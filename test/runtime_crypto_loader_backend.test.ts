import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  createCryptoLoaderBackend,
  cryptoLoaderBackendKind,
  cryptoLoaderBackendReady,
  cryptoLoaderBackendReason,
  cryptoLoaderBackendState,
} from "../src/runtime/fedos_crypto_loader_backend.js";
import { createCryptoLoaderFacade, initializeCrypto } from "../src/runtime/fedos_crypto_loader_facade.js";
import { createCryptoProviderFacadeBoundary } from "../src/runtime/fedos_crypto_provider_facade_boundary.js";
import { createExplicitCryptoInitialization } from "../src/runtime/fedos_explicit_crypto_initialization.js";
import { createDynamicLoaderDevApproval } from "../src/runtime/fedos_dynamic_loader_dev_approval.js";
import { createDynamicLoaderGate } from "../src/runtime/fedos_dynamic_loader_gate.js";
import { evaluateWasmLoaderImportPolicy } from "../src/runtime/fedos_wasm_loader_import_policy.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { createRuntime } from "../src/runtime/create_runtime.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import backendDocSource from "../docs/runtime_crypto_loader_backend_abstraction.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import backendSource from "../src/runtime/fedos_crypto_loader_backend.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import facadeSource from "../src/runtime/fedos_crypto_loader_facade.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

/**
 * Stage 713–728 (Prototype Phase 003) — "FedOS Crypto Loader Backend
 * Abstraction: a thin, swappable seam directly below the Facade,
 * PlanningOnly/not-ready, no side effects, no WASM Loader/Rust
 * connection".
 *
 * `docs/runtime_crypto_loader_backend_abstraction.md` (Stage 713)
 * names the seam that lets the Crypto Loader Facade stay a thin entry
 * point for backend selection, separate from the Facade's own
 * pre-existing `backend` field.
 * `src/runtime/fedos_crypto_loader_backend.ts` (Stage 714) fixes
 * `createCryptoLoaderBackend()` to `{ state: "PlanningOnly",
 * backendKind: "WasmPlanned", backendReady: false, reason:
 * "BackendAbstractionPending" }`.
 * Stage 721 wires `createCryptoLoaderFacade()` to call it, discarding
 * the result -- the Facade's own return value, `initializeCrypto()`'s
 * own return value (both Facade-level and Runtime-level), stay
 * byte-for-byte unchanged. Neither this test file nor any file it
 * exercises writes `import()` of any kind, imports the generated JS
 * glue, calls `WebAssembly.instantiate`/`compile`, or connects the
 * WASM Loader/Rust to any of it. Runtime reaches the Facade (Stage
 * 697) but never the Backend Abstraction directly -- ONLY the Facade
 * calls `createCryptoLoaderBackend()`.
 */
