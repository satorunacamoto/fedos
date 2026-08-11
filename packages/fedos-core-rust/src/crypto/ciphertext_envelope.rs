//! Stage 157–158 — an INTERNAL-ONLY ciphertext envelope skeleton +
//! validation. Stage 161 extends it to hold REAL ciphertext bytes,
//! bridged from this crate's own AEAD seal operation (see
//! `super::aead_envelope_bridge`). Crate-private only — see
//! `src/crypto.rs`'s module-level doc comment for this module's place in
//! the `crypto` tree.
//!
//! Fixes `docs/ciphertext_envelope_plan.md`'s six planned fields
//! (version, algorithm, nonce, ciphertext, tag, AAD domain) into a
//! CONCRETE type, [`AeadCiphertextEnvelope`]. `ciphertext` (combined with
//! its authentication tag, matching this crate's own AEAD seal
//! convention) is a `Vec<u8>` — either the fixed, non-secret
//! [`CIPHERTEXT_PLACEHOLDER_MARKER`] (via
//! [`AeadCiphertextEnvelope::new_for_internal_use`], the Stage 157–158
//! skeleton path, still used by this module's own tests) or REAL bytes
//! bridged from this crate's own AEAD seal operation (via
//! [`AeadCiphertextEnvelope::new_with_ciphertext_for_internal_use`],
//! Stage 161's real path — see `super::aead_envelope_bridge`).
//!
//! [`validate_envelope_internal`] validates UNTRUSTED CANDIDATE field
//! values (raw version/algorithm/AAD-domain discriminant bytes, a nonce
//! byte slice, and a ciphertext byte slice) — the same shape a future
//! deserializer would need to check before trusting bytes read off the
//! wire. It checks structure and labels ONLY: version first (per
//! `docs/ciphertext_envelope_plan.md`'s "MUST be checked before any other
//! field is interpreted" rule), then algorithm, then AAD domain, then
//! nonce length, then that the ciphertext candidate is non-empty. It does
//! NOT perform authenticated-decryption verification (structural
//! non-emptiness is not, and does not claim to be, a proof of
//! authenticity — that check belongs to the actual AEAD open call, see
//! `super::aead_envelope_bridge`) and it does NOT serialize or
//! deserialize any structured text or binary wire format — it accepts
//! already-split candidate values, exactly as far as "validation" goes
//! without also being "codec implementation," which remains its own,
//! later, separate, explicitly-reviewed stage.
//!
//! The algorithm and AAD-domain labels here are deliberately NEW, SEPARATE
//! enums from this crate's real AEAD implementation's own equivalents —
//! this type's OWN labels stay independent of the real cipher wiring's
//! own labels, even though Stage 161's bridge now converts between them
//! at the one reviewed boundary point (`super::aead_envelope_bridge`).
//!
//! Not part of this crate's public API: every item below is `pub(crate)`
//! at most (never `pub`), nothing is re-exported from the crate root, and
//! this crate's public `pub fn` surface is unaffected by this module
//! directly (see `src/lib.rs`'s own `pub fn fedos_encrypt`/`fedos_decrypt`,
//! Stage 166–167, for the actual public boundary that uses this type
//! internally). No public `encrypt`/`decrypt` is implemented HERE, no
//! Runtime/Worker/storage/Nostr connection, no Nostr encrypted-message
//! scheme, no `Cargo.toml` change.
#![allow(dead_code)]

/// Which envelope wire-format version a candidate claims, and which
/// version this crate currently supports — a label only. Crate-private
/// only. Exactly one variant exists today, mirroring
/// `FedosRandomBytesLength`/`FedosAeadNonceKind`/`SecretInputLength`'s
/// "exactly one variant, no open choice" shape for what this crate
/// PRODUCES — a future additional version would be its own reviewed
/// addition. [`validate_envelope_internal`]'s raw `version_tag` parameter
/// is the separate, untrusted-candidate side of this: it is what lets a
/// future decoder reject a version this crate does not (yet) support,
/// rather than silently misinterpreting it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum AeadEnvelopeVersion {
    V1,
}

