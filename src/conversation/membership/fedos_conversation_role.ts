/**
 * Secure Runtime Alpha 764 ("Membership Role Decision") — Stage 4 of the
 * Alpha 761–790 Canonical Conversation Membership & Capability
 * Foundation Arc.
 *
 * Compared, per this Arc's own instruction:
 *   A. member / moderator / owner — a closed, coarse role vocabulary.
 *   B. reader / writer / inviter / administrator — a wider, permission-
 *      shaped set.
 *   C. capability-based independent permissions — no role at all, every
 *      action its own capability.
 *   D. single generic member role — no distinction at all.
 *
 * ADOPTED: Option A. Matches this Arc's own preferred direction ("the
 * smallest V1 that does not overpromise private moderation") and the
 * prior review's own `FedosConversationRole` sketch
 * (`docs/reviews/private_conversation_security/04_membership_authorization.md`
 * §"Recommended shape" — "owner | admin | member — narrower set than
 * SpaceRole's five, TBD by a future Arc"; this Arc names that narrower
 * set `owner | moderator | member`, `"moderator"` chosen over `"admin"`
 * to avoid implying system-administration authority this Arc never
 * grants). Option B is rejected: it names permissions
 * (`writeAuthority`/`inviteAuthority` are already independent
 * `FedosConversationPolicy` axes, Alpha 653) as if they were role
 * levels, which would duplicate Policy's own axis model inside
 * Membership. Option C is rejected as premature: no consumer in this
 * Arc's scope needs per-action capability grants finer than a role.
 * Option D is rejected: `revoke()` (Membership Authority, Alpha 770)
 * needs SOME notion of "who may act on another member," which a single
 * undifferentiated role cannot express.
 *
 * `SpaceRole` (`../../community/types.ts`, Alpha 9) is NOT reused — it
 * is a five-value, pubkey-allowlist-keyed vocabulary
 * (`owner | admin | moderator | member | guest`) built for a different,
 * older Community/Nostr-specific model with no fail-closed validator and
 * a free-text `SpaceDecision.reason` string; reusing it would import
 * that model's own looser conventions into this Arc's fail-closed,
 * closed-vocabulary discipline.
 *
 * A role carries NO permission logic itself in V1 — enforcement (if
 * any) is a future Conversation Policy consumer's responsibility
 * (Alpha 773), never this file's.
 */

export type FedosConversationRole = "member" | "moderator" | "owner";

export const FEDOS_CONVERSATION_ROLES: readonly FedosConversationRole[] = ["member", "moderator", "owner"];
