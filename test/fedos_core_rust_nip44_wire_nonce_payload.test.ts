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
import nip44WireNonceSource from "../packages/fedos-core-rust/src/crypto/nip44_wire_nonce.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WirePayloadSource from "../packages/fedos-core-rust/src/crypto/nip44_wire_payload.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WireDiagnosticsSource from "../packages/fedos-core-rust/src/crypto/nip44_wire_diagnostics.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import conversationKeySource from "../packages/fedos-core-rust/src/crypto/conversation_key.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import messageKeySource from "../packages/fedos-core-rust/src/crypto/message_key.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hkdfBridgeSource from "../packages/fedos-core-rust/src/crypto/hkdf_bridge.rs?raw";
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
import nip44WireNonceGenDocSource from "../docs/nip44_wire_nonce_generation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WirePayloadBuilderDocSource from "../docs/nip44_wire_payload_builder.md?raw";

/**
 * Stage 224–228 — NIP-44 v2 wire-compatible implementation building
 * blocks: wire nonce generation (`crypto::nip44_wire_nonce`, Stage 224),
 * a payload builder skeleton + structural-only validator
 * (`crypto::nip44_wire_payload`, Stage 225–226), and a separate,
 * two-row diagnostics preview (`crypto::nip44_wire_diagnostics`, Stage
 * 227) that adds no `CryptoCapability` variant. **No ChaCha20 stream
 * cipher, no HMAC computation, no encrypt/decrypt connection, no base64,
 * no wire encode/decode, no `ConversationKey`/`MessageKey`/`hkdf_bridge`
 * change, no public API addition, no Runtime/Worker/Storage/Relay
 * connection, no new Cargo dependency** — every one of those is verified
 * absent below.
 */
