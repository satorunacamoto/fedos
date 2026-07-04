//! Stage 209–213 — an INTERNAL-ONLY, LABEL-ONLY skeleton for NIP-44 v2's
//! byte-exact WIRE format. Crate-private only — see `src/crypto.rs`'s
//! module-level doc comment for this module's place in the `crypto`
//! tree.
//!
//! **This module is deliberately separate from, and does NOT change,**
//! `crypto::nip44_padding`/`crypto::nip44_encrypt`/`crypto::nip44_decrypt`/
//! `crypto::nip44_bridge` (Stage 202–206) — the "FedOS internal
//! NIP-44-like bridge" that already exists and already reports `Ready` in
//! `diagnostics`. THAT bridge reuses this crate's pre-existing
//! ChaCha20-Poly1305 AEAD; it is NOT NIP-44 v2's byte-exact wire format.
//! This module instead fixes the LABEL VOCABULARY a future,
//! byte-exact "NIP-44 v2 wire-compatible implementation" would use —
//! `Nip44WireVersion` (which wire version), `Nip44WirePayloadKind` (which
//! section of the wire payload a value classifies: nonce, ciphertext, or
//! MAC tag), and `Nip44WireStatus` (this skeleton always reports
//! `Unimplemented` — there is no real encrypt/decrypt behind it). See
//! `docs/nip44_wire_compatibility_gap.md` for the full field-by-field gap
//! this vocabulary names, and `docs/nip44_wire_implementation_roadmap.md`
//! for the stage-by-stage plan that would eventually give these labels
//! real behavior.
//!
//! **What this module is NOT**: no NIP-44 v2 wire encrypt/decrypt
//! function, no base64 encode/decode, no HMAC-SHA256 tag computation, no
//! raw ChaCha20 stream-cipher call, no 32-byte NIP-44 nonce generator, no
//! public API, no Runtime/Worker/Storage/Relay/Nostr connection, no new
//! `Cargo.toml` dependency. `Nip44WireDecision` holds ONLY the three
//! labels above — never a ciphertext byte, nonce byte, key, or tag of any
//! kind.
#![allow(dead_code)]

/// Which NIP-44 wire format version this skeleton names — a label only.
/// `V2` is the only version `test-vectors/nip44/nip44-v2.json` and the
/// current NIP-44 spec define; a future NIP-44 wire version (should one
/// ever be published) would add its own new variant here as its own
/// explicit, reviewed change. Crate-private only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Nip44WireVersion {
    V2,
}

/// Which section of the NIP-44 v2 wire payload a value classifies — a
/// label only, never a codec. Mirrors
/// `docs/nip44_wire_compatibility_gap.md`'s field-by-field table: `Nonce`
/// (the wire format's 32-byte random nonce — NOT this crate's own
/// pre-existing 12-byte `FedosAeadNonceDecision`), `Ciphertext` (the raw
/// ChaCha20 stream-cipher output — NOT this crate's own
/// ChaCha20-Poly1305 AEAD output), `Mac` (the separate 32-byte
/// HMAC-SHA256 tag — NOT a Poly1305 tag folded into an AEAD call).
/// Crate-private only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Nip44WirePayloadKind {
    Nonce,
    Ciphertext,
    Mac,
}

/// Coarse observable status of a [`Nip44WireDecision`] — mirrors
/// `CiphertextTransportStatus`'s "one variant today" shape
/// (`crypto::ciphertext_transport`). This skeleton produces ONLY
/// `Unimplemented` — there is no real NIP-44 v2 wire encrypt/decrypt
/// function anywhere in this crate yet. A future stage that actually
/// implements one (see `docs/nip44_wire_implementation_roadmap.md`) would
/// add a `Ready`-style variant as its own reviewed change, exactly as
/// `crypto::aead_internal`'s own `AeadStatus` did once Stage 152–154
/// landed real AEAD code.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Nip44WireStatus {
    Unimplemented,
}

