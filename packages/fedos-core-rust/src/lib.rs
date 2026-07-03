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
//!
//! Stage 85 adds a third test-only module of the same shape as Stage 75/77,
//! verifying Stage 84's Argon2id dependency against an official RFC 9106
//! known-answer vector file. Same rules apply: `cfg(test)` only, no public
//! API change.
//!
//! Stage 86 is a test-only refactor of the Stage 85 module — the
//! Argon2id-side analogue of Stage 81/83's refactors: the derivation logic
//! that used to be written as a per-vector helper is now one small,
//! private, test-only helper function taking raw bytes (its own doc
//! comment, next to its declaration, names it). No production code
//! changed — the six functions above are untouched, and the Stage 82
//! skeleton is not connected to this refactor.
//!
//! Stage 87 adds a fourth crate-private module, `key_material`, reusing
//! `secret_handle`'s (Stage 79) exact placeholder-only pattern: an
//! INTERNAL-ONLY key-material handle skeleton (labels and a non-sensitive
//! status only — no key, seed, plaintext, ciphertext, passphrase, or nonce
//! byte). It exists as a future AEAD/KDF connection point, still not
//! connected to `secret_handle`, `aead_core`, or `kdf_core` today. Same
//! rules apply: not part of the public API, no public function above
//! constructs, holds, or returns one of its types.
//!
//! Stage 88 adds a fifth crate-private module, `domain_label`: an
//! INTERNAL-ONLY domain-separation-label skeleton holding only a fixed,
//! non-secret, `&'static str` label per named future connection point
//! (never a user-, environment-, or config-derived string, and never a
//! `String`/`Vec<u8>` field). It exists in preparation for a future HKDF/
//! AEAD/NIP-44/Nostr-key-derivation connection, still not connected to
//! `secret_handle`, `aead_core`, `kdf_core`, or `key_material` today. Same
//! rules apply: not part of the public API, no public function above
//! constructs, holds, or returns one of its types.
//!
//! Stage 89 adds a sixth crate-private module, `operation_context`: an
//! INTERNAL-ONLY operation-context skeleton naming a future AEAD/KDF/
//! Argon2/NIP-44/Nostr-key-derivation operation (a label and a
//! non-sensitive status only — no key, seed, plaintext, ciphertext,
//! passphrase, or nonce byte, and no `String`/`Vec` field). It exists as a
//! type basis for a future real operation, still not connected to
//! `secret_handle`, `aead_core`, `kdf_core`, `key_material`, or
//! `domain_label` today. Same rules apply: not part of the public API, no
//! public function above constructs, holds, or returns one of its types.
//!
//! Stage 90 adds a seventh crate-private module, `request_descriptor`: an
//! INTERNAL-ONLY request-descriptor skeleton naming a future AEAD/KDF/
//! Argon2/NIP-44/Nostr-key-derivation operation REQUEST (a label and a
//! non-sensitive status only — no key, seed, plaintext, ciphertext,
//! passphrase, or nonce byte, and no `String`/`Vec` field). It exists as a
//! non-sensitive-metadata type basis for a future real request, still not
//! connected to `secret_handle`, `aead_core`, `kdf_core`, `key_material`,
//! `domain_label`, or `operation_context` today. Same rules apply: not part
//! of the public API, no public function above constructs, holds, or
//! returns one of its types.
//!
//! Stage 91 adds an eighth crate-private module, `response_descriptor`: an
//! INTERNAL-ONLY response-descriptor skeleton naming a future AEAD/KDF/
//! Argon2/NIP-44/Nostr-key-derivation operation RESULT (a label and a
//! non-sensitive status only — no key, seed, plaintext, ciphertext,
//! passphrase, tag, or nonce byte, and no `String`/`Vec` field, no result
//! payload of any kind). It exists as a non-sensitive-metadata type basis
//! for a future real response, still not connected to `secret_handle`,
//! `aead_core`, `kdf_core`, `key_material`, `domain_label`,
//! `operation_context`, or `request_descriptor` today. Same rules apply:
//! not part of the public API, no public function above constructs, holds,
//! or returns one of its types.
//!
//! Stage 92 adds a ninth crate-private module, `crypto_pipeline`: an
//! INTERNAL-ONLY crypto-pipeline skeleton naming a future AEAD/KDF/Argon2/
//! NIP-44/Nostr-key-derivation PIPELINE that would eventually bundle the
//! descriptor/context/label/key-material skeletons above (a label and a
//! non-sensitive status only — no key, seed, plaintext, ciphertext,
//! passphrase, tag, or nonce byte, and no `String`/`Vec` field). It exists
//! as a type basis for a future real pipeline, still not connected to
//! `secret_handle`, `aead_core`, `kdf_core`, `key_material`, `domain_label`,
//! `operation_context`, `request_descriptor`, or `response_descriptor`
//! today. Same rules apply: not part of the public API, no public function
//! above constructs, holds, or returns one of its types.
//!
//! Stage 93 adds a tenth crate-private module, `descriptor_bundle`: an
//! INTERNAL-ONLY descriptor-bundle skeleton naming a future AEAD/KDF/
//! Argon2/NIP-44/Nostr-key-derivation BUNDLE that would eventually group
//! the descriptor/context/label/key-material skeletons above (a label and
//! a non-sensitive status only — no key, seed, plaintext, ciphertext,
//! passphrase, tag, or nonce byte, and no `String`/`Vec` field). It exists
//! as a fully independent, label-only type basis for a future real bundle,
//! still not connected to — and not holding an instance of —
//! `secret_handle`, `aead_core`, `kdf_core`, `key_material`, `domain_label`,
//! `operation_context`, `request_descriptor`, `response_descriptor`, or
//! `crypto_pipeline` today. Same rules apply: not part of the public API,
//! no public function above constructs, holds, or returns one of its
//! types.
//!
//! Stage 94 adds an eleventh crate-private module, `execution_plan`: an
//! INTERNAL-ONLY execution-plan skeleton naming a future AEAD/KDF/Argon2/
//! NIP-44/Nostr-key-derivation processing ORDER, as fixed, non-sensitive
//! plan/step labels only — no key, seed, plaintext, ciphertext, passphrase,
//! tag, or nonce byte, and no `String`/`Vec` field. It exists as a fully
//! independent, label-only type basis for a future real plan, still not
//! connected to — and not holding an instance of — `secret_handle`,
//! `aead_core`, `kdf_core`, `key_material`, `domain_label`,
//! `operation_context`, `request_descriptor`, `response_descriptor`,
//! `crypto_pipeline`, or `descriptor_bundle` today. Same rules apply: not
//! part of the public API, no public function above constructs, holds, or
//! returns one of its types.
//!
//! Stage 95 adds a twelfth crate-private module, `error_taxonomy`: an
//! INTERNAL-ONLY error-taxonomy skeleton classifying a future AEAD/KDF/
//! Argon2/NIP-44/Nostr-key-derivation operation FAILURE, as a fixed,
//! non-sensitive label only — no error message, no source error, no stack
//! trace, and no `String`/`Vec` field. It exists as a fully independent,
//! label-only type basis for a future real error type, still not
//! connected to — and not holding an instance of — `secret_handle`,
//! `aead_core`, `kdf_core`, `key_material`, `domain_label`,
//! `operation_context`, `request_descriptor`, `response_descriptor`,
//! `crypto_pipeline`, `descriptor_bundle`, or `execution_plan` today. Same
//! rules apply: not part of the public API, no public function above
//! constructs, holds, or returns one of its types.
//!
//! Stage 96 adds a thirteenth crate-private module, `audit_event`: an
//! INTERNAL-ONLY audit-event-label skeleton naming a future crypto-internal
//! state change (a fixed, non-sensitive label only — no event payload, no
//! log output, and no `String`/`Vec` field). It exists as a fully
//! independent, label-only type basis for a future real observability
//! mechanism, still not connected to — and not holding an instance of —
//! `secret_handle`, `aead_core`, `kdf_core`, `key_material`, `domain_label`,
//! `operation_context`, `request_descriptor`, `response_descriptor`,
//! `crypto_pipeline`, `descriptor_bundle`, `execution_plan`, or
//! `error_taxonomy` today. Same rules apply: not part of the public API,
//! no public function above constructs, holds, or returns one of its
//! types.

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

/// Stage 87 — an INTERNAL-ONLY key-material handle skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns a
/// [`KeyMaterialHandle`].
///
/// This module holds NO real key, seed, plaintext, ciphertext, passphrase,
/// or nonce byte — there is no borrowed-byte-slice, `Vec<u8>`, or `String`
/// field or parameter anywhere below, and no AEAD/HKDF/Argon2/NIP-44
/// operation is implemented or called. It reuses `secret_handle`'s
/// (Stage 79) exact placeholder-only pattern — a fixed, non-secret marker
/// wrapped in `secrecy::SecretBox`, zeroized on `clear()` — rather than
/// duplicating a second, divergent design; `subtle` (adopted Stage 78) is
/// intentionally NOT used yet, same reasoning as `secret_handle`. This
/// module does not connect to `secret_handle`, `aead_core` (Stage 80), or
/// `kdf_core` (Stage 82): it never constructs any of their types and never
/// reads a key/secret byte out of one — when in doubt about a connection
/// between skeletons, this crate deliberately leaves them unconnected
/// rather than guess at a future design (the same reasoning `aead_core`'s
/// own doc comment already states). It exists as a future AEAD/KDF
/// connection point: a place a later, explicitly-reviewed stage can extend
/// to actually hold key bytes, once it also implements the AEAD/KDF
/// operation that would consume them.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle`/
/// `aead_core`/`kdf_core` above do. This is expected for a skeleton not yet
/// wired to any consumer.
#[allow(dead_code)]
mod key_material {
    use secrecy::SecretBox;
    use zeroize::Zeroize;

    /// Coarse internal lifecycle state of a [`KeyMaterialHandle`].
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum KeyMaterialState {
        /// No placeholder marker has been allocated yet.
        Empty,
        /// A placeholder marker is allocated. Still holds no real key byte.
        Placeholder,
        /// [`KeyMaterialHandle::clear`] was called: the placeholder marker
        /// was zeroized and this handle must not be treated as holding
        /// anything.
        Cleared,
    }

    impl Default for KeyMaterialState {
        fn default() -> Self {
            KeyMaterialState::Empty
        }
    }

