//! Stage 150 — a fixed, non-sensitive crypto capability label enumeration.
//! Stage 164 adds a tenth variant, `Envelope`, now that Stage 161–163's
//! AEAD ↔ ciphertext-envelope bridge is real. Stage 195 adds an eleventh
//! variant, `Ecdh`, now that Stage 194 adopts `k256` (secp256k1
//! elliptic-curve arithmetic) — see `diagnostics`'s own module-level doc
//! comment for why this capability reports `ReadyForImplementation`
//! rather than `Ready`: the dependency exists, but zero ECDH code has
//! been written. Stage 198–201 add four more variants — `MessageKey`,
//! `Padding`, `Encrypt`, `Decrypt` — completing the fixed future order
//! `docs/nip44_dependency_adoption.md` §8 names (ECDH → ConversationKey →
//! MessageKey → Padding → Encrypt → Decrypt → NIP-44) as fully-tracked
//! capability labels, even though `Padding`/`Encrypt`/`Decrypt` remain
//! unimplemented this stage — see `diagnostics` for each one's current
//! readiness. Stage 202–208 implement all three (`nip44_padding`,
//! `nip44_encrypt`, `nip44_decrypt`) and add a SIXTEENTH variant,
//! `Authentication`, tracking `nip44_decrypt`'s single-fixed-label MAC
//! discipline as its own capability — all four now report `Ready` (see
//! `diagnostics`). Crate-private only — see `src/crypto.rs`'s module-level
//! doc comment for the full scope of this module and its `diagnostics`
//! sibling.
#![allow(dead_code)]

/// One of this crate's sixteen tracked crypto capabilities — a label
/// ONLY, never a byte, never an operation. Crate-private only; never
/// exposed via this crate's public API.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CryptoCapability {
    /// `fedos_random_bytes_32` (Stage 137).
    Random,
    /// `fedos_aead_nonce_96` (Stage 138).
    Nonce,
    /// `SecretHandle` (`secret_handle` module, Stage 79/144–146).
    SecretHandle,
    /// `derive_secret_handle_internal` (`kdf_core` module, Stage 147).
    Hkdf,
    /// `crypto::aead_internal::seal_internal`/`open_internal` (Stage
    /// 152–154). The pre-existing `aead_core` (Stage 80) skeleton remains
    /// a separate, still-unconnected placeholder.
    Aead,
    /// `crypto::ciphertext_envelope`/`aead_envelope_bridge` (Stage
    /// 157–163): a real AEAD seal result bridged into a real
    /// `AeadCiphertextEnvelope`, and back again for opening.
    Envelope,
    /// secp256k1 elliptic-curve Diffie-Hellman — the shared-secret step
    /// `docs/nip44_internal_plan.md` §3 needs for NIP-44's conversation
    /// key. Stage 194 adopts `k256` (field/group arithmetic only); NO
    /// ECDH function exists yet — see `diagnostics` for the
    /// `ReadyForImplementation` distinction from `Ready`/`NotImplemented`.
    Ecdh,
    /// NIP-44 encrypted direct messages — not yet implemented.
    Nip44,
    /// Schnorr (BIP-340/Nostr event) signing — not yet implemented.
    Schnorr,
    /// A storage-encryption-key derivation (an `HkdfDomain::Storage`
    /// consumer) — domain label exists (Stage 147); no consumer wired yet.
    StorageKey,
    /// A conversation/messaging-key derivation (an
    /// `HkdfDomain::Conversation` consumer) — Stage 199 makes this real:
    /// `crypto::conversation_key::derive_conversation_key_via_ecdh_internal`
    /// (ECDH + HKDF-extract), vector-verified against
    /// `test-vectors/nip44/nip44-v2.json`'s `valid`/`invalid
    /// .get_conversation_key` categories.
    ConversationKey,
    /// A NIP-44 per-message key (`crypto::message_key`/`crypto::hkdf_bridge`,
    /// Stage 200–201) — derived FROM `ConversationKey` via the
    /// pre-existing `HkdfDomain::Conversation`. This is a generic
    /// architectural bridge, not NIP-44 v2's real per-message
    /// nonce-salted derivation — see `crypto::hkdf_bridge`'s own
    /// module-level doc comment.
    MessageKey,
    /// NIP-44 v2's logarithmic-bucket plaintext padding scheme
    /// (`docs/nip44_internal_plan.md` §5) — `crypto::nip44_padding`
    /// (Stage 202–203) implements this SPEC-EXACTLY, vector-verified
    /// against `test-vectors/nip44/nip44-v2.json`'s `valid.calc_padded_len`/
    /// `invalid.encrypt_msg_lengths` categories. This is the one piece of
    /// the Stage 202–208 bridge that already matches the real NIP-44 v2
    /// wire format byte-for-byte — see
    /// `docs/nip44_wire_compatibility_gap.md`.
    Padding,
    /// `crypto::nip44_encrypt` (Stage 204): a pad-then-seal pipeline keyed
    /// by a `MessageKey`, reusing this crate's PRE-EXISTING
    /// ChaCha20-Poly1305 AEAD (`crypto::aead_internal`) rather than NIP-44
    /// v2's byte-exact raw-ChaCha20-plus-separate-HMAC-SHA256 wire
    /// construction. This is the "FedOS internal NIP-44-like bridge", NOT
    /// a NIP-44 v2 wire-compatible encrypt — see
    /// `docs/nip44_wire_compatibility_gap.md` for the full field-by-field
    /// gap and `docs/nip44_wire_implementation_roadmap.md` for the path to
    /// closing it.
    Encrypt,
    /// `crypto::nip44_decrypt` (Stage 205): the inverse of `Encrypt` —
    /// open-then-unpad, collapsing every failure cause into a single fixed
    /// `AuthenticationFailed` label (see `Authentication` below). Same
    /// "internal bridge, not NIP-44 v2 wire-compatible" scope note as
    /// `Encrypt` above.
    Decrypt,
    /// Stage 208 — the MAC/tag-verification discipline
    /// `crypto::nip44_decrypt` implements: a SINGLE fixed
    /// `AuthenticationFailed` label covering every decrypt failure cause
    /// (wrong key, wrong nonce, tampered ciphertext, invalid MAC, invalid
    /// padding), verified constant-time and cause-indistinguishable by
    /// that module's own test suite. Distinct from `Encrypt`/`Decrypt`
    /// themselves (the cipher operations) — this label tracks the
    /// authentication PROPERTY specifically, per
    /// `docs/nip44_internal_plan.md` §7.
    Authentication,
}

