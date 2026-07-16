import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  FedosWasmLoaderSkeleton,
  createFedosWasmLoader,
  loaderPlanReachedPolicy,
  loaderPolicyAllowed,
  loaderPolicyDecision,
  loaderPolicyReason,
} from "../src/runtime/fedos_wasm_loader.js";
import { createWasmBackend } from "../src/runtime/fedos_wasm_backend.js";
import { createCryptoBackendInterface } from "../src/runtime/fedos_crypto_backend_interface.js";
import { createCryptoBackendResolver } from "../src/runtime/fedos_crypto_backend_resolver.js";
import { createCryptoLoaderBackend } from "../src/runtime/fedos_crypto_loader_backend.js";
import { createCryptoLoaderFacade, initializeCrypto } from "../src/runtime/fedos_crypto_loader_facade.js";
import { createRuntime } from "../src/runtime/create_runtime.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../src/runtime/fedos_wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

/**
 * Stage 825 (Prototype Phase 011) — "FedosWasmLoader.planLoad() reaches
 * policy() -- result discarded in full, planLoad()'s own return value
 * byte-for-byte unchanged, no cycle, Runtime/Facade/Backend/Interface/
 * Resolver return values all unaffected, Worker/WASM/Rust unreached".
 *
 * This is a READ, not an obedience: planLoad() now structurally calls
 * policy(), but never merges its answer into its own return object and
 * never branches on it.
 */
