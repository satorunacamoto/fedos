/**
 * Secure Runtime Alpha 762 ("Participant Reference Decision") — Stage 2
 * of the Alpha 761–790 Canonical Conversation Membership & Capability
 * Foundation Arc.
 *
 * A protocol-neutral reference to whoever participates in a
 * Conversation's Membership or Capability domain — deliberately NOT
 * `FedosBoardAuthorReference` reused directly (a post author and a
 * Conversation participant are different facts that happen to share a
 * shape today; collapsing them would make a future participant-only
 * field, e.g. a Membership `role`, look like it also applies to board
 * authorship). Mirrors `FedosBoardAuthorReference`'s own
 * `identityId`/protocol/`publicIdentifier` shape
 * (`../../board/fedos_board_author.ts`, Alpha 254) and reuses the
 * EXISTING `FedosBoardSourceProtocol` vocabulary
 * (`../../board/fedos_board_source.ts`) for every protocol-bound
 * authority — `"fedos"`, not a new `"fedos-identity"` label, so this
 * type never disagrees with the codebase's own established naming.
 * Extended with exactly one NEW authority kind this Arc's own scope
 * requires: `"temporary-capability"`, for a participant who has redeemed
 * a join Capability (`../capability/`) but is not yet bound to any
 * protocol identity — see `docs/secure_runtime_alpha_762_participant_reference_decision.md`.
 *
 * HARD GUARDRAILS:
 *   - Immutable — every field `readonly`.
 *   - Exact closed field set: `authority`, `publicIdentifier`,
 *     `identityId` — no more.
 *   - No display name, no avatar, no secret, no signing object, no raw
 *     capability secret, no arbitrary metadata bag.
 *   - No implicit cross-protocol identity equivalence: two references
 *     with the same `publicIdentifier` but different `authority` are
 *     NEVER treated as the same participant anywhere in this Arc.
 */

/** Reuses `FedosBoardSourceProtocol`'s own five protocol labels, plus one Capability-domain addition. */
export type FedosConversationParticipantAuthority = "fedos" | "nostr" | "activitypub" | "atproto" | "session" | "temporary-capability";

export const FEDOS_CONVERSATION_PARTICIPANT_AUTHORITIES: readonly FedosConversationParticipantAuthority[] = [
  "fedos",
  "nostr",
  "activitypub",
  "atproto",
  "session",
  "temporary-capability",
];

export interface FedosConversationParticipantReference {
  readonly authority: FedosConversationParticipantAuthority;
  /** An already-public identifier in `authority`'s own namespace — never a secret. */
  readonly publicIdentifier: string;
  /** Local `FedosIdentityRecord.id`, or `null` when not a known local identity. */
  readonly identityId: string | null;
}
