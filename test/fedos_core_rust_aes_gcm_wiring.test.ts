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
import aes256gcmVectors from "../test-vectors/aead/aes256gcm-nist.json";

/**
 * Stage 101 — adopt the `aes-gcm` dependency AND wire the NIST CAVP
 * AES-256-GCM known-answer vectors
 * (`test-vectors/aead/aes256gcm-nist.json`, imported Stage 73) to
 * `cargo test`, WITH its seal/open test-only helper extracted from the
 * start — all in one Stage, unlike `chacha20poly1305` (adopted Stage 74,
 * wired Stage 75, helper extracted Stage 81) or `argon2` (adopted Stage 84,
 * wired Stage 85, helper extracted Stage 86).
 *
 * This is a dependency-adoption + verification-WIRING combination only: a
 * new `#[cfg(test)]`-only module (`aes256gcm_vectors`) in
 * `packages/fedos-core-rust/src/lib.rs` reads the vector file and asserts
 * the `aes-gcm` dependency reproduces the NIST known-answer bytes, via two
 * private, test-only helpers (`seal_aes256gcm_for_test` /
 * `open_aes256gcm_for_test`) that exist ONLY inside that module. The
 * crate's PUBLIC API (`fedos_core_status`, `fedos_core_capabilities`,
 * `random_bytes_placeholder`, `derive_key_placeholder`,
 * `encrypt_placeholder`, `decrypt_placeholder`) is untouched and still
 * implements no cryptography; the crate-private `aead_core` skeleton
 * (Stage 80) remains placeholder-only and unconnected to this module;
 * nothing is wired into the Runtime, the Worker, or `CryptoProvider`; no
 * random/nonce/key is generated.
 *
 * `cargo test` (green as of this stage) and `cargo check` / `cargo check
 * --tests` are verified as their own separate commands outside `npm test`,
 * consistent with how this repo has always kept the Rust toolchain check
 * independent of the vitest/TypeScript test run.
 */
