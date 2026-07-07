import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  createStaticImportReadiness,
  staticImportReadinessReason,
  staticImportReadinessState,
  staticImportReady,
} from "../src/runtime/fedos_wasm_static_import_readiness.js";
import { reviewStaticImport } from "../src/runtime/fedos_wasm_static_import_review.js";
import { planStaticImport } from "../src/runtime/fedos_wasm_static_import_plan.js";
import { evaluateWasmLoaderImportPolicy } from "../src/runtime/fedos_wasm_loader_import_policy.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import readinessDocSource from "../docs/runtime_wasm_static_import_readiness.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import readinessSource from "../src/runtime/fedos_wasm_static_import_readiness.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import reviewSource from "../src/runtime/fedos_wasm_static_import_review.ts?raw";
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
 * Stage 533–536 — "FedOS WASM Static Import Readiness: the eight
 * conditions required after Safety Review passes, never satisfied".
 * `docs/runtime_wasm_static_import_readiness.md` (Stage 533) names the
 * checklist. `src/runtime/fedos_wasm_static_import_readiness.ts`
 * (Stage 534) fixes `createStaticImportReadiness()` to
 * `{ readinessState: "PlanningOnly", ready: false, reason:
 * "RuntimeNotReady" }`. Stage 535 wires `reviewStaticImport()` to call
 * it, discarding the result. Neither this test file nor any file it
 * exercises imports, `import()`s, or executes the generated JS glue,
 * calls `WebAssembly.instantiate`/`compile`/`initSync`/the default
 * init export, or connects Runtime/Worker to any of it.
 */
describe("FedOS WASM Static Import Readiness, always blocked, fail-closed everywhere (Stage 533-536)", () => {
  it("1. createStaticImportReadiness is always ready:false, reason RuntimeNotReady -- never a live probe", () => {
    const readiness = createStaticImportReadiness();
    expect(readiness.readinessState).toBe("PlanningOnly");
    expect(readiness.ready).toBe(false);
    expect(readiness.reason).toBe("RuntimeNotReady");
    // Pure and idempotent across repeated calls.
    expect(createStaticImportReadiness()).toEqual(readiness);

    expect(staticImportReadinessState()).toBe("PlanningOnly");
    expect(staticImportReady()).toBe(false);
    expect(staticImportReadinessReason()).toBe("RuntimeNotReady");
  });

  it("2. the readiness record's fixed answers match across diagnostics", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.readinessState).toBe("PlanningOnly");
    expect(status.staticImportReady).toBe(false);
    expect(status.staticImportReadinessReason).toBe("RuntimeNotReady");

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.readinessState).toBe("PlanningOnly");
    expect(workerStatus.staticImportReady).toBe(false);
    expect(workerStatus.staticImportReadinessReason).toBe("RuntimeNotReady");
  });

  it("3. the readiness source never imports the generated JS glue, dynamic-imports, require, or touches WebAssembly/initSync/default init/fetch/Runtime/Worker", () => {
    const codeOnly = codeOnlyLines(readinessSource);
    expect(codeOnly).not.toMatch(/import\s*\(/);
    expect(codeOnly).not.toMatch(/require\s*\(/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/\bfetch\s*\(/);
    expect(codeOnly).not.toMatch(/instantiateStreaming/);
    expect(codeOnly).not.toMatch(/initSync/);
    expect(codeOnly).not.toMatch(/__wbg_init/);
    expect(codeOnly).not.toMatch(/\bfs\./);
    expect(codeOnly).not.toMatch(/child_process/i);
    expect(codeOnly).not.toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/create_runtime|AppRuntime/);
    expect(codeOnly).not.toMatch(/worker\.ts|src\/worker/);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
  });

  it("4. the static import review legitimately reaches the readiness record but never the generated JS glue, WebAssembly, or default init", () => {
    expect(reviewSource).toMatch(/fedos_wasm_static_import_readiness/);
    const codeOnly = codeOnlyLines(reviewSource);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/initSync/);
    expect(codeOnly).not.toMatch(/__wbg_init/);

    const decision = reviewStaticImport();
    expect(decision.approved).toBe(false);
    expect(decision.reason).toBe("GeneratedArtifactNotCommitted");

    expect(planStaticImport().state).toBe("BlockedByPolicy");
  });

  it("5. WebAssembly.instantiate/compile are never actually invoked, even when exercising the full plan/review/readiness surface", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      evaluateWasmLoaderImportPolicy();
      planStaticImport();
      reviewStaticImport();
      createStaticImportReadiness();
      staticImportReadinessState();
      staticImportReady();
      staticImportReadinessReason();
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
      reviewStaticImport();
      createStaticImportReadiness();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("7. Runtime remains unconnected -- create_runtime.ts imports none of the WASM chain, including the readiness record", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_wasm_loader_import_policy/,
    );
    expect(createRuntimeSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("8. Worker remains unconnected -- src/worker.ts imports none of the WASM chain, including the readiness record", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_wasm_loader_import_policy/,
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

  it("10. Allowed/Approved/Ready are all still unreachable anywhere in the chain", () => {
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
    expect(reviewStaticImport().approved).not.toBe(true);
    expect(reviewStaticImport().reason).not.toBe("Approved");
    expect(createStaticImportReadiness().ready).toBe(false);
    expect(createStaticImportReadiness().readinessState).not.toBe("Ready");
    expect(createStaticImportReadiness().reason).not.toBe("Ready");
  });

  it("11. Rust public API is unchanged (27 pub fn, none #[wasm_bindgen]-annotated) -- Cargo/package dependencies unchanged", () => {
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

  it("12. the readiness doc and execution contract doc record the required facts", () => {
    expect(readinessDocSource).toMatch(/RuntimeNotReady/);
    expect(readinessDocSource).toMatch(/PlanningOnly/);
    expect(readinessDocSource).toMatch(/pkg\/fedos_core_rust\.js/);

    expect(executionContractDocSource).toMatch(/Static Import Readiness/);
    expect(executionContractDocSource).toMatch(/RuntimeNotReady/);
    expect(executionContractDocSource).toMatch(/\bSTOP\b/);
  });
});
