/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Append-Only Outbound Request State Persistence.
 *
 * Mirrors `b3b3a6d`'s own `AppendOnlyFedosDeletionExecutionPersistence`
 * backend exactly — one independent NDJSON log file, insert-only,
 * fail-closed on corruption. A restart REPLAYS every line in file order
 * (`evaluateFedosDeletionRequestStateWrite` re-validates each transition
 * during replay too — the SAME function a live write uses) and keeps the
 * LATEST valid snapshot per `requestId`; a stray line that would not
 * have been a valid write (corruption, or a hand-edited file) throws,
 * never silently skips.
 */

import { readFileSync, appendFileSync } from "node:fs";
import type { FedosPersistedDeletionRequestStateRecordV1 } from "./fedos_persisted_deletion_request_state_record_v1.js";
import {
  evaluateFedosDeletionRequestStateWrite,
  type FedosDeletionRequestStatePersistence,
  type FedosDeletionRequestStatePersistenceWriteResult,
} from "./fedos_deletion_request_state_persistence.js";

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

function replayLog(filePath: string): {
  readonly latestByRequestId: Map<string, FedosPersistedDeletionRequestStateRecordV1>;
  readonly allSnapshots: FedosPersistedDeletionRequestStateRecordV1[];
} {
  const contents = readLogFile(filePath);
  const latestByRequestId = new Map<string, FedosPersistedDeletionRequestStateRecordV1>();
  const allSnapshots: FedosPersistedDeletionRequestStateRecordV1[] = [];
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPersistedDeletionRequestStateRecordV1;
    const outcome = evaluateFedosDeletionRequestStateWrite(latestByRequestId.get(parsed.requestId) ?? null, parsed);
    if (outcome !== "inserted") {
      throw new Error(`AppendOnlyFedosDeletionRequestStatePersistence: log file contains an invalid transition for requestId "${parsed.requestId}" (outcome "${outcome}").`);
    }
    latestByRequestId.set(parsed.requestId, parsed);
    allSnapshots.push(parsed);
  }
  return { latestByRequestId, allSnapshots };
}

export class AppendOnlyFedosDeletionRequestStatePersistence implements FedosDeletionRequestStatePersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putRecord(record: FedosPersistedDeletionRequestStateRecordV1): FedosDeletionRequestStatePersistenceWriteResult {
    const { latestByRequestId } = replayLog(this.#filePath);
    const outcome = evaluateFedosDeletionRequestStateWrite(latestByRequestId.get(record.requestId) ?? null, record);
    if (outcome !== "inserted") return outcome;
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getRecord(requestId: string): FedosPersistedDeletionRequestStateRecordV1 | null {
    return replayLog(this.#filePath).latestByRequestId.get(requestId) ?? null;
  }

  listAllSnapshots(): readonly FedosPersistedDeletionRequestStateRecordV1[] {
    return replayLog(this.#filePath).allSnapshots;
  }
}
