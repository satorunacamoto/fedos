/**
 * Secure Runtime Alpha 941 — in-memory
 * `FedosConversationEncryptionCoordinationPersistence` backend. Mirrors
 * `InMemoryFedosConversationConstructionCoordinationPersistence`'s own
 * private-field `Map`-backed convention exactly (Alpha 914).
 */

import {
  fedosConversationEncryptionCoordinationRecordKey,
  fedosPersistedConversationEncryptionCoordinationRecordsAreEqual,
  resolveCurrentEncryptionCoordinationRecord,
  type FedosConversationEncryptionCoordinationPersistence,
  type FedosConversationEncryptionCoordinationWriteResult,
} from "./fedos_conversation_encryption_coordination_persistence.js";
import type { FedosPersistedConversationEncryptionCoordinationV1 } from "./fedos_persisted_conversation_encryption_coordination_v1.js";

export class InMemoryFedosConversationEncryptionCoordinationPersistence
  implements FedosConversationEncryptionCoordinationPersistence
{
  readonly #records = new Map<string, FedosPersistedConversationEncryptionCoordinationV1>();

  putCoordinationFact(
    record: FedosPersistedConversationEncryptionCoordinationV1,
  ): FedosConversationEncryptionCoordinationWriteResult {
    const key = fedosConversationEncryptionCoordinationRecordKey(record.coordinationId, record.phase);
    const existing = this.#records.get(key);
    if (existing === undefined) {
      this.#records.set(key, record);
      return "inserted";
    }
    return fedosPersistedConversationEncryptionCoordinationRecordsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getCoordination(coordinationId: string): FedosPersistedConversationEncryptionCoordinationV1 | null {
    const factsForId = [...this.#records.values()].filter((record) => record.coordinationId === coordinationId);
    return resolveCurrentEncryptionCoordinationRecord(factsForId);
  }
}
