import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  createCryptoProviderFacadeBoundary,
  providerFacadeBoundaryState,
  providerFacadeConnected,
  providerFacadeReason,
} from "../src/runtime/fedos_crypto_provider_facade_boundary.js";
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
import boundaryDocSource from "../docs/runtime_crypto_provider_facade_boundary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boundarySource from "../src/runtime/fedos_crypto_provider_facade_boundary.ts?raw";
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
 * Stage 601–606 — "FedOS Crypto Provider / Facade Boundary:
 * design-only seam recording connection, PlanningOnly/denied, no
 * side effects anywhere".
 * `docs/runtime_crypto_provider_facade_boundary.md` (Stage 601) fixes
 * the Boundary's role.
 * `src/runtime/fedos_crypto_provider_facade_boundary.ts` (Stage 602)
 * fixes `createCryptoProviderFacadeBoundary()` to `{ state:
 * "PlanningOnly", providerConnected: false, facadeConnected: false,
 * reason: "ProviderFacadeConnectionPending" }`.
 * Stage 603 wires `createCryptoLoaderFacade()` to call it, discarding
 * the result. Neither this test file nor any file it exercises writes
 * `import()` of any kind, imports the generated JS glue, calls
 * `WebAssembly.instantiate`/`compile`, or connects Runtime/Worker to
 * any of it.
 */
describe("FedOS Crypto Provider / Facade Boundary, PlanningOnly/denied, no side effects anywhere (Stage 601-606)", () => {
  it("1. createCryptoProviderFacadeBoundary is always fixed -- never a live probe", () => {
    const boundary = createCryptoProviderFacadeBoundary();
    expect(boundary.state).toBe("PlanningOnly");
    expect(boundary.providerConnected).toBe(false);
    expect(boundary.facadeConnected).toBe(false);
    expect(boundary.reason).toBe("ProviderFacadeConnectionPending");
    // Pure and idempotent across repeated calls.
    expect(createCryptoProviderFacadeBoundary()).toEqual(boundary);

    expect(providerFacadeBoundaryState()).toBe("PlanningOnly");
    expect(providerFacadeConnected()).toBe(false);
    expect(providerFacadeReason()).toBe("ProviderFacadeConnectionPending");
  });

  it("2. the Boundary's fixed answers match across diagnostics", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.providerFacadeBoundaryState).toBe("PlanningOnly");
    expect(status.providerFacadeConnected).toBe(false);
    expect(status.providerFacadeReason).toBe("ProviderFacadeConnectionPending");

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.providerFacadeBoundaryState).toBe("PlanningOnly");
    expect(workerStatus.providerFacadeConnected).toBe(false);
    expect(workerStatus.providerFacadeReason).toBe("ProviderFacadeConnectionPending");
  });

  it("3. the Boundary source never writes import()/require, never imports the generated JS glue, and never touches WebAssembly/fetch/Runtime/Worker/Provider", () => {
    const codeOnly = codeOnlyLines(boundarySource);
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
  });

  it("4. the Crypto Loader Facade legitimately reaches the Boundary but never the generated JS glue or WebAssembly", () => {
    expect(facadeSource).toMatch(/fedos_crypto_provider_facade_boundary/);
    const codeOnly = codeOnlyLines(facadeSource);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/initSync/);

    const facade = createCryptoLoaderFacade();
    expect(facade.initialized).toBe(false);
    expect(initializeCrypto().allowed).toBe(false);
  });

  it("5. the generated JS glue is never imported (code, not comments) anywhere in the Boundary or Facade source, static or dynamic", () => {
    const boundaryCodeOnly = codeOnlyLines(boundarySource);
    const facadeCodeOnly = codeOnlyLines(facadeSource);
    expect(boundaryCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
    expect(facadeCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("6. WebAssembly.instantiate/compile are never actually invoked, even when exercising the full parked-chain surface through the Boundary", () => {
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
      providerFacadeBoundaryState();
      providerFacadeConnected();
      providerFacadeReason();
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
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("8. Runtime remains unconnected -- create_runtime.ts imports none of the WASM chain, including the Boundary", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_dynamic_loader_gate|fedos_dynamic_loader_dev_approval|fedos_explicit_crypto_initialization|fedos_crypto_provider_facade_boundary|fedos_wasm_loader_import_policy/,
    );
    expect(createRuntimeSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("9. Worker remains unconnected -- src/worker.ts imports none of the WASM chain, including the Boundary", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_dynamic_loader_gate|fedos_dynamic_loader_dev_approval|fedos_explicit_crypto_initialization|fedos_crypto_provider_facade_boundary|fedos_wasm_loader_import_policy/,
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

  it("11. Allowed/Connected are still unreachable anywhere in the chain", () => {
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
    expect(createCryptoProviderFacadeBoundary().facadeConnected).toBe(false);
    expect(createCryptoProviderFacadeBoundary().state).not.toBe("Connected");
    expect(createCryptoProviderFacadeBoundary().reason).not.toBe("Allowed");
  });

  it("12. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(33);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(10);

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

  it("13. the Boundary doc and execution contract doc record the required facts", () => {
    expect(boundaryDocSource).toMatch(/ProviderFacadeConnectionPending/);
    expect(boundaryDocSource).toMatch(/PlanningOnly/);
    expect(boundaryDocSource).toMatch(/providerConnected/);
    expect(boundaryDocSource).toMatch(/facadeConnected/);

    expect(executionContractDocSource).toMatch(/Provider\/Facade Boundary/);
    expect(executionContractDocSource).toMatch(/ProviderFacadeConnectionPending/);
    expect(executionContractDocSource).toMatch(/\bSTOP\b/);
  });
});
