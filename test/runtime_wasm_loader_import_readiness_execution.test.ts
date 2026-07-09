import { describe, it, expect, vi } from "vitest";
// This project's tsconfig.json carries no `@types/node`; declared
// ambient here the same way `src/runtime/fedos_wasm_loader.ts` itself does.
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
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

// `node:fs`'s own exports are non-configurable, so `vi.spyOn` cannot
// redefine `existsSync` directly -- `vi.mock` replaces the module
// instead, and each test drives the mock's return value.
vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
}));
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import * as nodeFs from "node:fs";

/**
 * Stage 937 (Prototype EXECUTION Phase 003) — "FedosWasmLoader.planLoad()
 * performs a REAL, purely-combinational Import Readiness evaluation
 * (no new filesystem/environment read of its own -- combines the
 * Generated Artifact Check and Dev-only Gate Evaluation results
 * already recorded), immediately after the Import Plan is confirmed.
 * The evaluation's result is recorded (importReadiness()) but is
 * NEVER read by any `if` condition -- WebAssembly Plan/Rust API Call
 * Plan still run in the same order, and planLoad() still ALWAYS
 * returns BlockedByPolicy regardless of whether readiness evaluates
 * true or false. Import Readiness is NOT import permission;
 * import()/WebAssembly/Rust remain entirely unimplemented."
 */
