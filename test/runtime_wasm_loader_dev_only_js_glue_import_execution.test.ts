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
 * Stage 945 (Prototype EXECUTION Phase 004) — "a NEW, separate, PUBLIC,
 * ASYNC method, `attemptDevOnlyJsGlueImport()`, calls real dynamic
 * `import()` on the Generated JS Glue -- but ONLY when the MOST
 * RECENT `planLoad()` call recorded `importReadiness().ready === true`.
 * `planLoad()` itself is BYTE-FOR-BYTE UNCHANGED by this stage and
 * does not call this new method; it still always returns
 * BlockedByPolicy regardless of whether the import was ever attempted
 * or what its outcome was. Even a successful import touches nothing
 * further -- no __wbg_init/initSync/WebAssembly/Rust of any kind."
 */
describe("FedosWasmLoaderSkeleton.attemptDevOnlyJsGlueImport() performs a REAL, gated import() of the Generated JS Glue only when importReady=true, never touches WebAssembly/Rust, planLoad() itself unchanged (Stage 945)", () => {
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

  it("1. importExecution() is null before attemptDevOnlyJsGlueImport() has ever been called", () => {
    const loader = new FedosWasmLoaderSkeleton();
    expect(loader.importExecution()).toBeNull();
  });

  it("2. when planLoad() was never called (importReadiness null), import is NEVER attempted -- Fail Closed to PrototypeStillClosed", async () => {
    const importHook = vi.fn(async () => ({}));
    const loader = new FedosWasmLoaderSkeleton({ importGeneratedJsGlue: importHook });
    const result = await loader.attemptDevOnlyJsGlueImport();
    expect(result).toEqual({ attempted: false, succeeded: false, reason: "PrototypeStillClosed" });
    expect(loader.importExecution()).toEqual(result);
    expect(importHook).not.toHaveBeenCalled();
  });

  it("3. when importReady=false (artifacts missing), import is NEVER attempted -- reason=NotReady", async () => {
    await withArtifacts(false, async () => {
      await withNodeEnv("development", async () => {
        const importHook = vi.fn(async () => ({}));
        const loader = new FedosWasmLoaderSkeleton({ importGeneratedJsGlue: importHook });
        loader.planLoad();
        const result = await loader.attemptDevOnlyJsGlueImport();
        expect(result).toEqual({ attempted: false, succeeded: false, reason: "NotReady" });
        expect(importHook).not.toHaveBeenCalled();
      });
    });
  });

  it("4. when importReady=false (not Development Runtime), import is NEVER attempted -- reason=NotReady", async () => {
    await withArtifacts(true, async () => {
      await withNodeEnv("production", async () => {
        const importHook = vi.fn(async () => ({}));
        const loader = new FedosWasmLoaderSkeleton({ importGeneratedJsGlue: importHook });
        loader.planLoad();
        const result = await loader.attemptDevOnlyJsGlueImport();
        expect(result).toEqual({ attempted: false, succeeded: false, reason: "NotReady" });
        expect(importHook).not.toHaveBeenCalled();
      });
    });
  });

  it("5. when importReady=true, import IS attempted, called with a file:// URL naming ONLY fedos_core_rust.js (never the .wasm file)", async () => {
    await withArtifacts(true, async () => {
      await withNodeEnv("development", async () => {
        const importHook = vi.fn(async (_specifier: string) => ({}));
        const loader = new FedosWasmLoaderSkeleton({ importGeneratedJsGlue: importHook });
        loader.planLoad();
        await loader.attemptDevOnlyJsGlueImport();
        expect(importHook).toHaveBeenCalledTimes(1);
        const specifier = importHook.mock.calls[0]?.[0] ?? "";
        expect(specifier).toMatch(/^file:\/\//);
        expect(specifier).toMatch(/fedos_core_rust\.js$/);
        expect(specifier).not.toMatch(/fedos_core_rust_bg\.wasm/);
      });
    });
  });

  it("6. import succeeds -> attempted=true, succeeded=true, reason=Imported", async () => {
    await withArtifacts(true, async () => {
      await withNodeEnv("development", async () => {
        const loader = new FedosWasmLoaderSkeleton({ importGeneratedJsGlue: async () => ({ ready: true }) });
        loader.planLoad();
        const result = await loader.attemptDevOnlyJsGlueImport();
        expect(result).toEqual({ attempted: true, succeeded: true, reason: "Imported" });
        expect(loader.importExecution()).toEqual(result);
      });
    });
  });

  it("7. import fails (rejects) -> attempted=true, succeeded=false, reason=ImportFailed -- Fail Closed, not thrown", async () => {
    await withArtifacts(true, async () => {
      await withNodeEnv("development", async () => {
        const loader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => {
            throw new Error("simulated module resolution failure");
          },
        });
        loader.planLoad();
        await expect(loader.attemptDevOnlyJsGlueImport()).resolves.toEqual({
          attempted: true,
          succeeded: false,
          reason: "ImportFailed",
        });
      });
    });
  });

  it("8. against the REAL (unmocked) repo state, import genuinely fails -- the generated artifact does not exist on disk", async () => {
    withNodeEnv("development", () => {
      // No existsSync mock override here: the real packages/fedos-core-rust/pkg
      // directory does not exist in this repo, so real existsSync -> false,
      // so importReady never becomes true, so real import() is never attempted.
    });
    const loader = createFedosWasmLoader() as unknown as FedosWasmLoaderSkeleton;
    withNodeEnv("development", () => {
      loader.planLoad();
    });
    const result = await loader.attemptDevOnlyJsGlueImport();
    expect(result.reason).toBe("NotReady");
    expect(result.attempted).toBe(false);
  });

  it("9. both success and failure still leave planLoad() returning the SAME BlockedByPolicy answer, byte-for-byte unchanged", async () => {
    await withArtifacts(true, async () => {
      await withNodeEnv("development", async () => {
        const loader = new FedosWasmLoaderSkeleton({ importGeneratedJsGlue: async () => ({}) });
        loader.planLoad();
        await loader.attemptDevOnlyJsGlueImport();
        const decisionAfterSuccess = loader.planLoad();
        expect(decisionAfterSuccess).toEqual({
          operation: "load",
          state: "BlockedByPolicy",
          policy: "FailClosed",
          reason: expect.any(String),
        });
        expect(Object.keys(decisionAfterSuccess)).toEqual(["operation", "state", "policy", "reason"]);
      });

      const failingLoader = new FedosWasmLoaderSkeleton({
        importGeneratedJsGlue: async () => {
          throw new Error("simulated failure");
        },
      });
      await withNodeEnv("development", async () => {
        failingLoader.planLoad();
        await failingLoader.attemptDevOnlyJsGlueImport();
        const decisionAfterFailure = failingLoader.planLoad();
        expect(decisionAfterFailure).toEqual({
          operation: "load",
          state: "BlockedByPolicy",
          policy: "FailClosed",
          reason: expect.any(String),
        });
      });
    });
  });

  it("10. Import Plan.shouldImport and every other Plan's own field stay false even after a successful import", async () => {
    await withArtifacts(true, async () => {
      await withNodeEnv("development", async () => {
        const loader = new FedosWasmLoaderSkeleton({ importGeneratedJsGlue: async () => ({}) });
        loader.planLoad();
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
    });
  });

  it("11. attemptDevOnlyJsGlueImport() is called by NOTHING inside planLoad() itself -- planLoad()'s own source is byte-for-byte unchanged in behavior", () => {
    const loader = createFedosWasmLoader();
    // planLoad() never triggers any import attempt on its own.
    const decision = loader.planLoad();
    expect(decision).toEqual({
      operation: "load",
      state: "BlockedByPolicy",
      policy: "FailClosed",
      reason: expect.any(String),
    });
    expect((loader as unknown as FedosWasmLoaderSkeleton).importExecution()).toBeNull();
  });

  it("12. no __wbg_init/initSync/WebAssembly reference exists anywhere in the Loader source", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    expect(codeOnly).not.toMatch(/__wbg_init/);
    // Stage 969 (Prototype EXECUTION Phase 007, a later stage than
    // this one) legitimately references .initSync as a PROPERTY
    // NAME to check for its presence on the retained JS glue module
    // -- this checks for a real, direct initSync(...) CALL, not the
    // property-name check.
    expect(codeOnly).not.toMatch(/\binitSync\s*\(/);
    expect(codeOnly).not.toMatch(/WebAssembly\./);
    expect(codeOnly).not.toMatch(/new\s+WebAssembly\.Module/);
    expect(codeOnly).not.toMatch(/new\s+WebAssembly\.Instance/);
  });

  it("13. no Rust API call exists anywhere in the Loader source, including version(), and no #[wasm_bindgen]", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    expect(codeOnly).not.toMatch(/\bversion\s*\(/);
    expect(codeOnly).not.toMatch(/#\[wasm_bindgen\]/);
    expect(codeOnly).not.toMatch(/fedos_core_rust(?!\.js"|_bg\.wasm"|\.js`)/);
  });

  it("14. only the ONE known-legitimate gated import() call exists -- no unconditional/ungated import() anywhere else", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    const importCallMatches = [...codeOnly.matchAll(/\bimport\s*\(/g)];
    expect(importCallMatches.length).toBe(1);
    expect(codeOnly).toMatch(/importGeneratedJsGlue\(pathToFileURL/);
  });

  it("15. WebAssembly.instantiate/compile and fetch are never invoked, even exercising a successful import", async () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true } as Response));
    const originalFetch = globalThis.fetch;
    (globalThis as { fetch?: unknown }).fetch = fetchSpy;
    try {
      await withArtifacts(true, async () => {
        await withNodeEnv("development", async () => {
          const loader = new FedosWasmLoaderSkeleton({ importGeneratedJsGlue: async () => ({}) });
          loader.planLoad();
          await loader.attemptDevOnlyJsGlueImport();
          loader.policy();
          loader.planningState();
          loader.status();
          createWasmBackend();
          createCryptoBackendInterface();
          createCryptoBackendResolver();
          createCryptoLoaderBackend();
          createCryptoLoaderFacade();
          createRuntime().initializeCrypto();
        });
      });
    } finally {
      instantiate.mockRestore();
      compile.mockRestore();
      (globalThis as { fetch?: unknown }).fetch = originalFetch;
    }
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("16. Worker remains fully unconnected to the import execution/policy()/planLoad(), and Production Runtime (create_runtime.ts) remains fully unconnected", () => {
    expect(workerSource).not.toMatch(/fedos_wasm_loader/);
    expect(workerSource).not.toMatch(/attemptDevOnlyJsGlueImport|importExecution|importGeneratedJsGlue/);
    expect(workerSource).not.toMatch(/\bpolicy\s*\(/);
    expect(workerSource).not.toMatch(/planLoad/);
    expect(workerSource).not.toMatch(/initializeCrypto/);
    expect(workerDiagnosticsSource).not.toMatch(/attemptDevOnlyJsGlueImport|importExecution|importGeneratedJsGlue/);

    expect(createRuntimeSource).not.toMatch(/fedos_wasm_loader/);
    expect(createRuntimeSource).not.toMatch(/attemptDevOnlyJsGlueImport|importExecution|importGeneratedJsGlue/);
  });

  it("17. diagnostics gain no new field this stage", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(
      /attemptDevOnlyJsGlueImport|importExecution|importGeneratedJsGlue|ImportFailed/,
    );
    expect(workerDiagnosticsSource).not.toMatch(
      /attemptDevOnlyJsGlueImport|importExecution|importGeneratedJsGlue|ImportFailed/,
    );
  });

  it("18. Runtime's initializeCrypto() and every upstream layer's return value remain unaffected", () => {
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

  it("19. no cycle exists: policy() never calls planLoad() or attemptDevOnlyJsGlueImport()", () => {
    const loader = createFedosWasmLoader();
    const planLoadSpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "planLoad");
    try {
      loader.policy();
      expect(planLoadSpy).not.toHaveBeenCalled();
    } finally {
      planLoadSpy.mockRestore();
    }
  });

  it("20. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
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

  it("21. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.state).toBe("Unsupported");
    expect(encrypted.allowed).toBe(false);
    const decrypted = await provider.decrypt({});
    expect(decrypted.state).toBe("Unsupported");
    expect(decrypted.allowed).toBe(false);
  });
});
