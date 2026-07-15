//! Stage 152–154 — internal AEAD implementation (ChaCha20-Poly1305 +
//! AES-256-GCM), consuming `SecretHandle` + the 96-bit nonce helper.
//! Crate-private only — see `src/crypto.rs`'s module-level doc comment for
//! this module's place in the `crypto` tree.
//!
//! This is this crate's FIRST production use of `chacha20poly1305`
//! (adopted Stage 74) and `aes-gcm` (adopted Stage 101) — previously
//! exercised only by the `#[cfg(test)]`-only `rfc8439_vectors`/
//! `aes256gcm_vectors` modules, which remain unchanged and still pass
//! their own RFC 8439/NIST CAVP vectors unmodified.
//!
//! **Input discipline**: `seal_internal`/`open_internal` accept EXACTLY
//! two typed inputs for key material and nonce — a
//! `&`[`SecretHandle`](crate::secret_handle::SecretHandle) (validated to
//! be `SecretHandleKind::AeadKeyMaterial`, rejected otherwise) and a
//! `&`[`FedosAeadNonceDecision`](crate::FedosAeadNonceDecision) (validated
//! to be `FedosNonceState::Ready`, rejected otherwise) — never a raw key
//! byte, nonce byte, salt, or info parameter from any caller. AAD is a
//! fixed, compile-time [`AeadAadDomain`] label, never caller-supplied
//! text. Plaintext/ciphertext are the only variable-length inputs, and
//! both stay `pub(crate)`-at-most throughout — never returned across this
//! crate's public API boundary.
//!
//! **Nonce reuse is the CALLER's responsibility, not enforced here.**
//! This module does not track, and cannot track, whether a given
//! `(key, nonce)` pair has been used before — doing so would require
//! persistent, cross-call state this crate does not have. Every caller of
//! `seal_internal` MUST draw a fresh nonce from `fedos_aead_nonce_96()`
//! for EVERY seal call under the same key — reusing a nonce with
//! ChaCha20-Poly1305/AES-256-GCM catastrophically breaks confidentiality
//! AND authenticity. This is a documented, binding caller obligation, not
//! a runtime-checked guarantee — see `docs/aead_internal_implementation.md`
//! and `docs/nonce_generation_policy.md`.
//!
//! **This module does NOT**: implement a public `encrypt`/`decrypt` API,
//! connect to the Runtime/Worker/WASM, connect to storage or Nostr,
//! implement a Nostr encrypted-message scheme, or define a ciphertext
//! envelope/serialization format (see `docs/ciphertext_envelope_plan.md`
//! for that future, separate, docs-only stage).
#![allow(dead_code)]

use crate::secret_handle::{SecretHandle, SecretHandleKind};
use crate::{FedosAeadNonceDecision, FedosNonceState};

use aes_gcm::aead::{
    Aead as AesAeadOp, Error as AesAeadError, KeyInit as AesKeyInit, Payload as AesPayload,
};
use aes_gcm::{Aes256Gcm, Key as AesKey, Nonce as AesNonce};
use chacha20poly1305::aead::{
    Aead as ChaChaAeadOp, Error as ChaChaAeadError, KeyInit as ChaChaKeyInit,
    Payload as ChaChaPayload,
};
use chacha20poly1305::{ChaCha20Poly1305, Key as ChaChaKey, Nonce as ChaChaNonce};
use zeroize::Zeroize;

/// Which AEAD algorithm a seal/open call uses — a label only. Crate-private
/// only; never exposed via this crate's public API. Distinct from the
/// pre-existing, still-unconnected `crate::aead_core::AeadAlgorithm`
/// (Stage 80 skeleton, which this module does not touch and which still
/// names only `ChaCha20Poly1305` — that skeleton is left exactly as it
/// was, per this crate's standing "leave unrelated skeletons unconnected"
/// discipline, the same choice Stage 147 made for `domain_label`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum AeadCipher {
    ChaCha20Poly1305,
    Aes256Gcm,
}

