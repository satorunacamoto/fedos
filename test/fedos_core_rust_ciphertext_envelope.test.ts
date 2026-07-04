import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import ciphertextEnvelopeSource from "../packages/fedos-core-rust/src/crypto/ciphertext_envelope.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 157–158 — internal ciphertext envelope skeleton + validation.
 *
 * `packages/fedos-core-rust/src/crypto/ciphertext_envelope.rs` (new) fixes
 * `AeadCiphertextEnvelope` — a SKELETON holding a version/algorithm/
 * AAD-domain label, a real 12-byte nonce, and a fixed, non-secret
 * ciphertext PLACEHOLDER (never real ciphertext) — plus
 * `validate_envelope_internal`, which structurally validates untrusted
 * candidate field values (no AEAD authentication, no serialization).
 *
 * Scope for this stage: envelope skeleton + validation only. No public
 * encrypt/decrypt, no seal/open bridge to real AEAD output, no
 * serialization (JSON/base64/CBOR), no Runtime/Worker/Storage/Nostr/
 * NIP-44/WASM connection, no `Cargo.toml` change — every one of those is
 * verified absent below.
 */
describe("FedOS Rust crate — internal ciphertext envelope skeleton (Stage 157–158)", () => {
  const cargoCode: string = cargoTomlSource
    .split("\n")
    .map((line: string) => line.replace(/#.*$/, ""))
    .join("\n")
    .toLowerCase();

  it("1. AeadEnvelopeVersion/AeadEnvelopeAlgorithm/AeadEnvelopeAadDomain/AeadCiphertextEnvelope/AeadEnvelopeStatus/AeadEnvelopeDecision are pub(crate)-only, never pub", () => {
    for (const name of [
      "AeadEnvelopeVersion",
      "AeadEnvelopeAlgorithm",
      "AeadEnvelopeAadDomain",
      "AeadCiphertextEnvelope",
      "AeadEnvelopeStatus",
      "AeadEnvelopeDecision",
    ]) {
      expect(ciphertextEnvelopeSource, `expected pub(crate) ${name}`).toMatch(
        new RegExp(`\\bpub\\(crate\\)\\s+(enum|struct)\\s+${name}\\b`),
      );
      expect(ciphertextEnvelopeSource, `${name} must never be pub`).not.toMatch(
        new RegExp(`\\bpub\\s+(enum|struct)\\s+${name}\\b`),
      );
    }
  });

  it("2. AeadCiphertextEnvelope holds version/algorithm/nonce [u8;12]/ciphertext placeholder [u8;4]/aad_domain", () => {
    expect(ciphertextEnvelopeSource).toMatch(/version:\s*AeadEnvelopeVersion/);
    expect(ciphertextEnvelopeSource).toMatch(/algorithm:\s*AeadEnvelopeAlgorithm/);
    expect(ciphertextEnvelopeSource).toMatch(/nonce:\s*\[\s*u8\s*;\s*12\s*\]/);
    expect(ciphertextEnvelopeSource).toMatch(/ciphertext_placeholder:\s*\[\s*u8\s*;\s*4\s*\]/);
    expect(ciphertextEnvelopeSource).toMatch(/aad_domain:\s*AeadEnvelopeAadDomain/);
    // No Vec<u8> ciphertext field — this is a fixed placeholder, not real
    // variable-length ciphertext.
    expect(ciphertextEnvelopeSource).not.toMatch(/ciphertext[a-z_]*:\s*Vec<u8>/i);
  });

  it("3. AeadEnvelopeVersion has exactly one variant (V1); AeadEnvelopeAlgorithm has exactly two (ChaCha20Poly1305/Aes256Gcm)", () => {
    expect(ciphertextEnvelopeSource).toContain("V1");
    expect(ciphertextEnvelopeSource).toContain("ChaCha20Poly1305");
    expect(ciphertextEnvelopeSource).toContain("Aes256Gcm");
  });

  it("4. AeadEnvelopeAadDomain mirrors the five AeadAadDomain labels", () => {
    for (const domain of ["RootKey", "Identity", "Storage", "Conversation", "TestOnly"]) {
      expect(ciphertextEnvelopeSource, `expected AAD domain: ${domain}`).toContain(domain);
    }
  });

  it("5. AeadEnvelopeAlgorithm and AeadEnvelopeAadDomain are SEPARATE types from aead_internal's AeadCipher/AeadAadDomain — no import from aead_internal", () => {
    // A bare mention of the crate-usage PATH (`aead_internal::` or the
    // `AeadCipher` type name) would mean a real import/reuse; a plain
    // enum-variant name like `ChaCha20Poly1305` is expected and fine (it
    // is the label this skeleton's OWN separate enum uses too).
    expect(ciphertextEnvelopeSource).not.toMatch(/use\s+super::aead_internal/);
    expect(ciphertextEnvelopeSource).not.toMatch(/\baead_internal::/);
    expect(ciphertextEnvelopeSource).not.toMatch(/\bAeadCipher\b/);
    expect(ciphertextEnvelopeSource).not.toMatch(/\bsuper::aead_internal::AeadAadDomain\b/);
  });

  it("6. validate_envelope_internal is pub(crate)-only and checks version/algorithm/domain/nonce-length/ciphertext-placeholder", () => {
    expect(ciphertextEnvelopeSource).toMatch(
      /\bpub\(crate\)\s+fn\s+validate_envelope_internal\s*\(/,
    );
    expect(ciphertextEnvelopeSource).not.toMatch(/\bpub\s+fn\s+validate_envelope_internal\b/);
    for (const status of [
      "Valid",
      "InvalidVersion",
      "InvalidAlgorithm",
      "InvalidAadDomain",
      "InvalidNonceLength",
      "InvalidCiphertextPlaceholder",
    ]) {
      expect(ciphertextEnvelopeSource, `expected AeadEnvelopeStatus variant: ${status}`).toContain(
        status,
      );
    }
  });

  it("7. no AEAD authentication/decryption and no seal/open call anywhere in this module", () => {
    // Crate-usage patterns only — NOT a bare algorithm-name substring
    // match: `AeadEnvelopeAlgorithm::ChaCha20Poly1305` is this skeleton's
    // OWN separate label (required by spec), not a reuse of the
    // `chacha20poly1305`/`aes-gcm` crates themselves.
    expect(ciphertextEnvelopeSource).not.toMatch(/\bseal_internal\s*\(/);
    expect(ciphertextEnvelopeSource).not.toMatch(/\bopen_internal\s*\(/);
    expect(ciphertextEnvelopeSource).not.toMatch(/\bSecretHandle::/);
    expect(ciphertextEnvelopeSource).not.toMatch(/\buse\s+chacha20poly1305\b/);
    expect(ciphertextEnvelopeSource).not.toMatch(/\bchacha20poly1305::/);
    expect(ciphertextEnvelopeSource).not.toMatch(/\buse\s+aes_gcm\b/);
    expect(ciphertextEnvelopeSource).not.toMatch(/\baes_gcm::/);
    expect(ciphertextEnvelopeSource).not.toMatch(/\bChaCha20Poly1305::new\b/);
    expect(ciphertextEnvelopeSource).not.toMatch(/\bAes256Gcm::new\b/);
  });

  it("8. no serialization anywhere: no JSON/base64/CBOR/serde in ciphertext_envelope.rs", () => {
    expect(ciphertextEnvelopeSource).not.toMatch(/\bserde\b/i);
    expect(ciphertextEnvelopeSource).not.toMatch(/\bjson\b/i);
    expect(ciphertextEnvelopeSource).not.toMatch(/\bbase64\b/i);
    expect(ciphertextEnvelopeSource).not.toMatch(/\bcbor\b/i);
    expect(ciphertextEnvelopeSource).not.toMatch(/\bto_vec\s*\(\s*\)\s*;?\s*\/\/.*serial/i);
    expect(ciphertextEnvelopeSource).not.toMatch(/#\[derive\([^)]*Serialize[^)]*\)\]/);
    expect(ciphertextEnvelopeSource).not.toMatch(/#\[derive\([^)]*Deserialize[^)]*\)\]/);
  });

  it("9. no public encrypt()/decrypt()/deriveKey anywhere in lib.rs or this module", () => {
    expect(ciphertextEnvelopeSource).not.toMatch(/\bpub\s+fn\s+encrypt\b/);
    expect(ciphertextEnvelopeSource).not.toMatch(/\bpub\s+fn\s+decrypt\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+encrypt\s*\(/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+decrypt\s*\(/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+deriveKey\b/i);
  });

  it("10. no public raw key getter and no public raw nonce parameter anywhere in this module", () => {
    expect(ciphertextEnvelopeSource).not.toMatch(/\bpub\s+fn\s+\w*key\w*\(/i);
    expect(ciphertextEnvelopeSource).not.toMatch(/\bexpose_secret\b/);
    expect(ciphertextEnvelopeSource).not.toMatch(/\bSecretBox\b/);
  });

  it("11. lib.rs's public pub fn surface is unchanged (still 24 functions) — the envelope skeleton adds no pub fn", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map(
      (m) => m[1],
    );
    expect(pubFnNames.length).toBe(24);
    expect(pubFnNames).not.toContain("validate_envelope_internal");
  });

  it("12. Cargo.toml is unchanged — no new dependency, still 9 production dependencies", () => {
    const depsIdx = cargoCode.indexOf("[dependencies]");
    const devDepsIdx = cargoCode.indexOf("[dev-dependencies]");
    const productionDepsSection = cargoCode.slice(depsIdx, devDepsIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(9);
  });

  it("13. not connected to Runtime/Worker/Storage/Nostr/NIP-44/WASM in any way", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("ciphertext_envelope");
      expect(src).not.toContain("aeadciphertextenvelope");
      expect(src).not.toContain("validate_envelope_internal");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(ciphertextEnvelopeSource).not.toMatch(/\bnip.?44\b/i);
    expect(ciphertextEnvelopeSource).not.toMatch(/\bstorage::/);
    expect(ciphertextEnvelopeSource).not.toMatch(/\bnostr::/i);
  });

  it("14. no unwrap/expect/panic/todo/unimplemented anywhere in this module's production code", () => {
    const firstCfgTestIdx = ciphertextEnvelopeSource.indexOf("#[cfg(test)]");
    const productionOnly =
      firstCfgTestIdx === -1
        ? ciphertextEnvelopeSource
        : ciphertextEnvelopeSource.slice(0, firstCfgTestIdx);
    expect(productionOnly).not.toMatch(/\.unwrap\s*\(/);
    expect(productionOnly).not.toMatch(/\.expect\s*\(/);
    expect(productionOnly).not.toMatch(/\bpanic!\s*\(/);
    expect(productionOnly).not.toMatch(/\btodo!\s*\(/);
    expect(productionOnly).not.toMatch(/\bunimplemented!\s*\(/);
  });

  it("15. no `unsafe` anywhere in ciphertext_envelope.rs; crate-level forbid stays intact", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(ciphertextEnvelopeSource).not.toContain("unsafe");
  });
});