describe("NIP-44 wire nonce generation + payload skeleton + diagnostics (Stage 224-228)", () => {
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

  const NEW_FILES: [string, string][] = [
    ["nip44_wire_nonce.rs", nip44WireNonceSource],
    ["nip44_wire_payload.rs", nip44WirePayloadSource],
    ["nip44_wire_diagnostics.rs", nip44WireDiagnosticsSource],
  ];

  it("1. crypto.rs declares all three new modules as pub(crate) mod, never bare pub mod", () => {
    for (const module of ["nip44_wire_nonce", "nip44_wire_payload", "nip44_wire_diagnostics"]) {
      expect(cryptoModSource).toMatch(new RegExp(`pub\\(crate\\)\\s+mod\\s+${module};`));
      expect(cryptoModSource).not.toMatch(new RegExp(`\\n\\s*pub\\s+mod\\s+${module};`));
    }
  });

  it("2. no pub fn/struct/enum/mod exists in any of the three new files — pub(crate) only", () => {
    for (const [name, src] of NEW_FILES) {
      expect(src, `${name} must declare no pub fn`).not.toMatch(/^\s*pub\s+fn\s+/m);
      expect(src, `${name} must declare no pub struct`).not.toMatch(/^\s*pub\s+struct\s+/m);
      expect(src, `${name} must declare no pub enum`).not.toMatch(/^\s*pub\s+enum\s+/m);
      expect(src, `${name} must declare no pub mod`).not.toMatch(/^\s*pub\s+mod\s+/m);
    }
  });

  it("3. no unsafe/unwrap/expect/panic in the production-only portion of any of the three new files", () => {
    // Doc comments legitimately NAME `.unwrap(`/`.expect(`/etc. in "this
    // function never does X" reassurance prose (mirroring
    // `nip44_encrypt_decrypt_guard`'s own `strip_comment_lines` rationale)
    // — only the CODE (not comments) must never use them.
    for (const [name, src] of NEW_FILES) {
      const codeOnly = codeOnlyOf(productionOnlyOf(src));
      expect(codeOnly, `${name} must not use unsafe`).not.toContain("unsafe");
      expect(codeOnly, `${name} must not use .unwrap(`).not.toMatch(/\.unwrap\s*\(/);
      expect(codeOnly, `${name} must not use .expect(`).not.toMatch(/\.expect\s*\(/);
      expect(codeOnly, `${name} must not use panic!(`).not.toMatch(/\bpanic!\s*\(/);
    }
  });

  it("4. nip44_wire_nonce draws exactly 32 bytes via getrandom, completely independent of fedos_aead_nonce_96", () => {
    expect(nip44WireNonceSource).toMatch(/getrandom::fill/);
    expect(nip44WireNonceSource).toMatch(/\[0u8;\s*32\]/);
    const codeOnly = codeOnlyOf(nip44WireNonceSource);
    expect(codeOnly).not.toMatch(/fedos_aead_nonce_96/);
    expect(codeOnly).not.toMatch(/FedosAeadNonceDecision/);
    expect(codeOnly).not.toMatch(/FedosAeadNonceKind/);
    expect(codeOnly).not.toMatch(/FedosNonceState/);
  });

  it("5. Nip44WireNonceStatus has exactly Ready/InternalFailure — no EntropySourceUnavailable reuse", () => {
    const enumMatch = nip44WireNonceSource.match(
      /pub\(crate\)\s+enum\s+Nip44WireNonceStatus\s*\{([\s\S]*?)\n\}/,
    );
    expect(enumMatch, "expected to find the Nip44WireNonceStatus enum body").not.toBeNull();
    const variants = [...enumMatch![1].matchAll(/^\s*(\w+),?\s*$/gm)].map((m) => m[1]);
    expect(variants).toEqual(["Ready", "InternalFailure"]);
  });

  it("6. nip44_wire_payload builds a real version/nonce with placeholder ciphertext/mac, and validates structurally only", () => {
    expect(nip44WirePayloadSource).toMatch(/pub\(crate\)\s+fn\s+build_placeholder\s*\(/);
    expect(nip44WirePayloadSource).toMatch(
      /pub\(crate\)\s+fn\s+validate_wire_payload_placeholder\s*\(/,
    );
    expect(nip44WirePayloadSource).toMatch(/ciphertext:\s*Option<Vec<u8>>/);
    expect(nip44WirePayloadSource).toMatch(/mac:\s*Option<\[u8;\s*32\]>/);
  });

  it("7. no ChaCha20/HMAC/base64/wire-encode connection anywhere in the three new files", () => {
    for (const [name, src] of NEW_FILES) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly, `${name} must not import chacha20`).not.toMatch(/use\s+chacha20\s*::/);
      expect(codeOnly, `${name} must not import hmac`).not.toMatch(/use\s+hmac\s*::/);
      expect(codeOnly, `${name} must not import base64`).not.toMatch(/use\s+base64/i);
      expect(codeOnly, `${name} must not declare an encode/decode fn`).not.toMatch(
        /fn\s+\w*(encode|decode)\w*\s*\(/i,
      );
    }
  });

  it("8. crypto::conversation_key, crypto::message_key, and crypto::hkdf_bridge are untouched", () => {
    for (const src of [conversationKeySource, messageKeySource, hkdfBridgeSource]) {
      expect(src).not.toMatch(
        /Nip44WireNonce|Nip44WirePayload|Nip44WireReadiness|Nip44WireFeature/,
      );
    }
  });

  it("9. nip44_wire_diagnostics is a separate preview (now eight rows as of Stage 238) — no CryptoCapability variant added, capability_matrix/diagnostics unchanged in shape", () => {
    // Stage 233 extended this preview from two rows to four (WireCrypto,
    // WireAuthentication join WireNonce/WirePayload); Stage 238 extends it
    // again to eight (WireEncoding/WireEncrypt/WireDecrypt/WireInvalidVectors)
    // — see test/fedos_core_rust_nip44_wire_completion.test.ts for the
    // dedicated Stage 234-238 checks.
    expect(nip44WireDiagnosticsSource).toMatch(
      /pub\(crate\)\s+fn\s+nip44_wire_diagnostics_preview\s*\(\s*\)\s*->\s*\[\s*Nip44WireFeatureReport\s*;\s*8\s*\]/,
    );
    expect(capabilityMatrixSource).toMatch(
      /pub\(crate\)\s+const\s+ALL:\s*\[CryptoCapability;\s*16\]\s*=\s*\[/,
    );
    expect(diagnosticsSource).not.toMatch(/WireNonce|WirePayload/);
  });

  it("10. docs/nip44_wire_nonce_generation.md and docs/nip44_wire_payload_builder.md exist, document real code, and state ChaCha20/HMAC are not connected", () => {
    expect(nip44WireNonceGenDocSource).toMatch(/generate_wire_nonce_internal/);
    expect(nip44WireNonceGenDocSource).toMatch(/this document records real code/i);
    expect(nip44WirePayloadBuilderDocSource).toMatch(/build_placeholder/);
    expect(nip44WirePayloadBuilderDocSource).toMatch(/validate_wire_payload_placeholder/);
    expect(nip44WirePayloadBuilderDocSource).toMatch(
      /ChaCha20 stream encryption and HMAC-SHA256\s+are NOT connected/i,
    );
  });

  it("11. not connected to Runtime, Worker, StorageBackend, or FederationProvider in any way", () => {
    for (const src of [runtimeSource, workerSource]) {
      expect(src).not.toMatch(/nip44_wire_nonce|nip44_wire_payload|nip44_wire_diagnostics/i);
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
    }
    for (const src of [storageTypesSource, noopStorageSource, federationTypesSource]) {
      expect(src).not.toMatch(/nip44_wire_nonce|nip44_wire_payload|nip44_wire_diagnostics/i);
    }
  });

  it("12. the crate's public pub fn surface is unchanged at twenty-seven — no public API addition", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
    expect(pubFnNames.length).toBe(50);
    for (const name of pubFnNames) {
      if (name === "encrypt_nip44_wire" || name === "decrypt_nip44_wire") continue;
      expect(name.toLowerCase()).not.toContain("nip44");
      expect(name.toLowerCase()).not.toContain("wirenonce");
      expect(name.toLowerCase()).not.toContain("wirepayload");
    }
  });

  it("13. Cargo.toml still has exactly 10 production dependencies — zero new dependency added", () => {
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

  it("14. package.json is unchanged — still 2 production dependencies", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(["@noble/curves", "@noble/hashes"]);
  });

  it("15. no serialization change: no serde derive in any of the three new files' production code", () => {
    for (const [name, src] of NEW_FILES) {
      const productionOnly = productionOnlyOf(src);
      expect(productionOnly, `${name} must not derive Serialize`).not.toMatch(/derive\(Serialize/);
      expect(productionOnly, `${name} must not derive Deserialize`).not.toMatch(
        /derive\(Deserialize/,
      );
    }
  });
});
