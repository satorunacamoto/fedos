//! Stage 203 — NIP-44 v2 padding vector verification, `#[cfg(test)]`
//! ONLY. Wires `test-vectors/nip44/nip44-v2.json`'s `valid.calc_padded_len`
//! (24 cases) against `nip44_padding::calc_padded_len`, and its
//! `invalid.encrypt_msg_lengths` (4 cases) against
//! `nip44_padding::pad_message`'s own length-bounds rejection — the REAL
//! cryptographic/structural verification `nip44_vector_schema` (Stage
//! 186–188) deliberately deferred (that module only checks the fixture's
//! SCHEMA, never its content).
//!
//! Uses `serde`/`serde_json` — already `[dev-dependencies]`-only in
//! `Cargo.toml` since Stage 75/77, exactly like `nip44_vector_schema` and
//! `nip44_conversation_key_vectors`.
#![cfg(test)]

use super::nip44_padding::{calc_padded_len, pad_message, PadStatus};

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

fn category_data(name: &str) -> serde_json::Value {
    let file: Nip44VectorFile =
        serde_json::from_str(NIP44_V2_JSON).expect("NIP-44 v2 vector JSON must parse");
    file.vectors
        .into_iter()
        .find(|v| v.category == name)
        .unwrap_or_else(|| panic!("expected category `{name}` to be present"))
        .data
}

#[test]
fn valid_calc_padded_len_vectors_all_match() {
    let data = category_data("valid.calc_padded_len");
    let cases: Vec<(usize, usize)> =
        serde_json::from_value(data).expect("valid.calc_padded_len data must parse");
    assert!(!cases.is_empty());
    for (input, expected) in cases {
        assert_eq!(
            calc_padded_len(input),
            expected,
            "calc_padded_len({input}) mismatch"
        );
    }
}

#[test]
fn invalid_encrypt_msg_lengths_are_all_rejected_by_pad_message() {
    let data = category_data("invalid.encrypt_msg_lengths");
    let lengths: Vec<usize> =
        serde_json::from_value(data).expect("invalid.encrypt_msg_lengths data must parse");
    assert!(!lengths.is_empty());
    for length in lengths {
        let plaintext = vec![0x41u8; length];
        let decision = pad_message(&plaintext);
        assert_eq!(
            decision.status,
            PadStatus::InvalidLength,
            "expected length {length} to be rejected"
        );
        assert!(decision.output.is_none());
    }
}
