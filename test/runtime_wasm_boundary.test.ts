import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  FedosRustInvocationAdapterPlaceholder,
} from "../src/runtime/fedos_rust_invocation_adapter.js";
import {
  FedosWasmBoundaryPlaceholder,
  createFedosWasmBoundary,
  fedosWasmBoundaryReachable,
  fedosWasmBoundaryState,
  fedosWasmLoaded,
} from "../src/runtime/fedos_wasm_boundary.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmBoundarySource from "../src/runtime/fedos_wasm_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import invocationAdapterSource from "../src/runtime/fedos_rust_invocation_adapter.ts?raw";
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
 * Stage 385–392 — "FedOS Runtime <-> Rust boundary decision: WASM
 * Boundary (Not Loaded)": docs/runtime_rust_boundary_decision.md
 * (Stage 385) formally decides WebAssembly is the sole official MVP
 * boundary; src/runtime/fedos_wasm_boundary.ts (Stage 386) models it
 * as a placeholder that never loads or executes anything; Stage 387
 * wires the Rust Invocation Adapter's planEncrypt()/planDecrypt() to
 * reach it via planLoad() only.
 */
describe("FedOS WASM boundary, not loaded, fail-closed everywhere (Stage 385-392)", () => {
  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
  }

  it("1. WASM is not loaded -- planLoad() always resolves BlockedByImplementation, status() always NotLoaded", () => {
    const boundary = new FedosWasmBoundaryPlaceholder();
    expect(boundary.status().state).toBe("NotLoaded");
    const decision = boundary.planLoad();
    expect(decision.operation).toBe("load");
    expect(decision.state).toBe("BlockedByImplementation");
  });

  it("2. no WebAssembly.instantiate/compile call anywhere in the WASM Boundary file", () => {
    const codeOnly = codeOnlyOf(wasmBoundarySource);
    expect(codeOnly).not.toMatch(/WebAssembly\s*\.\s*instantiate/);
    expect(codeOnly).not.toMatch(/WebAssembly\s*\.\s*compile/);
  });

  it("3. WebAssembly.instantiate is never actually invoked at runtime", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      const boundary = createFedosWasmBoundary();
      boundary.planLoad();
      boundary.planEncrypt({ operation: "encrypt" });
      boundary.planDecrypt({ operation: "decrypt" });
    } finally {
      instantiate.mockRestore();
      compile.mockRestore();
    }
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
  });

  it("4. no wasm-bindgen reference anywhere in the WASM Boundary file", () => {
    expect(codeOnlyOf(wasmBoundarySource)).not.toMatch(/wasm-bindgen/i);
  });

  it("5. no FFI reference anywhere in the WASM Boundary file", () => {
    expect(codeOnlyOf(wasmBoundarySource)).not.toMatch(/\bffi\b/i);
  });

  it("6. no Native Addon reference anywhere in the WASM Boundary file", () => {
    const codeOnly = codeOnlyOf(wasmBoundarySource);
    expect(codeOnly).not.toMatch(/native.?addon/i);
    expect(codeOnly).not.toMatch(/\bnapi\b/i);
    expect(codeOnly).not.toMatch(/\.node['"`]/);
  });

  it("7. no CLI/subprocess reference anywhere in the WASM Boundary file", () => {
    const codeOnly = codeOnlyOf(wasmBoundarySource);
    expect(codeOnly).not.toMatch(/child_process/i);
    expect(codeOnly).not.toMatch(/\bspawn\s*\(/);
    expect(codeOnly).not.toMatch(/\bexec\s*\(/);
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

  it("9. planEncrypt/planDecrypt of the Rust Invocation Adapter still always resolve BlockedByImplementation, untouched by the new WASM wiring", () => {
    const adapter = new FedosRustInvocationAdapterPlaceholder();
    expect(adapter.planEncrypt({ kind: "Encrypt" }).state).toBe("BlockedByImplementation");
    expect(adapter.planDecrypt({ kind: "Decrypt" }).state).toBe("BlockedByImplementation");
  });

  it("10. Rust invocation adapter wires to the WASM boundary THROUGH the Execution Backend (Stage 403) -- no longer directly", () => {
    expect(invocationAdapterSource).not.toMatch(/from\s*"\.\/fedos_wasm_boundary\.js"/);
    expect(invocationAdapterSource).toMatch(/from\s*"\.\/fedos_execution_backend\.js"/);
    expect(invocationAdapterSource).toMatch(/\.planLoad\(\)/);
    expect(wasmBoundarySource).toMatch(/export function createFedosWasmBoundary/);
  });

  it("11. no Rust crypto is ever called -- no fedos-core-rust reference in the WASM Boundary file", () => {
    expect(codeOnlyOf(wasmBoundarySource)).not.toMatch(/fedos-core-rust/i);
  });

  it("12. no crate::crypto / crypto module reference anywhere in the WASM Boundary file", () => {
    const codeOnly = codeOnlyOf(wasmBoundarySource);
    expect(codeOnly).not.toMatch(/crate::crypto/);
    expect(codeOnly).not.toMatch(/\bcrypto\b/i);
  });

  it("13. no NIP-44 reference anywhere in the WASM Boundary file", () => {
    expect(codeOnlyOf(wasmBoundarySource)).not.toMatch(/nip-?44/i);
  });

  it("14. SecretHandle is hidden from the WASM Boundary file", () => {
    expect(codeOnlyOf(wasmBoundarySource)).not.toMatch(/SecretHandle/);
  });

  it("15. ConversationKey is hidden from the WASM Boundary file", () => {
    expect(codeOnlyOf(wasmBoundarySource)).not.toMatch(/ConversationKey/);
  });

  it("16. MessageKey is hidden from the WASM Boundary file", () => {
    expect(codeOnlyOf(wasmBoundarySource)).not.toMatch(/MessageKey/);
  });

  it("17. WirePayload is hidden from the WASM Boundary file", () => {
    expect(codeOnlyOf(wasmBoundarySource)).not.toMatch(/WirePayload/);
  });

  it("18. no compiled/native artifact exists -- no .wasm/.node/.dll/.so/.dylib anywhere in packages/fedos-core-rust", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../packages/fedos-core-rust/**/*");
    const paths = Object.keys(files);
    const forbidden = /\.(wasm|rlib|so|dll|dylib|node|a|o)$/i;
    for (const path of paths) {
      expect(forbidden.test(path), `unexpected compiled/native artifact: ${path}`).toBe(false);
    }
  });

  it("19. Allowed is still unreachable from either activation policy, even with both locks open", () => {
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

  it("20. no Runtime activation -- create_runtime.ts never calls planLoad or any plan*/review*/evaluate* function", () => {
    expect(createRuntimeSource).not.toMatch(
      /planLoad|planPing|planExecution|planEncrypt|planDecrypt|planRustEncrypt|planRustDecrypt|planRustApiEncrypt|planRustApiDecrypt|reviewEncrypt|reviewDecrypt|planFedosInternalRustCall|evaluateFedosInternalRustCall|planFedosRustInvocationAdapterExecution|createFedosWasmBoundary|createExecutionBackend|planBackend/,
    );
  });

  it("21. no Worker activation -- src/worker.ts still doesn't import the WASM Boundary or any earlier chain link", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_boundary|fedos_execution_backend|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api|fedos_runtime_crypto_provider/,
    );
  });

  it("22. Cargo.toml/package.json/Rust public API are unchanged", () => {
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

    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(pubFnNames.length).toBe(50);
  });

  it("23. diagnostics expose wasmBoundaryState/wasmBoundaryReachable/wasmLoaded without constructing an instance", () => {
    expect(fedosWasmBoundaryState()).toBe("NotLoaded");
    expect(fedosWasmBoundaryReachable()).toBe(true);
    expect(fedosWasmLoaded()).toBe(false);

    const status = runtimeCryptoActivationStatus();
    expect(status.wasmBoundaryState).toBe("NotLoaded");
    expect(status.wasmBoundaryReachable).toBe(true);
    expect(status.wasmLoaded).toBe(false);

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.wasmBoundaryState).toBe("NotLoaded");
    expect(workerStatus.wasmBoundaryReachable).toBe(true);
    expect(workerStatus.wasmLoaded).toBe(false);
  });

  it("24. no process.env reference in the WASM Boundary file", () => {
    expect(codeOnlyOf(wasmBoundarySource)).not.toMatch(/process\.env/);
  });
});
