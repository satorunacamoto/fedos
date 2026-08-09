/**
 * Secure Runtime Alpha 998 ("Append-Only Invitation Revocation Registry") —
 * Phase B of the Alpha 991–1050 Conversation Invitation Transport & Draft
 * Management Arc.
 *
 * Append-only `FedosConversationInvitationRevocationRegistry` backend. Mirrors
 * `AppendOnlyFedosConversationDraftPersistence`'s own established backend
 * exactly (Alpha 894): an INDEPENDENT NDJSON log file, one
 * `FedosPersistedConversationInvitationRevocationV1` per line, insert-only,
 * replayed on every read, with no side index held between calls.
 *
 * CRASH REVIEW: identical policy to Alpha 752/894 — "fail closed, never repair
 * automatically." An empty/missing file is NOT corruption
 * (`listConversationRevocations()` returns `[]`). A non-blank line that fails
 * `JSON.parse` THROWS. Two lines sharing the same `capabilityId` with identical
 * content collapse (idempotent); two lines sharing the same `capabilityId` with
 * DIFFERENT content is an irreconcilable conflict IN THE LOG — replay THROWS.
 *
 * HARD GUARDRAILS:
 *   - `AppendOnlyFedosConversationInvitationRevocationRegistry` is the ONLY
 *     export.
 *   - The constructor performs NO filesystem I/O — only stores the path.
 *   - `node:fs` only — no external dependency, reached the SAME untyped way the
 *     sibling backends already do.
 *   - NO delete/compaction/rewrite method of any kind.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosConversationInvitationRevocationRecordKey,
  fedosPersistedConversationInvitationRevocationsAreEqual,
  type FedosPersistedConversationInvitationRevocationV1,
} from "../../../../conversation/invitation/fedos_persisted_conversation_invitation_revocation_v1.js";
import {
  type FedosConversationInvitationRevocationRegistry,
  type FedosConversationInvitationRevocationWriteResult,
} from "../../../../conversation/invitation/fedos_conversation_invitation_revocation_registry.js";

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

function replayLog(filePath: string): FedosPersistedConversationInvitationRevocationV1[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, FedosPersistedConversationInvitationRevocationV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPersistedConversationInvitationRevocationV1;
    const key = fedosConversationInvitationRevocationRecordKey(parsed.capabilityId);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsed);
    } else if (!fedosPersistedConversationInvitationRevocationsAreEqual(existing, parsed)) {
      throw new Error(
        `AppendOnlyFedosConversationInvitationRevocationRegistry: conflicting duplicate records for capability id "${String(parsed.capabilityId)}" found in log file.`,
      );
    }
  }
  return [...byKey.values()];
}

export class AppendOnlyFedosConversationInvitationRevocationRegistry implements FedosConversationInvitationRevocationRegistry {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putRevocation(record: FedosPersistedConversationInvitationRevocationV1): FedosConversationInvitationRevocationWriteResult {
    const existing = this.getRevocation(record.capabilityId);
    if (existing !== null) {
      return fedosPersistedConversationInvitationRevocationsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getRevocation(capabilityId: string): FedosPersistedConversationInvitationRevocationV1 | null {
    return replayLog(this.#filePath).find((record) => record.capabilityId === capabilityId) ?? null;
  }

  isRevoked(capabilityId: string): boolean {
    return this.getRevocation(capabilityId) !== null;
  }

  listConversationRevocations(conversationId: string): readonly FedosPersistedConversationInvitationRevocationV1[] {
    return replayLog(this.#filePath).filter((record) => record.conversationId === conversationId);
  }
}
