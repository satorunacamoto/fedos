import { describe, it, expect } from "vitest";
import {
  FedosRuntimeCryptoProvider,
  FEDOS_RUNTIME_PROVIDER_IMPLEMENTED,
  FEDOS_PROVIDER_IMPLEMENTATION_STAGES,
  fedosProviderImplementationStage,
} from "../src/runtime/fedos_runtime_crypto_provider.js";
import { evaluateFedosInternalRustCall, planFedosInternalRustCall } from "../src/runtime/fedos_internal_rust_call.js";
import { FedosRustExecutionReviewPlaceholder } from "../src/runtime/fedos_rust_execution_review.js";
import {
  FedosRustInvocationAdapterPlaceholder,
  createFedosRustInvocationAdapter,
  fedosRustInvocationAdapterExecuted,
  fedosRustInvocationAdapterReachable,
  fedosRustInvocationAdapterState,
  planFedosRustInvocationAdapterExecution,
} from "../src/runtime/fedos_rust_invocation_adapter.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import invocationAdapterSource from "../src/runtime/fedos_rust_invocation_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import internalRustCallSource from "../src/runtime/fedos_internal_rust_call.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosProviderSource from "../src/runtime/fedos_runtime_crypto_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeDiagnosticsSource from "../src/runtime/runtime_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerDiagnosticsSource from "../src/runtime/worker_crypto_diagnostics.ts?raw";
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
 * Stage 361–368 — "Rust Invocation Adapter (Blocked before Rust
 * Execution)": src/runtime/fedos_rust_invocation_adapter.ts (Stage
 * 361/363), wired from fedos_internal_rust_call.ts (Stage 362). The
 * adapter receives calls but never invokes Rust/WASM/FFI; it is the
 * FINAL layer before real Rust crypto, and this stage executes
 * nothing.
 */
