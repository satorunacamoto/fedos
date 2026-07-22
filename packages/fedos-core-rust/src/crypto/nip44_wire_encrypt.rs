//! Stage 236 — the complete NIP-44 v2 wire-compatible ENCRYPT pipeline:
//! derive exact message keys → pad → ChaCha20 stream encrypt →
//! HMAC-SHA256 → encode, in that exact order. Crate-private only — see
//! `src/crypto.rs`'s module-level doc comment for this module's place in
//! the `crypto` tree.
//!
//! ```text
//! ConversationKey
//!    │  derive_message_keys_exact_internal (crypto::nip44_message_keys, Stage 219, UNCHANGED)
//!    ▼
//! chacha_key ‖ chacha_nonce ‖ hmac_key
//!    │  pad_message (crypto::nip44_padding, Stage 202-203, UNCHANGED)
//!    ▼
//! padded plaintext
//!    │  encrypt_stream_internal (crypto::nip44_stream_cipher, Stage 229)
//!    ▼
//! ciphertext
//!    │  compute_hmac_internal (crypto::nip44_hmac, Stage 231)
//!    ▼
//! mac
//!    │  encode_wire_payload_internal (crypto::nip44_wire_encoding, Stage 234)
//!    ▼
//! wire payload string
//! ```
//!
//! [`encrypt_wire_internal`] is the ONE production entry point — it takes
//! ONLY `conversation_key: &ConversationKey` and `plaintext: &[u8]`, and
//! draws its nonce EXCLUSIVELY via
//! `crypto::nip44_wire_nonce::generate_wire_nonce_internal` (Stage 224).
//! There is NO production way to supply a caller-chosen nonce — a
//! nonce-accepting variant exists ONLY behind `#[cfg(test)]`
//! ([`encrypt_wire_from_bytes_with_nonce_for_test_internal`]), for
//! deterministic vector testing (`test-vectors/nip44/nip44-v2.json`'s
//! `valid.encrypt_decrypt` category fixes its own `nonce` per case — see
//! the sibling `#[cfg(test)]`-only `nip44_wire_encrypt_vectors` module,
//! Stage 237).
//!
//! **What this module is NOT**: no decrypt pipeline (see
//! `crypto::nip44_wire_decrypt`), no change to
//! `crypto::conversation_key`/`crypto::message_key`/`crypto::hkdf_bridge`/
//! `crypto::nip44_padding`/`crypto::nip44_wire_nonce`/
//! `crypto::nip44_wire_encoding` (all UNCHANGED), no connection to
//! `crypto::nip44_encrypt`/`nip44_decrypt`/`nip44_bridge` (the Stage
//! 202–206 "FedOS internal NIP-44-like bridge" — unrelated, untouched),
//! no public API, no Runtime/Worker/Storage/Relay/Nostr connection, no
//! new `Cargo.toml` dependency.
#![allow(dead_code)]

use super::conversation_key::ConversationKey;
use super::nip44_hmac::compute_hmac_internal;
use super::nip44_message_keys::{
    derive_message_keys_exact_internal, Nip44DerivedKeyKind, Nip44MessageKeyDecision,
    Nip44MessageKeyStatus,
};
use super::nip44_padding::{pad_message, PadStatus};
use super::nip44_stream_cipher::encrypt_stream_internal;
use super::nip44_wire_encoding::encode_wire_payload_internal;
use super::nip44_wire_nonce::{generate_wire_nonce_internal, Nip44WireNonceStatus};
use zeroize::Zeroize;

/// Coarse observable outcome of an [`encrypt_wire_internal`] call.
/// Crate-private only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Nip44WireEncryptStatus {
    /// Every step succeeded; `Nip44WireEncryptDecision::payload` is
    /// `Some` — the complete wire payload string.
    Ready,
    /// The conversation key held no real bytes (a placeholder path, or
    /// an already-`clear()`-ed handle) — checked BEFORE any padding/
    /// ChaCha20/HMAC call.
    InvalidConversationKey,
    /// `plaintext` was empty or longer than 65535 bytes — NIP-44 v2's
    /// own valid plaintext-length bounds
    /// (`crypto::nip44_padding::pad_message`'s own check), rejected
    /// before any encryption is attempted.
    InvalidPlaintextLength,
    /// The underlying wire nonce draw
    /// (`crypto::nip44_wire_nonce::generate_wire_nonce_internal`) failed
    /// — there is no fallback, no degraded payload. Only reachable via
    /// [`encrypt_wire_internal`] (the `#[cfg(test)]`-only nonce-accepting
    /// variant takes its nonce directly and never draws one).
    InternalFailure,
}