/// Which fixed Associated Data (AAD) context a seal/open call binds to — a
/// non-sensitive label only, never caller-supplied text. Mirrors
/// `kdf_core::HkdfDomain`'s "one fixed `&'static [u8]` literal per domain"
/// shape (Stage 147), as its own, separate enum — AEAD's AAD domain and
/// HKDF's salt/info domain are deliberately NOT the same type, so a future
/// change to one never silently changes the other.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum AeadAadDomain {
    RootKey,
    Identity,
    Storage,
    Conversation,
    TestOnly,
    /// Secure Runtime Alpha 433/436 — the Master Seed Authority's own
    /// sealing domain: binds a sealed Master Seed ciphertext to exactly
    /// this purpose, so it can never be swapped for, or confused with, a
    /// ciphertext sealed under any OTHER domain even under an
    /// (implausible) accidental key reuse. Deliberately its OWN domain,
    /// not a reuse of `RootKey`/`Storage` — domain separation exists
    /// precisely so each distinct secret CLASS gets its own label.
    MasterSeedSealing,
}

impl AeadAadDomain {
    /// The fixed AAD bytes for this domain. Never derived from caller
    /// input, never random — a plain `&'static` byte-string literal chosen
    /// at compile time. Both `seal_internal` and `open_internal` must be
    /// called with the SAME domain for a given ciphertext, or
    /// authentication fails (by design — AAD is authenticated but not
    /// encrypted, and a mismatched AAD is exactly the tamper case AEAD
    /// exists to catch).
    const fn as_aad(self) -> &'static [u8] {
        match self {
            AeadAadDomain::RootKey => b"fedos-aead-aad-root-key-v1",
            AeadAadDomain::Identity => b"fedos-aead-aad-identity-v1",
            AeadAadDomain::Storage => b"fedos-aead-aad-storage-v1",
            AeadAadDomain::Conversation => b"fedos-aead-aad-conversation-v1",
            AeadAadDomain::TestOnly => b"fedos-aead-aad-test-only-v1",
            AeadAadDomain::MasterSeedSealing => b"fedos-aead-aad-master-seed-sealing-v1",
        }
    }
}

/// Coarse observable outcome of a [`seal_internal`]/[`open_internal`]
/// call. Crate-private only. No secret byte is exposed through this label
/// — only through [`AeadSealDecision::ciphertext`]/
/// [`AeadOpenDecision::plaintext`] on `Ready`, and even then only a plain
/// byte buffer the caller already owns (never a `SecretHandle`-derived
/// byte reappearing unexpectedly).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum AeadStatus {
    /// The operation succeeded.
    Ready,
    /// The key `SecretHandle` was not `AeadKeyMaterial`-kinded, or held no
    /// real bytes (Stage 79 placeholder, or already `clear()`-ed).
    InvalidKey,
    /// The nonce decision was not `FedosNonceState::Ready` (e.g. an
    /// `EntropySourceUnavailable` decision was passed in).
    InvalidNonce,
    /// Decryption/verification failed — a fixed label covering every
    /// failure cause (wrong key, wrong nonce, wrong AAD, tampered
    /// ciphertext) uniformly; per RFC 8439/NIST AEAD guidance, an AEAD
    /// implementation must never distinguish WHY authentication failed —
    /// doing so is itself a side channel.
    AuthenticationFailed,
    /// The underlying AEAD crate reported a failure other than the above
    /// (unreachable in practice for a well-formed seal call with
    /// fixed-length key/nonce, but matched exhaustively rather than
    /// assumed infallible).
    InternalFailure,
}

