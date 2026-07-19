/**
 * Secure Runtime Alpha 1004 ("In-Memory Draft Management Persistence") — Phase
 * C of the Alpha 991–1050 Conversation Invitation Transport & Draft Management
 * Arc.
 *
 * In-memory `FedosConversationDraftManagementPersistence` backend. Mirrors
 * `InMemoryFedosConversationConstructionCoordinationPersistence`'s own
 * private-field `Map`-backed convention exactly (Alpha 914), keyed by
 * `(conversationId, revision)`.
 *
 * HARD GUARDRAILS:
 *   - Deterministic, no constructor side effects.
 *   - Independent instances never share state — no module-level mutable state.
 *   - `listManagementFacts()` returns a NEW array every call.
 */

import {
  fedosConversationDraftManagementStateRecordKey,
  fedosPersistedConversationDraftManagementStatesAreEqual,
  resolveCurrentDraftManagementState,
  type FedosPersistedConversationDraftManagementStateV1,
} from "./fedos_persisted_conversation_draft_management_state_v1.js";
import {
  type FedosConversationDraftManagementPersistence,
  type FedosConversationDraftManagementWriteResult,
} from "./fedos_conversation_draft_management_persistence.js";

export class InMemoryFedosConversationDraftManagementPersistence implements FedosConversationDraftManagementPersistence {
  readonly #records = new Map<string, FedosPersistedConversationDraftManagementStateV1>();

  putManagementFact(record: FedosPersistedConversationDraftManagementStateV1): FedosConversationDraftManagementWriteResult {
    const key = fedosConversationDraftManagementStateRecordKey(record.conversationId, record.revision);
    const existing = this.#records.get(key);
    if (existing === undefined) {
      this.#records.set(key, record);
      return "inserted";
    }
    return fedosPersistedConversationDraftManagementStatesAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getCurrentManagementState(conversationId: string): FedosPersistedConversationDraftManagementStateV1 | null {
    return resolveCurrentDraftManagementState(this.#factsFor(conversationId));
  }

  listManagementFacts(conversationId: string): readonly FedosPersistedConversationDraftManagementStateV1[] {
    return this.#factsFor(conversationId);
  }

  #factsFor(conversationId: string): FedosPersistedConversationDraftManagementStateV1[] {
    return [...this.#records.values()].filter((record) => record.conversationId === conversationId);
  }
}
