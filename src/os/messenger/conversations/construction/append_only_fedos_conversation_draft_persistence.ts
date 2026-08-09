/**
 * Secure Runtime Alpha 894 — append-only `FedosConversationDraftPersistence`
 * backend. Mirrors `AppendOnlyFedosConversationPersistence`'s own
 * established backend exactly (Alpha 752): an INDEPENDENT NDJSON log
 * file, one `FedosPersistedConversationDraftRecordV1` per line,
 * insert-only, replayed on every read, with no side index held between
 * calls.
 *
 * CRASH REVIEW: identical policy to Alpha 752/357 — "fail closed, never
 * repair automatically." An empty/missing file is NOT corruption
 * (`listDrafts()` returns `[]`). A non-blank line that fails `JSON.parse`
 * THROWS. Two lines sharing the same `id` with identical content collapse
 * (idempotent); two lines sharing the same `id` with different content is
 * an irreconcilable conflict IN THE LOG — replay THROWS.
 *
 * HARD GUARDRAILS:
 *   - `AppendOnlyFedosConversationDraftPersistence` is the ONLY export.
 *   - The constructor performs NO filesystem I/O — only stores the path.
 *   - `node:fs` only — no external dependency, reached the SAME untyped
 *     way the sibling backends already do.
 *   - NO delete/compaction/rewrite method of any kind.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosPersistedConversationDraftRecordsAreEqual,
  type FedosConversationDraftPersistence,
  type FedosConversationDraftPersistenceWriteResult,
} from "../../../../conversation/construction/fedos_conversation_draft_persistence.js";
import type { FedosPersistedConversationDraftRecordV1 } from "../../../../conversation/construction/fedos_persisted_conversation_draft_record_v1.js";
import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";

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

function replayLog(filePath: string): FedosPersistedConversationDraftRecordV1[] {
  const contents = readLogFile(filePath);
  const byId = new Map<string, FedosPersistedConversationDraftRecordV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPersistedConversationDraftRecordV1;
    const existing = byId.get(parsed.id);
    if (existing === undefined) {
      byId.set(parsed.id, parsed);
    } else if (!fedosPersistedConversationDraftRecordsAreEqual(existing, parsed)) {
      throw new Error(
        `AppendOnlyFedosConversationDraftPersistence: conflicting duplicate records for id "${String(parsed.id)}" found in log file.`,
      );
    }
  }
  return [...byId.values()];
}

export class AppendOnlyFedosConversationDraftPersistence implements FedosConversationDraftPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putDraft(record: FedosPersistedConversationDraftRecordV1): FedosConversationDraftPersistenceWriteResult {
    const existing = this.getDraft(record.id as FedosConversationId);
    if (existing !== null) {
      return fedosPersistedConversationDraftRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getDraft(id: FedosConversationId): FedosPersistedConversationDraftRecordV1 | null {
    return this.listDrafts().find((record) => record.id === id) ?? null;
  }

  listDrafts(): readonly FedosPersistedConversationDraftRecordV1[] {
    return replayLog(this.#filePath);
  }
}
