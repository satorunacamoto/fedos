import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  FedosWasmLoaderSkeleton,
  createFedosWasmLoader,
  loaderDevOnlyGatePlanBackend,
  loaderDevOnlyGatePlanCreated,
  loaderDevOnlyGatePlanCurrentStage,
  loaderDevOnlyGatePlanNextRequiredCheck,
  loaderDevOnlyGatePlanReason,
  loaderDevOnlyGatePlanShouldEvaluate,
  loaderGeneratedArtifactCheckPlanShouldCheck,
  loaderJsGlueAccessPlanShouldAccess,
  loaderLoadPlanShouldLoad,
  loaderPolicyAllowed,
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
 * Stage 881 (Prototype Phase 017) — "FedosWasmLoader.planLoad() builds
 * an internal Dev-only Gate Plan object (#createDevOnlyGatePlan()) one
 * step past the Generated Artifact Check Plan, and confirms it --
 * still always BlockedByPolicy, still STOP. Names the Development-
 * Runtime-only intent (shouldEvaluate: false), why evaluation is not
 * performed yet (reason: "BlockedByGeneratedArtifactCheckPlan"), and
 * what comes next (nextRequiredCheck: "ImportPlanning") -- without
 * reading process.env/import.meta/NODE_ENV or performing any real
 * Development/Production determination. Real environment evaluation,
 * Dev-only Gate evaluation, import(), WebAssembly, and Rust remain
 * Phase 018+'s responsibility."
 */
describe("FedosWasmLoader.planLoad() builds and confirms an internal Dev-only Gate Plan, still BlockedByPolicy, no cycle, Development determination/import()/WebAssembly/Rust not yet implemented (Stage 881)", () => {
  it("1. a Dev-only Gate Plan is generated every time planLoad() runs (loaderDevOnlyGatePlanCreated is fixed true)", () => {
    expect(loaderDevOnlyGatePlanCreated()).toBe(true);
  });

  it("2. the Dev-only Gate Plan is shouldEvaluate: false", () => {
    expect(loaderDevOnlyGatePlanShouldEvaluate()).toBe(false);
  });

  it('3. the Dev-only Gate Plan names backend: "Wasm"', () => {
    expect(loaderDevOnlyGatePlanBackend()).toBe("Wasm");
  });

  it("4. currentStage names Dev-only Gate planning", () => {
    const stage = loaderDevOnlyGatePlanCurrentStage();
    expect(stage).toBe("DevOnlyGatePlanning");
    expect(stage).toMatch(/DevOnlyGate/);
  });

  it("5. nextRequiredCheck is ImportPlanning", () => {
    expect(loaderDevOnlyGatePlanNextRequiredCheck()).toBe("ImportPlanning");
  });

  it("6. the Dev-only Gate Plan's reason represents a Fail Closed reason", () => {
    const reason = loaderDevOnlyGatePlanReason();
    expect(["BlockedByGeneratedArtifactCheckPlan", "PrototypeDisabled", "DevelopmentGateUnavailable"]).toContain(
      reason,
    );
    // The ONE value this Prototype stage's fixed constant ever produces.
    expect(reason).toBe("BlockedByGeneratedArtifactCheckPlan");
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

  it("8. the Dev-only Gate Plan's own fields never leak into planLoad()'s return value", () => {
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad() as unknown as Record<string, unknown>;
    expect(decision).not.toHaveProperty("shouldEvaluate");
    expect(decision).not.toHaveProperty("backend");
    expect(decision).not.toHaveProperty("currentStage");
    expect(decision).not.toHaveProperty("nextRequiredCheck");
    expect(decision.reason).not.toBe("BlockedByGeneratedArtifactCheckPlan"); // Plan's OWN reason
    expect(decision.state).toBe("BlockedByPolicy"); // planLoad()'s OWN decision label
  });

  it("9. planLoad() internally reaches the Dev-only Gate Plan step, nested inside the Generated Artifact Check Plan's own shouldCheck:false branch", () => {
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

    expect(loadPlanIdx).toBeGreaterThan(-1);
    expect(shouldLoadIdx).toBeGreaterThan(loadPlanIdx);
    expect(jsGlueIdx).toBeGreaterThan(shouldLoadIdx);
    expect(shouldAccessIdx).toBeGreaterThan(jsGlueIdx);
    expect(artifactCheckIdx).toBeGreaterThan(shouldAccessIdx);
    expect(shouldCheckIdx).toBeGreaterThan(artifactCheckIdx);
    expect(devGateIdx).toBeGreaterThan(shouldCheckIdx);
    expect(shouldEvaluateIdx).toBeGreaterThan(devGateIdx);
  });

  it("10. policy() is still called exactly once per planLoad() call, even with the new Dev-only Gate Plan step", () => {
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

  it("11. planningState() and status() are not interfered with by the Dev-only Gate Plan", () => {
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

  it("12. no Development-judgement implementation exists: no process.env, import.meta, or NODE_ENV reference anywhere in the Loader source", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    expect(codeOnly).not.toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/import\.meta/);
    expect(codeOnly).not.toMatch(/NODE_ENV/);
    expect(codeOnly).not.toMatch(/isDevelopment|isProduction|is_development|is_production/i);
  });

  it("13. Runtime's initializeCrypto() return value is unaffected", () => {
    const runtime = createRuntime();
    expect(runtime.initializeCrypto()).toEqual({
      allowed: false,
      initialized: false,
      reason: "PrototypeDisabled",
    });
  });

  it("14. Facade/Backend Abstraction/Backend Interface/Backend Resolver/WASM Backend return values are unaffected", () => {
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
  });

  it("15. Worker remains fully unconnected to the Dev-only Gate Plan/policy()/planLoad()", () => {
    expect(workerSource).not.toMatch(/fedos_wasm_loader/);
    expect(workerSource).not.toMatch(/DevOnlyGatePlan/);
    expect(workerSource).not.toMatch(/\bpolicy\s*\(/);
    expect(workerSource).not.toMatch(/planLoad/);
    expect(workerSource).not.toMatch(/initializeCrypto/);
    expect(workerDiagnosticsSource).not.toMatch(/DevOnlyGatePlan/);
  });

  it("16. Production Runtime (create_runtime.ts) remains fully unconnected, and diagnostics gain no new field this stage", () => {
    expect(createRuntimeSource).not.toMatch(/fedos_wasm_loader/);
    expect(createRuntimeSource).not.toMatch(/DevOnlyGatePlan/);
    expect(runtimeDiagnosticsSource).not.toMatch(/DevOnlyGatePlan/);
    // This stage deliberately does NOT touch diagnostics ("necessary minimum" scope).
    expect(runtimeDiagnosticsSource).not.toMatch(/loaderDevOnlyGatePlan/);
    expect(workerDiagnosticsSource).not.toMatch(/loaderDevOnlyGatePlan/);
  });

  it("17. WebAssembly.instantiate/compile are never invoked, even exercising the full Dev-only Gate Plan chain", () => {
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
  });

  it("18. no import()/WebAssembly/generated-JS-glue/Rust reference, and no filesystem access, anywhere in the Loader source", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    expect(codeOnly).not.toMatch(/\bfetch\s*\(/);
    expect(codeOnly).not.toMatch(/import\s*\(/);
    expect(codeOnly).not.toMatch(/require\s*\(/);
    // Stage 889's Import Plan legitimately names a future
    // "WebAssemblyPlanning" gate without implementing it, so this
    // checks for real API usage (a dot after the identifier), not the
    // bare word.
    expect(codeOnly).not.toMatch(/WebAssembly\./);
    expect(codeOnly).not.toMatch(/initSync/);
    expect(codeOnly).not.toMatch(/__wbg_init/);
    // Stage 921 (Prototype EXECUTION Phase 001, a later stage than
    // this one) legitimately names the two Generated Artifact
    // filenames ("fedos_core_rust.js"/"fedos_core_rust_bg.wasm") to
    // check their existence -- this checks for actual Rust
    // crate/module USAGE, not that naming.
    expect(codeOnly).not.toMatch(/fedos_core_rust(?!\.js"|_bg\.wasm")/);
    expect(codeOnly).not.toMatch(/#\[wasm_bindgen\]/);
    expect(codeOnly).not.toMatch(/create_runtime|AppRuntime/);
    expect(codeOnly).not.toMatch(/worker\.ts|src\/worker/);
    // Stage 921 (Prototype EXECUTION Phase 001, a later stage than
    // this one) legitimately adds a read-only existsSync() existence
    // check -- this checks for CONTENT-reading filesystem access
    // (never permitted), not the narrowly-scoped existence check.
    expect(codeOnly).not.toMatch(/readFileSync|statSync|readFile\(|readdirSync/);
    // Still only imports the pre-existing Loader Plan -- no new static import added.
    expect(codeOnly).not.toMatch(/fedos_wasm_loader_contract|fedos_wasm_artifact|fedos_wasm_boundary/);
    expect(codeOnly).not.toMatch(/fedos_generated_artifact_presence/);
    expect(codeOnly).not.toMatch(/fedos_dynamic_loader/);

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

  it("19. no cycle exists: policy() never calls planLoad(), and #createDevOnlyGatePlan() calls nothing", () => {
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

  it("20. Rust public API is unchanged (27 pub fn, none #[wasm_bindgen]-annotated) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(27);
    expect(libRsSource).not.toMatch(/#\[wasm_bindgen\]/);

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
    expect(depLines.length).toBe(10);

    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("21. pre-existing loader fields (policy/Load Plan/JS Glue Access Plan/Generated Artifact Check Plan) remain unaffected by this stage", () => {
    expect(loaderPolicyAllowed()).toBe(false);
    expect(loaderLoadPlanShouldLoad()).toBe(false);
    expect(loaderJsGlueAccessPlanShouldAccess()).toBe(false);
    expect(loaderGeneratedArtifactCheckPlanShouldCheck()).toBe(false);
  });

  it("22. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
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
