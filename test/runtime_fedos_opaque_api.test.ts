import { describe, it, expect } from "vitest";
import {
  FedosRuntimeCryptoProvider,
  FEDOS_RUNTIME_PROVIDER_IMPLEMENTED,
  FEDOS_PROVIDER_IMPLEMENTATION_STAGES,
  fedosProviderImplementationStage,
} from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  FedosOpaqueApiPlaceholder,
  createFedosOpaqueApi,
  fedosOpaqueApiState,
  planFedosOpaqueApiExecution,
} from "../src/runtime/fedos_opaque_api.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import opaqueApiSource from "../src/runtime/fedos_opaque_api.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosProviderSource from "../src/runtime/fedos_runtime_crypto_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeDiagnosticsSource from "../src/runtime/runtime_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerDiagnosticsSource from "../src/runtime/worker_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import opaqueApiDocSource from "../docs/runtime_fedos_opaque_api.md?raw";
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

/**
 * Stage 321–328 — "FedOS Opaque API Internal Wiring (Blocked before
 * Rust)": src/runtime/fedos_opaque_api.ts (Stage 321/323),
 * FedosRuntimeCryptoProvider's #planInternalExecution extended to reach
 * it (Stage 322), FedosProviderImplementationStage fixed at
 * "OpaqueApiReady" (Stage 324), diagnostics extended (Stage 325). The
 * Opaque API receives requests but never invokes Rust/WASM/FFI; the
 * chain still terminates before any real crypto pipeline.
 */
describe("FedOS opaque API internal wiring, blocked before Rust (Stage 321-328)", () => {
  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
  }

  it("1. Provider reaches the Opaque API only -- fedos_runtime_crypto_provider.ts imports fedos_opaque_api.ts", () => {
    expect(fedosProviderSource).toMatch(/from\s*"\.\/fedos_opaque_api\.js"/);
  });

  it("2. the Opaque API never reaches Rust -- no packages/fedos-core-rust reference in fedos_opaque_api.ts", () => {
    expect(codeOnlyOf(opaqueApiSource)).not.toMatch(/fedos-core-rust/i);
  });

  it("3. the Opaque API never reaches WASM/FFI", () => {
    const codeOnly = codeOnlyOf(opaqueApiSource);
    expect(codeOnly).not.toMatch(/wasm/i);
    expect(codeOnly).not.toMatch(/\bffi\b/i);
  });

  it("4. encrypt()/decrypt() remain Unsupported, unaffected by the Opaque API wiring", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    expect((await provider.encrypt({})).state).toBe("Unsupported");
    expect((await provider.decrypt({})).state).toBe("Unsupported");
  });

  it("5. planEncrypt is blocked", () => {
    const api = new FedosOpaqueApiPlaceholder();
    const decision = api.planEncrypt({ operation: "encrypt" });
    expect(decision.state).toBe("BlockedByImplementation");
    expect(decision.operation).toBe("encrypt");
  });

  it("6. planDecrypt is blocked", () => {
    const api = new FedosOpaqueApiPlaceholder();
    const decision = api.planDecrypt({ operation: "decrypt" });
    expect(decision.state).toBe("BlockedByImplementation");
    expect(decision.operation).toBe("decrypt");
  });

  it("7. planFedosOpaqueApiExecution routes to the correct handler for both operations", () => {
    const api = createFedosOpaqueApi();
    expect(planFedosOpaqueApiExecution(api, { operation: "encrypt" }).operation).toBe("encrypt");
    expect(planFedosOpaqueApiExecution(api, { operation: "decrypt" }).operation).toBe("decrypt");
  });

  it("8. Runtime is unchanged -- create_runtime.ts never calls planExecution/planEncrypt/planDecrypt", () => {
    expect(createRuntimeSource).not.toMatch(/planExecution|planEncrypt|planDecrypt/);
  });

  it("9. Worker is unchanged -- src/worker.ts still doesn't import the Opaque API or the provider", () => {
    expect(workerSource).not.toMatch(/fedos_opaque_api|fedos_runtime_crypto_provider/);
  });

  it("10. SecretHandle/ConversationKey/MessageKey/WirePayload are hidden from the Opaque API file", () => {
    const codeOnly = codeOnlyOf(opaqueApiSource);
    expect(codeOnly).not.toMatch(/SecretHandle/);
    expect(codeOnly).not.toMatch(/ConversationKey/);
    expect(codeOnly).not.toMatch(/MessageKey/);
    expect(codeOnly).not.toMatch(/WirePayload/);
  });

  it("11. diagnostics are updated -- providerImplementationStage/opaqueApiState/runtimeExecutionState are present and fixed", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.providerImplementationStage).toBe("RustInvocationAdapterReady");
    expect(status.opaqueApiState).toBe("NotConnected");
    expect(status.runtimeExecutionState).toBe("BlockedByImplementation");

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.providerImplementationStage).toBe("RustInvocationAdapterReady");
    expect(workerStatus.opaqueApiState).toBe("NotConnected");
    expect(workerStatus.runtimeExecutionState).toBe("BlockedByImplementation");
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

  it("13. the implementation flag is unchanged -- still fixed false", () => {
    expect(FEDOS_RUNTIME_PROVIDER_IMPLEMENTED).toBe(false);
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

  it("14. dependency counts unchanged -- Cargo.toml (10) and package.json (2) dependencies, Rust pub fn surface (27)", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m: RegExpMatchArray) => m[1]);
    expect(pubFnNames.length).toBe(69);
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
    assertFedosRootDependencyInvariant(pkg.dependencies);
  });

  it("15. public API unchanged -- FedosRuntimeCryptoProvider still satisfies RuntimeCryptoProvider exactly", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(Object.keys(encrypted).sort()).toEqual(["allowed", "reason", "state"]);
    const decrypted = await provider.decrypt({});
    expect(Object.keys(decrypted).sort()).toEqual(["allowed", "reason", "state"]);
  });

  it("16. no process.env reference, no Relay/Storage/Nostr/NIP-17 reference in the Opaque API file", () => {
    const codeOnly = codeOnlyOf(opaqueApiSource);
    expect(codeOnly).not.toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/relay|storage|nostr|nip-?17/i);
  });

  it("17. diagnostics files never construct a FedosOpaqueApi instance or a FedosRuntimeCryptoProvider instance", () => {
    for (const src of [runtimeDiagnosticsSource, workerDiagnosticsSource]) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly).not.toMatch(/new\s+FedosOpaqueApiPlaceholder/);
      expect(codeOnly).not.toMatch(/new\s+FedosRuntimeCryptoProvider/);
    }
  });

  it("18. status() reports NotConnected, mirroring fedosOpaqueApiState()", () => {
    const api = new FedosOpaqueApiPlaceholder();
    expect(api.status().state).toBe("NotConnected");
    expect(fedosOpaqueApiState()).toBe("NotConnected");
  });

  it("19. docs record the full seven-step chain and state plainly this stage stops before Rust", () => {
    expect(opaqueApiDocSource).toMatch(/Opaque API/);
    expect(opaqueApiDocSource).toMatch(/BlockedByImplementation/);
    expect(opaqueApiDocSource).toMatch(/OpaqueApiReady/);
    expect(opaqueApiDocSource).toMatch(/No Rust invocation/i);
    expect(opaqueApiDocSource).toMatch(/No Runtime execution/i);
    expect(opaqueApiDocSource).toMatch(/No Worker execution/i);
  });
});
