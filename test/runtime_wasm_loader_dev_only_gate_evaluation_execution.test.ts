import { describe, it, expect, vi } from "vitest";
// This project's tsconfig.json carries no `@types/node`; declared
// ambient here the same way `src/runtime/fedos_wasm_loader.ts` itself does.
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  FedosWasmLoaderSkeleton,
  createFedosWasmLoader,
  loaderDevOnlyGateEvaluationEnvKey,
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

/**
 * Stage 929 (Prototype EXECUTION Phase 002) — "FedosWasmLoader.planLoad()
 * performs a REAL Development Runtime evaluation (reads
 * process.env.NODE_ENV, and ONLY that key), immediately after the
 * Dev-only Gate Plan is confirmed. The evaluation's result is recorded
 * (devOnlyGateEvaluation()) but is NEVER read by any `if` condition --
 * Import Plan/WebAssembly Plan/Rust API Call Plan still run in the
 * same order, and planLoad() still ALWAYS returns BlockedByPolicy
 * regardless of whether the runtime evaluates as Development,
 * Production, or Unknown. Evaluating Development Runtime is NOT import
 * permission; import()/WebAssembly/Rust remain entirely unimplemented."
 */
describe("FedosWasmLoader.planLoad() performs a REAL Dev-only Gate Evaluation, still always BlockedByPolicy regardless of outcome, import()/WebAssembly/Rust still unimplemented (Stage 929)", () => {
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

  it("1. the evaluated environment key is NODE_ENV, and only NODE_ENV", () => {
    expect(loaderDevOnlyGateEvaluationEnvKey()).toBe("NODE_ENV");
  });

  it("2. devOnlyGateEvaluation() is null before planLoad() has ever been called", () => {
    const loader = new FedosWasmLoaderSkeleton();
    expect(loader.devOnlyGateEvaluation()).toBeNull();
  });

  it("3. the Dev-only Gate Evaluation is performed as part of planLoad(), and its result is recorded", () => {
    const loader = new FedosWasmLoaderSkeleton();
    loader.planLoad();
    const result = loader.devOnlyGateEvaluation();
    expect(result).not.toBeNull();
    expect(result?.evaluated).toBe(true);
    expect(typeof result?.developmentAllowed).toBe("boolean");
    expect(["DevelopmentRuntime", "ProductionRuntime", "UnknownRuntime", "PrototypeStillClosed"]).toContain(
      result?.reason,
    );
  });

  it("4. when the runtime evaluates as Development (NODE_ENV=development), planLoad() STILL returns BlockedByPolicy", () => {
    withNodeEnv("development", () => {
      const loader = new FedosWasmLoaderSkeleton();
      const decision = loader.planLoad();
      const result = loader.devOnlyGateEvaluation();
      expect(result?.reason).toBe("DevelopmentRuntime");
      expect(result?.developmentAllowed).toBe(true);
      expect(decision).toEqual({
        operation: "load",
        state: "BlockedByPolicy",
        policy: "FailClosed",
        reason: expect.any(String),
      });
    });
  });

  it("5. when the runtime evaluates as Production (NODE_ENV=production), planLoad() STILL returns BlockedByPolicy", () => {
    withNodeEnv("production", () => {
      const loader = new FedosWasmLoaderSkeleton();
      const decision = loader.planLoad();
      const result = loader.devOnlyGateEvaluation();
      expect(result?.reason).toBe("ProductionRuntime");
      expect(result?.developmentAllowed).toBe(false);
      expect(decision).toEqual({
        operation: "load",
        state: "BlockedByPolicy",
        policy: "FailClosed",
        reason: expect.any(String),
      });
      expect(Object.keys(decision)).toEqual(["operation", "state", "policy", "reason"]);
    });
  });

  it("6. when the runtime is Unknown (NODE_ENV unset or unrecognized), planLoad() STILL returns BlockedByPolicy", () => {
    withNodeEnv(undefined, () => {
      const loader = new FedosWasmLoaderSkeleton();
      const decision = loader.planLoad();
      const result = loader.devOnlyGateEvaluation();
      expect(result?.reason).toBe("UnknownRuntime");
      expect(result?.developmentAllowed).toBe(false);
      expect(decision).toEqual({
        operation: "load",
        state: "BlockedByPolicy",
        policy: "FailClosed",
        reason: expect.any(String),
      });
    });

    withNodeEnv("staging", () => {
      const loader = new FedosWasmLoaderSkeleton();
      loader.planLoad();
      expect(loader.devOnlyGateEvaluation()?.reason).toBe("UnknownRuntime");
    });
  });

  it("7. Development Runtime evaluation never flips any Plan's own fixed false field -- Import/WebAssembly/Rust Plans stay closed", () => {
    withNodeEnv("development", () => {
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
    });
  });

  it("8. planLoad()'s own return value is byte-for-byte unchanged, key order included, across repeated calls", () => {
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

  it("9. the evaluation result never leaks into planLoad()'s return value", () => {
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad() as unknown as Record<string, unknown>;
    expect(decision).not.toHaveProperty("developmentAllowed");
    expect(decision).not.toHaveProperty("evaluated");
    expect(decision.reason).not.toBe("DevelopmentRuntime");
    expect(decision.reason).not.toBe("ProductionRuntime");
    expect(decision.reason).not.toBe("UnknownRuntime");
  });

  it("10. planLoad() still reaches every pre-existing Plan, in the same order, past the real evaluation", () => {
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

  it("11. policy() is still called exactly once per planLoad() call, even with the new real evaluation", () => {
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

  it("12. planningState() and status() are not interfered with by the real evaluation", () => {
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

  it("13. no import()/dynamic import/require()/generated-JS-glue-load exists anywhere in the Loader source", () => {
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
    expect(codeOnly).not.toMatch(/fedos_core_rust(?!\.js"|_bg\.wasm")/);
  });

  it("16. only process.env.NODE_ENV is read -- no other environment variable, and no import.meta", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    expect(codeOnly).toMatch(/process\.env/);
    expect(codeOnly).toMatch(/NODE_ENV/);
    expect(codeOnly).not.toMatch(/process\.env(?!\??\.NODE_ENV\b)/);
    expect(codeOnly).not.toMatch(/import\.meta/);
  });

  it("17. no new Node built-in or @ts-expect-error suppression was added by THIS stage (Stage 921's existing two; Stage 945, a later stage, adds one more)", () => {
    const tsExpectErrorDirectiveLines = wasmLoaderSource
      .split("\n")
      .filter((line: string) => line.trim().startsWith("// @ts-expect-error"));
    expect(tsExpectErrorDirectiveLines.length).toBeGreaterThanOrEqual(2);
    const nodeImportLines = wasmLoaderSource
      .split("\n")
      .filter((line: string) => /^\s*import\s.*from\s+"node:/.test(line));
    expect(nodeImportLines.length).toBeGreaterThanOrEqual(2);
  });

  it("18. Worker remains fully unconnected to the real evaluation/policy()/planLoad(), and Production Runtime (create_runtime.ts) remains fully unconnected", () => {
    expect(workerSource).not.toMatch(/fedos_wasm_loader/);
    expect(workerSource).not.toMatch(/devOnlyGateEvaluation|evaluateDevOnlyGate/);
    expect(workerSource).not.toMatch(/\bpolicy\s*\(/);
    expect(workerSource).not.toMatch(/planLoad/);
    expect(workerSource).not.toMatch(/initializeCrypto/);
    expect(workerDiagnosticsSource).not.toMatch(/devOnlyGateEvaluation|evaluateDevOnlyGate/);

    expect(createRuntimeSource).not.toMatch(/fedos_wasm_loader/);
    expect(createRuntimeSource).not.toMatch(/devOnlyGateEvaluation|evaluateDevOnlyGate/);
  });

  it("19. diagnostics gain no new field this stage", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(
      /devOnlyGateEvaluation|evaluateDevOnlyGate|developmentAllowed|DevelopmentRuntime/,
    );
    expect(workerDiagnosticsSource).not.toMatch(
      /devOnlyGateEvaluation|evaluateDevOnlyGate|developmentAllowed|DevelopmentRuntime/,
    );
  });

  it("20. WebAssembly.instantiate/compile are never invoked, even exercising the full chain with Development Runtime simulated", () => {
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

  it("21. Runtime's initializeCrypto() and every upstream layer's return value remain unaffected", () => {
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

  it("22. no cycle exists: policy() never calls planLoad(), and the real evaluation calls nothing but process.env", () => {
    const loader = createFedosWasmLoader();
    const planLoadSpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "planLoad");
    try {
      loader.policy();
      expect(planLoadSpy).not.toHaveBeenCalled();
    } finally {
      planLoadSpy.mockRestore();
    }
  });

  it("23. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(28);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(1);

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

  it("24. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.state).toBe("Unsupported");
    expect(encrypted.allowed).toBe(false);
    const decrypted = await provider.decrypt({});
    expect(decrypted.state).toBe("Unsupported");
    expect(decrypted.allowed).toBe(false);
  });
});
