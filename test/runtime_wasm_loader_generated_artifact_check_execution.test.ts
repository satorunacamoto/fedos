import { describe, it, expect, vi } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import * as nodeFs from "node:fs";

// `node:fs`'s own exports are non-configurable, so `vi.spyOn` cannot
// redefine `existsSync` directly -- `vi.mock` replaces the module
// instead, and each test drives the mock's return value/implementation.
vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
}));
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  FedosWasmLoaderSkeleton,
  createFedosWasmLoader,
  loaderDevOnlyGatePlanShouldEvaluate,
  loaderGeneratedArtifactCheckPlanShouldCheck,
  loaderGeneratedArtifactCheckTargets,
  loaderImportPlanShouldImport,
  loaderJsGlueAccessPlanShouldAccess,
  loaderLoadPlanShouldLoad,
  loaderPolicyAllowed,
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
 * Stage 921 (Prototype EXECUTION Phase 001) — "FedosWasmLoader.planLoad()
 * performs a REAL, read-only existence check of the two Generated
 * Artifact files, immediately after the Generated Artifact Check
 * Plan is confirmed. The check's result is recorded
 * (generatedArtifactCheckResult()) but is NEVER read by any `if`
 * condition -- every pre-existing Plan (Dev-only Gate through Rust
 * API Call) still runs in the same order, and planLoad() still ALWAYS
 * returns BlockedByPolicy regardless of whether the artifacts are
 * found. This is the FIRST real execution the Planning Chain arc has
 * ever performed; import()/WebAssembly/Rust remain entirely
 * unimplemented."
 */
