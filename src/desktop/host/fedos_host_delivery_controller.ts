/**
 * Secure Runtime Alpha 505 ("Delivery Controller Tick Loop") / Alpha
 * 506 ("Delivery Controller Shutdown Ordering") — Stages 5–6 of the
 * Alpha 501–520 Durable Delivery Observation Wiring & Host Delivery
 * Lifecycle Arc. Secure Runtime Alpha 529 ("Controller Retry Rewiring")
 * — Stage 9 of the Alpha 521–540 Durable Delivery Retry Coordination
 * Arc — REWIRES `#runTickAndPersist()`'s own internal persistence logic
 * (only): each `FedosPublishSchedulerTickEntry.observations` array is
 * now grouped into individual ATTEMPTS (`#groupObservationsIntoAttempts`,
 * below) and each attempt is written under its OWN, fresh
 * `makeFedosDeliveryAttemptSubjectId(originalSubjectId, attemptNumber)`
 * (`../../board/observation/fedos_delivery_attempt_subject_id.js`,
 * Alpha 525) — resolving the `"invalid-transition"` collision Alpha
 * 514 documented, without loosening the transition graph or validator
 * (both Alpha 494/495, still completely UNCHANGED) at all. `start()`/
 * `stop()`/`tick()`/`isRunning()` and the shutdown-ordering guarantee
 * (Alpha 505/506) are UNTOUCHED by this Stage — only the private
 * persistence helper changes. `FedosHostDeliveryControllerDependencies`
 * is ALSO unchanged — the new `FedosDeliveryRetryRegistry` (Alpha 527)
 * this class now owns is constructed INTERNALLY, never injected, since
 * it is pure write-time bookkeeping no caller ever needs to override or
 * share.
 *
 * `FedosHostDeliveryController` drives an injected `FedosPublishScheduler`'s
 * (`../../board/outbox/fedos_publish_scheduler.js`, Alpha 476,
 * UNCHANGED) own PUBLIC `tick()` method directly on its OWN interval —
 * it NEVER calls `FedosPublishScheduler.start()`/`stop()`. See
 * `docs/secure_runtime_alpha_504_delivery_controller_design_decision.md`
 * for why: `FedosPublishScheduler.start()`'s own internal timer calls
 * `tick()` fire-and-forget, with no way for any external caller to
 * `await` a specific in-flight call — driving `tick()` directly is the
 * only way to honor the required "Scheduler停止 → tick終了待ち → Host
 * 停止" shutdown ordering without editing `FedosPublishScheduler` at
 * all.
 *
 * Alpha 505's own entire scope: `start()`. Begins its own interval
 * (injectable `setIntervalFn`, mirroring `FedosPublishScheduler`'s own
 * Alpha 476 pattern) — the FIRST `tick()` fires after one `intervalMs`
 * elapses, never immediately. A REENTRANCY GUARD skips a firing
 * entirely (never queues, never runs concurrently) while a previous
 * `tick()` is still in flight (`#currentTick !== null`). Each
 * `FedosPublishSchedulerTickEntry` `tick()` returns is bridged, per
 * `FedosBoardOutboxObservation`, via
 * `fedosBoardOutboxObservationToDeliveryObservation`
 * (`../../board/outbox/fedos_board_outbox_observation_to_delivery_observation.js`,
 * Alpha 497, UNCHANGED) and written via the injected
 * `FedosValidatingDeliveryObservationRepository.record()`
 * (`../../board/observation/fedos_delivery_observation_write_validator.js`,
 * Alpha 495, UNCHANGED) — every value written traces back to
 * `tick()`'s own return value; this class invents nothing.
 *
 * Alpha 506's own entire scope: `stop()`. Clears the interval FIRST (no
 * new tick can start), THEN `await`s `#currentTick` if one is in
 * flight, THEN resolves — the exact three-step ordering this Arc's own
 * "Shutdown" section requires, now genuinely enforceable because this
 * class, not `FedosPublishScheduler`, owns the timer.
 *
 * HARD GUARDRAILS:
 *   - `FedosHostDeliveryController` is the ONLY export besides its own
 *     dependencies interface.
 *   - `FedosPublishScheduler.start()`/`stop()` are called NOWHERE in
 *     this file — only `tick()`.
 *   - No retry, no backoff, no queue of skipped ticks — a skipped
 *     firing is simply dropped; the NEXT interval firing (not a
 *     buffered one) is the next attempt.
 *   - No Publisher import of any kind — this file reads `tick()`'s own
 *     output only, never calls `publish()`/`publishOne()` itself.
 *   - No Board, Outbox-mutation, or GUI reference of any kind.
 */