impl AeadEnvelopeVersion {
    /// The fixed wire tag for this version. Never derived from input.
    const fn as_tag(self) -> u8 {
        match self {
            AeadEnvelopeVersion::V1 => 1,
        }
    }

    /// Maps a raw candidate tag byte to the version it names, or `None` if
    /// unrecognized. The ONLY place a `u8` is interpreted as a version.
    const fn from_tag(tag: u8) -> Option<Self> {
        match tag {
            1 => Some(AeadEnvelopeVersion::V1),
            _ => None,
        }
    }
}

/// Which AEAD algorithm an envelope names — a label only. Crate-private
/// only. Deliberately a SEPARATE type from this crate's real AEAD
/// implementation's own algorithm-choice type — see this module's own
/// doc comment above for why.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum AeadEnvelopeAlgorithm {
    ChaCha20Poly1305,
    Aes256Gcm,
}

impl AeadEnvelopeAlgorithm {
    const fn as_tag(self) -> u8 {
        match self {
            AeadEnvelopeAlgorithm::ChaCha20Poly1305 => 0,
            AeadEnvelopeAlgorithm::Aes256Gcm => 1,
        }
    }

    const fn from_tag(tag: u8) -> Option<Self> {
        match tag {
            0 => Some(AeadEnvelopeAlgorithm::ChaCha20Poly1305),
            1 => Some(AeadEnvelopeAlgorithm::Aes256Gcm),
            _ => None,
        }
    }
}

/// Which fixed AAD domain an envelope names — a label only. Crate-private
/// only. Deliberately a SEPARATE type from this crate's real AEAD
/// implementation's own AAD-domain type — see this module's own doc
/// comment above for why.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum AeadEnvelopeAadDomain {
    RootKey,
    Identity,
    Storage,
    Conversation,
    TestOnly,
    /// Commerce E2E Completion arc — mirrors `aead_internal::AeadAadDomain::CommerceMedia`
    /// (see that variant's own doc comment for the domain-separation rationale).
    CommerceMedia,
}

impl AeadEnvelopeAadDomain {
    const fn as_tag(self) -> u8 {
        match self {
            AeadEnvelopeAadDomain::RootKey => 0,
            AeadEnvelopeAadDomain::Identity => 1,
            AeadEnvelopeAadDomain::Storage => 2,
            AeadEnvelopeAadDomain::Conversation => 3,
            AeadEnvelopeAadDomain::TestOnly => 4,
            AeadEnvelopeAadDomain::CommerceMedia => 5,
        }
    }

    const fn from_tag(tag: u8) -> Option<Self> {
        match tag {
            0 => Some(AeadEnvelopeAadDomain::RootKey),
            1 => Some(AeadEnvelopeAadDomain::Identity),
            2 => Some(AeadEnvelopeAadDomain::Storage),
            3 => Some(AeadEnvelopeAadDomain::Conversation),
            4 => Some(AeadEnvelopeAadDomain::TestOnly),
            5 => Some(AeadEnvelopeAadDomain::CommerceMedia),
            _ => None,
        }
    }
}

/// A fixed, non-secret marker standing in for a real ciphertext‖tag
/// buffer — used ONLY by [`AeadCiphertextEnvelope::new_for_internal_use`]
/// (the Stage 157–158 skeleton path, still exercised by this module's own
/// tests). Never used by the real Stage 161 bridge
/// (`super::aead_envelope_bridge`), which populates `ciphertext` with
/// actual AEAD seal output instead.
const CIPHERTEXT_PLACEHOLDER_MARKER: [u8; 4] = [0xC1, 0x7E, 0xC1, 0x7E];

