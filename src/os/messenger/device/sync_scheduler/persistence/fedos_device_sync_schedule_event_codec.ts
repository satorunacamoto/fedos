/**
 * Secure Runtime Alpha 3721–3800 — fail-closed codec for
 * `FedosPersistedDeviceSyncScheduleEventV1`. Mirrors
 * `../../transfer/persistence/fedos_device_transfer_event_codec.ts`'s own
 * exact-key-set, `schemaVersion === 1`-checked, "malformed input returns
 * `null`, never throws" discipline exactly.
 */

import type {
  FedosPersistedDeviceSyncScheduleAttemptStartedEventV1,
  FedosPersistedDeviceSyncScheduleCompletedEventV1,
  FedosPersistedDeviceSyncScheduleCreatedEventV1,
  FedosPersistedDeviceSyncScheduleEventV1,
  FedosPersistedDeviceSyncScheduleFailedEventV1,
  FedosPersistedDeviceSyncScheduleOperatorRequiredEventV1,
  FedosPersistedDeviceSyncScheduleRetryLaterEventV1,
} from "../../../../../device/sync_scheduler/persistence/fedos_persisted_device_sync_schedule_event_v1.js";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidUnixSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function deserializeFedosDeviceSyncScheduleCreatedEvent(record: unknown): FedosPersistedDeviceSyncScheduleCreatedEventV1 | null {
  if (typeof record !== "object" || record === null) return null;
  const value = record as Record<string, unknown>;
  if (Object.keys(value).length !== 8) return null;
  if (value.schemaVersion !== 1 || value.eventType !== "created") return null;
  if (!isNonEmptyString(value.scheduleId) || !isNonEmptyString(value.sourceDeviceId) || !isNonEmptyString(value.targetDeviceId)) return null;
  if (!isNonNegativeInteger(value.fromSequence) || !isNonNegativeInteger(value.toSequence) || value.toSequence < value.fromSequence) return null;
  if (!isValidUnixSeconds(value.createdAt)) return null;
  return {
    schemaVersion: 1,
    eventType: "created",
    scheduleId: value.scheduleId,
    sourceDeviceId: value.sourceDeviceId,
    targetDeviceId: value.targetDeviceId,
    fromSequence: value.fromSequence,
    toSequence: value.toSequence,
    createdAt: value.createdAt,
  };
}

export function deserializeFedosDeviceSyncScheduleAttemptStartedEvent(record: unknown): FedosPersistedDeviceSyncScheduleAttemptStartedEventV1 | null {
  if (typeof record !== "object" || record === null) return null;
  const value = record as Record<string, unknown>;
  if (Object.keys(value).length !== 6) return null;
  if (value.schemaVersion !== 1 || value.eventType !== "attempt-started") return null;
  if (!isNonEmptyString(value.scheduleId) || !isNonNegativeInteger(value.attemptCount)) return null;
  if (!isNonEmptyString(value.transferSessionId) || !isValidUnixSeconds(value.at)) return null;
  return { schemaVersion: 1, eventType: "attempt-started", scheduleId: value.scheduleId, attemptCount: value.attemptCount, transferSessionId: value.transferSessionId, at: value.at };
}

export function deserializeFedosDeviceSyncScheduleRetryLaterEvent(record: unknown): FedosPersistedDeviceSyncScheduleRetryLaterEventV1 | null {
  if (typeof record !== "object" || record === null) return null;
  const value = record as Record<string, unknown>;
  if (Object.keys(value).length !== 7) return null;
  if (value.schemaVersion !== 1 || value.eventType !== "retry-later") return null;
  if (!isNonEmptyString(value.scheduleId) || !isNonNegativeInteger(value.attemptCount)) return null;
  if (!isValidUnixSeconds(value.nextEligibleAt) || !isNonEmptyString(value.coarseOutcome) || !isValidUnixSeconds(value.at)) return null;
  return {
    schemaVersion: 1,
    eventType: "retry-later",
    scheduleId: value.scheduleId,
    attemptCount: value.attemptCount,
    nextEligibleAt: value.nextEligibleAt,
    coarseOutcome: value.coarseOutcome,
    at: value.at,
  };
}

function deserializeTerminalEvent<T extends "completed" | "failed" | "operator-required">(
  record: unknown,
  eventType: T,
): { schemaVersion: 1; eventType: T; scheduleId: string; coarseOutcome: string; at: number } | null {
  if (typeof record !== "object" || record === null) return null;
  const value = record as Record<string, unknown>;
  if (Object.keys(value).length !== 5) return null;
  if (value.schemaVersion !== 1 || value.eventType !== eventType) return null;
  if (!isNonEmptyString(value.scheduleId) || !isNonEmptyString(value.coarseOutcome) || !isValidUnixSeconds(value.at)) return null;
  return { schemaVersion: 1, eventType, scheduleId: value.scheduleId, coarseOutcome: value.coarseOutcome, at: value.at };
}

export function deserializeFedosDeviceSyncScheduleCompletedEvent(record: unknown): FedosPersistedDeviceSyncScheduleCompletedEventV1 | null {
  return deserializeTerminalEvent(record, "completed");
}

export function deserializeFedosDeviceSyncScheduleFailedEvent(record: unknown): FedosPersistedDeviceSyncScheduleFailedEventV1 | null {
  return deserializeTerminalEvent(record, "failed");
}

export function deserializeFedosDeviceSyncScheduleOperatorRequiredEvent(record: unknown): FedosPersistedDeviceSyncScheduleOperatorRequiredEventV1 | null {
  return deserializeTerminalEvent(record, "operator-required");
}

/** Dispatches on `eventType`. `null` for an unrecognized `eventType` or any malformed record — fails closed, never throws. */
export function deserializeFedosDeviceSyncScheduleEvent(record: unknown): FedosPersistedDeviceSyncScheduleEventV1 | null {
  if (typeof record !== "object" || record === null) return null;
  const eventType = (record as Record<string, unknown>).eventType;
  switch (eventType) {
    case "created":
      return deserializeFedosDeviceSyncScheduleCreatedEvent(record);
    case "attempt-started":
      return deserializeFedosDeviceSyncScheduleAttemptStartedEvent(record);
    case "retry-later":
      return deserializeFedosDeviceSyncScheduleRetryLaterEvent(record);
    case "completed":
      return deserializeFedosDeviceSyncScheduleCompletedEvent(record);
    case "failed":
      return deserializeFedosDeviceSyncScheduleFailedEvent(record);
    case "operator-required":
      return deserializeFedosDeviceSyncScheduleOperatorRequiredEvent(record);
    default:
      return null;
  }
}
