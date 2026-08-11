/**
 * Secure Runtime Alpha 418 ("Append-Only Durable Outbox Persistence") —
 * Stage 8 of the Alpha 411–420 Canonical Board Durable Outbox Foundation
 * Arc.
 *
 * The first real durable `FedosBoardOutboxPersistence`
 * (`./fedos_board_outbox_persistence.js`, Alpha 417, port UNCHANGED),
 * implemented using ONLY Node's built-in `node:fs`, mirroring
 * `AppendOnlyFedosBoardPersistence`
 * (`../persistence/append_only_fedos_board_persistence.ts`, Alpha 353)
 * field-for-field: same JSON-Lines record format, same append-only
 * semantics, same replay-on-every-call reading strategy, same
 * inserted/already-present/conflict/failed conflict handling, same
 * fail-closed crash/corruption discipline (an unparsable or
 * schema-conflicting line THROWS on replay — never silently repaired or
 * dropped).
 *
 * This log is COMPLETELY INDEPENDENT of the Board-post append-only log
 * — a separate file, a separate schema, a separate class. See
 * `docs/secure_runtime_alpha_419_host_submit_outbox_coordination.md`
 * for why the two logs cannot form one true filesystem transaction, and
 * why that limitation is accepted rather than hidden.
 *
 * HARD GUARDRAILS:
 *   - `AppendOnlyFedosBoardOutboxPersistence` is the ONLY export.
 *   - Implements `FedosBoardOutboxPersistence` (Alpha 417) verbatim —
 *     NO new method, NO new field on the port.
 *   - The constructor performs NO filesystem I/O of any kind — it only
 *     stores the given file path.
 *   - NO external dependency — `node:fs` only, reached the same
 *     untyped way `AppendOnlyFedosBoardPersistence` already does.
 *   - NO in-memory cache/index of any kind is held between calls.
 *   - NO compression, NO binary format, NO write batching.
 *   - NO automatic repair of any kind, ever.
 *   - NO default file path — the caller always supplies one; nothing in
 *     this file selects a Host filesystem path.
 *   - NO reference to `src/worker.ts`, `src/runtime/*`, `src/desktop/*`,
 *     `src/identity/*`, any Protocol Adapter, Relay, Ontology, or
 *     `p2p/`.
 */

import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosPersistedBoardOutboxRecordsAreEqual,
  type FedosBoardOutboxPersistence,
  type FedosBoardOutboxPersistenceWriteResult,
} from "./fedos_board_outbox_persistence.js";
import type { FedosPersistedBoardOutboxRecordV1 } from "./fedos_board_outbox_codec.js";

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
 * OTHER read failure propagates unmodified — fail closed.
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
 * records, in on-disk order. Blank lines are skipped. Every non-blank
 * line MUST parse as JSON; a parse failure throws, unconditionally — no
 * trailing-line special-casing, mirroring
 * `AppendOnlyFedosBoardPersistence`'s own Alpha 357 discipline exactly.
 * Two lines sharing the same `id` collapse if structurally identical
 * (`fedosPersistedBoardOutboxRecordsAreEqual`); otherwise this function
 * throws.
 */
function replayLog(filePath: string): FedosPersistedBoardOutboxRecordV1[] {
  const contents = readLogFile(filePath);
  const byId = new Map<string, FedosPersistedBoardOutboxRecordV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPersistedBoardOutboxRecordV1;
    const existing = byId.get(parsed.id);
    if (existing === undefined) {
      byId.set(parsed.id, parsed);
    } else if (!fedosPersistedBoardOutboxRecordsAreEqual(existing, parsed)) {
      throw new Error(
        `AppendOnlyFedosBoardOutboxPersistence: conflicting duplicate records for id "${String(parsed.id)}" found in log file.`,
      );
    }
  }
  return [...byId.values()];
}

export class AppendOnlyFedosBoardOutboxPersistence implements FedosBoardOutboxPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putIntent(record: FedosPersistedBoardOutboxRecordV1): FedosBoardOutboxPersistenceWriteResult {
    const existing = this.getIntent(record.id);
    if (existing !== null) {
      return fedosPersistedBoardOutboxRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getIntent(id: string): FedosPersistedBoardOutboxRecordV1 | null {
    return this.listIntents().find((record) => record.id === id) ?? null;
  }

  listIntents(): readonly FedosPersistedBoardOutboxRecordV1[] {
    return replayLog(this.#filePath);
  }
}
