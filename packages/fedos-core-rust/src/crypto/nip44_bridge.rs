//! Stage 206 — the internal NIP-44 encrypt/decrypt to ciphertext-envelope
//! bridge, mirroring `crypto::aead_envelope_bridge`'s own exact shape
//! (Stage 161–163) but for `crypto::nip44_encrypt`/`crypto::nip44_decrypt`
//! (Stage 204–205) instead of `crypto::aead_internal` directly.
//!
//! Reuses the crate's PRE-EXISTING `ciphertext_envelope::AeadCiphertextEnvelope`
//! type UNCHANGED — no new field, no new variant, no format change of any
//! kind. The fixed `AeadEnvelopeAlgorithm::ChaCha20Poly1305`/
//! `AeadEnvelopeAadDomain::Conversation` labels this module always uses
//! are exactly the ones `crypto::nip44_encrypt`/`crypto::nip44_decrypt`
//! themselves always use internally, so no algorithm/domain mismatch is
//! reachable through this bridge alone.
//!
//! Crate-private only — see `src/crypto.rs`'s module-level doc comment
//! for this module's place in the `crypto` tree.
//!
//! **What this module is NOT**: not `fedos_encrypt`/`fedos_decrypt` (this
//! crate's pre-existing, UNRELATED public AEAD API, Stage 166–176 —
//! neither is called or modified here), no public API, no Runtime/Worker/
//! Storage/Relay connection.
#![allow(dead_code)]

use super::ciphertext_envelope::{
    AeadCiphertextEnvelope, AeadEnvelopeAadDomain, AeadEnvelopeAlgorithm, AeadEnvelopeVersion,
};
use super::message_key::MessageKey;
use super::nip44_decrypt::{nip44_decrypt_internal, Nip44DecryptDecision};
use super::nip44_encrypt::{Nip44EncryptDecision, Nip44EncryptStatus};
use crate::{FedosAeadNonceDecision, FedosAeadNonceKind, FedosNonceState};

/// Build a REAL [`AeadCiphertextEnvelope`] from a completed
/// [`Nip44EncryptDecision`]. Returns `None` if `decision.status` was not
/// `Nip44EncryptStatus::Ready` (there is no ciphertext to carry) — this
/// function performs no encryption itself, it only repackages an
/// ALREADY-sealed result plus the same `nonce` bytes the caller used to
/// produce it.
pub(crate) fn nip44_envelope_from_encrypt_decision_internal(
    decision: Nip44EncryptDecision,
    nonce: [u8; 12],
) -> Option<AeadCiphertextEnvelope> {
    if decision.status != Nip44EncryptStatus::Ready {
        return None;
    }
    let ciphertext = decision.ciphertext?;
    Some(AeadCiphertextEnvelope::new_with_ciphertext_for_internal_use(
        AeadEnvelopeVersion::V1,
        AeadEnvelopeAlgorithm::ChaCha20Poly1305,
        nonce,
        AeadEnvelopeAadDomain::Conversation,
        ciphertext,
    ))
}

/// Open an [`AeadCiphertextEnvelope`] by extracting its nonce/ciphertext
/// and calling `crypto::nip44_decrypt::nip44_decrypt_internal` — the
/// caller supplies only `envelope` and `message_key`, never separately
/// tracks which nonce the envelope used.
pub(crate) fn nip44_decrypt_decision_from_envelope_internal(
    message_key: &MessageKey,
    envelope: &AeadCiphertextEnvelope,
) -> Nip44DecryptDecision {
    let nonce_decision = FedosAeadNonceDecision {
        kind: FedosAeadNonceKind::NinetySixBit,
        state: FedosNonceState::Ready,
        nonce: Some(envelope.nonce()),
    };
    nip44_decrypt_internal(message_key, &nonce_decision, envelope.ciphertext())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::conversation_key::derive_conversation_key_via_ecdh_internal;
    use crate::crypto::hkdf_bridge::derive_message_key_from_conversation_key_internal;
    use crate::crypto::nip44_encrypt::nip44_encrypt_internal;
    use crate::secret_handle::{SecretHandle, SecretHandleKind as SkKind};
    use crate::{fedos_aead_nonce_96, FedosNonceState};

    const TEST_PLAINTEXT: &[u8] = b"fedos NIP-44 envelope bridge test plaintext";

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
        message_key_from_fixture(0x51, 0x52)
    }

    fn ready_nonce() -> FedosAeadNonceDecision {
        let decision = fedos_aead_nonce_96();
        assert_eq!(decision.state, FedosNonceState::Ready);
        decision
    }

    #[test]
    fn encrypt_to_envelope_to_decrypt_round_trips() {
        let key = real_message_key();
        let nonce = ready_nonce();
        let nonce_bytes = nonce.nonce.expect("Ready nonce decision must carry bytes");
        let sealed = nip44_encrypt_internal(&key, &nonce, TEST_PLAINTEXT);

        let envelope = nip44_envelope_from_encrypt_decision_internal(sealed, nonce_bytes)
            .expect("Ready encrypt decision must bridge to an envelope");
        assert_eq!(envelope.algorithm(), AeadEnvelopeAlgorithm::ChaCha20Poly1305);
        assert_eq!(envelope.aad_domain(), AeadEnvelopeAadDomain::Conversation);
        assert_eq!(envelope.nonce(), nonce_bytes);

        let opened = nip44_decrypt_decision_from_envelope_internal(&key, &envelope);
        assert_eq!(opened.status, super::super::nip44_decrypt::Nip44DecryptStatus::Ready);
        assert_eq!(opened.plaintext.as_deref(), Some(TEST_PLAINTEXT));
    }

    #[test]
    fn wrong_key_fails_authentication_through_the_envelope_bridge() {
        let key = real_message_key();
        let wrong_key = message_key_from_fixture(0x61, 0x62);
        let nonce = ready_nonce();
        let nonce_bytes = nonce.nonce.expect("Ready nonce decision must carry bytes");
        let sealed = nip44_encrypt_internal(&key, &nonce, TEST_PLAINTEXT);
        let envelope = nip44_envelope_from_encrypt_decision_internal(sealed, nonce_bytes)
            .expect("Ready encrypt decision must bridge to an envelope");

        let opened = nip44_decrypt_decision_from_envelope_internal(&wrong_key, &envelope);
        assert_eq!(
            opened.status,
            super::super::nip44_decrypt::Nip44DecryptStatus::AuthenticationFailed
        );
        assert!(opened.plaintext.is_none());
    }

    #[test]
    fn a_non_ready_encrypt_decision_does_not_bridge_to_an_envelope() {
        let non_ready_decision = Nip44EncryptDecision {
            status: super::super::nip44_encrypt::Nip44EncryptStatus::InvalidKey,
            ciphertext: None,
        };
        let envelope =
            nip44_envelope_from_encrypt_decision_internal(non_ready_decision, [0x33; 12]);
        assert!(envelope.is_none());
    }
}
