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
  readFileSync: vi.fn(() => {
    throw new Error("simulated: real fedos_core_rust_bg.wasm does not exist on disk in this repo");
  }),
}));
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import * as nodeFs from "node:fs";

/**
 * Stage 969 (Prototype EXECUTION Phase 007) — "a NEW, separate,
 * PUBLIC, ASYNC method, `attemptDevOnlyWasmInitialization()`, checks
 * the retained JS glue module (Stage 961) at runtime for whichever of
 * `initSync`/`default` it actually exposes -- never hand-picked in
 * source -- and calls it with explicit fedos_core_rust_bg.wasm bytes
 * (never a no-argument fetch). ONLY reachable when import readiness,
 * Development Runtime, a successful import, and a retained module are
 * ALL true. planLoad() itself is BYTE-FOR-BYTE UNCHANGED and does not
 * call this method; it still always returns BlockedByPolicy
 * regardless of whether initialization was ever attempted or what its
 * outcome was. No Rust API call of any kind is ever made -- the
 * generated JS glue exposes none to call."
 */
describe("FedosWasmLoaderSkeleton.attemptDevOnlyWasmInitialization() performs REAL, gated WASM initialization via whichever init API the retained module exposes, never calls Rust, planLoad() itself unchanged (Stage 969)", () => {
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

  async function readyLoader(
    importGeneratedJsGlue: () => Promise<unknown>,
    readGeneratedWasmBytes?: (path: string) => Uint8Array,
  ): Promise<FedosWasmLoaderSkeleton> {
    const loader = new FedosWasmLoaderSkeleton({
      importGeneratedJsGlue,
      readGeneratedWasmBytes,
    });
    loader.planLoad();
    await loader.attemptDevOnlyJsGlueImport();
    return loader;
  }

  it("1. wasmInitialization() is null before attemptDevOnlyWasmInitialization() has ever been called", () => {
    const loader = new FedosWasmLoaderSkeleton();
    expect(loader.wasmInitialization()).toBeNull();
  });

  it("2. with no module (import never attempted), initialization is NEVER attempted -- reason=PrototypeStillClosed", async () => {
    const loader = new FedosWasmLoaderSkeleton();
    const result = await loader.attemptDevOnlyWasmInitialization();
    expect(result).toEqual({ attempted: false, succeeded: false, reason: "PrototypeStillClosed" });
    expect(loader.wasmInitialization()).toEqual(result);
  });

  it("3. with a module but readiness/runtime conditions unmet, initialization is NEVER attempted -- reason=NotReady", async () => {
    await withArtifacts(false, async () => {
      await withNodeEnv("development", async () => {
        const initFn = vi.fn(() => ({}));
        const loader = await readyLoader(async () => ({ initSync: initFn }));
        const result = await loader.attemptDevOnlyWasmInitialization();
        expect(result).toEqual({ attempted: false, succeeded: false, reason: "NotReady" });
        expect(initFn).not.toHaveBeenCalled();
      });
    });
  });

  it("4. initSync is preferred when present, even if default is also present", async () => {
    await withArtifacts(true, async () => {
      await withNodeEnv("development", async () => {
        const initSyncFn = vi.fn((_input: unknown) => ({}));
        const defaultFn = vi.fn(async (_input: unknown) => ({}));
        const loader = await readyLoader(async () => ({ initSync: initSyncFn, default: defaultFn }), () =>
          new Uint8Array([0, 1, 2, 3]),
        );
        const result = await loader.attemptDevOnlyWasmInitialization();
        expect(result).toEqual({ attempted: true, succeeded: true, reason: "Initialized" });
        expect(initSyncFn).toHaveBeenCalledTimes(1);
        expect(defaultFn).not.toHaveBeenCalled();
        expect(initSyncFn.mock.calls[0]?.[0]).toEqual({ module: new Uint8Array([0, 1, 2, 3]) });
      });
    });
  });

  it("5. default is used when initSync is absent", async () => {
    await withArtifacts(true, async () => {
      await withNodeEnv("development", async () => {
        const defaultFn = vi.fn(async (_input: unknown) => ({}));
        const loader = await readyLoader(async () => ({ default: defaultFn }), () => new Uint8Array([9, 9]));
        const result = await loader.attemptDevOnlyWasmInitialization();
        expect(result).toEqual({ attempted: true, succeeded: true, reason: "Initialized" });
        expect(defaultFn).toHaveBeenCalledTimes(1);
        expect(defaultFn.mock.calls[0]?.[0]).toEqual({ module_or_path: new Uint8Array([9, 9]) });
      });
    });
  });

  it("6. default is NEVER called with no argument -- always passed explicit bytes", async () => {
    await withArtifacts(true, async () => {
      await withNodeEnv("development", async () => {
        const defaultFn = vi.fn(async (_input: unknown) => ({}));
        const loader = await readyLoader(async () => ({ default: defaultFn }), () => new Uint8Array([1]));
        await loader.attemptDevOnlyWasmInitialization();
        expect(defaultFn).toHaveBeenCalledTimes(1);
        expect(defaultFn.mock.calls[0]?.length).toBe(1);
        expect(defaultFn.mock.calls[0]?.[0]).not.toBeUndefined();
      });
    });
  });

  it("7. neither initSync nor default present -> InitializationUnavailable, no bytes read attempted", async () => {
    await withArtifacts(true, async () => {
      await withNodeEnv("development", async () => {
        const readBytes = vi.fn(() => new Uint8Array());
        const loader = await readyLoader(async () => ({ marker: "no-init-functions" }), readBytes);
        const result = await loader.attemptDevOnlyWasmInitialization();
        expect(result).toEqual({ attempted: true, succeeded: false, reason: "InitializationUnavailable" });
        expect(readBytes).not.toHaveBeenCalled();
      });
    });
  });

  it("8. init function throws -> InitializationFailed, Fail Closed, not thrown", async () => {
    await withArtifacts(true, async () => {
      await withNodeEnv("development", async () => {
        const loader = await readyLoader(
          async () => ({
            initSync: () => {
              throw new Error("simulated instantiation failure");
            },
          }),
          () => new Uint8Array([1, 2]),
        );
        await expect(loader.attemptDevOnlyWasmInitialization()).resolves.toEqual({
          attempted: true,
          succeeded: false,
          reason: "InitializationFailed",
        });
      });
    });
  });

  it("9. wasm bytes read fails -> InitializationFailed, Fail Closed, not thrown", async () => {
    await withArtifacts(true, async () => {
      await withNodeEnv("development", async () => {
        const loader = await readyLoader(async () => ({ initSync: vi.fn(() => ({})) }), () => {
          throw new Error("simulated read failure");
        });
        await expect(loader.attemptDevOnlyWasmInitialization()).resolves.toEqual({
          attempted: true,
          succeeded: false,
          reason: "InitializationFailed",
        });
      });
    });
  });

  it("10. against the REAL (unmocked) repo state, no generated artifact exists, so initialization is never attempted", async () => {
    const loader = createFedosWasmLoader() as unknown as FedosWasmLoaderSkeleton;
    withNodeEnv("development", () => {
      loader.planLoad();
    });
    await loader.attemptDevOnlyJsGlueImport();
    const result = await loader.attemptDevOnlyWasmInitialization();
    expect(result.reason).toBe("NotReady");
    expect(result.attempted).toBe(false);
  });

  it("11. planLoad() still returns the SAME BlockedByPolicy answer after a successful initialization, byte-for-byte unchanged", async () => {
    await withArtifacts(true, async () => {
      await withNodeEnv("development", async () => {
        const loader = await readyLoader(async () => ({ initSync: vi.fn(() => ({})) }), () => new Uint8Array([1]));
        const initResult = await loader.attemptDevOnlyWasmInitialization();
        expect(initResult.succeeded).toBe(true);
        const decision = loader.planLoad();
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

  it("12. no property of a successful init result is retained -- InitOutput/memory/instance never stored or exposed", async () => {
    await withArtifacts(true, async () => {
      await withNodeEnv("development", async () => {
        const fakeInitOutput = { memory: { marker: "fake-memory" }, __wbindgen_start: () => undefined };
        const loader = await readyLoader(async () => ({ initSync: () => fakeInitOutput }), () => new Uint8Array([1]));
        const result = await loader.attemptDevOnlyWasmInitialization();
        expect(result).toEqual({ attempted: true, succeeded: true, reason: "Initialized" });
        expect(Object.keys(result)).toEqual(["attempted", "succeeded", "reason"]);
      });
    });
  });

  it("13. Import Plan.shouldImport and every other Plan's own field stay false regardless of WASM initialization outcome", async () => {
    await withArtifacts(true, async () => {
      await withNodeEnv("development", async () => {
        const loader = await readyLoader(async () => ({ initSync: vi.fn(() => ({})) }), () => new Uint8Array([1]));
        await loader.attemptDevOnlyWasmInitialization();
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

  it("14. no Rust API call exists anywhere in the Loader source, including version(), and no #[wasm_bindgen]", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    expect(codeOnly).not.toMatch(/\bversion\s*\(/);
    expect(codeOnly).not.toMatch(/#\[wasm_bindgen\]/);
    expect(codeOnly).not.toMatch(/fedos_core_rust(?!\.js"|_bg\.wasm"|\.js`)/);
    expect(codeOnly).not.toMatch(/__wbg_init/);
  });

  it("15. no real WebAssembly API usage exists anywhere in the Loader source -- only the two named init functions are checked by name", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    expect(codeOnly).not.toMatch(/WebAssembly\./);
    expect(codeOnly).not.toMatch(/new\s+WebAssembly\.Module/);
    expect(codeOnly).not.toMatch(/new\s+WebAssembly\.Instance/);
    expect(codeOnly).toMatch(/candidate\.initSync/);
    expect(codeOnly).toMatch(/candidate\.default/);
  });

  it("16. no content-reading filesystem API other than readFileSync exists anywhere in the Loader source", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    expect(codeOnly).not.toMatch(/statSync|readFile\(|readdirSync|writeFileSync|unlinkSync/);
    expect(codeOnly).toMatch(/readFileSync/);
  });

  it("17. planLoad()'s own source is byte-for-byte unaffected: no reference to attemptDevOnlyWasmInitialization/wasmInitialization inside planLoad()'s body", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    const planLoadMatch = codeOnly.match(/planLoad\(\): FedosWasmLoaderDecision \{[\s\S]*?\n {2}\}/);
    expect(planLoadMatch).not.toBeNull();
    const planLoadBody = (planLoadMatch as RegExpMatchArray)[0] ?? "";
    expect(planLoadBody.length).toBeGreaterThan(0);
    expect(planLoadBody).not.toMatch(/wasmInitialization/);
    expect(planLoadBody).not.toMatch(/attemptDevOnlyWasmInitialization/);

    const loader = createFedosWasmLoader();
    const decision = loader.planLoad();
    expect(decision).toEqual({
      operation: "load",
      state: "BlockedByPolicy",
      policy: "FailClosed",
      reason: expect.any(String),
    });
  });

  it("18. Worker remains fully unconnected to wasmInitialization()/policy()/planLoad(), and Production Runtime (create_runtime.ts) remains fully unconnected", () => {
    expect(workerSource).not.toMatch(/fedos_wasm_loader/);
    expect(workerSource).not.toMatch(/wasmInitialization|attemptDevOnlyWasmInitialization/);
    expect(workerSource).not.toMatch(/\bpolicy\s*\(/);
    expect(workerSource).not.toMatch(/planLoad/);
    expect(workerSource).not.toMatch(/initializeCrypto/);
    expect(workerDiagnosticsSource).not.toMatch(/wasmInitialization|attemptDevOnlyWasmInitialization/);

    expect(createRuntimeSource).not.toMatch(/fedos_wasm_loader/);
    expect(createRuntimeSource).not.toMatch(/wasmInitialization|attemptDevOnlyWasmInitialization/);
  });

  it("19. diagnostics gain no new field this stage", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(
      /wasmInitialization|attemptDevOnlyWasmInitialization|InitializationUnavailable|InitializationFailed/,
    );
    expect(workerDiagnosticsSource).not.toMatch(
      /wasmInitialization|attemptDevOnlyWasmInitialization|InitializationUnavailable|InitializationFailed/,
    );
  });

  it("20. WebAssembly.instantiate/compile and fetch are never invoked by the Loader, even exercising a successful initialization", async () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true } as Response));
    const originalFetch = globalThis.fetch;
    (globalThis as { fetch?: unknown }).fetch = fetchSpy;
    try {
      await withArtifacts(true, async () => {
        await withNodeEnv("development", async () => {
          const loader = await readyLoader(async () => ({ initSync: vi.fn(() => ({})) }), () => new Uint8Array([1]));
          await loader.attemptDevOnlyWasmInitialization();
          loader.wasmInitialization();
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

  it("22. no cycle exists: policy() never calls planLoad() or attemptDevOnlyWasmInitialization()", () => {
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
    expect(pubFnNames.length).toBe(33);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(10);

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
