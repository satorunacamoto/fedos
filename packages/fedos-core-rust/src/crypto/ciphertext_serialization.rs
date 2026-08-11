//! Stage 186 — the ciphertext envelope's canonical JSON + base64url wire
//! encoding, IMPLEMENTED. Crate-private only — see `src/crypto.rs`'s
//! module-level doc comment for this module's place in the `crypto` tree.
//!
//! `docs/ciphertext_serialization_format_decision.md` (Stage 182) picked
//! canonical JSON + base64url fields as this crate's MVP wire encoding and
//! fixed the canonical field order (`v`/`alg`/`aad`/`n`/`ct`/`tag`) — this
//! module is that decision's first real implementation:
//! [`encode_envelope_internal`] turns a real (non-placeholder)
//! `super::ciphertext_envelope::AeadCiphertextEnvelope` into that exact
//! wire string; [`decode_envelope_internal`] parses one back, REJECTING
//! (never panicking on) an unrecognized version/algorithm/AAD-domain
//! label, an out-of-canonical-order or missing/extra field, or invalid
//! base64url text.
//!
//! # No new dependency
//!
//! `serde`/`serde_json`/`hex` remain `[dev-dependencies]`-only in
//! `Cargo.toml`, exactly as before this stage — promoting any of them to
//! `[dependencies]` was explicitly NOT authorized for this stage (see
//! `docs/ciphertext_serialization_format_decision.md` §5/§6). This
//! module's JSON emission/parsing and base64url encoding/decoding are
//! hand-written against the STANDARD LIBRARY ONLY, made tractable (and
//! genuinely safe, not just expedient) by this format's CLOSED schema:
//! every value is either a small fixed-label string (`alg`/`aad`, drawn
//! from a short enum), a small decimal integer (`v`), or base64url text
//! (`n`/`ct`/`tag`) — the base64url alphabet contains no `"` or `\`, so
//! this module's string-value scanning (stopping at the next `"`) never
//! needs general JSON string-escape handling. Any input that smuggles in
//! such a character (or anything else outside this closed schema) is
//! rejected by a LATER validation step even if the structural scan
//! mis-splits it — see this module's own test suite for the adversarial
//! cases this reasoning is checked against. This is NOT a general-purpose
//! JSON parser and must never be reused as one.
//!
//! # Field order is STRICT, both ways
//!
//! [`encode_envelope_internal`] always emits keys in the canonical order;
//! [`decode_envelope_internal`] requires them in that SAME order —
//! `docs/ciphertext_serialization_format_decision.md` §3 explicitly left
//! this leniency choice to the implementing stage, and this stage picks
//! the strict reading (a reordered document is REJECTED, not tolerated).
//! This also lets the decoder be a simple sequential scan rather than a
//! general out-of-order object parser.
//!
//! # `ct`/`tag` are split wire fields; the in-memory type keeps them combined
//!
//! `AeadCiphertextEnvelope::ciphertext()` still returns ONE combined
//! `ciphertext‖tag` buffer in memory (Stage 161's resolution, unchanged).
//! This module splits that buffer at its final [`AEAD_TAG_LEN`] (16) bytes
//! ONLY at the wire boundary — both this crate's adopted AEAD ciphers
//! (ChaCha20-Poly1305, AES-256-GCM) produce a 16-byte tag. If the combined
//! buffer is shorter than 16 bytes (only possible for a Stage 157–158
//! SKELETON placeholder envelope, never a real sealed one),
//! [`encode_envelope_internal`] returns `None` rather than panicking on
//! the split.
//!
//! # Scope
//!
//! Connects to the REAL `AeadCiphertextEnvelope` type (per this stage's
//! explicit authorization), but is not called by, and does not call,
//! `fedos_encrypt`/`fedos_decrypt`, `crypto::aead_envelope_bridge`, or
//! `crypto::ciphertext_transport` — wiring this codec into any of those is
//! its own, future, separate, explicitly-reviewed stage. No public API
//! addition (every item here is `pub(crate)` at most); no Runtime/Worker/
//! Storage/Nostr/NIP-44/WASM connection; no `Cargo.toml` change.
#![allow(dead_code)]

