import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
import rfc9106Vectors from "../test-vectors/kdf/argon2id-rfc9106.json";

/**
 * Stage 85 — wire the RFC 9106 Argon2id vectors
 * (`test-vectors/kdf/argon2id-rfc9106.json`, imported Stage 73) to
 * `cargo test`, using the `argon2` dependency adopted Stage 84, following
 * the exact same pattern Stage 75/77 used for RFC 8439/RFC 5869.
 *
 * This is verification WIRING only: a new `#[cfg(test)]`-only module,
 * `rfc9106_vectors`, in `packages/fedos-core-rust/src/lib.rs` reads the
 * vector file and asserts the `argon2` dependency reproduces the RFC's
 * known-answer tag bytes when run as Argon2id. The crate's PUBLIC API
 * (`fedos_core_status`, `fedos_core_capabilities`, `random_bytes_placeholder`,
 * `derive_key_placeholder`, `encrypt_placeholder`, `decrypt_placeholder`) is
 * untouched and still implements no cryptography; nothing is wired into the
 * Runtime, the Worker, or `CryptoProvider`; no random/password/key is
 * generated; and there is still no public `deriveKey`/password-hashing
 * implementation.
 *
 * The vector's memory buffer is allocated with this crate's own `std::vec`
 * (via `argon2::Argon2::hash_password_into_with_memory`), NOT `argon2`'s
 * optional `alloc` feature — `argon2` stays adopted with
 * `default-features = false` and NO features enabled (unchanged from
 * Stage 84); `Cargo.toml` needed no change this stage. No new
 * `[dev-dependencies]` entry was needed either — `hex`/`serde`/`serde_json`
 * (Stage 75) already cover vector parsing and hex-decoding.
 *
 * `cargo test` (green as of this stage) and `cargo check` / `cargo check
 * --tests` are verified as their own separate commands outside `npm test`,
 * consistent with how this repo has always kept the Rust toolchain check
 * independent of the vitest/TypeScript test run.
 *
 * Update (Stage 86): the per-vector helper this file's test 5 named,
 * `run_argon2id_for_vector`, was renamed and reshaped into
 * `derive_argon2id_for_test` (a byte-level helper matching the
 * `_for_test`-suffix convention Stage 81/83 established for the AEAD/HKDF
 * modules) — test 5 below now checks the new name. See
 * test/fedos_core_rust_argon2_test_helper.test.ts for the dedicated
 * Stage 86 checks.
 */
