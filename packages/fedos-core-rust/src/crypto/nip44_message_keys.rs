//! Stage 219 — real NIP-44 v2 per-message key derivation via
//! HKDF-Expand. Crate-private only — see `src/crypto.rs`'s module-level
//! doc comment for this module's place in the `crypto` tree.
//!
//! Replaces Stage 217's `derive_message_keys_exact_placeholder()`
//! label-only skeleton with the REAL derivation
//! `docs/nip44_message_key_review.md` (Stage 214) confirmed byte-for-byte
//! against `test-vectors/nip44/nip44-v2.json`'s `valid.get_message_keys`
//! category (vector-wired by the sibling `#[cfg(test)]`-only
//! `nip44_message_key_vectors` module, Stage 220):
//!
//! ```text
//! PRK  = conversation_key            (32 bytes — ALREADY the HKDF PRK;
//!                                      no second extract is ever called)
//! info = nonce                       (32 bytes, caller-supplied)
//! L    = 76
//! OKM  = HKDF-Expand(PRK, info, L)
//! chacha_key   = OKM[ 0..32]  (32 bytes)
//! chacha_nonce = OKM[32..44]  (12 bytes)
//! hmac_key     = OKM[44..76]  (32 bytes)
//! ```
//!
//! [`derive_message_keys_exact_internal`] is the `ConversationKey`-facing
//! entry point; it exposes `conversation_key`'s raw bytes via that type's
//! own pre-existing, UNCHANGED `expose_bytes_for_internal_message_key_derivation`
//! accessor (Stage 201) and calls
//! [`derive_message_keys_exact_from_bytes_internal`], a lower-level
//! pure-bytes engine kept `pub(crate)` specifically so
//! `nip44_message_key_vectors` can feed it the vectors' raw
//! `conversation_key` value directly — `valid.get_message_keys` supplies
//! a `conversation_key` with NO corresponding `sec1`/`pub2` pair anywhere
//! in `valid.get_conversation_key`, so re-deriving it through
//! `ConversationKey`'s own ECDH constructor is not possible; keeping the
//! byte-level engine separate is how this module achieves full vector
//! fidelity while leaving `crypto::conversation_key` completely
//! unchanged.
//!
//! **What this module is NOT**: no ChaCha20 stream-cipher call (this
//! module only derives `chacha_key`/`chacha_nonce`, never encrypts
//! anything with them), no HMAC-SHA256 call (only derives `hmac_key`,
//! never computes a tag), no base64, no wire payload/serialization, no
//! change to `crypto::conversation_key`/`crypto::message_key`/
//! `crypto::hkdf_bridge` (all three are UNCHANGED — see their own
//! module-level doc comments), no public API, no Runtime/Worker/Storage/
//! Relay connection, no new `Cargo.toml` dependency (`hkdf`/`sha2`/
//! `zeroize` are already production dependencies since Stage 76/152/79).
#![allow(dead_code)]

use super::conversation_key::ConversationKey;
use hkdf::Hkdf;
use sha2::Sha256;
use zeroize::Zeroize;

/// Which of NIP-44 v2's three per-message derived values a
/// [`Nip44MessageKeyDecision`] carries — a label only. Mirrors
/// `docs/nip44_message_key_review.md` §1's fixed byte-offset split of the
/// 76-byte HKDF-expand output: `ChachaKey` (bytes 0..32), `ChachaNonce`
/// (bytes 32..44), `HmacKey` (bytes 44..76). Crate-private only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Nip44DerivedKeyKind {
    ChachaKey,
    ChachaNonce,
    HmacKey,
}

/// Coarse observable outcome of a [`derive_message_keys_exact_internal`]/
/// [`derive_message_keys_exact_from_bytes_internal`] call. Crate-private
/// only. No secret byte is exposed through this label itself — only
/// through [`Nip44MessageKeyDecision::bytes`] on `Ready`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Nip44MessageKeyStatus {
    /// Derivation succeeded; `Nip44MessageKeyDecision::bytes` is `Some`.
    Ready,
    /// `conversation_key` held no real bytes (the Stage 198 placeholder
    /// path, or an already-`clear()`-ed handle) — checked BEFORE any HKDF
    /// call. Only reachable via [`derive_message_keys_exact_internal`];
    /// [`derive_message_keys_exact_from_bytes_internal`] takes raw bytes
    /// directly and never returns this variant.
    InvalidConversationKey,
    /// The underlying HKDF-expand step failed — unreachable in practice
    /// at this module's fixed 76-byte output (well inside SHA-256's own
    /// 8160-byte ceiling, RFC 5869 §2.3), matched exhaustively rather
    /// than assumed infallible, mirroring
    /// `kdf_core::HkdfStatus::InternalFailure`.
    InternalFailure,
}

/// The result of a [`derive_message_keys_exact_internal`]/
/// [`derive_message_keys_exact_from_bytes_internal`] call for ONE of the
/// three derived values. Crate-private only; not part of this crate's
/// public API.
pub(crate) struct Nip44MessageKeyDecision {
    pub(crate) kind: Nip44DerivedKeyKind,
    pub(crate) status: Nip44MessageKeyStatus,
    pub(crate) bytes: Option<Vec<u8>>,
}

