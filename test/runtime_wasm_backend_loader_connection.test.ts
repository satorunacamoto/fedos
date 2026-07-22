import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  createWasmBackend,
  wasmBackendLoaderDecision,
  wasmBackendLoaderLoaded,
  wasmBackendLoaderReached,
  wasmBackendReady,
  wasmBackendState,
} from "../src/runtime/fedos_wasm_backend.js";
import { FedosWasmLoaderSkeleton, createFedosWasmLoader } from "../src/runtime/fedos_wasm_loader.js";
import { createCryptoBackendInterface } from "../src/runtime/fedos_crypto_backend_interface.js";
import { createCryptoLoaderBackend } from "../src/runtime/fedos_crypto_loader_backend.js";
import { createCryptoLoaderFacade, initializeCrypto } from "../src/runtime/fedos_crypto_loader_facade.js";
import { createRuntime } from "../src/runtime/create_runtime.js";
import { createExplicitCryptoInitialization } from "../src/runtime/fedos_explicit_crypto_initialization.js";
import { createDynamicLoaderDevApproval } from "../src/runtime/fedos_dynamic_loader_dev_approval.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import explicitInitSource from "../src/runtime/fedos_explicit_crypto_initialization.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import planningDocSource from "../docs/runtime_wasm_backend_planning.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmBackendSource from "../src/runtime/fedos_wasm_backend.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../src/runtime/fedos_wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
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
 * Stage 793–808 (Prototype Phase 008) — "First real connection from
 * WASM Backend Planning to the FedosWasmLoader Skeleton: planLoad()
 * is actually called, its result discarded, every existing fixed
 * return value stays byte-for-byte unchanged".
 *
 * `src/runtime/fedos_wasm_backend.ts`'s `createWasmBackend()` (Stage
 * 793) now constructs a `FedosWasmLoader` (`fedos_wasm_loader.ts`,
 * Stage 489-492, previously "unwired") and calls its `planLoad()` --
 * the FIRST real caller of that file anywhere in this repository
 * besides tests. `planLoad()` resolves `{ operation: "load", state:
 * "BlockedByPolicy", policy: "FailClosed", reason: "..." }`, discarded
 * in full. `createWasmBackend()`'s own return value, the Backend
 * Interface's own return value, the Backend Abstraction's own return
 * value, the Facade's own return value, and Runtime's own
 * `initializeCrypto()` return value all stay byte-for-byte unchanged.
 * The generated JS glue, `WebAssembly.instantiate`/`compile`,
 * `initSync`/the default init export, and Rust remain completely
 * unreached -- `planLoad()` itself only reaches its own internal
 * Loader Plan (`fedos_wasm_loader_plan.ts`), never further.
 */
