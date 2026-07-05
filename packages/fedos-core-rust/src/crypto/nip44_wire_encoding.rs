//! Stage 234 — the real NIP-44 v2 wire payload encoding: `base64(version_byte
//! ‖ nonce[32] ‖ ciphertext ‖ mac[32])`, hand-implemented (standard base64,
//! RFC 4648 §4) against ONLY `core`/`alloc` — no `base64` crate is
//! adopted. Crate-private only — see `src/crypto.rs`'s module-level doc
//! comment for this module's place in the `crypto` tree.
//!
//! **This is STANDARD base64 (`+`/`/`, `=` padding) — NOT the base64url
//! (`-`/`_`, no padding) `crypto::ciphertext_serialization` (Stage 186)
//! already uses for this crate's OWN, separate ciphertext envelope
//! format.** The two are deliberately SEPARATE implementations, never
//! shared or generalized into one codec — `docs/nip44_wire_payload_layout.md`
//! already named this as a deliberate choice (NIP-44 v2's spec requires
//! standard base64; this crate's own envelope format separately chose
//! base64url), and this module does not import from, call, or modify
//! `ciphertext_serialization` in any way.
//!
//! [`encode_wire_payload_internal`] builds the fixed field order —
//! `version_byte (0x02, from crate::nip44_wire_payload::NIP44_WIRE_VERSION_TAG_V2)`
//! ‖ `nonce (32 bytes)` ‖ `ciphertext (variable)` ‖ `mac (32 bytes)` —
//! then base64-encodes it. It cannot fail for any input (concatenation
//! and encoding have no failure mode at these fixed/variable lengths), so
//! it returns a plain `String`, not a `Status`/`Decision` pair.
//!
//! [`decode_wire_payload_internal`] validates an UNTRUSTED CANDIDATE wire
//! string STRUCTURALLY: malformed base64 (invalid character, wrong
//! length, misplaced padding) → [`Nip44WireEncodingStatus::InvalidPayload`];
//! decoded length too short to carry `version ‖ nonce ‖ mac` (65 bytes
//! minimum) → `InvalidPayload`; a `version_byte` other than `0x02` →
//! `InvalidPayload`. It performs NO authentication and NO decryption —
//! `ciphertext`/`mac` byte CONTENT is never inspected here; only
//! structural shape is checked (mirroring
//! `crypto::nip44_wire_payload::validate_wire_payload_placeholder`'s own
//! "structural checks only" discipline). Reuses
//! `crypto::nip44_wire_payload::Nip44WirePayload` (UNCHANGED) as its own
//! output shape — this is the SECOND way that type gets built, alongside
//! `Nip44WirePayloadBuilder::build_placeholder`'s placeholder path.
//!
//! **What this module is NOT**: no ChaCha20, no HMAC, no encrypt/decrypt
//! pipeline (see `crypto::nip44_wire_encrypt`/`crypto::nip44_wire_decrypt`),
//! no `ciphertext_serialization` connection or modification, no public
//! API, no Runtime/Worker/Storage/Relay/Nostr connection, no new
//! `Cargo.toml` dependency.
#![allow(dead_code)]

use super::nip44_wire::Nip44WireVersion;
use super::nip44_wire_payload::{Nip44WirePayload, NIP44_WIRE_VERSION_TAG_V2};

/// The minimum number of decoded bytes a candidate wire payload must
/// carry to even structurally hold `version (1)` ‖ `nonce (32)` ‖ `mac
/// (32)` — 65 bytes. A real payload's `ciphertext` is never actually
/// empty (the minimum padded ciphertext is 34 bytes, per
/// `crypto::nip44_padding::calc_padded_len`'s own minimum), but THAT
/// semantic check is left to the downstream HMAC/unpad pipeline
/// (`crypto::nip44_wire_decrypt`) — this module only guarantees enough
/// bytes exist to extract the three fixed-size/variable fields at all.
const NIP44_WIRE_PAYLOAD_MINIMUM_LENGTH: usize = 1 + 32 + 32;

const BASE64_STANDARD_ALPHABET: &[u8; 64] =
    b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/// Coarse observable outcome of a [`decode_wire_payload_internal`] call —
/// exactly two variants, never a more detailed reason (malformed
/// base64, wrong version, and too-short-to-parse all collapse into the
/// same `InvalidPayload` label). Crate-private only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Nip44WireEncodingStatus {
    /// The candidate decoded successfully and passed every structural
    /// check; `Nip44WireDecodeDecision::payload` is `Some`.
    Ready,
    /// The candidate failed base64 decoding, was too short, or named an
    /// unsupported version — a SINGLE fixed label covering all three,
    /// never distinguishing which.
    InvalidPayload,
}

/// The result of a [`decode_wire_payload_internal`] call. Crate-private
/// only.
pub(crate) struct Nip44WireDecodeDecision {
    pub(crate) status: Nip44WireEncodingStatus,
    pub(crate) payload: Option<Nip44WirePayload>,
}

