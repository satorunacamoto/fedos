//! Stage 234 — NIP-44 v2 wire ENCODING vector verification, `#[cfg(test)]`
//! ONLY. Wires `test-vectors/nip44/nip44-v2.json`'s `valid.encrypt_decrypt`
//! category (10 cases) against
//! `crypto::nip44_wire_encoding::decode_wire_payload_internal`/
//! `encode_wire_payload_internal` — confirming the REAL production
//! decoder/encoder handle every real vector payload exactly, without
//! needing any test-only fixture decoder (unlike
//! `nip44_stream_cipher_vectors`/`nip44_wire_decrypt_vectors`, Stage
//! 230/232, which predate this module and still use their own small
//! test-only base64 helper — left UNCHANGED by this stage).
//!
//! Uses `serde`/`serde_json`/`hex` — already `[dev-dependencies]`-only in
//! `Cargo.toml` since Stage 75/77, exactly like every other NIP-44 vector
//! module.
#![cfg(test)]

use super::nip44_wire_encoding::{
    decode_wire_payload_internal, encode_wire_payload_internal, Nip44WireEncodingStatus,
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
    nonce: String,
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
fn decode_wire_payload_internal_extracts_the_documented_nonce_for_all_valid_encrypt_decrypt_cases() {
    let data = category_data("valid.encrypt_decrypt");
    let cases: Vec<ValidEncryptDecryptCase> =
        serde_json::from_value(data).expect("valid.encrypt_decrypt data must parse");
    assert!(!cases.is_empty());

    for case in &cases {
        let expected_nonce = hex_to_32_bytes(&case.nonce);
        let decision = decode_wire_payload_internal(&case.payload);
        assert_eq!(
            decision.status,
            Nip44WireEncodingStatus::Ready,
            "expected Ready for payload={}",
            case.payload
        );
        let payload = decision
            .payload
            .expect("Ready decision must carry a payload");
        assert_eq!(payload.nonce, expected_nonce);
        assert!(payload.ciphertext.is_some());
        assert!(payload.mac.is_some());
    }
}

#[test]
fn encode_wire_payload_internal_reproduces_the_documented_payload_string_exactly() {
    let data = category_data("valid.encrypt_decrypt");
    let cases: Vec<ValidEncryptDecryptCase> =
        serde_json::from_value(data).expect("valid.encrypt_decrypt data must parse");

    for case in &cases {
        let decoded = decode_wire_payload_internal(&case.payload);
        let payload = decoded
            .payload
            .expect("Ready decision must carry a payload");
        let ciphertext = payload.ciphertext.expect("expected real ciphertext");
        let mac = payload.mac.expect("expected real mac");

        let re_encoded = encode_wire_payload_internal(&payload.nonce, &ciphertext, &mac);
        assert_eq!(
            re_encoded, case.payload,
            "re-encoded payload must match the vector's own payload string exactly"
        );
    }
}
