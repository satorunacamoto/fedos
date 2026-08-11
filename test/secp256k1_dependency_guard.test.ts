import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cryptoModSource from "../packages/fedos-core-rust/src/crypto.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilityMatrixSource from "../packages/fedos-core-rust/src/crypto/capability_matrix.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import diagnosticsSource from "../packages/fedos-core-rust/src/crypto/diagnostics.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import guardModuleSource from "../packages/fedos-core-rust/src/crypto/secp256k1_dependency_guard.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import dependencyAdoptionDoc from "../docs/nip44_dependency_adoption.md?raw";
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

/**
 * Stage 194–197 — "secp256k1 dependency adoption + capability/diagnostics
 * update + guards + documentation." Updated by Secure Runtime Alpha 181
 * (the Nostr Schnorr Signing Foundation Arc) — see
 * `docs/secure_runtime_alpha_181_k256_schnorr_api_inventory.md` for why
 * `schnorr` moved from the forbidden list (item 3) to the expected list
 * (item 2) below; every other guarantee this file made at Stage 196 is
 * UNCHANGED.
 *
 * `docs/nip44_dependency_adoption.md`'s (Stage 192) two candidates are
 * resolved: Stage 194 adopts `k256` (minimal `arithmetic`-only feature —
 * no `ecdsa`/`schnorr`/`serde`/`pem`/`pkcs8`/`rand` feature). Stage 195
 * adds an eleventh `CryptoCapability`, `Ecdh`, reporting a new fourth
 * `CapabilityReadiness` label, `ReadyForImplementation` (the dependency
 * exists; zero ECDH code does). Stage 196 adds
 * `crypto::secp256k1_dependency_guard` (Rust-side) and this file
 * (TypeScript-side). **No ECDH implementation, no conversation-key,
 * message-key, padding, encrypt, or decrypt function, no NIP-44 code, no
 * public API addition, no Runtime/Worker/Storage/Federation connection**
 * — every one of those is verified absent below.
 */
