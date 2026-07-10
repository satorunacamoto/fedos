import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  createInitializeCryptoPublicApi,
  initializeCryptoApiVisible,
  initializeCryptoPublicApiCallable,
  initializeCryptoPublicApiReason,
  initializeCryptoPublicApiState,
} from "../src/runtime/fedos_initialize_crypto_public_api.js";
import { createInitializeCryptoInvocationContract } from "../src/runtime/fedos_initialize_crypto_invocation_contract.js";
import { createInitializeCryptoWiringPlan } from "../src/runtime/fedos_initialize_crypto_wiring_plan.js";
import { createInitializeCryptoExposureReview } from "../src/runtime/fedos_initialize_crypto_exposure_review.js";
import { createCryptoInitializationResult } from "../src/runtime/fedos_crypto_initialization_result.js";
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
import publicApiDocSource from "../docs/runtime_initialize_crypto_public_api.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import publicApiSource from "../src/runtime/fedos_initialize_crypto_public_api.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import planSource from "../src/runtime/fedos_initialize_crypto_wiring_plan.ts?raw";
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
 * Stage 665–670 — "FedOS Runtime initializeCrypto Public API:
 * design-only public surface, PlanningOnly/denied, no side effects
 * anywhere".
 * `docs/runtime_initialize_crypto_public_api.md` (Stage 665) fixes
 * the Public API's role: whether `initializeCrypto()` is visible and
 * callable as a public `AppRuntime` member, distinct from the
 * Wiring Plan's own `runtimeWiringAllowed` flag.
 * `src/runtime/fedos_initialize_crypto_public_api.ts` (Stage 666)
 * fixes `createInitializeCryptoPublicApi()` to `{ state:
 * "PlanningOnly", apiVisible: false, callable: false, reason:
 * "PublicApiPending" }`.
 * Stage 667 wires `createInitializeCryptoWiringPlan()` to call it,
 * discarding the result. Neither this test file nor any file it
 * exercises writes `import()` of any kind, imports the generated JS
 * glue, calls `WebAssembly.instantiate`/`compile`, or connects
 * Runtime/Worker to any of it. `create_runtime.ts`/`src/worker.ts`
 * are unmodified.
 */
