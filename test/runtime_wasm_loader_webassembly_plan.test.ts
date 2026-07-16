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
  loaderWebAssemblyPlanBackend,
  loaderWebAssemblyPlanCreated,
  loaderWebAssemblyPlanCurrentStage,
  loaderWebAssemblyPlanNextRequiredCheck,
  loaderWebAssemblyPlanReason,
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
 * Stage 897 (Prototype Phase 019) — "FedosWasmLoader.planLoad() builds
 * an internal WebAssembly Plan object (#createWebAssemblyPlan()) one
 * step past the Import Plan, and confirms it -- still always
 * BlockedByPolicy, still STOP. Names the future intent to create and
 * use a real WebAssembly instance (shouldInstantiate: false), why
 * WebAssembly cannot be reached yet (reason: "BlockedByImportPlan"),
 * and what comes next (nextRequiredCheck: "RustApiCallPlanning") --
 * without ever calling WebAssembly.instantiate/compile, constructing
 * new WebAssembly.Module/Instance, calling initSync, or calling Rust.
 * Real WebAssembly instantiation and Rust remain Phase 020+'s
 * responsibility. The "WebAssemblyPlanning" naming literal itself is
 * explicitly permitted -- guard checks target real API usage
 * (WebAssembly., new WebAssembly.Module/Instance), not the bare word."
 */
describe("FedosWasmLoader.planLoad() builds and confirms an internal WebAssembly Plan, still BlockedByPolicy, no cycle, WebAssembly API/Rust not yet implemented (Stage 897)", () => {
  it("1. a WebAssembly Plan is generated every time planLoad() runs (loaderWebAssemblyPlanCreated is fixed true)", () => {
    expect(loaderWebAssemblyPlanCreated()).toBe(true);
  });

  it("2. the WebAssembly Plan is shouldInstantiate: false", () => {
    expect(loaderWebAssemblyPlanShouldInstantiate()).toBe(false);
  });

  it('3. the WebAssembly Plan names backend: "Wasm"', () => {
    expect(loaderWebAssemblyPlanBackend()).toBe("Wasm");
  });

  it('4. currentStage is "WebAssemblyPlanning"', () => {
    expect(loaderWebAssemblyPlanCurrentStage()).toBe("WebAssemblyPlanning");
  });

  it('5. nextRequiredCheck is "RustApiCallPlanning"', () => {
    expect(loaderWebAssemblyPlanNextRequiredCheck()).toBe("RustApiCallPlanning");
  });

  it("6. the WebAssembly Plan's reason represents a Fail Closed reason", () => {
    const reason = loaderWebAssemblyPlanReason();
    expect(["BlockedByImportPlan", "PrototypeDisabled", "WebAssemblyUnavailable"]).toContain(reason);
    // The ONE value this Prototype stage's fixed constant ever produces.
    expect(reason).toBe("BlockedByImportPlan");
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

  it("8. the WebAssembly Plan's own fields never leak into planLoad()'s return value", () => {
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad() as unknown as Record<string, unknown>;
    expect(decision).not.toHaveProperty("shouldInstantiate");
    expect(decision).not.toHaveProperty("backend");
    expect(decision).not.toHaveProperty("currentStage");
    expect(decision).not.toHaveProperty("nextRequiredCheck");
    expect(decision.reason).not.toBe("BlockedByImportPlan"); // Plan's OWN reason
    expect(decision.state).toBe("BlockedByPolicy"); // planLoad()'s OWN decision label
  });

  it("9. planLoad() internally reaches the WebAssembly Plan step, nested inside the Import Plan's own shouldImport:false branch", () => {
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

    expect(loadPlanIdx).toBeGreaterThan(-1);
    expect(shouldLoadIdx).toBeGreaterThan(loadPlanIdx);
    expect(jsGlueIdx).toBeGreaterThan(shouldLoadIdx);
    expect(shouldAccessIdx).toBeGreaterThan(jsGlueIdx);
    expect(artifactCheckIdx).toBeGreaterThan(shouldAccessIdx);
    expect(shouldCheckIdx).toBeGreaterThan(artifactCheckIdx);
    expect(devGateIdx).toBeGreaterThan(shouldCheckIdx);
    expect(shouldEvaluateIdx).toBeGreaterThan(devGateIdx);
    expect(importPlanIdx).toBeGreaterThan(shouldEvaluateIdx);
    expect(shouldImportIdx).toBeGreaterThan(importPlanIdx);
    expect(webAssemblyPlanIdx).toBeGreaterThan(shouldImportIdx);
    expect(shouldInstantiateIdx).toBeGreaterThan(webAssemblyPlanIdx);
  });

  it("10. policy() is still called exactly once per planLoad() call, even with the new WebAssembly Plan step", () => {
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

  it("11. planningState() and status() are not interfered with by the WebAssembly Plan", () => {
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

  it("12. no real WebAssembly API usage exists anywhere in the Loader source -- the bare naming literal is permitted, real API calls are not", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    // The "WebAssemblyPlanning" naming literal legitimately contains
    // the substring "WebAssembly" -- these checks target real API
    // usage (a dot, or a `new` constructor call), not the bare word.
    expect(codeOnly).toMatch(/WebAssemblyPlanning/); // the permitted naming literal IS present
    expect(codeOnly).not.toMatch(/WebAssembly\./);
    expect(codeOnly).not.toMatch(/WebAssembly\.instantiate/);
    expect(codeOnly).not.toMatch(/WebAssembly\.compile/);
    expect(codeOnly).not.toMatch(/new\s+WebAssembly\.Module/);
    expect(codeOnly).not.toMatch(/new\s+WebAssembly\.Instance/);
    expect(codeOnly).not.toMatch(/\bnew\s+WebAssembly\b/);
    // Stage 969 (Prototype EXECUTION Phase 007, a later stage than
    // this one) legitimately references .initSync as a PROPERTY
    // NAME to check for its presence on the retained JS glue module
    // -- this checks for a real, direct initSync(...) CALL, not the
    // property-name check.
    expect(codeOnly).not.toMatch(/\binitSync\s*\(/);
    expect(codeOnly).not.toMatch(/__wbg_init/);
  });

  it("13. no import()/dynamic import/generated-JS-glue-load implementation exists anywhere in the Loader source", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    // Stage 945 (Prototype EXECUTION Phase 004, a later stage than
    // this one) legitimately calls real, gated import() exactly once
    // inside attemptDevOnlyJsGlueImport() -- this checks for import()
    // ANYWHERE ELSE in the source, not that one narrowly-scoped call.
    expect(codeOnly).not.toMatch(/import\s*\((?!\/\* @vite-ignore \*\/)/);
    expect(codeOnly).not.toMatch(/require\s*\(/);
    // Stage 921 (Prototype EXECUTION Phase 001, a later stage than
    // this one) legitimately names the two Generated Artifact
    // filenames ("fedos_core_rust.js"/"fedos_core_rust_bg.wasm") to
    // check their existence -- this checks for actual Rust
    // crate/module USAGE, not that naming.
    expect(codeOnly).not.toMatch(/fedos_core_rust(?!\.js"|_bg\.wasm")/);
    // Still only imports the pre-existing Loader Plan -- no new static import added.
    expect(codeOnly).not.toMatch(/fedos_wasm_loader_contract|fedos_wasm_artifact|fedos_wasm_boundary/);
  });

  it("14. no CONTENT-reading filesystem access implementation exists anywhere in the Loader source", () => {
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

  it("15. no Rust connection exists anywhere in the Loader source", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    // Stage 921 (Prototype EXECUTION Phase 001, a later stage than
    // this one) legitimately names the two Generated Artifact
    // filenames ("fedos_core_rust.js"/"fedos_core_rust_bg.wasm") to
    // check their existence -- this checks for actual Rust
    // crate/module USAGE, not that naming.
    expect(codeOnly).not.toMatch(/fedos_core_rust(?!\.js"|_bg\.wasm")/);
    expect(codeOnly).not.toMatch(/#\[wasm_bindgen\]/);
  });

  it("16. no Development/Production judgement implementation exists: no process.env, import.meta, or NODE_ENV reference anywhere in the Loader source", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    // Stage 929 (Prototype EXECUTION Phase 002, a later stage than
    // this one) legitimately reads process.env.NODE_ENV (and ONLY
    // that one key) to evaluate the Dev-only Gate -- this checks for
    // any OTHER process.env usage and for import.meta (still fully
    // forbidden), not the narrowly-scoped NODE_ENV read.
    expect(codeOnly).not.toMatch(/process\.env(?!\??\.NODE_ENV\b)/);
    expect(codeOnly).not.toMatch(/import\.meta/);
    expect(codeOnly).not.toMatch(/isDevelopment|isProduction|is_development|is_production/i);
  });

  it("17. Worker remains fully unconnected to the WebAssembly Plan/policy()/planLoad(), and Production Runtime (create_runtime.ts) remains fully unconnected", () => {
    expect(workerSource).not.toMatch(/fedos_wasm_loader/);
    expect(workerSource).not.toMatch(/FedosWasmLoaderWebAssemblyPlan|loaderWebAssemblyPlan/);
    expect(workerSource).not.toMatch(/\bpolicy\s*\(/);
    expect(workerSource).not.toMatch(/planLoad/);
    expect(workerSource).not.toMatch(/initializeCrypto/);
    expect(workerDiagnosticsSource).not.toMatch(/FedosWasmLoaderWebAssemblyPlan|loaderWebAssemblyPlan/);

    expect(createRuntimeSource).not.toMatch(/fedos_wasm_loader/);
    expect(createRuntimeSource).not.toMatch(/FedosWasmLoaderWebAssemblyPlan|loaderWebAssemblyPlan/);
  });

  it("18. diagnostics gain no new field this stage", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(/FedosWasmLoaderWebAssemblyPlan/);
    expect(workerDiagnosticsSource).not.toMatch(/FedosWasmLoaderWebAssemblyPlan/);
    // This stage deliberately does NOT touch diagnostics ("necessary minimum" scope).
    expect(runtimeDiagnosticsSource).not.toMatch(/loaderWebAssemblyPlan/);
    expect(workerDiagnosticsSource).not.toMatch(/loaderWebAssemblyPlan/);
  });

  it("19. WebAssembly.instantiate/compile are never invoked, even exercising the full WebAssembly Plan chain", () => {
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

  it("20. Runtime's initializeCrypto() and every upstream layer's return value remain unaffected", () => {
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

  it("21. no cycle exists: policy() never calls planLoad(), and #createWebAssemblyPlan() calls nothing", () => {
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

  it("22. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(45);
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

  it("23. pre-existing loader fields (policy/Load Plan/JS Glue Access Plan/Generated Artifact Check Plan/Dev-only Gate Plan/Import Plan) remain unaffected by this stage", () => {
    expect(loaderPolicyAllowed()).toBe(false);
    expect(loaderLoadPlanShouldLoad()).toBe(false);
    expect(loaderJsGlueAccessPlanShouldAccess()).toBe(false);
    expect(loaderGeneratedArtifactCheckPlanShouldCheck()).toBe(false);
    expect(loaderDevOnlyGatePlanShouldEvaluate()).toBe(false);
    expect(loaderImportPlanShouldImport()).toBe(false);
  });

  it("24. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
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
