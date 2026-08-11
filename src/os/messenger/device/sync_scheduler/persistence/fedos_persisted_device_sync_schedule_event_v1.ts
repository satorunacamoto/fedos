/**
 * Secure Runtime Alpha 3721–3800 — the persisted Schedule event union
 * (Phase F). Mirrors
 * `../../transfer/persistence/fedos_persisted_device_transfer_event_v1.ts`'s
 * own "event-sourced, one immutable fact per (scheduleId, eventType)"
 * discipline exactly. Each event type occurs AT MOST ONCE per
 * `scheduleId`, EXCEPT `"attempt-started"`/`"retry-later"`, which may each
 * recur across multiple attempts — keyed additionally by `attemptCount`
 * so a retried Schedule's own event log stays a true append-only history,
 * never an overwrite.
 */

export interface FedosPersistedDeviceSyncScheduleCreatedEventV1 {
  readonly schemaVersion: 1;
  readonly eventType: "created";
  readonly scheduleId: string;
  readonly sourceDeviceId: string;
  readonly targetDeviceId: string;
  readonly fromSequence: number;
  readonly toSequence: number;
  readonly createdAt: number;
}

export interface FedosPersistedDeviceSyncScheduleAttemptStartedEventV1 {
  readonly schemaVersion: 1;
  readonly eventType: "attempt-started";
  readonly scheduleId: string;
  readonly attemptCount: number;
  readonly transferSessionId: string;
  readonly at: number;
}

export interface FedosPersistedDeviceSyncScheduleRetryLaterEventV1 {
  readonly schemaVersion: 1;
  readonly eventType: "retry-later";
  readonly scheduleId: string;
  readonly attemptCount: number;
  readonly nextEligibleAt: number;
  readonly coarseOutcome: string;
  readonly at: number;
}

export interface FedosPersistedDeviceSyncScheduleCompletedEventV1 {
  readonly schemaVersion: 1;
  readonly eventType: "completed";
  readonly scheduleId: string;
  readonly coarseOutcome: string;
  readonly at: number;
}

export interface FedosPersistedDeviceSyncScheduleFailedEventV1 {
  readonly schemaVersion: 1;
  readonly eventType: "failed";
  readonly scheduleId: string;
  readonly coarseOutcome: string;
  readonly at: number;
}

export interface FedosPersistedDeviceSyncScheduleOperatorRequiredEventV1 {
  readonly schemaVersion: 1;
  readonly eventType: "operator-required";
  readonly scheduleId: string;
  readonly coarseOutcome: string;
  readonly at: number;
}

export type FedosPersistedDeviceSyncScheduleEventV1 =
  | FedosPersistedDeviceSyncScheduleCreatedEventV1
  | FedosPersistedDeviceSyncScheduleAttemptStartedEventV1
  | FedosPersistedDeviceSyncScheduleRetryLaterEventV1
  | FedosPersistedDeviceSyncScheduleCompletedEventV1
  | FedosPersistedDeviceSyncScheduleFailedEventV1
  | FedosPersistedDeviceSyncScheduleOperatorRequiredEventV1;

/** Keyed by `(scheduleId, eventType)` for once-only events, and additionally by `attemptCount` for the two events that legitimately recur across retries -- so a repeat attempt's own fact is a NEW key, never a collision with an earlier attempt's. */
export function fedosDeviceSyncScheduleEventKey(event: FedosPersistedDeviceSyncScheduleEventV1): string {
  if (event.eventType === "attempt-started" || event.eventType === "retry-later") {
    return `${event.scheduleId}:${event.eventType}:${event.attemptCount}`;
  }
  return `${event.scheduleId}:${event.eventType}`;
}

export function fedosPersistedDeviceSyncScheduleEventsAreEqual(a: FedosPersistedDeviceSyncScheduleEventV1, b: FedosPersistedDeviceSyncScheduleEventV1): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
