import { describe, it, expect } from "vitest";
import {
  PlaceholderRuntimeCryptoProvider,
  RUNTIME_CRYPTO_CAPABILITIES,
} from "../src/runtime/crypto_provider.js";
import type {
  RuntimeCryptoCapability,
  RuntimeCryptoProvider,
} from "../src/runtime/crypto_provider.js";
import {
  RUNTIME_TO_FEDOS_CRYPTO_CAPABILITY,
  mapRuntimeCryptoCapabilityToFedosCapability,
  runtimeCryptoCapabilityMappingPreview,
} from "../src/runtime/runtime_crypto_capability.js";
import { runtimeCryptoDiagnosticsPreview } from "../src/runtime/runtime_crypto_diagnostics.js";
import { CRYPTO_CAPABILITIES } from "../src/crypto/types.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cryptoProviderSource from "../src/runtime/crypto_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeCapabilitySource from "../src/runtime/runtime_crypto_capability.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeDiagnosticsSource from "../src/runtime/runtime_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageTypesSource from "../src/storage/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopStorageSource from "../src/storage/noop_storage.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import federationTypesSource from "../src/federation/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosCoreAdapterSource from "../src/crypto/fedos_core_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilityMatrixSource from "../packages/fedos-core-rust/src/crypto/capability_matrix.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import conversationKeySource from "../packages/fedos-core-rust/src/crypto/conversation_key.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import messageKeySource from "../packages/fedos-core-rust/src/crypto/message_key.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WirePayloadSource from "../packages/fedos-core-rust/src/crypto/nip44_wire_payload.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeWorkerBridgeDocSource from "../docs/runtime_worker_crypto_bridge.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmBoundaryDocSource from "../docs/fedos_wasm_boundary.md?raw";

/**
 * Stage 249–256 — "Runtime Crypto Boundary Foundation":
 * src/runtime/crypto_provider.ts (Stage 249), src/runtime/runtime_crypto_capability.ts
 * (Stage 250), src/runtime/runtime_crypto_diagnostics.ts (Stage 251),
 * docs/runtime_worker_crypto_bridge.md (Stage 252), docs/fedos_wasm_boundary.md
 * (Stage 253) — all definitions/planning only. Runtime never calls FedOS, no
 * Worker/Storage/Relay/WASM/FFI connection, no public API addition.
 */
