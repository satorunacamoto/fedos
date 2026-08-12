/**
 * Secure Runtime Alpha 353 ("Implement AppendOnlyFedosBoardPersistence")
 * / Alpha 354 ("Append Semantics") / Alpha 355 ("Reading") / Alpha 356
 * ("Conflict Handling") / Alpha 357 ("Crash Review") — Stages 3–7 of
 * the Alpha 351–360 Append-only Durable Board Backend Arc.
 *
 * The FIRST real durable `FedosBoardPersistence` (`./fedos_board_persistence.js`,
 * Alpha 315, port UNCHANGED) — the architecture Alpha 349 froze,
 * implemented using ONLY Node's built-in `node:fs`, no external
 * dependency. Named `AppendOnlyFedosBoardPersistence` (not the bare
 * "AppendOnlyBoardPersistence" this Arc's own instruction used) to
 * match this repository's own established `Fedos`-prefixed naming
 * convention for every concrete port implementation
 * (`InMemoryFedosBoardPersistence`, Alpha 316; `PersistedFedosBoardRepository`,
 * Alpha 317).
 *
 * RECORD FORMAT (Alpha 352): one JSON-serialized
 * `FedosPersistedBoardPostRecordV1` per line, `\n`-terminated (JSON
 * Lines / NDJSON) — no binary format, no compression, no batching. This
 * is the FIRST place anywhere in the Board persistence layer that
 * calls `JSON.stringify`/`JSON.parse` — `fedos_board_post_codec.ts`
 * (Alpha 314) deliberately stops one layer short of any wire format
 * (see that Stage's own design doc). See
 * `docs/secure_runtime_alpha_352_append_only_record_format.md` for the
 * full format specification and crash-assumption disclosure (notably:
 * NO explicit `fsync` is called — a genuine, disclosed, unresolved
 * durability gap for true power-loss events, distinct from an ordinary
 * process crash, which this file already tolerates cleanly).
 *
 * APPEND SEMANTICS (Alpha 354): `putPost()` NEVER rewrites, NEVER
 * truncates, and NEVER reorders the log file. A genuinely new `id` is
 * appended via exactly one `appendFileSync` call. An `"already-present"`
 * or `"conflict"` outcome writes NOTHING — mirroring
 * `InMemoryFedosBoardPersistence`'s own no-op-beyond-the-return-token
 * behavior on those same two outcomes (Alpha 316), and keeping the log
 * free of redundant duplicate lines for every write this class itself
 * performs.
 *
 * READING (Alpha 355): `getPost()`/`listPosts()` rebuild state by
 * REPLAYING the append log on every call — NO in-memory index/cache of
 * any kind is held between calls (this Stage's own explicit scope: "No
 * side indexes yet"). `getPost()` is implemented in terms of
 * `listPosts()`, guaranteeing byte-identical corruption/fail-closed
 * behavior between the two.
 *
 * CONFLICT HANDLING (Alpha 356): `putPost()`'s four outcomes —
 * `"inserted"` / `"already-present"` / `"conflict"` / `"failed"` —
 * behave EXACTLY like `InMemoryFedosBoardPersistence` (Alpha 316) for
 * the first three, using the SAME `fedosPersistedBoardPostRecordsAreEqual`
 * equality check (Alpha 315, unmodified) to distinguish
 * `"already-present"` from `"conflict"`. `"failed"` is now REACHABLE
 * for the first time in this repository — exactly the case
 * `PersistedFedosBoardRepository.register()`'s own Alpha 317 comment
 * anticipated ("Unreachable with `InMemoryFedosBoardPersistence` this
 * Arc — a documented, deliberate, conservative mapping for a future
 * durable backend"): a genuine I/O failure during the `appendFileSync`
 * call itself (e.g. a missing parent directory) is caught and mapped
 * to `"failed"`, never left to propagate as an uncaught exception.
 *
 * CRASH REVIEW (Alpha 357): "Fail closed. Never repair automatically."
 * — applied UNIFORMLY to every corruption shape this Stage reviews
 * (empty file, duplicate append, a truncated trailing line, malformed
 * JSON, an unknown schema version), with NO special-casing of a
 * trailing line versus a mid-file one. Concretely:
 *   - An EMPTY or MISSING file is NOT corruption — `listPosts()`
 *     returns `[]`.
 *   - A NON-EMPTY line that fails `JSON.parse` (whether truncated by a
 *     crash mid-write, or malformed for any other reason) causes
 *     `getPost()`/`listPosts()` to THROW — deliberately, not silently
 *     dropped or "repaired" by assuming it is a harmless crash
 *     artifact. This is this Arc's own explicit resolution of the
 *     "unsolved design gap" Alpha 345 (§6) named: rather than trying
 *     to distinguish a trailing partial write from a mid-file corrupt
 *     record — a heuristic that would itself be a repair decision —
 *     this Stage treats the two IDENTICALLY, fail-closed, always.
 *   - Two lines sharing the SAME `id` with STRUCTURALLY IDENTICAL
 *     content (Alpha 315's own `fedosPersistedBoardPostRecordsAreEqual`)
 *     collapse to one record during replay — this is NOT a repair, it
 *     is the SAME idempotent "already-present" semantics the port
 *     already defines as correct (Alpha 315 §"already-present").
 *   - Two lines sharing the SAME `id` with DIFFERENT content is a
 *     genuine, irreconcilable conflict IN THE LOG ITSELF — replay
 *     THROWS rather than silently picking a winner (which would be a
 *     repair decision).
 *   - An unknown `schemaVersion` requires NO special code in this
 *     file at all: `JSON.parse` succeeds, the raw record is returned
 *     unvalidated (this port never validates record CONTENT, only
 *     Alpha 314's `deserializeFedosBoardPost` does, one layer up), and
 *     `hydrateFedosBoardService`'s own existing fail-closed
 *     `"rejected-corrupt-record"` handling (Alpha 318, UNMODIFIED)
 *     already covers it completely.
 *
 * HARD GUARDRAILS:
 *   - `AppendOnlyFedosBoardPersistence` is the ONLY export.
 *   - Implements `FedosBoardPersistence` (Alpha 315) verbatim — NO new
 *     method, NO new field on the port, NO change to
 *     `FedosBoardPersistenceWriteResult`.
 *   - The constructor performs NO filesystem I/O of any kind — it only
 *     stores the given file path, matching `InMemoryFedosBoardPersistence`'s
 *     own "Deterministic, no constructor side effects" guardrail
 *     (Alpha 316).
 *   - NO external dependency of any kind — `node:fs` only, reached the
 *     SAME untyped way `fedos_windows_dpapi_helper.ts` already reaches
 *     `node:child_process` (Alpha 023): a `// @ts-expect-error`, since
 *     this project's own `tsconfig.json` carries no `@types/node`.
 *   - NO in-memory cache/index of any kind is held between calls — see
 *     Alpha 355 above.
 *   - NO compression, NO binary format, NO write batching — every
 *     `putPost()` call that actually writes performs exactly ONE
 *     `appendFileSync` call for exactly ONE record.
 *   - NO automatic repair of any kind, ever — a corrupt or conflicting
 *     log causes an exception, never a silently-dropped or
 *     silently-resolved record.
 *   - NO reference to `src/worker.ts`, `src/runtime/*`, `src/desktop/*`
 *     (including `src/desktop/host/*`), `src/identity/*`, any Protocol
 *     Adapter, Relay, Ontology, `p2p/`, SQLite, D1, or IndexedDB.
 */

