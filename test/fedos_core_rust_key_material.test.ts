import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 87 — internal key-material handle skeleton.
 *
 * `packages/fedos-core-rust/src/lib.rs` gains a fourth crate-private module,
 * `key_material`: `KeyMaterialState` (`Empty` / `Placeholder` / `Cleared`),
 * `KeyMaterialKind` (`AeadKeyPlaceholder` / `KdfOutputPlaceholder` /
 * `NostrKeyPlaceholder` / `UnknownPlaceholder` — a label only), a
 * non-sensitive `KeyMaterialStatus`, and `KeyMaterialHandle` itself
 * (`new_placeholder(kind)`/`status()`/`kind()`/`clear()`/`is_cleared()`). It
 * reuses `secret_handle`'s (Stage 79) exact placeholder-only pattern — a
 * fixed, non-secret marker wrapped in `secrecy::SecretBox`, zeroized on
 * `clear()` — as a future AEAD/KDF connection point.
 *
 * `KeyMaterialHandle` is an INTERNAL skeleton, not a public API: every item
 * in `key_material` is `pub(crate)` at most (never `pub`), nothing is
 * re-exported from the crate root, and this crate's public `pub fn` surface
 * is still exactly the same six placeholder functions from Stage 69. No real
 * key/seed/plaintext/ciphertext/passphrase/nonce byte is accepted, stored,
 * or handled anywhere — `new_placeholder(kind)` takes only a `KeyMaterialKind`
 * label, never a byte of any kind, and the only field beyond the label is the
 * fixed placeholder marker. No AEAD/HKDF/Argon2/NIP-44 operation is
 * implemented or called. `key_material` is also NOT connected to
 * `secret_handle`, `aead_core` (Stage 80), or `kdf_core` (Stage 82) — it
 * never constructs any of their types. Nothing is wired into the Runtime,
 * the Worker, or `CryptoProvider`.
 *
 * `cargo test` (green as of this stage, including `key_material`'s own
 * `#[cfg(test)] mod tests`) and `cargo check` / `cargo check --tests` are
 * verified as their own separate commands outside `npm test`, consistent
 * with how this repo has always kept the Rust toolchain check independent of
 * the vitest/TypeScript test run.
 */