    /// Which future connection point a [`KeyMaterialHandle`] names — a
    /// label only, intent, not an implementation. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum KeyMaterialKind {
        /// Intended future connection point: an AEAD key (e.g. for
        /// `aead_core`, Stage 80). No AEAD key is held here.
        AeadKeyPlaceholder,
        /// Intended future connection point: KDF output (e.g. HKDF's OKM or
        /// Argon2id's tag, for `kdf_core`, Stage 82). No KDF output is held
        /// here.
        KdfOutputPlaceholder,
        /// Intended future connection point: a Nostr identity/signing key.
        /// No Nostr key is held here.
        NostrKeyPlaceholder,
        /// Any other future connection point not yet named above.
        UnknownPlaceholder,
    }

    /// A non-sensitive status snapshot for a [`KeyMaterialHandle`].
    /// Crate-private only. Never contains a key/seed/plaintext/ciphertext/
    /// passphrase/nonce byte.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct KeyMaterialStatus {
        pub(crate) state: KeyMaterialState,
    }

    /// A fixed, non-secret placeholder value. Exists ONLY so
    /// [`KeyMaterialHandle`] has a concrete `Zeroize`-able type to wrap in
    /// `secrecy::SecretBox` — its value is a constant, never derived from
    /// or holding any real key/seed/plaintext/ciphertext/passphrase/nonce
    /// byte. Identical in shape to `secret_handle`'s own `PlaceholderMarker`
    /// (Stage 79) — deliberately not shared across modules, so each
    /// skeleton stays independently reviewable.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    struct PlaceholderMarker(u8);

    impl Zeroize for PlaceholderMarker {
        fn zeroize(&mut self) {
            self.0 = 0;
        }
    }

    /// An INTERNAL-ONLY key-material handle skeleton (crate-private; not
    /// part of this crate's public API — see the module-level doc comment
    /// above). Holds NO real key, seed, plaintext, ciphertext, passphrase,
    /// or nonce byte: `marker` is the fixed, non-secret [`PlaceholderMarker`]
    /// above, wrapped in `secrecy::SecretBox` purely to exercise the
    /// secret-handling foundation adopted Stage 78, same as
    /// `secret_handle`. A future, explicitly-reviewed stage may extend this
    /// skeleton to hold real key bytes; until then it accepts and stores
    /// none.
    pub(crate) struct KeyMaterialHandle {
        state: KeyMaterialState,
        kind: KeyMaterialKind,
        marker: SecretBox<PlaceholderMarker>,
    }

    impl KeyMaterialHandle {
        /// Construct a placeholder handle of the given [`KeyMaterialKind`].
        /// Takes NO key, seed, plaintext, ciphertext, passphrase, or nonce
        /// input of any kind — `kind` is a label only.
        pub(crate) fn new_placeholder(kind: KeyMaterialKind) -> Self {
            Self {
                state: KeyMaterialState::Placeholder,
                kind,
                marker: SecretBox::new(Box::new(PlaceholderMarker(0))),
            }
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> KeyMaterialStatus {
            KeyMaterialStatus { state: self.state }
        }

        /// The [`KeyMaterialKind`] label this handle was constructed with —
        /// intent only.
        pub(crate) fn kind(&self) -> KeyMaterialKind {
            self.kind
        }

        /// Zeroizes the (non-secret) placeholder marker and marks this
        /// handle `Cleared`. Does not return, expose, or copy the marker.
        pub(crate) fn clear(&mut self) {
            self.marker.zeroize();
            self.state = KeyMaterialState::Cleared;
        }

        /// Whether [`KeyMaterialHandle::clear`] has been called.
        pub(crate) fn is_cleared(&self) -> bool {
            self.state == KeyMaterialState::Cleared
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let handle = KeyMaterialHandle::new_placeholder(KeyMaterialKind::AeadKeyPlaceholder);
            assert_eq!(handle.status().state, KeyMaterialState::Placeholder);
            assert!(!handle.is_cleared());
        }

        #[test]
        fn kind_reports_the_constructed_placeholder_kind_only() {
            for kind in [
                KeyMaterialKind::AeadKeyPlaceholder,
                KeyMaterialKind::KdfOutputPlaceholder,
                KeyMaterialKind::NostrKeyPlaceholder,
                KeyMaterialKind::UnknownPlaceholder,
            ] {
                let handle = KeyMaterialHandle::new_placeholder(kind);
                assert_eq!(handle.kind(), kind);
                assert_eq!(handle.status().state, KeyMaterialState::Placeholder);
            }
        }

        #[test]
        fn status_reports_placeholder_state_only_no_secret_bytes() {
            // `KeyMaterialStatus` carries only the coarse state enum — no
            // secret byte, no marker, nothing derived from `marker`.
            let handle = KeyMaterialHandle::new_placeholder(KeyMaterialKind::KdfOutputPlaceholder);
            let status = handle.status();
            assert_eq!(status.state, KeyMaterialState::Placeholder);
        }

        #[test]
        fn clear_transitions_state_to_cleared_only() {
            let mut handle =
                KeyMaterialHandle::new_placeholder(KeyMaterialKind::NostrKeyPlaceholder);
            handle.clear();
            assert_eq!(handle.status().state, KeyMaterialState::Cleared);
            assert!(handle.is_cleared());
        }

        #[test]
        fn is_cleared_is_false_until_clear_is_called() {
            let handle = KeyMaterialHandle::new_placeholder(KeyMaterialKind::UnknownPlaceholder);
            assert!(!handle.is_cleared());
        }

        #[test]
        fn empty_state_is_the_default_placeholder_only_state() {
            assert_eq!(KeyMaterialState::default(), KeyMaterialState::Empty);
        }
    }
}

/// Stage 88 — an INTERNAL-ONLY domain-separation-label skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns a [`DomainLabel`].
///
/// This module holds NO user-, environment-, or config-derived string — every
/// label [`DomainLabel::as_static_label`] can return is a fixed `&'static
/// str` literal, chosen at compile time from a [`DomainLabelKind`], never
/// built, formatted, concatenated, or read from any input, the process
/// environment, or runtime configuration. There is no `String` or owned
/// byte-buffer field
/// anywhere below — only the fixed `&'static str` table and the two label
/// enums. No AEAD/HKDF/Argon2/NIP-44 operation is implemented or called, and
/// no Nostr key is derived. This module does not connect to `secret_handle`
/// (Stage 79), `aead_core` (Stage 80), `kdf_core` (Stage 82), or
/// `key_material` (Stage 87): it never constructs any of their types and
/// never reads a key/secret byte out of one — when in doubt about a
/// connection between skeletons, this crate deliberately leaves them
/// unconnected rather than guess at a future design (the same reasoning
/// `aead_core`'s own doc comment already states). It exists in preparation
/// for a future HKDF/AEAD/NIP-44/Nostr-key-derivation connection point: a
/// place a later, explicitly-reviewed stage can extend to actually mix a
/// fixed label into a real derivation, once it also implements the
/// HKDF/AEAD/NIP-44 operation that would consume it.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle`/
/// `aead_core`/`kdf_core`/`key_material` above do. This is expected for a
/// skeleton not yet wired to any consumer.
#[allow(dead_code)]
mod domain_label {
    /// Coarse internal lifecycle state of a [`DomainLabel`]. Crate-private
    /// only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum DomainLabelState {
        /// A fixed placeholder label is active and returnable.
        Placeholder,
        /// No fixed label should be treated as active — the default, inert
        /// state before any [`DomainLabel`] is constructed for use.
        Disabled,
    }

    impl Default for DomainLabelState {
        fn default() -> Self {
            DomainLabelState::Disabled
        }
    }

    /// Which future domain-separation connection point a [`DomainLabel`]
    /// names — a label identity only, not an implementation. Crate-private
    /// only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum DomainLabelKind {
        /// Intended future connection point: a top-level FedOS master
        /// domain-separation label. No master key is derived here.
        FedosMasterPlaceholder,
        /// Intended future connection point: an AEAD key label (e.g. for
        /// `aead_core`, Stage 80, or `key_material`, Stage 87). No AEAD key
        /// is derived here.
        AeadKeyPlaceholder,
        /// Intended future connection point: a KDF output label (e.g. for
        /// `kdf_core`, Stage 82). No KDF output is derived here.
        KdfOutputPlaceholder,
        /// Intended future connection point: a Nostr identity/signing key
        /// label. No Nostr key is derived here.
        NostrKeyPlaceholder,
        /// Intended future connection point: a NIP-44 encryption label. No
        /// NIP-44 operation is performed here.
        Nip44Placeholder,
        /// Reserved for this module's own tests / future test-only fixtures
        /// — never used by production code paths.
        TestOnlyPlaceholder,
    }

    impl DomainLabelKind {
        /// The fixed `&'static str` label for this kind. Never built,
        /// formatted, concatenated, or derived from any input — a plain
        /// literal chosen at compile time.
        const fn as_static_label(self) -> &'static str {
            match self {
                DomainLabelKind::FedosMasterPlaceholder => "fedos:placeholder:master",
                DomainLabelKind::AeadKeyPlaceholder => "fedos:placeholder:aead-key",
                DomainLabelKind::KdfOutputPlaceholder => "fedos:placeholder:kdf-output",
                DomainLabelKind::NostrKeyPlaceholder => "fedos:placeholder:nostr-key",
                DomainLabelKind::Nip44Placeholder => "fedos:placeholder:nip44",
                DomainLabelKind::TestOnlyPlaceholder => "fedos:placeholder:test-only",
            }
        }
    }

    /// A non-sensitive status snapshot for a [`DomainLabel`]. Crate-private
    /// only. Never contains a key/seed/plaintext/ciphertext/passphrase/nonce
    /// byte.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct DomainLabelStatus {
        pub(crate) state: DomainLabelState,
    }

    /// An INTERNAL-ONLY domain-separation-label handle skeleton
    /// (crate-private; not part of this crate's public API — see the
    /// module-level doc comment above). Holds only a [`DomainLabelKind`]
    /// label identity and a [`DomainLabelState`] — no key, seed, plaintext,
    /// ciphertext, passphrase, or nonce byte, and no user-, environment-, or
    /// config-derived string. A future, explicitly-reviewed stage may extend
    /// this skeleton to actually mix its fixed label into a real
    /// derivation; until then it accepts and stores none.
    pub(crate) struct DomainLabel {
        kind: DomainLabelKind,
        state: DomainLabelState,
    }

    impl DomainLabel {
        /// Construct a placeholder label handle of the given
        /// [`DomainLabelKind`]. Takes NO user-, environment-, or
        /// config-derived input of any kind — `kind` is a fixed label
        /// identity only.
        pub(crate) fn new_placeholder(kind: DomainLabelKind) -> Self {
            Self {
                kind,
                state: DomainLabelState::Placeholder,
            }
        }

        /// The [`DomainLabelKind`] this handle was constructed with —
        /// identity only.
        pub(crate) fn kind(&self) -> DomainLabelKind {
            self.kind
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> DomainLabelStatus {
            DomainLabelStatus { state: self.state }
        }

        /// The fixed `&'static str` label for this handle's
        /// [`DomainLabelKind`] — never a `String`, never built/formatted/
        /// concatenated, never derived from user input, the process
        /// environment, or runtime configuration.
        pub(crate) fn as_static_label(&self) -> &'static str {
            self.kind.as_static_label()
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let label = DomainLabel::new_placeholder(DomainLabelKind::AeadKeyPlaceholder);
            assert_eq!(label.status().state, DomainLabelState::Placeholder);
        }

        #[test]
        fn kind_reports_the_constructed_placeholder_kind_only() {
            for kind in [
                DomainLabelKind::FedosMasterPlaceholder,
                DomainLabelKind::AeadKeyPlaceholder,
                DomainLabelKind::KdfOutputPlaceholder,
                DomainLabelKind::NostrKeyPlaceholder,
                DomainLabelKind::Nip44Placeholder,
                DomainLabelKind::TestOnlyPlaceholder,
            ] {
                let label = DomainLabel::new_placeholder(kind);
                assert_eq!(label.kind(), kind);
                assert_eq!(label.status().state, DomainLabelState::Placeholder);
            }
        }

        #[test]
        fn as_static_label_returns_the_documented_fixed_string_per_kind() {
            let expected = [
                (DomainLabelKind::FedosMasterPlaceholder, "fedos:placeholder:master"),
                (DomainLabelKind::AeadKeyPlaceholder, "fedos:placeholder:aead-key"),
                (DomainLabelKind::KdfOutputPlaceholder, "fedos:placeholder:kdf-output"),
                (DomainLabelKind::NostrKeyPlaceholder, "fedos:placeholder:nostr-key"),
                (DomainLabelKind::Nip44Placeholder, "fedos:placeholder:nip44"),
                (DomainLabelKind::TestOnlyPlaceholder, "fedos:placeholder:test-only"),
            ];
            for (kind, expected_label) in expected {
                let label = DomainLabel::new_placeholder(kind);
                assert_eq!(label.as_static_label(), expected_label);
            }
        }

        #[test]
        fn as_static_label_is_stable_across_repeated_calls() {
            let label = DomainLabel::new_placeholder(DomainLabelKind::Nip44Placeholder);
            assert_eq!(label.as_static_label(), label.as_static_label());
        }

        #[test]
        fn disabled_state_is_the_default_placeholder_only_state() {
            assert_eq!(DomainLabelState::default(), DomainLabelState::Disabled);
        }
    }
}

/// Stage 89 — an INTERNAL-ONLY operation-context skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns an
/// [`OperationContext`].
///
/// This module holds NO real key, seed, plaintext, ciphertext, passphrase,
/// or nonce byte — there is no borrowed-byte-slice, `Vec<u8>`, or `String`
/// field or parameter anywhere below, and no AEAD/HKDF/Argon2/NIP-44
/// operation is implemented or called, and no Nostr key is derived. It
/// takes no user-, environment-, or config-derived input of any kind —
/// [`OperationContext::new_placeholder`] accepts only an [`OperationKind`]
/// label. This module does not connect to `secret_handle` (Stage 79),
/// `aead_core` (Stage 80), `kdf_core` (Stage 82), `key_material` (Stage 87),
/// or `domain_label` (Stage 88): it never constructs any of their types and
/// never reads a key/secret/label byte out of one — when in doubt about a
/// connection between skeletons, this crate deliberately leaves them
/// unconnected rather than guess at a future design (the same reasoning
/// `aead_core`'s own doc comment already states). It exists as a type basis
/// a later, explicitly-reviewed stage can extend to actually name and
/// eventually run a real AEAD/KDF/NIP-44/Nostr-key-derivation operation,
/// once it also implements that operation.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle`/
/// `aead_core`/`kdf_core`/`key_material`/`domain_label` above do. This is
/// expected for a skeleton not yet wired to any consumer.
#[allow(dead_code)]
mod operation_context {
    /// Coarse internal lifecycle state of an [`OperationContext`].
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum OperationContextState {
        /// A placeholder operation context is active. Runs no cryptography.
        Placeholder,
        /// No operation context should be treated as active — the default,
        /// inert state before any [`OperationContext`] is constructed for
        /// use.
        Disabled,
    }