fn invalid_conversation_key_all() -> [Nip44MessageKeyDecision; 3] {
    [
        Nip44MessageKeyDecision {
            kind: Nip44DerivedKeyKind::ChachaKey,
            status: Nip44MessageKeyStatus::InvalidConversationKey,
            bytes: None,
        },
        Nip44MessageKeyDecision {
            kind: Nip44DerivedKeyKind::ChachaNonce,
            status: Nip44MessageKeyStatus::InvalidConversationKey,
            bytes: None,
        },
        Nip44MessageKeyDecision {
            kind: Nip44DerivedKeyKind::HmacKey,
            status: Nip44MessageKeyStatus::InvalidConversationKey,
            bytes: None,
        },
    ]
}

fn internal_failure_all() -> [Nip44MessageKeyDecision; 3] {
    [
        Nip44MessageKeyDecision {
            kind: Nip44DerivedKeyKind::ChachaKey,
            status: Nip44MessageKeyStatus::InternalFailure,
            bytes: None,
        },
        Nip44MessageKeyDecision {
            kind: Nip44DerivedKeyKind::ChachaNonce,
            status: Nip44MessageKeyStatus::InternalFailure,
            bytes: None,
        },
        Nip44MessageKeyDecision {
            kind: Nip44DerivedKeyKind::HmacKey,
            status: Nip44MessageKeyStatus::InternalFailure,
            bytes: None,
        },
    ]
}

/// The pure HKDF-expand engine: `conversation_key_bytes` is treated
/// DIRECTLY as the HKDF PRK (`Hkdf::from_prk` — no `Hkdf::extract` call
/// exists anywhere in this module), expanded with `nonce` as the `info`
/// parameter to 76 bytes, split into `chacha_key` (0..32) ‖ `chacha_nonce`
/// (32..44) ‖ `hmac_key` (44..76) — `docs/nip44_message_key_review.md`
/// §1's exact schedule. `pub(crate)` (not private) specifically so the
/// sibling `#[cfg(test)]`-only `nip44_message_key_vectors` module (Stage
/// 220) can feed it `test-vectors/nip44/nip44-v2.json`'s
/// `valid.get_message_keys` fixture's raw `conversation_key` value
/// directly — see this module's own doc comment above for why that
/// fixture cannot instead be reproduced through `ConversationKey`'s own
/// ECDH constructor.
pub(crate) fn derive_message_keys_exact_from_bytes_internal(
    conversation_key_bytes: &[u8; 32],
    nonce: &[u8; 32],
) -> [Nip44MessageKeyDecision; 3] {
    let hk = match Hkdf::<Sha256>::from_prk(conversation_key_bytes) {
        Ok(hk) => hk,
        Err(_) => return internal_failure_all(),
    };
    let mut okm = [0u8; 76];
    if hk.expand(nonce, &mut okm).is_err() {
        okm.zeroize();
        return internal_failure_all();
    }
    let decisions = [
        Nip44MessageKeyDecision {
            kind: Nip44DerivedKeyKind::ChachaKey,
            status: Nip44MessageKeyStatus::Ready,
            bytes: Some(okm[0..32].to_vec()),
        },
        Nip44MessageKeyDecision {
            kind: Nip44DerivedKeyKind::ChachaNonce,
            status: Nip44MessageKeyStatus::Ready,
            bytes: Some(okm[32..44].to_vec()),
        },
        Nip44MessageKeyDecision {
            kind: Nip44DerivedKeyKind::HmacKey,
            status: Nip44MessageKeyStatus::Ready,
            bytes: Some(okm[44..76].to_vec()),
        },
    ];
    okm.zeroize();
    decisions
}

