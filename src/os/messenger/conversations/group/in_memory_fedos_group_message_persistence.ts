/**
 * Secure Runtime Alpha 1342 — in-memory `FedosGroupMessagePersistence`
 * backend. Mirrors `InMemoryFedosConversationActivationPersistence`'s own
 * `(id, state)`-keyed, resolve-current-by-rank convention (Alpha 1121).
 */

import {
  fedosGroupMessageRecordKey,
  fedosGroupMessageRecordsAreEqual,
  resolveCurrentGroupMessageRecord,
  type FedosGroupMessagePersistence,
  type FedosGroupMessagePersistenceWriteResult,
  type FedosGroupMessageRecord,
} from "../../../../conversation/group/fedos_group_message.js";

export class InMemoryFedosGroupMessagePersistence implements FedosGroupMessagePersistence {
  readonly #records = new Map<string, FedosGroupMessageRecord>();

  putMessageFact(record: FedosGroupMessageRecord): FedosGroupMessagePersistenceWriteResult {
    const key = fedosGroupMessageRecordKey(record.id, record.fanoutState);
    const existing = this.#records.get(key);
    if (existing === undefined) {
      this.#records.set(key, record);
      return "inserted";
    }
    return fedosGroupMessageRecordsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getMessage(id: string): FedosGroupMessageRecord | null {
    return resolveCurrentGroupMessageRecord([...this.#records.values()].filter((r) => r.id === id));
  }

  listMessagesForGroup(groupConversationId: string): readonly FedosGroupMessageRecord[] {
    const byId = new Map<string, FedosGroupMessageRecord[]>();
    for (const record of this.#records.values()) {
      if (record.groupConversationId !== groupConversationId) continue;
      const list = byId.get(record.id) ?? [];
      list.push(record);
      byId.set(record.id, list);
    }
    const result: FedosGroupMessageRecord[] = [];
    for (const facts of byId.values()) {
      const current = resolveCurrentGroupMessageRecord(facts);
      if (current !== null) result.push(current);
    }
    return result.sort((a, b) => (a.createdAt !== b.createdAt ? a.createdAt - b.createdAt : a.id.localeCompare(b.id)));
  }
}
