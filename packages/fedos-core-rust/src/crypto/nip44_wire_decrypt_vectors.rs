//! Stage 232 — full NIP-44 v2 wire DECRYPT pipeline vector verification,
//! `#[cfg(test)]` ONLY. Wires `test-vectors/nip44/nip44-v2.json`'s
//! `valid.encrypt_decrypt` category (10 cases) end-to-end against
//! `crypto::nip44_wire_decrypt::decrypt_wire_from_bytes_internal` —
//! confirming the FULL pipeline (HMAC verify → ChaCha20 stream decrypt →
//! unpad) recovers the documented `plaintext` exactly, not just the
//! ChaCha20-only slice `nip44_stream_cipher_vectors` (Stage 230) already
//! confirmed.
//!
//! Reuses the SAME test-fixture-only base64 STANDARD decoder pattern
//! `nip44_stream_cipher_vectors` (Stage 230) already established — see
//! that module's own doc comment for the full record of why this exists
//! and why it is not a production capability (`#[cfg(test)]`-only, no
//! `Cargo.toml` dependency, never reachable from production code).
//! Duplicated here rather than shared, mirroring how every other NIP-44
//! vector module in this crate already duplicates its own small
//! hex-decoding helper rather than importing one from a sibling
//! `#[cfg(test)]` module.
//!
//! Uses `serde`/`serde_json`/`hex` — already `[dev-dependencies]`-only in
//! `Cargo.toml` since Stage 75/77, exactly like every other NIP-44 vector
//! module.
#![cfg(test)]

use super::nip44_wire_decrypt::{decrypt_wire_from_bytes_internal, Nip44WireDecryptStatus};

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

/// A test-fixture-ONLY standard base64 decoder — see
/// `nip44_stream_cipher_vectors`'s own module-level doc comment (Stage
/// 230) for the full record of why this exists and why it is not a
/// production capability.
fn base64_standard_decode_for_test_fixture(input: &str) -> Vec<u8> {
    const ALPHABET: &[u8] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut lookup = [255u8; 256];
    for (i, &b) in ALPHABET.iter().enumerate() {
        lookup[b as usize] = i as u8;
    }

    let mut bits: u32 = 0;
    let mut bit_count: u32 = 0;
    let mut output = Vec::new();
    for byte in input.bytes().filter(|&b| b != b'=') {
        let value = lookup[byte as usize];
        assert_ne!(value, 255, "invalid base64 character in test fixture");
        bits = (bits << 6) | u32::from(value);
        bit_count += 6;
        if bit_count >= 8 {
            bit_count -= 8;
            output.push((bits >> bit_count) as u8);
        }
    }
    output
}

#[test]
fn valid_encrypt_decrypt_vectors_all_decrypt_to_the_documented_plaintext() {
    let data = category_data("valid.encrypt_decrypt");
    let cases: Vec<ValidEncryptDecryptCase> =
        serde_json::from_value(data).expect("valid.encrypt_decrypt data must parse");
    assert!(!cases.is_empty());

    for case in &cases {
        let conversation_key = hex_to_32_bytes(&case.conversation_key);
        let nonce = hex_to_32_bytes(&case.nonce);

        let decoded_payload = base64_standard_decode_for_test_fixture(&case.payload);
        assert!(
            decoded_payload.len() > 1 + 32 + 32,
            "decoded payload must be long enough to carry version+nonce+mac"
        );
        let wire_nonce = &decoded_payload[1..33];
        assert_eq!(wire_nonce, nonce, "wire nonce must match the vector's own nonce field");
        let ciphertext = &decoded_payload[33..decoded_payload.len() - 32];
        let mac_slice = &decoded_payload[decoded_payload.len() - 32..];
        let mut mac = [0u8; 32];
        mac.copy_from_slice(mac_slice);

        let decision =
            decrypt_wire_from_bytes_internal(&conversation_key, &nonce, ciphertext, &mac);
        assert_eq!(
            decision.status,
            Nip44WireDecryptStatus::Ready,
            "expected Ready for plaintext={:?}",
            case.plaintext
        );
        assert_eq!(
            decision.plaintext.as_deref(),
            Some(case.plaintext.as_bytes()),
            "recovered plaintext mismatch for plaintext={:?}",
            case.plaintext
        );
    }
}

#[test]
fn a_tampered_mac_byte_makes_every_vector_fail_authentication() {
    let data = category_data("valid.encrypt_decrypt");
    let cases: Vec<ValidEncryptDecryptCase> =
        serde_json::from_value(data).expect("valid.encrypt_decrypt data must parse");

    for case in &cases {
        let conversation_key = hex_to_32_bytes(&case.conversation_key);
        let nonce = hex_to_32_bytes(&case.nonce);
        let decoded_payload = base64_standard_decode_for_test_fixture(&case.payload);
        let ciphertext = &decoded_payload[33..decoded_payload.len() - 32];
        let mut mac = [0u8; 32];
        mac.copy_from_slice(&decoded_payload[decoded_payload.len() - 32..]);
        mac[0] ^= 0xFF;

        let decision =
            decrypt_wire_from_bytes_internal(&conversation_key, &nonce, ciphertext, &mac);
        assert_eq!(decision.status, Nip44WireDecryptStatus::AuthenticationFailed);
        assert!(decision.plaintext.is_none());
    }
}
