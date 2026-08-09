/**
 * Secure Runtime Alpha 4421–4500 ("Desktop Device Sync Badge, Notification,
 * and Operational Event Wiring Arc") — Phase B: `FedosDeviceSyncEventBridge`.
 *
 * BRIDGE ONLY -- never owns business logic. Translates real
 * `FedosDeviceSyncScheduler` attempt activity (`../sync_scheduler/fedos_device_sync_scheduler.ts`,
 * Alpha 3721-3800, UNMODIFIED) into the closed `FedosDeviceSyncEvent`
 * vocabulary (`./fedos_device_sync_event.ts`). Constructs no persistence,
 * no crypto, no timer, no Scheduler, no Runtime of its own -- reuses
 * exactly what already exists.
 *
 * INTEGRATION POINT (Phase A finding, the SAME kind of "does the obvious
 * wiring actually work end-to-end" check the immediately-prior Arc's own
 * badge Coordinator had to make): `FedosDeviceSyncScheduler` exposes NO
 * event emitter, NO `on()`/`addListener()`, and no observable hook at all
 * on `startSync()`/`stopSync()`/`tickSync()`/`triggerSyncNow()` -- its
 * OWN interval timer calls `this.tickSync()` directly, entirely internal
 * to that file, unreachable from outside the instance. The ONE real,
 * already-designed extension seam the Scheduler DOES expose is
 * `FedosDeviceSyncSchedulerDeps.attemptFn` (`../sync_scheduler/fedos_device_sync_attempt.ts`'s
 * own header: "the Scheduler depends on this NARROW interface only").
 * `wrapAttemptFn()` below wraps whatever real (or omitted/fail-closed
 * default) `FedosDeviceSyncAttemptFn` a caller was going to supply to
 * `startFedosDesktopRuntime({ deviceSyncAttemptFn: ... })` (or directly to
 * `new FedosDeviceSyncScheduler({ attemptFn: ... })`) with an IDENTICAL
 * function that observes every real attempt -- interval-triggered AND
 * manually-triggered alike, since BOTH paths call the SAME injected
 * `attemptFn` -- and returns the SAME result, byte-for-byte, to the real
 * caller. This is the ONLY integration technique this file uses: no
 * monkey-patching of the Scheduler instance, no subclassing, no reflection
 * into its private fields.
 *
 * HONEST SCOPE BOUNDARY (disclosed, not papered over): because the ONLY
 * hook available is per-ATTEMPT (one `(scheduleId, targetDeviceId,
 * attemptNumber)` at a time, sequential -- `FedosDeviceSyncScheduler.#runTick()`
 * awaits each attempt before starting the next), this Bridge's own
 * `"sync-started"`/`"sync-progress"`/`"sync-completed"`/`"sync-failed"`/
 * `"retry-scheduled"`/`"retry-aborted"`/`"conflict-detected"` events are
 * scoped to ONE ATTEMPT, never a fabricated whole-tick aggregate the
 * Scheduler itself does not report anywhere. A tick that attempts N
 * schedules produces N complete little `started -> progress ->
 * (completed|failed|retry-scheduled|retry-aborted|conflict-detected)`
 * sequences, one per schedule -- never one aggregate event guessing at
 * what "the whole tick" was about.
 *
 * `"retry-aborted"` vs `"retry-scheduled"`: `FedosDeviceSyncTickEntry.directive`
 * (the Scheduler's own PUBLIC return shape) does not distinguish a genuine
 * "still retrying later" `"later"` outcome from a "this WAS the abandoning
 * attempt" `"later"` outcome -- both classify identically via
 * `classifyFedosDeviceSyncRetryDirective()`; the abandonment decision is a
 * SEPARATE, ONLY-INTERNAL check inside `#attemptSchedule()`
 * (`attemptCount >= abandonmentPolicy.maxAttempts`) whose result never
 * reaches the returned `FedosDeviceSyncTickEntry`. Rather than read
 * `FedosDeviceSyncSchedulePersistence` after the fact (a STALE read at the
 * moment `attemptFn` itself resolves -- the Scheduler has not yet
 * persisted this attempt's own outcome event) or duplicate the
 * Scheduler's own persisted Schedule state, this Bridge is OPTIONALLY
 * handed the SAME `abandonmentPolicy.maxAttempts` number a caller already
 * passes to the Scheduler elsewhere (a plain, static policy VALUE, never
 * mutable state) and replicates the SAME "was this attempt number the
 * abandoning one" arithmetic the Scheduler itself uses. Omitted, every
 * `"later"` directive is honestly reported as `"retry-scheduled"` only --
 * this Bridge never CLAIMS `"retry-aborted"` when it cannot actually tell.
 *
 * `"conflict-detected"` is scoped to the SEND-side `"identity-conflict"`
 * attempt outcome code only (`FedosDeviceSyncAttemptOutcomeCode`, already
 * in the Scheduler's own closed vocabulary). The RECEIVE-side conflict
 * subsystem (`FedosDeviceSyncImportCoordinator`/`FedosDeviceSyncConflictPersistence`,
 * `../sync_scheduler/fedos_device_sync_import_coordinator.ts`) is a
 * SEPARATE, currently entirely unwired concern -- `startFedosDesktopRuntime()`
 * never constructs or calls it anywhere on this codebase's own base -- so
 * this Bridge cannot honestly observe it without inventing a NEW call site
 * for Import Coordinator, which would be a Sync protocol change, explicitly
 * out of this Arc's own scope. Disclosed in this Arc's own completion
 * declaration, not silently glossed over.
 *
 * `"device-offline"`/`"device-online"` are DERIVED, in-memory-only
 * presentation signals -- never a fact the Scheduler itself persists or
 * reports. A per-target-device `Set<string>` of "currently believed
 * offline" ids (mirrors `FedosDesktopBadgeCoordinator`'s own
 * `#previousCounts` "local presentation state is never durable"
 * discipline exactly) transitions to `"device-offline"` the first time an
 * attempt against that target reports `"target-unavailable"`/
 * `"relay-disconnected"`, and back to `"device-online"` the first time a
 * LATER attempt against the SAME target reports anything else. Reset on
 * every fresh Bridge instance (a process restart never fabricates a false
 * "still offline" carried over from a prior process, the SAME "first
 * observation is a baseline, never a false positive" idea the badge
 * Coordinator's own "attention" detection already established).
 */

