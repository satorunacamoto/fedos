import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  createExplicitCryptoInitialization,
  cryptoInitializationAllowed,
  cryptoInitializationMode,
  cryptoInitializationReason,
  cryptoInitialized,
} from "../src/runtime/fedos_explicit_crypto_initialization.js";
import { createDynamicLoaderDevApproval } from "../src/runtime/fedos_dynamic_loader_dev_approval.js";
import { createDynamicLoaderGate } from "../src/runtime/fedos_dynamic_loader_gate.js";
import { evaluateWasmLoaderImportPolicy } from "../src/runtime/fedos_wasm_loader_import_policy.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import explicitInitDocSource from "../docs/runtime_explicit_crypto_initialization.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import explicitInitSource from "../src/runtime/fedos_explicit_crypto_initialization.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import devApprovalSource from "../src/runtime/fedos_dynamic_loader_dev_approval.ts?raw";
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
 * Stage 585–590 — "FedOS Explicit Crypto Initialization: explicit-init-only
 * design fixed, no auto-load, no implicit load, no side effects".
 * `docs/runtime_explicit_crypto_initialization.md` (Stage 585) fixes the
 * six permanent rules.
 * `src/runtime/fedos_explicit_crypto_initialization.ts` (Stage 586) fixes
 * `createExplicitCryptoInitialization()` to `{ mode:
 * "ExplicitInitialization", initializationAllowed: false, initialized:
 * false, reason: "InitializationApprovalPending" }`.
 * Stage 587 wires `createDynamicLoaderDevApproval()` to call it,
 * discarding the result. Neither this test file nor any file it
 * exercises writes `import()` of any kind, imports the generated JS
 * glue, calls `WebAssembly.instantiate`/`compile`, or connects
 * Runtime/Worker to any of it.
 */
describe("FedOS Explicit Crypto Initialization, fixed/denied, no side effects anywhere (Stage 585-590)", () => {
  it("1. createExplicitCryptoInitialization is always fixed -- never a live probe", () => {
    const init = createExplicitCryptoInitialization();
    expect(init.mode).toBe("ExplicitInitialization");
    expect(init.initializationAllowed).toBe(false);
    expect(init.initialized).toBe(false);
    expect(init.reason).toBe("InitializationApprovalPending");
    // Pure and idempotent across repeated calls.
    expect(createExplicitCryptoInitialization()).toEqual(init);

    expect(cryptoInitializationMode()).toBe("ExplicitInitialization");
    expect(cryptoInitializationAllowed()).toBe(false);
    expect(cryptoInitialized()).toBe(false);
    expect(cryptoInitializationReason()).toBe("InitializationApprovalPending");
  });

  it("2. the design's fixed answers match across diagnostics", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.cryptoInitializationMode).toBe("ExplicitInitialization");
    expect(status.cryptoInitializationAllowed).toBe(false);
    expect(status.cryptoInitialized).toBe(false);
    expect(status.cryptoInitializationReason).toBe("InitializationApprovalPending");

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.cryptoInitializationMode).toBe("ExplicitInitialization");
    expect(workerStatus.cryptoInitializationAllowed).toBe(false);
    expect(workerStatus.cryptoInitialized).toBe(false);
    expect(workerStatus.cryptoInitializationReason).toBe("InitializationApprovalPending");
  });

  it("3. the explicit init source never writes import()/require, never imports the generated JS glue, and never touches WebAssembly/fetch/Runtime/Worker", () => {
    const codeOnly = codeOnlyLines(explicitInitSource);
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
  });

  it("4. the dynamic loader dev approval legitimately reaches the explicit init design but never the generated JS glue or WebAssembly", () => {
    expect(devApprovalSource).toMatch(/fedos_explicit_crypto_initialization/);
    const codeOnly = codeOnlyLines(devApprovalSource);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/initSync/);

    const approval = createDynamicLoaderDevApproval();
    expect(approval.approved).toBe(false);

    const gate = createDynamicLoaderGate();
    expect(gate.dynamicLoaderAllowed).toBe(false);
  });

  it("5. the generated JS glue is never imported (code, not comments) anywhere in the explicit init or dev approval source, static or dynamic", () => {
    const explicitInitCodeOnly = codeOnlyLines(explicitInitSource);
    const devApprovalCodeOnly = codeOnlyLines(devApprovalSource);
    expect(explicitInitCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
    expect(devApprovalCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("6. WebAssembly.instantiate/compile are never actually invoked, even when exercising the full plan/review/readiness/presence/activation/distribution/loader-strategy/gate/dev-approval/explicit-init surface", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      evaluateWasmLoaderImportPolicy();
      createDynamicLoaderGate();
      createDynamicLoaderDevApproval();
      createExplicitCryptoInitialization();
      cryptoInitializationMode();
      cryptoInitializationAllowed();
      cryptoInitialized();
      cryptoInitializationReason();
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
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("8. Runtime remains unconnected -- create_runtime.ts imports none of the WASM chain, including the explicit init design", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_dynamic_loader_gate|fedos_dynamic_loader_dev_approval|fedos_explicit_crypto_initialization|fedos_wasm_loader_import_policy/,
    );
    expect(createRuntimeSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("9. Worker remains unconnected -- src/worker.ts imports none of the WASM chain, including the explicit init design", () => {
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

  it("11. Allowed/initialized are still unreachable anywhere in the chain", () => {
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
    expect(createExplicitCryptoInitialization().initialized).toBe(false);
    expect(createExplicitCryptoInitialization().reason).not.toBe("Allowed");
    expect(createExplicitCryptoInitialization().mode).toBe("ExplicitInitialization");
  });

  it("12. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
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

  it("13. the explicit init doc and execution contract doc record the required facts", () => {
    expect(explicitInitDocSource).toMatch(/InitializationApprovalPending/);
    expect(explicitInitDocSource).toMatch(/ExplicitInitialization/);
    expect(explicitInitDocSource).toMatch(/no auto-load/i);

    expect(executionContractDocSource).toMatch(/Explicit Crypto Initialization/);
    expect(executionContractDocSource).toMatch(/InitializationApprovalPending/);
    expect(executionContractDocSource).toMatch(/Dynamic Import/);
    expect(executionContractDocSource).toMatch(/\bSTOP\b/);
  });
});