/// The result of a [`seal_internal`] call. Crate-private only; never
/// `Clone`/`Debug`-over-secret (this struct holds no `SecretHandle` and no
/// key byte — `ciphertext` is plain output data the caller already
/// intends to transmit/store, not a secret this crate tracks the
/// lifecycle of).
pub(crate) struct AeadSealDecision {
    pub(crate) algorithm: AeadCipher,
    pub(crate) status: AeadStatus,
    pub(crate) ciphertext: Option<Vec<u8>>,
}

/// The result of an [`open_internal`] call. Crate-private only.
pub(crate) struct AeadOpenDecision {
    pub(crate) algorithm: AeadCipher,
    pub(crate) status: AeadStatus,
    pub(crate) plaintext: Option<Vec<u8>>,
}

/// Validate `key` is `AeadKeyMaterial`-kinded and holds real bytes, via
/// `SecretHandle`'s own narrowly-scoped `expose_bytes_for_internal_aead`
/// accessor (added this stage) — the ONE reviewed path into a key
/// `SecretHandle`'s bytes anywhere in this module.
fn extract_key_bytes(key: &SecretHandle) -> Option<[u8; 32]> {
    if key.kind() != SecretHandleKind::AeadKeyMaterial {
        return None;
    }
    key.expose_bytes_for_internal_aead()
}

/// Validate `nonce` is `Ready` and extract its 12 bytes. A nonce is not a
/// secret (`docs/nonce_generation_policy.md` section 9), so this is a
/// plain field read, not a `SecretHandle`-style accessor.
fn extract_nonce_bytes(nonce: &FedosAeadNonceDecision) -> Option<[u8; 12]> {
    if nonce.state != FedosNonceState::Ready {
        return None;
    }
    nonce.nonce
}

fn seal_chacha20poly1305(
    key_bytes: &[u8; 32],
    nonce_bytes: &[u8; 12],
    aad: &[u8],
    plaintext: &[u8],
) -> Result<Vec<u8>, ChaChaAeadError> {
    let key = ChaChaKey::from(*key_bytes);
    let nonce = ChaChaNonce::from(*nonce_bytes);
    let cipher = ChaCha20Poly1305::new(&key);
    cipher.encrypt(
        &nonce,
        ChaChaPayload {
            msg: plaintext,
            aad,
        },
    )
}

fn open_chacha20poly1305(
    key_bytes: &[u8; 32],
    nonce_bytes: &[u8; 12],
    aad: &[u8],
    ciphertext: &[u8],
) -> Result<Vec<u8>, ChaChaAeadError> {
    let key = ChaChaKey::from(*key_bytes);
    let nonce = ChaChaNonce::from(*nonce_bytes);
    let cipher = ChaCha20Poly1305::new(&key);
    cipher.decrypt(
        &nonce,
        ChaChaPayload {
            msg: ciphertext,
            aad,
        },
    )
}

fn seal_aes256gcm(
    key_bytes: &[u8; 32],
    nonce_bytes: &[u8; 12],
    aad: &[u8],
    plaintext: &[u8],
) -> Result<Vec<u8>, AesAeadError> {
    let key = AesKey::<Aes256Gcm>::from_slice(key_bytes);
    let nonce = AesNonce::from_slice(nonce_bytes);
    let cipher = Aes256Gcm::new(key);
    cipher.encrypt(
        nonce,
        AesPayload {
            msg: plaintext,
            aad,
        },
    )
}

fn open_aes256gcm(
    key_bytes: &[u8; 32],
    nonce_bytes: &[u8; 12],
    aad: &[u8],
    ciphertext: &[u8],
) -> Result<Vec<u8>, AesAeadError> {
    let key = AesKey::<Aes256Gcm>::from_slice(key_bytes);
    let nonce = AesNonce::from_slice(nonce_bytes);
    let cipher = Aes256Gcm::new(key);
    cipher.decrypt(
        nonce,
        AesPayload {
            msg: ciphertext,
            aad,
        },
    )
}

