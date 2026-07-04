//! Stage 220 — NIP-44 v2 message-key vector verification, `#[cfg(test)]`
//! ONLY. Wires `test-vectors/nip44/nip44-v2.json`'s
//! `valid.get_message_keys` category (32 cases, one shared
//! `conversation_key`, 32 distinct `nonce`s) against
//! `nip44_message_keys::derive_message_keys_exact_from_bytes_internal` —
//! the REAL cryptographic verification `nip44_vector_schema` (Stage
//! 186–188) deliberately deferred (that module only checks the fixture's
//! SCHEMA, never its content), exactly like `nip44_conversation_key_vectors`
//! (Stage 199) and `nip44_padding_vectors` (Stage 203) before it.
//!
//! Uses the byte-level `derive_message_keys_exact_from_bytes_internal`
//! entry point, not `derive_message_keys_exact_internal` — this
//! category's fixture supplies a raw `conversation_key` value with no
//! corresponding `sec1`/`pub2` pair in `valid.get_conversation_key`, so
//! there is no way to reproduce it through `ConversationKey`'s own ECDH
//! constructor (see `nip44_message_keys`'s own module-level doc comment
//! for the full record). This is `invalid` category free: NIP-44 v2's
//! reference vector set defines no `invalid.get_message_keys` category
//! (Stage 220 only wires the `valid` category, per this stage's own
//! scope — invalid-input handling for THIS function is instead already
//! covered by `nip44_message_keys`'s own `#[cfg(test)]` unit tests, e.g.
//! `derive_message_keys_exact_internal_rejects_placeholder_conversation_key`).
//!
//! Uses `serde`/`serde_json`/`hex` — already `[dev-dependencies]`-only in
//! `Cargo.toml` since Stage 75/77, exactly like every other NIP-44 vector
//! module.
#![cfg(test)]

use super::nip44_message_keys::{derive_message_keys_exact_from_bytes_internal, Nip44DerivedKeyKind, Nip44MessageKeyStatus};

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
struct ValidGetMessageKeysCase {
    nonce: String,
    chacha_key: String,
    chacha_nonce: String,
    hmac_key: String,
}

#[derive(Debug, serde::Deserialize)]
struct ValidGetMessageKeysData {
    conversation_key: String,
    keys: Vec<ValidGetMessageKeysCase>,
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
fn valid_get_message_keys_vectors_all_match_chacha_key_chacha_nonce_and_hmac_key() {
    let data = category_data("valid.get_message_keys");
    let fixture: ValidGetMessageKeysData =
        serde_json::from_value(data).expect("valid.get_message_keys data must parse");
    assert!(!fixture.keys.is_empty());

    let conversation_key_bytes = hex_to_32_bytes(&fixture.conversation_key);

    for case in &fixture.keys {
        let nonce_bytes = hex_to_32_bytes(&case.nonce);
        let decisions =
            derive_message_keys_exact_from_bytes_internal(&conversation_key_bytes, &nonce_bytes);

        for decision in &decisions {
            assert_eq!(
                decision.status,
                Nip44MessageKeyStatus::Ready,
                "expected Ready for nonce={}",
                case.nonce
            );
        }

        let chacha_key = decisions
            .iter()
            .find(|d| d.kind == Nip44DerivedKeyKind::ChachaKey)
            .and_then(|d| d.bytes.as_ref())
            .expect("Ready ChachaKey decision must carry bytes");
        let chacha_nonce = decisions
            .iter()
            .find(|d| d.kind == Nip44DerivedKeyKind::ChachaNonce)
            .and_then(|d| d.bytes.as_ref())
            .expect("Ready ChachaNonce decision must carry bytes");
        let hmac_key = decisions
            .iter()
            .find(|d| d.kind == Nip44DerivedKeyKind::HmacKey)
            .and_then(|d| d.bytes.as_ref())
            .expect("Ready HmacKey decision must carry bytes");

        assert_eq!(
            hex::encode(chacha_key),
            case.chacha_key,
            "chacha_key mismatch for nonce={}",
            case.nonce
        );
        assert_eq!(
            hex::encode(chacha_nonce),
            case.chacha_nonce,
            "chacha_nonce mismatch for nonce={}",
            case.nonce
        );
        assert_eq!(
            hex::encode(hmac_key),
            case.hmac_key,
            "hmac_key mismatch for nonce={}",
            case.nonce
        );
    }
}

#[test]
fn valid_get_message_keys_category_has_the_documented_thirty_two_cases() {
    let data = category_data("valid.get_message_keys");
    let fixture: ValidGetMessageKeysData =
        serde_json::from_value(data).expect("valid.get_message_keys data must parse");
    assert_eq!(fixture.keys.len(), 32);
}
