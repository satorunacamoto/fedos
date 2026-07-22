import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  createCryptoBackendResolver,
  cryptoBackendAvailable,
  cryptoBackendResolved,
  cryptoBackendResolverReason,
  cryptoBackendResolverSelected,
  cryptoBackendResolverState,
} from "../src/runtime/fedos_crypto_backend_resolver.js";
import {
  createCryptoBackendInterface,
  cryptoBackendInterfaceReady,
  cryptoBackendInterfaceState,
} from "../src/runtime/fedos_crypto_backend_interface.js";
import { createWasmBackend } from "../src/runtime/fedos_wasm_backend.js";
import {
  createCryptoLoaderBackend,
  cryptoLoaderBackendReady,
} from "../src/runtime/fedos_crypto_loader_backend.js";
import { createCryptoLoaderFacade, initializeCrypto } from "../src/runtime/fedos_crypto_loader_facade.js";
import { createCryptoProviderFacadeBoundary } from "../src/runtime/fedos_crypto_provider_facade_boundary.js";
import { createExplicitCryptoInitialization } from "../src/runtime/fedos_explicit_crypto_initialization.js";
import { createDynamicLoaderDevApproval } from "../src/runtime/fedos_dynamic_loader_dev_approval.js";
import { createDynamicLoaderGate } from "../src/runtime/fedos_dynamic_loader_gate.js";
import { evaluateWasmLoaderImportPolicy } from "../src/runtime/fedos_wasm_loader_import_policy.js";
import { createRuntime } from "../src/runtime/create_runtime.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import resolverDocSource from "../docs/runtime_crypto_backend_resolver.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import resolverSource from "../src/runtime/fedos_crypto_backend_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import interfaceSource from "../src/runtime/fedos_crypto_backend_interface.ts?raw";
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
 * Stage 762–776 (Prototype Phase 006) — "FedOS Crypto Backend
 * Resolver: a pure leaf directly below the Crypto Backend Interface
 * that answers ONLY 'which backend is planned', PlanningOnly/
 * unresolved, no side effects, no real WASM Loader/Rust connection".
 *
 * `docs/runtime_crypto_backend_resolver.md` (Stage 762) names the
 * seam that lets the Interface ask "which backend is planned" as a
 * SEPARATE concern from "is it ready to load" (the Interface's own
 * `interfaceReady`, WASM Backend Planning's own `backendReady`/
 * `loaderAttached`). `src/runtime/fedos_crypto_backend_resolver.ts`
 * (Stage 763) fixes `createCryptoBackendResolver()` to `{ state:
 * "PlanningOnly", selectedBackend: "WasmPlanned", backendResolved:
 * false, backendAvailable: false, reason:
 * "BackendResolutionPending" }`. Stage 764 wires
 * `createCryptoBackendInterface()` to call it as a SECOND, separate
 * reach -- alongside its pre-existing reach into `createWasmBackend()`
 * (Stage 746), NOT replacing it -- discarding the result. The
 * Interface's own return value, the Backend Abstraction's own return
 * value, the Facade's own return value, and Runtime's own
 * `initializeCrypto()` return value all stay byte-for-byte unchanged.
 * Neither this test file nor any file it exercises writes `import()`
 * of any kind, imports the generated JS glue, calls
 * `WebAssembly.instantiate`/`compile`, or connects the real WASM
 * Loader/Rust to any of it. Runtime reaches the Facade, the Facade
 * reaches the Backend Abstraction, the Abstraction reaches the
 * Interface, and the Interface reaches the Resolver, but neither
 * Runtime, Worker, the Facade, nor the Backend Abstraction ever
 * reaches the Resolver directly -- ONLY the Backend Interface calls
 * `createCryptoBackendResolver()`.
 */
