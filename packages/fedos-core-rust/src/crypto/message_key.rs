//! Stage 200 — INTERNAL-ONLY NIP-44 per-message-key type. A skeleton only
//! (mirrors `conversation_key`'s own Stage 198 skeleton): this module
//! defines the type and its decision/status shapes, but performs no
//! derivation itself — `crypto::hkdf_bridge` (Stage 201) is the ONE
//! production caller that constructs a real, `Holding`-state
//! [`MessageKey`].
//!
//! Crate-private only — see `src/crypto.rs`'s module-level doc comment for
//! this module's place in the `crypto` tree.
//!
//! **What this module is NOT**: no HKDF call of any kind (see
//! `crypto::hkdf_bridge`), no per-message nonce, no `chacha_key`/
//! `chacha_nonce`/`hmac_key` triple (NIP-44 v2's real per-message
//! derivation, `docs/nip44_internal_plan.md` §4 — a future, separate,
//! explicitly-reviewed stage, NOT this one), no padding, no NIP-44
//! encrypt/decrypt, no public API, no Runtime/Worker/Storage/Relay
//! connection.
#![allow(dead_code)]

use crate::secret_handle::{SecretHandle, SecretHandleKind};

/// Which protocol/version a [`MessageKey`] was derived for — a label only.
/// `Placeholder` is this module's own non-secret path; `Nip44V2` is the
/// one real generation `crypto::hkdf_bridge` (Stage 201) produces.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum MessageKeyKind {
    /// `new_placeholder()`'s non-secret path.
    Placeholder,
    /// A real, `crypto::hkdf_bridge`-derived NIP-44 v2 message key.
    Nip44V2,
}

/// Coarse observable outcome of a [`MessageKey`]-producing call (Stage
/// 201's `crypto::hkdf_bridge::derive_message_key_from_conversation_key_internal`).
/// Crate-private only. No secret byte is exposed through this label itself
/// — only through the decision's own `output` field on `Success`, and even
/// then only as an opaque [`MessageKey`], never a raw byte.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum MessageKeyStatus {
    /// Derivation succeeded; the decision's `output` is `Some`.
    Success,
    /// The input `ConversationKey` was not `Holding` real bytes (the
    /// Stage 198 placeholder path, or already `clear()`-ed).
    InvalidKey,
    /// The underlying HKDF step failed — unreachable in practice, matched
    /// exhaustively rather than assumed infallible, mirroring
    /// `kdf_core::HkdfStatus::InternalFailure`/
    /// `conversation_key::ConversationKeyStatus::InternalFailure`.
    InternalFailure,
}

/// The result of a [`MessageKey`]-producing call. Crate-private only;
/// never `Clone`/`Debug`-over-raw-bytes (deriving either would fail to
/// compile, since `output: Option<MessageKey>` and `MessageKey` itself
/// implements neither).
pub(crate) struct MessageKeyDecision {
    pub(crate) status: MessageKeyStatus,
    pub(crate) output: Option<MessageKey>,
}

/// An INTERNAL-ONLY NIP-44 per-message key (crate-private; not part of
/// this crate's public API). Holds EITHER this module's own non-secret
/// placeholder path (`new_placeholder()`) OR, once `crypto::hkdf_bridge`
/// (Stage 201) constructs one, a real 32-byte per-message key — both via
/// an internally-held [`SecretHandle`]. No `Clone`, no `Debug`, no
/// `Display`, no `Serialize`, no public raw-byte accessor anywhere on this
/// type — the same prohibitions that bind `SecretHandle`/`ConversationKey`
/// themselves.
pub(crate) struct MessageKey {
    kind: MessageKeyKind,
    handle: SecretHandle,
}

impl MessageKey {
    /// Construct a placeholder message key. Takes NO secret input of any
    /// kind — mirrors `SecretHandle::new_placeholder`/
    /// `ConversationKey::new_placeholder`'s own shape exactly.
    pub(crate) fn new_placeholder() -> Self {
        Self {
            kind: MessageKeyKind::Placeholder,
            handle: SecretHandle::new_placeholder(),
        }
    }

    /// Construct a handle holding a REAL 32-byte message key. Crate-private
    /// — the only intended production caller is `crypto::hkdf_bridge`
    /// (Stage 201).
    pub(crate) fn new_from_32_bytes_for_internal_use(bytes: [u8; 32]) -> Self {
        Self {
            kind: MessageKeyKind::Nip44V2,
            handle: SecretHandle::new_from_32_bytes_for_internal_use(
                SecretHandleKind::MessageKeyMaterial,
                bytes,
            ),
        }
    }

    /// The non-sensitive classification label fixed at construction.
    pub(crate) fn kind(&self) -> MessageKeyKind {
        self.kind
    }

    /// Whether [`MessageKey::clear`] has been called.
    pub(crate) fn is_cleared(&self) -> bool {
        self.handle.is_cleared()
    }

    /// Zeroizes the held payload (placeholder marker or real bytes). Safe
    /// to call more than once.
    pub(crate) fn clear(&mut self) {
        self.handle.clear();
    }

    /// A narrowly-scoped internal accessor for this module's own tests
    /// (and any future, explicitly-reviewed consumer) — mirrors
    /// `ConversationKey`'s own `expose_bytes_for_internal_message_key_derivation`
    /// pattern. Returns `None` for the placeholder path and after
    /// `clear()`.
    pub(crate) fn expose_bytes_for_internal_use(&self) -> Option<[u8; 32]> {
        self.handle.expose_bytes_for_internal_derivation()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_placeholder_starts_in_placeholder_kind_only() {
        let key = MessageKey::new_placeholder();
        assert_eq!(key.kind(), MessageKeyKind::Placeholder);
        assert!(!key.is_cleared());
        assert!(key.expose_bytes_for_internal_use().is_none());
    }

    const TEST_FIXTURE_BYTES: [u8; 32] = [0xCD; 32];

    #[test]
    fn new_from_32_bytes_for_internal_use_holds_nip44_v2_kind_and_exposes_bytes() {
        let key = MessageKey::new_from_32_bytes_for_internal_use(TEST_FIXTURE_BYTES);
        assert_eq!(key.kind(), MessageKeyKind::Nip44V2);
        assert!(!key.is_cleared());
        assert_eq!(
            key.expose_bytes_for_internal_use(),
            Some(TEST_FIXTURE_BYTES)
        );
    }

    #[test]
    fn clear_transitions_to_cleared_and_is_idempotent() {
        let mut key = MessageKey::new_from_32_bytes_for_internal_use(TEST_FIXTURE_BYTES);
        key.clear();
        assert!(key.is_cleared());
        assert!(key.expose_bytes_for_internal_use().is_none());
        key.clear();
        assert!(key.is_cleared());
    }
}
