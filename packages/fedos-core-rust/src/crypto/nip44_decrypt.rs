//! Stage 205 — NIP-44 internal decrypt: open-then-unpad, the inverse of
//! `crypto::nip44_encrypt` (Stage 204) — the same "generic AEAD bridge,
//! not NIP-44 v2's byte-exact wire cipher" scope note applies here; see
//! that module's own doc comment for the full record.
//!
//! **Authentication discipline (`docs/nip44_internal_plan.md` §7)**: a
//! SINGLE fixed [`Nip44DecryptStatus::AuthenticationFailed`] label covers
//! EVERY decrypt failure cause reachable once `message_key`/`nonce` are
//! well-formed — a wrong key, a wrong nonce, a tampered ciphertext, an
//! invalid MAC (`crypto::aead_internal::open_internal`'s own
//! constant-time Poly1305 tag check), AND a structurally malformed
//! padded plaintext discovered by `crypto::nip44_padding::unpad_message`
//! AFTER authentication already succeeded — never a distinct label per
//! cause, mirroring `AeadStatus::AuthenticationFailed`'s own "one label,
//! never distinguishing WHY" discipline and RFC 8439/NIST AEAD guidance
//! against side-channel-revealing error differentiation. Because
//! `open_internal`'s own tag verification runs BEFORE this module's
//! unpad step ever executes, an adversarial input can only ever reach
//! the unpad step by first passing authentication — so the unpad check
//! itself never becomes an independently exploitable oracle.
//!
//! Crate-private only — see `src/crypto.rs`'s module-level doc comment
//! for this module's place in the `crypto` tree.
//!
//! **What this module is NOT**: no ciphertext envelope (see
//! `crypto::nip44_bridge`, Stage 206), no public API, no Runtime/Worker/
//! Storage/Relay connection.
#![allow(dead_code)]

use super::aead_internal::{open_internal, AeadAadDomain, AeadCipher, AeadStatus};
use super::message_key::MessageKey;
use super::nip44_padding::{unpad_message, PadStatus};
use crate::secret_handle::{SecretHandle, SecretHandleKind};
use crate::FedosAeadNonceDecision;

/// Coarse observable outcome of a [`nip44_decrypt_internal`] call.
/// Crate-private only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Nip44DecryptStatus {
    /// The operation succeeded; `Nip44DecryptDecision::plaintext` is
    /// `Some` — the original, unpadded plaintext.
    Ready,
    /// `message_key` held no real bytes (a `crypto::message_key`
    /// placeholder, or an already-`clear()`-ed handle).
    InvalidKey,
    /// The `nonce` decision was not `FedosNonceState::Ready`.
    InvalidNonce,
    /// Authentication or unpadding failed — a SINGLE fixed label covering
    /// every distinct cause (see this module's own doc comment above).
    AuthenticationFailed,
    /// The underlying AEAD step failed for a reason other than the
    /// above — unreachable in practice, matched exhaustively rather than
    /// assumed infallible.
    InternalFailure,
}

/// The result of a [`nip44_decrypt_internal`] call. Crate-private only.
pub(crate) struct Nip44DecryptDecision {
    pub(crate) status: Nip44DecryptStatus,
    pub(crate) plaintext: Option<Vec<u8>>,
}

