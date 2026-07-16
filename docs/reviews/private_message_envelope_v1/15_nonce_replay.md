# 15 — Nonce and Replay Considerations

## What the real Rust source states about its own nonce discipline

Direct reading of `packages/fedos-core-rust/src/crypto/aead_internal.rs`'s
own doc comments, this pass:

```
//! two typed inputs for key material and nonce — a
...
//! `(key, nonce)` pair has been used before — doing so would require
...
//! `seal_internal` MUST draw a fresh nonce from `fedos_aead_nonce_96()`
//! for EVERY seal call under the same key — reusing a nonce with
...
//! and `docs/nonce_generation_policy.md`.
```

and, on the nonce-extraction helper:

```rust
/// Validate `nonce` is `Ready` and extract its 12 bytes. A nonce is not a
/// secret (`docs/nonce_generation_policy.md` section 9), so this is a
```

**Confirmed, directly**: nonces are 96-bit (12-byte), generated via
`fedos_aead_nonce_96()`, and the source's own doc comment states a fresh
nonce **must** be drawn for every `seal_internal` call under the same
key — a documented policy, not merely an implementation detail this
review is inferring.

## What is not confirmed by TypeScript-side reading — named honestly, not guessed

This review's own required reading list is `src/`-first; a full audit of
`fedos_aead_nonce_96()`'s own CSPRNG source, its entropy quality, or
whether it is called with any state that could cause cross-process nonce
collision is **Rust-internal, cryptographic-implementation-level
verification** this review does not perform — it is outside what a
source-inspecting TypeScript-boundary review can respectably assert.
This review states only what its own reading directly confirms: the
*documented policy* is "fresh nonce every call," and the doc comment
itself frames this as **required**, not optional, for callers whose
external behavior remains within the Rust boundary's own internal
control (i.e., `seal_internal` draws its own nonce; nothing in Seam 2's
TS-facing `encrypt()` API accepts or supplies a nonce parameter,
confirmed by direct reading of `fedos_runtime_encrypt.ts`'s own
signature: `encrypt(key, algorithm, aadDomain, plaintext)` — no nonce
argument exists anywhere in the public chain).

## Consequence for the Envelope: nonce is fully opaque and Rust-internal, by design — and this is good encapsulation, with one caveat

Because nonce generation is entirely internal to `seal_internal` and
never exposed to or supplied by TypeScript, the Envelope
(`04_envelope_v1.md`) has **no nonce field of its own** — the nonce, if
it needs to travel with the ciphertext at all (typical for AEAD wire
formats, since the receiver needs it to decrypt), is presumably already
embedded inside the `AeadCiphertextWire` string produced by
`exportCiphertext()`, per that file's own role (serializing "the canonical
JSON + base64url text `serialize_aead_ciphertext()`... produces"). This
review did not independently verify the exact byte layout inside
`AeadCiphertextWire` (that would require reading
`ciphertext_transport.rs`'s own serialization code in full, which
neither this review nor either prior review did) — it is named here as
**an assumption grounded in the wire-type's own documented role, not a
directly confirmed byte-level fact**, and flagged for a future Arc to
confirm directly against Rust source before relying on it.

## Replay considerations specific to the Envelope, not the raw AEAD call

Fresh-nonce-per-call (confirmed) prevents the classic AEAD nonce-reuse
key-recovery attack. It does **not**, by itself, prevent **application-level
replay** — an adversary (or a buggy client) resubmitting an entire,
validly-encrypted, validly-authenticated Envelope a second time. Nothing
in this codebase's own current source addresses this: `04_envelope_v1.md`'s
`createdAt` field is a plaintext routing-metadata timestamp, not a
cryptographically-bound anti-replay nonce, and `14_associated_data.md`'s
own recommended AAD binding (`conversationId`/`keyEpoch`/`senderRef`)
would not by itself prevent replay either — a resubmitted Envelope would
have identical AAD and identical ciphertext, and would re-authenticate
successfully every time. **This review names application-level replay
protection (e.g. a per-sender monotonic sequence number, or de-duplication
by message id at the receiving/persistence layer) as an open item no
document in this review resolves** — it is a genuinely separate concern
from the AEAD nonce discipline above, and conflating the two (assuming
"fresh AEAD nonce" already solves "no duplicate message delivery") would
be the kind of error this review's own instruction to avoid speculative
claims exists to prevent.

## See also

- `docs/reviews/private_conversation_security/01_existing_crypto_inventory.md` (the source of the real AEAD implementation this document's own nonce-policy grounding depends on)
- `04_envelope_v1.md`, `05_encryption_suites.md`, `14_associated_data.md`
