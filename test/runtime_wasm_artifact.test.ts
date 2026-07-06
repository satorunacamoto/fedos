import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import { FedosRustInvocationAdapterPlaceholder } from "../src/runtime/fedos_rust_invocation_adapter.js";
import {
  FedosWasmArtifactPlaceholder,
  createFedosWasmArtifact,
  fedosWasmArtifactBuilt,
  fedosWasmArtifactReachable,
  fedosWasmArtifactState,
} from "../src/runtime/fedos_wasm_artifact.js";
import { FedosWasmBoundaryPlaceholder } from "../src/runtime/fedos_wasm_boundary.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmArtifactSource from "../src/runtime/fedos_wasm_artifact.ts?raw";
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
 * Stage 393–400 — "FedOS Rust -> WASM build architecture: WASM
 * Artifact (Not Built)": docs/runtime_wasm_build_plan.md (Stage 393)
 * is planning only; src/runtime/fedos_wasm_artifact.ts (Stage 394)
 * models the "build" step as a placeholder that never builds
 * anything; Stage 395 wires the WASM Boundary's planLoad() to reach
 * it via planBuild() only.
 */
describe("FedOS WASM artifact, not built, fail-closed everywhere (Stage 393-400)", () => {
  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
  }

  it("1. no WASM is generated -- planBuild() always resolves BlockedByImplementation, status() always NotBuilt", () => {
    const artifact = new FedosWasmArtifactPlaceholder();
    expect(artifact.status().state).toBe("NotBuilt");
    const decision = artifact.planBuild();
    expect(decision.operation).toBe("build");
    expect(decision.state).toBe("BlockedByImplementation");
  });

  it("2. no .wasm file exists anywhere in packages/fedos-core-rust", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../packages/fedos-core-rust/**/*");
    const paths = Object.keys(files);
    for (const path of paths) {
      expect(/\.wasm$/i.test(path), `unexpected WASM binary: ${path}`).toBe(false);
    }
  });

  it("3. no wasm-pack reference anywhere in the WASM Artifact file", () => {
    expect(codeOnlyOf(wasmArtifactSource)).not.toMatch(/wasm-pack/i);
  });

  it("4. no wasm-bindgen reference anywhere in the WASM Artifact file", () => {
    expect(codeOnlyOf(wasmArtifactSource)).not.toMatch(/wasm-bindgen/i);
  });

  it("5. no 'cargo build --target wasm32' reference anywhere in the WASM Artifact file, and it is never actually invoked", () => {
    const codeOnly = codeOnlyOf(wasmArtifactSource);
    expect(codeOnly).not.toMatch(/cargo\s+build/i);
    expect(codeOnly).not.toMatch(/wasm32/i);
    expect(codeOnly).not.toMatch(/child_process/i);
    expect(codeOnly).not.toMatch(/\bspawn\s*\(/);
    expect(codeOnly).not.toMatch(/\bexec\s*\(/);
  });

  it("6. no WebAssembly.instantiate call anywhere in the WASM Artifact file", () => {
    expect(codeOnlyOf(wasmArtifactSource)).not.toMatch(/WebAssembly\s*\.\s*instantiate/);
  });

  it("7. no WebAssembly.compile call anywhere in the WASM Artifact file", () => {
    expect(codeOnlyOf(wasmArtifactSource)).not.toMatch(/WebAssembly\s*\.\s*compile/);
  });

  it("7a. WebAssembly.instantiate/compile are never actually invoked at runtime", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      const artifact = createFedosWasmArtifact();
      artifact.planBuild();
      artifact.planLoad();
      const boundary = new FedosWasmBoundaryPlaceholder();
      boundary.planLoad();
    } finally {
      instantiate.mockRestore();
      compile.mockRestore();
    }
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
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

  it("9. planEncrypt/planDecrypt of the Rust Invocation Adapter and WASM Boundary are unchanged, untouched by the new Artifact wiring", () => {
    const adapter = new FedosRustInvocationAdapterPlaceholder();
    expect(adapter.planEncrypt({ kind: "Encrypt" }).state).toBe("BlockedByImplementation");
    expect(adapter.planDecrypt({ kind: "Decrypt" }).state).toBe("BlockedByImplementation");

    const boundary = new FedosWasmBoundaryPlaceholder();
    expect(boundary.planEncrypt({ operation: "encrypt" }).state).toBe("BlockedByImplementation");
    expect(boundary.planDecrypt({ operation: "decrypt" }).state).toBe("BlockedByImplementation");
  });

  it("10. the WASM Boundary wires to the Artifact's planBuild() only", () => {
    expect(wasmBoundarySource).toMatch(/from\s*"\.\/fedos_wasm_artifact\.js"/);
    expect(wasmBoundarySource).toMatch(/\.planBuild\(\)/);
  });

  it("11. no Rust crypto is ever called -- no fedos-core-rust reference in the WASM Artifact file", () => {
    expect(codeOnlyOf(wasmArtifactSource)).not.toMatch(/fedos-core-rust/i);
  });

  it("12. no crate::crypto / crypto module reference anywhere in the WASM Artifact file", () => {
    const codeOnly = codeOnlyOf(wasmArtifactSource);
    expect(codeOnly).not.toMatch(/crate::crypto/);
    expect(codeOnly).not.toMatch(/\bcrypto\b/i);
  });

  it("13. no NIP-44 reference anywhere in the WASM Artifact file", () => {
    expect(codeOnlyOf(wasmArtifactSource)).not.toMatch(/nip-?44/i);
  });

  it("14. SecretHandle/ConversationKey/MessageKey/WirePayload are hidden from the WASM Artifact file", () => {
    const codeOnly = codeOnlyOf(wasmArtifactSource);
    expect(codeOnly).not.toMatch(/SecretHandle/);
    expect(codeOnly).not.toMatch(/ConversationKey/);
    expect(codeOnly).not.toMatch(/MessageKey/);
    expect(codeOnly).not.toMatch(/WirePayload/);
  });

  it("15. Runtime is unchanged -- create_runtime.ts never calls planBuild or any plan*/review*/evaluate* function", () => {
    expect(createRuntimeSource).not.toMatch(
      /planBuild|planLoad|planPing|planExecution|planEncrypt|planDecrypt|planRustEncrypt|planRustDecrypt|planRustApiEncrypt|planRustApiDecrypt|reviewEncrypt|reviewDecrypt|planFedosInternalRustCall|evaluateFedosInternalRustCall|planFedosRustInvocationAdapterExecution|createFedosWasmBoundary|createFedosWasmArtifact|createExecutionBackend|planBackend/,
    );
  });

  it("16. Worker is unchanged -- src/worker.ts still doesn't import the WASM Artifact or any earlier chain link", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_artifact|fedos_wasm_boundary|fedos_execution_backend|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api|fedos_runtime_crypto_provider/,
    );
  });

  it("17. Allowed is still unreachable from either activation policy, even with both locks open", () => {
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

  it("18. Cargo.toml/package.json/Rust public API are unchanged", () => {
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

    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(pubFnNames.length).toBe(27);
  });

  it("19. FEDOS_RUNTIME_PROVIDER_IMPLEMENTED is untouched -- still fixed false", async () => {
    const module = await import("../src/runtime/fedos_runtime_crypto_provider.js");
    expect(module.FEDOS_RUNTIME_PROVIDER_IMPLEMENTED).toBe(false);
  });

  it("20. diagnostics expose wasmArtifactState/wasmArtifactReachable/wasmArtifactBuilt without constructing an instance", () => {
    expect(fedosWasmArtifactState()).toBe("NotBuilt");
    expect(fedosWasmArtifactReachable()).toBe(true);
    expect(fedosWasmArtifactBuilt()).toBe(false);

    const status = runtimeCryptoActivationStatus();
    expect(status.wasmArtifactState).toBe("NotBuilt");
    expect(status.wasmArtifactReachable).toBe(true);
    expect(status.wasmArtifactBuilt).toBe(false);

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.wasmArtifactState).toBe("NotBuilt");
    expect(workerStatus.wasmArtifactReachable).toBe(true);
    expect(workerStatus.wasmArtifactBuilt).toBe(false);
  });

  it("21. no process.env reference in the WASM Artifact file", () => {
    expect(codeOnlyOf(wasmArtifactSource)).not.toMatch(/process\.env/);
  });

  it("22. no FFI/Native Addon reference anywhere in the WASM Artifact file", () => {
    const codeOnly = codeOnlyOf(wasmArtifactSource);
    expect(codeOnly).not.toMatch(/\bffi\b/i);
    expect(codeOnly).not.toMatch(/native.?addon/i);
    expect(codeOnly).not.toMatch(/\bnapi\b/i);
  });
});
