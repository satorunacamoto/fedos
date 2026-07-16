import { describe, it, expect, vi } from "vitest";
// This project's tsconfig.json carries no `@types/node`; declared
// ambient here the same way `src/runtime/fedos_wasm_loader.ts` itself does.
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
import {
  FedosWasmLoaderSkeleton,
  createFedosWasmLoader,
} from "../src/runtime/fedos_wasm_loader.js";
import { initializeCrypto } from "../src/runtime/fedos_crypto_loader_facade.js";
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
import fedosCryptoLoaderFacadeSource from "../src/runtime/fedos_crypto_loader_facade.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import verificationDocSource from "../docs/runtime_wasm_js_glue_version_export_verification.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/runtime_wasm_loader_dev_only_rust_version_call_execution.md?raw";
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
 * Prototype EXECUTION Phase 012 — "Dev-only Rust version() Call": the
 * FIRST time this arc ever calls a real Rust API through the retained
 * JS glue module. `attemptDevOnlyRustVersionCall()` checks ONLY
 * `typeof module.version === "function"` (no export-list discovery)
 * and, when all six prior-state gate conditions hold, calls
 * `module.version()` with no argument -- a genuine `string` return is
 * the only success path; anything else (throw, non-string) Fails
 * Closed to `CallFailed`, never thrown. `planLoad()`/`initializeCrypto()`
 * remain byte-for-byte unchanged and never call this method.
 */
