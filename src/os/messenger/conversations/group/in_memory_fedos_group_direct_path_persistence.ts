/**
 * Secure Runtime Alpha 1336 — in-memory `FedosGroupDirectPathPersistence`
 * backend. Mirrors `InMemoryFedosConversationActivationPersistence`'s own
 * `(id, state)`-keyed, resolve-current-by-rank convention (Alpha 1121).
 */

import {
  fedosGroupDirectPathRecordKey,
  fedosGroupDirectPathRecordsAreEqual,
  resolveCurrentGroupDirectPathRecord,
  type FedosGroupDirectPathPersistence,
  type FedosGroupDirectPathPersistenceWriteResult,
  type FedosGroupDirectPathRecord,
} from "../../../../conversation/group/fedos_group_direct_path.js";

export class InMemoryFedosGroupDirectPathPersistence implements FedosGroupDirectPathPersistence {
  readonly #records = new Map<string, FedosGroupDirectPathRecord>();

  putPathFact(record: FedosGroupDirectPathRecord): FedosGroupDirectPathPersistenceWriteResult {
    const key = fedosGroupDirectPathRecordKey(record.pathId, record.state);
    const existing = this.#records.get(key);
    if (existing === undefined) {
      this.#records.set(key, record);
      return "inserted";
    }
    return fedosGroupDirectPathRecordsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getPath(pathId: string): FedosGroupDirectPathRecord | null {
    return resolveCurrentGroupDirectPathRecord([...this.#records.values()].filter((r) => r.pathId === pathId));
  }

  listPathsForGeneration(groupConversationId: string, generationId: string): readonly FedosGroupDirectPathRecord[] {
    const scoped = [...this.#records.values()].filter(
      (r) => r.groupConversationId === groupConversationId && r.generationId === generationId,
    );
    const byPathId = new Map<string, FedosGroupDirectPathRecord[]>();
    for (const record of scoped) {
      const list = byPathId.get(record.pathId) ?? [];
      list.push(record);
      byPathId.set(record.pathId, list);
    }
    const result: FedosGroupDirectPathRecord[] = [];
    for (const facts of byPathId.values()) {
      const current = resolveCurrentGroupDirectPathRecord(facts);
      if (current !== null) result.push(current);
    }
    return result;
  }
}
