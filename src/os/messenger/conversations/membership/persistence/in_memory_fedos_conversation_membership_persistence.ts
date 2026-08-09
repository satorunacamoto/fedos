/**
 * Secure Runtime Alpha 828 ("In-Memory Membership Persistence") — Stage
 * 8 of the Alpha 821–850 Durable Conversation Membership & Capability
 * Persistence Arc.
 *
 * A structurally SEPARATE backend from the (frozen, unchanged)
 * `InMemoryFedosConversationMembershipAuthority` — that class owns a
 * `Map<id, FedosConversationMembership>` of runtime records with no
 * wire format and no durability boundary at all; this class owns a
 * `Map<"id::state", FedosPersistedConversationMembershipV1>` of
 * PERSISTED wire records, matching this Arc's own "prefer adapters over
 * replacements" instruction — nothing here reuses or wraps the frozen
 * Authority's own internal state.
 *
 * Mirrors `InMemoryFedosPayloadRetentionPersistence`'s own private-field
 * `Map`-backed convention exactly (Alpha 796).
 */

import {
  fedosConversationMembershipRecordKey,
  fedosPersistedConversationMembershipsAreEqual,
  resolveCurrentMembershipRecord,
  type FedosConversationMembershipPersistence,
  type FedosConversationMembershipPersistenceWriteResult,
} from "./fedos_conversation_membership_persistence.js";
import type { FedosPersistedConversationMembershipV1 } from "./fedos_persisted_conversation_membership_v1.js";

export class InMemoryFedosConversationMembershipPersistence implements FedosConversationMembershipPersistence {
  readonly #records = new Map<string, FedosPersistedConversationMembershipV1>();

  putMembership(record: FedosPersistedConversationMembershipV1): FedosConversationMembershipPersistenceWriteResult {
    const key = fedosConversationMembershipRecordKey(record.id, record.state);
    const existing = this.#records.get(key);
    if (existing === undefined) {
      this.#records.set(key, record);
      return "inserted";
    }
    return fedosPersistedConversationMembershipsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getMembership(id: string): FedosPersistedConversationMembershipV1 | null {
    const recordsForId = [...this.#records.values()].filter((record) => record.id === id);
    return resolveCurrentMembershipRecord(recordsForId);
  }

  listMemberships(): readonly FedosPersistedConversationMembershipV1[] {
    return this.#currentByDistinctId([...this.#records.values()]);
  }

  listConversationMemberships(conversationId: string): readonly FedosPersistedConversationMembershipV1[] {
    return this.#currentByDistinctId([...this.#records.values()].filter((record) => record.conversationId === conversationId));
  }

  #currentByDistinctId(records: readonly FedosPersistedConversationMembershipV1[]): readonly FedosPersistedConversationMembershipV1[] {
    const ids = new Set(records.map((record) => record.id));
    const result: FedosPersistedConversationMembershipV1[] = [];
    for (const id of ids) {
      const current = resolveCurrentMembershipRecord(records.filter((record) => record.id === id));
      if (current !== null) result.push(current);
    }
    return result;
  }
}
