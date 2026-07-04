//! Stage 204 — NIP-44 internal encrypt: pad-then-seal, reusing this
//! crate's own ALREADY-REAL ChaCha20-Poly1305 AEAD
//! (`crypto::aead_internal`, Stage 152–154) under the fixed
//! `AeadAadDomain::Conversation` label, keyed by an already-derived
//! `MessageKey` (`crypto::message_key`/`crypto::hkdf_bridge`, Stage
//! 200–201).
//!
//! **This is NOT NIP-44 v2's byte-exact wire cipher.** The real spec
//! (`docs/nip44_internal_plan.md` §6–7) uses unauthenticated ChaCha20 (a
//! stream cipher with no built-in tag) plus a SEPARATE HMAC-SHA256 tag
//! over `nonce concat ciphertext`. This module instead reuses this
//! crate's pre-existing ChaCha20-Poly1305 AEAD construction, which folds
//! authentication into the same primitive rather than a second HMAC step
//! — the same "generic bridge, not the real per-message wire format"
//! choice `crypto::hkdf_bridge` already made for key derivation (Stage
//! 201). This costs zero new `Cargo.toml` dependency (no raw
//! `chacha20`/`hmac` crate is adopted) and reuses already-tested,
//! already-audited code. Byte-exact NIP-44 v2 compatibility (matching
//! `test-vectors/nip44/nip44-v2.json`'s `valid.encrypt_decrypt`/
//! `invalid.decrypt` categories) remains a future, separate,
//! explicitly-reviewed stage.
//!
//! Crate-private only — see `src/crypto.rs`'s module-level doc comment
//! for this module's place in the `crypto` tree.
//!
//! **What this module is NOT**: no ConversationKey-to-MessageKey
//! derivation (the caller supplies an already-derived `&MessageKey`; this
//! module's own tests build one via `crypto::conversation_key`/
//! `crypto::hkdf_bridge` purely as a fixture), no ciphertext envelope (see
//! `crypto::nip44_bridge`, Stage 206), no public API, no Runtime/Worker/
//! Storage/Relay connection.
#![allow(dead_code)]

use super::aead_internal::{seal_internal, AeadAadDomain, AeadCipher, AeadStatus};
use super::message_key::MessageKey;
use super::nip44_padding::{pad_message, PadStatus};
use crate::secret_handle::{SecretHandle, SecretHandleKind};
use crate::FedosAeadNonceDecision;

/// Coarse observable outcome of a [`nip44_encrypt_internal`] call.
/// Crate-private only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Nip44EncryptStatus {
    /// The operation succeeded; `Nip44EncryptDecision::ciphertext` is
    /// `Some` — the sealed, padded plaintext WITH its authentication tag
    /// appended (the same `ciphertext‖tag` convention
    /// `crypto::aead_internal::seal_internal` already uses).
    Ready,
    /// `message_key` held no real bytes (a `crypto::message_key`
    /// placeholder, or an already-`clear()`-ed handle).
    InvalidKey,
    /// The `nonce` decision was not `FedosNonceState::Ready`.
    InvalidNonce,
    /// `plaintext` was empty or longer than 65535 bytes — NIP-44 v2's own
    /// valid plaintext-length bounds (`docs/nip44_internal_plan.md` §5),
    /// checked BEFORE any padding or sealing is attempted.
    InvalidLength,
    /// The underlying padding/AEAD step failed for a reason other than
    /// the above — unreachable in practice for a well-formed call,
    /// matched exhaustively rather than assumed infallible.
    InternalFailure,
}

/// The result of a [`nip44_encrypt_internal`] call. Crate-private only.
pub(crate) struct Nip44EncryptDecision {
    pub(crate) status: Nip44EncryptStatus,
    pub(crate) ciphertext: Option<Vec<u8>>,
}

