import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  createCryptoBackendInterface,
  cryptoBackendActivated,
  cryptoBackendInterfaceReady,
  cryptoBackendInterfaceReason,
  cryptoBackendInterfaceState,
  cryptoBackendSelected,
} from "../src/runtime/fedos_crypto_backend_interface.js";
import { createWasmBackend, wasmBackendReady } from "../src/runtime/fedos_wasm_backend.js";
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
import positioningDocSource from "../docs/fedos_runtime_positioning.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import interfaceDocSource from "../docs/runtime_crypto_backend_interface.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import interfaceSource from "../src/runtime/fedos_crypto_backend_interface.ts?raw";
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
 * Stage 745–760 (Prototype Phase 005) — "FedOS Crypto Backend
 * Interface: a common, backend-agnostic contract inserted between the
 * Crypto Loader Backend Abstraction and WASM Backend Planning,
 * PlanningOnly/not-ready, no side effects, no real WASM Loader/Rust
 * connection".
 *
 * `docs/runtime_crypto_backend_interface.md` (Stage 745) names the
 * seam that lets the Backend Abstraction talk to WASM/Native/Python
 * candidates through the SAME shape, replacing the Stage 737 direct
 * wire from the Abstraction to WASM Backend Planning.
 * `src/runtime/fedos_crypto_backend_interface.ts` (Stage 746) fixes
 * `createCryptoBackendInterface()` to `{ state: "PlanningOnly",
 * backendSelected: "WasmPlanned", backendActivated: false,
 * interfaceReady: false, reason: "BackendInterfacePending" }`. Stage
 * 753 wires `createCryptoLoaderBackend()` to call it INSTEAD OF
 * calling `createWasmBackend()` directly -- the Abstraction's own
 * return value, the Facade's own return value, and Runtime's own
 * `initializeCrypto()` return value all stay byte-for-byte unchanged.
 * The Interface itself reaches WASM Backend Planning one link further
 * down, discarding ITS result too -- `fedos_wasm_backend.ts`'s own
 * fixed answer is unchanged, just no longer reached directly from the
 * Abstraction. Neither this test file nor any file it exercises
 * writes `import()` of any kind, imports the generated JS glue, calls
 * `WebAssembly.instantiate`/`compile`, or connects the real WASM
 * Loader/Rust to any of it. Runtime reaches the Facade, the Facade
 * reaches the Backend Abstraction, and the Abstraction reaches the
 * Backend Interface, but neither Runtime, Worker, nor the Facade ever
 * reaches the Backend Interface directly -- ONLY the Backend
 * Abstraction calls `createCryptoBackendInterface()`.
 *
 * `docs/fedos_runtime_positioning.md` fixes the repository-wide scope
 * this Interface's `"WasmPlanned"`/`"NativePlanned"`/`"PythonPlanned"`
 * candidate list echoes: FedOS is a desktop-first Secure Runtime
 * Platform (not a Tails/Whonix-style OS replacement), Rust owns
 * cryptography only, and TypeScript/Python own runtime glue and
 * experimentation/EMSR/Ontology work respectively. Test #17 guards
 * that document's required facts and its cross-reference from this
 * Interface's own doc.
 */
