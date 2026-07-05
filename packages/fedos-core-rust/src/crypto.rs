//! Stage 150–151 — an INTERNAL-ONLY crypto capability matrix + diagnostics
//! preview.
//!
//! NOT part of this crate's public API: this module and both of its
//! children (`capability_matrix`, `diagnostics`) are declared plain `mod`
//! (private, visible only within this crate) with every item inside
//! `pub(crate)` at most — never `pub`, never re-exported from the crate
//! root. Adding this module changes NOTHING about this crate's public
//! `pub fn` surface (still the same twenty-four functions from Stage 138).
//!
//! `capability_matrix` (Stage 150) fixes a label ONLY — `CryptoCapability`,
//! the nine crypto capability names this crate's design tracks (Random,
//! Nonce, SecretHandle, Hkdf, Aead, Nip44, Schnorr, StorageKey,
//! ConversationKey) — no status, no byte, no operation.
//!
//! `diagnostics` (Stage 151) pairs each `CryptoCapability` with a fixed,
//! hand-maintained `CapabilityReadiness` label (`Ready`/`NotConnected`/
//! `NotImplemented`) via `crypto_diagnostics_preview()` — a DISPLAY-ONLY
//! snapshot, never a live probe: it does not call `fedos_random_bytes_32`,
//! `fedos_aead_nonce_96`, `SecretHandle`, `kdf_core`, `aead_core`, or any
//! other crypto function to compute these values; the table is a constant,
//! reviewed BY HAND each stage. No secret byte, key, or any other sensitive
//! value is ever held or displayed by either child module — only the nine
//! fixed capability labels and their fixed readiness labels.
//!
//! Neither child module is wired into the Runtime, the Worker, storage, or
//! Nostr in any way, and `Cargo.toml` is unchanged by this module (it adds
//! no dependency).
//!
//! Stage 152–154 add `aead_internal` — this crate's first REAL AEAD
//! implementation (ChaCha20-Poly1305 + AES-256-GCM), consuming a
//! `SecretHandle(AeadKeyMaterial)` and a `Ready` `FedosAeadNonceDecision`
//! only; see `aead_internal`'s own module-level doc comment for the full
//! design. Stage 155 adds `aead_diagnostics`, a fixed, display-only
//! per-algorithm readiness preview alongside the Stage 151
//! `diagnostics::crypto_diagnostics_preview`, whose own `Aead` row is
//! updated this stage from `NotConnected` to `Ready`. No public API
//! addition, no `Cargo.toml` change, no Runtime/Worker/storage/Nostr/
//! NIP-44/WASM connection.
//!
//! Stage 157–158 add `ciphertext_envelope` — an INTERNAL-ONLY ciphertext
//! envelope (`AeadCiphertextEnvelope`, holding a version/algorithm/
//! AAD-domain label, a real 12-byte nonce, and a ciphertext buffer) plus
//! `validate_envelope_internal`, which validates untrusted candidate
//! field values structurally (no AEAD authentication, no serialization).
//! Its algorithm/AAD-domain labels are deliberately SEPARATE types from
//! `aead_internal`'s own `AeadCipher`/`AeadAadDomain` — see
//! `ciphertext_envelope`'s own module-level doc comment for the full
//! design and `docs/ciphertext_envelope_plan.md` for the planning record.
//!
//! Stage 161–163 add `aead_envelope_bridge` — the ONE reviewed connection
//! point between `aead_internal`'s real seal/open results and
//! `ciphertext_envelope`'s type: `envelope_from_seal_decision_internal`
//! (AEAD → envelope) and `open_decision_from_envelope_internal`
//! (envelope → AEAD), both `pub(crate)`-only. See
//! `aead_envelope_bridge`'s own module-level doc comment for the full
//! design and `docs/ciphertext_envelope_plan.md` section 9 for the
//! planning record this implements.
//!
//! Stage 177–178 add `ciphertext_transport` — an INTERNAL-ONLY,
//! LABEL-ONLY transport descriptor (`CiphertextTransportDescriptor`)
//! naming which algorithm sealed a ciphertext, which future destination
//! (`Storage`/`NostrEvent`) it is headed for, and whether a wire encoding
//! has been chosen (always `Undecided` — no encoding is picked by this
//! skeleton). Deliberately unconnected to `ciphertext_envelope`'s real
//! envelope type, to `aead_internal`'s real cipher labels, and to any
//! `StorageBackend`/Nostr send path — see `ciphertext_transport`'s own
//! module-level doc comment, `docs/ciphertext_envelope_serialization_plan.md`,
//! and `docs/encrypted_payload_storage_boundary.md` for the full design
//! and planning records.
//!
//! Stage 182 updates `ciphertext_transport`'s `CiphertextEncodingPlaceholder`
//! with a second variant, `CanonicalJsonBase64UrlPlaceholder`, recording
//! `docs/ciphertext_serialization_format_decision.md`'s MVP encoding
//! decision (canonical JSON + base64url fields) — still a label only, no
//! encode/decode function, no `serde`/base64 dependency, no `Cargo.toml`
//! change. `Undecided` remains valid; `new_placeholder` now defaults to
//! the new variant, and a new
//! `new_placeholder_with_encoding` constructor lets a caller pick either
//! explicitly.
//!
//! Stage 186 adds `ciphertext_serialization` — the REAL implementation of
//! that Stage 182 decision: `encode_envelope_internal`/
//! `decode_envelope_internal` turn a real `ciphertext_envelope::AeadCiphertextEnvelope`
//! into (and back from) the canonical JSON + base64url wire string, hand-
//! written against the standard library only (`serde`/`serde_json`/`hex`
//! remain `[dev-dependencies]`-only — no `Cargo.toml` change). Both
//! functions stay `pub(crate)`-only; neither is wired to `fedos_encrypt`/
//! `fedos_decrypt`, `aead_envelope_bridge`, or `ciphertext_transport` yet
//! — see `ciphertext_serialization`'s own module-level doc comment and
//! `docs/ciphertext_serialization_format_decision.md` for the full design
//! record.
//!
//! Stage 194–196 adopt `k256` (secp256k1 elliptic-curve arithmetic,
//! `arithmetic` feature only — see `Cargo.toml`'s own comment for the
//! full record, including the reviewed `rand_core` transitive-dependency
//! exception) and add `capability_matrix`'s eleventh `CryptoCapability`,
//! `Ecdh`, reporting `diagnostics`'s new `CapabilityReadiness::ReadyForImplementation`
//! (the dependency exists; zero ECDH code does). `secp256k1_dependency_guard`
//! (`#[cfg(test)]`-only) confirms the resolved build stays exactly this
//! minimal. No ECDH function, no conversation-key derivation, no NIP-44
//! code, no public API addition.
//!
//! Stage 198–201 implement NIP-44's key-derivation half. `conversation_key`
//! (Stage 198–199) adds `ConversationKey` — a `SecretHandle`-backed type
//! with a Stage 198 placeholder path, plus Stage 199's REAL
//! `derive_conversation_key_via_ecdh_internal`: secp256k1 ECDH (manual
//! `k256` `arithmetic`-only point multiplication — no `ecdh` Cargo feature
//! added) followed by HKDF-extract-only (fixed salt `"nip44-v2"`),
//! vector-verified against `test-vectors/nip44/nip44-v2.json`'s
//! `valid`/`invalid .get_conversation_key` categories (43 cases total) by
//! the sibling `#[cfg(test)]`-only `nip44_conversation_key_vectors`
//! module. `message_key` (Stage 200) adds `MessageKey` — the same
//! `SecretHandle`-backed, placeholder-first shape, with zero derivation
//! logic of its own. `hkdf_bridge` (Stage 201) adds the one function that
//! connects them: `derive_message_key_from_conversation_key_internal`,
//! reusing `kdf_core::derive_secret_handle_internal`'s pre-existing,
//! ALREADY-REAL `HkdfDomain::Conversation` — a generic architectural
//! bridge, deliberately NOT NIP-44 v2's real per-message nonce-salted
//! derivation (a future, separate stage). `capability_matrix` gains four
//! more variants (`MessageKey`, `Padding`, `Encrypt`, `Decrypt`);
//! `diagnostics` promotes `Ecdh`/`ConversationKey` to `Ready` and reports
//! `MessageKey` as `Ready`, `Encrypt`/`Decrypt` as `NotConnected`, and
//! `Padding` as `NotImplemented`. No padding, no NIP-44 encrypt/decrypt,
//! no public API addition, no Runtime/Worker/Storage/Relay connection.
//!
//! Stage 202–203 add `nip44_padding` — NIP-44 v2's logarithmic-bucket
//! plaintext padding scheme (`docs/nip44_internal_plan.md` §5):
//! `calc_padded_len` (pure integer arithmetic, no floating point),
//! `pad_message` (a 2-byte big-endian length prefix plus zero-fill),
//! `unpad_message` (the inverse). Vector-verified against
//! `test-vectors/nip44/nip44-v2.json`'s `valid.calc_padded_len` (24 cases)
//! and `invalid.encrypt_msg_lengths` (4 cases) by the sibling
//! `#[cfg(test)]`-only `nip44_padding_vectors` module.
//!
//! Stage 204–206 add `nip44_encrypt`/`nip44_decrypt` — a pad-then-seal /
//! open-then-unpad pipeline keyed by a `MessageKey`, reusing this crate's
//! pre-existing ChaCha20-Poly1305 AEAD (`aead_internal`, Stage 152–154)
//! rather than NIP-44 v2's byte-exact raw-ChaCha20-plus-HMAC-SHA256 wire
//! format — see each module's own doc comment for the full scope note —
//! and `nip44_bridge`, which connects both to the pre-existing, UNCHANGED
//! `ciphertext_envelope::AeadCiphertextEnvelope` type. `nip44_decrypt`
//! collapses every reachable failure cause (wrong key, wrong nonce,
//! tampered ciphertext, invalid tag, malformed post-auth padding) into the
//! single fixed `Nip44DecryptStatus::AuthenticationFailed` label, never
//! distinguishing cause.
//!
//! Stage 207–208 add `capability_matrix`'s sixteenth variant,
//! `Authentication`, tracking `nip44_decrypt`'s single-fixed-label MAC
//! discipline as its own capability; `diagnostics` promotes
//! `Padding`/`Encrypt`/`Decrypt` to `Ready` and reports `Authentication`
//! as `Ready` too — zero `NotConnected` rows remain. The dedicated
//! `#[cfg(test)]`-only `nip44_encrypt_decrypt_guard` module confirms all
//! four Stage 202–206 files stay `pub(crate)`-only, `unsafe`/`unwrap`/
//! `expect`/`panic!`-free, and unconnected to Runtime/Worker/Storage/
//! Relay. No byte-exact NIP-44 wire format, no public API addition, no
//! Runtime/Worker/Storage/Relay connection.
//!
//! Stage 209–213 add `nip44_wire` — a LABEL-ONLY skeleton
//! (`Nip44WireVersion`/`Nip44WirePayloadKind`/`Nip44WireStatus`/
//! `Nip44WireDecision`, always reporting `Unimplemented`) fixing the
//! vocabulary a FUTURE, byte-exact "NIP-44 v2 wire-compatible
//! implementation" would use — deliberately separate from, and NOT a
//! replacement for, the Stage 202–206 `nip44_padding`/`nip44_encrypt`/
//! `nip44_decrypt`/`nip44_bridge` bridge (which stays exactly as it was,
//! still reporting `Ready`). See `docs/nip44_wire_compatibility_gap.md`
//! for that existing bridge's own forbidden/required terminology list
//! and `docs/nip44_wire_implementation_roadmap.md` for the proposed path
//! to a real wire-compatible pipeline. No NIP-44 v2 wire encrypt/decrypt,
//! no base64, no HMAC-SHA256, no raw ChaCha20 stream cipher, no
//! `capability_matrix`/`diagnostics` change, no public API addition, no
//! Runtime/Worker/Storage/Relay connection, no new `Cargo.toml`
//! dependency.
//!
//! Stage 214–218 ("NIP-44 v2 exact wire preparation") add
//! `nip44_message_keys` — a LABEL-ONLY skeleton
//! (`Nip44DerivedKeyKind`/`Nip44MessageKeyStatus`/
//! `Nip44MessageKeyDecision`/`derive_message_keys_exact_placeholder`,
//! always reporting `Placeholder`) naming the three per-message values
//! (`chacha_key`/`chacha_nonce`/`hmac_key`) `docs/nip44_message_key_review.md`
//! confirms byte-for-byte against `test-vectors/nip44/nip44-v2.json`'s
//! `valid.get_message_keys` category — HKDF-Expand(PRK =
//! `conversation_key`, info = `nonce`, L = 76), NOT a second extract, NOT
//! this crate's currently-implemented `hkdf_bridge` (which uses a FIXED
//! domain info/salt and produces one 32-byte `MessageKey`, not this
//! three-way 76-byte split). `docs/nip44_wire_nonce.md` and
//! `docs/nip44_wire_payload_layout.md` review the 32-byte per-message
//! nonce and the fixed wire field order/lengths respectively — docs only,
//! no serialize/deserialize code.
//!
//! Stage 219 replaces `nip44_message_keys`'s label-only skeleton with the
//! REAL derivation `docs/nip44_message_key_review.md` reviewed:
//! `derive_message_keys_exact_internal` (the `ConversationKey`-facing
//! entry point) and `derive_message_keys_exact_from_bytes_internal` (a
//! lower-level pure-bytes engine, kept `pub(crate)` for the sibling
//! vector-verification module below). `Nip44MessageKeyStatus` drops its
//! Stage 217 `Placeholder` variant for `Ready`/`InvalidConversationKey`/
//! `InternalFailure`. Still no ChaCha20 stream-cipher call, no
//! HMAC-SHA256 call, no base64, no wire payload/serialization, no change
//! to `crypto::conversation_key`/`crypto::message_key`/
//! `crypto::hkdf_bridge` (all three remain UNCHANGED), no
//! `capability_matrix`/`diagnostics` capability-count change (still
//! sixteen variants), no public API addition, no Runtime/Worker/Storage/
//! Relay connection, no new `Cargo.toml` dependency.
//!
//! Stage 220 adds the sibling `#[cfg(test)]`-only `nip44_message_key_vectors`
//! module, wiring ALL 32 `test-vectors/nip44/nip44-v2.json`
//! `valid.get_message_keys` cases against
//! `derive_message_keys_exact_from_bytes_internal` — every `chacha_key`/
//! `chacha_nonce`/`hmac_key` matches byte-for-byte. This category's
//! fixture supplies a raw `conversation_key` with no corresponding
//! `sec1`/`pub2` pair anywhere in `valid.get_conversation_key`, hence the
//! byte-level entry point (see `nip44_message_keys`'s own module-level
//! doc comment for the full record).
//!
//! Stage 224 adds `nip44_wire_nonce` — real NIP-44 v2 wire nonce
//! generation (`generate_wire_nonce_internal`, exactly 32 CSPRNG bytes
//! via `getrandom::fill`), COMPLETELY INDEPENDENT of this crate's own
//! pre-existing `fedos_aead_nonce_96`/`FedosAeadNonceDecision` (Stage
//! 138) — deliberately not shared or generalized, per
//! `docs/nip44_wire_nonce.md` (Stage 215).
//!
//! Stage 225–226 add `nip44_wire_payload` — a wire payload SKELETON
//! builder (`Nip44WirePayloadBuilder::build_placeholder`: real `version`/
//! `nonce`, placeholder-only `ciphertext`/`mac`) and its
//! structural-only validator (`validate_wire_payload_placeholder`:
//! version tag, nonce length, ciphertext/mac presence — no
//! authentication, no decryption, no base64). Calling the validator
//! against the builder's own output correctly reports `MissingField`
//! (ciphertext/mac are still absent) — this module names what
//! "wire-valid" will mean once a later stage wires real ChaCha20/HMAC
//! code, it does not pretend today's skeleton already satisfies it.
//!
//! Stage 227 adds `nip44_wire_diagnostics` — a SEPARATE, fixed,
//! display-only two-row preview (`WireNonce` → `Ready`, `WirePayload` →
//! `Placeholder`), mirroring `aead_diagnostics`'s own "per-feature detail
//! preview alongside the main table" shape (Stage 155). It does NOT add
//! a `CryptoCapability` variant and does NOT change any existing
//! capability's meaning or readiness — `capability_matrix`/`diagnostics`
//! stay exactly as they were (still sixteen variants).
//!
//! Stage 229 adds `nip44_stream_cipher` — the real, byte-exact NIP-44 v2
//! raw ChaCha20 stream cipher (RFC 8439 §2.3–2.4, hand-implemented, no
//! `chacha20` crate adopted), `encrypt_stream_internal`/
//! `decrypt_stream_internal`, keyed by `chacha_key`/`chacha_nonce` only,
//! counter fixed at `0`. NOT an AEAD — never calls, and is never called
//! by, `crypto::aead_internal`'s ChaCha20-Poly1305. Vector-verified by
//! the sibling `#[cfg(test)]`-only `nip44_stream_cipher_vectors` module
//! (Stage 230) against `test-vectors/nip44/nip44-v2.json`'s
//! `valid.encrypt_decrypt` category's ciphertext bytes.
//!
//! Stage 231 adds `nip44_hmac` — the real NIP-44 v2 HMAC-SHA256
//! authentication step (RFC 2104, hand-implemented against this crate's
//! already-adopted `sha2` dependency, no `hmac` crate adopted),
//! `compute_hmac_internal`/`verify_hmac_internal` (`HMAC-SHA256(hmac_key,
//! nonce ‖ ciphertext)`), using `subtle::ConstantTimeEq` for the tag
//! comparison — this crate's own `subtle` dependency (adopted Stage 76
//! "for a future secret-derived byte comparison", per `Cargo.toml`'s own
//! comment), finally connected to that exact purpose.
//! `verify_hmac_internal` returns only `Verified`/`AuthenticationFailed`
//! — no more detailed reason.
//!
//! Stage 232 adds `nip44_wire_decrypt` — the complete NIP-44 v2
//! wire-compatible DECRYPT pipeline: verify HMAC (Stage 231) →
//! decrypt ChaCha20 stream (Stage 229) → unpad
//! (`crypto::nip44_padding`, Stage 202–203, UNCHANGED), in that exact
//! order, collapsing every reachable failure into a single fixed
//! `Nip44WireDecryptStatus::AuthenticationFailed` label. Vector-verified
//! end-to-end by the sibling `#[cfg(test)]`-only `nip44_wire_decrypt_vectors`
//! module against ALL 10 `valid.encrypt_decrypt` cases — every recovered
//! plaintext matches exactly.
//!
//! Stage 233 extends `nip44_wire_diagnostics`'s preview from two rows to
//! four: `WireCrypto` → `Ready` (`crypto::nip44_stream_cipher`) and
//! `WireAuthentication` → `Ready` (`crypto::nip44_hmac`/
//! `crypto::nip44_wire_decrypt`), alongside the unchanged `WireNonce` →
//! `Ready` and `WirePayload` → `Placeholder` rows. Still no
//! `CryptoCapability` variant added, still no existing capability's
//! meaning changed — `capability_matrix`/`diagnostics` remain exactly as
//! they were (still sixteen variants).
//!
//! Stage 234 adds `nip44_wire_encoding` — the real NIP-44 v2 wire payload
//! encoding, `base64(version_byte ‖ nonce ‖ ciphertext ‖ mac)`, STANDARD
//! base64 (hand-implemented, no `base64` crate adopted) — deliberately
//! SEPARATE from `crypto::ciphertext_serialization`'s own base64url
//! codec (Stage 186, UNCHANGED), never shared or generalized.
//! `decode_wire_payload_internal` validates structurally only (base64
//! well-formedness, minimum length, version byte), reusing
//! `crypto::nip44_wire_payload::Nip44WirePayload` (UNCHANGED) as its
//! output shape.
//!
//! Stage 235 extends `nip44_wire_decrypt` with `decrypt_wire_payload_internal`/
//! `decrypt_wire_payload_from_bytes_internal` — decode (Stage 234) then
//! the existing Stage 232 pipeline — and a fourth
//! `Nip44WireDecryptStatus` variant, `InvalidPayload`, for encoding-level
//! failures (checked before any key derivation/HMAC call). Vector-
//! verified by the sibling `#[cfg(test)]`-only
//! `nip44_wire_decrypt_invalid_vectors` module against ALL 12
//! `invalid.decrypt` cases — every one collapses to `InvalidPayload` or
//! `AuthenticationFailed`, never a more detailed reason.
//!
//! Stage 236 adds `nip44_wire_encrypt` — the complete NIP-44 v2
//! wire-compatible ENCRYPT pipeline: derive exact message keys (Stage
//! 219) → pad (Stage 202–203, UNCHANGED) → ChaCha20 stream encrypt
//! (Stage 229) → HMAC-SHA256 (Stage 231) → encode (Stage 234).
//! `encrypt_wire_internal` is the ONE production entry point, drawing its
//! nonce ONLY via `crypto::nip44_wire_nonce::generate_wire_nonce_internal`
//! (Stage 224); a nonce-accepting variant exists ONLY behind
//! `#[cfg(test)]`, for deterministic vector testing.
//!
//! Stage 237 adds the sibling `#[cfg(test)]`-only `nip44_wire_encrypt_vectors`
//! module: ALL 10 `valid.encrypt_decrypt` cases' encrypted payload
//! strings match the vectors' own `payload` field EXACTLY, and
//! decoding+decrypting each reproduces the documented plaintext exactly
//! — full round-trip, connecting Stage 234–236's new code to the
//! existing Stage 219–232 pipeline with zero changes to any of it.
//!
//! Stage 238 extends `nip44_wire_diagnostics`'s preview from four rows to
//! eight: `WireEncoding`/`WireEncrypt`/`WireDecrypt`/`WireInvalidVectors`
//! all report `Ready`. Still no `CryptoCapability` variant added, still
//! no existing capability's meaning changed.
#![allow(dead_code)]

