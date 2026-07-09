import { describe, it, expect, vi } from "vitest";
import {
  FedosExecutionBackendPlaceholder,
  createExecutionBackend,
  fedosExecutionBackendImplemented,
  fedosExecutionBackendKind,
  fedosExecutionBackendReachable,
  fedosExecutionBackendState,
} from "../src/runtime/fedos_execution_backend.js";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import { FedosRustInvocationAdapterPlaceholder } from "../src/runtime/fedos_rust_invocation_adapter.js";
import { FedosWasmBoundaryPlaceholder } from "../src/runtime/fedos_wasm_boundary.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionBackendSource from "../src/runtime/fedos_execution_backend.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import invocationAdapterSource from "../src/runtime/fedos_rust_invocation_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmBoundarySource from "../src/runtime/fedos_wasm_boundary.ts?raw";
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
 * Stage 401–408 — "FedOS Execution Backend Architecture": FedOS Core
 * (Rust) is formalized as backend-agnostic, and the Execution Backend
 * (`src/runtime/fedos_execution_backend.ts`, Stage 402) becomes the
 * swappable interface between it and any Runtime. WASM
 * (`fedos_wasm_boundary.ts`, Stage 386, UNCHANGED) is the first
 * implementation candidate, now reached THROUGH the Execution Backend
 * (Stage 403) instead of directly from the Rust Invocation Adapter.
 * Native/Desktop and Mobile are named as future candidates with NO
 * code, dependency, or file anywhere in this repository.
 */
