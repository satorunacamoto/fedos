//! FedOS Core — minimal Rust crate skeleton (Stage 69).
//!
//! Placeholder API ONLY. This crate implements NO cryptography: no AEAD, no
//! HKDF/Argon2/KDF, no CSPRNG/random, no NIP-44, no BIP39/BIP32, no zeroize, and
//! no key generation/derivation. Every function returns an `unavailable` /
//! placeholder status and touches no key/seed/plaintext/ciphertext bytes.
//!
//! It exists so a FUTURE, explicitly-reviewed stage can implement the real
//! RustCrypto-backed core BEHIND this shape — but only after passing the crypto
//! test vectors (see `docs/crypto_test_vectors.md`) and shipping a build
//! manifest (see `docs/fedos_core_build_manifest.md`). There is no forbidden
//! (unsafe) code, no FFI, no file/network IO, and no WASM binding here.
//!
//! Mirrors the TypeScript `FedosCoreCrypto` seam
//! (`packages/fedos-core-rust/src/types.ts`) so a real core can eventually drop
//! in without the host depending on any concrete implementation.
//!
//! Stage 75 adds ONE thing beyond the above: a test-only module (gated
//! `cfg(test)`, at the bottom of this file) that reads an official RFC 8439
//! AEAD known-answer vector file and asserts Stage 74's AEAD dependency
//! reproduces its expected bytes under `cargo test`. That module is
//! verification plumbing only — it is compiled only for `cargo test`, is not
//! compiled into the library's public API, and does not change any function
//! above. (Its own doc comment, just above its declaration, names the
//! specific dependency and vector file — kept out of this crate-level doc so
//! this production-facing summary stays free of any AEAD crate name.)
//!
//! Stage 77 adds a second test-only module of the same shape, verifying
//! Stage 76's KDF dependency against an official RFC 5869 HKDF known-answer
//! vector file. Same rules apply: `cfg(test)` only, no public API change.
//!
//! Stage 79 adds a crate-private `secret_handle` module (below, still ahead
//! of this file's first module gated `cfg(test)`): an INTERNAL-ONLY
//! `SecretHandle` skeleton, the first code in this crate to actually import
//! and use the `zeroize`/`secrecy` dependencies adopted Stage 78 — but only
//! against a fixed, non-secret placeholder marker. It is not part of the
//! public API (nothing below is `pub`, nothing is re-exported), holds no
//! real key/seed/plaintext/ciphertext/passphrase byte, and none of the six
//! functions above constructs, holds, or returns one.
//!
//! Stage 80 adds a second crate-private module, `aead_core`, of the same
//! shape: an INTERNAL-ONLY AEAD request skeleton (labels and a non-sensitive
//! status only — no key, nonce, plaintext, ciphertext, or tag byte, and its
//! production code imports no AEAD cipher crate — same reason that crate
//! name is kept out of this summary, see the note above). Same rules apply:
//! not part of the public API, no public function above constructs, holds,
//! or returns one of its types.
//!
//! Stage 81 is a test-only refactor of the Stage 75 module: the seal/open
//! logic that used to be written inline in its two vector tests is now two
//! small, private, test-only helper functions inside that same module
//! (their own doc comments, next to their declarations, name them). No
//! production code changed — the six functions above are untouched, and the
//! Stage 80 skeleton is not connected to this refactor.
//!
//! Stage 82 adds a third crate-private module, `kdf_core`, of the same
//! shape as `aead_core`: an INTERNAL-ONLY KDF request skeleton (labels and a
//! non-sensitive status only — no IKM, salt, info, PRK, or OKM byte, and its
//! production code imports no KDF/digest crate — same reason those crate
//! names are kept out of this summary, see the note above). Same rules
//! apply: not part of the public API, no public function above constructs,
//! holds, or returns one of its types.
//!
//! Stage 83 is a test-only refactor of the Stage 77 module — the KDF-side
//! analogue of Stage 81's AEAD-side refactor: the extract/expand logic that
//! used to be written inline in its two vector tests is now three small,
//! private, test-only helper functions inside that same module (their own
//! doc comments, next to their declarations, name them). No production code
//! changed — the six functions above are untouched, and the Stage 82
//! skeleton is not connected to this refactor.

#![forbid(unsafe_code)]

/// Coarse observable state of the core. No secret is exposed at any state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosCoreState {
    /// No real core is present (the safe default).
    Unavailable,
    /// A placeholder result: a label of intent only — runs no cryptography.
    Placeholder,
}

/// A non-sensitive snapshot of the core. `reason` is a fixed, human-readable
/// label and never contains a secret, key, seed, plaintext, or ciphertext.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FedosCoreStatus {
    pub state: FedosCoreState,
    pub reason: &'static str,
}

/// Placeholder capability labels — intent only. None is implemented or safe.
/// The string values match the TypeScript `FedosCoreCapability` union.
const FEDOS_CORE_CAPABILITIES: &[&str] = &[
    "aead_placeholder",
    "kdf_placeholder",
    "random_placeholder",
    "nip44_placeholder",
    "rust_core_placeholder",
];

/// Current status: permanently `Unavailable` in this skeleton.
pub fn fedos_core_status() -> FedosCoreStatus {
    FedosCoreStatus {
        state: FedosCoreState::Unavailable,
        reason: "no FedOS Rust crypto core is implemented (skeleton only)",
    }
}

/// The placeholder capability labels this skeleton advertises (intent only).
pub fn fedos_core_capabilities() -> &'static [&'static str] {
    FEDOS_CORE_CAPABILITIES
}

/// Placeholder: generates NO random bytes.
pub fn random_bytes_placeholder() -> FedosCoreStatus {
    placeholder_status()
}

