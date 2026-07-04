//! Stage 157–158 — an INTERNAL-ONLY ciphertext envelope skeleton +
//! validation. Crate-private only — see `src/crypto.rs`'s module-level
//! doc comment for this module's place in the `crypto` tree.
//!
//! Fixes `docs/ciphertext_envelope_plan.md`'s six planned fields
//! (version, algorithm, nonce, ciphertext, tag, AAD domain) into a
//! CONCRETE skeleton type, [`AeadCiphertextEnvelope`] — but this is a
//! SKELETON, not a real envelope: the `ciphertext`/`tag` field is a fixed,
//! non-secret [`CIPHERTEXT_PLACEHOLDER_MARKER`] constant, never the real
//! output of this crate's own AEAD seal operation. Connecting this
//! envelope to a real seal/open result is Stage 161 candidate work — see
//! `docs/ciphertext_envelope_plan.md` section 8 for that future bridge's
//! planned shape, not built here.
//!
//! [`validate_envelope_internal`] validates UNTRUSTED CANDIDATE field
//! values (raw version/algorithm/AAD-domain discriminant bytes, a nonce
//! byte slice, and a ciphertext-placeholder byte slice) — the same shape
//! a future deserializer would need to check before trusting bytes read
//! off the wire. It checks structure and labels ONLY: version first (per
//! `docs/ciphertext_envelope_plan.md`'s "MUST be checked before any other
//! field is interpreted" rule), then algorithm, then AAD domain, then
//! nonce length, then the ciphertext placeholder's fixed marker value. It
//! does NOT perform authenticated-decryption verification — there is no
//! real ciphertext yet to authenticate — and it does NOT serialize or
//! deserialize any structured text or binary wire format (no length-
//! prefixed/tagged encoding, no byte-offset parsing of a single combined
//! buffer) — it accepts already-split candidate values, exactly as far as
//! "validation" goes without also being "codec implementation," which
//! remains its own, later, separate, explicitly-reviewed stage.
//!
//! The algorithm and AAD-domain labels here are deliberately NEW, SEPARATE
//! enums from this crate's real AEAD implementation's own equivalents —
//! this skeleton stays unconnected from the real cipher wiring, per this
//! crate's standing "leave unrelated skeletons unconnected" discipline
//! (the same choice Stage 147 made for `domain_label`, and Stage 152–154
//! made for the pre-existing placeholder AEAD request skeleton).
//!
//! Not part of this crate's public API: every item below is `pub(crate)`
//! at most (never `pub`), nothing is re-exported from the crate root, and
//! this crate's public `pub fn` surface is unchanged (still twenty-four
//! functions). No public `encrypt`/`decrypt`, no Runtime/Worker/storage/
//! Nostr connection, no Nostr encrypted-message scheme, no `Cargo.toml`
//! change.
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
}

impl AeadEnvelopeAadDomain {
    const fn as_tag(self) -> u8 {
        match self {
            AeadEnvelopeAadDomain::RootKey => 0,
            AeadEnvelopeAadDomain::Identity => 1,
            AeadEnvelopeAadDomain::Storage => 2,
            AeadEnvelopeAadDomain::Conversation => 3,
            AeadEnvelopeAadDomain::TestOnly => 4,
        }
    }

    const fn from_tag(tag: u8) -> Option<Self> {
        match tag {
            0 => Some(AeadEnvelopeAadDomain::RootKey),
            1 => Some(AeadEnvelopeAadDomain::Identity),
            2 => Some(AeadEnvelopeAadDomain::Storage),
            3 => Some(AeadEnvelopeAadDomain::Conversation),
            4 => Some(AeadEnvelopeAadDomain::TestOnly),
            _ => None,
        }
    }
}

/// A fixed, non-secret marker standing in for a future real
/// ciphertext‖tag buffer. Exactly one valid value exists today;
/// [`validate_envelope_internal`] rejects any candidate that does not
/// match it exactly. Never real ciphertext, never variable-length, never
/// derived from a `SecretHandle` or any AEAD operation.
const CIPHERTEXT_PLACEHOLDER_MARKER: [u8; 4] = [0xC1, 0x7E, 0xC1, 0x7E];

