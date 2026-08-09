/**
 * Secure Runtime Alpha 829 ("Append-Only Membership Persistence") —
 * Stage 9 of the Alpha 821–850 Durable Conversation Membership &
 * Capability Persistence Arc.
 *
 * Mirrors `AppendOnlyFedosPayloadRetentionPersistence`'s own established
 * backend exactly (Alpha 796) — independent NDJSON log file, insert-
 * only, fail-closed on corruption, no compaction/delete/rewrite, zero
 * new dependency (`node:fs` only).
 *
 * CRASH REVIEW — identical policy to Alpha 752/796, "fail closed, never
 * repair automatically": an empty/missing file is NOT corruption
 * (`listMemberships()` returns `[]`). A non-blank line that fails
 * `JSON.parse` THROWS unconditionally — no special-casing of a trailing
 * partial write versus a mid-file corrupt line (Alpha 832's own
 * "Membership Corruption Policy" decision: one corrupt record voids the
 * backend, following this codebase's own existing, reviewed precedent,
 * not a new per-membership quarantine scheme this Arc would have to
 * invent and justify from scratch). Two lines sharing the SAME `(id,
 * state)` key with identical content collapse (idempotent); with
 * different content, replay THROWS (an irreconcilable log conflict).
 * Two records for the SAME `id` under BOTH `"revoked"` AND `"left"`
 * keys is a further corruption case, already handled by
 * `resolveCurrentMembershipRecord()` (throws) — reused here unchanged.
 *
 * HARD GUARDRAILS:
 *   - `AppendOnlyFedosConversationMembershipPersistence` is the ONLY
 *     export.
 *   - Implements `FedosConversationMembershipPersistence` (Alpha 827)
 *     verbatim.
 *   - No constructor filesystem I/O — only stores the given file path.
 *   - No delete/compaction/rewrite method.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosConversationMembershipRecordKey,
  fedosPersistedConversationMembershipsAreEqual,
  resolveCurrentMembershipRecord,
  type FedosConversationMembershipPersistence,
  type FedosConversationMembershipPersistenceWriteResult,
} from "./fedos_conversation_membership_persistence.js";
import type { FedosPersistedConversationMembershipV1 } from "./fedos_persisted_conversation_membership_v1.js";

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

/** PRIVATE — replays the append log into a deduplicated array, keyed by `(id, state)`. A parse failure or irreconcilable duplicate throws unconditionally (see this file's own header). */
function replayLog(filePath: string): FedosPersistedConversationMembershipV1[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, FedosPersistedConversationMembershipV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPersistedConversationMembershipV1;
    const key = fedosConversationMembershipRecordKey(parsed.id, parsed.state);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsed);
    } else if (!fedosPersistedConversationMembershipsAreEqual(existing, parsed)) {
      throw new Error(
        `AppendOnlyFedosConversationMembershipPersistence: conflicting duplicate records for key "${key}" found in log file.`,
      );
    }
  }
  return [...byKey.values()];
}

export class AppendOnlyFedosConversationMembershipPersistence implements FedosConversationMembershipPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putMembership(record: FedosPersistedConversationMembershipV1): FedosConversationMembershipPersistenceWriteResult {
    const key = fedosConversationMembershipRecordKey(record.id, record.state);
    const existing = replayLog(this.#filePath).find((r) => fedosConversationMembershipRecordKey(r.id, r.state) === key) ?? null;
    if (existing !== null) {
      return fedosPersistedConversationMembershipsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getMembership(id: string): FedosPersistedConversationMembershipV1 | null {
    return resolveCurrentMembershipRecord(replayLog(this.#filePath).filter((record) => record.id === id));
  }

  listMemberships(): readonly FedosPersistedConversationMembershipV1[] {
    return this.#currentByDistinctId(replayLog(this.#filePath));
  }

  listConversationMemberships(conversationId: string): readonly FedosPersistedConversationMembershipV1[] {
    return this.#currentByDistinctId(replayLog(this.#filePath).filter((record) => record.conversationId === conversationId));
  }

  #currentByDistinctId(records: readonly FedosPersistedConversationMembershipV1[]): readonly FedosPersistedConversationMembershipV1[] {
    const ids = new Set(records.map((record) => record.id));
    const result: FedosPersistedConversationMembershipV1[] = [];
    for (const id of ids) {
      const current = resolveCurrentMembershipRecord(records.filter((record) => record.id === id));
      if (current !== null) result.push(current);
    }
    return result;
  }
}
