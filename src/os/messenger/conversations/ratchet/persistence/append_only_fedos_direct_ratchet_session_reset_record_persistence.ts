/**
 * FedOS Ratchet Device Lifecycle and Authenticated Session Reset
 * Foundation Arc — Append-Only Session Reset Record Persistence. Mirrors
 * `../../../device/persistence/append_only_fedos_device_binding_challenge_replay_persistence.ts`'s
 * own NDJSON-backend discipline exactly: independent log file,
 * insert-only, deterministic replay, fail-closed on corruption (one
 * unparseable line or one irreconcilable duplicate key throws
 * unconditionally), zero new dependency, no compaction/delete/rewrite.
 * This is what gives replay protection AND the durable reset audit trail
 * restart-safety: a reset recorded before a crash/restart is still on
 * file after, because `getResetRecord()`/`listResetRecords()` replay this
 * same log.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  decodeFedosDirectRatchetSessionResetRecordV1,
  encodeFedosDirectRatchetSessionResetRecordV1,
} from "../../../../../conversation/ratchet/fedos_direct_ratchet_session_reset_record.js";
import {
  fedosDirectRatchetSessionResetRecordKey,
  fedosDirectRatchetSessionResetRecordsAreEqual,
  type FedosDirectRatchetSessionResetRecordPersistence,
  type FedosDirectRatchetSessionResetRecordWriteResult,
} from "../../../../../conversation/ratchet/persistence/fedos_direct_ratchet_session_reset_record_persistence.js";
import type { FedosDirectRatchetSessionResetRecordV1 } from "../../../../../conversation/ratchet/fedos_direct_ratchet_session_reset_record.js";

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

/** PRIVATE — replays the append log into a deduplicated array. A parse/schema failure or an irreconcilable duplicate throws unconditionally (fail-closed on corruption). */
function replayLog(filePath: string): FedosDirectRatchetSessionResetRecordV1[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, FedosDirectRatchetSessionResetRecordV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = decodeFedosDirectRatchetSessionResetRecordV1(line);
    if (parsed === null) {
      throw new Error("AppendOnlyFedosDirectRatchetSessionResetRecordPersistence: corrupt or schema-invalid record found in log file.");
    }
    const key = fedosDirectRatchetSessionResetRecordKey(parsed);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsed);
    } else if (!fedosDirectRatchetSessionResetRecordsAreEqual(existing, parsed)) {
      throw new Error(`AppendOnlyFedosDirectRatchetSessionResetRecordPersistence: conflicting duplicate records for key "${key}" found in log file.`);
    }
  }
  return [...byKey.values()];
}

export class AppendOnlyFedosDirectRatchetSessionResetRecordPersistence implements FedosDirectRatchetSessionResetRecordPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putResetRecord(record: FedosDirectRatchetSessionResetRecordV1): FedosDirectRatchetSessionResetRecordWriteResult {
    const key = fedosDirectRatchetSessionResetRecordKey(record);
    const existing = replayLog(this.#filePath).find((r) => fedosDirectRatchetSessionResetRecordKey(r) === key) ?? null;
    if (existing !== null) {
      return fedosDirectRatchetSessionResetRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, encodeFedosDirectRatchetSessionResetRecordV1(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getResetRecord(nonce: string): FedosDirectRatchetSessionResetRecordV1 | null {
    return replayLog(this.#filePath).find((r) => r.nonce === nonce) ?? null;
  }

  listResetRecords(): readonly FedosDirectRatchetSessionResetRecordV1[] {
    return replayLog(this.#filePath);
  }
}
