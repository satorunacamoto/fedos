import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/runtime_wasm_rust_version_export.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeDiagnosticsSource from "../src/runtime/runtime_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerDiagnosticsSource from "../src/runtime/worker_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../src/runtime/fedos_wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

const PRE_EXISTING_PUB_FN_NAMES = [
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
  "fedos_generate_aead_key_32",
  "fedos_encrypt",
  "fedos_decrypt",
];

/**
 * Prototype EXECUTION Phase 010 — "Add Minimal wasm-bindgen version()
 * Export": adds the crate's FIRST `#[wasm_bindgen]`-annotated function,
 * `version() -> String` (`packages/fedos-core-rust/src/lib.rs`, Stage
 * 986) -- the minimal candidate Phase 008's review named, made usable by
 * Phase 009's `wasm-bindgen` dependency adoption. Zero side effects, no
 * TypeScript call, no Cargo.toml change, no other Rust API change, and no
 * generated JS glue committed.
 */
describe("FedOS Rust version() export -- one #[wasm_bindgen] fn, 28 pub fn total, no TypeScript call", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. #[wasm_bindgen] appears exactly once in lib.rs", () => {
    // Stage 1004 (Secure Runtime Alpha 008) legitimately added a SECOND
    // #[wasm_bindgen]-annotated function (random_bytes_32) -- see
    // test/fedos_core_rust_random_bytes.test.ts for its own dedicated
    // checks. Stage 1005 (Secure Runtime Alpha 010) legitimately added
    // a THIRD (generate_aead_key_32, later REPLACED by
    // generate_aead_key_handle -- see
    // test/secure_runtime_alpha_010_aead_key_generation.test.ts). Stage
    // 1008 (Secure Runtime Alpha 013) legitimately added TWO more
    // annotated items (the AeadKeyHandle opaque class struct + its impl
    // block) -- see
    // test/secure_runtime_alpha_013_opaque_aead_key_handle_migration.test.ts.
    // Stage 1009 (Secure Runtime Alpha 014) legitimately added FIVE more
    // (FedosAeadAlgorithm, FedosAeadAadDomain, the AeadCiphertextHandle
    // struct + its impl block, and encrypt_aead()) -- see
    // test/secure_runtime_alpha_014_encrypt_opaque_handle_api.test.ts.
    // Stage 1010 (Secure Runtime Alpha 015) legitimately added ONE more
    // (decrypt_aead()) -- see
    // test/secure_runtime_alpha_015_decrypt_opaque_handle_api.test.ts.
    // Stage 1011 (Secure Runtime Alpha 018) legitimately added TWO more
    // (serialize_aead_ciphertext()/deserialize_aead_ciphertext()) -- see
    // test/secure_runtime_alpha_018_ciphertext_wire_export_import_api.test.ts.
    // Stage 1012-1015 (Secure Runtime Alpha 146-149) added ZERO new
    // #[wasm_bindgen] annotations, but DID add doc comments that mention
    // the literal string `#[wasm_bindgen]` in prose (never as a real
    // annotation) -- see test/secure_runtime_alpha_146_master_seed_handle.test.ts.
    // This count is therefore now measured with a line-anchored regex, so
    // a future prose mention elsewhere in the file cannot inflate it.
    // This test's own title still reflects Stage 986's original,
    // now-historical scope.
    const matches = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)];
    expect(matches.length).toBe(15);
  });

  it("3. version() is declared, #[wasm_bindgen]-annotated, and returns a fixed String", () => {
    expect(libRsSource).toMatch(/#\[wasm_bindgen\]\s*\npub fn version\(\) -> String \{/);
    expect(libRsSource).toMatch(/"fedos-core-rust\/0\.0\.0"\.to_string\(\)/);
  });

  it("4. use wasm_bindgen::prelude::*; is imported exactly once", () => {
    const matches = [...libRsSource.matchAll(/use wasm_bindgen::prelude::\*;/g)];
    expect(matches.length).toBe(1);
  });

  it("5. Rust public API count is 28 -- the 27 pre-existing pub fn plus version()", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(50);
    expect(pubFnNames).toContain("version");
    for (const name of PRE_EXISTING_PUB_FN_NAMES) {
      expect(pubFnNames).toContain(name);
    }
  });

  it("6. fedos_runtime_ping_internal remains pub(crate), not pub, and is unaffected", () => {
    expect(libRsSource).toMatch(/pub\(crate\)\s+fn\s+fedos_runtime_ping_internal\(\)\s*->\s*bool/);
  });

  it("7. #![forbid(unsafe_code)] is unchanged, still crate-level", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
  });

  it("8. Cargo.toml is unchanged from its Phase 009 (Stage 985) state -- still 11 production dependencies, wasm-bindgen pinned 0.2.126", () => {
    const cargoCode = cargoTomlSource
      .split("\n")
      .map((line: string) => line.replace(/#.*$/, ""))
      .join("\n")
      .toLowerCase();
    const depsIdx = cargoCode.indexOf("[dependencies]");
    const devDepsIdx = cargoCode.indexOf("[dev-dependencies]");
    const productionDepsSection = cargoCode.slice(depsIdx, devDepsIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(11);
    expect(productionDepsSection).toMatch(/^\s*wasm-bindgen\s*=\s*"0\.2\.126"/m);
  });

  it("9. package.json dependencies remain unchanged at 2", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("10. src/runtime/fedos_wasm_loader.ts was untouched by THIS stage's own scope (Stage 986) -- a real module.version() call was later added by Stage 993, Prototype EXECUTION Phase 012, see test/runtime_wasm_loader_dev_only_rust_version_call_execution.test.ts -- still seven Plan interfaces", () => {
    expect(wasmLoaderSource).toMatch(/attemptDevOnlyRustVersionCall/);
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);
  });

  it("11. no TypeScript file in the Runtime/Worker chain calls version()", () => {
    expect(createRuntimeSource).not.toMatch(/[.=]\s*version\s*\(/);
    expect(workerSource).not.toMatch(/[.=]\s*version\s*\(/);
    expect(runtimeDiagnosticsSource).not.toMatch(/[.=]\s*version\s*\(/);
    expect(workerDiagnosticsSource).not.toMatch(/[.=]\s*version\s*\(/);
  });

  it("12. Runtime, Worker, and both diagnostics files are completely unaffected -- no reference to the new doc anywhere", () => {
    expect(createRuntimeSource).not.toMatch(/runtime_wasm_rust_version_export/);
    expect(workerSource).not.toMatch(/runtime_wasm_rust_version_export/);
    expect(runtimeDiagnosticsSource).not.toMatch(/runtime_wasm_rust_version_export/);
    expect(workerDiagnosticsSource).not.toMatch(/runtime_wasm_rust_version_export/);
  });

  it("13. diagnostics carry no new field introduced by this stage", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(/rustVersionExport|wasmVersionExport/i);
    expect(workerDiagnosticsSource).not.toMatch(/rustVersionExport|wasmVersionExport/i);
  });

  it("14. the design doc explicitly states what was added and what was deliberately NOT done", () => {
    expect(designDocSource).toMatch(/pub fn version\(\) -> String/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* call `version\(\)` from any TypeScript file/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* apply `#\\?\[wasm_bindgen\\?\]` to any of the 27 pre-existing/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* commit `target\/`, `Cargo\.lock`, or `pkg\/`/);
  });

  it("15. cross-references the Stage 977 export readiness review and the Stage 985 bindgen dependency adoption this Phase builds on", () => {
    expect(designDocSource).toMatch(/runtime_wasm_rust_export_readiness_review\.md/);
    expect(designDocSource).toMatch(/runtime_wasm_rust_export_bindgen_dependency\.md/);
    expect(designDocSource).toMatch(/runtime_wasm_js_glue_contract\.md/);
  });
});
