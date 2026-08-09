/**
 * Secure Runtime Alpha 1471–1540 — Mailbox Delivery's durable scheduler.
 *
 * Mirrors `FedosPublishScheduler`'s own tick/single-flight/retry-directive
 * design (`../../board/outbox/fedos_publish_scheduler.ts`, Alpha
 * 476/561–580) as a NEW, parallel class — it cannot be imported directly
 * (that class is hard-bound to `FedosPersistedBoardOutboxRecordV1`/
 * `FedosBoardOutboxObservation`, and this arc's own instruction is
 * "reuse the architecture," never "redesign the existing Board-bound
 * class"). REUSES, by direct import, unchanged:
 *   - `FedosDeliveryRetryRegistry`/`makeFedosDeliveryAttemptSubjectId`/
 *     `toFedosDeliveryObservationSubjectId`/`encodeFedosDeliveryRetryReason`
 *     (`../../board/observation/*`) — the exact "Retry" machinery
 *     `FedosHostDeliveryController`
 *     (`../../desktop/host/fedos_host_delivery_controller.ts`, Alpha
 *     505/506/529) already established: each PUBLISH ATTEMPT of one
 *     logical Outbox intent gets its own fresh, attempt-scoped subject
 *     id, so the transition graph's own "one publishing→terminal pair
 *     per subject" rule (`fedos_delivery_observation_transition_graph.ts`,
 *     Alpha 494, UNCHANGED) is satisfied per attempt, never violated
 *     across retries.
 *   - `FedosValidatingDeliveryObservationRepository`
 *     (`../../board/observation/fedos_delivery_observation_write_validator.ts`,
 *     Alpha 495) as the injected write boundary — this class never
 *     writes to a raw `FedosDeliveryObservationRepository` directly.
 *
 * Unlike Board's Scheduler+Controller split (a Scheduler producing its
 * own `FedosBoardOutboxObservation` vocabulary, later bridged to the
 * canonical one by a separate Controller), this class writes canonical
 * `FedosDeliveryObservationState` facts directly — one fewer bridging
 * layer, since Mailbox Delivery has no Board-outbox-scoped vocabulary of
 * its own to reconcile.
 *
 * HARD GUARDRAILS (mirrors Alpha 476/561–580):
 *   - `tick()` is SINGLE-FLIGHT — a second call while one is already in
 *     flight returns the SAME `Promise`.
 *   - No default `Publisher`/`retryRegistry`/`observationRepository` is
 *     constructed here — the caller MUST inject each.
 *   - The constructor never starts a timer, never calls `Publisher`,
 *     never reads the Outbox.
 */

import type { FedosConversationTransportOutboxPersistence } from "./fedos_conversation_transport_outbox_persistence.js";
import type { FedosPersistedConversationTransportOutboxRecord } from "./fedos_conversation_transport_outbox_codec.js";
import {
  isValidFedosConversationTransportPublishResult,
  type FedosConversationTransportPublisher,
  type FedosConversationTransportPublishResult,
} from "./fedos_conversation_transport_publisher.js";
import { toFedosDeliveryObservationSubjectId } from "../../../board/observation/fedos_delivery_observation.js";
import type { FedosDeliveryObservationState } from "../../../board/observation/fedos_delivery_observation.js";
import { FedosDeliveryRetryRegistry } from "../../../board/observation/fedos_delivery_retry_registry.js";
import { makeFedosDeliveryAttemptSubjectId } from "../../../board/observation/fedos_delivery_attempt_subject_id.js";
import { encodeFedosDeliveryRetryReason } from "../../../board/observation/fedos_delivery_retry_reason_codec.js";
import type { FedosValidatingDeliveryObservationRepository } from "../../../board/observation/fedos_delivery_observation_write_validator.js";

export interface FedosConversationTransportSchedulerDependencies {
  readonly outboxPersistence: FedosConversationTransportOutboxPersistence;
  readonly publisher: FedosConversationTransportPublisher;
  readonly observationRepository: FedosValidatingDeliveryObservationRepository;
  /** Tick cadence in milliseconds. Must be a positive, finite integer. */
  readonly intervalMs: number;
  readonly now?: () => number;
  readonly setIntervalFn?: (handler: () => void, intervalMs: number) => unknown;
  readonly clearIntervalFn?: (handle: unknown) => void;
  /**
   * OPTIONAL — a fresh `FedosDeliveryRetryRegistry` is constructed when
   * omitted. A caller that survives a `stop()`/`start()` cycle for the
   * SAME still-pending intents (`FedosPrivateTransport`) should inject
   * ONE persistent instance across every Scheduler it constructs,
   * mirroring `FedosDesktopHost`'s own `#deliveryRetryRegistry` field
   * (Alpha 531).
   */
  readonly retryRegistry?: FedosDeliveryRetryRegistry;
  readonly initialDelivered?: ReadonlySet<string>;
  readonly initialAbandoned?: ReadonlySet<string>;
}

export interface FedosConversationTransportSchedulerTickEntry {
  readonly intent: FedosPersistedConversationTransportOutboxRecord;
  readonly result: FedosConversationTransportPublishResult;
}

