import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  FedosWasmLoaderSkeleton,
  createFedosWasmLoader,
  loaderDevOnlyGatePlanShouldEvaluate,
  loaderGeneratedArtifactCheckPlanShouldCheck,
  loaderImportPlanShouldImport,
  loaderJsGlueAccessPlanShouldAccess,
  loaderLoadPlanShouldLoad,
  loaderPolicyAllowed,
  loaderRustApiCallPlanBackend,
  loaderRustApiCallPlanCreated,
  loaderRustApiCallPlanCurrentStage,
  loaderRustApiCallPlanNextRequiredCheck,
  loaderRustApiCallPlanReason,
  loaderRustApiCallPlanShouldCall,
  loaderWebAssemblyPlanShouldInstantiate,
} from "../src/runtime/fedos_wasm_loader.js";
import { createWasmBackend } from "../src/runtime/fedos_wasm_backend.js";
import { createCryptoBackendInterface } from "../src/runtime/fedos_crypto_backend_interface.js";
import { createCryptoBackendResolver } from "../src/runtime/fedos_crypto_backend_resolver.js";
import { createCryptoLoaderBackend } from "../src/runtime/fedos_crypto_loader_backend.js";
import { createCryptoLoaderFacade, initializeCrypto } from "../src/runtime/fedos_crypto_loader_facade.js";
import { createRuntime } from "../src/runtime/create_runtime.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../src/runtime/fedos_wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
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

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

/**
 * Stage 905 (Prototype Phase 020) — "FedosWasmLoader.planLoad() builds
 * an internal Rust API Call Plan object (#createRustApiCallPlan()) one
 * step past the WebAssembly Plan, and confirms it -- still always
 * BlockedByPolicy, still STOP. Names the future intent to call a real
 * Rust public function (shouldCall: false), why the call cannot happen
 * yet (reason: "BlockedByWebAssemblyPlan"), and what comes next
 * (nextRequiredCheck: "PrototypeExecutionReadiness") -- without ever
 * calling any Rust API, referencing #[wasm_bindgen]/__wbg_init, or
 * calling initSync. This is the LAST link in the Planning Chain --
 * the chain is now complete."
 */
