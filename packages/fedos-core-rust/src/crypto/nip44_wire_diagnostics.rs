//! Stage 227 — a fixed, display-only, per-feature NIP-44 WIRE diagnostics
//! preview. Crate-private only — see `src/crypto.rs`'s module-level doc
//! comment for this module's place in the `crypto` tree, and
//! `super::diagnostics` for the coarser, crate-wide `CryptoCapability`
//! table (which this module complements, not replaces or extends — see
//! below for why this stays a SEPARATE preview, mirroring
//! `super::aead_diagnostics`'s own "small, per-feature detail preview
//! alongside the main table" shape, Stage 155).
//!
//! **Why a new preview instead of new `CryptoCapability` rows**: this
//! stage's own scope explicitly forbids adding a `CryptoCapability`
//! variant or changing any existing one's meaning. `WirePayload`'s real
//! state — a real, wired skeleton whose `ciphertext`/`mac` fields are
//! STILL an explicit placeholder — has no accurate match among
//! `super::diagnostics::CapabilityReadiness`'s four existing labels
//! (`Ready`/`NotConnected`/`ReadyForImplementation`/`NotImplemented`):
//! calling it `Ready` would overclaim (no ChaCha20/HMAC exists),
//! `NotImplemented` would underclaim (real, tested code DOES exist and
//! IS connected), and `NotConnected`/`ReadyForImplementation` describe
//! different situations entirely. [`Nip44WireReadiness::Placeholder`]
//! names this precisely, instead of stretching an existing label to fit.
//!
//! `nip44_wire_diagnostics_preview()` is DISPLAY-ONLY, same discipline as
//! `super::diagnostics::crypto_diagnostics_preview`/
//! `super::aead_diagnostics::aead_diagnostics_preview`: it does not call
//! `crypto::nip44_wire_nonce::generate_wire_nonce_internal` or
//! `crypto::nip44_wire_payload::Nip44WirePayloadBuilder::build_placeholder`
//! — a fixed, hand-maintained table, reviewed BY HAND each stage, never a
//! live probe. No nonce byte, ciphertext byte, or MAC byte is ever held
//! or displayed here — only the two fixed feature labels and their fixed
//! readiness labels.
#![allow(dead_code)]

/// A non-sensitive readiness label for one [`Nip44WireFeature`] —
/// deliberately SEPARATE from `super::diagnostics::CapabilityReadiness`
/// (see this module's own doc comment above for why). Crate-private
/// only; never exposed via this crate's public API.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Nip44WireReadiness {
    /// Real, `cargo test`-verified code exists and is fully connected —
    /// e.g. `WireNonce` (`crypto::nip44_wire_nonce::generate_wire_nonce_internal`,
    /// Stage 224: every field it produces is real).
    Ready,
    /// Real, `cargo test`-verified code exists and is connected, but AT
    /// LEAST ONE field it produces is an explicit, documented
    /// placeholder — e.g. `WirePayload` (`crypto::nip44_wire_payload`,
    /// Stage 225–226: `version`/`nonce` are real, `ciphertext`/`mac` are
    /// `None`).
    Placeholder,
}

/// Which NIP-44 wire feature a [`Nip44WireFeatureReport`] names — a label
/// only. Crate-private only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Nip44WireFeature {
    WireNonce,
    WirePayload,
}

/// One row of the [`nip44_wire_diagnostics_preview`] table. Crate-private
/// only. Never contains a nonce/ciphertext/MAC byte — only the two
/// fixed, non-sensitive labels below.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Nip44WireFeatureReport {
    pub(crate) feature: Nip44WireFeature,
    pub(crate) readiness: Nip44WireReadiness,
}

/// A fixed, hand-maintained, display-only snapshot of both NIP-44 wire
/// features' current readiness. Returns exactly two rows (`WireNonce`,
/// `WirePayload`, in that order) every time it is called — takes no
/// parameter of any kind.
pub(crate) fn nip44_wire_diagnostics_preview() -> [Nip44WireFeatureReport; 2] {
    [
        Nip44WireFeatureReport {
            feature: Nip44WireFeature::WireNonce,
            readiness: Nip44WireReadiness::Ready,
        },
        Nip44WireFeatureReport {
            feature: Nip44WireFeature::WirePayload,
            readiness: Nip44WireReadiness::Placeholder,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preview_reports_exactly_two_rows_wire_nonce_ready_wire_payload_placeholder() {
        let preview = nip44_wire_diagnostics_preview();
        assert_eq!(preview.len(), 2);
        assert_eq!(preview[0].feature, Nip44WireFeature::WireNonce);
        assert_eq!(preview[0].readiness, Nip44WireReadiness::Ready);
        assert_eq!(preview[1].feature, Nip44WireFeature::WirePayload);
        assert_eq!(preview[1].readiness, Nip44WireReadiness::Placeholder);
    }

    #[test]
    fn preview_is_stable_across_repeated_calls() {
        assert_eq!(nip44_wire_diagnostics_preview(), nip44_wire_diagnostics_preview());
    }

    #[test]
    fn nip44_wire_readiness_has_no_variant_other_than_the_two_specified() {
        for readiness in [Nip44WireReadiness::Ready, Nip44WireReadiness::Placeholder] {
            match readiness {
                Nip44WireReadiness::Ready => {}
                Nip44WireReadiness::Placeholder => {}
            }
        }
    }

    #[test]
    fn nip44_wire_feature_has_no_variant_other_than_the_two_specified() {
        for feature in [Nip44WireFeature::WireNonce, Nip44WireFeature::WirePayload] {
            match feature {
                Nip44WireFeature::WireNonce => {}
                Nip44WireFeature::WirePayload => {}
            }
        }
    }
}
