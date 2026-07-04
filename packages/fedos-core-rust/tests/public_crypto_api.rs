//! Stage 171–176 — an integration test, compiled by Cargo as its OWN
//! separate crate (the standard meaning of anything under `tests/`), which
//! can reach `fedos_core_rust` ONLY through its public API. This is the
//! concrete proof that `fedos_generate_aead_key_32`/`fedos_encrypt`/
//! `fedos_decrypt` and the opaque `FedosAeadKeyHandle`/
//! `FedosCiphertextEnvelope` types are genuinely usable from outside the
//! crate — not just `pub` in name (the Stage 166–170 limitation
//! `docs/public_crypto_api.md` documented and this stage resolves). No
//! `SecretHandle`/`AeadCiphertextEnvelope`/`AeadCipher`/`AeadAadDomain`
//! name is reachable from here; this file cannot even write one down.

use fedos_core_rust::{
    fedos_decrypt, fedos_encrypt, fedos_generate_aead_key_32, FedosAeadAadDomain,
    FedosAeadAlgorithm, FedosDecryptStatus, FedosEncryptStatus, FedosKeyGenerationStatus,
};

const PLAINTEXT: &[u8] = b"integration test plaintext, reached only via the public API";

#[test]
fn generate_key_encrypt_decrypt_round_trips_for_both_ciphers_from_outside_the_crate() {
    for algorithm in [FedosAeadAlgorithm::ChaCha20Poly1305, FedosAeadAlgorithm::Aes256Gcm] {
        let generated = fedos_generate_aead_key_32();
        assert_eq!(generated.status, FedosKeyGenerationStatus::Ready);
        let key = generated
            .key
            .expect("Ready generation decision must carry a key handle");

        let encrypted = fedos_encrypt(algorithm, &key, FedosAeadAadDomain::TestOnly, PLAINTEXT);
        assert_eq!(encrypted.status, FedosEncryptStatus::Ready);
        let envelope = encrypted
            .envelope
            .expect("Ready encrypt decision must carry an envelope");

        let decrypted = fedos_decrypt(&key, &envelope);
        assert_eq!(decrypted.status, FedosDecryptStatus::Ready);
        assert_eq!(decrypted.plaintext.as_deref(), Some(PLAINTEXT));
    }
}

#[test]
fn wrong_key_fails_from_outside_the_crate() {
    let key_a = fedos_generate_aead_key_32()
        .key
        .expect("Ready generation decision must carry a key handle");
    let key_b = fedos_generate_aead_key_32()
        .key
        .expect("Ready generation decision must carry a key handle");

    let encrypted = fedos_encrypt(
        FedosAeadAlgorithm::Aes256Gcm,
        &key_a,
        FedosAeadAadDomain::TestOnly,
        PLAINTEXT,
    );
    let envelope = encrypted
        .envelope
        .expect("Ready encrypt decision must carry an envelope");

    let decrypted = fedos_decrypt(&key_b, &envelope);
    assert_eq!(decrypted.status, FedosDecryptStatus::AuthenticationFailed);
    assert!(decrypted.plaintext.is_none());
}

#[test]
fn a_second_generated_key_never_repeats_the_first() {
    let first = fedos_generate_aead_key_32()
        .key
        .expect("Ready generation decision must carry a key handle");
    let second = fedos_generate_aead_key_32()
        .key
        .expect("Ready generation decision must carry a key handle");

    // Neither key exposes a raw byte to compare directly — the only
    // externally-observable proof two handles differ is that encrypting
    // under one and decrypting under the other fails authentication.
    let encrypted = fedos_encrypt(
        FedosAeadAlgorithm::ChaCha20Poly1305,
        &first,
        FedosAeadAadDomain::TestOnly,
        PLAINTEXT,
    );
    let envelope = encrypted
        .envelope
        .expect("Ready encrypt decision must carry an envelope");
    let decrypted = fedos_decrypt(&second, &envelope);
    assert_eq!(decrypted.status, FedosDecryptStatus::AuthenticationFailed);
}
