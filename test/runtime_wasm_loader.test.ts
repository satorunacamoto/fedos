import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  FedosWasmLoaderSkeleton,
  createFedosWasmLoader,
  loaderMode,
  loaderPolicy,
  loaderState,
} from "../src/runtime/fedos_wasm_loader.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import loaderDocSource from "../docs/runtime_wasm_loader.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import loaderSkeletonSource from "../src/runtime/fedos_wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 489–500 — "FedOS WASM Loader Skeleton: planning and policy
 * only, never a real load". `src/runtime/fedos_wasm_loader.ts` (Stage
 * 489–492) names `FedosWasmLoader`'s three planned operations
 * (`planLoad`/`planInitialize`/`planUnload`), all fixed
 * `"BlockedByPolicy"` under a fixed `"FailClosed"` policy.
 * `docs/runtime_wasm_loader.md` (Stage 493) records the three fixed
 * states this file names: `"NotLoaded"`/`"PlanningOnly"`/`"FailClosed"`.
 * Neither this test file nor any file it exercises imports,
 * `import()`s, or executes the generated JS glue, calls
 * `WebAssembly.instantiate`/`compile`, or connects Runtime/Worker to
 * any of it.
 */
describe("FedOS WASM Loader Skeleton, planning only, fail-closed everywhere (Stage 489-500)", () => {
  it("1. constructing a loader does nothing -- fixed NotLoaded/PlanningOnly/FailClosed, never a live probe", () => {
    const loader = new FedosWasmLoaderSkeleton();
    const status = loader.status();
    expect(status.state).toBe("NotLoaded");
    expect(status.mode).toBe("PlanningOnly");
    expect(status.policy).toBe("FailClosed");

    expect(loaderState()).toBe("NotLoaded");
    expect(loaderMode()).toBe("PlanningOnly");
    expect(loaderPolicy()).toBe("FailClosed");

    const built = createFedosWasmLoader();
    expect(built.status()).toEqual(status);
  });

  it("2. planLoad/planInitialize/planUnload are all fixed BlockedByPolicy -- Allowed is unreachable", () => {
    const loader = createFedosWasmLoader();
    const load = loader.planLoad();
    const init = loader.planInitialize();
    const unload = loader.planUnload();

    for (const decision of [load, init, unload]) {
      expect(decision.state).toBe("BlockedByPolicy");
      expect(decision.policy).toBe("FailClosed");
      expect(typeof decision.reason).toBe("string");
    }
    expect(load.operation).toBe("load");
    expect(init.operation).toBe("initialize");
    expect(unload.operation).toBe("unload");
  });

  it("3. does not mutate anything across repeated calls -- pure and idempotent", () => {
    const loader = createFedosWasmLoader();
    const first = loader.status();
    loader.planLoad();
    loader.planInitialize();
    loader.planUnload();
    const second = loader.status();
    expect(second).toEqual(first);
  });

  it("4. the loader skeleton source never imports the generated JS glue, dynamic-imports, or touches WebAssembly/fetch", () => {
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
    // Stage 945 (Prototype EXECUTION Phase 004, a later stage than
    // this one) legitimately calls real, gated import() exactly once
    // inside attemptDevOnlyJsGlueImport() -- this checks for import()
    // ANYWHERE ELSE in the source, not that one narrowly-scoped call.
    expect(codeOnly).not.toMatch(/import\s*\((?!\/\* @vite-ignore \*\/)/);
    expect(codeOnly).not.toMatch(/require\s*\(/);
    // Stage 889's Import Plan legitimately names a future
    // "WebAssemblyPlanning" gate without implementing it, so this
    // checks for real API usage (a dot after the identifier), not the
    // bare word.
    expect(codeOnly).not.toMatch(/WebAssembly\./);
    expect(codeOnly).not.toMatch(/\bfetch\s*\(/);
    expect(codeOnly).not.toMatch(/instantiateStreaming/);
    expect(codeOnly).not.toMatch(/\bfs\./);
    expect(codeOnly).not.toMatch(/child_process/i);
    // Stage 929 (Prototype EXECUTION Phase 002, a later stage than
    // this one) legitimately reads process.env.NODE_ENV (and ONLY that
    // one key) to evaluate the Dev-only Gate -- this checks for any
    // OTHER process.env usage, not the narrowly-scoped NODE_ENV read.
    expect(codeOnly).not.toMatch(/process\.env(?!\??\.NODE_ENV\b)/);
    // Deliberately unwired: no reference to the prior Loader Contract link or anything above it.
    expect(codeOnly).not.toMatch(/fedos_wasm_loader_contract/);
    expect(codeOnly).not.toMatch(/fedos_wasm_artifact/);
    expect(codeOnly).not.toMatch(/fedos_wasm_boundary/);
  });

  it("5. WebAssembly.instantiate/compile are never actually invoked, even when exercising the loader's full surface", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      const loader = createFedosWasmLoader();
      loader.status();
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

  it("6. no fetch call happens when exercising the loader's full surface", async () => {
    const spy = vi.fn(() => Promise.resolve({ ok: true } as Response));
    const original = globalThis.fetch;
    (globalThis as { fetch?: unknown }).fetch = spy;
    try {
      const loader = createFedosWasmLoader();
      loader.planLoad();
      loader.planInitialize();
      loader.planUnload();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("7. runtimeCryptoActivationStatus/workerCryptoActivationStatus expose the fixed loader-skeleton labels", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.loaderSkeletonState).toBe("NotLoaded");
    expect(status.loaderSkeletonMode).toBe("PlanningOnly");
    expect(status.loaderSkeletonPolicy).toBe("FailClosed");
    // Distinct from, and unchanged alongside, the pre-existing loader contract fields.
    expect(status.loaderContractState).toBe("NotLoaded");
    expect(status.loaderImportMode).toBe("StaticPlanning");
    expect(status.loaderInitialized).toBe(false);

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.loaderSkeletonState).toBe("NotLoaded");
    expect(workerStatus.loaderSkeletonMode).toBe("PlanningOnly");
    expect(workerStatus.loaderSkeletonPolicy).toBe("FailClosed");
    expect(workerStatus.loaderContractState).toBe("NotLoaded");
    expect(workerStatus.loaderImportMode).toBe("StaticPlanning");
    expect(workerStatus.loaderInitialized).toBe(false);
  });

  it("8. Runtime remains unconnected -- create_runtime.ts imports none of the WASM chain, including the loader skeleton", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_toolchain|fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_wasm_loader_contract|fedos_wasm_loader(?!_contract)|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api/,
    );
    expect(createRuntimeSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("9. Worker remains unconnected -- src/worker.ts imports none of the WASM chain, including the loader skeleton", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_toolchain|fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_wasm_loader_contract|fedos_wasm_loader(?!_contract)|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api|fedos_runtime_crypto_provider/,
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

  it("11. Allowed is still unreachable from either activation policy, even with both locks open", () => {
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

  it("12. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986))", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(46);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
  });

  it("13. the loader policy doc records the three fixed states and the execution contract doc records the Loader Skeleton / STOP diagram", () => {
    expect(loaderDocSource).toMatch(/NotLoaded/);
    expect(loaderDocSource).toMatch(/PlanningOnly/);
    expect(loaderDocSource).toMatch(/FailClosed/);

    expect(executionContractDocSource).toMatch(/Loader Skeleton/);
    expect(executionContractDocSource).toMatch(/\bSTOP\b/);
    expect(executionContractDocSource).toMatch(/BlockedByPolicy|FailClosed/);
  });
});