describe("FedosWasmLoaderSkeleton.attemptDevOnlyRustVersionCall() performs REAL, gated Rust version() call via module.version only, Fail Closed everywhere else (Stage 993)", () => {
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

  async function fullyReadyLoader(
    importGeneratedJsGlue: () => Promise<unknown>,
    readGeneratedWasmBytes: (path: string) => Uint8Array = () => new Uint8Array([1]),
  ): Promise<FedosWasmLoaderSkeleton> {
    const loader = new FedosWasmLoaderSkeleton({
      importGeneratedJsGlue,
      readGeneratedWasmBytes,
    });
    loader.planLoad();
    await loader.attemptDevOnlyJsGlueImport();
    await loader.attemptDevOnlyWasmInitialization();
    return loader;
  }

  it("1. rustVersionExecution() is null before attemptDevOnlyRustVersionCall() has ever been called", () => {
    const loader = new FedosWasmLoaderSkeleton();
    expect(loader.rustVersionExecution()).toBeNull();
  });

  it("2. with no prior state at all (planLoad() never called), the call is NEVER attempted -- reason=PrototypeStillClosed", async () => {
    const loader = new FedosWasmLoaderSkeleton();
    const result = await loader.attemptDevOnlyRustVersionCall();
    expect(result).toEqual({ attempted: false, succeeded: false, version: null, reason: "PrototypeStillClosed" });
    expect(loader.rustVersionExecution()).toEqual(result);
  });

  it("3. with prior state present but WASM Initialization never succeeded, the call is NEVER attempted -- reason=NotInitialized", async () => {
    await withArtifacts(true, async () => {
      await withNodeEnv("development", async () => {
        // initSync throws, so attemptDevOnlyWasmInitialization() records succeeded=false.
        const versionFn = vi.fn(() => "1.2.3");
        const loader = await fullyReadyLoader(async () => ({
          initSync: () => {
            throw new Error("simulated instantiation failure");
          },
          version: versionFn,
        }));
        expect(loader.wasmInitialization()?.succeeded).toBe(false);
        const result = await loader.attemptDevOnlyRustVersionCall();
        expect(result).toEqual({ attempted: false, succeeded: false, version: null, reason: "NotInitialized" });
        expect(versionFn).not.toHaveBeenCalled();
      });
    });
  });

  it("4. with Development conditions unmet (non-development NODE_ENV), the call is NEVER attempted -- reason=NotInitialized", async () => {
    await withArtifacts(true, async () => {
      await withNodeEnv("production", async () => {
        const versionFn = vi.fn(() => "1.2.3");
        const loader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({ initSync: vi.fn(() => ({})), version: versionFn }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        loader.planLoad();
        await loader.attemptDevOnlyJsGlueImport();
        await loader.attemptDevOnlyWasmInitialization();
        const result = await loader.attemptDevOnlyRustVersionCall();
        expect(result.attempted).toBe(false);
        expect(result.succeeded).toBe(false);
        expect(result.version).toBeNull();
        expect(["NotInitialized", "PrototypeStillClosed"]).toContain(result.reason);
        expect(versionFn).not.toHaveBeenCalled();
      });
    });
  });

  it("5. all six conditions satisfied, module.version present and returns a string -> Succeeded, called with no argument", async () => {
    await withArtifacts(true, async () => {
      await withNodeEnv("development", async () => {
        const versionFn = vi.fn(() => "fedos-core-rust/0.0.0");
        const loader = await fullyReadyLoader(async () => ({
          initSync: vi.fn(() => ({})),
          version: versionFn,
        }));
        const result = await loader.attemptDevOnlyRustVersionCall();
        expect(result).toEqual({
          attempted: true,
          succeeded: true,
          version: "fedos-core-rust/0.0.0",
          reason: "Succeeded",
        });
        expect(loader.rustVersionExecution()).toEqual(result);
        expect(versionFn).toHaveBeenCalledTimes(1);
        expect(versionFn.mock.calls[0]?.length).toBe(0);
      });
    });
  });

  it("6. module.version is absent -> VersionUnavailable, never called", async () => {
    await withArtifacts(true, async () => {
      await withNodeEnv("development", async () => {
        const loader = await fullyReadyLoader(async () => ({
          initSync: vi.fn(() => ({})),
          // no `version` property at all
        }));
        const result = await loader.attemptDevOnlyRustVersionCall();
        expect(result).toEqual({ attempted: true, succeeded: false, version: null, reason: "VersionUnavailable" });
      });
    });
  });

  it("7. module.version exists but is not a function -> VersionUnavailable, never called", async () => {
    await withArtifacts(true, async () => {
      await withNodeEnv("development", async () => {
        const loader = await fullyReadyLoader(async () => ({
          initSync: vi.fn(() => ({})),
          version: "not-a-function",
        }));
        const result = await loader.attemptDevOnlyRustVersionCall();
        expect(result).toEqual({ attempted: true, succeeded: false, version: null, reason: "VersionUnavailable" });
      });
    });
  });

  it("8. module.version() throws -> CallFailed, Fail Closed, not thrown", async () => {
    await withArtifacts(true, async () => {
      await withNodeEnv("development", async () => {
        const loader = await fullyReadyLoader(async () => ({
          initSync: vi.fn(() => ({})),
          version: () => {
            throw new Error("simulated version() failure");
          },
        }));
        await expect(loader.attemptDevOnlyRustVersionCall()).resolves.toEqual({
          attempted: true,
          succeeded: false,
          version: null,
          reason: "CallFailed",
        });
      });
    });
  });

  it("9. module.version() returns a non-string value -> CallFailed, never Succeeded", async () => {
    // Each candidate gets its OWN withArtifacts()/withNodeEnv() scope --
    // wrapping several full async attempt-flows inside ONE such scope
    // would let its `finally` (mock cleanup) run after only the FIRST
    // flow's initial await, not after the whole loop.
    for (const badReturn of [undefined, 42, {}, null, ["1.0.0"]]) {
      await withArtifacts(true, async () => {
        await withNodeEnv("development", async () => {
          const loader = await fullyReadyLoader(async () => ({
            initSync: vi.fn(() => ({})),
            version: () => badReturn,
          }));
          const result = await loader.attemptDevOnlyRustVersionCall();
          expect(result).toEqual({ attempted: true, succeeded: false, version: null, reason: "CallFailed" });
        });
      });
    }
  });

  it("10. against the REAL (unmocked) repo state, no generated artifact exists, so the call is never attempted", async () => {
    const loader = createFedosWasmLoader() as unknown as FedosWasmLoaderSkeleton;
    withNodeEnv("development", () => {
      loader.planLoad();
    });
    await loader.attemptDevOnlyJsGlueImport();
    await loader.attemptDevOnlyWasmInitialization();
    const result = await loader.attemptDevOnlyRustVersionCall();
    expect(result.attempted).toBe(false);
    expect(result.succeeded).toBe(false);
    expect(result.version).toBeNull();
  });

  it("11. planLoad() still returns the SAME BlockedByPolicy answer after a successful version() call, byte-for-byte unchanged", async () => {
    await withArtifacts(true, async () => {
      await withNodeEnv("development", async () => {
        const loader = await fullyReadyLoader(async () => ({
          initSync: vi.fn(() => ({})),
          version: () => "1.2.3",
        }));
        const versionResult = await loader.attemptDevOnlyRustVersionCall();
        expect(versionResult.succeeded).toBe(true);
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

  it("12. no module or Rust object is retained -- only succeeded/version/reason survive, module itself absent from the result", async () => {
    await withArtifacts(true, async () => {
      await withNodeEnv("development", async () => {
        const loader = await fullyReadyLoader(async () => ({
          initSync: vi.fn(() => ({})),
          version: () => "9.9.9",
        }));
        const result = await loader.attemptDevOnlyRustVersionCall();
        expect(Object.keys(result).sort()).toEqual(["attempted", "reason", "succeeded", "version"].sort());
        expect(typeof result.version === "string" || result.version === null).toBe(true);
      });
    });
  });

  it("13. planLoad()'s own source has no reference to rustVersionExecution/attemptDevOnlyRustVersionCall inside its body", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    const planLoadMatch = codeOnly.match(/planLoad\(\): FedosWasmLoaderDecision \{[\s\S]*?\n {2}\}/);
    expect(planLoadMatch).not.toBeNull();
    const planLoadBody = (planLoadMatch as RegExpMatchArray)[0] ?? "";
    expect(planLoadBody.length).toBeGreaterThan(0);
    expect(planLoadBody).not.toMatch(/rustVersionExecution/);
    expect(planLoadBody).not.toMatch(/attemptDevOnlyRustVersionCall/);
  });

  it("14. initializeCrypto() is byte-for-byte unaffected -- no reference to rustVersionExecution/attemptDevOnlyRustVersionCall anywhere in its source", () => {
    expect(fedosCryptoLoaderFacadeSource).not.toMatch(/rustVersionExecution/);
    expect(fedosCryptoLoaderFacadeSource).not.toMatch(/attemptDevOnlyRustVersionCall/);
  });

  it("15. initializeCrypto()'s own real return value is unaffected regardless of this stage's addition", () => {
    const decision = initializeCrypto();
    expect(decision.allowed).toBe(false);
  });

  it("16. createRuntime()'s own facade is unaffected -- no reference to rustVersionExecution/attemptDevOnlyRustVersionCall anywhere", () => {
    const runtime = createRuntime();
    expect(runtime).toBeDefined();
    expect(createRuntimeSource).not.toMatch(/rustVersionExecution/);
    expect(createRuntimeSource).not.toMatch(/attemptDevOnlyRustVersionCall/);
  });

  it("17. Worker remains fully unconnected -- src/worker.ts references neither rustVersionExecution nor attemptDevOnlyRustVersionCall", () => {
    expect(workerSource).not.toMatch(/rustVersionExecution/);
    expect(workerSource).not.toMatch(/attemptDevOnlyRustVersionCall/);
    expect(workerSource).not.toMatch(
      /fedos_wasm_toolchain|fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api|fedos_runtime_crypto_provider/,
    );
  });

  it("18. Production (create_runtime.ts) remains unconnected to this new method beyond the pre-existing WASM Backend Planning reach", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_toolchain|fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api/,
    );
  });

  it("19. Runtime and Worker diagnostics files are byte-for-byte untouched by this stage -- no reference to it anywhere, no new field", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(/rustVersionExecution/);
    expect(runtimeDiagnosticsSource).not.toMatch(/attemptDevOnlyRustVersionCall/);
    expect(workerDiagnosticsSource).not.toMatch(/rustVersionExecution/);
    expect(workerDiagnosticsSource).not.toMatch(/attemptDevOnlyRustVersionCall/);
  });

  it("20. no other Rust API is ever called -- no encrypt/decrypt/randomBytes/deriveKey reference in the Loader source's new method", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    const methodMatch = codeOnly.match(
      /async attemptDevOnlyRustVersionCall\(\): Promise<FedosWasmLoaderRustVersionExecution> \{[\s\S]*?\n {2}\}/,
    );
    expect(methodMatch).not.toBeNull();
    const methodBody = (methodMatch as RegExpMatchArray)[0] ?? "";
    expect(methodBody.length).toBeGreaterThan(0);
    expect(methodBody).not.toMatch(/\bencrypt\b/i);
    expect(methodBody).not.toMatch(/\bdecrypt\b/i);
    expect(methodBody).not.toMatch(/randomBytes/i);
    expect(methodBody).not.toMatch(/deriveKey/i);
    expect(methodBody).toMatch(/candidate\.version/);
  });

  it("21. no export-list enumeration exists anywhere in the Loader source -- only module.version is ever checked", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    expect(codeOnly).not.toMatch(/Object\.keys\(\s*(module|candidate)\s*\)/);
    expect(codeOnly).not.toMatch(/Object\.entries\(\s*(module|candidate)\s*\)/);
    expect(codeOnly).not.toMatch(/Object\.getOwnPropertyNames\(\s*(module|candidate)\s*\)/);
  });

  it("22. Rust public API is unchanged -- still 28 pub fn, still exactly one #[wasm_bindgen]; Cargo/package dependencies unchanged", () => {
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

  it("23. still exactly seven Plan interfaces -- no eighth added by this stage", () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);
  });

  it("24. the design doc exists, is substantial, and states the six gate conditions, the two Fail-Closed reasons, and what this Phase does NOT do", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
    expect(designDocSource).toMatch(/ALL SIX/);
    expect(designDocSource).toMatch(/PrototypeStillClosed/);
    expect(designDocSource).toMatch(/NotInitialized/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `initializeCrypto\(\)`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `planLoad\(\)`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* connect to Worker/);
  });

  it("25. cross-references the Stage 986 version() export, the Stage 987 JS glue verification, and the Stage 969 WASM initialization this Phase's sixth gate depends on", () => {
    expect(designDocSource).toMatch(/runtime_wasm_rust_version_export\.md/);
    expect(designDocSource).toMatch(/runtime_wasm_js_glue_version_export_verification\.md/);
    expect(designDocSource).toMatch(/runtime_wasm_loader_dev_only_wasm_initialization_execution\.md/);
    expect(verificationDocSource).toMatch(/version/);
  });
});
