/**
 * Secure Runtime Alpha 2921–3000 ("Device Trust and Multi-Device Runtime
 * Integration") — Append-Only Device Registry Persistence (Phase D).
 *
 * Mirrors `../../conversation/capability/persistence/append_only_fedos_conversation_capability_persistence.ts`'s
 * own event-keyed NDJSON backend exactly (Alpha 840): independent log
 * file, insert-only, deterministic replay, fail-closed on corruption
 * (one unparseable line or one irreconcilable duplicate key throws
 * unconditionally — "one corrupt record voids the backend," same
 * precedent), zero new dependency, no compaction/delete/rewrite, no path
 * construction of its own beyond the caller-supplied `filePath`.
 *
 * Uses `./fedos_device_binding_codec.ts` to fail closed on a malformed
 * JSON line's CONTENT (not just unparseable JSON) — a line that parses
 * but does not match this Arc's own schema is treated identically to a
 * JSON parse failure: the whole backend throws, never silently drops
 * the bad record and continues.
 */

import { readFileSync, appendFileSync } from "node:fs";
import { deserializeFedosDeviceBindingEvent } from "./fedos_device_binding_codec.js";
import {
  fedosDeviceBindingEventKey,
  fedosPersistedDeviceBindingEventsAreEqual,
  reconstructFedosDeviceBindingRecord,
  type FedosDeviceRegistryPersistence,
  type FedosDeviceRegistryPersistenceWriteResult,
} from "./fedos_device_registry_persistence.js";
import type { FedosPersistedDeviceBindingEventV1 } from "./fedos_persisted_device_binding_event_v1.js";
import type { FedosDeviceBindingV1 } from "../fedos_device_binding.js";

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

/** PRIVATE — replays the append log into a deduplicated array, keyed per event. A parse/schema failure or an irreconcilable duplicate throws unconditionally (fail-closed on corruption). */
function replayLog(filePath: string): FedosPersistedDeviceBindingEventV1[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, FedosPersistedDeviceBindingEventV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsedJson = JSON.parse(line);
    const parsed = deserializeFedosDeviceBindingEvent(parsedJson);
    if (parsed === null) {
      throw new Error("AppendOnlyFedosDeviceRegistryPersistence: corrupt or schema-invalid record found in log file.");
    }
    const key = fedosDeviceBindingEventKey(parsed);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsed);
    } else if (!fedosPersistedDeviceBindingEventsAreEqual(existing, parsed)) {
      throw new Error(`AppendOnlyFedosDeviceRegistryPersistence: conflicting duplicate records for key "${key}" found in log file.`);
    }
  }
  return [...byKey.values()];
}

export class AppendOnlyFedosDeviceRegistryPersistence implements FedosDeviceRegistryPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putEvent(event: FedosPersistedDeviceBindingEventV1): FedosDeviceRegistryPersistenceWriteResult {
    const key = fedosDeviceBindingEventKey(event);
    const existing = replayLog(this.#filePath).find((e) => fedosDeviceBindingEventKey(e) === key) ?? null;
    if (existing !== null) {
      return fedosPersistedDeviceBindingEventsAreEqual(existing, event) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(event) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getBinding(deviceId: string): FedosDeviceBindingV1 | null {
    return reconstructFedosDeviceBindingRecord(replayLog(this.#filePath).filter((event) => event.deviceId === deviceId));
  }

  listBindings(): readonly FedosDeviceBindingV1[] {
    return this.#currentByDistinctDevice(replayLog(this.#filePath));
  }

  listBindingsForAccount(accountAuthority: string, accountPublicIdentifier: string): readonly FedosDeviceBindingV1[] {
    return this.listBindings().filter(
      (binding) => binding.accountRef.authority === accountAuthority && binding.accountRef.publicIdentifier === accountPublicIdentifier,
    );
  }

  #currentByDistinctDevice(events: readonly FedosPersistedDeviceBindingEventV1[]): readonly FedosDeviceBindingV1[] {
    const deviceIds = new Set(events.map((event) => event.deviceId));
    const result: FedosDeviceBindingV1[] = [];
    for (const deviceId of deviceIds) {
      const record = reconstructFedosDeviceBindingRecord(events.filter((event) => event.deviceId === deviceId));
      if (record !== null) result.push(record);
    }
    return result;
  }
}
