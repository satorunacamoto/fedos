/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Append-Only Acknowledgement Persistence.
 *
 * Mirrors `b3b3a6d`'s own `AppendOnlyFedosDeletionExecutionPersistence`
 * exactly.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosPersistedDeletionAcknowledgementRecordsAreEqual,
  type FedosPersistedDeletionAcknowledgementRecordV1,
} from "./fedos_persisted_deletion_acknowledgement_record_v1.js";
import type { FedosDeletionAcknowledgementPersistence, FedosDeletionAcknowledgementPersistenceWriteResult } from "./fedos_deletion_acknowledgement_persistence.js";

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

function replayLog(filePath: string): FedosPersistedDeletionAcknowledgementRecordV1[] {
  const contents = readLogFile(filePath);
  const byRequestId = new Map<string, FedosPersistedDeletionAcknowledgementRecordV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPersistedDeletionAcknowledgementRecordV1;
    const existing = byRequestId.get(parsed.requestId);
    if (existing === undefined) {
      byRequestId.set(parsed.requestId, parsed);
    } else if (!fedosPersistedDeletionAcknowledgementRecordsAreEqual(existing, parsed)) {
      throw new Error(`AppendOnlyFedosDeletionAcknowledgementPersistence: conflicting duplicate records for requestId "${parsed.requestId}" found in log file.`);
    }
  }
  return [...byRequestId.values()];
}

export class AppendOnlyFedosDeletionAcknowledgementPersistence implements FedosDeletionAcknowledgementPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putRecord(record: FedosPersistedDeletionAcknowledgementRecordV1): FedosDeletionAcknowledgementPersistenceWriteResult {
    const existing = replayLog(this.#filePath).find((candidate) => candidate.requestId === record.requestId) ?? null;
    if (existing !== null) {
      return fedosPersistedDeletionAcknowledgementRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getRecord(requestId: string): FedosPersistedDeletionAcknowledgementRecordV1 | null {
    return replayLog(this.#filePath).find((candidate) => candidate.requestId === requestId) ?? null;
  }

  listRecords(): readonly FedosPersistedDeletionAcknowledgementRecordV1[] {
    return replayLog(this.#filePath);
  }
}
