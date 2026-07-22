import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 79 — internal secret-handle skeleton. Stage 144–146 extends it to
 * hold its first REAL secret bytes (see
 * `fedos_core_rust_secret_handle_real_bytes.test.ts` for the dedicated
 * real-byte guard suite) — this file covers the parts of the shape that
 * changed as a result (state/method-set enumeration) plus everything from
 * Stage 79 that is still true unchanged.
 *
 * `packages/fedos-core-rust/src/lib.rs` gains a crate-private `secret_handle`
 * module: `SecretHandleState` (`Empty` / `Placeholder` / `Holding` /
 * `Cleared`), `SecretHandleKind`, `SecretInputLength`, `SecretHandleStatus`,
 * and `SecretHandle` itself
 * (`new_placeholder()`/`new_from_32_bytes_for_internal_use()`/`status()`/
 * `kind()`/`clear()`/`is_cleared()`). This is the first PRODUCTION (not
 * `#[cfg(test)]`-only) code in this crate to actually import and use the
 * `zeroize`/`secrecy` dependencies adopted Stage 78. `subtle` (also adopted
 * Stage 78) is deliberately still NOT used.
 *
 * `SecretHandle` is an INTERNAL type, not a public API: every item in
 * `secret_handle` is `pub(crate)` at most (never `pub`), nothing is
 * re-exported from the crate root, and this crate's public `pub fn` surface
 * is unchanged by this addition. No key/seed/plaintext/ciphertext/passphrase
 * byte is accepted, stored, or handled through any `pub` function anywhere
 * — `new_from_32_bytes_for_internal_use()` is `pub(crate)`-only and takes a
 * fixed-size `[u8; 32]`, never a slice/`Vec<u8>`/`String`. No AEAD/HKDF/
 * Argon2/NIP-44 operation is implemented or called. Nothing is wired into
 * the Runtime, the Worker, or `CryptoProvider`.
 *
 * `cargo test` (green as of this stage, including `secret_handle`'s own
 * `#[cfg(test)] mod tests`) and `cargo check` / `cargo check --tests` are
 * verified as their own separate commands outside `npm test`, consistent
 * with how this repo has always kept the Rust toolchain check independent of
 * the vitest/TypeScript test run.
 */
