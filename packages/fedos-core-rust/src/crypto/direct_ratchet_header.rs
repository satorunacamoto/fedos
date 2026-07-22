//! Secure Runtime Alpha 5481-5560 — the Direct Ratchet's own versioned,
//! transport-neutral, internal wire header (Phase G). A FIXED-LAYOUT binary
//! encoding, never JSON — `serde_json` is a `[dev-dependencies]`-only crate
//! in this repository (`Cargo.toml`'s own comment), unavailable to
//! production code, so this format is hand-rolled the same way
//! `master_seed_sealed_envelope_codec` hand-rolls its own fixed-key-order
//! encoding elsewhere in this crate.
//!
//! Strict field count (exactly seven fields, no open-ended map), bounded
//! sizes (`session_id`/`sender_device_ref` capped, matching the Foundation
//! Arc's own `MAX_COMPONENT_LENGTH` precedent), and no trailing bytes after
//! the last field (this format's own "unknown-field rejection" — since the
//! layout is fixed, any additional bytes are necessarily tamper/corruption,
//! never a legitimate future field this decoder simply ignores).
//!
//! No secret material of any kind — every field here is public metadata
//! that BECOMES the AEAD Additional Authenticated Data for the message it
//! travels with (`direct_ratchet::seal_direct_ratchet_message_internal`),
//! never message content itself.
#![allow(dead_code)]

const SCHEMA_VERSION: u8 = 1;
const SUITE_LABEL: &[u8] = b"fedos-direct-ratchet-v1";
const MAX_BOUNDED_STRING_LEN: usize = 256;

pub(crate) struct DirectRatchetHeaderFields {
    pub(crate) session_id: String,
    pub(crate) sender_device_ref: String,
    pub(crate) ratchet_public_key: [u8; 32],
    pub(crate) message_number: u32,
    pub(crate) previous_chain_length: u32,
    pub(crate) generation: u32,
}

fn write_bounded_string(out: &mut Vec<u8>, value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.is_empty() || bytes.len() > MAX_BOUNDED_STRING_LEN {
        return false;
    }
    out.extend_from_slice(&(bytes.len() as u32).to_be_bytes());
    out.extend_from_slice(bytes);
    true
}

fn read_bounded_string(input: &[u8], offset: &mut usize) -> Option<String> {
    if input.len() < *offset + 4 {
        return None;
    }
    let mut len_bytes = [0u8; 4];
    len_bytes.copy_from_slice(&input[*offset..*offset + 4]);
    let len = u32::from_be_bytes(len_bytes) as usize;
    *offset += 4;
    if len == 0 || len > MAX_BOUNDED_STRING_LEN || input.len() < *offset + len {
        return None;
    }
    let value = std::str::from_utf8(&input[*offset..*offset + len]).ok()?.to_string();
    *offset += len;
    Some(value)
}

/// Encodes `fields` into the canonical fixed-layout header bytes. Returns
/// `None` (never a panic) if either string field is empty or exceeds the
/// bounded length — fail closed on a malformed CALLER input, never a
/// truncated/partial header.
pub(crate) fn encode_direct_ratchet_header(fields: &DirectRatchetHeaderFields) -> Option<Vec<u8>> {
    let mut out = Vec::with_capacity(64 + fields.session_id.len() + fields.sender_device_ref.len());
    out.push(SCHEMA_VERSION);
    out.extend_from_slice(&(SUITE_LABEL.len() as u32).to_be_bytes());
    out.extend_from_slice(SUITE_LABEL);
    if !write_bounded_string(&mut out, &fields.session_id) {
        return None;
    }
    if !write_bounded_string(&mut out, &fields.sender_device_ref) {
        return None;
    }
    out.extend_from_slice(&fields.ratchet_public_key);
    out.extend_from_slice(&fields.message_number.to_be_bytes());
    out.extend_from_slice(&fields.previous_chain_length.to_be_bytes());
    out.extend_from_slice(&fields.generation.to_be_bytes());
    Some(out)
}

