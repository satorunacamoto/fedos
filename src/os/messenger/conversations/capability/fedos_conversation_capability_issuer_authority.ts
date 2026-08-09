/**
 * Secure Runtime Alpha 780 ("Capability Issuer Authority") — Stage 6 of
 * Phase B of the Alpha 761–790 Canonical Conversation Membership &
 * Capability Foundation Arc.
 *
 * Two operations only: `issueJoinCapability()` and `inspectDescriptor()`
 * — mirrors `FedosConversationMembershipAuthority`'s own "narrow
 * authority, one concern" discipline (Alpha 770).
 *
 * An issuer must verify, before issuing: the conversation exists, the
 * issuer is allowed to invite (a future Membership/Policy rule — see
 * `docs/secure_runtime_alpha_773_membership_policy_boundary.md`), and
 * `expiresAt`/`maxUses` are well-formed. This Arc keeps BOTH checks
 * INJECTED (`FedosConversationExistenceCheck`/
 * `FedosConversationCapabilityIssuanceAuthorizationCheck` below) rather
 * than hard-wiring either to `FedosConversationPersistence` or
 * `FedosConversationMembershipAuthority` directly — an adapter
 * boundary, not a new coupling, matching this Arc's own "prefer
 * adapters over replacements" instruction. For V1, a caller/test may
 * inject a static/always-true authorization check; this file makes NO
 * claim that real, production private-invite authorization exists — an
 * always-true injected check is an honestly-labeled TEST convenience,
 * never a default this file itself supplies.
 */

import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";
import type { FedosConversationParticipantReference } from "../../../../conversation/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationCapabilityAction, FedosConversationCapabilityDescriptor } from "../../../../conversation/capability/fedos_conversation_capability_descriptor.js";
import type { FedosConversationCapabilityId } from "../../../../conversation/capability/fedos_conversation_capability_id.js";
import type { FedosConversationCapabilityIssuanceResult } from "../../../../conversation/capability/fedos_conversation_capability_issuance_result.js";

/** Injected — decouples the Issuer Authority from any one Conversation persistence implementation. */
export type FedosConversationExistenceCheck = (conversationId: FedosConversationId) => boolean;

/** Injected — see this file's own header. No default production implementation is supplied anywhere in this Arc. */
export type FedosConversationCapabilityIssuanceAuthorizationCheck = (
  conversationId: FedosConversationId,
  issuer: FedosConversationParticipantReference,
) => boolean;

export interface FedosConversationCapabilityIssueRequest {
  readonly conversationId: FedosConversationId;
  readonly issuer: FedosConversationParticipantReference;
  readonly action: FedosConversationCapabilityAction;
  /** `null` for a general (any redeemer) capability. */
  readonly intendedRecipient: FedosConversationParticipantReference | null;
  readonly maxUses: number;
  readonly expiresAt: number | null;
}

export interface FedosConversationCapabilityIssuerAuthority {
  issueJoinCapability(request: FedosConversationCapabilityIssueRequest, now: number): FedosConversationCapabilityIssuanceResult;
  inspectDescriptor(capabilityId: FedosConversationCapabilityId): FedosConversationCapabilityDescriptor | null;
  /**
   * Alpha 1000 ("Invitation Directory Read") — OPTIONAL, additive read of every
   * PUBLIC descriptor issued for one conversation. Added for the Alpha 991–1050
   * Invitation Transport & Draft Management Arc's invitation-management read
   * surface (`listConversationInvitations()`), exactly the "list all
   * capabilities issued for a conversation" case the Arc's reconciliation
   * sanctions extending additively. Descriptors ONLY — never a bearer secret.
   * Optional so this addition breaks no existing implementation; a caller that
   * needs listing checks for its presence and falls back to `[]`.
   */
  listIssuedDescriptorsForConversation?(conversationId: FedosConversationId): readonly FedosConversationCapabilityDescriptor[];
}
