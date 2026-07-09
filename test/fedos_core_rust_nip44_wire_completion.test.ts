import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cryptoModSource from "../packages/fedos-core-rust/src/crypto.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilityMatrixSource from "../packages/fedos-core-rust/src/crypto/capability_matrix.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import diagnosticsSource from "../packages/fedos-core-rust/src/crypto/diagnostics.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WireEncodingSource from "../packages/fedos-core-rust/src/crypto/nip44_wire_encoding.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WireEncodingVectorsSource from "../packages/fedos-core-rust/src/crypto/nip44_wire_encoding_vectors.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WireEncryptSource from "../packages/fedos-core-rust/src/crypto/nip44_wire_encrypt.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WireEncryptVectorsSource from "../packages/fedos-core-rust/src/crypto/nip44_wire_encrypt_vectors.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WireDecryptSource from "../packages/fedos-core-rust/src/crypto/nip44_wire_decrypt.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WireDecryptInvalidVectorsSource from "../packages/fedos-core-rust/src/crypto/nip44_wire_decrypt_invalid_vectors.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WireDiagnosticsSource from "../packages/fedos-core-rust/src/crypto/nip44_wire_diagnostics.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import ciphertextSerializationSource from "../packages/fedos-core-rust/src/crypto/ciphertext_serialization.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import aeadInternalSource from "../packages/fedos-core-rust/src/crypto/aead_internal.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import conversationKeySource from "../packages/fedos-core-rust/src/crypto/conversation_key.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import messageKeySource from "../packages/fedos-core-rust/src/crypto/message_key.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hkdfBridgeSource from "../packages/fedos-core-rust/src/crypto/hkdf_bridge.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44PaddingSource from "../packages/fedos-core-rust/src/crypto/nip44_padding.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WireNonceSource from "../packages/fedos-core-rust/src/crypto/nip44_wire_nonce.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WirePayloadSource from "../packages/fedos-core-rust/src/crypto/nip44_wire_payload.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageTypesSource from "../src/storage/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopStorageSource from "../src/storage/noop_storage.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import federationTypesSource from "../src/federation/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WireCryptoCompletionDocSource from "../docs/nip44_wire_crypto_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WireRoadmapSource from "../docs/nip44_wire_implementation_roadmap.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WirePayloadLayoutDocSource from "../docs/nip44_wire_payload_layout.md?raw";

/**
 * Stage 234–240 — "NIP-44 v2 wire-compatible implementation completion":
 * real base64 wire payload encode/decode (`crypto::nip44_wire_encoding`,
 * Stage 234), `invalid.decrypt` vector wiring (Stage 235), the complete
 * ENCRYPT pipeline (`crypto::nip44_wire_encrypt`, Stage 236), and full
 * encrypt+decrypt round-trip vector verification (Stage 237) against
 * ALL 10 `valid.encrypt_decrypt` cases. **No Runtime/Worker/Storage/
 * Relay/Nostr connection, no public API addition, no `fedos_encrypt`/
 * `fedos_decrypt` change, no `ciphertext_serialization` change, no new
 * Cargo dependency, no `package.json` change** — every one of those is
 * verified absent below.
 */
