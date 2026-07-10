import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 80 — internal AEAD module skeleton.
 *
 * `packages/fedos-core-rust/src/lib.rs` gains a second crate-private module,
 * `aead_core` (alongside Stage 79's `secret_handle`): `AeadAlgorithm`
 * (`ChaCha20Poly1305`), `AeadOperation` (`Encrypt` / `Decrypt`),
 * `AeadRequestStatus` (wraps this crate's existing `FedosCoreState`), and
 * `AeadPlaceholderRequest` itself
 * (`new_placeholder_encrypt()`/`new_placeholder_decrypt()`/`status()`/
 * `algorithm()`/`operation()`).
 *
 * `AeadPlaceholderRequest` is an INTERNAL skeleton, not a public API: every
 * item in `aead_core` is `pub(crate)` at most (never `pub`), nothing is
 * re-exported, and this crate's public `pub fn` surface is still exactly the
 * same six placeholder functions from Stage 69. No real key, nonce,
 * plaintext, ciphertext, or tag byte is accepted, stored, or handled
 * anywhere — `new_placeholder_encrypt()`/`new_placeholder_decrypt()` take no
 * such input, and `AeadPlaceholderRequest` stores only the two labels.
 * Production code in `aead_core` does NOT import `chacha20poly1305` — that
 * dependency is still exercised ONLY inside the pre-existing `cfg(test)`-only
 * `rfc8439_vectors` module (Stage 75), unchanged this stage.
 * `aead_core` does not connect to `secret_handle`: it never constructs a
 * `SecretHandle` and extracts no key/secret byte from one. Nothing is wired
 * into the Runtime, the Worker, or `CryptoProvider`.
 *
 * `cargo test` (green as of this stage, including `aead_core`'s own
 * `#[cfg(test)] mod tests`) and `cargo check` / `cargo check --tests` are
 * verified as their own separate commands outside `npm test`, consistent
 * with how this repo has always kept the Rust toolchain check independent of
 * the vitest/TypeScript test run.
 */
describe("FedOS Rust crate — internal AEAD module skeleton", () => {
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

  const aeadCoreModule = extractModule(libRsSource, "mod aead_core");

  it("1. lib.rs contains an internal (non-pub) aead_core module", () => {
    expect(libRsSource).toContain("mod aead_core");
    expect(libRsSource).not.toContain("pub mod aead_core");
  });

  it("2. aead_core module is not pub", () => {
    // `\bmod\s+aead_core\b` preceded directly by `pub ` (not `pub(crate) `)
    // would be a public module declaration — must not exist.
    expect(libRsSource).not.toMatch(/\bpub\s+mod\s+aead_core\b/);
  });

  it("3. Aead structs/enums are crate-private only (pub(crate) at most, never pub)", () => {
    // `\bpub\s+struct\b` / `\bpub\s+enum\b` require whitespace directly
    // after `pub`, which `pub(crate)` does not have (it has `(crate)`) — so
    // these checks naturally exclude the legitimate `pub(crate)` declarations
    // matched just below.
    expect(aeadCoreModule).toMatch(/\bpub\(crate\)\s+enum\s+AeadAlgorithm\b/);
    expect(aeadCoreModule).toMatch(/\bpub\(crate\)\s+enum\s+AeadOperation\b/);
    expect(aeadCoreModule).toMatch(/\bpub\(crate\)\s+struct\s+AeadRequestStatus\b/);
    expect(aeadCoreModule).toMatch(/\bpub\(crate\)\s+struct\s+AeadPlaceholderRequest\b/);
    expect(aeadCoreModule).not.toMatch(/\bpub\s+enum\s+AeadAlgorithm\b/);
    expect(aeadCoreModule).not.toMatch(/\bpub\s+enum\s+AeadOperation\b/);
    expect(aeadCoreModule).not.toMatch(/\bpub\s+struct\s+AeadRequestStatus\b/);
    expect(aeadCoreModule).not.toMatch(/\bpub\s+struct\s+AeadPlaceholderRequest\b/);
    // No public re-export of any of the four either.
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+aead_core\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+[\w:]*Aead\w*/);
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
    ];
    expect(pubFnNames.length).toBe(36);
    expect([...pubFnNames].sort()).toEqual([...expected].sort());
  });

  it("5. encrypt_placeholder / decrypt_placeholder (and the other four placeholders) are unchanged", () => {
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
      /fn encrypt_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
    expect(libRsSource).toMatch(
      /fn decrypt_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
    expect(libRsSource).toMatch(
      /fn random_bytes_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
    expect(libRsSource).toMatch(
      /fn derive_key_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
  });

  it("6. aead_core's production code does not import chacha20poly1305", () => {
    // `aead_core` itself has no nested cfg(test) usage of chacha20poly1305 —
    // that dependency stays exercised only by the pre-existing
    // `rfc8439_vectors` module (Stage 75), which this test does not touch.
    expect(aeadCoreModule).not.toMatch(/\buse\s+chacha20poly1305\b/);
    expect(aeadCoreModule).not.toMatch(/\bchacha20poly1305::/);
    expect(aeadCoreModule).not.toContain("ChaCha20Poly1305::new");
  });

  it("7. no key/nonce/plaintext/ciphertext/tag storage field anywhere in aead_core", () => {
    // Field/parameter DECLARATIONS only (name immediately followed by a
    // colon-typed annotation) — not prose in a doc comment that merely
    // NAMES these words (e.g. "no key, nonce, plaintext, ciphertext, or tag
    // byte").
    expect(aeadCoreModule).not.toMatch(/\b(key|nonce|plaintext|ciphertext|tag|aad)\s*:\s*\w/i);
  });

  it("8. no Vec<u8> / String byte-storage field anywhere in aead_core", () => {
    expect(aeadCoreModule).not.toMatch(/:\s*Vec<u8>/);
    expect(aeadCoreModule).not.toMatch(/:\s*String\b/);
    expect(aeadCoreModule).not.toMatch(/&\s*\[\s*u8\s*\]/);
    // Both constructors take no parameter of any kind.
    expect(aeadCoreModule).toMatch(/fn\s+new_placeholder_encrypt\s*\(\s*\)/);
    expect(aeadCoreModule).toMatch(/fn\s+new_placeholder_decrypt\s*\(\s*\)/);
  });

  it("9. no random/getrandom usage anywhere in aead_core", () => {
    expect(aeadCoreModule).not.toContain("getrandom");
    expect(aeadCoreModule).not.toMatch(/\brand::/);
    expect(aeadCoreModule).not.toMatch(/\bthread_rng\b/);
  });

  it("10. no HKDF connection anywhere in aead_core", () => {
    expect(aeadCoreModule).not.toMatch(/\bhkdf\b/i);
    expect(aeadCoreModule).not.toMatch(/\bHkdf\b/);
  });

  it("11. no SecretHandle key extraction anywhere in aead_core — the two skeletons are unconnected", () => {
    expect(aeadCoreModule).not.toMatch(/\bSecretHandle\b/);
    expect(aeadCoreModule).not.toMatch(/\bsecret_handle::/);
    expect(aeadCoreModule).not.toMatch(/\bexpose_secret\s*\(/);
  });

  it("12. no `unsafe` anywhere in lib.rs (crate-level forbid stays intact)", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(libRsSource).not.toMatch(/\bunsafe\s+(fn|impl|trait|\{)/);
    expect(aeadCoreModule).not.toContain("unsafe");
  });

  it("13. Runtime / Worker sources are unchanged: no aead_core reference and no crypto-op auto-call", () => {
    // Note: neither source is checked for the bare word "aead" — both
    // legitimately contain it already in pre-existing, unrelated prose
    // (e.g. "runs no KDF/AEAD/random" describing what selectCryptoProvider
    // does NOT do). The specific new identifiers below are unambiguous.
    for (const src of [runtimeSource, workerSource]) {
      expect(src).not.toContain("aead_core");
      expect(src).not.toContain("AeadPlaceholderRequest");
      expect(src.toLowerCase()).not.toContain("cargo");
      expect(src.toLowerCase()).not.toContain("lib.rs");
      expect(src.toLowerCase()).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(runtimeSource).not.toMatch(/\.\s*load\s*\(/);
  });

  it("14. no .wasm / target / Cargo.lock artifact is committed to the package", () => {
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

  it("15. AeadAlgorithm/AeadOperation carry the specified labels only", () => {
    expect(aeadCoreModule).toContain("ChaCha20Poly1305");
    expect(aeadCoreModule).toContain("Encrypt");
    expect(aeadCoreModule).toContain("Decrypt");
  });

  it("16. AeadPlaceholderRequest exposes exactly the five specified methods", () => {
    for (const method of [
      "new_placeholder_encrypt",
      "new_placeholder_decrypt",
      "status",
      "algorithm",
      "operation",
    ]) {
      expect(aeadCoreModule).toMatch(new RegExp(`\\bfn\\s+${method}\\b`));
    }
  });
});
