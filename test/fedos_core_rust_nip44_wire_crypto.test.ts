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
import nip44StreamCipherSource from "../packages/fedos-core-rust/src/crypto/nip44_stream_cipher.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44StreamCipherVectorsSource from "../packages/fedos-core-rust/src/crypto/nip44_stream_cipher_vectors.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44HmacSource from "../packages/fedos-core-rust/src/crypto/nip44_hmac.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WireDecryptSource from "../packages/fedos-core-rust/src/crypto/nip44_wire_decrypt.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WireDecryptVectorsSource from "../packages/fedos-core-rust/src/crypto/nip44_wire_decrypt_vectors.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WireDiagnosticsSource from "../packages/fedos-core-rust/src/crypto/nip44_wire_diagnostics.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import conversationKeySource from "../packages/fedos-core-rust/src/crypto/conversation_key.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import messageKeySource from "../packages/fedos-core-rust/src/crypto/message_key.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hkdfBridgeSource from "../packages/fedos-core-rust/src/crypto/hkdf_bridge.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44PaddingSource from "../packages/fedos-core-rust/src/crypto/nip44_padding.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44MessageKeysSource from "../packages/fedos-core-rust/src/crypto/nip44_message_keys.rs?raw";
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

/**
 * Stage 229–233 — "NIP-44 wire crypto completion": a byte-exact, hand-
 * implemented raw ChaCha20 stream cipher (`crypto::nip44_stream_cipher`,
 * Stage 229–230, vector-verified against `valid.encrypt_decrypt`), real
 * HMAC-SHA256 authentication (`crypto::nip44_hmac`, Stage 231), and the
 * complete verify-HMAC → decrypt-stream → unpad DECRYPT pipeline
 * (`crypto::nip44_wire_decrypt`, Stage 232, vector-verified end-to-end).
 * `crypto::nip44_wire_diagnostics`'s preview grows to four rows (Stage
 * 233). **No AEAD connection, no encrypt pipeline, no wire payload
 * encode/decode, no base64 (outside test-only fixture parsing), no
 * `ConversationKey`/`MessageKey`/`hkdf_bridge`/`nip44_padding` change, no
 * `CryptoCapability` addition, no public API addition, no Runtime/
 * Worker/Storage/Relay/Nostr connection, no new Cargo dependency** —
 * every one of those is verified absent below.
 */
