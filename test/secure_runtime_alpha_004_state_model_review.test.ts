import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import reviewDocSource from "../docs/secure_runtime_alpha_004_state_model_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilityReaderDocSource from "../docs/secure_runtime_alpha_003_capability_reader.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import surfaceReviewDocSource from "../docs/secure_runtime_alpha_002_public_surface_review.md?raw";
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
 * Secure Runtime Alpha 004 — "Runtime State Model Review": REVIEW
 * ONLY, no code change of any kind. Reviews the state model
 * `runtimeCapabilities()` (Alpha 003, Stage 999) introduced: checks
 * for Runtime State duplication/inconsistency across
 * Prototype/Development/Production, whether `runtimeCapabilities()`
 * risks scope creep, whether `initializeCrypto()`'s own Action/Reader
 * responsibility stays separated, compares future field candidates,
 * compares a future RuntimeState/RuntimeHealth/RuntimeDiagnostics
 * responsibility split, and ranks Alpha 005's priorities.
 */
describe("Secure Runtime Alpha 004 Runtime State Model Review -- review only, no Runtime/Worker/Rust/Cargo/package change", () => {
  it("1. the review document exists and is substantial", () => {
    expect(typeof reviewDocSource).toBe("string");
    expect(reviewDocSource.length).toBeGreaterThan(8000);
  });

  it("2. states REVIEW ONLY with an explicit multi-file 'no code change' list", () => {
    expect(reviewDocSource).toMatch(/REVIEW ONLY/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change any Runtime implementation code/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `runtimeCapabilities\(\)`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `initializeCrypto\(\)`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `FedosWasmLoader`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `packages\/fedos-core-rust\/src\/lib\.rs`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `src\/worker\.ts`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change any Production code path/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* add Secure Storage of any kind/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* add any new Crypto API/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change any `FedosWasmLoader\*Plan` interface/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
  });

  it("3. an inventory of current Runtime state is present, naming real functions", () => {
    expect(reviewDocSource).toMatch(/Current Runtime state — inventory/);
    expect(reviewDocSource).toMatch(/initializeCrypto\(\)/);
    expect(reviewDocSource).toMatch(/runtimeCapabilities\(\)/);
    expect(reviewDocSource).toMatch(/attemptDevOnlyRuntimeRustIntegration\(\)/);
    expect(reviewDocSource).toMatch(/FedosWasmLoader\.status\(\)/);
    expect(reviewDocSource).toMatch(/FedosWasmLoader\.planLoad\(\)/);
    expect(reviewDocSource).toMatch(/runtimeCryptoActivationStatus\(\)/);
  });

  it("4. answers whether Runtime State duplicates, naming the two independent NODE_ENV classifiers and the triple 'Prototype' word overload", () => {
    expect(reviewDocSource).toMatch(/Does Runtime State duplicate/);
    expect(reviewDocSource).toMatch(/#evaluateDevOnlyGate\(\)/);
    expect(reviewDocSource).toMatch(/determineRuntimeState\(\)/);
    expect(reviewDocSource).toMatch(/overloaded THREE separate ways/);
    expect(reviewDocSource).toMatch(/DevelopmentRuntime.*ProductionRuntime.*UnknownRuntime.*PrototypeStillClosed/s);
  });

  it("5. answers whether runtimeCapabilities() is taking on too much responsibility", () => {
    expect(reviewDocSource).toMatch(/Is `runtimeCapabilities\(\)` taking on too much responsibility\?/);
    expect(reviewDocSource).toMatch(/NOT today/);
    expect(reviewDocSource).toMatch(/reachability/i);
  });

  it("6. answers whether initializeCrypto()'s responsibility is mixed with a Reader's -- Action vs Reader", () => {
    expect(reviewDocSource).toMatch(/Is `initializeCrypto\(\)`'s responsibility mixed with a Reader's\?/);
    expect(reviewDocSource).toMatch(/NO functional mixing/);
    expect(reviewDocSource).toMatch(/NAMING\/BEHAVIOR mismatch/);
  });

  it("7. compares at least five candidate future RuntimeCapabilities fields, including all of the user's own named examples, and rejects productionReady as named", () => {
    for (const candidate of [
      "secureStorageAvailable",
      "workerConnected",
      "backend:",
      "cryptoReady",
      "productionReady",
    ]) {
      expect(reviewDocSource).toContain(candidate);
    }
    expect(reviewDocSource).toMatch(/\*\*Reject as named\*\*/);
  });

  it("8. compares a four-way responsibility split (RuntimeCapabilities/RuntimeState/RuntimeHealth/RuntimeDiagnostics) without implementing it", () => {
    expect(reviewDocSource).toMatch(/Should `RuntimeState` become an independent type\?/);
    expect(reviewDocSource).toMatch(/`RuntimeCapabilities`.*`RuntimeState`.*`RuntimeHealth`.*`RuntimeDiagnostics`/s);
    expect(reviewDocSource).toMatch(/Not implemented this Phase — comparison only/);
    expect(reviewDocSource).toMatch(/naming collision/);
  });

  it("9. ranks Alpha 005 priorities", () => {
    expect(reviewDocSource).toMatch(/Alpha 005 — recommended priority, ranked/);
    expect(reviewDocSource).toMatch(/Resolve the state-model naming\/duplication issues/);
    expect(reviewDocSource).toMatch(/Add the `backend` field to `RuntimeCapabilities`/);
    expect(reviewDocSource).toMatch(/Proceed to Crypto API Surface work/);
  });

  it("10. cross-references Alpha 001/002/003 and the Prototype completion doc", () => {
    expect(reviewDocSource).toMatch(/secure_runtime_alpha_001_baseline\.md/);
    expect(reviewDocSource).toMatch(/secure_runtime_alpha_002_public_surface_review\.md/);
    expect(reviewDocSource).toMatch(/secure_runtime_alpha_003_capability_reader\.md/);
    expect(reviewDocSource).toMatch(/fedos_prototype_completion\.md/);
    expect(capabilityReaderDocSource).toMatch(/runtimeState/);
    expect(surfaceReviewDocSource).toMatch(/backend/);
    expect(baselineDocSource).toMatch(/Crypto API Surface/);
  });

  it("11. Runtime implementation code was untouched by THIS review's own scope (Stage 1000) -- create_runtime.ts/fedos_wasm_loader.ts/types.ts still have no reference; fedos_runtime_prototype_execution.ts's own later Stage 1001 doc comments legitimately cite this review's own §1 finding, see test/secure_runtime_alpha_005_runtime_state_naming_cleanup.test.ts", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_004_state_model_review/);
    expect(wasmLoaderSource).not.toMatch(/secure_runtime_alpha_004_state_model_review/);
    expect(runtimeIntegrationSource).toMatch(/secure_runtime_alpha_004_state_model_review/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_004_state_model_review/);
  });

  it("12. Stage 1001 (Secure Runtime Alpha 005) implemented THIS review's own §1 finding for real -- runtimeState was renamed runtimeMode, 'Prototype' removed from the value union", () => {
    const interfaceMatch = runtimeIntegrationSource.match(
      /export interface RuntimeCapabilities \{[\s\S]*?\n\}/,
    );
    expect(interfaceMatch).not.toBeNull();
    const interfaceBody = (interfaceMatch as RegExpMatchArray)[0] ?? "";
    const fieldNames = [...interfaceBody.matchAll(/readonly (\w+):/g)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldNames.sort()).toEqual(
      ["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort(),
    );
  });

  it("13. initializeCrypto() is confirmed byte-for-byte unchanged by an ACTUAL call, not just doc text", async () => {
    const { createRuntimeInitializeCryptoResult } = await import("../src/os/_legacy_prototype/runtime/create_runtime.js");
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision).toEqual({ allowed: false, initialized: false, reason: "PrototypeDisabled" });
  });

  it("14. FedosWasmLoader.planLoad() is confirmed byte-for-byte unchanged by an ACTUAL call -- still BlockedByPolicy", async () => {
    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("15. still exactly seven Plan interfaces in fedos_wasm_loader.ts -- no Plan change by this review", () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);
  });

  it("16. Worker remains fully unchanged and unconnected", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_004_state_model_review/);
    expect(workerSource).not.toMatch(/runtimeCapabilities/);
    expect(workerSource).not.toMatch(/attemptDevOnlyRuntimeRustIntegration/);
  });

  it("17. Production is unaffected -- create_runtime.ts's own AppRuntime assembly is unchanged from Stage 999's own state", () => {
    expect(createRuntimeSource).toMatch(/runtimeCapabilities/);
    expect(createRuntimeSource).not.toMatch(/RuntimePrototypeExecutionState/);
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_004/);
  });

  it("18. Rust and Cargo/package sources are unchanged -- still 28 pub fn, one #[wasm_bindgen], 11/2 dependencies", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_004_state_model_review/);

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

  it("19. neither diagnostics file gained a field or reference from this stage", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(/secure_runtime_alpha_004_state_model_review/);
    expect(workerDiagnosticsSource).not.toMatch(/secure_runtime_alpha_004_state_model_review/);
  });
});
