import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cryptoModSource from "../packages/fedos-core-rust/src/crypto.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import dependencyAdoptionDoc from "../docs/nip44_dependency_adoption.md?raw";
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
 * Stage 193 — NIP-44 PRE-ADOPTION GUARD (superseded IN PART by Stage 194).
 *
 * `docs/nip44_dependency_adoption.md` (Stage 192) originally compared
 * `rust-secp256k1` and `k256` without adopting either — Stage 193 guarded
 * that state. **Stage 194 has since adopted `k256`** (minimal
 * `arithmetic`-only feature) and Stage 195 added an `Ecdh`
 * `CryptoCapability` LABEL reporting `ReadyForImplementation` — see
 * `test/secp256k1_dependency_guard.test.ts` for the dedicated Stage
 * 194–196 checks on that adoption's exact shape. This file's remaining
 * checks confirm what is STILL true after that adoption: no actual ECDH
 * cryptographic COMPUTATION, no conversation-key/message-key derivation,
 * no padding, no NIP-44-specific encrypt/decrypt function exists anywhere
 * in this crate's production code, no Runtime/Worker/Storage/Federation
 * connection exists, and the public `pub fn` surface is unchanged at
 * twenty-seven.
 */
describe("NIP-44 pre-adoption guard (Stage 193, updated Stage 194-196)", () => {
  const cargoCode: string = cargoTomlSource
    .split("\n")
    .map((line: string) => line.replace(/#.*$/, ""))
    .join("\n")
    .toLowerCase();

  it("1. Cargo.toml has exactly 10 production dependencies: the original 9, plus k256 (Stage 194) — no rust-secp256k1/other ECC crate", () => {
    const depsIdx = cargoCode.indexOf("[dependencies]");
    const devDepsIdx = cargoCode.indexOf("[dev-dependencies]");
    const productionDepsSection = cargoCode.slice(depsIdx, devDepsIdx);
    const productionDepLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(productionDepLines.length).toBe(10);
    const productionDepNames = productionDepLines.map((line: string) => line.trim().split(/\s*=/)[0]);
    expect(productionDepNames.sort()).toEqual(
      [
        "chacha20poly1305",
        "hkdf",
        "zeroize",
        "secrecy",
        "subtle",
        "argon2",
        "aes-gcm",
        "getrandom",
        "sha2",
        "k256",
      ].sort(),
    );
  });

  it("2. no rust-secp256k1 (C-FFI) dependency line anywhere in Cargo.toml — docs/nip44_dependency_adoption.md picked k256", () => {
    expect(cargoCode).not.toMatch(/^\s*secp256k1\s*=/m);
  });

  it("3. k256 IS now a declared dependency (Stage 194) — its exact feature shape has its own dedicated test file", () => {
    expect(cargoCode).toMatch(/^\s*k256\s*=/m);
  });

  it("4. no NIP-44 cryptographic implementation exists anywhere in lib.rs's production code — checked structurally (fn/struct/enum/mod definitions), not as a bare word (this crate's own doc comments legitimately name 'NIP-44' in prose, e.g. 'no Runtime/Worker/Storage/Nostr/NIP-44/WASM connection')", () => {
    const firstCfgTestIdx = libRsSource.indexOf("#[cfg(test)]");
    const productionOnly =
      firstCfgTestIdx === -1 ? libRsSource : libRsSource.slice(0, firstCfgTestIdx);
    for (const forbidden of [
      /\b(fn|struct|enum|mod)\s+\w*nip44\w*/i,
      /\b(fn|struct|enum|mod)\s+\w*Nip44\w*/,
    ]) {
      expect(productionOnly, `expected productionOnly to not match ${forbidden}`).not.toMatch(
        forbidden,
      );
    }
  });

  it("5. the Ecdh CAPABILITY LABEL is legitimate (Stage 195), but no actual ECDH cryptographic COMPUTATION (a real shared-secret function/call) exists anywhere in production code", () => {
    // Updated Stage 195: `CryptoCapability::Ecdh` is now a real, intentional
    // enum variant (capability_matrix.rs) and is legitimately NAMED in
    // crypto.rs's own doc comment — a bare `/\becdh\b/` check across the
    // whole module would now false-positive on that intentional label, so
    // this checks for an actual COMPUTATION shape instead: a function that
    // performs Diffie-Hellman (e.g. calls into k256's point-multiplication
    // API), not merely a label naming the future capability.
    const firstCfgTestIdx = libRsSource.indexOf("#[cfg(test)]");
    const productionOnly = libRsSource.slice(0, firstCfgTestIdx);
    for (const forbidden of [/\bfn\s+\w*ecdh\w*\s*\(/i, /\bAffinePoint::/, /\bProjectivePoint::/, /\.to_affine\s*\(/]) {
      expect(productionOnly, `expected lib.rs productionOnly to not match ${forbidden}`).not.toMatch(
        forbidden,
      );
      expect(cryptoModSource, `expected crypto.rs to not match ${forbidden}`).not.toMatch(forbidden);
    }
  });

  it("6. no ConversationKey/conversation_key derivation FUNCTION exists in production code", () => {
    for (const src of [libRsSource, cryptoModSource]) {
      expect(src).not.toMatch(/\bfn\s+\w*derive\w*conversation_key\w*\s*\(/i);
      expect(src).not.toMatch(/\bfn\s+get_conversation_key\s*\(/i);
    }
  });

  it("7. no MessageKey/message_key derivation FUNCTION exists in production code", () => {
    for (const src of [libRsSource, cryptoModSource]) {
      expect(src).not.toMatch(/\bfn\s+\w*derive\w*message_key\w*\s*\(/i);
      expect(src).not.toMatch(/\bfn\s+get_message_keys\s*\(/i);
    }
  });

  it("8. no padding implementation (calc_padded_len or equivalent) exists in production code", () => {
    for (const src of [libRsSource, cryptoModSource]) {
      expect(src).not.toMatch(/\bfn\s+\w*calc_padded_len\w*\s*\(/i);
      expect(src).not.toMatch(/\bfn\s+\w*pad_plaintext\w*\s*\(/i);
    }
  });

  it("9. no NIP-44-specific encrypt/decrypt FUNCTION exists in production code (fedos_encrypt/fedos_decrypt are the unrelated, pre-existing AEAD API)", () => {
    const firstCfgTestIdx = libRsSource.indexOf("#[cfg(test)]");
    const productionOnly = libRsSource.slice(0, firstCfgTestIdx);
    expect(productionOnly).not.toMatch(/\bfn\s+nip44_encrypt\s*\(/i);
    expect(productionOnly).not.toMatch(/\bfn\s+nip44_decrypt\s*\(/i);
    expect(productionOnly).not.toMatch(/\bfn\s+\w*conversation\w*_(encrypt|decrypt)\s*\(/i);
  });

  it("10. not connected to Runtime, Worker, StorageBackend, or FederationProvider in any way", () => {
    for (const src of [runtimeSource, workerSource]) {
      expect(src).not.toMatch(/nip.?44/i);
      expect(src).not.toMatch(/secp256k1|k256/i);
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
    }
    for (const src of [storageTypesSource, noopStorageSource, federationTypesSource]) {
      expect(src).not.toMatch(/nip.?44/i);
      expect(src).not.toMatch(/secp256k1|k256/i);
    }
  });

  it("11. the crate's public pub fn surface is unchanged at twenty-seven", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
    expect(pubFnNames.length).toBe(27);
    for (const name of pubFnNames) {
      expect(name.toLowerCase()).not.toContain("nip44");
      expect(name.toLowerCase()).not.toContain("conversation");
      expect(name.toLowerCase()).not.toContain("secp256k1");
    }
  });

  it("12. package.json is unchanged — still 2 production dependencies, no secp256k1/k256/elliptic-curve library", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(["@noble/curves", "@noble/hashes"]);
  });

  it("13. docs/nip44_dependency_adoption.md names both candidates, and now records the Stage 194 k256 decision (Stage 192's original 'no decision' framing is superseded)", () => {
    expect(dependencyAdoptionDoc).toMatch(/rust-secp256k1/);
    expect(dependencyAdoptionDoc).toMatch(/\bk256\b/);
    expect(dependencyAdoptionDoc).toMatch(/ADOPTED/);
    expect(dependencyAdoptionDoc).toMatch(/Stage 194/);
    expect(dependencyAdoptionDoc).not.toMatch(/```rust/);
  });
});