/// The result of an [`encrypt_wire_internal`] call. Crate-private only.
pub(crate) struct Nip44WireEncryptDecision {
    pub(crate) status: Nip44WireEncryptStatus,
    pub(crate) payload: Option<String>,
}

/// Pull kind-matching, `Ready`-status bytes out of a
/// `derive_message_keys_exact_*`-produced triple, converting to a
/// fixed-size array. Returns `None` for anything other than an
/// exact-length `Ready` match — never panics, never `.unwrap()`s.
/// Mirrors `crypto::nip44_wire_decrypt`'s own private helper of the same
/// shape (kept separate rather than shared, per this crate's "no
/// cross-module private helper sharing" convention for `fn`s that are
/// not part of either module's own public-within-crate surface).
///
/// ONLY for `ChachaNonce` since Secure Runtime Alpha 6281-6360 — see
/// [`extract_handle_bytes`] for the two genuinely-secret kinds.
fn extract_fixed_bytes<const N: usize>(
    decisions: &[Nip44MessageKeyDecision; 3],
    kind: Nip44DerivedKeyKind,
) -> Option<[u8; N]> {
    let decision = decisions.iter().find(|d| d.kind == kind)?;
    if decision.status != Nip44MessageKeyStatus::Ready {
        return None;
    }
    decision.bytes.as_deref()?.try_into().ok()
}

/// Secure Runtime Alpha 6281-6360 (FedOS Secure Memory Secret Buffer and
/// Zeroization Foundation Arc) — the `ChachaKey`/`HmacKey` counterpart of
/// [`extract_fixed_bytes`] above: these two are now `SecretHandle`-backed
/// (this file's own Phase A gap closure), so extraction goes through the
/// handle's own narrow `expose_bytes_for_internal_nip44_message_key`
/// accessor instead of `.bytes`. Returns a COPY — the caller
/// (`encrypt_wire_from_key_decisions`) zeroizes it once the one-shot
/// ChaCha20/HMAC call that needs it is done, mirroring every other
/// `expose_bytes_for_internal_*` consumer in this crate.
fn extract_handle_bytes(
    decisions: &[Nip44MessageKeyDecision; 3],
    kind: Nip44DerivedKeyKind,
) -> Option<[u8; 32]> {
    let decision = decisions.iter().find(|d| d.kind == kind)?;
    if decision.status != Nip44MessageKeyStatus::Ready {
        return None;
    }
    decision
        .handle
        .as_ref()?
        .expose_bytes_for_internal_nip44_message_key()
}

fn invalid_conversation_key_decision() -> Nip44WireEncryptDecision {
    Nip44WireEncryptDecision {
        status: Nip44WireEncryptStatus::InvalidConversationKey,
        payload: None,
    }
}

