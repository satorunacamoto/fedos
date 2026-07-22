/**
 * Secure Runtime Alpha 3721–3800 ("Background Device Sync Scheduling and
 * Conflict Resolution") — the Device Sync Scheduler (Phase B/C/D/E/G).
 *
 * OWNS: schedule state (`FedosDeviceSyncSchedulePersistence`), the next
 * eligible attempt time per Schedule, an in-flight single-flight guard,
 * target-Device planning (`fedos_device_sync_target_planning.ts`), retry
 * decisions (`fedos_device_sync_retry_policy.ts`), Observation recording
 * (delegated to whatever the injected `attemptFn` itself records — this
 * class does not construct or require its own Observation repository),
 * and shutdown waiting.
 *
 * DOES NOT OWN (Phase B's own explicit list): Device trust truth (reads
 * `FedosDeviceRegistryPersistence`, never mutates it), Sync Journal truth
 * (reads `FedosSyncState`, never bypasses `applyPendingChanges()`), Relay
 * identity truth (depends on the narrow, injected `FedosDeviceSyncAttemptFn`
 * boundary — see `fedos_device_sync_attempt.ts` — never imports Relay Sync
 * internals directly), crypto secrets (touches none), canonical
 * Conversation state (touches none).
 *
 * Dependency injection throughout; NO global singleton anywhere in this
 * file or this Arc.
 *
 * ACTIVATION (Phase C): default DISABLED — the constructor never starts a
 * timer. `startSync()` throws if already running (repeated start
 * EXPLICITLY REJECTED, mirroring `FedosConversationTransportScheduler.start()`'s
 * own established contract). `stopSync()` is ASYNC and WAITS for any
 * in-flight tick before returning (a real addition beyond that established
 * pattern, per this Arc's own explicit "stop waits for in-flight tick"
 * requirement) and is safe to call repeatedly (a no-op once already
 * stopped). Every OTHER tick-triggering operation (`tickSync()`/
 * `triggerSyncNow()`) is DENIED while not running — "operation after stop
 * denied." `syncStatus()` remains available regardless of running state
 * (a read-only query).
 *
 * SINGLE-FLIGHT (Phase D): `tickSync()` and `triggerSyncNow()` share the
 * IDENTICAL guard as the interval timer's own tick — a second call while
 * one is already in flight returns the SAME `Promise`, mirroring
 * `FedosConversationTransportScheduler.tick()` exactly.
 */

import type { FedosDeviceSyncSchedulePersistence } from "./persistence/fedos_device_sync_schedule_persistence.js";
import type { FedosDeviceRegistryPersistence } from "../persistence/fedos_device_registry_persistence.js";
import type { FedosDeviceBindingAccountRef } from "../fedos_device_binding.js";
import type { FedosSyncState } from "../../sync/fedos_sync_state.js";
import { planFedosDeviceSyncTargets } from "./fedos_device_sync_target_planning.js";
import {
  classifyFedosDeviceSyncRetryDirective,
  isWellFormedFedosDeviceSyncAbandonmentPolicy,
  type FedosDeviceSyncAbandonmentPolicy,
  type FedosDeviceSyncAttemptOutcomeCode,
  type FedosDeviceSyncRetryDirective,
} from "./fedos_device_sync_retry_policy.js";
import type { FedosDeviceSyncAttemptFn } from "./fedos_device_sync_attempt.js";
import {
  createPendingFedosDeviceSyncSchedule,
  isFedosDeviceSyncScheduleTerminal,
  type FedosDeviceSyncScheduleV1,
} from "./fedos_device_sync_schedule.js";
import { isWellFormedFedosDeviceSyncResourceLimits, type FedosDeviceSyncResourceLimits, FEDOS_DEVICE_SYNC_DEFAULT_RESOURCE_LIMITS } from "./fedos_device_sync_resource_limits.js";
import {
  FedosSecureRandomDeviceBindingChallengeNonceGenerator,
  type FedosDeviceBindingChallengeNonceGenerator,
} from "../binding_challenge/fedos_device_binding_challenge.js";

