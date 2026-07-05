import { describe, it, expect } from "vitest";
import {
  FedosRuntimeCryptoProvider,
  FEDOS_RUNTIME_PROVIDER_IMPLEMENTED,
  FEDOS_PROVIDER_IMPLEMENTATION_STAGES,
  fedosProviderImplementationStage,
} from "../src/runtime/fedos_runtime_crypto_provider.js";
import { FedosOpaqueApiPlaceholder } from "../src/runtime/fedos_opaque_api.js";
import {
  FedosRustBoundaryPlaceholder,
  createFedosRustBoundary,
  fedosRustBoundaryReachable,
  fedosRustBoundaryState,
  planFedosRustBoundaryExecution,
} from "../src/runtime/fedos_rust_boundary.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import rustBoundarySource from "../src/runtime/fedos_rust_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import opaqueApiSource from "../src/runtime/fedos_opaque_api.ts?raw";
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
import rustBoundaryDocSource from "../docs/runtime_fedos_rust_boundary.md?raw";

/**
 * Stage 329–336 — "Private Rust Boundary (Blocked before Rust Crypto)":
 * src/runtime/fedos_rust_boundary.ts (Stage 329/331), wired from
 * fedos_opaque_api.ts (Stage 330), FedosProviderImplementationStage
 * extended to "RustBoundaryReady" (Stage 332), diagnostics extended
 * (Stage 333). The Rust Boundary receives requests but never invokes
 * Rust/WASM/FFI; the chain still terminates before any real crypto.
 */