/// Seal (encrypt-then-tag) `plaintext` under `key` (a
/// `SecretHandle(AeadKeyMaterial)`), `nonce` (a `Ready`
/// `FedosAeadNonceDecision` — the caller MUST have drawn this fresh via
/// `fedos_aead_nonce_96()` and MUST NOT reuse it under the same `key`),
/// and `aad_domain` (a fixed AAD context). Returns `ciphertext‖tag` on
/// `AeadStatus::Ready`; rejects a wrong-kinded/empty key
/// (`InvalidKey`) or a non-`Ready` nonce decision (`InvalidNonce`) before
/// ever touching the underlying cipher.
pub(crate) fn seal_internal(
    algorithm: AeadCipher,
    key: &SecretHandle,
    nonce: &FedosAeadNonceDecision,
    aad_domain: AeadAadDomain,
    plaintext: &[u8],
) -> AeadSealDecision {
    let mut key_bytes = match extract_key_bytes(key) {
        Some(bytes) => bytes,
        None => {
            return AeadSealDecision {
                algorithm,
                status: AeadStatus::InvalidKey,
                ciphertext: None,
            };
        }
    };
    let nonce_bytes = match extract_nonce_bytes(nonce) {
        Some(bytes) => bytes,
        None => {
            key_bytes.zeroize();
            return AeadSealDecision {
                algorithm,
                status: AeadStatus::InvalidNonce,
                ciphertext: None,
            };
        }
    };
    let aad = aad_domain.as_aad();
    let result = match algorithm {
        AeadCipher::ChaCha20Poly1305 => {
            seal_chacha20poly1305(&key_bytes, &nonce_bytes, aad, plaintext).map_err(|_| ())
        }
        AeadCipher::Aes256Gcm => {
            seal_aes256gcm(&key_bytes, &nonce_bytes, aad, plaintext).map_err(|_| ())
        }
    };
    key_bytes.zeroize();
    match result {
        Ok(ciphertext) => AeadSealDecision {
            algorithm,
            status: AeadStatus::Ready,
            ciphertext: Some(ciphertext),
        },
        Err(()) => AeadSealDecision {
            algorithm,
            status: AeadStatus::InternalFailure,
            ciphertext: None,
        },
    }
}

