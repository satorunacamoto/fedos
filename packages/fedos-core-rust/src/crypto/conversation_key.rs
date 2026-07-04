//! Stage 198 — INTERNAL-ONLY NIP-44 conversation-key type (a placeholder
//! path only, mirroring `SecretHandle`'s own skeleton-first shape).
//!
//! Stage 199 — real secp256k1 ECDH + HKDF-extract-only generation, using
//! `k256`'s `arithmetic` feature ONLY (Stage 194's adoption). No `ecdh`
//! Cargo feature is enabled or needed: this module computes the shared
//! point directly via `ProjectivePoint`/`AffinePoint` scalar
//! multiplication — the same operation `k256::ecdh`'s convenience wrapper
//! performs internally — verified byte-for-byte against
//! `test-vectors/nip44/nip44-v2.json`'s `valid.get_conversation_key` (35
//! cases) and `invalid.get_conversation_key` (8 cases) categories, see the
//! sibling `#[cfg(test)]`-only `nip44_conversation_key_vectors` module.
//!
//! Crate-private only — see `src/crypto.rs`'s module-level doc comment for
//! this module's place in the `crypto` tree.
//!
//! **What this module is NOT**: no message-key derivation (see
//! `crypto::message_key`/`crypto::hkdf_bridge`, Stage 200–201), no padding,
//! no NIP-44 encrypt/decrypt function, no public API, no Runtime/Worker/
//! Storage/Relay connection.
//!
//! ## Conversation-key derivation (per `docs/nip44_internal_plan.md` §3)
//!
//! `sec1` (one party's secp256k1 secret key) and `pub2` (the other party's
//! 32-byte x-only Nostr public key) → ECDH shared point, X-coordinate only
//! (32 bytes) → HKDF-SHA256 EXTRACT ONLY (never expand), fixed salt
//! `"nip44-v2"` (ASCII) → the 32-byte conversation key.
//!
//! `pub2` is lifted to a full curve point using the SAME even-Y convention
//! NIP-44's reference implementation uses: prepend a `0x02` SEC1 tag byte
//! (Nostr's own x-only public keys are BIP-340 "lift_x with even Y"
//! points; NIP-44's reference implementation, `nostr-tools`, computes
//! `getSharedSecret(sec1, '02' + pub2)` for exactly this reason).
//!
//! ## Input discipline (Stage 199)
//!
//! [`derive_conversation_key_via_ecdh_internal`] accepts EXACTLY two
//! `&`[`SecretHandle`](crate::secret_handle::SecretHandle) parameters, both
//! REQUIRED to be
//! [`SecretHandleKind::NostrKeyMaterial`](crate::secret_handle::SecretHandleKind::NostrKeyMaterial)-kinded
//! and currently `Holding` real bytes (never the Stage 79 placeholder
//! path, never an already-`clear()`-ed handle) — any kind mismatch,
//! placeholder, or cleared input is rejected with
//! [`ConversationKeyStatus::InvalidKey`] before any k256 operation runs.
//! An out-of-range/zero secp256k1 scalar, or a `pub2` with no valid
//! on-curve lift, is likewise `InvalidKey` — `k256`'s own constant-time
//! validation (`SecretKey::from_slice`/`AffinePoint::from_encoded_point`)
//! catches every documented `invalid.get_conversation_key` vector case,
//! never a panic.
#![allow(dead_code)]

use crate::secret_handle::{SecretHandle, SecretHandleKind};
use hkdf::Hkdf;
use k256::elliptic_curve::sec1::{FromEncodedPoint, ToEncodedPoint};
use k256::{AffinePoint, EncodedPoint, ProjectivePoint, SecretKey};
use sha2::Sha256;
use zeroize::Zeroize;

/// Coarse internal lifecycle state of a [`ConversationKey`]. Mirrors
/// `SecretHandleState`'s shape, wrapping the same underlying
/// `SecretHandle` lifecycle rather than reinventing it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ConversationKeyState {
    /// No placeholder marker or real payload has been allocated yet.
    Empty,
    /// A placeholder marker is allocated (`new_placeholder()`). Still
    /// holds no real conversation key.
    Placeholder,
    /// Real conversation-key bytes are held (via
    /// `derive_conversation_key_via_ecdh_internal`'s `Success` path).
    Holding,
    /// [`ConversationKey::clear`] was called.
    Cleared,
}

impl Default for ConversationKeyState {
    fn default() -> Self {
        ConversationKeyState::Empty
    }
}

/// Which protocol/version a [`ConversationKey`] was derived for — a label
/// only. `Placeholder` is the Stage 198 non-secret path; `Nip44V2` is the
/// one real generation this crate implements (Stage 199).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ConversationKeyKind {
    /// `new_placeholder()`'s non-secret path.
    Placeholder,
    /// A real NIP-44 v2 conversation key (Stage 199).
    Nip44V2,
}