describe("FedosWasmLoader.planLoad() reaches policy() (read only, discarded), no cycle, every upstream layer unaffected (Stage 825)", () => {
  it("1. planLoad() calls policy() exactly once per call", () => {
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

  it("2. planLoad()'s own return value is byte-for-byte unchanged", () => {
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad();
    expect(decision).toEqual({
      operation: "load",
      state: "BlockedByPolicy",
      policy: "FailClosed",
      reason: expect.any(String),
    });
    // Exactly these four keys -- nothing from policy()'s own shape merged in.
    expect(Object.keys(decision).sort()).toEqual(["operation", "policy", "reason", "state"]);
  });

  it("3. policy()'s own result is never merged into planLoad()'s return value", () => {
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad() as unknown as Record<string, unknown>;
    expect(decision).not.toHaveProperty("allowed");
    expect(decision.reason).not.toBe("PrototypePolicy");
    expect(decision.state).toBe("BlockedByPolicy"); // planLoad()'s OWN decision label, not policy()'s
  });

  it("4. Runtime's initializeCrypto() return value is unaffected", () => {
    const runtime = createRuntime();
    expect(runtime.initializeCrypto()).toEqual({
      allowed: false,
      initialized: false,
      reason: "PrototypeDisabled",
    });
  });

  it("5. Facade's return value is unaffected", () => {
    expect(() => createCryptoLoaderFacade()).not.toThrow();
    expect(() => initializeCrypto()).not.toThrow();
    expect(createCryptoLoaderFacade()).toEqual({
      state: "PlanningOnly",
      initialized: false,
      backend: "WasmPlanned",
      reason: "FacadeInitializationPending",
    });
  });

  it("6. Backend Abstraction's return value is unaffected", () => {
    expect(createCryptoLoaderBackend()).toEqual({
      state: "PlanningOnly",
      backendKind: "WasmPlanned",
      backendReady: false,
      reason: "BackendAbstractionPending",
    });
  });

  it("7. Backend Interface's return value is unaffected", () => {
    expect(createCryptoBackendInterface()).toEqual({
      state: "PlanningOnly",
      backendSelected: "WasmPlanned",
      backendActivated: false,
      interfaceReady: false,
      reason: "BackendInterfacePending",
    });
  });

  it("8. Backend Resolver's return value is unaffected", () => {
    expect(createCryptoBackendResolver()).toEqual({
      state: "PlanningOnly",
      selectedBackend: "WasmPlanned",
      backendResolved: false,
      backendAvailable: false,
      reason: "BackendResolutionPending",
    });
  });

  it("9. planningState() is not interfered with by the new planLoad() -> policy() reach", () => {
    const loader = createFedosWasmLoader();

    const planningStateSpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "planningState");
    try {
      loader.planLoad();
      expect(planningStateSpy).not.toHaveBeenCalled();
    } finally {
      planningStateSpy.mockRestore();
    }

    expect(loader.planningState()).toEqual({
      state: "Planning",
      decision: "BlockedByPolicy",
      loaded: false,
    });
  });

  it("10. status() is not interfered with by the new planLoad() -> policy() reach", () => {
    const loader = createFedosWasmLoader();

    const statusSpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "status");
    try {
      loader.planLoad();
      expect(statusSpy).not.toHaveBeenCalled();
    } finally {
      statusSpy.mockRestore();
    }

    expect(loader.status()).toEqual({
      state: "NotLoaded",
      mode: "PlanningOnly",
      policy: "FailClosed",
      reason: expect.any(String),
    });
  });

  it("11. Worker remains fully unconnected to planLoad()/policy()", () => {
    expect(createRuntimeSource).not.toMatch(/fedos_wasm_loader/);
    expect(workerSource).not.toMatch(/fedos_wasm_loader/);
    expect(workerSource).not.toMatch(/\bpolicy\s*\(/);
    expect(workerSource).not.toMatch(/planLoad/);
    expect(workerSource).not.toMatch(/initializeCrypto/);

    const workerStatus = workerCryptoActivationStatus() as unknown as Record<string, unknown>;
    expect(workerStatus).not.toHaveProperty("loaderPlanReachedPolicy");
  });

  it("12. WebAssembly.instantiate/compile are never invoked, even exercising the full reach chain", () => {
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

  it("13. no Rust reference anywhere in the Loader source; Rust public API unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986))", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    // Stage 921 (Prototype EXECUTION Phase 001, a later stage than
    // this one) legitimately names the two Generated Artifact
    // filenames ("fedos_core_rust.js"/"fedos_core_rust_bg.wasm") to
    // check their existence -- this checks for actual Rust
    // crate/module USAGE, not that naming.
    expect(codeOnly).not.toMatch(/fedos_core_rust(?!\.js"|_bg\.wasm")/);

    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(45);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(16);
  });

  it("14. no cycle exists: policy() never calls planLoad(), in either the new or the pre-existing direction", () => {
    const loader = createFedosWasmLoader();

    const planLoadSpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "planLoad");
    try {
      loader.policy();
      expect(planLoadSpy).not.toHaveBeenCalled();
    } finally {
      planLoadSpy.mockRestore();
    }

    // The new planLoad() -> policy() reach is intentionally ONE-directional.
    const policySpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "policy");
    try {
      loader.planLoad();
      expect(policySpy).toHaveBeenCalledTimes(1);
    } finally {
      policySpy.mockRestore();
    }
  });

  it("15. no fetch call, and no static import()/require() anywhere in the Loader source", () => {
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
    expect(codeOnly).not.toMatch(/create_runtime|AppRuntime/);
    expect(codeOnly).not.toMatch(/worker\.ts|src\/worker/);
    // Still only imports the pre-existing Loader Plan -- no new static import added.
    expect(codeOnly).not.toMatch(/fedos_wasm_loader_contract|fedos_wasm_artifact|fedos_wasm_boundary/);

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

  it("16. the diagnostics summary reports loaderPlanReachedPolicy: true; pre-existing loader Policy fields are unchanged", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.loaderPlanReachedPolicy).toBe(true);
    expect(status.loaderPolicyAllowed).toBe(false);
    expect(status.loaderPolicyDecision).toBe("BlockedByPolicy");
    expect(status.loaderPolicyReason).toBe("PrototypePolicy");

    expect(loaderPlanReachedPolicy()).toBe(true);
    expect(loaderPolicyAllowed()).toBe(false);
    expect(loaderPolicyDecision()).toBe("BlockedByPolicy");
    expect(loaderPolicyReason()).toBe("PrototypePolicy");
  });

  it("17. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
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
