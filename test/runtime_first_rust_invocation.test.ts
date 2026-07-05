import { describe, it, expect } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  FedosRustInvocationAdapterPlaceholder,
  fedosRustPingExecuted,
  fedosRustPingReachable,
} from "../src/runtime/fedos_rust_invocation_adapter.js";
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
 * Stage 369–376 — "The First Minimal Rust Invocation: Ping": a
 * pub(crate), no-parameter, constant-returning
 * `fedos_runtime_ping_internal()` (Stage 369) in
 * packages/fedos-core-rust, plus an unconnected TypeScript-side
 * `FedosRustInvocationAdapter.planPing()` (Stage 370) that never calls
 * Rust yet. No cryptographic operation of any kind is introduced.
 */
describe("The first minimal Rust invocation, ping only (Stage 369-376)", () => {
  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
  }

  it("1. Rust ping exists -- fedos_runtime_ping_internal is defined in lib.rs", () => {
    expect(libRsSource).toMatch(/fn\s+fedos_runtime_ping_internal\s*\(\s*\)\s*->\s*bool/);
  });

  it("2. Rust ping is pub(crate) -- not pub, not exported from the crate's public API", () => {
    expect(libRsSource).toMatch(/pub\(crate\)\s+fn\s+fedos_runtime_ping_internal/);
    expect(libRsSource).not.toMatch(/^\s*pub\s+fn\s+fedos_runtime_ping_internal/m);
  });

  it("3. Rust ping's own body always returns true -- no branch, no parameter, no allocation", () => {
    const match = libRsSource.match(/pub\(crate\)\s+fn\s+fedos_runtime_ping_internal\(\)\s*->\s*bool\s*\{([^}]*)\}/);
    expect(match).not.toBeNull();
    const body = ((match as RegExpMatchArray)[1] ?? "").trim();
    expect(body).toBe("true");
  });

  it("4. no crypto is called -- fedos_runtime_ping_internal's own body has no crate::crypto reference", () => {
    const match = libRsSource.match(/pub\(crate\)\s+fn\s+fedos_runtime_ping_internal\(\)\s*->\s*bool\s*\{([^}]*)\}/);
    const body = (match as RegExpMatchArray)[1] ?? "";
    expect(body).not.toMatch(/crate::crypto/);
  });

  it("5. no SecretHandle in the Adapter file", () => {
    expect(codeOnlyOf(invocationAdapterSource)).not.toMatch(/SecretHandle/);
  });

  it("6. no ConversationKey in the Adapter file", () => {
    expect(codeOnlyOf(invocationAdapterSource)).not.toMatch(/ConversationKey/);
  });

  it("7. no MessageKey in the Adapter file", () => {
    expect(codeOnlyOf(invocationAdapterSource)).not.toMatch(/MessageKey/);
  });

  it("8. no WirePayload in the Adapter file", () => {
    expect(codeOnlyOf(invocationAdapterSource)).not.toMatch(/WirePayload/);
  });

  it("9. no encrypt/decrypt call inside planPing() -- it never touches planEncrypt/planDecrypt", () => {
    const match = invocationAdapterSource.match(/planPing\(\)[^{]*\{([^}]*)\}/);
    expect(match).not.toBeNull();
    const body = (match as RegExpMatchArray)[1] ?? "";
    expect(body).not.toMatch(/planEncrypt|planDecrypt|encrypt|decrypt/i);
  });

  it("10. planPing() now executes its TypeScript-side ping mirror and succeeds (Stage 377 supersedes Stage 370's BlockedByImplementation)", () => {
    const adapter = new FedosRustInvocationAdapterPlaceholder();
    const decision = adapter.planPing();
    expect(decision.state).toBe("RustPingExecuted");
    expect(decision.succeeded).toBe(true);
  });

  it("11. the Adapter never actually loads or executes WASM (Stage 387 legitimately references the WASM Boundary abstraction; see test/runtime_wasm_boundary.test.ts for the exhaustive WASM guard)", () => {
    const codeOnly = codeOnlyOf(invocationAdapterSource);
    expect(codeOnly).not.toMatch(/WebAssembly\s*\.\s*(instantiate|compile)/);
    expect(codeOnly).not.toMatch(/wasm-bindgen/i);
    expect(codeOnly).not.toMatch(/\.wasm['"`]/);
    expect(codeOnly).not.toMatch(/\bimport\s*\(/);
  });

  it("12. no FFI reference anywhere in the Adapter file", () => {
    expect(codeOnlyOf(invocationAdapterSource)).not.toMatch(/\bffi\b/i);
  });

  it("13. no Runtime activation -- create_runtime.ts never calls planPing or any plan*/review*/evaluate* function", () => {
    expect(createRuntimeSource).not.toMatch(
      /planPing|planExecution|planEncrypt|planDecrypt|planRustEncrypt|planRustDecrypt|planRustApiEncrypt|planRustApiDecrypt|reviewEncrypt|reviewDecrypt|planFedosInternalRustCall|evaluateFedosInternalRustCall|planFedosRustInvocationAdapterExecution/,
    );
  });

  it("14. no Worker activation -- src/worker.ts still doesn't import the Adapter or any earlier chain link", () => {
    expect(workerSource).not.toMatch(
      /fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api|fedos_runtime_crypto_provider/,
    );
  });

  it("15. Cargo.toml is unchanged -- exactly 10 production dependencies", () => {
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
  });

  it("16. package.json is unchanged -- exactly 2 dependencies", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("17. Rust public API is unchanged -- pub fn count still 27 (ping is pub(crate), not counted)", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(pubFnNames.length).toBe(27);
    expect(pubFnNames).not.toContain("fedos_runtime_ping_internal");
  });

  it("18. encrypt/decrypt remain unchanged -- always Unsupported", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.state).toBe("Unsupported");
    expect(encrypted.allowed).toBe(false);
    const decrypted = await provider.decrypt({});
    expect(decrypted.state).toBe("Unsupported");
    expect(decrypted.allowed).toBe(false);
  });

  it("19. diagnostics expose rustPingReachable/rustPingExecuted without constructing an instance (Stage 377 flips rustPingExecuted to true)", () => {
    expect(fedosRustPingReachable()).toBe(true);
    expect(fedosRustPingExecuted()).toBe(true);

    const status = runtimeCryptoActivationStatus();
    expect(status.rustPingReachable).toBe(true);
    expect(status.rustPingExecuted).toBe(true);

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.rustPingReachable).toBe(true);
    expect(workerStatus.rustPingExecuted).toBe(true);
  });

  it("20. no process.env/Relay/Storage/Nostr/NIP-17 reference in the Adapter file", () => {
    const codeOnly = codeOnlyOf(invocationAdapterSource);
    expect(codeOnly).not.toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/relay|storage|nostr|nip-?17/i);
  });
});
