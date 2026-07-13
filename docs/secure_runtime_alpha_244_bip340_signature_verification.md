# Secure Runtime Alpha 244 — BIP-340 Signature Verification

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/desktop/nostr_signature_verifier.ts`. This is Stage 4 of the
Alpha 241–250 Nostr Inbound Event Validation Arc, following Alpha
243's own `verifyNostrEventId`.**

## 1. Why now

`validateInboundNostrEvent`'s (Alpha 245) own required order names
signature verification as its SECOND cryptographic step, run only
after Event ID verification succeeds. This Stage builds exactly that.

## 2. Options compared

**A. Reuse `NobleSignatureVerifier` directly.** REJECTED. Its own
`verify()` body recomputes the event id internally via `serializeForId`
as a PRECONDITION before checking the signature — inheriting the exact
escaping divergence Alpha 243 already found unsafe for arbitrary
inbound events. It also operates on the legacy `NostrEvent` type,
requiring either a rename-adapter or accepting the legacy stack's own
type into the Desktop boundary, against this Arc's own Boundary
Requirement.

**B. Reuse an existing Rust verifier through an already-existing
boundary.** REJECTED. Alpha 241 §2/§5 found no `pub(crate)` Rust
Schnorr-verification function reachable from TypeScript — every
`k256::schnorr::...::verify_prehash` call in `lib.rs` lives inside a
`#[cfg(test)]` block.

**C. Add a new internal TypeScript verifier using current
dependencies.** **ADOPTED.**

**D. Add a new wasm export.** REJECTED — this Arc's own Absolute
Prohibitions forbid new dependencies and (absent proof of necessity)
Rust/Cargo changes; Option C already satisfies every requirement with
neither.

## 3. What was implemented

```ts
export function verifyNostrEventSignature(event: FedosNostrWireEvent): boolean
```

Validates `id`/`pubkey` (32 bytes each) and `sig` (64 bytes) as
exact-length lowercase hex, then calls `schnorr.verify` from
`@noble/curves/secp256k1.js` DIRECTLY — over `event.id`'s own bytes as
the message, under `event.pubkey`'s own x-only bytes.

## 4. Reusing the primitive, not redesigning it

This Arc's own "Already complete and MUST NOT be redesigned" list
names "BIP-340 Schnorr verification primitives already present in the
repository" explicitly. `schnorr.verify` (`@noble/curves`) IS that
primitive — the SAME function `NobleSignatureVerifier` itself calls
internally. This file calls it DIRECTLY, honoring the instruction to
reuse rather than redesign it; it avoids only the id-recomputation
PRECONDITION `NobleSignatureVerifier` bundles around that call, since
Alpha 245's own combined validator already runs Event ID verification
as its own, separate, prior step (Alpha 245 §2's own required order).
`@noble/curves`/`@noble/hashes` remain ALREADY-declared `package.json`
dependencies, unchanged — this Stage adds ZERO new dependency.

## 5. Required rules, each honored

- **Verify signature over `event.id` bytes.** Confirmed: `schnorr.verify`'s
  own second argument is `hexToBytes(event.id)`, never a re-hash of
  `content`.
- **Event ID verification must run first; invalid id means signature
  verification is not treated as sufficient.** This function does NOT
  itself re-verify the id (that would duplicate Alpha 243's own job) —
  it is `validateInboundNostrEvent`'s (Alpha 245) own responsibility to
  call `verifyNostrEventId` BEFORE this function, and to short-circuit
  with `null` if it fails, so this function's own (otherwise
  meaningless, since it would check a signature against a WRONG
  message) result is never even computed for a self-inconsistent
  event.
- **Malformed pubkey/signature/id fails closed.** Three exact-length
  hex checks precede any cryptographic call; any failure returns
  `false` immediately.
- **No exception escapes.** Wrapped in one outer `try`/`catch`.
- **No secret-key access, no signing, no key derivation.** Only
  `schnorr.verify` is imported — never `schnorr.sign`/
  `schnorr.getPublicKey`/any HKDF or key-derivation primitive.
- **No automatic logging, no severity classification.** Zero
  `console.*` call, zero classification of WHY a signature failed
  beyond the single `boolean` result.

## 6. Structural confirmation (real inspection, this Stage)

- `verifyNostrEventSignature` is the ONLY export.
- Zero reference to `schnorr.sign`, `schnorr.getPublicKey`, `Hkdf`, or
  any signing/derivation primitive anywhere in this file.
- Zero reference to `src/nostr/*` or `src/sign/*` anywhere in this
  file.
- Zero `console.*` call anywhere in this file.

## 7. What this Stage does NOT do

- Does **not** implement `validateInboundNostrEvent` — Alpha 245's own
  deliverable.
- Does **not** re-verify the event id — trusts its own caller's
  ordering (§5).
- Does **not** modify `src/nostr/noble_signature.ts`,
  `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`, or
  `package.json`.
- Does **not** modify `fedos_relay.ts`, `null_relay.ts`,
  `websocket_relay.ts`, `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `desktop_application.ts`, Storage, or
  Observation.

## 8. See also

- `docs/secure_runtime_alpha_243_canonical_event_id_verification.md`
- `docs/secure_runtime_alpha_245_combined_inbound_event_validator.md`
- `docs/secure_runtime_alpha_241_existing_inbound_validation_inventory.md`