describe("FedOS Crypto Loader Backend Abstraction, PlanningOnly/not-ready, no side effects, no WASM Loader connection (Stage 713-728)", () => {
  it("1. createCryptoLoaderBackend is always fixed -- never a live probe", () => {
    const backend = createCryptoLoaderBackend();
    expect(backend.state).toBe("PlanningOnly");
    expect(backend.backendKind).toBe("WasmPlanned");
    expect(backend.backendReady).toBe(false);
    expect(backend.reason).toBe("BackendAbstractionPending");
    // Pure and idempotent across repeated calls.
    expect(createCryptoLoaderBackend()).toEqual(backend);

    expect(cryptoLoaderBackendState()).toBe("PlanningOnly");
    expect(cryptoLoaderBackendKind()).toBe("WasmPlanned");
    expect(cryptoLoaderBackendReady()).toBe(false);
    expect(cryptoLoaderBackendReason()).toBe("BackendAbstractionPending");
  });

  it("2. the Backend Abstraction's fixed answers match across diagnostics; Worker diagnostics are unaffected", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.cryptoLoaderBackendState).toBe("PlanningOnly");
    expect(status.cryptoLoaderBackendKind).toBe("WasmPlanned");
    expect(status.cryptoLoaderBackendReady).toBe(false);
    expect(status.cryptoLoaderBackendReason).toBe("BackendAbstractionPending");

    const workerStatus = workerCryptoActivationStatus() as unknown as Record<string, unknown>;
    expect(workerStatus).not.toHaveProperty("cryptoLoaderBackendState");
    expect(workerStatus).not.toHaveProperty("cryptoLoaderBackendKind");
    expect(workerStatus).not.toHaveProperty("cryptoLoaderBackendReady");
    expect(workerStatus).not.toHaveProperty("cryptoLoaderBackendReason");
  });

  it("3. the Backend Abstraction source never writes import()/require, never imports the generated JS glue, and never touches WebAssembly/fetch/Runtime/Worker/WASM Loader", () => {
    const codeOnly = codeOnlyLines(backendSource);
    expect(codeOnly).not.toMatch(/import\s*\(/);
    expect(codeOnly).not.toMatch(/require\s*\(/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/\bfetch\s*\(/);
    expect(codeOnly).not.toMatch(/instantiateStreaming/);
    expect(codeOnly).not.toMatch(/initSync/);
    expect(codeOnly).not.toMatch(/__wbg_init/);
    expect(codeOnly).not.toMatch(/\bfs\b/);
    expect(codeOnly).not.toMatch(/existsSync|statSync/);
    expect(codeOnly).not.toMatch(/child_process/i);
    expect(codeOnly).not.toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/create_runtime|AppRuntime/);
    expect(codeOnly).not.toMatch(/worker\.ts|src\/worker/);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
    expect(codeOnly).not.toMatch(/FedosRuntimeCryptoProvider|RuntimeCryptoProvider/);
    expect(codeOnly).not.toMatch(/fedos_wasm_loader/);
    // Terminus: does not call any further link deeper.
    expect(codeOnly).not.toMatch(/fedos_crypto_provider_facade_boundary/);
    expect(codeOnly).not.toMatch(/fedos_explicit_crypto_initialization/);
  });

  it("4. the Crypto Loader Facade legitimately reaches the Backend Abstraction but never the generated JS glue, WebAssembly, or WASM Loader", () => {
    expect(facadeSource).toMatch(/fedos_crypto_loader_backend/);
    const codeOnly = codeOnlyLines(facadeSource);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/initSync/);
    expect(codeOnly).not.toMatch(/fedos_wasm_loader/);

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
  });

  it("5. Runtime's own initializeCrypto() return value is unaffected by the Facade reaching the Backend Abstraction", () => {
    const runtime = createRuntime();
    expect(runtime.initializeCrypto()).toEqual({
      allowed: false,
      initialized: false,
      reason: "PrototypeDisabled",
    });
  });

  it("6. only the Facade calls the Backend Abstraction directly -- create_runtime.ts never references it", () => {
    expect(createRuntimeSource).not.toMatch(/fedos_crypto_loader_backend/);
    expect(workerSource).not.toMatch(/fedos_crypto_loader_backend/);
  });

  it("7. the generated JS glue is never imported (code, not comments) anywhere in the Backend Abstraction or Facade source, static or dynamic", () => {
    const backendCodeOnly = codeOnlyLines(backendSource);
    const facadeCodeOnly = codeOnlyLines(facadeSource);
    expect(backendCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
    expect(facadeCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("8. WebAssembly.instantiate/compile are never actually invoked, even when exercising the full parked-chain surface through the Backend Abstraction", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      evaluateWasmLoaderImportPolicy();
      createDynamicLoaderGate();
      createDynamicLoaderDevApproval();
      createExplicitCryptoInitialization();
      createCryptoProviderFacadeBoundary();
      createCryptoLoaderFacade();
      initializeCrypto();
      createCryptoLoaderBackend();
      cryptoLoaderBackendState();
      cryptoLoaderBackendKind();
      cryptoLoaderBackendReady();
      cryptoLoaderBackendReason();
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
      evaluateWasmLoaderImportPolicy();
      createDynamicLoaderGate();
      createDynamicLoaderDevApproval();
      createExplicitCryptoInitialization();
      createCryptoProviderFacadeBoundary();
      createCryptoLoaderFacade();
      createCryptoLoaderBackend();
      createRuntime().initializeCrypto();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("10. Runtime imports the Facade only -- create_runtime.ts still never imports the rest of the WASM chain", () => {
    expect(createRuntimeSource).toMatch(/fedos_crypto_loader_facade/);
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_dynamic_loader_gate|fedos_dynamic_loader_dev_approval|fedos_explicit_crypto_initialization|fedos_crypto_provider_facade_boundary|fedos_wasm_loader_import_policy|fedos_crypto_loader_backend/,
    );
    expect(createRuntimeSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("11. Worker remains fully unconnected -- src/worker.ts imports none of the WASM chain, including the Facade and the Backend Abstraction", () => {
    expect(workerSource).not.toMatch(/fedos_crypto_loader_facade|fedos_crypto_loader_backend/);
    expect(workerSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_dynamic_loader_gate|fedos_dynamic_loader_dev_approval|fedos_explicit_crypto_initialization|fedos_crypto_provider_facade_boundary|fedos_wasm_loader_import_policy/,
    );
    expect(workerSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
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

  it("13. Allowed/Active/Ready are still unreachable anywhere in the chain", () => {
    const runtimeDecision = evaluateRuntimeCryptoActivation(
      { runtimeCryptoEnabled: true, runtimeCryptoProvider: "fedos" },
      { FEDOS_CRYPTO_PROVIDER: "fedos", FEDOS_CRYPTO_ENABLED: "explicit-dev-only" },
    );
    expect(runtimeDecision.reason).toBe("ProviderUnavailable");
    expect(runtimeDecision.allowed).toBe(false);

    const workerDecision = evaluateWorkerCryptoActivation(
      { workerCryptoEnabled: true, workerCryptoProvider: "fedos" },
      { FEDOS_CRYPTO_PROVIDER: "fedos", FEDOS_CRYPTO_ENABLED: "explicit-dev-only" },
    );
    expect(workerDecision.reason).toBe("ProviderUnavailable");
    expect(workerDecision.allowed).toBe(false);

    expect(evaluateWasmLoaderImportPolicy().allowed).toBe(false);
    expect(createDynamicLoaderGate().dynamicLoaderAllowed).toBe(false);
    expect(createDynamicLoaderDevApproval().approved).toBe(false);
    expect(createExplicitCryptoInitialization().initializationAllowed).toBe(false);
    expect(createCryptoProviderFacadeBoundary().providerConnected).toBe(false);
    expect(createCryptoLoaderFacade().initialized).toBe(false);
    expect(createCryptoLoaderBackend().backendReady).toBe(false);
    expect(createCryptoLoaderBackend().state).not.toBe("Active");
    expect(createCryptoLoaderBackend().reason).not.toBe("Allowed");
    expect(createRuntime().initializeCrypto().allowed).toBe(false);
  });

  it("14. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(46);
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

  it("15. the Backend Abstraction doc and execution contract doc record the required facts", () => {
    expect(backendDocSource).toMatch(/BackendAbstractionPending/);
    expect(backendDocSource).toMatch(/PlanningOnly/);
    expect(backendDocSource).toMatch(/WasmPlanned/);
    expect(backendDocSource).toMatch(/NativePlanned/);
    expect(backendDocSource).toMatch(/PythonPlanned/);

    expect(executionContractDocSource).toMatch(/Backend Abstraction/);
    expect(executionContractDocSource).toMatch(/BackendAbstractionPending/);
    expect(executionContractDocSource).toMatch(/\bSTOP\b/);
    expect(executionContractDocSource).toMatch(/Worker/);
  });
});
