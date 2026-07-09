import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  createCryptoLoaderFacade,
  cryptoLoaderFacadeBackend,
  cryptoLoaderFacadeInitialized,
  cryptoLoaderFacadeReason,
  cryptoLoaderFacadeState,
  initializeCrypto,
} from "../src/runtime/fedos_crypto_loader_facade.js";
import { createExplicitCryptoInitialization } from "../src/runtime/fedos_explicit_crypto_initialization.js";
import { createDynamicLoaderDevApproval } from "../src/runtime/fedos_dynamic_loader_dev_approval.js";
import { createDynamicLoaderGate } from "../src/runtime/fedos_dynamic_loader_gate.js";
import { evaluateWasmLoaderImportPolicy } from "../src/runtime/fedos_wasm_loader_import_policy.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import facadeDocSource from "../docs/runtime_crypto_loader_facade.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import facadeSource from "../src/runtime/fedos_crypto_loader_facade.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import explicitInitSource from "../src/runtime/fedos_explicit_crypto_initialization.ts?raw";
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
 * Stage 593–598 — "FedOS Crypto Loader Facade: design-only seam
 * between Provider and WASM Loader, PlanningOnly/denied, no side
 * effects anywhere".
 * `docs/runtime_crypto_loader_facade.md` (Stage 593) fixes the target
 * architecture and six responsibilities.
 * `src/runtime/fedos_crypto_loader_facade.ts` (Stage 594) fixes
 * `createCryptoLoaderFacade()` to `{ state: "PlanningOnly",
 * initialized: false, backend: "WasmPlanned", reason:
 * "FacadeInitializationPending" }` and `initializeCrypto()` to `{
 * allowed: false, reason: "FacadeInitializationPending" }`.
 * Stage 595 wires `createExplicitCryptoInitialization()` to call
 * `createCryptoLoaderFacade()`, discarding the result. Neither this
 * test file nor any file it exercises writes `import()` of any kind,
 * imports the generated JS glue, calls
 * `WebAssembly.instantiate`/`compile`, or connects Runtime/Worker to
 * any of it.
 */
