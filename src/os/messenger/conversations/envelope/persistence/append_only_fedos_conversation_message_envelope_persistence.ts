/**
 * Secure Runtime Alpha 860 ("Append-Only Envelope Persistence") — Stage
 * 10 of Phase A of the Alpha 851–890 Private Message Envelope and
 * Encryption Authority Activation Arc.
 *
 * Mirrors `AppendOnlyFedosConversationPersistence`'s own established
 * backend exactly (Alpha 752) — independent NDJSON log file, insert-
 * only, fail-closed on corruption, no compaction/delete/rewrite, zero
 * new dependency (`node:fs` only).
 *
 * CRASH REVIEW — identical policy to Alpha 752/796/829: an empty/missing
 * file is NOT corruption (`listConversationEnvelopes()` returns `[]` for
 * every conversation). A non-blank line that fails `JSON.parse` THROWS
 * unconditionally — no special-casing of a trailing partial write versus
 * a mid-file corrupt line, matching this codebase's own established "one
 * corrupt record voids the backend" precedent. Two lines sharing the
 * SAME `id` with identical content collapse (idempotent); with different
 * content, replay THROWS (an irreconcilable log conflict) — there is no
 * `(id, state)` composite key here (Alpha 827's own reason for one does
 * not apply — an Envelope has no state transition).
 *
 * HARD GUARDRAILS:
 *   - `AppendOnlyFedosConversationMessageEnvelopePersistence` is the
 *     ONLY export.
 *   - Implements `FedosConversationMessageEnvelopePersistence` (Alpha
 *     857) verbatim.
 *   - No constructor filesystem I/O — only stores the given file path.
 *   - No delete/compaction/rewrite method.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosPersistedConversationMessageEnvelopesAreEqual,
  type FedosConversationMessageEnvelopePersistence,
  type FedosConversationMessageEnvelopePersistenceWriteResult,
} from "../../../../../conversation/envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import type { FedosPersistedConversationMessageEnvelopeV1 } from "../../../../../conversation/envelope/persistence/fedos_persisted_conversation_message_envelope_v1.js";
import type { FedosConversationId } from "../../../../../conversation/fedos_conversation_id.js";

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

/** PRIVATE — replays the append log into a deduplicated array, keyed by `id`. A parse failure or irreconcilable duplicate throws unconditionally (see this file's own header). */
function replayLog(filePath: string): FedosPersistedConversationMessageEnvelopeV1[] {
  const contents = readLogFile(filePath);
  const byId = new Map<string, FedosPersistedConversationMessageEnvelopeV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPersistedConversationMessageEnvelopeV1;
    const existing = byId.get(parsed.id);
    if (existing === undefined) {
      byId.set(parsed.id, parsed);
    } else if (!fedosPersistedConversationMessageEnvelopesAreEqual(existing, parsed)) {
      throw new Error(
        `AppendOnlyFedosConversationMessageEnvelopePersistence: conflicting duplicate records for id "${parsed.id}" found in log file.`,
      );
    }
  }
  return [...byId.values()];
}

export class AppendOnlyFedosConversationMessageEnvelopePersistence implements FedosConversationMessageEnvelopePersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putEnvelope(record: FedosPersistedConversationMessageEnvelopeV1): FedosConversationMessageEnvelopePersistenceWriteResult {
    const existing = replayLog(this.#filePath).find((r) => r.id === record.id) ?? null;
    if (existing !== null) {
      return fedosPersistedConversationMessageEnvelopesAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getEnvelope(id: string): FedosPersistedConversationMessageEnvelopeV1 | null {
    return replayLog(this.#filePath).find((record) => record.id === id) ?? null;
  }

  listConversationEnvelopes(conversationId: FedosConversationId): readonly FedosPersistedConversationMessageEnvelopeV1[] {
    return replayLog(this.#filePath).filter((record) => record.conversationId === conversationId);
  }
}
