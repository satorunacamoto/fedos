/**
 * Secure Runtime Alpha 866 ("Membership Readiness") — Stage 6 of Phase B
 * of the Alpha 851–890 Private Message Envelope and Encryption Authority
 * Activation Arc.
 *
 * The review's own `08_membership_readiness.md` names the exact trap
 * this file exists to avoid: an Encryption/Decryption Authority that
 * resolves a conversation key for ANY caller, without a real Membership
 * check upstream, would make the Envelope LOOK access-controlled while
 * enforcing nothing — CFv1 §10's own "no fake allow-all membership" trap
 * one layer deeper. This function is that real, upstream check — called
 * by the Coordinators (`../encryption/fedos_conversation_encryption_coordinator.ts`
 * step 1, `fedos_conversation_decryption_coordinator.ts` step 2) BEFORE
 * either Authority is ever invoked, never folded into either Authority
 * itself (`06_encryption_authority.md`'s own "Authority boundary,
 * restated": the Encryption Authority must not itself decide who is a
 * legitimate participant).
 *
 * Direct mode's own membership check is structurally simpler than the
 * general N-member case (`08_membership_readiness.md`: no role, no
 * partial membership) but not exempt — this function still performs a
 * real `findMembership()` lookup against the frozen, unmodified
 * `FedosConversationMembershipAuthority` (Alpha 761–850) every single
 * call, never a hard-coded `true`.
 *
 * Suite/epoch readiness is checked here too (not duplicated in either
 * Authority) — `keyEpoch` readiness encodes Alpha 850/`11_key_epochs.md`'s
 * own Option 1 decision, ADOPTED here for the first time by this Arc:
 * **a Direct conversation's `keyEpoch` never advances past its initial
 * value** — the simplest honest V1 answer the review named without
 * choosing. `0` is therefore the only ever-valid `keyEpoch`; nothing in
 * this Arc's own Encryption Authority ever writes a different one.
 */

import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";
import type { FedosConversationMembershipAuthority } from "../../../../conversation/membership/fedos_conversation_membership_authority.js";
import type { FedosConversationParticipantReference } from "../../../../conversation/membership/fedos_conversation_participant_reference.js";
import { FEDOS_CONVERSATION_ENVELOPE_ENCRYPTION_SUITES } from "../../../../conversation/envelope/fedos_conversation_message_envelope.js";

/** Alpha 850's own adopted answer to `11_key_epochs.md`'s open question — see this file's own header. */
export const FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH = 0;

export type FedosConversationCryptoReadiness =
  | { readonly outcome: "ready" }
  | { readonly outcome: "not-member" }
  | { readonly outcome: "unsupported-suite" }
  | { readonly outcome: "unsupported-epoch" };

/**
 * Real, upstream readiness — active Membership, a supported suite, and
 * `keyEpoch === 0` (Alpha 850's own adopted Direct-mode epoch decision).
 * Does NOT itself resolve or touch key material — "key material
 * available" (the review's own readiness-table row) is proven or
 * disproven by the Encryption/Decryption Authority's own
 * `resolveConversationKey()` call, downstream of this function, never
 * duplicated here (this function has no WASM/Rust dependency at all).
 */
export function evaluateFedosConversationCryptoReadiness(
  membershipAuthority: FedosConversationMembershipAuthority,
  conversationId: FedosConversationId,
  participant: FedosConversationParticipantReference,
  suite: string,
  keyEpoch: number,
): FedosConversationCryptoReadiness {
  if (!FEDOS_CONVERSATION_ENVELOPE_ENCRYPTION_SUITES.includes(suite as (typeof FEDOS_CONVERSATION_ENVELOPE_ENCRYPTION_SUITES)[number])) {
    return { outcome: "unsupported-suite" };
  }
  if (keyEpoch !== FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH) return { outcome: "unsupported-epoch" };

  const membership = membershipAuthority.findMembership(conversationId, participant);
  if (membership === null || membership.state !== "active") return { outcome: "not-member" };

  return { outcome: "ready" };
}