describe("NIP-44 wire-compatible implementation completion: base64 encoding + invalid vectors + encrypt pipeline (Stage 234-240)", () => {
  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
  }

  function productionOnlyOf(source: string): string {
    const idx = source.indexOf("#[cfg(test)]");
    return idx === -1 ? source : source.slice(0, idx);
  }

  const PRODUCTION_FILES: [string, string][] = [
    ["nip44_wire_encoding.rs", nip44WireEncodingSource],
    ["nip44_wire_encrypt.rs", nip44WireEncryptSource],
  ];

  it("1. crypto.rs declares nip44_wire_encoding/nip44_wire_encrypt as pub(crate) mod, and the four new vector modules as #[cfg(test)]-only", () => {
    for (const module of ["nip44_wire_encoding", "nip44_wire_encrypt"]) {
      expect(cryptoModSource).toMatch(new RegExp(`pub\\(crate\\)\\s+mod\\s+${module};`));
      expect(cryptoModSource).not.toMatch(new RegExp(`\\n\\s*pub\\s+mod\\s+${module};`));
    }
    for (const module of [
      "nip44_wire_encoding_vectors",
      "nip44_wire_encrypt_vectors",
      "nip44_wire_decrypt_invalid_vectors",
    ]) {
      expect(cryptoModSource).toMatch(
        new RegExp(`#\\[cfg\\(test\\)\\]\\s*\\r?\\n\\s*mod\\s+${module}\\s*;`),
      );
    }
  });

  it("2. no pub fn/struct/enum/mod in nip44_wire_encoding.rs/nip44_wire_encrypt.rs — pub(crate) only", () => {
    for (const [name, src] of PRODUCTION_FILES) {
      expect(src, `${name} must declare no pub fn`).not.toMatch(/^\s*pub\s+fn\s+/m);
      expect(src, `${name} must declare no pub struct`).not.toMatch(/^\s*pub\s+struct\s+/m);
      expect(src, `${name} must declare no pub enum`).not.toMatch(/^\s*pub\s+enum\s+/m);
      expect(src, `${name} must declare no pub mod`).not.toMatch(/^\s*pub\s+mod\s+/m);
    }
  });

  it("3. no unsafe/unwrap/expect/panic in the production-only portion of nip44_wire_encoding.rs/nip44_wire_encrypt.rs", () => {
    for (const [name, src] of PRODUCTION_FILES) {
      const codeOnly = codeOnlyOf(productionOnlyOf(src));
      expect(codeOnly, `${name} must not use unsafe`).not.toContain("unsafe");
      expect(codeOnly, `${name} must not use .unwrap(`).not.toMatch(/\.unwrap\s*\(/);
      expect(codeOnly, `${name} must not use .expect(`).not.toMatch(/\.expect\s*\(/);
      expect(codeOnly, `${name} must not use panic!(`).not.toMatch(/\bpanic!\s*\(/);
    }
  });

  it("4. the base64 helper functions in nip44_wire_encoding.rs are private (never pub(crate)), and are STANDARD base64 (not base64url)", () => {
    expect(nip44WireEncodingSource).not.toMatch(/pub\(crate\)\s+fn\s+base64_standard_encode_internal/);
    expect(nip44WireEncodingSource).not.toMatch(/pub\(crate\)\s+fn\s+base64_standard_decode_internal/);
    expect(nip44WireEncodingSource).toMatch(/fn\s+base64_standard_encode_internal/);
    expect(nip44WireEncodingSource).toMatch(/fn\s+base64_standard_decode_internal/);
    expect(nip44WireEncodingSource).toMatch(/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789\+\//);
  });

  it("5. nip44_wire_encoding is never confused with ciphertext_serialization's base64url codec — no cross-reference or shared function, and ciphertext_serialization is untouched", () => {
    const codeOnly = codeOnlyOf(nip44WireEncodingSource);
    expect(codeOnly).not.toMatch(/ciphertext_serialization/);
    expect(codeOnly).not.toMatch(/base64url/i);
    // ciphertext_serialization's own base64url alphabet uses '-'/'_', never '+'//'.
    expect(ciphertextSerializationSource).not.toMatch(
      /ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789\+\//,
    );
  });

  it("6. encrypt_wire_internal draws its nonce only via generate_wire_nonce_internal — no caller-supplied nonce in the production entry point", () => {
    const fnMatch = nip44WireEncryptSource.match(
      /pub\(crate\)\s+fn\s+encrypt_wire_internal\s*\(([^)]*)\)/,
    );
    expect(fnMatch, "expected to find encrypt_wire_internal's signature").not.toBeNull();
    expect(fnMatch![1]).not.toMatch(/nonce/);
    expect(nip44WireEncryptSource).toMatch(/generate_wire_nonce_internal\s*\(\s*\)/);
  });

  it("7. the nonce-accepting encrypt variant is #[cfg(test)]-gated only — never reachable from production code", () => {
    const idx = nip44WireEncryptSource.indexOf(
      "fn encrypt_wire_from_bytes_with_nonce_for_test_internal",
    );
    expect(idx).toBeGreaterThan(-1);
    const precedingText = nip44WireEncryptSource.slice(0, idx);
    const lastCfgTestIdx = precedingText.lastIndexOf("#[cfg(test)]");
    expect(lastCfgTestIdx).toBeGreaterThan(-1);
    // No other item declaration between the #[cfg(test)] attribute and
    // the function itself.
    const between = precedingText.slice(lastCfgTestIdx);
    expect(between).not.toMatch(/pub\(crate\)\s+fn\s+\w+\s*\(/);
  });

  it("8. invalid.decrypt is wired: 12 cases, all collapsing to InvalidPayload or AuthenticationFailed", () => {
    expect(nip44WireDecryptInvalidVectorsSource).toContain("#![cfg(test)]");
    expect(nip44WireDecryptInvalidVectorsSource).toContain("invalid.decrypt");
    expect(nip44WireDecryptInvalidVectorsSource).toMatch(/cases\.len\(\)\s*,\s*12\s*\)/);
    expect(nip44WireDecryptInvalidVectorsSource).toMatch(/InvalidPayload/);
    expect(nip44WireDecryptInvalidVectorsSource).toMatch(/AuthenticationFailed/);
  });

  it("9. nip44_wire_decrypt's Nip44WireDecryptStatus has exactly four variants including InvalidPayload", () => {
    const enumMatch = nip44WireDecryptSource.match(
      /pub\(crate\)\s+enum\s+Nip44WireDecryptStatus\s*\{([\s\S]*?)\n\}/,
    );
    expect(enumMatch).not.toBeNull();
    const variants = [...enumMatch![1].matchAll(/^\s*(\w+),?\s*$/gm)].map((m) => m[1]);
    expect(variants).toEqual([
      "Ready",
      "InvalidConversationKey",
      "InvalidPayload",
      "AuthenticationFailed",
    ]);
  });

  it("10. nip44_wire_diagnostics reports exactly eight rows including WireEncoding/WireEncrypt/WireDecrypt/WireInvalidVectors, all Ready", () => {
    expect(nip44WireDiagnosticsSource).toMatch(
      /pub\(crate\)\s+fn\s+nip44_wire_diagnostics_preview\s*\(\s*\)\s*->\s*\[\s*Nip44WireFeatureReport\s*;\s*8\s*\]/,
    );
    for (const feature of ["WireEncoding", "WireEncrypt", "WireDecrypt", "WireInvalidVectors"]) {
      expect(nip44WireDiagnosticsSource).toMatch(new RegExp(feature));
    }
  });

  it("11. capability_matrix/diagnostics are unchanged in shape — still sixteen capabilities, still zero NotConnected rows (no CryptoCapability addition this stage)", () => {
    expect(capabilityMatrixSource).toMatch(
      /pub\(crate\)\s+const\s+ALL:\s*\[CryptoCapability;\s*16\]\s*=\s*\[/,
    );
    expect(diagnosticsSource).not.toMatch(/readiness:\s*CapabilityReadiness::NotConnected/);
    expect(diagnosticsSource).not.toMatch(/WireEncoding|WireEncrypt|WireDecrypt|WireInvalidVectors/);
  });

  it("12. crypto::conversation_key, crypto::message_key, crypto::hkdf_bridge, crypto::nip44_padding, crypto::nip44_wire_nonce, crypto::nip44_wire_payload, and crypto::ciphertext_serialization are untouched by this stage", () => {
    for (const src of [
      conversationKeySource,
      messageKeySource,
      hkdfBridgeSource,
      nip44PaddingSource,
      nip44WireNonceSource,
      nip44WirePayloadSource,
      ciphertextSerializationSource,
    ]) {
      expect(src).not.toMatch(
        /Nip44WireEncod|Nip44WireEncrypt|encode_wire_payload_internal|decode_wire_payload_internal/,
      );
    }
  });

  it("13. crypto::aead_internal (the AEAD bridge) is untouched, and no fedos_encrypt/fedos_decrypt call exists anywhere in the new wire-crypto files", () => {
    expect(aeadInternalSource).not.toMatch(/Nip44WireEncod|Nip44WireEncrypt|nip44_wire/i);
    for (const [name, src] of [
      ...PRODUCTION_FILES,
      ["nip44_wire_encoding_vectors.rs", nip44WireEncodingVectorsSource],
      ["nip44_wire_encrypt_vectors.rs", nip44WireEncryptVectorsSource],
      ["nip44_wire_decrypt_invalid_vectors.rs", nip44WireDecryptInvalidVectorsSource],
    ] as [string, string][]) {
      expect(src, `${name} must not call fedos_encrypt`).not.toMatch(/fedos_encrypt\(/);
      expect(src, `${name} must not call fedos_decrypt`).not.toMatch(/fedos_decrypt\(/);
    }
  });

  it("14. not connected to Runtime, Worker, StorageBackend, or FederationProvider in any way", () => {
    for (const src of [runtimeSource, workerSource]) {
      expect(src).not.toMatch(/nip44_wire_encoding|nip44_wire_encrypt|encode_wire_payload_internal/i);
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
    }
    for (const src of [storageTypesSource, noopStorageSource, federationTypesSource]) {
      expect(src).not.toMatch(/nip44_wire_encoding|nip44_wire_encrypt/i);
    }
  });

  it("15. the crate's public pub fn surface is unchanged at twenty-seven — no public API addition", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
    expect(pubFnNames.length).toBe(27);
    for (const name of pubFnNames) {
      expect(name.toLowerCase()).not.toContain("nip44");
      expect(name.toLowerCase()).not.toContain("wireencod");
      expect(name.toLowerCase()).not.toContain("wireencrypt");
    }
  });

  it("16. Cargo.toml still has exactly 10 production dependencies — zero new dependency added (no base64 crate)", () => {
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
    expect(cargoCode).not.toMatch(/^\s*base64\s*=/m);
  });

  it("17. package.json is unchanged — still 2 production dependencies", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(["@noble/curves", "@noble/hashes"]);
  });

  it("18. no serialization change: no serde derive in the two new production files", () => {
    for (const [name, src] of PRODUCTION_FILES) {
      expect(src, `${name} must not derive Serialize`).not.toMatch(/derive\(Serialize/);
      expect(src, `${name} must not derive Deserialize`).not.toMatch(/derive\(Deserialize/);
    }
  });

  it("19. docs/nip44_wire_crypto_completion.md, docs/nip44_wire_implementation_roadmap.md, and docs/nip44_wire_payload_layout.md all record the completion", () => {
    expect(nip44WireCryptoCompletionDocSource).toMatch(/encode_wire_payload_internal|encrypt_wire_internal/);
    expect(nip44WireRoadmapSource).toMatch(/IMPLEMENTED Stage 234|IMPLEMENTED Stage 236/);
    expect(nip44WirePayloadLayoutDocSource).toMatch(/IMPLEMENTED/i);
  });
});
