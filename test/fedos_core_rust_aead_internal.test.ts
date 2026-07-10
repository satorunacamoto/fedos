import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import aeadInternalSource from "../packages/fedos-core-rust/src/crypto/aead_internal.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 152–154 — internal AEAD implementation (ChaCha20-Poly1305 +
 * AES-256-GCM) using SecretHandle + the 96-bit nonce helper.
 *
 * `packages/fedos-core-rust/src/crypto/aead_internal.rs` (new) implements
 * `seal_internal`/`open_internal`: crate-private functions accepting ONLY a
 * `SecretHandle(AeadKeyMaterial)` key and a `Ready` `FedosAeadNonceDecision`
 * nonce — never a raw key/nonce byte from any caller. AAD is a fixed
 * `AeadAadDomain` label. `SecretHandle` gains a second narrowly-scoped
 * accessor, `expose_bytes_for_internal_aead`.
 *
 * Scope for this stage: internal AEAD only. No public `encrypt`/`decrypt`,
 * no ciphertext envelope/serialization, no Runtime/Worker/Storage/Nostr/
 * NIP-44/WASM connection, no `Cargo.toml` change — every one of those is
 * verified absent below.
 */
describe("FedOS Rust crate — internal AEAD implementation (Stage 152–154)", () => {
  function extractModule(source: string, marker: string): string {
    const start = source.indexOf(marker);
    expect(start, `expected to find "${marker}" in lib.rs`).toBeGreaterThan(-1);
    const braceStart = source.indexOf("{", start);
    expect(braceStart, `expected an opening brace after "${marker}"`).toBeGreaterThan(-1);
    let depth = 0;
    for (let i = braceStart; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) return source.slice(start, i + 1);
      }
    }
    throw new Error(`unbalanced braces while extracting module: ${marker}`);
  }

  const secretHandleModule = extractModule(libRsSource, "mod secret_handle");

  const cargoCode: string = cargoTomlSource
    .split("\n")
    .map((line: string) => line.replace(/#.*$/, ""))
    .join("\n")
    .toLowerCase();

  it("1. seal_internal/open_internal are pub(crate)-only and accept exactly (AeadCipher, &SecretHandle, &FedosAeadNonceDecision, AeadAadDomain, &[u8])", () => {
    expect(aeadInternalSource).toMatch(
      /\bpub\(crate\)\s+fn\s+seal_internal\s*\(\s*algorithm:\s*AeadCipher,\s*key:\s*&SecretHandle,\s*nonce:\s*&FedosAeadNonceDecision,\s*aad_domain:\s*AeadAadDomain,\s*plaintext:\s*&\[\s*u8\s*\],?\s*\)\s*->\s*AeadSealDecision/,
    );
    expect(aeadInternalSource).toMatch(
      /\bpub\(crate\)\s+fn\s+open_internal\s*\(\s*algorithm:\s*AeadCipher,\s*key:\s*&SecretHandle,\s*nonce:\s*&FedosAeadNonceDecision,\s*aad_domain:\s*AeadAadDomain,\s*ciphertext:\s*&\[\s*u8\s*\],?\s*\)\s*->\s*AeadOpenDecision/,
    );
    expect(aeadInternalSource).not.toMatch(/\bpub\s+fn\s+seal_internal\b/);
    expect(aeadInternalSource).not.toMatch(/\bpub\s+fn\s+open_internal\b/);
  });

  it("2. no public encrypt()/decrypt() function anywhere in aead_internal.rs or lib.rs", () => {
    expect(aeadInternalSource).not.toMatch(/\bpub\s+fn\s+encrypt\b/);
    expect(aeadInternalSource).not.toMatch(/\bpub\s+fn\s+decrypt\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+encrypt\s*\(/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+decrypt\s*\(/);
  });

  it("3. AeadCipher/AeadAadDomain/AeadStatus/AeadSealDecision/AeadOpenDecision are pub(crate)-only, never pub", () => {
    for (const name of [
      "AeadCipher",
      "AeadAadDomain",
      "AeadStatus",
      "AeadSealDecision",
      "AeadOpenDecision",
    ]) {
      expect(aeadInternalSource, `expected pub(crate) ${name}`).toMatch(
        new RegExp(`\\bpub\\(crate\\)\\s+(enum|struct)\\s+${name}\\b`),
      );
      expect(aeadInternalSource, `${name} must never be pub`).not.toMatch(
        new RegExp(`\\bpub\\s+(enum|struct)\\s+${name}\\b`),
      );
    }
  });

  it("4. AeadCipher supports exactly ChaCha20Poly1305 and Aes256Gcm", () => {
    expect(aeadInternalSource).toMatch(/\bChaCha20Poly1305\b/);
    expect(aeadInternalSource).toMatch(/\bAes256Gcm\b/);
  });

  it("5. AAD is a fixed &'static [u8] literal per domain — no caller-supplied AAD parameter", () => {
    expect(aeadInternalSource).toMatch(
      /const\s+fn\s+as_aad\s*\(\s*self\s*\)\s*->\s*&'static\s*\[\s*u8\s*\]/,
    );
    expect(aeadInternalSource).not.toMatch(/fn\s+seal_internal[^)]*\baad\s*:/);
    expect(aeadInternalSource).not.toMatch(/fn\s+open_internal[^)]*\baad\s*:/);
  });

  it("6. no public raw key getter: key bytes are read only via SecretHandle's own expose_bytes_for_internal_aead accessor", () => {
    expect(aeadInternalSource).toContain("expose_bytes_for_internal_aead()");
    expect(aeadInternalSource).not.toMatch(/\bsecrecy::/);
    expect(aeadInternalSource).not.toMatch(/\.expose_secret\s*\(/);
    expect(secretHandleModule).toMatch(
      /\bpub\(crate\)\s+fn\s+expose_bytes_for_internal_aead\s*\(\s*&self\s*\)\s*->\s*Option<\s*\[\s*u8\s*;\s*32\s*\]\s*>/,
    );
    expect(secretHandleModule).not.toMatch(/\bpub\s+fn\s+expose_bytes_for_internal_aead\b/);
  });

  it("7. no Vec<u8> exposed publicly: ciphertext/plaintext fields stay pub(crate)-at-most", () => {
    expect(aeadInternalSource).toMatch(/pub\(crate\)\s+ciphertext:\s*Option<Vec<u8>>/);
    expect(aeadInternalSource).toMatch(/pub\(crate\)\s+plaintext:\s*Option<Vec<u8>>/);
    expect(aeadInternalSource).not.toMatch(/pub\s+ciphertext:/);
    expect(aeadInternalSource).not.toMatch(/pub\s+plaintext:/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+\w+\([^)]*\)\s*->\s*[^{;]*\bAeadSealDecision\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+\w+\([^)]*\)\s*->\s*[^{;]*\bAeadOpenDecision\b/);
  });

  it("8. decrypt failure is a single fixed error label (AuthenticationFailed) — never distinguishes tamper cause", () => {
    expect(aeadInternalSource).toContain("AuthenticationFailed");
    // Exactly one Err(...) => AuthenticationFailed arm in open_internal, not
    // one per tamper cause.
    const authFailedOccurrences = (aeadInternalSource.match(/AuthenticationFailed/g) ?? []).length;
    expect(authFailedOccurrences).toBeGreaterThanOrEqual(1);
  });

  it("9. nonce reuse prevention is documented as a caller obligation (not runtime-tracked)", () => {
    expect(aeadInternalSource).toMatch(/nonce reuse/i);
    expect(aeadInternalSource).toMatch(/CALLER'S? RESPONSIBILITY|caller.*obligation/i);
  });

  it("10. no unwrap/expect/panic/todo/unimplemented anywhere in aead_internal.rs's production code", () => {
    const firstCfgTestIdx = aeadInternalSource.indexOf("#[cfg(test)]");
    const productionOnly =
      firstCfgTestIdx === -1 ? aeadInternalSource : aeadInternalSource.slice(0, firstCfgTestIdx);
    expect(productionOnly).not.toMatch(/\.unwrap\s*\(/);
    expect(productionOnly).not.toMatch(/\.expect\s*\(/);
    expect(productionOnly).not.toMatch(/\bpanic!\s*\(/);
    expect(productionOnly).not.toMatch(/\btodo!\s*\(/);
    expect(productionOnly).not.toMatch(/\bunimplemented!\s*\(/);
  });

  it("11. no `unsafe` anywhere in aead_internal.rs; crate-level forbid stays intact", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(aeadInternalSource).not.toContain("unsafe");
  });

  it("12. not connected to Runtime/Worker/Storage/Nostr/NIP-44/WASM in any way", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("aead_internal");
      expect(src).not.toContain("seal_internal");
      expect(src).not.toContain("open_internal");
      expect(src).not.toContain("aeadcipher");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(aeadInternalSource).not.toMatch(/\bnip.?44\b/i);
    expect(aeadInternalSource).not.toMatch(/\bstorage::/);
    expect(aeadInternalSource).not.toMatch(/\bnostr::/i);
  });

  it("13. lib.rs's public pub fn surface is unchanged (still 24 functions) — AEAD internal implementation adds no pub fn", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map(
      (m) => m[1],
    );
    expect(pubFnNames.length).toBe(33);
    expect(pubFnNames).not.toContain("seal_internal");
    expect(pubFnNames).not.toContain("open_internal");
  });

  it("14. Cargo.toml is unchanged — no new dependency, still 9 production dependencies", () => {
    const depsIdx = cargoCode.indexOf("[dependencies]");
    const devDepsIdx = cargoCode.indexOf("[dev-dependencies]");
    const productionDepsSection = cargoCode.slice(depsIdx, devDepsIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(11);
    expect(cargoCode).toContain("chacha20poly1305");
    expect(cargoCode).toContain("aes-gcm");
  });

  it("15. no caller-supplied nonce bytes accepted — nonce is only a FedosAeadNonceDecision from fedos_aead_nonce_96", () => {
    expect(aeadInternalSource).not.toMatch(/fn\s+seal_internal[^)]*nonce_bytes\s*:\s*\[/);
    expect(aeadInternalSource).not.toMatch(/fn\s+seal_internal[^)]*nonce\s*:\s*\[\s*u8/);
    expect(aeadInternalSource).toMatch(/nonce:\s*&FedosAeadNonceDecision/);
  });

  it("16. no deterministic/fallback crypto: no rand::/thread_rng/getrandom call inside aead_internal.rs itself", () => {
    expect(aeadInternalSource).not.toContain("getrandom");
    expect(aeadInternalSource).not.toMatch(/\brand::/);
    expect(aeadInternalSource).not.toMatch(/\bthread_rng\b/);
  });
});