describe("Runtime crypto boundary foundation (Stage 249-256)", () => {
  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
  }

  it("1. RuntimeCryptoProvider's every method resolves only to Placeholder/NotConnected/Unsupported, never real crypto", async () => {
    const provider: RuntimeCryptoProvider = new PlaceholderRuntimeCryptoProvider();
    expect(provider.status().state).toBe("Placeholder");

    const notConnected = await provider.encrypt({});
    expect(notConnected.allowed).toBe(false);
    expect(notConnected.state).toBe("NotConnected");
    expect(notConnected).not.toHaveProperty("ciphertext");
    expect(notConnected).not.toHaveProperty("bytes");

    const notConnectedDecrypt = await provider.decrypt({});
    expect(notConnectedDecrypt.allowed).toBe(false);
    expect(notConnectedDecrypt.state).toBe("NotConnected");

    const unsupported = await provider.encrypt({
      capability: "not_a_real_capability" as RuntimeCryptoCapability,
    });
    expect(unsupported.allowed).toBe(false);
    expect(unsupported.state).toBe("Unsupported");
  });

  it("2. capabilities() returns only the fixed placeholder list", () => {
    const provider = new PlaceholderRuntimeCryptoProvider();
    const caps = provider.capabilities();
    expect(caps).toEqual(RUNTIME_CRYPTO_CAPABILITIES);
    for (const cap of caps) expect(cap).toMatch(/_placeholder$/);
  });

  it("3. does not mutate the input request", async () => {
    const provider = new PlaceholderRuntimeCryptoProvider();
    const request = { opaqueKeyRef: "h1", opaquePlaintextRef: "h2" };
    const snapshot = JSON.stringify(request);
    await provider.encrypt(request);
    expect(JSON.stringify(request)).toBe(snapshot);
  });

  it("4. every RuntimeCryptoCapability maps to an existing CryptoCapability", () => {
    for (const cap of RUNTIME_CRYPTO_CAPABILITIES) {
      const mapped = mapRuntimeCryptoCapabilityToFedosCapability(cap);
      expect(CRYPTO_CAPABILITIES).toContain(mapped);
    }
    expect(Object.keys(RUNTIME_TO_FEDOS_CRYPTO_CAPABILITY).length).toBe(
      RUNTIME_CRYPTO_CAPABILITIES.length,
    );
  });

  it("5. the capability mapping preview is a pure, stable table (no live call)", () => {
    const preview = runtimeCryptoCapabilityMappingPreview();
    expect(preview.length).toBe(RUNTIME_CRYPTO_CAPABILITIES.length);
    expect(preview).toEqual(runtimeCryptoCapabilityMappingPreview());
  });

  it("6. runtimeCryptoDiagnosticsPreview reads only status()/capabilities(), never encrypt/decrypt", () => {
    let encryptCalled = false;
    let decryptCalled = false;
    const spyProvider: RuntimeCryptoProvider = {
      status: () => ({ state: "NotConnected", reason: "test" }),
      capabilities: () => RUNTIME_CRYPTO_CAPABILITIES,
      encrypt: async () => {
        encryptCalled = true;
        return { allowed: false, state: "NotConnected", reason: "test" };
      },
      decrypt: async () => {
        decryptCalled = true;
        return { allowed: false, state: "NotConnected", reason: "test" };
      },
    };
    const report = runtimeCryptoDiagnosticsPreview(spyProvider);
    expect(report.state).toBe("NotConnected");
    expect(report.capabilities).toEqual(RUNTIME_CRYPTO_CAPABILITIES);
    expect(encryptCalled).toBe(false);
    expect(decryptCalled).toBe(false);
  });

  it("7. the diagnostics state maps Unsupported to Disabled, and Enabled is never produced", () => {
    const placeholderProvider = new PlaceholderRuntimeCryptoProvider();
    expect(runtimeCryptoDiagnosticsPreview(placeholderProvider).state).toBe("Placeholder");

    const notConnectedProvider: RuntimeCryptoProvider = {
      status: () => ({ state: "NotConnected", reason: "x" }),
      capabilities: () => [],
      encrypt: async () => ({ allowed: false, state: "NotConnected", reason: "x" }),
      decrypt: async () => ({ allowed: false, state: "NotConnected", reason: "x" }),
    };
    expect(runtimeCryptoDiagnosticsPreview(notConnectedProvider).state).toBe("NotConnected");

    const unsupportedProvider: RuntimeCryptoProvider = {
      status: () => ({ state: "Unsupported", reason: "x" }),
      capabilities: () => [],
      encrypt: async () => ({ allowed: false, state: "Unsupported", reason: "x" }),
      decrypt: async () => ({ allowed: false, state: "Unsupported", reason: "x" }),
    };
    expect(runtimeCryptoDiagnosticsPreview(unsupportedProvider).state).toBe("Disabled");

    for (const src of [cryptoProviderSource, runtimeDiagnosticsSource]) {
      expect(codeOnlyOf(src)).not.toMatch(/state:\s*"Enabled"/);
    }
  });

  it("8. no Runtime/Worker source calls FedOS crypto, and no crypto library/WASM import exists in the new files", () => {
    for (const src of [cryptoProviderSource, runtimeCapabilitySource, runtimeDiagnosticsSource]) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly).not.toMatch(/new\s+FedosCoreCryptoProvider/);
      expect(codeOnly).not.toMatch(/new\s+PlaceholderFedosCoreCrypto/);
      // The OLD, permanently-disabled loader seam
      // (packages/fedos-core-rust/src/wasm_loader.ts, Stage 63) must never be
      // referenced -- checked by its actual import path/exported symbol
      // names, not a bare "wasm_loader" substring: Stage 483 legitimately
      // adds an import from the UNRELATED ./fedos_wasm_loader_contract.js
      // (Stage 482's fixed-value-only observation contract) and Stage 495
      // legitimately adds one from the UNRELATED ./fedos_wasm_loader.js
      // (Stage 489's Loader Skeleton), both of whose file names happen to
      // share that substring -- the negative lookbehind excludes any
      // `fedos_`-prefixed loader file, leaving only the OLD bare path.
      expect(codeOnly).not.toMatch(/(?<!fedos_)wasm_loader\.(js|ts)/);
      expect(codeOnly).not.toMatch(
        /FedosCoreWasmLoader|NoopFedosCoreWasmLoader|PlaceholderFedosCoreWasmLoader|loadFedosCoreWasm/,
      );
      expect(codeOnly).not.toMatch(/import\s+.*fedos-core-rust/);
    }
    // Stage 260 legitimately wires RuntimeCryptoProvider into
    // createRuntime()/AppRuntime as a SELECTION-only field
    // (`runtime.crypto`) — never calling FedOS or real crypto. The
    // pre-existing, UNRELATED selectCryptoProvider()/FedosCoreCryptoProvider
    // wiring (Stage 65) is untouched and still present in this same file —
    // this check only confirms the NEW seam never calls encrypt/decrypt.
    expect(createRuntimeSource).toMatch(/selectRuntimeCryptoProvider/);
    expect(createRuntimeSource).toMatch(/buildRuntimeCryptoProvider/);
    expect(createRuntimeSource).not.toMatch(/\.\s*(encrypt|decrypt)\s*\(/);
    expect(runtimeTypesSource).not.toMatch(/new\s+FedosCoreCryptoProvider|new\s+PlaceholderFedosCoreCrypto/);
    expect(workerSource).not.toMatch(/RuntimeCryptoProvider|PlaceholderRuntimeCryptoProvider/);
  });

  it("9. no Storage/Relay/NIP-17 reference anywhere in the three new Runtime files", () => {
    for (const src of [cryptoProviderSource, runtimeCapabilitySource, runtimeDiagnosticsSource]) {
      expect(codeOnlyOf(src)).not.toMatch(/Storage|Relay|nip.?17|nip-17/i);
    }
    for (const src of [storageTypesSource, noopStorageSource, federationTypesSource]) {
      expect(src).not.toMatch(/RuntimeCryptoProvider|runtime_crypto_capability|runtime_crypto_diagnostics/);
    }
  });

  it("10. fedos_core_adapter.ts (the existing FedOS host adapter) is untouched by this stage", () => {
    expect(fedosCoreAdapterSource).not.toMatch(/RuntimeCryptoProvider|runtime_crypto_capability|runtime_crypto_diagnostics/);
  });

  it("11. public pub fn surface is unchanged at twenty-seven, and SecretHandle/ConversationKey/MessageKey/Nip44WirePayload stay pub(crate)-only", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
    expect(pubFnNames.length).toBe(27);

    expect(libRsSource).toMatch(/pub\(crate\)\s+struct\s+SecretHandle\b/);
    expect(libRsSource).not.toMatch(/pub\s+struct\s+SecretHandle\b/);
    expect(conversationKeySource).toMatch(/pub\(crate\)\s+struct\s+ConversationKey\b/);
    expect(conversationKeySource).not.toMatch(/pub\s+struct\s+ConversationKey\b/);
    expect(messageKeySource).toMatch(/pub\(crate\)\s+struct\s+MessageKey\b/);
    expect(messageKeySource).not.toMatch(/pub\s+struct\s+MessageKey\b/);
    expect(nip44WirePayloadSource).toMatch(/pub\(crate\)\s+struct\s+Nip44WirePayload\b/);
    expect(nip44WirePayloadSource).not.toMatch(/pub\s+struct\s+Nip44WirePayload\b/);
  });

  it("12. capability_matrix is unchanged in shape — still sixteen CryptoCapability variants", () => {
    expect(capabilityMatrixSource).toMatch(
      /pub\(crate\)\s+const\s+ALL:\s*\[CryptoCapability;\s*16\]\s*=\s*\[/,
    );
  });

  it("13. Cargo.toml and package.json dependency counts are unchanged", () => {
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
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(["@noble/curves", "@noble/hashes"]);
  });

  it("14. both Worker/WASM planning docs exist and state their respective non-goals", () => {
    expect(runtimeWorkerBridgeDocSource).toMatch(/this document adds no code/i);
    expect(runtimeWorkerBridgeDocSource).toMatch(/FedOS/);
    expect(runtimeWorkerBridgeDocSource).not.toMatch(/```[\s\S]*?new\s+Worker[\s\S]*?```/);

    expect(wasmBoundaryDocSource).toMatch(/this document adds no code/i);
    expect(wasmBoundaryDocSource).toMatch(/SecretHandle/);
    expect(wasmBoundaryDocSource).toMatch(/ConversationKey/);
    expect(wasmBoundaryDocSource).toMatch(/MessageKey/);
    expect(wasmBoundaryDocSource).toMatch(/Nip44WirePayload|WirePayload/);
    expect(wasmBoundaryDocSource).not.toMatch(/```[\s\S]*?wasm_bindgen\(/);
  });
});
