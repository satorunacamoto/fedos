//! Stage 150 — a fixed, non-sensitive crypto capability label enumeration.
//! Stage 164 adds a tenth variant, `Envelope`, now that Stage 161–163's
//! AEAD ↔ ciphertext-envelope bridge is real. Stage 195 adds an eleventh
//! variant, `Ecdh`, now that Stage 194 adopts `k256` (secp256k1
//! elliptic-curve arithmetic) — see `diagnostics`'s own module-level doc
//! comment for why this capability reports `ReadyForImplementation`
//! rather than `Ready`: the dependency exists, but zero ECDH code has
//! been written. Crate-private only — see `src/crypto.rs`'s module-level
//! doc comment for the full scope of this module and its `diagnostics`
//! sibling.
#![allow(dead_code)]

/// One of this crate's eleven tracked crypto capabilities — a label ONLY,
/// never a byte, never an operation. Crate-private only; never exposed via
/// this crate's public API.
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
    /// `HkdfDomain::Conversation` consumer) — domain label exists (Stage
    /// 147); no consumer wired yet. Depends on `Ecdh` (above) landing
    /// FIRST, per `docs/nip44_dependency_adoption.md`'s fixed future
    /// order — still `NotImplemented`, not promoted alongside `Ecdh` this
    /// stage.
    ConversationKey,
}

impl CryptoCapability {
    /// Every `CryptoCapability` variant, in a fixed, stable order — the same
    /// order `diagnostics::crypto_diagnostics_preview` reports them in.
    /// Crate-private only.
    pub(crate) const ALL: [CryptoCapability; 11] = [
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
