/**
 * Secure Runtime Alpha 991/993/994/995 ("Invitation Authority" / "Invitation
 * Validation" / "Invitation Redemption" / "Invitation Revocation") — Phase A
 * of the Alpha 991–1050 Conversation Invitation Transport & Draft Management
 * Arc.
 *
 * Closed, fail-closed outcome vocabularies for the three invitation
 * operations, mirroring `FedosConversationCapabilityIssuanceResult` /
 * `FedosConversationCapabilityRedemptionResult` / the Membership result
 * vocabulary exactly (union of `{ outcome: "..." }` shapes, never a boolean,
 * never a raw `Error`, never arbitrary provider text).
 *
 * These are DERIVED, re-shaped views of the frozen Capability result
 * vocabularies (per this Arc's reconciliation, Finding 1): the invitation
 * transport delegates to the frozen issuer/redemption authorities and maps
 * their outcomes onto invitation-shaped tokens — `"invalid-capability"`
 * becomes `"invalid-invitation"`, and a NEW `"revoked"` redemption outcome is
 * added for this Arc's genuinely-new revocation gap (Finding 2). Expiry
 * (`"expired"`) and exhaustion (`"exhausted"`) are carried through UNCHANGED —
 * they are already enforced by the frozen redemption authority, never
 * re-implemented here.
 */

import type { FedosConversationCapabilityDescriptor } from "../capability/fedos_conversation_capability_descriptor.js";
import type { FedosConversationMembership } from "../membership/fedos_conversation_membership.js";
import type { FedosConversationInvitationToken } from "./fedos_conversation_invitation_token.js";

/**
 * Result of creating an invitation (= issuing a join Capability). Maps
 * `FedosConversationCapabilityIssuanceResult`: `"issued"` becomes
 * `"created"`, carrying the public descriptor plus the recipient-facing token
 * (the ONE channel a bearer secret travels through, Alpha 907). Every failure
 * token is carried through unchanged.
 */
export type FedosConversationInvitationCreationResult =
  | {
      readonly outcome: "created";
      readonly descriptor: FedosConversationCapabilityDescriptor;
      readonly token: FedosConversationInvitationToken;
    }
  | { readonly outcome: "denied"; readonly reason: "conversation-not-found" | "issuer-not-authorized" }
  | { readonly outcome: "invalid-request" }
  | { readonly outcome: "unavailable" };

/**
 * Result of redeeming an invitation (= redeeming a join Capability). Maps
 * `FedosConversationCapabilityRedemptionResult`: `"invalid-capability"`
 * becomes `"invalid-invitation"` (still collapsing unknown-id and wrong-secret
 * uniformly — Alpha 782's "never reveal an almost-correct secret" discipline
 * is preserved), and a NEW `"revoked"` outcome is returned when the invitation
 * was revoked before redemption (Finding 2). All other outcomes are carried
 * through unchanged.
 */
export type FedosConversationInvitationRedemptionResult =
  | { readonly outcome: "redeemed"; readonly descriptor: FedosConversationCapabilityDescriptor; readonly membership: FedosConversationMembership }
  | { readonly outcome: "already-redeemed" }
  | { readonly outcome: "expired" }
  | { readonly outcome: "exhausted" }
  | { readonly outcome: "revoked" }
  | { readonly outcome: "invalid-invitation" }
  | { readonly outcome: "recipient-mismatch" }
  | { readonly outcome: "unauthorized" }
  | { readonly outcome: "conflict" }
  | { readonly outcome: "unavailable" };

/**
 * Result of revoking an invitation — this Arc's genuinely-new operation
 * (Finding 2). Revocation is TERMINAL and one-way: a second revocation of an
 * already-revoked invitation is the idempotent `"already-revoked"`, never an
 * error. `"unauthorized"` when the revoker is not the issuer and not an active
 * owner/moderator; `"not-found"` when no invitation with that id exists.
 */
export type FedosConversationInvitationRevocationResult =
  | { readonly outcome: "revoked" }
  | { readonly outcome: "already-revoked" }
  | { readonly outcome: "not-found" }
  | { readonly outcome: "unauthorized" }
  | { readonly outcome: "unavailable" };

/**
 * An immutable, non-secret summary of one invitation for management/read
 * surfaces (Alpha 1011 Conversation Read APIs). The PUBLIC descriptor plus its
 * current revoked flag — NEVER a bearer secret or token (Alpha 907/925).
 */
export interface FedosConversationInvitationSummary {
  readonly descriptor: FedosConversationCapabilityDescriptor;
  readonly revoked: boolean;
}
