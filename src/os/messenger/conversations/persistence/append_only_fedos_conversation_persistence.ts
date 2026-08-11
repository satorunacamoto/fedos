/**
 * Secure Runtime Alpha 752 ("Append-Only Persistence") — Stage 12 of the
 * Alpha 741–760 Canonical Conversation Identity and Record Foundation
 * Arc.
 *
 * Mirrors `AppendOnlyFedosBoardPersistence`'s own established backend
 * exactly (`../../board/persistence/append_only_fedos_board_persistence.ts`,
 * Alpha 353–357) — an INDEPENDENT log file, never sharing a file with
 * Board/Outbox/Observation. One JSON-serialized
 * `FedosPersistedConversationRecordV1` per line (NDJSON), insert-only:
 * `putConversation()` NEVER rewrites, NEVER truncates, and NEVER
 * reorders the log file. Reading REPLAYS the log on every call — no
 * in-memory index/cache is held between calls, the same "no side index"
 * discipline Alpha 355 established for Board persistence, carried over
 * here deliberately (see `docs/secure_runtime_alpha_752_append_only_persistence.md`
 * and Alpha 753's own "no separate repository" decision, which depends
 * on this same choice).
 *
 * CRASH REVIEW: identical policy to Alpha 357 — "fail closed, never
 * repair automatically" — applied uniformly. An empty/missing file is
 * NOT corruption (`listConversations()` returns `[]`). A non-blank line
 * that fails `JSON.parse` (a truncated trailing write, or any other
 * malformed line) THROWS, deliberately, with no special-casing of a
 * trailing line versus a mid-file one — the identical reasoning Alpha
 * 357's own design doc gives for Board persistence applies unchanged
 * here: distinguishing "trailing partial write" from "mid-file corrupt
 * record" is itself a repair decision this backend refuses to make. Two
 * lines sharing the same `id` with identical content collapse
 * (idempotent `"already-present"`, not a repair); two lines sharing the
 * same `id` with different content is a genuine, irreconcilable
 * conflict IN THE LOG ITSELF — replay THROWS rather than silently
 * picking a winner.
 *
 * HARD GUARDRAILS:
 *   - `AppendOnlyFedosConversationPersistence` is the ONLY export.
 *   - Implements `FedosConversationPersistence` (Alpha 749) verbatim —
 *     no new method, no new field on the port.
 *   - The constructor performs NO filesystem I/O of any kind — only
 *     stores the given file path (Alpha 316/353's own "no constructor
 *     side effects" guardrail, applied here identically).
 *   - NO external dependency — `node:fs` only, reached the SAME untyped
 *     way `append_only_fedos_board_persistence.ts` already does.
 *   - NO delete/compaction/rewrite method of any kind — this Arc's own
 *     Absolute Prohibitions forbid it entirely, not merely "not this
 *     Arc, later."
 *   - No reference to `src/worker.ts`, `src/runtime/*`, `src/desktop/*`,
 *     `src/identity/*`, any Protocol Adapter, Relay, Ontology, `p2p/`,
 *     SQLite, D1, or IndexedDB.
 */

import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosPersistedConversationRecordsAreEqual,
  type FedosConversationPersistence,
  type FedosConversationPersistenceWriteResult,
} from "./fedos_conversation_persistence.js";
import type { FedosPersistedConversationRecordV1 } from "./fedos_persisted_conversation_record_v1.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";

/** PRIVATE — narrow, dependency-free check for a Node `ENOENT` error, without `@types/node`. Mirrors the Board backend's own identical helper. */
function isEnoent(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code?: unknown }).code === "ENOENT"
  );
}

/** PRIVATE — reads the log file's raw contents. A missing file reads as an empty, freshly-started log. Any other read failure propagates unmodified. */
function readLogFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8") as string;
  } catch (err) {
    if (isEnoent(err)) return "";
    throw err;
  }
}

/**
 * PRIVATE — replays the append log into a deduplicated array of
 * records, in on-disk order. Blank lines are skipped. A parse failure
 * throws unconditionally (see this file's own header §"crash review").
 * Two lines sharing the same `id` collapse if structurally identical;
 * otherwise this function throws.
 */
function replayLog(filePath: string): FedosPersistedConversationRecordV1[] {
  const contents = readLogFile(filePath);
  const byId = new Map<string, FedosPersistedConversationRecordV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPersistedConversationRecordV1;
    const existing = byId.get(parsed.id);
    if (existing === undefined) {
      byId.set(parsed.id, parsed);
    } else if (!fedosPersistedConversationRecordsAreEqual(existing, parsed)) {
      throw new Error(
        `AppendOnlyFedosConversationPersistence: conflicting duplicate records for id "${String(parsed.id)}" found in log file.`,
      );
    }
  }
  return [...byId.values()];
}

export class AppendOnlyFedosConversationPersistence implements FedosConversationPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putConversation(record: FedosPersistedConversationRecordV1): FedosConversationPersistenceWriteResult {
    const existing = this.getConversation(record.id as FedosConversationId);
    if (existing !== null) {
      return fedosPersistedConversationRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getConversation(id: FedosConversationId): FedosPersistedConversationRecordV1 | null {
    return this.listConversations().find((record) => record.id === id) ?? null;
  }

  listConversations(): readonly FedosPersistedConversationRecordV1[] {
    return replayLog(this.#filePath);
  }
}
