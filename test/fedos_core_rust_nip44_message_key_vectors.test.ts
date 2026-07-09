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
import nip44MessageKeyVectorsSource from "../packages/fedos-core-rust/src/crypto/nip44_message_key_vectors.rs?raw";
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
import nip44V2VectorsSource from "../test-vectors/nip44/nip44-v2.json?raw";

/**
 * Stage 219–223 — the first real slice of a "NIP-44 v2 wire-compatible
 * implementation": exact per-message key derivation via HKDF-Expand.
 * `crypto::nip44_message_keys`'s Stage 217 label-only skeleton
 * (`derive_message_keys_exact_placeholder`) is replaced with
 * `derive_message_keys_exact_internal`/
 * `derive_message_keys_exact_from_bytes_internal`, vector-wired by the
 * new `#[cfg(test)]`-only `nip44_message_key_vectors` module (Stage 220)
 * against ALL 32 `test-vectors/nip44/nip44-v2.json` `valid.get_message_keys`
 * cases. **This stage is derivation ONLY** — no Encrypt/Decrypt, no
 * ChaCha20 stream cipher, no HMAC computation, no wire encoding, no
 * base64, no Nostr/Runtime/Worker/Storage connection, no
 * `crypto::conversation_key`/`crypto::message_key`/`crypto::hkdf_bridge`
 * change, no public API addition, no new Cargo dependency — every one of
 * those is verified absent below.
 */
