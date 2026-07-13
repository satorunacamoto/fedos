//! Stage 196 — secp256k1 dependency PRE-IMPLEMENTATION guard,
//! `#[cfg(test)]` ONLY. Updated by Secure Runtime Alpha 181 (the Nostr
//! Schnorr Signing Foundation Arc) — see that Stage's own record,
//! `docs/secure_runtime_alpha_181_k256_schnorr_api_inventory.md`, for
//! why `schnorr` moved from the forbidden list to the expected one
//! below; every other guarantee this module made at Stage 196 is
//! UNCHANGED.
//!
//! Confirms, from the ACTUAL resolved build (not just prose), that
//! `k256`'s adopted feature set stays exactly as minimal as
//! `docs/nip44_dependency_adoption.md`/`Cargo.toml`'s own comment record
//! now describes: exactly one production dependency line for `k256`,
//! exactly the `arithmetic` + `schnorr` features (no
//! `ecdsa`/`serde`/`pem`/`pkcs8`/`std`/`alloc` feature enabled), and the
//! resolved `Cargo.lock` graph contains no FULL `rand` crate (only
//! `rand_core`, the reviewed, unavoidable transitive-trait-only
//! exception `Cargo.toml`'s own comment documents).
//!
//! **Performs no cryptography of any kind** — no ECDH, no
//! conversation-key/message-key derivation, no padding, no encrypt/
//! decrypt, no Schnorr signing. This module exists ONLY to guard the
//! DEPENDENCY shape stays fixed at exactly this feature set until a
//! future, separate, explicitly-reviewed stage needs more.
#![cfg(test)]

/// This crate's own `Cargo.toml`, read at compile time — the SAME
/// discipline `nip44_vector_schema`'s `include_str!` of the NIP-44 vector
/// file already uses, applied here to the manifest itself.
const CARGO_TOML: &str = include_str!("../../Cargo.toml");

/// This crate's own `Cargo.lock`, read at compile time. Cargo always
/// resolves (and, if missing, regenerates) `Cargo.lock` BEFORE compiling
/// anything — including this test file — so this reflects the ACTUAL
/// resolved dependency graph a real `cargo build`/`cargo test` produced,
/// not merely `Cargo.toml`'s declared intent.
const CARGO_LOCK: &str = include_str!("../../Cargo.lock");

/// Strips `#`-prefixed comments from a TOML-ish line, mirroring this
/// repository's own JS-side `cargoCode` normalization convention (see
/// e.g. `test/fedos_core_rust_ciphertext_transport.test.ts`) so a
/// commented-out mention never counts as a real declaration.
fn strip_toml_comments(source: &str) -> String {
    source
        .lines()
        .map(|line| match line.find('#') {
            Some(idx) => &line[..idx],
            None => line,
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn production_dependencies_section(cargo_toml: &str) -> &str {
    let deps_idx = cargo_toml
        .find("[dependencies]")
        .expect("Cargo.toml must have a [dependencies] section");
    let dev_deps_idx = cargo_toml
        .find("[dev-dependencies]")
        .expect("Cargo.toml must have a [dev-dependencies] section");
    &cargo_toml[deps_idx..dev_deps_idx]
}

#[test]
fn cargo_toml_has_exactly_ten_production_dependencies_after_k256_adoption() {
    let cleaned = strip_toml_comments(CARGO_TOML);
    let section = production_dependencies_section(&cleaned);
    let dep_lines: Vec<&str> = section
        .lines()
        .filter(|line| {
            let trimmed = line.trim();
            !trimmed.is_empty() && trimmed.contains('=') && !trimmed.starts_with('[')
        })
        .collect();
    assert_eq!(
        dep_lines.len(),
        10,
        "expected exactly 10 production dependencies (9 pre-Stage-194 + k256), got: {dep_lines:?}"
    );
}

#[test]
fn k256_is_declared_with_default_features_false_and_only_arithmetic_and_schnorr_features() {
    let cleaned = strip_toml_comments(CARGO_TOML);
    let section = production_dependencies_section(&cleaned);
    let k256_line = section
        .lines()
        .find(|line| line.trim_start().starts_with("k256"))
        .expect("expected a k256 dependency line in [dependencies]");
    assert!(k256_line.contains("default-features = false"));
    assert!(k256_line.contains(r#"features = ["arithmetic", "schnorr"]"#));
    for forbidden in ["ecdsa", "serde", "pem", "pkcs8", "rand", "\"std\"", "\"alloc\""] {
        assert!(
            !k256_line.contains(forbidden),
            "k256 dependency line must not enable `{forbidden}`: {k256_line}"
        );
    }
}

#[test]
fn no_secp256k1_c_ffi_dependency_was_also_added() {
    let cleaned = strip_toml_comments(CARGO_TOML);
    let section = production_dependencies_section(&cleaned);
    assert!(
        !section
            .lines()
            .any(|line| line.trim_start().starts_with("secp256k1")),
        "expected no rust-secp256k1 dependency line — docs/nip44_dependency_adoption.md picked k256"
    );
}

#[test]
fn cargo_lock_resolves_k256_and_contains_no_full_rand_crate_package() {
    assert!(
        CARGO_LOCK.contains("name = \"k256\""),
        "expected Cargo.lock to resolve a k256 package"
    );
    assert!(
        !CARGO_LOCK.contains("name = \"rand\"\n"),
        "the FULL rand crate must never appear as a resolved package — only rand_core (trait-only) is the reviewed exception"
    );
}

#[test]
fn cargo_lock_contains_rand_core_only_as_the_documented_transitive_exception() {
    // rand_core IS expected — it is the reviewed, unavoidable transitive
    // dependency of elliptic-curve/ff/group/crypto-bigint this crate's
    // own Cargo.toml comment documents. This test exists to make that
    // presence an explicit, named assertion rather than an unexamined
    // side effect — if it ever disappears (e.g. a future k256 release
    // drops the requirement), that is fine and this assertion should be
    // relaxed at that time, not silently left stale.
    assert!(CARGO_LOCK.contains("name = \"rand_core\""));
}

