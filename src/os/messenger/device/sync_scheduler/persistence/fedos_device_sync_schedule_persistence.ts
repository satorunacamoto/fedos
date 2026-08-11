/**
 * Secure Runtime Alpha 3721–3800 — Schedule Persistence Port (Phase F).
 * Mirrors `../../transfer/persistence/fedos_device_transfer_session_persistence.ts`'s
 * own event-store-plus-reconstruct shape exactly, applied to
 * `FedosDeviceSyncScheduleV1` instead of a Transfer Session. A
 * DELIBERATELY SEPARATE port and file tree from the Transfer Session
 * persistence and the Relay Sync Outbox/dedup persistence — this Arc's
 * own Schedule lifecycle is a distinct concern from all three.
 */

import {
  createPendingFedosDeviceSyncSchedule,
  startFedosDeviceSyncScheduleAttempt,
  retryLaterFedosDeviceSyncSchedule,
  completeFedosDeviceSyncSchedule,
  failFedosDeviceSyncSchedule,
  requireOperatorForFedosDeviceSyncSchedule,
  type FedosDeviceSyncScheduleV1,
} from "../fedos_device_sync_schedule.js";
import {
  fedosDeviceSyncScheduleEventKey,
  fedosPersistedDeviceSyncScheduleEventsAreEqual,
  type FedosPersistedDeviceSyncScheduleEventV1,
  type FedosPersistedDeviceSyncScheduleCreatedEventV1,
} from "./fedos_persisted_device_sync_schedule_event_v1.js";

export type FedosDeviceSyncSchedulePersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosDeviceSyncSchedulePersistence {
  putEvent(event: FedosPersistedDeviceSyncScheduleEventV1): FedosDeviceSyncSchedulePersistenceWriteResult;
  getSchedule(scheduleId: string): FedosDeviceSyncScheduleV1 | null;
  listSchedulesForSource(sourceDeviceId: string): readonly FedosDeviceSyncScheduleV1[];
  listAllSchedules(): readonly FedosDeviceSyncScheduleV1[];
}

export { fedosDeviceSyncScheduleEventKey, fedosPersistedDeviceSyncScheduleEventsAreEqual };

const APPLICABLE_EVENT_TYPES = ["attempt-started", "retry-later", "completed", "failed", "operator-required"] as const;

/**
 * Reconstructs the current Schedule for one schedule id from every event
 * found for it. `"created"` seeds the record; every OTHER event type is
 * applied in ASCENDING `at`/`attemptCount` order (never the log's own
 * physical append order alone) since `"attempt-started"`/`"retry-later"`
 * legitimately recur across attempts and must be replayed chronologically
 * for a correct `attemptCount`/`state` outcome. An invalid/out-of-order
 * transition is ignored (never applied, never nulls out an already-valid
 * record) — mirrors `reconstructFedosDeviceTransferSessionRecord()`'s own
 * discipline exactly.
 */
export function reconstructFedosDeviceSyncScheduleRecord(eventsForScheduleId: readonly FedosPersistedDeviceSyncScheduleEventV1[]): FedosDeviceSyncScheduleV1 | null {
  const created = eventsForScheduleId.find((event): event is FedosPersistedDeviceSyncScheduleCreatedEventV1 => event.eventType === "created");
  if (created === undefined) return null;

  let schedule: FedosDeviceSyncScheduleV1 = createPendingFedosDeviceSyncSchedule({
    scheduleId: created.scheduleId,
    sourceDeviceId: created.sourceDeviceId,
    targetDeviceId: created.targetDeviceId,
    fromSequence: created.fromSequence,
    toSequence: created.toSequence,
    createdAt: created.createdAt,
  });

  const rest = eventsForScheduleId
    .filter((event): event is Exclude<FedosPersistedDeviceSyncScheduleEventV1, FedosPersistedDeviceSyncScheduleCreatedEventV1> =>
      (APPLICABLE_EVENT_TYPES as readonly string[]).includes(event.eventType),
    )
    .slice()
    .sort((a, b) => a.at - b.at);

  for (const event of rest) {
    let next: FedosDeviceSyncScheduleV1 | null = null;
    switch (event.eventType) {
      case "attempt-started":
        next = startFedosDeviceSyncScheduleAttempt(schedule, event.transferSessionId, event.at);
        break;
      case "retry-later":
        next = retryLaterFedosDeviceSyncSchedule(schedule, event.nextEligibleAt, event.coarseOutcome, event.at);
        break;
      case "completed":
        next = completeFedosDeviceSyncSchedule(schedule, event.coarseOutcome, event.at);
        break;
      case "failed":
        next = failFedosDeviceSyncSchedule(schedule, event.coarseOutcome, event.at);
        break;
      case "operator-required":
        next = requireOperatorForFedosDeviceSyncSchedule(schedule, event.coarseOutcome, event.at);
        break;
      default:
        break;
    }
    if (next !== null) schedule = next;
  }
  return schedule;
}
