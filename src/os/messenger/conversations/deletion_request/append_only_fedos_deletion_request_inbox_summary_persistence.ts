/**
 * Secure Runtime Alpha 6041-6120 — append-only backend for
 * `FedosDeletionRequestInboxSummaryPersistence`, mirroring every other
 * append-only backend in this domain (`5641-5720`, unmodified) exactly:
 * one independent NDJSON log, insert-only, fail-closed on corruption.
 */
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  evaluateFedosDeletionRequestInboxSummaryWrite,
  type FedosDeletionRequestInboxSummaryPersistence,
  type FedosDeletionRequestInboxSummaryV1,
  type FedosDeletionRequestInboxSummaryWriteResult,
} from "../../../../conversation/deletion_request/fedos_deletion_request_inbox_summary.js";

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

function replayLog(filePath: string): Map<string, FedosDeletionRequestInboxSummaryV1> {
  const byRequestId = new Map<string, FedosDeletionRequestInboxSummaryV1>();
  for (const rawLine of readLogFile(filePath).split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosDeletionRequestInboxSummaryV1;
    const outcome = evaluateFedosDeletionRequestInboxSummaryWrite(byRequestId.get(parsed.requestId) ?? null, parsed);
    if (outcome !== "inserted") {
      throw new Error(`AppendOnlyFedosDeletionRequestInboxSummaryPersistence: invalid entry for requestId "${parsed.requestId}" (outcome "${outcome}").`);
    }
    byRequestId.set(parsed.requestId, parsed);
  }
  return byRequestId;
}

export class AppendOnlyFedosDeletionRequestInboxSummaryPersistence implements FedosDeletionRequestInboxSummaryPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putSummary(summary: FedosDeletionRequestInboxSummaryV1): FedosDeletionRequestInboxSummaryWriteResult {
    const byRequestId = replayLog(this.#filePath);
    const outcome = evaluateFedosDeletionRequestInboxSummaryWrite(byRequestId.get(summary.requestId) ?? null, summary);
    if (outcome !== "inserted") return outcome;
    try {
      appendFileSync(this.#filePath, JSON.stringify(summary) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getSummary(requestId: string): FedosDeletionRequestInboxSummaryV1 | null {
    return replayLog(this.#filePath).get(requestId) ?? null;
  }

  listSummaries(): readonly FedosDeletionRequestInboxSummaryV1[] {
    return [...replayLog(this.#filePath).values()];
  }
}
