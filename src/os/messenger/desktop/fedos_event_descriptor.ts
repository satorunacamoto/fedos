/**
 * Secure Runtime Alpha 202 ("Desktop-Facing Event Reader Abstraction")
 * — the FIRST file of the Alpha 201–210 Nostr Event Runtime Exposure
 * Arc to add real code, following Alpha 201's own Decision to build a
 * TypeScript-only Desktop Reader boundary rather than extend the Rust
 * wasm surface. `FedosEventDescriptor` is the protocol-independent
 * public shape of an already-finalized Event Desktop may observe —
 * deliberately named and shaped like `FedosIdentityDescriptor`
 * (`src/identity/fedos_identity_descriptor.ts`, Alpha 028/045): a
 * `provider` field carries the originating protocol as DATA, never as
 * part of a Nostr-specific type name, and every field uses
 * protocol-neutral vocabulary (`author`, not `pubkey`; `createdAt`,
 * not `created_at`; `signature`, not `sig`) so this shape is never
 * mistaken for a NIP-01 wire-format event.
 *
 * This file defines a TYPE ONLY — no function, no class, no runtime
 * behavior, and no wiring into any other module in this repository.
 * `FedosNostrEventHandle` (`packages/fedos-core-rust/src/lib.rs`,
 * Alpha 192) is NOT reused, extended, or referenced here in any way —
 * it stays `pub(crate)`, entirely unreachable from TypeScript, exactly
 * as Alpha 198 confirmed and Alpha 201 §2 reconfirmed. Every field on
 * this type is PUBLIC, already-signed Event data — the same kind of
 * data a NIP-01 event's own seven wire fields already are once
 * broadcast — never a secret key, seed, or mnemonic of any kind.
 *
 * HARD GUARDRAILS:
 *   - `FedosEventDescriptor` is the ONLY export.
 *   - Every field is `readonly` — this type carries NO mutation method
 *     or setter of any kind, and no field may ever be reassigned after
 *     construction (Alpha 205 confirms this by direct inspection).
 *   - NO secret key, `nsec`, seed, mnemonic, or signing-key reference
 *     of any kind — `signature` holds a PUBLIC signature value, the
 *     same public artifact NIP-01's own `sig` field already is.
 *   - NO Relay, WebSocket, Subscription, or Filter field of any kind.
 *   - `provider` is a plain, unconstrained `string` — deliberately NOT
 *     a fixed Nostr-only union — mirroring `FedosIdentityDescriptor.provider`'s
 *     own identical discipline exactly.
 */

export interface FedosEventDescriptor {
  readonly id: string;
  readonly provider: string;
  readonly author: string;
  readonly createdAt: number;
  readonly kind: number;
  readonly tags: readonly (readonly string[])[];
  readonly content: string;
  readonly signature: string;
}
