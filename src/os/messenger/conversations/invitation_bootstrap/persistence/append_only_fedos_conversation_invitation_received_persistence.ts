/**
 * Secure Runtime Alpha 7081-7160 — Append-Only Received-Invitation
 * Persistence. Mirrors `append_only_fedos_ratchet_peer_capability_observation_persistence.ts`'s
 * NDJSON-backend discipline exactly: independent log file, insert-only,
 * deterministic replay, fail-closed on corruption, zero new dependency,
 * no compaction/delete/rewrite. This is what gives restart-safe
 * idempotent duplicate-invitation handling: a received invitation
 * recorded before a restart is still on file after, because
 * `listReceived()` replays this same log.
 */

import { readFileSync, appendFileSync } from "node:fs";
import {
  decodeFedosConversationInvitationReceivedRecordV1 as decodeFromLine,
  encodeFedosConversationInvitationReceivedRecordV1 as encodeToLine,
} from "./fedos_conversation_invitation_received_codec.js";
import {
  fedosConversationInvitationReceivedRecordKey,
  fedosConversationInvitationReceivedRecordsAreEqual,
  type FedosConversationInvitationReceivedPersistence,
  type FedosConversationInvitationReceivedWriteResult,
} from "./fedos_conversation_invitation_received_persistence.js";
import type { FedosConversationInvitationReceivedRecordV1 } from "../fedos_conversation_invitation_received_record.js";

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
function replayLog(filePath: string): FedosConversationInvitationReceivedRecordV1[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, FedosConversationInvitationReceivedRecordV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = decodeFromLine(line);
    if (parsed === null) {
      throw new Error("AppendOnlyFedosConversationInvitationReceivedPersistence: corrupt or schema-invalid record found in log file.");
    }
    const key = fedosConversationInvitationReceivedRecordKey(parsed);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsed);
    } else if (!fedosConversationInvitationReceivedRecordsAreEqual(existing, parsed)) {
      throw new Error(`AppendOnlyFedosConversationInvitationReceivedPersistence: conflicting duplicate records for key "${key}" found in log file.`);
    }
  }
  return [...byKey.values()];
}

export class AppendOnlyFedosConversationInvitationReceivedPersistence implements FedosConversationInvitationReceivedPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putReceived(record: FedosConversationInvitationReceivedRecordV1): FedosConversationInvitationReceivedWriteResult {
    const key = fedosConversationInvitationReceivedRecordKey(record);
    const existing = replayLog(this.#filePath).find((r) => fedosConversationInvitationReceivedRecordKey(r) === key) ?? null;
    if (existing !== null) {
      return fedosConversationInvitationReceivedRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, encodeToLine(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  listReceived(): readonly FedosConversationInvitationReceivedRecordV1[] {
    return replayLog(this.#filePath);
  }
}
