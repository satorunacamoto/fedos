//! Stage 201 — the ONE reviewed connection point between
//! `conversation_key::ConversationKey` and `message_key::MessageKey`:
//! `derive_message_key_from_conversation_key_internal`, which bridges a
//! `ConversationKey` through `kdf_core::derive_secret_handle_internal`
//! (Stage 147, already real) under the FIXED, pre-existing
//! `HkdfDomain::Conversation` — never a caller-suppliable salt/info/domain
//! of any kind.
//!
//! Crate-private only — see `src/crypto.rs`'s module-level doc comment for
//! this module's place in the `crypto` tree.
//!
//! **This is a generic architectural bridge, NOT NIP-44 v2's real
//! per-message key derivation.** The real spec (`docs/nip44_internal_plan.md`
//! §4) derives `chacha_key`/`chacha_nonce`/`hmac_key` via HKDF-EXPAND keyed
//! by the conversation key, with a FRESH RANDOM 32-byte value as the
//! HKDF-expand salt for every message — a caller-varying salt this
//! module's fixed-domain design deliberately does NOT accept. That
//! per-message, nonce-salted derivation remains a future, separate,
//! explicitly-reviewed stage (bundled with the padding/encrypt work this
//! stage does not do). This module instead reuses the crate's OWN existing
//! generic domain-separated KDF bridge (`HkdfDomain::Conversation`, fixed
//! salt/info since Stage 147) to give `MessageKey` a real, connected,
//! `SecretHandle`-backed value today, without pre-committing to NIP-44's
//! exact per-message wire shape.
//!
//! **Input/output discipline**: takes `&ConversationKey` (a shared
//! reference — this function cannot mutate or clear its input, since
//! `ConversationKey::clear` requires `&mut self`, which this signature
//! never has). The conversation key's bytes are copied into a transient,
//! immediately-zeroized `SecretHandle(HkdfInputMaterial)` for the sole
//! purpose of this one `derive_secret_handle_internal` call — that
//! transient handle is explicitly `clear()`-ed before this function
//! returns. Output is ALWAYS a brand-new `MessageKey` — never an alias or
//! reuse of the input's own storage.
#![allow(dead_code)]

use super::conversation_key::ConversationKey;
use super::message_key::{MessageKey, MessageKeyDecision, MessageKeyStatus};
use crate::kdf_core::{derive_secret_handle_internal, HkdfDomain, HkdfStatus};
use crate::secret_handle::{SecretHandle, SecretHandleKind};

