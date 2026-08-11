/**
 * Secure Runtime Alpha 244 ("BIP-340 Signature Verification") — the
 * THIRD new file of the Alpha 241–250 Nostr Inbound Event Validation
 * Arc. `verifyNostrEventSignature` checks that a `FedosNostrWireEvent`'s
 * (Alpha 234) own `sig` is a valid BIP-340 Schnorr signature over its
 * own `id` bytes, under its own x-only `pubkey`.
 *
 * Four options were compared (this Stage's own instruction):
 *
 *   A. Reuse `NobleSignatureVerifier` (`src/nostr/noble_signature.ts`,
 *      Stage 8) directly. REJECTED: its own `verify()` body
 *      RECOMPUTES the event id internally via `serializeForId`
 *      (`JSON.stringify`-based) as a precondition before checking the
 *      signature — the SAME escaping divergence Alpha 243 §(see its
 *      own doc comment) already found unsafe to inherit for inbound
 *      events from arbitrary Nostr clients. It also operates on the
 *      legacy `NostrEvent` type, requiring either a field-renaming
 *      adapter or accepting the legacy stack's own type into the new
 *      Desktop boundary — against this Arc's own Boundary Requirement
 *      ("keep ownership and types explicit").
 *   B. Reuse an existing Rust verifier through an already-existing
 *      boundary. REJECTED: Alpha 241 §5 found no `pub(crate)` Rust
 *      Schnorr-verification function reachable from TypeScript at
 *      all — every `k256::schnorr::...::verify_prehash` call in
 *      `lib.rs` lives inside a `#[cfg(test)] mod tests` block, proving
 *      the OUTBOUND signing chain's own correctness, never exposed as
 *      a `pub(crate) fn`, let alone `#[wasm_bindgen]`.
 *   C. Add a new internal TypeScript verifier using CURRENT
 *      dependencies. **ADOPTED.**
 *   D. Add a new wasm export. REJECTED: this Arc's own Absolute
 *      Prohibitions forbid new dependencies and (absent proof of
 *      necessity) Rust/Cargo changes; Option C already satisfies every
 *      requirement with zero such change.
 *
 * `verifyNostrEventSignature` calls `schnorr.verify` from
 * `@noble/curves/secp256k1.js` DIRECTLY — the EXACT SAME primitive
 * `NobleSignatureVerifier` itself calls internally, and the SAME
 * "BIP-340 Schnorr verification primitives already present in the
 * repository" this Arc's own "Already complete and MUST NOT be
 * redesigned" list names. This file REUSES that primitive; it does
 * NOT redesign or reimplement Schnorr verification itself — it only
 * avoids the id-recomputation precondition `NobleSignatureVerifier`
 * bundles in, since Alpha 245's own combined validator (this Arc) runs
 * Event ID verification as its OWN, separate, prior step.
 * `@noble/curves`/`@noble/hashes` are ALREADY-declared `package.json`
 * dependencies (unchanged since before this Arc) — this Stage adds
 * ZERO new dependency of any kind.
 *
 * HARD GUARDRAILS:
 *   - `verifyNostrEventSignature` is the ONLY export.
 *   - Verifies `sig` over `event.id`'s own bytes — NEVER re-hashes
 *     `content`/derives a message independently; this function trusts
 *     its OWN caller (`validateInboundNostrEvent`, Alpha 245) to have
 *     already confirmed `event.id` is correct BEFORE calling this
 *     function, matching this Arc's own "event ID verification must
 *     run first" / "invalid id means signature verification is not
 *     treated as sufficient" instruction — this function itself does
 *     NOT re-verify the id (that would duplicate Alpha 243's own job);
 *     it only refuses a malformed-shaped id (wrong length/hex).
 *   - `id`/`pubkey` (32 bytes each) and `sig` (64 bytes) are each
 *     validated as exact-length lowercase hex BEFORE any cryptographic
 *     call — malformed shapes fail closed (`false`), never throw.
 *   - NEVER throws — wrapped in a single outer `try`/`catch` returning
 *     `false` for any unexpected internal error (including a
 *     malformed x-only pubkey `@noble/curves` itself rejects).
 *   - NO secret-key access, NO signing, NO key derivation of any kind
 *     — this file imports `schnorr.verify` only, never
 *     `schnorr.sign`/`schnorr.getPublicKey`.
 *   - NO automatic logging, NO severity classification of any kind.
 *   - NO reference to `src/nostr/*` or `src/sign/*` anywhere in this
 *     file.
 */

import { schnorr } from "@noble/curves/secp256k1.js";
import { hexToBytes } from "@noble/hashes/utils.js";
import type { FedosNostrWireEvent } from "./fedos_nostr_wire_event.js";

const LOWER_HEX = /^[0-9a-f]+$/;

function isExactHex(value: string, byteLength: number): boolean {
  return typeof value === "string" && value.length === byteLength * 2 && LOWER_HEX.test(value);
}

/**
 * Verifies `event.sig` is a valid BIP-340 Schnorr signature over
 * `event.id`'s own 32 bytes, under `event.pubkey`'s own x-only 32
 * bytes. Assumes `event.id` has ALREADY been verified correct by the
 * caller (Alpha 245's own ordering requirement) — this function only
 * rejects a malformed-SHAPED id, never re-derives it. Never throws;
 * malformed input fails closed (`false`).
 */
export function verifyNostrEventSignature(event: FedosNostrWireEvent): boolean {
  try {
    if (!isExactHex(event.id, 32)) return false;
    if (!isExactHex(event.pubkey, 32)) return false;
    if (!isExactHex(event.sig, 64)) return false;
    return schnorr.verify(hexToBytes(event.sig), hexToBytes(event.id), hexToBytes(event.pubkey));
  } catch {
    return false;
  }
}
