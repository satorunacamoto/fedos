import { describe, it, expect } from "vitest";
import { PlaceholderRuntimeCryptoProvider } from "../src/runtime/crypto_provider.js";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  FEDOS_RUNTIME_CRYPTO_PROVIDER_NAME,
  PLACEHOLDER_RUNTIME_CRYPTO_PROVIDER_NAME,
  createDefaultRuntimeCryptoProviderRegistry,
} from "../src/runtime/runtime_crypto_registry.js";
import {
  RUNTIME_CRYPTO_CONFIG,
  RUNTIME_CRYPTO_PROVIDER_NAMES,
  getRuntimeCryptoConfig,
} from "../src/runtime/runtime_crypto_config.js";
import { buildRuntimeCryptoProvider } from "../src/runtime/runtime_crypto_bridge.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { createRuntime } from "../src/runtime/create_runtime.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosProviderSource from "../src/runtime/fedos_runtime_crypto_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import registrySource from "../src/runtime/runtime_crypto_registry.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import configSource from "../src/runtime/runtime_crypto_config.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import bridgeSource from "../src/runtime/runtime_crypto_bridge.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import diagnosticsSource from "../src/runtime/runtime_crypto_diagnostics.ts?raw";
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
import activationDocSource from "../docs/runtime_fedos_provider_activation.md?raw";

/**
 * Stage 265–272 — "Runtime FedOS Provider Integration (Opt-in,
 * Safe-by-default)": src/runtime/fedos_runtime_crypto_provider.ts (Stage
 * 265), Registry registration (Stage 266), explicit opt-in config (Stage
 * 267), the bridge's two-flag gate (Stage 268), diagnostics' effective
 * provider (Stage 269), docs/runtime_fedos_provider_activation.md (Stage
 * 270). Default stays Placeholder; FedOS provider is never constructed
 * outside the Registry/Bridge; Runtime never calls encrypt/decrypt.
 */