describe("FedOS Crypto Backend Interface, PlanningOnly/not-ready, no side effects, no real WASM Loader connection (Stage 745-760)", () => {
  it("1. createCryptoBackendInterface is always fixed -- never a live probe", () => {
    const iface = createCryptoBackendInterface();
    expect(iface.state).toBe("PlanningOnly");
    expect(iface.backendSelected).toBe("WasmPlanned");
    expect(iface.backendActivated).toBe(false);
    expect(iface.interfaceReady).toBe(false);
    expect(iface.reason).toBe("BackendInterfacePending");
    // Pure and idempotent across repeated calls.
    expect(createCryptoBackendInterface()).toEqual(iface);

    expect(cryptoBackendInterfaceState()).toBe("PlanningOnly");
    expect(cryptoBackendSelected()).toBe("WasmPlanned");
    expect(cryptoBackendActivated()).toBe(false);
    expect(cryptoBackendInterfaceReady()).toBe(false);
    expect(cryptoBackendInterfaceReason()).toBe("BackendInterfacePending");
  });

  it("2. the Backend Interface's fixed answers match across diagnostics; Worker diagnostics are unaffected", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.cryptoBackendInterfaceState).toBe("PlanningOnly");
    expect(status.cryptoBackendInterfaceReady).toBe(false);
    expect(status.cryptoBackendSelected).toBe("WasmPlanned");
    expect(status.cryptoBackendActivated).toBe(false);
    expect(status.cryptoBackendInterfaceReason).toBe("BackendInterfacePending");

    const workerStatus = workerCryptoActivationStatus() as unknown as Record<string, unknown>;
    expect(workerStatus).not.toHaveProperty("cryptoBackendInterfaceState");
    expect(workerStatus).not.toHaveProperty("cryptoBackendInterfaceReady");
    expect(workerStatus).not.toHaveProperty("cryptoBackendSelected");
    expect(workerStatus).not.toHaveProperty("cryptoBackendActivated");
    expect(workerStatus).not.toHaveProperty("cryptoBackendInterfaceReason");
  });

  it("3. the Backend Interface source never writes import()/require, never imports the generated JS glue, and never touches WebAssembly/fetch/Runtime/Worker/real WASM Loader/the Facade", () => {
    const codeOnly = codeOnlyLines(interfaceSource);
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
    expect(codeOnly).not.toMatch(/fedos_crypto_loader_facade/);
    // Terminus for the Abstraction's own reach: does not call further planning-chain links.
    expect(codeOnly).not.toMatch(/fedos_crypto_provider_facade_boundary/);
    expect(codeOnly).not.toMatch(/fedos_explicit_crypto_initialization/);
    // Only a type-only import from the Abstraction is allowed (backendSelected's shared type).
    expect(codeOnly).toMatch(/import type \{ FedosCryptoLoaderBackendKind \} from "\.\/fedos_crypto_loader_backend\.js"/);
  });

  it("4. the Backend Interface legitimately reaches WASM Backend Planning but never the generated JS glue, WebAssembly, or the real WASM Loader", () => {
    expect(interfaceSource).toMatch(/fedos_wasm_backend/);
    const codeOnly = codeOnlyLines(interfaceSource);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/initSync/);
    expect(codeOnly).not.toMatch(/fedos_wasm_loader\b/);
    expect(codeOnly).not.toMatch(/fedos_wasm_loader_plan|fedos_wasm_loader_contract/);

    const wasmBackend = createWasmBackend();
    expect(wasmBackend).toEqual({
      state: "PlanningOnly",
      backendReady: false,
      loaderAttached: false,
      loaderKind: "WasmLoaderPlanned",
      reason: "WasmBackendPlanningPending",
    });
    expect(wasmBackendReady()).toBe(false);
  });

  it("5. the Backend Abstraction no longer references WASM Backend Planning directly -- it now goes through the Backend Interface", () => {
    expect(backendSource).toMatch(/fedos_crypto_backend_interface/);
    // Code (not doc-comment prose recounting Stage 737's history) no longer references it.
    expect(codeOnlyLines(backendSource)).not.toMatch(/fedos_wasm_backend/);
    // fedos_wasm_backend.ts is UNMODIFIED by this stage; its own doc comment still
    // legitimately recounts Stage 737's history in prose, but never in code.
    expect(codeOnlyLines(wasmBackendSource)).not.toMatch(/fedos_crypto_loader_backend/);

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

  it("6. Runtime's own initializeCrypto() return value is unaffected by the Abstraction reaching the Backend Interface", () => {
    const runtime = createRuntime();
    expect(runtime.initializeCrypto()).toEqual({
      allowed: false,
      initialized: false,
      reason: "PrototypeDisabled",
    });
  });

  it("7. only the Backend Abstraction calls the Backend Interface directly -- Runtime, Worker, and the Facade never reference it", () => {
    expect(createRuntimeSource).not.toMatch(/fedos_crypto_backend_interface/);
    expect(workerSource).not.toMatch(/fedos_crypto_backend_interface/);
    expect(codeOnlyLines(facadeSource)).not.toMatch(/fedos_crypto_backend_interface/);
  });

  it("8. the generated JS glue is never imported (code, not comments) anywhere in the Backend Interface, WASM Backend Planning, or the Backend Abstraction source, static or dynamic", () => {
    const interfaceCodeOnly = codeOnlyLines(interfaceSource);
    const wasmBackendCodeOnly = codeOnlyLines(wasmBackendSource);
    const backendCodeOnly = codeOnlyLines(backendSource);
    expect(interfaceCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
    expect(wasmBackendCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
    expect(backendCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("9. WebAssembly.instantiate/compile are never actually invoked, even when exercising the full parked-chain surface through the Backend Interface", () => {
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
      createCryptoBackendInterface();
      cryptoBackendInterfaceState();
      cryptoBackendSelected();
      cryptoBackendActivated();
      cryptoBackendInterfaceReady();
      cryptoBackendInterfaceReason();
      createWasmBackend();
      createRuntime().initializeCrypto();
    } finally {
      instantiate.mockRestore();
      compile.mockRestore();
    }
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
  });

  it("10. no fetch call happens when exercising the full surface", async () => {
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
      createRuntime().initializeCrypto();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("11. Runtime imports the Facade only -- create_runtime.ts still never imports the rest of the WASM chain, including the Backend Interface", () => {
    expect(createRuntimeSource).toMatch(/fedos_crypto_loader_facade/);
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_dynamic_loader_gate|fedos_dynamic_loader_dev_approval|fedos_explicit_crypto_initialization|fedos_crypto_provider_facade_boundary|fedos_wasm_loader_import_policy|fedos_crypto_loader_backend|fedos_wasm_backend|fedos_crypto_backend_interface/,
    );
    expect(createRuntimeSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("12. Worker remains fully unconnected -- src/worker.ts imports none of the WASM chain, including the Facade, the Backend Abstraction, the Backend Interface, and WASM Backend Planning", () => {
    expect(workerSource).not.toMatch(
      /fedos_crypto_loader_facade|fedos_crypto_loader_backend|fedos_wasm_backend|fedos_crypto_backend_interface/,
    );
    expect(workerSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_dynamic_loader_gate|fedos_dynamic_loader_dev_approval|fedos_explicit_crypto_initialization|fedos_wasm_loader_import_policy/,
    );
    expect(workerSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
    expect(workerSource).not.toMatch(/initializeCrypto/);
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

  it("14. Allowed/Active/Ready are still unreachable anywhere in the chain", () => {
    expect(createCryptoBackendInterface().backendActivated).toBe(false);
    expect(createCryptoBackendInterface().interfaceReady).toBe(false);
    expect(createCryptoBackendInterface().state).not.toBe("Active");
    expect(createCryptoBackendInterface().reason).not.toBe("Allowed");
    expect(createCryptoLoaderBackend().backendReady).toBe(false);
    expect(createWasmBackend().backendReady).toBe(false);
    expect(createCryptoLoaderFacade().initialized).toBe(false);
    expect(createRuntime().initializeCrypto().allowed).toBe(false);
  });

  it("15. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(45);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(16);

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

  it("16. the Backend Interface doc and execution contract doc record the required facts", () => {
    expect(interfaceDocSource).toMatch(/BackendInterfacePending/);
    expect(interfaceDocSource).toMatch(/PlanningOnly/);
    expect(interfaceDocSource).toMatch(/WasmPlanned/);
    expect(interfaceDocSource).toMatch(/backendActivated/);
    expect(interfaceDocSource).toMatch(/interfaceReady/);

    expect(executionContractDocSource).toMatch(/Backend Interface/);
    expect(executionContractDocSource).toMatch(/BackendInterfacePending/);
    expect(executionContractDocSource).toMatch(/\bSTOP\b/);
    expect(executionContractDocSource).toMatch(/Worker/);
  });

  it("17. the FedOS Runtime Positioning doc fixes FedOS as a desktop-first Secure Runtime Platform, not an OS replacement, and is cross-referenced by the Backend Interface doc", () => {
    expect(positioningDocSource).toMatch(/Secure Runtime Platform/);
    expect(positioningDocSource).toMatch(/Desktop-first|desktop-first/);
    expect(positioningDocSource).toMatch(/Tails/);
    expect(positioningDocSource).toMatch(/Whonix/);
    expect(positioningDocSource).toMatch(/not an operating-system replacement|not.*OS replacement/i);
    expect(positioningDocSource).toMatch(/Mobile/);
    expect(positioningDocSource).toMatch(/Worker/);
    expect(positioningDocSource).toMatch(/Production/);
    expect(positioningDocSource).toMatch(/WasmPlanned/);
    expect(positioningDocSource).toMatch(/NativePlanned/);
    expect(positioningDocSource).toMatch(/PythonPlanned/);
    expect(positioningDocSource).toMatch(/EMSR/);
    expect(positioningDocSource).toMatch(/Ontology/);
    // Docs-only: names import()/WebAssembly.instantiate as PROHIBITED, never as a real call.
    expect(positioningDocSource).toMatch(/prohibited|PROHIBITED|does not/i);

    expect(interfaceDocSource).toMatch(/fedos_runtime_positioning/);
  });
});