function isPositiveIntegerMs(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

const FAILED_LATER_RESULT: FedosConversationTransportPublishResult = { outcome: "failed", retryPolicy: "later" };

export class FedosConversationTransportScheduler {
  readonly #outboxPersistence: FedosConversationTransportOutboxPersistence;
  readonly #publisher: FedosConversationTransportPublisher;
  readonly #observationRepository: FedosValidatingDeliveryObservationRepository;
  readonly #intervalMs: number;
  readonly #now: () => number;
  readonly #setIntervalFn: (handler: () => void, intervalMs: number) => unknown;
  readonly #clearIntervalFn: (handle: unknown) => void;
  readonly #retryRegistry: FedosDeliveryRetryRegistry;

  readonly #delivered: Set<string>;
  readonly #abandoned: Set<string>;

  #timerHandle: unknown = undefined;
  #running = false;
  #tickInFlight: Promise<readonly FedosConversationTransportSchedulerTickEntry[]> | null = null;

  constructor(dependencies: FedosConversationTransportSchedulerDependencies) {
    if (!isPositiveIntegerMs(dependencies.intervalMs)) {
      throw new Error("FedosConversationTransportScheduler requires a positive, finite integer intervalMs.");
    }
    this.#outboxPersistence = dependencies.outboxPersistence;
    this.#publisher = dependencies.publisher;
    this.#observationRepository = dependencies.observationRepository;
    this.#intervalMs = dependencies.intervalMs;
    this.#now = dependencies.now ?? Date.now;
    this.#setIntervalFn = dependencies.setIntervalFn ?? ((handler, ms) => setInterval(handler, ms));
    this.#clearIntervalFn = dependencies.clearIntervalFn ?? ((handle) => clearInterval(handle as Parameters<typeof clearInterval>[0]));
    this.#retryRegistry = dependencies.retryRegistry ?? new FedosDeliveryRetryRegistry();
    this.#delivered = new Set(dependencies.initialDelivered ?? []);
    this.#abandoned = new Set(dependencies.initialAbandoned ?? []);
  }

  isRunning(): boolean {
    return this.#running;
  }

  start(): void {
    if (this.#running) {
      throw new Error("FedosConversationTransportScheduler.start() may only be called from the stopped state.");
    }
    this.#running = true;
    this.#timerHandle = this.#setIntervalFn(() => {
      void this.tick();
    }, this.#intervalMs);
  }

  stop(): void {
    if (!this.#running) return;
    this.#clearIntervalFn(this.#timerHandle);
    this.#timerHandle = undefined;
    this.#running = false;
  }

  tick(): Promise<readonly FedosConversationTransportSchedulerTickEntry[]> {
    if (this.#tickInFlight !== null) return this.#tickInFlight;
    const run = this.#runTick();
    this.#tickInFlight = run;
    run.finally(() => {
      this.#tickInFlight = null;
    }).catch(() => undefined);
    return run;
  }

  async #runTick(): Promise<readonly FedosConversationTransportSchedulerTickEntry[]> {
    const pending = this.#outboxPersistence
      .listIntents()
      .filter((record) => !this.#delivered.has(record.id) && !this.#abandoned.has(record.id));

    const entries: FedosConversationTransportSchedulerTickEntry[] = [];
    for (const intent of pending) {
      entries.push(await this.#attemptIntent(intent));
    }
    return entries;
  }

  async #attemptIntent(
    intent: FedosPersistedConversationTransportOutboxRecord,
  ): Promise<FedosConversationTransportSchedulerTickEntry> {
    const first = await this.#attemptOnce(intent);
    let result = first;

    if (result.outcome !== "delivered" && result.retryPolicy === "immediate") {
      const second = await this.#attemptOnce(intent);
      result = second.outcome !== "delivered" && second.retryPolicy === "immediate" ? { ...second, retryPolicy: "later" } : second;
    }

    if (result.outcome === "delivered") {
      this.#delivered.add(intent.id);
    } else if (result.retryPolicy === "never") {
      this.#abandoned.add(intent.id);
    }

    return { intent, result };
  }

  /** One publish attempt: allocates a fresh attempt-scoped subject id, records `publishing` then the terminal fact. */
  async #attemptOnce(intent: FedosPersistedConversationTransportOutboxRecord): Promise<FedosConversationTransportPublishResult> {
    const originalSubjectId = toFedosDeliveryObservationSubjectId(intent.id);
    if (originalSubjectId === null) return FAILED_LATER_RESULT;

    const attemptNumber = this.#retryRegistry.nextAttemptNumber(originalSubjectId);
    const attemptSubjectId = makeFedosDeliveryAttemptSubjectId(originalSubjectId, attemptNumber);
    if (attemptSubjectId === null) return FAILED_LATER_RESULT;

    const startedAt = this.#now();
    this.#observationRepository.record(attemptSubjectId, "publishing", startedAt);

    let raw: unknown;
    try {
      raw = await this.#publisher.publish(intent);
    } catch {
      raw = undefined;
    }
    const result = isValidFedosConversationTransportPublishResult(raw) ? raw : FAILED_LATER_RESULT;

    const state: FedosDeliveryObservationState =
      result.outcome === "delivered" ? "accepted" : result.outcome === "rejected" ? "rejected" : "failed";
    const isFinal = result.outcome === "delivered" || result.retryPolicy === "never";
    const reason = encodeFedosDeliveryRetryReason(isFinal, result.reason ?? null);
    this.#observationRepository.record(attemptSubjectId, state, this.#now(), reason);

    return result;
  }
}
