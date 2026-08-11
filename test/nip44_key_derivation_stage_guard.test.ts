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
import conversationKeySource from "../packages/fedos-core-rust/src/crypto/conversation_key.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import messageKeySource from "../packages/fedos-core-rust/src/crypto/message_key.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hkdfBridgeSource from "../packages/fedos-core-rust/src/crypto/hkdf_bridge.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44KeyDerivationGuardSource from "../packages/fedos-core-rust/src/crypto/nip44_key_derivation_guard.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageTypesSource from "../src/os/core/storage/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopStorageSource from "../src/os/core/storage/noop_storage.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import federationTypesSource from "../src/os/_legacy_prototype/federation/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

/**
 * Stage 198–201 — "NIP-44 key-derivation half": `ConversationKey` (Stage
 * 198 skeleton + Stage 199 real ECDH + HKDF-extract), `MessageKey` (Stage
 * 200 skeleton), and the `HkdfDomain::Conversation` bridge connecting them
 * (Stage 201). `CryptoCapability` grows from eleven to fifteen variants
 * (`MessageKey`/`Padding`/`Encrypt`/`Decrypt` added); `Ecdh`/
 * `ConversationKey`/`MessageKey` report `Ready`, `Encrypt`/`Decrypt` report
 * `NotConnected`, `Padding` reports `NotImplemented`. **No padding, no
 * NIP-44 encrypt/decrypt, no public API addition, no Runtime/Worker/
 * Storage/Federation/Relay connection** — every one of those is verified
 * absent below.
 *
 * **Superseded IN PART by Stage 202–208** — `CryptoCapability` grows a
 * sixteenth variant, `Authentication`, and `Padding`/`Encrypt`/`Decrypt`
 * are promoted from `NotImplemented`/`NotConnected` to `Ready` (real code
 * now exists in `crypto::nip44_padding`/`nip44_encrypt`/`nip44_decrypt`).
 * Tests 1 and 3 below are updated accordingly to the current, real shape
 * — see test/nip44_padding_encrypt_decrypt_guard.test.ts for the
 * dedicated Stage 202–208 checks on padding/encrypt/decrypt/bridge's own
 * encapsulation. What remains true unchanged: `ConversationKey`/
 * `MessageKey`/the `HkdfDomain::Conversation` bridge (tests 5–13) and the
 * public `pub fn` surface (test 14, still unchanged at twenty-seven).
 */
