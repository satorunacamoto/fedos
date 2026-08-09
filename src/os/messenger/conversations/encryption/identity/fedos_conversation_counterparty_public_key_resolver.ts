/**
 * Secure Runtime Alpha 934 ("Counterparty PublicKey Resolution") — Stage
 * 4 of the Alpha 931–990 Conversation Identity Resolution and Encryption
 * Coordinator Arc.
 *
 * The FINAL step of Alpha 890's own named blocker: given the resolved
 * counterparty `FedosConversationParticipantReference`
 * (`./fedos_conversation_participant_resolver.ts`), extract the
 * `counterpartyPublicKeyHex` `resolveConversationKey()` (Alpha 869)
 * needs. A pure, total function — no network, no storage, no Membership
 * lookup of its own (the counterparty reference is always already
 * resolved by the caller).
 *
 * `09_direct_key_strategy.md`'s own ECDH channel is Nostr-keyed (a
 * secp256k1 public key), so only a counterparty whose `authority ===
 * "nostr"` can ever resolve here — `"unsupported-authority"` for every
 * other `FedosConversationParticipantAuthority` (`"fedos"`,
 * `"activitypub"`, `"atproto"`, `"session"`, `"temporary-capability"`)
 * is an honest, permanent V1 limitation, not a bug: this Arc invents no
 * new cross-protocol key-exchange scheme.
 *
 * The hex-shape check reuses `docs/secure_runtime_alpha_687_public_identifier_normalization_decision.md`'s
 * own "hex only, no Bech32 decoder" decision VERBATIM (Alpha 687, the
 * Nostr Identity Binding & Outbound Delivery Activation Arc) — the
 * IDENTICAL 64-character lowercase-hex pattern
 * `FedosSigningAuthorityNostrAuthorBinding`
 * (`../../../board/runtime/identity/fedos_nostr_author_binding_authority.ts`)
 * already enforces, re-declared here (that pattern constant is not
 * exported by that file, so this is a literal restatement of an
 * already-adopted decision, never a new one) rather than widened or
 * reinterpreted.
 */

import type { FedosConversationParticipantReference } from "../../../../../conversation/membership/fedos_conversation_participant_reference.js";

/** Alpha 687's own "hex only" decision, restated verbatim — see this file's own header. */
const NOSTR_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

export type FedosConversationCounterpartyPublicKeyResolution =
  | { readonly outcome: "resolved"; readonly publicKeyHex: string }
  | { readonly outcome: "unsupported-authority" }
  | { readonly outcome: "invalid-public-key" };

/** Total, never throws. */
export function resolveFedosConversationCounterpartyPublicKeyHex(
  counterparty: FedosConversationParticipantReference,
): FedosConversationCounterpartyPublicKeyResolution {
  if (counterparty.authority !== "nostr") return { outcome: "unsupported-authority" };
  if (!NOSTR_PUBLIC_KEY_HEX_PATTERN.test(counterparty.publicIdentifier)) return { outcome: "invalid-public-key" };
  return { outcome: "resolved", publicKeyHex: counterparty.publicIdentifier };
}
