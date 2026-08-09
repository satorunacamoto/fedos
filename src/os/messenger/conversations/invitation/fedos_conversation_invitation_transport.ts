/**
 * Secure Runtime Alpha 991/993/994/995/999 ("Invitation Authority" /
 * "Invitation Validation" / "Invitation Redemption" / "Invitation Revocation"
 * / "Invitation Transport") — Phase B of the Alpha 991–1050 Conversation
 * Invitation Transport & Draft Management Arc.
 *
 * A THIN application-layer FACADE over the frozen Capability boundary — per
 * this Arc's reconciliation (Finding 1), it re-implements NONE of: bearer
 * secret generation, expiry checking, use-count enforcement, or membership
 * admission. Every one of those is delegated to the injected, frozen
 * `FedosConversationCapabilityIssuerAuthority` (Alpha 780) and
 * `FedosConversationCapabilityRedemptionAuthority` (Alpha 783). This facade
 * only:
 *   - re-shapes the frozen result vocabularies into invitation-shaped results
 *     (`fedos_conversation_invitation_result.ts`),
 *   - packages the issuance output into a recipient-facing token
 *     (`fedos_conversation_invitation_token.ts`), and
 *   - composes in the genuinely-new revocation gate (Finding 2) via the
 *     additive `FedosConversationInvitationRevocationRegistry` (Alpha 996),
 *     consulted BEFORE any redemption is delegated.
 *
 * Invitation issuance = issue a join Capability. Invitation validation +
 * redemption = redeem a join Capability (`redeem()` validates the bearer
 * secret, expiry, recipient, and use-count without mutation, then commits).
 * Invitation expiration is handled ENTIRELY by the frozen redemption authority
 * (`"expired"` outcome) — this facade adds no expiry logic. Invitation
 * revocation is this Arc's own new, additive, terminal operation.
 *
 * SECURITY NOTES:
 *   - The bearer secret travels through EXACTLY ONE channel — the token on a
 *     `"created"` result — never through `inspectInvitation()` or any list
 *     read (Alpha 907/925).
 *   - The revocation gate is checked by PUBLIC capability id (already loggable)
 *     before redemption, so a revoked invitation never redeems regardless of
 *     bearer-secret correctness — fail closed.
 *   - `"invalid-invitation"` uniformly covers unknown id AND wrong secret
 *     (Alpha 782's "never reveal an almost-correct secret" preserved).
 */

import type { FedosBoardRuntimeClock } from "../../board/runtime/fedos_board_runtime_clock.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference.js";
import type { FedosConversationCapabilityDescriptor } from "../capability/fedos_conversation_capability_descriptor.js";
import type { FedosConversationCapabilityId } from "../capability/fedos_conversation_capability_id.js";
import type { FedosConversationCapabilityIssuerAuthority } from "../capability/fedos_conversation_capability_issuer_authority.js";
import type { FedosConversationCapabilityRedemptionAuthority } from "../capability/fedos_conversation_capability_redemption_authority.js";
import { toFedosConversationInvitationToken, type FedosConversationInvitationToken } from "./fedos_conversation_invitation_token.js";
import type {
  FedosConversationInvitationCreationResult,
  FedosConversationInvitationRedemptionResult,
  FedosConversationInvitationRevocationResult,
  FedosConversationInvitationSummary,
} from "./fedos_conversation_invitation_result.js";
import type { FedosConversationInvitationRevocationRegistry } from "./fedos_conversation_invitation_revocation_registry.js";
import type { FedosPersistedConversationInvitationRevocationV1 } from "./fedos_persisted_conversation_invitation_revocation_v1.js";

/**
 * Caller preferences for a new invitation — NEVER an id/secret/current-use
 * count (those are Authority-derived). The `action` is fixed
 * `"join-conversation"` (Alpha 776's V1 single action), so it is not a caller
 * input.
 */
export interface FedosConversationInvitationCreationRequest {
  readonly conversationId: FedosConversationId;
  readonly issuer: FedosConversationParticipantReference;
  /** `null` for a general (any redeemer) invitation; a specific participant for a one-recipient invitation. */
  readonly intendedRecipient: FedosConversationParticipantReference | null;
  readonly maxUses: number;
  readonly expiresAt: number | null;
}

/**
 * Injected — decides whether `revoker` may revoke `descriptor`'s invitation.
 * Kept INJECTED (never hard-wired to Membership) exactly like the frozen
 * issuer authority's own `FedosConversationCapabilityIssuanceAuthorizationCheck`
 * (Alpha 780) — an adapter boundary, not a new coupling. The assembly
 * (Alpha 1011) supplies a real check: the revoker is the original issuer, or an
 * active owner/moderator member.
 */
export type FedosConversationInvitationRevocationAuthorizationCheck = (
  descriptor: FedosConversationCapabilityDescriptor,
  revoker: FedosConversationParticipantReference,
) => boolean;

export interface FedosConversationInvitationTransportDependencies {
  readonly issuerAuthority: FedosConversationCapabilityIssuerAuthority;
  readonly redemptionAuthority: FedosConversationCapabilityRedemptionAuthority;
  readonly revocationRegistry: FedosConversationInvitationRevocationRegistry;
  readonly revocationAuthorizationCheck: FedosConversationInvitationRevocationAuthorizationCheck;
  readonly clock: FedosBoardRuntimeClock;
}

export class FedosConversationInvitationTransport {
  readonly #deps: FedosConversationInvitationTransportDependencies;

  constructor(deps: FedosConversationInvitationTransportDependencies) {
    this.#deps = deps;
  }