import type {
  FedosDeviceSyncAttemptFn,
  FedosDeviceSyncAttemptRequest,
  FedosDeviceSyncAttemptResult,
} from "../../../../device/sync_scheduler/fedos_device_sync_attempt.js";
import { classifyFedosDeviceSyncRetryDirective, type FedosDeviceSyncAttemptOutcomeCode } from "../../../../device/sync_scheduler/fedos_device_sync_retry_policy.js";
import type { FedosDeviceSyncEvent, FedosDeviceSyncEventListener } from "../../../../device/sync_events/fedos_device_sync_event.js";

function defaultNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** The Scheduler's own fail-closed default (`fedos_desktop_runtime.ts`'s own `config.deviceSyncAttemptFn ?? (async () => ({ outcome: "failed" }))`) -- restated here so `wrapAttemptFn(undefined)` observes the IDENTICAL honest behavior a caller who supplied nothing would otherwise get, rather than silently becoming a no-op Bridge. */
const FAIL_CLOSED_ATTEMPT_FN: FedosDeviceSyncAttemptFn = async () => ({ outcome: "failed" });

/** Attempt outcome codes this Bridge treats as a connectivity-loss signal for `"device-offline"`/`"device-online"` derivation -- the SAME two codes the Scheduler's own Retry Policy already classifies as transient/`"later"` for exactly this reason (`../sync_scheduler/fedos_device_sync_retry_policy.ts`'s own `RETRYABLE_LATER`), restated narrowly here (never the WHOLE retryable set -- `crypto-temporarily-unavailable` is a local capability gap, not a remote Device being offline). */
const OFFLINE_SIGNAL_OUTCOMES: ReadonlySet<FedosDeviceSyncAttemptOutcomeCode> = new Set(["target-unavailable", "relay-disconnected"]);

export interface FedosDeviceSyncEventBridgeDeps {
  readonly listener: FedosDeviceSyncEventListener;
  /**
   * OPTIONAL -- the SAME `FedosDeviceSyncAbandonmentPolicy.maxAttempts` a
   * caller already passes to the Scheduler. Lets `"retry-aborted"` be
   * distinguished honestly from `"retry-scheduled"` for the "this
   * attempt exhausted the abandonment policy" case (see this file's own
   * header). Omitted, every `"later"` directive is reported as
   * `"retry-scheduled"` only -- never a false `"retry-aborted"` claim.
   */
  readonly abandonmentMaxAttempts?: number;
  readonly now?: () => number;
}

export class FedosDeviceSyncEventBridge {
  readonly #listener: FedosDeviceSyncEventListener;
  readonly #abandonmentMaxAttempts: number | undefined;
  readonly #now: () => number;
  /** In-memory-only, never persisted -- see this file's own header. */
  readonly #offlineTargets = new Set<string>();

  constructor(deps: FedosDeviceSyncEventBridgeDeps) {
    this.#listener = deps.listener;
    this.#abandonmentMaxAttempts = deps.abandonmentMaxAttempts;
    this.#now = deps.now ?? defaultNowSeconds;
  }

  /** `true` iff this Bridge currently believes `targetDeviceId` is offline (its own last-observed attempt outcome was a connectivity-loss signal). Read-only, in-memory, never a persisted fact -- exposed only so a caller/test can inspect this Bridge's own derived state without waiting for the next attempt. */
  isTargetBelievedOffline(targetDeviceId: string): boolean {
    return this.#offlineTargets.has(targetDeviceId);
  }