    impl Default for OperationContextState {
        fn default() -> Self {
            OperationContextState::Disabled
        }
    }

    /// Which future cryptographic operation an [`OperationContext`] names —
    /// a label only, intent, not an implementation. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum OperationKind {
        /// Intended future connection point: an AEAD seal/encrypt
        /// operation. No AEAD encryption is performed here.
        AeadEncryptPlaceholder,
        /// Intended future connection point: an AEAD open/decrypt
        /// operation. No AEAD decryption is performed here.
        AeadDecryptPlaceholder,
        /// Intended future connection point: an HKDF extract step. No HKDF
        /// extraction is performed here.
        HkdfExtractPlaceholder,
        /// Intended future connection point: an HKDF expand step. No HKDF
        /// expansion is performed here.
        HkdfExpandPlaceholder,
        /// Intended future connection point: a combined HKDF
        /// extract-then-expand step. No HKDF operation is performed here.
        HkdfExtractExpandPlaceholder,
        /// Intended future connection point: an Argon2id hash operation. No
        /// Argon2id hashing is performed here.
        Argon2idPlaceholder,
        /// Intended future connection point: a NIP-44 encrypt operation. No
        /// NIP-44 encryption is performed here.
        Nip44EncryptPlaceholder,
        /// Intended future connection point: a NIP-44 decrypt operation. No
        /// NIP-44 decryption is performed here.
        Nip44DecryptPlaceholder,
        /// Intended future connection point: a Nostr identity/signing key
        /// derivation. No Nostr key is derived here.
        NostrKeyDerivationPlaceholder,
        /// Reserved for this module's own tests / future test-only fixtures
        /// — never used by production code paths.
        TestOnlyPlaceholder,
    }

    /// A non-sensitive status snapshot for an [`OperationContext`].
    /// Crate-private only. Never contains a key/seed/plaintext/ciphertext/
    /// passphrase/nonce byte.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct OperationContextStatus {
        pub(crate) state: OperationContextState,
    }

    /// An INTERNAL-ONLY operation-context handle skeleton (crate-private;
    /// not part of this crate's public API — see the module-level doc
    /// comment above). Holds only an [`OperationKind`] label and an
    /// [`OperationContextState`] — no key, seed, plaintext, ciphertext,
    /// passphrase, or nonce byte, and no user-, environment-, or
    /// config-derived input. A future, explicitly-reviewed stage may extend
    /// this skeleton to actually run the named operation; until then it
    /// accepts and stores none.
    pub(crate) struct OperationContext {
        kind: OperationKind,
        state: OperationContextState,
    }

    impl OperationContext {
        /// Construct a placeholder operation context of the given
        /// [`OperationKind`]. Takes NO user-, environment-, or
        /// config-derived input of any kind — `kind` is a label only.
        pub(crate) fn new_placeholder(kind: OperationKind) -> Self {
            Self {
                kind,
                state: OperationContextState::Placeholder,
            }
        }

        /// The [`OperationKind`] label this context was constructed with —
        /// intent only.
        pub(crate) fn kind(&self) -> OperationKind {
            self.kind
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> OperationContextStatus {
            OperationContextStatus { state: self.state }
        }

        /// Whether this context is still in the [`OperationContextState::Placeholder`]
        /// state — always `true` for any handle constructed via
        /// [`OperationContext::new_placeholder`], since no other
        /// constructor exists.
        pub(crate) fn is_placeholder(&self) -> bool {
            self.state == OperationContextState::Placeholder
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let context = OperationContext::new_placeholder(OperationKind::AeadEncryptPlaceholder);
            assert_eq!(context.status().state, OperationContextState::Placeholder);
            assert!(context.is_placeholder());
        }

        #[test]
        fn kind_reports_the_constructed_placeholder_kind_only() {
            for kind in [
                OperationKind::AeadEncryptPlaceholder,
                OperationKind::AeadDecryptPlaceholder,
                OperationKind::HkdfExtractPlaceholder,
                OperationKind::HkdfExpandPlaceholder,
                OperationKind::HkdfExtractExpandPlaceholder,
                OperationKind::Argon2idPlaceholder,
                OperationKind::Nip44EncryptPlaceholder,
                OperationKind::Nip44DecryptPlaceholder,
                OperationKind::NostrKeyDerivationPlaceholder,
                OperationKind::TestOnlyPlaceholder,
            ] {
                let context = OperationContext::new_placeholder(kind);
                assert_eq!(context.kind(), kind);
                assert_eq!(context.status().state, OperationContextState::Placeholder);
            }
        }

        #[test]
        fn status_reports_placeholder_state_only_no_secret_bytes() {
            let context = OperationContext::new_placeholder(OperationKind::HkdfExtractPlaceholder);
            let status = context.status();
            assert_eq!(status.state, OperationContextState::Placeholder);
        }

        #[test]
        fn is_placeholder_is_true_for_every_constructed_context() {
            for kind in [
                OperationKind::Argon2idPlaceholder,
                OperationKind::Nip44DecryptPlaceholder,
                OperationKind::TestOnlyPlaceholder,
            ] {
                assert!(OperationContext::new_placeholder(kind).is_placeholder());
            }
        }

        #[test]
        fn disabled_state_is_the_default_placeholder_only_state() {
            assert_eq!(OperationContextState::default(), OperationContextState::Disabled);
        }
    }
}

/// Stage 90 — an INTERNAL-ONLY request-descriptor skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns a
/// [`RequestDescriptor`].
///
/// This module holds NO real key, seed, plaintext, ciphertext, passphrase,
/// or nonce byte — there is no borrowed-byte-slice, `Vec<u8>`, or `String`
/// field or parameter anywhere below, and no AEAD/HKDF/Argon2/NIP-44
/// operation is implemented or called, and no Nostr key is derived. It
/// takes no user-, environment-, or config-derived input of any kind —
/// [`RequestDescriptor::new_placeholder`] accepts only a
/// [`RequestDescriptorKind`] label. This module does not connect to
/// `secret_handle` (Stage 79), `aead_core` (Stage 80), `kdf_core` (Stage
/// 82), `key_material` (Stage 87), `domain_label` (Stage 88), or
/// `operation_context` (Stage 89): it never constructs any of their types
/// and never reads a key/secret/label/operation byte out of one — when in
/// doubt about a connection between skeletons, this crate deliberately
/// leaves them unconnected rather than guess at a future design (the same
/// reasoning `aead_core`'s own doc comment already states). It exists as a
/// non-sensitive-metadata type basis a later, explicitly-reviewed stage can
/// extend to actually describe a real AEAD/KDF/NIP-44/Nostr-key-derivation
/// operation REQUEST, once it also implements the operation the request
/// would describe.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle`/
/// `aead_core`/`kdf_core`/`key_material`/`domain_label`/`operation_context`
/// above do. This is expected for a skeleton not yet wired to any consumer.
#[allow(dead_code)]
mod request_descriptor {
    /// Coarse internal lifecycle state of a [`RequestDescriptor`].
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum RequestDescriptorState {
        /// A placeholder request descriptor is active. Describes no real
        /// request; runs no cryptography.
        Placeholder,
        /// No request descriptor should be treated as active — the
        /// default, inert state before any [`RequestDescriptor`] is
        /// constructed for use.
        Disabled,
    }

    impl Default for RequestDescriptorState {
        fn default() -> Self {
            RequestDescriptorState::Disabled
        }
    }

    /// Which future cryptographic operation REQUEST a [`RequestDescriptor`]
    /// names — a label only, intent, not an implementation and not a real
    /// request payload. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum RequestDescriptorKind {
        /// Intended future connection point: an AEAD seal/encrypt request.
        /// No AEAD encryption request is described here.
        AeadEncryptRequestPlaceholder,
        /// Intended future connection point: an AEAD open/decrypt request.
        /// No AEAD decryption request is described here.
        AeadDecryptRequestPlaceholder,
        /// Intended future connection point: an HKDF extract request. No
        /// HKDF extraction request is described here.
        HkdfExtractRequestPlaceholder,
        /// Intended future connection point: an HKDF expand request. No
        /// HKDF expansion request is described here.
        HkdfExpandRequestPlaceholder,
        /// Intended future connection point: a combined HKDF
        /// extract-then-expand request. No HKDF request is described here.
        HkdfExtractExpandRequestPlaceholder,
        /// Intended future connection point: an Argon2id hash request. No
        /// Argon2id hashing request is described here.
        Argon2idRequestPlaceholder,
        /// Intended future connection point: a NIP-44 encrypt request. No
        /// NIP-44 encryption request is described here.
        Nip44EncryptRequestPlaceholder,
        /// Intended future connection point: a NIP-44 decrypt request. No
        /// NIP-44 decryption request is described here.
        Nip44DecryptRequestPlaceholder,
        /// Intended future connection point: a Nostr identity/signing key
        /// derivation request. No Nostr key derivation request is
        /// described here.
        NostrKeyDerivationRequestPlaceholder,
        /// Reserved for this module's own tests / future test-only
        /// fixtures — never used by production code paths.
        TestOnlyRequestPlaceholder,
    }

    /// A non-sensitive status snapshot for a [`RequestDescriptor`].
    /// Crate-private only. Never contains a key/seed/plaintext/ciphertext/
    /// passphrase/nonce byte.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct RequestDescriptorStatus {
        pub(crate) state: RequestDescriptorState,
    }

    /// An INTERNAL-ONLY request-descriptor handle skeleton (crate-private;
    /// not part of this crate's public API — see the module-level doc
    /// comment above). Holds only a [`RequestDescriptorKind`] label and a
    /// [`RequestDescriptorState`] — no key, seed, plaintext, ciphertext,
    /// passphrase, or nonce byte, and no user-, environment-, or
    /// config-derived input. A future, explicitly-reviewed stage may extend
    /// this skeleton to actually describe a real request; until then it
    /// accepts and stores none.
    pub(crate) struct RequestDescriptor {
        kind: RequestDescriptorKind,
        state: RequestDescriptorState,
    }

    impl RequestDescriptor {
        /// Construct a placeholder request descriptor of the given
        /// [`RequestDescriptorKind`]. Takes NO user-, environment-, or
        /// config-derived input of any kind — `kind` is a label only.
        pub(crate) fn new_placeholder(kind: RequestDescriptorKind) -> Self {
            Self {
                kind,
                state: RequestDescriptorState::Placeholder,
            }
        }

        /// The [`RequestDescriptorKind`] label this descriptor was
        /// constructed with — intent only.
        pub(crate) fn kind(&self) -> RequestDescriptorKind {
            self.kind
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> RequestDescriptorStatus {
            RequestDescriptorStatus { state: self.state }
        }

        /// Whether this descriptor is still in the
        /// [`RequestDescriptorState::Placeholder`] state — always `true`
        /// for any handle constructed via
        /// [`RequestDescriptor::new_placeholder`], since no other
        /// constructor exists.
        pub(crate) fn is_placeholder(&self) -> bool {
            self.state == RequestDescriptorState::Placeholder
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let descriptor =
                RequestDescriptor::new_placeholder(RequestDescriptorKind::AeadEncryptRequestPlaceholder);
            assert_eq!(descriptor.status().state, RequestDescriptorState::Placeholder);
            assert!(descriptor.is_placeholder());
        }

        #[test]
        fn kind_reports_the_constructed_placeholder_kind_only() {
            for kind in [
                RequestDescriptorKind::AeadEncryptRequestPlaceholder,
                RequestDescriptorKind::AeadDecryptRequestPlaceholder,
                RequestDescriptorKind::HkdfExtractRequestPlaceholder,
                RequestDescriptorKind::HkdfExpandRequestPlaceholder,
                RequestDescriptorKind::HkdfExtractExpandRequestPlaceholder,
                RequestDescriptorKind::Argon2idRequestPlaceholder,
                RequestDescriptorKind::Nip44EncryptRequestPlaceholder,
                RequestDescriptorKind::Nip44DecryptRequestPlaceholder,
                RequestDescriptorKind::NostrKeyDerivationRequestPlaceholder,
                RequestDescriptorKind::TestOnlyRequestPlaceholder,
            ] {
                let descriptor = RequestDescriptor::new_placeholder(kind);
                assert_eq!(descriptor.kind(), kind);
                assert_eq!(descriptor.status().state, RequestDescriptorState::Placeholder);
            }
        }

        #[test]
        fn status_reports_placeholder_state_only_no_secret_bytes() {
            let descriptor =
                RequestDescriptor::new_placeholder(RequestDescriptorKind::HkdfExtractRequestPlaceholder);
            let status = descriptor.status();
            assert_eq!(status.state, RequestDescriptorState::Placeholder);
        }

        #[test]
        fn is_placeholder_is_true_for_every_constructed_descriptor() {
            for kind in [
                RequestDescriptorKind::Argon2idRequestPlaceholder,
                RequestDescriptorKind::Nip44DecryptRequestPlaceholder,
                RequestDescriptorKind::TestOnlyRequestPlaceholder,
            ] {
                assert!(RequestDescriptor::new_placeholder(kind).is_placeholder());
            }
        }

        #[test]
        fn disabled_state_is_the_default_placeholder_only_state() {
            assert_eq!(
                RequestDescriptorState::default(),
                RequestDescriptorState::Disabled
            );
        }
    }
}

