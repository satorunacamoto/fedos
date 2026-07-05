//! Stage 232 — the complete NIP-44 v2 wire-compatible DECRYPT pipeline:
//! verify HMAC → decrypt ChaCha20 stream → unpad, in that exact order,
//! collapsing every failure reachable after key derivation into a
//! SINGLE fixed [`Nip44WireDecryptStatus::AuthenticationFailed`] label —
//! never distinguishing a wrong key, a wrong nonce, a tampered
//! ciphertext, an invalid MAC, or a structurally malformed padded
//! plaintext discovered AFTER authentication already succeeded. Mirrors
//! `crypto::nip44_decrypt::Nip44DecryptStatus::AuthenticationFailed`'s
//! own "one label, never distinguishing why" discipline
//! (`docs/nip44_internal_plan.md` §7) — but for the REAL, byte-exact
//! wire pipeline this time, not the "FedOS internal NIP-44-like bridge"
//! (`crypto::nip44_decrypt`, Stage 205, itself completely UNCHANGED and
//! unrelated).
//!
//! Crate-private only — see `src/crypto.rs`'s module-level doc comment
//! for this module's place in the `crypto` tree.
//!
//! **The exact order matters and is authentication-then-decrypt, never
//! the reverse**: [`decrypt_wire_internal`]/[`decrypt_wire_from_bytes_internal`]
//! call `crypto::nip44_hmac::verify_hmac_internal` (Stage 231) BEFORE
//! `crypto::nip44_stream_cipher::decrypt_stream_internal` (Stage 229) is
//! ever invoked — an unauthenticated ciphertext is never decrypted, per
//! `docs/nip44_internal_plan.md` §7's own "HMAC verified BEFORE
//! decryption is attempted" requirement. Unpadding
//! (`crypto::nip44_padding::unpad_message`, Stage 202–203, UNCHANGED)
//! only ever runs on already-authenticated bytes.
//!
//! [`decrypt_wire_internal`] is the `ConversationKey`-facing entry point;
//! it derives `chacha_key`/`chacha_nonce`/`hmac_key` via
//! `crypto::nip44_message_keys::derive_message_keys_exact_internal`
//! (Stage 219, UNCHANGED). [`decrypt_wire_from_bytes_internal`] is a
//! lower-level entry point taking the conversation key's raw bytes
//! directly — kept `pub(crate)` specifically so this module's own vector
//! tests (against `test-vectors/nip44/nip44-v2.json`'s
//! `valid.encrypt_decrypt` category) can feed it a raw `conversation_key`
//! value with no `ConversationKey`-constructing `sec1`/`pub2` pair
//! required, mirroring `crypto::nip44_message_keys`'s own
//! `derive_message_keys_exact_from_bytes_internal` precedent exactly.
//!
//! Stage 235 adds [`decrypt_wire_payload_internal`]/
//! [`decrypt_wire_payload_from_bytes_internal`] — the wire-STRING-facing
//! entry points: decode (`crypto::nip44_wire_encoding::decode_wire_payload_internal`,
//! Stage 234) then delegate to the pipeline above. A fourth
//! `Nip44WireDecryptStatus` variant, `InvalidPayload`, covers encoding-
//! level failures (malformed base64, wrong version, too-short payload)
//! — checked BEFORE any key derivation/HMAC/ChaCha20 call, distinct from
//! both `InvalidConversationKey` (a different structural precondition)
//! and `AuthenticationFailed` (a cryptographic failure reachable only
//! AFTER a payload decodes successfully). Vector-verified against ALL 12
//! `invalid.decrypt` cases by the sibling `#[cfg(test)]`-only
//! `nip44_wire_decrypt_invalid_vectors` module (Stage 235) — every one
//! collapses to `InvalidPayload` or `AuthenticationFailed`, never a more
//! detailed reason.
//!
//! **What this module is NOT**: no encrypt pipeline (see
//! `crypto::nip44_wire_encrypt`, Stage 236), no change to
//! `crypto::conversation_key`/`crypto::message_key`/`crypto::hkdf_bridge`/
//! `crypto::nip44_padding`/`crypto::nip44_wire_payload`/
//! `crypto::nip44_wire_encoding` (all UNCHANGED), no public API, no
//! Runtime/Worker/Storage/Relay/Nostr connection, no new `Cargo.toml`
//! dependency.
#![allow(dead_code)]

