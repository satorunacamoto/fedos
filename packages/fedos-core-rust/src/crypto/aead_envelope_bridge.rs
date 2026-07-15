//! Stage 161–163 — the internal AEAD ↔ ciphertext-envelope bridge.
//! Crate-private only — see `src/crypto.rs`'s module-level doc comment
//! for this module's place in the `crypto` tree.
//!
//! [`envelope_from_seal_decision_internal`] (Stage 161) converts a
//! `super::aead_internal::AeadSealDecision` (this crate's real AEAD seal
//! result) into a real `super::ciphertext_envelope::AeadCiphertextEnvelope`
//! — the ONE place `AeadCipher`/`AeadAadDomain` (from `aead_internal`) are
//! mapped onto their deliberately-separate `AeadEnvelopeAlgorithm`/
//! `AeadEnvelopeAadDomain` siblings (from `ciphertext_envelope`).
//!
//! [`open_decision_from_envelope_internal`] (Stage 162) does the reverse:
//! given an envelope and a key `SecretHandle`, it extracts the
//! algorithm/nonce/AAD-domain/ciphertext already carried by the envelope
//! and calls `aead_internal::open_internal` — the caller never has to
//! separately track which algorithm/nonce/domain a given envelope used,
//! that is the entire point of an envelope.
//!
//! Stage 163 (this module's own test suite) completes the misuse-guard
//! coverage END TO END through both bridge directions: a full seal →
//! envelope → open round trip for both ciphers, a wrong key (kind or
//! cleared), a wrong/mismatched nonce, a wrong AAD domain, a tampered
//! ciphertext, and — specifically for this module — a Stage 157–158
//! SKELETON (placeholder-ciphertext) envelope being rejected by the real
//! open bridge rather than silently mishandled.
//!
//! Not part of this crate's public API: both functions are `pub(crate)`
//! only — see `src/lib.rs`'s `pub fn fedos_encrypt`/`fedos_decrypt`
//! (Stage 166–167) for the actual public boundary that calls into this
//! bridge, never re-exporting it directly. No serialization, no
//! Runtime/Worker/storage/Nostr connection, no `Cargo.toml` change.
#![allow(dead_code)]

use super::aead_internal::{
    open_internal, AeadAadDomain, AeadCipher, AeadOpenDecision, AeadSealDecision, AeadStatus,
};
use super::ciphertext_envelope::{
    AeadCiphertextEnvelope, AeadEnvelopeAadDomain, AeadEnvelopeAlgorithm, AeadEnvelopeVersion,
};
use crate::secret_handle::SecretHandle;
use crate::FedosAeadNonceDecision;

fn cipher_to_envelope_algorithm(algorithm: AeadCipher) -> AeadEnvelopeAlgorithm {
    match algorithm {
        AeadCipher::ChaCha20Poly1305 => AeadEnvelopeAlgorithm::ChaCha20Poly1305,
        AeadCipher::Aes256Gcm => AeadEnvelopeAlgorithm::Aes256Gcm,
    }
}

fn envelope_algorithm_to_cipher(algorithm: AeadEnvelopeAlgorithm) -> AeadCipher {
    match algorithm {
        AeadEnvelopeAlgorithm::ChaCha20Poly1305 => AeadCipher::ChaCha20Poly1305,
        AeadEnvelopeAlgorithm::Aes256Gcm => AeadCipher::Aes256Gcm,
    }
}

/// Secure Runtime Alpha 436 — returns `None` for
/// `AeadAadDomain::MasterSeedSealing`: that domain has, and needs, no
/// `AeadEnvelopeAadDomain` counterpart, because the Master Seed
/// Authority's own seal/restore path (`master_seed_authority`, outside
/// this `crypto` tree) calls `aead_internal::seal_internal`/
/// `open_internal` DIRECTLY — it never constructs, and never needs, a
/// `FedosCiphertextEnvelope`/`AeadCiphertextEnvelope` at all. This
/// function's return type widens from a bare `AeadEnvelopeAadDomain` to
/// `Option<AeadEnvelopeAadDomain>` ONLY to keep this match exhaustive
/// over `AeadAadDomain`'s now-six variants; every pre-existing domain's
/// mapping is byte-for-byte unchanged.
fn aad_domain_to_envelope_domain(aad_domain: AeadAadDomain) -> Option<AeadEnvelopeAadDomain> {
    match aad_domain {
        AeadAadDomain::RootKey => Some(AeadEnvelopeAadDomain::RootKey),
        AeadAadDomain::Identity => Some(AeadEnvelopeAadDomain::Identity),
        AeadAadDomain::Storage => Some(AeadEnvelopeAadDomain::Storage),
        AeadAadDomain::Conversation => Some(AeadEnvelopeAadDomain::Conversation),
        AeadAadDomain::TestOnly => Some(AeadEnvelopeAadDomain::TestOnly),
        AeadAadDomain::MasterSeedSealing => None,
    }
}