impl CryptoCapability {
    /// Every `CryptoCapability` variant, in a fixed, stable order — the same
    /// order `diagnostics::crypto_diagnostics_preview` reports them in.
    /// Crate-private only.
    pub(crate) const ALL: [CryptoCapability; 16] = [
        CryptoCapability::Random,
        CryptoCapability::Nonce,
        CryptoCapability::SecretHandle,
        CryptoCapability::Hkdf,
        CryptoCapability::Aead,
        CryptoCapability::Envelope,
        CryptoCapability::Ecdh,
        CryptoCapability::Nip44,
        CryptoCapability::Schnorr,
        CryptoCapability::StorageKey,
        CryptoCapability::ConversationKey,
        CryptoCapability::MessageKey,
        CryptoCapability::Padding,
        CryptoCapability::Encrypt,
        CryptoCapability::Decrypt,
        CryptoCapability::Authentication,
    ];

    /// The fixed `&'static str` label for this capability — never built,
    /// formatted, concatenated, or derived from any input, mirroring
    /// `crate::domain_label::DomainLabelKind::as_static_label` (Stage 88).
    pub(crate) const fn as_static_label(self) -> &'static str {
        match self {
            CryptoCapability::Random => "random",
            CryptoCapability::Nonce => "nonce",
            CryptoCapability::SecretHandle => "secret_handle",
            CryptoCapability::Hkdf => "hkdf",
            CryptoCapability::Aead => "aead",
            CryptoCapability::Envelope => "envelope",
            CryptoCapability::Ecdh => "ecdh",
            CryptoCapability::Nip44 => "nip44",
            CryptoCapability::Schnorr => "schnorr",
            CryptoCapability::StorageKey => "storage_key",
            CryptoCapability::ConversationKey => "conversation_key",
            CryptoCapability::MessageKey => "message_key",
            CryptoCapability::Padding => "padding",
            CryptoCapability::Encrypt => "encrypt",
            CryptoCapability::Decrypt => "decrypt",
            CryptoCapability::Authentication => "authentication",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_contains_every_variant_exactly_once_in_the_documented_order() {
        assert_eq!(
            CryptoCapability::ALL,
            [
                CryptoCapability::Random,
                CryptoCapability::Nonce,
                CryptoCapability::SecretHandle,
                CryptoCapability::Hkdf,
                CryptoCapability::Aead,
                CryptoCapability::Envelope,
                CryptoCapability::Ecdh,
                CryptoCapability::Nip44,
                CryptoCapability::Schnorr,
                CryptoCapability::StorageKey,
                CryptoCapability::ConversationKey,
                CryptoCapability::MessageKey,
                CryptoCapability::Padding,
                CryptoCapability::Encrypt,
                CryptoCapability::Decrypt,
                CryptoCapability::Authentication,
            ]
        );
    }

    #[test]
    fn as_static_label_returns_the_documented_fixed_string_per_variant() {
        let expected = [
            (CryptoCapability::Random, "random"),
            (CryptoCapability::Nonce, "nonce"),
            (CryptoCapability::SecretHandle, "secret_handle"),
            (CryptoCapability::Hkdf, "hkdf"),
            (CryptoCapability::Aead, "aead"),
            (CryptoCapability::Envelope, "envelope"),
            (CryptoCapability::Ecdh, "ecdh"),
            (CryptoCapability::Nip44, "nip44"),
            (CryptoCapability::Schnorr, "schnorr"),
            (CryptoCapability::StorageKey, "storage_key"),
            (CryptoCapability::ConversationKey, "conversation_key"),
            (CryptoCapability::MessageKey, "message_key"),
            (CryptoCapability::Padding, "padding"),
            (CryptoCapability::Encrypt, "encrypt"),
            (CryptoCapability::Decrypt, "decrypt"),
            (CryptoCapability::Authentication, "authentication"),
        ];
        for (capability, label) in expected {
            assert_eq!(capability.as_static_label(), label);
        }
    }

    #[test]
    fn as_static_label_is_stable_across_repeated_calls() {
        let capability = CryptoCapability::Hkdf;
        assert_eq!(capability.as_static_label(), capability.as_static_label());
    }

    #[test]
    fn every_label_is_unique() {
        let labels: Vec<&'static str> = CryptoCapability::ALL
            .iter()
            .map(|c| c.as_static_label())
            .collect();
        let mut sorted = labels.clone();
        sorted.sort_unstable();
        sorted.dedup();
        assert_eq!(sorted.len(), labels.len());
    }
}
