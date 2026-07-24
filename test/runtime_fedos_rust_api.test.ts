import { describe, it, expect } from "vitest";
import {
  FedosRuntimeCryptoProvider,
  FEDOS_RUNTIME_PROVIDER_IMPLEMENTED,
  FEDOS_PROVIDER_IMPLEMENTATION_STAGES,
  fedosProviderImplementationStage,
} from "../src/runtime/fedos_runtime_crypto_provider.js";
import { FedosRustBoundaryPlaceholder } from "../src/runtime/fedos_rust_boundary.js";
import {
  FedosRustApiPlaceholder,
  createFedosRustApi,
  fedosRustApiReachable,
  fedosRustApiState,
  planFedosRustApiExecution,
} from "../src/runtime/fedos_rust_api.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import rustApiSource from "../src/runtime/fedos_rust_api.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import rustBoundarySource from "../src/runtime/fedos_rust_boundary.ts?raw";
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
import rustApiDocSource from "../docs/runtime_fedos_rust_api.md?raw";

/**
 * Stage 337–344 — "Private Rust API Connection (Blocked before Rust
 * Crypto)": src/runtime/fedos_rust_api.ts (Stage 337/339), wired from
 * fedos_rust_boundary.ts (Stage 338), FedosProviderImplementationStage
 * extended to "RustApiReady" (Stage 340), diagnostics extended (Stage
 * 341). The Rust API receives requests but never invokes Rust/WASM/FFI;
 * the chain still terminates before any real crypto.
 */