  /** Alpha 991 — create an invitation = issue a join Capability. Delegates issuance entirely; never mints a secret itself. */
  createInvitation(request: FedosConversationInvitationCreationRequest): FedosConversationInvitationCreationResult {
    if (request === null || typeof request !== "object") return { outcome: "invalid-request" };
    const now = this.#deps.clock();
    const issuance = this.#deps.issuerAuthority.issueJoinCapability(
      {
        conversationId: request.conversationId,
        issuer: request.issuer,
        action: "join-conversation",
        intendedRecipient: request.intendedRecipient,
        maxUses: request.maxUses,
        expiresAt: request.expiresAt,
      },
      now,
    );
    switch (issuance.outcome) {
      case "issued":
        return {
          outcome: "created",
          descriptor: issuance.descriptor,
          token: toFedosConversationInvitationToken(issuance.descriptor.capabilityId, issuance.bearerSecret),
        };
      case "denied":
        return { outcome: "denied", reason: issuance.reason };
      case "invalid-request":
        return { outcome: "invalid-request" };
      case "unavailable":
        return { outcome: "unavailable" };
    }
  }

  /**
   * Alpha 993/994 — validate + redeem an invitation. The revocation gate is
   * consulted FIRST (fail closed): a revoked invitation never redeems, whatever
   * the bearer secret. Otherwise redemption is delegated wholesale to the
   * frozen redemption authority, and its outcome re-shaped.
   */
  redeemInvitation(
    token: FedosConversationInvitationToken,
    redeemer: FedosConversationParticipantReference,
  ): FedosConversationInvitationRedemptionResult {
    if (token === null || typeof token !== "object") return { outcome: "invalid-invitation" };
    if (this.#deps.revocationRegistry.isRevoked(token.capabilityId)) return { outcome: "revoked" };

    const now = this.#deps.clock();
    const result = this.#deps.redemptionAuthority.redeem(
      { capabilityId: token.capabilityId, bearerSecret: token.bearerSecret, redeemer },
      now,
    );
    switch (result.outcome) {
      case "redeemed":
        return { outcome: "redeemed", descriptor: result.descriptor, membership: result.membership };
      case "invalid-capability":
        return { outcome: "invalid-invitation" };
      case "already-redeemed":
        return { outcome: "already-redeemed" };
      case "expired":
        return { outcome: "expired" };
      case "exhausted":
        return { outcome: "exhausted" };
      case "recipient-mismatch":
        return { outcome: "recipient-mismatch" };
      case "unauthorized":
        return { outcome: "unauthorized" };
      case "conflict":
        return { outcome: "conflict" };
      case "unavailable":
        return { outcome: "unavailable" };
    }
  }

  /**
   * Alpha 995 — revoke an invitation. This Arc's genuinely-new, terminal,
   * one-way operation. Authorization is enforced through the injected check;
   * an already-revoked invitation is the idempotent `"already-revoked"`.
   */
  revokeInvitation(
    capabilityId: FedosConversationCapabilityId,
    revoker: FedosConversationParticipantReference,
  ): FedosConversationInvitationRevocationResult {
    const descriptor = this.#deps.issuerAuthority.inspectDescriptor(capabilityId);
    if (descriptor === null) return { outcome: "not-found" };
    if (!this.#deps.revocationAuthorizationCheck(descriptor, revoker)) return { outcome: "unauthorized" };
    if (this.#deps.revocationRegistry.isRevoked(capabilityId)) return { outcome: "already-revoked" };

    const record: FedosPersistedConversationInvitationRevocationV1 = {
      schemaVersion: 1,
      capabilityId,
      conversationId: descriptor.conversationId,
      revokedByAuthority: revoker.authority,
      revokedByPublicIdentifier: revoker.publicIdentifier,
      revokedByIdentityId: revoker.identityId,
      revokedAt: this.#deps.clock(),
    };
    const write = this.#deps.revocationRegistry.putRevocation(record);
    switch (write) {
      case "inserted":
        return { outcome: "revoked" };
      case "already-present":
        // A concurrent identical revocation reached the same terminal fact.
        return { outcome: "already-revoked" };
      case "conflict":
        // A concurrent DIFFERENT revoker already revoked it — the invitation
        // is revoked regardless; the terminal state is honestly reached.
        return { outcome: "already-revoked" };
      case "failed":
        return { outcome: "unavailable" };
    }
  }

  /**
   * Alpha 1011 — a non-secret read of one invitation: the PUBLIC descriptor
   * plus its current revoked flag. Never returns a bearer secret or token.
   * `null` for an unknown invitation.
   */
  inspectInvitation(capabilityId: FedosConversationCapabilityId): FedosConversationInvitationSummary | null {
    const descriptor = this.#deps.issuerAuthority.inspectDescriptor(capabilityId);
    if (descriptor === null) return null;
    return Object.freeze({ descriptor, revoked: this.#deps.revocationRegistry.isRevoked(capabilityId) });
  }

  /**
   * Alpha 1011 — every invitation issued for a conversation, as non-secret
   * summaries, for invitation-management reads. Composed over the frozen issuer
   * authority's additive `listIssuedDescriptorsForConversation()` (Alpha 1000)
   * plus the revocation registry. Returns `[]` when the authority does not
   * support listing.
   */
  listConversationInvitations(conversationId: FedosConversationId): readonly FedosConversationInvitationSummary[] {
    const list = this.#deps.issuerAuthority.listIssuedDescriptorsForConversation;
    if (list === undefined) return [];
    return list.call(this.#deps.issuerAuthority, conversationId).map((descriptor) =>
      Object.freeze({ descriptor, revoked: this.#deps.revocationRegistry.isRevoked(descriptor.capabilityId) }),
    );
  }
}
