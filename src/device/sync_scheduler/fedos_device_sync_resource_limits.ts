/**
 * Secure Runtime Alpha 3721–3800 — explicit resource limits (Phase N).
 *
 * No unlimited-scale claim of any kind — every limit here is either
 * ENFORCED directly by `fedos_device_sync_scheduler.ts`
 * (`maxTargetDevicesPerCycle`, `maxJournalRecordsPerRange`,
 * `maxConcurrentTransfersPerTick`, `maxRelayCount`) or a DECLARED policy
 * input this Arc does NOT yet enforce with a compaction implementation
 * (`maxRetainedScheduleHistory`/`maxRetainedConflictHistory` — stated
 * honestly here and in this Arc's own completion declaration as
 * unimplemented, not silently assumed).
 */

export interface FedosDeviceSyncResourceLimits {
  /** ENFORCED — target planning (Phase E) never plans more than this many target Devices in one cycle. */
  readonly maxTargetDevicesPerCycle: number;
  /** ENFORCED — the maximum INCLUSIVE Journal-sequence span (`toSequence - fromSequence + 1`) one Schedule may cover; a larger pending range is split across multiple Schedules. */
  readonly maxJournalRecordsPerRange: number;
  /** ENFORCED — the Scheduler never runs more than this many per-target attempts concurrently within one tick. */
  readonly maxConcurrentTransfersPerTick: number;
  /** ENFORCED at the injected `FedosDeviceRelaySyncPublisher` layer (Alpha 3641–3720's own `FEDOS_DEVICE_RELAY_SYNC_MAX_RELAYS`, unmodified) — restated here only so a caller assembling a Scheduler sees the SAME number in one place. */
  readonly maxRelayCount: number;
  /** DECLARED policy input, NOT YET enforced by any compaction/pruning code in this Arc — this Arc's own append-only Schedule/Conflict persistence never deletes a record. Stated honestly as a real, named limitation. */
  readonly maxRetainedScheduleHistory: number;
  readonly maxRetainedConflictHistory: number;
}

export const FEDOS_DEVICE_SYNC_DEFAULT_RESOURCE_LIMITS: FedosDeviceSyncResourceLimits = Object.freeze({
  maxTargetDevicesPerCycle: 32,
  maxJournalRecordsPerRange: 500,
  maxConcurrentTransfersPerTick: 4,
  maxRelayCount: 16,
  maxRetainedScheduleHistory: 10_000,
  maxRetainedConflictHistory: 10_000,
});

export function isWellFormedFedosDeviceSyncResourceLimits(limits: FedosDeviceSyncResourceLimits): boolean {
  return (
    Number.isInteger(limits.maxTargetDevicesPerCycle) &&
    limits.maxTargetDevicesPerCycle > 0 &&
    Number.isInteger(limits.maxJournalRecordsPerRange) &&
    limits.maxJournalRecordsPerRange > 0 &&
    Number.isInteger(limits.maxConcurrentTransfersPerTick) &&
    limits.maxConcurrentTransfersPerTick > 0 &&
    Number.isInteger(limits.maxRelayCount) &&
    limits.maxRelayCount > 0 &&
    Number.isInteger(limits.maxRetainedScheduleHistory) &&
    limits.maxRetainedScheduleHistory > 0 &&
    Number.isInteger(limits.maxRetainedConflictHistory) &&
    limits.maxRetainedConflictHistory > 0
  );
}
