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
import nip44PaddingSource from "../packages/fedos-core-rust/src/crypto/nip44_padding.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44EncryptSource from "../packages/fedos-core-rust/src/crypto/nip44_encrypt.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44DecryptSource from "../packages/fedos-core-rust/src/crypto/nip44_decrypt.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44BridgeSource from "../packages/fedos-core-rust/src/crypto/nip44_bridge.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44EncryptDecryptGuardSource from "../packages/fedos-core-rust/src/crypto/nip44_encrypt_decrypt_guard.rs?raw";
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
 * Stage 202–208 — "NIP-44 pad/encrypt/decrypt/authentication half":
 * `crypto::nip44_padding` (Stage 202 `calc_padded_len`/`pad_message`/
 * `unpad_message`, Stage 203 vector-verified), `crypto::nip44_encrypt`/
 * `crypto::nip44_decrypt` (Stage 204–205, a pad-then-seal/open-then-unpad
 * pipeline reusing the crate's pre-existing ChaCha20-Poly1305 AEAD — NOT
 * NIP-44 v2's byte-exact raw-ChaCha20-plus-HMAC-SHA256 wire format), and
 * `crypto::nip44_bridge` (Stage 206, connecting both to the pre-existing,
 * UNCHANGED `ciphertext_envelope::AeadCiphertextEnvelope`). `diagnostics`
 * promotes `Padding`/`Encrypt`/`Decrypt` to `Ready` and adds a sixteenth
 * `CryptoCapability`, `Authentication` (Stage 207/208), also `Ready`.
 * **No byte-exact NIP-44 encrypt/decrypt, no new Cargo dependency, no
 * public API addition, no Runtime/Worker/Storage/Federation/Relay
 * connection** — every one of those is verified absent below.
 */
describe("NIP-44 padding/encrypt/decrypt/authentication (Stage 202-208)", () => {
  const NEW_FILES: [string, string][] = [
    ["nip44_padding.rs", nip44PaddingSource],
    ["nip44_encrypt.rs", nip44EncryptSource],
    ["nip44_decrypt.rs", nip44DecryptSource],
    ["nip44_bridge.rs", nip44BridgeSource],
  ];

  function productionOnlyOf(source: string): string {
    const idx = source.indexOf("#[cfg(test)]");
    return idx === -1 ? source : source.slice(0, idx);
  }

  it("1. CryptoCapability's ALL array has exactly sixteen variants, ending Padding/Encrypt/Decrypt/Authentication", () => {
    const allMatch = capabilityMatrixSource.match(
      /pub\(crate\)\s+const\s+ALL:\s*\[CryptoCapability;\s*16\]\s*=\s*\[([\s\S]*?)\];/,
    );
    expect(allMatch, "expected to find CryptoCapability::ALL with 16 entries").not.toBeNull();
    const variants = [...allMatch![1].matchAll(/CryptoCapability::(\w+)/g)].map((m) => m[1]);
    expect(variants.length).toBe(16);
    expect(variants.slice(-4)).toEqual(["Padding", "Encrypt", "Decrypt", "Authentication"]);
  });

  it("2. Padding, Encrypt, Decrypt, and Authentication all report Ready in crypto_diagnostics_preview", () => {
    for (const capability of ["Padding", "Encrypt", "Decrypt", "Authentication"]) {
      const rowMatch = diagnosticsSource.match(
        new RegExp(
          `CapabilityReport\\s*\\{\\s*capability:\\s*CryptoCapability::${capability},\\s*readiness:\\s*CapabilityReadiness::(\\w+),?\\s*\\}`,
        ),
      );
      expect(rowMatch, `expected to find the ${capability} CapabilityReport row`).not.toBeNull();
      expect(rowMatch![1]).toBe("Ready");
    }
  });

  it("3. no capability reports NotConnected any more", () => {
    expect(diagnosticsSource).not.toMatch(/readiness:\s*CapabilityReadiness::NotConnected/);
  });

  it("4. crypto.rs declares all four new modules as pub(crate) mod, never bare pub mod, plus their own cfg(test)-only guard/vector modules", () => {
    for (const module of ["nip44_padding", "nip44_encrypt", "nip44_decrypt", "nip44_bridge"]) {
      expect(cryptoModSource).toMatch(new RegExp(`pub\\(crate\\)\\s+mod\\s+${module};`));
      expect(cryptoModSource).not.toMatch(new RegExp(`\\n\\s*pub\\s+mod\\s+${module};`));
    }
    expect(cryptoModSource).toMatch(
      /#\[cfg\(test\)\]\s*\r?\n\s*mod\s+nip44_padding_vectors\s*;/,
    );
    expect(cryptoModSource).toMatch(
      /#\[cfg\(test\)\]\s*\r?\n\s*mod\s+nip44_encrypt_decrypt_guard\s*;/,
    );
  });

  it("5. no pub fn/struct/enum/mod exists in any of the four new files — pub(crate) only", () => {
    for (const [name, src] of NEW_FILES) {
      expect(src, `${name} must declare no pub fn`).not.toMatch(/^\s*pub\s+fn\s+/m);
      expect(src, `${name} must declare no pub struct`).not.toMatch(/^\s*pub\s+struct\s+/m);
      expect(src, `${name} must declare no pub enum`).not.toMatch(/^\s*pub\s+enum\s+/m);
      expect(src, `${name} must declare no pub mod`).not.toMatch(/^\s*pub\s+mod\s+/m);
    }
  });

  it("6. no unsafe/unwrap/expect/panic in the production-only portion of any of the four new files", () => {
    for (const [name, src] of NEW_FILES) {
      const productionOnly = productionOnlyOf(src);
      expect(productionOnly, `${name} must not use unsafe`).not.toContain("unsafe");
      expect(productionOnly, `${name} must not use .unwrap(`).not.toMatch(/\.unwrap\s*\(/);
      expect(productionOnly, `${name} must not use .expect(`).not.toMatch(/\.expect\s*\(/);
      expect(productionOnly, `${name} must not use panic!(`).not.toMatch(/\bpanic!\s*\(/);
    }
  });

  it("7. nip44_padding declares calc_padded_len/pad_message/unpad_message as pub(crate) only", () => {
    expect(nip44PaddingSource).toMatch(/pub\(crate\)\s+const\s+fn\s+calc_padded_len\s*\(/);
    expect(nip44PaddingSource).toMatch(/pub\(crate\)\s+fn\s+pad_message\s*\(/);
    expect(nip44PaddingSource).toMatch(/pub\(crate\)\s+fn\s+unpad_message\s*\(/);
  });

  it("8. nip44_encrypt/nip44_decrypt reuse the pre-existing ChaCha20-Poly1305 AEAD — no raw chacha20/hmac crate import", () => {
    for (const src of [nip44EncryptSource, nip44DecryptSource]) {
      expect(src).toMatch(/AeadCipher::ChaCha20Poly1305/);
      expect(src).not.toMatch(/use\s+chacha20\s*::/);
      expect(src).not.toMatch(/use\s+hmac\s*::/);
    }
  });

  it("9. nip44_decrypt collapses every failure cause into a single fixed AuthenticationFailed label", () => {
    const authenticationFailedMatches = [
      ...nip44DecryptSource.matchAll(/Nip44DecryptStatus::AuthenticationFailed/g),
    ];
    // At least once for the AEAD tag-failure path, and again for the
    // post-authentication malformed-padding path (both collapse into the
    // SAME variant — see this module's own doc comment).
    expect(authenticationFailedMatches.length).toBeGreaterThanOrEqual(2);
    // Nip44DecryptStatus itself has no separate "invalid padding" variant.
    const enumMatch = nip44DecryptSource.match(
      /pub\(crate\)\s+enum\s+Nip44DecryptStatus\s*\{([\s\S]*?)\n\}/,
    );
    expect(enumMatch, "expected to find the Nip44DecryptStatus enum body").not.toBeNull();
    expect(enumMatch![1]).not.toMatch(/InvalidPadding/);
    expect(enumMatch![1]).not.toMatch(/InvalidMac/);
  });

  it("10. nip44_bridge does not modify ciphertext_envelope.rs's own type — it only constructs/reads it", () => {
    expect(nip44BridgeSource).toMatch(/AeadCiphertextEnvelope::new_with_ciphertext_for_internal_use/);
    expect(nip44BridgeSource).not.toMatch(/struct\s+AeadCiphertextEnvelope/);
    expect(nip44BridgeSource).not.toMatch(/enum\s+AeadEnvelopeAlgorithm/);
  });

  it("11. the dedicated Rust-side encapsulation guard module is #![cfg(test)]-only", () => {
    expect(nip44EncryptDecryptGuardSource).toContain("#![cfg(test)]");
  });

  it("12. not connected to Runtime, Worker, StorageBackend, or FederationProvider in any way", () => {
    for (const src of [runtimeSource, workerSource]) {
      expect(src).not.toMatch(/nip44|calc_padded_len|nip44_encrypt|nip44_decrypt/i);
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
    }
    for (const src of [storageTypesSource, noopStorageSource, federationTypesSource]) {
      expect(src).not.toMatch(/nip44|calc_padded_len/i);
    }
  });

  it("13. the crate's public pub fn surface is unchanged at twenty-seven — no public API addition", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
    expect(pubFnNames.length).toBe(64);
    for (const name of pubFnNames) {
      expect(name.toLowerCase()).not.toContain("nip44");
      expect(name.toLowerCase()).not.toContain("padding");
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
  });

  it("15. package.json is unchanged — still 2 production dependencies", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(["@noble/curves", "@noble/hashes"]);
  });

  it("16. no serialization change: no serde derive on any of the four new files' Decision/output types", () => {
    for (const [, src] of NEW_FILES) {
      expect(src).not.toMatch(/derive\(Serialize/);
      expect(src).not.toMatch(/derive\(Deserialize/);
    }
  });
});