export interface FedosDeviceSyncSchedulerDeps {
  readonly schedulePersistence: FedosDeviceSyncSchedulePersistence;
  readonly registryPersistence: FedosDeviceRegistryPersistence;
  readonly accountRef: FedosDeviceBindingAccountRef;
  readonly sourceDeviceId: string;
  readonly syncState: FedosSyncState;
  readonly attemptFn: FedosDeviceSyncAttemptFn;
  readonly abandonmentPolicy: FedosDeviceSyncAbandonmentPolicy;
  readonly limits?: FedosDeviceSyncResourceLimits;
  readonly nonceGenerator?: FedosDeviceBindingChallengeNonceGenerator;
  /** Tick cadence in milliseconds. Must be a positive, finite integer. */
  readonly intervalMs: number;
  readonly now?: () => number;
  readonly setIntervalFn?: (handler: () => void, intervalMs: number) => unknown;
  readonly clearIntervalFn?: (handle: unknown) => void;
}

export interface FedosDeviceSyncTickEntry {
  readonly scheduleId: string;
  readonly targetDeviceId: string;
  readonly outcome: FedosDeviceSyncAttemptOutcomeCode;
  readonly directive: FedosDeviceSyncRetryDirective;
}

export interface FedosDeviceSyncSchedulerStatus {
  readonly running: boolean;
  readonly tickInFlight: boolean;
  readonly scheduleCount: number;
  readonly pendingCount: number;
  readonly inProgressCount: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly operatorRequiredCount: number;
}

