/**
 * Secure Runtime Alpha 476 ("Publish Scheduler Tick Design") / Alpha
 * 477 ("Scheduler Lifecycle Model") — Stages 6–7 of the Alpha 471–480
 * Canonical Publish Scheduler Foundation Arc.
 *
 * `FedosPublishScheduler` periodically flows PENDING Outbox intents
 * (`FedosBoardOutboxPersistence.listIntents()`, Alpha 417) to an
 * injected `FedosBoardOutboxPublisher` (`./fedos_board_outbox_publisher.ts`,
 * Alpha 473), recording `FedosBoardOutboxObservation`s
 * (`./fedos_board_outbox_observation.ts`, Alpha 475) for every attempt.
 * It owns CADENCE, ORCHESTRATION, and RETRY-DIRECTIVE APPLICATION ONLY
 * — never signing, never transport, never protocol-specific delivery,
 * never backoff-duration computation (see
 * `docs/secure_runtime_alpha_472_scheduler_responsibility_decision.md`).
 *
 * Retry is governed EXACTLY by the `FedosBoardOutboxPublishResult.retryPolicy`
 * the injected `Publisher` itself returns — `"immediate" | "later" |
 * "never"`, this Arc's own required constraint, no exponential backoff
 * or scheduled-delay computation anywhere in this file (see
 * `docs/secure_runtime_alpha_474_retry_policy_model.md`):
 *   - `"immediate"`: ONE additional same-`tick()` re-attempt. If that
 *     second attempt ALSO returns `"immediate"`, it is downgraded to
 *     `"later"` before being acted on — a hard, undocumented-nowhere-
 *     else guardrail that bounds every `tick()` call to at most two
 *     `Publisher.publish()` calls per pending intent, guaranteeing
 *     `tick()` always terminates.
 *   - `"later"`: the intent stays pending; the NEXT `tick()` call (not
 *     this one) will attempt it again. No delay is scheduled — cadence
 *     is entirely `intervalMs`, this Scheduler's own single knob.
 *   - `"never"`: the intent is marked abandoned, in memory, for the
 *     lifetime of this Scheduler instance, and is never attempted again
 *     by `tick()`.
 *
 * Secure Runtime Alpha 561–580 ("Publish Scheduler Concurrency Safety &
 * Abandonment Policy Arc") adds TWO closures, additive only, to the
 * above, unchanged model:
 *   - `tick()` is now SINGLE-FLIGHT (Alpha 563) — see its own doc
 *     comment. Closes the real, reproducible double-publish race Alpha
 *     549 proved.
 *   - An OPTIONAL, injected `abandonmentPolicy` (Alpha 566/568,
 *     `./fedos_board_outbox_abandonment_policy.ts`) is now consulted, in
 *     ADDITION to the Publisher's own `"never"`, whenever a completed
 *     attempt is not `"delivered"` — closing Alpha 551's own finding
 *     that a permanently-crashing/malformed-result Publisher was
 *     retried forever with no Scheduler-level bound. Omitted by
 *     default, reproducing the exact prior behavior unchanged.
 *
 * `start()`/`stop()`/`tick()` are ALL this Arc permits creating; `tick()`
 * is public specifically so callers (and this Arc's own tests) can
 * drive exactly one pass without depending on a real timer.
 *
 * HARD GUARDRAILS:
 *   - No import from `../../nostr/*`, `../../desktop/*`, `../*` (Board
 *     core), or any Relay/signing/transport/Ontology/p2p/GUI file
 *     anywhere in this file — only `./fedos_board_outbox_persistence.js`,
 *     `./fedos_board_outbox_codec.js`, `./fedos_board_outbox_publisher.js`,
 *     `./fedos_board_outbox_observation.js`, and (Alpha 561–580)
 *     `./fedos_board_outbox_abandonment_policy.js` — itself bound by the
 *     same guardrail, see that file's own header.
 *   - No default `Publisher` implementation is constructed here — the
 *     caller MUST inject one; there is no Nostr/ActivityPub/AT Protocol/
 *     Session fallback of any kind.
 *   - Observations are NOT persisted — `tick()` returns them; durable
 *     storage remains deferred (Alpha 475).
 *   - The constructor never starts a timer, never calls `Publisher`,
 *     never reads the Outbox — matching this repository's own
 *     established "no auto-load at startup" construction discipline
 *     (`docs/runtime_explicit_crypto_initialization.md` Rule #1).
 */