describe("WASM Backend Planning reaches the real FedosWasmLoader.planLoad(), still BlockedByPolicy, no generated JS glue/WebAssembly/Rust reached (Stage 793-808)", () => {
  it("1. createWasmBackend() actually calls FedosWasmLoaderSkeleton.planLoad(), and the result is discarded", () => {
    const planLoadSpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "planLoad");
    try {
      const backend = createWasmBackend();
      expect(planLoadSpy).toHaveBeenCalledTimes(1);
      // The Loader's own decision never leaks into the Backend's own return value.
      expect(backend).toEqual({
        state: "PlanningOnly",
        backendReady: false,
        loaderAttached: false,
        loaderKind: "WasmLoaderPlanned",
        reason: "WasmBackendPlanningPending",
      });
    } finally {
      planLoadSpy.mockRestore();
    }
  });

  it("1b. no call-graph cycle exists -- the full chain terminates normally, and fedos_explicit_crypto_initialization.ts no longer reaches the Facade", () => {
    // This is the critical regression guard for Stage 793: reaching the real
    // FedosWasmLoader from WASM Backend Planning walks all the way down through
    // fedos_wasm_loader_plan.ts -> ... -> fedos_dynamic_loader_dev_approval.ts ->
    // fedos_explicit_crypto_initialization.ts. Before this stage's fix, that last
    // file ALSO called createCryptoLoaderFacade(), which would close a cycle back
    // to createWasmBackend() and recurse forever. Every call below must terminate.
    expect(() => createCryptoLoaderFacade()).not.toThrow();
    expect(() => initializeCrypto()).not.toThrow();
    expect(() => createCryptoLoaderBackend()).not.toThrow();
    expect(() => createCryptoBackendInterface()).not.toThrow();
    expect(() => createWasmBackend()).not.toThrow();
    expect(() => createDynamicLoaderDevApproval()).not.toThrow();
    expect(() => createExplicitCryptoInitialization()).not.toThrow();
    expect(() => createRuntime().initializeCrypto()).not.toThrow();

    expect(createExplicitCryptoInitialization()).toEqual({
      mode: "ExplicitInitialization",
      initializationAllowed: false,
      initialized: false,
      reason: "InitializationApprovalPending",
    });

    const codeOnly = codeOnlyLines(explicitInitSource);
    expect(codeOnly).not.toMatch(/fedos_crypto_loader_facade/);
  });

  it("2. createWasmBackend()'s own fixed return value is unchanged, including across repeated calls", () => {
    const first = createWasmBackend();
    const second = createWasmBackend();
    expect(first).toEqual(second);
    expect(first).toEqual({
      state: "PlanningOnly",
      backendReady: false,
      loaderAttached: false,
      loaderKind: "WasmLoaderPlanned",
      reason: "WasmBackendPlanningPending",
    });
    expect(wasmBackendState()).toBe("PlanningOnly");
    expect(wasmBackendReady()).toBe(false);
  });

  it("3. the new standalone accessors report the Loader is reached, not loaded, and BlockedByPolicy", () => {
    expect(wasmBackendLoaderReached()).toBe(true);
    expect(wasmBackendLoaderLoaded()).toBe(false);
    expect(wasmBackendLoaderDecision()).toBe("BlockedByPolicy");
  });

  it("4. the real FedosWasmLoader.planLoad() itself is unchanged -- still fixed BlockedByPolicy", () => {
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad();
    expect(decision).toEqual({
      operation: "load",
      state: "BlockedByPolicy",
      policy: "FailClosed",
      reason: expect.any(String),
    });
  });

  it("5. the full reach chain Runtime -> Facade -> Backend Abstraction -> Backend Interface -> WASM Backend -> WASM Loader is exercised, and every layer's own return value is unaffected", () => {
    const backend = createCryptoLoaderBackend();
    expect(backend).toEqual({
      state: "PlanningOnly",
      backendKind: "WasmPlanned",
      backendReady: false,
      reason: "BackendAbstractionPending",
    });

    const iface = createCryptoBackendInterface();
    expect(iface).toEqual({
      state: "PlanningOnly",
      backendSelected: "WasmPlanned",
      backendActivated: false,
      interfaceReady: false,
      reason: "BackendInterfacePending",
    });

    const facade = createCryptoLoaderFacade();
    expect(facade).toEqual({
      state: "PlanningOnly",
      initialized: false,
      backend: "WasmPlanned",
      reason: "FacadeInitializationPending",
    });
    expect(initializeCrypto()).toEqual({
      allowed: false,
      reason: "FacadeInitializationPending",
    });

    const runtime = createRuntime();
    expect(runtime.initializeCrypto()).toEqual({
      allowed: false,
      initialized: false,
      reason: "PrototypeDisabled",
    });
  });

  it("6. the diagnostics summary reports the three new fields; Worker diagnostics are unaffected", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.wasmBackendLoaderReached).toBe(true);
    expect(status.wasmBackendLoaderLoaded).toBe(false);
    expect(status.wasmBackendLoaderDecision).toBe("BlockedByPolicy");
    // Pre-existing fields are unchanged.
    expect(status.wasmBackendState).toBe("PlanningOnly");
    expect(status.wasmBackendReady).toBe(false);
    expect(status.wasmBackendLoaderAttached).toBe(false);
    expect(status.wasmBackendLoaderKind).toBe("WasmLoaderPlanned");
    expect(status.wasmBackendReason).toBe("WasmBackendPlanningPending");

    const workerStatus = workerCryptoActivationStatus() as unknown as Record<string, unknown>;
    expect(workerStatus).not.toHaveProperty("wasmBackendLoaderReached");
    expect(workerStatus).not.toHaveProperty("wasmBackendLoaderLoaded");
    expect(workerStatus).not.toHaveProperty("wasmBackendLoaderDecision");
  });

  it("7. the WASM Backend source legitimately reaches fedos_wasm_loader.ts only -- never fedos_wasm_loader_plan.ts/fedos_wasm_loader_contract.ts directly, the generated JS glue, WebAssembly, or Rust", () => {
    expect(wasmBackendSource).toMatch(/fedos_wasm_loader\.js/);
    const codeOnly = codeOnlyLines(wasmBackendSource);
    expect(codeOnly).not.toMatch(/fedos_wasm_loader_plan/);
    expect(codeOnly).not.toMatch(/fedos_wasm_loader_contract/);
    // Stage 921 (Prototype EXECUTION Phase 001, a later stage than
    // this one) legitimately names the two Generated Artifact
    // filenames ("fedos_core_rust.js"/"fedos_core_rust_bg.wasm") to
    // check their existence -- this checks for actual Rust
    // crate/module USAGE, not that naming.
    expect(codeOnly).not.toMatch(/fedos_core_rust(?!\.js"|_bg\.wasm")/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/instantiateStreaming/);
    // Stage 969 (Prototype EXECUTION Phase 007, a later stage than
    // this one) legitimately references .initSync as a PROPERTY
    // NAME to check for its presence on the retained JS glue module
    // -- this checks for a real, direct initSync(...) CALL, not the
    // property-name check.
    expect(codeOnly).not.toMatch(/\binitSync\s*\(/);
    expect(codeOnly).not.toMatch(/__wbg_init/);
    expect(codeOnly).not.toMatch(/\bfetch\s*\(/);
    // Stage 945 (Prototype EXECUTION Phase 004, a later stage than
    // this one) legitimately calls real, gated import() exactly once
    // inside attemptDevOnlyJsGlueImport() -- this checks for import()
    // ANYWHERE ELSE in the source, not that one narrowly-scoped call.
    expect(codeOnly).not.toMatch(/import\s*\((?!\/\* @vite-ignore \*\/)/);
    expect(codeOnly).not.toMatch(/require\s*\(/);
    expect(codeOnly).not.toMatch(/create_runtime|AppRuntime/);
    expect(codeOnly).not.toMatch(/worker\.ts|src\/worker/);
  });

  it("8. the real FedosWasmLoader source itself is unchanged in behavior -- still no generated JS glue, WebAssembly, or Rust reference in code", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    // Stage 921 (Prototype EXECUTION Phase 001, a later stage than
    // this one) legitimately names the two Generated Artifact
    // filenames ("fedos_core_rust.js"/"fedos_core_rust_bg.wasm") to
    // check their existence -- this checks for actual Rust
    // crate/module USAGE, not that naming.
    expect(codeOnly).not.toMatch(/fedos_core_rust(?!\.js"|_bg\.wasm")/);
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
    expect(codeOnly).not.toMatch(/\bfetch\s*\(/);
    // Stage 945 (Prototype EXECUTION Phase 004, a later stage than
    // this one) legitimately calls real, gated import() exactly once
    // inside attemptDevOnlyJsGlueImport() -- this checks for import()
    // ANYWHERE ELSE in the source, not that one narrowly-scoped call.
    expect(codeOnly).not.toMatch(/import\s*\((?!\/\* @vite-ignore \*\/)/);
    expect(codeOnly).not.toMatch(/create_runtime|AppRuntime/);
    expect(codeOnly).not.toMatch(/worker\.ts|src\/worker/);
    // Still only reaches its own internal Loader Plan, never further.
    expect(codeOnly).not.toMatch(/fedos_wasm_artifact|fedos_wasm_boundary|fedos_wasm_loader_contract/);
  });

  it("9. WebAssembly.instantiate/compile are never actually invoked, even when exercising the full chain through the real WASM Loader", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      createCryptoLoaderFacade();
      initializeCrypto();
      createCryptoLoaderBackend();
      createCryptoBackendInterface();
      createWasmBackend();
      createFedosWasmLoader().planLoad();
      createRuntime().initializeCrypto();
    } finally {
      instantiate.mockRestore();
      compile.mockRestore();
    }
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
  });

  it("10. no fetch call happens when exercising the full surface", async () => {
    const spy = vi.fn(() => Promise.resolve({ ok: true } as Response));
    const original = globalThis.fetch;
    (globalThis as { fetch?: unknown }).fetch = spy;
    try {
      createCryptoLoaderFacade();
      createCryptoLoaderBackend();
      createCryptoBackendInterface();
      createWasmBackend();
      createRuntime().initializeCrypto();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("11. Runtime and Worker remain fully unconnected to the real WASM Loader", () => {
    expect(createRuntimeSource).not.toMatch(/fedos_wasm_loader/);
    expect(workerSource).not.toMatch(/fedos_wasm_loader/);
    expect(workerSource).not.toMatch(/initializeCrypto/);
  });

  it("12. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
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

  it("13. Allowed/Loaded/Active are still unreachable anywhere in the chain", () => {
    expect(createWasmBackend().backendReady).toBe(false);
    expect(createWasmBackend().loaderAttached).toBe(false);
    expect(createWasmBackend().state).not.toBe("Active");
    expect(wasmBackendLoaderDecision()).not.toBe("Allowed");
    expect(wasmBackendLoaderLoaded()).toBe(false);
    expect(createFedosWasmLoader().planLoad().state).not.toBe("Allowed");
    expect(createFedosWasmLoader().status().state).not.toBe("Loaded");
    expect(createRuntime().initializeCrypto().allowed).toBe(false);
  });

  it("14. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(48);
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

  it("15. the WASM Backend Planning doc and execution contract doc record the required facts", () => {
    expect(planningDocSource).toMatch(/Loader reached, still blocked|reached.{0,20}still blocked/i);
    expect(planningDocSource).toMatch(/BlockedByPolicy/);

    expect(executionContractDocSource).toMatch(/FedosWasmLoader/);
    expect(executionContractDocSource).toMatch(/BlockedByPolicy/);
    expect(executionContractDocSource).toMatch(/\bSTOP\b/);
    expect(executionContractDocSource).toMatch(/Worker/);
  });
});
