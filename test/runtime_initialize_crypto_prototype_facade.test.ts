import { describe, it, expect, vi } from "vitest";
import { createRuntime, createRuntimeInitializeCryptoResult } from "../src/runtime/create_runtime.js";
import { createCryptoLoaderFacade } from "../src/runtime/fedos_crypto_loader_facade.js";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import facadeSource from "../src/runtime/fedos_crypto_loader_facade.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

/**
 * Stage 697–712 (Prototype Phase 002) — "Runtime reaches the Crypto
 * Loader Facade: AppRuntime.initializeCrypto() now calls
 * createCryptoLoaderFacade(), discards the result, and stays fixed
 * allowed:false/PrototypeDisabled. No Loader/WASM/Rust/Worker
 * connection of any kind, and the Facade itself is unmodified."
 *
 * `src/runtime/create_runtime.ts` (Stage 697) extends
 * `createRuntimeInitializeCryptoResult()` one link deeper into
 * `fedos_crypto_loader_facade.ts`'s `createCryptoLoaderFacade()` —
 * mirroring the SAME "reach one link deeper, keep your own answer"
 * pattern already established throughout the `fedos_*.ts` chain.
 * `runtime_crypto_diagnostics.ts` (Stage 698) records only that the
 * Facade was REACHED, not that it is connected. This test file guards
 * that Runtime stops exactly at the Facade: it never reaches the
 * Provider/Facade Boundary, WASM Loader, generated JS glue,
 * `WebAssembly`, or Rust directly, and Worker remains untouched.
 */
