/**
 * Secure Runtime Alpha 3721–3800 — Append-Only Schedule Persistence.
 * Mirrors every other append-only backend in this codebase exactly:
 * independent log file, insert-only, deterministic replay, fail-closed on
 * corruption, zero new dependency.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import { deserializeFedosDeviceSyncScheduleEvent } from "../../../../../device/sync_scheduler/persistence/fedos_device_sync_schedule_event_codec.js";
import {
  fedosDeviceSyncScheduleEventKey,
  fedosPersistedDeviceSyncScheduleEventsAreEqual,
  reconstructFedosDeviceSyncScheduleRecord,
  type FedosDeviceSyncSchedulePersistence,
  type FedosDeviceSyncSchedulePersistenceWriteResult,
} from "../../../../../device/sync_scheduler/persistence/fedos_device_sync_schedule_persistence.js";
import type { FedosPersistedDeviceSyncScheduleEventV1 } from "../../../../../device/sync_scheduler/persistence/fedos_persisted_device_sync_schedule_event_v1.js";
import type { FedosDeviceSyncScheduleV1 } from "../../../../../device/sync_scheduler/fedos_device_sync_schedule.js";

function isEnoent(err: unknown): boolean {
  return err !== null && typeof err === "object" && "code" in err && (err as { code?: unknown }).code === "ENOENT";
}

function readLogFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8") as string;
  } catch (err) {
    if (isEnoent(err)) return "";
    throw err;
  }
}

function replayLog(filePath: string): FedosPersistedDeviceSyncScheduleEventV1[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, FedosPersistedDeviceSyncScheduleEventV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsedJson = JSON.parse(line);
    const parsed = deserializeFedosDeviceSyncScheduleEvent(parsedJson);
    if (parsed === null) {
      throw new Error("AppendOnlyFedosDeviceSyncSchedulePersistence: corrupt or schema-invalid record found in log file.");
    }
    const key = fedosDeviceSyncScheduleEventKey(parsed);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsed);
    } else if (!fedosPersistedDeviceSyncScheduleEventsAreEqual(existing, parsed)) {
      throw new Error(`AppendOnlyFedosDeviceSyncSchedulePersistence: conflicting duplicate records for key "${key}" found in log file.`);
    }
  }
  return [...byKey.values()];
}

export class AppendOnlyFedosDeviceSyncSchedulePersistence implements FedosDeviceSyncSchedulePersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putEvent(event: FedosPersistedDeviceSyncScheduleEventV1): FedosDeviceSyncSchedulePersistenceWriteResult {
    const key = fedosDeviceSyncScheduleEventKey(event);
    const existing = replayLog(this.#filePath).find((e) => fedosDeviceSyncScheduleEventKey(e) === key) ?? null;
    if (existing !== null) {
      return fedosPersistedDeviceSyncScheduleEventsAreEqual(existing, event) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(event) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getSchedule(scheduleId: string): FedosDeviceSyncScheduleV1 | null {
    return reconstructFedosDeviceSyncScheduleRecord(replayLog(this.#filePath).filter((event) => event.scheduleId === scheduleId));
  }

  listSchedulesForSource(sourceDeviceId: string): readonly FedosDeviceSyncScheduleV1[] {
    return this.listAllSchedules().filter((schedule) => schedule.sourceDeviceId === sourceDeviceId);
  }

  listAllSchedules(): readonly FedosDeviceSyncScheduleV1[] {
    const events = replayLog(this.#filePath);
    const scheduleIds = new Set(events.map((event) => event.scheduleId));
    const result: FedosDeviceSyncScheduleV1[] = [];
    for (const scheduleId of scheduleIds) {
      const record = reconstructFedosDeviceSyncScheduleRecord(events.filter((event) => event.scheduleId === scheduleId));
      if (record !== null) result.push(record);
    }
    return result;
  }
}
