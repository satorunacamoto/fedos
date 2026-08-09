/**
 * Secure Runtime Alpha 770 ("Membership Authority Interface") — Stage 10
 * of the Alpha 761–790 Canonical Conversation Membership & Capability
 * Foundation Arc.
 *
 * A narrow authority — mirrors `FedosConversationPersistence`'s own
 * "one port per durable concern, no database vocabulary, no network"
 * discipline (`../persistence/fedos_conversation_persistence.ts`, Alpha
 * 749). `previewAdmission()` is kept separate from `admit()` (a pure
 * read vs. a mutation) — the same separation
 * `FedosConversationPolicyAuthority`'s own read methods already keep
 * from `FedosBoardRuntime`'s own write commands.
 *
 * NOT this authority's responsibility, per this Arc's own Absolute
 * Prohibitions:
 *   - message encryption of any kind.
 *   - invitation secret issuance/redemption — Capability-domain
 *     (`../capability/`), consulted BY the Capability domain via this
 *     interface, never the reverse.
 *   - any protocol/network responsibility.
 *
 * Timestamps are caller-supplied (`now: number`, Unix seconds) rather
 * than read from `Date.now()` internally — keeps every implementation
 * pure and deterministically testable, matching
 * `validateFedosConversationRecord`'s own caller-supplied `createdAt`
 * convention (Alpha 748) rather than inventing a second clock-injection
 * idiom (`FedosBoardRuntimeClock` already exists one layer up, at the
 * Runtime, not the Authority).
 */

import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";
import type { FedosConversationMembership } from "../../../../conversation/membership/fedos_conversation_membership.js";
import type { FedosConversationParticipantReference } from "../../../../conversation/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationRole } from "../../../../conversation/membership/fedos_conversation_role.js";
import type {
  FedosConversationMembershipAdmissionPreview,
  FedosConversationMembershipMutationResult,
} from "../../../../conversation/membership/fedos_conversation_membership_result.js";

export interface FedosConversationMembershipAuthority {
  /** Pure — never mutates. What `admit()` would do right now, without doing it. */
  previewAdmission(
    conversationId: FedosConversationId,
    participant: FedosConversationParticipantReference,
  ): FedosConversationMembershipAdmissionPreview;

  admit(
    conversationId: FedosConversationId,
    participant: FedosConversationParticipantReference,
    role: FedosConversationRole,
    now: number,
  ): FedosConversationMembershipMutationResult;

  findMembership(
    conversationId: FedosConversationId,
    participant: FedosConversationParticipantReference,
  ): FedosConversationMembership | null;

  listMemberships(conversationId: FedosConversationId): readonly FedosConversationMembership[];

  revoke(
    conversationId: FedosConversationId,
    participant: FedosConversationParticipantReference,
    now: number,
  ): FedosConversationMembershipMutationResult;

  leave(
    conversationId: FedosConversationId,
    participant: FedosConversationParticipantReference,
    now: number,
  ): FedosConversationMembershipMutationResult;
}