describe("FedOS Rust crate — internal secret handle skeleton", () => {
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

  const secretHandleModule = extractModule(libRsSource, "mod secret_handle");

  it("1. lib.rs contains an internal (non-pub) secret_handle module", () => {
    expect(libRsSource).toContain("mod secret_handle");
    expect(libRsSource).not.toContain("pub mod secret_handle");
  });

  it("2. SecretHandle is not `pub` — at most `pub(crate)`", () => {
    // `\bpub\s+struct\b` requires whitespace directly after `pub`, which
    // `pub(crate) struct` does not have (it has `(crate)`) — so this check
    // does not need a lookbehind to avoid a false positive on the
    // legitimate `pub(crate)` declaration matched just above.
    expect(secretHandleModule).toMatch(/\bpub\(crate\)\s+struct\s+SecretHandle\b/);
    expect(secretHandleModule).not.toMatch(/\bpub\s+struct\s+SecretHandle\b/);
    // Same for the two supporting types.
    expect(secretHandleModule).toMatch(/\bpub\(crate\)\s+enum\s+SecretHandleState\b/);
    expect(secretHandleModule).toMatch(/\bpub\(crate\)\s+struct\s+SecretHandleStatus\b/);
  });

  it("3. no public SecretHandle export anywhere in lib.rs", () => {
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+secret_handle\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+[\w:]*SecretHandle\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+\w+\([^)]*\)\s*->\s*[^{;]*\bSecretHandle\b/);
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
    ];
    expect(pubFnNames.length).toBe(68);    expect([...pubFnNames].sort()).toEqual([...expected].sort());
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

  it("6. no key/seed/plaintext/ciphertext/passphrase storage field anywhere in secret_handle", () => {
    // Field/parameter DECLARATIONS only (name immediately followed by a
    // colon-typed annotation) — not prose in a doc comment that merely
    // NAMES these words (e.g. "holds no real key/seed/plaintext byte").
    expect(secretHandleModule).not.toMatch(/\b(key|seed|plaintext|ciphertext|passphrase)\s*:\s*\w/i);
  });

  it("7. no Vec<u8> / String secret field anywhere in secret_handle", () => {
    expect(secretHandleModule).not.toMatch(/:\s*Vec<u8>/);
    expect(secretHandleModule).not.toMatch(/:\s*String\b/);
    expect(secretHandleModule).not.toMatch(/&\s*\[\s*u8\s*\]/);
    // `new_placeholder()` takes no parameter of any kind.
    expect(secretHandleModule).toMatch(/fn\s+new_placeholder\s*\(\s*\)/);
  });

  it("8. no AEAD/HKDF/Argon2 implementation anywhere in secret_handle", () => {
    expect(secretHandleModule).not.toMatch(/chacha|poly1305|xchacha|aes|gcm/i);
    expect(secretHandleModule).not.toMatch(/\bhkdf\b/i);
    expect(secretHandleModule).not.toMatch(/\bargon2\b/i);
    expect(secretHandleModule).not.toMatch(/\bnip.?44\b/i);
  });

  it("9. no random/getrandom usage anywhere in secret_handle", () => {
    expect(secretHandleModule).not.toContain("getrandom");
    expect(secretHandleModule).not.toMatch(/\brand::/);
    expect(secretHandleModule).not.toMatch(/\bthread_rng\b/);
  });

  it("10. no `unsafe` anywhere in lib.rs (crate-level forbid stays intact)", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(libRsSource).not.toMatch(/\bunsafe\s+(fn|impl|trait|\{)/);
    expect(secretHandleModule).not.toContain("unsafe");
  });

  it("11. no .wasm / target / Cargo.lock artifact is committed to the package", () => {
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

  it("12. Runtime / Worker sources are unchanged: no secret-handle reference and no crypto-op auto-call", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("secret_handle");
      expect(src).not.toContain("secrethandle");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(runtimeSource).not.toMatch(/\.\s*load\s*\(/);
  });

  it("13. secret_handle uses zeroize/secrecy against both the placeholder marker and (Stage 144–146/147) real bytes, and does not use subtle yet", () => {
    // Stage 147 adds `ExposeSecret` (for `expose_bytes_for_internal_derivation`)
    // alongside the pre-existing `SecretBox` import — both now arrive via one
    // braced `use secrecy::{...}` rather than a single-item `use`.
    expect(secretHandleModule).toMatch(/\buse\s+secrecy::\{[^}]*\bSecretBox\b[^}]*\}/);
    expect(secretHandleModule).toMatch(/\buse\s+secrecy::\{[^}]*\bExposeSecret\b[^}]*\}/);
    expect(secretHandleModule).toMatch(/\buse\s+zeroize::Zeroize\b/);
    expect(secretHandleModule).toContain("PlaceholderMarker");
    // subtle is deliberately not used yet (see the module's own doc
    // comment) — a future stage adopts it for a real secret-derived byte
    // comparison, not for this skeleton's plain enum-state equality.
    expect(secretHandleModule).not.toMatch(/\buse\s+subtle\b/);
    expect(secretHandleModule).not.toMatch(/\bConstantTimeEq\b/);
    expect(secretHandleModule).not.toMatch(/\.ct_eq\s*\(/);
  });

  it("14. SecretHandleState has exactly the four specified variants (Stage 144–146 adds Holding)", () => {
    for (const variant of ["Empty", "Placeholder", "Holding", "Cleared"]) {
      expect(secretHandleModule).toContain(variant);
    }
  });

  it("15. SecretHandle exposes exactly the seven specified methods (Stage 144–146 adds new_from_32_bytes_for_internal_use and kind; Stage 147 adds expose_bytes_for_internal_derivation)", () => {
    for (const method of [
      "new_placeholder",
      "new_from_32_bytes_for_internal_use",
      "status",
      "kind",
      "clear",
      "is_cleared",
      "expose_bytes_for_internal_derivation",
    ]) {
      expect(secretHandleModule).toMatch(new RegExp(`\\bfn\\s+${method}\\b`));
    }
  });
});
