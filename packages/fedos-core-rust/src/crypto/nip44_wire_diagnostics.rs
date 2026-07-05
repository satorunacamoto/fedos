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
//! `crypto::nip44_wire_nonce::generate_wire_nonce_internal`,
//! `crypto::nip44_wire_payload::Nip44WirePayloadBuilder::build_placeholder`,
//! `crypto::nip44_stream_cipher::encrypt_stream_internal`, or
//! `crypto::nip44_hmac::compute_hmac_internal` — a fixed, hand-maintained
//! table, reviewed BY HAND each stage, never a live probe. No nonce
//! byte, ciphertext byte, key byte, or MAC byte is ever held or
//! displayed here — only the four fixed feature labels and their fixed
//! readiness labels.
//!
//! Stage 229–232 add two more rows: `WireCrypto` → `Ready`
//! (`crypto::nip44_stream_cipher`, Stage 229 — the real, byte-exact
//! ChaCha20 stream cipher, vector-verified against
//! `valid.encrypt_decrypt`) and `WireAuthentication` → `Ready`
//! (`crypto::nip44_hmac`, Stage 231 — the real HMAC-SHA256
//! authentication step, and `crypto::nip44_wire_decrypt`, Stage 232 —
//! the complete verify-HMAC → decrypt-stream → unpad pipeline, also
//! vector-verified end-to-end). Both report `Ready` (not
//! `Placeholder`) — unlike `WirePayload`, neither has any field that
//! stays an explicit placeholder: `WireCrypto`'s ChaCha20 stream and
//! `WireAuthentication`'s HMAC tag are both fully real, `cargo
//! test`-verified operations.
//!
//! Stage 238 adds four more rows, all `Ready`: `WireEncoding`
//! (`crypto::nip44_wire_encoding`, Stage 234 — real base64 wire payload
//! encode/decode), `WireEncrypt` (`crypto::nip44_wire_encrypt`, Stage
//! 236 — the complete wire-compatible ENCRYPT pipeline), `WireDecrypt`
//! (`crypto::nip44_wire_decrypt`'s wire-STRING-facing
//! `decrypt_wire_payload_internal`/`decrypt_wire_payload_from_bytes_internal`,
//! Stage 235 — distinct from `WireAuthentication` above, which tracks
//! the byte-level HMAC/decrypt pipeline specifically), and
//! `WireInvalidVectors` (confirming `test-vectors/nip44/nip44-v2.json`'s
//! full `invalid.decrypt` category, Stage 235, collapses to
//! `InvalidPayload`/`AuthenticationFailed` for every one of its 12
//! cases). Still no `CryptoCapability` variant added, still no existing
//! capability's meaning changed.
#![allow(dead_code)]

/// A non-sensitive readiness label for one [`Nip44WireFeature`] —
/// deliberately SEPARATE from `super::diagnostics::CapabilityReadiness`
/// (see this module's own doc comment above for why). Crate-private
/// only; never exposed via this crate's public API.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Nip44WireReadiness {
    /// Real, `cargo test`-verified code exists and is fully connected —
    /// e.g. `WireNonce` (`crypto::nip44_wire_nonce::generate_wire_nonce_internal`,
    /// Stage 224: every field it produces is real), `WireCrypto`
    /// (`crypto::nip44_stream_cipher`, Stage 229), `WireAuthentication`
    /// (`crypto::nip44_hmac`/`crypto::nip44_wire_decrypt`, Stage 231–232).
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
    WireCrypto,
    WireAuthentication,
    WireEncoding,
    WireEncrypt,
    WireDecrypt,
    WireInvalidVectors,
}

/// One row of the [`nip44_wire_diagnostics_preview`] table. Crate-private
/// only. Never contains a nonce/ciphertext/key/MAC byte — only the two
/// fixed, non-sensitive labels below.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Nip44WireFeatureReport {
    pub(crate) feature: Nip44WireFeature,
    pub(crate) readiness: Nip44WireReadiness,
}

