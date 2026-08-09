/**
 * Secure Runtime Alpha 3641–3720 — Append-Only Device Sync Outbox
 * Persistence. Mirrors this codebase's own NDJSON-backend discipline
 * exactly: independent log file, insert-only, deterministic replay,
 * fail-closed on corruption, keyed by `transferSessionId`.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosPersistedDeviceRelaySyncOutboxRecordsAreEqual,
  isWellFormedFedosPersistedDeviceRelaySyncOutboxRecordV1,
  type FedosDeviceRelaySyncOutboxPersistence,
  type FedosDeviceRelaySyncOutboxWriteResult,
  type FedosPersistedDeviceRelaySyncOutboxRecordV1,
} from "./fedos_device_relay_sync_outbox_persistence.js";

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

function replayLog(filePath: string): Map<string, FedosPersistedDeviceRelaySyncOutboxRecordV1> {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, FedosPersistedDeviceRelaySyncOutboxRecordV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsedJson = JSON.parse(line);
    if (!isWellFormedFedosPersistedDeviceRelaySyncOutboxRecordV1(parsedJson)) {
      throw new Error("AppendOnlyFedosDeviceRelaySyncOutboxPersistence: corrupt or schema-invalid record found in log file.");
    }
    const record = Object.freeze({ ...parsedJson }) as FedosPersistedDeviceRelaySyncOutboxRecordV1;
    const existing = byKey.get(record.transferSessionId);
    if (existing === undefined) {
      byKey.set(record.transferSessionId, record);
    } else if (!fedosPersistedDeviceRelaySyncOutboxRecordsAreEqual(existing, record)) {
      throw new Error(`AppendOnlyFedosDeviceRelaySyncOutboxPersistence: conflicting duplicate records for key "${record.transferSessionId}" found in log file.`);
    }
  }
  return byKey;
}

export class AppendOnlyFedosDeviceRelaySyncOutboxPersistence implements FedosDeviceRelaySyncOutboxPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putRecord(record: FedosPersistedDeviceRelaySyncOutboxRecordV1): FedosDeviceRelaySyncOutboxWriteResult {
    const existing = replayLog(this.#filePath).get(record.transferSessionId) ?? null;
    if (existing !== null) {
      return fedosPersistedDeviceRelaySyncOutboxRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getRecord(transferSessionId: string): FedosPersistedDeviceRelaySyncOutboxRecordV1 | null {
    return replayLog(this.#filePath).get(transferSessionId) ?? null;
  }
}