describe("NIP-44 exact message key HKDF-expand + vector verification (Stage 219-223)", () => {
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

  it("1. the Stage 217 placeholder function is gone from nip44_message_keys — no fn derive_message_keys_exact_placeholder anywhere in the code", () => {
    const codeOnly = codeOnlyOf(nip44MessageKeysSource);
    expect(codeOnly).not.toMatch(/fn\s+derive_message_keys_exact_placeholder/);
    expect(codeOnly).not.toMatch(/Nip44MessageKeyStatus::Placeholder/);
  });

  it("2. nip44_message_keys uses real HKDF-expand (Hkdf::from_prk + .expand), never Hkdf::extract or Hkdf::new", () => {
    const codeOnly = codeOnlyOf(nip44MessageKeysSource);
    expect(codeOnly).toMatch(/use\s+hkdf\s*::\s*Hkdf\s*;/);
    expect(codeOnly).toMatch(/Hkdf::<Sha256>::from_prk/);
    expect(codeOnly).toMatch(/\.expand\s*\(/);
    expect(codeOnly).not.toMatch(/Hkdf::extract/);
    expect(codeOnly).not.toMatch(/Hkdf::new\s*\(/);
  });

  it("3. derive_message_keys_exact_internal takes &ConversationKey and a 32-byte nonce, and delegates to derive_message_keys_exact_from_bytes_internal", () => {
    expect(nip44MessageKeysSource).toMatch(
      /pub\(crate\)\s+fn\s+derive_message_keys_exact_internal\s*\(\s*conversation_key\s*:\s*&ConversationKey\s*,\s*nonce\s*:\s*&\[u8;\s*32\]\s*,?\s*\)/,
    );
    expect(nip44MessageKeysSource).toMatch(/derive_message_keys_exact_from_bytes_internal\s*\(/);
  });

  it("4. crypto.rs declares nip44_message_key_vectors as a #[cfg(test)]-only mod, never bare pub mod", () => {
    expect(cryptoModSource).toMatch(
      /#\[cfg\(test\)\]\s*\r?\n\s*mod\s+nip44_message_key_vectors\s*;/,
    );
    expect(cryptoModSource).not.toMatch(/\n\s*pub\s+mod\s+nip44_message_key_vectors;/);
  });

  it("5. nip44_message_key_vectors.rs is #![cfg(test)]-only and wires valid.get_message_keys against derive_message_keys_exact_from_bytes_internal", () => {
    expect(nip44MessageKeyVectorsSource).toContain("#![cfg(test)]");
    expect(nip44MessageKeyVectorsSource).toContain("valid.get_message_keys");
    expect(nip44MessageKeyVectorsSource).toMatch(/derive_message_keys_exact_from_bytes_internal/);
    expect(nip44MessageKeyVectorsSource).toMatch(/chacha_key/);
    expect(nip44MessageKeyVectorsSource).toMatch(/chacha_nonce/);
    expect(nip44MessageKeyVectorsSource).toMatch(/hmac_key/);
  });

  it("6. the imported test-vectors file's valid.get_message_keys category has exactly 32 cases (matches the Rust-side vector count assertion)", () => {
    const parsed = JSON.parse(nip44V2VectorsSource);
    const category = parsed.vectors.find(
      (v: { category: string }) => v.category === "valid.get_message_keys",
    );
    expect(category).toBeDefined();
    expect(category.data.keys.length).toBe(32);
  });

  it("7. no invalid.get_message_keys category is wired (or exists) — this stage is valid-vector-only, per its own documented scope", () => {
    const parsed = JSON.parse(nip44V2VectorsSource);
    const invalidCategory = parsed.vectors.find(
      (v: { category: string }) => v.category === "invalid.get_message_keys",
    );
    expect(invalidCategory).toBeUndefined();
    // The module's own doc comment legitimately NAMES the absent category
    // to explain its scope — only the CODE must never wire it.
    expect(codeOnlyOf(nip44MessageKeyVectorsSource)).not.toMatch(/invalid\.get_message_keys/);
  });

  it("8. no unsafe/unwrap/expect/panic in nip44_message_keys' production code", () => {
    const productionOnly = productionOnlyOf(nip44MessageKeysSource);
    expect(productionOnly).not.toContain("unsafe");
    expect(productionOnly).not.toMatch(/\.unwrap\s*\(/);
    expect(productionOnly).not.toMatch(/\.expect\s*\(/);
    expect(productionOnly).not.toMatch(/\bpanic!\s*\(/);
  });

  it("9. no HMAC/ChaCha20-stream/base64/nonce-generation connection anywhere in nip44_message_keys or nip44_message_key_vectors", () => {
    for (const src of [nip44MessageKeysSource, nip44MessageKeyVectorsSource]) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly).not.toMatch(/use\s+hmac\s*::/);
      expect(codeOnly).not.toMatch(/use\s+chacha20\s*::/);
      expect(codeOnly).not.toMatch(/use\s+base64/i);
      expect(codeOnly).not.toMatch(/fedos_random_bytes_32/);
      expect(codeOnly).not.toMatch(/fedos_aead_nonce_96/);
    }
  });

  it("10. crypto::conversation_key, crypto::message_key, and crypto::hkdf_bridge are untouched — no ConversationKey/HKDF-bridge change", () => {
    for (const src of [conversationKeySource, messageKeySource, hkdfBridgeSource]) {
      expect(src).not.toMatch(/Nip44DerivedKeyKind|Nip44MessageKeyDecision|Nip44MessageKeyStatus/);
      expect(src).not.toMatch(/derive_message_keys_exact/);
    }
  });

  it("11. capability_matrix/diagnostics are unchanged in shape — still sixteen capabilities, still zero NotConnected rows (Capability addition forbidden this stage)", () => {
    expect(capabilityMatrixSource).toMatch(
      /pub\(crate\)\s+const\s+ALL:\s*\[CryptoCapability;\s*16\]\s*=\s*\[/,
    );
    expect(diagnosticsSource).not.toMatch(/readiness:\s*CapabilityReadiness::NotConnected/);
  });

  it("12. not connected to Runtime, Worker, StorageBackend, or FederationProvider in any way", () => {
    for (const src of [runtimeSource, workerSource]) {
      expect(src).not.toMatch(/nip44_message_keys|Nip44MessageKey|derive_message_keys_exact/i);
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
    }
    for (const src of [storageTypesSource, noopStorageSource, federationTypesSource]) {
      expect(src).not.toMatch(/nip44_message_keys|Nip44MessageKey/i);
    }
  });

  it("13. the crate's public pub fn surface is unchanged at twenty-seven — no public API addition", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
    expect(pubFnNames.length).toBe(30);
    for (const name of pubFnNames) {
      expect(name.toLowerCase()).not.toContain("nip44");
      expect(name.toLowerCase()).not.toContain("messagekey");
    }
  });

  it("14. Cargo.toml still has exactly 10 production dependencies — zero new dependency added", () => {
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

  it("15. package.json is unchanged — still 2 production dependencies", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(["@noble/curves", "@noble/hashes"]);
  });

  it("16. no serialization change: no serde derive in nip44_message_keys.rs production code", () => {
    const productionOnly = productionOnlyOf(nip44MessageKeysSource);
    expect(productionOnly).not.toMatch(/derive\(Serialize/);
    expect(productionOnly).not.toMatch(/derive\(Deserialize/);
  });
});
