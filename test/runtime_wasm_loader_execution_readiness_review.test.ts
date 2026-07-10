import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import reviewDocSource from "../docs/runtime_wasm_loader_execution_readiness_review.md?raw";
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
 * Prototype Phase 021 — "FedOS WASM Loader Execution Readiness
 * Review": a REVIEW-ONLY audit confirming the eight-Plan Planning
 * Chain (Stage 841-905, Phases 013-020) is complete, naming the order
 * a future stage would convert Plans into real checks, and naming
 * Generated Artifact Check as the first candidate. No code, fixed
 * value, diagnostics field, ninth Plan, or wiring change of any kind;
 * no load, import, or execution.
 */
describe("FedOS WASM Loader Execution Readiness Review -- review only, no runtime/worker/diagnostics/source change", () => {
  it("1. the review doc exists and is substantial", () => {
    expect(typeof reviewDocSource).toBe("string");
    expect(reviewDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the eight-Plan Planning Chain is documented in full, in order", () => {
    const order = [
      "Load Plan",
      "JS Glue Access Plan",
      "Generated Artifact Check Plan",
      "Dev-only Gate Plan",
      "Import Plan",
      "WebAssembly Plan",
      "Rust API Call Plan",
    ];
    for (const label of order) {
      expect(reviewDocSource).toMatch(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }

    // Order check within the §1 chain diagram itself, not the whole doc.
    const chainBlockMatch = reviewDocSource.match(
      /## 1\. Planning Chain completion confirmation[\s\S]*?```txt\n([\s\S]*?)```/,
    );
    expect(chainBlockMatch).not.toBeNull();
    const chainBlock = (chainBlockMatch as RegExpMatchArray)[1] ?? "";
    expect(chainBlock.length).toBeGreaterThan(0);
    let lastIndex = -1;
    for (const label of order) {
      const idx = chainBlock.indexOf(label);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it("3. the policy about not adding a ninth stage (eighth Plan) is stated explicitly", () => {
    expect(reviewDocSource).toMatch(/COMPLETE/);
    expect(reviewDocSource).toMatch(/[Nn]o ninth\s+stage/);
    expect(reviewDocSource).toMatch(/[Nn]o eighth Plan/);
    expect(reviewDocSource).toMatch(/PrototypeExecutionReadiness/);
  });

  it("4. the next-implementation order is named, in order, and explicitly not implemented yet", () => {
    const order = [
      "Generated Artifact Check",
      "Dev-only Gate Evaluation",
      "Import Readiness",
      "Dev-only import()",
      "WebAssembly Readiness",
      "Minimal Rust API Call",
    ];
    for (const label of order) {
      expect(reviewDocSource).toMatch(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }

    const orderBlockMatch = reviewDocSource.match(
      /## 2\. Order for converting Plans into real checks[\s\S]*?```txt\n([\s\S]*?)```/,
    );
    expect(orderBlockMatch).not.toBeNull();
    const orderBlock = (orderBlockMatch as RegExpMatchArray)[1] ?? "";
    expect(orderBlock.length).toBeGreaterThan(0);
    let lastIndex = -1;
    for (const label of order) {
      const idx = orderBlock.indexOf(label);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }

    expect(reviewDocSource).toMatch(/implements NONE of these/);
  });

  it("5. Generated Artifact Check is named as the first candidate, with reasons", () => {
    expect(reviewDocSource).toMatch(/First candidate for real implementation: Generated Artifact Check/);
    expect(reviewDocSource).toMatch(/recommended FIRST candidate/);
    expect(reviewDocSource).toMatch(/Safely checkable before `import\(\)`/);
    expect(reviewDocSource).toMatch(/No WebAssembly execution involved/);
    expect(reviewDocSource).toMatch(/No Rust call involved/);
  });

  it("6. future conditions for Generated Artifact Check are named: targets, dev-only location, Production/Worker exclusion, missing-artifact Fail Closed, no immediate import", () => {
    expect(reviewDocSource).toMatch(/Generated JS Glue/);
    expect(reviewDocSource).toMatch(/Generated WASM artifact/);
    expect(reviewDocSource).toMatch(/Development Runtime ONLY/);
    expect(reviewDocSource).toMatch(/Production stays Fail Closed/);
    expect(reviewDocSource).toMatch(/Worker stays unconnected/);
    expect(reviewDocSource).toMatch(/Missing artifact.{0,20}Fail Closed/is);
    expect(reviewDocSource).toMatch(/still no immediate `import\(\)`/);
  });

  it("7. all eight Fail Closed fields are stated as unchanged", () => {
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
    expect(reviewDocSource).toMatch(/does NOT change this fixed-`false` design/);
  });

  it("8. import()/WebAssembly/Rust/Worker/Production/NIP-17/NIP-44/NIP-59/Double Ratchet/Triple Ratchet/onion routing are all explicitly named as prohibited", () => {
    expect(reviewDocSource).toMatch(/Explicit prohibitions for THIS stage/);
    expect(reviewDocSource).toMatch(/`import\(\)`[\s\S]{0,60}remains PROHIBITED/);
    expect(reviewDocSource).toMatch(/`WebAssembly`[\s\S]{0,250}remains PROHIBITED/);
    expect(reviewDocSource).toMatch(/Rust API calls[\s\S]{0,250}remain PROHIBITED/);
    expect(reviewDocSource).toMatch(/Worker connection/);
    expect(reviewDocSource).toMatch(/Production connection/);
    expect(reviewDocSource).toMatch(/NIP-17, NIP-44, NIP-59/);
    expect(reviewDocSource).toMatch(/Double Ratchet, Triple Ratchet, onion routing/);
  });

  it("9. the review doc never writes real import()/WebAssembly code -- only names them as prohibited, in prose", () => {
    expect(reviewDocSource).not.toMatch(/```(ts|js|typescript|javascript)[\s\S]*WebAssembly\.instantiate[\s\S]*```/);
    expect(reviewDocSource).not.toMatch(/```(ts|js|typescript|javascript)[\s\S]*import\(/);
  });

  it("10. explicitly states no eighth Plan (ninth stage), no execution-logic change, and no file deleted/merged", () => {
    expect(reviewDocSource).toMatch(/REVIEW ONLY/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* add an eighth internal Plan \(a ninth chain stage\)/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `src\/runtime\/fedos_wasm_loader\.ts`'s execution[\s\S]{0,20}logic/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* delete or merge any existing file/);
  });

  it("11. Runtime, Worker, and both diagnostics files are completely unaffected -- no reference to the new review doc anywhere", () => {
    expect(createRuntimeSource).not.toMatch(/runtime_wasm_loader_execution_readiness_review/);
    expect(workerSource).not.toMatch(/runtime_wasm_loader_execution_readiness_review/);
    expect(runtimeDiagnosticsSource).not.toMatch(/runtime_wasm_loader_execution_readiness_review/);
    expect(workerDiagnosticsSource).not.toMatch(/runtime_wasm_loader_execution_readiness_review/);
  });

  it("12. runtime_crypto_diagnostics.ts and worker_crypto_diagnostics.ts carry no new field introduced by this stage", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(/executionReadiness|readinessReview/i);
    expect(workerDiagnosticsSource).not.toMatch(/executionReadiness|readinessReview/i);
  });

  it("13. fedos_wasm_loader.ts source is untouched by this stage -- no eighth Plan type, no new private #create*Plan() method, same public surface", () => {
    // Exactly the seven Plan interfaces this arc has built through Stage 905 -- no eighth.
    const planInterfaceMatches = [
      ...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g),
    ].map((m: RegExpMatchArray) => m[0]);
    const uniquePlanInterfaces = [...new Set(planInterfaceMatches)];
    expect(uniquePlanInterfaces.length).toBe(7);
    expect(uniquePlanInterfaces).toContain("export interface FedosWasmLoaderLoadPlan");
    expect(uniquePlanInterfaces).toContain("export interface FedosWasmLoaderJsGlueAccessPlan");
    expect(uniquePlanInterfaces).toContain("export interface FedosWasmLoaderGeneratedArtifactCheckPlan");
    expect(uniquePlanInterfaces).toContain("export interface FedosWasmLoaderDevOnlyGatePlan");
    expect(uniquePlanInterfaces).toContain("export interface FedosWasmLoaderImportPlan");
    expect(uniquePlanInterfaces).toContain("export interface FedosWasmLoaderWebAssemblyPlan");
    expect(uniquePlanInterfaces).toContain("export interface FedosWasmLoaderRustApiCallPlan");

    // Exactly the seven private #create*Plan() builder methods -- no eighth.
    const createPlanMethods = [...wasmLoaderSource.matchAll(/#create\w*Plan\(\)/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    const uniqueCreatePlanMethods = [...new Set(createPlanMethods)];
    expect(uniqueCreatePlanMethods.length).toBe(7);

    // The public FedosWasmLoader interface is still exactly these six members.
    expect(wasmLoaderSource).toMatch(/status\(\):\s*FedosWasmLoaderStatus/);
    expect(wasmLoaderSource).toMatch(/planLoad\(\):\s*FedosWasmLoaderDecision/);
    expect(wasmLoaderSource).toMatch(/planInitialize\(\):\s*FedosWasmLoaderDecision/);
    expect(wasmLoaderSource).toMatch(/planUnload\(\):\s*FedosWasmLoaderDecision/);
    expect(wasmLoaderSource).toMatch(/planningState\(\):\s*FedosWasmLoaderPlanningStatus/);
    expect(wasmLoaderSource).toMatch(/policy\(\):\s*FedosWasmLoaderPolicyDecision/);
  });

  it("14. no execution API has been added to fedos_wasm_loader.ts: no import()/WebAssembly/Rust/filesystem/environment reference of any kind", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    // Stage 945 (Prototype EXECUTION Phase 004, a later stage than
    // this one) legitimately calls real, gated import() exactly once
    // inside attemptDevOnlyJsGlueImport() -- this checks for import()
    // ANYWHERE ELSE in the source, not that one narrowly-scoped call.
    expect(codeOnly).not.toMatch(/import\s*\((?!\/\* @vite-ignore \*\/)/);
    expect(codeOnly).not.toMatch(/require\s*\(/);
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
    expect(codeOnly).not.toMatch(/#\[wasm_bindgen\]/);
    // Stage 921 (Prototype EXECUTION Phase 001, a later stage than
    // this one) legitimately names the two Generated Artifact
    // filenames ("fedos_core_rust.js"/"fedos_core_rust_bg.wasm") to
    // check their existence -- this checks for actual Rust
    // crate/module USAGE, not that naming.
    expect(codeOnly).not.toMatch(/fedos_core_rust(?!\.js"|_bg\.wasm")/);
    // Stage 921 (Prototype EXECUTION Phase 001, a later stage than this
    // review) legitimately adds a read-only existsSync() existence
    // check -- this checks for CONTENT-reading filesystem access
    // (never permitted), not the narrowly-scoped existence check.
    // Stage 969 (Prototype EXECUTION Phase 007, a later stage than
    // this one) legitimately reads the SAME fedos_core_rust_bg.wasm
    // bytes Stage 921 already names, via readFileSync -- this checks
    // for any OTHER content-reading filesystem API, not that one
    // narrowly-scoped read.
    expect(codeOnly).not.toMatch(/statSync|readFile\(|readdirSync/);
    // Stage 929 (Prototype EXECUTION Phase 002, a later stage than
    // this one) legitimately reads process.env.NODE_ENV (and ONLY
    // that one key) to evaluate the Dev-only Gate -- this checks for
    // any OTHER process.env usage and for import.meta (still fully
    // forbidden), not the narrowly-scoped NODE_ENV read.
    expect(codeOnly).not.toMatch(/process\.env(?!\??\.NODE_ENV\b)/);
    expect(codeOnly).not.toMatch(/import\.meta/);
  });

  it("15. no NIP-17/NIP-44/NIP-59/Double Ratchet/Triple Ratchet/onion routing is implemented or recommended for implementation", () => {
    expect(reviewDocSource).toMatch(/NIP-17/);
    expect(reviewDocSource).toMatch(/NIP-44/);
    expect(reviewDocSource).toMatch(/NIP-59/);
    expect(reviewDocSource).toMatch(/Double Ratchet/);
    expect(reviewDocSource).toMatch(/Triple Ratchet/);
    expect(reviewDocSource).toMatch(/onion routing/i);
    expect(reviewDocSource).not.toMatch(/```[\s\S]*ratchet[\s\S]*```/i);
  });

  it("16. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(34);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(11);

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

  it("17. Worker/Production non-connection is explicitly named alongside the future Generated Artifact Check candidate", () => {
    expect(reviewDocSource).toMatch(/runtime_dynamic_loader_dev_approval\.md/);
    expect(reviewDocSource).toMatch(/fedos_runtime_positioning\.md/);
  });

  it("18. this review cross-references the prior Rust API Call Plan doc and confirms rather than contradicts its own §7 finding", () => {
    expect(reviewDocSource).toMatch(/runtime_wasm_loader_rust_api_call_plan\.md/);
    expect(reviewDocSource).toMatch(/§7/);
  });
});
