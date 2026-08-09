/**
 * Secure Runtime Alpha 1121 — in-memory
 * `FedosConversationActivationPersistence` backend. Mirrors
 * `InMemoryFedosConversationConstructionCoordinationPersistence`'s own
 * private-field `Map`-backed convention exactly (Alpha 914).
 */

import {
  fedosConversationActivationRecordKey,
  fedosPersistedConversationActivationRecordsAreEqual,
  resolveCurrentActivationRecord,
  type FedosConversationActivationPersistence,
  type FedosConversationActivationPersistenceWriteResult,
} from "../../../../conversation/activation/fedos_conversation_activation_persistence.js";
import type { FedosPersistedConversationActivationV1 } from "../../../../conversation/activation/fedos_persisted_conversation_activation_v1.js";

export class InMemoryFedosConversationActivationPersistence implements FedosConversationActivationPersistence {
  readonly #records = new Map<string, FedosPersistedConversationActivationV1>();

  putActivationFact(record: FedosPersistedConversationActivationV1): FedosConversationActivationPersistenceWriteResult {
    const key = fedosConversationActivationRecordKey(record.activationId, record.phase);
    const existing = this.#records.get(key);
    if (existing === undefined) {
      this.#records.set(key, record);
      return "inserted";
    }
    return fedosPersistedConversationActivationRecordsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getActivation(activationId: string): FedosPersistedConversationActivationV1 | null {
    const factsForId = [...this.#records.values()].filter((record) => record.activationId === activationId);
    return resolveCurrentActivationRecord(factsForId);
  }
}
