/**
 * Secure Runtime Alpha 1404 — in-memory `FedosPrivateNostrDeliveryRequestPersistence`
 * backend. Single-record-per-id, no state ranking (the request itself is
 * immutable) — mirrors `InMemoryFedosConversationMessageEnvelopePersistence`'s
 * own shape exactly.
 */

import {
  fedosPrivateNostrDeliveryRequestsAreEqual,
  type FedosPrivateNostrDeliveryRequest,
  type FedosPrivateNostrDeliveryRequestPersistence,
  type FedosPrivateNostrDeliveryRequestPersistenceWriteResult,
} from "./fedos_private_nostr_delivery_request.js";

export class InMemoryFedosPrivateNostrDeliveryRequestPersistence implements FedosPrivateNostrDeliveryRequestPersistence {
  readonly #records = new Map<string, FedosPrivateNostrDeliveryRequest>();

  putRequest(record: FedosPrivateNostrDeliveryRequest): FedosPrivateNostrDeliveryRequestPersistenceWriteResult {
    const existing = this.#records.get(record.id);
    if (existing === undefined) {
      this.#records.set(record.id, record);
      return "inserted";
    }
    return fedosPrivateNostrDeliveryRequestsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getRequest(id: string): FedosPrivateNostrDeliveryRequest | null {
    return this.#records.get(id) ?? null;
  }

  listRequestsForEnvelope(conversationId: string, envelopeId: string): readonly FedosPrivateNostrDeliveryRequest[] {
    return [...this.#records.values()].filter((r) => r.conversationId === conversationId && r.envelopeId === envelopeId);
  }
}