/// Standard base64 encode (RFC 4648 §4, WITH `=` padding) — hand-written,
/// no `base64` crate. Never fails for any input.
fn base64_standard_encode_internal(data: &[u8]) -> String {
    let mut output = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0];
        let b1 = chunk.get(1).copied().unwrap_or(0);
        let b2 = chunk.get(2).copied().unwrap_or(0);
        let n = (u32::from(b0) << 16) | (u32::from(b1) << 8) | u32::from(b2);

        output.push(BASE64_STANDARD_ALPHABET[((n >> 18) & 0x3F) as usize] as char);
        output.push(BASE64_STANDARD_ALPHABET[((n >> 12) & 0x3F) as usize] as char);
        output.push(if chunk.len() > 1 {
            BASE64_STANDARD_ALPHABET[((n >> 6) & 0x3F) as usize] as char
        } else {
            '='
        });
        output.push(if chunk.len() > 2 {
            BASE64_STANDARD_ALPHABET[(n & 0x3F) as usize] as char
        } else {
            '='
        });
    }
    output
}

/// Standard base64 decode (RFC 4648 §4) — hand-written, no `base64`
/// crate. Rejects (`None`): an empty input, a length not a multiple of
/// 4, any byte outside the standard alphabet/`=`, more than two `=`
/// characters, or any `=` that is not among the final two positions of
/// the string. Never panics: every index used here is bounds-checked by
/// construction (`chunks(4)` on a length-multiple-of-4 slice always
/// yields full 4-byte chunks; `u8 as usize` into a 256-entry lookup
/// table is always in range).
fn base64_standard_decode_internal(input: &str) -> Option<Vec<u8>> {
    let bytes = input.as_bytes();
    if bytes.is_empty() || bytes.len() % 4 != 0 {
        return None;
    }

    let mut lookup = [255u8; 256];
    for (i, &b) in BASE64_STANDARD_ALPHABET.iter().enumerate() {
        lookup[b as usize] = i as u8;
    }

    let mut padding_count = 0usize;
    for (i, &b) in bytes.iter().enumerate() {
        if b == b'=' {
            padding_count += 1;
            if i < bytes.len().saturating_sub(2) {
                return None;
            }
        } else {
            if padding_count > 0 {
                return None;
            }
            if lookup[b as usize] == 255 {
                return None;
            }
        }
    }
    if padding_count > 2 {
        return None;
    }

    let mut output = Vec::with_capacity(bytes.len() / 4 * 3);
    for chunk in bytes.chunks(4) {
        let is_pad2 = chunk[2] == b'=';
        let is_pad3 = chunk[3] == b'=';
        let v0 = lookup[chunk[0] as usize];
        let v1 = lookup[chunk[1] as usize];
        let v2 = if is_pad2 { 0 } else { lookup[chunk[2] as usize] };
        let v3 = if is_pad3 { 0 } else { lookup[chunk[3] as usize] };
        let n = (u32::from(v0) << 18) | (u32::from(v1) << 12) | (u32::from(v2) << 6) | u32::from(v3);

        output.push((n >> 16) as u8);
        if !is_pad2 {
            output.push((n >> 8) as u8);
        }
        if !is_pad3 {
            output.push(n as u8);
        }
    }
    Some(output)
}

/// Build the NIP-44 v2 wire payload string: `base64(version_byte (0x02)
/// ‖ nonce ‖ ciphertext ‖ mac)`. Takes the already-sealed `ciphertext`
/// and already-computed `mac` directly — this function performs NO
/// ChaCha20 encryption and NO HMAC computation of its own (see
/// `crypto::nip44_stream_cipher`/`crypto::nip44_hmac` for those). Cannot
/// fail for any input.
pub(crate) fn encode_wire_payload_internal(
    nonce: &[u8; 32],
    ciphertext: &[u8],
    mac: &[u8; 32],
) -> String {
    let mut buffer = Vec::with_capacity(1 + 32 + ciphertext.len() + 32);
    buffer.push(NIP44_WIRE_VERSION_TAG_V2);
    buffer.extend_from_slice(nonce);
    buffer.extend_from_slice(ciphertext);
    buffer.extend_from_slice(mac);
    base64_standard_encode_internal(&buffer)
}

