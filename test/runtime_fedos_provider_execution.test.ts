import { describe, it, expect } from "vitest";
import {
  FedosRuntimeCryptoProvider,
  FEDOS_RUNTIME_PROVIDER_IMPLEMENTED,
  FEDOS_RUNTIME_EXECUTION_STATES,
  fedosProviderExecutionState,
  fedosProviderImplementationState,
  fedosProviderOperationState,
} from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  planFedosRuntimeOperation,
  evaluateFedosRuntimeOperation,
} from "../src/runtime/fedos_runtime_operation.js";
import { buildOpaqueRequestFromOperation } from "../src/runtime/fedos_runtime_opaque_request.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import operationSource from "../src/runtime/fedos_runtime_operation.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import opaqueRequestSource from "../src/runtime/fedos_runtime_opaque_request.ts?raw";
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
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionDocSource from "../docs/runtime_fedos_provider_execution.md?raw";

/**
 * Stage 313–320 — "FedOS Provider Internal Execution Design (Blocked)":
 * src/runtime/fedos_runtime_operation.ts (Stage 313),
 * src/runtime/fedos_runtime_opaque_request.ts (Stage 314),
 * FedosRuntimeCryptoProvider's #planInternalExecution/planExecution
 * (Stage 315/316), three standalone diagnostics-facing state functions
 * (Stage 317). The chain always terminates before FedOS -- no Rust,
 * WASM, Runtime, or Worker call anywhere in this chain.
 */
