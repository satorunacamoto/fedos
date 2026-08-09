/**
 * Secure Runtime Alpha 1327 — in-memory `FedosGroupGenerationPersistence`
 * backend. Mirrors `InMemoryFedosConversationActivationPersistence`'s own
 * private-field `Map`-backed convention (Alpha 1121).
 */

import {
  currentGenerationFrom,
  fedosGroupGenerationRecordsAreEqual,
  type FedosGroupGenerationId,
  type FedosGroupGenerationPersistence,
  type FedosGroupGenerationPersistenceWriteResult,
  type FedosGroupGenerationRecord,
} from "./fedos_group_generation.js";

export class InMemoryFedosGroupGenerationPersistence implements FedosGroupGenerationPersistence {
  readonly #records = new Map<string, FedosGroupGenerationRecord>();

  putGeneration(record: FedosGroupGenerationRecord): FedosGroupGenerationPersistenceWriteResult {
    const existing = this.#records.get(record.generationId);
    if (existing === undefined) {
      this.#records.set(record.generationId, record);
      return "inserted";
    }
    return fedosGroupGenerationRecordsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getGeneration(generationId: FedosGroupGenerationId): FedosGroupGenerationRecord | null {
    return this.#records.get(generationId) ?? null;
  }

  currentGenerationForGroup(groupConversationId: string): FedosGroupGenerationRecord | null {
    return currentGenerationFrom([...this.#records.values()].filter((r) => r.groupConversationId === groupConversationId));
  }

  listGenerations(groupConversationId: string): readonly FedosGroupGenerationRecord[] {
    return [...this.#records.values()]
      .filter((r) => r.groupConversationId === groupConversationId)
      .sort((a, b) => a.generationNumber - b.generationNumber);
  }
}
