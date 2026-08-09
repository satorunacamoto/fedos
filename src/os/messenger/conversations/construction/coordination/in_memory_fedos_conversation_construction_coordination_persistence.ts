/**
 * Secure Runtime Alpha 914 — in-memory
 * `FedosConversationConstructionCoordinationPersistence` backend. Mirrors
 * `InMemoryFedosConversationRedemptionCoordinationPersistence`'s own
 * private-field `Map`-backed convention exactly (Alpha 844).
 */

import {
  fedosConversationConstructionCoordinationRecordKey,
  fedosPersistedConversationConstructionCoordinationRecordsAreEqual,
  resolveCurrentConstructionCoordinationRecord,
  type FedosConversationConstructionCoordinationPersistence,
  type FedosConversationConstructionCoordinationWriteResult,
} from "./fedos_conversation_construction_coordination_persistence.js";
import type { FedosPersistedConversationConstructionCoordinationV1 } from "./fedos_persisted_conversation_construction_coordination_v1.js";

export class InMemoryFedosConversationConstructionCoordinationPersistence
  implements FedosConversationConstructionCoordinationPersistence
{
  readonly #records = new Map<string, FedosPersistedConversationConstructionCoordinationV1>();

  putCoordinationFact(
    record: FedosPersistedConversationConstructionCoordinationV1,
  ): FedosConversationConstructionCoordinationWriteResult {
    const key = fedosConversationConstructionCoordinationRecordKey(record.coordinationId, record.phase);
    const existing = this.#records.get(key);
    if (existing === undefined) {
      this.#records.set(key, record);
      return "inserted";
    }
    return fedosPersistedConversationConstructionCoordinationRecordsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getCoordination(coordinationId: string): FedosPersistedConversationConstructionCoordinationV1 | null {
    const factsForId = [...this.#records.values()].filter((record) => record.coordinationId === coordinationId);
    return resolveCurrentConstructionCoordinationRecord(factsForId);
  }
}
