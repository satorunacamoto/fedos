//! Stage 225–226 — a NIP-44 v2 wire payload SKELETON builder and its
//! structural-only validator. Crate-private only — see
//! `src/crypto.rs`'s module-level doc comment for this module's place in
//! the `crypto` tree.
//!
//! Stage 225: [`Nip44WirePayload`] holds the fixed field order
//! `docs/nip44_wire_payload_layout.md` (Stage 216) already fixed —
//! `version` ‖ `nonce` ‖ `ciphertext` ‖ `mac` — with `version` fixed to
//! `Nip44WireVersion::V2` and `nonce` REAL (drawn via
//! `crypto::nip44_wire_nonce::generate_wire_nonce_internal`, Stage 224).
//! `ciphertext`/`mac` stay `None` — PLACEHOLDER ONLY — since no ChaCha20
//! stream cipher or HMAC-SHA256 tag computation exists anywhere in this
//! crate yet. [`Nip44WirePayloadBuilder::build_placeholder`] is the ONE
//! constructor; it takes no ciphertext, plaintext, or MAC input of any
//! kind — there is nothing here for it to accept.
//!
//! Stage 226: [`validate_wire_payload_placeholder`] checks a CANDIDATE
//! payload's raw field values STRUCTURALLY ONLY — the version tag, the
//! nonce's length, and whether a ciphertext/MAC value is present at all
//! — mirroring `crypto::ciphertext_envelope::validate_envelope_internal`'s
//! own "untrusted candidate, structural checks only" shape. It performs
//! NO authentication, NO decryption, NO HMAC verification, and NO
//! base64 decoding of any kind — there is no cryptographic primitive
//! behind any of these fields yet to authenticate against. Calling it
//! against [`Nip44WirePayloadBuilder::build_placeholder`]'s own output
//! correctly reports [`Nip44WirePayloadValidationStatus::MissingField`]
//! (ciphertext/MAC are still absent) — this validator names what
//! "wire-valid" WILL mean once a later stage wires real encryption, it
//! does not pretend today's skeleton already satisfies it.
//!
//! **What this module is NOT**: no ChaCha20 stream-cipher call, no
//! HMAC-SHA256 call, no base64 encode/decode, no wire encode/decode (no
//! function anywhere in this module turns a [`Nip44WirePayload`] into
//! bytes or back), no connection to `crypto::nip44_encrypt`/
//! `nip44_decrypt`/`nip44_bridge` (the Stage 202–206 "FedOS internal
//! NIP-44-like bridge" — untouched), no public API, no Runtime/Worker/
//! Storage/Relay connection, no new `Cargo.toml` dependency.
#![allow(dead_code)]

use super::nip44_wire::Nip44WireVersion;
use super::nip44_wire_nonce::{generate_wire_nonce_internal, Nip44WireNonceStatus};

/// NIP-44 v2's fixed wire version byte, per
/// `docs/nip44_wire_payload_layout.md`'s own field table — the ONE value
/// [`validate_wire_payload_placeholder`] ever accepts as valid. Crate-private only.
pub(crate) const NIP44_WIRE_VERSION_TAG_V2: u8 = 0x02;

/// Coarse observable outcome of a
/// [`Nip44WirePayloadBuilder::build_placeholder`] call. Crate-private
/// only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Nip44WirePayloadStatus {
    /// A payload skeleton was built — `version`/`nonce` are real,
    /// `ciphertext`/`mac` are still placeholder (`None`).
    Placeholder,
    /// The underlying wire nonce draw
    /// (`crypto::nip44_wire_nonce::generate_wire_nonce_internal`) failed
    /// — there is no fallback, no degraded payload.
    InternalFailure,
}

/// A NIP-44 v2 wire payload SKELETON — `version` ‖ `nonce` ‖
/// `ciphertext` ‖ `mac`, per `docs/nip44_wire_payload_layout.md`'s fixed
/// field order. `version` is always [`Nip44WireVersion::V2`]; `nonce` is
/// a REAL 32-byte value (Stage 224); `ciphertext`/`mac` are `None` —
/// PLACEHOLDER ONLY, since no ChaCha20 stream cipher or HMAC-SHA256 tag
/// computation exists anywhere in this crate yet. Crate-private only;
/// not part of this crate's public API.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Nip44WirePayload {
    pub(crate) version: Nip44WireVersion,
    pub(crate) nonce: [u8; 32],
    pub(crate) ciphertext: Option<Vec<u8>>,
    pub(crate) mac: Option<[u8; 32]>,
}

/// The result of a [`Nip44WirePayloadBuilder::build_placeholder`] call.
/// Crate-private only.
pub(crate) struct Nip44WirePayloadDecision {
    pub(crate) status: Nip44WirePayloadStatus,
    pub(crate) payload: Option<Nip44WirePayload>,
}