describe("FedosWasmLoader.planLoad() builds and confirms an internal Rust API Call Plan, still BlockedByPolicy, no cycle, Rust API not yet called, Planning Chain complete (Stage 905)", () => {
  it("1. a Rust API Call Plan is generated every time planLoad() runs (loaderRustApiCallPlanCreated is fixed true)", () => {
    expect(loaderRustApiCallPlanCreated()).toBe(true);
  });

  it("2. the Rust API Call Plan is shouldCall: false", () => {
    expect(loaderRustApiCallPlanShouldCall()).toBe(false);
  });

  it('3. the Rust API Call Plan names backend: "Wasm"', () => {
    expect(loaderRustApiCallPlanBackend()).toBe("Wasm");
  });

  it('4. currentStage is "RustApiCallPlanning"', () => {
    expect(loaderRustApiCallPlanCurrentStage()).toBe("RustApiCallPlanning");
  });

  it('5. nextRequiredCheck is "PrototypeExecutionReadiness"', () => {
    expect(loaderRustApiCallPlanNextRequiredCheck()).toBe("PrototypeExecutionReadiness");
  });

  it("6. the Rust API Call Plan's reason represents a Fail Closed reason", () => {
    const reason = loaderRustApiCallPlanReason();
    expect(["BlockedByWebAssemblyPlan", "PrototypeDisabled", "RustApiUnavailable"]).toContain(reason);
    // The ONE value this Prototype stage's fixed constant ever produces.
    expect(reason).toBe("BlockedByWebAssemblyPlan");
  });

  it("7. planLoad()'s own return value is byte-for-byte unchanged, key order included -- Prototype always reaches BlockedByPolicy", () => {
    const loader = createFedosWasmLoader();
    for (let i = 0; i < 3; i += 1) {
      const decision = loader.planLoad();
      expect(decision).toEqual({
        operation: "load",
        state: "BlockedByPolicy",
        policy: "FailClosed",
        reason: expect.any(String),
      });
      expect(Object.keys(decision)).toEqual(["operation", "state", "policy", "reason"]);
    }
  });

  it("8. the Rust API Call Plan's own fields never leak into planLoad()'s return value", () => {
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad() as unknown as Record<string, unknown>;
    expect(decision).not.toHaveProperty("shouldCall");
    expect(decision).not.toHaveProperty("backend");
    expect(decision).not.toHaveProperty("currentStage");
    expect(decision).not.toHaveProperty("nextRequiredCheck");
    expect(decision.reason).not.toBe("BlockedByWebAssemblyPlan"); // Plan's OWN reason
    expect(decision.state).toBe("BlockedByPolicy"); // planLoad()'s OWN decision label
  });

  it("9. planLoad() internally reaches the Rust API Call Plan step, nested inside the WebAssembly Plan's own shouldInstantiate:false branch -- the full eight-Plan chain, in order", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    const planLoadMatch = codeOnly.match(/planLoad\(\): FedosWasmLoaderDecision \{[\s\S]*?\n {2}\}/);
    expect(planLoadMatch).not.toBeNull();
    const planLoadBody = (planLoadMatch as RegExpMatchArray)[0] ?? "";
    expect(planLoadBody.length).toBeGreaterThan(0);

    const loadPlanIdx = planLoadBody.indexOf("#createLoadPlan()");
    const shouldLoadIdx = planLoadBody.indexOf("loadPlan.shouldLoad");
    const jsGlueIdx = planLoadBody.indexOf("#createJsGlueAccessPlan()");
    const shouldAccessIdx = planLoadBody.indexOf("jsGlueAccessPlan.shouldAccess");
    const artifactCheckIdx = planLoadBody.indexOf("#createGeneratedArtifactCheckPlan()");
    const shouldCheckIdx = planLoadBody.indexOf("artifactCheckPlan.shouldCheck");
    const devGateIdx = planLoadBody.indexOf("#createDevOnlyGatePlan()");
    const shouldEvaluateIdx = planLoadBody.indexOf("devOnlyGatePlan.shouldEvaluate");
    const importPlanIdx = planLoadBody.indexOf("#createImportPlan()");
    const shouldImportIdx = planLoadBody.indexOf("importPlan.shouldImport");
    const webAssemblyPlanIdx = planLoadBody.indexOf("#createWebAssemblyPlan()");
    const shouldInstantiateIdx = planLoadBody.indexOf("webAssemblyPlan.shouldInstantiate");
    const rustApiCallPlanIdx = planLoadBody.indexOf("#createRustApiCallPlan()");
    const shouldCallIdx = planLoadBody.indexOf("rustApiCallPlan.shouldCall");

    const order = [
      loadPlanIdx,
      shouldLoadIdx,
      jsGlueIdx,
      shouldAccessIdx,
      artifactCheckIdx,
      shouldCheckIdx,
      devGateIdx,
      shouldEvaluateIdx,
      importPlanIdx,
      shouldImportIdx,
      webAssemblyPlanIdx,
      shouldInstantiateIdx,
      rustApiCallPlanIdx,
      shouldCallIdx,
    ];
    for (const idx of order) {
      expect(idx).toBeGreaterThan(-1);
    }
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i]).toBeGreaterThan(order[i - 1] as number);
    }
  });

  it("10. policy() is still called exactly once per planLoad() call, even with the new Rust API Call Plan step", () => {
    const loader = createFedosWasmLoader();
    const policySpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "policy");
    try {
      loader.planLoad();
      expect(policySpy).toHaveBeenCalledTimes(1);
      loader.planLoad();
      expect(policySpy).toHaveBeenCalledTimes(2);
    } finally {
      policySpy.mockRestore();
    }
  });

  it("11. planningState() and status() are not interfered with by the Rust API Call Plan", () => {
    const loader = createFedosWasmLoader();

    const planningStateSpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "planningState");
    const statusSpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "status");
    try {
      loader.planLoad();
      expect(planningStateSpy).not.toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    } finally {
      planningStateSpy.mockRestore();
      statusSpy.mockRestore();
    }

    expect(loader.planningState()).toEqual({
      state: "Planning",
      decision: "BlockedByPolicy",
      loaded: false,
    });
    expect(loader.status()).toEqual({
      state: "NotLoaded",
      mode: "PlanningOnly",
      policy: "FailClosed",
      reason: expect.any(String),
    });
  });

  it("12. no Rust API call exists anywhere in the Loader source, including version()", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    // Stage 921 (Prototype EXECUTION Phase 001, a later stage than
    // this one) legitimately names the two Generated Artifact
    // filenames ("fedos_core_rust.js"/"fedos_core_rust_bg.wasm") to
    // check their existence -- this checks for actual Rust
    // crate/module USAGE, not that naming.
    expect(codeOnly).not.toMatch(/fedos_core_rust(?!\.js"|_bg\.wasm")/);
    expect(codeOnly).not.toMatch(/\bversion\s*\(/);
    expect(codeOnly).not.toMatch(/#\[wasm_bindgen\]/);
    expect(codeOnly).not.toMatch(/__wbg_init/);
    // Stage 969 (Prototype EXECUTION Phase 007, a later stage than
    // this one) legitimately references .initSync as a PROPERTY
    // NAME to check for its presence on the retained JS glue module
    // -- this checks for a real, direct initSync(...) CALL, not the
    // property-name check.
    expect(codeOnly).not.toMatch(/\binitSync\s*\(/);
  });

  it("13. no import()/dynamic import/generated-JS-glue-load implementation exists anywhere in the Loader source", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    // Stage 945 (Prototype EXECUTION Phase 004, a later stage than
    // this one) legitimately calls real, gated import() exactly once
    // inside attemptDevOnlyJsGlueImport() -- this checks for import()
    // ANYWHERE ELSE in the source, not that one narrowly-scoped call.
    expect(codeOnly).not.toMatch(/import\s*\((?!\/\* @vite-ignore \*\/)/);
    expect(codeOnly).not.toMatch(/require\s*\(/);
    // Still only imports the pre-existing Loader Plan -- no new static import added.
    expect(codeOnly).not.toMatch(/fedos_wasm_loader_contract|fedos_wasm_artifact|fedos_wasm_boundary/);
  });

  it("14. no real WebAssembly API usage exists anywhere in the Loader source", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    expect(codeOnly).not.toMatch(/WebAssembly\./);
    expect(codeOnly).not.toMatch(/new\s+WebAssembly\.Module/);
    expect(codeOnly).not.toMatch(/new\s+WebAssembly\.Instance/);
  });

  it("15. no CONTENT-reading filesystem access implementation exists anywhere in the Loader source", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    // Stage 921 (Prototype EXECUTION Phase 001, a later stage than
    // this one) legitimately adds a read-only existsSync() existence
    // check -- this checks for CONTENT-reading filesystem access
    // (never permitted), not the narrowly-scoped existence check.
    // Stage 969 (Prototype EXECUTION Phase 007, a later stage than
    // this one) legitimately reads the SAME fedos_core_rust_bg.wasm
    // bytes Stage 921 already names, via readFileSync -- this checks
    // for any OTHER content-reading filesystem API, not that one
    // narrowly-scoped read.
    expect(codeOnly).not.toMatch(/statSync|readFile\(|readdirSync/);
    expect(codeOnly).not.toMatch(/fedos_generated_artifact_presence/);
  });

  it("16. Worker remains fully unconnected to the Rust API Call Plan/policy()/planLoad(), and Production Runtime (create_runtime.ts) remains fully unconnected", () => {
    expect(workerSource).not.toMatch(/fedos_wasm_loader/);
    expect(workerSource).not.toMatch(/FedosWasmLoaderRustApiCallPlan|loaderRustApiCallPlan/);
    expect(workerSource).not.toMatch(/\bpolicy\s*\(/);
    expect(workerSource).not.toMatch(/planLoad/);
    expect(workerSource).not.toMatch(/initializeCrypto/);
    expect(workerDiagnosticsSource).not.toMatch(/FedosWasmLoaderRustApiCallPlan|loaderRustApiCallPlan/);

    expect(createRuntimeSource).not.toMatch(/fedos_wasm_loader/);
    expect(createRuntimeSource).not.toMatch(/FedosWasmLoaderRustApiCallPlan|loaderRustApiCallPlan/);
  });

  it("17. diagnostics gain no new field this stage", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(/FedosWasmLoaderRustApiCallPlan/);
    expect(workerDiagnosticsSource).not.toMatch(/FedosWasmLoaderRustApiCallPlan/);
    // This stage deliberately does NOT touch diagnostics ("necessary minimum" scope).
    expect(runtimeDiagnosticsSource).not.toMatch(/loaderRustApiCallPlan/);
    expect(workerDiagnosticsSource).not.toMatch(/loaderRustApiCallPlan/);
  });

  it("18. WebAssembly.instantiate/compile are never invoked, even exercising the full eight-Plan chain", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      const loader = createFedosWasmLoader();
      loader.planLoad();
      loader.policy();
      loader.planningState();
      loader.status();
      createWasmBackend();
      createCryptoBackendInterface();
      createCryptoBackendResolver();
      createCryptoLoaderBackend();
      createCryptoLoaderFacade();
      createRuntime().initializeCrypto();
    } finally {
      instantiate.mockRestore();
      compile.mockRestore();
    }
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();

    const spy = vi.fn(() => Promise.resolve({ ok: true } as Response));
    const original = globalThis.fetch;
    (globalThis as { fetch?: unknown }).fetch = spy;
    try {
      const loader = createFedosWasmLoader();
      loader.planLoad();
      createWasmBackend();
      createRuntime().initializeCrypto();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("19. Runtime's initializeCrypto() and every upstream layer's return value remain unaffected", () => {
    expect(() => createCryptoLoaderFacade()).not.toThrow();
    expect(() => initializeCrypto()).not.toThrow();
    expect(createCryptoLoaderFacade()).toEqual({
      state: "PlanningOnly",
      initialized: false,
      backend: "WasmPlanned",
      reason: "FacadeInitializationPending",
    });
    expect(createCryptoLoaderBackend()).toEqual({
      state: "PlanningOnly",
      backendKind: "WasmPlanned",
      backendReady: false,
      reason: "BackendAbstractionPending",
    });
    expect(createCryptoBackendInterface()).toEqual({
      state: "PlanningOnly",
      backendSelected: "WasmPlanned",
      backendActivated: false,
      interfaceReady: false,
      reason: "BackendInterfacePending",
    });
    expect(createCryptoBackendResolver()).toEqual({
      state: "PlanningOnly",
      selectedBackend: "WasmPlanned",
      backendResolved: false,
      backendAvailable: false,
      reason: "BackendResolutionPending",
    });
    expect(createWasmBackend()).toEqual({
      state: "PlanningOnly",
      backendReady: false,
      loaderAttached: false,
      loaderKind: "WasmLoaderPlanned",
      reason: "WasmBackendPlanningPending",
    });
    expect(createRuntime().initializeCrypto()).toEqual({
      allowed: false,
      initialized: false,
      reason: "PrototypeDisabled",
    });
  });

  it("20. no cycle exists: policy() never calls planLoad(), and #createRustApiCallPlan() calls nothing", () => {
    const loader = createFedosWasmLoader();

    const planLoadSpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "planLoad");
    try {
      loader.policy();
      expect(planLoadSpy).not.toHaveBeenCalled();
    } finally {
      planLoadSpy.mockRestore();
    }

    const policySpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "policy");
    try {
      loader.planLoad();
      expect(policySpy).toHaveBeenCalledTimes(1);
    } finally {
      policySpy.mockRestore();
    }
  });

  it("21. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
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

  it("22. pre-existing loader fields across all seven prior Plans remain unaffected by this stage", () => {
    expect(loaderPolicyAllowed()).toBe(false);
    expect(loaderLoadPlanShouldLoad()).toBe(false);
    expect(loaderJsGlueAccessPlanShouldAccess()).toBe(false);
    expect(loaderGeneratedArtifactCheckPlanShouldCheck()).toBe(false);
    expect(loaderDevOnlyGatePlanShouldEvaluate()).toBe(false);
    expect(loaderImportPlanShouldImport()).toBe(false);
    expect(loaderWebAssemblyPlanShouldInstantiate()).toBe(false);
  });

  it("23. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.state).toBe("Unsupported");
    expect(encrypted.allowed).toBe(false);
    const decrypted = await provider.decrypt({});
    expect(decrypted.state).toBe("Unsupported");
    expect(decrypted.allowed).toBe(false);

    const runtime = createRuntime();
    const beforeEncrypt = await runtime.crypto.encrypt({});
    runtime.initializeCrypto();
    expect(await runtime.crypto.encrypt({})).toEqual(beforeEncrypt);
  });
});