/// The `ConversationKey`-facing entry point: exposes `conversation_key`'s
/// raw bytes via its own pre-existing
/// `expose_bytes_for_internal_message_key_derivation` accessor (Stage
/// 201, UNCHANGED by this module), rejecting a placeholder or
/// already-`clear()`-ed `conversation_key` with
/// [`Nip44MessageKeyStatus::InvalidConversationKey`] on all three
/// results BEFORE any HKDF call, then delegates to
/// [`derive_message_keys_exact_from_bytes_internal`]. Does not mutate
/// `conversation_key`.
pub(crate) fn derive_message_keys_exact_internal(
    conversation_key: &ConversationKey,
    nonce: &[u8; 32],
) -> [Nip44MessageKeyDecision; 3] {
    let mut bytes = match conversation_key.expose_bytes_for_internal_message_key_derivation() {
        Some(bytes) => bytes,
        None => return invalid_conversation_key_all(),
    };
    let decisions = derive_message_keys_exact_from_bytes_internal(&bytes, nonce);
    bytes.zeroize();
    decisions
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::conversation_key::derive_conversation_key_via_ecdh_internal;
    use crate::secret_handle::{SecretHandle, SecretHandleKind};

    const TEST_NONCE: [u8; 32] = [0x24; 32];

    fn real_conversation_key() -> ConversationKey {
        let secret = SecretHandle::new_from_32_bytes_for_internal_use(
            SecretHandleKind::NostrKeyMaterial,
            [0x11; 32],
        );
        let public = SecretHandle::new_from_32_bytes_for_internal_use(
            SecretHandleKind::NostrKeyMaterial,
            [0x22; 32],
        );
        derive_conversation_key_via_ecdh_internal(&secret, &public)
            .output
            .expect("expected a real conversation key")
    }

    #[test]
    fn derive_message_keys_exact_internal_returns_all_three_kinds_ready_in_order() {
        let key = real_conversation_key();
        let decisions = derive_message_keys_exact_internal(&key, &TEST_NONCE);
        assert_eq!(decisions[0].kind, Nip44DerivedKeyKind::ChachaKey);
        assert_eq!(decisions[1].kind, Nip44DerivedKeyKind::ChachaNonce);
        assert_eq!(decisions[2].kind, Nip44DerivedKeyKind::HmacKey);
        for decision in &decisions {
            assert_eq!(decision.status, Nip44MessageKeyStatus::Ready);
        }
        assert_eq!(decisions[0].bytes.as_ref().map(Vec::len), Some(32));
        assert_eq!(decisions[1].bytes.as_ref().map(Vec::len), Some(12));
        assert_eq!(decisions[2].bytes.as_ref().map(Vec::len), Some(32));
    }

    #[test]
    fn derive_message_keys_exact_internal_rejects_placeholder_conversation_key() {
        let placeholder = ConversationKey::new_placeholder();
        let decisions = derive_message_keys_exact_internal(&placeholder, &TEST_NONCE);
        for decision in &decisions {
            assert_eq!(decision.status, Nip44MessageKeyStatus::InvalidConversationKey);
            assert!(decision.bytes.is_none());
        }
    }

    #[test]
    fn derive_message_keys_exact_internal_rejects_cleared_conversation_key() {
        let mut key = real_conversation_key();
        key.clear();
        let decisions = derive_message_keys_exact_internal(&key, &TEST_NONCE);
        for decision in &decisions {
            assert_eq!(decision.status, Nip44MessageKeyStatus::InvalidConversationKey);
        }
    }

    #[test]
    fn derive_message_keys_exact_internal_does_not_mutate_conversation_key() {
        let key = real_conversation_key();
        let _ = derive_message_keys_exact_internal(&key, &TEST_NONCE);
        assert!(!key.is_cleared());
    }

    #[test]
    fn is_deterministic_for_the_same_conversation_key_and_nonce() {
        let key = real_conversation_key();
        let first = derive_message_keys_exact_internal(&key, &TEST_NONCE);
        let second = derive_message_keys_exact_internal(&key, &TEST_NONCE);
        for (a, b) in first.iter().zip(second.iter()) {
            assert_eq!(a.bytes, b.bytes);
        }
    }

    #[test]
    fn a_different_nonce_produces_different_output() {
        let key = real_conversation_key();
        let first = derive_message_keys_exact_internal(&key, &TEST_NONCE);
        let second = derive_message_keys_exact_internal(&key, &[0x99; 32]);
        assert_ne!(first[0].bytes, second[0].bytes);
    }

    #[test]
    fn derive_message_keys_exact_from_bytes_internal_matches_the_conversation_key_facing_entry_point()
    {
        let key = real_conversation_key();
        let bytes = key
            .expose_bytes_for_internal_message_key_derivation()
            .expect("expected real bytes");
        let via_bytes = derive_message_keys_exact_from_bytes_internal(&bytes, &TEST_NONCE);
        let via_key = derive_message_keys_exact_internal(&key, &TEST_NONCE);
        for (a, b) in via_bytes.iter().zip(via_key.iter()) {
            assert_eq!(a.bytes, b.bytes);
        }
    }

    #[test]
    fn nip44_derived_key_kind_has_no_variant_other_than_the_three_specified() {
        for kind in [
            Nip44DerivedKeyKind::ChachaKey,
            Nip44DerivedKeyKind::ChachaNonce,
            Nip44DerivedKeyKind::HmacKey,
        ] {
            match kind {
                Nip44DerivedKeyKind::ChachaKey => {}
                Nip44DerivedKeyKind::ChachaNonce => {}
                Nip44DerivedKeyKind::HmacKey => {}
            }
        }
    }

    #[test]
    fn nip44_message_key_status_has_no_variant_other_than_the_three_specified() {
        for status in [
            Nip44MessageKeyStatus::Ready,
            Nip44MessageKeyStatus::InvalidConversationKey,
            Nip44MessageKeyStatus::InternalFailure,
        ] {
            match status {
                Nip44MessageKeyStatus::Ready => {}
                Nip44MessageKeyStatus::InvalidConversationKey => {}
                Nip44MessageKeyStatus::InternalFailure => {}
            }
        }
    }
}