import type { FedosBoardOutboxPersistence } from "./fedos_board_outbox_persistence.js";
import type { FedosPersistedBoardOutboxRecordV1 } from "./fedos_board_outbox_codec.js";
import {
  isValidFedosBoardOutboxPublishResult,
  type FedosBoardOutboxPublisher,
  type FedosBoardOutboxPublishResult,
} from "./fedos_board_outbox_publisher.js";
import {
  createFedosBoardOutboxObservation,
  type FedosBoardOutboxObservation,
  type FedosBoardOutboxObservationKind,
} from "./fedos_board_outbox_observation.js";
import type { FedosBoardOutboxId } from "./fedos_board_outbox_types.js";
import type { FedosDeliveryAbandonmentPolicy } from "./fedos_board_outbox_abandonment_policy.js";

export interface FedosPublishSchedulerDependencies {
  readonly outboxPersistence: FedosBoardOutboxPersistence;
  readonly publisher: FedosBoardOutboxPublisher;
  /** Tick cadence in milliseconds. Must be a positive, finite integer. */
  readonly intervalMs: number;
  readonly now?: () => number;
  /** Defaults to the global `setInterval`. Injectable so tests never depend on a real timer. */
  readonly setIntervalFn?: (handler: () => void, intervalMs: number) => unknown;
  /** Defaults to the global `clearInterval`. */
  readonly clearIntervalFn?: (handle: unknown) => void;
  /**
   * Secure Runtime Alpha 566/568 (Alpha 561–580 Arc) — OPTIONAL,
   * consulted only when a completed attempt's own `retryPolicy` was NOT
   * already `"never"`. Omitted entirely by default: this Scheduler
   * ships no default abandonment policy of its own (see
   * `./fedos_board_outbox_abandonment_policy.ts` for why no number is
   * invented here), so omitting this field reproduces the exact,
   * unchanged "retry forever until the Publisher itself says `never`"
   * behavior every prior Arc already relied on.
   */
  readonly abandonmentPolicy?: FedosDeliveryAbandonmentPolicy;
  /**
   * Secure Runtime Alpha 585/587 (Alpha 581–600 Durable Retry Registry
   * & Delivery Recovery Arc) — OPTIONAL. A caller (`FedosDesktopHost.startDelivery()`)
   * that has already hydrated recovery state from durable Observation
   * history (`fedos_delivery_recovery_hydration.ts`) seeds a FRESH
   * Scheduler with it here, so an already-`"accepted"` intent is never
   * re-attempted after a restart. Omitted entirely by default —
   * reproduces the exact, unchanged "every intent starts pending"
   * behavior every prior Arc already relied on. Defensively copied into
   * a fresh `Set`, never the caller's own reference.
   */
  readonly initialDelivered?: ReadonlySet<string>;
  /**
   * Secure Runtime Alpha 585/588 (Alpha 581–600 Arc) — OPTIONAL, the
   * `initialDelivered` counterpart for already-abandoned intents (see
   * above). Omitted by default.
   */
  readonly initialAbandoned?: ReadonlySet<string>;
  /**
   * Secure Runtime Alpha 585 (Alpha 581–600 Arc) — OPTIONAL. Seeds
   * `#completedAttempts` (Alpha 568) for an intent that is neither
   * delivered nor abandoned yet (still genuinely pending, mid-retry) so
   * an injected `abandonmentPolicy`'s own bound is not silently reset
   * to zero by a restart. Omitted by default.
   */
  readonly initialCompletedAttempts?: ReadonlyMap<string, number>;
}

export interface FedosPublishSchedulerTickEntry {
  readonly intent: FedosPersistedBoardOutboxRecordV1;
  readonly result: FedosBoardOutboxPublishResult;
  readonly observations: readonly FedosBoardOutboxObservation[];
}

