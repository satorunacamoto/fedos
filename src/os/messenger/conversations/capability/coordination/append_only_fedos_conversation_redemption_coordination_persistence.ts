/**
 * Secure Runtime Alpha 844 ("Coordination Persistence") — append-only
 * backend. Mirrors `AppendOnlyFedosConversationMembershipPersistence`'s
 * own event-keyed, fail-closed backend exactly (Alpha 829): independent
 * NDJSON log file, insert-only, deterministic replay, no
 * compaction/delete/rewrite, zero new dependency, no automatic repair. A
 * malformed line throws unconditionally on replay — this Arc's own
 * established "one corrupt record voids the backend" precedent (Alpha
 * 829/832/840), applied identically here.
 */

import { readFileSync, appendFileSync } from "node:fs";
import {
  fedosConversationRedemptionCoordinationRecordKey,
  fedosPersistedConversationRedemptionCoordinationRecordsAreEqual,
  resolveCurrentCoordinationRecord,
  type FedosConversationRedemptionCoordinationPersistence,
  type FedosConversationRedemptionCoordinationWriteResult,
} from "./fedos_conversation_redemption_coordination_persistence.js";
import type { FedosPersistedConversationRedemptionCoordinationV1 } from "./fedos_persisted_conversation_redemption_coordination_v1.js";

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

function replayLog(filePath: string): FedosPersistedConversationRedemptionCoordinationV1[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, FedosPersistedConversationRedemptionCoordinationV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line) as FedosPersistedConversationRedemptionCoordinationV1;
    const key = fedosConversationRedemptionCoordinationRecordKey(parsed.coordinationId, parsed.phase);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsed);
    } else if (!fedosPersistedConversationRedemptionCoordinationRecordsAreEqual(existing, parsed)) {
      throw new Error(
        `AppendOnlyFedosConversationRedemptionCoordinationPersistence: conflicting duplicate records for key "${key}" found in log file.`,
      );
    }
  }
  return [...byKey.values()];
}

export class AppendOnlyFedosConversationRedemptionCoordinationPersistence implements FedosConversationRedemptionCoordinationPersistence {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putCoordinationFact(record: FedosPersistedConversationRedemptionCoordinationV1): FedosConversationRedemptionCoordinationWriteResult {
    const key = fedosConversationRedemptionCoordinationRecordKey(record.coordinationId, record.phase);
    const existing =
      replayLog(this.#filePath).find((r) => fedosConversationRedemptionCoordinationRecordKey(r.coordinationId, r.phase) === key) ?? null;
    if (existing !== null) {
      return fedosPersistedConversationRedemptionCoordinationRecordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getCoordination(coordinationId: string): FedosPersistedConversationRedemptionCoordinationV1 | null {
    const factsForId = replayLog(this.#filePath).filter((record) => record.coordinationId === coordinationId);
    return resolveCurrentCoordinationRecord(factsForId);
  }
}