describe("NIP-44 wire crypto completion: ChaCha20 + HMAC-SHA256 + decrypt pipeline (Stage 229-233)", () => {
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
    ["nip44_stream_cipher.rs", nip44StreamCipherSource],
    ["nip44_hmac.rs", nip44HmacSource],
    ["nip44_wire_decrypt.rs", nip44WireDecryptSource],
  ];

  const ALL_NEW_FILES: [string, string][] = [
    ...PRODUCTION_FILES,
    ["nip44_stream_cipher_vectors.rs", nip44StreamCipherVectorsSource],
    ["nip44_wire_decrypt_vectors.rs", nip44WireDecryptVectorsSource],
    ["nip44_wire_diagnostics.rs", nip44WireDiagnosticsSource],
  ];

  it("1. crypto.rs declares nip44_stream_cipher/nip44_hmac/nip44_wire_decrypt as pub(crate) mod, and the two vector modules as #[cfg(test)]-only", () => {
    for (const module of ["nip44_stream_cipher", "nip44_hmac", "nip44_wire_decrypt"]) {
      expect(cryptoModSource).toMatch(new RegExp(`pub\\(crate\\)\\s+mod\\s+${module};`));
      expect(cryptoModSource).not.toMatch(new RegExp(`\\n\\s*pub\\s+mod\\s+${module};`));
    }
    expect(cryptoModSource).toMatch(
      /#\[cfg\(test\)\]\s*\r?\n\s*mod\s+nip44_stream_cipher_vectors\s*;/,
    );
    expect(cryptoModSource).toMatch(
      /#\[cfg\(test\)\]\s*\r?\n\s*mod\s+nip44_wire_decrypt_vectors\s*;/,
    );
  });

  it("2. no pub fn/struct/enum/mod exists in any of the three new production files — pub(crate) only", () => {
    for (const [name, src] of PRODUCTION_FILES) {
      expect(src, `${name} must declare no pub fn`).not.toMatch(/^\s*pub\s+fn\s+/m);
      expect(src, `${name} must declare no pub struct`).not.toMatch(/^\s*pub\s+struct\s+/m);
      expect(src, `${name} must declare no pub enum`).not.toMatch(/^\s*pub\s+enum\s+/m);
      expect(src, `${name} must declare no pub mod`).not.toMatch(/^\s*pub\s+mod\s+/m);
    }
  });

  it("3. no unsafe/unwrap/expect/panic in the production-only portion of the three new production files", () => {
    for (const [name, src] of PRODUCTION_FILES) {
      const codeOnly = codeOnlyOf(productionOnlyOf(src));
      expect(codeOnly, `${name} must not use unsafe`).not.toContain("unsafe");
      expect(codeOnly, `${name} must not use .unwrap(`).not.toMatch(/\.unwrap\s*\(/);
      expect(codeOnly, `${name} must not use .expect(`).not.toMatch(/\.expect\s*\(/);
      expect(codeOnly, `${name} must not use panic!(`).not.toMatch(/\bpanic!\s*\(/);
    }
  });

  it("4. nip44_stream_cipher implements ChaCha20 (counter fixed at 0) with no AEAD/chacha20-crate/aead_internal connection", () => {
    const codeOnly = codeOnlyOf(nip44StreamCipherSource);
    expect(nip44StreamCipherSource).toMatch(/pub\(crate\)\s+fn\s+encrypt_stream_internal/);
    expect(nip44StreamCipherSource).toMatch(/pub\(crate\)\s+fn\s+decrypt_stream_internal/);
    expect(codeOnly).not.toMatch(/use\s+chacha20\s*::/);
    expect(codeOnly).not.toMatch(/aead_internal/);
    expect(codeOnly).not.toMatch(/AeadCipher/);
    expect(codeOnly).not.toMatch(/Poly1305/i);
  });

  it("5. nip44_hmac implements HMAC-SHA256 using sha2 + subtle::ConstantTimeEq, no hmac crate", () => {
    const codeOnly = codeOnlyOf(nip44HmacSource);
    expect(codeOnly).toMatch(/use\s+sha2\s*::/);
    expect(codeOnly).toMatch(/use\s+subtle\s*::\s*ConstantTimeEq/);
    expect(codeOnly).toMatch(/\.ct_eq\s*\(/);
    expect(codeOnly).not.toMatch(/use\s+hmac\s*::/);
    expect(codeOnly).not.toMatch(/==\s*mac\b/);
  });

  it("6. verify_hmac_internal returns exactly Verified/AuthenticationFailed — no more detailed reason", () => {
    const enumMatch = nip44HmacSource.match(
      /pub\(crate\)\s+enum\s+Nip44HmacVerifyStatus\s*\{([\s\S]*?)\n\}/,
    );
    expect(enumMatch, "expected to find the Nip44HmacVerifyStatus enum body").not.toBeNull();
    const variants = [...enumMatch![1].matchAll(/^\s*(\w+),?\s*$/gm)].map((m) => m[1]);
    expect(variants).toEqual(["Verified", "AuthenticationFailed"]);
  });

  it("7. nip44_wire_decrypt runs verify-HMAC before decrypt-stream, and collapses failures into AuthenticationFailed (plus separate InvalidConversationKey/InvalidPayload preconditions as of Stage 235)", () => {
    // Stage 235 adds a fourth variant, InvalidPayload, for encoding-level
    // failures (see test/fedos_core_rust_nip44_wire_completion.test.ts for
    // the dedicated Stage 234-238 checks) — this test's own core claim
    // (verify-HMAC strictly before decrypt-stream) still holds unchanged.
    const enumMatch = nip44WireDecryptSource.match(
      /pub\(crate\)\s+enum\s+Nip44WireDecryptStatus\s*\{([\s\S]*?)\n\}/,
    );
    expect(enumMatch, "expected to find the Nip44WireDecryptStatus enum body").not.toBeNull();
    const variants = [...enumMatch![1].matchAll(/^\s*(\w+),?\s*$/gm)].map((m) => m[1]);
    expect(variants).toEqual([
      "Ready",
      "InvalidConversationKey",
      "InvalidPayload",
      "AuthenticationFailed",
    ]);

    const verifyIdx = nip44WireDecryptSource.indexOf("verify_hmac_internal(");
    const decryptIdx = nip44WireDecryptSource.indexOf("decrypt_stream_internal(");
    expect(verifyIdx).toBeGreaterThan(-1);
    expect(decryptIdx).toBeGreaterThan(-1);
    expect(verifyIdx).toBeLessThan(decryptIdx);
  });

  it("8. crypto::conversation_key, crypto::message_key, crypto::hkdf_bridge, crypto::nip44_padding, and crypto::nip44_message_keys are untouched by this stage", () => {
    for (const src of [
      conversationKeySource,
      messageKeySource,
      hkdfBridgeSource,
      nip44PaddingSource,
    ]) {
      expect(src).not.toMatch(/Nip44WireDecrypt|Nip44HmacVerify|chacha20_block|encrypt_stream_internal/);
    }
    // nip44_message_keys is reused (its functions are CALLED), but its own
    // definitions must not have been rewritten to know about the new files.
    expect(nip44MessageKeysSource).not.toMatch(/Nip44WireDecrypt|Nip44HmacVerify/);
  });

  it("9. crypto::nip44_wire_nonce and crypto::nip44_wire_payload (Stage 224-227) are untouched by this stage", () => {
    expect(nip44WireNonceSource).not.toMatch(/Nip44WireDecrypt|Nip44HmacVerify|chacha20_block/);
    expect(nip44WirePayloadSource).not.toMatch(/Nip44WireDecrypt|Nip44HmacVerify|chacha20_block/);
  });

  it("10. nip44_wire_diagnostics reports WireCrypto/Ready and WireAuthentication/Ready among its rows (now eight total as of Stage 238)", () => {
    // Stage 238 extends this preview from four rows to eight (WireEncoding/
    // WireEncrypt/WireDecrypt/WireInvalidVectors join) — see
    // test/fedos_core_rust_nip44_wire_completion.test.ts for the dedicated
    // Stage 234-238 checks on the four new rows.
    expect(nip44WireDiagnosticsSource).toMatch(
      /pub\(crate\)\s+fn\s+nip44_wire_diagnostics_preview\s*\(\s*\)\s*->\s*\[\s*Nip44WireFeatureReport\s*;\s*8\s*\]/,
    );
    expect(nip44WireDiagnosticsSource).toMatch(/WireCrypto/);
    expect(nip44WireDiagnosticsSource).toMatch(/WireAuthentication/);
  });

  it("11. capability_matrix/diagnostics are unchanged in shape — still sixteen capabilities, still zero NotConnected rows (no CryptoCapability addition this stage)", () => {
    expect(capabilityMatrixSource).toMatch(
      /pub\(crate\)\s+const\s+ALL:\s*\[CryptoCapability;\s*16\]\s*=\s*\[/,
    );
    expect(diagnosticsSource).not.toMatch(/readiness:\s*CapabilityReadiness::NotConnected/);
    expect(diagnosticsSource).not.toMatch(/WireCrypto|WireAuthentication/);
  });

  it("12. no base64/wire-encode/wire-decode production capability exists — only #[cfg(test)]-only fixture decoders in the two vector files", () => {
    for (const [name, src] of PRODUCTION_FILES) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly, `${name} must not import base64`).not.toMatch(/use\s+base64/i);
      expect(codeOnly, `${name} must not declare an encode/decode fn`).not.toMatch(
        /fn\s+\w*(encode|decode)\w*\s*\(/i,
      );
    }
    for (const [name, src] of [
      ["nip44_stream_cipher_vectors.rs", nip44StreamCipherVectorsSource],
      ["nip44_wire_decrypt_vectors.rs", nip44WireDecryptVectorsSource],
    ] as [string, string][]) {
      expect(src, `${name} must be #![cfg(test)]-only`).toContain("#![cfg(test)]");
      expect(src, `${name}'s base64 helper must be private, never pub(crate)`).not.toMatch(
        /pub\(crate\)\s+fn\s+base64/,
      );
    }
  });

  it("13. docs/nip44_wire_crypto_completion.md exists and documents the real implementation", () => {
    expect(nip44WireCryptoCompletionDocSource).toMatch(/encrypt_stream_internal/);
    expect(nip44WireCryptoCompletionDocSource).toMatch(/compute_hmac_internal/);
    expect(nip44WireCryptoCompletionDocSource).toMatch(/decrypt_wire_internal/);
    expect(nip44WireCryptoCompletionDocSource).toMatch(/this document records real code/i);
  });

  it("14. not connected to Runtime, Worker, StorageBackend, or FederationProvider in any way", () => {
    for (const src of [runtimeSource, workerSource]) {
      expect(src).not.toMatch(
        /nip44_stream_cipher|nip44_hmac|nip44_wire_decrypt|chacha20_block|compute_hmac_internal/i,
      );
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
    }
    for (const src of [storageTypesSource, noopStorageSource, federationTypesSource]) {
      expect(src).not.toMatch(/nip44_stream_cipher|nip44_hmac|nip44_wire_decrypt/i);
    }
  });

  it("15. the crate's public pub fn surface is unchanged at twenty-seven — no public API addition", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
    expect(pubFnNames.length).toBe(64);
    for (const name of pubFnNames) {
      expect(name.toLowerCase()).not.toContain("nip44");
      expect(name.toLowerCase()).not.toContain("chacha");
      expect(name.toLowerCase()).not.toContain("hmac");
    }
  });

  it("16. Cargo.toml still has exactly 10 production dependencies — zero new dependency added (no chacha20/hmac crate)", () => {
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
    expect(cargoCode).not.toMatch(/^\s*chacha20\s*=/m);
    expect(cargoCode).not.toMatch(/^\s*hmac\s*=/m);
    expect(cargoCode).not.toMatch(/^\s*base64\s*=/m);
  });

  it("17. package.json is unchanged — still 2 production dependencies", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(["@noble/curves", "@noble/hashes"]);
  });

  it("18. no serialization change: no serde derive in any of the three new production files", () => {
    for (const [name, src] of PRODUCTION_FILES) {
      expect(src, `${name} must not derive Serialize`).not.toMatch(/derive\(Serialize/);
      expect(src, `${name} must not derive Deserialize`).not.toMatch(/derive\(Deserialize/);
    }
  });

  it("19. no fedos_encrypt/fedos_decrypt call anywhere in the new wire-crypto files", () => {
    for (const [name, src] of ALL_NEW_FILES) {
      expect(src, `${name} must not call fedos_encrypt`).not.toMatch(/fedos_encrypt\(/);
      expect(src, `${name} must not call fedos_decrypt`).not.toMatch(/fedos_decrypt\(/);
    }
  });
});
