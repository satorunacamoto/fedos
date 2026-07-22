import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  createWasmBackend,
  wasmBackendLoaderAttached,
  wasmBackendLoaderKind,
  wasmBackendReady,
  wasmBackendReason,
  wasmBackendState,
} from "../src/runtime/fedos_wasm_backend.js";
import {
  createCryptoLoaderBackend,
  cryptoLoaderBackendReady,
  cryptoLoaderBackendState,
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
import planningDocSource from "../docs/runtime_wasm_backend_planning.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmBackendSource from "../src/runtime/fedos_wasm_backend.ts?raw";
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
 * Stage 729–744 (Prototype Phase 004) — "FedOS WASM Backend Planning
 * Layer: a thin planning seam directly below the Crypto Loader
 * Backend Abstraction, PlanningOnly/not-ready, no side effects, no
 * real WASM Loader/Rust connection".
 *
 * `docs/runtime_wasm_backend_planning.md` (Stage 729) names the seam
 * that lets the designated `"WasmPlanned"` backend candidate describe
 * its own readiness and loader-attachment state, separate from the
 * Backend Abstraction's own pre-existing `backendKind`/`backendReady`
 * fields. `src/runtime/fedos_wasm_backend.ts` (Stage 730) fixes
 * `createWasmBackend()` to `{ state: "PlanningOnly", backendReady:
 * false, loaderAttached: false, loaderKind: "WasmLoaderPlanned",
 * reason: "WasmBackendPlanningPending" }`. Stage 737 originally wired
 * `createCryptoLoaderBackend()` to call it directly, discarding the
 * result.
 *
 * Stage 753 (Prototype Phase 005) REPLACES that direct wire: the
 * Crypto Backend Interface (`fedos_crypto_backend_interface.ts`,
 * `docs/runtime_crypto_backend_interface.md`) is now inserted between
 * the Backend Abstraction and this planning layer, so
 * `fedos_crypto_loader_backend.ts` no longer references
 * `fedos_wasm_backend.ts` directly -- see
 * `test/runtime_crypto_backend_interface.test.ts` for that layer's own
 * guard suite. This file's fixed value and diagnostics are UNCHANGED
 * by that move; only WHICH file calls `createWasmBackend()` changed.
 * Neither this test file nor any file it exercises writes `import()`
 * of any kind, imports the generated JS glue, calls
 * `WebAssembly.instantiate`/`compile`, or connects the real WASM
 * Loader/Rust to any of it. Runtime reaches the Facade (Stage 697),
 * the Facade reaches the Backend Abstraction (Stage 721), and the
 * Abstraction reaches the Backend Interface (Stage 753), but neither
 * Runtime, Worker, the Facade, nor the Backend Abstraction ever
 * reaches the WASM Backend Planning layer directly anymore -- ONLY the
 * Backend Interface calls `createWasmBackend()`.
 */
describe("FedOS WASM Backend Planning Layer, PlanningOnly/not-ready, no side effects, no real WASM Loader connection (Stage 729-744)", () => {
  it("1. createWasmBackend is always fixed -- never a live probe", () => {
    const backend = createWasmBackend();
    expect(backend.state).toBe("PlanningOnly");
    expect(backend.backendReady).toBe(false);
    expect(backend.loaderAttached).toBe(false);
    expect(backend.loaderKind).toBe("WasmLoaderPlanned");
    expect(backend.reason).toBe("WasmBackendPlanningPending");
    // Pure and idempotent across repeated calls.
    expect(createWasmBackend()).toEqual(backend);

    expect(wasmBackendState()).toBe("PlanningOnly");
    expect(wasmBackendReady()).toBe(false);
    expect(wasmBackendLoaderAttached()).toBe(false);
    expect(wasmBackendLoaderKind()).toBe("WasmLoaderPlanned");
    expect(wasmBackendReason()).toBe("WasmBackendPlanningPending");
  });

  it("2. the WASM Backend Planning layer's fixed answers match across diagnostics; Worker diagnostics are unaffected", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.wasmBackendState).toBe("PlanningOnly");
    expect(status.wasmBackendReady).toBe(false);
    expect(status.wasmBackendLoaderAttached).toBe(false);
    expect(status.wasmBackendLoaderKind).toBe("WasmLoaderPlanned");
    expect(status.wasmBackendReason).toBe("WasmBackendPlanningPending");

    const workerStatus = workerCryptoActivationStatus() as unknown as Record<string, unknown>;
    expect(workerStatus).not.toHaveProperty("wasmBackendState");
    expect(workerStatus).not.toHaveProperty("wasmBackendReady");
    expect(workerStatus).not.toHaveProperty("wasmBackendLoaderAttached");
    expect(workerStatus).not.toHaveProperty("wasmBackendLoaderKind");
    expect(workerStatus).not.toHaveProperty("wasmBackendReason");
  });

  it("3. the WASM Backend Planning source never writes import()/require, never imports the generated JS glue, and never touches WebAssembly/fetch/Runtime/Worker/the Backend Abstraction (it DOES legitimately reach fedos_wasm_loader.ts as of Stage 793 -- see test/runtime_wasm_backend_loader_connection.test.ts)", () => {
    const codeOnly = codeOnlyLines(wasmBackendSource);
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
    // Stage 793 (Prototype Phase 008): legitimately reaches fedos_wasm_loader.ts itself,
    // but never its own downstream files directly.
    expect(codeOnly).toMatch(/fedos_wasm_loader\.js/);
    expect(codeOnly).not.toMatch(/fedos_wasm_loader_plan/);
    expect(codeOnly).not.toMatch(/fedos_wasm_loader_contract/);
    // This layer is called BY the Backend Interface (Stage 753), never the reverse.
    expect(codeOnly).not.toMatch(/fedos_crypto_loader_backend/);
    expect(codeOnly).not.toMatch(/fedos_crypto_backend_interface/);
    expect(codeOnly).not.toMatch(/fedos_crypto_loader_facade/);
    // Terminus for the Facade/Abstraction/Interface's OWN reach: does not call any
    // further Planning-chain link besides the real Loader (Stage 793).
    expect(codeOnly).not.toMatch(/fedos_crypto_provider_facade_boundary/);
    expect(codeOnly).not.toMatch(/fedos_explicit_crypto_initialization/);
  });

  it("4. the Backend Abstraction no longer references WASM Backend Planning directly -- that now happens via the Backend Interface, but the Abstraction's own fixed value is unaffected", () => {
    expect(backendSource).toMatch(/fedos_crypto_backend_interface/);
    const codeOnly = codeOnlyLines(backendSource);
    // Code (not doc-comment prose recounting Stage 737's history) no longer references it.
    expect(codeOnly).not.toMatch(/fedos_wasm_backend/);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/initSync/);
    expect(codeOnly).not.toMatch(/fedos_wasm_loader\b/);
    expect(codeOnly).not.toMatch(/fedos_wasm_loader_plan|fedos_wasm_loader_contract/);

    const backend = createCryptoLoaderBackend();
    expect(backend).toEqual({
      state: "PlanningOnly",
      backendKind: "WasmPlanned",
      backendReady: false,
      reason: "BackendAbstractionPending",
    });

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

  it("5. Runtime's own initializeCrypto() return value is unaffected by the Backend Abstraction reaching WASM Backend Planning", () => {
    const runtime = createRuntime();
    expect(runtime.initializeCrypto()).toEqual({
      allowed: false,
      initialized: false,
      reason: "PrototypeDisabled",
    });
  });

  it("6. only the Backend Interface calls WASM Backend Planning directly -- Runtime, Worker, the Facade, and the Backend Abstraction never reference it", () => {
    expect(createRuntimeSource).not.toMatch(/fedos_wasm_backend/);
    expect(workerSource).not.toMatch(/fedos_wasm_backend/);
    expect(codeOnlyLines(facadeSource)).not.toMatch(/fedos_wasm_backend/);
    expect(codeOnlyLines(backendSource)).not.toMatch(/fedos_wasm_backend/);
  });

  it("7. the generated JS glue is never imported (code, not comments) anywhere in WASM Backend Planning or the Backend Abstraction source, static or dynamic", () => {
    const wasmBackendCodeOnly = codeOnlyLines(wasmBackendSource);
    const backendCodeOnly = codeOnlyLines(backendSource);
    expect(wasmBackendCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
    expect(backendCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("8. WebAssembly.instantiate/compile are never actually invoked, even when exercising the full parked-chain surface through WASM Backend Planning", () => {
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
      cryptoLoaderBackendReady();
      createWasmBackend();
      wasmBackendState();
      wasmBackendReady();
      wasmBackendLoaderAttached();
      wasmBackendLoaderKind();
      wasmBackendReason();
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
      createWasmBackend();
      createRuntime().initializeCrypto();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("10. Runtime imports the Facade only -- create_runtime.ts still never imports the rest of the WASM chain, including WASM Backend Planning", () => {
    expect(createRuntimeSource).toMatch(/fedos_crypto_loader_facade/);
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_dynamic_loader_gate|fedos_dynamic_loader_dev_approval|fedos_explicit_crypto_initialization|fedos_crypto_provider_facade_boundary|fedos_wasm_loader_import_policy|fedos_crypto_loader_backend|fedos_wasm_backend/,
    );
    expect(createRuntimeSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("11. Worker remains fully unconnected -- src/worker.ts imports none of the WASM chain, including the Facade, the Backend Abstraction, and WASM Backend Planning", () => {
    expect(workerSource).not.toMatch(/fedos_crypto_loader_facade|fedos_crypto_loader_backend|fedos_wasm_backend/);
    expect(workerSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_dynamic_loader_gate|fedos_dynamic_loader_dev_approval|fedos_explicit_crypto_initialization|fedos_wasm_loader_import_policy/,
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
    expect(createWasmBackend().backendReady).toBe(false);
    expect(createWasmBackend().loaderAttached).toBe(false);
    expect(createWasmBackend().state).not.toBe("Active");
    expect(createWasmBackend().reason).not.toBe("Allowed");
    expect(createWasmBackend().loaderKind).not.toBe("WasmLoaderActive");
    expect(createCryptoLoaderBackend().backendReady).toBe(false);
    expect(createCryptoLoaderFacade().initialized).toBe(false);
    expect(createRuntime().initializeCrypto().allowed).toBe(false);
  });

  it("14. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);

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

  it("15. the WASM Backend Planning doc and execution contract doc record the required facts", () => {
    expect(planningDocSource).toMatch(/WasmBackendPlanningPending/);
    expect(planningDocSource).toMatch(/PlanningOnly/);
    expect(planningDocSource).toMatch(/WasmLoaderPlanned/);
    expect(planningDocSource).toMatch(/loaderAttached/);

    expect(executionContractDocSource).toMatch(/WASM Backend Planning/);
    expect(executionContractDocSource).toMatch(/WasmBackendPlanningPending/);
    expect(executionContractDocSource).toMatch(/\bSTOP\b/);
    expect(executionContractDocSource).toMatch(/Worker/);
  });
});
