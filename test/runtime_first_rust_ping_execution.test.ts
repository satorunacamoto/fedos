import { describe, it, expect } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  FedosRustInvocationAdapterPlaceholder,
  fedosRustPingBridgeCall,
  fedosRustPingExecuted,
  fedosRustPingReachable,
  fedosRustPingSucceeded,
} from "../src/runtime/fedos_rust_invocation_adapter.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import invocationAdapterSource from "../src/runtime/fedos_rust_invocation_adapter.ts?raw";
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
 * Stage 377–384 — "The First Minimal Rust 'Invocation': Ping Executes
 * (Honestly, Without a Real Boundary)": planPing() now resolves
 * "RustPingExecuted"/succeeded=true via fedosRustPingBridgeCall(), a
 * pure TypeScript mirror of packages/fedos-core-rust's
 * fedos_runtime_ping_internal() -- NOT a literal WASM/FFI/native-addon
 * call. No cryptographic operation of any kind is introduced.
 */
describe("The first Rust ping 'execution', fail-closed everywhere else (Stage 377-384)", () => {
  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
  }

  it("1. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.state).toBe("Unsupported");
    expect(encrypted.allowed).toBe(false);
    const decrypted = await provider.decrypt({});
    expect(decrypted.state).toBe("Unsupported");
    expect(decrypted.allowed).toBe(false);
  });

  it("2. planEncrypt/planDecrypt still always resolve BlockedByImplementation, untouched by planPing()'s new behavior", () => {
    const adapter = new FedosRustInvocationAdapterPlaceholder();
    expect(adapter.planEncrypt({ kind: "Encrypt" }).state).toBe("BlockedByImplementation");
    expect(adapter.planDecrypt({ kind: "Decrypt" }).state).toBe("BlockedByImplementation");
  });

  it("3. planPing() now executes and succeeds, using a dedicated, separate state model", () => {
    const adapter = new FedosRustInvocationAdapterPlaceholder();
    const decision = adapter.planPing();
    expect(decision.state).toBe("RustPingExecuted");
    expect(decision.succeeded).toBe(true);
    // No `kind` field: distinct from FedosRustInvocationAdapterDecision.
    expect(decision).not.toHaveProperty("kind");
  });

  it("4. Rust ping is the only Rust function this file's ping path ever mentions -- no encrypt/decrypt/crypto Rust fn name appears", () => {
    const pingSection = codeOnlyOf(invocationAdapterSource);
    const cryptoRustFnNames = [
      "fedos_encrypt",
      "fedos_decrypt",
      "encrypt_placeholder",
      "decrypt_placeholder",
      "derive_key_placeholder",
      "random_bytes_placeholder",
      "fedos_generate_aead_key_32",
      "fedos_random_bytes_32",
      "fedos_aead_nonce_96",
    ];
    for (const name of cryptoRustFnNames) {
      expect(libRsSource, `sanity: ${name} should exist in lib.rs`).toContain(`fn ${name}`);
      expect(pingSection).not.toContain(name);
    }
  });

  it("5. no NIP-44 reference anywhere in the Adapter file", () => {
    expect(codeOnlyOf(invocationAdapterSource)).not.toMatch(/nip-?44/i);
  });

  it("6. no crate::crypto / crypto module reference anywhere in the Adapter file", () => {
    const codeOnly = codeOnlyOf(invocationAdapterSource);
    expect(codeOnly).not.toMatch(/crate::crypto/);
    expect(codeOnly).not.toMatch(/\bcrypto\b/i);
  });

  it("7. the Adapter never actually loads or executes WASM (Stage 387 legitimately references the WASM Boundary abstraction; see test/runtime_wasm_boundary.test.ts for the exhaustive WASM guard)", () => {
    const codeOnly = codeOnlyOf(invocationAdapterSource);
    expect(codeOnly).not.toMatch(/WebAssembly\s*\.\s*(instantiate|compile)/);
    expect(codeOnly).not.toMatch(/wasm-bindgen/i);
    expect(codeOnly).not.toMatch(/\.wasm['"`]/);
    expect(codeOnly).not.toMatch(/\bimport\s*\(/);
  });

  it("8. no FFI reference anywhere in the Adapter file", () => {
    expect(codeOnlyOf(invocationAdapterSource)).not.toMatch(/\bffi\b/i);
  });

  it("9. no key generation of any kind -- no 'generate' + 'key' pairing, no random bytes", () => {
    const codeOnly = codeOnlyOf(invocationAdapterSource);
    expect(codeOnly).not.toMatch(/generate.*key|key.*generate/i);
    expect(codeOnly).not.toMatch(/random(Bytes)?/i);
  });

  it("10. no ConversationKey in the Adapter file", () => {
    expect(codeOnlyOf(invocationAdapterSource)).not.toMatch(/ConversationKey/);
  });

  it("11. no MessageKey in the Adapter file", () => {
    expect(codeOnlyOf(invocationAdapterSource)).not.toMatch(/MessageKey/);
  });

  it("12. no SecretHandle in the Adapter file", () => {
    expect(codeOnlyOf(invocationAdapterSource)).not.toMatch(/SecretHandle/);
  });

  it("13. no WirePayload in the Adapter file", () => {
    expect(codeOnlyOf(invocationAdapterSource)).not.toMatch(/WirePayload/);
  });

  it("14. fedosRustPingBridgeCall is a pure, deterministic, parameterless function that always returns true", () => {
    expect(fedosRustPingBridgeCall.length).toBe(0);
    for (let i = 0; i < 8; i++) {
      expect(fedosRustPingBridgeCall()).toBe(true);
    }
  });

  it("15. fedosRustPingBridgeCall's body matches fedos_runtime_ping_internal's body -- both are just 'return true'", () => {
    const tsMatch = invocationAdapterSource.match(/export function fedosRustPingBridgeCall\(\)[^{]*\{([^}]*)\}/);
    expect(tsMatch).not.toBeNull();
    expect(((tsMatch as RegExpMatchArray)[1] ?? "").trim()).toBe("return true;");

    const rustMatch = libRsSource.match(/pub\(crate\)\s+fn\s+fedos_runtime_ping_internal\(\)\s*->\s*bool\s*\{([^}]*)\}/);
    expect(rustMatch).not.toBeNull();
    expect(((rustMatch as RegExpMatchArray)[1] ?? "").trim()).toBe("true");
  });

  it("16. no real cross-language boundary was introduced -- no .wasm file, no compiled artifact, no native-addon extension", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../packages/fedos-core-rust/**/*");
    const paths = Object.keys(files);
    const forbidden = /\.(wasm|rlib|so|dll|dylib|node|a|o)$/i;
    for (const path of paths) {
      expect(forbidden.test(path), `unexpected compiled/native artifact: ${path}`).toBe(false);
    }
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

  it("18. no Runtime activation -- create_runtime.ts never calls planPing or any plan*/review*/evaluate* function", () => {
    expect(createRuntimeSource).not.toMatch(
      /planPing|planExecution|planEncrypt|planDecrypt|planRustEncrypt|planRustDecrypt|planRustApiEncrypt|planRustApiDecrypt|reviewEncrypt|reviewDecrypt|planFedosInternalRustCall|evaluateFedosInternalRustCall|planFedosRustInvocationAdapterExecution|fedosRustPingBridgeCall/,
    );
  });

  it("19. no Worker activation -- src/worker.ts still doesn't import the Adapter or any earlier chain link", () => {
    expect(workerSource).not.toMatch(
      /fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api|fedos_runtime_crypto_provider/,
    );
  });

  it("20. Cargo.toml is unchanged -- exactly 10 production dependencies", () => {
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

  it("21. package.json is unchanged -- exactly 2 dependencies", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("22. Rust public API is unchanged -- pub fn count still 27", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(pubFnNames.length).toBe(27);
  });

  it("23. FEDOS_RUNTIME_PROVIDER_IMPLEMENTED is untouched -- still fixed false", async () => {
    const module = await import("../src/runtime/fedos_runtime_crypto_provider.js");
    expect(module.FEDOS_RUNTIME_PROVIDER_IMPLEMENTED).toBe(false);
  });

  it("24. diagnostics expose rustPingExecuted/rustPingSucceeded correctly, without constructing an instance", () => {
    expect(fedosRustPingReachable()).toBe(true);
    expect(fedosRustPingExecuted()).toBe(true);
    expect(fedosRustPingSucceeded()).toBe(true);

    const status = runtimeCryptoActivationStatus();
    expect(status.rustPingExecuted).toBe(true);
    expect(status.rustPingSucceeded).toBe(true);

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.rustPingExecuted).toBe(true);
    expect(workerStatus.rustPingSucceeded).toBe(true);
  });
});