/// Placeholder: derives NO key.
pub fn derive_key_placeholder() -> FedosCoreStatus {
    placeholder_status()
}

/// Placeholder: encrypts NOTHING.
pub fn encrypt_placeholder() -> FedosCoreStatus {
    placeholder_status()
}

/// Placeholder: decrypts NOTHING.
pub fn decrypt_placeholder() -> FedosCoreStatus {
    placeholder_status()
}

/// Build a placeholder status. Reads nothing, computes nothing, stores nothing.
fn placeholder_status() -> FedosCoreStatus {
    FedosCoreStatus {
        state: FedosCoreState::Placeholder,
        reason: "placeholder only (no cryptography performed)",
    }
}

/// Stage 79 — an INTERNAL-ONLY secret-handle skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns a [`SecretHandle`].
///
/// This is the first code in this crate to actually import and use the
/// `zeroize`/`secrecy` dependencies adopted Stage 78 — but only against a
/// fixed, non-secret [`PlaceholderMarker`]. It holds NO real key, seed,
/// plaintext, ciphertext, or passphrase byte: no function below takes a
/// borrowed-byte-slice, `Vec<u8>`, or `String` secret parameter, and no
/// field below is typed as one either; no AEAD/HKDF/Argon2/NIP-44 operation
/// is implemented or called here.
/// `subtle` (also adopted Stage 78) is intentionally NOT used yet — a future
/// stage that needs to compare real secret-derived bytes (e.g. an
/// authentication tag) adopts it then; [`SecretHandleState`]'s derived
/// `PartialEq` below is plain, non-secret enum equality, not a secret
/// comparison `subtle` would need to guard.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`. This is expected for a skeleton not
/// yet wired to any consumer; it clears once a future stage (e.g. an
/// internal AEAD module) actually uses `SecretHandle`.
#[allow(dead_code)]
mod secret_handle {
    use secrecy::SecretBox;
    use zeroize::Zeroize;

    /// Coarse internal lifecycle state of a [`SecretHandle`]. Crate-private
    /// only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum SecretHandleState {
        /// No placeholder marker has been allocated yet.
        Empty,
        /// A placeholder marker is allocated. Still holds no real secret.
        Placeholder,
        /// [`SecretHandle::clear`] was called: the placeholder marker was
        /// zeroized and this handle must not be treated as holding anything.
        Cleared,
    }

    impl Default for SecretHandleState {
        fn default() -> Self {
            SecretHandleState::Empty
        }
    }

    /// A non-sensitive status snapshot for a [`SecretHandle`]. Crate-private
    /// only. Never contains a key/seed/plaintext/ciphertext byte.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct SecretHandleStatus {
        pub(crate) state: SecretHandleState,
    }

    /// A fixed, non-secret placeholder value. Exists ONLY so [`SecretHandle`]
    /// has a concrete `Zeroize`-able type to wrap in `secrecy::SecretBox` —
    /// its value is a constant, never derived from or holding any real
    /// key/seed/plaintext/ciphertext/passphrase byte.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    struct PlaceholderMarker(u8);

    impl Zeroize for PlaceholderMarker {
        fn zeroize(&mut self) {
            self.0 = 0;
        }
    }

    /// An INTERNAL-ONLY secret-handle skeleton (crate-private; not part of
    /// this crate's public API — see the module-level doc comment above).
    /// Holds NO real key, seed, plaintext, ciphertext, or passphrase byte:
    /// `marker` is the fixed, non-secret [`PlaceholderMarker`] above,
    /// wrapped in `secrecy::SecretBox` purely to exercise the
    /// secret-handling foundation adopted Stage 78 ahead of any real secret
    /// type. A future, explicitly-reviewed stage may extend this skeleton to
    /// hold real secret bytes; until then it accepts and stores none.
    pub(crate) struct SecretHandle {
        state: SecretHandleState,
        marker: SecretBox<PlaceholderMarker>,
    }

    impl SecretHandle {
        /// Construct a placeholder handle. Takes NO secret input of any
        /// kind — there is no borrowed-byte-slice, `Vec<u8>`, or `String`
        /// parameter here or anywhere else in this module.
        pub(crate) fn new_placeholder() -> Self {
            Self {
                state: SecretHandleState::Placeholder,
                marker: SecretBox::new(Box::new(PlaceholderMarker(0))),
            }
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> SecretHandleStatus {
            SecretHandleStatus { state: self.state }
        }

        /// Zeroizes the (non-secret) placeholder marker and marks this
        /// handle `Cleared`. Does not return, expose, or copy the marker.
        pub(crate) fn clear(&mut self) {
            self.marker.zeroize();
            self.state = SecretHandleState::Cleared;
        }

        /// Whether [`SecretHandle::clear`] has been called.
        pub(crate) fn is_cleared(&self) -> bool {
            self.state == SecretHandleState::Cleared
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let handle = SecretHandle::new_placeholder();
            assert_eq!(handle.status().state, SecretHandleState::Placeholder);
            assert!(!handle.is_cleared());
        }

        #[test]
        fn status_reports_placeholder_state_only_no_secret_bytes() {
            // `SecretHandleStatus` carries only the coarse state enum — no
            // secret byte, no marker, nothing derived from `marker`.
            let handle = SecretHandle::new_placeholder();
            let status = handle.status();
            assert_eq!(status.state, SecretHandleState::Placeholder);
        }

        #[test]
        fn clear_transitions_state_to_cleared_only() {
            let mut handle = SecretHandle::new_placeholder();
            handle.clear();
            assert_eq!(handle.status().state, SecretHandleState::Cleared);
            assert!(handle.is_cleared());
        }

        #[test]
        fn is_cleared_is_false_until_clear_is_called() {
            let handle = SecretHandle::new_placeholder();
            assert!(!handle.is_cleared());
        }

        #[test]
        fn empty_state_is_the_default_placeholder_only_state() {
            assert_eq!(SecretHandleState::default(), SecretHandleState::Empty);
        }
    }
}