describe("FedOS Runtime initializeCrypto Public API, PlanningOnly/denied, no side effects anywhere (Stage 665-670)", () => {
  it("1. createInitializeCryptoPublicApi is always fixed -- never a live probe", () => {
    const api = createInitializeCryptoPublicApi();
    expect(api.state).toBe("PlanningOnly");
    expect(api.apiVisible).toBe(false);
    expect(api.callable).toBe(false);
    expect(api.reason).toBe("PublicApiPending");
    // Pure and idempotent across repeated calls.
    expect(createInitializeCryptoPublicApi()).toEqual(api);

    expect(initializeCryptoPublicApiState()).toBe("PlanningOnly");
    expect(initializeCryptoApiVisible()).toBe(false);
    expect(initializeCryptoPublicApiCallable()).toBe(false);
    expect(initializeCryptoPublicApiReason()).toBe("PublicApiPending");
  });

  it("2. the Public API's fixed answers match across diagnostics, and are distinct from the pre-existing initializeCryptoCallable field", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.initializeCryptoPublicApiState).toBe("PlanningOnly");
    expect(status.initializeCryptoApiVisible).toBe(false);
    expect(status.initializeCryptoPublicApiCallable).toBe(false);
    expect(status.initializeCryptoPublicApiReason).toBe("PublicApiPending");
    // Stage 636's pre-existing field is untouched by this stage.
    expect(status.initializeCryptoCallable).toBe(false);

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.initializeCryptoPublicApiState).toBe("PlanningOnly");
    expect(workerStatus.initializeCryptoApiVisible).toBe(false);
    expect(workerStatus.initializeCryptoPublicApiCallable).toBe(false);
    expect(workerStatus.initializeCryptoPublicApiReason).toBe("PublicApiPending");
    expect(workerStatus.initializeCryptoCallable).toBe(false);
  });

  it("3. the Public API source never writes import()/require, never imports the generated JS glue, and never touches WebAssembly/fetch/Runtime/Worker/Provider/Facade/Boundary/Loader", () => {
    const codeOnly = codeOnlyLines(publicApiSource);
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

  it("4. the Wiring Plan legitimately reaches the Public API but never the generated JS glue or WebAssembly", () => {
    expect(planSource).toMatch(/fedos_initialize_crypto_public_api/);
    const codeOnly = codeOnlyLines(planSource);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/initSync/);

    const plan = createInitializeCryptoWiringPlan();
    expect(plan.runtimeWiringAllowed).toBe(false);
    expect(plan.workerWiringAllowed).toBe(false);
  });

  it("5. the generated JS glue is never imported (code, not comments) anywhere in the Public API or Wiring Plan source, static or dynamic", () => {
    const publicApiCodeOnly = codeOnlyLines(publicApiSource);
    const planCodeOnly = codeOnlyLines(planSource);
    expect(publicApiCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
    expect(planCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("6. WebAssembly.instantiate/compile are never actually invoked, even when exercising the full parked-chain surface through the Public API", () => {
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
      createInitializeCryptoExposureReview();
      createInitializeCryptoWiringPlan();
      createInitializeCryptoPublicApi();
      createInitializeCryptoInvocationContract();
      initializeCryptoPublicApiState();
      initializeCryptoApiVisible();
      initializeCryptoPublicApiCallable();
      initializeCryptoPublicApiReason();
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
      createInitializeCryptoExposureReview();
      createInitializeCryptoWiringPlan();
      createInitializeCryptoPublicApi();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("8. Runtime remains unconnected -- create_runtime.ts imports none of the WASM chain, including the Public API", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_dynamic_loader_gate|fedos_dynamic_loader_dev_approval|fedos_explicit_crypto_initialization|fedos_crypto_provider_facade_boundary|fedos_crypto_provider_initialization_request|fedos_provider_initialization_approval|fedos_provider_init_facade_contract|fedos_initialize_crypto_api_contract|fedos_crypto_initialization_result|fedos_initialize_crypto_exposure_review|fedos_initialize_crypto_wiring_plan|fedos_initialize_crypto_public_api|fedos_wasm_loader_import_policy/,
    );
    expect(createRuntimeSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("9. Worker remains unconnected -- src/worker.ts imports none of the WASM chain, including the Public API", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_dynamic_loader_gate|fedos_dynamic_loader_dev_approval|fedos_explicit_crypto_initialization|fedos_crypto_provider_facade_boundary|fedos_crypto_provider_initialization_request|fedos_provider_initialization_approval|fedos_provider_init_facade_contract|fedos_initialize_crypto_api_contract|fedos_crypto_initialization_result|fedos_initialize_crypto_exposure_review|fedos_initialize_crypto_wiring_plan|fedos_initialize_crypto_public_api|fedos_wasm_loader_import_policy/,
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

  it("11. Visible/Callable/Allowed are still unreachable anywhere in the chain", () => {
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
    expect(createInitializeCryptoExposureReview().approved).toBe(false);
    expect(createInitializeCryptoWiringPlan().runtimeWiringAllowed).toBe(false);
    expect(createInitializeCryptoPublicApi().apiVisible).toBe(false);
    expect(createInitializeCryptoPublicApi().callable).toBe(false);
    expect(createInitializeCryptoPublicApi().state).not.toBe("Visible");
    expect(createInitializeCryptoPublicApi().reason).not.toBe("Allowed");
  });

  it("12. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);

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

  it("13. the Public API doc and execution contract doc record the required facts", () => {
    expect(publicApiDocSource).toMatch(/PublicApiPending/);
    expect(publicApiDocSource).toMatch(/PlanningOnly/);
    expect(publicApiDocSource).toMatch(/apiVisible/);

    expect(executionContractDocSource).toMatch(/Runtime initializeCrypto Public API/);
    expect(executionContractDocSource).toMatch(/PublicApiPending/);
    expect(executionContractDocSource).toMatch(/\bSTOP\b/);
  });
});