/// A builder for [`Nip44WirePayload`] skeletons. Crate-private only; not
/// part of this crate's public API.
pub(crate) struct Nip44WirePayloadBuilder;

impl Nip44WirePayloadBuilder {
    /// Build a [`Nip44WirePayload`] skeleton: `version` fixed to
    /// [`Nip44WireVersion::V2`], `nonce` freshly drawn via
    /// `crypto::nip44_wire_nonce::generate_wire_nonce_internal`,
    /// `ciphertext`/`mac` left `None` (placeholder). Takes NO ciphertext,
    /// plaintext, key, or MAC input of any kind — there is nothing here
    /// for this constructor to accept. Returns
    /// [`Nip44WirePayloadStatus::InternalFailure`] with `payload: None`
    /// if the underlying nonce draw fails — never a payload with a
    /// zeroed or degraded nonce.
    pub(crate) fn build_placeholder() -> Nip44WirePayloadDecision {
        let nonce_decision = generate_wire_nonce_internal();
        match (nonce_decision.status, nonce_decision.nonce) {
            (Nip44WireNonceStatus::Ready, Some(nonce)) => Nip44WirePayloadDecision {
                status: Nip44WirePayloadStatus::Placeholder,
                payload: Some(Nip44WirePayload {
                    version: Nip44WireVersion::V2,
                    nonce,
                    ciphertext: None,
                    mac: None,
                }),
            },
            _ => Nip44WirePayloadDecision {
                status: Nip44WirePayloadStatus::InternalFailure,
                payload: None,
            },
        }
    }
}

/// Coarse observable outcome of a [`validate_wire_payload_placeholder`]
/// call. Crate-private only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Nip44WirePayloadValidationStatus {
    /// Every structural check passed — `version_tag` matched
    /// [`NIP44_WIRE_VERSION_TAG_V2`], `nonce` was exactly 32 bytes, and
    /// both `ciphertext`/`mac` were reported present. This does NOT mean
    /// the payload authenticates, decrypts, or is otherwise
    /// cryptographically valid — no such check exists in this module.
    Valid,
    /// The candidate `version_tag` did not match
    /// [`NIP44_WIRE_VERSION_TAG_V2`]. Checked FIRST, mirroring
    /// `crypto::ciphertext_envelope::validate_envelope_internal`'s own
    /// "version must be checked before any other field is interpreted"
    /// rule.
    InvalidVersion,
    /// The candidate `nonce` slice was not exactly 32 bytes.
    InvalidNonceLength,
    /// The candidate `ciphertext` or `mac` value was reported absent —
    /// exactly what `Nip44WirePayloadBuilder::build_placeholder`'s own
    /// output looks like today, since no ChaCha20/HMAC code exists yet.
    /// This is a STRUCTURAL check only (presence, not correctness).
    MissingField,
}

/// The result of a [`validate_wire_payload_placeholder`] call.
/// Crate-private only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Nip44WirePayloadValidationDecision {
    pub(crate) status: Nip44WirePayloadValidationStatus,
}