describe("FedOS provider internal execution design, blocked (Stage 313-320)", () => {
  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
  }

  const NEW_PRODUCTION_FILES: [string, string][] = [
    ["fedos_runtime_operation.ts", operationSource],
    ["fedos_runtime_opaque_request.ts", opaqueRequestSource],
    ["fedos_runtime_crypto_provider.ts", fedosProviderSource],
  ];

  it("1. no Rust/WASM invocation anywhere in the new execution-chain files", () => {
    for (const [name, src] of NEW_PRODUCTION_FILES) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly, name).not.toMatch(/fedos-core-rust/i);
      expect(codeOnly, name).not.toMatch(/wasm/i);
      expect(codeOnly, name).not.toMatch(/\bffi\b/i);
    }
  });

  it("2. no Runtime invocation -- create_runtime.ts never calls planExecution/encrypt/decrypt", () => {
    expect(createRuntimeSource).not.toMatch(/planExecution/);
    expect(createRuntimeSource).not.toMatch(/\.\s*(encrypt|decrypt)\s*\(/);
  });

  it("3. no Worker invocation -- src/worker.ts still doesn't import any of the new files", () => {
    expect(workerSource).not.toMatch(
      /fedos_runtime_operation|fedos_runtime_opaque_request|fedos_runtime_crypto_provider/,
    );
  });

  it("4. no SecretHandle/ConversationKey/MessageKey/WirePayload leakage in any new file", () => {
    for (const [name, src] of NEW_PRODUCTION_FILES) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly, name).not.toMatch(/SecretHandle/);
      expect(codeOnly, name).not.toMatch(/ConversationKey/);
      expect(codeOnly, name).not.toMatch(/MessageKey/);
      expect(codeOnly, name).not.toMatch(/WirePayload/);
    }
  });

  it("5. FedosRuntimeOperation/FedosOpaqueRequest carry no plaintext/ciphertext byte -- only kind/operation labels and optional opaque handle strings", () => {
    const operation = planFedosRuntimeOperation("encrypt");
    expect(operation).toEqual({ kind: "encrypt" });
    const opaque = buildOpaqueRequestFromOperation(operation);
    expect(opaque).toEqual({ operation: "encrypt" });
    expect(JSON.stringify(opaque)).not.toMatch(/key|secret|plaintext|ciphertext/i);
  });

  it("6. evaluateFedosRuntimeOperation always resolves Blocked", () => {
    for (const kind of ["encrypt", "decrypt"] as const) {
      const decision = evaluateFedosRuntimeOperation(planFedosRuntimeOperation(kind));
      expect(decision.status).toBe("Blocked");
    }
  });

  it("7. execution is always blocked -- planExecution always resolves BlockedByImplementation, for both operation kinds", () => {
    const provider = new FedosRuntimeCryptoProvider();
    for (const kind of ["encrypt", "decrypt"] as const) {
      const decision = provider.planExecution(kind);
      expect(decision.state).toBe("BlockedByImplementation");
      expect(decision.operation).toBe(kind);
    }
    expect(FEDOS_RUNTIME_EXECUTION_STATES).toEqual([
      "BlockedByActivation",
      "BlockedByImplementation",
      "ReadyForOpaqueExecution",
    ]);
  });

  it("8. the three standalone state functions agree with the instance methods and each other", () => {
    const provider = new FedosRuntimeCryptoProvider();
    expect(fedosProviderImplementationState()).toBe(provider.decisionReason());
    expect(fedosProviderImplementationState()).toBe("NotImplemented");
    expect(fedosProviderExecutionState()).toBe("BlockedByImplementation");
    expect(fedosProviderOperationState()).toBe("Blocked");
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

  it("10. the implementation flag is unchanged -- still fixed false, no env parameter anywhere", () => {
    expect(FEDOS_RUNTIME_PROVIDER_IMPLEMENTED).toBe(false);
    for (const [name, src] of NEW_PRODUCTION_FILES) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly, name).not.toMatch(/process\.env/);
      expect(codeOnly, name).not.toMatch(/RuntimeEnv/);
    }
  });

  it("11. encrypt()/decrypt() remain unchanged -- always Unsupported, never called by the new execution chain", () => {
    expect(codeOnlyOf(operationSource)).not.toMatch(/\.\s*(encrypt|decrypt)\s*\(/);
    expect(codeOnlyOf(opaqueRequestSource)).not.toMatch(/\.\s*(encrypt|decrypt)\s*\(/);
  });

  it("12. diagnostics expose the three new fields without constructing a provider, and they never leak a request or secret", async () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.providerImplementationState).toBe("NotImplemented");
    expect(status.providerExecutionState).toBe("BlockedByImplementation");
    expect(status.providerOperationState).toBe("Blocked");

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.providerImplementationState).toBe("NotImplemented");
    expect(workerStatus.providerExecutionState).toBe("BlockedByImplementation");
    expect(workerStatus.providerOperationState).toBe("Blocked");

    for (const src of [runtimeDiagnosticsSource, workerDiagnosticsSource]) {
      expect(codeOnlyOf(src)).not.toMatch(/planExecution|buildOpaqueRequestFromOperation|new\s+FedosRuntimeCryptoProvider/);
    }
  });

  it("13. dependency counts unchanged -- Cargo.toml (10) and package.json (2) dependencies, Rust pub fn surface (27)", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m: RegExpMatchArray) => m[1]);
    expect(pubFnNames.length).toBe(30);

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

  it("14. public API unchanged -- FedosRuntimeCryptoProvider still satisfies RuntimeCryptoProvider, encrypt/decrypt shape untouched", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(Object.keys(encrypted).sort()).toEqual(["allowed", "reason", "state"]);
    expect(encrypted.state).toBe("Unsupported");
    const decrypted = await provider.decrypt({});
    expect(Object.keys(decrypted).sort()).toEqual(["allowed", "reason", "state"]);
    expect(decrypted.state).toBe("Unsupported");
  });

  it("15. docs record the full chain, and state plainly that this stage stops before FedOS/Runtime/Worker/Rust", () => {
    expect(executionDocSource).toMatch(/FedosRuntimeOperation/);
    expect(executionDocSource).toMatch(/Opaque Request/);
    expect(executionDocSource).toMatch(/BlockedByImplementation/);
    expect(executionDocSource).toMatch(/Before Runtime/i);
    expect(executionDocSource).toMatch(/Before Worker/i);
    expect(executionDocSource).toMatch(/Before Rust/i);
  });
});
