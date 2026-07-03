import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 83 — extract a test-only HKDF-SHA256 helper.
 *
 * `packages/fedos-core-rust/src/lib.rs`'s pre-existing `cfg(test)`-only
 * `rfc5869_vectors` module (Stage 77) is refactored: the HKDF-SHA256
 * extract/expand logic that used to be written inline (and duplicated) in
 * its two vector tests is now three small, private, test-only helper
 * functions, `extract_hkdf_sha256_for_test`, `expand_hkdf_sha256_for_test`,
 * and `extract_expand_hkdf_sha256_for_test`. All three exist ONLY inside
 * that `cfg(test)`-only module — private `fn`s, never `pub`/`pub(crate)`,
 * never re-exported — and are NOT connected to the crate-private `kdf_core`
 * skeleton (Stage 82) or `secret_handle`/`aead_core` in any way.
 *
 * This is a test-only refactor, not a new capability — the KDF-side
 * analogue of Stage 81's AEAD-side `rfc8439_vectors` refactor: the two
 * pre-existing `rfc5869_vectors` tests still assert exactly what they
 * asserted before (Stage 77's known-answer checks), just calling the shared
 * helpers instead of constructing an `Hkdf<Sha256>` inline twice. Two new
 * unit tests exercise the helpers directly, independent of the vector file.
 * The crate's PUBLIC API (`fedos_core_status`, `fedos_core_capabilities`,
 * `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
 * `decrypt_placeholder`) is untouched; `kdf_core` (Stage 82) remains a
 * placeholder-only skeleton; nothing is wired into the Runtime, the Worker,
 * or `CryptoProvider`.
 *
 * `cargo test` (green as of this stage, including the two new helper unit
 * tests) and `cargo check` / `cargo check --tests` are verified as their own
 * separate commands outside `npm test`, consistent with how this repo has
 * always kept the Rust toolchain check independent of the vitest/TypeScript
 * test run.
 */
describe("FedOS Rust crate — test-only HKDF-SHA256 helper", () => {
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
  const rfc5869Module = extractModule(libRsSource, "mod rfc5869_vectors");
  const kdfCoreModule = extractModule(libRsSource, "mod kdf_core");

  it("1. the test-only HKDF-SHA256 helpers exist after the first #[cfg(test)]", () => {
    expect(firstCfgTestIdx).toBeGreaterThan(-1);
    expect(testOnlyLibRs).toContain("fn extract_hkdf_sha256_for_test");
    expect(testOnlyLibRs).toContain("fn expand_hkdf_sha256_for_test");
    expect(testOnlyLibRs).toContain("fn extract_expand_hkdf_sha256_for_test");
    // All three live inside the rfc5869_vectors module specifically.
    expect(rfc5869Module).toContain("fn extract_hkdf_sha256_for_test");
    expect(rfc5869Module).toContain("fn expand_hkdf_sha256_for_test");
    expect(rfc5869Module).toContain("fn extract_expand_hkdf_sha256_for_test");
  });

  it("2. the helper names include `_for_test` and are private (not pub/pub(crate))", () => {
    for (const name of [
      "extract_hkdf_sha256_for_test",
      "expand_hkdf_sha256_for_test",
      "extract_expand_hkdf_sha256_for_test",
    ]) {
      expect(rfc5869Module).toMatch(new RegExp(`\\bfn\\s+${name}\\b`));
      expect(rfc5869Module).not.toMatch(new RegExp(`\\bpub\\s+fn\\s+${name}\\b`));
      expect(rfc5869Module).not.toMatch(new RegExp(`\\bpub\\(crate\\)\\s+fn\\s+${name}\\b`));
    }
    // Never re-exported from the crate root.
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+[\w:]*hkdf_sha256_for_test\b/);
  });

  it("3. production code (before the first #[cfg(test)]) has no hkdf import or reference", () => {
    expect(productionLibRs).not.toMatch(/\buse\s+hkdf\b/);
    expect(productionLibRs).not.toMatch(/\bhkdf::/);
    expect(productionLibRs).not.toMatch(/\bHkdf::/);
    expect(productionLibRs).not.toContain("extract_hkdf_sha256_for_test");
    expect(productionLibRs).not.toContain("expand_hkdf_sha256_for_test");
    expect(productionLibRs).not.toContain("extract_expand_hkdf_sha256_for_test");
  });

  it("4. production code (before the first #[cfg(test)]) has no sha2 import or reference", () => {
    expect(productionLibRs).not.toMatch(/\buse\s+sha2\b/);
    expect(productionLibRs).not.toMatch(/\bsha2::/);
    expect(productionLibRs).not.toContain("Sha256::new");
  });

  it("5. lib.rs's public `pub fn` surface is still exactly the six Stage 69 functions", () => {
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
    ];
    expect(pubFnNames.length).toBe(18);
    expect([...pubFnNames].sort()).toEqual([...expected].sort());
  });

  it("6. production kdf_core remains placeholder-only, unconnected to the new helpers", () => {
    // Stage 82's skeleton is untouched: no hkdf/sha2 import, no reference to
    // the new test-only helper names, and its six methods are unchanged.
    expect(kdfCoreModule).not.toMatch(/\buse\s+hkdf\b/);
    expect(kdfCoreModule).not.toMatch(/\bhkdf::/);
    expect(kdfCoreModule).not.toMatch(/\buse\s+sha2\b/);
    expect(kdfCoreModule).not.toMatch(/\bsha2::/);
    expect(kdfCoreModule).not.toContain("extract_hkdf_sha256_for_test");
    expect(kdfCoreModule).not.toContain("expand_hkdf_sha256_for_test");
    expect(kdfCoreModule).not.toContain("extract_expand_hkdf_sha256_for_test");
    for (const method of [
      "new_placeholder_extract",
      "new_placeholder_expand",
      "new_placeholder_extract_expand",
      "status",
      "algorithm",
      "operation",
    ]) {
      expect(kdfCoreModule).toMatch(new RegExp(`\\bfn\\s+${method}\\b`));
    }
  });

  it("7. no production IKM/salt/info/PRK/OKM storage field anywhere in kdf_core", () => {
    // Field/parameter DECLARATIONS only (name immediately followed by a
    // colon-typed annotation) — not prose in a doc comment. The
    // rfc5869_vectors module's test-only helper PARAMETERS (ikm_bytes: &[u8],
    // etc.) are expected and out of scope here — this check is specific to
    // the production kdf_core skeleton, which must still hold no such field.
    expect(kdfCoreModule).not.toMatch(/\b(ikm|salt|info|prk|okm|secret)\s*:\s*\w/i);
    expect(kdfCoreModule).not.toMatch(/:\s*Vec<u8>/);
    expect(kdfCoreModule).not.toMatch(/:\s*String\b/);
    expect(kdfCoreModule).not.toMatch(/&\s*\[\s*u8\s*\]/);
  });

  it("8. Runtime / Worker sources are unchanged: no test-helper reference and no crypto-op auto-call", () => {
    for (const src of [runtimeSource, workerSource]) {
      expect(src).not.toContain("extract_hkdf_sha256_for_test");
      expect(src).not.toContain("expand_hkdf_sha256_for_test");
      expect(src).not.toContain("extract_expand_hkdf_sha256_for_test");
      expect(src).not.toContain("rfc5869");
      expect(src.toLowerCase()).not.toContain("cargo");
      expect(src.toLowerCase()).not.toContain("lib.rs");
      expect(src.toLowerCase()).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(runtimeSource).not.toMatch(/\.\s*load\s*\(/);
  });

  it("9. no .wasm / target / Cargo.lock artifact is committed to the package", () => {
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

  it("10. the helper's Result-returning signatures are used by both vector tests (positive and negative)", () => {
    expect(rfc5869Module).toMatch(
      /extract_hkdf_sha256_for_test\(\s*&ikm_bytes,\s*&salt_bytes,?\s*\)/,
    );
    expect(rfc5869Module).toMatch(
      /expand_hkdf_sha256_for_test\(\s*&prk_bytes,\s*&info_bytes,\s*vector\.length,?\s*\)/,
    );
    expect(rfc5869Module).toMatch(
      /extract_expand_hkdf_sha256_for_test\(\s*&ikm_bytes,\s*&salt_bytes,\s*&info_bytes,\s*vector\.length,?\s*\)/,
    );
    expect(rfc5869Module).toContain("Result<Vec<u8>, InvalidLength>");
    expect(rfc5869Module).toContain("Result<(Vec<u8>, Vec<u8>), InvalidLength>");
  });
});
