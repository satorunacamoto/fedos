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
import nip44MessageKeysSource from "../packages/fedos-core-rust/src/crypto/nip44_message_keys.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WireSource from "../packages/fedos-core-rust/src/crypto/nip44_wire.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import conversationKeySource from "../packages/fedos-core-rust/src/crypto/conversation_key.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import messageKeySource from "../packages/fedos-core-rust/src/crypto/message_key.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hkdfBridgeSource from "../packages/fedos-core-rust/src/crypto/hkdf_bridge.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import messageKeyReviewDocSource from "../docs/nip44_message_key_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wireNonceDocSource from "../docs/nip44_wire_nonce.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wirePayloadLayoutDocSource from "../docs/nip44_wire_payload_layout.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
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
import packageJsonSource from "../package.json?raw";

/**
 * Stage 214–218 — "NIP-44 v2 exact wire preparation". Three new docs
 * (`docs/nip44_message_key_review.md`, `docs/nip44_wire_nonce.md`,
 * `docs/nip44_wire_payload_layout.md`) fix the exact per-message key
 * derivation, the 32-byte wire nonce, and the fixed wire payload field
 * order in writing, and `crypto::nip44_message_keys` (new) adds a
 * LABEL-ONLY skeleton naming the three derived values
 * (`chacha_key`/`chacha_nonce`/`hmac_key`) with a single
 * `derive_message_keys_exact_placeholder` function that takes no input
 * and returns only `Placeholder` status. **No HKDF call, no nonce
 * generation, no HMAC, no ChaCha20 stream cipher, no
 * `ConversationKey`/`MessageKey`/`hkdf_bridge` change, no public API
 * addition, no Runtime/Worker/Storage/Relay connection, no new Cargo
 * dependency** — every one of those is verified absent below.
 */
