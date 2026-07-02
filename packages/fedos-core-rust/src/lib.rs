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
#[cfg(test)]
mod rfc8439_vectors {
    use chacha20poly1305::aead::{Aead, KeyInit, Payload};
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

    #[test]
    fn rfc8439_json_parses_and_is_non_empty() {
        let file: VectorFile =
            serde_json::from_str(RFC8439_JSON).expect("RFC 8439 vector JSON must parse");
        assert!(
            !file.vectors.is_empty(),
            "expected at least one RFC 8439 vector"
        );
    }

    /// `shouldPass=true` vectors: `chacha20poly1305` must both (a) seal
    /// (encrypt) plaintext+AAD to exactly the RFC's expected
    /// ciphertext||tag, and (b) open (decrypt) that same ciphertext||tag
    /// back to exactly the RFC's expected plaintext.
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

            let key = Key::try_from(key_bytes.as_slice())
                .unwrap_or_else(|_| panic!("{}: key is not 32 bytes", vector.id));
            let nonce = Nonce::try_from(nonce_bytes.as_slice())
                .unwrap_or_else(|_| panic!("{}: nonce is not 12 bytes", vector.id));
            let cipher = ChaCha20Poly1305::new(&key);

            let mut expected_sealed = ciphertext_bytes.clone();
            expected_sealed.extend_from_slice(&tag_bytes);

            let sealed = cipher
                .encrypt(
                    &nonce,
                    Payload {
                        msg: &plaintext_bytes,
                        aad: &aad_bytes,
                    },
                )
                .unwrap_or_else(|err| panic!("{}: encrypt failed: {err}", vector.id));
            assert_eq!(
                sealed, expected_sealed,
                "{}: ciphertext||tag did not match the RFC 8439 vector",
                vector.id
            );

            let opened = cipher
                .decrypt(
                    &nonce,
                    Payload {
                        msg: expected_sealed.as_slice(),
                        aad: &aad_bytes,
                    },
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
    /// fail to decrypt/authenticate. RFC 8439 itself publishes no
    /// byte-level tamper/negative vector for this construction (per
    /// docs/crypto_vector_sources.md §2's verbatim-only import rule, none is
    /// fabricated here — see the file's own `notes` field) — so today this
    /// loop body runs zero times and the test trivially passes. It exists so
    /// that IF a future, explicitly-reviewed re-import of this file ever
    /// adds an official negative case, this test starts enforcing it with no
    /// further code change required.
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

            let key = Key::try_from(key_bytes.as_slice())
                .unwrap_or_else(|_| panic!("{}: key is not 32 bytes", vector.id));
            let nonce = Nonce::try_from(nonce_bytes.as_slice())
                .unwrap_or_else(|_| panic!("{}: nonce is not 12 bytes", vector.id));
            let cipher = ChaCha20Poly1305::new(&key);

            let mut sealed = ciphertext_bytes.clone();
            sealed.extend_from_slice(&tag_bytes);

            let result = cipher.decrypt(
                &nonce,
                Payload {
                    msg: sealed.as_slice(),
                    aad: &aad_bytes,
                },
            );
            assert!(
                result.is_err(),
                "{}: expected decrypt/authentication failure for a shouldPass=false vector",
                vector.id
            );
        }
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
#[cfg(test)]
mod rfc5869_vectors {
    use hkdf::Hkdf;
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

    #[test]
    fn rfc5869_json_parses_and_is_non_empty() {
        let file: VectorFile =
            serde_json::from_str(RFC5869_JSON).expect("RFC 5869 vector JSON must parse");
        assert!(
            !file.vectors.is_empty(),
            "expected at least one RFC 5869 vector"
        );
    }

    /// `shouldPass=true` vectors: `hkdf::Hkdf::<sha2::Sha256>` must both (a)
    /// extract a PRK from IKM+salt matching the RFC's expected PRK, and (b)
    /// expand that PRK with `info` to exactly the RFC's expected `L`-octet
    /// OKM.
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

            let (prk, hk) = Hkdf::<Sha256>::extract(Some(&salt_bytes), &ikm_bytes);
            assert_eq!(
                prk.as_slice(),
                prk_bytes.as_slice(),
                "{}: PRK did not match the RFC 5869 vector",
                vector.id
            );

            let mut okm = vec![0u8; vector.length];
            hk.expand(&info_bytes, &mut okm)
                .unwrap_or_else(|err| panic!("{}: expand failed: {err}", vector.id));
            assert_eq!(
                okm, okm_bytes,
                "{}: OKM did not match the RFC 5869 vector",
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
    /// produce a PRK or OKM that does NOT match whatever (necessarily
    /// incorrect) expected bytes the fixture carries. The currently imported
    /// RFC 5869 file has no negative case (RFC 5869 Appendix A publishes only
    /// positive known-answer test cases for HKDF-SHA256 — see
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

            let (prk, hk) = Hkdf::<Sha256>::extract(Some(&salt_bytes), &ikm_bytes);
            let mut okm = vec![0u8; vector.length];
            hk.expand(&info_bytes, &mut okm)
                .unwrap_or_else(|err| panic!("{}: expand failed: {err}", vector.id));

            assert!(
                prk.as_slice() != prk_bytes.as_slice() || okm != okm_bytes,
                "{}: expected PRK or OKM mismatch for a shouldPass=false vector",
                vector.id
            );
        }
    }
}