describe("FedOS private Rust API connection, blocked before Rust crypto (Stage 337-344)", () => {
  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
  }

  it("1. Provider reaches the Rust API only -- fedos_rust_boundary.ts imports fedos_rust_api.ts", () => {
    expect(rustBoundarySource).toMatch(/from\s*"\.\/fedos_rust_api\.js"/);
  });

  it("2. the Rust API never reaches Rust crypto -- no packages/fedos-core-rust reference", () => {
    expect(codeOnlyOf(rustApiSource)).not.toMatch(/fedos-core-rust/i);
  });

  it("3. the Rust API never reaches WASM", () => {
    expect(codeOnlyOf(rustApiSource)).not.toMatch(/wasm/i);
  });

  it("4. the Rust API never reaches FFI", () => {
    expect(codeOnlyOf(rustApiSource)).not.toMatch(/\bffi\b/i);
  });

  it("5. encrypt()/decrypt() remain unchanged, unaffected by the Rust API wiring", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.state).toBe("Unsupported");
    expect(encrypted.allowed).toBe(false);
    const decrypted = await provider.decrypt({});
    expect(decrypted.state).toBe("Unsupported");
    expect(decrypted.allowed).toBe(false);
  });

  it("6. SecretHandle is hidden from the Rust API file", () => {
    expect(codeOnlyOf(rustApiSource)).not.toMatch(/SecretHandle/);
  });

  it("7. ConversationKey is hidden from the Rust API file", () => {
    expect(codeOnlyOf(rustApiSource)).not.toMatch(/ConversationKey/);
  });

  it("8. MessageKey is hidden from the Rust API file", () => {
    expect(codeOnlyOf(rustApiSource)).not.toMatch(/MessageKey/);
  });

  it("9. WirePayload is hidden from the Rust API file", () => {
    expect(codeOnlyOf(rustApiSource)).not.toMatch(/WirePayload/);
  });

  it("10. Allowed is unreachable from either activation policy, even with both locks open", () => {
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

  it("11. dependency counts unchanged -- Cargo.toml (10) and package.json (2) dependencies, Rust pub fn surface (27)", () => {
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
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("12. public API unchanged -- FedosRuntimeCryptoProvider still satisfies RuntimeCryptoProvider exactly", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(Object.keys(encrypted).sort()).toEqual(["allowed", "reason", "state"]);
    const decrypted = await provider.decrypt({});
    expect(Object.keys(decrypted).sort()).toEqual(["allowed", "reason", "state"]);
  });

  it("13. planRustApiEncrypt is blocked, with no payload/plaintext/ciphertext/key material", () => {
    const api = new FedosRustApiPlaceholder();
    const decision = api.planRustApiEncrypt({ operation: "encrypt" });
    expect(decision.state).toBe("BlockedByImplementation");
    expect(decision.operation).toBe("encrypt");
    expect(JSON.stringify(decision)).not.toMatch(/key|secret|plaintext|ciphertext/i);
  });

  it("14. planRustApiDecrypt is blocked, with no payload/plaintext/ciphertext/key material", () => {
    const api = new FedosRustApiPlaceholder();
    const decision = api.planRustApiDecrypt({ operation: "decrypt" });
    expect(decision.state).toBe("BlockedByImplementation");
    expect(decision.operation).toBe("decrypt");
    expect(JSON.stringify(decision)).not.toMatch(/key|secret|plaintext|ciphertext/i);
  });

  it("15. planFedosRustApiExecution routes to the correct handler for both operations", () => {
    const api = createFedosRustApi();
    expect(planFedosRustApiExecution(api, { operation: "encrypt" }).operation).toBe("encrypt");
    expect(planFedosRustApiExecution(api, { operation: "decrypt" }).operation).toBe("decrypt");
  });

  it("16. Runtime is unchanged -- create_runtime.ts never calls any plan* function", () => {
    expect(createRuntimeSource).not.toMatch(
      /planExecution|planEncrypt|planDecrypt|planRustEncrypt|planRustDecrypt|planRustApiEncrypt|planRustApiDecrypt/,
    );
  });

  it("17. Worker is unchanged -- src/worker.ts still doesn't import the Rust API, Rust Boundary, Opaque API, or the provider", () => {
    expect(workerSource).not.toMatch(
      /fedos_rust_api|fedos_rust_boundary|fedos_opaque_api|fedos_runtime_crypto_provider/,
    );
  });

  it("18. the implementation stage is fixed at RustInvocationAdapterReady, and RustReady remains unreachable", () => {
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

  it("19. diagnostics expose rustApiState/rustApiReachable without constructing an instance", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.rustApiState).toBe("NotConnected");
    expect(status.rustApiReachable).toBe(true);

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.rustApiState).toBe("NotConnected");
    expect(workerStatus.rustApiReachable).toBe(true);

    for (const src of [runtimeDiagnosticsSource, workerDiagnosticsSource]) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly).not.toMatch(/new\s+FedosRustApiPlaceholder/);
      expect(codeOnly).not.toMatch(/new\s+FedosRustBoundaryPlaceholder/);
      expect(codeOnly).not.toMatch(/new\s+FedosRuntimeCryptoProvider/);
    }
  });

  it("20. status() reports NotConnected, mirroring fedosRustApiState(), and fedosRustApiReachable() is a pure standalone function", () => {
    const api = new FedosRustApiPlaceholder();
    expect(api.status().state).toBe("NotConnected");
    expect(fedosRustApiState()).toBe("NotConnected");
    expect(fedosRustApiReachable()).toBe(true);
  });

  it("21. the Rust Boundary's own decision is unaffected by reaching the Rust API -- still BlockedByImplementation", () => {
    const boundary = new FedosRustBoundaryPlaceholder();
    expect(boundary.planRustEncrypt({ operation: "encrypt" }).state).toBe("BlockedByImplementation");
    expect(boundary.planRustDecrypt({ operation: "decrypt" }).state).toBe("BlockedByImplementation");
  });

  it("22. neither the Rust API file nor its wiring reference process.env, Relay, Storage, Nostr, or NIP-17", () => {
    for (const src of [rustApiSource, rustBoundarySource, fedosProviderSource]) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly).not.toMatch(/process\.env/);
      expect(codeOnly).not.toMatch(/relay|storage|nostr|nip-?17/i);
    }
  });

  it("23. docs record the full eight-step chain and state plainly this stage stops before real Rust crypto", () => {
    expect(rustApiDocSource).toMatch(/Rust API/);
    expect(rustApiDocSource).toMatch(/BlockedByImplementation/);
    expect(rustApiDocSource).toMatch(/RustApiReady/);
    expect(rustApiDocSource).toMatch(/No Rust crypto invocation/i);
    expect(rustApiDocSource).toMatch(/No Runtime execution/i);
    expect(rustApiDocSource).toMatch(/No Worker execution/i);
  });
});
