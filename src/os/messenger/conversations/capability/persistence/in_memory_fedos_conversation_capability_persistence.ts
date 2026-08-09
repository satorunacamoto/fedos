/**
 * Secure Runtime Alpha 839 ("In-Memory Capability Persistence") — Stage
 * 7 of Phase C of the Alpha 821–850 Durable Conversation Membership &
 * Capability Persistence Arc.
 *
 * A structurally SEPARATE backend from the (frozen, unchanged)
 * `InMemoryFedosConversationCapabilityAuthority` — that class owns its
 * own private `Map` of runtime descriptors/secrets with no wire format
 * at all; this class owns a `Map<eventKey, event>` of PERSISTED wire
 * events. Mirrors `InMemoryFedosPayloadRetentionPersistence`'s own
 * private-field `Map`-backed convention (Alpha 796).
 */

import {
  fedosConversationCapabilityEventKey,
  fedosPersistedConversationCapabilityEventsAreEqual,
  reconstructFedosConversationCapabilityRecord,
  type FedosConversationCapabilityPersistence,
  type FedosConversationCapabilityPersistenceWriteResult,
} from "../../../../../conversation/capability/persistence/fedos_conversation_capability_persistence.js";
import {
  fedosConversationCapabilityRedeemedEventKey,
  type FedosPersistedConversationCapabilityEventV1,
  type FedosPersistedConversationCapabilityRecordV1,
} from "../../../../../conversation/capability/persistence/fedos_persisted_conversation_capability_v1.js";

export class InMemoryFedosConversationCapabilityPersistence implements FedosConversationCapabilityPersistence {
  readonly #events = new Map<string, FedosPersistedConversationCapabilityEventV1>();

  putEvent(event: FedosPersistedConversationCapabilityEventV1): FedosConversationCapabilityPersistenceWriteResult {
    const key = fedosConversationCapabilityEventKey(event);
    const existing = this.#events.get(key);
    if (existing === undefined) {
      this.#events.set(key, event);
      return "inserted";
    }
    return fedosPersistedConversationCapabilityEventsAreEqual(existing, event) ? "already-present" : "conflict";
  }

  getCapability(capabilityId: string): FedosPersistedConversationCapabilityRecordV1 | null {
    return reconstructFedosConversationCapabilityRecord(this.#eventsForCapability(capabilityId));
  }

  listCapabilities(): readonly FedosPersistedConversationCapabilityRecordV1[] {
    return this.#currentByDistinctCapability([...this.#events.values()]);
  }

  listConversationCapabilities(conversationId: string): readonly FedosPersistedConversationCapabilityRecordV1[] {
    const issuedForConversation = [...this.#events.values()].filter(
      (event) => event.eventType === "issued" && event.conversationId === conversationId,
    );
    const capabilityIds = new Set(issuedForConversation.map((event) => event.capabilityId));
    return this.#currentByDistinctCapability([...this.#events.values()].filter((event) => capabilityIds.has(event.capabilityId)));
  }

  hasRedeemedEvent(capabilityId: string, redeemerAuthority: string, redeemerPublicIdentifier: string): boolean {
    return this.#events.has(fedosConversationCapabilityRedeemedEventKey(capabilityId, redeemerAuthority, redeemerPublicIdentifier));
  }

  listConversationCapabilityEvents(conversationId: string): readonly FedosPersistedConversationCapabilityEventV1[] {
    const issuedForConversation = [...this.#events.values()].filter(
      (event) => event.eventType === "issued" && event.conversationId === conversationId,
    );
    const capabilityIds = new Set(issuedForConversation.map((event) => event.capabilityId));
    return [...this.#events.values()].filter((event) => capabilityIds.has(event.capabilityId));
  }

  #eventsForCapability(capabilityId: string): readonly FedosPersistedConversationCapabilityEventV1[] {
    return [...this.#events.values()].filter((event) => event.capabilityId === capabilityId);
  }

  #currentByDistinctCapability(
    events: readonly FedosPersistedConversationCapabilityEventV1[],
  ): readonly FedosPersistedConversationCapabilityRecordV1[] {
    const capabilityIds = new Set(events.map((event) => event.capabilityId));
    const result: FedosPersistedConversationCapabilityRecordV1[] = [];
    for (const capabilityId of capabilityIds) {
      const record = reconstructFedosConversationCapabilityRecord(events.filter((event) => event.capabilityId === capabilityId));
      if (record !== null) result.push(record);
    }
    return result;
  }
}
