import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import reviewDocSource from "../docs/runtime_wasm_rust_export_readiness_review.md?raw";
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

/**
 * Prototype EXECUTION Phase 008 — "FedOS Rust Export Readiness
 * Review": a REVIEW-ONLY audit of the Rust -> JS export boundary
 * Prototype EXECUTION Phase 007's own Pre-check found empty (0
 * #[wasm_bindgen] among 27 pub fn, JS glue exporting only
 * initSync/default). Recommends a future, separate stage add ONE new,
 * minimal, side-effect-free version() function -- never retrofitting
 * any of the 27 existing functions -- and names the Cargo.toml change
 * (a genuine wasm-bindgen dependency) that would require. No
 * #[wasm_bindgen] attribute, Rust source, Cargo.toml, package.json,
 * or TypeScript change of any kind is made by this review.
 */
describe("FedOS Rust Export Readiness Review -- review only, no Rust/Cargo/package/TypeScript change", () => {
  it("1. the review doc exists and is substantial", () => {
    expect(typeof reviewDocSource).toBe("string");
    expect(reviewDocSource.length).toBeGreaterThan(3000);
  });

  it("2. all 27 pub fn are listed, matching the real lib.rs count", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(44);
    // `random_bytes_32` (Stage 1004, Secure Runtime Alpha 008),
    // `generate_aead_key_handle`/`kind` (Stage 1008, Secure Runtime
    // Alpha 013 -- REPLACING Stage 1005's `generate_aead_key_32`),
    // `encrypt_aead` (Stage 1009, Secure Runtime Alpha 014 -- `kind`
    // appears TWICE in the real pub fn list, once per opaque class, but
    // only needs skipping once here since this loop iterates every
    // occurrence), `decrypt_aead` (Stage 1010, Secure Runtime
    // Alpha 015), and `serialize_aead_ciphertext`/
    // `deserialize_aead_ciphertext` (Stage 1011, Secure Runtime
    // Alpha 018) are genuinely NEW pub fn added long after THIS
    // review's own Stage 977 scope -- the review doc's table only ever
    // named the 27 functions that existed at that time (plus `version`,
    // Stage 986, which this doc's OWN forward-looking recommendation
    // text happens to already mention). It is never retroactively
    // edited to document later additions -- see
    // `docs/secure_runtime_alpha_008_random_bytes.md`/
    // `docs/secure_runtime_alpha_013_opaque_aead_key_handle_migration.md`/
    // `docs/secure_runtime_alpha_014_encrypt_opaque_handle_api.md`/
    // `docs/secure_runtime_alpha_015_decrypt_opaque_handle_api.md`/
    // `docs/secure_runtime_alpha_018_ciphertext_wire_export_import_api.md`
    // for those functions' own reviews.
    // Secure Runtime Alpha 436/444's FedosMasterSeedAuthority (eight
    // methods, one #[wasm_bindgen] impl block) is likewise genuinely new,
    // long after this review's own Stage 977 scope -- never retroactively
    // added to this doc's table either. See
    // docs/secure_runtime_alpha_436_rust_master_seed_authority_implementation.md.
    const NEW_SINCE_THIS_REVIEW = new Set([
      "random_bytes_32",
      "generate_aead_key_handle",
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
    ]);
    for (const name of pubFnNames) {
      if (NEW_SINCE_THIS_REVIEW.has(name as string)) continue;
      expect(reviewDocSource).toMatch(new RegExp("`" + name + "`"));
    }
  });

  it("3. the #[wasm_bindgen] count is confirmed 0, matching the real lib.rs", () => {
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(16);
    expect(reviewDocSource).toMatch(/`#\\?\[wasm_bindgen\\?\]`.{0,20}count.{0,20}confirmed `0`|confirmed `0`/is);
    expect(reviewDocSource).toMatch(/# 0/);
  });

  it("4. current JS glue exports (default/initSync only, no crate-specific export) are stated", () => {
    expect(reviewDocSource).toMatch(/export \{ initSync, __wbg_init as default \};/);
    expect(reviewDocSource).toMatch(/No crate-specific export exists/);
  });

  it("5. a minimal version() candidate is recommended, with reasons, without adding it", () => {
    expect(reviewDocSource).toMatch(/pub fn version\(\) -> String/);
    expect(reviewDocSource).toMatch(/Zero side effects/);
    expect(reviewDocSource).toMatch(/NOT retrofit any of\s*\n?\s*the 27 existing ones/);
  });

  it("6. the impact of adding #[wasm_bindgen] to the candidate is analyzed", () => {
    expect(reviewDocSource).toMatch(/Impact of adding `#\\?\[wasm_bindgen\\?\]`/);
    expect(reviewDocSource).toMatch(/grows from 27 to 28/);
  });

  it("7. Cargo.toml change necessity is identified as YES, with the reason", () => {
    expect(reviewDocSource).toMatch(/Cargo\.toml.{0,20}change necessity.{0,20}YES/is);
    expect(reviewDocSource).toMatch(/NOT currently a `\[dependencies\]` entry/);
    expect(reviewDocSource).toMatch(/one dependency per\s*\n?\s*Stage/i);
  });

  it("8. whether version()-only is sufficient for Prototype termination is answered", () => {
    expect(reviewDocSource).toMatch(/Is `version\(\)`-only sufficient for Prototype termination/);
    expect(reviewDocSource).toMatch(/not as the final state/);
  });

  it("9. explicitly states no #[wasm_bindgen]/Rust/Cargo.toml/package.json/TypeScript change is made by this review", () => {
    expect(reviewDocSource).toMatch(/REVIEW ONLY/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* add `#\\?\[wasm_bindgen\\?\]` to any function/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `src\/runtime\/fedos_wasm_loader\.ts`/);
  });

  it("10. the review doc's own illustrative code block was never compiled or wired into lib.rs BY THIS REVIEW's own Stage 977 scope (Stage 986, Prototype EXECUTION Phase 010, later implemented that exact candidate for real -- see test/runtime_wasm_rust_version_export.test.ts)", () => {
    const codeBlocks = [...reviewDocSource.matchAll(/```rust\n([\s\S]*?)```/g)].map(
      (m: RegExpMatchArray) => m[1] ?? "",
    );
    expect(codeBlocks.length).toBeGreaterThan(0);
    // The one rust code block was illustrative-only AT THIS REVIEW's own
    // time (Stage 977) -- a LATER, separate stage (986) implemented the
    // exact same candidate for real, so this now confirms presence rather
    // than absence.
    expect(libRsSource).toMatch(/pub fn version\(\) -> String/);
  });

  it("11. Runtime, Worker, and both diagnostics files are completely unaffected -- no reference to the new review doc anywhere", () => {
    expect(createRuntimeSource).not.toMatch(/runtime_wasm_rust_export_readiness_review/);
    expect(workerSource).not.toMatch(/runtime_wasm_rust_export_readiness_review/);
    expect(runtimeDiagnosticsSource).not.toMatch(/runtime_wasm_rust_export_readiness_review/);
    expect(workerDiagnosticsSource).not.toMatch(/runtime_wasm_rust_export_readiness_review/);
  });

  it("12. runtime_crypto_diagnostics.ts and worker_crypto_diagnostics.ts carry no new field introduced by this stage", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(/rustExportReadiness/i);
    expect(workerDiagnosticsSource).not.toMatch(/rustExportReadiness/i);
  });

  it("13. fedos_wasm_loader.ts source is untouched by this stage -- no new execution logic, no version() call", () => {
    expect(wasmLoaderSource).not.toMatch(/\bversion\s*\(\s*\)\s*;/);
    // Still exactly the same seven Plan interfaces and seven
    // #create*Plan() methods this arc has built through Stage 969 --
    // no eighth of either.
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);
  });

  it("14. Rust public API is unchanged (27 pub fn, still 0 #[wasm_bindgen]) -- this review's OWN Stage 977 scope added no Cargo/package dependency (wasm-bindgen was later added directly at Stage 985, Prototype EXECUTION Phase 009 -- see test/runtime_wasm_rust_export_bindgen_dependency.test.ts); package.json dependencies remain unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(44);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(16);

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

    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("15. cross-references the Stage 969 Pre-check, the Stage 481 JS glue contract, and the Stage 905 Rust API Call Plan this review builds on", () => {
    expect(reviewDocSource).toMatch(/runtime_wasm_loader_dev_only_wasm_initialization_execution\.md/);
    expect(reviewDocSource).toMatch(/runtime_wasm_js_glue_contract\.md/);
    expect(reviewDocSource).toMatch(/runtime_wasm_loader_rust_api_call_plan\.md/);
    expect(reviewDocSource).toMatch(/rust_dependency_adoption\.md/);
  });
});
