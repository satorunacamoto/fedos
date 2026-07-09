import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  FedosWasmLoaderSkeleton,
  createFedosWasmLoader,
  loaderLoaded,
  loaderPlanningDecision,
  loaderPlanningState,
  loaderPolicyAllowed,
  loaderPolicyDecision,
  loaderPolicyReason,
} from "../src/runtime/fedos_wasm_loader.js";
import { createWasmBackend } from "../src/runtime/fedos_wasm_backend.js";
import { createCryptoBackendInterface } from "../src/runtime/fedos_crypto_backend_interface.js";
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
 * Stage 817 (Prototype Phase 010) — "FedosWasmLoader gains a Loader
 * Policy reader, policy() -- fixed { allowed: false, decision:
 * "BlockedByPolicy", reason: "PrototypePolicy" }, independent of
 * planningState() and status(), no cycle with planLoad(), planLoad()
 * itself byte-for-byte unchanged".
 */
describe("FedOS WASM Loader gains a Loader Policy reader, independent of planningState()/status(), no cycle with planLoad() (Stage 817)", () => {
  it("1. policy() is always a fixed constant", () => {
    const loader = createFedosWasmLoader();
    const policy = loader.policy();
    expect(policy).toEqual({
      allowed: false,
      decision: "BlockedByPolicy",
      reason: "PrototypePolicy",
    });
    // Pure and idempotent across repeated calls.
    expect(loader.policy()).toEqual(policy);

    expect(loaderPolicyAllowed()).toBe(false);
    expect(loaderPolicyDecision()).toBe("BlockedByPolicy");
    expect(loaderPolicyReason()).toBe("PrototypePolicy");
  });

  it("2. policy() is independent of planningState() -- neither calls the other", () => {
    const loader = createFedosWasmLoader();

    const planningStateSpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "planningState");
    try {
      loader.policy();
      expect(planningStateSpy).not.toHaveBeenCalled();
    } finally {
      planningStateSpy.mockRestore();
    }

    const policySpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "policy");
    try {
      loader.planningState();
      expect(policySpy).not.toHaveBeenCalled();
    } finally {
      policySpy.mockRestore();
    }

    // Their own return values stay unaffected by the other's existence.
    expect(loader.planningState()).toEqual({
      state: "Planning",
      decision: "BlockedByPolicy",
      loaded: false,
    });
  });

  it("3. policy() is independent of status() -- neither calls the other", () => {
    const loader = createFedosWasmLoader();

    const statusSpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "status");
    try {
      loader.policy();
      expect(statusSpy).not.toHaveBeenCalled();
    } finally {
      statusSpy.mockRestore();
    }

    const policySpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "policy");
    try {
      loader.status();
      expect(policySpy).not.toHaveBeenCalled();
    } finally {
      policySpy.mockRestore();
    }

    // status()'s own pinned shape stays untouched.
    expect(loader.status()).toEqual({
      state: "NotLoaded",
      mode: "PlanningOnly",
      policy: "FailClosed",
      reason: expect.any(String),
    });
  });

  it("4. planLoad()'s own return value is byte-for-byte unchanged by this stage", () => {
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad();
    expect(decision).toEqual({
      operation: "load",
      state: "BlockedByPolicy",
      policy: "FailClosed",
      reason: expect.any(String),
    });
  });

  it("5. no cycle exists: policy() never calls planLoad(); planLoad() -> policy() is a new, one-directional reach as of Stage 825", () => {
    const loader = createFedosWasmLoader();

    const planLoadSpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "planLoad");
    try {
      loader.policy();
      expect(planLoadSpy).not.toHaveBeenCalled();
    } finally {
      planLoadSpy.mockRestore();
    }

    // Stage 825 (Prototype Phase 011, test/runtime_wasm_loader_plan_policy_connection.test.ts)
    // wires planLoad() to call policy() exactly once, discarding the
    // result -- a deliberate, one-directional reach, not a cycle,
    // since policy() itself still never calls planLoad() (asserted
    // above).
    const policySpy = vi.spyOn(FedosWasmLoaderSkeleton.prototype, "policy");
    try {
      loader.planLoad();
      expect(policySpy).toHaveBeenCalledTimes(1);
    } finally {
      policySpy.mockRestore();
    }
  });

  it("6. the full reach chain still terminates normally, and every existing layer's return value is unaffected", () => {
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

  it("7. Runtime and Worker remain fully unconnected to the Loader Policy reader", () => {
    expect(createRuntimeSource).not.toMatch(/fedos_wasm_loader/);
    expect(workerSource).not.toMatch(/fedos_wasm_loader/);
    expect(workerSource).not.toMatch(/\bpolicy\s*\(/);
    expect(workerSource).not.toMatch(/initializeCrypto/);

    const workerStatus = workerCryptoActivationStatus() as unknown as Record<string, unknown>;
    expect(workerStatus).not.toHaveProperty("loaderPolicyAllowed");
    expect(workerStatus).not.toHaveProperty("loaderPolicyDecision");
    expect(workerStatus).not.toHaveProperty("loaderPolicyReason");
  });

  it("8. the diagnostics summary reports the three new fields; pre-existing loader fields are unchanged", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.loaderPolicyAllowed).toBe(false);
    expect(status.loaderPolicyDecision).toBe("BlockedByPolicy");
    expect(status.loaderPolicyReason).toBe("PrototypePolicy");
    // Pre-existing loader-related fields are unchanged.
    expect(status.loaderPlanningState).toBe("Planning");
    expect(status.loaderPlanningDecision).toBe("BlockedByPolicy");
    expect(status.loaderLoaded).toBe(false);
    expect(status.loaderSkeletonState).toBe("NotLoaded");
    expect(status.loaderSkeletonMode).toBe("PlanningOnly");
    expect(status.loaderSkeletonPolicy).toBe("FailClosed");
  });

  it("9. no WebAssembly/generated JS glue/Rust reference of any kind, and no new import()/require() anywhere in the Loader source", () => {
    const codeOnly = codeOnlyLines(wasmLoaderSource);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
    // Stage 889's Import Plan legitimately names a future
    // "WebAssemblyPlanning" gate without implementing it, so this
    // checks for real API usage (a dot after the identifier), not the
    // bare word.
    expect(codeOnly).not.toMatch(/WebAssembly\./);
    expect(codeOnly).not.toMatch(/instantiateStreaming/);
    expect(codeOnly).not.toMatch(/initSync/);
    expect(codeOnly).not.toMatch(/__wbg_init/);
    expect(codeOnly).not.toMatch(/\bfetch\s*\(/);
    expect(codeOnly).not.toMatch(/import\s*\(/);
    expect(codeOnly).not.toMatch(/require\s*\(/);
    expect(codeOnly).not.toMatch(/create_runtime|AppRuntime/);
    expect(codeOnly).not.toMatch(/worker\.ts|src\/worker/);
    // Still only imports the pre-existing Loader Plan -- no new static import added.
    expect(codeOnly).not.toMatch(/fedos_wasm_loader_contract|fedos_wasm_artifact|fedos_wasm_boundary/);
  });

  it("10. WebAssembly.instantiate/compile are never actually invoked, even when exercising the full surface including policy()", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      const loader = createFedosWasmLoader();
      loader.policy();
      loader.planningState();
      loader.status();
      loader.planLoad();
      loaderPolicyAllowed();
      loaderPolicyDecision();
      loaderPolicyReason();
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

  it("11. no fetch call happens when exercising the full surface", async () => {
    const spy = vi.fn(() => Promise.resolve({ ok: true } as Response));
    const original = globalThis.fetch;
    (globalThis as { fetch?: unknown }).fetch = spy;
    try {
      const loader = createFedosWasmLoader();
      loader.policy();
      loader.planLoad();
      createWasmBackend();
      createRuntime().initializeCrypto();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("12. no Rust reference: Rust public API is unchanged (27 pub fn, none #[wasm_bindgen]-annotated)", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(27);
    expect(libRsSource).not.toMatch(/#\[wasm_bindgen\]/);
  });

  it("13. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
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

  it("14. Allowed is still unreachable anywhere in the new reader", () => {
    const loader = createFedosWasmLoader();
    expect(loader.policy().allowed).toBe(false);
    expect(loader.policy().decision).not.toBe("Allowed");
    expect(loaderPolicyAllowed()).toBe(false);
    expect(loaderPolicyDecision()).not.toBe("Allowed");
  });
});
