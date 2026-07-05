//! Stage 235 — NIP-44 v2 `invalid.decrypt` vector verification,
//! `#[cfg(test)]` ONLY. Wires `test-vectors/nip44/nip44-v2.json`'s
//! `invalid.decrypt` category (12 cases: unknown version ×2, invalid
//! base64, invalid MAC ×2, invalid padding ×3, invalid payload length
//! ×4) against
//! `crypto::nip44_wire_decrypt::decrypt_wire_payload_from_bytes_internal`
//! — confirming EVERY case collapses to
//! `Nip44WireDecryptStatus::InvalidPayload` or `AuthenticationFailed`,
//! never a more detailed reason, and never `Ready`.
//!
//! Uses the REAL production decode/decrypt pipeline
//! (`crypto::nip44_wire_encoding::decode_wire_payload_internal`, Stage
//! 234; `crypto::nip44_wire_decrypt`, Stage 232/235) directly — no
//! test-only base64 helper is needed here, unlike
//! `nip44_stream_cipher_vectors`/`nip44_wire_decrypt_vectors` (Stage
//! 230/232, which predate the real decoder and still use their own,
//! left UNCHANGED by this stage).
//!
//! Uses `serde`/`serde_json`/`hex` — already `[dev-dependencies]`-only in
//! `Cargo.toml` since Stage 75/77, exactly like every other NIP-44 vector
//! module.
#![cfg(test)]

use super::nip44_wire_decrypt::{decrypt_wire_payload_from_bytes_internal, Nip44WireDecryptStatus};

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
struct InvalidDecryptCase {
    conversation_key: String,
    #[allow(dead_code)]
    nonce: String,
    #[serde(default)]
    payload: String,
    note: String,
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
fn invalid_decrypt_vectors_all_collapse_to_invalid_payload_or_authentication_failed() {
    let data = category_data("invalid.decrypt");
    let cases: Vec<InvalidDecryptCase> =
        serde_json::from_value(data).expect("invalid.decrypt data must parse");
    assert!(!cases.is_empty());

    for case in &cases {
        let conversation_key = hex_to_32_bytes(&case.conversation_key);
        let decision = decrypt_wire_payload_from_bytes_internal(&conversation_key, &case.payload);
        assert!(
            matches!(
                decision.status,
                Nip44WireDecryptStatus::InvalidPayload
                    | Nip44WireDecryptStatus::AuthenticationFailed
            ),
            "expected InvalidPayload or AuthenticationFailed for note={:?}, got {:?}",
            case.note,
            decision.status
        );
        assert!(decision.plaintext.is_none(), "note={:?}", case.note);
    }
}

#[test]
fn invalid_decrypt_category_has_the_documented_twelve_cases() {
    let data = category_data("invalid.decrypt");
    let cases: Vec<InvalidDecryptCase> =
        serde_json::from_value(data).expect("invalid.decrypt data must parse");
    assert_eq!(cases.len(), 12);
}
