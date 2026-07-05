# NIP-44 v2 wire crypto completion: ChaCha20 + HMAC-SHA256 + decrypt pipeline (Stage 229–233); base64 encoding + invalid vectors + encrypt pipeline (Stage 234–240) — implementation record

**Status: this document records real code.** It describes the ACTUAL raw
ChaCha20 stream cipher, HMAC-SHA256 authentication, complete verify-HMAC
→ decrypt-stream → unpad DECRYPT pipeline (Stage 229–233), real base64
wire payload encoding, `invalid.decrypt` vector wiring, and the complete
ENCRYPT pipeline (Stage 234–240) this crate landed — together, the full
crypto CORE of a byte-exact "NIP-44 v2 wire-compatible implementation"
(`docs/nip44_wire_implementation_roadmap.md`).

**As of Stage 240, the internal NIP-44 v2 wire encrypt/decrypt
implementation is COMPLETE at the crate-internal level** — every
`test-vectors/nip44/nip44-v2.json` category this crate's own roadmap
targeted (`get_conversation_key`, `get_message_keys`,
`calc_padded_len`/`encrypt_msg_lengths`, `valid.encrypt_decrypt`,
`invalid.decrypt`) is wired to `cargo test` and passes. **This is still
NOT connected to Runtime/Worker/Storage/Nostr/Relay, still has no public
API of its own, and `fedos_encrypt`/`fedos_decrypt` (this crate's
existing, unrelated, opaque-handle AEAD API) are completely untouched**
— see "What remains" at the end of this document, and
`docs/nip44_wire_compatibility_gap.md` for why none of this crate's
NIP-44 code, before or after this stage, may ever be described as
"NIP-44 compatible" without that further, separate, explicitly-reviewed
connection work.

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
- **`Nip44WireDecryptStatus` had exactly three variants at Stage 232**:
  `Ready`, `InvalidConversationKey` (a structural precondition), and
  `AuthenticationFailed` (a SINGLE fixed label collapsing every HMAC
  failure and every post-authentication unpad failure — never
  distinguishing which). **Stage 235 adds a fourth, `InvalidPayload`** —
  see that section below.
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

## Wire payload encoding (Stage 234)

[`crypto::nip44_wire_encoding`](../packages/fedos-core-rust/src/crypto/nip44_wire_encoding.rs)
hand-implements STANDARD base64 (RFC 4648 §4, `+`/`/`, `=` padding) — no
`base64` crate is adopted, and this is DELIBERATELY SEPARATE from
`crypto::ciphertext_serialization`'s own base64url codec (Stage 186,
UNCHANGED) — the two are never shared or generalized.

- `encode_wire_payload_internal(nonce: &[u8; 32], ciphertext: &[u8], mac:
  &[u8; 32]) -> String` builds `base64(version_byte (0x02) ‖ nonce ‖
  ciphertext ‖ mac)`. Cannot fail for any input.
- `decode_wire_payload_internal(payload: &str) -> Nip44WireDecodeDecision`
  validates a candidate STRUCTURALLY ONLY: malformed base64 (invalid
  character, wrong length, misplaced padding), too-short decoded length
  (< 65 bytes — not enough for `version ‖ nonce ‖ mac`), or a
  `version_byte` other than `0x02` all collapse into a SINGLE
  `Nip44WireEncodingStatus::InvalidPayload` label. Performs NO
  authentication and NO decryption. Reuses
  `crypto::nip44_wire_payload::Nip44WirePayload` (UNCHANGED, Stage
  225–226) as its own output shape — the second way that type gets
  built, alongside `Nip44WirePayloadBuilder::build_placeholder`'s
  placeholder path.
- **Vector-verified**: the sibling `#[cfg(test)]`-only
  [`nip44_wire_encoding_vectors`](../packages/fedos-core-rust/src/crypto/nip44_wire_encoding_vectors.rs)
  module confirms `decode_wire_payload_internal` extracts the documented
  `nonce` for all 10 `valid.encrypt_decrypt` cases, and that
  re-encoding the decoded fields reproduces each vector's own `payload`
  string EXACTLY.

## `invalid.decrypt` vector wiring (Stage 235)

`crypto::nip44_wire_decrypt` (Stage 232) gains two wire-STRING-facing
entry points, `decrypt_wire_payload_internal`/
`decrypt_wire_payload_from_bytes_internal`, and a fourth
`Nip44WireDecryptStatus` variant, `InvalidPayload` (encoding-level
failures, checked BEFORE any key derivation/HMAC/ChaCha20 call — distinct
from both `InvalidConversationKey` and `AuthenticationFailed`). The
sibling `#[cfg(test)]`-only
[`nip44_wire_decrypt_invalid_vectors`](../packages/fedos-core-rust/src/crypto/nip44_wire_decrypt_invalid_vectors.rs)
module wires ALL 12 `invalid.decrypt` cases (unknown version ×2, invalid
base64, invalid MAC ×2, invalid padding ×3, invalid payload length ×4)
against `decrypt_wire_payload_from_bytes_internal` — every single one
collapses to `InvalidPayload` or `AuthenticationFailed`, never `Ready`,
never a more detailed reason.

## Encrypt pipeline (Stage 236)

[`crypto::nip44_wire_encrypt`](../packages/fedos-core-rust/src/crypto/nip44_wire_encrypt.rs)
composes the complete ENCRYPT direction: derive exact message keys
(Stage 219, UNCHANGED) → pad (Stage 202–203, UNCHANGED) → ChaCha20 stream
encrypt (Stage 229) → HMAC-SHA256 (Stage 231) → encode (Stage 234).