/// Which mechanism produced a [`ConversationKey`] — a label only, present
/// on a [`ConversationKeyDecision`] regardless of success or failure
/// (mirrors `kdf_core::HkdfDecision`'s own `domain` field, always present).
/// Exactly one variant exists today; a future alternate generation method
/// would be its own reviewed addition — matched exhaustively rather than
/// assumed singular forever.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ConversationKeyGeneration {
    /// secp256k1 ECDH + HKDF-extract (Stage 199, this module's one
    /// function).
    Ecdh,
}

/// Coarse observable outcome of a
/// [`derive_conversation_key_via_ecdh_internal`] call. Crate-private only.
/// No secret byte is exposed through this label itself — only through
/// [`ConversationKeyDecision::output`] on `Success`, and even then only as
/// an opaque [`ConversationKey`], never a raw byte.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ConversationKeyStatus {
    /// Derivation succeeded; `ConversationKeyDecision::output` is `Some`.
    Success,
    /// One or both input `SecretHandle`s were not `NostrKeyMaterial`-kinded,
    /// held no real bytes (Stage 79 placeholder, or already `clear()`-ed),
    /// or held bytes `k256` rejects as an invalid secp256k1 scalar/point
    /// (out-of-range, zero, or a public key with no valid on-curve lift).
    InvalidKey,
    /// The underlying HKDF-extract step failed — unreachable in practice
    /// (HKDF-SHA256 extract cannot fail for a 32-byte IKM), matched
    /// exhaustively rather than assumed infallible, mirroring
    /// `kdf_core::HkdfStatus::InternalFailure`.
    InternalFailure,
}

/// The result of a [`derive_conversation_key_via_ecdh_internal`] call.
/// Crate-private only; never `Clone`/`Debug`-over-raw-bytes (deriving
/// either would fail to compile, since `output: Option<ConversationKey>`
/// and `ConversationKey` itself implements neither).
pub(crate) struct ConversationKeyDecision {
    pub(crate) generation: ConversationKeyGeneration,
    pub(crate) status: ConversationKeyStatus,
    pub(crate) output: Option<ConversationKey>,
}

/// An INTERNAL-ONLY NIP-44 conversation key (crate-private; not part of
/// this crate's public API). Holds EITHER the Stage 198 non-secret
/// placeholder path (`new_placeholder()`) OR, as of Stage 199, a real
/// 32-byte conversation key derived via ECDH + HKDF-extract — both via an
/// internally-held [`SecretHandle`]. No `Clone`, no `Debug`, no `Display`,
/// no `Serialize`, no public raw-byte accessor anywhere on this type — the
/// same prohibitions that bind `SecretHandle` itself.
pub(crate) struct ConversationKey {
    state: ConversationKeyState,
    kind: ConversationKeyKind,
    handle: SecretHandle,
}

impl ConversationKey {
    /// Construct a placeholder conversation key. Takes NO secret input of
    /// any kind — mirrors `SecretHandle::new_placeholder`'s own shape
    /// exactly.
    pub(crate) fn new_placeholder() -> Self {
        Self {
            state: ConversationKeyState::Placeholder,
            kind: ConversationKeyKind::Placeholder,
            handle: SecretHandle::new_placeholder(),
        }
    }

    /// Construct a handle holding a REAL 32-byte conversation key. Private
    /// to this module — the only production caller is
    /// [`derive_conversation_key_via_ecdh_internal`] below.
    fn new_from_32_bytes_for_internal_use(bytes: [u8; 32]) -> Self {
        Self {
            state: ConversationKeyState::Holding,
            kind: ConversationKeyKind::Nip44V2,
            handle: SecretHandle::new_from_32_bytes_for_internal_use(
                SecretHandleKind::ConversationKeyMaterial,
                bytes,
            ),
        }
    }

    /// A non-sensitive status snapshot.
    pub(crate) fn state(&self) -> ConversationKeyState {
        self.state
    }

    /// The non-sensitive classification label fixed at construction.
    pub(crate) fn kind(&self) -> ConversationKeyKind {
        self.kind
    }

    /// Whether [`ConversationKey::clear`] has been called.
    pub(crate) fn is_cleared(&self) -> bool {
        self.handle.is_cleared()
    }

    /// Zeroizes the held payload (placeholder marker or real bytes) and
    /// marks this handle `Cleared`. Safe to call more than once.
    pub(crate) fn clear(&mut self) {
        self.handle.clear();
        self.state = ConversationKeyState::Cleared;
    }