describe("FedOS Crypto Loader Facade, PlanningOnly/denied, no side effects anywhere (Stage 593-598)", () => {
  it("1. createCryptoLoaderFacade/initializeCrypto are always fixed -- never a live probe", () => {
    const facade = createCryptoLoaderFacade();
    expect(facade.state).toBe("PlanningOnly");
    expect(facade.initialized).toBe(false);
    expect(facade.backend).toBe("WasmPlanned");
    expect(facade.reason).toBe("FacadeInitializationPending");
    // Pure and idempotent across repeated calls.
    expect(createCryptoLoaderFacade()).toEqual(facade);

    const decision = initializeCrypto();
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("FacadeInitializationPending");
    expect(initializeCrypto()).toEqual(decision);

    expect(cryptoLoaderFacadeState()).toBe("PlanningOnly");
    expect(cryptoLoaderFacadeBackend()).toBe("WasmPlanned");
    expect(cryptoLoaderFacadeInitialized()).toBe(false);
    expect(cryptoLoaderFacadeReason()).toBe("FacadeInitializationPending");
  });

  it("2. the Facade's fixed answers match across diagnostics", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.cryptoLoaderFacadeState).toBe("PlanningOnly");
    expect(status.cryptoLoaderFacadeBackend).toBe("WasmPlanned");
    expect(status.cryptoLoaderFacadeInitialized).toBe(false);
    expect(status.cryptoLoaderFacadeReason).toBe("FacadeInitializationPending");

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.cryptoLoaderFacadeState).toBe("PlanningOnly");
    expect(workerStatus.cryptoLoaderFacadeBackend).toBe("WasmPlanned");
    expect(workerStatus.cryptoLoaderFacadeInitialized).toBe(false);
    expect(workerStatus.cryptoLoaderFacadeReason).toBe("FacadeInitializationPending");
  });

  it("3. the Facade source never writes import()/require, never imports the generated JS glue, and never touches WebAssembly/fetch/Runtime/Worker/WASM Loader", () => {
    const codeOnly = codeOnlyLines(facadeSource);
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
    expect(codeOnly).not.toMatch(/fedos_wasm_loader/);
  });

  it("4. the explicit crypto initialization design legitimately reaches the Facade but never the generated JS glue or WebAssembly", () => {
    expect(explicitInitSource).toMatch(/fedos_crypto_loader_facade/);
    const codeOnly = codeOnlyLines(explicitInitSource);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/initSync/);

    const init = createExplicitCryptoInitialization();
    expect(init.initializationAllowed).toBe(false);

    const approval = createDynamicLoaderDevApproval();
    expect(approval.approved).toBe(false);

    const gate = createDynamicLoaderGate();
    expect(gate.dynamicLoaderAllowed).toBe(false);
  });

  it("5. the generated JS glue is never imported (code, not comments) anywhere in the Facade or explicit init source, static or dynamic", () => {
    const facadeCodeOnly = codeOnlyLines(facadeSource);
    const explicitInitCodeOnly = codeOnlyLines(explicitInitSource);
    expect(facadeCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
    expect(explicitInitCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("6. WebAssembly.instantiate/compile are never actually invoked, even when exercising the full plan/review/readiness/presence/activation/distribution/loader-strategy/gate/dev-approval/explicit-init/facade surface", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      evaluateWasmLoaderImportPolicy();
      createDynamicLoaderGate();
      createDynamicLoaderDevApproval();
      createExplicitCryptoInitialization();
      createCryptoLoaderFacade();
      initializeCrypto();
      cryptoLoaderFacadeState();
      cryptoLoaderFacadeBackend();
      cryptoLoaderFacadeInitialized();
      cryptoLoaderFacadeReason();
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
      initializeCrypto();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("8. Runtime deliberately reaches ONLY the Facade (Stage 697) -- create_runtime.ts imports none of the rest of the WASM chain", () => {
    // As of Stage 697 (Prototype Phase 002), create_runtime.ts legitimately
    // calls createCryptoLoaderFacade() -- see test/runtime_initialize_crypto_prototype_facade.test.ts.
    expect(createRuntimeSource).toMatch(/fedos_crypto_loader_facade/);
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_dynamic_loader_gate|fedos_dynamic_loader_dev_approval|fedos_explicit_crypto_initialization|fedos_wasm_loader_import_policy|fedos_crypto_provider_facade_boundary/,
    );
    expect(createRuntimeSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("9. Worker remains unconnected -- src/worker.ts imports none of the WASM chain, including the Facade", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_dynamic_loader_gate|fedos_dynamic_loader_dev_approval|fedos_explicit_crypto_initialization|fedos_wasm_loader_import_policy/,
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

  it("11. Allowed/Active/initialized are still unreachable anywhere in the chain", () => {
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
    expect(createCryptoLoaderFacade().state).not.toBe("Active");
    expect(createCryptoLoaderFacade().backend).not.toBe("WasmActive");
    expect(createCryptoLoaderFacade().reason).not.toBe("Allowed");
    expect(initializeCrypto().allowed).toBe(false);
    expect(initializeCrypto().reason).not.toBe("Allowed");
  });

  it("12. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(28);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(1);

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

  it("13. the Facade doc and execution contract doc record the required facts", () => {
    expect(facadeDocSource).toMatch(/FacadeInitializationPending/);
    expect(facadeDocSource).toMatch(/PlanningOnly/);
    expect(facadeDocSource).toMatch(/WasmPlanned/);

    expect(executionContractDocSource).toMatch(/Crypto Loader Facade/);
    expect(executionContractDocSource).toMatch(/FacadeInitializationPending/);
    expect(executionContractDocSource).toMatch(/\bSTOP\b/);
  });
});