- `encrypt_wire_internal(conversation_key: &ConversationKey, plaintext:
  &[u8]) -> Nip44WireEncryptDecision` is the ONE production entry point
  — it draws its nonce EXCLUSIVELY via
  `crypto::nip44_wire_nonce::generate_wire_nonce_internal` (Stage 224).
  There is NO way to supply a caller-chosen nonce in production.
- `Nip44WireEncryptStatus` has four variants: `Ready`,
  `InvalidConversationKey`, `InvalidPlaintextLength` (mirrors
  `crypto::nip44_padding::pad_message`'s own 1–65535-byte bound), and
  `InternalFailure` (the nonce draw failed).
- A `#[cfg(test)]`-ONLY nonce-accepting variant,
  `encrypt_wire_from_bytes_with_nonce_for_test_internal`, exists SOLELY
  for deterministic vector testing — this item does not exist at all in
  non-test builds.

## Full round-trip vector verification (Stage 237)

The sibling `#[cfg(test)]`-only
[`nip44_wire_encrypt_vectors`](../packages/fedos-core-rust/src/crypto/nip44_wire_encrypt_vectors.rs)
module confirms, for ALL 10 `valid.encrypt_decrypt` cases:

1. `encrypt_wire_from_bytes_with_nonce_for_test_internal`'s output
   matches the vector's own `payload` field EXACTLY.
2. Decoding and decrypting that freshly-encrypted payload recovers the
   documented `plaintext` EXACTLY.
3. Decoding and decrypting the VECTOR'S OWN `payload` string (not just
   our freshly-encrypted one) also recovers the documented `plaintext`
   EXACTLY — closing the full loop against the upstream reference
   vectors, not just against this crate's own output.

This connects Stage 234–236's new code to the already-verified Stage
219–232 pipeline with ZERO changes to any of it.

## Diagnostics (Stage 238)

`crypto::nip44_wire_diagnostics`'s preview grows from four rows to
eight: `WireEncoding`, `WireEncrypt`, `WireDecrypt`, and
`WireInvalidVectors` all report `Ready`. `WireDecrypt` is distinct from
`WireAuthentication` (Stage 233) — the former tracks the wire-STRING-
facing decrypt pipeline (Stage 235) specifically, the latter the
byte-level HMAC/decrypt pipeline (Stage 231–232). Still no
`CryptoCapability` variant added, still no existing capability's
meaning changed.

## The test-only base64 decoders (Stage 230/232) vs. the real one (Stage 234)

`nip44_stream_cipher_vectors`/`nip44_wire_decrypt_vectors` (Stage
230/232) each still carry their OWN small, `#[cfg(test)]`-only standard
base64 DECODE function — left UNCHANGED by Stage 234–240, since they
predate the real production decoder and already pass. Newer vector
modules (`nip44_wire_encoding_vectors`, `nip44_wire_decrypt_invalid_vectors`,
`nip44_wire_encrypt_vectors`, Stage 234–237) use the REAL
`crypto::nip44_wire_encoding::decode_wire_payload_internal`/
`encode_wire_payload_internal` directly instead, needing no test-only
helper of their own. Neither the old test-only helpers nor the new real
codec are reachable from production code beyond `crypto::nip44_wire_encrypt`/
`crypto::nip44_wire_decrypt` themselves, and neither adds a
`Cargo.toml` dependency.

## What remains (per `docs/nip44_wire_implementation_roadmap.md`)

- **Step 8 — bridge to Nostr DM.** This is the ONLY roadmap step left.
  No Runtime/Worker/Storage/Relay/Nostr connection exists anywhere in
  this crate's NIP-44 wire code — `encrypt_wire_internal`/
  `decrypt_wire_internal`/`decrypt_wire_payload_internal` are
  `pub(crate)`-only, called by nothing outside this crate's own test
  suite.
- **No public API.** Whether and how a future public, opaque-handle API
  (mirroring `docs/public_crypto_opaque_handles.md`'s discipline) ever
  exposes this pipeline is not decided here — see
  `docs/nip44_wire_implementation_roadmap.md`'s own "what this roadmap
  does NOT do" section.
- **No connection to `fedos_encrypt`/`fedos_decrypt`.** Those remain
  this crate's existing, unrelated, opaque-handle AEAD API (Stage
  166–176) — untouched, and not extended or overloaded with a NIP-44
  variant by any of this work.
- **`encrypt_decrypt_long_msg`** (SHA-256-checksum-only fixtures, per
  that category's own upstream convention) is not wired — this crate's
  vector wiring covers `valid.encrypt_decrypt`/`invalid.decrypt` (the
  categories with inline plaintext/payload values) only.

## See also

- `docs/nip44_wire_implementation_roadmap.md` — steps 4/5/6/7 this work
  implements; step 8 the only one remaining.
- `docs/nip44_wire_compatibility_gap.md` — the terminology this stage's
  code still respects (no file claims "NIP-44 compatible").
- `docs/nip44_wire_payload_layout.md` — the planning document Stage 234
  implements the real encode/decode of.
- `docs/nip44_message_key_review.md` / `docs/nip44_wire_nonce_generation.md`
  / `docs/nip44_wire_payload_builder.md` — the earlier building blocks
  this pipeline reuses UNCHANGED.