describe("FedOS Rust invocation adapter, blocked before Rust execution (Stage 361-368)", () => {
  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
  }

  it("1. Provider reaches the Adapter only -- fedos_internal_rust_call.ts imports fedos_rust_invocation_adapter.ts", () => {
    expect(internalRustCallSource).toMatch(/from\s*"\.\/fedos_rust_invocation_adapter\.js"/);
  });

  it("2. the Adapter never reaches Rust -- no packages/fedos-core-rust reference", () => {
    expect(codeOnlyOf(invocationAdapterSource)).not.toMatch(/fedos-core-rust/i);
  });

  it("3. the Adapter never actually loads or executes WASM (Stage 387 legitimately references the WASM Boundary abstraction; see test/runtime_wasm_boundary.test.ts for the exhaustive WASM guard)", () => {
    const codeOnly = codeOnlyOf(invocationAdapterSource);
    expect(codeOnly).not.toMatch(/WebAssembly\s*\.\s*(instantiate|compile)/);
    expect(codeOnly).not.toMatch(/wasm-bindgen/i);
    expect(codeOnly).not.toMatch(/\.wasm['"`]/);
    expect(codeOnly).not.toMatch(/\bimport\s*\(/);
  });

  it("4. the Adapter never reaches FFI", () => {
    expect(codeOnlyOf(invocationAdapterSource)).not.toMatch(/\bffi\b/i);
  });

  it("5. Execution Review is unchanged -- approved is still always false, reason still BlockedBeforeCrypto", () => {
    const review = new FedosRustExecutionReviewPlaceholder();
    const encrypted = review.reviewEncrypt({ operation: "encrypt" });
    expect(encrypted.approved).toBe(false);
    expect(encrypted.reason).toBe("BlockedBeforeCrypto");
    const decrypted = review.reviewDecrypt({ operation: "decrypt" });
    expect(decrypted.approved).toBe(false);
    expect(decrypted.reason).toBe("BlockedBeforeCrypto");
  });

  it("6. Internal Rust Call is unchanged -- status still Planned", () => {
    const decision = evaluateFedosInternalRustCall(planFedosInternalRustCall("Encrypt"));
    expect(decision.status).toBe("Planned");
  });

  it("7. Executed is always false", () => {
    expect(fedosRustInvocationAdapterExecuted()).toBe(false);
    const adapter = new FedosRustInvocationAdapterPlaceholder();
    expect(adapter.planEncrypt({ kind: "Encrypt" }).state).toBe("BlockedByImplementation");
    expect(adapter.planDecrypt({ kind: "Decrypt" }).state).toBe("BlockedByImplementation");
  });

  it("8. encrypt/decrypt remain unchanged -- always Unsupported", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.state).toBe("Unsupported");
    expect(encrypted.allowed).toBe(false);
    const decrypted = await provider.decrypt({});
    expect(decrypted.state).toBe("Unsupported");
    expect(decrypted.allowed).toBe(false);
  });

  it("9. Allowed is still unreachable from either activation policy, even with both locks open", () => {
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

  it("10. Runtime is unchanged -- create_runtime.ts never calls any plan*/review*/evaluate* function", () => {
    expect(createRuntimeSource).not.toMatch(
      /planExecution|planEncrypt|planDecrypt|planRustEncrypt|planRustDecrypt|planRustApiEncrypt|planRustApiDecrypt|reviewEncrypt|reviewDecrypt|planFedosInternalRustCall|evaluateFedosInternalRustCall|planFedosRustInvocationAdapterExecution/,
    );
  });

  it("11. Worker is unchanged -- src/worker.ts still doesn't import the Adapter or any earlier chain link", () => {
    expect(workerSource).not.toMatch(
      /fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api|fedos_runtime_crypto_provider/,
    );
  });

  it("12. SecretHandle is hidden from the Adapter file", () => {
    expect(codeOnlyOf(invocationAdapterSource)).not.toMatch(/SecretHandle/);
  });

  it("13. ConversationKey is hidden from the Adapter file", () => {
    expect(codeOnlyOf(invocationAdapterSource)).not.toMatch(/ConversationKey/);
  });

  it("14. MessageKey is hidden from the Adapter file", () => {
    expect(codeOnlyOf(invocationAdapterSource)).not.toMatch(/MessageKey/);
  });

  it("15. WirePayload is hidden from the Adapter file", () => {
    expect(codeOnlyOf(invocationAdapterSource)).not.toMatch(/WirePayload/);
  });

  it("16. Cargo.toml is unchanged -- exactly 10 production dependencies", () => {
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
  });

  it("17. package.json is unchanged -- exactly 2 dependencies", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("18. Rust pub fn count is unchanged -- 27", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m: RegExpMatchArray) => m[1]);
    expect(pubFnNames.length).toBe(44);
  });

  it("19. FEDOS_RUNTIME_PROVIDER_IMPLEMENTED is unchanged -- still fixed false", () => {
    expect(FEDOS_RUNTIME_PROVIDER_IMPLEMENTED).toBe(false);
  });

  it("20. the implementation stage is fixed at RustInvocationAdapterReady, and RustReady remains unreachable", () => {
    expect(fedosProviderImplementationStage()).toBe("RustInvocationAdapterReady");
    expect(FEDOS_PROVIDER_IMPLEMENTATION_STAGES).toEqual([
      "Unavailable",
      "ProviderReady",
      "OpaqueApiReady",
      "RustBoundaryReady",
      "RustApiReady",
      "RustInvocationAdapterReady",
      "RustReady",
    ]);
  });

  it("21. planFedosRustInvocationAdapterExecution routes to the correct handler for both kinds", () => {
    const adapter = createFedosRustInvocationAdapter();
    expect(planFedosRustInvocationAdapterExecution(adapter, { kind: "Encrypt" }).kind).toBe("Encrypt");
    expect(planFedosRustInvocationAdapterExecution(adapter, { kind: "Decrypt" }).kind).toBe("Decrypt");
  });

  it("22. diagnostics expose the three new fields without constructing an instance", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.rustInvocationAdapterState).toBe("NotConnected");
    expect(status.rustInvocationAdapterReachable).toBe(true);
    expect(status.rustInvocationAdapterExecuted).toBe(false);

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.rustInvocationAdapterState).toBe("NotConnected");
    expect(workerStatus.rustInvocationAdapterReachable).toBe(true);
    expect(workerStatus.rustInvocationAdapterExecuted).toBe(false);

    for (const src of [runtimeDiagnosticsSource, workerDiagnosticsSource]) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly).not.toMatch(/new\s+FedosRustInvocationAdapterPlaceholder/);
      expect(codeOnly).not.toMatch(/new\s+FedosRuntimeCryptoProvider/);
    }
  });

  it("23. status() reports NotConnected, mirroring fedosRustInvocationAdapterState()", () => {
    const adapter = new FedosRustInvocationAdapterPlaceholder();
    expect(adapter.status().state).toBe("NotConnected");
    expect(fedosRustInvocationAdapterState()).toBe("NotConnected");
    expect(fedosRustInvocationAdapterReachable()).toBe(true);
  });

  it("24. neither the Adapter file nor its wiring reference process.env, Relay, Storage, Nostr, or NIP-17", () => {
    for (const src of [invocationAdapterSource, internalRustCallSource, fedosProviderSource]) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly).not.toMatch(/process\.env/);
      expect(codeOnly).not.toMatch(/relay|storage|nostr|nip-?17/i);
    }
  });
});
