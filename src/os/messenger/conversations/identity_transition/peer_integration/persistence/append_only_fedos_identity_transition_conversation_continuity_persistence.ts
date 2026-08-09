/**
 * Secure Runtime Alpha 6121–6200 — Append-Only Conversation Continuity
 * Persistence. Mirrors every other append-only backend in this domain.
 */
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  decodeFedosIdentityTransitionConversationContinuityRecordV1,
  determineFedosIdentityTransitionConversationContinuityWriteOutcome,
  encodeFedosIdentityTransitionConversationContinuityRecordV1,
  fedosIdentityTransitionConversationContinuityKey,
  fedosIdentityTransitionConversationContinuityLineageKey,
  type FedosIdentityTransitionConversationContinuityPersistence,
  type FedosIdentityTransitionConversationContinuityRecordV1,
  type FedosIdentityTransitionConversationContinuityWriteOutcome,
} from "../../../../../../conversation/identity_transition/peer_integration/fedos_identity_transition_conversation_continuity.js";

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

function replayLog(filePath: string): FedosIdentityTransitionConversationContinuityRecordV1[] {
  const contents = readLogFile(filePath);
  const records: FedosIdentityTransitionConversationContinuityRecordV1[] = [];
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = decodeFedosIdentityTransitionConversationContinuityRecordV1(line);
    if (parsed === null) {
      throw new Error("AppendOnlyFedosIdentityTransitionConversationContinuityPersistence: corrupt or schema-invalid record found in log file.");
    }
    records.push(parsed);
  }
  return records;
}

export class AppendOnlyFedosIdentityTransitionConversationContinuityPersistence implements FedosIdentityTransitionConversationContinuityPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putRecord(record: FedosIdentityTransitionConversationContinuityRecordV1): FedosIdentityTransitionConversationContinuityWriteOutcome {
    const existing = replayLog(this.#filePath);
    const outcome = determineFedosIdentityTransitionConversationContinuityWriteOutcome(existing, record);
    if (outcome !== "inserted") return outcome;
    try {
      appendFileSync(this.#filePath, encodeFedosIdentityTransitionConversationContinuityRecordV1(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  listForConversation(localDeviceRef: string, conversationId: string): readonly FedosIdentityTransitionConversationContinuityRecordV1[] {
    const key = JSON.stringify([localDeviceRef, conversationId]);
    return replayLog(this.#filePath).filter((r) => fedosIdentityTransitionConversationContinuityLineageKey(r) === key);
  }

  getCurrentForConversation(localDeviceRef: string, conversationId: string): FedosIdentityTransitionConversationContinuityRecordV1 | null {
    const rows = this.listForConversation(localDeviceRef, conversationId);
    if (rows.length === 0) return null;
    return rows.reduce((latest, r) => (r.revision > latest.revision ? r : latest));
  }

  listRecords(): readonly FedosIdentityTransitionConversationContinuityRecordV1[] {
    return replayLog(this.#filePath);
  }
}

export { fedosIdentityTransitionConversationContinuityKey };