/// The shared pipeline core: pad → ChaCha20 stream encrypt → HMAC-SHA256
/// → encode, given already-derived `chacha_key`/`chacha_nonce`/
/// `hmac_key` decisions and the wire `nonce` those decisions were
/// derived from.
fn encrypt_wire_from_key_decisions(
    key_decisions: &[Nip44MessageKeyDecision; 3],
    nonce: &[u8; 32],
    plaintext: &[u8],
) -> Nip44WireEncryptDecision {
    // Secure Runtime Alpha 6281-6360 — `chacha_nonce` (not confidential)
    // and plaintext padding are both checked BEFORE `chacha_key`/`hmac_key`
    // are ever copied out of their handles, so a padding/nonce-derivation
    // failure never leaves an un-zeroized secret copy on this function's
    // own stack frame on an early-return path.
    let chacha_nonce: [u8; 12] =
        match extract_fixed_bytes(key_decisions, Nip44DerivedKeyKind::ChachaNonce) {
            Some(bytes) => bytes,
            None => return invalid_conversation_key_decision(),
        };

    let padded = match pad_message(plaintext) {
        decision if decision.status == PadStatus::Ready => match decision.output {
            Some(padded) => padded,
            None => {
                return Nip44WireEncryptDecision {
                    status: Nip44WireEncryptStatus::InvalidPlaintextLength,
                    payload: None,
                };
            }
        },
        _ => {
            return Nip44WireEncryptDecision {
                status: Nip44WireEncryptStatus::InvalidPlaintextLength,
                payload: None,
            };
        }
    };

    let mut chacha_key: [u8; 32] =
        match extract_handle_bytes(key_decisions, Nip44DerivedKeyKind::ChachaKey) {
            Some(bytes) => bytes,
            None => return invalid_conversation_key_decision(),
        };
    let mut hmac_key: [u8; 32] =
        match extract_handle_bytes(key_decisions, Nip44DerivedKeyKind::HmacKey) {
            Some(bytes) => bytes,
            None => {
                chacha_key.zeroize();
                return invalid_conversation_key_decision();
            }
        };

    let ciphertext = encrypt_stream_internal(&chacha_key, &chacha_nonce, &padded);
    let mac = compute_hmac_internal(&hmac_key, nonce, &ciphertext);
    let payload = encode_wire_payload_internal(nonce, &ciphertext, &mac);
    // Secure Runtime Alpha 6281-6360 — zeroize this function's own local
    // copies once the one-shot ChaCha20/HMAC calls that needed them are
    // done, mirroring every other `expose_bytes_for_internal_*` consumer's
    // "caller zeroizes its own copy" discipline.
    chacha_key.zeroize();
    hmac_key.zeroize();

    Nip44WireEncryptDecision {
        status: Nip44WireEncryptStatus::Ready,
        payload: Some(payload),
    }
}

/// The ONE production entry point: derives `chacha_key`/`chacha_nonce`/
/// `hmac_key` via
/// `crypto::nip44_message_keys::derive_message_keys_exact_internal`
/// (Stage 219, UNCHANGED), keyed by a FRESH nonce drawn via
/// `crypto::nip44_wire_nonce::generate_wire_nonce_internal` (Stage 224)
/// — never a caller-supplied or deterministic nonce. `conversation_key`
/// MUST be a real, `Holding` `ConversationKey` — a placeholder or
/// already-`clear()`-ed handle is rejected with
/// [`Nip44WireEncryptStatus::InvalidConversationKey`] before any
/// padding/ChaCha20/HMAC call. Does not mutate `conversation_key`.
pub(crate) fn encrypt_wire_internal(
    conversation_key: &ConversationKey,
    plaintext: &[u8],
) -> Nip44WireEncryptDecision {
    let nonce_decision = generate_wire_nonce_internal();
    let nonce = match (nonce_decision.status, nonce_decision.nonce) {
        (Nip44WireNonceStatus::Ready, Some(nonce)) => nonce,
        _ => {
            return Nip44WireEncryptDecision {
                status: Nip44WireEncryptStatus::InternalFailure,
                payload: None,
            };
        }
    };
    let key_decisions = derive_message_keys_exact_internal(conversation_key, &nonce);
    encrypt_wire_from_key_decisions(&key_decisions, &nonce, plaintext)
}

