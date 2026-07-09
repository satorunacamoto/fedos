import { describe, it, expect } from "vitest";
import {
  FedosRuntimeCryptoProvider,
  FEDOS_RUNTIME_PROVIDER_IMPLEMENTED,
  FEDOS_INTERNAL_CAPABILITY_SURFACE,
  FEDOS_PROVIDER_DECISION_REASONS,
} from "../src/runtime/fedos_runtime_crypto_provider.js";
import { RUNTIME_CRYPTO_CAPABILITIES } from "../src/runtime/crypto_provider.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosProviderSource from "../src/runtime/fedos_runtime_crypto_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimePolicySource from "../src/runtime/runtime_crypto_activation_policy.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerPolicySource from "../src/runtime/worker_crypto_activation_policy.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeBridgeSource from "../src/runtime/runtime_crypto_bridge.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerBridgeSource from "../src/runtime/worker_crypto_bridge.ts?raw";
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
import implementationDocSource from "../docs/runtime_fedos_provider_implementation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import activationPolicyDocSource from "../docs/runtime_crypto_activation_policy.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import threatModelDocSource from "../docs/runtime_crypto_threat_model.md?raw";

/**
 * Stage 305–312 — "FedOS Provider Implementation Readiness (Shape Only)":
 * src/runtime/fedos_runtime_crypto_provider.ts gains
 * FEDOS_RUNTIME_PROVIDER_IMPLEMENTED (Stage 305),
 * internalCapabilitySurface()/decisionReason() (Stage 306/307), both
 * activation policies read the flag as a single source of truth (Stage
 * 308), diagnostics gain providerImplemented (Stage 309). None of this
 * enables real cryptography, changes encrypt()/decrypt()'s behavior, or
 * connects Runtime/Worker/Nostr/Relay/Storage to anything.
 */
describe("FedOS provider implementation readiness, shape only (Stage 305-312)", () => {
  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
  }

  it("1. FEDOS_RUNTIME_PROVIDER_IMPLEMENTED is fixed false", () => {
    expect(FEDOS_RUNTIME_PROVIDER_IMPLEMENTED).toBe(false);
  });

  it("2. FEDOS_RUNTIME_PROVIDER_IMPLEMENTED cannot be changed via env -- no process.env reference, no env parameter anywhere in the file", () => {
    const codeOnly = codeOnlyOf(fedosProviderSource);
    expect(codeOnly).not.toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/RuntimeEnv/);
    expect(codeOnly).not.toMatch(/FEDOS_CRYPTO_ENABLED|FEDOS_CRYPTO_PROVIDER/);
  });

  it("3. encrypt()/decrypt() still always resolve to Unsupported", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    expect((await provider.encrypt({})).state).toBe("Unsupported");
    expect((await provider.encrypt({})).allowed).toBe(false);
    expect((await provider.decrypt({})).state).toBe("Unsupported");
    expect((await provider.decrypt({})).allowed).toBe(false);
  });

  it("4. status() reports implemented: false alongside the existing state/reason fields", () => {
    const status = new FedosRuntimeCryptoProvider().status();
    expect(status).toEqual({
      state: "NotConnected",
      reason: "FedOS runtime crypto provider is not connected to any real core",
      implemented: false,
    });
  });

  it("5. capabilities() and internalCapabilitySurface() carry no secret, key, plaintext, or ciphertext material", () => {
    const provider = new FedosRuntimeCryptoProvider();
    const capsJson = JSON.stringify(provider.capabilities());
    const surfaceJson = JSON.stringify(provider.internalCapabilitySurface());
    for (const json of [capsJson, surfaceJson]) {
      expect(json).not.toMatch(/key|secret|plaintext|ciphertext|nsec|privkey/i);
    }
    expect(FEDOS_INTERNAL_CAPABILITY_SURFACE.length).toBe(RUNTIME_CRYPTO_CAPABILITIES.length);
  });

  it("6. Allowed is unreachable from either activation policy, even with both locks open and the implementation flag imported", () => {
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

  it("7. Runtime does not call encrypt/decrypt automatically -- create_runtime.ts still never invokes them", () => {
    expect(createRuntimeSource).not.toMatch(/\.\s*(encrypt|decrypt)\s*\(/);
  });

  it("8. Worker still does not import any Worker crypto file or the new implementation surface", () => {
    expect(workerSource).not.toMatch(
      /worker_crypto_config|worker_crypto_registry|worker_crypto_bridge|worker_crypto_diagnostics|worker_crypto_activation_policy|fedos_runtime_crypto_provider/,
    );
  });

  it("9. neither bridge file was touched -- neither reads FEDOS_CRYPTO_ENABLED or FEDOS_RUNTIME_PROVIDER_IMPLEMENTED", () => {
    for (const src of [runtimeBridgeSource, workerBridgeSource]) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly).not.toMatch(/FEDOS_CRYPTO_ENABLED/);
      expect(codeOnly).not.toMatch(/FEDOS_RUNTIME_PROVIDER_IMPLEMENTED/);
    }
  });

  it("10. neither policy file calls encrypt/decrypt or constructs a provider with new", () => {
    for (const src of [runtimePolicySource, workerPolicySource]) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly).not.toMatch(/\.\s*(encrypt|decrypt)\s*\(/);
      expect(codeOnly).not.toMatch(/new\s+FedosRuntimeCryptoProvider/);
    }
  });

  it("11. no Relay/Storage/Nostr/NIP-17/WASM/FFI reference in fedos_runtime_crypto_provider.ts", () => {
    const codeOnly = codeOnlyOf(fedosProviderSource);
    expect(codeOnly).not.toMatch(/relay|storage|nostr|nip-?17|wasm|ffi/i);
  });

  it("12. diagnostics report providerImplemented: false, and it stays false even with both locks open", () => {
    expect(runtimeCryptoActivationStatus().providerImplemented).toBe(false);
    expect(workerCryptoActivationStatus().providerImplemented).toBe(false);
    expect(
      runtimeCryptoActivationStatus({
        FEDOS_CRYPTO_PROVIDER: "fedos",
        FEDOS_CRYPTO_ENABLED: "explicit-dev-only",
      }).providerImplemented,
    ).toBe(false);
  });

  it("13. Rust is untouched -- pub fn surface (27) and Cargo.toml/package.json dependency counts unchanged", () => {
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

  it("14. docs record that the flag is still false, real crypto still doesn't run, and Worker/Nostr/Relay remain unconnected", () => {
    expect(implementationDocSource).toMatch(/FEDOS_RUNTIME_PROVIDER_IMPLEMENTED/);
    expect(implementationDocSource).toMatch(/still.*false|permanently.*false|fixed.*false/i);
    expect(implementationDocSource).toMatch(/Allowed/);
    expect(implementationDocSource).toMatch(/Worker/);
    expect(implementationDocSource).toMatch(/Nostr|Relay/);

    expect(activationPolicyDocSource).toMatch(/FEDOS_RUNTIME_PROVIDER_IMPLEMENTED/);
    expect(threatModelDocSource).toMatch(/FEDOS_RUNTIME_PROVIDER_IMPLEMENTED/);
  });

  it("15. FEDOS_PROVIDER_DECISION_REASONS names exactly the four documented labels, in order", () => {
    expect(FEDOS_PROVIDER_DECISION_REASONS).toEqual([
      "NotImplemented",
      "DisabledByActivationPolicy",
      "RuntimeConnectionMissing",
      "Unsupported",
    ]);
  });
});