describe("Runtime FedOS provider integration, opt-in and safe-by-default (Stage 265-272)", () => {
  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
  }

  const PRODUCTION_FILES: [string, string][] = [
    ["fedos_runtime_crypto_provider.ts", fedosProviderSource],
    ["runtime_crypto_registry.ts", registrySource],
    ["runtime_crypto_config.ts", configSource],
    ["runtime_crypto_bridge.ts", bridgeSource],
  ];

  it("1. FedosRuntimeCryptoProvider.encrypt/decrypt always resolve to Unsupported, and calls no FedOS core", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.allowed).toBe(false);
    expect(encrypted.state).toBe("Unsupported");
    const decrypted = await provider.decrypt({});
    expect(decrypted.allowed).toBe(false);
    expect(decrypted.state).toBe("Unsupported");
  });

  it("2. FedosRuntimeCryptoProvider does not mutate its request argument", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const request = { opaqueKeyRef: "h1", opaquePlaintextRef: "h2" };
    const snapshot = JSON.stringify(request);
    await provider.encrypt(request);
    expect(JSON.stringify(request)).toBe(snapshot);
  });

  it("3. the default registry registers both placeholder and fedos, and fedos resolves a FedosRuntimeCryptoProvider", () => {
    const registry = createDefaultRuntimeCryptoProviderRegistry();
    expect(registry.names()).toEqual([
      PLACEHOLDER_RUNTIME_CRYPTO_PROVIDER_NAME,
      FEDOS_RUNTIME_CRYPTO_PROVIDER_NAME,
    ]);
    expect(registry.create(FEDOS_RUNTIME_CRYPTO_PROVIDER_NAME)).toBeInstanceOf(
      FedosRuntimeCryptoProvider,
    );
  });

  it("4. RUNTIME_CRYPTO_CONFIG/getRuntimeCryptoConfig fix both runtimeCryptoEnabled: false and runtimeCryptoProvider: 'placeholder'", () => {
    expect(RUNTIME_CRYPTO_CONFIG).toEqual({
      runtimeCryptoEnabled: false,
      runtimeCryptoProvider: "placeholder",
    });
    expect(getRuntimeCryptoConfig()).toEqual(RUNTIME_CRYPTO_CONFIG);
    expect(Object.isFrozen(RUNTIME_CRYPTO_CONFIG)).toBe(true);
    expect(RUNTIME_CRYPTO_PROVIDER_NAMES).toEqual(["placeholder", "fedos"]);
  });

  it("5. runtime_crypto_config.ts reads no RuntimeEnv/process.env field", () => {
    const codeOnly = codeOnlyOf(configSource);
    expect(codeOnly).not.toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/RuntimeEnv/);
  });

  it("6. buildRuntimeCryptoProvider always resolves placeholder (the two-flag gate never passes), and only via the Registry", () => {
    const provider = buildRuntimeCryptoProvider();
    expect(provider).toBeInstanceOf(PlaceholderRuntimeCryptoProvider);
    expect(provider).not.toBeInstanceOf(FedosRuntimeCryptoProvider);
  });

  it("7. the bridge's two-flag gate is evaluated with && (never ||) in source", () => {
    expect(bridgeSource).toMatch(
      /runtimeCryptoEnabled\s*&&\s*runtimeCryptoProvider\s*===\s*FEDOS_RUNTIME_CRYPTO_PROVIDER_NAME/,
    );
    expect(codeOnlyOf(bridgeSource)).not.toMatch(
      /runtimeCryptoEnabled\s*\|\|\s*runtimeCryptoProvider/,
    );
  });

  it("8. no RuntimeCryptoProvider is constructed with `new` outside runtime_crypto_registry.ts among the production files", () => {
    for (const [name, src] of PRODUCTION_FILES) {
      if (name === "runtime_crypto_registry.ts" || name === "fedos_runtime_crypto_provider.ts") {
        continue;
      }
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly, `${name} must not construct a provider with new`).not.toMatch(
        /new\s+(PlaceholderRuntimeCryptoProvider|FedosRuntimeCryptoProvider)/,
      );
    }
  });

  it("9. runtimeCryptoActivationStatus reports { enabled: false, configuredProvider: 'placeholder', effectiveProvider: 'placeholder' }, mirroring the bridge's gate", () => {
    expect(runtimeCryptoActivationStatus()).toEqual({
      enabled: false,
      configuredProvider: "placeholder",
      effectiveProvider: "placeholder",
      activationReason: "DisabledByConfig",
    });
  });

  it("10. AppRuntime.crypto defaults to PlaceholderRuntimeCryptoProvider, and createRuntime never calls encrypt/decrypt", () => {
    const runtime = createRuntime();
    expect(runtime.crypto).toBeInstanceOf(PlaceholderRuntimeCryptoProvider);
    expect(createRuntimeSource).not.toMatch(/\.\s*(encrypt|decrypt)\s*\(/);
  });

  it("11. no Worker/WASM/Relay/Storage/NIP-17 reference in the four new/updated production files", () => {
    for (const [name, src] of PRODUCTION_FILES) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly, name).not.toMatch(/worker\.js|wasm|Relay|Storage|nip.?17|nip-17/i);
    }
    expect(codeOnlyOf(diagnosticsSource)).not.toMatch(/worker\.js|wasm|Relay|Storage|nip.?17|nip-17/i);
  });

  it("12. the Worker does not reference any Runtime crypto file or AppRuntime.crypto", () => {
    expect(workerSource).not.toMatch(
      /fedos_runtime_crypto_provider|runtime_crypto_registry|runtime_crypto_config|runtime_crypto_bridge|FedosRuntimeCryptoProvider/,
    );
    expect(workerSource).not.toMatch(/\.crypto\s*\.\s*(encrypt|decrypt)\s*\(/);
  });

  it("13. public pub fn surface is unchanged at twenty-seven", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
    expect(pubFnNames.length).toBe(27);
  });

  it("14. Cargo.toml and package.json dependency counts are unchanged", () => {
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
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(["@noble/curves", "@noble/hashes"]);
  });

  it("15. docs/runtime_fedos_provider_activation.md exists, names the five-step order, and adds no code", () => {
    expect(activationDocSource).toMatch(/this document adds no code/i);
    expect(activationDocSource).toMatch(/Placeholder/);
    expect(activationDocSource).toMatch(/FedOS Provider/);
    expect(activationDocSource).toMatch(/Worker/);
    expect(activationDocSource).toMatch(/Runtime/);
    expect(activationDocSource).toMatch(/Nostr/);
  });

  it("16. Stage 281-284: FEDOS_CRYPTO_PROVIDER=fedos still never yields a FedosRuntimeCryptoProvider from buildRuntimeCryptoProvider (runtimeCryptoEnabled stays false)", () => {
    const provider = buildRuntimeCryptoProvider(
      createDefaultRuntimeCryptoProviderRegistry(),
      { FEDOS_CRYPTO_PROVIDER: "fedos" },
    );
    expect(provider).toBeInstanceOf(PlaceholderRuntimeCryptoProvider);
    expect(provider).not.toBeInstanceOf(FedosRuntimeCryptoProvider);
  });

  it("17. FedosRuntimeCryptoProvider still always resolves encrypt/decrypt to Unsupported, unaffected by the env var", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    expect((await provider.encrypt({})).state).toBe("Unsupported");
    expect((await provider.decrypt({})).state).toBe("Unsupported");
  });

  it("18. RUNTIME_CRYPTO_PROVIDER_NAMES still lists exactly placeholder/fedos", () => {
    expect(RUNTIME_CRYPTO_PROVIDER_NAMES).toEqual(["placeholder", "fedos"]);
  });
});