import type { FedosPublishScheduler, FedosPublishSchedulerTickEntry } from "../../board/outbox/fedos_publish_scheduler.js";
import type { FedosBoardOutboxObservation } from "../../board/outbox/fedos_board_outbox_observation.js";
import { fedosBoardOutboxObservationToDeliveryObservation } from "../../board/outbox/fedos_board_outbox_observation_to_delivery_observation.js";
import { toFedosDeliveryObservationSubjectId } from "../../board/observation/fedos_delivery_observation.js";
import type { FedosValidatingDeliveryObservationRepository } from "../../board/observation/fedos_delivery_observation_write_validator.js";
import { FedosDeliveryRetryRegistry } from "../../board/observation/fedos_delivery_retry_registry.js";
import { makeFedosDeliveryAttemptSubjectId } from "../../board/observation/fedos_delivery_attempt_subject_id.js";
import { encodeFedosDeliveryRetryReason } from "../../board/observation/fedos_delivery_retry_reason_codec.js";

export interface FedosHostDeliveryControllerDependencies {
  readonly scheduler: FedosPublishScheduler;
  readonly observationRepository: FedosValidatingDeliveryObservationRepository;
  /** Tick cadence in milliseconds. Must be a positive, finite integer. */
  readonly intervalMs: number;
  /**
   * Alpha 531 (ripple fix, discovered by this Arc's own end-to-end
   * verification) — OPTIONAL, defaulted to a FRESH `FedosDeliveryRetryRegistry`
   * when omitted, mirroring every other optional-dependency convention
   * in this repository. Passing the SAME registry across multiple
   * `FedosHostDeliveryController` instances (as `FedosDesktopHost.startDelivery()`
   * now does, Alpha 531) is what makes attempt numbering survive a
   * stop/start delivery cycle for the SAME still-pending intent — a
   * FRESH registry per instance (this class' own prior, pre-Alpha-531
   * behavior) silently re-used already-terminal attempt-scoped subject
   * ids after a restart, which the UNCHANGED validator correctly, but
   * silently, rejected as `"invalid-transition"` again.
   */
  readonly retryRegistry?: FedosDeliveryRetryRegistry;
  /** Defaults to the global `setInterval`. Injectable so tests never depend on a real timer. */
  readonly setIntervalFn?: (handler: () => void, intervalMs: number) => unknown;
  /** Defaults to the global `clearInterval`. */
  readonly clearIntervalFn?: (handle: unknown) => void;
}

