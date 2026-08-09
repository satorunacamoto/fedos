/**
 * FedOS Ratchet Device Lifecycle and Authenticated Session Reset
 * Foundation Arc — Append-Only Device Replacement Persistence. Mirrors
 * `./append_only_fedos_device_binding_challenge_replay_persistence.ts`'s
 * own NDJSON-backend discipline exactly: independent log file,
 * insert-only, deterministic replay, fail-closed on corruption, zero new
 * dependency, no compaction/delete/rewrite — this is what gives the
 * Device Replacement audit link (and, by extension,
 * `deriveFedosDeviceLifecycleState()`'s own `"replaced"` view)
 * restart-safety.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  decodeFedosDeviceReplacementRecordV1,
  encodeFedosDeviceReplacementRecordV1,
} from "../fedos_device_replacement_record.js";
import {
  fedosDeviceReplacementRecordKey,
  fedosDeviceReplacementRecordsAreEqual,
  type FedosDeviceReplacementPersistence,
  type FedosDeviceReplacementWriteResult,
} from "./fedos_device_replacement_persistence.js";
import type { FedosDeviceReplacementRecordV1 } from "../fedos_device_replacement_record.js";

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
function replayLog(filePath: string): FedosDeviceReplacementRecordV1[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, FedosDeviceReplacementRecordV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = decodeFedosDeviceReplacementRecordV1(line);
    if (parsed === null) {
      throw new Error("AppendOnlyFedosDeviceReplacementPersistence: corrupt or schema-invalid record found in log file.");
    }
    const key = fedosDeviceReplacementRecordKey(parsed);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsed);
    } else if (!fedosDeviceReplacementRecordsAreEqual(existing, parsed)) {
      throw new Error(`AppendOnlyFedosDeviceReplacementPersistence: conflicting duplicate records for key "${key}" found in log file.`);
    }
  }
  return [...byKey.values()];
}

export class AppendOnlyFedosDeviceReplacementPersistence implements FedosDeviceReplacementPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putReplacement(record: FedosDeviceReplacementRecordV1): FedosDeviceReplacementWriteResult {
    const key = fedosDeviceReplacementRecordKey(record);
    const existing = replayLog(this.#filePath).find((r) => fedosDeviceReplacementRecordKey(r) === key) ?? null;
    if (existing !== null) {
      return fedosDeviceReplacementRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, encodeFedosDeviceReplacementRecordV1(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getReplacementForOldDevice(oldDeviceId: string): FedosDeviceReplacementRecordV1 | null {
    return replayLog(this.#filePath).find((r) => r.oldDeviceId === oldDeviceId) ?? null;
  }

  listReplacements(): readonly FedosDeviceReplacementRecordV1[] {
    return replayLog(this.#filePath);
  }
}
