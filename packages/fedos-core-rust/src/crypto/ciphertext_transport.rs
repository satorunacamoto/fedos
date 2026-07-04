//! Stage 177–178 — an INTERNAL-ONLY ciphertext TRANSPORT descriptor
//! skeleton. Crate-private only — see `src/crypto.rs`'s module-level doc
//! comment for this module's place in the `crypto` tree.
//!
//! Fixes a LABEL-ONLY descriptor (`CiphertextTransportDescriptor`) naming
//! which future destination (`CiphertextTransportKind`) a ciphertext is
//! headed for, which `CiphertextTransportAlgorithm` sealed it, and which
//! `CiphertextEncodingPlaceholder` its eventual wire encoding would use —
//! WITHOUT holding, carrying, or referencing any actual ciphertext byte,
//! nonce byte, key, or serialized form. This is deliberately a much
//! smaller type than `super::ciphertext_envelope::AeadCiphertextEnvelope`:
//! the envelope carries the real (post-Stage-161) sealed bytes; this
//! descriptor carries ONLY the classification labels a future transport
//! layer (`docs/encrypted_payload_storage_boundary.md`) would need to
//! route an envelope without inspecting its contents.
//!
//! Every type here is deliberately SEPARATE from its lookalikes elsewhere
//! in this crate — `CiphertextTransportAlgorithm` is NOT
//! `crypto::aead_internal::AeadCipher` and NOT
//! `crypto::ciphertext_envelope::AeadEnvelopeAlgorithm` — the same
//! "separate label per boundary" discipline this crate has followed at
//! every previous crypto stage (Stage 157–158, Stage 171–176). No bridge
//! connecting this descriptor to either of those existing types is built
//! here — see `docs/ciphertext_envelope_serialization_plan.md` §7 for why
//! that bridge, and the actual encoding decision, are both explicitly
//! deferred.
//!
//! Not part of this crate's public API: every item below is `pub(crate)`
//! at most (never `pub`), nothing is re-exported from the crate root, and
//! this crate's public `pub fn` surface is unaffected by this module
//! (still twenty-seven functions, unchanged since Stage 171–176). No
//! serialization (JSON/base64/CBOR/binary) is implemented anywhere in this
//! module — `CiphertextEncodingPlaceholder` names that an encoding
//! decision is still PENDING, it does not make one. No Runtime/Worker/
//! Storage/Nostr/NIP-44/WASM connection, no `Cargo.toml` change.
#![allow(dead_code)]

/// Which format-version this descriptor itself claims — a label only,
/// mirroring `crypto::ciphertext_envelope::AeadEnvelopeVersion`'s "exactly
/// one variant, no open choice" shape for what this crate currently
/// produces. Crate-private only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CiphertextTransportVersion {
    V1,
}

/// Which AEAD algorithm sealed the ciphertext this descriptor classifies —
/// a label only, deliberately SEPARATE from
/// `crypto::aead_internal::AeadCipher` and
/// `crypto::ciphertext_envelope::AeadEnvelopeAlgorithm`. Crate-private
/// only; never exposed via this crate's public API.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CiphertextTransportAlgorithm {
    ChaCha20Poly1305,
    Aes256Gcm,
}

/// Whether a wire encoding has been chosen for this ciphertext yet —
/// exactly one variant today, `Undecided`, because
/// `docs/ciphertext_envelope_serialization_plan.md` deliberately does NOT
/// pick an MVP encoding (JSON/base64/CBOR/binary all remain candidates).
/// A future stage that picks one adds new variants here as its own
/// explicit, reviewed change — never silently. Crate-private only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CiphertextEncodingPlaceholder {
    Undecided,
}

/// Which future destination a ciphertext is headed for — a label only, no
/// connection of any kind to either destination.
/// `docs/encrypted_payload_storage_boundary.md` names what MAY eventually
/// cross into each: `Storage` for a future `StorageBackend`, `NostrEvent`
/// for a future Nostr/federation event candidate. Crate-private only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CiphertextTransportKind {
    Storage,
    NostrEvent,
}

/// Coarse observable status of a [`CiphertextTransportDescriptor`] —
/// mirrors `FedosCoreState`'s "Unavailable / Placeholder" shape. This
/// skeleton produces ONLY `Unavailable` today (there is no real transport
/// wiring yet); a future stage that actually connects a descriptor to a
/// `StorageBackend`/Nostr send path would add a `Ready`-style variant as
/// its own reviewed change.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CiphertextTransportStatus {
    Unavailable,
}

