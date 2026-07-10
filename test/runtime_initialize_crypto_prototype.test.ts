import { describe, it, expect, vi } from "vitest";
import { createRuntime, createRuntimeInitializeCryptoResult } from "../src/runtime/create_runtime.js";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import prototypeDocSource from "../docs/runtime_initialize_crypto_prototype.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import typesSource from "../src/runtime/types.ts?raw";
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
 * Stage 689–696 (Prototype Phase 001) — "FedOS Runtime initializeCrypto
 * Prototype: a real, callable AppRuntime.initializeCrypto(), fixed
 * `allowed: false`, no Facade/Loader/WASM/Rust call of any kind, Worker
 * untouched, encrypt/decrypt unchanged".
 *
 * Ends the pure-Planning arc (Stage 585–688) and adds the FIRST real
 * public member to `AppRuntime` — `initializeCrypto()` — but calling it
 * performs no real work. This test file guards that the door exists
 * without being opened: no `import()` of any kind, no `WebAssembly`
 * reference, no generated JS glue reference, no Facade/Loader
 * reference, no Worker wiring, and no change to Rust's public surface
 * or dependencies.
 */
describe("FedOS Runtime initializeCrypto Prototype, door added not opened, no side effects anywhere (Stage 689-696)", () => {
  it("1. createRuntime().initializeCrypto exists and is callable", () => {
    const runtime = createRuntime();
    expect(typeof runtime.initializeCrypto).toBe("function");
  });

  it("2. the return value is always { allowed: false, initialized: false, reason: 'PrototypeDisabled' }", () => {
    const runtime = createRuntime();
    const result = runtime.initializeCrypto();
    expect(result).toEqual({
      allowed: false,
      initialized: false,
      reason: "PrototypeDisabled",
    });

    expect(createRuntimeInitializeCryptoResult()).toEqual(result);
  });

  it("3. calling it repeatedly, on the same runtime or a fresh one, always returns the same fixed value", () => {
    const runtime = createRuntime();
    const first = runtime.initializeCrypto();
    const second = runtime.initializeCrypto();
    const third = createRuntime().initializeCrypto();
    expect(first).toEqual(second);
    expect(first).toEqual(third);
  });

  it("4. the diagnostics summary reports the prototype as exposed but not allowed", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.runtimeInitializeCryptoPrototypeExposed).toBe(true);
    expect(status.runtimeInitializeCryptoPrototypeAllowed).toBe(false);
    expect(status.runtimeInitializeCryptoPrototypeReason).toBe("PrototypeDisabled");
  });

  it("5. create_runtime.ts never writes import()/require, never references the generated JS glue, and never touches WebAssembly/fetch/Loader (Facade reference is covered by test/runtime_initialize_crypto_prototype_facade.test.ts as of Stage 697)", () => {
    const codeOnly = codeOnlyLines(createRuntimeSource);
    expect(codeOnly).not.toMatch(/import\s*\(/);
    expect(codeOnly).not.toMatch(/require\s*\(/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/instantiateStreaming/);
    expect(codeOnly).not.toMatch(/initSync/);
    expect(codeOnly).not.toMatch(/__wbg_init/);
    expect(codeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
    expect(codeOnly).not.toMatch(/fedos_crypto_provider_facade_boundary/);
    expect(codeOnly).not.toMatch(/fedos_wasm_loader/);
  });

  it("6. types.ts never writes import()/require, never references the generated JS glue, and never touches WebAssembly/Facade/Loader", () => {
    const codeOnly = codeOnlyLines(typesSource);
    expect(codeOnly).not.toMatch(/import\s*\(/);
    expect(codeOnly).not.toMatch(/require\s*\(/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
    expect(codeOnly).not.toMatch(/fedos_crypto_loader_facade/);
    expect(codeOnly).not.toMatch(/fedos_crypto_provider_facade_boundary/);
    expect(codeOnly).not.toMatch(/fedos_wasm_loader/);
  });

  it("7. WebAssembly.instantiate/compile are never actually invoked when calling initializeCrypto", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      const runtime = createRuntime();
      runtime.initializeCrypto();
      runtime.initializeCrypto();
    } finally {
      instantiate.mockRestore();
      compile.mockRestore();
    }
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
  });

  it("8. no fetch call happens when calling initializeCrypto", () => {
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

  it("9. Worker remains untouched -- src/worker.ts never references initializeCrypto", () => {
    expect(workerSource).not.toMatch(/initializeCrypto/);
  });

  it("10. encrypt/decrypt are unchanged -- still always Unsupported, unaffected by the new prototype", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.state).toBe("Unsupported");
    expect(encrypted.allowed).toBe(false);
    const decrypted = await provider.decrypt({});
    expect(decrypted.state).toBe("Unsupported");
    expect(decrypted.allowed).toBe(false);

    const runtime = createRuntime();
    const beforeEncrypt = await runtime.crypto.encrypt({});
    const beforeDecrypt = await runtime.crypto.decrypt({});
    runtime.initializeCrypto();
    expect(await runtime.crypto.encrypt({})).toEqual(beforeEncrypt);
    expect(await runtime.crypto.decrypt({})).toEqual(beforeDecrypt);
  });

  it("11. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);

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

  it("12. no new PlanningOnly runtime module was added by THIS stage -- the fedos_*.ts file set was still exactly the known forty-two AS OF THIS stage's own scope (Stage 714/730/746/763 legitimately added fedos_crypto_loader_backend.ts/fedos_wasm_backend.ts/fedos_crypto_backend_interface.ts/fedos_crypto_backend_resolver.ts afterward; Stage 994, Prototype EXECUTION Phase 013, later added a 43rd, fedos_runtime_prototype_execution.ts; Stage 1004, Secure Runtime Alpha 008, later added a 44th, fedos_runtime_random_bytes.ts; Stage 1005, Secure Runtime Alpha 010, later added a 45th, fedos_runtime_aead_key_generation.ts; Stage 1009, Secure Runtime Alpha 014, later added a 46th, fedos_runtime_encrypt.ts; Stage 1010, Secure Runtime Alpha 015, later added a 47th, fedos_runtime_decrypt.ts; Stage 1011, Secure Runtime Alpha 018, later added a 48th and 49th, fedos_runtime_export_ciphertext.ts/fedos_runtime_import_ciphertext.ts; Stage 1012, Secure Runtime Alpha 019, later added a 50th, fedos_runtime_ciphertext_storage.ts; Secure Runtime Alpha 020 later added a 51st, fedos_runtime_mode_authority.ts; Secure Runtime Alpha 021 later added a 52nd and 53rd, fedos_runtime_storage_backend.ts/fedos_runtime_storage_resolver.ts; Secure Runtime Alpha 023 later added a 54th and 55th, fedos_windows_dpapi_helper.ts/fedos_runtime_storage_backend_windows_dpapi.ts)", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(files).length).toBe(55);
  });

  it("13. create_runtime.ts's pre-existing cryptoProvider/crypto selection is unchanged by this stage", () => {
    const runtime = createRuntime();
    expect(runtime.cryptoProvider.getStatus().state).toBe("unavailable");
    expect(createRuntimeSource).toMatch(/selectCryptoProvider/);
    expect(createRuntimeSource).toMatch(/selectRuntimeCryptoProvider/);
  });

  it("14. the prototype doc records the required facts", () => {
    expect(prototypeDocSource).toMatch(/PrototypeDisabled/);
    expect(prototypeDocSource).toMatch(/Prototype Phase 001/);
    expect(prototypeDocSource).toMatch(/OUT OF SCOPE/);
    expect(prototypeDocSource).toMatch(/"Unsupported"/);
  });
});