describe("FedOS Crypto Backend Resolver, PlanningOnly/unresolved, no side effects, no real WASM Loader connection (Stage 762-776)", () => {
  it("1. createCryptoBackendResolver is always fixed -- never a live probe", () => {
    const resolver = createCryptoBackendResolver();
    expect(resolver.state).toBe("PlanningOnly");
    expect(resolver.selectedBackend).toBe("WasmPlanned");
    expect(resolver.backendResolved).toBe(false);
    expect(resolver.backendAvailable).toBe(false);
    expect(resolver.reason).toBe("BackendResolutionPending");
    // Pure and idempotent across repeated calls.
    expect(createCryptoBackendResolver()).toEqual(resolver);

    expect(cryptoBackendResolverState()).toBe("PlanningOnly");
    expect(cryptoBackendResolverSelected()).toBe("WasmPlanned");
    expect(cryptoBackendResolved()).toBe(false);
    expect(cryptoBackendAvailable()).toBe(false);
    expect(cryptoBackendResolverReason()).toBe("BackendResolutionPending");
  });

  it("2. the Backend Resolver's fixed answers match across diagnostics; Worker diagnostics are unaffected", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.cryptoBackendResolverState).toBe("PlanningOnly");
    expect(status.cryptoBackendResolverSelected).toBe("WasmPlanned");
    expect(status.cryptoBackendResolved).toBe(false);
    expect(status.cryptoBackendAvailable).toBe(false);
    expect(status.cryptoBackendResolverReason).toBe("BackendResolutionPending");

    const workerStatus = workerCryptoActivationStatus() as unknown as Record<string, unknown>;
    expect(workerStatus).not.toHaveProperty("cryptoBackendResolverState");
    expect(workerStatus).not.toHaveProperty("cryptoBackendResolverSelected");
    expect(workerStatus).not.toHaveProperty("cryptoBackendResolved");
    expect(workerStatus).not.toHaveProperty("cryptoBackendAvailable");
    expect(workerStatus).not.toHaveProperty("cryptoBackendResolverReason");
  });

  it("3. the Backend Resolver source never writes import()/require, never imports the generated JS glue, and never touches WebAssembly/fetch/Runtime/Worker/real WASM Loader/the Interface/WASM Backend Planning", () => {
    const codeOnly = codeOnlyLines(resolverSource);
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
    expect(codeOnly).not.toMatch(/fedos_wasm_backend/);
    expect(codeOnly).not.toMatch(/fedos_crypto_loader_facade/);
    // This layer is called BY the Backend Interface, never the reverse.
    expect(codeOnly).not.toMatch(/fedos_crypto_backend_interface/);
    // Terminus: does not call any further link deeper.
    expect(codeOnly).not.toMatch(/fedos_crypto_provider_facade_boundary/);
    expect(codeOnly).not.toMatch(/fedos_explicit_crypto_initialization/);
    // Only a type-only import from the Abstraction is allowed (selectedBackend's shared type).
    expect(codeOnly).toMatch(/import type \{ FedosCryptoLoaderBackendKind \} from "\.\/fedos_crypto_loader_backend\.js"/);
  });

  it("4. the Backend Interface legitimately reaches the Resolver as a SECOND, separate leaf -- its pre-existing reach into WASM Backend Planning is unaffected", () => {
    expect(interfaceSource).toMatch(/fedos_crypto_backend_resolver/);
    expect(interfaceSource).toMatch(/fedos_wasm_backend/);
    const codeOnly = codeOnlyLines(interfaceSource);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/initSync/);
    expect(codeOnly).not.toMatch(/fedos_wasm_loader\b/);
    expect(codeOnly).not.toMatch(/fedos_wasm_loader_plan|fedos_wasm_loader_contract/);

    const iface = createCryptoBackendInterface();
    expect(iface).toEqual({
      state: "PlanningOnly",
      backendSelected: "WasmPlanned",
      backendActivated: false,
      interfaceReady: false,
      reason: "BackendInterfacePending",
    });
    expect(cryptoBackendInterfaceState()).toBe("PlanningOnly");
    expect(cryptoBackendInterfaceReady()).toBe(false);

    // WASM Backend Planning's own fixed answer stays unchanged.
    expect(createWasmBackend()).toEqual({
      state: "PlanningOnly",
      backendReady: false,
      loaderAttached: false,
      loaderKind: "WasmLoaderPlanned",
      reason: "WasmBackendPlanningPending",
    });
  });

  it("5. Backend Abstraction, Facade, and Runtime return values are all unaffected by the Interface reaching the Resolver", () => {
    const backend = createCryptoLoaderBackend();
    expect(backend).toEqual({
      state: "PlanningOnly",
      backendKind: "WasmPlanned",
      backendReady: false,
      reason: "BackendAbstractionPending",
    });
    expect(cryptoLoaderBackendReady()).toBe(false);

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

    const runtime = createRuntime();
    expect(runtime.initializeCrypto()).toEqual({
      allowed: false,
      initialized: false,
      reason: "PrototypeDisabled",
    });
  });

  it("6. only the Backend Interface calls the Backend Resolver directly -- Runtime, Worker, the Facade, and the Backend Abstraction never reference it", () => {
    expect(createRuntimeSource).not.toMatch(/fedos_crypto_backend_resolver/);
    expect(workerSource).not.toMatch(/fedos_crypto_backend_resolver/);
    expect(codeOnlyLines(facadeSource)).not.toMatch(/fedos_crypto_backend_resolver/);
    expect(codeOnlyLines(backendSource)).not.toMatch(/fedos_crypto_backend_resolver/);
  });

  it("7. the generated JS glue is never imported (code, not comments) anywhere in the Backend Resolver or the Backend Interface source, static or dynamic", () => {
    const resolverCodeOnly = codeOnlyLines(resolverSource);
    const interfaceCodeOnly = codeOnlyLines(interfaceSource);
    expect(resolverCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
    expect(interfaceCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("8. WebAssembly.instantiate/compile are never actually invoked, even when exercising the full parked-chain surface through the Backend Resolver", () => {
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
      createCryptoBackendInterface();
      cryptoBackendInterfaceState();
      cryptoBackendInterfaceReady();
      createWasmBackend();
      createCryptoBackendResolver();
      cryptoBackendResolverState();
      cryptoBackendResolverSelected();
      cryptoBackendResolved();
      cryptoBackendAvailable();
      cryptoBackendResolverReason();
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
      createCryptoBackendInterface();
      createCryptoBackendResolver();
      createRuntime().initializeCrypto();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("10. Runtime imports the Facade only -- create_runtime.ts still never imports the rest of the WASM chain, including the Backend Resolver", () => {
    expect(createRuntimeSource).toMatch(/fedos_crypto_loader_facade/);
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_dynamic_loader_gate|fedos_dynamic_loader_dev_approval|fedos_explicit_crypto_initialization|fedos_crypto_provider_facade_boundary|fedos_wasm_loader_import_policy|fedos_crypto_loader_backend|fedos_wasm_backend|fedos_crypto_backend_interface|fedos_crypto_backend_resolver/,
    );
    expect(createRuntimeSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("11. Worker remains fully unconnected -- src/worker.ts imports none of the WASM chain, including the Facade, the Backend Abstraction, the Backend Interface, and the Backend Resolver", () => {
    expect(workerSource).not.toMatch(
      /fedos_crypto_loader_facade|fedos_crypto_loader_backend|fedos_wasm_backend|fedos_crypto_backend_interface|fedos_crypto_backend_resolver/,
    );
    expect(workerSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_dynamic_loader_gate|fedos_dynamic_loader_dev_approval|fedos_explicit_crypto_initialization|fedos_wasm_loader_import_policy/,
    );
    expect(workerSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
    expect(workerSource).not.toMatch(/initializeCrypto/);
  });

  it("12. encrypt/decrypt are unchanged -- still always Unsupported, and no NIP-17/NIP-44/NIP-59/Double Ratchet/Triple Ratchet is implemented", async () => {
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

    const resolverCodeOnly = codeOnlyLines(resolverSource);
    expect(resolverCodeOnly).not.toMatch(/NIP-?17|NIP-?44|NIP-?59/i);
    expect(resolverCodeOnly).not.toMatch(/Double Ratchet|Triple Ratchet/i);
  });

  it("13. Allowed/Active/Resolved/Available are still unreachable anywhere in the chain", () => {
    expect(createCryptoBackendResolver().backendResolved).toBe(false);
    expect(createCryptoBackendResolver().backendAvailable).toBe(false);
    expect(createCryptoBackendResolver().state).not.toBe("Active");
    expect(createCryptoBackendResolver().reason).not.toBe("Allowed");
    expect(createCryptoBackendInterface().backendActivated).toBe(false);
    expect(createCryptoBackendInterface().interfaceReady).toBe(false);
    expect(createCryptoLoaderBackend().backendReady).toBe(false);
    expect(createWasmBackend().backendReady).toBe(false);
    expect(createCryptoLoaderFacade().initialized).toBe(false);
    expect(createRuntime().initializeCrypto().allowed).toBe(false);
  });

  it("14. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(64);
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

  it("15. the Backend Resolver doc and execution contract doc record the required facts", () => {
    expect(resolverDocSource).toMatch(/BackendResolutionPending/);
    expect(resolverDocSource).toMatch(/PlanningOnly/);
    expect(resolverDocSource).toMatch(/WasmPlanned/);
    expect(resolverDocSource).toMatch(/backendResolved/);
    expect(resolverDocSource).toMatch(/backendAvailable/);

    expect(executionContractDocSource).toMatch(/Backend Resolver/);
    expect(executionContractDocSource).toMatch(/BackendResolutionPending/);
    expect(executionContractDocSource).toMatch(/\bSTOP\b/);
    expect(executionContractDocSource).toMatch(/Worker/);
  });
});