use super::conversation_key::ConversationKey;
use super::nip44_hmac::{verify_hmac_internal, Nip44HmacVerifyStatus};
use super::nip44_message_keys::{
    derive_message_keys_exact_from_bytes_internal, derive_message_keys_exact_internal,
    Nip44DerivedKeyKind, Nip44MessageKeyDecision, Nip44MessageKeyStatus,
};
use super::nip44_padding::{unpad_message, PadStatus};
use super::nip44_stream_cipher::decrypt_stream_internal;
use super::nip44_wire_encoding::{decode_wire_payload_internal, Nip44WireEncodingStatus};

/// Coarse observable outcome of a [`decrypt_wire_internal`]/
/// [`decrypt_wire_from_bytes_internal`]/[`decrypt_wire_payload_internal`]/
/// [`decrypt_wire_payload_from_bytes_internal`] call. Crate-private only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Nip44WireDecryptStatus {
    /// Every step succeeded; `Nip44WireDecryptDecision::plaintext` is
    /// `Some` — the original, unpadded plaintext.
    Ready,
    /// The conversation key held no real bytes (a placeholder path, or
    /// an already-`clear()`-ed handle) — checked BEFORE any HMAC/
    /// ChaCha20 call, via `crypto::nip44_message_keys`'s own
    /// `Nip44MessageKeyStatus::InvalidConversationKey`. A structural
    /// precondition failure, distinct from an authentication failure.
    InvalidConversationKey,
    /// The candidate wire payload STRING failed to decode structurally
    /// (malformed base64, wrong version, too short) — checked BEFORE any
    /// key derivation/HMAC/ChaCha20 call. Only reachable via
    /// [`decrypt_wire_payload_internal`]/[`decrypt_wire_payload_from_bytes_internal`]
    /// (the byte-level `decrypt_wire_internal`/`decrypt_wire_from_bytes_internal`
    /// entry points never return this — they take already-decoded
    /// fields). A SINGLE fixed label, never distinguishing which
    /// structural check failed.
    InvalidPayload,
    /// HMAC verification failed, OR (only reachable after HMAC
    /// verification already succeeded) the decrypted, authenticated
    /// bytes were not validly padded — a SINGLE fixed label covering
    /// both causes, never distinguishing which. See this module's own
    /// doc comment above.
    AuthenticationFailed,
}

/// The result of a [`decrypt_wire_internal`]/
/// [`decrypt_wire_from_bytes_internal`] call. Crate-private only.
pub(crate) struct Nip44WireDecryptDecision {
    pub(crate) status: Nip44WireDecryptStatus,
    pub(crate) plaintext: Option<Vec<u8>>,
}

/// Pull kind-matching, `Ready`-status bytes out of a
/// `derive_message_keys_exact_*`-produced triple, converting to a fixed-
/// size array. Returns `None` for anything other than an exact-length
/// `Ready` match — never panics, never `.unwrap()`s.
fn extract_fixed_bytes<const N: usize>(
    decisions: &[Nip44MessageKeyDecision; 3],
    kind: Nip44DerivedKeyKind,
) -> Option<[u8; N]> {
    let decision = decisions.iter().find(|d| d.kind == kind)?;
    if decision.status != Nip44MessageKeyStatus::Ready {
        return None;
    }
    decision.bytes.as_deref()?.try_into().ok()
}

fn invalid_conversation_key_decision() -> Nip44WireDecryptDecision {
    Nip44WireDecryptDecision {
        status: Nip44WireDecryptStatus::InvalidConversationKey,
        plaintext: None,
    }
}

fn authentication_failed_decision() -> Nip44WireDecryptDecision {
    Nip44WireDecryptDecision {
        status: Nip44WireDecryptStatus::AuthenticationFailed,
        plaintext: None,
    }
}

fn invalid_payload_decision() -> Nip44WireDecryptDecision {
    Nip44WireDecryptDecision {
        status: Nip44WireDecryptStatus::InvalidPayload,
        plaintext: None,
    }
}