pub(crate) mod aead_diagnostics;
pub(crate) mod aead_envelope_bridge;
pub(crate) mod aead_internal;
pub(crate) mod capability_matrix;
pub(crate) mod ciphertext_envelope;
pub(crate) mod ciphertext_serialization;
pub(crate) mod ciphertext_transport;
pub(crate) mod conversation_key;
pub(crate) mod diagnostics;
pub(crate) mod hkdf_bridge;
pub(crate) mod message_key;
pub(crate) mod nip44_bridge;
pub(crate) mod nip44_decrypt;
pub(crate) mod nip44_encrypt;
pub(crate) mod nip44_hmac;
pub(crate) mod nip44_message_keys;
pub(crate) mod nip44_padding;
pub(crate) mod nip44_stream_cipher;
pub(crate) mod nip44_wire;
pub(crate) mod nip44_wire_decrypt;
pub(crate) mod nip44_wire_diagnostics;
pub(crate) mod nip44_wire_encoding;
pub(crate) mod nip44_wire_encrypt;
pub(crate) mod nip44_wire_nonce;
pub(crate) mod nip44_wire_payload;
#[cfg(test)]
mod nip44_conversation_key_vectors;
#[cfg(test)]
mod nip44_encrypt_decrypt_guard;
#[cfg(test)]
mod nip44_key_derivation_guard;
#[cfg(test)]
mod nip44_message_key_vectors;
#[cfg(test)]
mod nip44_padding_vectors;
#[cfg(test)]
mod nip44_stream_cipher_vectors;
#[cfg(test)]
mod nip44_wire_decrypt_invalid_vectors;
#[cfg(test)]
mod nip44_wire_decrypt_vectors;
#[cfg(test)]
mod nip44_wire_encoding_vectors;
#[cfg(test)]
mod nip44_wire_encrypt_vectors;
#[cfg(test)]
mod nip44_vector_schema;
#[cfg(test)]
mod secp256k1_dependency_guard;