use super::ciphertext_envelope::{
    AeadCiphertextEnvelope, AeadEnvelopeAadDomain, AeadEnvelopeAlgorithm, AeadEnvelopeVersion,
};

/// The fixed AEAD authentication tag length (bytes) both ciphers this
/// crate has adopted (ChaCha20-Poly1305, AES-256-GCM) produce — the
/// split point between the wire `ct` and `tag` fields.
const AEAD_TAG_LEN: usize = 16;

const BASE64URL_ALPHABET: &[u8; 64] =
    b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/// RFC 4648 §5 base64url, NO padding. Infallible: every byte slice has a
/// base64url encoding.
fn base64url_encode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0];
        let b1 = *chunk.get(1).unwrap_or(&0);
        let b2 = *chunk.get(2).unwrap_or(&0);
        let n = ((b0 as u32) << 16) | ((b1 as u32) << 8) | (b2 as u32);
        out.push(BASE64URL_ALPHABET[((n >> 18) & 0x3F) as usize] as char);
        out.push(BASE64URL_ALPHABET[((n >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            out.push(BASE64URL_ALPHABET[((n >> 6) & 0x3F) as usize] as char);
        }
        if chunk.len() > 2 {
            out.push(BASE64URL_ALPHABET[(n & 0x3F) as usize] as char);
        }
    }
    out
}

/// Maps one base64url ASCII byte to its 6-bit value, or `None` for any
/// character outside the base64url alphabet — this is the ONE place
/// standard-base64 `+`/`/`, padding `=`, whitespace, and every other
/// non-base64url byte are all rejected uniformly (none of them match any
/// arm below).
fn base64url_decode_byte(byte: u8) -> Option<u8> {
    match byte {
        b'A'..=b'Z' => Some(byte - b'A'),
        b'a'..=b'z' => Some(byte - b'a' + 26),
        b'0'..=b'9' => Some(byte - b'0' + 52),
        b'-' => Some(62),
        b'_' => Some(63),
        _ => None,
    }
}

/// RFC 4648 §5 base64url decode, NO padding accepted. Returns `None` for
/// any invalid character (including standard-base64 `+`/`/`, `=`
/// padding, or whitespace) or an invalid unpadded length (`len % 4 == 1`
/// is never valid). Never panics — every index/slice access below is
/// guarded by the length checks that precede it.
fn base64url_decode(text: &str) -> Option<Vec<u8>> {
    let bytes = text.as_bytes();
    if bytes.len() % 4 == 1 {
        return None;
    }
    let mut out = Vec::with_capacity(bytes.len() / 4 * 3 + 3);
    let mut i = 0;
    while i + 4 <= bytes.len() {
        let c0 = base64url_decode_byte(bytes[i])?;
        let c1 = base64url_decode_byte(bytes[i + 1])?;
        let c2 = base64url_decode_byte(bytes[i + 2])?;
        let c3 = base64url_decode_byte(bytes[i + 3])?;
        let n = ((c0 as u32) << 18) | ((c1 as u32) << 12) | ((c2 as u32) << 6) | (c3 as u32);
        out.push((n >> 16) as u8);
        out.push((n >> 8) as u8);
        out.push(n as u8);
        i += 4;
    }
    match bytes.len() - i {
        0 => {}
        2 => {
            let c0 = base64url_decode_byte(bytes[i])?;
            let c1 = base64url_decode_byte(bytes[i + 1])?;
            let n = ((c0 as u32) << 18) | ((c1 as u32) << 12);
            out.push((n >> 16) as u8);
        }
        3 => {
            let c0 = base64url_decode_byte(bytes[i])?;
            let c1 = base64url_decode_byte(bytes[i + 1])?;
            let c2 = base64url_decode_byte(bytes[i + 2])?;
            let n = ((c0 as u32) << 18) | ((c1 as u32) << 12) | ((c2 as u32) << 6);
            out.push((n >> 16) as u8);
            out.push((n >> 8) as u8);
        }
        _ => return None,
    }
    Some(out)
}

fn version_to_wire_tag(version: AeadEnvelopeVersion) -> u8 {
    match version {
        AeadEnvelopeVersion::V1 => 1,
    }
}

fn version_from_wire_tag(tag: u8) -> Option<AeadEnvelopeVersion> {
    match tag {
        1 => Some(AeadEnvelopeVersion::V1),
        _ => None,
    }
}

fn algorithm_to_label(algorithm: AeadEnvelopeAlgorithm) -> &'static str {
    match algorithm {
        AeadEnvelopeAlgorithm::ChaCha20Poly1305 => "chacha20poly1305",
        AeadEnvelopeAlgorithm::Aes256Gcm => "aes256gcm",
    }
}

