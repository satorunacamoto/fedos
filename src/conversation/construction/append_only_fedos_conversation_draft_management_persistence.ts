/**
 * Secure Runtime Alpha 1005 ("Append-Only Draft Management Persistence") —
 * Phase C of the Alpha 991–1050 Conversation Invitation Transport & Draft
 * Management Arc.
 *
 * Append-only `FedosConversationDraftManagementPersistence` backend. Mirrors
 * `AppendOnlyFedosConversationConstructionCoordinationPersistence`'s own
 * event-keyed backend exactly (Alpha 914): an INDEPENDENT NDJSON log file, one
 * `FedosPersistedConversationDraftManagementStateV1` per line, insert-only,
 * replayed on every read, with no side index held between calls.
 *
 * CRASH REVIEW: identical policy to Alpha 752/914 — "fail closed, never repair
 * automatically." An empty/missing file is NOT corruption. A non-blank line
 * that fails `JSON.parse` THROWS. Two lines sharing the same
 * `(conversationId, revision)` with identical content collapse (idempotent);
 * two lines sharing that key with DIFFERENT content is an irreconcilable
 * conflict IN THE LOG — replay THROWS.
 *
 * HARD GUARDRAILS:
 *   - `AppendOnlyFedosConversationDraftManagementPersistence` is the ONLY
 *     export.
 *   - The constructor performs NO filesystem I/O — only stores the path.
 *   - `node:fs` only — no external dependency.
 *   - NO delete/compaction/rewrite method of any kind.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosConversationDraftManagementStateRecordKey,
  fedosPersistedConversationDraftManagementStatesAreEqual,
  resolveCurrentDraftManagementState,
  type FedosPersistedConversationDraftManagementStateV1,
} from "./fedos_persisted_conversation_draft_management_state_v1.js";
import {
  type FedosConversationDraftManagementPersistence,
  type FedosConversationDraftManagementWriteResult,
} from "./fedos_conversation_draft_management_persistence.js";

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

function replayLog(filePath: string): FedosPersistedConversationDraftManagementStateV1[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, FedosPersistedConversationDraftManagementStateV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPersistedConversationDraftManagementStateV1;
    const key = fedosConversationDraftManagementStateRecordKey(parsed.conversationId, parsed.revision);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsed);
    } else if (!fedosPersistedConversationDraftManagementStatesAreEqual(existing, parsed)) {
      throw new Error(
        `AppendOnlyFedosConversationDraftManagementPersistence: conflicting duplicate records for key "${key}" found in log file.`,
      );
    }
  }
  return [...byKey.values()];
}

export class AppendOnlyFedosConversationDraftManagementPersistence implements FedosConversationDraftManagementPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putManagementFact(record: FedosPersistedConversationDraftManagementStateV1): FedosConversationDraftManagementWriteResult {
    const key = fedosConversationDraftManagementStateRecordKey(record.conversationId, record.revision);
    const existing = replayLog(this.#filePath).find(
      (r) => fedosConversationDraftManagementStateRecordKey(r.conversationId, r.revision) === key,
    ) ?? null;
    if (existing !== null) {
      return fedosPersistedConversationDraftManagementStatesAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getCurrentManagementState(conversationId: string): FedosPersistedConversationDraftManagementStateV1 | null {
    return resolveCurrentDraftManagementState(this.#factsFor(conversationId));
  }

  listManagementFacts(conversationId: string): readonly FedosPersistedConversationDraftManagementStateV1[] {
    return this.#factsFor(conversationId);
  }

  #factsFor(conversationId: string): FedosPersistedConversationDraftManagementStateV1[] {
    return replayLog(this.#filePath).filter((record) => record.conversationId === conversationId);
  }
}