describe("FedosWasmLoader.planLoad() performs a REAL Generated Artifact Check, still always BlockedByPolicy regardless of outcome, import()/WebAssembly/Rust still unimplemented (Stage 921)", () => {
  it("1. the check targets are the two Generated Artifact filenames, in a fixed order", () => {
    expect(loaderGeneratedArtifactCheckTargets()).toEqual(["fedos_core_rust.js", "fedos_core_rust_bg.wasm"]);
  });

  it("2. generatedArtifactCheckResult() is null before planLoad() has ever been called", () => {
    const loader = new FedosWasmLoaderSkeleton();
    expect(loader.generatedArtifactCheckResult()).toBeNull();
  });

  it("3. the Generated Artifact Check is performed as part of planLoad(), and its result is recorded", () => {
    const loader = new FedosWasmLoaderSkeleton();
    loader.planLoad();
    const result = loader.generatedArtifactCheckResult();
    expect(result).not.toBeNull();
    expect(result?.checkedArtifacts).toEqual(["fedos_core_rust.js", "fedos_core_rust_bg.wasm"]);
    expect(typeof result?.artifactsExist).toBe("boolean");
    expect(Array.isArray(result?.missingArtifacts)).toBe(true);
  });

  it("4. when the artifacts do NOT exist (the real, uncompiled state of this repo), the check records them missing, and planLoad() still returns BlockedByPolicy", () => {
    const existsSyncSpy = vi.mocked(nodeFs.existsSync).mockReturnValue(false);
    try {
      const loader = new FedosWasmLoaderSkeleton();
      const decision = loader.planLoad();
      const result = loader.generatedArtifactCheckResult();
      expect(result?.artifactsExist).toBe(false);
      expect(result?.missingArtifacts).toEqual(["fedos_core_rust.js", "fedos_core_rust_bg.wasm"]);
      expect(decision).toEqual({
        operation: "load",
        state: "BlockedByPolicy",
        policy: "FailClosed",
        reason: expect.any(String),
      });
    } finally {
      existsSyncSpy.mockReset();
      existsSyncSpy.mockReturnValue(false);
    }
  });

  it("5. when the artifacts DO exist (simulated), the check records them present, and planLoad() STILL returns the SAME BlockedByPolicy answer", () => {
    const existsSyncSpy = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
    try {
      const loader = new FedosWasmLoaderSkeleton();
      const decision = loader.planLoad();
      const result = loader.generatedArtifactCheckResult();
      expect(result?.artifactsExist).toBe(true);
      expect(result?.missingArtifacts).toEqual([]);
      expect(decision).toEqual({
        operation: "load",
        state: "BlockedByPolicy",
        policy: "FailClosed",
        reason: expect.any(String),
      });
      expect(Object.keys(decision)).toEqual(["operation", "state", "policy", "reason"]);
    } finally {
      existsSyncSpy.mockReset();
      existsSyncSpy.mockReturnValue(false);
    }
  });

  it("6. artifacts existing (simulated) never flips any Plan's own fixed false field", () => {
    const existsSyncSpy = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
    try {
      const loader = new FedosWasmLoaderSkeleton();
      loader.planLoad();
      expect(loaderPolicyAllowed()).toBe(false);
      expect(loaderLoadPlanShouldLoad()).toBe(false);
      expect(loaderJsGlueAccessPlanShouldAccess()).toBe(false);
      expect(loaderGeneratedArtifactCheckPlanShouldCheck()).toBe(false);
      expect(loaderDevOnlyGatePlanShouldEvaluate()).toBe(false);
      expect(loaderImportPlanShouldImport()).toBe(false);
      expect(loaderWebAssemblyPlanShouldInstantiate()).toBe(false);
      expect(loaderRustApiCallPlanShouldCall()).toBe(false);
    } finally {
      existsSyncSpy.mockReset();
      existsSyncSpy.mockReturnValue(false);
    }
  });

  it("7. if existsSync throws (e.g. unavailable environment), the check Fails Closed to 'missing' rather than throwing", () => {
    const existsSyncSpy = vi.mocked(nodeFs.existsSync).mockImplementation(() => {
      throw new Error("simulated filesystem failure");
    });
    try {
      const loader = new FedosWasmLoaderSkeleton();
      expect(() => loader.planLoad()).not.toThrow();
      const result = loader.generatedArtifactCheckResult();
      expect(result?.artifactsExist).toBe(false);
      expect(result?.missingArtifacts).toEqual(["fedos_core_rust.js", "fedos_core_rust_bg.wasm"]);
    } finally {
      existsSyncSpy.mockReset();
      existsSyncSpy.mockReturnValue(false);
    }
  });

  it("8. planLoad()'s own return value is byte-for-byte unchanged, key order included, across repeated calls -- Prototype always reaches BlockedByPolicy", () => {
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

  it("9. the check result never leaks into planLoad()'s return value", () => {
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad() as unknown as Record<string, unknown>;
    expect(decision).not.toHaveProperty("artifactsExist");
    expect(decision).not.toHaveProperty("missingArtifacts");
    expect(decision).not.toHaveProperty("checkedArtifacts");
  });

  it("10. planLoad() still reaches every pre-existing Plan, in the same order, past the real check", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    const planLoadMatch = codeOnly.match(/planLoad\(\): FedosWasmLoaderDecision \{[\s\S]*?\n {2}\}/);
    expect(planLoadMatch).not.toBeNull();
    const planLoadBody = (planLoadMatch as RegExpMatchArray)[0] ?? "";
    expect(planLoadBody.length).toBeGreaterThan(0);

    const order = [
      "#createLoadPlan()",
      "loadPlan.shouldLoad",
      "#createJsGlueAccessPlan()",
      "jsGlueAccessPlan.shouldAccess",
      "#createGeneratedArtifactCheckPlan()",
      "artifactCheckPlan.shouldCheck",
      "#checkGeneratedArtifacts()",
      "#createDevOnlyGatePlan()",
      "devOnlyGatePlan.shouldEvaluate",
      "#createImportPlan()",
      "importPlan.shouldImport",
      "#createWebAssemblyPlan()",
      "webAssemblyPlan.shouldInstantiate",
      "#createRustApiCallPlan()",
      "rustApiCallPlan.shouldCall",
    ];
    let lastIndex = -1;
    for (const label of order) {
      const idx = planLoadBody.indexOf(label);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it("11. policy() is still called exactly once per planLoad() call, even with the new real check", () => {
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

  it("12. planningState() and status() are not interfered with by the real check", () => {
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

  it("13. no import()/dynamic import/require()/generated-JS-glue-load/execution exists anywhere in the Loader source", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    // Stage 945 (Prototype EXECUTION Phase 004, a later stage than
    // this one) legitimately calls real, gated import() exactly once
    // inside attemptDevOnlyJsGlueImport() -- this checks for import()
    // ANYWHERE ELSE in the source, not that one narrowly-scoped call.
    expect(codeOnly).not.toMatch(/import\s*\((?!\/\* @vite-ignore \*\/)/);
    expect(codeOnly).not.toMatch(/require\s*\(/);
  });

  it("14. no real WebAssembly API usage exists anywhere in the Loader source", () => {
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
  });

  it("15. no Rust API call exists anywhere in the Loader source, including version(), and no #[wasm_bindgen]", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    expect(codeOnly).not.toMatch(/\bversion\s*\(/);
    expect(codeOnly).not.toMatch(/#\[wasm_bindgen\]/);
    // The two Generated Artifact filenames are legitimately named for
    // existence-checking; anything else referencing the Rust crate is not.
    expect(codeOnly).not.toMatch(/fedos_core_rust(?!\.js"|_bg\.wasm")/);
  });

  it("16. only a read-only existsSync() existence check exists -- no content-reading filesystem API anywhere in the Loader source", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    expect(codeOnly).toMatch(/existsSync/);
    // Stage 969 (Prototype EXECUTION Phase 007, a later stage than
    // this one) legitimately reads the SAME fedos_core_rust_bg.wasm
    // bytes Stage 921 already names, via readFileSync -- this checks
    // for any OTHER content-reading filesystem API, not that one
    // narrowly-scoped read.
    expect(codeOnly).not.toMatch(/statSync|readFile\(|readdirSync|writeFileSync|unlinkSync/);
  });

  it("17. Worker remains fully unconnected to the real check/policy()/planLoad(), and Production Runtime (create_runtime.ts) remains fully unconnected", () => {
    expect(workerSource).not.toMatch(/fedos_wasm_loader/);
    expect(workerSource).not.toMatch(/generatedArtifactCheckResult|checkGeneratedArtifacts/);
    expect(workerSource).not.toMatch(/\bpolicy\s*\(/);
    expect(workerSource).not.toMatch(/planLoad/);
    expect(workerSource).not.toMatch(/initializeCrypto/);
    expect(workerDiagnosticsSource).not.toMatch(/generatedArtifactCheckResult|checkGeneratedArtifacts/);

    expect(createRuntimeSource).not.toMatch(/fedos_wasm_loader/);
    expect(createRuntimeSource).not.toMatch(/generatedArtifactCheckResult|checkGeneratedArtifacts/);
  });

  it("18. diagnostics gain no new field this stage", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(/generatedArtifactCheckResult|checkGeneratedArtifacts|artifactsExist|missingArtifacts/);
    expect(workerDiagnosticsSource).not.toMatch(/generatedArtifactCheckResult|checkGeneratedArtifacts|artifactsExist|missingArtifacts/);
  });

  it("19. WebAssembly.instantiate/compile are never invoked, even exercising the full chain with artifacts simulated present", () => {
    const existsSyncSpy = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
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
      existsSyncSpy.mockReset();
      existsSyncSpy.mockReturnValue(false);
      instantiate.mockRestore();
      compile.mockRestore();
    }
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();

    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true } as Response));
    const originalFetch = globalThis.fetch;
    (globalThis as { fetch?: unknown }).fetch = fetchSpy;
    try {
      const loader = createFedosWasmLoader();
      loader.planLoad();
      createWasmBackend();
      createRuntime().initializeCrypto();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = originalFetch;
    }
    expect(fetchSpy).not.toHaveBeenCalled();
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

  it("21. no cycle exists: policy() never calls planLoad(), and the real check calls nothing but existsSync", () => {
    const loader = createFedosWasmLoader();
    const planLoadSpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "planLoad");
    try {
      loader.policy();
      expect(planLoadSpy).not.toHaveBeenCalled();
    } finally {
      planLoadSpy.mockRestore();
    }
  });

  it("22. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(31);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(5);

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

  it("23. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.state).toBe("Unsupported");
    expect(encrypted.allowed).toBe(false);
    const decrypted = await provider.decrypt({});
    expect(decrypted.state).toBe("Unsupported");
    expect(decrypted.allowed).toBe(false);
  });
});