function isPositiveIntegerMs(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

function defaultNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export class FedosDeviceSyncScheduler {
  readonly #deps: FedosDeviceSyncSchedulerDeps;
  readonly #limits: FedosDeviceSyncResourceLimits;
  readonly #nonceGenerator: FedosDeviceBindingChallengeNonceGenerator;
  readonly #now: () => number;
  readonly #setIntervalFn: (handler: () => void, intervalMs: number) => unknown;
  readonly #clearIntervalFn: (handle: unknown) => void;

  #running = false;
  #timerHandle: unknown = undefined;
  #tickInFlight: Promise<readonly FedosDeviceSyncTickEntry[]> | null = null;

  constructor(deps: FedosDeviceSyncSchedulerDeps) {
    if (!isPositiveIntegerMs(deps.intervalMs)) {
      throw new Error("FedosDeviceSyncScheduler requires a positive, finite integer intervalMs.");
    }
    if (!isWellFormedFedosDeviceSyncAbandonmentPolicy(deps.abandonmentPolicy)) {
      throw new Error("FedosDeviceSyncScheduler requires an explicit, well-formed abandonmentPolicy -- no arbitrary default retry count exists in this file.");
    }
    const limits = deps.limits ?? FEDOS_DEVICE_SYNC_DEFAULT_RESOURCE_LIMITS;
    if (!isWellFormedFedosDeviceSyncResourceLimits(limits)) {
      throw new Error("FedosDeviceSyncScheduler requires well-formed resource limits.");
    }
    this.#deps = deps;
    this.#limits = limits;
    this.#nonceGenerator = deps.nonceGenerator ?? new FedosSecureRandomDeviceBindingChallengeNonceGenerator();
    this.#now = deps.now ?? defaultNowSeconds;
    this.#setIntervalFn = deps.setIntervalFn ?? ((handler, ms) => setInterval(handler, ms));
    this.#clearIntervalFn = deps.clearIntervalFn ?? ((handle) => clearInterval(handle as Parameters<typeof clearInterval>[0]));
  }

  isRunning(): boolean {
    return this.#running;
  }

  /** Default DISABLED -- no timer exists until this is called. Throws if already running (repeated start explicitly rejected). */
  startSync(): void {
    if (this.#running) {
      throw new Error("FedosDeviceSyncScheduler.startSync() may only be called from the stopped state.");
    }
    this.#running = true;
    this.#timerHandle = this.#setIntervalFn(() => {
      void this.tickSync();
    }, this.#deps.intervalMs);
  }

  /** Safe to call repeatedly (a no-op once already stopped). WAITS for any in-flight tick before returning -- an interval tick already running when `stopSync()` is called completes before this Promise resolves. */
  async stopSync(): Promise<void> {
    if (!this.#running) return;
    this.#clearIntervalFn(this.#timerHandle);
    this.#timerHandle = undefined;
    this.#running = false;
    if (this.#tickInFlight !== null) {
      await this.#tickInFlight.catch(() => undefined);
    }
  }

  /** Single-flight — a second call while one tick is already in flight returns the SAME Promise. Denied ("operation after stop denied") while not running. */
  tickSync(): Promise<readonly FedosDeviceSyncTickEntry[]> {
    if (!this.#running) {
      return Promise.reject(new Error("FedosDeviceSyncScheduler.tickSync() denied -- the Scheduler is not running."));
    }
    if (this.#tickInFlight !== null) return this.#tickInFlight;
    const run = this.#runTick();
    this.#tickInFlight = run;
    run.finally(() => {
      this.#tickInFlight = null;
    }).catch(() => undefined);
    return run;
  }

  /** An explicit manual trigger, sharing the IDENTICAL single-flight guard `tickSync()`/the interval timer already use. */
  triggerSyncNow(): Promise<readonly FedosDeviceSyncTickEntry[]> {
    return this.tickSync();
  }

  /** Always available, regardless of running state -- a read-only query, never gated by "operation after stop denied." */
  syncStatus(): FedosDeviceSyncSchedulerStatus {
    const schedules = this.#deps.schedulePersistence.listAllSchedules();
    const counts = { pending: 0, "in-progress": 0, completed: 0, failed: 0, "operator-required": 0 };
    for (const schedule of schedules) counts[schedule.state] += 1;
    return {
      running: this.#running,
      tickInFlight: this.#tickInFlight !== null,
      scheduleCount: schedules.length,
      pendingCount: counts.pending,
      inProgressCount: counts["in-progress"],
      completedCount: counts.completed,
      failedCount: counts.failed,
      operatorRequiredCount: counts["operator-required"],
    };
  }

  async #runTick(): Promise<readonly FedosDeviceSyncTickEntry[]> {
    const now = this.#now();
    this.#recoverInterruptedSchedules(now);

    const targetPlans = planFedosDeviceSyncTargets({
      registryPersistence: this.#deps.registryPersistence,
      accountRef: this.#deps.accountRef,
      sourceDeviceId: this.#deps.sourceDeviceId,
      syncState: this.#deps.syncState,
      limits: this.#limits,
    });

    const entries: FedosDeviceSyncTickEntry[] = [];
    let concurrentCount = 0;
    for (const plan of targetPlans) {
      if (concurrentCount >= this.#limits.maxConcurrentTransfersPerTick) break;
      const schedule = this.#findOrCreateSchedule(plan.targetDeviceId, plan.fromSequence, plan.toSequence, now);
      if (isFedosDeviceSyncScheduleTerminal(schedule)) continue;
      if (schedule.state === "in-progress") continue; // recovered above if truly interrupted; still in-progress means a genuine same-tick concurrency bug elsewhere -- skip defensively, never double-attempt.
      if (schedule.nextEligibleAt > now) continue;

      concurrentCount += 1;
      entries.push(await this.#attemptSchedule(schedule, now));
    }
    return entries;
  }

  /** Restart recovery (Phase M): any Schedule found still `"in-progress"` at the start of a tick was interrupted mid-attempt (a crash, or a process restart) -- moved back to `"pending"` so it becomes safely retryable, never silently stuck. */
  #recoverInterruptedSchedules(now: number): void {
    for (const schedule of this.#deps.schedulePersistence.listAllSchedules()) {
      if (schedule.state !== "in-progress") continue;
      this.#deps.schedulePersistence.putEvent({
        schemaVersion: 1,
        eventType: "retry-later",
        scheduleId: schedule.scheduleId,
        attemptCount: schedule.attemptCount,
        nextEligibleAt: now,
        coarseOutcome: "interrupted-recovered",
        at: now,
      });
    }
  }

  #findOrCreateSchedule(targetDeviceId: string, fromSequence: number, toSequence: number, now: number): FedosDeviceSyncScheduleV1 {
    const scheduleId = `${this.#deps.sourceDeviceId}:${targetDeviceId}:${fromSequence}:${toSequence}`;
    const existing = this.#deps.schedulePersistence.getSchedule(scheduleId);
    if (existing !== null) return existing;

    const created = createPendingFedosDeviceSyncSchedule({ scheduleId, sourceDeviceId: this.#deps.sourceDeviceId, targetDeviceId, fromSequence, toSequence, createdAt: now });
    this.#deps.schedulePersistence.putEvent({
      schemaVersion: 1,
      eventType: "created",
      scheduleId,
      sourceDeviceId: this.#deps.sourceDeviceId,
      targetDeviceId,
      fromSequence,
      toSequence,
      createdAt: now,
    });
    return created;
  }

  async #attemptSchedule(schedule: FedosDeviceSyncScheduleV1, now: number): Promise<FedosDeviceSyncTickEntry> {
    const transferSessionId = schedule.transferSessionId ?? this.#nonceGenerator.generateNonce();
    const attemptCount = schedule.attemptCount + 1;
    this.#deps.schedulePersistence.putEvent({
      schemaVersion: 1,
      eventType: "attempt-started",
      scheduleId: schedule.scheduleId,
      attemptCount,
      transferSessionId,
      at: now,
    });

    let result;
    try {
      result = await this.#deps.attemptFn({
        scheduleId: schedule.scheduleId,
        sourceDeviceId: schedule.sourceDeviceId,
        targetDeviceId: schedule.targetDeviceId,
        fromSequence: schedule.fromSequence,
        toSequence: schedule.toSequence,
        attemptNumber: attemptCount,
        transferSessionId,
      });
    } catch {
      result = { outcome: "failed" as FedosDeviceSyncAttemptOutcomeCode };
    }

    const directive = classifyFedosDeviceSyncRetryDirective(result.outcome);
    const coarseOutcome = result.reason !== undefined ? `${result.outcome}:${result.reason}` : result.outcome;

    if (result.outcome === "delivered") {
      this.#deps.schedulePersistence.putEvent({ schemaVersion: 1, eventType: "completed", scheduleId: schedule.scheduleId, coarseOutcome, at: now });
    } else if (directive === "never") {
      this.#deps.schedulePersistence.putEvent({ schemaVersion: 1, eventType: "failed", scheduleId: schedule.scheduleId, coarseOutcome, at: now });
    } else if (directive === "operator-required") {
      this.#deps.schedulePersistence.putEvent({ schemaVersion: 1, eventType: "operator-required", scheduleId: schedule.scheduleId, coarseOutcome, at: now });
    } else if (attemptCount >= this.#deps.abandonmentPolicy.maxAttempts) {
      this.#deps.schedulePersistence.putEvent({
        schemaVersion: 1,
        eventType: "operator-required",
        scheduleId: schedule.scheduleId,
        coarseOutcome: `abandoned-after-${attemptCount}-attempts:${coarseOutcome}`,
        at: now,
      });
    } else {
      this.#deps.schedulePersistence.putEvent({
        schemaVersion: 1,
        eventType: "retry-later",
        scheduleId: schedule.scheduleId,
        attemptCount,
        nextEligibleAt: now + this.#deps.abandonmentPolicy.laterDelaySeconds,
        coarseOutcome,
        at: now,
      });
    }

    return { scheduleId: schedule.scheduleId, targetDeviceId: schedule.targetDeviceId, outcome: result.outcome, directive };
  }
}