import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosPersistedBoardPostRecordsAreEqual,
  type FedosBoardPersistence,
  type FedosBoardPersistenceWriteResult,
} from "./fedos_board_persistence.js";
import type { FedosPersistedBoardPostRecordV1 } from "./fedos_persisted_board_post_v1.js";

/** PRIVATE — narrow, dependency-free check for a Node `ENOENT` error, without `@types/node`. */
function isEnoent(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code?: unknown }).code === "ENOENT"
  );
}

/**
 * PRIVATE — reads the log file's raw contents. A missing file is NOT
 * corruption: it reads as an empty, freshly-started log (`""`). Any
 * OTHER read failure (e.g. a permissions error) propagates unmodified
 * — fail closed, never silently treated as empty.
 */
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
 * records, in on-disk order. Blank lines (including the single
 * trailing blank entry every properly `\n`-terminated file produces)
 * are skipped — they are not corruption, merely an artifact of
 * line-splitting. Every non-blank line is parsed as JSON and MUST
 * succeed; a parse failure (a truncated trailing write, or any other
 * malformed line) throws, unconditionally — see Alpha 357 above for
 * why this Stage does not special-case a trailing line. Two lines
 * sharing the same `id` collapse if structurally identical
 * (`fedosPersistedBoardPostRecordsAreEqual`, Alpha 315); otherwise
 * this function throws — a conflicting duplicate in the log itself is
 * never silently resolved.
 */
function replayLog(filePath: string): FedosPersistedBoardPostRecordV1[] {
  const contents = readLogFile(filePath);
  const byId = new Map<string, FedosPersistedBoardPostRecordV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPersistedBoardPostRecordV1;
    const existing = byId.get(parsed.id);
    if (existing === undefined) {
      byId.set(parsed.id, parsed);
    } else if (!fedosPersistedBoardPostRecordsAreEqual(existing, parsed)) {
      throw new Error(
        `AppendOnlyFedosBoardPersistence: conflicting duplicate records for id "${String(parsed.id)}" found in log file.`,
      );
    }
  }
  return [...byId.values()];
}

export class AppendOnlyFedosBoardPersistence implements FedosBoardPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putPost(record: FedosPersistedBoardPostRecordV1): FedosBoardPersistenceWriteResult {
    const existing = this.getPost(record.id);
    if (existing !== null) {
      return fedosPersistedBoardPostRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getPost(id: string): FedosPersistedBoardPostRecordV1 | null {
    return this.listPosts().find((record) => record.id === id) ?? null;
  }

  listPosts(): readonly FedosPersistedBoardPostRecordV1[] {
    return replayLog(this.#filePath);
  }
}
