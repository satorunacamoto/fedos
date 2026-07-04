//! Stage 230 — NIP-44 v2 ChaCha20 STREAM CIPHER vector verification,
//! `#[cfg(test)]` ONLY. Wires `test-vectors/nip44/nip44-v2.json`'s
//! `valid.encrypt_decrypt` category (10 cases) against
//! `crypto::nip44_stream_cipher::encrypt_stream_internal` — comparing
//! ONLY the raw ChaCha20 ciphertext bytes, not the HMAC tag (see
//! `crypto::nip44_hmac`, Stage 231, for the separate MAC verification)
//! and not the base64/version/nonce wire framing (out of this stage's
//! scope entirely).
//!
//! Reuses `crypto::nip44_message_keys::derive_message_keys_exact_from_bytes_internal`
//! (Stage 219–220, UNCHANGED) for `chacha_key`/`chacha_nonce`, and
//! `crypto::nip44_padding::pad_message` (Stage 202–203, UNCHANGED) for
//! padding — neither is touched by this module; both were already
//! vector-verified in their own stages.
//!
//! **A test-only base64 STANDARD decoder lives in this file, and ONLY
//! this file's `#[cfg(test)]` scope.** It exists SOLELY to unpack this
//! ONE fixture's `payload` field (there is no other way to recover the
//! vector's expected ciphertext bytes for comparison — `valid.encrypt_decrypt`
//! supplies no separate hex `ciphertext` field). It is NOT a production
//! capability: it is never `pub`, never `pub(crate)`, never reachable
//! from any production code path, and adds NO `Cargo.toml` dependency
//! (hand-written against `core`/`alloc` only, mirroring
//! `crypto::ciphertext_serialization`'s own precedent of hand-written
//! base64url — Stage 186 — for exactly the same "no new dependency"
//! reason). This is a fixture-decoding detail of a test module, not the
//! "wire encode/decode"/"base64 implementation" this crate's own
//! `docs/nip44_wire_compatibility_gap.md`/`docs/nip44_wire_implementation_roadmap.md`
//! still name as a LATER, separate, unimplemented stage.
//!
//! Uses `serde`/`serde_json`/`hex` — already `[dev-dependencies]`-only in
//! `Cargo.toml` since Stage 75/77, exactly like every other NIP-44 vector
//! module.
#![cfg(test)]

use super::nip44_message_keys::{derive_message_keys_exact_from_bytes_internal, Nip44DerivedKeyKind, Nip44MessageKeyStatus};
use super::nip44_padding::pad_message;
use super::nip44_stream_cipher::encrypt_stream_internal;

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

/// A test-fixture-ONLY standard base64 decoder — see this file's own
/// module-level doc comment for why this exists and why it is not a
/// production capability. Panics on malformed input, which is
/// acceptable here: the input is this repository's own trusted,
/// already-committed test-vector fixture, never untrusted data.
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

fn chacha_key_and_nonce_from(conversation_key: &[u8; 32], nonce: &[u8; 32]) -> ([u8; 32], [u8; 12]) {
    let decisions = derive_message_keys_exact_from_bytes_internal(conversation_key, nonce);
    let chacha_key_bytes = decisions
        .iter()
        .find(|d| d.kind == Nip44DerivedKeyKind::ChachaKey)
        .expect("expected a ChachaKey decision");
    assert_eq!(chacha_key_bytes.status, Nip44MessageKeyStatus::Ready);
    let chacha_nonce_bytes = decisions
        .iter()
        .find(|d| d.kind == Nip44DerivedKeyKind::ChachaNonce)
        .expect("expected a ChachaNonce decision");
    assert_eq!(chacha_nonce_bytes.status, Nip44MessageKeyStatus::Ready);

    let chacha_key: [u8; 32] = chacha_key_bytes
        .bytes
        .as_deref()
        .expect("Ready ChachaKey must carry bytes")
        .try_into()
        .expect("chacha_key must be 32 bytes");
    let chacha_nonce: [u8; 12] = chacha_nonce_bytes
        .bytes
        .as_deref()
        .expect("Ready ChachaNonce must carry bytes")
        .try_into()
        .expect("chacha_nonce must be 12 bytes");
    (chacha_key, chacha_nonce)
}

#[test]
fn valid_encrypt_decrypt_vectors_all_produce_the_documented_chacha20_ciphertext() {
    let data = category_data("valid.encrypt_decrypt");
    let cases: Vec<ValidEncryptDecryptCase> =
        serde_json::from_value(data).expect("valid.encrypt_decrypt data must parse");
    assert!(!cases.is_empty());

    for case in &cases {
        let conversation_key = hex_to_32_bytes(&case.conversation_key);
        let nonce = hex_to_32_bytes(&case.nonce);
        let (chacha_key, chacha_nonce) = chacha_key_and_nonce_from(&conversation_key, &nonce);

        let padded = pad_message(case.plaintext.as_bytes())
            .output
            .expect("pad_message must succeed for a valid-length plaintext");
        let computed_ciphertext = encrypt_stream_internal(&chacha_key, &chacha_nonce, &padded);

        let decoded_payload = base64_standard_decode_for_test_fixture(&case.payload);
        assert!(
            decoded_payload.len() > 1 + 32 + 32,
            "decoded payload must be long enough to carry version+nonce+mac"
        );
        let expected_ciphertext = &decoded_payload[33..decoded_payload.len() - 32];

        assert_eq!(
            computed_ciphertext, expected_ciphertext,
            "ChaCha20 stream ciphertext mismatch for plaintext={:?}",
            case.plaintext
        );
    }
}

#[test]
fn valid_encrypt_decrypt_category_has_the_documented_ten_cases() {
    let data = category_data("valid.encrypt_decrypt");
    let cases: Vec<ValidEncryptDecryptCase> =
        serde_json::from_value(data).expect("valid.encrypt_decrypt data must parse");
    assert_eq!(cases.len(), 10);
}
