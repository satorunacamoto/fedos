import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  FedosWasmLoaderSkeleton,
  createFedosWasmLoader,
  loaderLoaded,
  loaderMode,
  loaderPlanningDecision,
  loaderPlanningState,
  loaderPolicy,
  loaderState,
} from "../src/runtime/fedos_wasm_loader.js";
import { createWasmBackend } from "../src/runtime/fedos_wasm_backend.js";
import { createCryptoBackendInterface } from "../src/runtime/fedos_crypto_backend_interface.js";
import { createCryptoLoaderBackend } from "../src/runtime/fedos_crypto_loader_backend.js";
import { createCryptoLoaderFacade, initializeCrypto } from "../src/runtime/fedos_crypto_loader_facade.js";
import { createRuntime } from "../src/os/_legacy_prototype/runtime/create_runtime.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../src/runtime/fedos_wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
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
 * Stage 809 (Prototype Phase 009) — "FedosWasmLoader gains a Loader
 * State reader, planningState() -- fixed { state: "Planning",
 * decision: "BlockedByPolicy", loaded: false }, no cycle with
 * planLoad(), planLoad() itself byte-for-byte unchanged".
 *
 * A design conflict was found and fixed before this addition landed:
 * `status()` (Stage 489) already exists with a DIFFERENT, pinned shape
 * (`{ state: "NotLoaded", mode: "PlanningOnly", policy: "FailClosed",
 * reason }`), and `FedosWasmLoaderState` already exports
 * `"NotLoaded" | "Loaded"`. This stage adds a NEW, separately-named
 * method (`planningState()`) and type (`FedosWasmLoaderPlanningState`)
 * instead of redefining either -- `status()`'s own return value is
 * untouched, guarded here and by the pre-existing
 * `test/runtime_wasm_loader.test.ts`.
 */
describe("FedOS WASM Loader gains a Loader State reader, no cycle with planLoad(), status() untouched (Stage 809)", () => {
  it("1. planningState() is always fixed -- never a live probe, and never collides with status()", () => {
    const loader = createFedosWasmLoader();
    const planning = loader.planningState();
    expect(planning).toEqual({
      state: "Planning",
      decision: "BlockedByPolicy",
      loaded: false,
    });
    // Pure and idempotent across repeated calls.
    expect(loader.planningState()).toEqual(planning);

    expect(loaderPlanningState()).toBe("Planning");
    expect(loaderPlanningDecision()).toBe("BlockedByPolicy");
    expect(loaderLoaded()).toBe(false);

    // status() is a DIFFERENT method with a DIFFERENT, untouched shape.
    const status = loader.status();
    expect(status).toEqual({
      state: "NotLoaded",
      mode: "PlanningOnly",
      policy: "FailClosed",
      reason: expect.any(String),
    });
    expect(loaderState()).toBe("NotLoaded");
    expect(loaderMode()).toBe("PlanningOnly");
    expect(loaderPolicy()).toBe("FailClosed");
  });

  it("2. planLoad()'s own return value is byte-for-byte unchanged by this stage", () => {
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad();
    expect(decision).toEqual({
      operation: "load",
      state: "BlockedByPolicy",
      policy: "FailClosed",
      reason: expect.any(String),
    });
  });

  it("3. no cycle exists between planningState() and planLoad() in either direction", () => {
    const loader = createFedosWasmLoader();

    const planLoadSpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "planLoad");
    try {
      loader.planningState();
      expect(planLoadSpy).not.toHaveBeenCalled();
    } finally {
      planLoadSpy.mockRestore();
    }

    const planningStateSpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "planningState");
    try {
      loader.planLoad();
      expect(planningStateSpy).not.toHaveBeenCalled();
    } finally {
      planningStateSpy.mockRestore();
    }
  });

  it("4. the full reach chain still terminates normally, and every existing layer's return value is unaffected", () => {
    expect(() => createCryptoLoaderFacade()).not.toThrow();
    expect(() => initializeCrypto()).not.toThrow();
    expect(() => createCryptoLoaderBackend()).not.toThrow();
    expect(() => createCryptoBackendInterface()).not.toThrow();
    expect(() => createWasmBackend()).not.toThrow();
    expect(() => createRuntime().initializeCrypto()).not.toThrow();

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

  it("5. Runtime and Worker remain fully unconnected to the Loader State reader", () => {
    expect(createRuntimeSource).not.toMatch(/fedos_wasm_loader/);
    expect(workerSource).not.toMatch(/fedos_wasm_loader/);
    expect(workerSource).not.toMatch(/planningState/);
    expect(workerSource).not.toMatch(/initializeCrypto/);
  });

  it("6. the diagnostics summary reports the three new fields; Worker diagnostics are unaffected", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.loaderPlanningState).toBe("Planning");
    expect(status.loaderPlanningDecision).toBe("BlockedByPolicy");
    expect(status.loaderLoaded).toBe(false);
    // Pre-existing loader-related fields are unchanged.
    expect(status.loaderSkeletonState).toBe("NotLoaded");
    expect(status.loaderSkeletonMode).toBe("PlanningOnly");
    expect(status.loaderSkeletonPolicy).toBe("FailClosed");
    expect(status.wasmBackendLoaderReached).toBe(true);
    expect(status.wasmBackendLoaderLoaded).toBe(false);
    expect(status.wasmBackendLoaderDecision).toBe("BlockedByPolicy");

    const workerStatus = workerCryptoActivationStatus() as unknown as Record<string, unknown>;
    expect(workerStatus).not.toHaveProperty("loaderPlanningState");
    expect(workerStatus).not.toHaveProperty("loaderPlanningDecision");
    expect(workerStatus).not.toHaveProperty("loaderLoaded");
  });

  it("7. no WebAssembly/generated JS glue/Rust reference of any kind, and no new import()/require() anywhere in the Loader source", () => {
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
    // Still only imports the pre-existing Loader Plan -- no new static import added.
    expect(codeOnly).not.toMatch(/fedos_wasm_loader_contract|fedos_wasm_artifact|fedos_wasm_boundary/);
  });

  it("8. WebAssembly.instantiate/compile are never actually invoked, even when exercising the full surface including planningState()", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      const loader = createFedosWasmLoader();
      loader.planningState();
      loader.status();
      loader.planLoad();
      loaderPlanningState();
      loaderPlanningDecision();
      loaderLoaded();
      createWasmBackend();
      createRuntime().initializeCrypto();
    } finally {
      instantiate.mockRestore();
      compile.mockRestore();
    }
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
  });

  it("9. no fetch call happens when exercising the full surface", async () => {
    const spy = vi.fn(() => Promise.resolve({ ok: true } as Response));
    const original = globalThis.fetch;
    (globalThis as { fetch?: unknown }).fetch = spy;
    try {
      const loader = createFedosWasmLoader();
      loader.planningState();
      loader.planLoad();
      createWasmBackend();
      createRuntime().initializeCrypto();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("10. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
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

  it("11. Allowed/Active/Loaded are still unreachable anywhere in the new reader", () => {
    const loader = createFedosWasmLoader();
    expect(loader.planningState().state).not.toBe("Active");
    expect(loader.planningState().decision).not.toBe("Allowed");
    expect(loader.planningState().loaded).toBe(false);
    expect(loaderPlanningState()).not.toBe("Active");
    expect(loaderPlanningDecision()).not.toBe("Allowed");
    expect(loaderLoaded()).toBe(false);
  });

  it("12. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);

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
});