/// A `#[cfg(test)]`-ONLY nonce-accepting variant, taking the conversation
/// key's raw bytes AND an explicit `nonce` directly — there is NO way to
/// reach this function, or any nonce-accepting encrypt path, from
/// production code (this entire item is compiled out of non-test
/// builds). Exists solely so this module's own vector tests
/// (`nip44_wire_encrypt_vectors`, Stage 237) can reproduce
/// `test-vectors/nip44/nip44-v2.json`'s `valid.encrypt_decrypt` category
/// exactly, since that category fixes its own `nonce` per case rather
/// than drawing one at random.
#[cfg(test)]
pub(crate) fn encrypt_wire_from_bytes_with_nonce_for_test_internal(
    conversation_key_bytes: &[u8; 32],
    plaintext: &[u8],
    nonce: &[u8; 32],
) -> Nip44WireEncryptDecision {
    let key_decisions =
        super::nip44_message_keys::derive_message_keys_exact_from_bytes_internal(
            conversation_key_bytes,
            nonce,
        );
    encrypt_wire_from_key_decisions(&key_decisions, nonce, plaintext)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::conversation_key::derive_conversation_key_via_ecdh_internal;
    use crate::crypto::nip44_wire_decrypt::{decrypt_wire_payload_internal, Nip44WireDecryptStatus};
    use crate::secret_handle::{SecretHandle, SecretHandleKind};

    const TEST_PLAINTEXT: &[u8] = b"fedos NIP-44 wire encrypt pipeline test plaintext";

    fn real_conversation_key() -> ConversationKey {
        let secret = SecretHandle::new_from_32_bytes_for_internal_use(
            SecretHandleKind::NostrKeyMaterial,
            [0x33; 32],
        );
        let public = SecretHandle::new_from_32_bytes_for_internal_use(
            SecretHandleKind::NostrKeyMaterial,
            [0x44; 32],
        );
        derive_conversation_key_via_ecdh_internal(&secret, &public)
            .output
            .expect("expected a real conversation key")
    }

    #[test]
    fn encrypt_wire_internal_produces_a_payload_that_decrypts_back_to_the_same_plaintext() {
        let key = real_conversation_key();
        let encrypted = encrypt_wire_internal(&key, TEST_PLAINTEXT);
        assert_eq!(encrypted.status, Nip44WireEncryptStatus::Ready);
        let payload = encrypted.payload.expect("Ready must carry a payload");

        let decision = decrypt_wire_payload_internal(&key, &payload);
        assert_eq!(decision.status, Nip44WireDecryptStatus::Ready);
        assert_eq!(decision.plaintext.as_deref(), Some(TEST_PLAINTEXT));
    }

    #[test]
    fn encrypt_wire_internal_draws_a_fresh_nonce_each_call() {
        let key = real_conversation_key();
        let first = encrypt_wire_internal(&key, TEST_PLAINTEXT);
        let second = encrypt_wire_internal(&key, TEST_PLAINTEXT);
        assert_ne!(first.payload, second.payload);
    }

    #[test]
    fn encrypt_wire_internal_rejects_placeholder_conversation_key() {
        let placeholder = ConversationKey::new_placeholder();
        let decision = encrypt_wire_internal(&placeholder, TEST_PLAINTEXT);
        assert_eq!(decision.status, Nip44WireEncryptStatus::InvalidConversationKey);
        assert!(decision.payload.is_none());
    }

    #[test]
    fn encrypt_wire_internal_rejects_cleared_conversation_key() {
        let mut key = real_conversation_key();
        key.clear();
        let decision = encrypt_wire_internal(&key, TEST_PLAINTEXT);
        assert_eq!(decision.status, Nip44WireEncryptStatus::InvalidConversationKey);
    }

    #[test]
    fn encrypt_wire_internal_rejects_empty_plaintext() {
        let key = real_conversation_key();
        let decision = encrypt_wire_internal(&key, &[]);
        assert_eq!(decision.status, Nip44WireEncryptStatus::InvalidPlaintextLength);
        assert!(decision.payload.is_none());
    }

    #[test]
    fn encrypt_wire_internal_rejects_over_max_length_plaintext() {
        let key = real_conversation_key();
        let too_long = vec![0x41u8; 65536];
        let decision = encrypt_wire_internal(&key, &too_long);
        assert_eq!(decision.status, Nip44WireEncryptStatus::InvalidPlaintextLength);
    }

    #[test]
    fn encrypt_wire_from_bytes_with_nonce_for_test_internal_is_deterministic() {
        let conversation_key_bytes = [0x55u8; 32];
        let nonce = [0x66u8; 32];
        let first = encrypt_wire_from_bytes_with_nonce_for_test_internal(
            &conversation_key_bytes,
            TEST_PLAINTEXT,
            &nonce,
        );
        let second = encrypt_wire_from_bytes_with_nonce_for_test_internal(
            &conversation_key_bytes,
            TEST_PLAINTEXT,
            &nonce,
        );
        assert_eq!(first.payload, second.payload);
    }

    #[test]
    fn nip44_wire_encrypt_status_has_no_variant_other_than_the_four_specified() {
        for status in [
            Nip44WireEncryptStatus::Ready,
            Nip44WireEncryptStatus::InvalidConversationKey,
            Nip44WireEncryptStatus::InvalidPlaintextLength,
            Nip44WireEncryptStatus::InternalFailure,
        ] {
            match status {
                Nip44WireEncryptStatus::Ready => {}
                Nip44WireEncryptStatus::InvalidConversationKey => {}
                Nip44WireEncryptStatus::InvalidPlaintextLength => {}
                Nip44WireEncryptStatus::InternalFailure => {}
            }
        }
    }
}
