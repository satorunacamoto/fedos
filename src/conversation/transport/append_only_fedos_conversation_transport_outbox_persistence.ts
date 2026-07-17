/**
 * Secure Runtime Alpha 1471–1540 — the durable
 * `FedosConversationTransportOutboxPersistence`, implemented using ONLY
 * Node's built-in `node:fs`. Mirrors `AppendOnlyFedosBoardOutboxPersistence`
 * (`../../board/outbox/append_only_fedos_board_outbox_persistence.ts`,
 * Alpha 418) field-for-field: same JSON-Lines record format, same
 * append-only semantics, same replay-on-every-call reading strategy, same
 * inserted/already-present/conflict/failed handling, same fail-closed
 * crash/corruption discipline (an unparsable or schema-conflicting line
 * THROWS on replay — never silently repaired or dropped).
 *
 * This log is COMPLETELY INDEPENDENT of the Board Outbox log, the
 * Conversation Envelope log, and every other durable log in this
 * repository — a separate file, a separate schema, a separate class.
 *
 * HARD GUARDRAILS:
 *   - Implements `FedosConversationTransportOutboxPersistence` verbatim
 *     — NO new method, NO new field on the port.
 *   - The constructor performs NO filesystem I/O of any kind — it only
 *     stores the given file path.
 *   - NO external dependency — `node:fs` only.
 *   - NO in-memory cache/index of any kind is held between calls.
 *   - NO automatic repair of any kind, ever.
 *   - NO default file path — the caller always supplies one.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosPersistedConversationTransportOutboxRecordsAreEqual,
  type FedosConversationTransportOutboxPersistence,
  type FedosConversationTransportOutboxPersistenceWriteResult,
} from "./fedos_conversation_transport_outbox_persistence.js";
import type { FedosPersistedConversationTransportOutboxRecordV1 } from "./fedos_conversation_transport_outbox_codec.js";

/** PRIVATE — narrow, dependency-free check for a Node `ENOENT` error, without `@types/node`. */
function isEnoent(err: unknown): boolean {
  return err !== null && typeof err === "object" && "code" in err && (err as { code?: unknown }).code === "ENOENT";
}

/** PRIVATE — a missing file is NOT corruption: it reads as an empty, freshly-started log. */
function readLogFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8") as string;
  } catch (err) {
    if (isEnoent(err)) return "";
    throw err;
  }
}

/** PRIVATE — replays the append log into a deduplicated array of records, in on-disk order. */
function replayLog(filePath: string): FedosPersistedConversationTransportOutboxRecordV1[] {
  const contents = readLogFile(filePath);
  const byId = new Map<string, FedosPersistedConversationTransportOutboxRecordV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPersistedConversationTransportOutboxRecordV1;
    const existing = byId.get(parsed.id);
    if (existing === undefined) {
      byId.set(parsed.id, parsed);
    } else if (!fedosPersistedConversationTransportOutboxRecordsAreEqual(existing, parsed)) {
      throw new Error(
        `AppendOnlyFedosConversationTransportOutboxPersistence: conflicting duplicate records for id "${String(parsed.id)}" found in log file.`,
      );
    }
  }
  return [...byId.values()];
}

export class AppendOnlyFedosConversationTransportOutboxPersistence implements FedosConversationTransportOutboxPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putIntent(record: FedosPersistedConversationTransportOutboxRecordV1): FedosConversationTransportOutboxPersistenceWriteResult {
    const existing = this.getIntent(record.id);
    if (existing !== null) {
      return fedosPersistedConversationTransportOutboxRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getIntent(id: string): FedosPersistedConversationTransportOutboxRecordV1 | null {
    return this.listIntents().find((record) => record.id === id) ?? null;
  }

  listIntents(): readonly FedosPersistedConversationTransportOutboxRecordV1[] {
    return replayLog(this.#filePath);
  }
}