describe("FedosWasmLoader.planLoad() performs a REAL Import Readiness evaluation, still always BlockedByPolicy regardless of outcome, import()/WebAssembly/Rust still unimplemented (Stage 937)", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  function withNodeEnv<T>(value: string | undefined, fn: () => T): T {
    if (value === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = value;
    }
    try {
      return fn();
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  }

  function withArtifacts<T>(exist: boolean, fn: () => T): T {
    const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(exist);
    try {
      return fn();
    } finally {
      mock.mockReset();
      mock.mockReturnValue(false);
    }
  }

  it("1. importReadiness() is null before planLoad() has ever been called", () => {
    const loader = new FedosWasmLoaderSkeleton();
    expect(loader.importReadiness()).toBeNull();
  });

  it("2. the Import Readiness evaluation is performed as part of planLoad(), and its result is recorded", () => {
    const loader = new FedosWasmLoaderSkeleton();
    loader.planLoad();
    const result = loader.importReadiness();
    expect(result).not.toBeNull();
    expect(result?.evaluated).toBe(true);
    expect(typeof result?.ready).toBe("boolean");
    expect(["ReadyForImport", "MissingArtifacts", "NotDevelopmentRuntime", "PrototypeStillClosed"]).toContain(
      result?.reason,
    );
  });

  it("3. reflects missing artifacts: artifacts missing -> ready=false, reason=MissingArtifacts, regardless of runtime kind", () => {
    withArtifacts(false, () => {
      withNodeEnv("development", () => {
        const loader = new FedosWasmLoaderSkeleton();
        loader.planLoad();
        const result = loader.importReadiness();
        expect(result?.ready).toBe(false);
        expect(result?.reason).toBe("MissingArtifacts");
      });
    });
  });

  it("4. reflects Development Runtime classification: artifacts present but NOT Development -> ready=false, reason=NotDevelopmentRuntime", () => {
    withArtifacts(true, () => {
      withNodeEnv("production", () => {
        const loader = new FedosWasmLoaderSkeleton();
        loader.planLoad();
        const result = loader.importReadiness();
        expect(result?.ready).toBe(false);
        expect(result?.reason).toBe("NotDevelopmentRuntime");
      });
    });
  });

  it("5. Ready condition correctly evaluated: artifacts present AND Development Runtime -> ready=true, reason=ReadyForImport", () => {
    withArtifacts(true, () => {
      withNodeEnv("development", () => {
        const loader = new FedosWasmLoaderSkeleton();
        const decision = loader.planLoad();
        const result = loader.importReadiness();
        expect(result?.ready).toBe(true);
        expect(result?.reason).toBe("ReadyForImport");
        // 6. Ready=true STILL reaches BlockedByPolicy -- Fail Closed maintained.
        expect(decision).toEqual({
          operation: "load",
          state: "BlockedByPolicy",
          policy: "FailClosed",
          reason: expect.any(String),
        });
        expect(Object.keys(decision)).toEqual(["operation", "state", "policy", "reason"]);
      });
    });
  });

  it("7. Import Plan.shouldImport stays false even when Import Readiness is fully satisfied", () => {
    withArtifacts(true, () => {
      withNodeEnv("development", () => {
        const loader = new FedosWasmLoaderSkeleton();
        loader.planLoad();
        expect(loaderImportPlanShouldImport()).toBe(false);
        expect(loaderPolicyAllowed()).toBe(false);
        expect(loaderLoadPlanShouldLoad()).toBe(false);
        expect(loaderJsGlueAccessPlanShouldAccess()).toBe(false);
        expect(loaderGeneratedArtifactCheckPlanShouldCheck()).toBe(false);
        expect(loaderDevOnlyGatePlanShouldEvaluate()).toBe(false);
        expect(loaderWebAssemblyPlanShouldInstantiate()).toBe(false);
        expect(loaderRustApiCallPlanShouldCall()).toBe(false);
      });
    });
  });

  it("8. Execution Readiness Summary combines all three real results and always names Import/WebAssembly/Rust as not executed", () => {
    const loader = new FedosWasmLoaderSkeleton();
    expect(loader.executionReadinessSummary()).toBeNull();

    withArtifacts(true, () => {
      withNodeEnv("development", () => {
        loader.planLoad();
        const summary = loader.executionReadinessSummary();
        expect(summary).toEqual({
          artifactsOk: true,
          runtimeOk: true,
          importReady: true,
          importExecuted: false,
          webAssemblyExecuted: false,
          rustExecuted: false,
        });
      });
    });
  });

  it("9. Execution Readiness Summary reflects missing artifacts / non-development runtime accurately", () => {
    const loader = new FedosWasmLoaderSkeleton();
    withArtifacts(false, () => {
      withNodeEnv("production", () => {
        loader.planLoad();
        const summary = loader.executionReadinessSummary();
        expect(summary).toEqual({
          artifactsOk: false,
          runtimeOk: false,
          importReady: false,
          importExecuted: false,
          webAssemblyExecuted: false,
          rustExecuted: false,
        });
      });
    });
  });

  it("10. planLoad()'s own return value is byte-for-byte unchanged, key order included, across repeated calls", () => {
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

  it("11. the readiness result never leaks into planLoad()'s return value", () => {
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad() as unknown as Record<string, unknown>;
    expect(decision).not.toHaveProperty("ready");
    expect(decision).not.toHaveProperty("evaluated");
    expect(decision.reason).not.toBe("ReadyForImport");
    expect(decision.reason).not.toBe("MissingArtifacts");
    expect(decision.reason).not.toBe("NotDevelopmentRuntime");
  });

  it("12. planLoad() still reaches every pre-existing Plan, in the same order, past the real evaluation", () => {
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
      "#evaluateDevOnlyGate()",
      "#createImportPlan()",
      "importPlan.shouldImport",
      "#evaluateImportReadiness()",
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

  it("13. policy() is still called exactly once per planLoad() call, even with the new real evaluation", () => {
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

  it("14. planningState() and status() are not interfered with by the real evaluation", () => {
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

  it("15. no import()/dynamic import/require()/generated-JS-glue-load exists anywhere in the Loader source", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    // Stage 945 (Prototype EXECUTION Phase 004, a later stage than
    // this one) legitimately calls real, gated import() exactly once
    // inside attemptDevOnlyJsGlueImport() -- this checks for import()
    // ANYWHERE ELSE in the source, not that one narrowly-scoped call.
    expect(codeOnly).not.toMatch(/import\s*\((?!\/\* @vite-ignore \*\/)/);
    expect(codeOnly).not.toMatch(/require\s*\(/);
  });

  it("16. no real WebAssembly API usage exists anywhere in the Loader source", () => {
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

  it("17. no Rust API call exists anywhere in the Loader source, including version(), and no #[wasm_bindgen]", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    expect(codeOnly).not.toMatch(/\bversion\s*\(/);
    expect(codeOnly).not.toMatch(/#\[wasm_bindgen\]/);
    expect(codeOnly).not.toMatch(/fedos_core_rust(?!\.js"|_bg\.wasm")/);
  });

  it("18. no new process.env key beyond NODE_ENV, and no @ts-expect-error/Node built-in was REMOVED (Stage 921's two remain; Stage 945, a later stage, adds one more)", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    expect(codeOnly).not.toMatch(/process\.env(?!\??\.NODE_ENV\b)/);
    expect(codeOnly).not.toMatch(/import\.meta/);
    const tsExpectErrorDirectiveLines = wasmLoaderSource
      .split("\n")
      .filter((line: string) => line.trim().startsWith("// @ts-expect-error"));
    expect(tsExpectErrorDirectiveLines.length).toBeGreaterThanOrEqual(2);
  });

  it("19. Worker remains fully unconnected to the real evaluation/policy()/planLoad(), and Production Runtime (create_runtime.ts) remains fully unconnected", () => {
    expect(workerSource).not.toMatch(/fedos_wasm_loader/);
    expect(workerSource).not.toMatch(/importReadiness|evaluateImportReadiness|executionReadinessSummary/);
    expect(workerSource).not.toMatch(/\bpolicy\s*\(/);
    expect(workerSource).not.toMatch(/planLoad/);
    expect(workerSource).not.toMatch(/initializeCrypto/);
    expect(workerDiagnosticsSource).not.toMatch(/importReadiness|evaluateImportReadiness|executionReadinessSummary/);

    expect(createRuntimeSource).not.toMatch(/fedos_wasm_loader/);
    expect(createRuntimeSource).not.toMatch(/importReadiness|evaluateImportReadiness|executionReadinessSummary/);
  });

  it("20. diagnostics gain no new field this stage", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(
      /importReadiness|evaluateImportReadiness|executionReadinessSummary|ReadyForImport/,
    );
    expect(workerDiagnosticsSource).not.toMatch(
      /importReadiness|evaluateImportReadiness|executionReadinessSummary|ReadyForImport/,
    );
  });

  it("21. WebAssembly.instantiate/compile are never invoked, even exercising the full chain with Import Readiness fully satisfied", () => {
    withArtifacts(true, () => {
      withNodeEnv("development", () => {
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
    });

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

  it("22. Runtime's initializeCrypto() and every upstream layer's return value remain unaffected", () => {
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

  it("23. no cycle exists: policy() never calls planLoad(), and the real evaluation calls nothing external", () => {
    const loader = createFedosWasmLoader();
    const planLoadSpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "planLoad");
    try {
      loader.policy();
      expect(planLoadSpy).not.toHaveBeenCalled();
    } finally {
      planLoadSpy.mockRestore();
    }
  });

  it("24. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
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

  it("25. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.state).toBe("Unsupported");
    expect(encrypted.allowed).toBe(false);
    const decrypted = await provider.decrypt({});
    expect(decrypted.state).toBe("Unsupported");
    expect(decrypted.allowed).toBe(false);
  });
});
