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
//! envelope SKELETON (`AeadCiphertextEnvelope`, holding a version/
//! algorithm/AAD-domain label, a real 12-byte nonce, and a fixed,
//! non-secret ciphertext PLACEHOLDER — never real ciphertext) plus
//! `validate_envelope_internal`, which validates untrusted candidate
//! field values structurally (no AEAD authentication, no serialization).
//! Deliberately unconnected from `aead_internal`'s real `AeadCipher`/
//! `AeadAadDomain` types — see `ciphertext_envelope`'s own module-level
//! doc comment for the full design and
//! `docs/ciphertext_envelope_plan.md` for the planning record.
#![allow(dead_code)]

pub(crate) mod aead_diagnostics;
pub(crate) mod aead_internal;
pub(crate) mod capability_matrix;
pub(crate) mod ciphertext_envelope;
pub(crate) mod diagnostics;