/// The shared pipeline core: verify HMAC → decrypt ChaCha20 stream →
/// unpad, given already-derived `chacha_key`/`chacha_nonce`/`hmac_key`
/// decisions. Both [`decrypt_wire_internal`] and
/// [`decrypt_wire_from_bytes_internal`] delegate here after their own
/// key-derivation step.
fn decrypt_wire_from_key_decisions(
    key_decisions: &[Nip44MessageKeyDecision; 3],
    nonce: &[u8; 32],
    ciphertext: &[u8],
    mac: &[u8; 32],
) -> Nip44WireDecryptDecision {
    let chacha_key: [u8; 32] =
        match extract_fixed_bytes(key_decisions, Nip44DerivedKeyKind::ChachaKey) {
            Some(bytes) => bytes,
            None => return invalid_conversation_key_decision(),
        };
    let chacha_nonce: [u8; 12] =
        match extract_fixed_bytes(key_decisions, Nip44DerivedKeyKind::ChachaNonce) {
            Some(bytes) => bytes,
            None => return invalid_conversation_key_decision(),
        };
    let hmac_key: [u8; 32] =
        match extract_fixed_bytes(key_decisions, Nip44DerivedKeyKind::HmacKey) {
            Some(bytes) => bytes,
            None => return invalid_conversation_key_decision(),
        };

    // Step 1: verify HMAC BEFORE any decryption is attempted.
    match verify_hmac_internal(&hmac_key, nonce, ciphertext, mac) {
        Nip44HmacVerifyStatus::AuthenticationFailed => return authentication_failed_decision(),
        Nip44HmacVerifyStatus::Verified => {}
    }

    // Step 2: decrypt the ChaCha20 stream — only ever reached after
    // authentication already succeeded.
    let padded = decrypt_stream_internal(&chacha_key, &chacha_nonce, ciphertext);

    // Step 3: unpad — a structurally malformed result here still
    // collapses into the SAME AuthenticationFailed label, never a
    // distinct one.
    let unpadded = unpad_message(&padded);
    match unpadded.status {
        PadStatus::Ready => match unpadded.output {
            Some(plaintext) => Nip44WireDecryptDecision {
                status: Nip44WireDecryptStatus::Ready,
                plaintext: Some(plaintext),
            },
            None => authentication_failed_decision(),
        },
        PadStatus::InvalidLength | PadStatus::InvalidPadding => authentication_failed_decision(),
    }
}

/// The `ConversationKey`-facing entry point: derives `chacha_key`/
/// `chacha_nonce`/`hmac_key` via
/// `crypto::nip44_message_keys::derive_message_keys_exact_internal`
/// (Stage 219, UNCHANGED), then runs the verify-HMAC → decrypt-stream →
/// unpad pipeline. `conversation_key` MUST be a real, `Holding`
/// `ConversationKey` — a placeholder or already-`clear()`-ed handle is
/// rejected with [`Nip44WireDecryptStatus::InvalidConversationKey`]
/// before any HMAC/ChaCha20 call. Does not mutate `conversation_key`.
pub(crate) fn decrypt_wire_internal(
    conversation_key: &ConversationKey,
    nonce: &[u8; 32],
    ciphertext: &[u8],
    mac: &[u8; 32],
) -> Nip44WireDecryptDecision {
    let key_decisions = derive_message_keys_exact_internal(conversation_key, nonce);
    decrypt_wire_from_key_decisions(&key_decisions, nonce, ciphertext, mac)
}

/// The byte-level entry point: identical pipeline to
/// [`decrypt_wire_internal`], but takes the conversation key's raw bytes
/// directly via
/// `crypto::nip44_message_keys::derive_message_keys_exact_from_bytes_internal`
/// — kept `pub(crate)` specifically for this module's own vector tests
/// (see this module's own doc comment above for why `valid.encrypt_decrypt`
/// cannot instead be reproduced through `ConversationKey`'s own ECDH
/// constructor).
pub(crate) fn decrypt_wire_from_bytes_internal(
    conversation_key_bytes: &[u8; 32],
    nonce: &[u8; 32],
    ciphertext: &[u8],
    mac: &[u8; 32],
) -> Nip44WireDecryptDecision {
    let key_decisions = derive_message_keys_exact_from_bytes_internal(conversation_key_bytes, nonce);
    decrypt_wire_from_key_decisions(&key_decisions, nonce, ciphertext, mac)
}

