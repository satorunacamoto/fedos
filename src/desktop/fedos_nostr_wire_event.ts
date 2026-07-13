/**
 * Secure Runtime Alpha 234 ("Inbound Event Representation") — the
 * SECOND new file of the Alpha 231–240 Nostr Relay Message Reception
 * Arc. `FedosNostrWireEvent` is the representation an inbound NIP-01
 * EVENT payload takes as it crosses the Desktop Relay boundary.
 *
 * Four options were compared (this Stage's own instruction):
 *
 *   A. Reuse `FedosEventDescriptor` (`fedos_event_descriptor.ts`, Alpha
 *      202) directly. REJECTED: `FedosEventDescriptor` requires a
 *      `provider` field that has NO source on the wire (a relay's own
 *      `["EVENT", subId, event]` payload carries exactly seven NIP-01
 *      fields — inventing a `provider` value at the parser boundary
 *      would be a guess, not a fact the wire actually states), and it
 *      RENAMES every field (`pubkey`→`author`, `created_at`→`createdAt`,
 *      `sig`→`signature`) — this Stage's own instruction states
 *      plainly "Do not rename away protocol semantics at the parser
 *      boundary." Reusing it here would violate both.
 *   B. Introduce a dedicated `FedosNostrWireEvent`. ADOPTED — see below.
 *   C. Reuse the legacy `SignedNostrEvent` (`src/sign/types.ts`, Stage
 *      10). REJECTED: `SignedNostrEvent` is owned by the legacy
 *      `src/sign`/`src/nostr` stack this Arc's own Boundary
 *      Requirements forbid silently mixing with the new Desktop
 *      boundary ("keep ownership and types explicit"); it is also
 *      shaped for the OUTBOUND signing flow (extends
 *      `UnsignedNostrEvent`), not inbound reception.
 *   D. Expose the raw `unknown` object. REJECTED: every downstream
 *      consumer (a subscription listener, Alpha 236) would need to
 *      re-validate the shape itself — the exact "parsing success must
 *      not imply cryptographic validity, but STRUCTURAL validity is
 *      still a real, useful guarantee" this Stage's own parser (Alpha
 *      233) already establishes and should not be thrown away at the
 *      last step.
 *
 * `FedosNostrWireEvent` therefore preserves NIP-01's own seven field
 * NAMES verbatim (`id`, `pubkey`, `created_at`, `kind`, `tags`,
 * `content`, `sig`) — no renaming, no dropped field, no synthesized
 * field. It is a SEPARATE, independent type from `FedosEventDescriptor`
 * — a later adapter (a future Stage, explicitly out of this Arc's own
 * scope) MAY map one onto the other; this Stage builds no such adapter,
 * since Alpha 240's own Completion Declaration lists cryptographic
 * validation of received Events as still out of scope, and mapping an
 * UNVALIDATED wire event onto `FedosEventDescriptor` — a type whose own
 * Alpha 202 doc comment describes its fields as "already-signed Event
 * data" — would misrepresent an unverified payload as a trusted one.
 *
 * HARD GUARDRAILS:
 *   - `FedosNostrWireEvent` is the ONLY export.
 *   - Every field is `readonly` — no mutation method or setter of any
 *     kind, and no field may ever be reassigned after construction.
 *   - Field NAMES are the exact NIP-01 wire names (`pubkey`, not
 *     `author`; `created_at`, not `createdAt`; `sig`, not `signature`)
 *     — this type is deliberately NOT protocol-neutral, because it
 *     represents a WIRE payload, not a Desktop-normalized descriptor.
 *   - NO `provider` field, NO synthesized/derived field of any kind —
 *     only the seven fields NIP-01 itself defines.
 *   - This file defines a TYPE ONLY — no function, no class, no runtime
 *     behavior, no validation logic (that is `relay_inbound_parser.ts`'s
 *     own concern, Alpha 233), and no cryptographic verification of any
 *     kind.
 *   - NO reference to `src/nostr/*` or `src/sign/*` anywhere in this
 *     file.
 */

export interface FedosNostrWireEvent {
  readonly id: string;
  readonly pubkey: string;
  readonly created_at: number;
  readonly kind: number;
  readonly tags: readonly (readonly string[])[];
  readonly content: string;
  readonly sig: string;
}
