import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import { createFedosWasmLoader } from "../src/runtime/fedos_wasm_loader.js";
import { createFedosWasmLoaderPlan } from "../src/runtime/fedos_wasm_loader_plan.js";
import {
  evaluateWasmLoaderImportPolicy,
  wasmLoaderImportPolicyState,
} from "../src/runtime/fedos_wasm_loader_import_policy.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import importPolicyDocSource from "../docs/runtime_wasm_loader_import_policy.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import importPolicySource from "../src/runtime/fedos_wasm_loader_import_policy.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import loaderPlanSource from "../src/runtime/fedos_wasm_loader_plan.ts?raw";
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

/**
 * Stage 509–516 — "FedOS WASM Loader Import Policy: fixing the
 * conditions phase #2 ('Import Permission') requires, all still
 * unmet". `docs/runtime_wasm_loader_import_policy.md` (Stage 509)
 * fixes six minimum conditions. `src/runtime/fedos_wasm_loader_import_policy.ts`
 * (Stage 510) names `evaluateWasmLoaderImportPolicy()`, always
 * resolving `{ allowed: false, reason: "BlockedByPolicy" }`. Stage
 * 511 wires `FedosWasmLoaderPlan.planImport()` to call it, discarding
 * the result. Neither this test file nor any file it exercises
 * imports, `import()`s, or executes the generated JS glue, calls
 * `WebAssembly.instantiate`/`compile`/`initSync`, or connects
 * Runtime/Worker to any of it.
 */
describe("FedOS WASM Loader Import Policy, always blocked, fail-closed everywhere (Stage 509-516)", () => {
  it("1. evaluateWasmLoaderImportPolicy is always allowed=false, reason=BlockedByPolicy -- never a live probe", () => {
    const decision = evaluateWasmLoaderImportPolicy();
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("BlockedByPolicy");
    // Pure and idempotent across repeated calls.
    expect(evaluateWasmLoaderImportPolicy()).toEqual(decision);

    expect(wasmLoaderImportPolicyState()).toBe("Blocked");
  });

  it("2. the import policy source never imports the generated JS glue, dynamic-imports, require, or touches WebAssembly/fetch/Runtime/Worker", () => {
    const codeOnly = importPolicySource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
    expect(codeOnly).not.toMatch(/import\s*\(/);
    expect(codeOnly).not.toMatch(/require\s*\(/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/\bfetch\s*\(/);
    expect(codeOnly).not.toMatch(/instantiateStreaming/);
    expect(codeOnly).not.toMatch(/initSync/);
    expect(codeOnly).not.toMatch(/\bfs\./);
    expect(codeOnly).not.toMatch(/child_process/i);
    expect(codeOnly).not.toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/create_runtime|AppRuntime/);
    expect(codeOnly).not.toMatch(/worker\.ts|src\/worker/);
  });

  it("3. the loader plan's planImport() legitimately reaches the import policy but never the generated JS glue or WebAssembly", () => {
    expect(loaderPlanSource).toMatch(/fedos_wasm_loader_import_policy/);
    const codeOnly = loaderPlanSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/initSync/);

    const plan = createFedosWasmLoaderPlan();
    const decision = plan.planImport();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.operation).toBe("import");
  });

  it("4. WebAssembly.instantiate/compile are never actually invoked, even when exercising the full loader/plan/policy surface", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      evaluateWasmLoaderImportPolicy();
      wasmLoaderImportPolicyState();
      const plan = createFedosWasmLoaderPlan();
      plan.planImport();
      plan.planInitialize();
      plan.planRuntimeAttach();
      plan.planWorkerAttach();
      const loader = createFedosWasmLoader();
      loader.planLoad();
      loader.planInitialize();
      loader.planUnload();
    } finally {
      instantiate.mockRestore();
      compile.mockRestore();
    }
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
  });

  it("5. no fetch call happens when exercising the full surface", async () => {
    const spy = vi.fn(() => Promise.resolve({ ok: true } as Response));
    const original = globalThis.fetch;
    (globalThis as { fetch?: unknown }).fetch = spy;
    try {
      evaluateWasmLoaderImportPolicy();
      const plan = createFedosWasmLoaderPlan();
      plan.planImport();
      const loader = createFedosWasmLoader();
      loader.planLoad();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("6. no require()/dynamic import() of the generated glue anywhere in the import policy or loader plan source", () => {
    expect(importPolicySource).not.toMatch(/require\s*\(\s*["'].*fedos_core_rust/);
    expect(importPolicySource).not.toMatch(/import\s*\(\s*["'].*fedos_core_rust/);
    expect(loaderPlanSource).not.toMatch(/require\s*\(\s*["'].*fedos_core_rust/);
    expect(loaderPlanSource).not.toMatch(/import\s*\(\s*["'].*fedos_core_rust/);
  });

  it("7. runtimeCryptoActivationStatus/workerCryptoActivationStatus expose the fixed import-policy labels", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.loaderImportPolicyState).toBe("Blocked");
    expect(status.loaderImportPolicyAllowed).toBe(false);
    expect(status.loaderImportPolicyReason).toBe("BlockedByPolicy");
    // Distinct from, and unchanged alongside, the pre-existing loader plan fields.
    expect(status.loaderPlanState).toBe("PlanningOnly");
    expect(status.loaderImportAllowed).toBe(false);
    expect(status.loaderInitializationAllowed).toBe(false);

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.loaderImportPolicyState).toBe("Blocked");
    expect(workerStatus.loaderImportPolicyAllowed).toBe(false);
    expect(workerStatus.loaderImportPolicyReason).toBe("BlockedByPolicy");
  });

  it("8. Runtime remains unconnected -- create_runtime.ts imports none of the WASM chain, including the import policy", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_toolchain|fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_wasm_loader_contract|fedos_wasm_loader_plan|fedos_wasm_loader_import_policy|fedos_wasm_loader(?!_contract)(?!_plan)(?!_import_policy)|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api/,
    );
    expect(createRuntimeSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("9. Worker remains unconnected -- src/worker.ts imports none of the WASM chain, including the import policy", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_toolchain|fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_wasm_loader_contract|fedos_wasm_loader_plan|fedos_wasm_loader_import_policy|fedos_wasm_loader(?!_contract)(?!_plan)(?!_import_policy)|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api|fedos_runtime_crypto_provider/,
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

  it("11. Allowed is still unreachable from either activation policy or the import policy, even with both locks open", () => {
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
    expect(evaluateWasmLoaderImportPolicy().reason).not.toBe("Allowed");
  });

  it("12. Rust public API is unchanged (27 pub fn, none #[wasm_bindgen]-annotated) -- no new dependency added", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(27);
    expect(libRsSource).not.toMatch(/#\[wasm_bindgen\]/);

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
    expect(depLines.length).toBe(10);

    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("13. the import policy doc records the six conditions and the execution contract doc records the revised Import Policy diagram", () => {
    expect(importPolicyDocSource).toMatch(/Loader Plan import allowed/);
    expect(importPolicyDocSource).toMatch(/Generated artifact present/i);
    expect(importPolicyDocSource).toMatch(/Artifact untracked\/gitignored/i);
    expect(importPolicyDocSource).toMatch(/Runtime dev-only approval/i);
    expect(importPolicyDocSource).toMatch(/Worker approval/i);
    expect(importPolicyDocSource).toMatch(/Execution Review/i);

    expect(executionContractDocSource).toMatch(/Import Policy/);
    expect(executionContractDocSource).toMatch(/\bSTOP\b/);
    expect(executionContractDocSource).toMatch(/BlockedByPolicy/);
  });
});
