import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cryptoTypesSource from "../../../src/os/core/crypto/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopCryptoSource from "../../../src/os/core/crypto/noop_crypto.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import vaultBridgeSource from "../../../src/os/core/crypto/vault_bridge.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import masterSeedAuthoritySource from "../../../src/os/core/vault/wasm/fedos_master_seed_authority.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sealedEnvelopeSource from "../../../src/os/core/vault/wasm/fedos_sealed_master_seed_envelope.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmMasterSeedAuthoritySource from "../../../src/os/core/vault/wasm/fedos_wasm_master_seed_authority.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import vaultTypesSource from "../../../src/os/core/vault/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import memoryVaultSource from "../../../src/os/core/vault/memory_vault.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopVaultSource from "../../../src/os/core/vault/noop_vault.ts?raw";

/**
 * Private Message Envelope and Encryption Activation V1 review --
 * crypto boundary invariants. Inspects src/crypto, src/runtime/master_seed,
 * and src/vault (the exact set the task's own required-reading list
 * names) to assert CURRENT boundary invariants -- no real key material
 * embedded in source, noop implementations really are noops, no raw-byte
 * getter exists on the Master Seed Authority. Never asserts anything
 * about a future implementation.
 */

/** A conservative check for an accidentally-committed raw secret: a long hex/base64-ish literal assigned to a key/seed-shaped identifier. */
function containsSuspiciousEmbeddedSecretLiteral(source: string, contextPattern: RegExp): boolean {
  const lines = source.split("\n");
  for (const line of lines) {
    if (!contextPattern.test(line)) continue;
    // A 32+ char hex or base64-shaped literal on the same line as a key/seed-named identifier.
    if (/["'`][0-9a-fA-F]{32,}["'`]/.test(line)) return true;
    if (/["'`][A-Za-z0-9+/]{40,}={0,2}["'`]/.test(line)) return true;
  }
  return false;
}

describe("Private Message Envelope V1 review -- crypto boundary invariants", () => {
  it("1. src/crypto/types.ts embeds no real key/seed/secret literal anywhere in the file", () => {
    expect(containsSuspiciousEmbeddedSecretLiteral(cryptoTypesSource as string, /key|seed|secret/i)).toBe(false);
  });

  it("2. src/crypto/noop_crypto.ts NoopCryptoProvider is total and never throws -- behavioral", async () => {
    const { NoopCryptoProvider } = await import("../../../src/crypto/noop_crypto.js");
    const provider = new NoopCryptoProvider();
    await expect(provider.randomBytes({ length: 32 })).resolves.toMatchObject({ allowed: false });
    await expect(provider.deriveKey({})).resolves.toMatchObject({ allowed: false });
    await expect(provider.encrypt({})).resolves.toMatchObject({ allowed: false });
    await expect(provider.decrypt({})).resolves.toMatchObject({ allowed: false });
  });

  it("3. NoopCryptoProvider's own decisions never carry an output-bytes field -- behavioral, grounds 01's 'nothing is produced' finding", async () => {
    const { NoopCryptoProvider } = await import("../../../src/crypto/noop_crypto.js");
    const provider = new NoopCryptoProvider();
    const decision = await provider.encrypt({});
    expect(Object.keys(decision).sort()).toEqual(["allowed", "reason", "state"]);
  });

  it("4. noop_crypto.ts source itself never imports or references packages/fedos-core-rust", () => {
    expect(noopCryptoSource as string).not.toMatch(/fedos-core-rust/);
  });

  it("5. src/crypto/vault_bridge.ts is a pure, unwired mapping -- no import of noop_crypto, no runtime/worker reference", () => {
    expect(vaultBridgeSource as string).not.toMatch(/from ["']\.\/noop_crypto\.js["']/);
    expect(vaultBridgeSource as string).not.toMatch(/runtime\/|worker\.ts/);
    expect(vaultBridgeSource as string).toMatch(/export function cryptoCapabilitiesToVaultCapabilities/);
  });

  it("6. FedosMasterSeedAuthority interface (src/runtime/master_seed) declares no raw-byte-returning method", () => {
    // Every declared method must return boolean, void, or a sealed envelope type -- never Uint8Array directly.
    const methodLines = (masterSeedAuthoritySource as string)
      .split("\n")
      .filter((line: string) => /^\s*\w+\(.*\):\s*Promise</.test(line));
    expect(methodLines.length).toBeGreaterThan(0);
    for (const line of methodLines) {
      expect(line).not.toMatch(/Promise<Uint8Array>/);
    }
  });

  it("7. FedosSealedMasterSeedEnvelopeV1 carries no plaintext-seed field or accessor -- source inspection", () => {
    expect(sealedEnvelopeSource as string).toMatch(/export interface FedosSealedMasterSeedEnvelopeV1/);
    const interfaceStart = (sealedEnvelopeSource as string).indexOf("export interface FedosSealedMasterSeedEnvelopeV1");
    const interfaceBody = (sealedEnvelopeSource as string).slice(
      interfaceStart,
      (sealedEnvelopeSource as string).indexOf("}", interfaceStart),
    );
    // Only a `json: string` field is permitted -- no `salt`/`nonce`/`plaintext`/`seed` accessor.
    expect(interfaceBody).toMatch(/readonly json: string/);
    expect(interfaceBody).not.toMatch(/salt|nonce|plaintext|rawSeed/i);
    expect(sealedEnvelopeSource as string).toMatch(/sole AUTHORITATIVE parser/i);
  });

  it("8. FedosWasmMasterSeedAuthority never exposes its own WASM handle publicly -- source inspection of the class's own public method return types", () => {
    const publicMethodSignatures = (wasmMasterSeedAuthoritySource as string).match(
      /async \w+\([^)]*\): Promise<[^{;]+>/g,
    );
    expect(publicMethodSignatures).not.toBeNull();
    for (const signature of publicMethodSignatures ?? []) {
      // No public method may declare a return type that is the raw handle type itself, except the
      // explicitly-named, reviewed internal-use accessor for Nostr signing.
      if (signature.includes("accessForNostrSigningAuthorityInternalUse")) continue;
      expect(signature).not.toMatch(/Promise<FedosMasterSeedAuthorityHandle/);
    }
  });

  it("9. src/vault/types.ts VaultBoundary declares no key-derivation or key-generation method", () => {
    expect(vaultTypesSource as string).toMatch(/export interface VaultBoundary/);
    const interfaceStart = (vaultTypesSource as string).indexOf("export interface VaultBoundary");
    const interfaceBody = (vaultTypesSource as string).slice(interfaceStart, (vaultTypesSource as string).indexOf("\n}", interfaceStart));
    expect(interfaceBody).not.toMatch(/deriveKey|generateKey|deriveSeed/i);
  });

  it("10. InMemoryVaultBoundary.unlock() derives no key -- behavioral, confirms the placeholder truly derives nothing", async () => {
    const { InMemoryVaultBoundary } = await import("../../../src/os/core/vault/memory_vault.js");
    const vault = new InMemoryVaultBoundary();
    const decision = await vault.unlock({ kind: "passphrase" });
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toMatch(/no key derived/i);
    // The decision itself carries no key-shaped field.
    expect(Object.keys(decision).sort()).toEqual(["allowed", "reason", "state"]);
  });

  it("11. memory_vault.ts source itself states, in its own words, that it never generates or derives a key/seed/token/secret", () => {
    expect(memoryVaultSource as string).toMatch(/never:/i);
    expect(memoryVaultSource as string).toMatch(/generates or derives a key/i);
  });

  it("12. NoopVaultBoundary is permanently unavailable and never unlocks -- behavioral", async () => {
    const { NoopVaultBoundary } = await import("../../../src/os/core/vault/noop_vault.js");
    const vault = new NoopVaultBoundary();
    expect(vault.getState()).toBe("unavailable");
    expect(vault.isUnlocked()).toBe(false);
    const decision = await vault.unlock({ kind: "passphrase" });
    expect(decision.allowed).toBe(false);
  });

  it("13. noop_vault.ts source confirms it is NOT wired into the runtime or Worker", () => {
    expect(noopVaultSource as string).toMatch(/NOT\s*\n?\s*\*?\s*wired into the runtime or Worker/i);
  });

  it("14. no file under src/crypto, src/runtime/master_seed, or src/vault embeds a literal that looks like a real secp256k1/Nostr private key (64 hex chars assigned to a key-shaped identifier)", () => {
    const dirs = ["src/crypto", "src/runtime/master_seed", "src/vault"];
    function allFiles(dir: string): string[] {
      const entries = readdirSync(dir, { withFileTypes: true }) as Array<{ name: string; isDirectory(): boolean }>;
      let files: string[] = [];
      for (const entry of entries) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) files = files.concat(allFiles(path));
        else if (entry.name.endsWith(".ts")) files.push(path);
      }
      return files;
    }
    const offending: string[] = [];
    for (const dir of dirs) {
      for (const file of allFiles(dir)) {
        const text = readFileSync(file, "utf8") as string;
        // Look for a bare 64-hex-char literal (the shape of a raw secp256k1 key) anywhere in the file.
        if (/["'`][0-9a-fA-F]{64}["'`]/.test(text)) offending.push(file);
      }
    }
    expect(offending).toEqual([]);
  });

  it("15. no file under src/crypto, src/runtime/master_seed, or src/vault contains a hard-coded BIP-39 mnemonic-shaped literal (12+ lowercase words in a single quoted string)", () => {
    const dirs = ["src/crypto", "src/runtime/master_seed", "src/vault"];
    function allFiles(dir: string): string[] {
      const entries = readdirSync(dir, { withFileTypes: true }) as Array<{ name: string; isDirectory(): boolean }>;
      let files: string[] = [];
      for (const entry of entries) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) files = files.concat(allFiles(path));
        else if (entry.name.endsWith(".ts")) files.push(path);
      }
      return files;
    }
    const mnemonicShape = /["'`](?:[a-z]+ ){11,}[a-z]+["'`]/;
    const offending: string[] = [];
    for (const dir of dirs) {
      for (const file of allFiles(dir)) {
        const text = readFileSync(file, "utf8") as string;
        if (mnemonicShape.test(text)) offending.push(file);
      }
    }
    expect(offending).toEqual([]);
  });
});