/// Coarse observable outcome of a [`validate_envelope_internal`] call.
/// Crate-private only. No secret byte is exposed through this label
/// itself — the fields this type validates (version/algorithm/AAD domain
/// tags, nonce, ciphertext bytes) are none of them secret (ciphertext is
/// not a secret once sealed — it is meant to be transmitted/stored
/// alongside its nonce and AAD domain).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum AeadEnvelopeStatus {
    /// Every field validated; `AeadEnvelopeDecision::envelope` is `Some`.
    Valid,
    /// The candidate `version_tag` did not match any supported
    /// [`AeadEnvelopeVersion`]. Checked FIRST, per
    /// `docs/ciphertext_envelope_plan.md`'s "version must be checked
    /// before any other field is interpreted" rule.
    InvalidVersion,
    /// The candidate `algorithm_tag` did not match any
    /// [`AeadEnvelopeAlgorithm`].
    InvalidAlgorithm,
    /// The candidate `aad_domain_tag` did not match any
    /// [`AeadEnvelopeAadDomain`].
    InvalidAadDomain,
    /// The candidate nonce slice was not exactly 12 bytes.
    InvalidNonceLength,
    /// The candidate ciphertext slice was empty. This is a STRUCTURAL
    /// check only — it does NOT prove the ciphertext authenticates; that
    /// is the actual AEAD open call's job
    /// (`super::aead_envelope_bridge::open_decision_from_envelope_internal`).
    InvalidCiphertext,
}

/// An INTERNAL-ONLY ciphertext envelope (crate-private; not part of this
/// crate's public API — see the module-level doc comment above). Holds a
/// version/algorithm/AAD-domain label, a real fixed-size 12-byte nonce (a
/// nonce is not a secret, per `docs/nonce_generation_policy.md` section
/// 9, so it is plain data here, not `SecretHandle`-wrapped), and a
/// ciphertext buffer that is EITHER the fixed, non-secret
/// [`CIPHERTEXT_PLACEHOLDER_MARKER`] (skeleton path) OR real AEAD seal
/// output (Stage 161 bridge path) — never derived from a `SecretHandle`
/// directly (only from an `AeadSealDecision`'s already-sealed output).
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct AeadCiphertextEnvelope {
    version: AeadEnvelopeVersion,
    algorithm: AeadEnvelopeAlgorithm,
    nonce: [u8; 12],
    ciphertext: Vec<u8>,
    aad_domain: AeadEnvelopeAadDomain,
}

impl AeadCiphertextEnvelope {
    /// Construct a SKELETON envelope from already-typed, already-valid
    /// fields — this constructor cannot represent an invalid version/
    /// algorithm/domain (the type system already rules that out) and
    /// always uses the fixed [`CIPHERTEXT_PLACEHOLDER_MARKER`] for its
    /// ciphertext field, since it takes no ciphertext input at all. Takes
    /// NO `SecretHandle` and calls no AEAD operation. Still used by this
    /// module's own tests to exercise the field-holding shape
    /// independently of the real AEAD bridge.
    pub(crate) fn new_for_internal_use(
        version: AeadEnvelopeVersion,
        algorithm: AeadEnvelopeAlgorithm,
        nonce: [u8; 12],
        aad_domain: AeadEnvelopeAadDomain,
    ) -> Self {
        Self {
            version,
            algorithm,
            nonce,
            ciphertext: CIPHERTEXT_PLACEHOLDER_MARKER.to_vec(),
            aad_domain,
        }
    }

    /// Construct an envelope carrying REAL ciphertext bytes — the ONE
    /// constructor `super::aead_envelope_bridge`'s Stage 161
    /// `envelope_from_seal_decision_internal` uses. Takes ownership of
    /// `ciphertext` (expected to be an `AeadSealDecision::ciphertext`'s
    /// `Ready`-state bytes) — never a `SecretHandle`, never calls any AEAD
    /// operation itself (the caller has already sealed the data).
    pub(crate) fn new_with_ciphertext_for_internal_use(
        version: AeadEnvelopeVersion,
        algorithm: AeadEnvelopeAlgorithm,
        nonce: [u8; 12],
        aad_domain: AeadEnvelopeAadDomain,
        ciphertext: Vec<u8>,
    ) -> Self {
        Self {
            version,
            algorithm,
            nonce,
            ciphertext,
            aad_domain,
        }
    }

    pub(crate) fn version(&self) -> AeadEnvelopeVersion {
        self.version
    }

    pub(crate) fn algorithm(&self) -> AeadEnvelopeAlgorithm {
        self.algorithm
    }

    /// The fixed-size 12-byte nonce. Not a secret — safe to return by
    /// value, exactly like `FedosAeadNonceDecision::nonce`.
    pub(crate) fn nonce(&self) -> [u8; 12] {
        self.nonce
    }

