import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  createDynamicLoaderGate,
  dynamicLoaderAllowed,
  dynamicLoaderGateReason,
  dynamicLoaderGateState,
} from "../src/runtime/fedos_dynamic_loader_gate.js";
import { createBuildTimeLoaderStrategy } from "../src/runtime/fedos_build_time_loader_strategy.js";
import { createGeneratedArtifactDistribution } from "../src/runtime/fedos_generated_artifact_distribution.js";
import { evaluateWasmLoaderImportPolicy } from "../src/runtime/fedos_wasm_loader_import_policy.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import gateDocSource from "../docs/runtime_dynamic_loader_gate.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import gateSource from "../src/runtime/fedos_dynamic_loader_gate.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import loaderStrategySource from "../src/runtime/fedos_build_time_loader_strategy.ts?raw";
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
 * Stage 569–574 — "FedOS Dynamic Loader Gate: eight conditions before
 * any future dynamic import(), all unmet, no side effects".
 * `docs/runtime_dynamic_loader_gate.md` (Stage 569) fixes the eight
 * conditions. `src/runtime/fedos_dynamic_loader_gate.ts` (Stage 570)
 * fixes `createDynamicLoaderGate()` to `{ gateState: "PlanningOnly",
 * dynamicLoaderAllowed: false, reason: "DynamicLoaderGatePending" }`.
 * Stage 571 wires `createBuildTimeLoaderStrategy()` to call it,
 * discarding the result. Neither this test file nor any file it
 * exercises writes a dynamic `import()`, imports the generated JS
 * glue, calls `WebAssembly.instantiate`/`compile`, or connects
 * Runtime/Worker to any of it.
 */
describe("FedOS Dynamic Loader Gate, PlanningOnly/closed, no side effects anywhere (Stage 569-574)", () => {
  it("1. createDynamicLoaderGate is always PlanningOnly/dynamicLoaderAllowed:false -- never a live probe", () => {
    const gate = createDynamicLoaderGate();
    expect(gate.gateState).toBe("PlanningOnly");
    expect(gate.dynamicLoaderAllowed).toBe(false);
    expect(gate.reason).toBe("DynamicLoaderGatePending");
    // Pure and idempotent across repeated calls.
    expect(createDynamicLoaderGate()).toEqual(gate);

    expect(dynamicLoaderGateState()).toBe("PlanningOnly");
    expect(dynamicLoaderAllowed()).toBe(false);
    expect(dynamicLoaderGateReason()).toBe("DynamicLoaderGatePending");
  });

  it("2. the gate's fixed answers match across diagnostics", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.dynamicLoaderGateState).toBe("PlanningOnly");
    expect(status.dynamicLoaderAllowed).toBe(false);
    expect(status.dynamicLoaderGateReason).toBe("DynamicLoaderGatePending");

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.dynamicLoaderGateState).toBe("PlanningOnly");
    expect(workerStatus.dynamicLoaderAllowed).toBe(false);
    expect(workerStatus.dynamicLoaderGateReason).toBe("DynamicLoaderGatePending");
  });

  it("3. the gate source never writes import()/require, never imports the generated JS glue, and never touches WebAssembly/fetch/Runtime/Worker", () => {
    const codeOnly = codeOnlyLines(gateSource);
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

  it("4. the build-time loader strategy legitimately reaches the gate but never the generated JS glue or WebAssembly", () => {
    expect(loaderStrategySource).toMatch(/fedos_dynamic_loader_gate/);
    const codeOnly = codeOnlyLines(loaderStrategySource);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/initSync/);

    const strategy = createBuildTimeLoaderStrategy();
    expect(strategy.strategy).toBe("DynamicLoaderPlanned");
    expect(strategy.dynamicImportAllowed).toBe(false);

    const distribution = createGeneratedArtifactDistribution();
    expect(distribution.staticImportSafe).toBe(false);
  });

  it("5. WebAssembly.instantiate/compile are never actually invoked, even when exercising the full plan/review/readiness/presence/activation/distribution/loader-strategy/gate surface", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      evaluateWasmLoaderImportPolicy();
      createGeneratedArtifactDistribution();
      createBuildTimeLoaderStrategy();
      createDynamicLoaderGate();
      dynamicLoaderGateState();
      dynamicLoaderAllowed();
      dynamicLoaderGateReason();
    } finally {
      instantiate.mockRestore();
      compile.mockRestore();
    }
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
  });

  it("6. no fetch call happens when exercising the full surface", async () => {
    const spy = vi.fn(() => Promise.resolve({ ok: true } as Response));
    const original = globalThis.fetch;
    (globalThis as { fetch?: unknown }).fetch = spy;
    try {
      evaluateWasmLoaderImportPolicy();
      createBuildTimeLoaderStrategy();
      createDynamicLoaderGate();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("7. Runtime remains unconnected -- create_runtime.ts imports none of the WASM chain, including the dynamic loader gate", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_dynamic_loader_gate|fedos_wasm_loader_import_policy/,
    );
    expect(createRuntimeSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("8. Worker remains unconnected -- src/worker.ts imports none of the WASM chain, including the dynamic loader gate", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_dynamic_loader_gate|fedos_wasm_loader_import_policy/,
    );
    expect(workerSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("9. the generated JS glue is never imported (code, not comments) anywhere in the gate or loader strategy source, static or dynamic", () => {
    const gateCodeOnly = codeOnlyLines(gateSource);
    const loaderStrategyCodeOnly = codeOnlyLines(loaderStrategySource);
    expect(gateCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
    expect(loaderStrategyCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
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

  it("11. Allowed/Open are still unreachable anywhere in the chain", () => {
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
    expect(createDynamicLoaderGate().gateState).not.toBe("Open");
    expect(createDynamicLoaderGate().reason).not.toBe("Allowed");
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

  it("13. the gate doc and execution contract doc record the required facts", () => {
    expect(gateDocSource).toMatch(/DynamicLoaderGatePending/);
    expect(gateDocSource).toMatch(/PlanningOnly/);

    expect(executionContractDocSource).toMatch(/Dynamic Loader Gate/);
    expect(executionContractDocSource).toMatch(/DynamicLoaderGatePending/);
    expect(executionContractDocSource).toMatch(/\bSTOP\b/);
  });
});