/// An INTERNAL-ONLY, LABEL-ONLY descriptor naming which algorithm sealed a
/// ciphertext, which destination it is headed for, and whether a wire
/// encoding has been chosen — never the ciphertext, nonce, tag, or key
/// itself. Crate-private only; not part of this crate's public API. See
/// this module's own doc comment above for the full design record.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct CiphertextTransportDescriptor {
    pub(crate) version: CiphertextTransportVersion,
    pub(crate) algorithm: CiphertextTransportAlgorithm,
    pub(crate) encoding: CiphertextEncodingPlaceholder,
    pub(crate) transport_kind: CiphertextTransportKind,
    pub(crate) status: CiphertextTransportStatus,
}

impl CiphertextTransportDescriptor {
    /// Construct a descriptor naming `algorithm` and `transport_kind`.
    /// `version` is always `V1` (the only version this crate produces
    /// today); `encoding` is always `Undecided` (no encoding is chosen by
    /// this skeleton); `status` is always `Unavailable` (no real transport
    /// wiring exists yet). Takes no ciphertext, nonce, tag, or key
    /// parameter of any kind — there is nothing here for this constructor
    /// to accept.
    pub(crate) fn new_placeholder(
        algorithm: CiphertextTransportAlgorithm,
        transport_kind: CiphertextTransportKind,
    ) -> Self {
        Self {
            version: CiphertextTransportVersion::V1,
            algorithm,
            encoding: CiphertextEncodingPlaceholder::Undecided,
            transport_kind,
            status: CiphertextTransportStatus::Unavailable,
        }
    }

    pub(crate) fn version(&self) -> CiphertextTransportVersion {
        self.version
    }

    pub(crate) fn algorithm(&self) -> CiphertextTransportAlgorithm {
        self.algorithm
    }

    pub(crate) fn encoding(&self) -> CiphertextEncodingPlaceholder {
        self.encoding
    }

    pub(crate) fn transport_kind(&self) -> CiphertextTransportKind {
        self.transport_kind
    }

    pub(crate) fn status(&self) -> CiphertextTransportStatus {
        self.status
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_placeholder_always_reports_v1_undecided_encoding_and_unavailable_status() {
        for algorithm in [
            CiphertextTransportAlgorithm::ChaCha20Poly1305,
            CiphertextTransportAlgorithm::Aes256Gcm,
        ] {
            for transport_kind in [
                CiphertextTransportKind::Storage,
                CiphertextTransportKind::NostrEvent,
            ] {
                let descriptor = CiphertextTransportDescriptor::new_placeholder(algorithm, transport_kind);
                assert_eq!(descriptor.version(), CiphertextTransportVersion::V1);
                assert_eq!(descriptor.algorithm(), algorithm);
                assert_eq!(descriptor.encoding(), CiphertextEncodingPlaceholder::Undecided);
                assert_eq!(descriptor.transport_kind(), transport_kind);
                assert_eq!(descriptor.status(), CiphertextTransportStatus::Unavailable);
            }
        }
    }

    #[test]
    fn descriptor_preserves_the_requested_algorithm_and_transport_kind_independently() {
        let storage_chacha =
            CiphertextTransportDescriptor::new_placeholder(
                CiphertextTransportAlgorithm::ChaCha20Poly1305,
                CiphertextTransportKind::Storage,
            );
        let nostr_aes =
            CiphertextTransportDescriptor::new_placeholder(
                CiphertextTransportAlgorithm::Aes256Gcm,
                CiphertextTransportKind::NostrEvent,
            );
        assert_ne!(storage_chacha.algorithm(), nostr_aes.algorithm());
        assert_ne!(storage_chacha.transport_kind(), nostr_aes.transport_kind());
    }

    #[test]
    fn ciphertext_transport_version_has_no_variant_other_than_v1() {
        // A structural guard: exhaustively matching every variant compiles
        // only if V1 is still the sole variant — if a future stage adds a
        // second version, this match becomes non-exhaustive and fails to
        // compile, forcing that stage to review this test deliberately.
        let version = CiphertextTransportVersion::V1;
        match version {
            CiphertextTransportVersion::V1 => {}
        }
    }

    #[test]
    fn ciphertext_encoding_placeholder_has_no_variant_other_than_undecided() {
        let encoding = CiphertextEncodingPlaceholder::Undecided;
        match encoding {
            CiphertextEncodingPlaceholder::Undecided => {}
        }
    }

    #[test]
    fn ciphertext_transport_status_has_no_variant_other_than_unavailable() {
        let status = CiphertextTransportStatus::Unavailable;
        match status {
            CiphertextTransportStatus::Unavailable => {}
        }
    }
}