  /**
   * Wraps `real` (or, if omitted, this file's own restated fail-closed
   * default -- see `FAIL_CLOSED_ATTEMPT_FN`) with an IDENTICAL
   * `FedosDeviceSyncAttemptFn` that observes every real attempt and emits
   * the corresponding `FedosDeviceSyncEvent` sequence, THEN returns
   * `real`'s own result completely unmodified. Never alters retry
   * behavior, never alters what the Scheduler itself persists -- a pure
   * observation wrapper.
   */
  wrapAttemptFn(real?: FedosDeviceSyncAttemptFn): FedosDeviceSyncAttemptFn {
    const inner = real ?? FAIL_CLOSED_ATTEMPT_FN;
    return async (request: FedosDeviceSyncAttemptRequest): Promise<FedosDeviceSyncAttemptResult> => {
      const startedAt = this.#now();
      this.#emit({ kind: "sync-started", at: startedAt, ...this.#base(request) });
      this.#emit({ kind: "sync-progress", at: startedAt, ...this.#base(request) });

      let result: FedosDeviceSyncAttemptResult;
      try {
        result = await inner(request);
      } catch {
        // Mirrors `FedosDeviceSyncScheduler.#attemptSchedule()`'s own catch exactly (a throwing
        // attemptFn is treated as `"failed"`) -- this Bridge's own emitted event must match what the
        // Scheduler will actually persist, never a divergent guess. `real` itself is never re-thrown
        // past this wrapper -- this wrapper is a drop-in replacement, so it must resolve, never reject,
        // exactly like the Scheduler's own real attemptFn contract already requires.
        result = { outcome: "failed" };
      }

      this.#emitOutcome(request, result);
      return result;
    };
  }

  #base(request: FedosDeviceSyncAttemptRequest): { scheduleId: string; sourceDeviceId: string; targetDeviceId: string; attemptNumber: number } {
    return {
      scheduleId: request.scheduleId,
      sourceDeviceId: request.sourceDeviceId,
      targetDeviceId: request.targetDeviceId,
      attemptNumber: request.attemptNumber,
    };
  }

  /**
   * Emits the ONE primary classification event first (`sync-completed`/
   * `conflict-detected`/`sync-failed`/`retry-aborted`/`retry-scheduled`),
   * THEN the connectivity signal (`device-offline`/`device-online`, if
   * any) LAST -- deliberately, so a listener that reduces this Bridge's
   * own event stream down to one "current status" (e.g.
   * `FedosDesktopDeviceSyncPresentationWiring`'s own tray tooltip) lands
   * on the more specific, more actionable "this Device appears offline"
   * fact as the final word for this attempt, rather than a generic
   * "scheduled to retry" status silently overwriting it.
   */
  #emitOutcome(request: FedosDeviceSyncAttemptRequest, result: FedosDeviceSyncAttemptResult): void {
    const at = this.#now();
    const base = { at, ...this.#base(request) };

    if (result.outcome === "delivered") {
      this.#emit({ ...base, kind: "sync-completed" });
    } else if (result.outcome === "identity-conflict") {
      this.#emit({ ...base, kind: "conflict-detected", outcome: result.outcome });
    } else {
      const directive = classifyFedosDeviceSyncRetryDirective(result.outcome);
      if (directive === "never") {
        this.#emit({ ...base, kind: "sync-failed", outcome: result.outcome, reason: result.reason ?? result.outcome });
      } else if (directive === "operator-required") {
        this.#emit({ ...base, kind: "retry-aborted", outcome: result.outcome, reason: result.reason ?? result.outcome });
      } else {
        // directive === "later"
        const willAbandon = this.#abandonmentMaxAttempts !== undefined && request.attemptNumber >= this.#abandonmentMaxAttempts;
        if (willAbandon) {
          this.#emit({ ...base, kind: "retry-aborted", outcome: result.outcome, reason: `abandoned after ${request.attemptNumber} attempt(s) (>= configured maxAttempts)` });
        } else {
          this.#emit({ ...base, kind: "retry-scheduled", outcome: result.outcome });
        }
      }
    }

    this.#updateConnectivity(request.targetDeviceId, result.outcome, at);
  }

  #updateConnectivity(targetDeviceId: string, outcome: FedosDeviceSyncAttemptOutcomeCode, at: number): void {
    const isOfflineSignal = OFFLINE_SIGNAL_OUTCOMES.has(outcome);
    if (isOfflineSignal && !this.#offlineTargets.has(targetDeviceId)) {
      this.#offlineTargets.add(targetDeviceId);
      this.#emit({ kind: "device-offline", at, targetDeviceId, reason: outcome });
    } else if (!isOfflineSignal && this.#offlineTargets.has(targetDeviceId)) {
      this.#offlineTargets.delete(targetDeviceId);
      this.#emit({ kind: "device-online", at, targetDeviceId });
    }
  }

  #emit(event: FedosDeviceSyncEvent): void {
    try {
      this.#listener(event);
    } catch {
      // A broken observer never breaks the real Scheduler attempt path -- mirrors
      // `FedosDesktopNotificationCoordinator.notify()`'s own "never throws past this boundary"
      // discipline, restated here for the ONE thing this Bridge itself calls out to.
    }
  }
}