describe("FedOS Runtime initializeCrypto Prototype reaches the Crypto Loader Facade only, result discarded, no side effects anywhere (Stage 697-712)", () => {
  it("1. createRuntime().initializeCrypto() still returns the exact fixed value, unaffected by reaching the Facade", () => {
    const runtime = createRuntime();
    const result = runtime.initializeCrypto();
    expect(result).toEqual({
      allowed: false,
      initialized: false,
      reason: "PrototypeDisabled",
    });
    expect(createRuntimeInitializeCryptoResult()).toEqual(result);
    // The Facade's own return shape (state/backend) is never merged in.
    expect(Object.keys(result).sort()).toEqual(["allowed", "initialized", "reason"]);
  });

  it("2. the Facade's own result is a completely separate, unmerged shape -- proof it was discarded, not consumed", () => {
    const runtimeResult = createRuntimeInitializeCryptoResult();
    const facadeResult = createCryptoLoaderFacade();
    expect(facadeResult).toEqual({
      state: "PlanningOnly",
      initialized: false,
      backend: "WasmPlanned",
      reason: "FacadeInitializationPending",
    });
    // Distinct reason strings prove the Facade's answer never overwrote Runtime's.
    expect(runtimeResult.reason).toBe("PrototypeDisabled");
    expect(facadeResult.reason).toBe("FacadeInitializationPending");
    expect(runtimeResult.reason).not.toBe(facadeResult.reason);
  });

  it("3. create_runtime.ts reaches the Facade only -- it references createCryptoLoaderFacade but never the Provider/Facade Boundary, WASM Loader, or generated JS glue directly", () => {
    expect(createRuntimeSource).toMatch(/createCryptoLoaderFacade/);
    const codeOnly = codeOnlyLines(createRuntimeSource);
    expect(codeOnly).not.toMatch(/fedos_crypto_provider_facade_boundary/);
    expect(codeOnly).not.toMatch(/fedos_provider_initialization_approval/);
    expect(codeOnly).not.toMatch(/fedos_crypto_provider_initialization_request/);
    expect(codeOnly).not.toMatch(/fedos_provider_init_facade_contract/);
    expect(codeOnly).not.toMatch(/fedos_wasm_loader/);
    expect(codeOnly).not.toMatch(/fedos_wasm_boundary/);
    expect(codeOnly).not.toMatch(/fedos_wasm_artifact/);
    expect(codeOnly).not.toMatch(/fedos_rust_api|fedos_rust_boundary|fedos_rust_invocation_adapter/);
    expect(codeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("4. create_runtime.ts never writes import()/require, never touches WebAssembly/fetch/initSync/__wbg_init", () => {
    const codeOnly = codeOnlyLines(createRuntimeSource);
    expect(codeOnly).not.toMatch(/import\s*\(/);
    expect(codeOnly).not.toMatch(/require\s*\(/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/instantiateStreaming/);
    expect(codeOnly).not.toMatch(/initSync/);
    expect(codeOnly).not.toMatch(/__wbg_init/);
  });

  it("5. the Crypto Loader Facade itself is unmodified -- still PlanningOnly, its code never references AppRuntime/create_runtime.ts/Worker", () => {
    const codeOnly = codeOnlyLines(facadeSource);
    expect(codeOnly).not.toMatch(/AppRuntime/);
    expect(codeOnly).not.toMatch(/create_runtime/);
    expect(codeOnly).not.toMatch(/worker\.ts|src\/worker/);
    expect(codeOnly).not.toMatch(/fedos_wasm_loader/);
    expect(codeOnly).not.toMatch(/import\s*\(/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("6. WebAssembly.instantiate/compile are never actually invoked when calling initializeCrypto (now reaching the Facade)", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      const runtime = createRuntime();
      runtime.initializeCrypto();
      runtime.initializeCrypto();
      createCryptoLoaderFacade();
    } finally {
      instantiate.mockRestore();
      compile.mockRestore();
    }
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
  });

  it("7. no fetch call happens when calling initializeCrypto", () => {
    const spy = vi.fn(() => Promise.resolve({ ok: true } as Response));
    const original = globalThis.fetch;
    (globalThis as { fetch?: unknown }).fetch = spy;
    try {
      const runtime = createRuntime();
      runtime.initializeCrypto();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("8. Worker remains untouched -- src/worker.ts never references initializeCrypto or the Crypto Loader Facade", () => {
    expect(workerSource).not.toMatch(/initializeCrypto/);
    expect(workerSource).not.toMatch(/fedos_crypto_loader_facade|createCryptoLoaderFacade/);
  });

  it("9. Worker diagnostics are unaffected -- workerCryptoActivationStatus has no Facade-reached fields", () => {
    const workerStatus = workerCryptoActivationStatus() as unknown as Record<string, unknown>;
    expect(workerStatus).not.toHaveProperty("runtimePrototypeFacadeReached");
    expect(workerStatus).not.toHaveProperty("runtimePrototypeFacadeConnected");
    expect(workerStatus).not.toHaveProperty("runtimePrototypeFacadeReason");
  });

  it("10. Runtime diagnostics report the Facade as reached but not connected", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.runtimePrototypeFacadeReached).toBe(true);
    expect(status.runtimePrototypeFacadeConnected).toBe(false);
    expect(status.runtimePrototypeFacadeReason).toBe("PrototypeDisabled");
    // Unchanged from Stage 692.
    expect(status.runtimeInitializeCryptoPrototypeExposed).toBe(true);
    expect(status.runtimeInitializeCryptoPrototypeAllowed).toBe(false);
    expect(status.runtimeInitializeCryptoPrototypeReason).toBe("PrototypeDisabled");
  });

  it("11. encrypt/decrypt are unchanged -- still always Unsupported, unaffected by reaching the Facade", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    expect((await provider.encrypt({})).state).toBe("Unsupported");
    expect((await provider.decrypt({})).state).toBe("Unsupported");

    const runtime = createRuntime();
    const beforeEncrypt = await runtime.crypto.encrypt({});
    const beforeDecrypt = await runtime.crypto.decrypt({});
    runtime.initializeCrypto();
    expect(await runtime.crypto.encrypt({})).toEqual(beforeEncrypt);
    expect(await runtime.crypto.decrypt({})).toEqual(beforeDecrypt);
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

  it("13. no new PlanningOnly runtime module was added by THIS stage -- the fedos_*.ts file set was still exactly the known forty-two AS OF THIS stage's own scope (Stage 714/730/746/763 legitimately added fedos_crypto_loader_backend.ts/fedos_wasm_backend.ts/fedos_crypto_backend_interface.ts/fedos_crypto_backend_resolver.ts afterward; Stage 994, Prototype EXECUTION Phase 013, later added a 43rd, fedos_runtime_prototype_execution.ts)", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(files).length).toBe(43);
  });

  it("14. repeated calls stay identical, and multiple independent runtimes agree", () => {
    const a = createRuntime().initializeCrypto();
    const b = createRuntime().initializeCrypto();
    const runtime = createRuntime();
    const c = runtime.initializeCrypto();
    const d = runtime.initializeCrypto();
    expect(a).toEqual(b);
    expect(c).toEqual(d);
    expect(a).toEqual(c);
  });
});
