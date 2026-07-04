//! Stage 155 — a fixed, display-only, per-algorithm AEAD diagnostics
//! preview. Crate-private only — see `src/crypto.rs`'s module-level doc
//! comment for this module's place in the `crypto` tree, and
//! `super::diagnostics` for the coarser, crate-wide capability preview
//! (whose single `Aead` row this module's two-row detail complements, not
//! replaces).
//!
//! `aead_diagnostics_preview()` is DISPLAY-ONLY, same discipline as
//! `super::diagnostics::crypto_diagnostics_preview`: it does not call
//! `super::aead_internal::seal_internal`/`open_internal`, does not
//! construct a `SecretHandle`, and does not call `fedos_aead_nonce_96` — a
//! fixed, hand-maintained table, reviewed BY HAND each stage, never a live
//! probe. No secret byte, key, nonce, plaintext, or ciphertext is ever
//! held or displayed here — only the two fixed algorithm labels and their
//! fixed readiness labels.
#![allow(dead_code)]

use super::aead_internal::AeadCipher;
use super::diagnostics::CapabilityReadiness;

/// One row of the [`aead_diagnostics_preview`] table. Crate-private only.
/// Never contains a key/nonce/plaintext/ciphertext/tag byte — only the two
/// fixed, non-sensitive labels below.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct AeadAlgorithmReport {
    pub(crate) algorithm: AeadCipher,
    pub(crate) readiness: CapabilityReadiness,
}

/// A fixed, hand-maintained, display-only snapshot of both AEAD
/// algorithms' current readiness. Returns exactly two rows
/// (`ChaCha20Poly1305`, `Aes256Gcm`, in that order) every time it is
/// called — takes no parameter of any kind.
pub(crate) fn aead_diagnostics_preview() -> [AeadAlgorithmReport; 2] {
    [
        AeadAlgorithmReport {
            algorithm: AeadCipher::ChaCha20Poly1305,
            readiness: CapabilityReadiness::Ready,
        },
        AeadAlgorithmReport {
            algorithm: AeadCipher::Aes256Gcm,
            readiness: CapabilityReadiness::Ready,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preview_reports_exactly_two_rows_both_ready() {
        let preview = aead_diagnostics_preview();
        assert_eq!(preview.len(), 2);
        for row in preview.iter() {
            assert_eq!(row.readiness, CapabilityReadiness::Ready);
        }
    }

    #[test]
    fn preview_reports_chacha20poly1305_then_aes256gcm_in_that_order() {
        let preview = aead_diagnostics_preview();
        assert_eq!(preview[0].algorithm, AeadCipher::ChaCha20Poly1305);
        assert_eq!(preview[1].algorithm, AeadCipher::Aes256Gcm);
    }

    #[test]
    fn preview_is_stable_across_repeated_calls() {
        assert_eq!(aead_diagnostics_preview(), aead_diagnostics_preview());
    }
}