    /// Stage 201 — a narrowly-scoped internal accessor exposing a COPY of
    /// the real 32-byte conversation key, for the sole reviewed use of
    /// `crypto::hkdf_bridge`'s conversation-key → message-key call site.
    /// Returns `None` for the Stage 198 placeholder path and after
    /// `clear()`. Mirrors `SecretHandle`'s own narrowly-scoped accessor
    /// pattern (`docs/secret_handle_api_shape.md` section 6): each future
    /// connection stage needing the bytes adds its OWN accessor, never a
    /// generic `expose()`.
    pub(crate) fn expose_bytes_for_internal_message_key_derivation(&self) -> Option<[u8; 32]> {
        self.handle.expose_bytes_for_internal_derivation()
    }
}

/// Construct a fixed `InvalidKey` decision — every rejection path below
/// returns exactly this shape.
fn invalid_key_decision() -> ConversationKeyDecision {
    ConversationKeyDecision {
        generation: ConversationKeyGeneration::Ecdh,
        status: ConversationKeyStatus::InvalidKey,
        output: None,
    }
}

/// Derive a NEW [`ConversationKey`] from one party's secp256k1 secret key
/// and the other party's public key, via secp256k1 ECDH followed by
/// HKDF-SHA256 EXTRACT ONLY (never expand) with the fixed salt
/// `"nip44-v2"` — `docs/nip44_internal_plan.md` §3's exact pipeline. This
/// is the ONLY place in this crate's production code that performs
/// elliptic-curve point arithmetic.
///
/// `secret_key`/`public_key` MUST both be
/// [`SecretHandleKind::NostrKeyMaterial`](crate::secret_handle::SecretHandleKind::NostrKeyMaterial)-kinded
/// and currently holding real bytes — the Stage 79 placeholder path, an
/// already-`clear()`-ed handle, or any other kind is rejected with
/// [`ConversationKeyStatus::InvalidKey`] before any k256 call. Does not
/// mutate either input handle — both are borrowed, never consumed, and
/// are left exactly as they were after this call returns.
pub(crate) fn derive_conversation_key_via_ecdh_internal(
    secret_key: &SecretHandle,
    public_key: &SecretHandle,
) -> ConversationKeyDecision {
    if secret_key.kind() != SecretHandleKind::NostrKeyMaterial
        || public_key.kind() != SecretHandleKind::NostrKeyMaterial
    {
        return invalid_key_decision();
    }

    let mut sec1_bytes = match secret_key.expose_bytes_for_internal_ecdh() {
        Some(bytes) => bytes,
        None => return invalid_key_decision(),
    };
    let mut pub2_bytes = match public_key.expose_bytes_for_internal_ecdh() {
        Some(bytes) => bytes,
        None => {
            sec1_bytes.zeroize();
            return invalid_key_decision();
        }
    };

    let secret_scalar = match SecretKey::from_slice(&sec1_bytes) {
        Ok(key) => key.to_nonzero_scalar(),
        Err(_) => {
            sec1_bytes.zeroize();
            pub2_bytes.zeroize();
            return invalid_key_decision();
        }
    };
    sec1_bytes.zeroize();

    // Lift the 32-byte x-only Nostr public key to a full curve point using
    // the even-Y convention (a `0x02` SEC1 compressed-point tag byte) — see
    // this module's own doc comment above for why.
    let mut compressed_pub2 = [0u8; 33];
    compressed_pub2[0] = 0x02;
    compressed_pub2[1..].copy_from_slice(&pub2_bytes);
    pub2_bytes.zeroize();

    let public_affine: Option<AffinePoint> = EncodedPoint::from_bytes(&compressed_pub2)
        .ok()
        .and_then(|encoded| Option::from(AffinePoint::from_encoded_point(&encoded)));
    compressed_pub2.zeroize();
    let public_affine = match public_affine {
        Some(affine) => affine,
        None => return invalid_key_decision(),
    };

    let mut shared_x = [0u8; 32];
    {
        let shared_point = (ProjectivePoint::from(public_affine) * *secret_scalar).to_affine();
        let encoded_shared = shared_point.to_encoded_point(true);
        shared_x.copy_from_slice(&encoded_shared.as_bytes()[1..33]);
    }

    let (prk, _) = Hkdf::<Sha256>::extract(Some(b"nip44-v2"), &shared_x);
    shared_x.zeroize();

    let mut conversation_key_bytes = [0u8; 32];
    conversation_key_bytes.copy_from_slice(&prk);

    let output = ConversationKey::new_from_32_bytes_for_internal_use(conversation_key_bytes);
    conversation_key_bytes.zeroize();

    ConversationKeyDecision {
        generation: ConversationKeyGeneration::Ecdh,
        status: ConversationKeyStatus::Success,
        output: Some(output),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_placeholder_starts_in_placeholder_state_only() {
        let key = ConversationKey::new_placeholder();
        assert_eq!(key.state(), ConversationKeyState::Placeholder);
        assert_eq!(key.kind(), ConversationKeyKind::Placeholder);
        assert!(!key.is_cleared());
    }

    #[test]
    fn empty_state_is_the_default_placeholder_only_state() {
        assert_eq!(ConversationKeyState::default(), ConversationKeyState::Empty);
    }

    #[test]
    fn clear_transitions_state_to_cleared_and_is_idempotent() {
        let mut key = ConversationKey::new_placeholder();
        key.clear();
        assert_eq!(key.state(), ConversationKeyState::Cleared);
        assert!(key.is_cleared());
        key.clear();
        assert!(key.is_cleared());
    }

    // A clearly-labeled, non-production test fixture — a fixed repeating
    // pattern, never a real key/seed/passphrase.
    const TEST_FIXTURE_BYTES: [u8; 32] = [0xAB; 32];

    #[test]
    fn rejects_wrong_kind_inputs() {
        let wrong_kind = SecretHandle::new_from_32_bytes_for_internal_use(
            SecretHandleKind::TestOnlySecretMaterial,
            TEST_FIXTURE_BYTES,
        );
        let nostr_key = SecretHandle::new_from_32_bytes_for_internal_use(
            SecretHandleKind::NostrKeyMaterial,
            TEST_FIXTURE_BYTES,
        );
        let decision = derive_conversation_key_via_ecdh_internal(&wrong_kind, &nostr_key);
        assert_eq!(decision.status, ConversationKeyStatus::InvalidKey);
        assert!(decision.output.is_none());

        let decision = derive_conversation_key_via_ecdh_internal(&nostr_key, &wrong_kind);
        assert_eq!(decision.status, ConversationKeyStatus::InvalidKey);
        assert!(decision.output.is_none());
    }

    #[test]
    fn rejects_placeholder_inputs() {
        let placeholder = SecretHandle::new_placeholder();
        let nostr_key = SecretHandle::new_from_32_bytes_for_internal_use(
            SecretHandleKind::NostrKeyMaterial,
            TEST_FIXTURE_BYTES,
        );
        let decision = derive_conversation_key_via_ecdh_internal(&placeholder, &nostr_key);
        assert_eq!(decision.status, ConversationKeyStatus::InvalidKey);
        assert!(decision.output.is_none());
    }

    #[test]
    fn rejects_cleared_inputs() {
        let mut cleared = SecretHandle::new_from_32_bytes_for_internal_use(
            SecretHandleKind::NostrKeyMaterial,
            TEST_FIXTURE_BYTES,
        );
        cleared.clear();
        let nostr_key = SecretHandle::new_from_32_bytes_for_internal_use(
            SecretHandleKind::NostrKeyMaterial,
            TEST_FIXTURE_BYTES,
        );
        let decision = derive_conversation_key_via_ecdh_internal(&cleared, &nostr_key);
        assert_eq!(decision.status, ConversationKeyStatus::InvalidKey);
        assert!(decision.output.is_none());
    }

    #[test]
    fn does_not_mutate_either_input_handle() {
        let secret = SecretHandle::new_from_32_bytes_for_internal_use(
            SecretHandleKind::NostrKeyMaterial,
            [0x11; 32],
        );
        let public = SecretHandle::new_from_32_bytes_for_internal_use(
            SecretHandleKind::NostrKeyMaterial,
            [0x22; 32],
        );
        let _ = derive_conversation_key_via_ecdh_internal(&secret, &public);
        assert_eq!(secret.kind(), SecretHandleKind::NostrKeyMaterial);
        assert!(!secret.is_cleared());
        assert_eq!(public.kind(), SecretHandleKind::NostrKeyMaterial);
        assert!(!public.is_cleared());
    }

    #[test]
    fn decision_always_names_ecdh_as_the_generation_method() {
        let placeholder = SecretHandle::new_placeholder();
        let decision = derive_conversation_key_via_ecdh_internal(&placeholder, &placeholder);
        assert_eq!(decision.generation, ConversationKeyGeneration::Ecdh);
    }

    /// `ConversationKeyGeneration` supports exactly one variant today — an
    /// exhaustive match with no wildcard arm compiles only because no other
    /// variant exists to add one for.
    #[test]
    fn conversation_key_generation_has_no_variant_other_than_ecdh() {
        let generation = ConversationKeyGeneration::Ecdh;
        match generation {
            ConversationKeyGeneration::Ecdh => {}
        }
    }

    #[test]
    fn expose_bytes_for_internal_message_key_derivation_returns_none_for_placeholder_and_cleared()
    {
        let placeholder = ConversationKey::new_placeholder();
        assert!(placeholder
            .expose_bytes_for_internal_message_key_derivation()
            .is_none());

        let mut real = ConversationKey::new_from_32_bytes_for_internal_use(TEST_FIXTURE_BYTES);
        real.clear();
        assert!(real
            .expose_bytes_for_internal_message_key_derivation()
            .is_none());
    }
}
