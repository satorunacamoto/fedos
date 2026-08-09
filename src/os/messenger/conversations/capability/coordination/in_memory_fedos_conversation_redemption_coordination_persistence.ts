/**
 * Secure Runtime Alpha 844 ("Coordination Persistence") — in-memory
 * backend. Mirrors `InMemoryFedosConversationMembershipPersistence`'s own
 * private-field `Map`-backed convention exactly (Alpha 828).
 */

import {
  fedosConversationRedemptionCoordinationRecordKey,
  fedosPersistedConversationRedemptionCoordinationRecordsAreEqual,
  resolveCurrentCoordinationRecord,
  type FedosConversationRedemptionCoordinationPersistence,
  type FedosConversationRedemptionCoordinationWriteResult,
} from "../../../../../conversation/capability/coordination/fedos_conversation_redemption_coordination_persistence.js";
import type { FedosPersistedConversationRedemptionCoordinationV1 } from "../../../../../conversation/capability/coordination/fedos_persisted_conversation_redemption_coordination_v1.js";

export class InMemoryFedosConversationRedemptionCoordinationPersistence implements FedosConversationRedemptionCoordinationPersistence {
  readonly #records = new Map<string, FedosPersistedConversationRedemptionCoordinationV1>();

  putCoordinationFact(record: FedosPersistedConversationRedemptionCoordinationV1): FedosConversationRedemptionCoordinationWriteResult {
    const key = fedosConversationRedemptionCoordinationRecordKey(record.coordinationId, record.phase);
    const existing = this.#records.get(key);
    if (existing === undefined) {
      this.#records.set(key, record);
      return "inserted";
    }
    return fedosPersistedConversationRedemptionCoordinationRecordsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getCoordination(coordinationId: string): FedosPersistedConversationRedemptionCoordinationV1 | null {
    const factsForId = [...this.#records.values()].filter((record) => record.coordinationId === coordinationId);
    return resolveCurrentCoordinationRecord(factsForId);
  }
}
