/**
 * Secure Runtime Alpha 5401-5480 ("FedOS Local Deletion Capability and
 * Deletion-State Foundation Arc") — Append-Only Deletion Execution
 * Persistence.
 *
 * Mirrors `AppendOnlyFedosPayloadRetentionPersistence`'s own established
 * backend exactly — independent NDJSON log file, insert-only, fail-closed
 * on corruption (an unparseable line or a conflicting duplicate record
 * for the same `planId` throws rather than silently dropping/merging),
 * no compaction/delete/rewrite. This is what makes Phase L (restart /
 * interruption) convergence real: a record is only ever visible once its
 * own line has been durably appended.
 */

import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosPersistedDeletionExecutionRecordsAreEqual,
  type FedosPersistedDeletionExecutionRecordV1,
} from "./fedos_persisted_deletion_execution_record_v1.js";
import type { FedosDeletionExecutionPersistence, FedosDeletionExecutionPersistenceWriteResult } from "./fedos_deletion_execution_persistence.js";

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

function replayLog(filePath: string): FedosPersistedDeletionExecutionRecordV1[] {
  const contents = readLogFile(filePath);
  const byId = new Map<string, FedosPersistedDeletionExecutionRecordV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPersistedDeletionExecutionRecordV1;
    const existing = byId.get(parsed.id);
    if (existing === undefined) {
      byId.set(parsed.id, parsed);
    } else if (!fedosPersistedDeletionExecutionRecordsAreEqual(existing, parsed)) {
      throw new Error(
        `AppendOnlyFedosDeletionExecutionPersistence: conflicting duplicate records for planId "${String(parsed.id)}" found in log file.`,
      );
    }
  }
  return [...byId.values()];
}

export class AppendOnlyFedosDeletionExecutionPersistence implements FedosDeletionExecutionPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putRecord(record: FedosPersistedDeletionExecutionRecordV1): FedosDeletionExecutionPersistenceWriteResult {
    const existing = replayLog(this.#filePath).find((candidate) => candidate.id === record.id) ?? null;
    if (existing !== null) {
      return fedosPersistedDeletionExecutionRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getRecord(planId: string): FedosPersistedDeletionExecutionRecordV1 | null {
    return replayLog(this.#filePath).find((candidate) => candidate.id === planId) ?? null;
  }

  listRecords(): readonly FedosPersistedDeletionExecutionRecordV1[] {
    return replayLog(this.#filePath);
  }
}
