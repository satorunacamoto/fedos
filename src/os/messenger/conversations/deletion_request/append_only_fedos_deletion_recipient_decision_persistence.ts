/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Append-Only Recipient Decision State Persistence.
 *
 * Mirrors `append_only_fedos_deletion_request_state_persistence.ts`
 * exactly, over the recipient-decision domain.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import type { FedosPersistedDeletionRecipientDecisionRecordV1 } from "../../../../conversation/deletion_request/fedos_persisted_deletion_recipient_decision_record_v1.js";
import {
  evaluateFedosDeletionRecipientDecisionWrite,
  type FedosDeletionRecipientDecisionPersistence,
  type FedosDeletionRecipientDecisionPersistenceWriteResult,
} from "../../../../conversation/deletion_request/fedos_deletion_recipient_decision_persistence.js";

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
  readonly latestByRequestId: Map<string, FedosPersistedDeletionRecipientDecisionRecordV1>;
  readonly allSnapshots: FedosPersistedDeletionRecipientDecisionRecordV1[];
} {
  const contents = readLogFile(filePath);
  const latestByRequestId = new Map<string, FedosPersistedDeletionRecipientDecisionRecordV1>();
  const allSnapshots: FedosPersistedDeletionRecipientDecisionRecordV1[] = [];
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPersistedDeletionRecipientDecisionRecordV1;
    const outcome = evaluateFedosDeletionRecipientDecisionWrite(latestByRequestId.get(parsed.requestId) ?? null, parsed);
    if (outcome !== "inserted") {
      throw new Error(`AppendOnlyFedosDeletionRecipientDecisionPersistence: log file contains an invalid transition for requestId "${parsed.requestId}" (outcome "${outcome}").`);
    }
    latestByRequestId.set(parsed.requestId, parsed);
    allSnapshots.push(parsed);
  }
  return { latestByRequestId, allSnapshots };
}

export class AppendOnlyFedosDeletionRecipientDecisionPersistence implements FedosDeletionRecipientDecisionPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putRecord(record: FedosPersistedDeletionRecipientDecisionRecordV1): FedosDeletionRecipientDecisionPersistenceWriteResult {
    const { latestByRequestId } = replayLog(this.#filePath);
    const outcome = evaluateFedosDeletionRecipientDecisionWrite(latestByRequestId.get(record.requestId) ?? null, record);
    if (outcome !== "inserted") return outcome;
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getRecord(requestId: string): FedosPersistedDeletionRecipientDecisionRecordV1 | null {
    return replayLog(this.#filePath).latestByRequestId.get(requestId) ?? null;
  }

  listAllSnapshots(): readonly FedosPersistedDeletionRecipientDecisionRecordV1[] {
    return replayLog(this.#filePath).allSnapshots;
  }
}
