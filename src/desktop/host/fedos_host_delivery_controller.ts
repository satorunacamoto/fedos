/**
 * Secure Runtime Alpha 505 ("Delivery Controller Tick Loop") / Alpha
 * 506 ("Delivery Controller Shutdown Ordering") — Stages 5–6 of the
 * Alpha 501–520 Durable Delivery Observation Wiring & Host Delivery
 * Lifecycle Arc.
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
import { fedosBoardOutboxObservationToDeliveryObservation } from "../../board/outbox/fedos_board_outbox_observation_to_delivery_observation.js";
import { toFedosDeliveryObservationSubjectId } from "../../board/observation/fedos_delivery_observation.js";
import type { FedosValidatingDeliveryObservationRepository } from "../../board/observation/fedos_delivery_observation_write_validator.js";

export interface FedosHostDeliveryControllerDependencies {
  readonly scheduler: FedosPublishScheduler;
  readonly observationRepository: FedosValidatingDeliveryObservationRepository;
  /** Tick cadence in milliseconds. Must be a positive, finite integer. */
  readonly intervalMs: number;
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
      const subjectId = toFedosDeliveryObservationSubjectId(entry.intent.id);
      if (subjectId === null) continue;
      for (const observation of entry.observations) {
        const canonical = fedosBoardOutboxObservationToDeliveryObservation(observation, subjectId);
        if (canonical === null) continue;
        this.#observationRepository.record(canonical.subjectId, canonical.state, canonical.observedAt, canonical.reason);
      }
    }
    return entries;
  }
}