fn envelope_domain_to_aad_domain(aad_domain: AeadEnvelopeAadDomain) -> AeadAadDomain {
    match aad_domain {
        AeadEnvelopeAadDomain::RootKey => AeadAadDomain::RootKey,
        AeadEnvelopeAadDomain::Identity => AeadAadDomain::Identity,
        AeadEnvelopeAadDomain::Storage => AeadAadDomain::Storage,
        AeadEnvelopeAadDomain::Conversation => AeadAadDomain::Conversation,
        AeadEnvelopeAadDomain::TestOnly => AeadAadDomain::TestOnly,
    }
}

/// Stage 161 — build a REAL [`AeadCiphertextEnvelope`] from a completed
/// [`AeadSealDecision`]. Returns `None` if `decision.status` was not
/// `AeadStatus::Ready` (there is no ciphertext to carry) — this function
/// performs no AEAD operation itself, it only repackages an ALREADY
/// sealed result plus the same `nonce`/`aad_domain` the caller used to
/// produce it. Takes `decision` by value (never clones ciphertext bytes
/// unnecessarily) and no `SecretHandle` at all — sealing already
/// happened before this function is ever called.
pub(crate) fn envelope_from_seal_decision_internal(
    decision: AeadSealDecision,
    nonce: [u8; 12],
    aad_domain: AeadAadDomain,
) -> Option<AeadCiphertextEnvelope> {
    if decision.status != AeadStatus::Ready {
        return None;
    }
    let ciphertext = match decision.ciphertext {
        Some(ciphertext) => ciphertext,
        None => return None,
    };
    let envelope_domain = aad_domain_to_envelope_domain(aad_domain)?;
    Some(AeadCiphertextEnvelope::new_with_ciphertext_for_internal_use(
        AeadEnvelopeVersion::V1,
        cipher_to_envelope_algorithm(decision.algorithm),
        nonce,
        envelope_domain,
        ciphertext,
    ))
}

