import { describe, it, expect } from "vitest";
import { NoopCryptoProvider } from "../src/crypto/noop_crypto.js";
import {
  CRYPTO_CAPABILITIES,
  type CryptoCapability,
  type EncryptRequest,
} from "../src/crypto/types.js";
import { cryptoCapabilitiesToVaultCapabilities } from "../src/crypto/vault_bridge.js";
// Crypto sources as strings: prove no XOR / no AEAD-library import lives here.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cryptoTypesSource from "../src/os/core/crypto/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopCryptoSource from "../src/os/core/crypto/noop_crypto.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import vaultBridgeSource from "../src/os/core/crypto/vault_bridge.ts?raw";
// Runtime / Worker sources: prove the crypto core is NOT auto-wired.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

const cryptoSources = [cryptoTypesSource, noopCryptoSource, vaultBridgeSource].join(
  "\n",
);

/**
 * Stage 34 — Crypto Core boundary tests.
 *
 * These assert the SEAM behaves as a boundary: it runs no crypto, generates no
 * randomness, derives no key, never throws, never mutates input, imports no
 * crypto library, and is not wired into the core.
 */
describe("NoopCryptoProvider", () => {
  it("is unavailable", () => {
    const crypto = new NoopCryptoProvider();
    expect(crypto.getStatus().state).toBe("unavailable");
  });

  it("advertises placeholder-or-empty capabilities only", () => {
    const caps = new NoopCryptoProvider().getCapabilities();
    for (const cap of caps) {
      expect(cap).toMatch(/_placeholder$/);
    }
    // The no-op default advertises nothing.
    expect(caps).toEqual([]);
  });

  it("randomBytes is denied/unavailable and produces no bytes", async () => {
    const decision = await new NoopCryptoProvider().randomBytes({ length: 32 });
    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe("unavailable");
    // No output/bytes field exists on the decision.
    expect(decision).not.toHaveProperty("bytes");
    expect(decision).not.toHaveProperty("output");
  });

  it("deriveKey is denied/unavailable", async () => {
    const decision = await new NoopCryptoProvider().deriveKey({ kdf: "hkdf" });
    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe("unavailable");
  });

  it("encrypt is denied/unavailable", async () => {
    const decision = await new NoopCryptoProvider().encrypt({
      algorithm: "chacha20poly1305",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe("unavailable");
  });

  it("decrypt is denied/unavailable", async () => {
    const decision = await new NoopCryptoProvider().decrypt({
      algorithm: "chacha20poly1305",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe("unavailable");
  });

  it("no operation throws", async () => {
    const crypto = new NoopCryptoProvider();
    await expect(crypto.randomBytes({ length: 16 })).resolves.toBeDefined();
    await expect(crypto.deriveKey({})).resolves.toBeDefined();
    await expect(crypto.encrypt({})).resolves.toBeDefined();
    await expect(crypto.decrypt({})).resolves.toBeDefined();
  });

  it("does not mutate the input request", async () => {
    const crypto = new NoopCryptoProvider();
    const request: EncryptRequest = {
      algorithm: "aes_gcm",
      keyRef: "handle-1",
      plaintextRef: "handle-2",
      aad: "v1",
    };
    const snapshot = JSON.stringify(request);
    await crypto.encrypt(request);
    expect(JSON.stringify(request)).toBe(snapshot);
  });
});

describe("crypto → vault capability bridge", () => {
  it("maps placeholders to vault placeholders, deduped, without mutating input", () => {
    const input: readonly CryptoCapability[] = [
      "aead_placeholder",
      "nip44_placeholder",
      "kdf_placeholder",
      "random_placeholder",
    ];
    const snapshot = JSON.stringify(input);
    const vaultCaps = cryptoCapabilitiesToVaultCapabilities(input);
    // aead + nip44 dedupe to one aead_crypto_placeholder; kdf -> identity_unlock.
    expect(vaultCaps).toEqual([
      "aead_crypto_placeholder",
      "identity_unlock_placeholder",
    ]);
    // Every produced capability is itself a placeholder.
    for (const cap of vaultCaps) {
      expect(cap).toMatch(/_placeholder$/);
    }
    // Input untouched.
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("returns nothing for an empty list", () => {
    expect(cryptoCapabilitiesToVaultCapabilities([])).toEqual([]);
  });

  it("every declared placeholder capability ends in _placeholder", () => {
    for (const cap of CRYPTO_CAPABILITIES) {
      expect(cap).toMatch(/_placeholder$/);
    }
  });
});

describe("src/crypto has no real cryptography", () => {
  it("contains no XOR implementation", () => {
    expect(cryptoSources.toLowerCase()).not.toContain("xor");
  });

  it("imports no AEAD / crypto library", () => {
    const importLines = cryptoSources
      .split("\n")
      .filter((line) => /^\s*import\b/.test(line));
    const denylist = [
      "chacha20poly1305",
      "@noble/ciphers",
      "@noble/hashes",
      "aes-gcm",
      "argon2",
      "bip39",
      "node:crypto",
      "tweetnacl",
      "libsodium",
    ];
    for (const line of importLines) {
      for (const pkg of denylist) {
        expect(line).not.toContain(pkg);
      }
    }
  });
});

describe("crypto core is SELECTED but never executed by the core", () => {
  // Stage 65 lets `createRuntime` SELECT a `CryptoProvider` from env — so the
  // Runtime/Worker sources now legitimately reference crypto. What must stay
  // absent is any EXECUTION: no `randomBytes`/`deriveKey`/`encrypt`/`decrypt`
  // call. (See `test/runtime_crypto_env.test.ts` for the full selection-boundary
  // coverage.)
  it("Runtime source selects a crypto provider but never runs a crypto op", () => {
    expect(runtimeSource).not.toMatch(/\.\s*randomBytes\s*\(/);
    expect(runtimeSource).not.toMatch(/\.\s*deriveKey\s*\(/);
    expect(runtimeSource).not.toMatch(/\.\s*encrypt\s*\(/);
    expect(runtimeSource).not.toMatch(/\.\s*decrypt\s*\(/);
  });

  it("Worker source never runs a crypto op", () => {
    expect(workerSource).not.toMatch(/\.\s*randomBytes\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*deriveKey\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*encrypt\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*decrypt\s*\(/);
  });
});
