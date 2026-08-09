/**
 * Secure Runtime Alpha 3641–3720 — Append-Only Device Sync Inbound Dedup
 * Persistence. Mirrors this codebase's own NDJSON-backend discipline
 * exactly: independent log file, insert-only, deterministic replay,
 * fail-closed on corruption, primary key `relayEventId`.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosPersistedDeviceRelaySyncImportRecordsAreEqual,
  isWellFormedFedosPersistedDeviceRelaySyncImportRecordV1,
  type FedosDeviceRelaySyncImportWriteResult,
  type FedosDeviceRelaySyncInboundDedupPersistence,
  type FedosPersistedDeviceRelaySyncImportRecordV1,
} from "../../../../../device/relay_sync/persistence/fedos_device_relay_sync_inbound_dedup_persistence.js";

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

function sessionHashKey(transferSessionId: string, packageContentHash: string): string {
  return `${transferSessionId}::${packageContentHash}`;
}

function replayLog(filePath: string): Map<string, FedosPersistedDeviceRelaySyncImportRecordV1> {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, FedosPersistedDeviceRelaySyncImportRecordV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsedJson = JSON.parse(line);
    if (!isWellFormedFedosPersistedDeviceRelaySyncImportRecordV1(parsedJson)) {
      throw new Error("AppendOnlyFedosDeviceRelaySyncInboundDedupPersistence: corrupt or schema-invalid record found in log file.");
    }
    const record = Object.freeze({ ...parsedJson }) as FedosPersistedDeviceRelaySyncImportRecordV1;
    const existing = byKey.get(record.relayEventId);
    if (existing === undefined) {
      byKey.set(record.relayEventId, record);
    } else if (!fedosPersistedDeviceRelaySyncImportRecordsAreEqual(existing, record)) {
      throw new Error(`AppendOnlyFedosDeviceRelaySyncInboundDedupPersistence: conflicting duplicate records for key "${record.relayEventId}" found in log file.`);
    }
  }
  return byKey;
}

export class AppendOnlyFedosDeviceRelaySyncInboundDedupPersistence implements FedosDeviceRelaySyncInboundDedupPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putImport(record: FedosPersistedDeviceRelaySyncImportRecordV1): FedosDeviceRelaySyncImportWriteResult {
    const existing = replayLog(this.#filePath).get(record.relayEventId) ?? null;
    if (existing !== null) {
      return fedosPersistedDeviceRelaySyncImportRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getByRelayEventId(relayEventId: string): FedosPersistedDeviceRelaySyncImportRecordV1 | null {
    return replayLog(this.#filePath).get(relayEventId) ?? null;
  }

  getBySessionAndHash(transferSessionId: string, packageContentHash: string): FedosPersistedDeviceRelaySyncImportRecordV1 | null {
    const key = sessionHashKey(transferSessionId, packageContentHash);
    for (const record of replayLog(this.#filePath).values()) {
      if (sessionHashKey(record.transferSessionId, record.packageContentHash) === key) return record;
    }
    return null;
  }
}
