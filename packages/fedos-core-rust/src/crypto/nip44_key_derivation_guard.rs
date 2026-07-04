//! Stage 201 — NIP-44 key-derivation encapsulation guard, `#[cfg(test)]`
//! ONLY.
//!
//! Confirms, from the ACTUAL source text (not just prose), that
//! `conversation_key`/`message_key`/`hkdf_bridge` (Stage 198–201) stay
//! exactly as encapsulated as their own module-level doc comments claim:
//! `pub(crate)`-only (never `pub`), no `#[derive(Clone)]`/`#[derive(Debug)]`
//! on `ConversationKey`/`MessageKey` themselves, and no Runtime/Worker/
//! Storage/Relay connection of any kind.
#![cfg(test)]

const CONVERSATION_KEY_SOURCE: &str = include_str!("conversation_key.rs");
const MESSAGE_KEY_SOURCE: &str = include_str!("message_key.rs");
const HKDF_BRIDGE_SOURCE: &str = include_str!("hkdf_bridge.rs");
const CRYPTO_MOD_SOURCE: &str = include_str!("../crypto.rs");

/// Strips every `//`-prefixed comment/doc-comment line — this module's own
/// doc comments legitimately NAME every forbidden word below in "this
/// module does NOT do X" reassurance prose (mirrors this repository's
/// established `cargoCode`/`strip_toml_comments` convention, applied here
/// to Rust line comments instead of TOML's `#`).
fn strip_comment_lines(source: &str) -> String {
    source
        .lines()
        .filter(|line| !line.trim_start().starts_with("//"))
        .collect::<Vec<_>>()
        .join("\n")
}

/// Returns the line immediately preceding `needle`'s first occurrence, or
/// an empty string if `needle` is on the first line / not found — used to
/// check the derive attribute (if any) directly above a struct
/// declaration.
fn line_before<'a>(source: &'a str, needle: &str) -> &'a str {
    let idx = match source.find(needle) {
        Some(idx) => idx,
        None => return "",
    };
    let preceding = &source[..idx];
    preceding.lines().last().unwrap_or("")
}

#[test]
fn conversation_key_struct_derives_neither_clone_nor_debug() {
    let preceding = line_before(CONVERSATION_KEY_SOURCE, "pub(crate) struct ConversationKey {");
    assert!(
        !preceding.contains("Clone"),
        "ConversationKey must not derive Clone: {preceding}"
    );
    assert!(
        !preceding.contains("Debug"),
        "ConversationKey must not derive Debug: {preceding}"
    );
}

#[test]
fn message_key_struct_derives_neither_clone_nor_debug() {
    let preceding = line_before(MESSAGE_KEY_SOURCE, "pub(crate) struct MessageKey {");
    assert!(
        !preceding.contains("Clone"),
        "MessageKey must not derive Clone: {preceding}"
    );
    assert!(
        !preceding.contains("Debug"),
        "MessageKey must not derive Debug: {preceding}"
    );
}

#[test]
fn conversation_key_decision_derives_neither_clone_nor_debug() {
    let preceding = line_before(
        CONVERSATION_KEY_SOURCE,
        "pub(crate) struct ConversationKeyDecision {",
    );
    assert!(!preceding.contains("Clone"));
    assert!(!preceding.contains("Debug"));
}

#[test]
fn message_key_decision_derives_neither_clone_nor_debug() {
    let preceding = line_before(MESSAGE_KEY_SOURCE, "pub(crate) struct MessageKeyDecision {");
    assert!(!preceding.contains("Clone"));
    assert!(!preceding.contains("Debug"));
}

#[test]
fn no_file_declares_a_pub_fn_pub_struct_or_pub_mod_item() {
    for (name, source) in [
        ("conversation_key.rs", CONVERSATION_KEY_SOURCE),
        ("message_key.rs", MESSAGE_KEY_SOURCE),
        ("hkdf_bridge.rs", HKDF_BRIDGE_SOURCE),
    ] {
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
fn crypto_rs_declares_the_three_new_modules_pub_crate_only_never_pub() {
    for module in ["conversation_key", "message_key", "hkdf_bridge"] {
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
fn no_runtime_worker_storage_or_relay_connection_in_any_of_the_three_files() {
    for (name, source) in [
        ("conversation_key.rs", CONVERSATION_KEY_SOURCE),
        ("message_key.rs", MESSAGE_KEY_SOURCE),
        ("hkdf_bridge.rs", HKDF_BRIDGE_SOURCE),
    ] {
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
fn none_of_the_three_files_implement_padding_encrypt_decrypt_or_nip44s_real_per_message_wire_format(
) {
    for (name, source) in [
        ("conversation_key.rs", CONVERSATION_KEY_SOURCE),
        ("message_key.rs", MESSAGE_KEY_SOURCE),
        ("hkdf_bridge.rs", HKDF_BRIDGE_SOURCE),
    ] {
        let code_only = strip_comment_lines(source);
        for forbidden in [
            "calc_padded_len",
            "pad_plaintext",
            "nip44_encrypt",
            "nip44_decrypt",
            "chacha_nonce",
            "hmac_key",
        ] {
            assert!(
                !code_only.contains(forbidden),
                "{name}'s CODE (not doc comments) must not reference `{forbidden}`"
            );
        }
    }
}