/// Validate an UNTRUSTED CANDIDATE set of wire payload field values —
/// the same shape a future wire decoder would need to check before
/// trusting bytes read off the wire (no such decoder exists yet; see
/// this module's own doc comment above). Checks, in order:
/// `version_tag` first, then `nonce`'s length, then whether
/// `ciphertext_present`/`mac_present` are both `true`. The first failing
/// check short-circuits with its own fixed
/// [`Nip44WirePayloadValidationStatus`] — no partial/best-effort result
/// is ever returned. Performs NO authentication, NO decryption, NO HMAC
/// verification, and NO base64 decoding — `ciphertext_present`/
/// `mac_present` report PRESENCE only, never inspecting or validating
/// the underlying bytes.
pub(crate) fn validate_wire_payload_placeholder(
    version_tag: u8,
    nonce: &[u8],
    ciphertext_present: bool,
    mac_present: bool,
) -> Nip44WirePayloadValidationDecision {
    if version_tag != NIP44_WIRE_VERSION_TAG_V2 {
        return Nip44WirePayloadValidationDecision {
            status: Nip44WirePayloadValidationStatus::InvalidVersion,
        };
    }
    if nonce.len() != 32 {
        return Nip44WirePayloadValidationDecision {
            status: Nip44WirePayloadValidationStatus::InvalidNonceLength,
        };
    }
    if !ciphertext_present || !mac_present {
        return Nip44WirePayloadValidationDecision {
            status: Nip44WirePayloadValidationStatus::MissingField,
        };
    }
    Nip44WirePayloadValidationDecision {
        status: Nip44WirePayloadValidationStatus::Valid,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_placeholder_returns_a_real_v2_nonce_with_placeholder_ciphertext_and_mac() {
        let decision = Nip44WirePayloadBuilder::build_placeholder();
        assert_eq!(decision.status, Nip44WirePayloadStatus::Placeholder);
        let payload = decision.payload.expect("Placeholder must carry a payload");
        assert_eq!(payload.version, Nip44WireVersion::V2);
        assert!(payload.ciphertext.is_none());
        assert!(payload.mac.is_none());
    }

    #[test]
    fn build_placeholder_draws_a_fresh_nonce_each_call() {
        let first = Nip44WirePayloadBuilder::build_placeholder();
        let second = Nip44WirePayloadBuilder::build_placeholder();
        let first_payload = first.payload.expect("expected a payload");
        let second_payload = second.payload.expect("expected a payload");
        assert_ne!(first_payload.nonce, second_payload.nonce);
    }

    #[test]
    fn validate_wire_payload_placeholder_rejects_a_wrong_version_tag() {
        let decision = validate_wire_payload_placeholder(0x01, &[0u8; 32], true, true);
        assert_eq!(
            decision.status,
            Nip44WirePayloadValidationStatus::InvalidVersion
        );
    }

    #[test]
    fn validate_wire_payload_placeholder_rejects_a_wrong_length_nonce() {
        let too_short = validate_wire_payload_placeholder(NIP44_WIRE_VERSION_TAG_V2, &[0u8; 31], true, true);
        assert_eq!(
            too_short.status,
            Nip44WirePayloadValidationStatus::InvalidNonceLength
        );
        let too_long = validate_wire_payload_placeholder(NIP44_WIRE_VERSION_TAG_V2, &[0u8; 33], true, true);
        assert_eq!(
            too_long.status,
            Nip44WirePayloadValidationStatus::InvalidNonceLength
        );
    }

    #[test]
    fn validate_wire_payload_placeholder_reports_missing_field_when_ciphertext_or_mac_absent() {
        let no_ciphertext = validate_wire_payload_placeholder(NIP44_WIRE_VERSION_TAG_V2, &[0u8; 32], false, true);
        assert_eq!(
            no_ciphertext.status,
            Nip44WirePayloadValidationStatus::MissingField
        );
        let no_mac = validate_wire_payload_placeholder(NIP44_WIRE_VERSION_TAG_V2, &[0u8; 32], true, false);
        assert_eq!(no_mac.status, Nip44WirePayloadValidationStatus::MissingField);
        let neither = validate_wire_payload_placeholder(NIP44_WIRE_VERSION_TAG_V2, &[0u8; 32], false, false);
        assert_eq!(neither.status, Nip44WirePayloadValidationStatus::MissingField);
    }

    #[test]
    fn validate_wire_payload_placeholder_reports_valid_when_every_structural_check_passes() {
        let decision = validate_wire_payload_placeholder(NIP44_WIRE_VERSION_TAG_V2, &[0u8; 32], true, true);
        assert_eq!(decision.status, Nip44WirePayloadValidationStatus::Valid);
    }

    #[test]
    fn a_freshly_built_placeholder_payload_is_not_yet_wire_valid() {
        // Documents, in a runnable test, that Stage 225's own builder
        // output does NOT yet satisfy Stage 226's own validator — exactly
        // the honest "skeleton only, no real encoding yet" state this
        // module's doc comment describes.
        let built = Nip44WirePayloadBuilder::build_placeholder();
        let payload = built.payload.expect("expected a payload");
        let validated = validate_wire_payload_placeholder(
            NIP44_WIRE_VERSION_TAG_V2,
            &payload.nonce,
            payload.ciphertext.is_some(),
            payload.mac.is_some(),
        );
        assert_eq!(
            validated.status,
            Nip44WirePayloadValidationStatus::MissingField
        );
    }

    #[test]
    fn nip44_wire_payload_status_has_no_variant_other_than_the_two_specified() {
        for status in [
            Nip44WirePayloadStatus::Placeholder,
            Nip44WirePayloadStatus::InternalFailure,
        ] {
            match status {
                Nip44WirePayloadStatus::Placeholder => {}
                Nip44WirePayloadStatus::InternalFailure => {}
            }
        }
    }

    #[test]
    fn nip44_wire_payload_validation_status_has_no_variant_other_than_the_four_specified() {
        for status in [
            Nip44WirePayloadValidationStatus::Valid,
            Nip44WirePayloadValidationStatus::InvalidVersion,
            Nip44WirePayloadValidationStatus::InvalidNonceLength,
            Nip44WirePayloadValidationStatus::MissingField,
        ] {
            match status {
                Nip44WirePayloadValidationStatus::Valid => {}
                Nip44WirePayloadValidationStatus::InvalidVersion => {}
                Nip44WirePayloadValidationStatus::InvalidNonceLength => {}
                Nip44WirePayloadValidationStatus::MissingField => {}
            }
        }
    }
}