describe("FedOS Rust crate — AES-256-GCM dependency adoption + NIST vector wiring", () => {
  // TOML comments legitimately NAME both allowed and still-forbidden crates;
  // strip comments before scanning (same approach as the other Rust tests).
  const cargoCode: string = cargoTomlSource
    .split("\n")
    .map((line: string) => line.replace(/#.*$/, ""))
    .join("\n")
    .toLowerCase();

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

  const firstCfgTestIdx = libRsSource.indexOf("#[cfg(test)]");
  const productionLibRs =
    firstCfgTestIdx === -1 ? libRsSource : libRsSource.slice(0, firstCfgTestIdx);
  const testOnlyLibRs = firstCfgTestIdx === -1 ? "" : libRsSource.slice(firstCfgTestIdx);
  const aes256gcmModule = extractModule(libRsSource, "mod aes256gcm_vectors");
  const aeadCoreModule = extractModule(libRsSource, "mod aead_core");

  it("1. Cargo.toml's [dependencies] (production) table contains aes-gcm", () => {
    expect(cargoCode).toContain("[dependencies]");
    const depsSection = cargoCode.slice(cargoCode.indexOf("[dependencies]"));
    const nextSectionIdx = depsSection.indexOf("\n[", 1);
    const productionDepsSection =
      nextSectionIdx === -1 ? depsSection : depsSection.slice(0, nextSectionIdx);
    expect(productionDepsSection).toMatch(/aes-gcm\s*=/);
  });

  it("2. production dependencies include aes-gcm — at least the seven entries as of this Stage (later stages may add more)", () => {
    const depsSection = cargoCode.slice(cargoCode.indexOf("[dependencies]"));
    const nextSectionIdx = depsSection.indexOf("\n[", 1);
    const productionDepsSection =
      nextSectionIdx === -1 ? depsSection : depsSection.slice(0, nextSectionIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    // Not an exact count here — Stage 104 later adds an eighth entry
    // (`getrandom`); see test/fedos_core_rust_dependency.test.ts for the
    // authoritative current total.
    expect(depLines.length).toBeGreaterThanOrEqual(7);
    for (const dep of [
      "chacha20poly1305",
      "hkdf",
      "zeroize",
      "secrecy",
      "subtle",
      "argon2",
      "aes-gcm",
    ]) {
      expect(
        depLines.some((line: string) => line.includes(dep)),
        `expected ${dep} in the production [dependencies] table`,
      ).toBe(true);
    }
  });

  it("3. aes-gcm's own feature list has no direct rand/getrandom opt-in", () => {
    // `aes-gcm`'s `default-features = false`, `features = ["aes", "alloc"]`
    // explicitly excludes its optional `getrandom` feature — see the
    // Cargo.toml comment above the `aes-gcm` entry. Scoped to aes-gcm's own
    // dependency LINE, not the whole file: Stage 104 separately adopts
    // `getrandom` itself as this crate's own, independent CSPRNG entry —
    // see test/fedos_core_rust_dependency.test.ts for the dedicated Stage
    // 104 checks — so a whole-file "does not contain getrandom" no longer
    // holds, even though aes-gcm's own feature opt-out still does.
    const aesGcmLine = cargoCode
      .split("\n")
      .find((line: string) => /^\s*aes-gcm\s*=/.test(line));
    expect(aesGcmLine, "expected to find the aes-gcm dependency line").toBeTruthy();
    expect(aesGcmLine).not.toContain("getrandom");
    expect(cargoCode).not.toContain("rand_core");
    expect(cargoCode).not.toMatch(/\brand\b/);
  });

  it("4. crate-type is rlib + cdylib (Stage 466 -- WASM artifact generation fix), never wasm32 as a literal dependency/config token (wasm-bindgen became a real dependency at Stage 985, see test/runtime_wasm_rust_export_bindgen_dependency.test.ts)", () => {
    expect(cargoCode).toMatch(/crate-type\s*=\s*\[\s*"rlib"\s*,\s*"cdylib"\s*\]/);
    expect(cargoCode).not.toContain("wasm32");
  });

  it("5. the AES-256-GCM test module is gated behind #[cfg(test)] only", () => {
    expect(firstCfgTestIdx).toBeGreaterThan(-1);
    expect(libRsSource).toContain("mod aes256gcm_vectors");
    // The module marker itself only appears after the first #[cfg(test)].
    expect(productionLibRs).not.toContain("mod aes256gcm_vectors");
    expect(testOnlyLibRs).toContain("mod aes256gcm_vectors");
  });

  it("6. production code (before the first #[cfg(test)]) never imports or calls aes-gcm", () => {
    // Specific Rust-usage/crate-name patterns only, NOT a bare "aes"/"gcm"
    // substring match: as of Stage 102, production code legitimately
    // contains the public, non-sensitive `FedosCryptoAlgorithm::Aes256Gcm`
    // label (see test/fedos_core_rust_public_api_boundary.test.ts for the
    // dedicated Stage 102 checks) — it names the algorithm without
    // importing or calling any AEAD crate. `Aes256Gcm::new` (an actual
    // cipher-construction call) remains forbidden.
    expect(productionLibRs).not.toMatch(/\buse\s+aes_gcm\b/);
    expect(productionLibRs).not.toMatch(/\baes_gcm::/);
    expect(productionLibRs).not.toMatch(/\bAes256Gcm::new\b/);
    expect(productionLibRs).not.toMatch(/\buse\s+chacha20poly1305\b/);
    expect(productionLibRs).not.toMatch(/\bchacha20poly1305::/);
    expect(productionLibRs).not.toMatch(/\bChaCha20Poly1305::new\b/);
  });

  it("7. lib.rs's public pub fn surface is exactly the six Stage 69 functions plus Stage 102's new one", () => {
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
    ];
    expect(pubFnNames.length).toBe(33);
    expect([...pubFnNames].sort()).toEqual([...expected].sort());
  });

  it("8. production API placeholders are unchanged, including encrypt_placeholder/decrypt_placeholder", () => {
    for (const fn of [
      "pub fn fedos_core_status() -> FedosCoreStatus",
      "pub fn fedos_core_capabilities() -> &'static [&'static str]",
      "pub fn random_bytes_placeholder() -> FedosCoreStatus",
      "pub fn derive_key_placeholder() -> FedosCoreStatus",
      "pub fn encrypt_placeholder() -> FedosCoreStatus",
      "pub fn decrypt_placeholder() -> FedosCoreStatus",
    ]) {
      expect(productionLibRs, `expected unchanged signature: ${fn}`).toContain(fn);
    }
    expect(productionLibRs).toMatch(
      /fn encrypt_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
    expect(productionLibRs).toMatch(
      /fn decrypt_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
  });

  it("9. aead_core remains unchanged and still placeholder-only, unconnected to the AES-256-GCM module", () => {
    expect(aeadCoreModule).not.toMatch(/\baes_gcm\b/);
    expect(aeadCoreModule).not.toMatch(/\bAes256Gcm\b/);
    expect(aeadCoreModule).not.toMatch(/\baes256gcm_vectors\b/);
    expect(aeadCoreModule).not.toMatch(/\bseal_aes256gcm_for_test\b/);
    expect(aeadCoreModule).not.toMatch(/\bopen_aes256gcm_for_test\b/);
    for (const method of ["new_placeholder_encrypt", "new_placeholder_decrypt", "status", "algorithm", "operation"]) {
      expect(aeadCoreModule).toMatch(new RegExp(`\\bfn\\s+${method}\\b`));
    }
    // And the converse: the AES-256-GCM module never constructs or
    // references aead_core's own types.
    expect(aes256gcmModule).not.toMatch(/\bAeadPlaceholderRequest\b/);
    expect(aes256gcmModule).not.toMatch(/\bAeadAlgorithm\b/);
    expect(aes256gcmModule).not.toMatch(/\bAeadOperation\b/);
  });

  it("10. the seal_aes256gcm_for_test / open_aes256gcm_for_test helpers exist, are private, and are never re-exported", () => {
    expect(aes256gcmModule).toMatch(/\bfn\s+seal_aes256gcm_for_test\b/);
    expect(aes256gcmModule).toMatch(/\bfn\s+open_aes256gcm_for_test\b/);
    expect(aes256gcmModule).not.toMatch(/\bpub\s+fn\s+seal_aes256gcm_for_test\b/);
    expect(aes256gcmModule).not.toMatch(/\bpub\(crate\)\s+fn\s+seal_aes256gcm_for_test\b/);
    expect(aes256gcmModule).not.toMatch(/\bpub\s+fn\s+open_aes256gcm_for_test\b/);
    expect(aes256gcmModule).not.toMatch(/\bpub\(crate\)\s+fn\s+open_aes256gcm_for_test\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+[\w:]*aes256gcm_for_test\b/);
  });

  it("11. lib.rs reads the NIST AES-256-GCM vector file via include_str! at compile time", () => {
    expect(libRsSource).toMatch(
      /include_str!\(\s*"\.\.\/\.\.\/\.\.\/test-vectors\/aead\/aes256gcm-nist\.json"\s*\)/,
    );
    // Actually imports and uses the aes-gcm dependency — but only inside
    // the #[cfg(test)]-scoped tail of the file.
    expect(testOnlyLibRs).toMatch(/\buse\s+aes_gcm\b/);
    expect(testOnlyLibRs).toContain("Aes256Gcm");
  });

  it("12. lib.rs's positive/negative vector tests both exist and iterate the vector file", () => {
    expect(aes256gcmModule).toMatch(/fn\s+aes256gcm_positive_vectors_encrypt_and_decrypt_correctly/);
    expect(aes256gcmModule).toMatch(/fn\s+aes256gcm_negative_vectors_fail_to_decrypt_if_present/);
    expect(aes256gcmModule).toMatch(/\.filter\(\|v\|\s*v\.should_pass\)/);
    expect(aes256gcmModule).toMatch(/\.filter\(\|v\|\s*!v\.should_pass\)/);
  });

  it("13. no public encrypt/decrypt AEAD implementation exists anywhere in lib.rs", () => {
    const pubFns = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
    const allowedPubFns = new Set([
      "fedos_core_status",
      "fedos_core_capabilities",
      "random_bytes_placeholder",
      "derive_key_placeholder",
      "encrypt_placeholder",
      "decrypt_placeholder",
      // Stage 102's label-only status function — see
      // test/fedos_core_rust_public_api_boundary.test.ts for the dedicated
      // checks that it implements no real AEAD/KDF/random operation.
      "fedos_crypto_boundary_status",
      // Stage 103's ten label-only boundary-consolidation functions — see
      // test/fedos_core_rust_public_boundary_consolidation.test.ts for the
      // dedicated checks that none implements a real operation.
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
      // Stage 105's key-format planning-label function — see
      // test/fedos_core_rust_key_format_label.test.ts for the dedicated
      // checks that it accepts no raw byte and performs no real format
      // decision.
      "fedos_key_format_descriptor_placeholder",
      // Stage 106's key-usage planning-label function and algorithm
      // policy metadata functions — see
      // test/fedos_core_rust_key_usage_label.test.ts and
      // test/fedos_core_rust_algorithm_policy.test.ts for the dedicated
      // checks that none enforces a real authorization/validation rule.
      "fedos_key_usage_descriptor_placeholder",
      "fedos_algorithm_requirements",
      "fedos_algorithm_capabilities",
      "fedos_algorithm_policy_decision",
      "fedos_random_bytes_32",
      "fedos_aead_nonce_96",
      "fedos_encrypt",
      "fedos_decrypt",
      "fedos_generate_aead_key_32",
      // Stage 986's minimal wasm_bindgen-annotated JS export -- see
      // test/runtime_wasm_rust_version_export.test.ts for the dedicated
      // checks that it implements no real cryptographic operation.
      "version",
      // Stage 1004's thin, non-cryptographic wasm_bindgen wrapper around
      // the pre-existing fedos_random_bytes_32() -- see
      // test/fedos_core_rust_random_bytes.test.ts for the dedicated
      // checks that it implements no new randomness source/algorithm.
      "random_bytes_32",
      // Stage 1005's thin wasm_bindgen wrapper around the pre-existing
      // fedos_generate_aead_key_32(), REPLACED Stage 1008 (Secure
      // Runtime Alpha 013) by generate_aead_key_handle() -- see
      // test/secure_runtime_alpha_013_opaque_aead_key_handle_migration.test.ts
      // for the dedicated checks that it implements no new algorithm.
      // Its opaque wrapper class's own `kind` getter (a fixed,
      // non-secret label) is the other new pub fn this Stage adds.
      "generate_aead_key_handle",
      "kind",
      // Stage 1009's thin wasm_bindgen wrapper around the pre-existing
      // fedos_encrypt() -- see
      // test/secure_runtime_alpha_014_encrypt_opaque_handle_api.test.ts
      // for the dedicated checks that it implements no new algorithm.
      // The new AeadCiphertextHandle opaque class's own `kind` getter
      // reuses the SAME name as AeadKeyHandle's own (already listed
      // above) -- both are separate impl blocks, so the name appears
      // twice in the real pub fn list but only needs listing once in
      // this Set.
      "encrypt_aead",
    ]);
    for (const name of pubFns) {
      expect(allowedPubFns.has(name), `unexpected public function: ${name}`).toBe(true);
    }
    // The #[cfg(test)] module's own test/helper functions are not `pub`.
    expect(testOnlyLibRs).not.toMatch(/\bpub\s+fn\s+aes256gcm/);
    expect(testOnlyLibRs).not.toMatch(/\bpub\s+fn\s+seal_aes256gcm/);
    expect(testOnlyLibRs).not.toMatch(/\bpub\s+fn\s+open_aes256gcm/);
  });

  it("14. no key/nonce/plaintext/ciphertext/tag storage field anywhere in production code, except the one reviewed Stage 138 nonce field", () => {
    // Field/parameter DECLARATIONS only (name immediately followed by a
    // colon-typed annotation) — not prose in a doc comment. Stage 138
    // adds exactly one reviewed exception: `FedosAeadNonceDecision.nonce`
    // (a fixed-size `[u8; 12]`, not a secret — see
    // test/fedos_core_rust_aead_nonce.test.ts for the dedicated checks).
    // Excise its own top-of-file summary paragraph AND its code block
    // (declaration + both construction sites) before checking the rest
    // of production code carries no such field.
    const summaryStart = productionLibRs.indexOf("Stage 138 adds a second real function");
    const summaryEnd = productionLibRs.indexOf("#![forbid(unsafe_code)]");
    const codeStart = productionLibRs.indexOf(
      "Stage 138 — a fixed-size AEAD nonce helper, drawn from the OS CSPRNG",
    );
    const codeEnd = productionLibRs.indexOf(
      "Stage 79 — an INTERNAL-ONLY secret-handle skeleton",
    );
    expect(summaryStart, "expected the Stage 138 crate-doc summary").toBeGreaterThan(-1);
    expect(summaryEnd, "expected #![forbid(unsafe_code)] after the summary").toBeGreaterThan(-1);
    expect(codeStart, "expected the Stage 138 code marker").toBeGreaterThan(-1);
    expect(codeEnd, "expected the Stage 79 marker after Stage 138's code").toBeGreaterThan(-1);
    const withoutStage138 =
      productionLibRs.slice(0, summaryStart) +
      productionLibRs.slice(summaryEnd, codeStart) +
      productionLibRs.slice(codeEnd);
    expect(withoutStage138).not.toMatch(
      /\b(key|nonce|iv|plaintext|ciphertext|tag)\s*:\s*\w/i,
    );
  });

  it("15. no .wasm / Cargo.lock / target / build artifact is committed to the package", () => {
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

  it("16. Runtime / Worker sources are unchanged: no aes-gcm reference and no crypto-op auto-call", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("aes-gcm");
      expect(src).not.toContain("aes_gcm");
      expect(src).not.toContain("aes256gcm");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(runtimeSource).not.toMatch(/\.\s*load\s*\(/);
  });

  it("17. the imported NIST AES-256-GCM vector file has both shouldPass=true and shouldPass=false cases", () => {
    // Sanity check on the same file lib.rs's include_str! points at: this
    // repo's test suite and the Rust test must be exercising a real,
    // non-empty vector set with both positive and negative coverage.
    const vectors = (aes256gcmVectors as { vectors: Array<{ shouldPass: boolean }> }).vectors;
    expect(Array.isArray(vectors)).toBe(true);
    expect(vectors.some((v) => v.shouldPass === true)).toBe(true);
    expect(vectors.some((v) => v.shouldPass === false)).toBe(true);
  });

  it("18. no unsafe anywhere in lib.rs (crate-level forbid stays intact)", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(libRsSource).not.toMatch(/\bunsafe\s+(fn|impl|trait|\{)/);
    expect(aes256gcmModule).not.toContain("unsafe");
  });
});
