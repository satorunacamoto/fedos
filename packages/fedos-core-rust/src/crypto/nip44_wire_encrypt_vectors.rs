//! Stage 237 — full NIP-44 v2 wire ENCRYPT + DECRYPT round-trip vector
//! verification, `#[cfg(test)]` ONLY. Wires `test-vectors/nip44/nip44-v2.json`'s
//! `valid.encrypt_decrypt` category (10 cases) end-to-end against
//! `crypto::nip44_wire_encrypt::encrypt_wire_from_bytes_with_nonce_for_test_internal`
//! (Stage 236) and
//! `crypto::nip44_wire_decrypt::decrypt_wire_payload_from_bytes_internal`
//! (Stage 235) — confirming, for every case:
//!
//! 1. `encrypt_wire_internal`'s pipeline (message-key derivation → pad →
//!    ChaCha20 → HMAC → encode) reproduces the vector's own `payload`
//!    field EXACTLY, byte-for-byte/char-for-char.
//! 2. Decoding and decrypting that SAME payload string recovers the
//!    documented `plaintext` EXACTLY.
//!
//! This connects Stage 234–236's new encode/encrypt code to the
//! already-verified Stage 219–232 decrypt pipeline
//! (`crypto::nip44_message_keys`/`crypto::nip44_padding`/
//! `crypto::nip44_stream_cipher`/`crypto::nip44_hmac`/
//! `crypto::nip44_wire_decrypt`, all UNCHANGED by this stage) with zero
//! new production code of its own — this file is a test only.
//!
//! Uses `serde`/`serde_json`/`hex` — already `[dev-dependencies]`-only in
//! `Cargo.toml` since Stage 75/77, exactly like every other NIP-44 vector
//! module.
#![cfg(test)]

use super::nip44_wire_decrypt::{decrypt_wire_payload_from_bytes_internal, Nip44WireDecryptStatus};
use super::nip44_wire_encrypt::{
    encrypt_wire_from_bytes_with_nonce_for_test_internal, Nip44WireEncryptStatus,
};

const NIP44_V2_JSON: &str = include_str!("../../../../test-vectors/nip44/nip44-v2.json");

#[derive(Debug, serde::Deserialize)]
struct Nip44VectorCategory {
    category: String,
    data: serde_json::Value,
}

#[derive(Debug, serde::Deserialize)]
struct Nip44VectorFile {
    vectors: Vec<Nip44VectorCategory>,
}

#[derive(Debug, serde::Deserialize)]
struct ValidEncryptDecryptCase {
    conversation_key: String,
    nonce: String,
    plaintext: String,
    payload: String,
}

fn category_data(name: &str) -> serde_json::Value {
    let file: Nip44VectorFile =
        serde_json::from_str(NIP44_V2_JSON).expect("NIP-44 v2 vector JSON must parse");
    file.vectors
        .into_iter()
        .find(|v| v.category == name)
        .unwrap_or_else(|| panic!("expected category `{name}` to be present"))
        .data
}

fn hex_to_32_bytes(hex_str: &str) -> [u8; 32] {
    let bytes = hex::decode(hex_str).expect("vector hex must decode");
    let mut fixed = [0u8; 32];
    fixed.copy_from_slice(&bytes);
    fixed
}

#[test]
fn encrypt_wire_reproduces_every_valid_encrypt_decrypt_payload_exactly() {
    let data = category_data("valid.encrypt_decrypt");
    let cases: Vec<ValidEncryptDecryptCase> =
        serde_json::from_value(data).expect("valid.encrypt_decrypt data must parse");
    assert!(!cases.is_empty());

    for case in &cases {
        let conversation_key = hex_to_32_bytes(&case.conversation_key);
        let nonce = hex_to_32_bytes(&case.nonce);

        let encrypted = encrypt_wire_from_bytes_with_nonce_for_test_internal(
            &conversation_key,
            case.plaintext.as_bytes(),
            &nonce,
        );
        assert_eq!(
            encrypted.status,
            Nip44WireEncryptStatus::Ready,
            "expected Ready for plaintext={:?}",
            case.plaintext
        );
        let payload = encrypted.payload.expect("Ready must carry a payload");
        assert_eq!(
            payload, case.payload,
            "encrypted payload mismatch for plaintext={:?}",
            case.plaintext
        );
    }
}

#[test]
fn decode_and_decrypt_of_every_freshly_encrypted_payload_recovers_the_documented_plaintext() {
    let data = category_data("valid.encrypt_decrypt");
    let cases: Vec<ValidEncryptDecryptCase> =
        serde_json::from_value(data).expect("valid.encrypt_decrypt data must parse");

    for case in &cases {
        let conversation_key = hex_to_32_bytes(&case.conversation_key);
        let nonce = hex_to_32_bytes(&case.nonce);

        let encrypted = encrypt_wire_from_bytes_with_nonce_for_test_internal(
            &conversation_key,
            case.plaintext.as_bytes(),
            &nonce,
        );
        let payload = encrypted.payload.expect("Ready must carry a payload");

        let decrypted = decrypt_wire_payload_from_bytes_internal(&conversation_key, &payload);
        assert_eq!(
            decrypted.status,
            Nip44WireDecryptStatus::Ready,
            "expected Ready decrypting plaintext={:?}",
            case.plaintext
        );
        assert_eq!(
            decrypted.plaintext.as_deref(),
            Some(case.plaintext.as_bytes()),
            "recovered plaintext mismatch for plaintext={:?}",
            case.plaintext
        );
    }
}

#[test]
fn decode_and_decrypt_of_the_vectors_own_documented_payload_also_recovers_the_plaintext() {
    // Full loop closure: not just OUR freshly-encrypted payload, but the
    // UPSTREAM reference vector's own payload string too.
    let data = category_data("valid.encrypt_decrypt");
    let cases: Vec<ValidEncryptDecryptCase> =
        serde_json::from_value(data).expect("valid.encrypt_decrypt data must parse");

    for case in &cases {
        let conversation_key = hex_to_32_bytes(&case.conversation_key);
        let decrypted =
            decrypt_wire_payload_from_bytes_internal(&conversation_key, &case.payload);
        assert_eq!(decrypted.status, Nip44WireDecryptStatus::Ready);
        assert_eq!(decrypted.plaintext.as_deref(), Some(case.plaintext.as_bytes()));
    }
}