/// A LABEL-ONLY decision naming which NIP-44 wire version and which
/// payload-section kind a future wire-compatible implementation would
/// eventually classify — WITHOUT holding, carrying, or referencing any
/// actual ciphertext byte, nonce byte, key, or MAC tag, and without
/// running any encrypt/decrypt/HMAC/base64 operation of any kind.
/// Crate-private only; not part of this crate's public API.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Nip44WireDecision {
    pub(crate) version: Nip44WireVersion,
    pub(crate) payload_kind: Nip44WirePayloadKind,
    pub(crate) status: Nip44WireStatus,
}

impl Nip44WireDecision {
    /// Construct a decision naming `payload_kind`. `version` is always
    /// `V2` (the only wire version this skeleton names today); `status`
    /// is always `Unimplemented` (no real wire encrypt/decrypt exists
    /// yet). Takes no ciphertext, nonce, tag, or key parameter of any
    /// kind — there is nothing here for this constructor to accept.
    pub(crate) fn new_placeholder(payload_kind: Nip44WirePayloadKind) -> Self {
        Self {
            version: Nip44WireVersion::V2,
            payload_kind,
            status: Nip44WireStatus::Unimplemented,
        }
    }

    pub(crate) fn version(&self) -> Nip44WireVersion {
        self.version
    }

    pub(crate) fn payload_kind(&self) -> Nip44WirePayloadKind {
        self.payload_kind
    }

    pub(crate) fn status(&self) -> Nip44WireStatus {
        self.status
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_placeholder_always_reports_v2_and_unimplemented() {
        for payload_kind in [
            Nip44WirePayloadKind::Nonce,
            Nip44WirePayloadKind::Ciphertext,
            Nip44WirePayloadKind::Mac,
        ] {
            let decision = Nip44WireDecision::new_placeholder(payload_kind);
            assert_eq!(decision.version(), Nip44WireVersion::V2);
            assert_eq!(decision.payload_kind(), payload_kind);
            assert_eq!(decision.status(), Nip44WireStatus::Unimplemented);
        }
    }

    #[test]
    fn decision_preserves_the_requested_payload_kind_independently() {
        let nonce = Nip44WireDecision::new_placeholder(Nip44WirePayloadKind::Nonce);
        let ciphertext = Nip44WireDecision::new_placeholder(Nip44WirePayloadKind::Ciphertext);
        let mac = Nip44WireDecision::new_placeholder(Nip44WirePayloadKind::Mac);
        assert_ne!(nonce.payload_kind(), ciphertext.payload_kind());
        assert_ne!(ciphertext.payload_kind(), mac.payload_kind());
        assert_ne!(nonce.payload_kind(), mac.payload_kind());
    }

    #[test]
    fn nip44_wire_version_has_no_variant_other_than_v2() {
        // A structural guard: exhaustively matching every variant compiles
        // only if V2 is still the sole variant — if a future stage adds a
        // second wire version, this match becomes non-exhaustive and fails
        // to compile, forcing that stage to review this test deliberately.
        let version = Nip44WireVersion::V2;
        match version {
            Nip44WireVersion::V2 => {}
        }
    }

    #[test]
    fn nip44_wire_payload_kind_has_no_variant_other_than_the_three_specified() {
        for kind in [
            Nip44WirePayloadKind::Nonce,
            Nip44WirePayloadKind::Ciphertext,
            Nip44WirePayloadKind::Mac,
        ] {
            match kind {
                Nip44WirePayloadKind::Nonce => {}
                Nip44WirePayloadKind::Ciphertext => {}
                Nip44WirePayloadKind::Mac => {}
            }
        }
    }

    #[test]
    fn nip44_wire_status_has_no_variant_other_than_unimplemented() {
        let status = Nip44WireStatus::Unimplemented;
        match status {
            Nip44WireStatus::Unimplemented => {}
        }
    }
}