/// Stage 91 — an INTERNAL-ONLY response-descriptor skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns a
/// [`ResponseDescriptor`].
///
/// This module holds NO real key, seed, plaintext, ciphertext, passphrase,
/// tag, or nonce byte — there is no borrowed-byte-slice, `Vec<u8>`, or
/// `String` field or parameter anywhere below, no result payload of any
/// kind, and no AEAD/HKDF/Argon2/NIP-44 operation is implemented or called,
/// and no Nostr key is derived. It takes no user-, environment-, or
/// config-derived input of any kind —
/// [`ResponseDescriptor::new_placeholder`] accepts only a
/// [`ResponseDescriptorKind`] label, and
/// [`ResponseDescriptor::new_error_placeholder`] accepts nothing at all.
/// This module does not connect to `secret_handle` (Stage 79), `aead_core`
/// (Stage 80), `kdf_core` (Stage 82), `key_material` (Stage 87),
/// `domain_label` (Stage 88), `operation_context` (Stage 89), or
/// `request_descriptor` (Stage 90): it never constructs any of their types
/// and never reads a key/secret/label/operation/request byte out of one —
/// when in doubt about a connection between skeletons, this crate
/// deliberately leaves them unconnected rather than guess at a future
/// design (the same reasoning `aead_core`'s own doc comment already
/// states). It exists as a non-sensitive-metadata type basis a later,
/// explicitly-reviewed stage can extend to actually describe a real
/// AEAD/KDF/NIP-44/Nostr-key-derivation operation RESULT, once it also
/// implements the operation the response would describe.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle`/
/// `aead_core`/`kdf_core`/`key_material`/`domain_label`/`operation_context`/
/// `request_descriptor` above do. This is expected for a skeleton not yet
/// wired to any consumer.
#[allow(dead_code)]
mod response_descriptor {
    /// Coarse internal lifecycle state of a [`ResponseDescriptor`].
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum ResponseDescriptorState {
        /// A placeholder response descriptor is active. Describes no real
        /// result; runs no cryptography.
        Placeholder,
        /// No response descriptor should be treated as active — the
        /// default, inert state before any [`ResponseDescriptor`] is
        /// constructed for use.
        Disabled,
        /// A placeholder ERROR response descriptor is active — describes
        /// only that a future real operation would have failed, never a
        /// real error payload/message/cause byte.
        ErrorPlaceholder,
    }

    impl Default for ResponseDescriptorState {
        fn default() -> Self {
            ResponseDescriptorState::Disabled
        }
    }

    /// Which future cryptographic operation RESULT a [`ResponseDescriptor`]
    /// names — a label only, intent, not an implementation and not a real
    /// result payload. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum ResponseDescriptorKind {
        /// Intended future connection point: an AEAD ciphertext result. No
        /// AEAD ciphertext is described here.
        AeadCiphertextPlaceholder,
        /// Intended future connection point: an AEAD plaintext result. No
        /// AEAD plaintext is described here.
        AeadPlaintextPlaceholder,
        /// Intended future connection point: an HKDF PRK result. No HKDF
        /// PRK is described here.
        HkdfPrkPlaceholder,
        /// Intended future connection point: an HKDF OKM result. No HKDF
        /// OKM is described here.
        HkdfOkmPlaceholder,
        /// Intended future connection point: an Argon2id tag result. No
        /// Argon2id tag is described here.
        Argon2idTagPlaceholder,
        /// Intended future connection point: a NIP-44 ciphertext result. No
        /// NIP-44 ciphertext is described here.
        Nip44CiphertextPlaceholder,
        /// Intended future connection point: a NIP-44 plaintext result. No
        /// NIP-44 plaintext is described here.
        Nip44PlaintextPlaceholder,
        /// Intended future connection point: a Nostr secret-key derivation
        /// result. No Nostr secret key is described here.
        NostrSecretKeyPlaceholder,
        /// Intended future connection point: a Nostr public-key derivation
        /// result. No Nostr public key is described here.
        NostrPublicKeyPlaceholder,
        /// A placeholder ERROR result label — pairs with
        /// [`ResponseDescriptorState::ErrorPlaceholder`]. Never a real error
        /// payload/message/cause byte.
        ErrorPlaceholder,
        /// Reserved for this module's own tests / future test-only
        /// fixtures — never used by production code paths.
        TestOnlyPlaceholder,
    }

    /// A non-sensitive status snapshot for a [`ResponseDescriptor`].
    /// Crate-private only. Never contains a key/seed/plaintext/ciphertext/
    /// passphrase/tag/nonce byte.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct ResponseDescriptorStatus {
        pub(crate) state: ResponseDescriptorState,
    }

    /// An INTERNAL-ONLY response-descriptor handle skeleton (crate-private;
    /// not part of this crate's public API — see the module-level doc
    /// comment above). Holds only a [`ResponseDescriptorKind`] label and a
    /// [`ResponseDescriptorState`] — no key, seed, plaintext, ciphertext,
    /// passphrase, tag, or nonce byte, and no user-, environment-, or
    /// config-derived input, and no result payload of any kind. A future,
    /// explicitly-reviewed stage may extend this skeleton to actually
    /// describe a real response; until then it accepts and stores none.
    pub(crate) struct ResponseDescriptor {
        kind: ResponseDescriptorKind,
        state: ResponseDescriptorState,
    }

    impl ResponseDescriptor {
        /// Construct a placeholder response descriptor of the given
        /// [`ResponseDescriptorKind`]. Takes NO user-, environment-, or
        /// config-derived input of any kind, and no result payload of any
        /// kind — `kind` is a label only.
        pub(crate) fn new_placeholder(kind: ResponseDescriptorKind) -> Self {
            Self {
                kind,
                state: ResponseDescriptorState::Placeholder,
            }
        }

        /// Construct a placeholder ERROR response descriptor. Takes NO
        /// input of any kind — never a real error payload/message/cause
        /// byte. Always pairs [`ResponseDescriptorKind::ErrorPlaceholder`]
        /// with [`ResponseDescriptorState::ErrorPlaceholder`].
        pub(crate) fn new_error_placeholder() -> Self {
            Self {
                kind: ResponseDescriptorKind::ErrorPlaceholder,
                state: ResponseDescriptorState::ErrorPlaceholder,
            }
        }

        /// The [`ResponseDescriptorKind`] label this descriptor was
        /// constructed with — intent only.
        pub(crate) fn kind(&self) -> ResponseDescriptorKind {
            self.kind
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> ResponseDescriptorStatus {
            ResponseDescriptorStatus { state: self.state }
        }

        /// Whether this descriptor is in the
        /// [`ResponseDescriptorState::Placeholder`] state — `true` for any
        /// handle constructed via
        /// [`ResponseDescriptor::new_placeholder`], `false` for one
        /// constructed via [`ResponseDescriptor::new_error_placeholder`].
        pub(crate) fn is_placeholder(&self) -> bool {
            self.state == ResponseDescriptorState::Placeholder
        }

        /// Whether this descriptor is in the
        /// [`ResponseDescriptorState::ErrorPlaceholder`] state — `true`
        /// only for a handle constructed via
        /// [`ResponseDescriptor::new_error_placeholder`].
        pub(crate) fn is_error_placeholder(&self) -> bool {
            self.state == ResponseDescriptorState::ErrorPlaceholder
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let descriptor =
                ResponseDescriptor::new_placeholder(ResponseDescriptorKind::AeadCiphertextPlaceholder);
            assert_eq!(descriptor.status().state, ResponseDescriptorState::Placeholder);
            assert!(descriptor.is_placeholder());
            assert!(!descriptor.is_error_placeholder());
        }

        #[test]
        fn kind_reports_the_constructed_placeholder_kind_only() {
            for kind in [
                ResponseDescriptorKind::AeadCiphertextPlaceholder,
                ResponseDescriptorKind::AeadPlaintextPlaceholder,
                ResponseDescriptorKind::HkdfPrkPlaceholder,
                ResponseDescriptorKind::HkdfOkmPlaceholder,
                ResponseDescriptorKind::Argon2idTagPlaceholder,
                ResponseDescriptorKind::Nip44CiphertextPlaceholder,
                ResponseDescriptorKind::Nip44PlaintextPlaceholder,
                ResponseDescriptorKind::NostrSecretKeyPlaceholder,
                ResponseDescriptorKind::NostrPublicKeyPlaceholder,
                ResponseDescriptorKind::TestOnlyPlaceholder,
            ] {
                let descriptor = ResponseDescriptor::new_placeholder(kind);
                assert_eq!(descriptor.kind(), kind);
                assert_eq!(descriptor.status().state, ResponseDescriptorState::Placeholder);
            }
        }

        #[test]
        fn status_reports_placeholder_state_only_no_secret_bytes() {
            let descriptor =
                ResponseDescriptor::new_placeholder(ResponseDescriptorKind::HkdfPrkPlaceholder);
            let status = descriptor.status();
            assert_eq!(status.state, ResponseDescriptorState::Placeholder);
        }

        #[test]
        fn new_error_placeholder_pairs_error_kind_with_error_state() {
            let descriptor = ResponseDescriptor::new_error_placeholder();
            assert_eq!(descriptor.kind(), ResponseDescriptorKind::ErrorPlaceholder);
            assert_eq!(
                descriptor.status().state,
                ResponseDescriptorState::ErrorPlaceholder
            );
            assert!(descriptor.is_error_placeholder());
            assert!(!descriptor.is_placeholder());
        }

        #[test]
        fn disabled_state_is_the_default_placeholder_only_state() {
            assert_eq!(
                ResponseDescriptorState::default(),
                ResponseDescriptorState::Disabled
            );
        }
    }
}

/// Stage 92 — an INTERNAL-ONLY crypto-pipeline skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns a [`CryptoPipeline`].
///
/// This module holds NO real key, seed, plaintext, ciphertext, passphrase,
/// tag, or nonce byte — there is no borrowed-byte-slice, `Vec<u8>`, or
/// `String` field or parameter anywhere below, and no AEAD/HKDF/Argon2/
/// NIP-44 operation is implemented or called, and no Nostr key is derived.
/// It takes no user-, environment-, or config-derived input of any kind —
/// [`CryptoPipeline::new_placeholder`] accepts only a [`CryptoPipelineKind`]
/// label. This module does not connect to `secret_handle` (Stage 79),
/// `aead_core` (Stage 80), `kdf_core` (Stage 82), `key_material` (Stage 87),
/// `domain_label` (Stage 88), `operation_context` (Stage 89),
/// `request_descriptor` (Stage 90), or `response_descriptor` (Stage 91): it
/// never constructs any of their types and never reads a key/secret/label/
/// operation/request/response byte out of one — when in doubt about a
/// connection between skeletons, this crate deliberately leaves them
/// unconnected rather than guess at a future design (the same reasoning
/// `aead_core`'s own doc comment already states). It exists as a type basis
/// a later, explicitly-reviewed stage can extend to actually bundle the
/// descriptor/context/label/key-material skeletons above into a real
/// AEAD/KDF/NIP-44/Nostr-key-derivation pipeline, once it also implements
/// the operation that pipeline would run.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle`/
/// `aead_core`/`kdf_core`/`key_material`/`domain_label`/`operation_context`/
/// `request_descriptor`/`response_descriptor` above do. This is expected
/// for a skeleton not yet wired to any consumer.
#[allow(dead_code)]
mod crypto_pipeline {
    /// Coarse internal lifecycle state of a [`CryptoPipeline`].
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum CryptoPipelineState {
        /// A placeholder pipeline is active. Runs no cryptography and
        /// bundles no descriptor.
        Placeholder,
        /// No pipeline should be treated as active — the default, inert
        /// state before any [`CryptoPipeline`] is constructed for use.
        Disabled,
    }

