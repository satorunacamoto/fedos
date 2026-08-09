/**
 * Secure Runtime Alpha 6201-6280 — append-only backend for
 * `FedosDeletionRequestPendingReviewPersistence`, mirroring
 * `append_only_fedos_deletion_request_inbox_summary_persistence.ts` (`6041-6120`,
 * unmodified) exactly: one independent NDJSON log, insert-only at the byte
 * level (a logical delete is a NEW `"tombstone"` line, never a rewrite),
 * fail-closed (throws) on any corrupt or structurally invalid line.
 */
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  evaluateFedosDeletionRequestPendingReviewPut,
  isWellFormedFedosDeletionRequestPendingReviewLogEntryV1,
  replayFedosDeletionRequestPendingReviewLog,
  type FedosDeletionRequestPendingReviewLogEntryV1,
  type FedosDeletionRequestPendingReviewPersistence,
  type FedosDeletionRequestPendingReviewWriteResult,
} from "./fedos_deletion_request_pending_review_persistence.js";
import type { FedosSignedDeletionRequestV1 } from "./fedos_deletion_request_signing.js";

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

function readEntries(filePath: string): FedosDeletionRequestPendingReviewLogEntryV1[] {
  const entries: FedosDeletionRequestPendingReviewLogEntryV1[] = [];
  for (const rawLine of readLogFile(filePath).split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed: unknown = JSON.parse(line);
    if (!isWellFormedFedosDeletionRequestPendingReviewLogEntryV1(parsed)) {
      throw new Error("AppendOnlyFedosDeletionRequestPendingReviewPersistence: corrupt or structurally invalid log entry.");
    }
    entries.push(parsed);
  }
  return entries;
}

export class AppendOnlyFedosDeletionRequestPendingReviewPersistence implements FedosDeletionRequestPendingReviewPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putPendingReview(requestId: string, signed: FedosSignedDeletionRequestV1, recordedAt: number): FedosDeletionRequestPendingReviewWriteResult {
    const entries = readEntries(this.#filePath);
    const outcome = evaluateFedosDeletionRequestPendingReviewPut(entries, requestId, signed);
    if (outcome !== "inserted") return outcome;
    const entry: FedosDeletionRequestPendingReviewLogEntryV1 = { schemaVersion: 1, requestId, action: "put", signed, recordedAt };
    try {
      appendFileSync(this.#filePath, JSON.stringify(entry) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getPendingReview(requestId: string): FedosSignedDeletionRequestV1 | null {
    return replayFedosDeletionRequestPendingReviewLog(readEntries(this.#filePath)).get(requestId) ?? null;
  }

  tombstonePendingReview(requestId: string, recordedAt: number): void {
    const entry: FedosDeletionRequestPendingReviewLogEntryV1 = { schemaVersion: 1, requestId, action: "tombstone", recordedAt };
    try {
      appendFileSync(this.#filePath, JSON.stringify(entry) + "\n", "utf8");
    } catch {
      // Best-effort — mirrors this domain's own established "a durable side-channel write failure never blocks the real evaluation pipeline" convention (`fedos_deletion_request_inbound_coordinator.ts`'s own inbox-summary write).
    }
  }
}
