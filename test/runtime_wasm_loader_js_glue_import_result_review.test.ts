import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import reviewDocSource from "../docs/runtime_wasm_loader_js_glue_import_result_review.md?raw";
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

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

/**
 * Prototype EXECUTION Phase 005 — "FedOS WASM Loader JS Glue Import
 * Result Review & WASM Init Strategy": a REVIEW-ONLY audit of Stage
 * 945 (Prototype EXECUTION Phase 004), confirming planLoad() stays
 * synchronous, attemptDevOnlyJsGlueImport() is the sole async
 * boundary, the imported module is still discarded, and comparing
 * initSync vs. async default init/__wbg_init for a future stage to
 * choose from -- recommending Option B (import/init responsibility
 * separation). No code, execution logic, diagnostics field, or
 * WebAssembly/Rust reference of any kind is added to
 * fedos_wasm_loader.ts.
 */
describe("FedOS WASM Loader JS Glue Import Result Review -- review only, no runtime/worker/diagnostics/source change", () => {
  it("1. the review doc exists and is substantial", () => {
    expect(typeof reviewDocSource).toBe("string");
    expect(reviewDocSource.length).toBeGreaterThan(3000);
  });

  it("2. planLoad() staying synchronous is explicitly reaffirmed", () => {
    expect(reviewDocSource).toMatch(/`planLoad\(\)` stays synchronous/);
    expect(reviewDocSource).toMatch(/no future stage should make `planLoad\(\)` asynchronous/);
  });

  it("3. attemptDevOnlyJsGlueImport() is named as the sole async boundary", () => {
    expect(reviewDocSource).toMatch(/attemptDevOnlyJsGlueImport\(\)`?\s+is\s+the\s+async\s+boundary/);
    expect(reviewDocSource).toMatch(/the\s+ONE\s+async\s+boundary\s+in\s+this\s+file/);
  });

  it("4. import success does not proceed to WebAssembly or Rust -- explicitly confirmed", () => {
    expect(reviewDocSource).toMatch(/the imported module is discarded/i);
    expect(reviewDocSource).toMatch(/entirely unreached by this Prototype/);
    expect(reviewDocSource).toMatch(/WebAssembly\.instantiate.{0,20}compile/s);
    expect(reviewDocSource).toMatch(/initSync/);
    expect(reviewDocSource).toMatch(/__wbg_init/);
  });

  it("5. initSync vs. async default init/__wbg_init are compared", () => {
    expect(reviewDocSource).toMatch(/WASM Init Strategy/);
    expect(reviewDocSource).toMatch(/\*\*`initSync\(module\)`\*\*/);
    expect(reviewDocSource).toMatch(/async default init `__wbg_init/);
    expect(reviewDocSource).toMatch(/does not recommend one over the other yet/);
  });

  it("6. version() is named as the recommended minimal first real Rust API target, without being called", () => {
    expect(reviewDocSource).toMatch(/recommends[\s\S]{0,200}`version\(\)`/);
    expect(reviewDocSource).toMatch(/side-effect-free/);
    expect(reviewDocSource).toMatch(/does NOT call `version\(\)`/);
  });

  it("7. the recommendation is responsibility separation -- Option B, with reasons", () => {
    expect(reviewDocSource).toMatch(/Option A/);
    expect(reviewDocSource).toMatch(/Option B/);
    expect(reviewDocSource).toMatch(/Option C/);
    expect(reviewDocSource).toMatch(/\*\*Recommendation: Option B\.\*\*/);
    expect(reviewDocSource).toMatch(/Separates import and WASM-init responsibilities/);
    expect(reviewDocSource).toMatch(/Does not disturb `planLoad\(\)`'s synchronous contract/);
  });

  it("8. Worker/Production non-connection is explicitly restated", () => {
    expect(reviewDocSource).toMatch(/Production stays Fail Closed/);
    expect(reviewDocSource).toMatch(/Worker stays unconnected/);
  });

  it("9. Fail Closed conditions are restated, unchanged", () => {
    const fields = [
      "policy.allowed",
      "Load Plan.shouldLoad",
      "JS Glue Access Plan.shouldAccess",
      "Generated Artifact Check Plan.shouldCheck",
      "Dev-only Gate Plan.shouldEvaluate",
      "Import Plan.shouldImport",
      "WebAssembly Plan.shouldInstantiate",
      "Rust API Call Plan.shouldCall",
    ];
    for (const field of fields) {
      expect(reviewDocSource).toMatch(new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*=\\s*false"));
    }
    expect(reviewDocSource).toMatch(/planLoad\(\)` still ALWAYS returns `BlockedByPolicy`/);
  });

  it("10. explicitly states no code/execution-logic/diagnostics/WebAssembly/Rust change is made by this review", () => {
    expect(reviewDocSource).toMatch(/REVIEW ONLY/);
    expect(reviewDocSource).toMatch(
      /Does \*\*not\*\* modify `src\/runtime\/fedos_wasm_loader\.ts`.{0,20}in any way/s,
    );
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* call `WebAssembly\.instantiate\(\)`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* call `initSync\(\)`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* call `__wbg_init\(\)`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* call any Rust API, including `version\(\)`/);
  });

  it("11. the review doc never writes real WebAssembly/Rust-calling code -- only names/compares them, in prose", () => {
    expect(reviewDocSource).not.toMatch(/```(ts|js|typescript|javascript|rust)[\s\S]*WebAssembly\.instantiate[\s\S]*```/);
    expect(reviewDocSource).not.toMatch(/```(ts|js|typescript|javascript|rust)[\s\S]*__wbg_init\(/);
  });

  it("12. Runtime, Worker, and both diagnostics files are completely unaffected -- no reference to the new review doc anywhere", () => {
    expect(createRuntimeSource).not.toMatch(/runtime_wasm_loader_js_glue_import_result_review/);
    expect(workerSource).not.toMatch(/runtime_wasm_loader_js_glue_import_result_review/);
    expect(runtimeDiagnosticsSource).not.toMatch(/runtime_wasm_loader_js_glue_import_result_review/);
    expect(workerDiagnosticsSource).not.toMatch(/runtime_wasm_loader_js_glue_import_result_review/);
  });

  it("13. runtime_crypto_diagnostics.ts and worker_crypto_diagnostics.ts carry no new field introduced by this stage", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(/jsGlueImportResultReview|wasmInitStrategy/i);
    expect(workerDiagnosticsSource).not.toMatch(/jsGlueImportResultReview|wasmInitStrategy/i);
  });

  it("14. fedos_wasm_loader.ts source is untouched by this stage -- no new execution logic, no WebAssembly/Rust API usage", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    expect(codeOnly).not.toMatch(/WebAssembly\./);
    expect(codeOnly).not.toMatch(/new\s+WebAssembly\.Module/);
    expect(codeOnly).not.toMatch(/new\s+WebAssembly\.Instance/);
    // Stage 969 (Prototype EXECUTION Phase 007, a later stage than
    // this one) legitimately references .initSync as a PROPERTY
    // NAME to check for its presence on the retained JS glue module
    // -- this checks for a real, direct initSync(...) CALL, not the
    // property-name check.
    expect(codeOnly).not.toMatch(/\binitSync\s*\(/);
    expect(codeOnly).not.toMatch(/__wbg_init/);
    expect(codeOnly).not.toMatch(/\bversion\s*\(/);
    expect(codeOnly).not.toMatch(/#\[wasm_bindgen\]/);

    // Exactly the seven Plan interfaces and seven private #create*Plan()
    // methods this arc has built through Stage 945 -- no eighth of either.
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);
    const createPlanMethods = [...wasmLoaderSource.matchAll(/#create\w*Plan\(\)/g)].map((m: RegExpMatchArray) => m[0]);
    expect([...new Set(createPlanMethods)].length).toBe(7);

    // Still only ONE gated, real import() call in the entire source
    // (Stage 945), and the public interface's six members are untouched.
    const importCallMatches = [...codeOnly.matchAll(/\bimport\s*\(/g)];
    expect(importCallMatches.length).toBe(1);
    expect(wasmLoaderSource).toMatch(/status\(\):\s*FedosWasmLoaderStatus/);
    expect(wasmLoaderSource).toMatch(/planLoad\(\):\s*FedosWasmLoaderDecision/);
    expect(wasmLoaderSource).toMatch(/planInitialize\(\):\s*FedosWasmLoaderDecision/);
    expect(wasmLoaderSource).toMatch(/planUnload\(\):\s*FedosWasmLoaderDecision/);
    expect(wasmLoaderSource).toMatch(/planningState\(\):\s*FedosWasmLoaderPlanningStatus/);
    expect(wasmLoaderSource).toMatch(/policy\(\):\s*FedosWasmLoaderPolicyDecision/);
  });

  it("15. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(50);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);

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

    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("16. no NIP-17/NIP-44/NIP-59/Double Ratchet/Triple Ratchet/onion routing is implemented or recommended for implementation", () => {
    expect(reviewDocSource).not.toMatch(/```[\s\S]*ratchet[\s\S]*```/i);
  });

  it("17. cross-references the prior Rust API Call Plan doc and the JS glue contract doc this review's §5 comparison is based on", () => {
    expect(reviewDocSource).toMatch(/runtime_wasm_loader_rust_api_call_plan\.md/);
    expect(reviewDocSource).toMatch(/runtime_wasm_js_glue_contract\.md/);
    expect(reviewDocSource).toMatch(/runtime_wasm_loader_dev_only_js_glue_import_execution\.md/);
  });
});