describe("NIP-44 exact message key derivation review + skeleton (Stage 214-218)", () => {
  function productionOnlyOf(source: string): string {
    const idx = source.indexOf("#[cfg(test)]");
    return idx === -1 ? source : source.slice(0, idx);
  }

  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
  }

  it("1. docs/nip44_message_key_review.md exists and documents the exact HKDF-expand derivation", () => {
    for (const keyword of [
      "HKDF-Expand",
      "info",
      "chacha_key",
      "chacha_nonce",
      "hmac_key",
      "valid.get_message_keys",
    ]) {
      expect(messageKeyReviewDocSource, `expected review doc to mention ${keyword}`).toContain(
        keyword,
      );
    }
    expect(messageKeyReviewDocSource).toMatch(/this document adds no code/i);
  });

  it("2. docs/nip44_wire_nonce.md exists and documents size, generation responsibility, reuse prohibition, and the internal-nonce difference", () => {
    expect(wireNonceDocSource).toMatch(/32.byte/i);
    expect(wireNonceDocSource).toMatch(/reus(e|ed|al)/i);
    expect(wireNonceDocSource).toMatch(/CSPRNG/);
    expect(wireNonceDocSource).toMatch(/fedos_aead_nonce_96/);
    expect(wireNonceDocSource).toMatch(/FedosAeadNonceDecision/);
    expect(wireNonceDocSource).toMatch(/this document adds no code/i);
  });

  it("3. docs/nip44_wire_payload_layout.md exists and fixes field order, lengths, base64, and padding position", () => {
    for (const keyword of [
      "version_byte",
      "nonce",
      "ciphertext",
      "hmac_tag",
      "base64",
      "padding",
    ]) {
      expect(
        wirePayloadLayoutDocSource.toLowerCase(),
        `expected payload layout doc to mention ${keyword}`,
      ).toContain(keyword.toLowerCase());
    }
    expect(wirePayloadLayoutDocSource).toMatch(/this document adds no code/i);
  });

  it("4. crypto.rs declares nip44_message_keys as pub(crate) mod, never bare pub mod", () => {
    expect(cryptoModSource).toMatch(/pub\(crate\)\s+mod\s+nip44_message_keys;/);
    expect(cryptoModSource).not.toMatch(/\n\s*pub\s+mod\s+nip44_message_keys;/);
  });

  it("5. nip44_message_keys declares no pub fn/struct/enum/mod — pub(crate) only", () => {
    expect(nip44MessageKeysSource).not.toMatch(/^\s*pub\s+fn\s+/m);
    expect(nip44MessageKeysSource).not.toMatch(/^\s*pub\s+struct\s+/m);
    expect(nip44MessageKeysSource).not.toMatch(/^\s*pub\s+enum\s+/m);
    expect(nip44MessageKeysSource).not.toMatch(/^\s*pub\s+mod\s+/m);
  });

  it("6. nip44_message_keys declares exactly the documented types and function", () => {
    for (const item of [
      "pub(crate) enum Nip44DerivedKeyKind",
      "pub(crate) enum Nip44MessageKeyStatus",
      "pub(crate) struct Nip44MessageKeyDecision",
      "pub(crate) fn derive_message_keys_exact_placeholder",
    ]) {
      expect(nip44MessageKeysSource).toContain(item);
    }
  });

  it("7. Nip44MessageKeyStatus has no variant other than Placeholder — derive_message_keys_exact_placeholder is placeholder-only", () => {
    const enumMatch = nip44MessageKeysSource.match(
      /pub\(crate\)\s+enum\s+Nip44MessageKeyStatus\s*\{([\s\S]*?)\n\}/,
    );
    expect(enumMatch, "expected to find the Nip44MessageKeyStatus enum body").not.toBeNull();
    const variants = [...enumMatch![1].matchAll(/^\s*(\w+),?\s*$/gm)].map((m) => m[1]);
    expect(variants).toEqual(["Placeholder"]);
  });

  it("8. derive_message_keys_exact_placeholder takes no parameter", () => {
    const fnMatch = nip44MessageKeysSource.match(
      /pub\(crate\)\s+fn\s+derive_message_keys_exact_placeholder\s*\(([^)]*)\)/,
    );
    expect(fnMatch, "expected to find derive_message_keys_exact_placeholder's signature").not.toBeNull();
    expect(fnMatch![1].trim()).toBe("");
  });

  it("9. no HKDF/nonce-generation/HMAC/ChaCha20 connection in nip44_message_keys — no real derivation exists yet", () => {
    // Doc comments legitimately NAME `use hkdf::`/`Hkdf::`/`ConversationKey`/
    // `HkdfDomain`/etc. in "this module does NOT use X" reassurance prose
    // (mirroring `nip44_encrypt_decrypt_guard`'s own `strip_comment_lines`
    // rationale) — only the CODE (not comments) must never reference them.
    const codeOnly = codeOnlyOf(nip44MessageKeysSource);
    expect(codeOnly).not.toMatch(/use\s+hkdf\s*::/);
    expect(codeOnly).not.toMatch(/Hkdf::/);
    expect(codeOnly).not.toMatch(/use\s+hmac\s*::/);
    expect(codeOnly).not.toMatch(/use\s+chacha20\s*::/);
    expect(codeOnly).not.toMatch(/fedos_random_bytes_32/);
    expect(codeOnly).not.toMatch(/fedos_aead_nonce_96/);
    expect(codeOnly).not.toMatch(/ConversationKey/);
    expect(codeOnly).not.toMatch(/HkdfDomain/);
  });

  it("10. no unsafe/unwrap/expect/panic in nip44_message_keys' production code", () => {
    const productionOnly = productionOnlyOf(nip44MessageKeysSource);
    expect(productionOnly).not.toContain("unsafe");
    expect(productionOnly).not.toMatch(/\.unwrap\s*\(/);
    expect(productionOnly).not.toMatch(/\.expect\s*\(/);
    expect(productionOnly).not.toMatch(/\bpanic!\s*\(/);
  });

  it("11. crypto::conversation_key, crypto::message_key, and crypto::hkdf_bridge are untouched by this stage (still no per-message nonce-salted derivation)", () => {
    for (const src of [conversationKeySource, messageKeySource, hkdfBridgeSource]) {
      expect(src).not.toMatch(/Nip44DerivedKeyKind|Nip44MessageKeyDecision|Nip44MessageKeyStatus/);
    }
  });

  it("12. crypto::nip44_wire (Stage 209-213) is unchanged — still label-only, still Unimplemented", () => {
    const enumMatch = nip44WireSource.match(
      /pub\(crate\)\s+enum\s+Nip44WireStatus\s*\{([\s\S]*?)\n\}/,
    );
    expect(enumMatch).not.toBeNull();
    expect(enumMatch![1]).toContain("Unimplemented");
  });

  it("13. capability_matrix/diagnostics are unchanged in shape — still sixteen capabilities, still zero NotConnected rows (no new capability added by this stage)", () => {
    expect(capabilityMatrixSource).toMatch(
      /pub\(crate\)\s+const\s+ALL:\s*\[CryptoCapability;\s*16\]\s*=\s*\[/,
    );
    expect(diagnosticsSource).not.toMatch(/readiness:\s*CapabilityReadiness::NotConnected/);
  });

  it("14. not connected to Runtime, Worker, StorageBackend, or FederationProvider in any way", () => {
    for (const src of [runtimeSource, workerSource]) {
      expect(src).not.toMatch(/nip44_message_keys|Nip44MessageKey|Nip44DerivedKeyKind/i);
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
    }
    for (const src of [storageTypesSource, noopStorageSource, federationTypesSource]) {
      expect(src).not.toMatch(/nip44_message_keys|Nip44MessageKey/i);
    }
  });

  it("15. the crate's public pub fn surface is unchanged at twenty-seven — no public API addition", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
    expect(pubFnNames.length).toBe(27);
    for (const name of pubFnNames) {
      expect(name.toLowerCase()).not.toContain("nip44");
      expect(name.toLowerCase()).not.toContain("messagekey");
    }
  });

  it("16. Cargo.toml still has exactly 10 production dependencies — zero new dependency added", () => {
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
    expect(cargoCode).not.toMatch(/^\s*chacha20\s*=/m);
    expect(cargoCode).not.toMatch(/^\s*hmac\s*=/m);
    expect(cargoCode).not.toMatch(/^\s*base64\s*=/m);
  });

  it("17. package.json is unchanged — still 2 production dependencies", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(["@noble/curves", "@noble/hashes"]);
  });

  it("18. no serialization change: no serde derive anywhere in nip44_message_keys.rs", () => {
    expect(nip44MessageKeysSource).not.toMatch(/derive\(Serialize/);
    expect(nip44MessageKeysSource).not.toMatch(/derive\(Deserialize/);
  });
});