/// A fixed, hand-maintained, display-only snapshot of all eight NIP-44
/// wire features' current readiness. Returns exactly eight rows
/// (`WireNonce`, `WirePayload`, `WireCrypto`, `WireAuthentication`,
/// `WireEncoding`, `WireEncrypt`, `WireDecrypt`, `WireInvalidVectors`, in
/// that order) every time it is called — takes no parameter of any
/// kind.
pub(crate) fn nip44_wire_diagnostics_preview() -> [Nip44WireFeatureReport; 8] {
    [
        Nip44WireFeatureReport {
            feature: Nip44WireFeature::WireNonce,
            readiness: Nip44WireReadiness::Ready,
        },
        Nip44WireFeatureReport {
            feature: Nip44WireFeature::WirePayload,
            readiness: Nip44WireReadiness::Placeholder,
        },
        Nip44WireFeatureReport {
            feature: Nip44WireFeature::WireCrypto,
            readiness: Nip44WireReadiness::Ready,
        },
        Nip44WireFeatureReport {
            feature: Nip44WireFeature::WireAuthentication,
            readiness: Nip44WireReadiness::Ready,
        },
        Nip44WireFeatureReport {
            feature: Nip44WireFeature::WireEncoding,
            readiness: Nip44WireReadiness::Ready,
        },
        Nip44WireFeatureReport {
            feature: Nip44WireFeature::WireEncrypt,
            readiness: Nip44WireReadiness::Ready,
        },
        Nip44WireFeatureReport {
            feature: Nip44WireFeature::WireDecrypt,
            readiness: Nip44WireReadiness::Ready,
        },
        Nip44WireFeatureReport {
            feature: Nip44WireFeature::WireInvalidVectors,
            readiness: Nip44WireReadiness::Ready,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preview_reports_exactly_eight_rows_in_the_documented_order_and_readiness() {
        let preview = nip44_wire_diagnostics_preview();
        assert_eq!(preview.len(), 8);
        assert_eq!(preview[0].feature, Nip44WireFeature::WireNonce);
        assert_eq!(preview[0].readiness, Nip44WireReadiness::Ready);
        assert_eq!(preview[1].feature, Nip44WireFeature::WirePayload);
        assert_eq!(preview[1].readiness, Nip44WireReadiness::Placeholder);
        assert_eq!(preview[2].feature, Nip44WireFeature::WireCrypto);
        assert_eq!(preview[2].readiness, Nip44WireReadiness::Ready);
        assert_eq!(preview[3].feature, Nip44WireFeature::WireAuthentication);
        assert_eq!(preview[3].readiness, Nip44WireReadiness::Ready);
        assert_eq!(preview[4].feature, Nip44WireFeature::WireEncoding);
        assert_eq!(preview[4].readiness, Nip44WireReadiness::Ready);
        assert_eq!(preview[5].feature, Nip44WireFeature::WireEncrypt);
        assert_eq!(preview[5].readiness, Nip44WireReadiness::Ready);
        assert_eq!(preview[6].feature, Nip44WireFeature::WireDecrypt);
        assert_eq!(preview[6].readiness, Nip44WireReadiness::Ready);
        assert_eq!(preview[7].feature, Nip44WireFeature::WireInvalidVectors);
        assert_eq!(preview[7].readiness, Nip44WireReadiness::Ready);
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
    fn nip44_wire_feature_has_no_variant_other_than_the_eight_specified() {
        for feature in [
            Nip44WireFeature::WireNonce,
            Nip44WireFeature::WirePayload,
            Nip44WireFeature::WireCrypto,
            Nip44WireFeature::WireAuthentication,
            Nip44WireFeature::WireEncoding,
            Nip44WireFeature::WireEncrypt,
            Nip44WireFeature::WireDecrypt,
            Nip44WireFeature::WireInvalidVectors,
        ] {
            match feature {
                Nip44WireFeature::WireNonce => {}
                Nip44WireFeature::WirePayload => {}
                Nip44WireFeature::WireCrypto => {}
                Nip44WireFeature::WireAuthentication => {}
                Nip44WireFeature::WireEncoding => {}
                Nip44WireFeature::WireEncrypt => {}
                Nip44WireFeature::WireDecrypt => {}
                Nip44WireFeature::WireInvalidVectors => {}
            }
        }
    }
}