/// Decode and structurally validate a candidate NIP-44 v2 wire payload
/// string. Checks, in order: base64 well-formedness, minimum decoded
/// length (65 bytes — enough for `version ‖ nonce ‖ mac`), then the
/// `version_byte` itself. The first failing check short-circuits with
/// [`Nip44WireEncodingStatus::InvalidPayload`] — no partial/best-effort
/// payload is ever returned. Performs NO authentication, NO decryption,
/// and NO inspection of `ciphertext`/`mac` byte content — see this
/// module's own doc comment above.
pub(crate) fn decode_wire_payload_internal(payload: &str) -> Nip44WireDecodeDecision {
    let decoded = match base64_standard_decode_internal(payload) {
        Some(bytes) => bytes,
        None => {
            return Nip44WireDecodeDecision {
                status: Nip44WireEncodingStatus::InvalidPayload,
                payload: None,
            };
        }
    };

    if decoded.len() < NIP44_WIRE_PAYLOAD_MINIMUM_LENGTH {
        return Nip44WireDecodeDecision {
            status: Nip44WireEncodingStatus::InvalidPayload,
            payload: None,
        };
    }

    if decoded[0] != NIP44_WIRE_VERSION_TAG_V2 {
        return Nip44WireDecodeDecision {
            status: Nip44WireEncodingStatus::InvalidPayload,
            payload: None,
        };
    }

    let nonce: [u8; 32] = match decoded[1..33].try_into() {
        Ok(bytes) => bytes,
        Err(_) => {
            return Nip44WireDecodeDecision {
                status: Nip44WireEncodingStatus::InvalidPayload,
                payload: None,
            };
        }
    };
    let mac: [u8; 32] = match decoded[decoded.len() - 32..].try_into() {
        Ok(bytes) => bytes,
        Err(_) => {
            return Nip44WireDecodeDecision {
                status: Nip44WireEncodingStatus::InvalidPayload,
                payload: None,
            };
        }
    };
    let ciphertext = decoded[33..decoded.len() - 32].to_vec();

    Nip44WireDecodeDecision {
        status: Nip44WireEncodingStatus::Ready,
        payload: Some(Nip44WirePayload {
            version: Nip44WireVersion::V2,
            nonce,
            ciphertext: Some(ciphertext),
            mac: Some(mac),
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_then_decode_round_trips() {
        let nonce = [0x11u8; 32];
        let ciphertext = vec![0x22u8; 34];
        let mac = [0x33u8; 32];
        let encoded = encode_wire_payload_internal(&nonce, &ciphertext, &mac);

        let decision = decode_wire_payload_internal(&encoded);
        assert_eq!(decision.status, Nip44WireEncodingStatus::Ready);
        let payload = decision.payload.expect("Ready must carry a payload");
        assert_eq!(payload.version, Nip44WireVersion::V2);
        assert_eq!(payload.nonce, nonce);
        assert_eq!(payload.ciphertext, Some(ciphertext));
        assert_eq!(payload.mac, Some(mac));
    }

    #[test]
    fn encode_then_decode_round_trips_for_empty_ciphertext() {
        let nonce = [0x44u8; 32];
        let ciphertext: Vec<u8> = Vec::new();
        let mac = [0x55u8; 32];
        let encoded = encode_wire_payload_internal(&nonce, &ciphertext, &mac);
        let decision = decode_wire_payload_internal(&encoded);
        assert_eq!(decision.status, Nip44WireEncodingStatus::Ready);
        let payload = decision.payload.expect("Ready must carry a payload");
        assert_eq!(payload.ciphertext, Some(Vec::new()));
    }

    #[test]
    fn decode_rejects_empty_string() {
        let decision = decode_wire_payload_internal("");
        assert_eq!(decision.status, Nip44WireEncodingStatus::InvalidPayload);
        assert!(decision.payload.is_none());
    }

    #[test]
    fn decode_rejects_a_length_not_a_multiple_of_four() {
        let decision = decode_wire_payload_internal("AAAAA");
        assert_eq!(decision.status, Nip44WireEncodingStatus::InvalidPayload);
    }

    #[test]
    fn decode_rejects_an_invalid_character() {
        let decision = decode_wire_payload_internal("#AAA");
        assert_eq!(decision.status, Nip44WireEncodingStatus::InvalidPayload);
    }

    #[test]
    fn decode_rejects_padding_in_the_middle() {
        let decision = decode_wire_payload_internal("A=AA");
        assert_eq!(decision.status, Nip44WireEncodingStatus::InvalidPayload);
    }

    #[test]
    fn decode_rejects_too_short_a_decoded_payload() {
        // "AAAA" decodes to 3 bytes - far short of the 65-byte minimum.
        let decision = decode_wire_payload_internal("AAAA");
        assert_eq!(decision.status, Nip44WireEncodingStatus::InvalidPayload);
    }

    #[test]
    fn decode_rejects_a_wrong_version_byte() {
        let nonce = [0x11u8; 32];
        let ciphertext = vec![0x22u8; 34];
        let mac = [0x33u8; 32];
        let mut buffer = Vec::new();
        buffer.push(0x01u8); // wrong version
        buffer.extend_from_slice(&nonce);
        buffer.extend_from_slice(&ciphertext);
        buffer.extend_from_slice(&mac);
        let encoded = base64_standard_encode_internal(&buffer);
        let decision = decode_wire_payload_internal(&encoded);
        assert_eq!(decision.status, Nip44WireEncodingStatus::InvalidPayload);
    }

    #[test]
    fn nip44_wire_encoding_status_has_no_variant_other_than_the_two_specified() {
        for status in [
            Nip44WireEncodingStatus::Ready,
            Nip44WireEncodingStatus::InvalidPayload,
        ] {
            match status {
                Nip44WireEncodingStatus::Ready => {}
                Nip44WireEncodingStatus::InvalidPayload => {}
            }
        }
    }
}