describe("FedOS private Rust boundary, blocked before Rust crypto (Stage 329-336)", () => {
  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
  }

  it("1. Provider reaches the Rust Boundary only -- fedos_opaque_api.ts imports fedos_rust_boundary.ts", () => {
    expect(opaqueApiSource).toMatch(/from\s*"\.\/fedos_rust_boundary\.js"/);
  });

  it("2. the Rust Boundary never reaches Rust crypto -- no packages/fedos-core-rust reference", () => {
    expect(codeOnlyOf(rustBoundarySource)).not.toMatch(/fedos-core-rust/i);
  });

  it("3. the Rust Boundary never reaches WASM", () => {
    expect(codeOnlyOf(rustBoundarySource)).not.toMatch(/wasm/i);
  });

  it("4. the Rust Boundary never reaches FFI", () => {
    expect(codeOnlyOf(rustBoundarySource)).not.toMatch(/\bffi\b/i);
  });

  it("5. encrypt()/decrypt() remain unchanged, unaffected by the Rust Boundary wiring", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.state).toBe("Unsupported");
    expect(encrypted.allowed).toBe(false);
    const decrypted = await provider.decrypt({});
    expect(decrypted.state).toBe("Unsupported");
    expect(decrypted.allowed).toBe(false);
  });

  it("6. planRustEncrypt is blocked", () => {
    const boundary = new FedosRustBoundaryPlaceholder();
    const decision = boundary.planRustEncrypt({ operation: "encrypt" });
    expect(decision.state).toBe("BlockedByImplementation");
    expect(decision.operation).toBe("encrypt");
  });

  it("7. planRustDecrypt is blocked", () => {
    const boundary = new FedosRustBoundaryPlaceholder();
    const decision = boundary.planRustDecrypt({ operation: "decrypt" });
    expect(decision.state).toBe("BlockedByImplementation");
    expect(decision.operation).toBe("decrypt");
  });

  it("8. planFedosRustBoundaryExecution routes to the correct handler for both operations", () => {
    const boundary = createFedosRustBoundary();
    expect(planFedosRustBoundaryExecution(boundary, { operation: "encrypt" }).operation).toBe("encrypt");
    expect(planFedosRustBoundaryExecution(boundary, { operation: "decrypt" }).operation).toBe("decrypt");
  });

  it("9. Runtime is unchanged -- create_runtime.ts never calls any plan*/encrypt/decrypt function", () => {
    expect(createRuntimeSource).not.toMatch(/planExecution|planEncrypt|planDecrypt|planRustEncrypt|planRustDecrypt/);
  });

  it("10. Worker is unchanged -- src/worker.ts still doesn't import the Rust Boundary, Opaque API, or the provider", () => {
    expect(workerSource).not.toMatch(/fedos_rust_boundary|fedos_opaque_api|fedos_runtime_crypto_provider/);
  });

  it("11. SecretHandle is hidden from the Rust Boundary file", () => {
    expect(codeOnlyOf(rustBoundarySource)).not.toMatch(/SecretHandle/);
  });

  it("12. ConversationKey is hidden from the Rust Boundary file", () => {
    expect(codeOnlyOf(rustBoundarySource)).not.toMatch(/ConversationKey/);
  });

  it("13. MessageKey is hidden from the Rust Boundary file", () => {
    expect(codeOnlyOf(rustBoundarySource)).not.toMatch(/MessageKey/);
  });

  it("14. WirePayload is hidden from the Rust Boundary file", () => {
    expect(codeOnlyOf(rustBoundarySource)).not.toMatch(/WirePayload/);
  });

  it("15. Allowed is unreachable from either activation policy, even with both locks open", () => {
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

  it("16. the implementation stage is fixed at RustApiReady, and RustReady remains unreachable", () => {
    expect(FEDOS_RUNTIME_PROVIDER_IMPLEMENTED).toBe(false);
    expect(fedosProviderImplementationStage()).toBe("RustApiReady");
    expect(FEDOS_PROVIDER_IMPLEMENTATION_STAGES).toEqual([
      "Unavailable",
      "ProviderReady",
      "OpaqueApiReady",
      "RustBoundaryReady",
      "RustApiReady",
      "RustReady",
    ]);
  });

  it("17. dependency counts unchanged -- Cargo.toml (10) and package.json (2) dependencies, Rust pub fn surface (27)", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m: RegExpMatchArray) => m[1]);
    expect(pubFnNames.length).toBe(27);

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
  });

  it("18. public API unchanged -- FedosRuntimeCryptoProvider still satisfies RuntimeCryptoProvider exactly", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(Object.keys(encrypted).sort()).toEqual(["allowed", "reason", "state"]);
    const decrypted = await provider.decrypt({});
    expect(Object.keys(decrypted).sort()).toEqual(["allowed", "reason", "state"]);
  });

  it("19. diagnostics expose rustBoundaryState/rustBoundaryReachable without constructing an instance", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.rustBoundaryState).toBe("NotConnected");
    expect(status.rustBoundaryReachable).toBe(true);

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.rustBoundaryState).toBe("NotConnected");
    expect(workerStatus.rustBoundaryReachable).toBe(true);

    for (const src of [runtimeDiagnosticsSource, workerDiagnosticsSource]) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly).not.toMatch(/new\s+FedosRustBoundaryPlaceholder/);
      expect(codeOnly).not.toMatch(/new\s+FedosOpaqueApiPlaceholder/);
      expect(codeOnly).not.toMatch(/new\s+FedosRuntimeCryptoProvider/);
    }
  });

  it("20. status() reports NotConnected, mirroring fedosRustBoundaryState(), and fedosRustBoundaryReachable() is a pure standalone function", () => {
    const boundary = new FedosRustBoundaryPlaceholder();
    expect(boundary.status().state).toBe("NotConnected");
    expect(fedosRustBoundaryState()).toBe("NotConnected");
    expect(fedosRustBoundaryReachable()).toBe(true);
  });

  it("21. the Opaque API's own decision is unaffected by reaching the Rust Boundary -- still BlockedByImplementation", () => {
    const api = new FedosOpaqueApiPlaceholder();
    expect(api.planEncrypt({ operation: "encrypt" }).state).toBe("BlockedByImplementation");
    expect(api.planDecrypt({ operation: "decrypt" }).state).toBe("BlockedByImplementation");
  });

  it("22. neither the Rust Boundary file nor the Opaque API's wiring reference process.env, Relay, Storage, Nostr, or NIP-17", () => {
    for (const src of [rustBoundarySource, opaqueApiSource, fedosProviderSource]) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly).not.toMatch(/process\.env/);
      expect(codeOnly).not.toMatch(/relay|storage|nostr|nip-?17/i);
    }
  });

  it("23. docs record the full seven-step chain and state plainly this stage stops before Rust crypto", () => {
    expect(rustBoundaryDocSource).toMatch(/Rust Boundary/);
    expect(rustBoundaryDocSource).toMatch(/BlockedByImplementation/);
    expect(rustBoundaryDocSource).toMatch(/RustBoundaryReady/);
    expect(rustBoundaryDocSource).toMatch(/No Rust crypto invocation/i);
    expect(rustBoundaryDocSource).toMatch(/No Runtime execution/i);
    expect(rustBoundaryDocSource).toMatch(/No Worker execution/i);
  });
});