/// Strict decode: rejects an unrecognized schema version, an unrecognized
/// suite label, a malformed/oversized bounded string, a truncated buffer,
/// AND any trailing byte after the last fixed field (this format's own
/// unknown-field/tamper-append rejection). Never panics.
pub(crate) fn decode_direct_ratchet_header(input: &[u8]) -> Option<DirectRatchetHeaderFields> {
    if input.is_empty() {
        return None;
    }
    let mut offset = 0usize;
    if input[offset] != SCHEMA_VERSION {
        return None;
    }
    offset += 1;

    if input.len() < offset + 4 {
        return None;
    }
    let mut suite_len_bytes = [0u8; 4];
    suite_len_bytes.copy_from_slice(&input[offset..offset + 4]);
    let suite_len = u32::from_be_bytes(suite_len_bytes) as usize;
    offset += 4;
    if suite_len != SUITE_LABEL.len() || input.len() < offset + suite_len {
        return None;
    }
    if &input[offset..offset + suite_len] != SUITE_LABEL {
        return None;
    }
    offset += suite_len;

    let session_id = read_bounded_string(input, &mut offset)?;
    let sender_device_ref = read_bounded_string(input, &mut offset)?;

    if input.len() < offset + 32 {
        return None;
    }
    let mut ratchet_public_key = [0u8; 32];
    ratchet_public_key.copy_from_slice(&input[offset..offset + 32]);
    offset += 32;

    if input.len() < offset + 12 {
        return None;
    }
    let mut message_number_bytes = [0u8; 4];
    message_number_bytes.copy_from_slice(&input[offset..offset + 4]);
    offset += 4;
    let mut previous_chain_length_bytes = [0u8; 4];
    previous_chain_length_bytes.copy_from_slice(&input[offset..offset + 4]);
    offset += 4;
    let mut generation_bytes = [0u8; 4];
    generation_bytes.copy_from_slice(&input[offset..offset + 4]);
    offset += 4;

    // No trailing bytes permitted -- this format's own unknown-field/tamper-append rejection.
    if offset != input.len() {
        return None;
    }

    Some(DirectRatchetHeaderFields {
        session_id,
        sender_device_ref,
        ratchet_public_key,
        message_number: u32::from_be_bytes(message_number_bytes),
        previous_chain_length: u32::from_be_bytes(previous_chain_length_bytes),
        generation: u32::from_be_bytes(generation_bytes),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_fields() -> DirectRatchetHeaderFields {
        DirectRatchetHeaderFields {
            session_id: "session-1".to_string(),
            sender_device_ref: "device-1".to_string(),
            ratchet_public_key: [0x42; 32],
            message_number: 5,
            previous_chain_length: 3,
            generation: 0,
        }
    }

    #[test]
    fn round_trips_exactly() {
        let fields = sample_fields();
        let encoded = encode_direct_ratchet_header(&fields).expect("must encode");
        let decoded = decode_direct_ratchet_header(&encoded).expect("must decode");
        assert_eq!(decoded.session_id, fields.session_id);
        assert_eq!(decoded.sender_device_ref, fields.sender_device_ref);
        assert_eq!(decoded.ratchet_public_key, fields.ratchet_public_key);
        assert_eq!(decoded.message_number, fields.message_number);
        assert_eq!(decoded.previous_chain_length, fields.previous_chain_length);
        assert_eq!(decoded.generation, fields.generation);
    }

    #[test]
    fn rejects_empty_input() {
        assert!(decode_direct_ratchet_header(&[]).is_none());
    }

    #[test]
    fn rejects_unknown_schema_version() {
        let fields = sample_fields();
        let mut encoded = encode_direct_ratchet_header(&fields).expect("must encode");
        encoded[0] = 2;
        assert!(decode_direct_ratchet_header(&encoded).is_none());
    }

    #[test]
    fn rejects_a_truncated_header() {
        let fields = sample_fields();
        let encoded = encode_direct_ratchet_header(&fields).expect("must encode");
        assert!(decode_direct_ratchet_header(&encoded[..encoded.len() - 5]).is_none());
    }

    #[test]
    fn rejects_trailing_bytes() {
        let fields = sample_fields();
        let mut encoded = encode_direct_ratchet_header(&fields).expect("must encode");
        encoded.push(0xFF);
        assert!(decode_direct_ratchet_header(&encoded).is_none());
    }

    #[test]
    fn rejects_an_empty_session_id() {
        let mut fields = sample_fields();
        fields.session_id = String::new();
        assert!(encode_direct_ratchet_header(&fields).is_none());
    }

    #[test]
    fn rejects_an_oversized_session_id() {
        let mut fields = sample_fields();
        fields.session_id = "x".repeat(1000);
        assert!(encode_direct_ratchet_header(&fields).is_none());
    }

    #[test]
    fn a_bit_flip_anywhere_in_the_header_changes_its_bytes() {
        let fields = sample_fields();
        let mut encoded = encode_direct_ratchet_header(&fields).expect("must encode");
        let original = encoded.clone();
        let flip_at = encoded.len() / 2;
        encoded[flip_at] ^= 0x01;
        assert_ne!(encoded, original);
    }
}
