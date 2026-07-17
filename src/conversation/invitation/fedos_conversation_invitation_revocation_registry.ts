/**
 * Secure Runtime Alpha 996 ("Invitation Revocation Registry Port") — Phase B
 * of the Alpha 991–1050 Conversation Invitation Transport & Draft Management
 * Arc.
 *
 * A DEDICATED, minimal durable port for invitation-revocation facts — the
 * ONLY consumer is `FedosConversationInvitationTransport` (Alpha 999). Mirrors
 * `FedosConversationDraftPersistence`'s own single-record-per-id shape (Alpha
 * 894) exactly: a revocation is immutable once written and at most one exists
 * per capability id (Finding 2: revocation is terminal and one-way), so a
 * single record per id is sufficient — no `(id, state)` event-keying.
 *
 * This port is entirely NEW and additive: it touches nothing in the frozen
 * Capability domain, so a non-revoked capability's meaning and behavior are
 * unchanged (this Arc's own "keep it additive" instruction).
 *
 * HARD GUARDRAILS:
 *   - No `delete`/compaction/rewrite method — the append-only discipline used
 *     everywhere in this codebase forbids it.
 *   - Synchronous, matching every other port in this codebase.
 */

import type { FedosPersistedConversationInvitationRevocationV1 } from "./fedos_persisted_conversation_invitation_revocation_v1.js";

/** Mirrors `FedosConversationPersistenceWriteResult` exactly (Alpha 749). */
export type FedosConversationInvitationRevocationWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosConversationInvitationRevocationRegistry {
  putRevocation(record: FedosPersistedConversationInvitationRevocationV1): FedosConversationInvitationRevocationWriteResult;
  getRevocation(capabilityId: string): FedosPersistedConversationInvitationRevocationV1 | null;
  /** `true` iff a terminal revocation fact exists for this capability id. */
  isRevoked(capabilityId: string): boolean;
  listConversationRevocations(conversationId: string): readonly FedosPersistedConversationInvitationRevocationV1[];
}
