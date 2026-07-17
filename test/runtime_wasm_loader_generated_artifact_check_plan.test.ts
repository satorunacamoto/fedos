import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  FedosWasmLoaderSkeleton,
  createFedosWasmLoader,
  loaderGeneratedArtifactCheckPlanBackend,
  loaderGeneratedArtifactCheckPlanCreated,
  loaderGeneratedArtifactCheckPlanCurrentStage,
  loaderGeneratedArtifactCheckPlanNextRequiredCheck,
  loaderGeneratedArtifactCheckPlanReason,
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
 * Stage 873 (Prototype Phase 016) — "FedosWasmLoader.planLoad() builds
 * an internal Generated Artifact Check Plan object
 * (#createGeneratedArtifactCheckPlan()) one step past the JS Glue
 * Access Plan, and confirms it -- still always BlockedByPolicy, still
 * STOP. Names WHAT would need to be confirmed (generated artifact
 * presence), WHY it is not confirmed yet (reason:
 * "BlockedByJsGlueAccessPlan"), and WHAT comes next
 * (nextRequiredCheck: "DevOnlyGate") -- without performing any of it.
 * Filesystem access / import() / WebAssembly / Rust remain Phase
 * 017+'s responsibility."
 */
describe("FedosWasmLoader.planLoad() builds and confirms an internal Generated Artifact Check Plan, still BlockedByPolicy, no cycle, filesystem/import()/WebAssembly/Rust not yet implemented (Stage 873)", () => {
  it("1. a Generated Artifact Check Plan is generated every time planLoad() runs (loaderGeneratedArtifactCheckPlanCreated is fixed true)", () => {
    expect(loaderGeneratedArtifactCheckPlanCreated()).toBe(true);
  });

  it("2. the Generated Artifact Check Plan is shouldCheck: false", () => {
    expect(loaderGeneratedArtifactCheckPlanShouldCheck()).toBe(false);
  });

  it('3. the Generated Artifact Check Plan names backend: "Wasm"', () => {
    expect(loaderGeneratedArtifactCheckPlanBackend()).toBe("Wasm");
  });

  it('4. currentStage names Generated Artifact Check planning', () => {
    const stage = loaderGeneratedArtifactCheckPlanCurrentStage();
    expect(stage).toBe("GeneratedArtifactCheckPlanning");
    expect(stage).toMatch(/GeneratedArtifactCheck/);
  });

  it('5. nextRequiredCheck points to the Dev-only Gate (or equivalent next stage)', () => {
    expect(loaderGeneratedArtifactCheckPlanNextRequiredCheck()).toBe("DevOnlyGate");
  });

  it("6. the Generated Artifact Check Plan's reason represents a Fail Closed reason", () => {
    const reason = loaderGeneratedArtifactCheckPlanReason();
    expect(["BlockedByJsGlueAccessPlan", "PrototypeDisabled", "FilesystemAccessUnavailable"]).toContain(reason);
    // The ONE value this Prototype stage's fixed constant ever produces.
    expect(reason).toBe("BlockedByJsGlueAccessPlan");
  });

  it("7. planLoad()'s own return value is byte-for-byte unchanged, key order included", () => {
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad();
    expect(decision).toEqual({
      operation: "load",
      state: "BlockedByPolicy",
      policy: "FailClosed",
      reason: expect.any(String),
    });
    expect(Object.keys(decision)).toEqual(["operation", "state", "policy", "reason"]);
  });

  it("8. the Generated Artifact Check Plan's own fields never leak into planLoad()'s return value", () => {
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad() as unknown as Record<string, unknown>;
    expect(decision).not.toHaveProperty("shouldCheck");
    expect(decision).not.toHaveProperty("backend");
    expect(decision).not.toHaveProperty("currentStage");
    expect(decision).not.toHaveProperty("nextRequiredCheck");
    expect(decision.reason).not.toBe("BlockedByJsGlueAccessPlan"); // Plan's OWN reason, not planLoad()'s
    expect(decision.state).toBe("BlockedByPolicy"); // planLoad()'s OWN decision label
  });

  it("9. planLoad() internally reaches the Generated Artifact Check Plan step, nested inside the JS Glue Access Plan's own shouldAccess:false branch", () => {
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

    expect(loadPlanIdx).toBeGreaterThan(-1);
    expect(shouldLoadIdx).toBeGreaterThan(loadPlanIdx);
    expect(jsGlueIdx).toBeGreaterThan(shouldLoadIdx);
    expect(shouldAccessIdx).toBeGreaterThan(jsGlueIdx);
    expect(artifactCheckIdx).toBeGreaterThan(shouldAccessIdx);
    expect(shouldCheckIdx).toBeGreaterThan(artifactCheckIdx);
  });

  it("10. policy() is still called exactly once per planLoad() call, even with the new Generated Artifact Check Plan step", () => {
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

  it("11. planningState() and status() are not interfered with by the Generated Artifact Check Plan", () => {
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

  it("12. Runtime's initializeCrypto() return value is unaffected", () => {
    const runtime = createRuntime();
    expect(runtime.initializeCrypto()).toEqual({
      allowed: false,
      initialized: false,
      reason: "PrototypeDisabled",
    });
  });

  it("13. Facade/Backend Abstraction/Backend Interface/Backend Resolver/WASM Backend return values are unaffected", () => {
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

  it("14. Worker remains fully unconnected to the Generated Artifact Check Plan/policy()/planLoad()", () => {
    expect(workerSource).not.toMatch(/fedos_wasm_loader/);
    expect(workerSource).not.toMatch(/GeneratedArtifactCheckPlan/);
    expect(workerSource).not.toMatch(/\bpolicy\s*\(/);
    expect(workerSource).not.toMatch(/planLoad/);
    expect(workerSource).not.toMatch(/initializeCrypto/);
    expect(workerDiagnosticsSource).not.toMatch(/GeneratedArtifactCheckPlan/);
  });

  it("15. Production Runtime (create_runtime.ts) remains fully unconnected, and diagnostics gain no new field this stage", () => {
    expect(createRuntimeSource).not.toMatch(/fedos_wasm_loader/);
    expect(createRuntimeSource).not.toMatch(/GeneratedArtifactCheckPlan/);
    expect(runtimeDiagnosticsSource).not.toMatch(/GeneratedArtifactCheckPlan/);
    // This stage deliberately does NOT touch diagnostics ("necessary minimum" scope).
    expect(runtimeDiagnosticsSource).not.toMatch(/loaderGeneratedArtifactCheckPlan/);
    expect(workerDiagnosticsSource).not.toMatch(/loaderGeneratedArtifactCheckPlan/);
  });

  it("16. WebAssembly.instantiate/compile are never invoked, even exercising the full Generated Artifact Check Plan chain", () => {
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

  it("17. no import()/WebAssembly/generated-JS-glue/Rust reference, and no filesystem access, anywhere in the Loader source", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    expect(codeOnly).not.toMatch(/\bfetch\s*\(/);
    // Stage 945 (Prototype EXECUTION Phase 004, a later stage than
    // this one) legitimately calls real, gated import() exactly once
    // inside attemptDevOnlyJsGlueImport() -- this checks for import()
    // ANYWHERE ELSE in the source, not that one narrowly-scoped call.
    expect(codeOnly).not.toMatch(/import\s*\((?!\/\* @vite-ignore \*\/)/);
    expect(codeOnly).not.toMatch(/require\s*\(/);
    // Stage 889's Import Plan legitimately names a future
    // "WebAssemblyPlanning" gate without implementing it, so this
    // checks for real API usage (a dot after the identifier), not the
    // bare word.
    expect(codeOnly).not.toMatch(/WebAssembly\./);
    // Stage 969 (Prototype EXECUTION Phase 007, a later stage than
    // this one) legitimately references .initSync as a PROPERTY
    // NAME to check for its presence on the retained JS glue module
    // -- this checks for a real, direct initSync(...) CALL, not the
    // property-name check.
    expect(codeOnly).not.toMatch(/\binitSync\s*\(/);
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
    // No real generated-artifact-existence check performed this stage
    // (Phase 016) -- Stage 921 (Prototype EXECUTION Phase 001, a later
    // stage) legitimately adds a read-only existsSync() existence
    // check, so this only forbids CONTENT-reading filesystem access.
    // Stage 969 (Prototype EXECUTION Phase 007, a later stage than
    // this one) legitimately reads the SAME fedos_core_rust_bg.wasm
    // bytes Stage 921 already names, via readFileSync -- this checks
    // for any OTHER content-reading filesystem API, not that one
    // narrowly-scoped read.
    expect(codeOnly).not.toMatch(/statSync|readFile\(|readdirSync/);
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

  it("18. no cycle exists: policy() never calls planLoad(), and #createGeneratedArtifactCheckPlan() calls nothing", () => {
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

  it("19. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(46);
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

  it("20. pre-existing loader fields (policy/Load Plan/JS Glue Access Plan) remain unaffected by this stage", () => {
    expect(loaderPolicyAllowed()).toBe(false);
    expect(loaderLoadPlanShouldLoad()).toBe(false);
    expect(loaderJsGlueAccessPlanShouldAccess()).toBe(false);
  });

  it("21. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
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
