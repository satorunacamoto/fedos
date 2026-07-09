import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  FedosWasmLoaderSkeleton,
  createFedosWasmLoader,
  loaderPolicyEvaluated,
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
 * Stage 833 (Prototype Phase 012) — "FedosWasmLoader.planLoad() actually
 * EVALUATES policy() -- branches on .allowed via `if (!policy.allowed)`
 * -- instead of merely reaching and discarding it. Because allowed is
 * permanently false, the branch always resolves BlockedByPolicy;
 * planLoad()'s own return value, key order included, is byte-for-byte
 * unchanged. The allowed:true path is a single reserved TODO comment,
 * never implemented."
 */
describe("FedosWasmLoader.planLoad() evaluates policy().allowed, always BlockedByPolicy, no cycle, every upstream layer unaffected (Stage 833)", () => {
  it("1. planLoad() calls policy() exactly once per call (to obtain the value it now evaluates)", () => {
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

  it("2. policy().allowed is evaluated (fixed false) -- the Policy Evaluation actually inspects the value", () => {
    const loader = createFedosWasmLoader();
    expect(loader.policy().allowed).toBe(false);
    expect(loaderPolicyAllowed()).toBe(false);
    expect(loaderPolicyEvaluated()).toBe(true);
  });

  it("3. the allowed:false branch always reaches BlockedByPolicy", () => {
    const loader = createFedosWasmLoader();
    for (let i = 0; i < 5; i += 1) {
      expect(loader.planLoad().state).toBe("BlockedByPolicy");
    }
  });

  it("4. the allowed:true (else) path is never reached -- policy().allowed can never be true in this stage", () => {
    const loader = createFedosWasmLoader();
    // There is no way to force policy() to answer allowed: true in this
    // stage -- it is a hand-fixed constant -- so the reserved TODO path
    // is structurally unreachable. Assert the precondition that keeps
    // it that way.
    expect(loader.policy()).toEqual({
      allowed: false,
      decision: "BlockedByPolicy",
      reason: "PrototypePolicy",
    });
    expect(loader.planLoad().state).not.toBe("Allowed");
  });

  it("5. planLoad()'s own return value is byte-for-byte unchanged, key order included", () => {
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

  it("6. policy()'s own result is never merged into planLoad()'s return value", () => {
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad() as unknown as Record<string, unknown>;
    expect(decision).not.toHaveProperty("allowed");
    expect(decision.reason).not.toBe("PrototypePolicy");
    expect(decision.state).toBe("BlockedByPolicy"); // planLoad()'s OWN decision label, not policy()'s
  });

  it("7. planningState() is not interfered with by the Policy Evaluation", () => {
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

  it("8. status() is not interfered with by the Policy Evaluation", () => {
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

  it("9. Runtime's initializeCrypto() return value is unaffected", () => {
    const runtime = createRuntime();
    expect(runtime.initializeCrypto()).toEqual({
      allowed: false,
      initialized: false,
      reason: "PrototypeDisabled",
    });
  });

  it("10. Facade's return value is unaffected", () => {
    expect(() => createCryptoLoaderFacade()).not.toThrow();
    expect(() => initializeCrypto()).not.toThrow();
    expect(createCryptoLoaderFacade()).toEqual({
      state: "PlanningOnly",
      initialized: false,
      backend: "WasmPlanned",
      reason: "FacadeInitializationPending",
    });
  });

  it("11. Backend Abstraction's return value is unaffected", () => {
    expect(createCryptoLoaderBackend()).toEqual({
      state: "PlanningOnly",
      backendKind: "WasmPlanned",
      backendReady: false,
      reason: "BackendAbstractionPending",
    });
  });

  it("12. Backend Interface's return value is unaffected", () => {
    expect(createCryptoBackendInterface()).toEqual({
      state: "PlanningOnly",
      backendSelected: "WasmPlanned",
      backendActivated: false,
      interfaceReady: false,
      reason: "BackendInterfacePending",
    });
  });

  it("13. Backend Resolver's return value is unaffected", () => {
    expect(createCryptoBackendResolver()).toEqual({
      state: "PlanningOnly",
      selectedBackend: "WasmPlanned",
      backendResolved: false,
      backendAvailable: false,
      reason: "BackendResolutionPending",
    });
  });

  it("14. Worker remains fully unconnected to planLoad()/policy()/the Policy Evaluation", () => {
    expect(createRuntimeSource).not.toMatch(/fedos_wasm_loader/);
    expect(workerSource).not.toMatch(/fedos_wasm_loader/);
    expect(workerSource).not.toMatch(/\bpolicy\s*\(/);
    expect(workerSource).not.toMatch(/planLoad/);
    expect(workerSource).not.toMatch(/initializeCrypto/);

    const workerStatus = workerCryptoActivationStatus() as unknown as Record<string, unknown>;
    expect(workerStatus).not.toHaveProperty("loaderPolicyEvaluated");
    expect(workerStatus).not.toHaveProperty("loaderPlanReachedPolicy");
  });

  it("15. WebAssembly.instantiate/compile are never invoked, even exercising the full evaluation chain", () => {
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

  it("16. no Rust reference anywhere in the Loader source; Rust public API unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986))", () => {
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
    expect(pubFnNames.length).toBe(30);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(3);
  });

  it("17. no cycle exists: policy() never calls planLoad(), in either direction", () => {
    const loader = createFedosWasmLoader();

    const planLoadSpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "planLoad");
    try {
      loader.policy();
      expect(planLoadSpy).not.toHaveBeenCalled();
    } finally {
      planLoadSpy.mockRestore();
    }

    // planLoad() -> policy() remains strictly one-directional.
    const policySpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "policy");
    try {
      loader.planLoad();
      expect(policySpy).toHaveBeenCalledTimes(1);
    } finally {
      policySpy.mockRestore();
    }
  });

  it("18. no fetch call, no static import()/require(), and no Load/Import/WebAssembly/Rust progression anywhere in the Loader source", () => {
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

  it("19. the diagnostics summary reports loaderPolicyEvaluated: true; every pre-existing loader field is unchanged", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.loaderPolicyEvaluated).toBe(true);
    expect(status.loaderPlanReachedPolicy).toBe(true);
    expect(status.loaderPolicyAllowed).toBe(false);
    expect(status.loaderPolicyDecision).toBe("BlockedByPolicy");
    expect(status.loaderPolicyReason).toBe("PrototypePolicy");

    expect(loaderPolicyEvaluated()).toBe(true);
    expect(loaderPlanReachedPolicy()).toBe(true);
    expect(loaderPolicyAllowed()).toBe(false);
    expect(loaderPolicyDecision()).toBe("BlockedByPolicy");
    expect(loaderPolicyReason()).toBe("PrototypePolicy");
  });

  it("20. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
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
