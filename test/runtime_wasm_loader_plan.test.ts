import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  FedosWasmLoaderSkeleton,
  createFedosWasmLoader,
} from "../src/runtime/fedos_wasm_loader.js";
import {
  FedosWasmLoaderPlanSkeleton,
  createFedosWasmLoaderPlan,
  loaderImportAllowed,
  loaderInitializationAllowed,
  loaderPlanState,
  planImport,
  planInitialize,
  planRuntimeAttach,
  planWorkerAttach,
} from "../src/runtime/fedos_wasm_loader_plan.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import planningDocSource from "../docs/runtime_wasm_loader_planning.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import loaderPlanSource from "../src/runtime/fedos_wasm_loader_plan.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import loaderSkeletonSource from "../src/runtime/fedos_wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 501–508 — "FedOS WASM Loader Plan: the last four phases
 * before the generated JS glue may ever load, all still blocked".
 * `docs/runtime_wasm_loader_planning.md` (Stage 501) orders five
 * phases (Loader Creation, Import Permission, Initialization
 * Permission, Runtime Attach, Worker Attach). `src/runtime/fedos_wasm_loader_plan.ts`
 * (Stage 502) names the last four as `planImport()`/`planInitialize()`/
 * `planRuntimeAttach()`/`planWorkerAttach()`, all fixed
 * `"BlockedByPolicy"`. Stage 503 wires `FedosWasmLoader.planLoad()`
 * to construct one and call `planImport()`, discarding the result.
 * Neither this test file nor any file it exercises imports,
 * `import()`s, or executes the generated JS glue, calls
 * `WebAssembly.instantiate`/`compile`/`initSync`, or connects
 * Runtime/Worker to any of it.
 */
