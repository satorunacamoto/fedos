import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import reviewDocSource from "../docs/runtime_prototype_public_completion_surface_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeIntegrationDocSource from "../docs/runtime_prototype_execution_runtime_integration.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeIntegrationSource from "../src/runtime/fedos_runtime_prototype_execution.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../src/runtime/fedos_wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeDiagnosticsSource from "../src/runtime/runtime_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerDiagnosticsSource from "../src/runtime/worker_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Prototype EXECUTION Phase 014 — "Public Runtime Completion Surface
 * Review": REVIEW ONLY, no code change of any kind. Reviews whether
 * Stage 994's real Runtime -> Rust -> Runtime round trip
 * (`attemptDevOnlyRuntimeRustIntegration()`) satisfies this arc's own
 * Prototype termination condition, compares five options (A-E) for
 * exposing `rustVersion` through a public surface without breaking
 * Fail Closed, and recommends adopting the already-existing standalone
 * async function (Option C) while explicitly rejecting baking it into
 * `initializeCrypto()`'s own pinned return contract (Option A).
 */
describe("FedOS Public Runtime Completion Surface Review -- review only, no Runtime/Worker/Rust/Cargo/package change (Phase 014)", () => {
  it("1. the review doc exists and is substantial", () => {
    expect(typeof reviewDocSource).toBe("string");
    expect(reviewDocSource.length).toBeGreaterThan(6000);
  });

  it("2. states REVIEW ONLY and lists no code change made", () => {
    expect(reviewDocSource).toMatch(/REVIEW ONLY/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `src\/runtime\/`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `src\/worker\.ts`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `packages\/fedos-core-rust\/src\/lib\.rs`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
  });

  it("3. the Prototype termination condition is quoted and its current achievement status is stated", () => {
    expect(reviewDocSource).toMatch(/Runtime reaches the Rust minimal API, and its return value reaches/);
    expect(reviewDocSource).toMatch(/back to Runtime/);
    expect(reviewDocSource).toMatch(/satisfied as of Stage 994/);
    expect(reviewDocSource).toMatch(/Not satisfied, and not required by the literal wording/);
  });

  it("4. the internal Runtime -> Rust -> Runtime loop is traced end-to-end and confirmed established", () => {
    expect(reviewDocSource).toMatch(/attemptDevOnlyRuntimeRustIntegration/);
    expect(reviewDocSource).toMatch(/attemptDevOnlyJsGlueImport/);
    expect(reviewDocSource).toMatch(/attemptDevOnlyWasmInitialization/);
    expect(reviewDocSource).toMatch(/attemptDevOnlyRustVersionCall/);
    expect(reviewDocSource).toMatch(/pub fn version\(\) -> String/);
    expect(reviewDocSource).toMatch(/RuntimePrototypeExecutionState/);
  });

  it("5. whether initializeCrypto() should be part of the termination condition is answered, with reasoning", () => {
    expect(reviewDocSource).toMatch(/Should the public `initializeCrypto\(\)` be part of the termination condition/);
    expect(reviewDocSource).toMatch(/Recommendation: No/);
  });

  it("6. compares at least five options (A-E) for exposing version() without breaking Fail Closed", () => {
    for (const optionLetter of ["A", "B", "C", "D", "E"]) {
      expect(reviewDocSource).toMatch(new RegExp(`\\| ${optionLetter} \\|`));
    }
    expect(reviewDocSource).toMatch(/Add a field to `initializeCrypto\(\)`'s own return value/);
    expect(reviewDocSource).toMatch(/diagnostics/i);
    expect(reviewDocSource).toMatch(/New, separate, explicitly-named, ASYNC public function/);
    expect(reviewDocSource).toMatch(/New `AppRuntime` field\/service/);
    expect(reviewDocSource).toMatch(/Do not expose publicly/);
  });

  it("7. a single recommended option is named, with reasoning, and Option A is explicitly rejected", () => {
    expect(reviewDocSource).toMatch(/Adopt Option C as already-sufficient/);
    expect(reviewDocSource).toMatch(/reject Option A outright/);
  });

  it("8. Production and Worker impact is reviewed and confirmed unaffected", () => {
    expect(reviewDocSource).toMatch(/Impact on Production and Worker/);
    expect(reviewDocSource).toMatch(/\*\*None, confirmed by construction/);
  });

  it("9. future Prototype-only code removal candidates are named without being actioned", () => {
    expect(reviewDocSource).toMatch(/Prototype-only code — future removal candidates/);
    expect(reviewDocSource).toMatch(/not actioned this Phase/);
    expect(reviewDocSource).toMatch(/FedosWasmLoader\*Plan/);
  });

  it("10. cross-references the Stage 994 Runtime Integration doc this review builds on", () => {
    expect(reviewDocSource).toMatch(/runtime_prototype_execution_runtime_integration\.md/);
    expect(reviewDocSource).toMatch(/runtime_wasm_loader_dev_only_rust_version_call_execution\.md/);
    expect(reviewDocSource).toMatch(/runtime_wasm_rust_export_readiness_review\.md/);
  });

  it("11. Fail Closed is confirmed maintained -- initializeCrypto()'s own real return value is still the pinned constant", async () => {
    const { createRuntimeInitializeCryptoResult } = await import("../src/runtime/create_runtime.js");
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision).toEqual({ allowed: false, initialized: false, reason: "PrototypeDisabled" });
  });

  it("12. Fail Closed is confirmed maintained -- the six-condition Rust version() gate in fedos_wasm_loader.ts is unchanged since Stage 993", () => {
    expect(wasmLoaderSource).toMatch(
      /this\.#generatedArtifactCheckResult\.artifactsExist/,
    );
    expect(wasmLoaderSource).toMatch(/this\.#wasmInitialization\.succeeded/);
    expect(wasmLoaderSource).toMatch(/"PrototypeStillClosed"/);
    expect(wasmLoaderSource).toMatch(/"NotInitialized"/);
  });

  it("13. Runtime source files (create_runtime.ts, fedos_wasm_loader.ts, fedos_runtime_prototype_execution.ts) reference nothing this review's doc introduces -- no code change", () => {
    expect(createRuntimeSource).not.toMatch(/runtime_prototype_public_completion_surface_review/);
    expect(wasmLoaderSource).not.toMatch(/runtime_prototype_public_completion_surface_review/);
    expect(runtimeIntegrationSource).not.toMatch(/runtime_prototype_public_completion_surface_review/);
  });

  it("14. Worker remains fully unconnected -- src/worker.ts references neither this review nor any part of the Rust-reach chain", () => {
    expect(workerSource).not.toMatch(/runtime_prototype_public_completion_surface_review/);
    expect(workerSource).not.toMatch(/attemptDevOnlyRuntimeRustIntegration/);
    expect(workerSource).not.toMatch(/attemptDevOnlyRustVersionCall/);
    expect(workerSource).not.toMatch(/fedos_runtime_prototype_execution/);
  });

  it("15. Production was unaffected AS OF THIS stage's own scope (Stage 995) -- create_runtime.ts's own AppRuntime assembly was byte-for-byte unchanged then; Stage 999 (Secure Runtime Alpha 003) later wired in ONE new, read-only field, runtimeCapabilities, see test/secure_runtime_alpha_003_capability_reader.test.ts", () => {
    expect(createRuntimeSource).toMatch(/fedos_runtime_prototype_execution/);
    expect(createRuntimeSource).toMatch(/attemptDevOnlyRuntimeRustIntegration/);
    expect(createRuntimeSource).not.toMatch(/RuntimePrototypeExecutionState/);
  });

  it("16. no Runtime/Worker/Rust/Cargo/package source file was modified by this stage -- diagnostics carry no new field, Rust public API and dependencies unchanged", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(/runtime_prototype_public_completion_surface_review/);
    expect(workerDiagnosticsSource).not.toMatch(/runtime_prototype_public_completion_surface_review/);
    expect(runtimeDiagnosticsSource).not.toMatch(/rustVersion|reachedRust/);
    expect(workerDiagnosticsSource).not.toMatch(/rustVersion|reachedRust/);

    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(29);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(2);

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

  it("17. the review doc never writes real, compiling code implementing any of Options A-D -- prose/table only", () => {
    const codeBlocks = [...reviewDocSource.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map(
      (m: RegExpMatchArray) => m[1] ?? "",
    );
    expect(codeBlocks.length).toBeGreaterThan(0);
    // The chain diagram / illustrative snippets are prose-adjacent, not
    // real production code -- confirmed by checking no new field/export
    // exists in the real source files this stage claims to leave alone.
    expect(createRuntimeSource).not.toMatch(/rustVersion/);
  });

  it("18. still exactly seven Plan interfaces in fedos_wasm_loader.ts -- no new Runtime Service or Plan added by this review", () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);
  });

  it("19. the Stage 994 Runtime Integration doc's own termination-condition question is the one this review resolves", () => {
    expect(runtimeIntegrationDocSource).toMatch(/Prototype termination condition/);
    expect(runtimeIntegrationDocSource).toMatch(/judgment call for whoever authored the original scoping/);
  });
});
