//! Stage 217 — an INTERNAL-ONLY, LABEL-ONLY skeleton for NIP-44 v2's real
//! per-message key derivation. Crate-private only — see `src/crypto.rs`'s
//! module-level doc comment for this module's place in the `crypto` tree.
//!
//! `docs/nip44_message_key_review.md` (Stage 214) confirms, byte-for-byte
//! against `test-vectors/nip44/nip44-v2.json`'s `valid.get_message_keys`
//! category, that the real derivation is `HKDF-Expand(PRK =
//! conversation_key, info = nonce, L = 76)`, split into `chacha_key`
//! (32 bytes) ‖ `chacha_nonce` (12 bytes) ‖ `hmac_key` (32 bytes). This
//! module fixes the LABEL VOCABULARY for that split — `Nip44DerivedKeyKind`
//! names which of the three a value would be — WITHOUT calling HKDF, WITHOUT
//! generating a nonce, and WITHOUT producing a single real key byte.
//! [`derive_message_keys_exact_placeholder`] takes NO `ConversationKey`,
//! NO nonce, and NO other input of any kind — there is nothing yet for it
//! to derive FROM — and always returns all three kinds as
//! [`Nip44MessageKeyStatus::Placeholder`].
//!
//! **What this module is NOT**: no HKDF-expand call (no `use hkdf::`, no
//! `Hkdf::` of any kind), no connection to `crypto::conversation_key`/
//! `crypto::message_key`/`crypto::hkdf_bridge` (those are UNCHANGED by
//! this module), no nonce generation (no `fedos_random_bytes_32`/
//! `fedos_aead_nonce_96` call), no HMAC-SHA256, no ChaCha20 stream cipher,
//! no public API, no Runtime/Worker/Storage/Relay/Nostr connection, no
//! new `Cargo.toml` dependency. See `docs/nip44_wire_implementation_roadmap.md`
//! step 1 (candidate Stage 219) for where the real derivation this
//! skeleton names would eventually be implemented.
#![allow(dead_code)]

/// Which of NIP-44 v2's three per-message derived values a
/// [`Nip44MessageKeyDecision`] classifies — a label only, never a byte.
/// Mirrors `docs/nip44_message_key_review.md` §1's fixed byte-offset
/// split of the 76-byte HKDF-expand output: `ChachaKey` (bytes 0..32),
/// `ChachaNonce` (bytes 32..44), `HmacKey` (bytes 44..76). Crate-private
/// only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Nip44DerivedKeyKind {
    ChachaKey,
    ChachaNonce,
    HmacKey,
}

/// Coarse observable status of a [`Nip44MessageKeyDecision`] — mirrors
/// `Nip44WireStatus`'s "one variant today" shape
/// (`crypto::nip44_wire`, Stage 209–213). This skeleton produces ONLY
/// `Placeholder` — no real HKDF-expand call exists anywhere in this
/// crate yet for the exact, nonce-`info`-keyed per-message derivation
/// `docs/nip44_message_key_review.md` reviews. A future stage that
/// actually implements it would add a `Ready`-style variant as its own
/// reviewed change, exactly as `crypto::conversation_key`'s own
/// `ConversationKeyStatus` did once Stage 199 landed real ECDH+HKDF code.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Nip44MessageKeyStatus {
    Placeholder,
}

/// A LABEL-ONLY decision naming which of the three per-message derived
/// values [`Nip44DerivedKeyKind`] classifies — WITHOUT holding, carrying,
/// or referencing any actual key byte, nonce byte, or HKDF input/output
/// of any kind. Crate-private only; not part of this crate's public API.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Nip44MessageKeyDecision {
    pub(crate) kind: Nip44DerivedKeyKind,
    pub(crate) status: Nip44MessageKeyStatus,
}

impl Nip44MessageKeyDecision {
    fn new_placeholder(kind: Nip44DerivedKeyKind) -> Self {
        Self {
            kind,
            status: Nip44MessageKeyStatus::Placeholder,
        }
    }

    pub(crate) fn kind(&self) -> Nip44DerivedKeyKind {
        self.kind
    }

    pub(crate) fn status(&self) -> Nip44MessageKeyStatus {
        self.status
    }
}

/// Name all three of NIP-44 v2's per-message derived values as
/// [`Nip44MessageKeyStatus::Placeholder`] decisions, in the fixed
/// `chacha_key` ‖ `chacha_nonce` ‖ `hmac_key` byte order
/// `docs/nip44_message_key_review.md` §1 documents. Takes NO
/// `ConversationKey`, NO nonce, and no other parameter of any kind —
/// there is no real HKDF-expand call behind this function; it exists
/// only to fix the vocabulary a future exact implementation would return
/// through, mirroring `crypto::nip44_wire::Nip44WireDecision::new_placeholder`'s
/// own "label only, no cryptography" shape.
pub(crate) fn derive_message_keys_exact_placeholder() -> [Nip44MessageKeyDecision; 3] {
    [
        Nip44MessageKeyDecision::new_placeholder(Nip44DerivedKeyKind::ChachaKey),
        Nip44MessageKeyDecision::new_placeholder(Nip44DerivedKeyKind::ChachaNonce),
        Nip44MessageKeyDecision::new_placeholder(Nip44DerivedKeyKind::HmacKey),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derive_message_keys_exact_placeholder_returns_all_three_kinds_in_the_documented_order() {
        let decisions = derive_message_keys_exact_placeholder();
        assert_eq!(decisions.len(), 3);
        assert_eq!(decisions[0].kind(), Nip44DerivedKeyKind::ChachaKey);
        assert_eq!(decisions[1].kind(), Nip44DerivedKeyKind::ChachaNonce);
        assert_eq!(decisions[2].kind(), Nip44DerivedKeyKind::HmacKey);
    }

    #[test]
    fn derive_message_keys_exact_placeholder_always_reports_placeholder_status() {
        for decision in derive_message_keys_exact_placeholder() {
            assert_eq!(decision.status(), Nip44MessageKeyStatus::Placeholder);
        }
    }

    #[test]
    fn derive_message_keys_exact_placeholder_is_deterministic_and_takes_no_input() {
        let first = derive_message_keys_exact_placeholder();
        let second = derive_message_keys_exact_placeholder();
        assert_eq!(first, second);
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
    fn nip44_message_key_status_has_no_variant_other_than_placeholder() {
        let status = Nip44MessageKeyStatus::Placeholder;
        match status {
            Nip44MessageKeyStatus::Placeholder => {}
        }
    }
}