describe("FedOS Rust crate — RFC 9106 Argon2id vectors wired to cargo test", () => {
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

  // TOML comments legitimately NAME both allowed and still-forbidden crates;
  // strip comments before scanning (same approach as the other Rust tests).
  const cargoCode: string = cargoTomlSource
    .split("\n")
    .map((line: string) => line.replace(/#.*$/, ""))
    .join("\n")
    .toLowerCase();

  const firstCfgTestIdx = libRsSource.indexOf("#[cfg(test)]");
  const productionLibRs =
    firstCfgTestIdx === -1 ? libRsSource : libRsSource.slice(0, firstCfgTestIdx);
  const testOnlyLibRs = firstCfgTestIdx === -1 ? "" : libRsSource.slice(firstCfgTestIdx);
  const rfc9106Module = extractModule(libRsSource, "mod rfc9106_vectors");
  const kdfCoreModule = extractModule(libRsSource, "mod kdf_core");

  it("1. lib.rs contains a #[cfg(test)] module wired to the RFC 9106 vector file", () => {
    expect(firstCfgTestIdx).toBeGreaterThan(-1);
    expect(libRsSource).toContain("mod rfc9106_vectors");
    expect(testOnlyLibRs).toContain("mod rfc9106_vectors");
    // Actually imports and uses the argon2 dependency — but only inside the
    // #[cfg(test)]-scoped tail of the file.
    expect(rfc9106Module).toMatch(/\buse\s+argon2::/);
    expect(rfc9106Module).toContain("Argon2id");
  });

  it("2. the RFC 9106 vector file is read via include_str! (no filesystem IO at test runtime)", () => {
    expect(libRsSource).toMatch(
      /include_str!\(\s*"\.\.\/\.\.\/\.\.\/test-vectors\/kdf\/argon2id-rfc9106\.json"\s*\)/,
    );
    expect(rfc9106Module).toContain("include_str!");
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
    expect(productionLibRs).not.toContain("rfc9106_vectors");
  });

  it("4. production kdf_core remains placeholder-only, unconnected to the RFC 9106 wiring", () => {
    expect(kdfCoreModule).not.toMatch(/\buse\s+argon2\b/);
    expect(kdfCoreModule).not.toMatch(/\bargon2::/i);
    expect(kdfCoreModule).not.toMatch(/\bArgon2::/);
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
    ];
    expect(pubFnNames.length).toBe(22);
    expect([...pubFnNames].sort()).toEqual([...expected].sort());
    // The #[cfg(test)] module's own test/helper functions are not `pub`.
    expect(testOnlyLibRs).not.toMatch(/\bpub\s+fn\s+rfc9106/);
    // Stage 86 extracts the Argon2id derivation logic into
    // `derive_argon2id_for_test` — see
    // test/fedos_core_rust_argon2_test_helper.test.ts for its dedicated
    // checks; this test only asserts it (like every other test-only
    // function here) is never `pub`.
    expect(testOnlyLibRs).not.toMatch(/\bpub\s+fn\s+derive_argon2id_for_test\b/);
  });

  it("6. derive_key_placeholder is unchanged: still a no-op placeholder, no Argon2 call", () => {
    expect(libRsSource).toMatch(
      /fn derive_key_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
  });

  it("7. no production password/salt/secret/associatedData/tag storage field anywhere in kdf_core", () => {
    // Field/parameter DECLARATIONS only (name immediately followed by a
    // colon-typed annotation) — not prose in a doc comment. The
    // rfc9106_vectors module's own test-only Vector struct fields
    // (password/salt/secret/etc.) are expected and out of scope here — this
    // check is specific to the production kdf_core skeleton.
    expect(kdfCoreModule).not.toMatch(
      /\b(password|salt|secret|associated_data|tag|ikm|info|prk|okm)\s*:\s*\w/i,
    );
    expect(kdfCoreModule).not.toMatch(/:\s*Vec<u8>/);
    expect(kdfCoreModule).not.toMatch(/:\s*String\b/);
    expect(kdfCoreModule).not.toMatch(/&\s*\[\s*u8\s*\]/);
  });

  it("8. argon2's own feature list has no direct rand opt-in", () => {
    // Scoped to argon2's own dependency LINE, not the whole file: Stage
    // 104 separately adopts `getrandom` itself as this crate's own,
    // independent CSPRNG entry — see test/fedos_core_rust_dependency.test.ts
    // for the dedicated Stage 104 checks — so a whole-file "does not
    // contain getrandom" no longer holds, even though argon2's own
    // `default-features = false` (excluding its default `rand` feature)
    // still does.
    const argon2Line = cargoCode.split("\n").find((line: string) => /^\s*argon2\s*=/.test(line));
    expect(argon2Line, "expected to find the argon2 dependency line").toBeTruthy();
    expect(argon2Line).not.toContain("rand");
    expect(cargoCode).not.toContain("rand_core");
  });

  it("9. the password-hash feature is not enabled on argon2", () => {
    expect(cargoCode).toContain("[dependencies]");
    const depsSection = cargoCode.slice(
      cargoCode.indexOf("[dependencies]"),
      cargoCode.indexOf("[dev-dependencies]") === -1
        ? undefined
        : cargoCode.indexOf("[dev-dependencies]"),
    );
    const argon2Line = depsSection
      .split("\n")
      .find((line: string) => /^\s*argon2\s*=/.test(line));
    expect(argon2Line, "expected to find the argon2 dependency line").toBeTruthy();
    expect(argon2Line).toContain("default-features");
    expect(argon2Line).toMatch(/default-features\s*=\s*false/);
    expect(argon2Line).not.toContain("password-hash");
    expect(argon2Line).not.toContain('"rand"');
    expect(argon2Line).not.toContain('"alloc"');
  });

  it("10. Runtime / Worker sources are unchanged: no argon2/rfc9106 reference and no crypto-op auto-call", () => {
    for (const src of [runtimeSource, workerSource]) {
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

  it("11. no .wasm / Cargo.lock / target / build artifact is committed to the package", () => {
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

  it("12. the imported RFC 9106 vector file used by cargo test has at least one shouldPass=true case", () => {
    // Sanity check on the same file lib.rs's include_str! points at: this
    // repo's test suite and the Rust test must be exercising a real,
    // non-empty vector set.
    const vectors = (rfc9106Vectors as { vectors: Array<{ shouldPass: boolean }> }).vectors;
    expect(Array.isArray(vectors)).toBe(true);
    expect(vectors.some((v) => v.shouldPass === true)).toBe(true);
  });
});