describe("FedOS Rust crate — internal key material skeleton", () => {
  /** Extracts a `mod name { ... }` block via brace matching (robust to
   * nested `{}` inside, e.g. this module's own nested `#[cfg(test)]`). */
  function extractModule(source: string, marker: string): string {
    const start = source.indexOf(marker);
    expect(start, `expected to find "${marker}" in lib.rs`).toBeGreaterThan(-1);
    const braceStart = source.indexOf("{", start);
    expect(braceStart, `expected an opening brace after "${marker}"`).toBeGreaterThan(-1);
    let depth = 0;
    for (let i = braceStart; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) return source.slice(start, i + 1);
      }
    }
    throw new Error(`unbalanced braces while extracting module: ${marker}`);
  }

  const keyMaterialModule = extractModule(libRsSource, "mod key_material");
  const secretHandleModule = extractModule(libRsSource, "mod secret_handle");
  const aeadCoreModule = extractModule(libRsSource, "mod aead_core");
  const kdfCoreModule = extractModule(libRsSource, "mod kdf_core");

  it("1. lib.rs contains an internal (non-pub) key_material module", () => {
    expect(libRsSource).toContain("mod key_material");
    expect(libRsSource).not.toContain("pub mod key_material");
  });

  it("2. key_material's own module declaration is not pub", () => {
    // The module block itself is declared as a crate-internal `mod`, not
    // `pub mod` — checked positionally right before the extracted block.
    const idx = libRsSource.indexOf("mod key_material");
    const before = libRsSource.slice(Math.max(0, idx - 40), idx);
    expect(before).not.toMatch(/\bpub\s+$/);
  });

  it("3. KeyMaterialHandle is not `pub` — at most `pub(crate)` — and never exported from the crate root", () => {
    expect(keyMaterialModule).toMatch(/\bpub\(crate\)\s+struct\s+KeyMaterialHandle\b/);
    expect(keyMaterialModule).not.toMatch(/\bpub\s+struct\s+KeyMaterialHandle\b/);
    expect(keyMaterialModule).toMatch(/\bpub\(crate\)\s+enum\s+KeyMaterialState\b/);
    expect(keyMaterialModule).toMatch(/\bpub\(crate\)\s+enum\s+KeyMaterialKind\b/);
    expect(keyMaterialModule).toMatch(/\bpub\(crate\)\s+struct\s+KeyMaterialStatus\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+key_material\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+[\w:]*KeyMaterialHandle\b/);
    expect(libRsSource).not.toMatch(
      /\bpub\s+fn\s+\w+\([^)]*\)\s*->\s*[^{;]*\bKeyMaterialHandle\b/,
    );
  });

  it("4. lib.rs's public `pub fn` surface is still exactly the six Stage 69 functions", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map(
      (m) => m[1],
    );
    const expected = [
      "fedos_core_status",
      "fedos_core_capabilities",
      "random_bytes_placeholder",
      "derive_key_placeholder",
      "encrypt_placeholder",
      "decrypt_placeholder",
      "fedos_crypto_boundary_status",
      "fedos_random_boundary_status",
      "fedos_nonce_boundary_status",
      "fedos_key_generation_boundary_status",
      "fedos_key_import_boundary_status",
      "fedos_key_export_boundary_status",
      "fedos_capability_descriptors",
      "fedos_algorithm_descriptors",
      "fedos_boundary_version",
      "fedos_boundary_features",
      "fedos_boundary_policy_decision",
      "fedos_key_format_descriptor_placeholder",
      "fedos_key_usage_descriptor_placeholder",
      "fedos_algorithm_requirements",
      "fedos_algorithm_capabilities",
      "fedos_algorithm_policy_decision",
      "fedos_random_bytes_32",
      "fedos_aead_nonce_96",
      "fedos_encrypt",
      "fedos_decrypt",
      "fedos_generate_aead_key_32",
      "version",
      "random_bytes_32",
      "generate_aead_key_handle",
      "kind",
      "kind",
      "encrypt_aead",
      "decrypt_aead",
      "serialize_aead_ciphertext",
      "deserialize_aead_ciphertext",
      "new",
      "is_available",
      "is_cleared",
      "generate",
      "seal",
      "restore_sealed",
      "clear",
      "sign_nostr_event",
      "public_key_hex_for_account",
      "resolve_conversation_key",
      "seal_direct_ratchet_secret",
      "restore_direct_ratchet_secret",
      "initialize_as_receiver",
      "initialize_as_sender",
      "local_ratchet_public_key_hex",
      "remote_ratchet_public_key_hex",
      "is_ready_to_send",
      "send_counter",
      "receive_counter",
      "skipped_key_count",
      "encrypt",
      "decrypt",
      "seal_root_key",
      "seal_sending_chain_key",
      "seal_receiving_chain_key",
      "seal_local_ratchet_private_key",
      "seal_all_skipped_keys",
      "restore",
      "encrypt_nip44_wire",
      "decrypt_nip44_wire",
      "sign_nostr_event_with_fresh_ephemeral_key",
      "build_and_sign_nip17_gift_wrap",
      "previous_sending_chain_length",
    ];
    expect(pubFnNames.length).toBe(69);    expect([...pubFnNames].sort()).toEqual([...expected].sort());
  });

  it("5. production API placeholders are unchanged", () => {
    for (const fn of [
      "pub fn fedos_core_status() -> FedosCoreStatus",
      "pub fn fedos_core_capabilities() -> &'static [&'static str]",
      "pub fn random_bytes_placeholder() -> FedosCoreStatus",
      "pub fn derive_key_placeholder() -> FedosCoreStatus",
      "pub fn encrypt_placeholder() -> FedosCoreStatus",
      "pub fn decrypt_placeholder() -> FedosCoreStatus",
    ]) {
      expect(libRsSource, `expected unchanged signature: ${fn}`).toContain(fn);
    }
    expect(libRsSource).toMatch(
      /fn random_bytes_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
    expect(libRsSource).toMatch(
      /fn derive_key_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
    expect(libRsSource).toMatch(
      /fn encrypt_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
    expect(libRsSource).toMatch(
      /fn decrypt_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
  });

  it("6. no key/seed/plaintext/ciphertext/passphrase/nonce storage field anywhere in key_material", () => {
    // Field/parameter DECLARATIONS only (name immediately followed by a
    // colon-typed annotation) — not prose in a doc comment that merely
    // NAMES these words (e.g. "holds no real key/seed/plaintext byte").
    expect(keyMaterialModule).not.toMatch(
      /\b(key|seed|plaintext|ciphertext|passphrase|nonce)\s*:\s*\w/i,
    );
  });

  it("7. no Vec<u8> / String secret field anywhere in key_material — the only stored data beyond the kind label is the fixed placeholder marker", () => {
    expect(keyMaterialModule).not.toMatch(/:\s*Vec<u8>/);
    expect(keyMaterialModule).not.toMatch(/:\s*String\b/);
    expect(keyMaterialModule).not.toMatch(/&\s*\[\s*u8\s*\]/);
    // `new_placeholder(kind)` takes only a `KeyMaterialKind` label.
    expect(keyMaterialModule).toMatch(
      /fn\s+new_placeholder\s*\(\s*kind\s*:\s*KeyMaterialKind\s*\)/,
    );
  });

  it("8. no AEAD/HKDF/Argon2/NIP-44 implementation anywhere in key_material", () => {
    // Specific Rust-usage patterns only — NOT a bare `\bhkdf\b`/`\bargon2\b`
    // word match, which would also match this module's own doc-comment
    // prose naming HKDF/Argon2 as future, still-unimplemented connection
    // points (e.g. "KDF output (e.g. HKDF's OKM..."), same lesson learned
    // for `kdf_core` (Stage 82) and the Argon2 test-helper stage (86).
    expect(keyMaterialModule).not.toMatch(/chacha|poly1305|xchacha|aes|gcm/i);
    expect(keyMaterialModule).not.toMatch(/\buse\s+hkdf\b/);
    expect(keyMaterialModule).not.toMatch(/\bhkdf::/);
    expect(keyMaterialModule).not.toMatch(/\bHkdf::/);
    expect(keyMaterialModule).not.toMatch(/\bargon2::/i);
    expect(keyMaterialModule).not.toMatch(/\bArgon2::/);
    expect(keyMaterialModule).not.toMatch(/\bArgon2</);
    expect(keyMaterialModule).not.toMatch(/\bnip.?44\b/i);
  });

  it("9. no random/getrandom usage anywhere in key_material", () => {
    expect(keyMaterialModule).not.toContain("getrandom");
    expect(keyMaterialModule).not.toMatch(/\brand::/);
    expect(keyMaterialModule).not.toMatch(/\bthread_rng\b/);
  });

  it("10. no `unsafe` anywhere in lib.rs (crate-level forbid stays intact)", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(libRsSource).not.toMatch(/\bunsafe\s+(fn|impl|trait|\{)/);
    expect(keyMaterialModule).not.toContain("unsafe");
  });

  it("11. Runtime / Worker sources are unchanged: no key-material reference and no crypto-op auto-call", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("key_material");
      expect(src).not.toContain("keymaterial");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(runtimeSource).not.toMatch(/\.\s*load\s*\(/);
  });

  it("12. no .wasm / target / Cargo.lock artifact is committed to the package", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../packages/fedos-core-rust/**/*");
    const paths = Object.keys(files);
    for (const path of paths) {
      expect(/\.wasm$/i.test(path), `unexpected WASM binary: ${path}`).toBe(false);
      expect(/\/(target|build)\//i.test(path), `unexpected build dir artifact: ${path}`).toBe(
        false,
      );
      expect(/\/Cargo\.lock$/i.test(path), `unexpected committed Cargo.lock: ${path}`).toBe(
        false,
      );
      expect(
        /\.(rlib|so|dll|dylib|node|a|o)$/i.test(path),
        `unexpected compiled artifact: ${path}`,
      ).toBe(false);
    }
  });

  it("13. key_material uses zeroize/secrecy only against the fixed placeholder marker, and does not use subtle yet", () => {
    expect(keyMaterialModule).toMatch(/\buse\s+secrecy::SecretBox\b/);
    expect(keyMaterialModule).toMatch(/\buse\s+zeroize::Zeroize\b/);
    expect(keyMaterialModule).toContain("PlaceholderMarker");
    // subtle is deliberately not used yet, same reasoning as secret_handle.
    expect(keyMaterialModule).not.toMatch(/\buse\s+subtle\b/);
    expect(keyMaterialModule).not.toMatch(/\bConstantTimeEq\b/);
    expect(keyMaterialModule).not.toMatch(/\.ct_eq\s*\(/);
  });

  it("14. KeyMaterialState has exactly the three specified variants; KeyMaterialKind has exactly the four specified variants", () => {
    for (const variant of ["Empty", "Placeholder", "Cleared"]) {
      expect(keyMaterialModule).toContain(variant);
    }
    for (const kind of [
      "AeadKeyPlaceholder",
      "KdfOutputPlaceholder",
      "NostrKeyPlaceholder",
      "UnknownPlaceholder",
    ]) {
      expect(keyMaterialModule).toContain(kind);
    }
  });

  it("15. KeyMaterialHandle exposes exactly the five specified methods", () => {
    for (const method of ["new_placeholder", "status", "kind", "clear", "is_cleared"]) {
      expect(keyMaterialModule).toMatch(new RegExp(`\\bfn\\s+${method}\\b`));
    }
  });

  it("16. key_material does not construct or reference secret_handle/aead_core/kdf_core types — skeletons stay unconnected", () => {
    expect(keyMaterialModule).not.toMatch(/\bSecretHandle\b/);
    expect(keyMaterialModule).not.toMatch(/\bAeadCore\b/);
    expect(keyMaterialModule).not.toMatch(/\bKdfCore\b/);
    // And the converse: the pre-existing skeletons don't reach into
    // key_material either (this stage only adds to lib.rs, never edits
    // those modules' own bodies).
    expect(secretHandleModule).not.toMatch(/\bKeyMaterial\w*\b/);
    expect(aeadCoreModule).not.toMatch(/\bKeyMaterial\w*\b/);
    expect(kdfCoreModule).not.toMatch(/\bKeyMaterial\w*\b/);
  });
});
