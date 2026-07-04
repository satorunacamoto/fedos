//! Stage 208 — NIP-44 padding/encrypt/decrypt/bridge encapsulation guard,
//! `#[cfg(test)]` ONLY. Mirrors `nip44_key_derivation_guard`'s own shape
//! (Stage 201) for the four Stage 202–206 files: confirms, from the
//! ACTUAL source text (not just prose), that `nip44_padding`/
//! `nip44_encrypt`/`nip44_decrypt`/`nip44_bridge` stay exactly as
//! encapsulated as their own module-level doc comments claim —
//! `pub(crate)`-only (never `pub`), no `unsafe`/`.unwrap(`/`.expect(`/
//! `panic!(` in production code, no new Cargo dependency, and no
//! Runtime/Worker/Storage/Relay connection of any kind.
#![cfg(test)]

const NIP44_PADDING_SOURCE: &str = include_str!("nip44_padding.rs");
const NIP44_ENCRYPT_SOURCE: &str = include_str!("nip44_encrypt.rs");
const NIP44_DECRYPT_SOURCE: &str = include_str!("nip44_decrypt.rs");
const NIP44_BRIDGE_SOURCE: &str = include_str!("nip44_bridge.rs");
const CRYPTO_MOD_SOURCE: &str = include_str!("../crypto.rs");

const ALL_FILES: [(&str, &str); 4] = [
    ("nip44_padding.rs", NIP44_PADDING_SOURCE),
    ("nip44_encrypt.rs", NIP44_ENCRYPT_SOURCE),
    ("nip44_decrypt.rs", NIP44_DECRYPT_SOURCE),
    ("nip44_bridge.rs", NIP44_BRIDGE_SOURCE),
];

/// Strips every `//`-prefixed comment/doc-comment line — this module's
/// sibling files legitimately NAME every forbidden word below in their
/// own "this module does NOT do X" reassurance prose, exactly like
/// `nip44_key_derivation_guard`'s own `strip_comment_lines` helper.
fn strip_comment_lines(source: &str) -> String {
    source
        .lines()
        .filter(|line| !line.trim_start().starts_with("//"))
        .collect::<Vec<_>>()
        .join("\n")
}

fn production_only(source: &str) -> &str {
    match source.find("#[cfg(test)]") {
        Some(idx) => &source[..idx],
        None => source,
    }
}

#[test]
fn no_file_declares_a_pub_fn_pub_struct_pub_enum_or_pub_mod_item() {
    for (name, source) in ALL_FILES {
        for line in source.lines() {
            let trimmed = line.trim_start();
            assert!(
                !trimmed.starts_with("pub fn "),
                "{name} must declare no `pub fn`: {line}"
            );
            assert!(
                !trimmed.starts_with("pub struct "),
                "{name} must declare no `pub struct`: {line}"
            );
            assert!(
                !trimmed.starts_with("pub enum "),
                "{name} must declare no `pub enum`: {line}"
            );
            assert!(
                !trimmed.starts_with("pub mod "),
                "{name} must declare no `pub mod`: {line}"
            );
        }
    }
}

#[test]
fn crypto_rs_declares_the_four_new_modules_pub_crate_only_never_pub() {
    for module in ["nip44_padding", "nip44_encrypt", "nip44_decrypt", "nip44_bridge"] {
        let declaration = format!("pub(crate) mod {module};");
        assert!(
            CRYPTO_MOD_SOURCE.contains(&declaration),
            "expected crypto.rs to contain `{declaration}`"
        );
        let bare_pub_declaration = format!("\npub mod {module};");
        assert!(!CRYPTO_MOD_SOURCE.contains(&bare_pub_declaration));
    }
}

#[test]
fn no_runtime_worker_storage_or_relay_connection_in_any_of_the_four_files() {
    for (name, source) in ALL_FILES {
        let code_only = strip_comment_lines(source);
        for forbidden in ["Runtime", "Worker", "StorageBackend", "Relay", "wasm_bindgen"] {
            assert!(
                !code_only.contains(forbidden),
                "{name}'s CODE (not doc comments) must not reference `{forbidden}`"
            );
        }
    }
}

#[test]
fn no_unsafe_unwrap_expect_or_panic_in_production_code() {
    for (name, source) in ALL_FILES {
        let code = production_only(source);
        assert!(
            !code.contains("unsafe"),
            "{name} production code must not use `unsafe`"
        );
        assert!(
            !code.contains(".unwrap("),
            "{name} production code must not use `.unwrap(`"
        );
        assert!(
            !code.contains(".expect("),
            "{name} production code must not use `.expect(`"
        );
        assert!(
            !code.contains("panic!("),
            "{name} production code must not use `panic!(`"
        );
    }
}

#[test]
fn no_new_cargo_dependency_is_imported_by_encrypt_or_decrypt() {
    // Stage 202-206 add zero new Cargo.toml dependencies — encrypt/decrypt
    // reuse the pre-existing ChaCha20-Poly1305 AEAD (`crypto::aead_internal`,
    // Stage 152-154), never a raw `chacha20`/`hmac` crate.
    for (name, source) in [
        ("nip44_encrypt.rs", NIP44_ENCRYPT_SOURCE),
        ("nip44_decrypt.rs", NIP44_DECRYPT_SOURCE),
    ] {
        for forbidden in ["use chacha20::", "use hmac::"] {
            assert!(
                !source.contains(forbidden),
                "{name} must not import a new crate: {forbidden}"
            );
        }
    }
}

#[test]
fn nip44_bridge_does_not_modify_or_reimplement_ciphertext_envelope() {
    let code_only = strip_comment_lines(NIP44_BRIDGE_SOURCE);
    assert!(!code_only.contains("struct AeadCiphertextEnvelope"));
    assert!(!code_only.contains("enum AeadEnvelopeAlgorithm"));
    assert!(!code_only.contains("enum AeadEnvelopeAadDomain"));
}

#[test]
fn no_fedos_encrypt_or_fedos_decrypt_call_anywhere_in_the_four_files() {
    for (name, source) in ALL_FILES {
        assert!(
            !source.contains("fedos_encrypt("),
            "{name} must not call the unrelated public fedos_encrypt"
        );
        assert!(
            !source.contains("fedos_decrypt("),
            "{name} must not call the unrelated public fedos_decrypt"
        );
    }
}