fn algorithm_from_label(label: &str) -> Option<AeadEnvelopeAlgorithm> {
    match label {
        "chacha20poly1305" => Some(AeadEnvelopeAlgorithm::ChaCha20Poly1305),
        "aes256gcm" => Some(AeadEnvelopeAlgorithm::Aes256Gcm),
        _ => None,
    }
}

fn aad_domain_to_label(domain: AeadEnvelopeAadDomain) -> &'static str {
    match domain {
        AeadEnvelopeAadDomain::RootKey => "root_key",
        AeadEnvelopeAadDomain::Identity => "identity",
        AeadEnvelopeAadDomain::Storage => "storage",
        AeadEnvelopeAadDomain::Conversation => "conversation",
        AeadEnvelopeAadDomain::TestOnly => "test_only",
        AeadEnvelopeAadDomain::CommerceMedia => "commerce_media",
    }
}

fn aad_domain_from_label(label: &str) -> Option<AeadEnvelopeAadDomain> {
    match label {
        "root_key" => Some(AeadEnvelopeAadDomain::RootKey),
        "identity" => Some(AeadEnvelopeAadDomain::Identity),
        "storage" => Some(AeadEnvelopeAadDomain::Storage),
        "conversation" => Some(AeadEnvelopeAadDomain::Conversation),
        "test_only" => Some(AeadEnvelopeAadDomain::TestOnly),
        "commerce_media" => Some(AeadEnvelopeAadDomain::CommerceMedia),
        _ => None,
    }
}

/// Coarse observable outcome of a [`decode_envelope_internal`] call. No
/// secret byte is exposed through this label itself — every field this
/// enum validates (version/algorithm/AAD-domain labels, base64url text,
/// JSON structure) is none of it secret, the same reasoning
/// `crypto::ciphertext_envelope::AeadEnvelopeStatus` already documents.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CiphertextSerializationStatus {
    /// Every field validated; `CiphertextSerializationDecision::envelope`
    /// is `Some`.
    Valid,
    /// The candidate `v` value did not match any supported
    /// `AeadEnvelopeVersion`.
    InvalidVersion,
    /// The candidate `alg` value did not match any `AeadEnvelopeAlgorithm`
    /// label.
    InvalidAlgorithm,
    /// The candidate `aad` value did not match any `AeadEnvelopeAadDomain`
    /// label.
    InvalidAadDomain,
    /// The candidate `n`/`ct`/`tag` text was not valid base64url, or (for
    /// `n`/`tag` specifically) decoded to the wrong fixed byte length.
    InvalidBase64Url,
    /// A canonical field was absent at its expected position — including
    /// a field present but OUT OF canonical order (this decoder is
    /// strict both ways, see this module's own doc comment).
    MissingField,
    /// Content remained after the last canonical field's closing `}` was
    /// expected — an extra/unexpected field.
    UnknownField,
    /// A structural JSON violation not covered by the above (e.g. no
    /// opening `{`, a non-digit `v` value, an unterminated string).
    MalformedJson,
}

/// The result of a [`decode_envelope_internal`] call. Crate-private only.
pub(crate) struct CiphertextSerializationDecision {
    pub(crate) status: CiphertextSerializationStatus,
    pub(crate) envelope: Option<AeadCiphertextEnvelope>,
}

