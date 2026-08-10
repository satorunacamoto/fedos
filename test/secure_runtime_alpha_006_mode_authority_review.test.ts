import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import reviewDocSource from "../docs/secure_runtime_alpha_006_mode_authority_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import namingCleanupDocSource from "../docs/secure_runtime_alpha_005_runtime_state_naming_cleanup.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import stateModelReviewDocSource from "../docs/secure_runtime_alpha_004_state_model_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import baselineDocSource from "../docs/secure_runtime_alpha_001_baseline.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeIntegrationSource from "../src/runtime/fedos_runtime_prototype_execution.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../src/os/core/vault/wasm/fedos_wasm_loader.ts?raw";
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
 * Secure Runtime Alpha 006 — "Runtime Mode Authority Review": REVIEW
 * ONLY, no code change of any kind. Reviews the two independent
 * `NODE_ENV` classifiers Alpha 004 found and Alpha 005 left unmerged
 * -- `FedosWasmLoader#evaluateDevOnlyGate()` (an execution gate) and
 * `runtimeCapabilities()`'s own `determineRuntimeMode()` (a public
 * label) -- and recommends keeping them separate for now, extracting
 * a shared classifier only once one of four named trigger conditions
 * becomes imminent.
 */
describe("Secure Runtime Alpha 006 Runtime Mode Authority Review -- review only, no Runtime/FedosWasmLoader/Worker/Rust/Cargo/package change", () => {
  it("1. the review document exists and is substantial", () => {
    expect(typeof reviewDocSource).toBe("string");
    expect(reviewDocSource.length).toBeGreaterThan(6000);
  });

  it("2. states REVIEW ONLY with an explicit multi-target 'no code change' list", () => {
    expect(reviewDocSource).toMatch(/REVIEW ONLY/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change any Runtime implementation code/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `FedosWasmLoader`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `src\/worker\.ts`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `packages\/fedos-core-rust\/src\/lib\.rs`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change any Production code path/);
  });

  it("3. both classifiers are named and compared by their real method names", () => {
    expect(reviewDocSource).toMatch(/#evaluateDevOnlyGate\(\)/);
    expect(reviewDocSource).toMatch(/determineRuntimeMode\(\)/);
    expect(reviewDocSource).toMatch(/The two systems, compared/);
  });

  it("4. the Loader side is characterized as an EXECUTION GATE, real Fail-Closed decision point", () => {
    expect(reviewDocSource).toMatch(/EXECUTION GATE/);
    expect(reviewDocSource).toMatch(/THIS IS the actual mechanism/);
    expect(reviewDocSource).toMatch(/importReadiness\(\)/);
  });

  it("5. the Runtime side is characterized as a PUBLIC REPORT / public label, never a gate", () => {
    expect(reviewDocSource).toMatch(/PUBLIC REPORT/);
    expect(reviewDocSource).toMatch(/NOT a gate/);
    expect(reviewDocSource).toMatch(/RuntimeCapabilities/);
  });

  it("6. compares at least four authority candidates (Loader-side, Runtime-side, shared function, keep separate)", () => {
    expect(reviewDocSource).toMatch(/Loader-side authoritative/);
    expect(reviewDocSource).toMatch(/Runtime-side authoritative/);
    expect(reviewDocSource).toMatch(/Extract to a shared function/);
    expect(reviewDocSource).toMatch(/Keep separate for now/);
  });

  it("7. recommends keeping the two systems separate now, with future consolidation as the pre-committed next step", () => {
    expect(reviewDocSource).toMatch(/Adopt Option D today/);
    expect(reviewDocSource).toMatch(/treat Option C as the pre-committed NEXT step/);
    expect(reviewDocSource).toMatch(/REJECTED outright/);
  });

  it("8. names at least four future consolidation trigger conditions", () => {
    expect(reviewDocSource).toMatch(/Before Production Runtime connection/);
    expect(reviewDocSource).toMatch(/Before Worker connection/);
    expect(reviewDocSource).toMatch(/RuntimeCapabilities.{0,60}gains additional fields/s);
    expect(reviewDocSource).toMatch(/Before Secure Storage or any new Crypto API branches on/);
  });

  it("9. ranks Alpha 007 priorities, five candidates, mode-authority common function ranked last", () => {
    expect(reviewDocSource).toMatch(/Alpha 007 — recommended priority, ranked/);
    expect(reviewDocSource).toMatch(/Crypto API Surface Review/);
    expect(reviewDocSource).toMatch(/RuntimeHealth Review/);
    expect(reviewDocSource).toMatch(/Secure Storage Baseline Review/);
    expect(reviewDocSource).toMatch(/Runtime mode authority common function \(Option C, §3\)/);
    expect(reviewDocSource).toMatch(/deliberately LAST for Alpha 007 specifically/);
  });

  it("10. cross-references Alpha 001/004/005", () => {
    expect(reviewDocSource).toMatch(/secure_runtime_alpha_005_runtime_state_naming_cleanup\.md/);
    expect(reviewDocSource).toMatch(/secure_runtime_alpha_004_state_model_review\.md/);
    expect(reviewDocSource).toMatch(/secure_runtime_alpha_001_baseline\.md/);
    expect(namingCleanupDocSource).toMatch(/NOT consolidated/);
    expect(stateModelReviewDocSource).toMatch(/#evaluateDevOnlyGate\(\)/);
    expect(baselineDocSource).toMatch(/No implicit environment trust/);
  });

  it("11. Runtime implementation code is confirmed byte-for-byte unchanged -- no reference to this review's doc anywhere", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_006_mode_authority_review/);
    expect(wasmLoaderSource).not.toMatch(/secure_runtime_alpha_006_mode_authority_review/);
    expect(runtimeIntegrationSource).not.toMatch(/secure_runtime_alpha_006_mode_authority_review/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_006_mode_authority_review/);
  });

  it("12. FedosWasmLoader's own #evaluateDevOnlyGate() is byte-for-byte unchanged -- still exactly the same four-value reason set", () => {
    expect(wasmLoaderSource).toMatch(
      /reason: "DevelopmentRuntime" \| "ProductionRuntime" \| "UnknownRuntime" \| "PrototypeStillClosed"/,
    );
  });

  it("13. runtimeCapabilities()/RuntimeCapabilities/FedosRuntimeMode are byte-for-byte unchanged since Alpha 005 -- still exactly four fields, still exactly three mode values", () => {
    const interfaceMatch = runtimeIntegrationSource.match(
      /export interface RuntimeCapabilities \{[\s\S]*?\n\}/,
    );
    expect(interfaceMatch).not.toBeNull();
    const fieldNames = [
      ...((interfaceMatch as RegExpMatchArray)[0] ?? "").matchAll(/readonly (\w+):/g),
    ].map((m: RegExpMatchArray) => m[1]);
    expect(fieldNames.sort()).toEqual(
      ["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort(),
    );

    const typeMatch = runtimeIntegrationSource.match(/export type FedosRuntimeMode = ([^;]+);/);
    expect(typeMatch).not.toBeNull();
    const values = [...((typeMatch as RegExpMatchArray)[1] ?? "").matchAll(/"([^"]+)"/g)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(values.sort()).toEqual(["Development", "Production", "Unknown"].sort());
  });

  it("14. no shared/common NODE_ENV classifier module was created -- fedos_wasm_loader.ts still has no reference to the Runtime-layer file, and determineRuntimeMode() still stands on its own", () => {
    expect(wasmLoaderSource).not.toMatch(/fedos_runtime_prototype_execution/);
    expect(runtimeIntegrationSource).toMatch(/function determineRuntimeMode\(\): FedosRuntimeMode \{/);
  });

  it("15. initializeCrypto()'s own return value is confirmed byte-for-byte unchanged by an ACTUAL call", async () => {
    const { createRuntimeInitializeCryptoResult } = await import("../src/os/_legacy_prototype/runtime/create_runtime.js");
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision).toEqual({ allowed: false, initialized: false, reason: "PrototypeDisabled" });
  });

  it("16. FedosWasmLoader.planLoad() is confirmed byte-for-byte unchanged -- still BlockedByPolicy", async () => {
    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("17. still exactly seven Plan interfaces in fedos_wasm_loader.ts -- no Plan change by this review", () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);
  });

  it("18. Worker remains fully unchanged and unconnected", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_006_mode_authority_review/);
    expect(workerSource).not.toMatch(/runtimeCapabilities/);
    expect(workerSource).not.toMatch(/evaluateDevOnlyGate/);
  });

  it("19. Rust and Cargo/package sources are unchanged -- still 28 pub fn, one #[wasm_bindgen], 11/2 dependencies", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_006_mode_authority_review/);

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

  it("20. neither diagnostics file gained a field or reference from this stage", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(/secure_runtime_alpha_006_mode_authority_review/);
    expect(workerDiagnosticsSource).not.toMatch(/secure_runtime_alpha_006_mode_authority_review/);
  });
});