    pub(crate) fn aad_domain(&self) -> AeadEnvelopeAadDomain {
        self.aad_domain
    }

    /// The ciphertext buffer — either the fixed skeleton placeholder or
    /// real AEAD seal output (`ciphertext‖tag`), depending on which
    /// constructor built this envelope. Not a secret once sealed.
    pub(crate) fn ciphertext(&self) -> &[u8] {
        &self.ciphertext
    }

    /// Whether this envelope still carries the Stage 157–158 skeleton
    /// placeholder rather than real ciphertext — used by
    /// `super::aead_envelope_bridge`'s own guard tests to prove a
    /// placeholder envelope is rejected rather than silently
    /// misinterpreted as real ciphertext.
    pub(crate) fn is_placeholder_ciphertext(&self) -> bool {
        self.ciphertext == CIPHERTEXT_PLACEHOLDER_MARKER
    }
}

/// The result of a [`validate_envelope_internal`] call. Crate-private
/// only.
pub(crate) struct AeadEnvelopeDecision {
    pub(crate) status: AeadEnvelopeStatus,
    pub(crate) envelope: Option<AeadCiphertextEnvelope>,
}

/// Validate an UNTRUSTED CANDIDATE set of envelope field values — the
/// same shape a future deserializer would need to check before trusting
/// bytes read off the wire (no such deserializer exists yet; see this
/// module's own doc comment above). Checks, in order: `version_tag`
/// first, then `algorithm_tag`, then `aad_domain_tag`, then `nonce`'s
/// length, then that `ciphertext` is non-empty. The first failing check
/// short-circuits with its own fixed [`AeadEnvelopeStatus`] and
/// `envelope: None` — no partial/best-effort envelope is ever returned.
/// Performs NO AEAD authentication/decryption (non-emptiness is a
/// structural check only) and NO byte-format parsing/serialization of
/// any kind.
pub(crate) fn validate_envelope_internal(
    version_tag: u8,
    algorithm_tag: u8,
    aad_domain_tag: u8,
    nonce: &[u8],
    ciphertext: &[u8],
) -> AeadEnvelopeDecision {
    let version = match AeadEnvelopeVersion::from_tag(version_tag) {
        Some(version) => version,
        None => {
            return AeadEnvelopeDecision {
                status: AeadEnvelopeStatus::InvalidVersion,
                envelope: None,
            };
        }
    };
    let algorithm = match AeadEnvelopeAlgorithm::from_tag(algorithm_tag) {
        Some(algorithm) => algorithm,
        None => {
            return AeadEnvelopeDecision {
                status: AeadEnvelopeStatus::InvalidAlgorithm,
                envelope: None,
            };
        }
    };
    let aad_domain = match AeadEnvelopeAadDomain::from_tag(aad_domain_tag) {
        Some(aad_domain) => aad_domain,
        None => {
            return AeadEnvelopeDecision {
                status: AeadEnvelopeStatus::InvalidAadDomain,
                envelope: None,
            };
        }
    };
    let nonce_bytes: [u8; 12] = match nonce.try_into() {
        Ok(bytes) => bytes,
        Err(_) => {
            return AeadEnvelopeDecision {
                status: AeadEnvelopeStatus::InvalidNonceLength,
                envelope: None,
            };
        }
    };
    if ciphertext.is_empty() {
        return AeadEnvelopeDecision {
            status: AeadEnvelopeStatus::InvalidCiphertext,
            envelope: None,
        };
    }
    AeadEnvelopeDecision {
        status: AeadEnvelopeStatus::Valid,
        envelope: Some(AeadCiphertextEnvelope::new_with_ciphertext_for_internal_use(
            version,
            algorithm,
            nonce_bytes,
            aad_domain,
            ciphertext.to_vec(),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_NONCE: [u8; 12] = [0x22; 12];

    #[test]
    fn new_for_internal_use_creates_an_envelope_holding_every_field() {
        let envelope = AeadCiphertextEnvelope::new_for_internal_use(
            AeadEnvelopeVersion::V1,
            AeadEnvelopeAlgorithm::ChaCha20Poly1305,
            TEST_NONCE,
            AeadEnvelopeAadDomain::TestOnly,
        );
        assert_eq!(envelope.version(), AeadEnvelopeVersion::V1);
        assert_eq!(envelope.algorithm(), AeadEnvelopeAlgorithm::ChaCha20Poly1305);
        assert_eq!(envelope.nonce(), TEST_NONCE);
        assert_eq!(envelope.aad_domain(), AeadEnvelopeAadDomain::TestOnly);
        assert_eq!(envelope.ciphertext(), &CIPHERTEXT_PLACEHOLDER_MARKER[..]);
        assert!(envelope.is_placeholder_ciphertext());
    }

    #[test]
    fn new_with_ciphertext_for_internal_use_holds_real_bytes_and_is_not_a_placeholder() {
        let real_ciphertext = vec![0xAA, 0xBB, 0xCC, 0xDD, 0xEE];
        let envelope = AeadCiphertextEnvelope::new_with_ciphertext_for_internal_use(
            AeadEnvelopeVersion::V1,
            AeadEnvelopeAlgorithm::Aes256Gcm,
            TEST_NONCE,
            AeadEnvelopeAadDomain::Storage,
            real_ciphertext.clone(),
        );
        assert_eq!(envelope.ciphertext(), real_ciphertext.as_slice());
        assert!(!envelope.is_placeholder_ciphertext());
    }

    #[test]
    fn version_algorithm_and_domain_are_preserved_for_every_combination() {
        for algorithm in [
            AeadEnvelopeAlgorithm::ChaCha20Poly1305,
            AeadEnvelopeAlgorithm::Aes256Gcm,
        ] {
            for aad_domain in [
                AeadEnvelopeAadDomain::RootKey,
                AeadEnvelopeAadDomain::Identity,
                AeadEnvelopeAadDomain::Storage,
                AeadEnvelopeAadDomain::Conversation,
                AeadEnvelopeAadDomain::TestOnly,
            ] {
                let envelope = AeadCiphertextEnvelope::new_for_internal_use(
                    AeadEnvelopeVersion::V1,
                    algorithm,
                    TEST_NONCE,
                    aad_domain,
                );
                assert_eq!(envelope.version(), AeadEnvelopeVersion::V1);
                assert_eq!(envelope.algorithm(), algorithm);
                assert_eq!(envelope.aad_domain(), aad_domain);
            }
        }
    }

    #[test]
    fn nonce_is_held_as_a_fixed_twelve_byte_array() {
        let envelope = AeadCiphertextEnvelope::new_for_internal_use(
            AeadEnvelopeVersion::V1,
            AeadEnvelopeAlgorithm::Aes256Gcm,
            TEST_NONCE,
            AeadEnvelopeAadDomain::RootKey,
        );
        let nonce = envelope.nonce();
        assert_eq!(nonce.len(), 12);
        assert_eq!(nonce, TEST_NONCE);
    }

    #[test]
    fn validate_envelope_internal_succeeds_for_a_well_formed_candidate() {
        let decision = validate_envelope_internal(
            AeadEnvelopeVersion::V1.as_tag(),
            AeadEnvelopeAlgorithm::ChaCha20Poly1305.as_tag(),
            AeadEnvelopeAadDomain::TestOnly.as_tag(),
            &TEST_NONCE,
            &CIPHERTEXT_PLACEHOLDER_MARKER,
        );
        assert_eq!(decision.status, AeadEnvelopeStatus::Valid);
        let envelope = decision.envelope.expect("Valid decision must carry an envelope");
        assert_eq!(envelope.version(), AeadEnvelopeVersion::V1);
        assert_eq!(envelope.algorithm(), AeadEnvelopeAlgorithm::ChaCha20Poly1305);
        assert_eq!(envelope.aad_domain(), AeadEnvelopeAadDomain::TestOnly);
        assert_eq!(envelope.nonce(), TEST_NONCE);
        assert_eq!(envelope.ciphertext(), &CIPHERTEXT_PLACEHOLDER_MARKER[..]);
    }

    #[test]
    fn validate_envelope_internal_succeeds_for_real_variable_length_ciphertext() {
        let real_ciphertext = vec![0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08];
        let decision = validate_envelope_internal(
            AeadEnvelopeVersion::V1.as_tag(),
            AeadEnvelopeAlgorithm::Aes256Gcm.as_tag(),
            AeadEnvelopeAadDomain::Conversation.as_tag(),
            &TEST_NONCE,
            &real_ciphertext,
        );
        assert_eq!(decision.status, AeadEnvelopeStatus::Valid);
        let envelope = decision.envelope.expect("Valid decision must carry an envelope");
        assert_eq!(envelope.ciphertext(), real_ciphertext.as_slice());
    }

    #[test]
    fn wrong_version_tag_is_rejected() {
        let decision = validate_envelope_internal(
            99,
            AeadEnvelopeAlgorithm::ChaCha20Poly1305.as_tag(),
            AeadEnvelopeAadDomain::TestOnly.as_tag(),
            &TEST_NONCE,
            &CIPHERTEXT_PLACEHOLDER_MARKER,
        );
        assert_eq!(decision.status, AeadEnvelopeStatus::InvalidVersion);
        assert!(decision.envelope.is_none());
    }

    #[test]
    fn wrong_algorithm_tag_is_rejected() {
        let decision = validate_envelope_internal(
            AeadEnvelopeVersion::V1.as_tag(),
            99,
            AeadEnvelopeAadDomain::TestOnly.as_tag(),
            &TEST_NONCE,
            &CIPHERTEXT_PLACEHOLDER_MARKER,
        );
        assert_eq!(decision.status, AeadEnvelopeStatus::InvalidAlgorithm);
        assert!(decision.envelope.is_none());
    }

    #[test]
    fn wrong_aad_domain_tag_is_rejected() {
        let decision = validate_envelope_internal(
            AeadEnvelopeVersion::V1.as_tag(),
            AeadEnvelopeAlgorithm::Aes256Gcm.as_tag(),
            99,
            &TEST_NONCE,
            &CIPHERTEXT_PLACEHOLDER_MARKER,
        );
        assert_eq!(decision.status, AeadEnvelopeStatus::InvalidAadDomain);
        assert!(decision.envelope.is_none());
    }

    #[test]
    fn wrong_nonce_length_is_rejected() {
        let short_nonce = [0x33u8; 8];
        let decision = validate_envelope_internal(
            AeadEnvelopeVersion::V1.as_tag(),
            AeadEnvelopeAlgorithm::ChaCha20Poly1305.as_tag(),
            AeadEnvelopeAadDomain::TestOnly.as_tag(),
            &short_nonce,
            &CIPHERTEXT_PLACEHOLDER_MARKER,
        );
        assert_eq!(decision.status, AeadEnvelopeStatus::InvalidNonceLength);
        assert!(decision.envelope.is_none());
    }

    #[test]
    fn empty_ciphertext_is_rejected() {
        let decision = validate_envelope_internal(
            AeadEnvelopeVersion::V1.as_tag(),
            AeadEnvelopeAlgorithm::ChaCha20Poly1305.as_tag(),
            AeadEnvelopeAadDomain::TestOnly.as_tag(),
            &TEST_NONCE,
            &[],
        );
        assert_eq!(decision.status, AeadEnvelopeStatus::InvalidCiphertext);
        assert!(decision.envelope.is_none());
    }

    /// `AeadEnvelopeVersion` supports exactly one variant today — an
    /// exhaustive match with no wildcard arm compiles only because no
    /// other variant exists to add one for.
    #[test]
    fn aead_envelope_version_has_no_variant_other_than_v1() {
        let version = AeadEnvelopeVersion::V1;
        match version {
            AeadEnvelopeVersion::V1 => {}
        }
    }

    /// `AeadEnvelopeAlgorithm` supports exactly the two specified variants.
    #[test]
    fn aead_envelope_algorithm_has_no_variant_other_than_the_two_specified() {
        let algorithm = AeadEnvelopeAlgorithm::ChaCha20Poly1305;
        match algorithm {
            AeadEnvelopeAlgorithm::ChaCha20Poly1305 => {}
            AeadEnvelopeAlgorithm::Aes256Gcm => {}
        }
    }
}