/// Serialize `envelope` to this crate's canonical JSON + base64url wire
/// format (`docs/ciphertext_serialization_format_decision.md`), in the
/// fixed key order `v`/`alg`/`aad`/`n`/`ct`/`tag`, with no whitespace
/// (a canonical, byte-for-byte-deterministic emission). Returns `None`
/// only if `envelope`'s combined ciphertext buffer is shorter than
/// [`AEAD_TAG_LEN`] — i.e. `envelope` is a Stage 157–158 SKELETON
/// placeholder, never a real sealed envelope — rather than panicking on
/// the `ct`/`tag` split. Never panics otherwise.
pub(crate) fn encode_envelope_internal(envelope: &AeadCiphertextEnvelope) -> Option<String> {
    let combined = envelope.ciphertext();
    if combined.len() < AEAD_TAG_LEN {
        return None;
    }
    let (ct, tag) = combined.split_at(combined.len() - AEAD_TAG_LEN);
    let v = version_to_wire_tag(envelope.version());
    let alg = algorithm_to_label(envelope.algorithm());
    let aad = aad_domain_to_label(envelope.aad_domain());
    let n_b64 = base64url_encode(&envelope.nonce());
    let ct_b64 = base64url_encode(ct);
    let tag_b64 = base64url_encode(tag);
    Some(format!(
        "{{\"v\":{v},\"alg\":\"{alg}\",\"aad\":\"{aad}\",\"n\":\"{n_b64}\",\"ct\":\"{ct_b64}\",\"tag\":\"{tag_b64}\"}}"
    ))
}

