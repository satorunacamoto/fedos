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
//!
//! Stage 195 adds a FOURTH `CapabilityReadiness` variant,
//! `ReadyForImplementation`, and reports it for the new `Ecdh` capability
//! (Stage 194 adopted `k256`, but zero ECDH code exists) — seeing this
//! distinction requires a state strictly between `NotImplemented` (no
//! dependency, no code) and `NotConnected` (a skeleton/staging TYPE
//! exists, not yet wired): `Ecdh` has neither a dependency gap NOR any
//! Rust type/skeleton yet, only an adopted library to build one against.
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
    /// wired. As of Stage 152–154 no capability reports this — `Aead` was
    /// the last one (staged per `docs/hkdf_internal_plan.md`'s AEAD
    /// staging section), now `Ready`.
    NotConnected,
    /// The dependency/library this capability needs is now adopted in
    /// `Cargo.toml`, but ZERO code — no skeleton, no function, no type —
    /// has been written for it yet. Stage 195 introduces this variant for
    /// exactly one capability, `Ecdh` (Stage 194 adopted `k256`). A
    /// capability moves OUT of this state, into `NotConnected` (a
    /// skeleton lands) or `Ready` (real, wired code lands), in its own
    /// later, separate, explicitly-reviewed stage — never silently.
    ReadyForImplementation,
    /// No implementation, skeleton, or adopted dependency exists yet at
    /// all (e.g. `Nip44`, `Schnorr`, `StorageKey`, `ConversationKey`).
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
/// exactly eleven rows, in [`CryptoCapability::ALL`]'s order, one per
/// capability, every time it is called — takes no parameter of any kind.
pub(crate) fn crypto_diagnostics_preview() -> [CapabilityReport; 11] {
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
            readiness: CapabilityReadiness::Ready,
        },
        CapabilityReport {
            capability: CryptoCapability::Envelope,
            readiness: CapabilityReadiness::Ready,
        },
        CapabilityReport {
            capability: CryptoCapability::Ecdh,
            readiness: CapabilityReadiness::ReadyForImplementation,
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
    fn preview_reports_exactly_eleven_rows_matching_capability_all_order() {
        let preview = crypto_diagnostics_preview();
        assert_eq!(preview.len(), 11);
        for (row, expected_capability) in preview.iter().zip(CryptoCapability::ALL.iter()) {
            assert_eq!(row.capability, *expected_capability);
        }
    }

    #[test]
    fn ready_capabilities_are_exactly_random_nonce_secret_handle_hkdf_aead_and_envelope() {
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
                CryptoCapability::Aead,
                CryptoCapability::Envelope,
            ]
        );
    }

    #[test]
    fn aead_and_envelope_are_ready_as_of_stage_161_164() {
        let preview = crypto_diagnostics_preview();
        for capability in [CryptoCapability::Aead, CryptoCapability::Envelope] {
            let row = preview
                .iter()
                .find(|row| row.capability == capability)
                .expect("expected capability row to exist");
            assert_eq!(row.readiness, CapabilityReadiness::Ready);
        }
    }

    #[test]
    fn no_capability_reports_not_connected_as_of_stage_152_154() {
        let preview = crypto_diagnostics_preview();
        assert!(preview
            .iter()
            .all(|row| row.readiness != CapabilityReadiness::NotConnected));
    }

    #[test]
    fn ecdh_is_ready_for_implementation_as_of_stage_194_195_not_ready_and_not_not_implemented() {
        let preview = crypto_diagnostics_preview();
        let row = preview
            .iter()
            .find(|row| row.capability == CryptoCapability::Ecdh)
            .expect("expected an Ecdh row to exist");
        assert_eq!(row.readiness, CapabilityReadiness::ReadyForImplementation);
        assert_ne!(row.readiness, CapabilityReadiness::Ready);
        assert_ne!(row.readiness, CapabilityReadiness::NotImplemented);
        assert_ne!(row.readiness, CapabilityReadiness::NotConnected);
    }

    #[test]
    fn exactly_one_capability_reports_ready_for_implementation() {
        let preview = crypto_diagnostics_preview();
        let ready_for_implementation: Vec<CryptoCapability> = preview
            .iter()
            .filter(|row| row.readiness == CapabilityReadiness::ReadyForImplementation)
            .map(|row| row.capability)
            .collect();
        assert_eq!(ready_for_implementation, vec![CryptoCapability::Ecdh]);
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