function isPositiveIntegerMs(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

export class FedosHostDeliveryController {
  readonly #scheduler: FedosPublishScheduler;
  readonly #observationRepository: FedosValidatingDeliveryObservationRepository;
  readonly #intervalMs: number;
  readonly #setIntervalFn: (handler: () => void, intervalMs: number) => unknown;
  readonly #clearIntervalFn: (handle: unknown) => void;

  readonly #retryRegistry: FedosDeliveryRetryRegistry;

  #timerHandle: unknown = undefined;
  #running = false;
  #currentTick: Promise<readonly FedosPublishSchedulerTickEntry[]> | null = null;

  constructor(dependencies: FedosHostDeliveryControllerDependencies) {
    if (!isPositiveIntegerMs(dependencies.intervalMs)) {
      throw new Error("FedosHostDeliveryController requires a positive, finite integer intervalMs.");
    }
    this.#scheduler = dependencies.scheduler;
    this.#observationRepository = dependencies.observationRepository;
    this.#intervalMs = dependencies.intervalMs;
    this.#retryRegistry = dependencies.retryRegistry ?? new FedosDeliveryRetryRegistry();
    this.#setIntervalFn = dependencies.setIntervalFn ?? ((handler, ms) => setInterval(handler, ms));
    this.#clearIntervalFn = dependencies.clearIntervalFn ?? ((handle) => clearInterval(handle as Parameters<typeof clearInterval>[0]));
  }

  isRunning(): boolean {
    return this.#running;
  }

  /** Throws if already running — mirrors `FedosPublishScheduler.start()`'s own convention. */
  start(): void {
    if (this.#running) {
      throw new Error("FedosHostDeliveryController.start() may only be called from the stopped state.");
    }
    this.#running = true;
    this.#timerHandle = this.#setIntervalFn(() => {
      if (this.#currentTick !== null) return; // reentrancy guard -- never overlap, never queue.
      const tick = this.#runTickAndPersist();
      this.#currentTick = tick;
      void tick.finally(() => {
        this.#currentTick = null;
      });
    }, this.#intervalMs);
  }

  /**
   * Guarantees Scheduler停止 -> tick終了待ち -> resolves: clears the
   * interval first (no new tick can start), then awaits any in-flight
   * tick before returning.
   */
  async stop(): Promise<void> {
    if (!this.#running) {
      throw new Error("FedosHostDeliveryController.stop() may only be called from the running state.");
    }
    this.#clearIntervalFn(this.#timerHandle);
    this.#timerHandle = undefined;
    this.#running = false;
    if (this.#currentTick !== null) {
      await this.#currentTick;
    }
  }

  /** Runs exactly one tick pass immediately, without waiting for the interval -- for tests/manual driving. */
  async tick(): Promise<readonly FedosPublishSchedulerTickEntry[]> {
    return this.#runTickAndPersist();
  }

  async #runTickAndPersist(): Promise<readonly FedosPublishSchedulerTickEntry[]> {
    const entries = await this.#scheduler.tick();
    for (const entry of entries) {
      const originalSubjectId = toFedosDeliveryObservationSubjectId(entry.intent.id);
      if (originalSubjectId === null) continue;

      for (const attempt of groupFedosBoardOutboxObservationsIntoAttempts(entry.observations)) {
        const attemptNumber = this.#retryRegistry.nextAttemptNumber(originalSubjectId);
        const attemptSubjectId = makeFedosDeliveryAttemptSubjectId(originalSubjectId, attemptNumber);
        if (attemptSubjectId === null) continue;

        const startedCanonical = fedosBoardOutboxObservationToDeliveryObservation(attempt.started, attemptSubjectId);
        if (startedCanonical !== null) {
          this.#observationRepository.record(
            startedCanonical.subjectId,
            startedCanonical.state,
            startedCanonical.observedAt,
            startedCanonical.reason,
          );
        }

        const terminalCanonical = fedosBoardOutboxObservationToDeliveryObservation(attempt.terminal, attemptSubjectId);
        if (terminalCanonical !== null) {
          const reason = encodeFedosDeliveryRetryReason(attempt.isFinal, terminalCanonical.reason ?? null);
          this.#observationRepository.record(
            terminalCanonical.subjectId,
            terminalCanonical.state,
            terminalCanonical.observedAt,
            reason,
          );
        }
      }
    }
    return entries;
  }
}

/**
 * Secure Runtime Alpha 529 — groups ONE `FedosPublishSchedulerTickEntry.observations`
 * array (Alpha 476, UNCHANGED — always `attempt-started`, terminal,
 * [`attempt-started`, terminal], [`abandoned`], in that exact order,
 * per `#attemptIntent()`'s own unchanged body) into individual attempts.
 * An attempt is FINAL when its own terminal kind is `"delivered"`
 * (success is always final) or is immediately followed by an
 * `"abandoned"` entry (the Scheduler's own unchanged signal that no
 * further attempt will ever occur). Pure, synchronous, never throws —
 * a malformed/unexpected shape simply stops grouping early rather than
 * guessing.
 */
function groupFedosBoardOutboxObservationsIntoAttempts(
  observations: readonly FedosBoardOutboxObservation[],
): ReadonlyArray<{
  readonly started: FedosBoardOutboxObservation;
  readonly terminal: FedosBoardOutboxObservation;
  readonly isFinal: boolean;
}> {
  const attempts: Array<{ started: FedosBoardOutboxObservation; terminal: FedosBoardOutboxObservation; isFinal: boolean }> = [];
  let i = 0;
  while (i < observations.length) {
    const started = observations[i];
    const terminal = observations[i + 1];
    if (started === undefined || terminal === undefined || started.kind !== "attempt-started") break;
    i += 2;
    const abandonedFollows = observations[i]?.kind === "abandoned";
    if (abandonedFollows) i += 1;
    attempts.push({ started, terminal, isFinal: terminal.kind === "delivered" || abandonedFollows });
  }
  return attempts;
}
