/**
 * Secure Runtime Alpha 1395 ("Delivery Mode Vocabulary") — Phase A of the
 * Alpha 1391–1470 Nostr Private Direct and Pairwise Fanout Delivery Arc.
 *
 * Alpha 1393's own Protocol Compliance Gate found ZERO normative NIP-17/
 * NIP-44/NIP-59 wire material anywhere in this repository — every review
 * in `docs/reviews/private_protocol_delivery_group_v1/` and
 * `docs/reviews/private_group_pairwise_fanout/` explicitly defers that
 * research to a future Arc rather than claiming sufficient normative
 * material exists (see `docs/secure_runtime_alpha_1391_1470_phase_a_inventory.md`).
 * Per the Gate's own instruction, this Arc implements PROTOCOL-NEUTRAL
 * Private Nostr Delivery contracts and stops short of any NIP-17/NIP-59
 * compliance claim.
 *
 * `FEDOS_PRIVATE_NOSTR_DELIVERY_KIND` is a FedOS-PROPRIETARY event kind
 * number — NOT a registered/reviewed Nostr NIP, NOT NIP-17's `kind:14`/
 * `kind:1059`, NOT interoperable with any other Nostr client. It exists
 * only so a private delivery never collides with the existing, real
 * kind-1 public-post signing path (`src/nostr/sign/`, Alpha 424's own
 * fixed `SUPPORTED_NOSTR_KIND = 1`) — Alpha 1447's own "no private
 * plaintext/payload in a public kind-1 event" requirement is otherwise
 * unsatisfiable, since a public Board read of kind-1 events would surface
 * this ciphertext as a garbled public post. `isWellFormedFedosNostrUnsignedEventRequest()`
 * (`../../../nostr/sign/fedos_nostr_signing_authority.ts`) is extended
 * ADDITIVELY to accept this one extra kind alongside `1` — see that
 * file's own updated header for the exact, minimal change.
 *
 * `"ephemeral-online"` mode (Alpha 1433) is deliberately NOT backed by
 * any wire-level ephemeral event kind or relay-enforced non-persistence
 * claim — this repository has no reviewed confirmation that a mock/real
 * Relay in this test harness actually honors any such convention. It is
 * an APPLICATION-LEVEL distinction only: no `expiresAt` retention intent
 * is attached, and no offline-delivery expectation is documented for it
 * (Alpha 1438). Both modes use the identical wire kind above.
 */

export type FedosPrivateNostrDeliveryMode = "mailbox" | "ephemeral-online";

export const FEDOS_PRIVATE_NOSTR_DELIVERY_MODES: readonly FedosPrivateNostrDeliveryMode[] = [
  "mailbox",
  "ephemeral-online",
];

/**
 * FedOS-proprietary, disclosed non-standard event kind — see this file's
 * own header. Chosen arbitrarily above the low, well-known single/double/
 * triple-digit NIP kind numbers as a soft collision precaution only; this
 * is NOT a claim about any registered kind range semantics.
 */
export const FEDOS_PRIVATE_NOSTR_DELIVERY_KIND = 24700;

export function isFedosPrivateNostrDeliveryMode(value: unknown): value is FedosPrivateNostrDeliveryMode {
  return value === "mailbox" || value === "ephemeral-online";
}
