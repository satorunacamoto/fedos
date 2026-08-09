/**
 * Secure Runtime Alpha 997 ("In-Memory Invitation Revocation Registry") —
 * Phase B of the Alpha 991–1050 Conversation Invitation Transport & Draft
 * Management Arc.
 *
 * In-memory `FedosConversationInvitationRevocationRegistry` backend. Mirrors
 * `InMemoryFedosConversationDraftPersistence`'s own private-field `Map`-backed
 * convention exactly (Alpha 894).
 *
 * HARD GUARDRAILS:
 *   - Deterministic, no constructor side effects.
 *   - Independent instances never share state — no module-level mutable state.
 *   - `listConversationRevocations()` returns a NEW array every call.
 */

import {
  fedosConversationInvitationRevocationRecordKey,
  fedosPersistedConversationInvitationRevocationsAreEqual,
  type FedosPersistedConversationInvitationRevocationV1,
} from "../../../../conversation/invitation/fedos_persisted_conversation_invitation_revocation_v1.js";
import {
  type FedosConversationInvitationRevocationRegistry,
  type FedosConversationInvitationRevocationWriteResult,
} from "../../../../conversation/invitation/fedos_conversation_invitation_revocation_registry.js";

export class InMemoryFedosConversationInvitationRevocationRegistry implements FedosConversationInvitationRevocationRegistry {
  readonly #records = new Map<string, FedosPersistedConversationInvitationRevocationV1>();

  putRevocation(record: FedosPersistedConversationInvitationRevocationV1): FedosConversationInvitationRevocationWriteResult {
    const key = fedosConversationInvitationRevocationRecordKey(record.capabilityId);
    const existing = this.#records.get(key);
    if (existing === undefined) {
      this.#records.set(key, record);
      return "inserted";
    }
    return fedosPersistedConversationInvitationRevocationsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getRevocation(capabilityId: string): FedosPersistedConversationInvitationRevocationV1 | null {
    return this.#records.get(fedosConversationInvitationRevocationRecordKey(capabilityId)) ?? null;
  }

  isRevoked(capabilityId: string): boolean {
    return this.#records.has(fedosConversationInvitationRevocationRecordKey(capabilityId));
  }

  listConversationRevocations(conversationId: string): readonly FedosPersistedConversationInvitationRevocationV1[] {
    return [...this.#records.values()].filter((record) => record.conversationId === conversationId);
  }
}