    impl Default for CryptoPipelineState {
        fn default() -> Self {
            CryptoPipelineState::Disabled
        }
    }

    /// Which future cryptographic PIPELINE a [`CryptoPipeline`] names — a
    /// label only, intent, not an implementation and not a real bundling of
    /// descriptors. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum CryptoPipelineKind {
        /// Intended future connection point: an AEAD encrypt/decrypt
        /// pipeline. No AEAD pipeline is bundled here.
        AeadPipelinePlaceholder,
        /// Intended future connection point: an HKDF extract/expand
        /// pipeline. No KDF pipeline is bundled here.
        KdfPipelinePlaceholder,
        /// Intended future connection point: an Argon2id hashing pipeline.
        /// No Argon2id pipeline is bundled here.
        Argon2idPipelinePlaceholder,
        /// Intended future connection point: a NIP-44 encrypt/decrypt
        /// pipeline. No NIP-44 pipeline is bundled here.
        Nip44PipelinePlaceholder,
        /// Intended future connection point: a Nostr identity/signing key
        /// derivation pipeline. No Nostr key pipeline is bundled here.
        NostrKeyPipelinePlaceholder,
        /// Reserved for this module's own tests / future test-only
        /// fixtures — never used by production code paths.
        TestOnlyPipelinePlaceholder,
    }

    /// A non-sensitive status snapshot for a [`CryptoPipeline`].
    /// Crate-private only. Never contains a key/seed/plaintext/ciphertext/
    /// passphrase/tag/nonce byte.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct CryptoPipelineStatus {
        pub(crate) state: CryptoPipelineState,
    }

    /// An INTERNAL-ONLY crypto-pipeline handle skeleton (crate-private; not
    /// part of this crate's public API — see the module-level doc comment
    /// above). Holds only a [`CryptoPipelineKind`] label and a
    /// [`CryptoPipelineState`] — no key, seed, plaintext, ciphertext,
    /// passphrase, tag, or nonce byte, and no user-, environment-, or
    /// config-derived input, and no bundled descriptor of any kind. A
    /// future, explicitly-reviewed stage may extend this skeleton to
    /// actually bundle a real pipeline; until then it accepts and stores
    /// none.
    pub(crate) struct CryptoPipeline {
        kind: CryptoPipelineKind,
        state: CryptoPipelineState,
    }

    impl CryptoPipeline {
        /// Construct a placeholder pipeline of the given
        /// [`CryptoPipelineKind`]. Takes NO user-, environment-, or
        /// config-derived input of any kind, and bundles no descriptor of
        /// any kind — `kind` is a label only.
        pub(crate) fn new_placeholder(kind: CryptoPipelineKind) -> Self {
            Self {
                kind,
                state: CryptoPipelineState::Placeholder,
            }
        }

        /// The [`CryptoPipelineKind`] label this pipeline was constructed
        /// with — intent only.
        pub(crate) fn kind(&self) -> CryptoPipelineKind {
            self.kind
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> CryptoPipelineStatus {
            CryptoPipelineStatus { state: self.state }
        }

        /// Whether this pipeline is still in the
        /// [`CryptoPipelineState::Placeholder`] state — always `true` for
        /// any handle constructed via [`CryptoPipeline::new_placeholder`],
        /// since no other constructor exists.
        pub(crate) fn is_placeholder(&self) -> bool {
            self.state == CryptoPipelineState::Placeholder
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let pipeline = CryptoPipeline::new_placeholder(CryptoPipelineKind::AeadPipelinePlaceholder);
            assert_eq!(pipeline.status().state, CryptoPipelineState::Placeholder);
            assert!(pipeline.is_placeholder());
        }

        #[test]
        fn kind_reports_the_constructed_placeholder_kind_only() {
            for kind in [
                CryptoPipelineKind::AeadPipelinePlaceholder,
                CryptoPipelineKind::KdfPipelinePlaceholder,
                CryptoPipelineKind::Argon2idPipelinePlaceholder,
                CryptoPipelineKind::Nip44PipelinePlaceholder,
                CryptoPipelineKind::NostrKeyPipelinePlaceholder,
                CryptoPipelineKind::TestOnlyPipelinePlaceholder,
            ] {
                let pipeline = CryptoPipeline::new_placeholder(kind);
                assert_eq!(pipeline.kind(), kind);
                assert_eq!(pipeline.status().state, CryptoPipelineState::Placeholder);
            }
        }

        #[test]
        fn status_reports_placeholder_state_only_no_secret_bytes() {
            let pipeline = CryptoPipeline::new_placeholder(CryptoPipelineKind::KdfPipelinePlaceholder);
            let status = pipeline.status();
            assert_eq!(status.state, CryptoPipelineState::Placeholder);
        }

        #[test]
        fn is_placeholder_is_true_for_every_constructed_pipeline() {
            for kind in [
                CryptoPipelineKind::Argon2idPipelinePlaceholder,
                CryptoPipelineKind::Nip44PipelinePlaceholder,
                CryptoPipelineKind::TestOnlyPipelinePlaceholder,
            ] {
                assert!(CryptoPipeline::new_placeholder(kind).is_placeholder());
            }
        }

        #[test]
        fn disabled_state_is_the_default_placeholder_only_state() {
            assert_eq!(CryptoPipelineState::default(), CryptoPipelineState::Disabled);
        }
    }
}

/// Stage 93 — an INTERNAL-ONLY descriptor-bundle skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns a
/// [`DescriptorBundle`].
///
/// This module holds NO real key, seed, plaintext, ciphertext, passphrase,
/// tag, or nonce byte — there is no borrowed-byte-slice, `Vec<u8>`, or
/// `String` field or parameter anywhere below, and no AEAD/HKDF/Argon2/
/// NIP-44 operation is implemented or called, and no Nostr key is derived.
/// It takes no user-, environment-, or config-derived input of any kind —
/// [`DescriptorBundle::new_placeholder`] accepts only a
/// [`DescriptorBundleKind`] label. Unlike a future real bundle, this
/// skeleton does NOT hold an instance of any other skeleton type: it does
/// not connect to `secret_handle` (Stage 79), `aead_core` (Stage 80),
/// `kdf_core` (Stage 82), `key_material` (Stage 87), `domain_label` (Stage
/// 88), `operation_context` (Stage 89), `request_descriptor` (Stage 90),
/// `response_descriptor` (Stage 91), or `crypto_pipeline` (Stage 92) — it
/// never constructs, stores, or reads a field of any of their types — when
/// in doubt about a connection between skeletons, this crate deliberately
/// leaves them unconnected rather than guess at a future design (the same
/// reasoning `aead_core`'s own doc comment already states). It exists as a
/// fully independent, label-only type basis a later, explicitly-reviewed
/// stage can extend to actually group the descriptor/context/label/
/// key-material skeletons above into a real bundle, once it also
/// implements the operation that bundle would support.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle`/
/// `aead_core`/`kdf_core`/`key_material`/`domain_label`/`operation_context`/
/// `request_descriptor`/`response_descriptor`/`crypto_pipeline` above do.
/// This is expected for a skeleton not yet wired to any consumer.
#[allow(dead_code)]
mod descriptor_bundle {
    /// Coarse internal lifecycle state of a [`DescriptorBundle`].
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum DescriptorBundleState {
        /// A placeholder bundle is active. Groups no real descriptor; runs
        /// no cryptography.
        Placeholder,
        /// No bundle should be treated as active — the default, inert
        /// state before any [`DescriptorBundle`] is constructed for use.
        Disabled,
    }

    impl Default for DescriptorBundleState {
        fn default() -> Self {
            DescriptorBundleState::Disabled
        }
    }

    /// Which future cryptographic BUNDLE a [`DescriptorBundle`] names — a
    /// label only, intent, not an implementation and not a real grouping of
    /// descriptors. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum DescriptorBundleKind {
        /// Intended future connection point: an AEAD request/response
        /// bundle. No AEAD bundle is grouped here.
        AeadBundlePlaceholder,
        /// Intended future connection point: an HKDF request/response
        /// bundle. No KDF bundle is grouped here.
        KdfBundlePlaceholder,
        /// Intended future connection point: an Argon2id request/response
        /// bundle. No Argon2id bundle is grouped here.
        Argon2idBundlePlaceholder,
        /// Intended future connection point: a NIP-44 request/response
        /// bundle. No NIP-44 bundle is grouped here.
        Nip44BundlePlaceholder,
        /// Intended future connection point: a Nostr identity/signing key
        /// derivation bundle. No Nostr key bundle is grouped here.
        NostrKeyBundlePlaceholder,
        /// Reserved for this module's own tests / future test-only
        /// fixtures — never used by production code paths.
        TestOnlyBundlePlaceholder,
    }

    /// A non-sensitive status snapshot for a [`DescriptorBundle`].
    /// Crate-private only. Never contains a key/seed/plaintext/ciphertext/
    /// passphrase/tag/nonce byte.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct DescriptorBundleStatus {
        pub(crate) state: DescriptorBundleState,
    }

    /// An INTERNAL-ONLY descriptor-bundle handle skeleton (crate-private;
    /// not part of this crate's public API — see the module-level doc
    /// comment above). Holds only a [`DescriptorBundleKind`] label and a
    /// [`DescriptorBundleState`] — no key, seed, plaintext, ciphertext,
    /// passphrase, tag, or nonce byte, no user-, environment-, or
    /// config-derived input, and no field of any other skeleton's type
    /// from `secret_handle`, `aead_core`, `kdf_core`, `key_material`,
    /// `domain_label`, `operation_context`, `request_descriptor`,
    /// `response_descriptor`, or `crypto_pipeline`. A future,
    /// explicitly-reviewed stage may extend this skeleton to actually
    /// group a real bundle; until then it accepts and stores none.
    pub(crate) struct DescriptorBundle {
        kind: DescriptorBundleKind,
        state: DescriptorBundleState,
    }

    impl DescriptorBundle {
        /// Construct a placeholder bundle of the given
        /// [`DescriptorBundleKind`]. Takes NO user-, environment-, or
        /// config-derived input of any kind, and groups no descriptor of
        /// any kind — `kind` is a label only.
        pub(crate) fn new_placeholder(kind: DescriptorBundleKind) -> Self {
            Self {
                kind,
                state: DescriptorBundleState::Placeholder,
            }
        }

        /// The [`DescriptorBundleKind`] label this bundle was constructed
        /// with — intent only.
        pub(crate) fn kind(&self) -> DescriptorBundleKind {
            self.kind
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> DescriptorBundleStatus {
            DescriptorBundleStatus { state: self.state }
        }

        /// Whether this bundle is still in the
        /// [`DescriptorBundleState::Placeholder`] state — always `true` for
        /// any handle constructed via [`DescriptorBundle::new_placeholder`],
        /// since no other constructor exists.
        pub(crate) fn is_placeholder(&self) -> bool {
            self.state == DescriptorBundleState::Placeholder
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let bundle = DescriptorBundle::new_placeholder(DescriptorBundleKind::AeadBundlePlaceholder);
            assert_eq!(bundle.status().state, DescriptorBundleState::Placeholder);
            assert!(bundle.is_placeholder());
        }

        #[test]
        fn kind_reports_the_constructed_placeholder_kind_only() {
            for kind in [
                DescriptorBundleKind::AeadBundlePlaceholder,
                DescriptorBundleKind::KdfBundlePlaceholder,
                DescriptorBundleKind::Argon2idBundlePlaceholder,
                DescriptorBundleKind::Nip44BundlePlaceholder,
                DescriptorBundleKind::NostrKeyBundlePlaceholder,
                DescriptorBundleKind::TestOnlyBundlePlaceholder,
            ] {
                let bundle = DescriptorBundle::new_placeholder(kind);
                assert_eq!(bundle.kind(), kind);
                assert_eq!(bundle.status().state, DescriptorBundleState::Placeholder);
            }
        }

        #[test]
        fn status_reports_placeholder_state_only_no_secret_bytes() {
            let bundle = DescriptorBundle::new_placeholder(DescriptorBundleKind::KdfBundlePlaceholder);
            let status = bundle.status();
            assert_eq!(status.state, DescriptorBundleState::Placeholder);
        }

        #[test]
        fn is_placeholder_is_true_for_every_constructed_bundle() {
            for kind in [
                DescriptorBundleKind::Argon2idBundlePlaceholder,
                DescriptorBundleKind::Nip44BundlePlaceholder,
                DescriptorBundleKind::TestOnlyBundlePlaceholder,
            ] {
                assert!(DescriptorBundle::new_placeholder(kind).is_placeholder());
            }
        }

        #[test]
        fn disabled_state_is_the_default_placeholder_only_state() {
            assert_eq!(
                DescriptorBundleState::default(),
                DescriptorBundleState::Disabled
            );
        }
    }
}

