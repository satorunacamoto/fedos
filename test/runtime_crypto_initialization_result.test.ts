import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  createCryptoInitializationResult,
  cryptoInitializationBackend,
  cryptoInitializationResultReason,
  cryptoInitializationResultState,
  cryptoInitializationSuccess,
} from "../src/runtime/fedos_crypto_initialization_result.js";
import { createInitializeCryptoApiContract } from "../src/runtime/fedos_initialize_crypto_api_contract.js";
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
import resultDocSource from "../docs/runtime_crypto_initialization_result.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import resultSource from "../src/runtime/fedos_crypto_initialization_result.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import apiContractSource from "../src/runtime/fedos_initialize_crypto_api_contract.ts?raw";
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
 * Stage 641–646 — "FedOS Crypto Initialization Result Contract:
 * design-only completion report, terminus of the Provider-side
 * Planning arc, PlanningOnly/denied, no side effects anywhere".
 * `docs/runtime_crypto_initialization_result.md` (Stage 641) fixes
 * the Result Contract's role, one level deeper than the API
 * Contract's own `initialized` flag.
 * `src/runtime/fedos_crypto_initialization_result.ts` (Stage 642)
 * fixes `createCryptoInitializationResult()` to `{ state:
 * "PlanningOnly", success: false, backend: "None", reason:
 * "InitializationResultPending" }`.
 * Stage 643 wires `createInitializeCryptoApiContract()` to call it,
 * discarding the result. Neither this test file nor any file it
 * exercises writes `import()` of any kind, imports the generated JS
 * glue, calls `WebAssembly.instantiate`/`compile`, or connects
 * Runtime/Worker to any of it.
 */
describe("FedOS Crypto Initialization Result Contract, PlanningOnly/denied, no side effects anywhere (Stage 641-646)", () => {
  it("1. createCryptoInitializationResult is always fixed -- never a live probe", () => {
    const result = createCryptoInitializationResult();
    expect(result.state).toBe("PlanningOnly");
    expect(result.success).toBe(false);
    expect(result.backend).toBe("None");
    expect(result.reason).toBe("InitializationResultPending");
    // Pure and idempotent across repeated calls.
    expect(createCryptoInitializationResult()).toEqual(result);

    expect(cryptoInitializationResultState()).toBe("PlanningOnly");
    expect(cryptoInitializationSuccess()).toBe(false);
    expect(cryptoInitializationBackend()).toBe("None");
    expect(cryptoInitializationResultReason()).toBe("InitializationResultPending");
  });

  it("2. the Result Contract's fixed answers match across diagnostics", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.cryptoInitializationResultState).toBe("PlanningOnly");
    expect(status.cryptoInitializationSuccess).toBe(false);
    expect(status.cryptoInitializationBackend).toBe("None");
    expect(status.cryptoInitializationResultReason).toBe("InitializationResultPending");

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.cryptoInitializationResultState).toBe("PlanningOnly");
    expect(workerStatus.cryptoInitializationSuccess).toBe(false);
    expect(workerStatus.cryptoInitializationBackend).toBe("None");
    expect(workerStatus.cryptoInitializationResultReason).toBe("InitializationResultPending");
  });

  it("3. the Result Contract source never writes import()/require, never imports the generated JS glue, and never touches WebAssembly/fetch/Runtime/Worker/Provider/Facade/Boundary/Loader", () => {
    const codeOnly = codeOnlyLines(resultSource);
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

  it("4. the initializeCrypto API Contract legitimately reaches the Result Contract but never the generated JS glue or WebAssembly", () => {
    expect(apiContractSource).toMatch(/fedos_crypto_initialization_result/);
    const codeOnly = codeOnlyLines(apiContractSource);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/initSync/);

    const apiContract = createInitializeCryptoApiContract();
    expect(apiContract.callable).toBe(false);
    expect(apiContract.initialized).toBe(false);
  });

  it("5. the generated JS glue is never imported (code, not comments) anywhere in the Result Contract or API Contract source, static or dynamic", () => {
    const resultCodeOnly = codeOnlyLines(resultSource);
    const apiContractCodeOnly = codeOnlyLines(apiContractSource);
    expect(resultCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
    expect(apiContractCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("6. WebAssembly.instantiate/compile are never actually invoked, even when exercising the full parked-chain surface through the Result Contract", () => {
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
      createCryptoInitializationResult();
      cryptoInitializationResultState();
      cryptoInitializationSuccess();
      cryptoInitializationBackend();
      cryptoInitializationResultReason();
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
      createCryptoInitializationResult();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("8. Runtime remains unconnected -- create_runtime.ts imports none of the WASM chain, including the Result Contract", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_dynamic_loader_gate|fedos_dynamic_loader_dev_approval|fedos_explicit_crypto_initialization|fedos_crypto_provider_facade_boundary|fedos_crypto_provider_initialization_request|fedos_provider_initialization_approval|fedos_provider_init_facade_contract|fedos_initialize_crypto_api_contract|fedos_crypto_initialization_result|fedos_wasm_loader_import_policy/,
    );
    expect(createRuntimeSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("9. Worker remains unconnected -- src/worker.ts imports none of the WASM chain, including the Result Contract", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_dynamic_loader_gate|fedos_dynamic_loader_dev_approval|fedos_explicit_crypto_initialization|fedos_crypto_provider_facade_boundary|fedos_crypto_provider_initialization_request|fedos_provider_initialization_approval|fedos_provider_init_facade_contract|fedos_initialize_crypto_api_contract|fedos_crypto_initialization_result|fedos_wasm_loader_import_policy/,
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

  it("11. Success/Completed/Wasm/Allowed are still unreachable anywhere in the chain", () => {
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
    expect(createCryptoInitializationResult().success).toBe(false);
    expect(createCryptoInitializationResult().backend).toBe("None");
    expect(createCryptoInitializationResult().state).not.toBe("Completed");
    expect(createCryptoInitializationResult().backend).not.toBe("Wasm");
    expect(createCryptoInitializationResult().reason).not.toBe("Allowed");
  });

  it("12. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(50);
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

  it("13. the Result Contract doc and execution contract doc record the required facts", () => {
    expect(resultDocSource).toMatch(/InitializationResultPending/);
    expect(resultDocSource).toMatch(/PlanningOnly/);
    expect(resultDocSource).toMatch(/success/);

    expect(executionContractDocSource).toMatch(/Crypto Initialization Result Contract/);
    expect(executionContractDocSource).toMatch(/InitializationResultPending/);
    expect(executionContractDocSource).toMatch(/\bSTOP\b/);
  });
});