describe("secp256k1 dependency adoption + capability/diagnostics + guards (Stage 194-197)", () => {
  const cargoCode: string = cargoTomlSource
    .split("\n")
    .map((line: string) => line.replace(/#.*$/, ""))
    .join("\n")
    .toLowerCase();

  function productionDepsSection(): string {
    const depsIdx = cargoCode.indexOf("[dependencies]");
    const devDepsIdx = cargoCode.indexOf("[dev-dependencies]");
    return cargoCode.slice(depsIdx, devDepsIdx);
  }

  it("1. Cargo.toml has exactly 10 production dependencies, including k256", () => {
    const depLines = productionDepsSection()
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(11);
    expect(depLines.some((line: string) => /^\s*k256\s*=/.test(line))).toBe(true);
  });

  it("2. k256 is declared with default-features = false and exactly the arithmetic+schnorr features (schnorr added by Secure Runtime Alpha 181)", () => {
    const k256Line = productionDepsSection()
      .split("\n")
      .find((line: string) => line.trim().startsWith("k256"));
    expect(k256Line, "expected a k256 dependency line").toBeDefined();
    expect(k256Line).toContain("default-features = false");
    expect(k256Line).toMatch(/features\s*=\s*\[\s*"arithmetic",\s*"schnorr"\s*\]/);
  });

  it("3. k256 does NOT enable ecdsa/serde/pem/pkcs8/std/alloc/rand features", () => {
    const k256Line = productionDepsSection()
      .split("\n")
      .find((line: string) => line.trim().startsWith("k256"))!;
    for (const forbidden of ["ecdsa", "serde", "pem", "pkcs8", "rand", '"std"', '"alloc"']) {
      expect(k256Line, `expected k256 line to not contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("4. no rust-secp256k1 (C-FFI) dependency line exists — docs/nip44_dependency_adoption.md picked k256", () => {
    const depLines = productionDepsSection()
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.some((line: string) => /^\s*secp256k1\s*=/.test(line))).toBe(false);
  });

  it("5. Cargo.toml's own comment records the reviewed rand_core transitive-dependency exception", () => {
    expect(cargoTomlSource).toMatch(/rand_core/);
    expect(cargoTomlSource).toMatch(/REVIEWED EXCEPTION/i);
    expect(cargoTomlSource).not.toMatch(/^\s*rand\s*=/m);
    expect(cargoTomlSource).not.toMatch(/^\s*rand_core\s*=/m);
  });

  it("6. CryptoCapability includes the Ecdh label right after Envelope (Stage 195) — now one of sixteen variants total since Stage 202-208; see test/nip44_padding_encrypt_decrypt_guard.test.ts for the current full-count check", () => {
    const variantOrderMatch = capabilityMatrixSource.match(
      /pub\(crate\)\s+const\s+ALL:\s*\[CryptoCapability;\s*16\]\s*=\s*\[([\s\S]*?)\];/,
    );
    expect(variantOrderMatch, "expected to find CryptoCapability::ALL with 16 entries").not.toBeNull();
    const variants = [...variantOrderMatch![1].matchAll(/CryptoCapability::(\w+)/g)].map((m) => m[1]);
    expect(variants.indexOf("Ecdh")).toBe(variants.indexOf("Envelope") + 1);
    expect(variants).toContain("Ecdh");
  });

  it("7. CapabilityReadiness has a fourth variant, ReadyForImplementation, distinct from Ready/NotConnected/NotImplemented", () => {
    expect(diagnosticsSource).toMatch(/\bReadyForImplementation\b/);
    const enumMatch = diagnosticsSource.match(
      /pub\(crate\)\s+enum\s+CapabilityReadiness\s*\{([\s\S]*?)\n\}/,
    );
    expect(enumMatch).not.toBeNull();
    const body = (enumMatch![1] ?? "").replace(/\/\/\/.*$/gm, "");
    const variants = [...body.matchAll(/^\s*([A-Za-z0-9_]+)\s*,/gm)].map((m) => m[1]);
    expect([...variants].sort()).toEqual(
      ["Ready", "NotConnected", "ReadyForImplementation", "NotImplemented"].sort(),
    );
  });

  it("8. Ecdh reports Ready in crypto_diagnostics_preview as of Stage 199 (was ReadyForImplementation Stage 195-198 — see test/nip44_key_derivation_stage_guard.test.ts for the dedicated Stage 199 check)", () => {
    const rowMatch = diagnosticsSource.match(
      /CapabilityReport\s*\{\s*capability:\s*CryptoCapability::Ecdh,\s*readiness:\s*CapabilityReadiness::(\w+),?\s*\}/,
    );
    expect(rowMatch, "expected to find the Ecdh CapabilityReport row").not.toBeNull();
    expect(rowMatch![1]).toBe("Ready");
  });

  it("9. no ECDH implementation exists: no fn performing point arithmetic, no conversation-key/message-key/padding/encrypt/decrypt function", () => {
    // Sliced to each file's production-only portion (before its first
    // `#[cfg(test)]`) — `diagnostics.rs`'s own test module legitimately
    // names a test fn `ecdh_is_ready_for_implementation_...`, which would
    // otherwise false-positive against the bare `fn ... ecdh ...` pattern.
    function productionOnlyOf(source: string): string {
      const idx = source.indexOf("#[cfg(test)]");
      return idx === -1 ? source : source.slice(0, idx);
    }
    const libRsProductionOnly = productionOnlyOf(libRsSource);
    const cryptoModProductionOnly = productionOnlyOf(cryptoModSource);
    const capabilityMatrixProductionOnly = productionOnlyOf(capabilityMatrixSource);
    const diagnosticsProductionOnly = productionOnlyOf(diagnosticsSource);
    for (const forbidden of [
      /\bfn\s+\w*ecdh\w*\s*\(/i,
      /\bAffinePoint::/,
      /\bProjectivePoint::/,
      /\bfn\s+\w*conversation_key\w*\s*\(/i,
      /\bfn\s+\w*message_key\w*\s*\(/i,
      /\bfn\s+\w*calc_padded_len\w*\s*\(/i,
      /\bfn\s+nip44_encrypt\s*\(/i,
      /\bfn\s+nip44_decrypt\s*\(/i,
    ]) {
      expect(libRsProductionOnly, `expected lib.rs to not match ${forbidden}`).not.toMatch(forbidden);
      expect(cryptoModProductionOnly, `expected crypto.rs to not match ${forbidden}`).not.toMatch(forbidden);
      expect(
        capabilityMatrixProductionOnly,
        `expected capability_matrix.rs to not match ${forbidden}`,
      ).not.toMatch(forbidden);
      expect(diagnosticsProductionOnly, `expected diagnostics.rs to not match ${forbidden}`).not.toMatch(
        forbidden,
      );
    }
  });

  it("10. crypto.rs declares secp256k1_dependency_guard as #[cfg(test)]-only, never pub(crate)/pub", () => {
    expect(cryptoModSource).toMatch(/#\[cfg\(test\)\]\s*\r?\n\s*mod\s+secp256k1_dependency_guard\s*;/);
    expect(cryptoModSource).not.toMatch(/\bpub\(crate\)\s+mod\s+secp256k1_dependency_guard\b/);
    expect(cryptoModSource).not.toMatch(/\bpub\s+mod\s+secp256k1_dependency_guard\b/);
  });

  it("11. the Rust-side guard module performs no cryptography and is gated #![cfg(test)]", () => {
    expect(guardModuleSource).toContain("#![cfg(test)]");
    for (const forbidden of [/\bfn\s+\w*ecdh\w*\s*\(/i, /\bAffinePoint::/, /\bProjectivePoint::/]) {
      expect(guardModuleSource).not.toMatch(forbidden);
    }
  });

  it("12. the crate's public pub fn surface is unchanged at twenty-seven — no public API addition", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
    expect(pubFnNames.length).toBe(69);    for (const name of pubFnNames) {
      // Alpha 869 -- FedosMasterSeedAuthority::resolve_conversation_key is
      // lib.rs-level wiring only; it delegates its ECDH math to the one
      // pre-existing, dedicated crypto::conversation_key module (see
      // test/nip44_key_derivation_stage_guard.test.ts test 8).
      if (name === "resolve_conversation_key") continue;
      expect(name.toLowerCase()).not.toContain("ecdh");
      expect(name.toLowerCase()).not.toContain("conversation");
      expect(name.toLowerCase()).not.toContain("secp256k1");
    }
  });

  it("13. not connected to Runtime, Worker, StorageBackend, or FederationProvider in any way", () => {
    for (const src of [runtimeSource, workerSource]) {
      expect(src).not.toMatch(/ecdh|conversationkey|k256|secp256k1/i);
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
    }
    for (const src of [storageTypesSource, noopStorageSource, federationTypesSource]) {
      expect(src).not.toMatch(/ecdh|conversationkey|k256|secp256k1/i);
    }
  });

  it("14. docs/nip44_dependency_adoption.md is updated to record the k256 decision, with feature rationale and a fixed future implementation order", () => {
    expect(dependencyAdoptionDoc).toMatch(/\bk256\b/);
    expect(dependencyAdoptionDoc).toMatch(/adopt(s|ed)/i);
    for (const step of ["ECDH", "ConversationKey", "MessageKey", "Padding", "Encrypt", "Decrypt", "NIP44".replace("NIP44", "NIP-44")]) {
      expect(dependencyAdoptionDoc, `expected the fixed order to name ${step}`).toMatch(
        new RegExp(step.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      );
    }
  });
});
