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
//! Stage 198–199 add `conversation_key` — a `SecretHandle`-backed
//! `ConversationKey` type with a Stage 198 placeholder path, plus Stage
//! 199's REAL `derive_conversation_key_via_ecdh_internal`: secp256k1 ECDH
//! (manual `k256` `arithmetic`-only point multiplication — no `ecdh`
//! Cargo feature added) followed by HKDF-extract-only (fixed salt
//! `"nip44-v2"`), vector-verified against
//! `test-vectors/nip44/nip44-v2.json`'s `valid`/`invalid .get_conversation_key`
//! categories (43 cases total) by the sibling `#[cfg(test)]`-only
//! `nip44_conversation_key_vectors` module. No message-key derivation, no
//! padding, no NIP-44 encrypt/decrypt, no public API addition, no
//! Runtime/Worker/Storage/Relay connection.
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
#[cfg(test)]
mod nip44_conversation_key_vectors;
#[cfg(test)]
mod nip44_vector_schema;
#[cfg(test)]
mod secp256k1_dependency_guard;