/// Parse `json` — an UNTRUSTED candidate string — against this crate's
/// canonical JSON + base64url wire format, requiring keys in EXACTLY the
/// canonical order (`v`/`alg`/`aad`/`n`/`ct`/`tag`), rejecting an unknown
/// version/algorithm/AAD-domain label, a missing or reordered field, an
/// extra field, or invalid base64url text (or a `tag` that does not
/// decode to exactly [`AEAD_TAG_LEN`] bytes). On success, reconstructs
/// the ONE combined `ciphertext‖tag` buffer
/// `AeadCiphertextEnvelope::new_with_ciphertext_for_internal_use` expects.
/// Never panics — every parse step is guarded, never indexed
/// unconditionally past a checked boundary.
pub(crate) fn decode_envelope_internal(json: &str) -> CiphertextSerializationDecision {
    fn invalid(status: CiphertextSerializationStatus) -> CiphertextSerializationDecision {
        CiphertextSerializationDecision {
            status,
            envelope: None,
        }
    }

    let rest = match json.strip_prefix("{\"v\":") {
        Some(r) => r,
        None => return invalid(CiphertextSerializationStatus::MalformedJson),
    };

    let digits_end = rest
        .find(|c: char| !c.is_ascii_digit())
        .unwrap_or(rest.len());
    let (v_digits, rest) = rest.split_at(digits_end);
    if v_digits.is_empty() {
        return invalid(CiphertextSerializationStatus::MalformedJson);
    }
    let v_tag: u8 = match v_digits.parse() {
        Ok(n) => n,
        Err(_) => return invalid(CiphertextSerializationStatus::MalformedJson),
    };
    let version = match version_from_wire_tag(v_tag) {
        Some(v) => v,
        None => return invalid(CiphertextSerializationStatus::InvalidVersion),
    };

    let rest = match rest.strip_prefix(",\"alg\":\"") {
        Some(r) => r,
        None => return invalid(CiphertextSerializationStatus::MissingField),
    };
    let (alg_str, rest) = match rest.find('"') {
        Some(idx) => (&rest[..idx], &rest[idx + 1..]),
        None => return invalid(CiphertextSerializationStatus::MalformedJson),
    };
    let algorithm = match algorithm_from_label(alg_str) {
        Some(a) => a,
        None => return invalid(CiphertextSerializationStatus::InvalidAlgorithm),
    };

    let rest = match rest.strip_prefix(",\"aad\":\"") {
        Some(r) => r,
        None => return invalid(CiphertextSerializationStatus::MissingField),
    };
    let (aad_str, rest) = match rest.find('"') {
        Some(idx) => (&rest[..idx], &rest[idx + 1..]),
        None => return invalid(CiphertextSerializationStatus::MalformedJson),
    };
    let aad_domain = match aad_domain_from_label(aad_str) {
        Some(a) => a,
        None => return invalid(CiphertextSerializationStatus::InvalidAadDomain),
    };

    let rest = match rest.strip_prefix(",\"n\":\"") {
        Some(r) => r,
        None => return invalid(CiphertextSerializationStatus::MissingField),
    };
    let (n_str, rest) = match rest.find('"') {
        Some(idx) => (&rest[..idx], &rest[idx + 1..]),
        None => return invalid(CiphertextSerializationStatus::MalformedJson),
    };
    let nonce_bytes = match base64url_decode(n_str) {
        Some(b) => b,
        None => return invalid(CiphertextSerializationStatus::InvalidBase64Url),
    };
    let nonce: [u8; 12] = match nonce_bytes.try_into() {
        Ok(arr) => arr,
        Err(_) => return invalid(CiphertextSerializationStatus::InvalidBase64Url),
    };

    let rest = match rest.strip_prefix(",\"ct\":\"") {
        Some(r) => r,
        None => return invalid(CiphertextSerializationStatus::MissingField),
    };
    let (ct_str, rest) = match rest.find('"') {
        Some(idx) => (&rest[..idx], &rest[idx + 1..]),
        None => return invalid(CiphertextSerializationStatus::MalformedJson),
    };
    let ct_bytes = match base64url_decode(ct_str) {
        Some(b) => b,
        None => return invalid(CiphertextSerializationStatus::InvalidBase64Url),
    };

    let rest = match rest.strip_prefix(",\"tag\":\"") {
        Some(r) => r,
        None => return invalid(CiphertextSerializationStatus::MissingField),
    };
    let (tag_str, rest) = match rest.find('"') {
        Some(idx) => (&rest[..idx], &rest[idx + 1..]),
        None => return invalid(CiphertextSerializationStatus::MalformedJson),
    };
    let tag_bytes = match base64url_decode(tag_str) {
        Some(b) => b,
        None => return invalid(CiphertextSerializationStatus::InvalidBase64Url),
    };
    if tag_bytes.len() != AEAD_TAG_LEN {
        return invalid(CiphertextSerializationStatus::InvalidBase64Url);
    }

    if rest != "}" {
        return invalid(CiphertextSerializationStatus::UnknownField);
    }

    let mut combined = ct_bytes;
    combined.extend_from_slice(&tag_bytes);

    CiphertextSerializationDecision {
        status: CiphertextSerializationStatus::Valid,
        envelope: Some(AeadCiphertextEnvelope::new_with_ciphertext_for_internal_use(
            version,
            algorithm,
            nonce,
            aad_domain,
            combined,
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::aead_envelope_bridge::envelope_from_seal_decision_internal;
    use crate::crypto::aead_internal::{seal_internal, AeadAadDomain, AeadCipher, AeadStatus};
    use crate::fedos_aead_nonce_96;
    use crate::secret_handle::{SecretHandle, SecretHandleKind};
    use crate::FedosNonceState;

    const TEST_KEY_BYTES: [u8; 32] = [0x99; 32];
    const TEST_PLAINTEXT: &[u8] = b"fedos ciphertext serialization test plaintext";

    fn test_key() -> SecretHandle {
        SecretHandle::new_from_32_bytes_for_internal_use(SecretHandleKind::AeadKeyMaterial, TEST_KEY_BYTES)
    }

    fn real_envelope(
        cipher: AeadCipher,
        aad_domain: AeadAadDomain,
    ) -> AeadCiphertextEnvelope {
        let key = test_key();
        let nonce_decision = fedos_aead_nonce_96();
        assert_eq!(nonce_decision.state, FedosNonceState::Ready);
        let sealed = seal_internal(cipher, &key, &nonce_decision, aad_domain, TEST_PLAINTEXT);
        assert_eq!(sealed.status, AeadStatus::Ready);
        let nonce_bytes = nonce_decision.nonce.expect("Ready nonce decision must carry bytes");
        envelope_from_seal_decision_internal(sealed, nonce_bytes, aad_domain)
            .expect("Ready seal decision must bridge to an envelope")
    }

    #[test]
    fn encode_then_decode_round_trips_for_both_ciphers_and_every_aad_domain() {
        for cipher in [AeadCipher::ChaCha20Poly1305, AeadCipher::Aes256Gcm] {
            for aad_domain in [
                AeadAadDomain::RootKey,
                AeadAadDomain::Identity,
                AeadAadDomain::Storage,
                AeadAadDomain::Conversation,
                AeadAadDomain::TestOnly,
            ] {
                let envelope = real_envelope(cipher, aad_domain);
                let json = encode_envelope_internal(&envelope)
                    .expect("a real sealed envelope must always encode");
                let decision = decode_envelope_internal(&json);
                assert_eq!(decision.status, CiphertextSerializationStatus::Valid);
                let decoded = decision.envelope.expect("Valid decision must carry an envelope");
                assert_eq!(decoded.version(), envelope.version());
                assert_eq!(decoded.algorithm(), envelope.algorithm());
                assert_eq!(decoded.aad_domain(), envelope.aad_domain());
                assert_eq!(decoded.nonce(), envelope.nonce());
                assert_eq!(decoded.ciphertext(), envelope.ciphertext());
            }
        }
    }

    #[test]
    fn encode_emits_keys_in_the_exact_canonical_order_with_no_whitespace() {
        let envelope = real_envelope(AeadCipher::ChaCha20Poly1305, AeadAadDomain::TestOnly);
        let json = encode_envelope_internal(&envelope).expect("must encode");
        assert!(json.starts_with("{\"v\":"));
        assert!(json.ends_with('}'));
        assert!(!json.contains(' '));
        assert!(!json.contains('\n'));
        assert!(!json.contains('\t'));
        let v_idx = json.find("\"v\":").expect("v key");
        let alg_idx = json.find("\"alg\":").expect("alg key");
        let aad_idx = json.find("\"aad\":").expect("aad key");
        let n_idx = json.find("\"n\":").expect("n key");
        let ct_idx = json.find("\"ct\":").expect("ct key");
        let tag_idx = json.find("\"tag\":").expect("tag key");
        assert!(v_idx < alg_idx);
        assert!(alg_idx < aad_idx);
        assert!(aad_idx < n_idx);
        assert!(n_idx < ct_idx);
        assert!(ct_idx < tag_idx);
    }

    #[test]
    fn decode_rejects_a_reordered_document_even_if_every_field_is_otherwise_present() {
        let envelope = real_envelope(AeadCipher::Aes256Gcm, AeadAadDomain::Storage);
        let json = encode_envelope_internal(&envelope).expect("must encode");
        // Swap the `n` and `ct` fields (both otherwise present and valid).
        let n_start = json.find("\"n\":").unwrap();
        let n_end = json[n_start..].find(",\"ct\":").unwrap() + n_start;
        let ct_start = n_end;
        let ct_end = json[ct_start..].find(",\"tag\":").unwrap() + ct_start;
        let n_field = &json[n_start..n_end];
        let ct_field = &json[ct_start..ct_end];
        let reordered = format!(
            "{}{}{}{}",
            &json[..n_start],
            ct_field,
            n_field,
            &json[ct_end..]
        );
        assert_ne!(reordered, json);
        let decision = decode_envelope_internal(&reordered);
        assert_ne!(decision.status, CiphertextSerializationStatus::Valid);
        assert!(decision.envelope.is_none());
    }

    #[test]
    fn decode_rejects_an_unknown_trailing_field() {
        let envelope = real_envelope(AeadCipher::ChaCha20Poly1305, AeadAadDomain::TestOnly);
        let json = encode_envelope_internal(&envelope).expect("must encode");
        let with_extra = format!("{}{}", &json[..json.len() - 1], ",\"extra\":\"x\"}");
        let decision = decode_envelope_internal(&with_extra);
        assert_eq!(decision.status, CiphertextSerializationStatus::UnknownField);
        assert!(decision.envelope.is_none());
    }

    #[test]
    fn decode_rejects_a_document_missing_the_tag_field() {
        let envelope = real_envelope(AeadCipher::Aes256Gcm, AeadAadDomain::TestOnly);
        let json = encode_envelope_internal(&envelope).expect("must encode");
        let tag_start = json.find(",\"tag\":").unwrap();
        let missing_tag = format!("{}}}", &json[..tag_start]);
        let decision = decode_envelope_internal(&missing_tag);
        assert_eq!(decision.status, CiphertextSerializationStatus::MissingField);
        assert!(decision.envelope.is_none());
    }

    #[test]
    fn decode_rejects_invalid_base64url_in_the_nonce_field() {
        let envelope = real_envelope(AeadCipher::ChaCha20Poly1305, AeadAadDomain::Storage);
        let json = encode_envelope_internal(&envelope).expect("must encode");
        let n_start = json.find("\"n\":\"").unwrap() + "\"n\":\"".len();
        let n_end = json[n_start..].find('"').unwrap() + n_start;
        let corrupted = format!(
            "{}{}{}",
            &json[..n_start],
            "not+valid/base64=pad",
            &json[n_end..]
        );
        let decision = decode_envelope_internal(&corrupted);
        assert_eq!(decision.status, CiphertextSerializationStatus::InvalidBase64Url);
        assert!(decision.envelope.is_none());
    }

    #[test]
    fn decode_rejects_an_unrecognized_version() {
        let envelope = real_envelope(AeadCipher::ChaCha20Poly1305, AeadAadDomain::TestOnly);
        let json = encode_envelope_internal(&envelope).expect("must encode");
        let corrupted = json.replacen("\"v\":1", "\"v\":9", 1);
        let decision = decode_envelope_internal(&corrupted);
        assert_eq!(decision.status, CiphertextSerializationStatus::InvalidVersion);
        assert!(decision.envelope.is_none());
    }

    #[test]
    fn decode_rejects_an_unrecognized_algorithm_label() {
        let envelope = real_envelope(AeadCipher::Aes256Gcm, AeadAadDomain::TestOnly);
        let json = encode_envelope_internal(&envelope).expect("must encode");
        let corrupted = json.replacen("\"aes256gcm\"", "\"des\"", 1);
        let decision = decode_envelope_internal(&corrupted);
        assert_eq!(decision.status, CiphertextSerializationStatus::InvalidAlgorithm);
        assert!(decision.envelope.is_none());
    }

    #[test]
    fn decode_rejects_an_unrecognized_aad_domain_label() {
        let envelope = real_envelope(AeadCipher::ChaCha20Poly1305, AeadAadDomain::Storage);
        let json = encode_envelope_internal(&envelope).expect("must encode");
        let corrupted = json.replacen("\"storage\"", "\"unknown_domain\"", 1);
        let decision = decode_envelope_internal(&corrupted);
        assert_eq!(decision.status, CiphertextSerializationStatus::InvalidAadDomain);
        assert!(decision.envelope.is_none());
    }

    #[test]
    fn encode_returns_none_for_a_stage_157_158_placeholder_envelope() {
        let placeholder = AeadCiphertextEnvelope::new_for_internal_use(
            AeadEnvelopeVersion::V1,
            AeadEnvelopeAlgorithm::ChaCha20Poly1305,
            [0x11; 12],
            AeadEnvelopeAadDomain::TestOnly,
        );
        assert!(placeholder.is_placeholder_ciphertext());
        assert!(encode_envelope_internal(&placeholder).is_none());
    }

    #[test]
    fn base64url_encode_decode_round_trips_and_rejects_standard_base64_chars() {
        for len in 0..=18usize {
            let bytes: Vec<u8> = (0..len as u8).collect();
            let encoded = base64url_encode(&bytes);
            assert!(!encoded.contains('+'));
            assert!(!encoded.contains('/'));
            assert!(!encoded.contains('='));
            assert!(!encoded.contains(char::is_whitespace));
            let decoded = base64url_decode(&encoded).expect("must decode what we just encoded");
            assert_eq!(decoded, bytes);
        }
        assert!(base64url_decode("has+plus").is_none());
        assert!(base64url_decode("has/slash").is_none());
        assert!(base64url_decode("padded==").is_none());
        assert!(base64url_decode("has space").is_none());
        assert!(base64url_decode("has\nnewline").is_none());
        assert!(base64url_decode("a").is_none()); // len % 4 == 1 is never valid
    }

    #[test]
    fn commerce_media_domain_label_round_trips() {
        assert_eq!(aad_domain_to_label(AeadEnvelopeAadDomain::CommerceMedia), "commerce_media");
        assert_eq!(aad_domain_from_label("commerce_media"), Some(AeadEnvelopeAadDomain::CommerceMedia));
    }
}