/// Coarse observable outcome of a [`validate_envelope_internal`] call.
/// Crate-private only. No secret byte is exposed through this label
/// itself — the fields this skeleton validates (version/algorithm/AAD
/// domain tags, nonce, ciphertext placeholder) are none of them secret.
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
    /// The candidate ciphertext-placeholder slice did not exactly match
    /// [`CIPHERTEXT_PLACEHOLDER_MARKER`].
    InvalidCiphertextPlaceholder,
}

/// An INTERNAL-ONLY ciphertext envelope skeleton (crate-private; not part
/// of this crate's public API — see the module-level doc comment above).
/// Holds a version/algorithm/AAD-domain label, a real fixed-size 12-byte
/// nonce (a nonce is not a secret, per `docs/nonce_generation_policy.md`
/// section 9, so it is plain data here, not `SecretHandle`-wrapped), and a
/// fixed, non-secret ciphertext PLACEHOLDER — never real ciphertext, never
/// a `Vec<u8>`, never derived from a `SecretHandle` or any AEAD operation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct AeadCiphertextEnvelope {
    version: AeadEnvelopeVersion,
    algorithm: AeadEnvelopeAlgorithm,
    nonce: [u8; 12],
    ciphertext_placeholder: [u8; 4],
    aad_domain: AeadEnvelopeAadDomain,
}

impl AeadCiphertextEnvelope {
    /// Construct an envelope from already-typed, already-valid fields —
    /// this constructor cannot represent an invalid version/algorithm/
    /// domain (the type system already rules that out) and always uses
    /// the fixed [`CIPHERTEXT_PLACEHOLDER_MARKER`] for its ciphertext
    /// field, since no real ciphertext exists yet. Takes NO `SecretHandle`
    /// and calls no AEAD operation.
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
            ciphertext_placeholder: CIPHERTEXT_PLACEHOLDER_MARKER,
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

    /// The fixed, non-secret ciphertext placeholder marker. Not real
    /// ciphertext — exists only so this skeleton's own tests (and a
    /// future Stage 161 bridge) have something concrete to check.
    pub(crate) fn ciphertext_placeholder(&self) -> [u8; 4] {
        self.ciphertext_placeholder
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
/// length, then `ciphertext_placeholder`'s exact bytes. The first failing
/// check short-circuits with its own fixed [`AeadEnvelopeStatus`] and
/// `envelope: None` — no partial/best-effort envelope is ever returned.
/// Performs NO AEAD authentication/decryption and NO byte-format
/// parsing/serialization of any kind.
pub(crate) fn validate_envelope_internal(
    version_tag: u8,
    algorithm_tag: u8,
    aad_domain_tag: u8,
    nonce: &[u8],
    ciphertext_placeholder: &[u8],
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
    if ciphertext_placeholder != CIPHERTEXT_PLACEHOLDER_MARKER {
        return AeadEnvelopeDecision {
            status: AeadEnvelopeStatus::InvalidCiphertextPlaceholder,
            envelope: None,
        };
    }
    AeadEnvelopeDecision {
        status: AeadEnvelopeStatus::Valid,
        envelope: Some(AeadCiphertextEnvelope::new_for_internal_use(
            version, algorithm, nonce_bytes, aad_domain,
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
        assert_eq!(
            envelope.ciphertext_placeholder(),
            CIPHERTEXT_PLACEHOLDER_MARKER
        );
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
    fn empty_ciphertext_placeholder_is_rejected() {
        let decision = validate_envelope_internal(
            AeadEnvelopeVersion::V1.as_tag(),
            AeadEnvelopeAlgorithm::ChaCha20Poly1305.as_tag(),
            AeadEnvelopeAadDomain::TestOnly.as_tag(),
            &TEST_NONCE,
            &[],
        );
        assert_eq!(decision.status, AeadEnvelopeStatus::InvalidCiphertextPlaceholder);
        assert!(decision.envelope.is_none());
    }

    #[test]
    fn tampered_ciphertext_placeholder_is_rejected() {
        let mut tampered = CIPHERTEXT_PLACEHOLDER_MARKER;
        tampered[0] ^= 0xFF;
        let decision = validate_envelope_internal(
            AeadEnvelopeVersion::V1.as_tag(),
            AeadEnvelopeAlgorithm::Aes256Gcm.as_tag(),
            AeadEnvelopeAadDomain::Storage.as_tag(),
            &TEST_NONCE,
            &tampered,
        );
        assert_eq!(
            decision.status,
            AeadEnvelopeStatus::InvalidCiphertextPlaceholder
        );
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
