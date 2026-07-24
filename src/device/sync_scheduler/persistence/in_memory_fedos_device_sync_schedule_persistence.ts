/**
 * Secure Runtime Alpha 3721–3800 — In-Memory Schedule Persistence.
 * Mirrors `../../transfer/persistence/in_memory_fedos_device_transfer_session_persistence.ts`'s
 * own private-`Map<eventKey, event>`-backed convention exactly.
 */

import {
  fedosDeviceSyncScheduleEventKey,
  fedosPersistedDeviceSyncScheduleEventsAreEqual,
  reconstructFedosDeviceSyncScheduleRecord,
  type FedosDeviceSyncSchedulePersistence,
  type FedosDeviceSyncSchedulePersistenceWriteResult,
} from "./fedos_device_sync_schedule_persistence.js";
import type { FedosPersistedDeviceSyncScheduleEventV1 } from "./fedos_persisted_device_sync_schedule_event_v1.js";
import type { FedosDeviceSyncScheduleV1 } from "../fedos_device_sync_schedule.js";

export class InMemoryFedosDeviceSyncSchedulePersistence implements FedosDeviceSyncSchedulePersistence {
  readonly #events = new Map<string, FedosPersistedDeviceSyncScheduleEventV1>();

  putEvent(event: FedosPersistedDeviceSyncScheduleEventV1): FedosDeviceSyncSchedulePersistenceWriteResult {
    const key = fedosDeviceSyncScheduleEventKey(event);
    const existing = this.#events.get(key);
    if (existing === undefined) {
      this.#events.set(key, event);
      return "inserted";
    }
    return fedosPersistedDeviceSyncScheduleEventsAreEqual(existing, event) ? "already-present" : "conflict";
  }

  getSchedule(scheduleId: string): FedosDeviceSyncScheduleV1 | null {
    return reconstructFedosDeviceSyncScheduleRecord(this.#eventsForSchedule(scheduleId));
  }

  listSchedulesForSource(sourceDeviceId: string): readonly FedosDeviceSyncScheduleV1[] {
    return this.listAllSchedules().filter((schedule) => schedule.sourceDeviceId === sourceDeviceId);
  }

  listAllSchedules(): readonly FedosDeviceSyncScheduleV1[] {
    const scheduleIds = new Set([...this.#events.values()].map((event) => event.scheduleId));
    const result: FedosDeviceSyncScheduleV1[] = [];
    for (const scheduleId of scheduleIds) {
      const record = reconstructFedosDeviceSyncScheduleRecord(this.#eventsForSchedule(scheduleId));
      if (record !== null) result.push(record);
    }
    return result;
  }

  #eventsForSchedule(scheduleId: string): readonly FedosPersistedDeviceSyncScheduleEventV1[] {
    return [...this.#events.values()].filter((event) => event.scheduleId === scheduleId);
  }
}
