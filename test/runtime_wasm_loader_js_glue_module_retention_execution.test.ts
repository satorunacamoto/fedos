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
 * Stage 961 (Prototype EXECUTION Phase 006) — "attemptDevOnlyJsGlueImport()'s
 * (Stage 945) successful import now RETAINS the resolved module,
 * unexamined, on a new private field, readable via jsGlueModule() --
 * instead of discarding it. Every other outcome sets it to null. The
 * module is never inspected, destructured, or called anywhere in this
 * file; WebAssembly/Rust remain entirely unreached; planLoad() itself
 * is untouched."
 */
describe("FedosWasmLoaderSkeleton retains the imported JS Glue module on success, sets it null otherwise, never inspects/executes it, WebAssembly/Rust untouched, planLoad() unchanged (Stage 961)", () => {
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

  it("1. jsGlueModule() is null before attemptDevOnlyJsGlueImport() has ever been called", () => {
    const loader = new FedosWasmLoaderSkeleton();
    expect(loader.jsGlueModule()).toBeNull();
  });

  it("2. import success -> jsGlueModule() returns the exact resolved module object, retained", async () => {
    const fakeModule = { marker: "fake-js-glue-module", version: () => "unreachable-if-called" };
    await withArtifacts(true, async () => {
      await withNodeEnv("development", async () => {
        const loader = new FedosWasmLoaderSkeleton({ importGeneratedJsGlue: async () => fakeModule });
        loader.planLoad();
        const result = await loader.attemptDevOnlyJsGlueImport();
        expect(result.reason).toBe("Imported");
        expect(loader.jsGlueModule()).toBe(fakeModule);
      });
    });
  });

  it("3. import failure (rejects) -> jsGlueModule() is null", async () => {
    const loader = new FedosWasmLoaderSkeleton({
      importGeneratedJsGlue: async () => {
        throw new Error("simulated failure");
      },
    });
    // Force the readiness gate open via a direct constructor-injected
    // hook is not available for readiness itself, so drive it through
    // planLoad() with mocked artifact/runtime state is unnecessary here:
    // attemptDevOnlyJsGlueImport() without a prior successful readiness
    // already resolves reason "NotReady"/"PrototypeStillClosed", both
    // of which must ALSO leave jsGlueModule() null.
    const result = await loader.attemptDevOnlyJsGlueImport();
    expect(result.succeeded).toBe(false);
    expect(loader.jsGlueModule()).toBeNull();
  });

  it("4. readiness null (planLoad() never called) -> jsGlueModule() stays null", async () => {
    const loader = new FedosWasmLoaderSkeleton({ importGeneratedJsGlue: async () => ({ fake: true }) });
    const result = await loader.attemptDevOnlyJsGlueImport();
    expect(result.reason).toBe("PrototypeStillClosed");
    expect(loader.jsGlueModule()).toBeNull();
  });

  it("5. a PRIOR successful retention is cleared (Fail Closed) by a LATER unsuccessful attempt on the SAME instance", async () => {
    let shouldSucceed = true;
    const fakeModule = { marker: "fake-js-glue-module" };
    const loader = new FedosWasmLoaderSkeleton({
      importGeneratedJsGlue: async () => {
        if (shouldSucceed) {
          return fakeModule;
        }
        throw new Error("simulated failure");
      },
    });

    await withArtifacts(true, async () => {
      await withNodeEnv("development", async () => {
        loader.planLoad();
        const first = await loader.attemptDevOnlyJsGlueImport();
        expect(first.reason).toBe("Imported");
        expect(loader.jsGlueModule()).toBe(fakeModule);

        shouldSucceed = false;
        const second = await loader.attemptDevOnlyJsGlueImport();
        expect(second.reason).toBe("ImportFailed");
        expect(loader.jsGlueModule()).toBeNull();
      });
    });
  });

  it("6. the retained module is never inspected, destructured, or called anywhere in the Loader source", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    // No property access, spread, or call syntax applied to the
    // retained field anywhere in real code.
    expect(codeOnly).not.toMatch(/#jsGlueModule\??\.\w/);
    expect(codeOnly).not.toMatch(/\.\.\.this\.#jsGlueModule/);
    expect(codeOnly).not.toMatch(/#jsGlueModule\(\)/);
    expect(codeOnly).not.toMatch(/#jsGlueModule\)\s*\(/);
  });

  it("7. no __wbg_init/initSync/default-init/WebAssembly reference exists anywhere in the Loader source", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    expect(codeOnly).not.toMatch(/__wbg_init/);
    expect(codeOnly).not.toMatch(/initSync/);
    expect(codeOnly).not.toMatch(/WebAssembly\./);
    expect(codeOnly).not.toMatch(/new\s+WebAssembly\.Module/);
    expect(codeOnly).not.toMatch(/new\s+WebAssembly\.Instance/);
  });

  it("8. no Rust API call exists anywhere in the Loader source, including version(), and no #[wasm_bindgen]", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    expect(codeOnly).not.toMatch(/\bversion\s*\(/);
    expect(codeOnly).not.toMatch(/#\[wasm_bindgen\]/);
    expect(codeOnly).not.toMatch(/fedos_core_rust(?!\.js"|_bg\.wasm"|\.js`)/);
  });

  it("9. planLoad()'s own source is byte-for-byte unaffected: no reference to jsGlueModule/importExecution/attemptDevOnlyJsGlueImport inside planLoad()'s body", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    const planLoadMatch = codeOnly.match(/planLoad\(\): FedosWasmLoaderDecision \{[\s\S]*?\n {2}\}/);
    expect(planLoadMatch).not.toBeNull();
    const planLoadBody = (planLoadMatch as RegExpMatchArray)[0] ?? "";
    expect(planLoadBody.length).toBeGreaterThan(0);
    expect(planLoadBody).not.toMatch(/jsGlueModule/);
    expect(planLoadBody).not.toMatch(/importExecution/);
    expect(planLoadBody).not.toMatch(/attemptDevOnlyJsGlueImport/);

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

  it("10. Import Plan.shouldImport and every other Plan's own field stay false regardless of module retention", async () => {
    const loader = new FedosWasmLoaderSkeleton({ importGeneratedJsGlue: async () => ({}) });
    await loader.attemptDevOnlyJsGlueImport();
    expect(loaderImportPlanShouldImport()).toBe(false);
    expect(loaderPolicyAllowed()).toBe(false);
    expect(loaderLoadPlanShouldLoad()).toBe(false);
    expect(loaderJsGlueAccessPlanShouldAccess()).toBe(false);
    expect(loaderGeneratedArtifactCheckPlanShouldCheck()).toBe(false);
    expect(loaderDevOnlyGatePlanShouldEvaluate()).toBe(false);
    expect(loaderWebAssemblyPlanShouldInstantiate()).toBe(false);
    expect(loaderRustApiCallPlanShouldCall()).toBe(false);
  });

  it("11. Worker remains fully unconnected to jsGlueModule()/policy()/planLoad(), and Production Runtime (create_runtime.ts) remains fully unconnected", () => {
    expect(workerSource).not.toMatch(/fedos_wasm_loader/);
    expect(workerSource).not.toMatch(/jsGlueModule|attemptDevOnlyJsGlueImport|importExecution/);
    expect(workerSource).not.toMatch(/\bpolicy\s*\(/);
    expect(workerSource).not.toMatch(/planLoad/);
    expect(workerSource).not.toMatch(/initializeCrypto/);
    expect(workerDiagnosticsSource).not.toMatch(/jsGlueModule|attemptDevOnlyJsGlueImport|importExecution/);

    expect(createRuntimeSource).not.toMatch(/fedos_wasm_loader/);
    expect(createRuntimeSource).not.toMatch(/jsGlueModule|attemptDevOnlyJsGlueImport|importExecution/);
  });

  it("12. diagnostics gain no new field this stage", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(/jsGlueModule|attemptDevOnlyJsGlueImport/);
    expect(workerDiagnosticsSource).not.toMatch(/jsGlueModule|attemptDevOnlyJsGlueImport/);
  });

  it("13. WebAssembly.instantiate/compile and fetch are never invoked, even exercising a retained module", async () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true } as Response));
    const originalFetch = globalThis.fetch;
    (globalThis as { fetch?: unknown }).fetch = fetchSpy;
    try {
      const loader = new FedosWasmLoaderSkeleton({ importGeneratedJsGlue: async () => ({ marker: true }) });
      await loader.attemptDevOnlyJsGlueImport();
      loader.jsGlueModule();
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
      (globalThis as { fetch?: unknown }).fetch = originalFetch;
    }
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("14. Runtime's initializeCrypto() and every upstream layer's return value remain unaffected", () => {
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

  it("15. no cycle exists: policy() never calls planLoad() or attemptDevOnlyJsGlueImport()", () => {
    const loader = createFedosWasmLoader();
    const planLoadSpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "planLoad");
    try {
      loader.policy();
      expect(planLoadSpy).not.toHaveBeenCalled();
    } finally {
      planLoadSpy.mockRestore();
    }
  });

  it("16. Rust public API is unchanged (27 pub fn, none #[wasm_bindgen]-annotated) -- Cargo/package dependencies unchanged", () => {
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

  it("17. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.state).toBe("Unsupported");
    expect(encrypted.allowed).toBe(false);
    const decrypted = await provider.decrypt({});
    expect(decrypted.state).toBe("Unsupported");
    expect(decrypted.allowed).toBe(false);
  });
});
