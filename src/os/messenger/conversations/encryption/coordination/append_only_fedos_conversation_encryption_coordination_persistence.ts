/**
 * Secure Runtime Alpha 941 — append-only
 * `FedosConversationEncryptionCoordinationPersistence` backend. Mirrors
 * `AppendOnlyFedosConversationConstructionCoordinationPersistence`'s own
 * event-keyed, fail-closed backend exactly (Alpha 914): an independent
 * NDJSON log file, insert-only, deterministic replay, no
 * compaction/delete/rewrite, zero new dependency, no automatic repair. A
 * malformed line throws unconditionally on replay; a conflicting
 * duplicate key throws — the same "one corrupt record voids the backend"
 * precedent this codebase already applies (Alpha 829/840/914).
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosConversationEncryptionCoordinationRecordKey,
  fedosPersistedConversationEncryptionCoordinationRecordsAreEqual,
  resolveCurrentEncryptionCoordinationRecord,
  type FedosConversationEncryptionCoordinationPersistence,
  type FedosConversationEncryptionCoordinationWriteResult,
} from "../../../../../conversation/encryption/coordination/fedos_conversation_encryption_coordination_persistence.js";
import type { FedosPersistedConversationEncryptionCoordinationV1 } from "../../../../../conversation/encryption/coordination/fedos_persisted_conversation_encryption_coordination_v1.js";

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

function replayLog(filePath: string): FedosPersistedConversationEncryptionCoordinationV1[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, FedosPersistedConversationEncryptionCoordinationV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPersistedConversationEncryptionCoordinationV1;
    const key = fedosConversationEncryptionCoordinationRecordKey(parsed.coordinationId, parsed.phase);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsed);
    } else if (!fedosPersistedConversationEncryptionCoordinationRecordsAreEqual(existing, parsed)) {
      throw new Error(
        `AppendOnlyFedosConversationEncryptionCoordinationPersistence: conflicting duplicate records for key "${key}" found in log file.`,
      );
    }
  }
  return [...byKey.values()];
}

export class AppendOnlyFedosConversationEncryptionCoordinationPersistence
  implements FedosConversationEncryptionCoordinationPersistence
{
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putCoordinationFact(
    record: FedosPersistedConversationEncryptionCoordinationV1,
  ): FedosConversationEncryptionCoordinationWriteResult {
    const key = fedosConversationEncryptionCoordinationRecordKey(record.coordinationId, record.phase);
    const existing =
      replayLog(this.#filePath).find(
        (r) => fedosConversationEncryptionCoordinationRecordKey(r.coordinationId, r.phase) === key,
      ) ?? null;
    if (existing !== null) {
      return fedosPersistedConversationEncryptionCoordinationRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getCoordination(coordinationId: string): FedosPersistedConversationEncryptionCoordinationV1 | null {
    const factsForId = replayLog(this.#filePath).filter((record) => record.coordinationId === coordinationId);
    return resolveCurrentEncryptionCoordinationRecord(factsForId);
  }
}