/// Derive a NEW [`MessageKey`] from an existing, `Holding`-state
/// [`ConversationKey`], via `kdf_core::derive_secret_handle_internal` under
/// the fixed `HkdfDomain::Conversation` — the ONLY domain this bridge ever
/// requests; there is no parameter through which a caller could select a
/// different one.
///
/// Rejects a `conversation_key` that is still the Stage 198 placeholder
/// path, or has already been `clear()`-ed, with
/// [`MessageKeyStatus::InvalidKey`] before any HKDF call. Does not mutate
/// `conversation_key` — it is borrowed, never consumed.
pub(crate) fn derive_message_key_from_conversation_key_internal(
    conversation_key: &ConversationKey,
) -> MessageKeyDecision {
    let bytes = match conversation_key.expose_bytes_for_internal_message_key_derivation() {
        Some(bytes) => bytes,
        None => {
            return MessageKeyDecision {
                status: MessageKeyStatus::InvalidKey,
                output: None,
            }
        }
    };

    let mut transient_input =
        SecretHandle::new_from_32_bytes_for_internal_use(SecretHandleKind::HkdfInputMaterial, bytes);
    let decision = derive_secret_handle_internal(&transient_input, HkdfDomain::Conversation);
    transient_input.clear();

    match decision.status {
        HkdfStatus::Ready => {
            let output_handle = decision
                .output
                .expect("Ready HkdfDecision must carry output");
            let output_bytes = output_handle
                .expose_bytes_for_internal_derivation()
                .expect("freshly-derived HkdfOutputMaterial handle must expose bytes");
            MessageKeyDecision {
                status: MessageKeyStatus::Success,
                output: Some(MessageKey::new_from_32_bytes_for_internal_use(output_bytes)),
            }
        }
        HkdfStatus::InvalidInput | HkdfStatus::InternalFailure => MessageKeyDecision {
            status: MessageKeyStatus::InternalFailure,
            output: None,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::secret_handle::SecretHandleKind as SkKind;

    #[test]
    fn rejects_a_placeholder_conversation_key() {
        let placeholder = ConversationKey::new_placeholder();
        let decision = derive_message_key_from_conversation_key_internal(&placeholder);
        assert_eq!(decision.status, MessageKeyStatus::InvalidKey);
        assert!(decision.output.is_none());
    }

    #[test]
    fn rejects_a_cleared_conversation_key() {
        let secret = SecretHandle::new_from_32_bytes_for_internal_use(
            SkKind::NostrKeyMaterial,
            [0x11; 32],
        );
        let public = SecretHandle::new_from_32_bytes_for_internal_use(
            SkKind::NostrKeyMaterial,
            [0x22; 32],
        );
        let ck_decision =
            super::super::conversation_key::derive_conversation_key_via_ecdh_internal(
                &secret, &public,
            );
        let mut conversation_key = ck_decision.output.expect("expected a real conversation key");
        conversation_key.clear();
        let decision = derive_message_key_from_conversation_key_internal(&conversation_key);
        assert_eq!(decision.status, MessageKeyStatus::InvalidKey);
        assert!(decision.output.is_none());
    }

    fn real_conversation_key() -> ConversationKey {
        let secret = SecretHandle::new_from_32_bytes_for_internal_use(
            SkKind::NostrKeyMaterial,
            [0x33; 32],
        );
        let public = SecretHandle::new_from_32_bytes_for_internal_use(
            SkKind::NostrKeyMaterial,
            [0x44; 32],
        );
        let decision = super::super::conversation_key::derive_conversation_key_via_ecdh_internal(
            &secret, &public,
        );
        decision.output.expect("expected a real conversation key")
    }

    #[test]
    fn derives_a_real_message_key_from_a_holding_conversation_key() {
        let conversation_key = real_conversation_key();
        let decision = derive_message_key_from_conversation_key_internal(&conversation_key);
        assert_eq!(decision.status, MessageKeyStatus::Success);
        let message_key = decision.output.expect("Success decision must carry output");
        assert_eq!(message_key.kind(), crate::crypto::message_key::MessageKeyKind::Nip44V2);
        assert!(!message_key.is_cleared());
        assert!(message_key.expose_bytes_for_internal_use().is_some());
    }

    #[test]
    fn does_not_mutate_or_clear_the_input_conversation_key() {
        let conversation_key = real_conversation_key();
        let _ = derive_message_key_from_conversation_key_internal(&conversation_key);
        assert!(!conversation_key.is_cleared());
        assert!(conversation_key
            .expose_bytes_for_internal_message_key_derivation()
            .is_some());
    }

    #[test]
    fn is_deterministic_for_the_same_conversation_key() {
        let conversation_key = real_conversation_key();
        let first = derive_message_key_from_conversation_key_internal(&conversation_key)
            .output
            .expect("expected Success");
        let second = derive_message_key_from_conversation_key_internal(&conversation_key)
            .output
            .expect("expected Success");
        assert_eq!(
            first.expose_bytes_for_internal_use(),
            second.expose_bytes_for_internal_use()
        );
    }

    #[test]
    fn differs_from_the_conversation_key_bytes_it_was_derived_from() {
        let conversation_key = real_conversation_key();
        let conversation_key_bytes = conversation_key
            .expose_bytes_for_internal_message_key_derivation()
            .expect("expected real bytes");
        let message_key = derive_message_key_from_conversation_key_internal(&conversation_key)
            .output
            .expect("expected Success");
        assert_ne!(
            conversation_key_bytes,
            message_key
                .expose_bytes_for_internal_use()
                .expect("expected real bytes")
        );
    }
}