/// Open `ciphertext` (as produced by `crypto::nip44_encrypt::nip44_encrypt_internal`)
/// under `message_key`/`nonce`/the fixed `AeadAadDomain::Conversation`
/// label, then unpad the result. Must be the EXACT SAME `message_key` and
/// `nonce` used to encrypt it, or this returns
/// [`Nip44DecryptStatus::AuthenticationFailed`]. Does not mutate
/// `message_key`.
pub(crate) fn nip44_decrypt_internal(
    message_key: &MessageKey,
    nonce: &FedosAeadNonceDecision,
    ciphertext: &[u8],
) -> Nip44DecryptDecision {
    let key_bytes = match message_key.expose_bytes_for_internal_use() {
        Some(bytes) => bytes,
        None => {
            return Nip44DecryptDecision {
                status: Nip44DecryptStatus::InvalidKey,
                plaintext: None,
            };
        }
    };

    let transient_key = SecretHandle::new_from_32_bytes_for_internal_use(
        SecretHandleKind::AeadKeyMaterial,
        key_bytes,
    );
    let opened = open_internal(
        AeadCipher::ChaCha20Poly1305,
        &transient_key,
        nonce,
        AeadAadDomain::Conversation,
        ciphertext,
    );

    let padded = match opened.status {
        AeadStatus::Ready => match opened.plaintext {
            Some(bytes) => bytes,
            None => {
                return Nip44DecryptDecision {
                    status: Nip44DecryptStatus::InternalFailure,
                    plaintext: None,
                };
            }
        },
        AeadStatus::InvalidNonce => {
            return Nip44DecryptDecision {
                status: Nip44DecryptStatus::InvalidNonce,
                plaintext: None,
            };
        }
        AeadStatus::AuthenticationFailed => {
            return Nip44DecryptDecision {
                status: Nip44DecryptStatus::AuthenticationFailed,
                plaintext: None,
            };
        }
        AeadStatus::InvalidKey | AeadStatus::InternalFailure => {
            return Nip44DecryptDecision {
                status: Nip44DecryptStatus::InternalFailure,
                plaintext: None,
            };
        }
    };

    let unpadded = unpad_message(&padded);
    match unpadded.status {
        PadStatus::Ready => match unpadded.output {
            Some(plaintext) => Nip44DecryptDecision {
                status: Nip44DecryptStatus::Ready,
                plaintext: Some(plaintext),
            },
            None => Nip44DecryptDecision {
                status: Nip44DecryptStatus::InternalFailure,
                plaintext: None,
            },
        },
        // A structurally malformed padded plaintext AFTER successful AEAD
        // authentication collapses into the SAME `AuthenticationFailed`
        // label, never a distinct one — see this module's own doc comment
        // above.
        PadStatus::InvalidLength | PadStatus::InvalidPadding => Nip44DecryptDecision {
            status: Nip44DecryptStatus::AuthenticationFailed,
            plaintext: None,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::aead_internal::{seal_internal, AeadCipher as RawAeadCipher};
    use crate::crypto::conversation_key::derive_conversation_key_via_ecdh_internal;
    use crate::crypto::hkdf_bridge::derive_message_key_from_conversation_key_internal;
    use crate::crypto::nip44_encrypt::{nip44_encrypt_internal, Nip44EncryptStatus};
    use crate::secret_handle::SecretHandleKind as SkKind;
    use crate::{fedos_aead_nonce_96, FedosNonceState};

    const TEST_PLAINTEXT: &[u8] = b"fedos NIP-44 internal decrypt test plaintext";

    fn message_key_from_fixture(secret_byte: u8, public_byte: u8) -> MessageKey {
        let secret = SecretHandle::new_from_32_bytes_for_internal_use(
            SkKind::NostrKeyMaterial,
            [secret_byte; 32],
        );
        let public = SecretHandle::new_from_32_bytes_for_internal_use(
            SkKind::NostrKeyMaterial,
            [public_byte; 32],
        );
        let conversation_key = derive_conversation_key_via_ecdh_internal(&secret, &public)
            .output
            .expect("expected a real conversation key");
        derive_message_key_from_conversation_key_internal(&conversation_key)
            .output
            .expect("expected a real message key")
    }

    fn real_message_key() -> MessageKey {
        message_key_from_fixture(0x61, 0x62)
    }

    fn other_message_key() -> MessageKey {
        message_key_from_fixture(0x71, 0x72)
    }

    fn ready_nonce() -> FedosAeadNonceDecision {
        let decision = fedos_aead_nonce_96();
        assert_eq!(decision.state, FedosNonceState::Ready);
        decision
    }

    #[test]
    fn decrypts_a_round_tripped_ciphertext() {
        let key = real_message_key();
        let nonce = ready_nonce();
        let sealed = nip44_encrypt_internal(&key, &nonce, TEST_PLAINTEXT);
        assert_eq!(sealed.status, Nip44EncryptStatus::Ready);
        let ciphertext = sealed.ciphertext.expect("Ready must carry ciphertext");

        let decision = nip44_decrypt_internal(&key, &nonce, &ciphertext);
        assert_eq!(decision.status, Nip44DecryptStatus::Ready);
        assert_eq!(decision.plaintext.as_deref(), Some(TEST_PLAINTEXT));
    }

    #[test]
    fn rejects_placeholder_message_key() {
        let key = MessageKey::new_placeholder();
        let nonce = ready_nonce();
        let decision = nip44_decrypt_internal(&key, &nonce, &[0u8; 48]);
        assert_eq!(decision.status, Nip44DecryptStatus::InvalidKey);
        assert!(decision.plaintext.is_none());
    }

    #[test]
    fn rejects_cleared_message_key() {
        let mut key = real_message_key();
        let nonce = ready_nonce();
        let sealed = nip44_encrypt_internal(&key, &nonce, TEST_PLAINTEXT);
        let ciphertext = sealed.ciphertext.expect("Ready must carry ciphertext");
        key.clear();
        let decision = nip44_decrypt_internal(&key, &nonce, &ciphertext);
        assert_eq!(decision.status, Nip44DecryptStatus::InvalidKey);
    }

    #[test]
    fn wrong_key_fails_authentication() {
        let key = real_message_key();
        let wrong_key = other_message_key();
        let nonce = ready_nonce();
        let sealed = nip44_encrypt_internal(&key, &nonce, TEST_PLAINTEXT);
        let ciphertext = sealed.ciphertext.expect("Ready must carry ciphertext");

        let decision = nip44_decrypt_internal(&wrong_key, &nonce, &ciphertext);
        assert_eq!(decision.status, Nip44DecryptStatus::AuthenticationFailed);
        assert!(decision.plaintext.is_none());
    }

    #[test]
    fn wrong_nonce_fails_authentication() {
        let key = real_message_key();
        let seal_nonce = ready_nonce();
        let sealed = nip44_encrypt_internal(&key, &seal_nonce, TEST_PLAINTEXT);
        let ciphertext = sealed.ciphertext.expect("Ready must carry ciphertext");

        let different_nonce = ready_nonce();
        assert_ne!(different_nonce.nonce, seal_nonce.nonce);
        let decision = nip44_decrypt_internal(&key, &different_nonce, &ciphertext);
        assert_eq!(decision.status, Nip44DecryptStatus::AuthenticationFailed);
    }

    #[test]
    fn tampered_ciphertext_fails_authentication() {
        let key = real_message_key();
        let nonce = ready_nonce();
        let sealed = nip44_encrypt_internal(&key, &nonce, TEST_PLAINTEXT);
        let mut ciphertext = sealed.ciphertext.expect("Ready must carry ciphertext");
        ciphertext[0] ^= 0xFF;

        let decision = nip44_decrypt_internal(&key, &nonce, &ciphertext);
        assert_eq!(decision.status, Nip44DecryptStatus::AuthenticationFailed);
    }

    #[test]
    fn malformed_padding_after_successful_authentication_still_reports_authentication_failed() {
        // Bypass `nip44_padding::pad_message` and seal a structurally
        // invalid padded buffer directly, using the SAME key/nonce this
        // module's own `nip44_encrypt_internal` would use — proving unpad
        // failures never surface as a distinct label from an AEAD tag
        // failure.
        let key = real_message_key();
        let nonce = ready_nonce();
        let key_bytes = key
            .expose_bytes_for_internal_use()
            .expect("expected real bytes");
        let transient = SecretHandle::new_from_32_bytes_for_internal_use(
            SkKind::AeadKeyMaterial,
            key_bytes,
        );
        let malformed_padded = vec![0xFFu8; 10];
        let sealed = seal_internal(
            RawAeadCipher::ChaCha20Poly1305,
            &transient,
            &nonce,
            AeadAadDomain::Conversation,
            &malformed_padded,
        );
        let ciphertext = sealed.ciphertext.expect("Ready must carry ciphertext");

        let decision = nip44_decrypt_internal(&key, &nonce, &ciphertext);
        assert_eq!(decision.status, Nip44DecryptStatus::AuthenticationFailed);
        assert!(decision.plaintext.is_none());
    }

    #[test]
    fn rejects_non_ready_nonce() {
        let key = real_message_key();
        let failed_nonce = FedosAeadNonceDecision {
            kind: crate::FedosAeadNonceKind::NinetySixBit,
            state: FedosNonceState::EntropySourceUnavailable,
            nonce: None,
        };
        let decision = nip44_decrypt_internal(&key, &failed_nonce, &[0u8; 48]);
        assert_eq!(decision.status, Nip44DecryptStatus::InvalidNonce);
    }
}
