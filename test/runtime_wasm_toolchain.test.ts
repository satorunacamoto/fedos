import { describe, it, expect, vi } from "vitest";
import {
  FedosWasmToolchainPlaceholder,
  createFedosWasmToolchain,
  fedosWasmBuildReady,
  fedosWasmToolchainInstalled,
  fedosWasmToolchainVerified,
} from "../src/runtime/fedos_wasm_toolchain.js";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import toolchainSource from "../src/runtime/fedos_wasm_toolchain.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Stage 417–424 — "FedOS WASM toolchain readiness": final preparation
 * before ever introducing a real `wasm32`/`wasm-bindgen`/`wasm-pack`
 * toolchain. Adds a standalone, unwired `FedosWasmToolchain` model
 * (`src/runtime/fedos_wasm_toolchain.ts`, Stage 419) plus diagnostics
 * fields (Stage 420) and four planning docs (Stage 417/418/421). No
 * WASM generation, no toolchain invocation, no Rust/Cargo/package.json
 * change, no Runtime/Worker activation.
 */
describe("FedOS WASM toolchain readiness, fail-closed, unwired (Stage 417-424)", () => {
  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
  }

  it("1. toolchain model only -- status() reports not installed/verified, plan*() always resolve Planning", () => {
    const toolchain = new FedosWasmToolchainPlaceholder();
    const status = toolchain.status();
    expect(status.installed).toBe(false);
    expect(status.verified).toBe(false);

    for (const decision of [
      toolchain.planInstall(),
      toolchain.planBuild(),
      toolchain.planBindgen(),
      toolchain.planVerify(),
    ]) {
      expect(decision.state).toBe("Planning");
    }
  });

  it("2. no wasm-pack reference anywhere in the toolchain file", () => {
    expect(codeOnlyOf(toolchainSource)).not.toMatch(/wasm-pack/i);
  });

  it("3. no wasm-bindgen reference anywhere in the toolchain file", () => {
    expect(codeOnlyOf(toolchainSource)).not.toMatch(/wasm-bindgen/i);
  });

  it("4. no child_process reference anywhere in the toolchain file", () => {
    const codeOnly = codeOnlyOf(toolchainSource);
    expect(codeOnly).not.toMatch(/child_process/i);
    expect(codeOnly).not.toMatch(/\bspawn\s*\(/);
    expect(codeOnly).not.toMatch(/\bexec(File)?\s*\(/);
    expect(codeOnly).not.toMatch(/\bfork\s*\(/);
  });

  it("5. no WebAssembly API reference in the toolchain file, and it is never actually invoked at runtime", () => {
    expect(codeOnlyOf(toolchainSource)).not.toMatch(/WebAssembly/);

    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      const toolchain = createFedosWasmToolchain();
      toolchain.status();
      toolchain.planInstall();
      toolchain.planBuild();
      toolchain.planBindgen();
      toolchain.planVerify();
    } finally {
      instantiate.mockRestore();
      compile.mockRestore();
    }
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
  });

  it("6. no build script is generated -- no cargo build/wasm32/rustup/wasm-pack/wasm-bindgen invocation anywhere in package.json scripts", () => {
    const pkg = JSON.parse(packageJsonSource);
    const scripts = Object.values(pkg.scripts ?? {}) as string[];
    for (const script of scripts) {
      expect(script).not.toMatch(/wasm-pack/i);
      expect(script).not.toMatch(/wasm-bindgen/i);
      expect(script).not.toMatch(/wasm32/i);
      expect(script).not.toMatch(/cargo\s+build/i);
      expect(script).not.toMatch(/rustup/i);
    }
  });

  it("7. no .wasm file, no generated JS bindings, no compiled/native artifact exists anywhere in packages/fedos-core-rust", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../packages/fedos-core-rust/**/*");
    const paths = Object.keys(files);
    const forbidden = /\.(wasm|rlib|so|dll|dylib|node|a|o)$/i;
    for (const path of paths) {
      expect(forbidden.test(path), `unexpected compiled/native artifact: ${path}`).toBe(false);
    }
  });

  it("8. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.state).toBe("Unsupported");
    expect(encrypted.allowed).toBe(false);
    const decrypted = await provider.decrypt({});
    expect(decrypted.state).toBe("Unsupported");
    expect(decrypted.allowed).toBe(false);
  });

  it("9. Runtime remains unconnected -- create_runtime.ts does not import the toolchain or any earlier chain link", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_toolchain|fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api/,
    );
  });

  it("10. Worker remains unconnected -- src/worker.ts does not import the toolchain or any earlier chain link", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_toolchain|fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api|fedos_runtime_crypto_provider/,
    );
  });

  it("11. Cargo.toml production dependencies are unchanged (10)", () => {
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
    expect(cargoCode).not.toMatch(/wasm-bindgen/);
    expect(cargoCode).not.toMatch(/wasm-pack/);
  });

  it("12. package.json dependencies are unchanged (2)", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("13. Rust public API (pub fn count) is unchanged (27)", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(27);
  });

  it("14. Allowed is still unreachable from either activation policy, even with both locks open", () => {
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

  it("15. diagnostics expose wasmToolchainInstalled/wasmToolchainVerified/wasmBuildReady, fixed false, without constructing an instance", () => {
    expect(fedosWasmToolchainInstalled()).toBe(false);
    expect(fedosWasmToolchainVerified()).toBe(false);
    expect(fedosWasmBuildReady()).toBe(false);

    const status = runtimeCryptoActivationStatus();
    expect(status.wasmToolchainInstalled).toBe(false);
    expect(status.wasmToolchainVerified).toBe(false);
    expect(status.wasmBuildReady).toBe(false);

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.wasmToolchainInstalled).toBe(false);
    expect(workerStatus.wasmToolchainVerified).toBe(false);
    expect(workerStatus.wasmBuildReady).toBe(false);
  });

  it("16. no process.env reference in the toolchain file", () => {
    expect(codeOnlyOf(toolchainSource)).not.toMatch(/process\.env/);
  });

  it("17. no cargo build --target wasm32 invocation reference anywhere in the toolchain file", () => {
    const codeOnly = codeOnlyOf(toolchainSource);
    expect(codeOnly).not.toMatch(/cargo\s+build/i);
    expect(codeOnly).not.toMatch(/wasm32/i);
  });
});