/// Pad `plaintext` (`crypto::nip44_padding::pad_message`) then seal it
/// under `message_key` and `nonce` (`crypto::aead_internal::seal_internal`,
/// `AeadCipher::ChaCha20Poly1305`, the fixed `AeadAadDomain::Conversation`
/// label) — this crate's own NIP-44-flavored pad-then-encrypt pipeline.
///
/// `message_key` MUST currently hold real bytes (rejected with
/// [`Nip44EncryptStatus::InvalidKey`] otherwise, before any padding or
/// AEAD call). `nonce` MUST be `FedosNonceState::Ready` — the caller MUST
/// have drawn it fresh via `fedos_aead_nonce_96()` and MUST NOT reuse it
/// under the same `message_key`, the same standing obligation
/// `crypto::aead_internal::seal_internal`'s own doc comment already fixes.
/// Does not mutate `message_key`.
pub(crate) fn nip44_encrypt_internal(
    message_key: &MessageKey,
    nonce: &FedosAeadNonceDecision,
    plaintext: &[u8],
) -> Nip44EncryptDecision {
    let key_bytes = match message_key.expose_bytes_for_internal_use() {
        Some(bytes) => bytes,
        None => {
            return Nip44EncryptDecision {
                status: Nip44EncryptStatus::InvalidKey,
                ciphertext: None,
            };
        }
    };

    let pad_decision = pad_message(plaintext);
    if pad_decision.status != PadStatus::Ready {
        return Nip44EncryptDecision {
            status: Nip44EncryptStatus::InvalidLength,
            ciphertext: None,
        };
    }
    let padded = match pad_decision.output {
        Some(buffer) => buffer,
        None => {
            return Nip44EncryptDecision {
                status: Nip44EncryptStatus::InternalFailure,
                ciphertext: None,
            };
        }
    };

    let transient_key = SecretHandle::new_from_32_bytes_for_internal_use(
        SecretHandleKind::AeadKeyMaterial,
        key_bytes,
    );
    let sealed = seal_internal(
        AeadCipher::ChaCha20Poly1305,
        &transient_key,
        nonce,
        AeadAadDomain::Conversation,
        &padded,
    );
    match sealed.status {
        AeadStatus::Ready => Nip44EncryptDecision {
            status: Nip44EncryptStatus::Ready,
            ciphertext: sealed.ciphertext,
        },
        AeadStatus::InvalidNonce => Nip44EncryptDecision {
            status: Nip44EncryptStatus::InvalidNonce,
            ciphertext: None,
        },
        AeadStatus::InvalidKey | AeadStatus::AuthenticationFailed | AeadStatus::InternalFailure => {
            Nip44EncryptDecision {
                status: Nip44EncryptStatus::InternalFailure,
                ciphertext: None,
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::conversation_key::derive_conversation_key_via_ecdh_internal;
    use crate::crypto::hkdf_bridge::derive_message_key_from_conversation_key_internal;
    use crate::secret_handle::SecretHandleKind as SkKind;
    use crate::{fedos_aead_nonce_96, FedosAeadNonceKind, FedosNonceState};

    const TEST_PLAINTEXT: &[u8] = b"fedos NIP-44 internal encrypt test plaintext";

    fn real_message_key() -> MessageKey {
        let secret =
            SecretHandle::new_from_32_bytes_for_internal_use(SkKind::NostrKeyMaterial, [0x51; 32]);
        let public =
            SecretHandle::new_from_32_bytes_for_internal_use(SkKind::NostrKeyMaterial, [0x52; 32]);
        let conversation_key = derive_conversation_key_via_ecdh_internal(&secret, &public)
            .output
            .expect("expected a real conversation key");
        derive_message_key_from_conversation_key_internal(&conversation_key)
            .output
            .expect("expected a real message key")
    }

    fn ready_nonce() -> FedosAeadNonceDecision {
        let decision = fedos_aead_nonce_96();
        assert_eq!(decision.state, FedosNonceState::Ready);
        decision
    }

    #[test]
    fn encrypts_a_well_formed_plaintext() {
        let key = real_message_key();
        let nonce = ready_nonce();
        let decision = nip44_encrypt_internal(&key, &nonce, TEST_PLAINTEXT);
        assert_eq!(decision.status, Nip44EncryptStatus::Ready);
        assert!(decision.ciphertext.is_some());
    }

    #[test]
    fn rejects_placeholder_message_key() {
        let key = MessageKey::new_placeholder();
        let nonce = ready_nonce();
        let decision = nip44_encrypt_internal(&key, &nonce, TEST_PLAINTEXT);
        assert_eq!(decision.status, Nip44EncryptStatus::InvalidKey);
        assert!(decision.ciphertext.is_none());
    }

    #[test]
    fn rejects_cleared_message_key() {
        let mut key = real_message_key();
        key.clear();
        let nonce = ready_nonce();
        let decision = nip44_encrypt_internal(&key, &nonce, TEST_PLAINTEXT);
        assert_eq!(decision.status, Nip44EncryptStatus::InvalidKey);
    }

    #[test]
    fn rejects_empty_plaintext() {
        let key = real_message_key();
        let nonce = ready_nonce();
        let decision = nip44_encrypt_internal(&key, &nonce, &[]);
        assert_eq!(decision.status, Nip44EncryptStatus::InvalidLength);
        assert!(decision.ciphertext.is_none());
    }

    #[test]
    fn rejects_over_max_length_plaintext() {
        let key = real_message_key();
        let nonce = ready_nonce();
        let too_long = vec![0x41u8; 65536];
        let decision = nip44_encrypt_internal(&key, &nonce, &too_long);
        assert_eq!(decision.status, Nip44EncryptStatus::InvalidLength);
    }

    #[test]
    fn rejects_non_ready_nonce() {
        let key = real_message_key();
        let failed_nonce = FedosAeadNonceDecision {
            kind: FedosAeadNonceKind::NinetySixBit,
            state: FedosNonceState::EntropySourceUnavailable,
            nonce: None,
        };
        let decision = nip44_encrypt_internal(&key, &failed_nonce, TEST_PLAINTEXT);
        assert_eq!(decision.status, Nip44EncryptStatus::InvalidNonce);
    }

    #[test]
    fn is_deterministic_for_the_same_key_nonce_and_plaintext() {
        let key = real_message_key();
        let nonce = ready_nonce();
        let first = nip44_encrypt_internal(&key, &nonce, TEST_PLAINTEXT);
        let second = nip44_encrypt_internal(&key, &nonce, TEST_PLAINTEXT);
        assert_eq!(first.ciphertext, second.ciphertext);
    }

    #[test]
    fn ciphertext_length_reflects_padding_plus_tag_overhead() {
        let key = real_message_key();
        let nonce = ready_nonce();
        let decision = nip44_encrypt_internal(&key, &nonce, TEST_PLAINTEXT);
        let ciphertext = decision.ciphertext.expect("Ready must carry ciphertext");
        // 2-byte length prefix + calc_padded_len bytes + 16-byte Poly1305 tag.
        let expected_padded_len =
            2 + super::super::nip44_padding::calc_padded_len(TEST_PLAINTEXT.len());
        assert_eq!(ciphertext.len(), expected_padded_len + 16);
    }
}
