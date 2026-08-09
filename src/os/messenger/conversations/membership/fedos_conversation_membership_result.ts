/**
 * Secure Runtime Alpha 769 ("Membership Result Vocabulary") — Stage 9 of
 * the Alpha 761–790 Canonical Conversation Membership & Capability
 * Foundation Arc.
 *
 * Explicit, closed outcomes only — no boolean, no raw `Error` object, no
 * stack trace, no arbitrary provider text. Mirrors
 * `FedosConversationPersistenceWriteResult`'s own
 * `"inserted" | "already-present" | "conflict" | "failed"` discipline
 * (`../persistence/fedos_conversation_persistence.ts`, Alpha 749),
 * adapted to Membership's own six-transition contract (Alpha 768).
 *
 * The instruction's own candidate list (`admitted` / `already-present` /
 * `conflict` / `invalid-transition` / `not-found` / `unavailable`) is
 * shared by all three mutating operations (`admit`/`revoke`/`leave`) at
 * the Authority interface level (Alpha 770) — but labeling a
 * SUCCESSFUL `revoke()`/`leave()` as `"admitted"` would be actively
 * misleading (nothing was admitted). This file extends the candidate
 * with two operation-specific success tokens, `"revoked"`/`"left"`,
 * mirroring `admitted`'s own shape exactly (`{ outcome; membership }`)
 * — the shared failure tokens (`already-present`/`conflict`/
 * `invalid-transition`/`not-found`/`unavailable`) are untouched.
 */

import type { FedosConversationMembership } from "../../../../conversation/membership/fedos_conversation_membership.js";

export type FedosConversationMembershipMutationOutcome =
  | "admitted"
  | "revoked"
  | "left"
  | "already-present"
  | "conflict"
  | "invalid-transition"
  | "not-found"
  | "unavailable";

export type FedosConversationMembershipMutationResult =
  | { readonly outcome: "admitted"; readonly membership: FedosConversationMembership }
  | { readonly outcome: "revoked"; readonly membership: FedosConversationMembership }
  | { readonly outcome: "left"; readonly membership: FedosConversationMembership }
  | { readonly outcome: "already-present"; readonly membership: FedosConversationMembership }
  | { readonly outcome: "conflict" }
  | { readonly outcome: "invalid-transition" }
  | { readonly outcome: "not-found" }
  | { readonly outcome: "unavailable" };

/**
 * Alpha 770's own `previewAdmission()` — a PURE read, never mutates.
 * Deliberately narrower than `FedosConversationMembershipMutationResult`:
 * a preview never returns `"not-found"` (nothing is looked up by id) and
 * never carries a `membership` payload (nothing was constructed).
 */
export type FedosConversationMembershipAdmissionPreview =
  | { readonly outcome: "would-admit" }
  | { readonly outcome: "already-active" }
  | { readonly outcome: "blocked"; readonly reason: "invalid-transition" }
  | { readonly outcome: "unavailable" };