/// Open (verify-then-decrypt) `ciphertext` (`ciphertext‖tag`, as returned
/// by [`seal_internal`]) under `key`/`nonce`/`aad_domain` — must be the
/// EXACT SAME key, nonce, and AAD domain used to seal it, or this returns
/// `AeadStatus::AuthenticationFailed`. Rejects a wrong-kinded/empty key
/// (`InvalidKey`) or a non-`Ready` nonce decision (`InvalidNonce`) before
/// ever touching the underlying cipher, same as [`seal_internal`].
pub(crate) fn open_internal(
    algorithm: AeadCipher,
    key: &SecretHandle,
    nonce: &FedosAeadNonceDecision,
    aad_domain: AeadAadDomain,
    ciphertext: &[u8],
) -> AeadOpenDecision {
    let mut key_bytes = match extract_key_bytes(key) {
        Some(bytes) => bytes,
        None => {
            return AeadOpenDecision {
                algorithm,
                status: AeadStatus::InvalidKey,
                plaintext: None,
            };
        }
    };
    let nonce_bytes = match extract_nonce_bytes(nonce) {
        Some(bytes) => bytes,
        None => {
            key_bytes.zeroize();
            return AeadOpenDecision {
                algorithm,
                status: AeadStatus::InvalidNonce,
                plaintext: None,
            };
        }
    };
    let aad = aad_domain.as_aad();
    let result = match algorithm {
        AeadCipher::ChaCha20Poly1305 => {
            open_chacha20poly1305(&key_bytes, &nonce_bytes, aad, ciphertext).map_err(|_| ())
        }
        AeadCipher::Aes256Gcm => {
            open_aes256gcm(&key_bytes, &nonce_bytes, aad, ciphertext).map_err(|_| ())
        }
    };
    key_bytes.zeroize();
    match result {
        Ok(plaintext) => AeadOpenDecision {
            algorithm,
            status: AeadStatus::Ready,
            plaintext: Some(plaintext),
        },
        Err(()) => AeadOpenDecision {
            algorithm,
            status: AeadStatus::AuthenticationFailed,
            plaintext: None,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{fedos_aead_nonce_96, FedosAeadNonceKind};

    // A clearly-labeled, non-production test fixture — a fixed repeating
    // pattern, never a real key/seed/passphrase.
    const TEST_KEY_BYTES: [u8; 32] = [0x11; 32];
    const TEST_PLAINTEXT: &[u8] = b"fedos AEAD internal test plaintext";

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
    fn chacha20poly1305_seal_then_open_round_trips() {
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
        let ciphertext = sealed.ciphertext.expect("Ready seal must carry ciphertext");

        let opened = open_internal(
            AeadCipher::ChaCha20Poly1305,
            &key,
            &nonce,
            AeadAadDomain::TestOnly,
            &ciphertext,
        );
        assert_eq!(opened.status, AeadStatus::Ready);
        assert_eq!(opened.plaintext.as_deref(), Some(TEST_PLAINTEXT));
    }

    #[test]
    fn aes256gcm_seal_then_open_round_trips() {
        let key = test_key();
        let nonce = ready_nonce();
        let sealed = seal_internal(
            AeadCipher::Aes256Gcm,
            &key,
            &nonce,
            AeadAadDomain::TestOnly,
            TEST_PLAINTEXT,
        );
        assert_eq!(sealed.status, AeadStatus::Ready);
        let ciphertext = sealed.ciphertext.expect("Ready seal must carry ciphertext");

        let opened = open_internal(
            AeadCipher::Aes256Gcm,
            &key,
            &nonce,
            AeadAadDomain::TestOnly,
            &ciphertext,
        );
        assert_eq!(opened.status, AeadStatus::Ready);
        assert_eq!(opened.plaintext.as_deref(), Some(TEST_PLAINTEXT));
    }

    #[test]
    fn wrong_aad_domain_fails_authentication_for_both_ciphers() {
        for algorithm in [AeadCipher::ChaCha20Poly1305, AeadCipher::Aes256Gcm] {
            let key = test_key();
            let nonce = ready_nonce();
            let sealed = seal_internal(
                algorithm,
                &key,
                &nonce,
                AeadAadDomain::Storage,
                TEST_PLAINTEXT,
            );
            let ciphertext = sealed.ciphertext.expect("Ready seal must carry ciphertext");

            let opened = open_internal(
                algorithm,
                &key,
                &nonce,
                AeadAadDomain::Conversation,
                &ciphertext,
            );
            assert_eq!(opened.status, AeadStatus::AuthenticationFailed);
            assert!(opened.plaintext.is_none());
        }
    }

    #[test]
    fn wrong_nonce_fails_authentication_for_both_ciphers() {
        for algorithm in [AeadCipher::ChaCha20Poly1305, AeadCipher::Aes256Gcm] {
            let key = test_key();
            let seal_nonce = ready_nonce();
            let sealed = seal_internal(
                algorithm,
                &key,
                &seal_nonce,
                AeadAadDomain::TestOnly,
                TEST_PLAINTEXT,
            );
            let ciphertext = sealed.ciphertext.expect("Ready seal must carry ciphertext");

            let different_nonce = ready_nonce();
            assert_ne!(different_nonce.nonce, seal_nonce.nonce);
            let opened = open_internal(
                algorithm,
                &key,
                &different_nonce,
                AeadAadDomain::TestOnly,
                &ciphertext,
            );
            assert_eq!(opened.status, AeadStatus::AuthenticationFailed);
        }
    }

    #[test]
    fn tampered_ciphertext_fails_authentication_for_both_ciphers() {
        for algorithm in [AeadCipher::ChaCha20Poly1305, AeadCipher::Aes256Gcm] {
            let key = test_key();
            let nonce = ready_nonce();
            let sealed = seal_internal(
                algorithm,
                &key,
                &nonce,
                AeadAadDomain::TestOnly,
                TEST_PLAINTEXT,
            );
            let mut ciphertext = sealed.ciphertext.expect("Ready seal must carry ciphertext");
            ciphertext[0] ^= 0xFF;

            let opened = open_internal(
                algorithm,
                &key,
                &nonce,
                AeadAadDomain::TestOnly,
                &ciphertext,
            );
            assert_eq!(opened.status, AeadStatus::AuthenticationFailed);
        }
    }

    #[test]
    fn wrong_key_kind_is_rejected_before_touching_the_cipher() {
        let wrong_kind_key = SecretHandle::new_from_32_bytes_for_internal_use(
            SecretHandleKind::HkdfInputMaterial,
            TEST_KEY_BYTES,
        );
        let nonce = ready_nonce();
        let sealed = seal_internal(
            AeadCipher::ChaCha20Poly1305,
            &wrong_kind_key,
            &nonce,
            AeadAadDomain::TestOnly,
            TEST_PLAINTEXT,
        );
        assert_eq!(sealed.status, AeadStatus::InvalidKey);
        assert!(sealed.ciphertext.is_none());

        let opened = open_internal(
            AeadCipher::ChaCha20Poly1305,
            &wrong_kind_key,
            &nonce,
            AeadAadDomain::TestOnly,
            TEST_PLAINTEXT,
        );
        assert_eq!(opened.status, AeadStatus::InvalidKey);
    }

    #[test]
    fn cleared_key_is_rejected() {
        let mut key = test_key();
        key.clear();
        let nonce = ready_nonce();
        let sealed = seal_internal(
            AeadCipher::Aes256Gcm,
            &key,
            &nonce,
            AeadAadDomain::TestOnly,
            TEST_PLAINTEXT,
        );
        assert_eq!(sealed.status, AeadStatus::InvalidKey);
        assert!(sealed.ciphertext.is_none());
    }

    #[test]
    fn non_ready_nonce_decision_is_rejected() {
        let key = test_key();
        let failed_nonce = FedosAeadNonceDecision {
            kind: FedosAeadNonceKind::NinetySixBit,
            state: FedosNonceState::EntropySourceUnavailable,
            nonce: None,
        };
        let sealed = seal_internal(
            AeadCipher::ChaCha20Poly1305,
            &key,
            &failed_nonce,
            AeadAadDomain::TestOnly,
            TEST_PLAINTEXT,
        );
        assert_eq!(sealed.status, AeadStatus::InvalidNonce);
        assert!(sealed.ciphertext.is_none());
    }

    #[test]
    fn seal_is_deterministic_for_the_same_key_nonce_aad_and_plaintext() {
        let key = test_key();
        let nonce = ready_nonce();
        let first = seal_internal(
            AeadCipher::ChaCha20Poly1305,
            &key,
            &nonce,
            AeadAadDomain::TestOnly,
            TEST_PLAINTEXT,
        );
        let second = seal_internal(
            AeadCipher::ChaCha20Poly1305,
            &key,
            &nonce,
            AeadAadDomain::TestOnly,
            TEST_PLAINTEXT,
        );
        assert_eq!(first.ciphertext, second.ciphertext);
    }

    /// `AeadCipher` supports exactly the two specified variants — an
    /// exhaustive match with no wildcard arm compiles only because no
    /// other variant exists to add one for.
    #[test]
    fn aead_cipher_has_no_variant_other_than_the_two_specified() {
        let algorithm = AeadCipher::ChaCha20Poly1305;
        match algorithm {
            AeadCipher::ChaCha20Poly1305 => {}
            AeadCipher::Aes256Gcm => {}
        }
    }
}
