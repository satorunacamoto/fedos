/**
 * Secure Runtime Alpha 796 ("Retention Authority Boundary") — Stage 6
 * of the Alpha 791–820 Conversation Retention & Private Payload
 * Storage Boundary Foundation Arc.
 *
 * Mirrors `AppendOnlyFedosConversationPersistence`'s own established
 * backend exactly (Alpha 752/353-357) — independent log file, NDJSON,
 * insert-only, fail-closed on corruption, no compaction/delete/rewrite.
 */

import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosPersistedPayloadRetentionDecisionsAreEqual,
  type FedosPayloadRetentionPersistence,
  type FedosPayloadRetentionPersistenceWriteResult,
} from "./fedos_payload_retention_persistence.js";
import { fedosPayloadRetentionDecisionKey, type FedosPayloadRetentionAction } from "./fedos_payload_retention_decision.js";
import type { FedosPersistedPayloadRetentionDecisionV1 } from "./fedos_persisted_payload_retention_decision_v1.js";
import type { FedosConversationPayloadId } from "../payload_storage/fedos_conversation_payload_id.js";

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

function replayLog(filePath: string): FedosPersistedPayloadRetentionDecisionV1[] {
  const contents = readLogFile(filePath);
  const byId = new Map<string, FedosPersistedPayloadRetentionDecisionV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPersistedPayloadRetentionDecisionV1;
    const existing = byId.get(parsed.id);
    if (existing === undefined) {
      byId.set(parsed.id, parsed);
    } else if (!fedosPersistedPayloadRetentionDecisionsAreEqual(existing, parsed)) {
      throw new Error(
        `AppendOnlyFedosPayloadRetentionPersistence: conflicting duplicate records for id "${String(parsed.id)}" found in log file.`,
      );
    }
  }
  return [...byId.values()];
}

export class AppendOnlyFedosPayloadRetentionPersistence implements FedosPayloadRetentionPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putDecision(record: FedosPersistedPayloadRetentionDecisionV1): FedosPayloadRetentionPersistenceWriteResult {
    const existing = replayLog(this.#filePath).find((decision) => decision.id === record.id) ?? null;
    if (existing !== null) {
      return fedosPersistedPayloadRetentionDecisionsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getDecision(payloadId: FedosConversationPayloadId, action: FedosPayloadRetentionAction): FedosPersistedPayloadRetentionDecisionV1 | null {
    const key = fedosPayloadRetentionDecisionKey(payloadId, action);
    return replayLog(this.#filePath).find((decision) => decision.id === key) ?? null;
  }

  listDecisionsForPayload(payloadId: FedosConversationPayloadId): readonly FedosPersistedPayloadRetentionDecisionV1[] {
    return replayLog(this.#filePath).filter((decision) => decision.payloadId === payloadId);
  }

  listDecisions(): readonly FedosPersistedPayloadRetentionDecisionV1[] {
    return replayLog(this.#filePath);
  }
}