function isPositiveIntegerMs(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

const FAILED_LATER_RESULT: FedosBoardOutboxPublishResult = { outcome: "failed", retryPolicy: "later" };

export class FedosPublishScheduler {
  readonly #outboxPersistence: FedosBoardOutboxPersistence;
  readonly #publisher: FedosBoardOutboxPublisher;
  readonly #intervalMs: number;
  readonly #now: () => number;
  readonly #setIntervalFn: (handler: () => void, intervalMs: number) => unknown;
  readonly #clearIntervalFn: (handle: unknown) => void;
  readonly #abandonmentPolicy?: FedosDeliveryAbandonmentPolicy;

  readonly #delivered: Set<string>;
  readonly #abandoned: Set<string>;
  readonly #completedAttempts: Map<string, number>;
  readonly #observationLog: FedosBoardOutboxObservation[] = [];

  #timerHandle: unknown = undefined;
  #running = false;
  /** Secure Runtime Alpha 563 (Alpha 561–580 Arc) single-flight guard — see `tick()`. */
  #tickInFlight: Promise<readonly FedosPublishSchedulerTickEntry[]> | null = null;

  constructor(dependencies: FedosPublishSchedulerDependencies) {
    if (!isPositiveIntegerMs(dependencies.intervalMs)) {
      throw new Error("FedosPublishScheduler requires a positive, finite integer intervalMs.");
    }
    this.#outboxPersistence = dependencies.outboxPersistence;
    this.#publisher = dependencies.publisher;
    this.#intervalMs = dependencies.intervalMs;
    this.#now = dependencies.now ?? Date.now;
    this.#setIntervalFn = dependencies.setIntervalFn ?? ((handler, ms) => setInterval(handler, ms));
    this.#clearIntervalFn = dependencies.clearIntervalFn ?? ((handle) => clearInterval(handle as Parameters<typeof clearInterval>[0]));
    this.#abandonmentPolicy = dependencies.abandonmentPolicy;
    this.#delivered = new Set(dependencies.initialDelivered ?? []);
    this.#abandoned = new Set(dependencies.initialAbandoned ?? []);
    this.#completedAttempts = new Map(dependencies.initialCompletedAttempts ?? []);
  }

  isRunning(): boolean {
    return this.#running;
  }

  /** Fresh array each call — caller mutation cannot affect internal state. */
  observationLog(): readonly FedosBoardOutboxObservation[] {
    return [...this.#observationLog];
  }

  /**
   * Throws if already running — mirrors `FedosDesktopHost.start()`'s own
   * "may only be called once, from the [stopped] state" convention
   * (`../../desktop/host/fedos_desktop_host.ts`, Alpha 400).
   */
  start(): void {
    if (this.#running) {
      throw new Error("FedosPublishScheduler.start() may only be called from the stopped state.");
    }
    this.#running = true;
    this.#timerHandle = this.#setIntervalFn(() => {
      void this.tick();
    }, this.#intervalMs);
  }

  /** Idempotent — calling `stop()` when not running is a harmless no-op. */
  stop(): void {
    if (!this.#running) return;
    this.#clearIntervalFn(this.#timerHandle);
    this.#timerHandle = undefined;
    this.#running = false;
  }

  /**
   * Runs exactly one pass over every currently pending Outbox intent —
   * callable directly regardless of `start()`/`stop()` state, per this
   * Arc's own instruction that `tick()` be a Public method in its own
   * right. Never throws for a `Publisher`-side problem: a rejecting or
   * malformed `publish()` call is treated as `{ outcome: "failed",
   * retryPolicy: "later" }`, fail-closed, never propagated.
   *
   * Secure Runtime Alpha 563 (Alpha 561–580 Publish Scheduler
   * Concurrency Safety & Abandonment Policy Arc) — SINGLE-FLIGHT: if a
   * previous `tick()` call is still in flight (from `start()`'s own
   * interval firing again before the prior pass resolved, OR from a
   * second direct `tick()` call), this call returns the SAME in-flight
   * `Promise` rather than starting a second, overlapping pass — Option
   * B from `docs/secure_runtime_alpha_562_single_flight_semantics_decision.md`.
   * Closes the real, reproducible double-publish race Alpha 549 proved
   * (`docs/secure_runtime_alpha_549_publish_runtime_thread_safety_audit.md`):
   * `#delivered`/`#abandoned` are only updated AFTER an attempt's own
   * `await` resolves, so two overlapping passes previously both listed
   * the SAME pending intent and both called `Publisher.publish()` on
   * it. The guard is released in `finally`, so a caller-side throw/
   * reject never leaves the Scheduler permanently unable to tick again.
   */
  tick(): Promise<readonly FedosPublishSchedulerTickEntry[]> {
    if (this.#tickInFlight !== null) return this.#tickInFlight;
    const run = this.#runTick();
    this.#tickInFlight = run;
    // `.finally()` returns a NEW, separate Promise that also rejects if
    // `run` does -- caught here (distinct from the `run` Promise itself,
    // which is what callers actually receive and may or may not await/
    // catch on their own) purely so a rejecting `run` never surfaces as
    // an unhandled rejection on THIS internal bookkeeping chain.
    run.finally(() => {
      this.#tickInFlight = null;
    }).catch(() => undefined);
    return run;
  }

  async #runTick(): Promise<readonly FedosPublishSchedulerTickEntry[]> {
    const pending = this.#outboxPersistence
      .listIntents()
      .filter((record) => !this.#delivered.has(record.id) && !this.#abandoned.has(record.id));

    const entries: FedosPublishSchedulerTickEntry[] = [];
    for (const intent of pending) {
      entries.push(await this.#attemptIntent(intent));
    }
    return entries;
  }

  async #attemptIntent(intent: FedosPersistedBoardOutboxRecordV1): Promise<FedosPublishSchedulerTickEntry> {
    const observations: FedosBoardOutboxObservation[] = [];

    const first = await this.#attemptOnce(intent);
    observations.push(...first.observations);
    let result = first.result;

    if (result.outcome !== "delivered" && result.retryPolicy === "immediate") {
      const second = await this.#attemptOnce(intent);
      observations.push(...second.observations);
      result =
        second.result.outcome !== "delivered" && second.result.retryPolicy === "immediate"
          ? { ...second.result, retryPolicy: "later" }
          : second.result;
    }

    if (result.outcome === "delivered") {
      this.#delivered.add(intent.id);
      this.#completedAttempts.delete(intent.id);
    } else {
      const completedAttempts = (this.#completedAttempts.get(intent.id) ?? 0) + 1;
      this.#completedAttempts.set(intent.id, completedAttempts);

      const abandonedByPublisher = result.retryPolicy === "never";
      const abandonedByPolicy =
        !abandonedByPublisher &&
        this.#abandonmentPolicy !== undefined &&
        this.#abandonmentPolicy.evaluate({
          outboxId: intent.id as FedosBoardOutboxId,
          completedAttempts,
          latestOutcome: result.outcome,
        }) === "abandon";

      if (abandonedByPublisher || abandonedByPolicy) {
        this.#abandoned.add(intent.id);
        this.#completedAttempts.delete(intent.id);
        observations.push(this.#observe(intent.id, "abandoned", result.reason));
      }
    }

    this.#observationLog.push(...observations);
    return { intent, result, observations };
  }

  async #attemptOnce(
    intent: FedosPersistedBoardOutboxRecordV1,
  ): Promise<{ result: FedosBoardOutboxPublishResult; observations: FedosBoardOutboxObservation[] }> {
    const observations: FedosBoardOutboxObservation[] = [this.#observe(intent.id, "attempt-started")];

    let raw: unknown;
    try {
      raw = await this.#publisher.publish(intent);
    } catch {
      raw = undefined;
    }
    const result = isValidFedosBoardOutboxPublishResult(raw) ? raw : FAILED_LATER_RESULT;

    const kind: FedosBoardOutboxObservationKind =
      result.outcome === "delivered" ? "delivered" : result.outcome === "rejected" ? "rejected" : "failed";
    observations.push(this.#observe(intent.id, kind, result.reason));

    return { result, observations };
  }

  #observe(outboxId: string, kind: FedosBoardOutboxObservationKind, reason?: string): FedosBoardOutboxObservation {
    const observation = createFedosBoardOutboxObservation(
      outboxId as FedosBoardOutboxId,
      kind,
      this.#now(),
      reason,
    );
    if (observation === null) {
      throw new Error(`FedosPublishScheduler produced an invalid observation for outboxId ${outboxId}.`);
    }
    return observation;
  }
}