/// The `ConversationKey`-facing, wire-STRING-facing entry point: decodes
/// `payload` via `crypto::nip44_wire_encoding::decode_wire_payload_internal`
/// (Stage 234) — rejecting a structurally malformed candidate with
/// [`Nip44WireDecryptStatus::InvalidPayload`] BEFORE any key derivation/
/// HMAC/ChaCha20 call — then delegates to [`decrypt_wire_internal`].
pub(crate) fn decrypt_wire_payload_internal(
    conversation_key: &ConversationKey,
    payload: &str,
) -> Nip44WireDecryptDecision {
    let decoded = decode_wire_payload_internal(payload);
    if decoded.status != Nip44WireEncodingStatus::Ready {
        return invalid_payload_decision();
    }
    let fields = match decoded.payload {
        Some(fields) => fields,
        None => return invalid_payload_decision(),
    };
    let ciphertext = match fields.ciphertext {
        Some(bytes) => bytes,
        None => return invalid_payload_decision(),
    };
    let mac = match fields.mac {
        Some(bytes) => bytes,
        None => return invalid_payload_decision(),
    };
    decrypt_wire_internal(conversation_key, &fields.nonce, &ciphertext, &mac)
}

/// The byte-level, wire-STRING-facing entry point: identical to
/// [`decrypt_wire_payload_internal`], but takes the conversation key's
/// raw bytes directly — kept `pub(crate)` specifically for this module's
/// own vector tests (see this module's own doc comment above for why).
pub(crate) fn decrypt_wire_payload_from_bytes_internal(
    conversation_key_bytes: &[u8; 32],
    payload: &str,
) -> Nip44WireDecryptDecision {
    let decoded = decode_wire_payload_internal(payload);
    if decoded.status != Nip44WireEncodingStatus::Ready {
        return invalid_payload_decision();
    }
    let fields = match decoded.payload {
        Some(fields) => fields,
        None => return invalid_payload_decision(),
    };
    let ciphertext = match fields.ciphertext {
        Some(bytes) => bytes,
        None => return invalid_payload_decision(),
    };
    let mac = match fields.mac {
        Some(bytes) => bytes,
        None => return invalid_payload_decision(),
    };
    decrypt_wire_from_bytes_internal(conversation_key_bytes, &fields.nonce, &ciphertext, &mac)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::nip44_hmac::compute_hmac_internal;
    use crate::crypto::nip44_padding::pad_message;
    use crate::crypto::nip44_stream_cipher::encrypt_stream_internal;
    use crate::secret_handle::{SecretHandle, SecretHandleKind};

    const TEST_CONVERSATION_KEY_BYTES: [u8; 32] = [0xab; 32];
    const TEST_NONCE: [u8; 32] = [0xcd; 32];
    const TEST_PLAINTEXT: &[u8] = b"fedos NIP-44 wire decrypt pipeline test plaintext";

    fn real_conversation_key() -> ConversationKey {
        let secret = SecretHandle::new_from_32_bytes_for_internal_use(
            SecretHandleKind::NostrKeyMaterial,
            [0x11; 32],
        );
        let public = SecretHandle::new_from_32_bytes_for_internal_use(
            SecretHandleKind::NostrKeyMaterial,
            [0x22; 32],
        );
        crate::crypto::conversation_key::derive_conversation_key_via_ecdh_internal(&secret, &public)
            .output
            .expect("expected a real conversation key")
    }

    /// Encrypt a well-formed wire ciphertext+mac pair for use as a
    /// round-trip fixture, using ONLY this crate's own (already-verified)
    /// building blocks — mirrors how `crypto::nip44_encrypt`'s own tests
    /// build fixtures with `crypto::nip44_padding`/`crypto::aead_internal`.
    fn encrypt_fixture(conversation_key_bytes: &[u8; 32], nonce: &[u8; 32]) -> (Vec<u8>, [u8; 32]) {
        let key_decisions = derive_message_keys_exact_from_bytes_internal(conversation_key_bytes, nonce);
        let chacha_key: [u8; 32] =
            extract_fixed_bytes(&key_decisions, Nip44DerivedKeyKind::ChachaKey).expect("chacha_key");
        let chacha_nonce: [u8; 12] =
            extract_fixed_bytes(&key_decisions, Nip44DerivedKeyKind::ChachaNonce)
                .expect("chacha_nonce");
        let hmac_key: [u8; 32] =
            extract_fixed_bytes(&key_decisions, Nip44DerivedKeyKind::HmacKey).expect("hmac_key");

        let padded = pad_message(TEST_PLAINTEXT).output.expect("padded plaintext");
        let ciphertext = encrypt_stream_internal(&chacha_key, &chacha_nonce, &padded);
        let mac = compute_hmac_internal(&hmac_key, nonce, &ciphertext);
        (ciphertext, mac)
    }

    #[test]
    fn decrypt_wire_from_bytes_internal_round_trips_a_well_formed_ciphertext() {
        let (ciphertext, mac) = encrypt_fixture(&TEST_CONVERSATION_KEY_BYTES, &TEST_NONCE);
        let decision =
            decrypt_wire_from_bytes_internal(&TEST_CONVERSATION_KEY_BYTES, &TEST_NONCE, &ciphertext, &mac);
        assert_eq!(decision.status, Nip44WireDecryptStatus::Ready);
        assert_eq!(decision.plaintext.as_deref(), Some(TEST_PLAINTEXT));
    }

    #[test]
    fn decrypt_wire_internal_round_trips_using_a_real_conversation_key() {
        let key = real_conversation_key();
        let key_bytes = key
            .expose_bytes_for_internal_message_key_derivation()
            .expect("expected real conversation key bytes");
        let (ciphertext, mac) = encrypt_fixture(&key_bytes, &TEST_NONCE);
        let decision = decrypt_wire_internal(&key, &TEST_NONCE, &ciphertext, &mac);
        assert_eq!(decision.status, Nip44WireDecryptStatus::Ready);
        assert_eq!(decision.plaintext.as_deref(), Some(TEST_PLAINTEXT));
    }

    #[test]
    fn decrypt_wire_internal_rejects_placeholder_conversation_key() {
        let placeholder = ConversationKey::new_placeholder();
        let decision = decrypt_wire_internal(&placeholder, &TEST_NONCE, &[0u8; 48], &[0u8; 32]);
        assert_eq!(decision.status, Nip44WireDecryptStatus::InvalidConversationKey);
        assert!(decision.plaintext.is_none());
    }

    #[test]
    fn decrypt_wire_internal_rejects_cleared_conversation_key() {
        let mut key = real_conversation_key();
        key.clear();
        let decision = decrypt_wire_internal(&key, &TEST_NONCE, &[0u8; 48], &[0u8; 32]);
        assert_eq!(decision.status, Nip44WireDecryptStatus::InvalidConversationKey);
    }

    #[test]
    fn wrong_mac_fails_authentication() {
        let (ciphertext, mac) = encrypt_fixture(&TEST_CONVERSATION_KEY_BYTES, &TEST_NONCE);
        let mut wrong_mac = mac;
        wrong_mac[0] ^= 0xFF;
        let decision =
            decrypt_wire_from_bytes_internal(&TEST_CONVERSATION_KEY_BYTES, &TEST_NONCE, &ciphertext, &wrong_mac);
        assert_eq!(decision.status, Nip44WireDecryptStatus::AuthenticationFailed);
        assert!(decision.plaintext.is_none());
    }

    #[test]
    fn wrong_conversation_key_fails_authentication() {
        let (ciphertext, mac) = encrypt_fixture(&TEST_CONVERSATION_KEY_BYTES, &TEST_NONCE);
        let wrong_key_bytes = [0xffu8; 32];
        let decision =
            decrypt_wire_from_bytes_internal(&wrong_key_bytes, &TEST_NONCE, &ciphertext, &mac);
        assert_eq!(decision.status, Nip44WireDecryptStatus::AuthenticationFailed);
    }

    #[test]
    fn wrong_nonce_fails_authentication() {
        let (ciphertext, mac) = encrypt_fixture(&TEST_CONVERSATION_KEY_BYTES, &TEST_NONCE);
        let different_nonce = [0xefu8; 32];
        let decision = decrypt_wire_from_bytes_internal(
            &TEST_CONVERSATION_KEY_BYTES,
            &different_nonce,
            &ciphertext,
            &mac,
        );
        assert_eq!(decision.status, Nip44WireDecryptStatus::AuthenticationFailed);
    }

    #[test]
    fn tampered_ciphertext_fails_authentication() {
        let (mut ciphertext, mac) = encrypt_fixture(&TEST_CONVERSATION_KEY_BYTES, &TEST_NONCE);
        ciphertext[0] ^= 0xFF;
        let decision =
            decrypt_wire_from_bytes_internal(&TEST_CONVERSATION_KEY_BYTES, &TEST_NONCE, &ciphertext, &mac);
        assert_eq!(decision.status, Nip44WireDecryptStatus::AuthenticationFailed);
    }

    #[test]
    fn malformed_padding_after_successful_authentication_still_reports_authentication_failed() {
        // Bypass `pad_message` and encrypt a structurally invalid padded
        // buffer directly, using the SAME key/nonce this module's own
        // `encrypt_fixture` would use — proving unpad failures never
        // surface as a distinct label from an HMAC failure.
        let key_decisions =
            derive_message_keys_exact_from_bytes_internal(&TEST_CONVERSATION_KEY_BYTES, &TEST_NONCE);
        let chacha_key: [u8; 32] =
            extract_fixed_bytes(&key_decisions, Nip44DerivedKeyKind::ChachaKey).expect("chacha_key");
        let chacha_nonce: [u8; 12] =
            extract_fixed_bytes(&key_decisions, Nip44DerivedKeyKind::ChachaNonce)
                .expect("chacha_nonce");
        let hmac_key: [u8; 32] =
            extract_fixed_bytes(&key_decisions, Nip44DerivedKeyKind::HmacKey).expect("hmac_key");

        let malformed_padded = vec![0xFFu8; 10];
        let ciphertext = encrypt_stream_internal(&chacha_key, &chacha_nonce, &malformed_padded);
        let mac = compute_hmac_internal(&hmac_key, &TEST_NONCE, &ciphertext);

        let decision =
            decrypt_wire_from_bytes_internal(&TEST_CONVERSATION_KEY_BYTES, &TEST_NONCE, &ciphertext, &mac);
        assert_eq!(decision.status, Nip44WireDecryptStatus::AuthenticationFailed);
        assert!(decision.plaintext.is_none());
    }

    #[test]
    fn nip44_wire_decrypt_status_has_no_variant_other_than_the_four_specified() {
        for status in [
            Nip44WireDecryptStatus::Ready,
            Nip44WireDecryptStatus::InvalidConversationKey,
            Nip44WireDecryptStatus::InvalidPayload,
            Nip44WireDecryptStatus::AuthenticationFailed,
        ] {
            match status {
                Nip44WireDecryptStatus::Ready => {}
                Nip44WireDecryptStatus::InvalidConversationKey => {}
                Nip44WireDecryptStatus::InvalidPayload => {}
                Nip44WireDecryptStatus::AuthenticationFailed => {}
            }
        }
    }

    #[test]
    fn decrypt_wire_payload_from_bytes_internal_round_trips_a_well_formed_wire_string() {
        let (ciphertext, mac) = encrypt_fixture(&TEST_CONVERSATION_KEY_BYTES, &TEST_NONCE);
        let payload = crate::crypto::nip44_wire_encoding::encode_wire_payload_internal(
            &TEST_NONCE,
            &ciphertext,
            &mac,
        );
        let decision =
            decrypt_wire_payload_from_bytes_internal(&TEST_CONVERSATION_KEY_BYTES, &payload);
        assert_eq!(decision.status, Nip44WireDecryptStatus::Ready);
        assert_eq!(decision.plaintext.as_deref(), Some(TEST_PLAINTEXT));
    }

    #[test]
    fn decrypt_wire_payload_internal_round_trips_using_a_real_conversation_key() {
        let key = real_conversation_key();
        let key_bytes = key
            .expose_bytes_for_internal_message_key_derivation()
            .expect("expected real conversation key bytes");
        let (ciphertext, mac) = encrypt_fixture(&key_bytes, &TEST_NONCE);
        let payload = crate::crypto::nip44_wire_encoding::encode_wire_payload_internal(
            &TEST_NONCE,
            &ciphertext,
            &mac,
        );
        let decision = decrypt_wire_payload_internal(&key, &payload);
        assert_eq!(decision.status, Nip44WireDecryptStatus::Ready);
        assert_eq!(decision.plaintext.as_deref(), Some(TEST_PLAINTEXT));
    }

    #[test]
    fn decrypt_wire_payload_from_bytes_internal_rejects_a_malformed_wire_string() {
        let decision =
            decrypt_wire_payload_from_bytes_internal(&TEST_CONVERSATION_KEY_BYTES, "not valid base64!!");
        assert_eq!(decision.status, Nip44WireDecryptStatus::InvalidPayload);
        assert!(decision.plaintext.is_none());
    }

    #[test]
    fn decrypt_wire_payload_internal_rejects_placeholder_conversation_key_even_for_a_malformed_payload()
    {
        // InvalidPayload is checked BEFORE any key-related check - a
        // malformed payload with a placeholder key still reports
        // InvalidPayload, never InvalidConversationKey.
        let placeholder = ConversationKey::new_placeholder();
        let decision = decrypt_wire_payload_internal(&placeholder, "not valid base64!!");
        assert_eq!(decision.status, Nip44WireDecryptStatus::InvalidPayload);
    }
}
