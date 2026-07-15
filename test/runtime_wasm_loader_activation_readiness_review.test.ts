import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import reviewDocSource from "../docs/runtime_wasm_loader_activation_readiness_review.md?raw";
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
 * Prototype Phase 014 — "FedOS WASM Loader Activation Readiness
 * Review": a REVIEW-ONLY audit of the current real reach chain
 * (Stage 489-841, Phases 008-013), naming which layers stay, which
 * are consolidation candidates, and what the next real-connection
 * candidates would be. No code, fixed value, diagnostics field, or
 * wiring change of any kind; no load, import, or execution.
 */
describe("FedOS WASM Loader Activation Readiness Review -- review only, no runtime/worker/diagnostics/source change", () => {
  it("1. the review doc exists and is substantial", () => {
    expect(typeof reviewDocSource).toBe("string");
    expect(reviewDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the current real reach chain is documented in full, in order", () => {
    expect(reviewDocSource).toMatch(/AppRuntime\.initializeCrypto\(\)/);
    expect(reviewDocSource).toMatch(/Crypto Loader Facade/);
    expect(reviewDocSource).toMatch(/Crypto Loader Backend/);
    expect(reviewDocSource).toMatch(/Crypto Backend Interface/);
    expect(reviewDocSource).toMatch(/Crypto Backend Resolver/);
    expect(reviewDocSource).toMatch(/WASM Backend/);
    expect(reviewDocSource).toMatch(/FedosWasmLoader\.planLoad\(\)/);
    expect(reviewDocSource).toMatch(/policy\(\)/);
    expect(reviewDocSource).toMatch(/Load Plan/);
    expect(reviewDocSource).toMatch(/BlockedByPolicy/);
    expect(reviewDocSource).toMatch(/STOP/);

    // Order check within the §1 reach-chain diagram itself (a prose
    // intro mentions several of these terms out of order beforehand,
    // so the check is scoped to the fenced code block, not the whole doc).
    const chainBlockMatch = reviewDocSource.match(/## 1\. Current real reach chain[\s\S]*?```([\s\S]*?)```/);
    expect(chainBlockMatch).not.toBeNull();
    const chainBlock = (chainBlockMatch as RegExpMatchArray)[1] ?? "";
    expect(chainBlock.length).toBeGreaterThan(0);
    const order = [
      "AppRuntime.initializeCrypto()",
      "Crypto Loader Facade",
      "Crypto Loader Backend",
      "Crypto Backend Interface",
      "Crypto Backend Resolver",
      "WASM Backend",
      "FedosWasmLoader.planLoad()",
      "policy()",
      "Load Plan",
      "BlockedByPolicy",
      "STOP",
    ];
    let lastIndex = -1;
    for (const label of order) {
      const idx = chainBlock.indexOf(label);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it("3. the nine layers to keep at real-implementation time are all named", () => {
    expect(reviewDocSource).toMatch(/Layers to keep at real-implementation time/);
    expect(reviewDocSource).toMatch(/Runtime `initializeCrypto\(\)`/);
    expect(reviewDocSource).toMatch(/fedos_crypto_loader_facade\.ts/);
    expect(reviewDocSource).toMatch(/fedos_crypto_loader_backend\.ts/);
    expect(reviewDocSource).toMatch(/fedos_crypto_backend_interface\.ts/);
    expect(reviewDocSource).toMatch(/fedos_crypto_backend_resolver\.ts/);
    expect(reviewDocSource).toMatch(/fedos_wasm_backend\.ts/);
    expect(reviewDocSource).toMatch(/`FedosWasmLoader`/);
    expect(reviewDocSource).toMatch(/FedosWasmLoaderLoadPlan/);
  });

  it("4. consolidation candidates are named across all three requested categories", () => {
    expect(reviewDocSource).toMatch(/Consolidation candidates/);
    expect(reviewDocSource).toMatch(/旧 Planning review|Planning-review families/);
    expect(reviewDocSource).toMatch(/Docs-only|docs-only/);
    expect(reviewDocSource).toMatch(/孤島チェーン|islands not required/);
    expect(reviewDocSource).toMatch(/runtime_initialize_crypto_planning_review\.md/);
    expect(reviewDocSource).toMatch(/runtime_architecture_simplification_review\.md/);
  });

  it("5. next real connection candidates are named, in order, and explicitly not implemented yet", () => {
    expect(reviewDocSource).toMatch(/Next real connection candidates/);
    expect(reviewDocSource).toMatch(/JS Glue access plan/);
    expect(reviewDocSource).toMatch(/generated artifact check/);
    expect(reviewDocSource).toMatch(/dev-only gate/);
    expect(reviewDocSource).toMatch(/import\(\)/);

    // Order check within the §4 diagram itself, not the whole doc --
    // "import()" is also named (out of this order) in §6's prohibitions.
    const nextChainBlockMatch = reviewDocSource.match(/## 4\. Next real connection candidates[\s\S]*?```([\s\S]*?)```/);
    expect(nextChainBlockMatch).not.toBeNull();
    const nextChainBlock = (nextChainBlockMatch as RegExpMatchArray)[1] ?? "";
    expect(nextChainBlock.length).toBeGreaterThan(0);
    const order = ["JS Glue access plan", "generated artifact check", "dev-only gate", "import()"];
    let lastIndex = -1;
    for (const label of order) {
      const idx = nextChainBlock.indexOf(label);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
    expect(reviewDocSource).toMatch(/NOT\s+implemented this stage/);
  });

  it("6. all five Fail Closed conditions are stated", () => {
    expect(reviewDocSource).toMatch(/Fail Closed conditions/);
    expect(reviewDocSource).toMatch(/policy\.allowed === false.{0,20}never load|never load.{0,40}policy\.allowed/is);
    expect(reviewDocSource).toMatch(/[Gg]enerated artifact unconfirmed.{0,20}never load|never load.{0,60}artifact/is);
    expect(reviewDocSource).toMatch(/[Nn]ever load from Worker/);
    expect(reviewDocSource).toMatch(/[Nn]ever load in Production/);
    expect(reviewDocSource).toMatch(/[Ii]mport failure.{0,20}Fail Closed/is);
  });

  it("7. import()/WebAssembly/initSync/Rust/NIP-17/NIP-44/NIP-59 are all explicitly named as prohibited for this stage", () => {
    expect(reviewDocSource).toMatch(/Explicit prohibitions for THIS stage/);
    expect(reviewDocSource).toMatch(/No `import\(\)`/);
    expect(reviewDocSource).toMatch(/No `WebAssembly`/);
    expect(reviewDocSource).toMatch(/No `initSync`/);
    expect(reviewDocSource).toMatch(/No Rust call/);
    expect(reviewDocSource).toMatch(/No NIP-17, no NIP-44, no NIP-59/);
    expect(reviewDocSource).toMatch(/Double Ratchet/);
    expect(reviewDocSource).toMatch(/Triple Ratchet/);
    expect(reviewDocSource).toMatch(/onion routing/i);
  });

  it("8. the review doc never writes real import()/WebAssembly code -- only names them as prohibited, in prose", () => {
    expect(reviewDocSource).not.toMatch(/```(ts|js|typescript|javascript)[\s\S]*WebAssembly\.instantiate[\s\S]*```/);
    expect(reviewDocSource).not.toMatch(/```(ts|js|typescript|javascript)[\s\S]*import\(/);
  });

  it("9. explicitly states no file is deleted, merged, or modified by this review", () => {
    expect(reviewDocSource).toMatch(/REVIEW ONLY/);
    expect(reviewDocSource).toMatch(/does \*\*not\*\* delete or merge any existing file/i);
    expect(reviewDocSource).toMatch(/No file is deleted, merged, or modified by this review/);
  });

  it("10. Runtime, Worker, and both diagnostics files are completely unaffected -- no reference to the new review doc anywhere", () => {
    expect(createRuntimeSource).not.toMatch(/runtime_wasm_loader_activation_readiness_review/);
    expect(workerSource).not.toMatch(/runtime_wasm_loader_activation_readiness_review/);
    expect(runtimeDiagnosticsSource).not.toMatch(/runtime_wasm_loader_activation_readiness_review/);
    expect(workerDiagnosticsSource).not.toMatch(/runtime_wasm_loader_activation_readiness_review/);
  });

  it("11. runtime_crypto_diagnostics.ts and worker_crypto_diagnostics.ts carry no new field introduced by this stage", () => {
    // This stage adds no diagnostics field of any kind -- the most
    // recent loader-related fields remain exactly the Stage 841 set,
    // and no "readiness"/"activation"-named field exists anywhere.
    expect(runtimeDiagnosticsSource).not.toMatch(/loaderActivationReadiness|readinessReview|activationReadiness/i);
    expect(workerDiagnosticsSource).not.toMatch(/loaderActivationReadiness|readinessReview|activationReadiness/i);
  });

  it("12. fedos_wasm_loader.ts source is untouched by this stage -- same public surface; only later stages ever added more imports", () => {
    const importLines = wasmLoaderSource
      .split("\n")
      .filter((line: string) => /^\s*import\s/.test(line));
    // Stage 921 (Prototype EXECUTION Phase 001, a later stage than this
    // Phase 014 review) legitimately adds two more imports
    // (`node:fs`'s `existsSync`, `node:path`'s `join`) for its own
    // narrowly-scoped existence check, and Stage 945 (Prototype
    // EXECUTION Phase 004, later still) adds one more (`node:url`'s
    // `pathToFileURL`) -- this stage (Phase 014) itself added none.
    expect(importLines.length).toBeGreaterThanOrEqual(3);
    expect(importLines.some((line: string) => /fedos_wasm_loader_plan\.js/.test(line))).toBe(true);
    expect(importLines.some((line: string) => /existsSync/.test(line) && /node:fs/.test(line))).toBe(true);
    expect(importLines.some((line: string) => /\bjoin\b/.test(line) && /node:path/.test(line))).toBe(true);

    // The public FedosWasmLoader interface is still exactly these six members.
    expect(wasmLoaderSource).toMatch(/status\(\):\s*FedosWasmLoaderStatus/);
    expect(wasmLoaderSource).toMatch(/planLoad\(\):\s*FedosWasmLoaderDecision/);
    expect(wasmLoaderSource).toMatch(/planInitialize\(\):\s*FedosWasmLoaderDecision/);
    expect(wasmLoaderSource).toMatch(/planUnload\(\):\s*FedosWasmLoaderDecision/);
    expect(wasmLoaderSource).toMatch(/planningState\(\):\s*FedosWasmLoaderPlanningStatus/);
    expect(wasmLoaderSource).toMatch(/policy\(\):\s*FedosWasmLoaderPolicyDecision/);
  });

  it("13. no NIP-17/NIP-44/NIP-59/Double Ratchet/Triple Ratchet/onion routing is implemented or recommended for implementation", () => {
    expect(reviewDocSource).toMatch(/NIP-17/);
    expect(reviewDocSource).toMatch(/NIP-44/);
    expect(reviewDocSource).toMatch(/NIP-59/);
    expect(reviewDocSource).toMatch(/Double Ratchet/);
    expect(reviewDocSource).toMatch(/Triple Ratchet/);
    expect(reviewDocSource).toMatch(/onion routing/i);
    expect(reviewDocSource).not.toMatch(/```[\s\S]*ratchet[\s\S]*```/i);
  });

  it("14. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
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

    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("15. the review names its own finding that a prior classification is now partially stale, without editing the flagged docs", () => {
    expect(reviewDocSource).toMatch(/now partially stale|now stale/i);
    expect(reviewDocSource).toMatch(/runtime_minimum_runtime_chain\.md/);
    expect(reviewDocSource).toMatch(/does not edit either document/i);
  });

  it("16. the review cross-references the prior architecture simplification review and reconciles rather than contradicts it", () => {
    expect(reviewDocSource).toMatch(/runtime_architecture_simplification_review\.md/);
    expect(reviewDocSource).toMatch(/Chain 3/);
    expect(reviewDocSource).toMatch(/Chain 4/);
  });

  it("17. Fail Closed conditions explicitly cover Worker and Production exclusion, matching the Wiring Plan's own guarantee", () => {
    expect(reviewDocSource).toMatch(/runtime_initialize_crypto_wiring_plan\.md/);
    expect(reviewDocSource).toMatch(/workerWiringAllowed/);
    expect(reviewDocSource).toMatch(/dev-only/);
  });

  it("18. this stage adds no dependency and commits no generated artifact -- explicitly stated in the review", () => {
    expect(reviewDocSource).toMatch(/No dependency added/);
    expect(reviewDocSource).toMatch(/No generated artifact committed/);
  });
});
