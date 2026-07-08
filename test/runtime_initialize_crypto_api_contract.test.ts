import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  createInitializeCryptoApiContract,
  initializeCryptoApiState,
  initializeCryptoCallable,
  initializeCryptoInitialized,
  initializeCryptoReason,
} from "../src/runtime/fedos_initialize_crypto_api_contract.js";
import { createProviderInitFacadeContract } from "../src/runtime/fedos_provider_init_facade_contract.js";
import { createProviderInitializationApproval } from "../src/runtime/fedos_provider_initialization_approval.js";
import { createCryptoProviderInitializationRequest } from "../src/runtime/fedos_crypto_provider_initialization_request.js";
import { createCryptoProviderFacadeBoundary } from "../src/runtime/fedos_crypto_provider_facade_boundary.js";
import { createCryptoLoaderFacade, initializeCrypto } from "../src/runtime/fedos_crypto_loader_facade.js";
import { createExplicitCryptoInitialization } from "../src/runtime/fedos_explicit_crypto_initialization.js";
import { createDynamicLoaderDevApproval } from "../src/runtime/fedos_dynamic_loader_dev_approval.js";
import { createDynamicLoaderGate } from "../src/runtime/fedos_dynamic_loader_gate.js";
import { evaluateWasmLoaderImportPolicy } from "../src/runtime/fedos_wasm_loader_import_policy.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import apiContractDocSource from "../docs/runtime_initialize_crypto_api_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import apiContractSource from "../src/runtime/fedos_initialize_crypto_api_contract.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import contractSource from "../src/runtime/fedos_provider_init_facade_contract.ts?raw";
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
 * Stage 633–638 — "FedOS initializeCrypto API Contract: design-only
 * callability layer, PlanningOnly/denied, no side effects anywhere".
 * `docs/runtime_initialize_crypto_api_contract.md` (Stage 633) fixes
 * the API Contract's role, one level deeper than the Provider Init
 * Facade Contract's own `contractReady` flag.
 * `src/runtime/fedos_initialize_crypto_api_contract.ts` (Stage 634)
 * fixes `createInitializeCryptoApiContract()` to `{ state:
 * "PlanningOnly", callable: false, initialized: false, reason:
 * "InitializeCryptoApiPending" }`.
 * Stage 635 wires `createProviderInitFacadeContract()` to call it,
 * discarding the result. Neither this test file nor any file it
 * exercises writes `import()` of any kind, imports the generated JS
 * glue, calls `WebAssembly.instantiate`/`compile`, or connects
 * Runtime/Worker to any of it.
 */