/// Stage 94 — an INTERNAL-ONLY execution-plan skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns an [`ExecutionPlan`].
///
/// This module holds NO real key, seed, plaintext, ciphertext, passphrase,
/// tag, or nonce byte — there is no borrowed-byte-slice, `Vec<u8>`, or
/// `String` field or parameter anywhere below, and no AEAD/HKDF/Argon2/
/// NIP-44 operation is implemented or called, and no Nostr key is derived.
/// It takes no user-, environment-, or config-derived input of any kind —
/// [`ExecutionPlan::new_placeholder`] accepts only an [`ExecutionPlanKind`]
/// label. [`ExecutionPlan::step_count`] returns a fixed, non-secret
/// `usize` chosen by a `match` — never a runtime-computed length, never a
/// growable, heap-allocated collection of [`ExecutionStepKind`] values or
/// any other dynamically-sized collection. This
/// module does NOT hold an instance of any other skeleton type: it does
/// not connect to `secret_handle` (Stage 79), `aead_core` (Stage 80),
/// `kdf_core` (Stage 82), `key_material` (Stage 87), `domain_label` (Stage
/// 88), `operation_context` (Stage 89), `request_descriptor` (Stage 90),
/// `response_descriptor` (Stage 91), `crypto_pipeline` (Stage 92), or
/// `descriptor_bundle` (Stage 93) — it never constructs, stores, or reads a
/// field of any of their types — when in doubt about a connection between
/// skeletons, this crate deliberately leaves them unconnected rather than
/// guess at a future design (the same reasoning `aead_core`'s own doc
/// comment already states). It exists as a fully independent, label-only
/// type basis a later, explicitly-reviewed stage can extend to actually
/// order a real AEAD/KDF/NIP-44/Nostr-key-derivation execution, once it
/// also implements the operation that plan would run.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle`/
/// `aead_core`/`kdf_core`/`key_material`/`domain_label`/`operation_context`/
/// `request_descriptor`/`response_descriptor`/`crypto_pipeline`/
/// `descriptor_bundle` above do. This is expected for a skeleton not yet
/// wired to any consumer.
#[allow(dead_code)]
mod execution_plan {
    /// Coarse internal lifecycle state of an [`ExecutionPlan`].
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum ExecutionPlanState {
        /// A placeholder plan is active. Runs no cryptography and orders
        /// no real step.
        Placeholder,
        /// No plan should be treated as active — the default, inert state
        /// before any [`ExecutionPlan`] is constructed for use.
        Disabled,
    }

    impl Default for ExecutionPlanState {
        fn default() -> Self {
            ExecutionPlanState::Disabled
        }
    }

    /// Which future cryptographic operation an [`ExecutionPlan`] would
    /// eventually order — a label only, intent, not an implementation and
    /// not a real processing order. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum ExecutionPlanKind {
        /// Intended future connection point: an AEAD encrypt/decrypt plan.
        /// No AEAD plan is ordered here.
        AeadPlanPlaceholder,
        /// Intended future connection point: an HKDF extract/expand plan.
        /// No KDF plan is ordered here.
        KdfPlanPlaceholder,
        /// Intended future connection point: an Argon2id hashing plan. No
        /// Argon2id plan is ordered here.
        Argon2idPlanPlaceholder,
        /// Intended future connection point: a NIP-44 encrypt/decrypt
        /// plan. No NIP-44 plan is ordered here.
        Nip44PlanPlaceholder,
        /// Intended future connection point: a Nostr identity/signing key
        /// derivation plan. No Nostr key plan is ordered here.
        NostrKeyPlanPlaceholder,
        /// Reserved for this module's own tests / future test-only
        /// fixtures — never used by production code paths.
        TestOnlyPlanPlaceholder,
    }

    /// A single named step a future real [`ExecutionPlan`] would order —
    /// a label only, intent, not an implementation. Crate-private only.
    /// This crate's canonical six-step placeholder sequence, in the order
    /// a future real plan would eventually run them (still not ordered or
    /// executed by anything in this module today).
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum ExecutionStepKind {
        /// Intended future step: validate a request descriptor's shape.
        ValidateRequestPlaceholder,
        /// Intended future step: resolve a domain-separation label.
        ResolveDomainPlaceholder,
        /// Intended future step: resolve key material for the operation.
        ResolveKeyMaterialPlaceholder,
        /// Intended future step: execute the underlying cryptographic
        /// primitive.
        ExecutePrimitivePlaceholder,
        /// Intended future step: build a response descriptor from the
        /// primitive's result.
        BuildResponsePlaceholder,
        /// Intended future step: clear any temporary state used along the
        /// way.
        ClearTemporaryStatePlaceholder,
    }

    /// A non-sensitive status snapshot for an [`ExecutionPlan`].
    /// Crate-private only. Never contains a key/seed/plaintext/ciphertext/
    /// passphrase/tag/nonce byte.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct ExecutionPlanStatus {
        pub(crate) state: ExecutionPlanState,
    }

    /// An INTERNAL-ONLY execution-plan handle skeleton (crate-private; not
    /// part of this crate's public API — see the module-level doc comment
    /// above). Holds only an [`ExecutionPlanKind`] label and an
    /// [`ExecutionPlanState`] — no key, seed, plaintext, ciphertext,
    /// passphrase, tag, or nonce byte, no user-, environment-, or
    /// config-derived input, and no field of any other skeleton's type
    /// from `secret_handle`, `aead_core`, `kdf_core`, `key_material`,
    /// `domain_label`, `operation_context`, `request_descriptor`,
    /// `response_descriptor`, `crypto_pipeline`, or `descriptor_bundle`. A
    /// future, explicitly-reviewed stage may extend this skeleton to
    /// actually order a real plan; until then it accepts and stores none.
    pub(crate) struct ExecutionPlan {
        kind: ExecutionPlanKind,
        state: ExecutionPlanState,
    }

    impl ExecutionPlan {
        /// Construct a placeholder plan of the given [`ExecutionPlanKind`].
        /// Takes NO user-, environment-, or config-derived input of any
        /// kind, and orders no step of any kind — `kind` is a label only.
        pub(crate) fn new_placeholder(kind: ExecutionPlanKind) -> Self {
            Self {
                kind,
                state: ExecutionPlanState::Placeholder,
            }
        }

        /// The [`ExecutionPlanKind`] label this plan was constructed with
        /// — intent only.
        pub(crate) fn kind(&self) -> ExecutionPlanKind {
            self.kind
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> ExecutionPlanStatus {
            ExecutionPlanStatus { state: self.state }
        }

        /// Whether this plan is still in the
        /// [`ExecutionPlanState::Placeholder`] state — always `true` for
        /// any handle constructed via [`ExecutionPlan::new_placeholder`],
        /// since no other constructor exists.
        pub(crate) fn is_placeholder(&self) -> bool {
            self.state == ExecutionPlanState::Placeholder
        }

        /// A fixed, non-secret step count for this plan's
        /// [`ExecutionPlanKind`] — this crate's canonical six-step
        /// placeholder sequence ([`ExecutionStepKind`]'s six variants),
        /// chosen by a `match`, never computed from a growable,
        /// heap-allocated collection (none exists anywhere in this
        /// module).
        pub(crate) fn step_count(&self) -> usize {
            match self.kind {
                ExecutionPlanKind::AeadPlanPlaceholder => 6,
                ExecutionPlanKind::KdfPlanPlaceholder => 6,
                ExecutionPlanKind::Argon2idPlanPlaceholder => 6,
                ExecutionPlanKind::Nip44PlanPlaceholder => 6,
                ExecutionPlanKind::NostrKeyPlanPlaceholder => 6,
                ExecutionPlanKind::TestOnlyPlanPlaceholder => 6,
            }
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let plan = ExecutionPlan::new_placeholder(ExecutionPlanKind::AeadPlanPlaceholder);
            assert_eq!(plan.status().state, ExecutionPlanState::Placeholder);
            assert!(plan.is_placeholder());
        }

        #[test]
        fn kind_reports_the_constructed_placeholder_kind_only() {
            for kind in [
                ExecutionPlanKind::AeadPlanPlaceholder,
                ExecutionPlanKind::KdfPlanPlaceholder,
                ExecutionPlanKind::Argon2idPlanPlaceholder,
                ExecutionPlanKind::Nip44PlanPlaceholder,
                ExecutionPlanKind::NostrKeyPlanPlaceholder,
                ExecutionPlanKind::TestOnlyPlanPlaceholder,
            ] {
                let plan = ExecutionPlan::new_placeholder(kind);
                assert_eq!(plan.kind(), kind);
                assert_eq!(plan.status().state, ExecutionPlanState::Placeholder);
            }
        }

        #[test]
        fn status_reports_placeholder_state_only_no_secret_bytes() {
            let plan = ExecutionPlan::new_placeholder(ExecutionPlanKind::KdfPlanPlaceholder);
            let status = plan.status();
            assert_eq!(status.state, ExecutionPlanState::Placeholder);
        }

        #[test]
        fn is_placeholder_is_true_for_every_constructed_plan() {
            for kind in [
                ExecutionPlanKind::Argon2idPlanPlaceholder,
                ExecutionPlanKind::Nip44PlanPlaceholder,
                ExecutionPlanKind::TestOnlyPlanPlaceholder,
            ] {
                assert!(ExecutionPlan::new_placeholder(kind).is_placeholder());
            }
        }

        #[test]
        fn step_count_is_the_fixed_six_step_placeholder_sequence_for_every_kind() {
            for kind in [
                ExecutionPlanKind::AeadPlanPlaceholder,
                ExecutionPlanKind::KdfPlanPlaceholder,
                ExecutionPlanKind::Argon2idPlanPlaceholder,
                ExecutionPlanKind::Nip44PlanPlaceholder,
                ExecutionPlanKind::NostrKeyPlanPlaceholder,
                ExecutionPlanKind::TestOnlyPlanPlaceholder,
            ] {
                assert_eq!(ExecutionPlan::new_placeholder(kind).step_count(), 6);
            }
        }

        #[test]
        fn disabled_state_is_the_default_placeholder_only_state() {
            assert_eq!(
                ExecutionPlanState::default(),
                ExecutionPlanState::Disabled
            );
        }
    }
}

/// Stage 95 — an INTERNAL-ONLY error-taxonomy skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns a
/// [`CryptoErrorDescriptor`].
///
/// This module holds NO real key, seed, plaintext, ciphertext, passphrase,
/// tag, or nonce byte — there is no borrowed-byte-slice, `Vec<u8>`, or
/// `String` field or parameter anywhere below, and no AEAD/HKDF/Argon2/
/// NIP-44 operation is implemented or called, and no Nostr key is derived.
/// It holds no textual explanation of any failure, no wrapped underlying
/// error value, and no captured call-stack information of any kind — only
/// a fixed [`CryptoErrorKind`] label. It takes no user-, environment-, or
/// config-derived input of any kind —
/// [`CryptoErrorDescriptor::new_placeholder`] accepts only a
/// [`CryptoErrorKind`] label. This module does NOT hold an instance of any
/// other skeleton type: it does not connect to `secret_handle` (Stage 79),
/// `aead_core` (Stage 80), `kdf_core` (Stage 82), `key_material` (Stage
/// 87), `domain_label` (Stage 88), `operation_context` (Stage 89),
/// `request_descriptor` (Stage 90), `response_descriptor` (Stage 91),
/// `crypto_pipeline` (Stage 92), `descriptor_bundle` (Stage 93), or
/// `execution_plan` (Stage 94) — it never constructs, stores, or reads a
/// field of any of their types — when in doubt about a connection between
/// skeletons, this crate deliberately leaves them unconnected rather than
/// guess at a future design (the same reasoning `aead_core`'s own doc
/// comment already states). It exists as a fully independent, label-only
/// type basis a later, explicitly-reviewed stage can extend to actually
/// classify a real AEAD/KDF/NIP-44/Nostr-key-derivation failure, once it
/// also implements the operation that failure would come from.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle`/
/// `aead_core`/`kdf_core`/`key_material`/`domain_label`/`operation_context`/
/// `request_descriptor`/`response_descriptor`/`crypto_pipeline`/
/// `descriptor_bundle`/`execution_plan` above do. This is expected for a
/// skeleton not yet wired to any consumer.
#[allow(dead_code)]
mod error_taxonomy {
    /// Coarse internal lifecycle state of a [`CryptoErrorDescriptor`].
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum CryptoErrorState {
        /// A placeholder error descriptor is active. Classifies no real
        /// failure; runs no cryptography.
        Placeholder,
        /// No error descriptor should be treated as active — the default,
        /// inert state before any [`CryptoErrorDescriptor`] is constructed
        /// for use.
        Disabled,
    }

