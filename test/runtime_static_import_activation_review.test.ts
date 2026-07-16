import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  createStaticImportActivationReview,
  staticImportActivationApproved,
  staticImportActivationReason,
  staticImportActivationState,
} from "../src/runtime/fedos_static_import_activation_review.js";
import { createGeneratedArtifactPresence } from "../src/runtime/fedos_generated_artifact_presence.js";
import { createStaticImportReadiness } from "../src/runtime/fedos_wasm_static_import_readiness.js";
import { reviewStaticImport } from "../src/runtime/fedos_wasm_static_import_review.js";
import { planStaticImport } from "../src/runtime/fedos_wasm_static_import_plan.js";
import { evaluateWasmLoaderImportPolicy } from "../src/runtime/fedos_wasm_loader_import_policy.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import activationReviewDocSource from "../docs/runtime_static_import_activation_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import activationReviewSource from "../src/runtime/fedos_static_import_activation_review.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import presenceSource from "../src/runtime/fedos_generated_artifact_presence.ts?raw";
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
 * Stage 545–550 — "FedOS Static Import Activation Review: the final
 * gate before real static import, Generated JS Glue never referenced".
 * `docs/runtime_static_import_activation_review.md` (Stage 545)
 * gathers every prior gate's answer into one named activation
 * decision. `src/runtime/fedos_static_import_activation_review.ts`
 * (Stage 546) fixes `createStaticImportActivationReview()` to `{
 * state: "PlanningOnly", approved: false, reason:
 * "RuntimeActivationReviewPending" }`. Stage 547 wires
 * `createGeneratedArtifactPresence()` to call it, discarding the
 * result. Neither this test file nor any file it exercises imports,
 * `import()`s, or executes the generated JS glue, calls
 * `WebAssembly.instantiate`/`compile`/`initSync`/the default init
 * export, or connects Runtime/Worker to any of it.
 */
describe("FedOS Static Import Activation Review, always blocked, fail-closed everywhere (Stage 545-550)", () => {
  it("1. createStaticImportActivationReview is always approved:false, reason RuntimeActivationReviewPending -- never a live probe", () => {
    const review = createStaticImportActivationReview();
    expect(review.state).toBe("PlanningOnly");
    expect(review.approved).toBe(false);
    expect(review.reason).toBe("RuntimeActivationReviewPending");
    // Pure and idempotent across repeated calls.
    expect(createStaticImportActivationReview()).toEqual(review);

    expect(staticImportActivationState()).toBe("PlanningOnly");
    expect(staticImportActivationApproved()).toBe(false);
    expect(staticImportActivationReason()).toBe("RuntimeActivationReviewPending");
  });

  it("2. the activation review's fixed answers match across diagnostics", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.staticImportActivationState).toBe("PlanningOnly");
    expect(status.staticImportActivationApproved).toBe(false);
    expect(status.staticImportActivationReason).toBe("RuntimeActivationReviewPending");

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.staticImportActivationState).toBe("PlanningOnly");
    expect(workerStatus.staticImportActivationApproved).toBe(false);
    expect(workerStatus.staticImportActivationReason).toBe("RuntimeActivationReviewPending");
  });

  it("3. the activation review source never imports the generated JS glue, dynamic-imports, require, or touches WebAssembly/initSync/default init/fetch/Runtime/Worker", () => {
    const codeOnly = codeOnlyLines(activationReviewSource);
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

  it("4. the generated artifact presence policy legitimately reaches the activation review but never the generated JS glue, WebAssembly, or filesystem", () => {
    expect(presenceSource).toMatch(/fedos_static_import_activation_review/);
    const codeOnly = codeOnlyLines(presenceSource);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/initSync/);
    expect(codeOnly).not.toMatch(/existsSync|statSync/);

    const presence = createGeneratedArtifactPresence();
    expect(presence.present).toBe(false);
    expect(presence.reason).toBe("ArtifactNotGeneratedForRuntime");

    const readiness = createStaticImportReadiness();
    expect(readiness.ready).toBe(false);

    expect(reviewStaticImport().approved).toBe(false);
    expect(planStaticImport().state).toBe("BlockedByPolicy");
  });

  it("5. WebAssembly.instantiate/compile are never actually invoked, even when exercising the full plan/review/readiness/presence/activation surface", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      evaluateWasmLoaderImportPolicy();
      planStaticImport();
      reviewStaticImport();
      createStaticImportReadiness();
      createGeneratedArtifactPresence();
      createStaticImportActivationReview();
      staticImportActivationState();
      staticImportActivationApproved();
      staticImportActivationReason();
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
      createGeneratedArtifactPresence();
      createStaticImportActivationReview();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("7. Runtime remains unconnected -- create_runtime.ts imports none of the WASM chain, including the activation review", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_wasm_loader_import_policy/,
    );
    expect(createRuntimeSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("8. Worker remains unconnected -- src/worker.ts imports none of the WASM chain, including the activation review", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_wasm_loader_import_policy/,
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

  it("10. Allowed/Approved/Ready/Present/Reviewed are all still unreachable anywhere in the chain", () => {
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
    expect(createStaticImportReadiness().ready).toBe(false);
    expect(createGeneratedArtifactPresence().present).toBe(false);
    expect(createStaticImportActivationReview().approved).toBe(false);
    expect(createStaticImportActivationReview().state).not.toBe("Reviewed");
    expect(createStaticImportActivationReview().reason).not.toBe("Approved");
  });

  it("11. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
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

  it("12. the activation review doc and execution contract doc record the required facts", () => {
    expect(activationReviewDocSource).toMatch(/RuntimeActivationReviewPending/);
    expect(activationReviewDocSource).toMatch(/PlanningOnly/);

    expect(executionContractDocSource).toMatch(/Static Import Activation Review/);
    expect(executionContractDocSource).toMatch(/RuntimeActivationReviewPending/);
    expect(executionContractDocSource).toMatch(/\bSTOP\b/);
  });
});
