/**
 * Secure Runtime Alpha 1346 — in-memory `FedosGroupFanoutDeliveryPersistence`
 * backend. Mirrors `InMemoryFedosConversationActivationPersistence`'s own
 * `(id, state)`-keyed, resolve-current-by-rank convention (Alpha 1121).
 */

import {
  fedosGroupFanoutDeliveryRecordKey,
  fedosGroupFanoutDeliveryRecordsAreEqual,
  resolveCurrentGroupFanoutDeliveryRecord,
  toFedosGroupFanoutDeliveryId,
  type FedosGroupFanoutDeliveryPersistence,
  type FedosGroupFanoutDeliveryPersistenceWriteResult,
  type FedosGroupFanoutDeliveryRecord,
} from "./fedos_group_fanout_delivery.js";

export class InMemoryFedosGroupFanoutDeliveryPersistence implements FedosGroupFanoutDeliveryPersistence {
  readonly #records = new Map<string, FedosGroupFanoutDeliveryRecord>();

  putDeliveryFact(record: FedosGroupFanoutDeliveryRecord): FedosGroupFanoutDeliveryPersistenceWriteResult {
    const deliveryId = toFedosGroupFanoutDeliveryId(record.groupMessageId, record.recipientMembershipId);
    const key = fedosGroupFanoutDeliveryRecordKey(deliveryId, record.state);
    const existing = this.#records.get(key);
    if (existing === undefined) {
      this.#records.set(key, record);
      return "inserted";
    }
    return fedosGroupFanoutDeliveryRecordsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getDelivery(groupMessageId: string, recipientMembershipId: string): FedosGroupFanoutDeliveryRecord | null {
    const deliveryId = toFedosGroupFanoutDeliveryId(groupMessageId, recipientMembershipId);
    const facts = [...this.#records.values()].filter(
      (r) => toFedosGroupFanoutDeliveryId(r.groupMessageId, r.recipientMembershipId) === deliveryId,
    );
    return resolveCurrentGroupFanoutDeliveryRecord(facts);
  }

  listDeliveriesForMessage(groupMessageId: string): readonly FedosGroupFanoutDeliveryRecord[] {
    const byDeliveryId = new Map<string, FedosGroupFanoutDeliveryRecord[]>();
    for (const record of this.#records.values()) {
      if (record.groupMessageId !== groupMessageId) continue;
      const deliveryId = toFedosGroupFanoutDeliveryId(record.groupMessageId, record.recipientMembershipId);
      const list = byDeliveryId.get(deliveryId) ?? [];
      list.push(record);
      byDeliveryId.set(deliveryId, list);
    }
    const result: FedosGroupFanoutDeliveryRecord[] = [];
    for (const facts of byDeliveryId.values()) {
      const current = resolveCurrentGroupFanoutDeliveryRecord(facts);
      if (current !== null) result.push(current);
    }
    return result;
  }
}