describe("FedOS WASM Loader Plan, planning only, fail-closed everywhere (Stage 501-508)", () => {
  it("1. constructing a plan does nothing -- fixed PlanningOnly, never a live probe", () => {
    const plan = new FedosWasmLoaderPlanSkeleton();
    const status = plan.status();
    expect(status.state).toBe("PlanningOnly");

    expect(loaderPlanState()).toBe("PlanningOnly");
    expect(loaderImportAllowed()).toBe(false);
    expect(loaderInitializationAllowed()).toBe(false);

    const built = createFedosWasmLoaderPlan();
    expect(built.status()).toEqual(status);
  });

  it("2. planImport/planInitialize/planRuntimeAttach/planWorkerAttach are all fixed BlockedByPolicy -- Allowed is unreachable", () => {
    const plan = createFedosWasmLoaderPlan();
    const decisions = [
      plan.planImport(),
      plan.planInitialize(),
      plan.planRuntimeAttach(),
      plan.planWorkerAttach(),
    ];
    for (const decision of decisions) {
      expect(decision.state).toBe("BlockedByPolicy");
      expect(typeof decision.reason).toBe("string");
    }
    expect(decisions.map((d) => d.operation)).toEqual([
      "import",
      "initialize",
      "runtimeAttach",
      "workerAttach",
    ]);

    // Standalone module-level functions mirror the same fixed decisions.
    expect(planImport().state).toBe("BlockedByPolicy");
    expect(planInitialize().state).toBe("BlockedByPolicy");
    expect(planRuntimeAttach().state).toBe("BlockedByPolicy");
    expect(planWorkerAttach().state).toBe("BlockedByPolicy");
  });

  it("3. does not mutate anything across repeated calls -- pure and idempotent", () => {
    const plan = createFedosWasmLoaderPlan();
    const first = plan.status();
    plan.planImport();
    plan.planInitialize();
    plan.planRuntimeAttach();
    plan.planWorkerAttach();
    const second = plan.status();
    expect(second).toEqual(first);
  });

  it("4. the loader plan source never imports the generated JS glue, dynamic-imports, Runtime/Worker, or touches WebAssembly/fetch", () => {
    const codeOnly = loaderPlanSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    // Stage 921 (Prototype EXECUTION Phase 001, a later stage than
    // this one) legitimately names the two Generated Artifact
    // filenames ("fedos_core_rust.js"/"fedos_core_rust_bg.wasm") to
    // check their existence -- this checks for actual Rust
    // crate/module USAGE, not that naming.
    expect(codeOnly).not.toMatch(/fedos_core_rust(?!\.js"|_bg\.wasm")/);
    expect(codeOnly).not.toMatch(/import\s*\(/);
    expect(codeOnly).not.toMatch(/require\s*\(/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/\bfetch\s*\(/);
    expect(codeOnly).not.toMatch(/instantiateStreaming/);
    // Stage 969 (Prototype EXECUTION Phase 007, a later stage than
    // this one) legitimately references .initSync as a PROPERTY
    // NAME to check for its presence on the retained JS glue module
    // -- this checks for a real, direct initSync(...) CALL, not the
    // property-name check.
    expect(codeOnly).not.toMatch(/\binitSync\s*\(/);
    expect(codeOnly).not.toMatch(/\bfs\./);
    expect(codeOnly).not.toMatch(/child_process/i);
    expect(codeOnly).not.toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/create_runtime|AppRuntime/);
    expect(codeOnly).not.toMatch(/worker\.ts|src\/worker/);
    expect(codeOnly).not.toMatch(/fedos_wasm_loader_contract/);
    expect(codeOnly).not.toMatch(/fedos_wasm_artifact/);
    expect(codeOnly).not.toMatch(/fedos_wasm_boundary/);
  });

  it("5. the loader skeleton's planLoad() reaches the loader plan but never the generated JS glue or WebAssembly", () => {
    expect(loaderSkeletonSource).toMatch(/fedos_wasm_loader_plan/);
    const codeOnly = loaderSkeletonSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    // Stage 921 (Prototype EXECUTION Phase 001, a later stage than
    // this one) legitimately names the two Generated Artifact
    // filenames ("fedos_core_rust.js"/"fedos_core_rust_bg.wasm") to
    // check their existence -- this checks for actual Rust
    // crate/module USAGE, not that naming.
    expect(codeOnly).not.toMatch(/fedos_core_rust(?!\.js"|_bg\.wasm")/);
    // Stage 889's Import Plan legitimately names a future
    // "WebAssemblyPlanning" gate without implementing it, so this
    // checks for real API usage (a dot after the identifier), not the
    // bare word.
    expect(codeOnly).not.toMatch(/WebAssembly\./);
    // Stage 969 (Prototype EXECUTION Phase 007, a later stage than
    // this one) legitimately references .initSync as a PROPERTY
    // NAME to check for its presence on the retained JS glue module
    // -- this checks for a real, direct initSync(...) CALL, not the
    // property-name check.
    expect(codeOnly).not.toMatch(/\binitSync\s*\(/);
  });

  it("6. WebAssembly.instantiate/compile are never actually invoked, even when exercising the plan's and skeleton's full surface", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      const plan = createFedosWasmLoaderPlan();
      plan.status();
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

  it("7. no fetch call happens when exercising the plan's full surface", async () => {
    const spy = vi.fn(() => Promise.resolve({ ok: true } as Response));
    const original = globalThis.fetch;
    (globalThis as { fetch?: unknown }).fetch = spy;
    try {
      const plan = createFedosWasmLoaderPlan();
      plan.planImport();
      plan.planInitialize();
      plan.planRuntimeAttach();
      plan.planWorkerAttach();
      const loader = new FedosWasmLoaderSkeleton();
      loader.planLoad();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("8. runtimeCryptoActivationStatus/workerCryptoActivationStatus expose the fixed loader-plan labels", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.loaderPlanState).toBe("PlanningOnly");
    expect(status.loaderImportAllowed).toBe(false);
    expect(status.loaderInitializationAllowed).toBe(false);
    // Distinct from, and unchanged alongside, the pre-existing loader skeleton fields.
    expect(status.loaderSkeletonState).toBe("NotLoaded");
    expect(status.loaderSkeletonMode).toBe("PlanningOnly");
    expect(status.loaderSkeletonPolicy).toBe("FailClosed");

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.loaderPlanState).toBe("PlanningOnly");
    expect(workerStatus.loaderImportAllowed).toBe(false);
    expect(workerStatus.loaderInitializationAllowed).toBe(false);
    expect(workerStatus.loaderSkeletonState).toBe("NotLoaded");
  });

  it("9. Runtime remains unconnected -- create_runtime.ts imports none of the WASM chain, including the loader plan", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_toolchain|fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_wasm_loader_contract|fedos_wasm_loader_plan|fedos_wasm_loader(?!_contract)(?!_plan)|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api/,
    );
    expect(createRuntimeSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("10. Worker remains unconnected -- src/worker.ts imports none of the WASM chain, including the loader plan", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_toolchain|fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_wasm_loader_contract|fedos_wasm_loader_plan|fedos_wasm_loader(?!_contract)(?!_plan)|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api|fedos_runtime_crypto_provider/,
    );
    expect(workerSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("11. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.state).toBe("Unsupported");
    expect(encrypted.allowed).toBe(false);
    const decrypted = await provider.decrypt({});
    expect(decrypted.state).toBe("Unsupported");
    expect(decrypted.allowed).toBe(false);
  });

  it("12. Allowed is still unreachable from either activation policy, even with both locks open", () => {
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
  });

  it("13. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986))", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(34);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(11);
  });

  it("14. the loader planning doc records the five phases and the execution contract doc records the revised Loader Plan diagram", () => {
    expect(planningDocSource).toMatch(/Loader Creation/);
    expect(planningDocSource).toMatch(/Import Permission/);
    expect(planningDocSource).toMatch(/Initialization Permission/);
    expect(planningDocSource).toMatch(/Runtime Attach/);
    expect(planningDocSource).toMatch(/Worker Attach/);

    expect(executionContractDocSource).toMatch(/Loader Plan/);
    expect(executionContractDocSource).toMatch(/\bSTOP\b/);
    expect(executionContractDocSource).toMatch(/BlockedByPolicy/);
  });
});