describe("FedOS Execution Backend, not connected, fail-closed everywhere (Stage 401-408)", () => {
  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
  }

  it("1. Backend abstraction only -- planBackend()/planLoad() always resolve Planning, status() always NotConnected", () => {
    const backend = new FedosExecutionBackendPlaceholder();
    expect(backend.status().state).toBe("NotConnected");

    const selection = backend.planBackend();
    expect(selection.backend).toBe("Wasm");
    expect(selection.state).toBe("Planning");

    const decision = backend.planLoad();
    expect(decision.operation).toBe("load");
    expect(decision.backend).toBe("Wasm");
    expect(decision.state).toBe("Planning");
  });

  it("2. no WASM is generated -- no WebAssembly.instantiate/compile reference in the Execution Backend file", () => {
    const codeOnly = codeOnlyOf(executionBackendSource);
    expect(codeOnly).not.toMatch(/WebAssembly\s*\.\s*instantiate/);
    expect(codeOnly).not.toMatch(/WebAssembly\s*\.\s*compile/);
  });

  it("3. WebAssembly.instantiate/compile are never actually invoked at runtime", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      const backend = createExecutionBackend();
      backend.status();
      backend.planBackend();
      backend.planLoad();
    } finally {
      instantiate.mockRestore();
      compile.mockRestore();
    }
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
  });

  it("4. no wasm-bindgen/wasm-pack reference anywhere in the Execution Backend file", () => {
    const codeOnly = codeOnlyOf(executionBackendSource);
    expect(codeOnly).not.toMatch(/wasm-bindgen/i);
    expect(codeOnly).not.toMatch(/wasm-pack/i);
  });

  it("5. no 'cargo build --target wasm32' reference anywhere in the Execution Backend file", () => {
    const codeOnly = codeOnlyOf(executionBackendSource);
    expect(codeOnly).not.toMatch(/cargo\s+build/i);
    expect(codeOnly).not.toMatch(/wasm32/i);
  });

  it("6. no Native backend generation -- no Native Addon/FFI/native toolchain reference anywhere in the Execution Backend file", () => {
    const codeOnly = codeOnlyOf(executionBackendSource);
    expect(codeOnly).not.toMatch(/\bffi\b/i);
    expect(codeOnly).not.toMatch(/native.?addon/i);
    expect(codeOnly).not.toMatch(/\bnapi\b/i);
    expect(codeOnly).not.toMatch(/\.node['"`]/);
    expect(codeOnly).not.toMatch(/node-gyp/i);
  });

  it("7. no CLI/subprocess reference anywhere in the Execution Backend file", () => {
    const codeOnly = codeOnlyOf(executionBackendSource);
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

  it("9. planEncrypt/planDecrypt of the Rust Invocation Adapter and WASM Boundary are unchanged, untouched by the new Execution Backend wiring", () => {
    const adapter = new FedosRustInvocationAdapterPlaceholder();
    expect(adapter.planEncrypt({ kind: "Encrypt" }).state).toBe("BlockedByImplementation");
    expect(adapter.planDecrypt({ kind: "Decrypt" }).state).toBe("BlockedByImplementation");

    const boundary = new FedosWasmBoundaryPlaceholder();
    expect(boundary.planEncrypt({ operation: "encrypt" }).state).toBe("BlockedByImplementation");
    expect(boundary.planDecrypt({ operation: "decrypt" }).state).toBe("BlockedByImplementation");
  });

  it("10. the Rust Invocation Adapter wires to the Execution Backend, not the WASM Boundary directly", () => {
    expect(invocationAdapterSource).toMatch(/from\s*"\.\/fedos_execution_backend\.js"/);
    expect(invocationAdapterSource).not.toMatch(/from\s*"\.\/fedos_wasm_boundary\.js"/);
    expect(invocationAdapterSource).toMatch(/\.planLoad\(\)/);
  });

  it("11. the Execution Backend wires to the WASM Boundary's planLoad() only, and the WASM Boundary file itself is untouched", () => {
    expect(executionBackendSource).toMatch(/from\s*"\.\/fedos_wasm_boundary\.js"/);
    expect(executionBackendSource).toMatch(/\.planLoad\(\)/);
    expect(wasmBoundarySource).toMatch(/export function createFedosWasmBoundary/);
  });

  it("12. no Rust crypto is ever called -- no fedos-core-rust / crate::crypto / bare 'crypto' reference in the Execution Backend file", () => {
    const codeOnly = codeOnlyOf(executionBackendSource);
    expect(codeOnly).not.toMatch(/fedos-core-rust/i);
    expect(codeOnly).not.toMatch(/crate::crypto/);
    expect(codeOnly).not.toMatch(/\bcrypto\b/i);
  });

  it("13. no NIP-44 reference anywhere in the Execution Backend file", () => {
    expect(codeOnlyOf(executionBackendSource)).not.toMatch(/nip-?44/i);
  });

  it("14. SecretHandle/ConversationKey/MessageKey/WirePayload are hidden from the Execution Backend file", () => {
    const codeOnly = codeOnlyOf(executionBackendSource);
    expect(codeOnly).not.toMatch(/SecretHandle/);
    expect(codeOnly).not.toMatch(/ConversationKey/);
    expect(codeOnly).not.toMatch(/MessageKey/);
    expect(codeOnly).not.toMatch(/WirePayload/);
  });

  it("15. no compiled/native artifact exists -- no .wasm/.node/.dll/.so/.dylib anywhere in packages/fedos-core-rust", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../packages/fedos-core-rust/**/*");
    const paths = Object.keys(files);
    const forbidden = /\.(wasm|rlib|so|dll|dylib|node|a|o)$/i;
    for (const path of paths) {
      expect(forbidden.test(path), `unexpected compiled/native artifact: ${path}`).toBe(false);
    }
  });

  it("16. Allowed is still unreachable from either activation policy, even with both locks open", () => {
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

  it("17. no Runtime activation -- create_runtime.ts never calls createExecutionBackend/planBackend/planLoad or any earlier plan*/review*/evaluate* function", () => {
    expect(createRuntimeSource).not.toMatch(
      /planLoad|planBackend|createExecutionBackend|planPing|planExecution|planEncrypt|planDecrypt|planRustEncrypt|planRustDecrypt|planRustApiEncrypt|planRustApiDecrypt|reviewEncrypt|reviewDecrypt|planFedosInternalRustCall|evaluateFedosInternalRustCall|planFedosRustInvocationAdapterExecution|createFedosWasmBoundary|createFedosWasmArtifact/,
    );
  });

  it("18. no Worker activation -- src/worker.ts still doesn't import the Execution Backend or any earlier chain link", () => {
    expect(workerSource).not.toMatch(
      /fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api|fedos_runtime_crypto_provider/,
    );
  });

  it("19. Cargo.toml/package.json/Rust public API are unchanged", () => {
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
    expect(pubFnNames.length).toBe(30);
  });

  it("20. FEDOS_RUNTIME_PROVIDER_IMPLEMENTED is untouched -- still fixed false", async () => {
    const module = await import("../src/runtime/fedos_runtime_crypto_provider.js");
    expect(module.FEDOS_RUNTIME_PROVIDER_IMPLEMENTED).toBe(false);
  });

  it("21. diagnostics expose executionBackend/executionBackendState/executionBackendReachable/backendImplemented without constructing an instance", () => {
    expect(fedosExecutionBackendKind()).toBe("Wasm");
    expect(fedosExecutionBackendState()).toBe("Planning");
    expect(fedosExecutionBackendReachable()).toBe(true);
    expect(fedosExecutionBackendImplemented()).toBe(false);

    const status = runtimeCryptoActivationStatus();
    expect(status.executionBackend).toBe("Wasm");
    expect(status.executionBackendState).toBe("Planning");
    expect(status.executionBackendReachable).toBe(true);
    expect(status.backendImplemented).toBe(false);

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.executionBackend).toBe("Wasm");
    expect(workerStatus.executionBackendState).toBe("Planning");
    expect(workerStatus.executionBackendReachable).toBe(true);
    expect(workerStatus.backendImplemented).toBe(false);
  });

  it("22. no process.env reference in the Execution Backend file", () => {
    expect(codeOnlyOf(executionBackendSource)).not.toMatch(/process\.env/);
  });
});
