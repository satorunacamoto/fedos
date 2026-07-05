# NIP-44 v2 wire crypto completion: ChaCha20 + HMAC-SHA256 + decrypt pipeline (Stage 229–233) — implementation record

**Status: this document records real code.** It describes the ACTUAL raw
ChaCha20 stream cipher, HMAC-SHA256 authentication, and complete
verify-HMAC → decrypt-stream → unpad DECRYPT pipeline Stage 229–233
landed — the crypto CORE of a byte-exact "NIP-44 v2 wire-compatible
implementation" (`docs/nip44_wire_implementation_roadmap.md`).

**This is decrypt-direction crypto, not a full wire implementation.** No
base64 encode/decode, no wire payload build/parse, and no
`invalid.decrypt` failure-mode wiring exist yet — see "What remains" at
the end of this document, and `docs/nip44_wire_compatibility_gap.md` for
why none of this crate's NIP-44 code, before or after this stage, may
ever be described as "NIP-44 compatible".

## Stream cipher (Stage 229–230)

[`crypto::nip44_stream_cipher`](../packages/fedos-core-rust/src/crypto/nip44_stream_cipher.rs)
hand-implements RFC 8439 §2.3–2.4's ChaCha20 block function and
keystream-XOR construction — no `chacha20` crate is adopted (no new
`Cargo.toml` dependency was needed or added; the algorithm is pure `u32`
wrapping-arithmetic/rotation/XOR).

- `encrypt_stream_internal(chacha_key: &[u8; 32], chacha_nonce: &[u8; 12],
  plaintext: &[u8]) -> Vec<u8>` and `decrypt_stream_internal(...) ->
  Vec<u8>` — the SAME operation (ChaCha20's keystream XOR is its own
  inverse), exposed as two named entry points for call-site clarity.
- The keystream counter is FIXED at `0` — NIP-44 v2's own convention,
  never caller-selectable.
- **NOT an AEAD.** Never calls, and is never called by,
  `crypto::aead_internal`'s ChaCha20-Poly1305 (Stage 152–154) — that
  primitive folds encryption and authentication into ONE call; NIP-44 v2
  keeps them as two entirely separate steps (`crypto::nip44_hmac`, Stage
  231, computes the separate tag).
- **Vector-verified (Stage 230)**: the sibling `#[cfg(test)]`-only
  [`nip44_stream_cipher_vectors`](../packages/fedos-core-rust/src/crypto/nip44_stream_cipher_vectors.rs)
  module wires all 10 `test-vectors/nip44/nip44-v2.json`
  `valid.encrypt_decrypt` cases: for each, `chacha_key`/`chacha_nonce`
  are derived via `crypto::nip44_message_keys::derive_message_keys_exact_from_bytes_internal`
  (Stage 219–220, UNCHANGED), the plaintext is padded via
  `crypto::nip44_padding::pad_message` (Stage 202–203, UNCHANGED), then
  `encrypt_stream_internal`'s output is compared byte-for-byte against
  the vector's own ciphertext (extracted from its base64 `payload`
  field — see "The test-only base64 decoder" below). All 10 match
  exactly.

## HMAC-SHA256 (Stage 231)

[`crypto::nip44_hmac`](../packages/fedos-core-rust/src/crypto/nip44_hmac.rs)
hand-implements RFC 2104's generic HMAC construction against this
crate's already-adopted `sha2::Sha256` — no `hmac` crate is adopted.

- `compute_hmac_internal(hmac_key: &[u8; 32], nonce: &[u8; 32],
  ciphertext: &[u8]) -> [u8; 32]` computes `HMAC-SHA256(hmac_key, nonce ‖
  ciphertext)` — `docs/nip44_internal_plan.md` §7's exact construction.
  Authenticates `nonce ‖ ciphertext`, NEVER the plaintext directly.
- `verify_hmac_internal(...) -> Nip44HmacVerifyStatus` returns ONLY
  `Verified` or `AuthenticationFailed` — no distinct reason per cause
  (wrong key, wrong nonce, tampered ciphertext, or simply a wrong tag all
  collapse into the same label), per §7's own requirement.
