//! Stage 199 — NIP-44 v2 conversation-key vector verification,
//! `#[cfg(test)]` ONLY. Wires `test-vectors/nip44/nip44-v2.json`'s
//! `valid.get_conversation_key` (35 cases) and `invalid.get_conversation_key`
//! (8 cases) categories against
//! `conversation_key::derive_conversation_key_via_ecdh_internal` — the
//! REAL cryptographic verification `nip44_vector_schema` (Stage 186–188)
//! deliberately deferred (that module only checks the fixture's SCHEMA,
//! never its cryptographic content).
//!
//! Uses `serde`/`serde_json`/`hex` — already `[dev-dependencies]`-only in
//! `Cargo.toml` since Stage 75/77, exactly like `nip44_vector_schema` and
//! the RFC 8439/5869/9106 vector modules.
#![cfg(test)]

use super::conversation_key::{derive_conversation_key_via_ecdh_internal, ConversationKeyStatus};
use crate::secret_handle::{SecretHandle, SecretHandleKind};
use serde::Deserialize;

const NIP44_V2_JSON: &str = include_str!("../../../../test-vectors/nip44/nip44-v2.json");

#[derive(Debug, Deserialize)]
struct Nip44VectorCategory {
    category: String,
    data: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct Nip44VectorFile {
    vectors: Vec<Nip44VectorCategory>,
}

#[derive(Debug, Deserialize)]
struct ValidGetConversationKeyCase {
    sec1: String,
    pub2: String,
    conversation_key: String,
}

#[derive(Debug, Deserialize)]
struct InvalidGetConversationKeyCase {
    sec1: String,
    pub2: String,
    #[allow(dead_code)]
    note: String,
}

fn parsed_file() -> Nip44VectorFile {
    serde_json::from_str(NIP44_V2_JSON).expect("NIP-44 v2 vector JSON must parse")
}

fn category_data(name: &str) -> serde_json::Value {
    let file = parsed_file();
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
fn valid_get_conversation_key_vectors_all_derive_the_documented_conversation_key() {
    let data = category_data("valid.get_conversation_key");
    let cases: Vec<ValidGetConversationKeyCase> =
        serde_json::from_value(data).expect("valid.get_conversation_key data must parse");
    assert!(!cases.is_empty());

    for case in &cases {
        let secret_key = SecretHandle::new_from_32_bytes_for_internal_use(
            SecretHandleKind::NostrKeyMaterial,
            hex_to_32_bytes(&case.sec1),
        );
        let public_key = SecretHandle::new_from_32_bytes_for_internal_use(
            SecretHandleKind::NostrKeyMaterial,
            hex_to_32_bytes(&case.pub2),
        );
        let decision = derive_conversation_key_via_ecdh_internal(&secret_key, &public_key);
        assert_eq!(
            decision.status,
            ConversationKeyStatus::Success,
            "expected Success for sec1={} pub2={}",
            case.sec1,
            case.pub2
        );
        let output = decision.output.expect("Success decision must carry output");
        let actual_bytes = output
            .expose_bytes_for_internal_message_key_derivation()
            .expect("Holding conversation key must expose bytes");
        assert_eq!(
            hex::encode(actual_bytes),
            case.conversation_key,
            "conversation_key mismatch for sec1={} pub2={}",
            case.sec1,
            case.pub2
        );
    }
}

#[test]
fn invalid_get_conversation_key_vectors_all_reject_with_invalid_key() {
    let data = category_data("invalid.get_conversation_key");
    let cases: Vec<InvalidGetConversationKeyCase> =
        serde_json::from_value(data).expect("invalid.get_conversation_key data must parse");
    assert!(!cases.is_empty());

    for case in &cases {
        let secret_key = SecretHandle::new_from_32_bytes_for_internal_use(
            SecretHandleKind::NostrKeyMaterial,
            hex_to_32_bytes(&case.sec1),
        );
        let public_key = SecretHandle::new_from_32_bytes_for_internal_use(
            SecretHandleKind::NostrKeyMaterial,
            hex_to_32_bytes(&case.pub2),
        );
        let decision = derive_conversation_key_via_ecdh_internal(&secret_key, &public_key);
        assert_eq!(
            decision.status,
            ConversationKeyStatus::InvalidKey,
            "expected InvalidKey for case: {}",
            case.note
        );
        assert!(decision.output.is_none());
    }
}