/// Stage 162 — open an [`AeadCiphertextEnvelope`] by extracting its
/// algorithm/nonce/AAD-domain/ciphertext and calling
/// `aead_internal::open_internal`. The caller supplies only `envelope`
/// and `key` — never separately tracks which algorithm/nonce/domain the
/// envelope used, that bookkeeping is the envelope's entire purpose.
///
/// A Stage 157–158 SKELETON envelope (still carrying the fixed
/// placeholder marker, never bridged from a real seal) is NOT specially
/// detected here — it is simply passed to `open_internal` like any other
/// envelope, which then fails authentication against it exactly like any
/// other wrong/tampered ciphertext would (`AeadStatus::AuthenticationFailed`).
/// This module's own tests (`placeholder_envelope_is_rejected_by_open_bridge`)
/// prove this explicitly — no separate "is this a placeholder" branch
/// exists, because the AEAD authentication check already covers it.
pub(crate) fn open_decision_from_envelope_internal(
    envelope: &AeadCiphertextEnvelope,
    key: &SecretHandle,
) -> AeadOpenDecision {
    let algorithm = envelope_algorithm_to_cipher(envelope.algorithm());
    let aad_domain = envelope_domain_to_aad_domain(envelope.aad_domain());
    let nonce_decision = FedosAeadNonceDecision {
        kind: crate::FedosAeadNonceKind::NinetySixBit,
        state: crate::FedosNonceState::Ready,
        nonce: Some(envelope.nonce()),
    };
    open_internal(
        algorithm,
        key,
        &nonce_decision,
        aad_domain,
        envelope.ciphertext(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::aead_internal::seal_internal;
    use crate::fedos_aead_nonce_96;
    use crate::secret_handle::SecretHandleKind;
    use crate::FedosNonceState;

    const TEST_KEY_BYTES: [u8; 32] = [0x44; 32];
    const TEST_PLAINTEXT: &[u8] = b"fedos AEAD envelope bridge test plaintext";

    fn test_key() -> SecretHandle {
        SecretHandle::new_from_32_bytes_for_internal_use(
            SecretHandleKind::AeadKeyMaterial,
            TEST_KEY_BYTES,
        )
    }

    fn ready_nonce() -> FedosAeadNonceDecision {
        let decision = fedos_aead_nonce_96();
        assert_eq!(decision.state, FedosNonceState::Ready);
        decision
    }

    #[test]
    fn chacha20poly1305_seal_to_envelope_to_open_round_trips() {
        let key = test_key();
        let nonce = ready_nonce();
        let sealed = seal_internal(
            AeadCipher::ChaCha20Poly1305,
            &key,
            &nonce,
            AeadAadDomain::TestOnly,
            TEST_PLAINTEXT,
        );
        assert_eq!(sealed.status, AeadStatus::Ready);
        let nonce_bytes = nonce.nonce.expect("Ready nonce decision must carry bytes");
        let envelope =
            envelope_from_seal_decision_internal(sealed, nonce_bytes, AeadAadDomain::TestOnly)
                .expect("Ready seal decision must bridge to an envelope");
        assert!(!envelope.is_placeholder_ciphertext());

        let opened = open_decision_from_envelope_internal(&envelope, &key);
        assert_eq!(opened.status, AeadStatus::Ready);
        assert_eq!(opened.plaintext.as_deref(), Some(TEST_PLAINTEXT));
    }

    #[test]
    fn aes256gcm_seal_to_envelope_to_open_round_trips() {
        let key = test_key();
        let nonce = ready_nonce();
        let sealed = seal_internal(
            AeadCipher::Aes256Gcm,
            &key,
            &nonce,
            AeadAadDomain::Storage,
            TEST_PLAINTEXT,
        );
        assert_eq!(sealed.status, AeadStatus::Ready);
        let nonce_bytes = nonce.nonce.expect("Ready nonce decision must carry bytes");
        let envelope =
            envelope_from_seal_decision_internal(sealed, nonce_bytes, AeadAadDomain::Storage)
                .expect("Ready seal decision must bridge to an envelope");

        let opened = open_decision_from_envelope_internal(&envelope, &key);
        assert_eq!(opened.status, AeadStatus::Ready);
        assert_eq!(opened.plaintext.as_deref(), Some(TEST_PLAINTEXT));
    }

    #[test]
    fn envelope_carries_the_algorithm_nonce_and_aad_domain_used_to_seal() {
        let key = test_key();
        let nonce = ready_nonce();
        let nonce_bytes = nonce.nonce.expect("Ready nonce decision must carry bytes");
        let sealed = seal_internal(
            AeadCipher::Aes256Gcm,
            &key,
            &nonce,
            AeadAadDomain::Identity,
            TEST_PLAINTEXT,
        );
        let envelope =
            envelope_from_seal_decision_internal(sealed, nonce_bytes, AeadAadDomain::Identity)
                .expect("Ready seal decision must bridge to an envelope");
        assert_eq!(envelope.algorithm(), AeadEnvelopeAlgorithm::Aes256Gcm);
        assert_eq!(envelope.nonce(), nonce_bytes);
        assert_eq!(envelope.aad_domain(), AeadEnvelopeAadDomain::Identity);
    }

    #[test]
    fn wrong_key_is_rejected_when_opening_a_real_envelope() {
        let key = test_key();
        let nonce = ready_nonce();
        let nonce_bytes = nonce.nonce.expect("Ready nonce decision must carry bytes");
        let sealed = seal_internal(
            AeadCipher::ChaCha20Poly1305,
            &key,
            &nonce,
            AeadAadDomain::TestOnly,
            TEST_PLAINTEXT,
        );
        let envelope =
            envelope_from_seal_decision_internal(sealed, nonce_bytes, AeadAadDomain::TestOnly)
                .expect("Ready seal decision must bridge to an envelope");

        let wrong_kind_key = SecretHandle::new_from_32_bytes_for_internal_use(
            SecretHandleKind::HkdfInputMaterial,
            TEST_KEY_BYTES,
        );
        let opened = open_decision_from_envelope_internal(&envelope, &wrong_kind_key);
        assert_eq!(opened.status, AeadStatus::InvalidKey);
        assert!(opened.plaintext.is_none());
    }

    #[test]
    fn cleared_key_is_rejected_when_opening_a_real_envelope() {
        let mut key = test_key();
        let nonce = ready_nonce();
        let nonce_bytes = nonce.nonce.expect("Ready nonce decision must carry bytes");
        let sealed = seal_internal(
            AeadCipher::Aes256Gcm,
            &key,
            &nonce,
            AeadAadDomain::TestOnly,
            TEST_PLAINTEXT,
        );
        let envelope =
            envelope_from_seal_decision_internal(sealed, nonce_bytes, AeadAadDomain::TestOnly)
                .expect("Ready seal decision must bridge to an envelope");
        key.clear();

        let opened = open_decision_from_envelope_internal(&envelope, &key);
        assert_eq!(opened.status, AeadStatus::InvalidKey);
        assert!(opened.plaintext.is_none());
    }

    #[test]
    fn wrong_nonce_in_the_envelope_fails_authentication() {
        let key = test_key();
        let nonce = ready_nonce();
        let nonce_bytes = nonce.nonce.expect("Ready nonce decision must carry bytes");
        let sealed = seal_internal(
            AeadCipher::ChaCha20Poly1305,
            &key,
            &nonce,
            AeadAadDomain::TestOnly,
            TEST_PLAINTEXT,
        );
        let envelope =
            envelope_from_seal_decision_internal(sealed, nonce_bytes, AeadAadDomain::TestOnly)
                .expect("Ready seal decision must bridge to an envelope");

        // Rebuild an envelope with the SAME ciphertext but a DIFFERENT
        // (independently drawn) nonce — simulating a corrupted/mismatched
        // envelope.
        let different_nonce = ready_nonce();
        let different_nonce_bytes = different_nonce
            .nonce
            .expect("Ready nonce decision must carry bytes");
        assert_ne!(different_nonce_bytes, nonce_bytes);
        let tampered_envelope = AeadCiphertextEnvelope::new_with_ciphertext_for_internal_use(
            envelope.version(),
            envelope.algorithm(),
            different_nonce_bytes,
            envelope.aad_domain(),
            envelope.ciphertext().to_vec(),
        );

        let opened = open_decision_from_envelope_internal(&tampered_envelope, &key);
        assert_eq!(opened.status, AeadStatus::AuthenticationFailed);
    }

    #[test]
    fn wrong_aad_domain_in_the_envelope_fails_authentication() {
        let key = test_key();
        let nonce = ready_nonce();
        let nonce_bytes = nonce.nonce.expect("Ready nonce decision must carry bytes");
        let sealed = seal_internal(
            AeadCipher::Aes256Gcm,
            &key,
            &nonce,
            AeadAadDomain::Storage,
            TEST_PLAINTEXT,
        );
        let envelope =
            envelope_from_seal_decision_internal(sealed, nonce_bytes, AeadAadDomain::Storage)
                .expect("Ready seal decision must bridge to an envelope");

        let tampered_envelope = AeadCiphertextEnvelope::new_with_ciphertext_for_internal_use(
            envelope.version(),
            envelope.algorithm(),
            envelope.nonce(),
            AeadEnvelopeAadDomain::Conversation,
            envelope.ciphertext().to_vec(),
        );

        let opened = open_decision_from_envelope_internal(&tampered_envelope, &key);
        assert_eq!(opened.status, AeadStatus::AuthenticationFailed);
    }

    #[test]
    fn tampered_ciphertext_in_the_envelope_fails_authentication() {
        let key = test_key();
        let nonce = ready_nonce();
        let nonce_bytes = nonce.nonce.expect("Ready nonce decision must carry bytes");
        let sealed = seal_internal(
            AeadCipher::ChaCha20Poly1305,
            &key,
            &nonce,
            AeadAadDomain::TestOnly,
            TEST_PLAINTEXT,
        );
        let envelope =
            envelope_from_seal_decision_internal(sealed, nonce_bytes, AeadAadDomain::TestOnly)
                .expect("Ready seal decision must bridge to an envelope");

        let mut tampered_ciphertext = envelope.ciphertext().to_vec();
        tampered_ciphertext[0] ^= 0xFF;
        let tampered_envelope = AeadCiphertextEnvelope::new_with_ciphertext_for_internal_use(
            envelope.version(),
            envelope.algorithm(),
            envelope.nonce(),
            envelope.aad_domain(),
            tampered_ciphertext,
        );

        let opened = open_decision_from_envelope_internal(&tampered_envelope, &key);
        assert_eq!(opened.status, AeadStatus::AuthenticationFailed);
    }

    #[test]
    fn placeholder_envelope_is_rejected_by_open_bridge() {
        // A Stage 157–158 SKELETON envelope, never bridged from a real
        // seal — its ciphertext is the fixed, non-secret placeholder
        // marker, which cannot possibly authenticate against a real key.
        let placeholder_envelope = AeadCiphertextEnvelope::new_for_internal_use(
            AeadEnvelopeVersion::V1,
            AeadEnvelopeAlgorithm::ChaCha20Poly1305,
            [0x55; 12],
            AeadEnvelopeAadDomain::TestOnly,
        );
        assert!(placeholder_envelope.is_placeholder_ciphertext());

        let key = test_key();
        let opened = open_decision_from_envelope_internal(&placeholder_envelope, &key);
        assert_eq!(opened.status, AeadStatus::AuthenticationFailed);
        assert!(opened.plaintext.is_none());
    }

    #[test]
    fn seal_decision_that_is_not_ready_does_not_bridge_to_an_envelope() {
        let non_ready_decision = AeadSealDecision {
            algorithm: AeadCipher::ChaCha20Poly1305,
            status: AeadStatus::InvalidKey,
            ciphertext: None,
        };
        let envelope =
            envelope_from_seal_decision_internal(non_ready_decision, [0x66; 12], AeadAadDomain::TestOnly);
        assert!(envelope.is_none());
    }
}
