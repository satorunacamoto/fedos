/**
 * Secure Runtime Alpha 3481–3560 — Append-Only Transfer Session
 * Persistence. Mirrors
 * `../../persistence/append_only_fedos_device_registry_persistence.ts`'s
 * own event-keyed NDJSON backend exactly: independent log file,
 * insert-only, deterministic replay, fail-closed on corruption (one
 * unparseable line or one irreconcilable duplicate key throws
 * unconditionally), zero new dependency, no compaction/delete/rewrite.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import { deserializeFedosDeviceTransferEvent } from "./fedos_device_transfer_event_codec.js";
import {
  fedosDeviceTransferEventKey,
  fedosPersistedDeviceTransferEventsAreEqual,
  reconstructFedosDeviceTransferSessionRecord,
  type FedosDeviceTransferSessionPersistence,
  type FedosDeviceTransferSessionPersistenceWriteResult,
} from "./fedos_device_transfer_session_persistence.js";
import type { FedosPersistedDeviceTransferEventV1 } from "./fedos_persisted_device_transfer_event_v1.js";
import type { FedosDeviceTransferSessionV1 } from "../fedos_device_transfer_session.js";

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
function replayLog(filePath: string): FedosPersistedDeviceTransferEventV1[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, FedosPersistedDeviceTransferEventV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsedJson = JSON.parse(line);
    const parsed = deserializeFedosDeviceTransferEvent(parsedJson);
    if (parsed === null) {
      throw new Error("AppendOnlyFedosDeviceTransferSessionPersistence: corrupt or schema-invalid record found in log file.");
    }
    const key = fedosDeviceTransferEventKey(parsed);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsed);
    } else if (!fedosPersistedDeviceTransferEventsAreEqual(existing, parsed)) {
      throw new Error(`AppendOnlyFedosDeviceTransferSessionPersistence: conflicting duplicate records for key "${key}" found in log file.`);
    }
  }
  return [...byKey.values()];
}

export class AppendOnlyFedosDeviceTransferSessionPersistence implements FedosDeviceTransferSessionPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putEvent(event: FedosPersistedDeviceTransferEventV1): FedosDeviceTransferSessionPersistenceWriteResult {
    const key = fedosDeviceTransferEventKey(event);
    const existing = replayLog(this.#filePath).find((e) => fedosDeviceTransferEventKey(e) === key) ?? null;
    if (existing !== null) {
      return fedosPersistedDeviceTransferEventsAreEqual(existing, event) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(event) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getSession(sessionId: string): FedosDeviceTransferSessionV1 | null {
    return reconstructFedosDeviceTransferSessionRecord(replayLog(this.#filePath).filter((event) => event.sessionId === sessionId));
  }

  listSessionsForAccount(accountAuthority: string, accountPublicIdentifier: string): readonly FedosDeviceTransferSessionV1[] {
    const events = replayLog(this.#filePath);
    const sessionIds = new Set(events.map((event) => event.sessionId));
    const result: FedosDeviceTransferSessionV1[] = [];
    for (const sessionId of sessionIds) {
      const record = reconstructFedosDeviceTransferSessionRecord(events.filter((event) => event.sessionId === sessionId));
      if (record !== null && record.accountAuthority === accountAuthority && record.accountPublicIdentifier === accountPublicIdentifier) {
        result.push(record);
      }
    }
    return result;
  }
}
