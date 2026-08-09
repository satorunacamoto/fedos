/**
 * Secure Runtime Alpha 1356/1357/1363 ("Member Addition" / "Member
 * Removal" / "Re-admission") — Phase D of the Alpha 1321–1390 Private
 * Group Pairwise Fanout Foundation Arc.
 *
 * `addMember()`/`removeMember()` operate on the Group Container's OWN
 * Membership — reusing the existing, unmodified
 * `FedosConversationCapabilityIssuerAuthority`/
 * `FedosConversationCapabilityRedemptionAuthority`/
 * `FedosConversationMembershipAuthority` exactly as
 * `FedosPrivateConversationConstructionCoordinator` already does for a
 * draft's own creator (Alpha 915) — never a new admission mechanism.
 * Neither operation creates a new generation itself (Alpha 1358's own
 * "Generation Transition Coordinator" is a SEPARATE, explicit step,
 * `./fedos_group_generation_authority.ts`) — a caller invokes
 * `createNextGeneration()` after a membership change to make it take
 * effect for future fanout (mirrors this Arc's own additive-layering
 * discipline: admission and generation snapshotting stay two narrow,
 * separately-testable operations, never fused into one).
 */

import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";
import type { FedosConversationMembershipAuthority } from "../../../../conversation/membership/fedos_conversation_membership_authority.js";
import type { FedosConversationParticipantReference } from "../../../../conversation/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationCapabilityIssuerAuthority } from "../../../../conversation/capability/fedos_conversation_capability_issuer_authority.js";
import type { FedosConversationCapabilityRedemptionAuthority } from "../../../../conversation/capability/fedos_conversation_capability_redemption_authority.js";

export type FedosGroupAddMemberResult =
  | { readonly outcome: "admitted" }
  | { readonly outcome: "already-member" }
  | { readonly outcome: "issuance-failed" }
  | { readonly outcome: "redemption-failed" };

export type FedosGroupRemoveMemberResult = { readonly outcome: "revoked" } | { readonly outcome: "not-member" } | { readonly outcome: "revocation-failed" };

export interface FedosGroupAdmissionDependencies {
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly capabilityIssuerAuthority: FedosConversationCapabilityIssuerAuthority;
  readonly redemptionAuthority: FedosConversationCapabilityRedemptionAuthority;
}

export class FedosGroupAdmission {
  readonly #deps: FedosGroupAdmissionDependencies;

  constructor(deps: FedosGroupAdmissionDependencies) {
    this.#deps = deps;
  }

  /** Alpha 1363 — a revoked/left Membership is never silently reactivated; this always goes through issue+redeem, exactly like a first-time admission. */
  addMember(
    groupConversationId: FedosConversationId,
    issuer: FedosConversationParticipantReference,
    newMember: FedosConversationParticipantReference,
    now: number,
  ): FedosGroupAddMemberResult {
    const existing = this.#deps.membershipAuthority.findMembership(groupConversationId, newMember);
    if (existing !== null && existing.state === "active") return { outcome: "already-member" };

    const issuance = this.#deps.capabilityIssuerAuthority.issueJoinCapability(
      { conversationId: groupConversationId, issuer, action: "join-conversation", intendedRecipient: newMember, maxUses: 1, expiresAt: null },
      now,
    );
    if (issuance.outcome !== "issued") return { outcome: "issuance-failed" };

    const redemption = this.#deps.redemptionAuthority.redeem(
      { capabilityId: issuance.descriptor.capabilityId, bearerSecret: issuance.bearerSecret, redeemer: newMember },
      now,
    );
    if (redemption.outcome !== "redeemed") return { outcome: "redemption-failed" };
    return { outcome: "admitted" };
  }

  removeMember(groupConversationId: FedosConversationId, member: FedosConversationParticipantReference, now: number): FedosGroupRemoveMemberResult {
    const existing = this.#deps.membershipAuthority.findMembership(groupConversationId, member);
    if (existing === null || existing.state !== "active") return { outcome: "not-member" };
    const revocation = this.#deps.membershipAuthority.revoke(groupConversationId, member, now);
    if (revocation.outcome !== "revoked") return { outcome: "revocation-failed" };
    return { outcome: "revoked" };
  }
}
