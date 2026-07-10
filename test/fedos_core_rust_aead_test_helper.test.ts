import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 81 — extract a test-only ChaCha20-Poly1305 helper.
 *
 * `packages/fedos-core-rust/src/lib.rs`'s pre-existing `cfg(test)`-only
 * `rfc8439_vectors` module (Stage 75) is refactored: the seal/open logic
 * that used to be written inline (and duplicated) in its two vector tests is
 * now two small, private, test-only helper functions,
 * `seal_chacha20poly1305_for_test` and `open_chacha20poly1305_for_test`. Both
 * exist ONLY inside that `cfg(test)`-only module — private `fn`s, never
 * `pub`/`pub(crate)`, never re-exported — and are NOT connected to the
 * crate-private `aead_core` skeleton (Stage 80) or `secret_handle` (Stage
 * 79) in any way.
 *
 * This is a test-only refactor, not a new capability: the two pre-existing
 * `rfc8439_vectors` tests still assert exactly what they asserted before
 * (Stage 75's known-answer checks), just calling the shared helper instead
 * of constructing a `Key`/`Nonce`/`ChaCha20Poly1305` inline twice. Two new
 * unit tests exercise the helpers directly, independent of the vector file.
 * The crate's PUBLIC API (`fedos_core_status`, `fedos_core_capabilities`,
 * `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
 * `decrypt_placeholder`) is untouched; `aead_core` (Stage 80) remains a
 * placeholder-only skeleton; nothing is wired into the Runtime, the Worker,
 * or `CryptoProvider`.
 *
 * `cargo test` (green as of this stage, including the two new helper unit
 * tests) and `cargo check` / `cargo check --tests` are verified as their own
 * separate commands outside `npm test`, consistent with how this repo has
 * always kept the Rust toolchain check independent of the vitest/TypeScript
 * test run.
 */
describe("FedOS Rust crate — test-only ChaCha20-Poly1305 helper", () => {
  /** Extracts a `mod name { ... }` block via brace matching (robust to
   * nested `{}` inside, e.g. a module's own nested `#[cfg(test)]`). */
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

  const firstCfgTestIdx = libRsSource.indexOf("#[cfg(test)]");
  const productionLibRs =
    firstCfgTestIdx === -1 ? libRsSource : libRsSource.slice(0, firstCfgTestIdx);
  const testOnlyLibRs = firstCfgTestIdx === -1 ? "" : libRsSource.slice(firstCfgTestIdx);
  const rfc8439Module = extractModule(libRsSource, "mod rfc8439_vectors");
  const aeadCoreModule = extractModule(libRsSource, "mod aead_core");

  it("1. the test-only ChaCha20-Poly1305 helper exists after the first #[cfg(test)]", () => {
    expect(firstCfgTestIdx).toBeGreaterThan(-1);
    expect(testOnlyLibRs).toContain("fn seal_chacha20poly1305_for_test");
    expect(testOnlyLibRs).toContain("fn open_chacha20poly1305_for_test");
    // Both live inside the rfc8439_vectors module specifically.
    expect(rfc8439Module).toContain("fn seal_chacha20poly1305_for_test");
    expect(rfc8439Module).toContain("fn open_chacha20poly1305_for_test");
  });

  it("2. the helper names include `_for_test` and are private (not pub/pub(crate))", () => {
    expect(rfc8439Module).toMatch(/\bfn\s+seal_chacha20poly1305_for_test\b/);
    expect(rfc8439Module).toMatch(/\bfn\s+open_chacha20poly1305_for_test\b/);
    expect(rfc8439Module).not.toMatch(/\bpub\s+fn\s+seal_chacha20poly1305_for_test\b/);
    expect(rfc8439Module).not.toMatch(/\bpub\s+fn\s+open_chacha20poly1305_for_test\b/);
    expect(rfc8439Module).not.toMatch(/\bpub\(crate\)\s+fn\s+seal_chacha20poly1305_for_test\b/);
    expect(rfc8439Module).not.toMatch(/\bpub\(crate\)\s+fn\s+open_chacha20poly1305_for_test\b/);
    // Never re-exported from the crate root.
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+[\w:]*chacha20poly1305_for_test\b/);
  });

  it("3. production code (before the first #[cfg(test)]) has no chacha20poly1305 import or reference", () => {
    // Specific crate-usage patterns only — NOT a bare substring match:
    // Stage 102's public `FedosCryptoAlgorithm::ChaCha20Poly1305` label
    // legitimately contains "chacha"/"poly1305" without importing or
    // calling the crate (see
    // test/fedos_core_rust_public_api_boundary.test.ts for the dedicated
    // Stage 102 checks).
    expect(productionLibRs).not.toMatch(/\buse\s+chacha20poly1305\b/);
    expect(productionLibRs).not.toMatch(/\bchacha20poly1305::/);
    expect(productionLibRs).not.toMatch(/\bChaCha20Poly1305::new\b/);
    expect(productionLibRs).not.toContain("seal_chacha20poly1305_for_test");
    expect(productionLibRs).not.toContain("open_chacha20poly1305_for_test");
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

  it("5. production aead_core remains placeholder-only, unconnected to the new helper", () => {
    // Stage 80's skeleton is untouched: no chacha20poly1305 import, no
    // reference to the new test-only helper names, and its five methods are
    // unchanged.
    expect(aeadCoreModule).not.toMatch(/\buse\s+chacha20poly1305\b/);
    expect(aeadCoreModule).not.toMatch(/\bchacha20poly1305::/);
    expect(aeadCoreModule).not.toContain("seal_chacha20poly1305_for_test");
    expect(aeadCoreModule).not.toContain("open_chacha20poly1305_for_test");
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

  it("6. no production key/nonce/plaintext/ciphertext/tag storage field anywhere in aead_core", () => {
    // Field/parameter DECLARATIONS only (name immediately followed by a
    // colon-typed annotation) — not prose in a doc comment. The rfc8439_vectors
    // module's test-only helper PARAMETERS (key_bytes: &[u8], etc.) are
    // expected and out of scope here — this check is specific to the
    // production aead_core skeleton, which must still hold no such field.
    expect(aeadCoreModule).not.toMatch(
      /\b(key|nonce|plaintext|ciphertext|tag|aad)\s*:\s*\w/i,
    );
    expect(aeadCoreModule).not.toMatch(/:\s*Vec<u8>/);
    expect(aeadCoreModule).not.toMatch(/:\s*String\b/);
    expect(aeadCoreModule).not.toMatch(/&\s*\[\s*u8\s*\]/);
  });

  it("7. Runtime / Worker sources are unchanged: no test-helper reference and no crypto-op auto-call", () => {
    for (const src of [runtimeSource, workerSource]) {
      expect(src).not.toContain("seal_chacha20poly1305_for_test");
      expect(src).not.toContain("open_chacha20poly1305_for_test");
      expect(src).not.toContain("rfc8439");
      expect(src.toLowerCase()).not.toContain("cargo");
      expect(src.toLowerCase()).not.toContain("lib.rs");
      expect(src.toLowerCase()).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(runtimeSource).not.toMatch(/\.\s*load\s*\(/);
  });

  it("8. no .wasm / target / Cargo.lock artifact is committed to the package", () => {
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

  it("9. the helper's Result-returning signature is used by both vector tests (positive and negative)", () => {
    expect(rfc8439Module).toMatch(
      /seal_chacha20poly1305_for_test\(\s*&key_bytes,\s*&nonce_bytes,\s*&plaintext_bytes,\s*&aad_bytes,?\s*\)/,
    );
    expect(rfc8439Module).toMatch(
      /open_chacha20poly1305_for_test\(\s*&key_bytes,\s*&nonce_bytes,\s*&(expected_sealed|sealed),\s*&aad_bytes,?\s*\)/,
    );
    expect(rfc8439Module).toContain("-> Result<Vec<u8>, AeadError>");
  });
});
