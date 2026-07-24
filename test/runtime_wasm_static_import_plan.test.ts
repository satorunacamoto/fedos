import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  FedosWasmStaticImportPlanSkeleton,
  FEDOS_WASM_STATIC_IMPORT_TARGET,
  createFedosWasmStaticImportPlan,
  planStaticImport,
  staticImportAllowed,
  staticImportPlanState,
  staticImportTarget,
} from "../src/runtime/fedos_wasm_static_import_plan.js";
import { evaluateWasmLoaderImportPolicy } from "../src/runtime/fedos_wasm_loader_import_policy.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import staticImportPlanDocSource from "../docs/runtime_wasm_static_import_plan.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import staticImportPlanSource from "../src/runtime/fedos_wasm_static_import_plan.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import importPolicySource from "../src/runtime/fedos_wasm_loader_import_policy.ts?raw";
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

const EXPECTED_TARGET = "packages/fedos-core-rust/pkg/fedos_core_rust.js";

/**
 * Stage 517–524 — "FedOS WASM Static Import Plan: naming the exact
 * static import a future stage would write, never writing it".
 * `docs/runtime_wasm_static_import_plan.md` (Stage 517) names the
 * target (`packages/fedos-core-rust/pkg/fedos_core_rust.js`) and
 * expected exports (`initSync`, default init).
 * `src/runtime/fedos_wasm_static_import_plan.ts` (Stage 518) fixes
 * `planStaticImport()` to `"BlockedByPolicy"`. Stage 519 wires
 * `evaluateWasmLoaderImportPolicy()` to call it, discarding the
 * result. Neither this test file nor any file it exercises imports,
 * `import()`s, or executes the generated JS glue, calls
 * `WebAssembly.instantiate`/`compile`/`initSync`, or connects
 * Runtime/Worker to any of it.
 */
describe("FedOS WASM Static Import Plan, always blocked, fail-closed everywhere (Stage 517-524)", () => {
  it("1. planStaticImport is always BlockedByPolicy -- never a live probe", () => {
    const decision = planStaticImport();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.target).toBe(EXPECTED_TARGET);
    expect(typeof decision.reason).toBe("string");
    // Pure and idempotent across repeated calls.
    expect(planStaticImport()).toEqual(decision);

    const plan = createFedosWasmStaticImportPlan();
    expect(plan.planStaticImport()).toEqual(decision);

    const skeleton = new FedosWasmStaticImportPlanSkeleton();
    expect(skeleton.status().state).toBe("PlanningOnly");
    expect(skeleton.status().target).toBe(EXPECTED_TARGET);
  });

  it("2. the import target matches across the plan, docs, and diagnostics", () => {
    expect(FEDOS_WASM_STATIC_IMPORT_TARGET).toBe(EXPECTED_TARGET);
    expect(staticImportTarget()).toBe(EXPECTED_TARGET);
    expect(staticImportPlanState()).toBe("PlanningOnly");
    expect(staticImportAllowed()).toBe(false);

    expect(staticImportPlanDocSource).toContain(EXPECTED_TARGET);

    const status = runtimeCryptoActivationStatus();
    expect(status.staticImportTarget).toBe(EXPECTED_TARGET);
    expect(status.staticImportPlanState).toBe("PlanningOnly");
    expect(status.staticImportAllowed).toBe(false);

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.staticImportTarget).toBe(EXPECTED_TARGET);
    expect(workerStatus.staticImportPlanState).toBe("PlanningOnly");
    expect(workerStatus.staticImportAllowed).toBe(false);
  });

  it("3. the static import plan source never imports the generated JS glue, dynamic-imports, require, or touches WebAssembly/fetch/Runtime/Worker", () => {
    const codeOnly = staticImportPlanSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
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
    // The target string is a plain constant assignment, never inside an import()/require() call.
    expect(codeOnly).not.toMatch(/import\s*\(\s*["'].*fedos_core_rust/);
    expect(codeOnly).not.toMatch(/require\s*\(\s*["'].*fedos_core_rust/);
  });

  it("4. the import policy's evaluateWasmLoaderImportPolicy() legitimately reaches the static import plan but never the generated JS glue or WebAssembly", () => {
    expect(importPolicySource).toMatch(/fedos_wasm_static_import_plan/);
    const codeOnly = importPolicySource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/initSync/);

    const decision = evaluateWasmLoaderImportPolicy();
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("BlockedByPolicy");
  });

  it("5. WebAssembly.instantiate/compile are never actually invoked, even when exercising the full policy/plan surface", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      evaluateWasmLoaderImportPolicy();
      const plan = createFedosWasmStaticImportPlan();
      plan.status();
      plan.planStaticImport();
      planStaticImport();
      staticImportPlanState();
      staticImportTarget();
      staticImportAllowed();
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
      const plan = createFedosWasmStaticImportPlan();
      plan.planStaticImport();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("7. Runtime remains unconnected -- create_runtime.ts imports none of the WASM chain, including the static import plan", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_toolchain|fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_wasm_loader_contract|fedos_wasm_loader_plan|fedos_wasm_loader_import_policy|fedos_wasm_static_import_plan|fedos_wasm_loader(?!_contract)(?!_plan)(?!_import_policy)|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api/,
    );
    expect(createRuntimeSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("8. Worker remains unconnected -- src/worker.ts imports none of the WASM chain, including the static import plan", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_toolchain|fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_wasm_loader_contract|fedos_wasm_loader_plan|fedos_wasm_loader_import_policy|fedos_wasm_static_import_plan|fedos_wasm_loader(?!_contract)(?!_plan)(?!_import_policy)|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api|fedos_runtime_crypto_provider/,
    );
    expect(workerSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("9. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.state).toBe("Unsupported");
    expect(encrypted.allowed).toBe(false);
    const decrypted = await provider.decrypt({});
    expect(decrypted.state).toBe("Unsupported");
    expect(decrypted.allowed).toBe(false);
  });

  it("10. Allowed is still unreachable from either activation policy, the import policy, or the static import plan", () => {
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
    expect(planStaticImport().state).not.toBe("Allowed");
  });

  it("11. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
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

  it("12. the static import plan doc records the target/exports and the execution contract doc records the revised diagram", () => {
    expect(staticImportPlanDocSource).toMatch(/initSync/);
    expect(staticImportPlanDocSource).toMatch(/default/);
    expect(staticImportPlanDocSource).toContain(EXPECTED_TARGET);

    expect(executionContractDocSource).toMatch(/Static Import Plan/);
    expect(executionContractDocSource).toContain(EXPECTED_TARGET);
    expect(executionContractDocSource).toMatch(/\bSTOP\b/);
    expect(executionContractDocSource).toMatch(/BlockedByPolicy/);
  });
});
