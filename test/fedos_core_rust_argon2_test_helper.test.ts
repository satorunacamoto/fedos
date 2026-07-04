import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 86 — extract a test-only Argon2id helper.
 *
 * `packages/fedos-core-rust/src/lib.rs`'s pre-existing `cfg(test)`-only
 * `rfc9106_vectors` module (Stage 85) is refactored: the Argon2id derivation
 * logic that used to be written as a per-vector helper
 * (`run_argon2id_for_vector(vector: &Vector)`) is now a single, private,
 * test-only helper function taking raw bytes,
 * `derive_argon2id_for_test(password_bytes, salt_bytes, secret_bytes,
 * associated_data_bytes, memory_cost_kib, time_cost, parallelism,
 * output_len) -> argon2::Result<Vec<u8>>` — mirroring the byte-level shape
 * and `_for_test` naming convention Stage 81/83 established for the
 * AEAD/HKDF modules (`seal_chacha20poly1305_for_test`,
 * `extract_hkdf_sha256_for_test`). It exists ONLY inside the
 * `cfg(test)`-only `rfc9106_vectors` module — a private `fn`, never
 * `pub`/`pub(crate)`, never re-exported — and is NOT connected to the
 * crate-private `kdf_core` skeleton (Stage 82) or `secret_handle`
 * (Stage 79) in any way.
 *
 * This is a test-only refactor, not a new capability: the two pre-existing
 * `rfc9106_vectors` tests still assert exactly what they asserted before
 * (Stage 85's known-answer check), just calling the shared helper instead
 * of building an `argon2::Argon2` inline per vector. Two new unit tests
 * exercise the helper directly, independent of the vector file. The
 * crate's PUBLIC API (`fedos_core_status`, `fedos_core_capabilities`,
 * `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
 * `decrypt_placeholder`) is untouched; `kdf_core` (Stage 82) remains a
 * placeholder-only skeleton; nothing is wired into the Runtime, the Worker,
 * or `CryptoProvider`.
 *
 * `cargo test` (green as of this stage, including the two new helper unit
 * tests) and `cargo check` / `cargo check --tests` are verified as their
 * own separate commands outside `npm test`, consistent with how this repo
 * has always kept the Rust toolchain check independent of the
 * vitest/TypeScript test run.
 */
describe("FedOS Rust crate — test-only Argon2id helper", () => {
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
  const rfc9106Module = extractModule(libRsSource, "mod rfc9106_vectors");
  const kdfCoreModule = extractModule(libRsSource, "mod kdf_core");

  it("1. the test-only Argon2id helper exists after the first #[cfg(test)]", () => {
    expect(firstCfgTestIdx).toBeGreaterThan(-1);
    expect(testOnlyLibRs).toContain("fn derive_argon2id_for_test");
    // Lives inside the rfc9106_vectors module specifically.
    expect(rfc9106Module).toContain("fn derive_argon2id_for_test");
  });

  it("2. the helper name includes `_for_test` and is private (not pub/pub(crate))", () => {
    expect(rfc9106Module).toMatch(/\bfn\s+derive_argon2id_for_test\b/);
    expect(rfc9106Module).not.toMatch(/\bpub\s+fn\s+derive_argon2id_for_test\b/);
    expect(rfc9106Module).not.toMatch(/\bpub\(crate\)\s+fn\s+derive_argon2id_for_test\b/);
    // Never re-exported from the crate root.
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+[\w:]*argon2id_for_test\b/);
  });

  it("3. production code (before the first #[cfg(test)]) has no Argon2 usage", () => {
    // `\bArgon2\b` (a bare, case-matched word) is deliberately NOT checked
    // here: this crate's PRE-EXISTING doc comments (Stage 69's crate-level
    // summary, Stage 79's `secret_handle` doc) already legitimately say
    // "Argon2" in plain English prose describing what the crate does NOT
    // do — not a Rust code reference. `Argon2::`/`Argon2<`/`argon2::` are
    // actual Rust usage patterns and would not appear in that prose.
    expect(productionLibRs).not.toMatch(/\buse\s+argon2\b/);
    expect(productionLibRs).not.toMatch(/\bargon2::/i);
    expect(productionLibRs).not.toMatch(/\bArgon2::/);
    expect(productionLibRs).not.toMatch(/\bArgon2</);
    expect(productionLibRs).not.toContain("derive_argon2id_for_test");
    expect(productionLibRs).not.toContain("rfc9106_vectors");
  });

  it("4. production code (before the first #[cfg(test)]) has no password/salt/tag fields", () => {
    // Field/parameter DECLARATIONS only (name immediately followed by a
    // colon-typed annotation) — not prose in a doc comment.
    expect(productionLibRs).not.toMatch(
      /\b(password|salt|secret|associated_data|tag)\s*:\s*\w/i,
    );
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
      "fedos_key_usage_descriptor_placeholder",
      "fedos_algorithm_requirements",
      "fedos_algorithm_capabilities",
      "fedos_algorithm_policy_decision",
      "fedos_random_bytes_32",
      "fedos_aead_nonce_96",
      "fedos_encrypt",
      "fedos_decrypt",
    ];
    expect(pubFnNames.length).toBe(26);
    expect([...pubFnNames].sort()).toEqual([...expected].sort());
  });

  it("6. production kdf_core remains placeholder-only, unconnected to the new helper", () => {
    expect(kdfCoreModule).not.toMatch(/\buse\s+argon2\b/);
    expect(kdfCoreModule).not.toMatch(/\bargon2::/i);
    expect(kdfCoreModule).not.toContain("derive_argon2id_for_test");
    expect(kdfCoreModule).not.toContain("rfc9106_vectors");
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

  it("7. no production password KDF implementation: derive_key_placeholder is unchanged", () => {
    expect(libRsSource).toMatch(
      /fn derive_key_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
    // No pub fn anywhere takes password/salt bytes in or returns a derived
    // key — the six placeholder names are the entire public surface (see
    // test 5 above), and none of them is a real Argon2id/KDF entry point.
  });

  it("8. Runtime / Worker sources are unchanged: no test-helper reference and no crypto-op auto-call", () => {
    for (const src of [runtimeSource, workerSource]) {
      expect(src).not.toContain("derive_argon2id_for_test");
      expect(src.toLowerCase()).not.toContain("argon2");
      expect(src.toLowerCase()).not.toContain("rfc9106");
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

  it("10. the helper's Result-returning signature is used by both vector tests (positive and negative)", () => {
    expect(rfc9106Module).toMatch(
      /derive_argon2id_for_test\(\s*&password_bytes,\s*&salt_bytes,\s*&secret_bytes,\s*&ad_bytes,\s*vector\.memory_kib,\s*vector\.iterations,\s*vector\.parallelism,\s*vector\.tag_length,?\s*\)/,
    );
    expect(rfc9106Module).toContain("-> argon2::Result<Vec<u8>>");
  });
});
