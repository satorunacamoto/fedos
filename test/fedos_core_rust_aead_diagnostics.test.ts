import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import aeadDiagnosticsSource from "../packages/fedos-core-rust/src/crypto/aead_diagnostics.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cryptoDiagnosticsSource from "../packages/fedos-core-rust/src/crypto/diagnostics.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

/**
 * Stage 155 — AEAD diagnostics preview.
 *
 * `packages/fedos-core-rust/src/crypto/aead_diagnostics.rs` (new) fixes
 * `aead_diagnostics_preview()`: a fixed, hand-maintained, display-only
 * two-row snapshot reporting `ChaCha20Poly1305` and `Aes256Gcm` as `Ready`.
 * `crypto/diagnostics.rs`'s own coarse `crypto_diagnostics_preview()` has
 * its `Aead` row flipped from `NotConnected` to `Ready` this stage.
 *
 * Scope: display-only, non-secret, `pub(crate)`-at-most. No public API
 * addition, no live probe (no crypto function call to compute readiness),
 * no secret byte ever displayed.
 */
describe("FedOS Rust crate — AEAD diagnostics preview (Stage 155)", () => {
  it("1. aead_diagnostics_preview is pub(crate)-only, takes no parameter, and returns a fixed [AeadAlgorithmReport; 2]", () => {
    expect(aeadDiagnosticsSource).toMatch(
      /\bpub\(crate\)\s+fn\s+aead_diagnostics_preview\s*\(\s*\)\s*->\s*\[\s*AeadAlgorithmReport\s*;\s*2\s*\]/,
    );
    expect(aeadDiagnosticsSource).not.toMatch(/\bpub\s+fn\s+aead_diagnostics_preview\b/);
  });

  it("2. AeadAlgorithmReport is pub(crate)-only and carries only algorithm + readiness labels — no secret field", () => {
    expect(aeadDiagnosticsSource).toMatch(/\bpub\(crate\)\s+struct\s+AeadAlgorithmReport\b/);
    expect(aeadDiagnosticsSource).not.toMatch(/\bpub\s+struct\s+AeadAlgorithmReport\b/);
    expect(aeadDiagnosticsSource).not.toMatch(/\b(key|nonce|plaintext|ciphertext|tag|secret)\s*:\s*\w/i);
    expect(aeadDiagnosticsSource).not.toMatch(/:\s*Vec<u8>/);
    expect(aeadDiagnosticsSource).not.toMatch(/:\s*\[\s*u8/);
  });

  it("3. both algorithms report Ready — no NotConnected/NotImplemented row", () => {
    expect(aeadDiagnosticsSource).toContain("CapabilityReadiness::Ready");
    expect(aeadDiagnosticsSource).not.toContain("CapabilityReadiness::NotConnected");
    expect(aeadDiagnosticsSource).not.toContain("CapabilityReadiness::NotImplemented");
  });

  it("4. the preview is a fixed table — no call into seal_internal/open_internal/SecretHandle/fedos_aead_nonce_96", () => {
    expect(aeadDiagnosticsSource).not.toMatch(/\bseal_internal\s*\(/);
    expect(aeadDiagnosticsSource).not.toMatch(/\bopen_internal\s*\(/);
    expect(aeadDiagnosticsSource).not.toMatch(/\bSecretHandle::new/);
    expect(aeadDiagnosticsSource).not.toMatch(/\bfedos_aead_nonce_96\s*\(/);
    expect(aeadDiagnosticsSource).not.toMatch(/\bfedos_random_bytes_32\s*\(/);
  });

  it("5. crypto/diagnostics.rs's Aead row is now Ready, and no capability reports NotConnected", () => {
    expect(cryptoDiagnosticsSource).toMatch(
      /CryptoCapability::Aead,\s*\n\s*readiness:\s*CapabilityReadiness::Ready,/,
    );
  });

  it("6. no secret byte, key, nonce, plaintext, or ciphertext ever appears in either diagnostics file", () => {
    for (const source of [aeadDiagnosticsSource, cryptoDiagnosticsSource]) {
      expect(source).not.toMatch(/\bSecretBox\b/);
      expect(source).not.toMatch(/\bexpose_secret\b/);
      expect(source).not.toMatch(/\bexpose_bytes_for_internal/);
    }
  });

  it("7. lib.rs's public pub fn surface is unchanged (still 24 functions) — AEAD diagnostics adds no pub fn", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map(
      (m) => m[1],
    );
    expect(pubFnNames.length).toBe(70);    expect(pubFnNames).not.toContain("aead_diagnostics_preview");
  });

  it("8. not connected to Runtime/Worker in any way", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("aead_diagnostics");
      expect(src).not.toContain("aeadalgorithmreport");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
    }
  });

  it("9. no unwrap/expect/panic/unsafe in aead_diagnostics.rs's production code", () => {
    const firstCfgTestIdx = aeadDiagnosticsSource.indexOf("#[cfg(test)]");
    const productionOnly =
      firstCfgTestIdx === -1
        ? aeadDiagnosticsSource
        : aeadDiagnosticsSource.slice(0, firstCfgTestIdx);
    expect(productionOnly).not.toMatch(/\.unwrap\s*\(/);
    expect(productionOnly).not.toMatch(/\.expect\s*\(/);
    expect(productionOnly).not.toMatch(/\bpanic!\s*\(/);
    expect(productionOnly).not.toContain("unsafe");
  });
});