describe("FedOS initializeCrypto API Contract, PlanningOnly/denied, no side effects anywhere (Stage 633-638)", () => {
  it("1. createInitializeCryptoApiContract is always fixed -- never a live probe", () => {
    const contract = createInitializeCryptoApiContract();
    expect(contract.state).toBe("PlanningOnly");
    expect(contract.callable).toBe(false);
    expect(contract.initialized).toBe(false);
    expect(contract.reason).toBe("InitializeCryptoApiPending");
    // Pure and idempotent across repeated calls.
    expect(createInitializeCryptoApiContract()).toEqual(contract);

    expect(initializeCryptoApiState()).toBe("PlanningOnly");
    expect(initializeCryptoCallable()).toBe(false);
    expect(initializeCryptoInitialized()).toBe(false);
    expect(initializeCryptoReason()).toBe("InitializeCryptoApiPending");
  });

  it("2. the API Contract's fixed answers match across diagnostics", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.initializeCryptoApiState).toBe("PlanningOnly");
    expect(status.initializeCryptoCallable).toBe(false);
    expect(status.initializeCryptoInitialized).toBe(false);
    expect(status.initializeCryptoReason).toBe("InitializeCryptoApiPending");

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.initializeCryptoApiState).toBe("PlanningOnly");
    expect(workerStatus.initializeCryptoCallable).toBe(false);
    expect(workerStatus.initializeCryptoInitialized).toBe(false);
    expect(workerStatus.initializeCryptoReason).toBe("InitializeCryptoApiPending");
  });

  it("3. the API Contract source never writes import()/require, never imports the generated JS glue, and never touches WebAssembly/fetch/Runtime/Worker/Provider/Facade/Boundary/Loader", () => {
    const codeOnly = codeOnlyLines(apiContractSource);
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
    expect(codeOnly).not.toMatch(/fedos_crypto_loader_facade/);
    expect(codeOnly).not.toMatch(/fedos_crypto_provider_facade_boundary/);
    expect(codeOnly).not.toMatch(/fedos_wasm_loader/);
  });

  it("4. the Provider Init Facade Contract legitimately reaches the API Contract but never the generated JS glue or WebAssembly", () => {
    expect(contractSource).toMatch(/fedos_initialize_crypto_api_contract/);
    const codeOnly = codeOnlyLines(contractSource);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/initSync/);

    const facadeContract = createProviderInitFacadeContract();
    expect(facadeContract.contractReady).toBe(false);
  });

  it("5. the generated JS glue is never imported (code, not comments) anywhere in the API Contract or Provider Init Facade Contract source, static or dynamic", () => {
    const apiContractCodeOnly = codeOnlyLines(apiContractSource);
    const contractCodeOnly = codeOnlyLines(contractSource);
    expect(apiContractCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
    expect(contractCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("6. WebAssembly.instantiate/compile are never actually invoked, even when exercising the full parked-chain surface through the API Contract", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      evaluateWasmLoaderImportPolicy();
      createDynamicLoaderGate();
      createDynamicLoaderDevApproval();
      createExplicitCryptoInitialization();
      createCryptoLoaderFacade();
      initializeCrypto();
      createCryptoProviderFacadeBoundary();
      createCryptoProviderInitializationRequest();
      createProviderInitializationApproval();
      createProviderInitFacadeContract();
      createInitializeCryptoApiContract();
      initializeCryptoApiState();
      initializeCryptoCallable();
      initializeCryptoInitialized();
      initializeCryptoReason();
    } finally {
      instantiate.mockRestore();
      compile.mockRestore();
    }
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
  });

  it("7. no fetch call happens when exercising the full surface", async () => {
    const spy = vi.fn(() => Promise.resolve({ ok: true } as Response));
    const original = globalThis.fetch;
    (globalThis as { fetch?: unknown }).fetch = spy;
    try {
      evaluateWasmLoaderImportPolicy();
      createDynamicLoaderGate();
      createDynamicLoaderDevApproval();
      createExplicitCryptoInitialization();
      createCryptoLoaderFacade();
      createCryptoProviderFacadeBoundary();
      createCryptoProviderInitializationRequest();
      createProviderInitializationApproval();
      createProviderInitFacadeContract();
      createInitializeCryptoApiContract();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("8. Runtime remains unconnected -- create_runtime.ts imports none of the WASM chain, including the API Contract", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_dynamic_loader_gate|fedos_dynamic_loader_dev_approval|fedos_explicit_crypto_initialization|fedos_crypto_loader_facade|fedos_crypto_provider_facade_boundary|fedos_crypto_provider_initialization_request|fedos_provider_initialization_approval|fedos_provider_init_facade_contract|fedos_initialize_crypto_api_contract|fedos_wasm_loader_import_policy/,
    );
    expect(createRuntimeSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("9. Worker remains unconnected -- src/worker.ts imports none of the WASM chain, including the API Contract", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_dynamic_loader_gate|fedos_dynamic_loader_dev_approval|fedos_explicit_crypto_initialization|fedos_crypto_loader_facade|fedos_crypto_provider_facade_boundary|fedos_crypto_provider_initialization_request|fedos_provider_initialization_approval|fedos_provider_init_facade_contract|fedos_initialize_crypto_api_contract|fedos_wasm_loader_import_policy/,
    );
    expect(workerSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("10. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.state).toBe("Unsupported");
    expect(encrypted.allowed).toBe(false);
    const decrypted = await provider.decrypt({});
    expect(decrypted.state).toBe("Unsupported");
    expect(decrypted.allowed).toBe(false);
  });

  it("11. Callable/Initialized/Allowed are still unreachable anywhere in the chain", () => {
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
    expect(createCryptoLoaderFacade().initialized).toBe(false);
    expect(createCryptoProviderFacadeBoundary().providerConnected).toBe(false);
    expect(createCryptoProviderInitializationRequest().allowed).toBe(false);
    expect(createProviderInitializationApproval().approved).toBe(false);
    expect(createProviderInitFacadeContract().contractReady).toBe(false);
    expect(createInitializeCryptoApiContract().callable).toBe(false);
    expect(createInitializeCryptoApiContract().initialized).toBe(false);
    expect(createInitializeCryptoApiContract().state).not.toBe("Callable");
    expect(createInitializeCryptoApiContract().reason).not.toBe("Allowed");
  });

  it("12. Rust public API is unchanged (27 pub fn, none #[wasm_bindgen]-annotated) -- Cargo/package dependencies unchanged", () => {
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

  it("13. the API Contract doc and execution contract doc record the required facts", () => {
    expect(apiContractDocSource).toMatch(/InitializeCryptoApiPending/);
    expect(apiContractDocSource).toMatch(/PlanningOnly/);
    expect(apiContractDocSource).toMatch(/callable/);

    expect(executionContractDocSource).toMatch(/initializeCrypto API Contract/);
    expect(executionContractDocSource).toMatch(/InitializeCryptoApiPending/);
    expect(executionContractDocSource).toMatch(/\bSTOP\b/);
  });
});
