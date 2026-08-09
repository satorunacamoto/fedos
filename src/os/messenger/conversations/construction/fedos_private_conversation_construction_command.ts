/**
 * Secure Runtime Alpha 901 ("Private Group Command") / Alpha 902 ("Direct
 * Conversation Command") — Phase B of the Alpha 891–930 Private
 * Conversation Draft Construction and Readiness Runtime Arc.
 *
 * A construction command names WHAT the caller wants, never WHO they are
 * or WHAT the system decides — the same discipline `CreatePublicThreadCommand`
 * already follows. Enforced by SHAPE: there is simply no field on either
 * command for a creator identity, Membership state, lifecycle state,
 * policy object, encryption suite, key epoch, readiness fact, use count,
 * persistence result, bearer verifier, or active state (Alpha 901's own
 * prohibition list). The coordinator resolves every one of those itself.
 *
 * `idempotencyKey` (Alpha 909) is an OPTIONAL application-generated
 * request id — NOT a canonical Conversation/Membership/Capability id
 * (those are Authority-derived, Alpha 908). It exists solely so a retried
 * command re-derives the SAME Conversation id and is recognized as the
 * same attempt (`"already-present"`), rather than minting a second draft.
 * Omitted, the coordinator mints a fresh request id, so each call is a
 * genuinely new construction. It is a plain opaque string, never a
 * secret.
 */

import type { FedosConversationParticipantAuthority } from "../../../../conversation/membership/fedos_conversation_participant_reference.js";

/** Caller preferences for an optional initial join Capability — NEVER an id/secret/current-use-count (Alpha 901/907). */
export interface FedosPrivateConversationInitialCapabilityRequest {
  readonly maxUses: number;
  readonly expiresAt: number | null;
}

/**
 * Alpha 901. Deliberately tiny: a private-group draft is `"unlisted"`,
 * `federationEligibility: "local-only"`, `readAccess: "members-only"`,
 * `writeAccess: "restricted"`, `inviteAuthority: "owner-and-moderators"`
 * — ALL fixed by `createPrivateGroupDraftPolicy()` (Alpha 896), none
 * caller-chosen. The only two caller inputs are the optional idempotency
 * key and whether to issue an initial (general, any-redeemer) join
 * Capability. Additional participants are NOT admitted at construction
 * (that would fabricate Membership); they join later by redeeming the
 * issued Capability (Alpha 906).
 */
export interface CreatePrivateGroupDraftCommand {
  readonly idempotencyKey?: string;
  readonly initialCapability?: FedosPrivateConversationInitialCapabilityRequest;
}

/**
 * Alpha 902. `direct` is a FIXED, declared mode — never `memberCount === 2`.
 * The command names the intended remote counterpart by an already-public
 * identifier only (never a secret). The creator is admitted at
 * construction (they bring the draft into existence); the recipient is
 * represented by an `intendedRecipient`-bound join Capability they must
 * redeem — construction NEVER fabricates an active Membership for a
 * recipient who has not redeemed (Alpha 906). Persisting the draft never
 * requires cryptographic key availability (Alpha 902).
 */
export interface CreateDirectDraftCommand {
  readonly idempotencyKey?: string;
  readonly recipient: {
    readonly authority: FedosConversationParticipantAuthority;
    readonly publicIdentifier: string;
  };
}