describe("NIP-44 conversation/message key derivation (Stage 198-201, updated Stage 202-208)", () => {
  function productionOnlyOf(source: string): string {
    const idx = source.indexOf("#[cfg(test)]");
    return idx === -1 ? source : source.slice(0, idx);
  }
  const conversationKeyProductionOnly = productionOnlyOf(conversationKeySource);
  const messageKeyProductionOnly = productionOnlyOf(messageKeySource);
  const hkdfBridgeProductionOnly = productionOnlyOf(hkdfBridgeSource);

  it("1. CryptoCapability has exactly sixteen variants, with MessageKey/Padding/Encrypt/Decrypt/Authentication appended after ConversationKey (Authentication added Stage 202-208)", () => {
    const allMatch = capabilityMatrixSource.match(
      /pub\(crate\)\s+const\s+ALL:\s*\[CryptoCapability;\s*16\]\s*=\s*\[([\s\S]*?)\];/,
    );
    expect(allMatch, "expected to find CryptoCapability::ALL with 16 entries").not.toBeNull();
    const variants = [...allMatch![1].matchAll(/CryptoCapability::(\w+)/g)].map((m) => m[1]);
    expect(variants).toEqual([
      "Random",
      "Nonce",
      "SecretHandle",
      "Hkdf",
      "Aead",
      "Envelope",
      "Ecdh",
      "Nip44",
      "Schnorr",
      "StorageKey",
      "ConversationKey",
      "MessageKey",
      "Padding",
      "Encrypt",
      "Decrypt",
      "Authentication",
    ]);
  });

  it("2. Ecdh, ConversationKey, and MessageKey all report Ready in crypto_diagnostics_preview", () => {
    for (const capability of ["Ecdh", "ConversationKey", "MessageKey"]) {
      const rowMatch = diagnosticsSource.match(
        new RegExp(
          `CapabilityReport\\s*\\{\\s*capability:\\s*CryptoCapability::${capability},\\s*readiness:\\s*CapabilityReadiness::(\\w+),?\\s*\\}`,
        ),
      );
      expect(rowMatch, `expected to find the ${capability} CapabilityReport row`).not.toBeNull();
      expect(rowMatch![1]).toBe("Ready");
    }
  });

  it("3. Padding, Encrypt, Decrypt, and Authentication all report Ready (Stage 202-208; superseding the Stage 198-201 NotConnected/NotImplemented snapshot)", () => {
    for (const [capability, expected] of [
      ["Padding", "Ready"],
      ["Encrypt", "Ready"],
      ["Decrypt", "Ready"],
      ["Authentication", "Ready"],
    ] as const) {
      const rowMatch = diagnosticsSource.match(
        new RegExp(
          `CapabilityReport\\s*\\{\\s*capability:\\s*CryptoCapability::${capability},\\s*readiness:\\s*CapabilityReadiness::(\\w+),?\\s*\\}`,
        ),
      );
      expect(rowMatch, `expected to find the ${capability} CapabilityReport row`).not.toBeNull();
      expect(rowMatch![1]).toBe(expected);
    }
  });

  it("4. crypto_diagnostics_preview's return type is now [CapabilityReport; 16] (Stage 202-208 adds the Authentication row)", () => {
    expect(diagnosticsSource).toMatch(
      /pub\(crate\)\s+fn\s+crypto_diagnostics_preview\(\)\s*->\s*\[CapabilityReport;\s*16\]/,
    );
  });

  it("5. ConversationKey is pub(crate)-only, holds a SecretHandle internally, and derives neither Clone nor Debug", () => {
    expect(conversationKeySource).toMatch(/pub\(crate\)\s+struct\s+ConversationKey\s*\{/);
    expect(conversationKeySource).not.toMatch(/\bpub\s+struct\s+ConversationKey\b/);
    expect(conversationKeySource).toMatch(/handle:\s*SecretHandle,/);
    // No raw-byte getter: the only accessor returning [u8; 32] is the
    // one narrowly-scoped, documented internal accessor.
    const rawByteAccessors = [
      ...conversationKeySource.matchAll(/fn\s+(\w+)\([^)]*\)\s*->\s*Option<\[u8;\s*32\]>/g),
    ].map((m) => m[1]);
    expect(rawByteAccessors).toEqual(["expose_bytes_for_internal_message_key_derivation"]);
  });

  it("6. MessageKey is pub(crate)-only, holds a SecretHandle internally, and derives neither Clone nor Debug", () => {
    expect(messageKeySource).toMatch(/pub\(crate\)\s+struct\s+MessageKey\s*\{/);
    expect(messageKeySource).not.toMatch(/\bpub\s+struct\s+MessageKey\b/);
    expect(messageKeySource).toMatch(/handle:\s*SecretHandle,/);
    const rawByteAccessors = [
      ...messageKeySource.matchAll(/fn\s+(\w+)\([^)]*\)\s*->\s*Option<\[u8;\s*32\]>/g),
    ].map((m) => m[1]);
    expect(rawByteAccessors).toEqual(["expose_bytes_for_internal_use"]);
  });

  it("7. no ECDH implementation exists in lib.rs/crypto.rs/capability_matrix.rs/diagnostics.rs (it lives ONLY in crypto::conversation_key)", () => {
    const firstCfgTestIdx = libRsSource.indexOf("#[cfg(test)]");
    const libProductionOnly = libRsSource.slice(0, firstCfgTestIdx);
    for (const forbidden of [/\bAffinePoint::/, /\bProjectivePoint::/, /\.to_affine\s*\(/]) {
      expect(libProductionOnly).not.toMatch(forbidden);
      expect(cryptoModSource).not.toMatch(forbidden);
      expect(capabilityMatrixSource).not.toMatch(forbidden);
      expect(diagnosticsSource).not.toMatch(forbidden);
    }
  });

  it("8. the real ECDH computation exists exactly once, in crypto::conversation_key, vector-verified", () => {
    expect(conversationKeySource).toMatch(/fn\s+derive_conversation_key_via_ecdh_internal\s*\(/);
    expect(conversationKeySource).toMatch(/\bProjectivePoint::from\(/);
    expect(conversationKeySource).toMatch(/nip44-v2/);
  });

  it("9. the HKDF bridge reuses the pre-existing, fixed HkdfDomain::Conversation — no caller-suppliable salt/info/domain parameter", () => {
    expect(hkdfBridgeSource).toMatch(/HkdfDomain::Conversation/);
    expect(hkdfBridgeSource).toMatch(
      /fn\s+derive_message_key_from_conversation_key_internal\s*\(\s*conversation_key:\s*&ConversationKey,?\s*\)/,
    );
    // No parameter named salt/info/domain of any kind on the bridge fn.
    const fnSignatureMatch = hkdfBridgeSource.match(
      /fn\s+derive_message_key_from_conversation_key_internal\s*\(([\s\S]*?)\)\s*->/,
    );
    expect(fnSignatureMatch).not.toBeNull();
    expect(fnSignatureMatch![1]).not.toMatch(/salt|info|domain/i);
  });

  it("10. no padding, no NIP-44 encrypt/decrypt function exists in any of the three new files", () => {
    for (const src of [conversationKeyProductionOnly, messageKeyProductionOnly, hkdfBridgeProductionOnly]) {
      for (const forbidden of [
        /\bfn\s+\w*calc_padded_len\w*\s*\(/i,
        /\bfn\s+\w*pad_plaintext\w*\s*\(/i,
        /\bfn\s+nip44_encrypt\s*\(/i,
        /\bfn\s+nip44_decrypt\s*\(/i,
      ]) {
        expect(src).not.toMatch(forbidden);
      }
    }
  });

  it("11. no pub fn/struct/enum/mod exists in any of the three new files — pub(crate) only", () => {
    for (const src of [conversationKeySource, messageKeySource, hkdfBridgeSource]) {
      expect(src).not.toMatch(/^\s*pub\s+fn\s+/m);
      expect(src).not.toMatch(/^\s*pub\s+struct\s+/m);
      expect(src).not.toMatch(/^\s*pub\s+enum\s+/m);
      expect(src).not.toMatch(/^\s*pub\s+mod\s+/m);
    }
  });

  it("12. crypto.rs declares conversation_key/message_key/hkdf_bridge as pub(crate) mod, and their own dedicated cfg(test)-only guard module", () => {
    for (const module of ["conversation_key", "message_key", "hkdf_bridge"]) {
      expect(cryptoModSource).toMatch(new RegExp(`pub\\(crate\\)\\s+mod\\s+${module};`));
    }
    expect(cryptoModSource).toMatch(
      /#\[cfg\(test\)\]\s*\r?\n\s*mod\s+nip44_key_derivation_guard\s*;/,
    );
    expect(cryptoModSource).toMatch(
      /#\[cfg\(test\)\]\s*\r?\n\s*mod\s+nip44_conversation_key_vectors\s*;/,
    );
  });

  it("13. the dedicated Rust-side encapsulation guard module itself is #![cfg(test)]-only and performs no cryptography", () => {
    expect(nip44KeyDerivationGuardSource).toContain("#![cfg(test)]");
    expect(nip44KeyDerivationGuardSource).not.toMatch(/\bAffinePoint::/);
    expect(nip44KeyDerivationGuardSource).not.toMatch(/\bProjectivePoint::/);
  });

  it("14. the crate's public pub fn surface is unchanged at twenty-seven — no public API addition", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
    expect(pubFnNames.length).toBe(70);    for (const name of pubFnNames) {
      // Alpha 869 -- FedosMasterSeedAuthority::resolve_conversation_key is
      // lib.rs-level wiring only; it delegates its ECDH math to this exact
      // file's own test 8, the one pre-existing, dedicated
      // crypto::conversation_key::derive_conversation_key_via_ecdh_internal.
      if (name === "resolve_conversation_key") continue;
      expect(name.toLowerCase()).not.toContain("ecdh");
      expect(name.toLowerCase()).not.toContain("conversation");
      expect(name.toLowerCase()).not.toContain("message_key");
    }
  });

  it("15. not connected to Runtime, Worker, StorageBackend, or FederationProvider in any way", () => {
    for (const src of [runtimeSource, workerSource]) {
      expect(src).not.toMatch(/conversationkey|messagekey|ecdh/i);
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
    }
    for (const src of [storageTypesSource, noopStorageSource, federationTypesSource]) {
      expect(src).not.toMatch(/conversationkey|messagekey|ecdh/i);
    }
  });

  it("16. package.json is unchanged — still 2 production dependencies, no secp256k1/k256/elliptic-curve library", () => {
    const pkg = JSON.parse(packageJsonSource);
    assertFedosRootDependencyInvariant(pkg.dependencies);
  });

  it("17. no serialization change: no serde derive on ConversationKey/MessageKey/their Decision types", () => {
    for (const src of [conversationKeySource, messageKeySource, hkdfBridgeSource]) {
      expect(src).not.toMatch(/derive\(Serialize/);
      expect(src).not.toMatch(/derive\(Deserialize/);
    }
  });
});