    impl Default for CryptoErrorState {
        fn default() -> Self {
            CryptoErrorState::Disabled
        }
    }

    /// Which future cryptographic operation FAILURE a
    /// [`CryptoErrorDescriptor`] names — a label only, intent, not an
    /// implementation and not a real failure explanation. Crate-private
    /// only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum CryptoErrorKind {
        /// Intended future connection point: an AEAD seal/open failure.
        /// No AEAD failure is classified here.
        AeadFailurePlaceholder,
        /// Intended future connection point: an HKDF extract/expand
        /// failure. No KDF failure is classified here.
        KdfFailurePlaceholder,
        /// Intended future connection point: an Argon2id hashing failure.
        /// No Argon2id failure is classified here.
        Argon2idFailurePlaceholder,
        /// Intended future connection point: a NIP-44 encrypt/decrypt
        /// failure. No NIP-44 failure is classified here.
        Nip44FailurePlaceholder,
        /// Intended future connection point: a Nostr identity/signing key
        /// derivation failure. No Nostr key failure is classified here.
        NostrKeyFailurePlaceholder,
        /// Intended future connection point: an invalid request shape (a
        /// future request descriptor rejected before any primitive runs).
        InvalidRequestPlaceholder,
        /// Intended future connection point: a requested operation kind
        /// with no supporting implementation yet.
        UnsupportedOperationPlaceholder,
        /// Intended future connection point: this crate's own internal
        /// invariant violated (a bug, not caller input).
        InternalInvariantPlaceholder,
        /// Reserved for this module's own tests / future test-only
        /// fixtures — never used by production code paths.
        TestOnlyFailurePlaceholder,
    }

    /// A non-sensitive status snapshot for a [`CryptoErrorDescriptor`].
    /// Crate-private only. Never contains a key/seed/plaintext/ciphertext/
    /// passphrase/tag/nonce byte, and never a failure explanation.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct CryptoErrorStatus {
        pub(crate) state: CryptoErrorState,
    }

    /// An INTERNAL-ONLY error-taxonomy handle skeleton (crate-private; not
    /// part of this crate's public API — see the module-level doc comment
    /// above). Holds only a [`CryptoErrorKind`] label and a
    /// [`CryptoErrorState`] — no key, seed, plaintext, ciphertext,
    /// passphrase, tag, or nonce byte, no user-, environment-, or
    /// config-derived input, no textual explanation of any failure, no
    /// wrapped underlying error value, no captured call-stack information,
    /// and no field of any other skeleton's type from `secret_handle`,
    /// `aead_core`, `kdf_core`, `key_material`, `domain_label`,
    /// `operation_context`, `request_descriptor`, `response_descriptor`,
    /// `crypto_pipeline`, `descriptor_bundle`, or `execution_plan`. A
    /// future, explicitly-reviewed stage may extend this skeleton to
    /// actually classify a real failure; until then it accepts and stores
    /// none.
    pub(crate) struct CryptoErrorDescriptor {
        kind: CryptoErrorKind,
        state: CryptoErrorState,
    }

    impl CryptoErrorDescriptor {
        /// Construct a placeholder error descriptor of the given
        /// [`CryptoErrorKind`]. Takes NO user-, environment-, or
        /// config-derived input of any kind, and classifies no real
        /// failure of any kind — `kind` is a label only.
        pub(crate) fn new_placeholder(kind: CryptoErrorKind) -> Self {
            Self {
                kind,
                state: CryptoErrorState::Placeholder,
            }
        }

        /// The [`CryptoErrorKind`] label this descriptor was constructed
        /// with — intent only.
        pub(crate) fn kind(&self) -> CryptoErrorKind {
            self.kind
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> CryptoErrorStatus {
            CryptoErrorStatus { state: self.state }
        }

        /// Whether this descriptor is still in the
        /// [`CryptoErrorState::Placeholder`] state — always `true` for any
        /// handle constructed via
        /// [`CryptoErrorDescriptor::new_placeholder`], since no other
        /// constructor exists.
        pub(crate) fn is_placeholder(&self) -> bool {
            self.state == CryptoErrorState::Placeholder
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let descriptor =
                CryptoErrorDescriptor::new_placeholder(CryptoErrorKind::AeadFailurePlaceholder);
            assert_eq!(descriptor.status().state, CryptoErrorState::Placeholder);
            assert!(descriptor.is_placeholder());
        }

        #[test]
        fn kind_reports_the_constructed_placeholder_kind_only() {
            for kind in [
                CryptoErrorKind::AeadFailurePlaceholder,
                CryptoErrorKind::KdfFailurePlaceholder,
                CryptoErrorKind::Argon2idFailurePlaceholder,
                CryptoErrorKind::Nip44FailurePlaceholder,
                CryptoErrorKind::NostrKeyFailurePlaceholder,
                CryptoErrorKind::InvalidRequestPlaceholder,
                CryptoErrorKind::UnsupportedOperationPlaceholder,
                CryptoErrorKind::InternalInvariantPlaceholder,
                CryptoErrorKind::TestOnlyFailurePlaceholder,
            ] {
                let descriptor = CryptoErrorDescriptor::new_placeholder(kind);
                assert_eq!(descriptor.kind(), kind);
                assert_eq!(descriptor.status().state, CryptoErrorState::Placeholder);
            }
        }

        #[test]
        fn status_reports_placeholder_state_only_no_secret_bytes() {
            let descriptor =
                CryptoErrorDescriptor::new_placeholder(CryptoErrorKind::KdfFailurePlaceholder);
            let status = descriptor.status();
            assert_eq!(status.state, CryptoErrorState::Placeholder);
        }

        #[test]
        fn is_placeholder_is_true_for_every_constructed_descriptor() {
            for kind in [
                CryptoErrorKind::Argon2idFailurePlaceholder,
                CryptoErrorKind::Nip44FailurePlaceholder,
                CryptoErrorKind::TestOnlyFailurePlaceholder,
            ] {
                assert!(CryptoErrorDescriptor::new_placeholder(kind).is_placeholder());
            }
        }

        #[test]
        fn disabled_state_is_the_default_placeholder_only_state() {
            assert_eq!(CryptoErrorState::default(), CryptoErrorState::Disabled);
        }
    }
}

/// Stage 96 — an INTERNAL-ONLY audit-event-label skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns an
/// [`AuditEventLabel`].
///
/// This module holds NO real key, seed, plaintext, ciphertext, passphrase,
/// tag, or nonce byte — there is no borrowed-byte-slice, `Vec<u8>`, or
/// `String` field or parameter anywhere below, and no AEAD/HKDF/Argon2/
/// NIP-44 operation is implemented or called, and no Nostr key is derived.
/// It holds no event payload of any kind — only a fixed [`AuditEventKind`]
/// label. Nothing in this module writes to stdout, stderr, or any log
/// sink: there is no macro call that would emit a line anywhere below,
/// and no observability crate is imported. It takes no user-,
/// environment-, or config-derived input of any kind —
/// [`AuditEventLabel::new_placeholder`] accepts only an [`AuditEventKind`]
/// label. This module does NOT hold an instance of any other skeleton
/// type: it does not connect to `secret_handle` (Stage 79), `aead_core`
/// (Stage 80), `kdf_core` (Stage 82), `key_material` (Stage 87),
/// `domain_label` (Stage 88), `operation_context` (Stage 89),
/// `request_descriptor` (Stage 90), `response_descriptor` (Stage 91),
/// `crypto_pipeline` (Stage 92), `descriptor_bundle` (Stage 93),
/// `execution_plan` (Stage 94), or `error_taxonomy` (Stage 95) — it never
/// constructs, stores, or reads a field of any of their types — when in
/// doubt about a connection between skeletons, this crate deliberately
/// leaves them unconnected rather than guess at a future design (the same
/// reasoning `aead_core`'s own doc comment already states). It exists as a
/// fully independent, label-only type basis a later, explicitly-reviewed
/// stage can extend to actually observe a real crypto-internal state
/// change, once it also implements the observability mechanism (and
/// policy) that event would feed.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle`/
/// `aead_core`/`kdf_core`/`key_material`/`domain_label`/`operation_context`/
/// `request_descriptor`/`response_descriptor`/`crypto_pipeline`/
/// `descriptor_bundle`/`execution_plan`/`error_taxonomy` above do. This is
/// expected for a skeleton not yet wired to any consumer.
#[allow(dead_code)]
mod audit_event {
    /// Coarse internal lifecycle state of an [`AuditEventLabel`].
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum AuditEventState {
        /// A placeholder audit-event label is active. Observes no real
        /// state change; emits no output.
        Placeholder,
        /// No audit-event label should be treated as active — the
        /// default, inert state before any [`AuditEventLabel`] is
        /// constructed for use.
        Disabled,
    }

    impl Default for AuditEventState {
        fn default() -> Self {
            AuditEventState::Disabled
        }
    }

