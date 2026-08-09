/**
 * Secure Runtime Alpha 1121 — append-only
 * `FedosConversationActivationPersistence` backend. Mirrors
 * `AppendOnlyFedosConversationConstructionCoordinationPersistence`'s own
 * event-keyed, fail-closed backend exactly (Alpha 914): an independent
 * NDJSON log file, insert-only, deterministic replay, no
 * compaction/delete/rewrite, zero new dependency, no automatic repair. A
 * malformed line throws unconditionally on replay; a conflicting duplicate
 * key throws — the same "one corrupt record voids the backend" precedent
 * this codebase already applies (Alpha 829/840/914).
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosConversationActivationRecordKey,
  fedosPersistedConversationActivationRecordsAreEqual,
  resolveCurrentActivationRecord,
  type FedosConversationActivationPersistence,
  type FedosConversationActivationPersistenceWriteResult,
} from "../../../../conversation/activation/fedos_conversation_activation_persistence.js";
import type { FedosPersistedConversationActivationV1 } from "../../../../conversation/activation/fedos_persisted_conversation_activation_v1.js";

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

function replayLog(filePath: string): FedosPersistedConversationActivationV1[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, FedosPersistedConversationActivationV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPersistedConversationActivationV1;
    const key = fedosConversationActivationRecordKey(parsed.activationId, parsed.phase);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsed);
    } else if (!fedosPersistedConversationActivationRecordsAreEqual(existing, parsed)) {
      throw new Error(
        `AppendOnlyFedosConversationActivationPersistence: conflicting duplicate records for key "${key}" found in log file.`,
      );
    }
  }
  return [...byKey.values()];
}

export class AppendOnlyFedosConversationActivationPersistence implements FedosConversationActivationPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putActivationFact(record: FedosPersistedConversationActivationV1): FedosConversationActivationPersistenceWriteResult {
    const key = fedosConversationActivationRecordKey(record.activationId, record.phase);
    const existing =
      replayLog(this.#filePath).find(
        (r) => fedosConversationActivationRecordKey(r.activationId, r.phase) === key,
      ) ?? null;
    if (existing !== null) {
      return fedosPersistedConversationActivationRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getActivation(activationId: string): FedosPersistedConversationActivationV1 | null {
    const factsForId = replayLog(this.#filePath).filter((record) => record.activationId === activationId);
    return resolveCurrentActivationRecord(factsForId);
  }
}
