//! Stage 151 — a fixed, display-only crypto diagnostics preview. Crate-
//! private only — see `src/crypto.rs`'s module-level doc comment for the
//! full scope of this module and its `capability_matrix` sibling.
//!
//! `crypto_diagnostics_preview()` is a DISPLAY-ONLY snapshot: it returns a
//! fixed, hand-maintained table pairing each `CryptoCapability` with a
//! `CapabilityReadiness` label. It is NOT a live health-check — it does not
//! call `fedos_random_bytes_32`, `fedos_aead_nonce_96`, construct a
//! `SecretHandle`, call `derive_secret_handle_internal`, or touch any other
//! crypto function to compute these values. The table's values are updated
//! BY HAND as each capability's implementation status changes across
//! stages — this keeps the preview simple and auditable, and guarantees it
//! can never accidentally observe (let alone display) a real secret byte,
//! since it never runs any operation that would produce one.
#![allow(dead_code)]

use super::capability_matrix::CryptoCapability;

/// A non-sensitive readiness label for one `CryptoCapability`. Crate-private
/// only; never exposed via this crate's public API.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CapabilityReadiness {
    /// A real, `cargo test`-verified implementation exists and is connected
    /// (e.g. `Random`, `Nonce`, `SecretHandle`, `Hkdf`).
    Ready,
    /// A skeleton/staging design exists, but the real operation is not yet
    /// wired (e.g. `Aead` — staged per `docs/hkdf_internal_plan.md`'s AEAD
    /// staging section, not yet implemented).
    NotConnected,
    /// No implementation or skeleton exists yet at all (e.g. `Nip44`,
    /// `Schnorr`, `StorageKey`, `ConversationKey`).
    NotImplemented,
}

/// One row of the [`crypto_diagnostics_preview`] table. Crate-private only.
/// Never contains a key/seed/plaintext/ciphertext/passphrase byte — only
/// the two fixed, non-sensitive labels below.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct CapabilityReport {
    pub(crate) capability: CryptoCapability,
    pub(crate) readiness: CapabilityReadiness,
}

/// A fixed, hand-maintained, display-only snapshot of every
/// [`CryptoCapability`]'s current readiness — see this module's own doc
/// comment above for why this is a fixed table, not a live probe. Returns
/// exactly nine rows, in [`CryptoCapability::ALL`]'s order, one per
/// capability, every time it is called — takes no parameter of any kind.
pub(crate) fn crypto_diagnostics_preview() -> [CapabilityReport; 9] {
    [
        CapabilityReport {
            capability: CryptoCapability::Random,
            readiness: CapabilityReadiness::Ready,
        },
        CapabilityReport {
            capability: CryptoCapability::Nonce,
            readiness: CapabilityReadiness::Ready,
        },
        CapabilityReport {
            capability: CryptoCapability::SecretHandle,
            readiness: CapabilityReadiness::Ready,
        },
        CapabilityReport {
            capability: CryptoCapability::Hkdf,
            readiness: CapabilityReadiness::Ready,
        },
        CapabilityReport {
            capability: CryptoCapability::Aead,
            readiness: CapabilityReadiness::NotConnected,
        },
        CapabilityReport {
            capability: CryptoCapability::Nip44,
            readiness: CapabilityReadiness::NotImplemented,
        },
        CapabilityReport {
            capability: CryptoCapability::Schnorr,
            readiness: CapabilityReadiness::NotImplemented,
        },
        CapabilityReport {
            capability: CryptoCapability::StorageKey,
            readiness: CapabilityReadiness::NotImplemented,
        },
        CapabilityReport {
            capability: CryptoCapability::ConversationKey,
            readiness: CapabilityReadiness::NotImplemented,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preview_reports_exactly_nine_rows_matching_capability_all_order() {
        let preview = crypto_diagnostics_preview();
        assert_eq!(preview.len(), 9);
        for (row, expected_capability) in preview.iter().zip(CryptoCapability::ALL.iter()) {
            assert_eq!(row.capability, *expected_capability);
        }
    }

    #[test]
    fn ready_capabilities_are_exactly_random_nonce_secret_handle_and_hkdf() {
        let preview = crypto_diagnostics_preview();
        let ready: Vec<CryptoCapability> = preview
            .iter()
            .filter(|row| row.readiness == CapabilityReadiness::Ready)
            .map(|row| row.capability)
            .collect();
        assert_eq!(
            ready,
            vec![
                CryptoCapability::Random,
                CryptoCapability::Nonce,
                CryptoCapability::SecretHandle,
                CryptoCapability::Hkdf,
            ]
        );
    }

    #[test]
    fn aead_is_not_connected_not_ready_and_not_not_implemented() {
        let preview = crypto_diagnostics_preview();
        let aead = preview
            .iter()
            .find(|row| row.capability == CryptoCapability::Aead)
            .expect("Aead row must exist");
        assert_eq!(aead.readiness, CapabilityReadiness::NotConnected);
    }

    #[test]
    fn not_implemented_capabilities_are_exactly_nip44_schnorr_storage_key_and_conversation_key() {
        let preview = crypto_diagnostics_preview();
        let not_implemented: Vec<CryptoCapability> = preview
            .iter()
            .filter(|row| row.readiness == CapabilityReadiness::NotImplemented)
            .map(|row| row.capability)
            .collect();
        assert_eq!(
            not_implemented,
            vec![
                CryptoCapability::Nip44,
                CryptoCapability::Schnorr,
                CryptoCapability::StorageKey,
                CryptoCapability::ConversationKey,
            ]
        );
    }

    #[test]
    fn preview_is_stable_across_repeated_calls() {
        assert_eq!(crypto_diagnostics_preview(), crypto_diagnostics_preview());
    }
}
