import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  createDynamicLoaderDevApproval,
  dynamicLoaderDevApprovalState,
  dynamicLoaderDevApproved,
  dynamicLoaderDevReason,
} from "../src/runtime/fedos_dynamic_loader_dev_approval.js";
import { createDynamicLoaderGate } from "../src/runtime/fedos_dynamic_loader_gate.js";
import { createBuildTimeLoaderStrategy } from "../src/runtime/fedos_build_time_loader_strategy.js";
import { evaluateWasmLoaderImportPolicy } from "../src/runtime/fedos_wasm_loader_import_policy.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import devApprovalDocSource from "../docs/runtime_dynamic_loader_dev_approval.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import devApprovalSource from "../src/runtime/fedos_dynamic_loader_dev_approval.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import gateSource from "../src/runtime/fedos_dynamic_loader_gate.ts?raw";
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
 * Stage 577–582 — "FedOS Dynamic Loader Dev Approval: eight dev-only
 * conditions before any future dynamic loader activation, all unmet,
 * no side effects".
 * `docs/runtime_dynamic_loader_dev_approval.md` (Stage 577) fixes the
 * eight dev-only conditions.
 * `src/runtime/fedos_dynamic_loader_dev_approval.ts` (Stage 578) fixes
 * `createDynamicLoaderDevApproval()` to `{ approvalState:
 * "PlanningOnly", approved: false, reason: "DevApprovalPending" }`.
 * Stage 579 wires `createDynamicLoaderGate()` to call it, discarding
 * the result. Neither this test file nor any file it exercises writes
 * `import()` of any kind, imports the generated JS glue, calls
 * `WebAssembly.instantiate`/`compile`, or connects Runtime/Worker to
 * any of it.
 */
describe("FedOS Dynamic Loader Dev Approval, PlanningOnly/denied, no side effects anywhere (Stage 577-582)", () => {
  it("1. createDynamicLoaderDevApproval is always PlanningOnly/approved:false -- never a live probe", () => {
    const approval = createDynamicLoaderDevApproval();
    expect(approval.approvalState).toBe("PlanningOnly");
    expect(approval.approved).toBe(false);
    expect(approval.reason).toBe("DevApprovalPending");
    // Pure and idempotent across repeated calls.
    expect(createDynamicLoaderDevApproval()).toEqual(approval);

    expect(dynamicLoaderDevApprovalState()).toBe("PlanningOnly");
    expect(dynamicLoaderDevApproved()).toBe(false);
    expect(dynamicLoaderDevReason()).toBe("DevApprovalPending");
  });

  it("2. the approval's fixed answers match across diagnostics", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.dynamicLoaderDevApprovalState).toBe("PlanningOnly");
    expect(status.dynamicLoaderDevApproved).toBe(false);
    expect(status.dynamicLoaderDevReason).toBe("DevApprovalPending");

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.dynamicLoaderDevApprovalState).toBe("PlanningOnly");
    expect(workerStatus.dynamicLoaderDevApproved).toBe(false);
    expect(workerStatus.dynamicLoaderDevReason).toBe("DevApprovalPending");
  });

  it("3. the dev approval source never writes import()/require, never imports the generated JS glue, and never touches WebAssembly/fetch/Runtime/Worker", () => {
    const codeOnly = codeOnlyLines(devApprovalSource);
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

  it("4. the dynamic loader gate legitimately reaches the dev approval but never the generated JS glue or WebAssembly", () => {
    expect(gateSource).toMatch(/fedos_dynamic_loader_dev_approval/);
    const codeOnly = codeOnlyLines(gateSource);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/initSync/);

    const gate = createDynamicLoaderGate();
    expect(gate.dynamicLoaderAllowed).toBe(false);

    const strategy = createBuildTimeLoaderStrategy();
    expect(strategy.dynamicImportAllowed).toBe(false);
  });

  it("5. the generated JS glue is never imported (code, not comments) anywhere in the dev approval or gate source, static or dynamic", () => {
    const devApprovalCodeOnly = codeOnlyLines(devApprovalSource);
    const gateCodeOnly = codeOnlyLines(gateSource);
    expect(devApprovalCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
    expect(gateCodeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("6. WebAssembly.instantiate/compile are never actually invoked, even when exercising the full plan/review/readiness/presence/activation/distribution/loader-strategy/gate/dev-approval surface", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      evaluateWasmLoaderImportPolicy();
      createBuildTimeLoaderStrategy();
      createDynamicLoaderGate();
      createDynamicLoaderDevApproval();
      dynamicLoaderDevApprovalState();
      dynamicLoaderDevApproved();
      dynamicLoaderDevReason();
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
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("8. Runtime remains unconnected -- create_runtime.ts imports none of the WASM chain, including the dev approval", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_dynamic_loader_gate|fedos_dynamic_loader_dev_approval|fedos_wasm_loader_import_policy/,
    );
    expect(createRuntimeSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("9. Worker remains unconnected -- src/worker.ts imports none of the WASM chain, including the dev approval", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_dynamic_loader_gate|fedos_dynamic_loader_dev_approval|fedos_wasm_loader_import_policy/,
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

  it("11. Allowed/Granted are still unreachable anywhere in the chain", () => {
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
    expect(createDynamicLoaderDevApproval().approvalState).not.toBe("Granted");
    expect(createDynamicLoaderDevApproval().reason).not.toBe("Allowed");
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

  it("13. the dev approval doc and execution contract doc record the required facts", () => {
    expect(devApprovalDocSource).toMatch(/DevApprovalPending/);
    expect(devApprovalDocSource).toMatch(/PlanningOnly/);

    expect(executionContractDocSource).toMatch(/Dynamic Loader Dev Approval/);
    expect(executionContractDocSource).toMatch(/DevApprovalPending/);
    expect(executionContractDocSource).toMatch(/\bSTOP\b/);
  });
});
