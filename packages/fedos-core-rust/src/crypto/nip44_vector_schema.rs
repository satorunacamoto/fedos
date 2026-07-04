//! Stage 186–188 — NIP-44 v2 vector SCHEMA guard, `#[cfg(test)]` ONLY.
//! This is `docs/nip44_vector_readiness.md` §3's step 1 ("vector schema
//! guard"), implemented — and ONLY step 1. It confirms
//! `test-vectors/nip44/nip44-v2.json` parses and that its 8 vector
//! categories (named in that document's §2 table) are present, each with
//! the expected `shouldPass` polarity and a non-empty `data` payload.
//!
//! **This module performs NO cryptographic verification of any kind.**
//! It does not compute an ECDH shared secret, does not call HKDF, does
//! not derive a conversation key or message keys, does not pad or
//! encrypt/decrypt anything, and does not depend on (or add) a
//! secp256k1/ECDH crate — `Cargo.toml` is unchanged by this module. Steps
//! 2–7 of `docs/nip44_vector_readiness.md` §3 (secp256k1 dependency
//! adoption through the invalid-case test) remain future, separate,
//! explicitly-reviewed stages; this module only proves the FIXTURE this
//! crate would need for all of them is present and well-formed.
//!
//! Uses `serde`/`serde_json` — already `[dev-dependencies]`-only in
//! `Cargo.toml` since Stage 75/77, exactly like the RFC 8439/5869/9106
//! vector modules this one mirrors in shape. This is a TEST-only
//! dependency use, unrelated to `crypto::ciphertext_serialization`'s
//! (Stage 186) deliberate choice not to use `serde_json` in PRODUCTION
//! code — the two are independent decisions for independent code paths.
#![cfg(test)]

use serde::Deserialize;
use serde_json::Value;

/// One top-level vector-file entry. Only the fields this schema guard
/// needs are named; every category's OWN `data` shape differs (some are
/// arrays, some are objects — see `valid.get_message_keys`), so `data`
/// stays an untyped [`Value`] here: this module checks PRESENCE and
/// non-emptiness only, never the cryptographic content inside it.
#[derive(Debug, Deserialize)]
struct Nip44VectorCategory {
    category: String,
    #[serde(rename = "shouldPass")]
    should_pass: bool,
    data: Value,
}

#[derive(Debug, Deserialize)]
struct Nip44VectorFile {
    algorithm: String,
    vectors: Vec<Nip44VectorCategory>,
}

/// The NIP-44 v2 vector file imported verbatim in Stage 73, read at
/// compile time so this guard has no filesystem/IO dependency at runtime
/// — same discipline as `RFC8439_JSON`/`RFC5869_JSON`/`RFC9106_JSON`.
const NIP44_V2_JSON: &str = include_str!("../../../../test-vectors/nip44/nip44-v2.json");

/// The exact 8 categories `docs/nip44_vector_readiness.md` §2 names,
/// each paired with its expected `shouldPass` polarity — a CLOSED set;
/// this guard checks the vector file contains exactly these, no more, no
/// fewer.
const EXPECTED_CATEGORIES: &[(&str, bool)] = &[
    ("valid.get_conversation_key", true),
    ("valid.get_message_keys", true),
    ("valid.calc_padded_len", true),
    ("valid.encrypt_decrypt", true),
    ("valid.encrypt_decrypt_long_msg", true),
    ("invalid.encrypt_msg_lengths", false),
    ("invalid.get_conversation_key", false),
    ("invalid.decrypt", false),
];

/// True for a non-null JSON value that is also non-empty if it happens to
/// be an array or object — schema/presence only, never a value-content
/// check.
fn is_non_empty_schema_value(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Array(items) => !items.is_empty(),
        Value::Object(fields) => !fields.is_empty(),
        _ => true,
    }
}

fn parsed_file() -> Nip44VectorFile {
    serde_json::from_str(NIP44_V2_JSON).expect("NIP-44 v2 vector JSON must parse")
}

#[test]
fn nip44_v2_json_parses_and_is_non_empty() {
    let file = parsed_file();
    assert!(
        !file.vectors.is_empty(),
        "expected at least one NIP-44 v2 vector category"
    );
}

#[test]
fn nip44_v2_declares_the_expected_algorithm_description() {
    let file = parsed_file();
    assert!(
        file.algorithm.contains("NIP-44 v2"),
        "expected the algorithm field to name NIP-44 v2, got: {}",
        file.algorithm
    );
    // Sanity-named only, per docs/nip44_internal_plan.md §2 — this guard
    // does not verify the pipeline these words name, only that the
    // fixture is the one this crate's planning docs already describe.
    assert!(file.algorithm.contains("secp256k1"));
    assert!(file.algorithm.contains("HKDF"));
    assert!(file.algorithm.contains("ChaCha20"));
    assert!(file.algorithm.contains("HMAC"));
}

#[test]
fn nip44_v2_contains_exactly_the_eight_expected_categories_no_more_no_fewer() {
    let file = parsed_file();
    let mut actual: Vec<&str> = file.vectors.iter().map(|v| v.category.as_str()).collect();
    actual.sort_unstable();
    let mut expected: Vec<&str> = EXPECTED_CATEGORIES.iter().map(|(name, _)| *name).collect();
    expected.sort_unstable();
    assert_eq!(actual, expected);
}

#[test]
fn every_expected_category_has_the_documented_shouldpass_polarity_and_non_empty_data() {
    let file = parsed_file();
    for (expected_name, expected_should_pass) in EXPECTED_CATEGORIES {
        let entry = file
            .vectors
            .iter()
            .find(|v| v.category == *expected_name)
            .unwrap_or_else(|| panic!("expected category `{expected_name}` to be present"));
        assert_eq!(
            entry.should_pass, *expected_should_pass,
            "category `{expected_name}` has unexpected shouldPass polarity"
        );
        assert!(
            is_non_empty_schema_value(&entry.data),
            "category `{expected_name}` has empty or null `data`"
        );
    }
}

#[test]
fn valid_categories_and_only_valid_categories_have_shouldpass_true() {
    let file = parsed_file();
    for vector in &file.vectors {
        let expects_pass = vector.category.starts_with("valid.");
        let expects_fail = vector.category.starts_with("invalid.");
        assert!(
            expects_pass || expects_fail,
            "category `{}` matches neither the valid.* nor invalid.* naming convention",
            vector.category
        );
        assert_eq!(
            vector.should_pass, expects_pass,
            "category `{}`'s shouldPass does not match its valid./invalid. name",
            vector.category
        );
    }
}

#[test]
fn get_message_keys_data_is_an_object_carrying_a_conversation_key_and_a_keys_array() {
    // The one category whose `data` is an object rather than an array
    // (docs/nip44_vector_readiness.md §2 row 2) — a schema/shape check
    // only, never reading the actual key-derivation bytes.
    let file = parsed_file();
    let entry = file
        .vectors
        .iter()
        .find(|v| v.category == "valid.get_message_keys")
        .expect("valid.get_message_keys must be present");
    let object = entry.data.as_object().expect("data must be a JSON object");
    assert!(object.contains_key("conversation_key"));
    let keys = object
        .get("keys")
        .and_then(Value::as_array)
        .expect("data.keys must be a non-empty array");
    assert!(!keys.is_empty());
}