/// Stage 80 — an INTERNAL-ONLY AEAD request skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns an
/// [`AeadPlaceholderRequest`].
///
/// This module holds NO key, nonce, plaintext, ciphertext, or tag byte —
/// there is no borrowed-byte-slice, `Vec<u8>`, or `String` field or
/// parameter anywhere below, and no real encrypt/decrypt operation is
/// implemented or called. Production code here does NOT import
/// `chacha20poly1305` — that dependency is exercised only by the
/// `cfg(test)`-only `rfc8439_vectors` module above, unchanged since Stage
/// 75. This module does not connect to `secret_handle` (above): it never
/// constructs a `SecretHandle` and never reads a key/secret byte out of one
/// — when in doubt about a connection between the two skeletons, this stage
/// deliberately leaves them unconnected rather than guess at a future
/// design. `hkdf` is likewise not referenced here.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle` above
/// does. This is expected for a skeleton not yet wired to any consumer.
#[allow(dead_code)]
mod aead_core {
    use crate::FedosCoreState;

    /// A supported AEAD algorithm label — intent only, no implementation.
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum AeadAlgorithm {
        ChaCha20Poly1305,
    }

    /// Which AEAD operation an [`AeadPlaceholderRequest`] represents —
    /// a label only, no bytes are sealed or opened. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum AeadOperation {
        Encrypt,
        Decrypt,
    }

    /// A non-sensitive status snapshot for an [`AeadPlaceholderRequest`].
    /// Crate-private only. Never contains a key/nonce/plaintext/ciphertext/
    /// tag byte — `state` reuses this crate's existing
    /// [`FedosCoreState`](crate::FedosCoreState) labels (`Unavailable` /
    /// `Placeholder`) rather than inventing a parallel enum.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct AeadRequestStatus {
        pub(crate) state: FedosCoreState,
    }

    /// An INTERNAL-ONLY AEAD placeholder request skeleton (crate-private;
    /// not part of this crate's public API — see the module-level doc
    /// comment above). Holds ONLY the two labels below — no key, nonce,
    /// plaintext, ciphertext, or tag byte, and no `chacha20poly1305` type.
    /// A future, explicitly-reviewed stage may extend this skeleton to
    /// actually seal/open bytes behind `cfg(test)` first; until then it
    /// accepts and stores none.
    pub(crate) struct AeadPlaceholderRequest {
        algorithm: AeadAlgorithm,
        operation: AeadOperation,
    }

    impl AeadPlaceholderRequest {
        /// Construct a placeholder ENCRYPT request. Takes NO plaintext,
        /// key, nonce, or AAD input of any kind.
        pub(crate) fn new_placeholder_encrypt() -> Self {
            Self {
                algorithm: AeadAlgorithm::ChaCha20Poly1305,
                operation: AeadOperation::Encrypt,
            }
        }

        /// Construct a placeholder DECRYPT request. Takes NO ciphertext,
        /// tag, key, nonce, or AAD input of any kind.
        pub(crate) fn new_placeholder_decrypt() -> Self {
            Self {
                algorithm: AeadAlgorithm::ChaCha20Poly1305,
                operation: AeadOperation::Decrypt,
            }
        }

        /// A non-sensitive status snapshot. Always `Placeholder` — this
        /// skeleton runs no cryptography, so there is no other state to
        /// report.
        pub(crate) fn status(&self) -> AeadRequestStatus {
            AeadRequestStatus {
                state: FedosCoreState::Placeholder,
            }
        }

        /// The algorithm label this request names — intent only.
        pub(crate) fn algorithm(&self) -> AeadAlgorithm {
            self.algorithm
        }

        /// The operation label this request names — intent only.
        pub(crate) fn operation(&self) -> AeadOperation {
            self.operation
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_encrypt_reports_encrypt_operation_only() {
            let request = AeadPlaceholderRequest::new_placeholder_encrypt();
            assert_eq!(request.operation(), AeadOperation::Encrypt);
            assert_eq!(request.algorithm(), AeadAlgorithm::ChaCha20Poly1305);
            assert_eq!(request.status().state, FedosCoreState::Placeholder);
        }

        #[test]
        fn new_placeholder_decrypt_reports_decrypt_operation_only() {
            let request = AeadPlaceholderRequest::new_placeholder_decrypt();
            assert_eq!(request.operation(), AeadOperation::Decrypt);
            assert_eq!(request.algorithm(), AeadAlgorithm::ChaCha20Poly1305);
            assert_eq!(request.status().state, FedosCoreState::Placeholder);
        }

        #[test]
        fn status_is_always_placeholder_only_no_real_cryptography() {
            for request in [
                AeadPlaceholderRequest::new_placeholder_encrypt(),
                AeadPlaceholderRequest::new_placeholder_decrypt(),
            ] {
                assert_eq!(request.status().state, FedosCoreState::Placeholder);
            }
        }
    }
}

