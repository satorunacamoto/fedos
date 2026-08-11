/**
 * Secure Runtime Alpha 914 — append-only
 * `FedosConversationConstructionCoordinationPersistence` backend. Mirrors
 * `AppendOnlyFedosConversationRedemptionCoordinationPersistence`'s own
 * event-keyed, fail-closed backend exactly (Alpha 844): an independent
 * NDJSON log file, insert-only, deterministic replay, no
 * compaction/delete/rewrite, zero new dependency, no automatic repair. A
 * malformed line throws unconditionally on replay; a conflicting
 * duplicate key throws — the same "one corrupt record voids the backend"
 * precedent this codebase already applies (Alpha 829/840/914).
 */

import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosConversationConstructionCoordinationRecordKey,
  fedosPersistedConversationConstructionCoordinationRecordsAreEqual,
  resolveCurrentConstructionCoordinationRecord,
  type FedosConversationConstructionCoordinationPersistence,
  type FedosConversationConstructionCoordinationWriteResult,
} from "./fedos_conversation_construction_coordination_persistence.js";
import type { FedosPersistedConversationConstructionCoordinationV1 } from "./fedos_persisted_conversation_construction_coordination_v1.js";

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

function replayLog(filePath: string): FedosPersistedConversationConstructionCoordinationV1[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, FedosPersistedConversationConstructionCoordinationV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPersistedConversationConstructionCoordinationV1;
    const key = fedosConversationConstructionCoordinationRecordKey(parsed.coordinationId, parsed.phase);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsed);
    } else if (!fedosPersistedConversationConstructionCoordinationRecordsAreEqual(existing, parsed)) {
      throw new Error(
        `AppendOnlyFedosConversationConstructionCoordinationPersistence: conflicting duplicate records for key "${key}" found in log file.`,
      );
    }
  }
  return [...byKey.values()];
}

export class AppendOnlyFedosConversationConstructionCoordinationPersistence
  implements FedosConversationConstructionCoordinationPersistence
{
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putCoordinationFact(
    record: FedosPersistedConversationConstructionCoordinationV1,
  ): FedosConversationConstructionCoordinationWriteResult {
    const key = fedosConversationConstructionCoordinationRecordKey(record.coordinationId, record.phase);
    const existing =
      replayLog(this.#filePath).find(
        (r) => fedosConversationConstructionCoordinationRecordKey(r.coordinationId, r.phase) === key,
      ) ?? null;
    if (existing !== null) {
      return fedosPersistedConversationConstructionCoordinationRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getCoordination(coordinationId: string): FedosPersistedConversationConstructionCoordinationV1 | null {
    const factsForId = replayLog(this.#filePath).filter((record) => record.coordinationId === coordinationId);
    return resolveCurrentConstructionCoordinationRecord(factsForId);
  }
}