- **Constant-time comparison**: uses `subtle::ConstantTimeEq` — this
  crate's OWN `subtle` dependency, adopted Stage 76 specifically "for a
  future secret-derived byte comparison (e.g. an authentication tag)"
  (per `Cargo.toml`'s own comment) and, as of this stage, finally
  connected to that exact purpose. No new `Cargo.toml` dependency.

## Decrypt pipeline (Stage 232)

[`crypto::nip44_wire_decrypt`](../packages/fedos-core-rust/src/crypto/nip44_wire_decrypt.rs)
composes the pieces above into the complete DECRYPT direction:

```
verify HMAC (crypto::nip44_hmac::verify_hmac_internal)
   │  AuthenticationFailed → stop, return AuthenticationFailed
   ▼
decrypt ChaCha20 stream (crypto::nip44_stream_cipher::decrypt_stream_internal)
   │  (only reached after authentication already succeeded)
   ▼
unpad (crypto::nip44_padding::unpad_message, UNCHANGED)
   │  InvalidLength/InvalidPadding → AuthenticationFailed (same label, never distinct)
   ▼
Ready, with the recovered plaintext
```

- `decrypt_wire_internal(conversation_key: &ConversationKey, nonce: &[u8;
  32], ciphertext: &[u8], mac: &[u8; 32]) -> Nip44WireDecryptDecision` —
  the `ConversationKey`-facing entry point. `conversation_key` MUST be a
  real, `Holding` key; a placeholder or already-`clear()`-ed key is
  rejected with `Nip44WireDecryptStatus::InvalidConversationKey` BEFORE
  any HMAC/ChaCha20 call — a structural precondition, distinct from an
  authentication failure.
- `decrypt_wire_from_bytes_internal(...)` — the byte-level entry point,
  kept `pub(crate)` specifically so vector tests can feed it a raw
  `conversation_key` value with no `sec1`/`pub2` pair required (mirroring
  `crypto::nip44_message_keys`'s own established precedent for the same
  reason).
- **`Nip44WireDecryptStatus` has exactly three variants**: `Ready`,
  `InvalidConversationKey` (a structural precondition), and
  `AuthenticationFailed` (a SINGLE fixed label collapsing every HMAC
  failure and every post-authentication unpad failure — never
  distinguishing which).
- **Vector-verified end-to-end**: the sibling `#[cfg(test)]`-only
  [`nip44_wire_decrypt_vectors`](../packages/fedos-core-rust/src/crypto/nip44_wire_decrypt_vectors.rs)
  module decodes all 10 `valid.encrypt_decrypt` payloads (via the SAME
  test-only base64 decoder pattern `nip44_stream_cipher_vectors`
  established), calls `decrypt_wire_from_bytes_internal`, and confirms
  the recovered plaintext matches the vector's own `plaintext` field
  EXACTLY, for every case. A second test confirms a single tampered MAC
  byte makes every one of the 10 vectors fail with
  `AuthenticationFailed`.

## The test-only base64 decoder (not a production capability)

`nip44_stream_cipher_vectors`/`nip44_wire_decrypt_vectors` each contain a
small, `#[cfg(test)]`-only standard base64 DECODE function, used SOLELY
to unpack `valid.encrypt_decrypt`'s own `payload` fixture field (there is
no other way to recover the vectors' expected ciphertext/MAC bytes for
comparison — that category supplies no separate hex fields). This is
**not** the "base64 payload encoding" `docs/nip44_wire_implementation_roadmap.md`
step 6 still names as a later, separate, unimplemented stage: it is
never `pub`/`pub(crate)`, never reachable from production code, and adds
no `Cargo.toml` dependency — hand-written against `core`/`alloc` only,
mirroring `crypto::ciphertext_serialization`'s own precedent (Stage 186)
of hand-writing base64url without adopting a crate.

## Diagnostics (Stage 233)

`crypto::nip44_wire_diagnostics`'s preview (Stage 227) grows from two
rows to four: `WireCrypto` → `Ready` and `WireAuthentication` → `Ready`
join the unchanged `WireNonce` → `Ready` and `WirePayload` →
`Placeholder` rows. No `CryptoCapability` variant is added and no
existing capability's meaning changes — `capability_matrix`/
`diagnostics` remain exactly as they were (still sixteen variants).

## What remains (per `docs/nip44_wire_implementation_roadmap.md`)

- **Step 6 — base64 payload encoding**: no production base64 encoder/
  decoder exists; no function anywhere in this crate turns a
  `crypto::nip44_wire_payload::Nip44WirePayload` into (or out of) wire
  bytes.
- **Step 7 — invalid vectors**: `test-vectors/nip44/nip44-v2.json`'s
  `invalid.decrypt` category (unknown version, invalid base64, invalid
  MAC/tamper, invalid padding, invalid payload length) is not yet wired
  — this stage only wires `valid.encrypt_decrypt`.
- **An encrypt pipeline** (pad → ChaCha20 encrypt → compute HMAC → build
  a real, non-placeholder `Nip44WirePayload`) — explicitly out of this
  stage's scope (only "wire decrypt" was requested); `crypto::nip44_wire_payload::Nip44WirePayloadBuilder::build_placeholder`
  remains UNCHANGED and still produces `ciphertext: None`/`mac: None`.
- **Step 8 — bridge to Nostr DM** — only after every remaining vector
  category passes; no Runtime/Worker/Storage/Relay/Nostr connection
  exists anywhere in this stage's code.

## See also

- `docs/nip44_wire_implementation_roadmap.md` — steps 4/5 this stage
  implements; steps 6–8 still remaining.
- `docs/nip44_wire_compatibility_gap.md` — the terminology this stage's
  code still respects (no file claims "NIP-44 compatible").
- `docs/nip44_message_key_review.md` / `docs/nip44_wire_nonce_generation.md`
  / `docs/nip44_wire_payload_builder.md` — the earlier building blocks
  this stage's pipeline reuses UNCHANGED.