/// Stage 82 — an INTERNAL-ONLY KDF request skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns a
/// [`KdfPlaceholderRequest`].
///
/// This module holds NO IKM, salt, info, PRK, OKM, or other secret byte —
/// there is no borrowed-byte-slice, `Vec<u8>`, or `String` field or
/// parameter anywhere below, and no real extract/expand operation is
/// implemented or called. Production code here does NOT import `hkdf` or
/// `sha2` — those dependencies are exercised only by the `cfg(test)`-only
/// `rfc5869_vectors` module above, unchanged since Stage 77/81. This module
/// does not connect to `aead_core` (above) or `secret_handle` (further
/// above): it never constructs an `AeadPlaceholderRequest` or a
/// `SecretHandle`, and never reads a key/secret byte out of either — when in
/// doubt about a connection between skeletons, this crate deliberately
/// leaves them unconnected rather than guess at a future design.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle` and
/// `aead_core` above do. This is expected for a skeleton not yet wired to
/// any consumer.
#[allow(dead_code)]
mod kdf_core {
    use crate::FedosCoreState;

    /// A supported KDF algorithm label — intent only, no implementation.
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum KdfAlgorithm {
        HkdfSha256,
    }

    /// Which KDF operation a [`KdfPlaceholderRequest`] represents — a label
    /// only, no bytes are extracted or expanded. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum KdfOperation {
        Extract,
        Expand,
        ExtractExpand,
    }

    /// A non-sensitive status snapshot for a [`KdfPlaceholderRequest`].
    /// Crate-private only. Never contains an IKM/salt/info/PRK/OKM byte —
    /// `state` reuses this crate's existing
    /// [`FedosCoreState`](crate::FedosCoreState) labels (`Unavailable` /
    /// `Placeholder`) rather than inventing a parallel enum.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct KdfRequestStatus {
        pub(crate) state: FedosCoreState,
    }

    /// An INTERNAL-ONLY KDF placeholder request skeleton (crate-private;
    /// not part of this crate's public API — see the module-level doc
    /// comment above). Holds ONLY the two labels below — no IKM, salt,
    /// info, PRK, OKM, or other secret byte, and no `hkdf`/`sha2` type. A
    /// future, explicitly-reviewed stage may extend this skeleton to
    /// actually extract/expand bytes behind `cfg(test)` first; until then it
    /// accepts and stores none.
    pub(crate) struct KdfPlaceholderRequest {
        algorithm: KdfAlgorithm,
        operation: KdfOperation,
    }

    impl KdfPlaceholderRequest {
        /// Construct a placeholder EXTRACT request. Takes NO IKM or salt
        /// input of any kind.
        pub(crate) fn new_placeholder_extract() -> Self {
            Self {
                algorithm: KdfAlgorithm::HkdfSha256,
                operation: KdfOperation::Extract,
            }
        }

        /// Construct a placeholder EXPAND request. Takes NO PRK or info
        /// input of any kind.
        pub(crate) fn new_placeholder_expand() -> Self {
            Self {
                algorithm: KdfAlgorithm::HkdfSha256,
                operation: KdfOperation::Expand,
            }
        }

        /// Construct a placeholder combined EXTRACT-THEN-EXPAND request.
        /// Takes NO IKM, salt, info, or length input of any kind.
        pub(crate) fn new_placeholder_extract_expand() -> Self {
            Self {
                algorithm: KdfAlgorithm::HkdfSha256,
                operation: KdfOperation::ExtractExpand,
            }
        }

        /// A non-sensitive status snapshot. Always `Placeholder` — this
        /// skeleton runs no cryptography, so there is no other state to
        /// report.
        pub(crate) fn status(&self) -> KdfRequestStatus {
            KdfRequestStatus {
                state: FedosCoreState::Placeholder,
            }
        }

        /// The algorithm label this request names — intent only.
        pub(crate) fn algorithm(&self) -> KdfAlgorithm {
            self.algorithm
        }

        /// The operation label this request names — intent only.
        pub(crate) fn operation(&self) -> KdfOperation {
            self.operation
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_extract_reports_extract_operation_only() {
            let request = KdfPlaceholderRequest::new_placeholder_extract();
            assert_eq!(request.operation(), KdfOperation::Extract);
            assert_eq!(request.algorithm(), KdfAlgorithm::HkdfSha256);
            assert_eq!(request.status().state, FedosCoreState::Placeholder);
        }

        #[test]
        fn new_placeholder_expand_reports_expand_operation_only() {
            let request = KdfPlaceholderRequest::new_placeholder_expand();
            assert_eq!(request.operation(), KdfOperation::Expand);
            assert_eq!(request.algorithm(), KdfAlgorithm::HkdfSha256);
            assert_eq!(request.status().state, FedosCoreState::Placeholder);
        }

        #[test]
        fn new_placeholder_extract_expand_reports_extract_expand_operation_only() {
            let request = KdfPlaceholderRequest::new_placeholder_extract_expand();
            assert_eq!(request.operation(), KdfOperation::ExtractExpand);
            assert_eq!(request.algorithm(), KdfAlgorithm::HkdfSha256);
            assert_eq!(request.status().state, FedosCoreState::Placeholder);
        }

        #[test]
        fn status_is_always_placeholder_only_no_real_cryptography() {
            for request in [
                KdfPlaceholderRequest::new_placeholder_extract(),
                KdfPlaceholderRequest::new_placeholder_expand(),
                KdfPlaceholderRequest::new_placeholder_extract_expand(),
            ] {
                assert_eq!(request.status().state, FedosCoreState::Placeholder);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_is_unavailable() {
        assert_eq!(fedos_core_status().state, FedosCoreState::Unavailable);
    }

    #[test]
    fn capabilities_are_placeholders_only() {
        for cap in fedos_core_capabilities() {
            assert!(cap.ends_with("_placeholder"));
        }
    }

    #[test]
    fn operations_return_placeholder_only() {
        for status in [
            random_bytes_placeholder(),
            derive_key_placeholder(),
            encrypt_placeholder(),
            decrypt_placeholder(),
        ] {
            assert_eq!(status.state, FedosCoreState::Placeholder);
        }
    }
}

/// Stage 75 — RFC 8439 known-answer verification, `#[cfg(test)]` ONLY.
///
/// This module is not part of the crate's public API: it is compiled only
/// under `cargo test`, imports `chacha20poly1305` (adopted as a production
/// dependency in Stage 74) purely to check that dependency against the
/// official vectors, and implements no encrypt/decrypt function that any
/// other code — production or otherwise — can call. The placeholder
/// functions above (`encrypt_placeholder`, `decrypt_placeholder`, etc.) are
/// untouched.
///
/// Stage 81 extracts the seal/open logic that used to be written inline in
/// the two vector tests below into two small test-only helpers,
/// [`seal_chacha20poly1305_for_test`] and [`open_chacha20poly1305_for_test`]
/// — private `fn`s that exist ONLY inside this `cfg(test)`-only module, are
/// not `pub`/`pub(crate)`, are not re-exported, and are NOT connected to the
/// crate-private `aead_core` skeleton (Stage 80) or to `secret_handle`
/// (Stage 79) in any way. This is a test-only refactor: the two vector tests
/// (`rfc8439_positive_vectors_encrypt_and_decrypt_correctly` and
/// `rfc8439_negative_vectors_fail_to_decrypt_if_present`) assert exactly the
/// same things as before, just calling the shared helper instead of
/// constructing a `Key`/`Nonce`/`ChaCha20Poly1305` inline twice.
#[cfg(test)]
mod rfc8439_vectors {
    use chacha20poly1305::aead::{Aead, Error as AeadError, KeyInit, Payload};
    use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce};
    use serde::Deserialize;

    /// One vector entry. Only the fields this test needs are named; unknown
    /// JSON fields (`nonceConstant`, `plaintextUtf8`, `notes`, ...) are
    /// ignored by serde rather than mirrored here.
    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Vector {
        id: String,
        should_pass: bool,
        key: String,
        nonce: String,
        aad: String,
        plaintext: String,
        ciphertext: String,
        tag: String,
    }

    #[derive(Debug, Deserialize)]
    struct VectorFile {
        vectors: Vec<Vector>,
    }

    /// The RFC 8439 vector file imported verbatim in Stage 73, read at
    /// compile time so this test has no filesystem/IO dependency at runtime.
    const RFC8439_JSON: &str =
        include_str!("../../../test-vectors/aead/chacha20poly1305-rfc8439.json");

    fn decode_hex(field: &str, id: &str, value: &str) -> Vec<u8> {
        hex::decode(value).unwrap_or_else(|err| {
            panic!("{id}: invalid hex in field `{field}`: {err}")
        })
    }

    /// Test-only ChaCha20-Poly1305 SEAL (encrypt-then-tag) helper — private
    /// `fn`, exists ONLY under `cfg(test)`, never `pub`/`pub(crate)`. Takes
    /// raw key/nonce/plaintext/AAD bytes (all test-vector bytes, never a
    /// real secret) and returns `ciphertext‖tag` on success, or the
    /// underlying AEAD error on failure (e.g. a malformed key/nonce length).
    fn seal_chacha20poly1305_for_test(
        key_bytes: &[u8],
        nonce_bytes: &[u8],
        plaintext_bytes: &[u8],
        aad_bytes: &[u8],
    ) -> Result<Vec<u8>, AeadError> {
        let key = Key::try_from(key_bytes).expect("test helper: key is not 32 bytes");
        let nonce = Nonce::try_from(nonce_bytes).expect("test helper: nonce is not 12 bytes");
        let cipher = ChaCha20Poly1305::new(&key);
        cipher.encrypt(
            &nonce,
            Payload {
                msg: plaintext_bytes,
                aad: aad_bytes,
            },
        )
    }

    /// Test-only ChaCha20-Poly1305 OPEN (verify-then-decrypt) helper — same
    /// scope/rules as [`seal_chacha20poly1305_for_test`] above.
    /// `sealed_bytes` is `ciphertext‖tag`; returns the plaintext on success,
    /// or an error if authentication fails (e.g. for a tampered/negative
    /// vector).
    fn open_chacha20poly1305_for_test(
        key_bytes: &[u8],
        nonce_bytes: &[u8],
        sealed_bytes: &[u8],
        aad_bytes: &[u8],
    ) -> Result<Vec<u8>, AeadError> {
        let key = Key::try_from(key_bytes).expect("test helper: key is not 32 bytes");
        let nonce = Nonce::try_from(nonce_bytes).expect("test helper: nonce is not 12 bytes");
        let cipher = ChaCha20Poly1305::new(&key);
        cipher.decrypt(
            &nonce,
            Payload {
                msg: sealed_bytes,
                aad: aad_bytes,
            },
        )
    }

    #[test]
    fn rfc8439_json_parses_and_is_non_empty() {
        let file: VectorFile =
            serde_json::from_str(RFC8439_JSON).expect("RFC 8439 vector JSON must parse");
        assert!(
            !file.vectors.is_empty(),
            "expected at least one RFC 8439 vector"
        );
    }

    /// `shouldPass=true` vectors: [`seal_chacha20poly1305_for_test`] must
    /// seal plaintext+AAD to exactly the RFC's expected ciphertext||tag, and
    /// [`open_chacha20poly1305_for_test`] must open that same
    /// ciphertext||tag back to exactly the RFC's expected plaintext.
    #[test]
    fn rfc8439_positive_vectors_encrypt_and_decrypt_correctly() {
        let file: VectorFile =
            serde_json::from_str(RFC8439_JSON).expect("RFC 8439 vector JSON must parse");

        let mut checked = 0usize;
        for vector in file.vectors.iter().filter(|v| v.should_pass) {
            let key_bytes = decode_hex("key", &vector.id, &vector.key);
            let nonce_bytes = decode_hex("nonce", &vector.id, &vector.nonce);
            let aad_bytes = decode_hex("aad", &vector.id, &vector.aad);
            let plaintext_bytes = decode_hex("plaintext", &vector.id, &vector.plaintext);
            let ciphertext_bytes = decode_hex("ciphertext", &vector.id, &vector.ciphertext);
            let tag_bytes = decode_hex("tag", &vector.id, &vector.tag);

            let mut expected_sealed = ciphertext_bytes.clone();
            expected_sealed.extend_from_slice(&tag_bytes);

            let sealed = seal_chacha20poly1305_for_test(
                &key_bytes,
                &nonce_bytes,
                &plaintext_bytes,
                &aad_bytes,
            )
            .unwrap_or_else(|err| panic!("{}: encrypt failed: {err}", vector.id));
            assert_eq!(
                sealed, expected_sealed,
                "{}: ciphertext||tag did not match the RFC 8439 vector",
                vector.id
            );

            let opened = open_chacha20poly1305_for_test(
                &key_bytes,
                &nonce_bytes,
                &expected_sealed,
                &aad_bytes,
            )
            .unwrap_or_else(|err| panic!("{}: decrypt failed: {err}", vector.id));
            assert_eq!(
                opened, plaintext_bytes,
                "{}: decrypted plaintext did not match the RFC 8439 vector",
                vector.id
            );

            checked += 1;
        }
        assert!(
            checked > 0,
            "expected at least one shouldPass=true RFC 8439 vector to be checked"
        );
    }

    /// `shouldPass=false` vectors, if any exist in the imported file, must
    /// fail to decrypt/authenticate via [`open_chacha20poly1305_for_test`].
    /// RFC 8439 itself publishes no byte-level tamper/negative vector for
    /// this construction (per docs/crypto_vector_sources.md §2's
    /// verbatim-only import rule, none is fabricated here — see the file's
    /// own `notes` field) — so today this loop body runs zero times and the
    /// test trivially passes. It exists so that IF a future,
    /// explicitly-reviewed re-import of this file ever adds an official
    /// negative case, this test starts enforcing it with no further code
    /// change required.
    #[test]
    fn rfc8439_negative_vectors_fail_to_decrypt_if_present() {
        let file: VectorFile =
            serde_json::from_str(RFC8439_JSON).expect("RFC 8439 vector JSON must parse");

        for vector in file.vectors.iter().filter(|v| !v.should_pass) {
            let key_bytes = decode_hex("key", &vector.id, &vector.key);
            let nonce_bytes = decode_hex("nonce", &vector.id, &vector.nonce);
            let aad_bytes = decode_hex("aad", &vector.id, &vector.aad);
            let ciphertext_bytes = decode_hex("ciphertext", &vector.id, &vector.ciphertext);
            let tag_bytes = decode_hex("tag", &vector.id, &vector.tag);

            let mut sealed = ciphertext_bytes.clone();
            sealed.extend_from_slice(&tag_bytes);

            let result =
                open_chacha20poly1305_for_test(&key_bytes, &nonce_bytes, &sealed, &aad_bytes);
            assert!(
                result.is_err(),
                "{}: expected decrypt/authentication failure for a shouldPass=false vector",
                vector.id
            );
        }
    }

    /// Unit test for the helpers themselves, independent of the vector
    /// file: a seal-then-open round trip over fixed, non-secret,
    /// test-only bytes must return the original plaintext.
    #[test]
    fn seal_then_open_round_trip_for_test_helper() {
        let key_bytes = [0x11u8; 32];
        let nonce_bytes = [0x22u8; 12];
        let aad_bytes = b"aad-for-test";
        let plaintext_bytes = b"plaintext-for-test";

        let sealed =
            seal_chacha20poly1305_for_test(&key_bytes, &nonce_bytes, plaintext_bytes, aad_bytes)
                .expect("seal should succeed with a well-formed key/nonce");
        let opened =
            open_chacha20poly1305_for_test(&key_bytes, &nonce_bytes, &sealed, aad_bytes)
                .expect("open should succeed against its own sealed output");
        assert_eq!(opened, plaintext_bytes);
    }

    /// Unit test for the OPEN helper's failure path: tampering with the
    /// sealed bytes (the authentication tag, here) must make
    /// [`open_chacha20poly1305_for_test`] return an error.
    #[test]
    fn open_fails_for_tampered_sealed_bytes_for_test_helper() {
        let key_bytes = [0x33u8; 32];
        let nonce_bytes = [0x44u8; 12];
        let aad_bytes = b"aad-for-test";
        let plaintext_bytes = b"plaintext-for-test";

        let mut sealed =
            seal_chacha20poly1305_for_test(&key_bytes, &nonce_bytes, plaintext_bytes, aad_bytes)
                .expect("seal should succeed with a well-formed key/nonce");
        let last = sealed.len() - 1;
        sealed[last] ^= 0xff;

        let result = open_chacha20poly1305_for_test(&key_bytes, &nonce_bytes, &sealed, aad_bytes);
        assert!(
            result.is_err(),
            "expected authentication failure for tampered sealed bytes"
        );
    }
}

/// Stage 77 — RFC 5869 HKDF-SHA256 known-answer verification, `#[cfg(test)]`
/// ONLY.
///
/// This module is not part of the crate's public API: it is compiled only
/// under `cargo test`, imports `hkdf` (adopted as a production dependency in
/// Stage 76) and `sha2` (a `[dev-dependencies]`-only crate added this stage)
/// purely to check the `hkdf` dependency against the official RFC 5869
/// vectors, and implements no key-derivation function that any other code —
/// production or otherwise — can call. `derive_key_placeholder` above is
/// untouched.
///
/// Stage 83 extracts the extract/expand logic that used to be written
/// inline in the two vector tests below into three small test-only helpers,
/// [`extract_hkdf_sha256_for_test`], [`expand_hkdf_sha256_for_test`], and
/// [`extract_expand_hkdf_sha256_for_test`] — private `fn`s that exist ONLY
/// inside this `cfg(test)`-only module, are not `pub`/`pub(crate)`, are not
/// re-exported, and are NOT connected to the crate-private `kdf_core`
/// skeleton (Stage 82) or to `secret_handle`/`aead_core` in any way. This is
/// a test-only refactor, mirroring Stage 81's `rfc8439_vectors` refactor:
/// the two vector tests
/// (`rfc5869_positive_vectors_extract_and_expand_correctly` and
/// `rfc5869_negative_vectors_do_not_match_if_present`) assert exactly the
/// same things as before, just calling the shared helpers instead of
/// constructing an `Hkdf<Sha256>` inline twice.
#[cfg(test)]
mod rfc5869_vectors {
    use hkdf::{Hkdf, InvalidLength};
    use serde::Deserialize;
    use sha2::Sha256;

    /// One vector entry. Only the fields this test needs are named; unknown
    /// JSON fields (`description`, `notes`, ...) are ignored by serde rather
    /// than mirrored here.
    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Vector {
        id: String,
        should_pass: bool,
        ikm: String,
        salt: String,
        info: String,
        length: usize,
        prk: String,
        okm: String,
    }

    #[derive(Debug, Deserialize)]
    struct VectorFile {
        vectors: Vec<Vector>,
    }

    /// The RFC 5869 vector file imported verbatim in Stage 73, read at
    /// compile time so this test has no filesystem/IO dependency at runtime.
    const RFC5869_JSON: &str = include_str!("../../../test-vectors/kdf/hkdf-rfc5869.json");

    fn decode_hex(field: &str, id: &str, value: &str) -> Vec<u8> {
        hex::decode(value).unwrap_or_else(|err| {
            panic!("{id}: invalid hex in field `{field}`: {err}")
        })
    }

    /// Test-only HKDF-SHA256 EXTRACT helper — private `fn`, exists ONLY
    /// under `cfg(test)`, never `pub`/`pub(crate)`. Takes raw IKM/salt bytes
    /// (test-vector bytes, never a real secret) and returns the PRK.
    /// Infallible, matching the `hkdf` crate's own `extract` signature.
    fn extract_hkdf_sha256_for_test(ikm_bytes: &[u8], salt_bytes: &[u8]) -> Vec<u8> {
        let (prk, _) = Hkdf::<Sha256>::extract(Some(salt_bytes), ikm_bytes);
        prk.to_vec()
    }

    /// Test-only HKDF-SHA256 EXPAND helper — same scope/rules as
    /// [`extract_hkdf_sha256_for_test`] above. Takes a PRK (raw bytes, e.g.
    /// from [`extract_hkdf_sha256_for_test`] or a vector's own fixture
    /// value) + `info` + a desired output length, and returns OKM bytes on
    /// success, or the underlying `InvalidLength` error if the requested
    /// length is unsupported (RFC 5869 §2.3's `255 * HashLen` ceiling).
    fn expand_hkdf_sha256_for_test(
        prk_bytes: &[u8],
        info_bytes: &[u8],
        length: usize,
    ) -> Result<Vec<u8>, InvalidLength> {
        let hk = Hkdf::<Sha256>::from_prk(prk_bytes)
            .expect("test helper: PRK is not the correct length");
        let mut okm = vec![0u8; length];
        hk.expand(info_bytes, &mut okm)?;
        Ok(okm)
    }

    /// Test-only combined HKDF-SHA256 EXTRACT-THEN-EXPAND helper — same
    /// scope/rules as [`extract_hkdf_sha256_for_test`] above. Runs extract
    /// then expand in one call; returns `(prk_bytes, okm_bytes)` on success.
    fn extract_expand_hkdf_sha256_for_test(
        ikm_bytes: &[u8],
        salt_bytes: &[u8],
        info_bytes: &[u8],
        length: usize,
    ) -> Result<(Vec<u8>, Vec<u8>), InvalidLength> {
        let (prk, hk) = Hkdf::<Sha256>::extract(Some(salt_bytes), ikm_bytes);
        let mut okm = vec![0u8; length];
        hk.expand(info_bytes, &mut okm)?;
        Ok((prk.to_vec(), okm))
    }

    #[test]
    fn rfc5869_json_parses_and_is_non_empty() {
        let file: VectorFile =
            serde_json::from_str(RFC5869_JSON).expect("RFC 5869 vector JSON must parse");
        assert!(
            !file.vectors.is_empty(),
            "expected at least one RFC 5869 vector"
        );
    }

    /// `shouldPass=true` vectors: [`extract_hkdf_sha256_for_test`] must
    /// extract a PRK from IKM+salt matching the RFC's expected PRK,
    /// [`expand_hkdf_sha256_for_test`] must expand that PRK with `info` to
    /// exactly the RFC's expected `L`-octet OKM, and
    /// [`extract_expand_hkdf_sha256_for_test`] must reproduce both bytes in
    /// one combined call.
    #[test]
    fn rfc5869_positive_vectors_extract_and_expand_correctly() {
        let file: VectorFile =
            serde_json::from_str(RFC5869_JSON).expect("RFC 5869 vector JSON must parse");

        let mut checked = 0usize;
        for vector in file.vectors.iter().filter(|v| v.should_pass) {
            let ikm_bytes = decode_hex("ikm", &vector.id, &vector.ikm);
            let salt_bytes = decode_hex("salt", &vector.id, &vector.salt);
            let info_bytes = decode_hex("info", &vector.id, &vector.info);
            let prk_bytes = decode_hex("prk", &vector.id, &vector.prk);
            let okm_bytes = decode_hex("okm", &vector.id, &vector.okm);

            let prk = extract_hkdf_sha256_for_test(&ikm_bytes, &salt_bytes);
            assert_eq!(
                prk, prk_bytes,
                "{}: PRK did not match the RFC 5869 vector",
                vector.id
            );

            let okm = expand_hkdf_sha256_for_test(&prk_bytes, &info_bytes, vector.length)
                .unwrap_or_else(|err| panic!("{}: expand failed: {err}", vector.id));
            assert_eq!(
                okm, okm_bytes,
                "{}: OKM did not match the RFC 5869 vector",
                vector.id
            );

            let (combined_prk, combined_okm) = extract_expand_hkdf_sha256_for_test(
                &ikm_bytes,
                &salt_bytes,
                &info_bytes,
                vector.length,
            )
            .unwrap_or_else(|err| panic!("{}: extract_expand failed: {err}", vector.id));
            assert_eq!(
                combined_prk, prk_bytes,
                "{}: combined-helper PRK did not match the RFC 5869 vector",
                vector.id
            );
            assert_eq!(
                combined_okm, okm_bytes,
                "{}: combined-helper OKM did not match the RFC 5869 vector",
                vector.id
            );

            checked += 1;
        }
        assert!(
            checked > 0,
            "expected at least one shouldPass=true RFC 5869 vector to be checked"
        );
    }

    /// `shouldPass=false` vectors, if any exist in the imported file, must
    /// produce a PRK or OKM (via [`extract_expand_hkdf_sha256_for_test`])
    /// that does NOT match whatever (necessarily incorrect) expected bytes
    /// the fixture carries. The currently imported RFC 5869 file has no
    /// negative case (RFC 5869 Appendix A publishes only positive
    /// known-answer test cases for HKDF-SHA256 — see
    /// docs/crypto_vector_sources.md §2's verbatim-only import rule; none is
    /// fabricated here) — so today this loop body runs zero times and the
    /// test trivially passes. It exists so that IF a future,
    /// explicitly-reviewed re-import of this file ever adds an official
    /// negative case, this test starts enforcing it with no further code
    /// change required.
    #[test]
    fn rfc5869_negative_vectors_do_not_match_if_present() {
        let file: VectorFile =
            serde_json::from_str(RFC5869_JSON).expect("RFC 5869 vector JSON must parse");

        for vector in file.vectors.iter().filter(|v| !v.should_pass) {
            let ikm_bytes = decode_hex("ikm", &vector.id, &vector.ikm);
            let salt_bytes = decode_hex("salt", &vector.id, &vector.salt);
            let info_bytes = decode_hex("info", &vector.id, &vector.info);
            let prk_bytes = decode_hex("prk", &vector.id, &vector.prk);
            let okm_bytes = decode_hex("okm", &vector.id, &vector.okm);

            let (prk, okm) = extract_expand_hkdf_sha256_for_test(
                &ikm_bytes,
                &salt_bytes,
                &info_bytes,
                vector.length,
            )
            .unwrap_or_else(|err| panic!("{}: expand failed: {err}", vector.id));

            assert!(
                prk != prk_bytes || okm != okm_bytes,
                "{}: expected PRK or OKM mismatch for a shouldPass=false vector",
                vector.id
            );
        }
    }

    /// Unit test for the helpers themselves, independent of the vector
    /// file: an extract-then-expand round trip over fixed, non-secret,
    /// test-only bytes must agree between the three-helper path and the
    /// single combined-helper path.
    #[test]
    fn extract_then_expand_round_trip_for_test_helper() {
        let ikm_bytes = [0x11u8; 22];
        let salt_bytes = [0x22u8; 13];
        let info_bytes = b"info-for-test";
        let length = 42;

        let prk = extract_hkdf_sha256_for_test(&ikm_bytes, &salt_bytes);
        let okm = expand_hkdf_sha256_for_test(&prk, info_bytes, length)
            .expect("expand should succeed with a well-formed PRK");
        assert_eq!(okm.len(), length);

        let (combined_prk, combined_okm) =
            extract_expand_hkdf_sha256_for_test(&ikm_bytes, &salt_bytes, info_bytes, length)
                .expect("extract_expand should succeed with well-formed input");
        assert_eq!(combined_prk, prk);
        assert_eq!(combined_okm, okm);
    }

    /// Unit test for the EXPAND helper's failure path: RFC 5869 §2.3 caps
    /// HKDF-SHA256 output at `255 * 32` octets — requesting more must make
    /// [`expand_hkdf_sha256_for_test`] return an error.
    #[test]
    fn expand_fails_for_unsupported_length_for_test_helper() {
        let ikm_bytes = [0x33u8; 22];
        let salt_bytes = [0x44u8; 13];
        let prk = extract_hkdf_sha256_for_test(&ikm_bytes, &salt_bytes);

        let result = expand_hkdf_sha256_for_test(&prk, b"info-for-test", 255 * 32 + 1);
        assert!(
            result.is_err(),
            "expected an error for an out-of-range OKM length"
        );
    }
}