    /// Which future crypto-internal state change an [`AuditEventLabel`]
    /// names — a label only, intent, not an implementation and not a real
    /// observation. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum AuditEventKind {
        /// Intended future connection point: a `CryptoProvider`
        /// implementation was selected. No selection is observed here.
        CryptoProviderSelectedPlaceholder,
        /// Intended future connection point: an incoming request was
        /// accepted. No acceptance is observed here.
        RequestAcceptedPlaceholder,
        /// Intended future connection point: an incoming request was
        /// rejected. No rejection is observed here.
        RequestRejectedPlaceholder,
        /// Intended future connection point: an execution plan was
        /// prepared. No preparation is observed here.
        PlanPreparedPlaceholder,
        /// Intended future connection point: an underlying cryptographic
        /// primitive was executed. No execution is observed here.
        PrimitiveExecutedPlaceholder,
        /// Intended future connection point: a response was built. No
        /// build is observed here.
        ResponseBuiltPlaceholder,
        /// Intended future connection point: a secret was cleared. No
        /// clearing is observed here.
        SecretClearedPlaceholder,
        /// Intended future connection point: a failure was classified
        /// (see `error_taxonomy`, Stage 95). No classification is
        /// observed here.
        ErrorClassifiedPlaceholder,
        /// Reserved for this module's own tests / future test-only
        /// fixtures — never used by production code paths.
        TestOnlyPlaceholder,
    }

    /// A non-sensitive status snapshot for an [`AuditEventLabel`].
    /// Crate-private only. Never contains a key/seed/plaintext/ciphertext/
    /// passphrase/tag/nonce byte, and never an event payload.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct AuditEventStatus {
        pub(crate) state: AuditEventState,
    }

    /// An INTERNAL-ONLY audit-event-label handle skeleton (crate-private;
    /// not part of this crate's public API — see the module-level doc
    /// comment above). Holds only an [`AuditEventKind`] label and an
    /// [`AuditEventState`] — no key, seed, plaintext, ciphertext,
    /// passphrase, tag, or nonce byte, no user-, environment-, or
    /// config-derived input, no event payload of any kind, and no field
    /// of any other skeleton's type from `secret_handle`, `aead_core`,
    /// `kdf_core`, `key_material`, `domain_label`, `operation_context`,
    /// `request_descriptor`, `response_descriptor`, `crypto_pipeline`,
    /// `descriptor_bundle`, `execution_plan`, or `error_taxonomy`. A
    /// future, explicitly-reviewed stage may extend this skeleton to
    /// actually observe a real state change; until then it accepts and
    /// stores none, and emits no output of any kind.
    pub(crate) struct AuditEventLabel {
        kind: AuditEventKind,
        state: AuditEventState,
    }

    impl AuditEventLabel {
        /// Construct a placeholder audit-event label of the given
        /// [`AuditEventKind`]. Takes NO user-, environment-, or
        /// config-derived input of any kind, and observes no real state
        /// change of any kind — `kind` is a label only.
        pub(crate) fn new_placeholder(kind: AuditEventKind) -> Self {
            Self {
                kind,
                state: AuditEventState::Placeholder,
            }
        }

        /// The [`AuditEventKind`] label this handle was constructed with
        /// — intent only.
        pub(crate) fn kind(&self) -> AuditEventKind {
            self.kind
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> AuditEventStatus {
            AuditEventStatus { state: self.state }
        }

        /// Whether this label is still in the
        /// [`AuditEventState::Placeholder`] state — always `true` for any
        /// handle constructed via [`AuditEventLabel::new_placeholder`],
        /// since no other constructor exists.
        pub(crate) fn is_placeholder(&self) -> bool {
            self.state == AuditEventState::Placeholder
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let label =
                AuditEventLabel::new_placeholder(AuditEventKind::CryptoProviderSelectedPlaceholder);
            assert_eq!(label.status().state, AuditEventState::Placeholder);
            assert!(label.is_placeholder());
        }

        #[test]
        fn kind_reports_the_constructed_placeholder_kind_only() {
            for kind in [
                AuditEventKind::CryptoProviderSelectedPlaceholder,
                AuditEventKind::RequestAcceptedPlaceholder,
                AuditEventKind::RequestRejectedPlaceholder,
                AuditEventKind::PlanPreparedPlaceholder,
                AuditEventKind::PrimitiveExecutedPlaceholder,
                AuditEventKind::ResponseBuiltPlaceholder,
                AuditEventKind::SecretClearedPlaceholder,
                AuditEventKind::ErrorClassifiedPlaceholder,
                AuditEventKind::TestOnlyPlaceholder,
            ] {
                let label = AuditEventLabel::new_placeholder(kind);
                assert_eq!(label.kind(), kind);
                assert_eq!(label.status().state, AuditEventState::Placeholder);
            }
        }

        #[test]
        fn status_reports_placeholder_state_only_no_secret_bytes() {
            let label = AuditEventLabel::new_placeholder(AuditEventKind::RequestAcceptedPlaceholder);
            let status = label.status();
            assert_eq!(status.state, AuditEventState::Placeholder);
        }

        #[test]
        fn is_placeholder_is_true_for_every_constructed_label() {
            for kind in [
                AuditEventKind::SecretClearedPlaceholder,
                AuditEventKind::ErrorClassifiedPlaceholder,
                AuditEventKind::TestOnlyPlaceholder,
            ] {
                assert!(AuditEventLabel::new_placeholder(kind).is_placeholder());
            }
        }

        #[test]
        fn disabled_state_is_the_default_placeholder_only_state() {
            assert_eq!(AuditEventState::default(), AuditEventState::Disabled);
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

/// Stage 85 — RFC 9106 Argon2id known-answer verification, `#[cfg(test)]`
/// ONLY.
///
/// This module is not part of the crate's public API: it is compiled only
/// under `cargo test`, imports `argon2` (adopted as a production dependency
/// in Stage 84) purely to check that dependency against the official RFC
/// 9106 §5.3 Argon2id test vector, and implements no password-hashing/KDF
/// function that any other code — production or otherwise — can call.
/// `derive_key_placeholder` above is untouched.
///
/// Stage 86 extracts the Argon2id derivation logic that used to be written
/// as a per-vector helper into [`derive_argon2id_for_test`] — a private
/// `fn`, exists ONLY inside this `cfg(test)`-only module, takes raw
/// password/salt/secret/associatedData bytes plus the cost parameters
/// (mirroring the byte-level shape of Stage 81/83's
/// `seal_chacha20poly1305_for_test`/`extract_hkdf_sha256_for_test`), and is
/// NOT connected to the crate-private `kdf_core` skeleton (Stage 82) or
/// `secret_handle` (Stage 79) in any way. This is a test-only refactor: the
/// two vector tests below assert exactly the same things as before, just
/// calling the shared helper instead of building an `Argon2` inline.
#[cfg(test)]
mod rfc9106_vectors {
    use argon2::{Algorithm, Argon2, AssociatedData, Block, ParamsBuilder, Version};
    use serde::Deserialize;

    /// One vector entry. Only the fields this test needs are named; unknown
    /// JSON fields (`type`, `description`, `preHashingDigestH0`, `notes`,
    /// ...) are ignored by serde rather than mirrored here — `tag` (the
    /// final digest) is the only field RFC 9106 §5.3 publishes as a
    /// complete, independently-verifiable known-answer value (see the
    /// imported vector file's own `notes` field).
    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Vector {
        id: String,
        should_pass: bool,
        version: u32,
        #[serde(rename = "memoryKiB")]
        memory_kib: u32,
        iterations: u32,
        parallelism: u32,
        tag_length: usize,
        password: String,
        salt: String,
        secret: String,
        associated_data: String,
        tag: String,
    }

    #[derive(Debug, Deserialize)]
    struct VectorFile {
        vectors: Vec<Vector>,
    }

    /// The RFC 9106 vector file imported verbatim in Stage 73, read at
    /// compile time so this test has no filesystem/IO dependency at runtime.
    const RFC9106_JSON: &str =
        include_str!("../../../test-vectors/kdf/argon2id-rfc9106.json");

    fn decode_hex(field: &str, id: &str, value: &str) -> Vec<u8> {
        hex::decode(value).unwrap_or_else(|err| {
            panic!("{id}: invalid hex in field `{field}`: {err}")
        })
    }

    /// Test-only Argon2id derivation helper — private `fn`, exists ONLY
    /// under `cfg(test)`, never `pub`/`pub(crate)`. Takes raw
    /// password/salt/secret/associatedData bytes (all test-vector bytes,
    /// never a real passphrase) plus the Argon2id cost parameters, and
    /// returns the computed tag on success, or the underlying
    /// `argon2::Error` on failure (e.g. invalid parameters). Hardcodes
    /// `Version::V0x13` (0x13 = 19) — RFC 9106 §5.3's own test vector, the
    /// only one this crate imports — rather than taking a version
    /// parameter; a future re-import with a different version would need
    /// this updated (each vector's own `version` field is still checked
    /// against it below, in the tests). `memory_blocks` is allocated with
    /// this crate's own `std::vec` (NOT `argon2`'s optional `alloc`
    /// feature, which is deliberately not enabled — see the Cargo.toml
    /// comment above the `argon2` entry), so no additional `argon2` feature
    /// is required beyond the `default-features = false` configuration
    /// already adopted Stage 84.
    fn derive_argon2id_for_test(
        password_bytes: &[u8],
        salt_bytes: &[u8],
        secret_bytes: &[u8],
        associated_data_bytes: &[u8],
        memory_cost_kib: u32,
        time_cost: u32,
        parallelism: u32,
        output_len: usize,
    ) -> argon2::Result<Vec<u8>> {
        let mut builder = ParamsBuilder::new();
        builder
            .m_cost(memory_cost_kib)
            .t_cost(time_cost)
            .p_cost(parallelism)
            .output_len(output_len)
            .data(AssociatedData::new(associated_data_bytes)?);
        let params = builder.build()?;
        let block_count = params.block_count();

        let argon2 =
            Argon2::new_with_secret(secret_bytes, Algorithm::Argon2id, Version::V0x13, params)?;

        let mut memory_blocks = vec![Block::default(); block_count];
        let mut tag = vec![0u8; output_len];
        argon2.hash_password_into_with_memory(
            password_bytes,
            salt_bytes,
            &mut tag,
            &mut memory_blocks,
        )?;
        Ok(tag)
    }

    #[test]
    fn rfc9106_json_parses_and_is_non_empty() {
        let file: VectorFile =
            serde_json::from_str(RFC9106_JSON).expect("RFC 9106 vector JSON must parse");
        assert!(
            !file.vectors.is_empty(),
            "expected at least one RFC 9106 vector"
        );
    }

    /// `shouldPass=true` vectors: [`derive_argon2id_for_test`] must produce
    /// exactly the RFC's expected tag from the vector's
    /// password/salt/secret/associatedData/memoryKiB/iterations/parallelism/
    /// tagLength.
    #[test]
    fn rfc9106_positive_vectors_hash_correctly() {
        let file: VectorFile =
            serde_json::from_str(RFC9106_JSON).expect("RFC 9106 vector JSON must parse");

        let mut checked = 0usize;
        for vector in file.vectors.iter().filter(|v| v.should_pass) {
            assert_eq!(
                vector.version, 0x13,
                "{}: derive_argon2id_for_test hardcodes RFC 9106 §5.3's version (0x13); \
                 update it if a future vector uses a different one",
                vector.id
            );

            let password_bytes = decode_hex("password", &vector.id, &vector.password);
            let salt_bytes = decode_hex("salt", &vector.id, &vector.salt);
            let secret_bytes = decode_hex("secret", &vector.id, &vector.secret);
            let ad_bytes = decode_hex("associatedData", &vector.id, &vector.associated_data);
            let expected_tag = decode_hex("tag", &vector.id, &vector.tag);

            let tag = derive_argon2id_for_test(
                &password_bytes,
                &salt_bytes,
                &secret_bytes,
                &ad_bytes,
                vector.memory_kib,
                vector.iterations,
                vector.parallelism,
                vector.tag_length,
            )
            .unwrap_or_else(|err| panic!("{}: derive failed: {err}", vector.id));

            assert_eq!(
                tag, expected_tag,
                "{}: Argon2id tag did not match the RFC 9106 vector",
                vector.id
            );

            checked += 1;
        }
        assert!(
            checked > 0,
            "expected at least one shouldPass=true RFC 9106 vector to be checked"
        );
    }

    /// `shouldPass=false` vectors, if any exist in the imported file, must
    /// produce a tag that does NOT match whatever (necessarily incorrect)
    /// expected bytes the fixture carries. RFC 9106 §5.3 publishes only the
    /// single positive Argon2id conformance vector — no byte-level
    /// tamper/negative vector — and none is fabricated here (per
    /// docs/crypto_vector_sources.md §2's verbatim-only import rule) — so
    /// today this loop body runs zero times and the test trivially passes.
    /// It exists so that IF a future, explicitly-reviewed re-import of this
    /// file ever adds an official negative case, this test starts enforcing
    /// it with no further code change required.
    #[test]
    fn rfc9106_negative_vectors_do_not_match_if_present() {
        let file: VectorFile =
            serde_json::from_str(RFC9106_JSON).expect("RFC 9106 vector JSON must parse");

        for vector in file.vectors.iter().filter(|v| !v.should_pass) {
            let password_bytes = decode_hex("password", &vector.id, &vector.password);
            let salt_bytes = decode_hex("salt", &vector.id, &vector.salt);
            let secret_bytes = decode_hex("secret", &vector.id, &vector.secret);
            let ad_bytes = decode_hex("associatedData", &vector.id, &vector.associated_data);
            let expected_tag = decode_hex("tag", &vector.id, &vector.tag);

            let tag = derive_argon2id_for_test(
                &password_bytes,
                &salt_bytes,
                &secret_bytes,
                &ad_bytes,
                vector.memory_kib,
                vector.iterations,
                vector.parallelism,
                vector.tag_length,
            )
            .unwrap_or_else(|err| panic!("{}: derive failed: {err}", vector.id));

            assert_ne!(
                tag, expected_tag,
                "{}: expected tag mismatch for a shouldPass=false vector",
                vector.id
            );
        }
    }

    /// Unit test for the helper itself, independent of the vector file:
    /// Argon2id must be deterministic — identical inputs must always
    /// produce identical output.
    #[test]
    fn derive_argon2id_is_deterministic_for_test_helper() {
        let password = b"password-for-test";
        let salt = b"salt-for-test-0123456789012345";
        let secret = b"secret-for-test";
        let ad = b"ad-for-test";

        let first = derive_argon2id_for_test(password, salt, secret, ad, 32, 3, 4, 32)
            .expect("derive should succeed with well-formed parameters");
        let second = derive_argon2id_for_test(password, salt, secret, ad, 32, 3, 4, 32)
            .expect("derive should succeed with well-formed parameters");

        assert_eq!(first.len(), 32);
        assert_eq!(first, second, "Argon2id must be deterministic for identical inputs");
    }

    /// Unit test for the helper's failure path: a memory cost below Argon2's
    /// own minimum (`Params::MIN_M_COST`, 8 KiB) must make
    /// [`derive_argon2id_for_test`] return an error.
    #[test]
    fn derive_argon2id_fails_for_unsupported_memory_cost_for_test_helper() {
        let result = derive_argon2id_for_test(b"password-for-test", b"salt-for-test", b"", b"", 1, 3, 4, 32);
        assert!(
            result.is_err(),
            "expected an error for an out-of-range memory cost"
        );
    }
}
