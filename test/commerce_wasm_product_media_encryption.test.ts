import { describe, it, expect, vi } from "vitest";
import { existsSync } from "node:fs";

import {
  WasmProductMediaEncryption,
  productionCommerceMediaEncryptionDepsFor,
  type WasmProductMediaEncryptionDeps,
} from "../src/os/commerce/catalog/wasm_product_media_encryption.js";
import type { FedosMasterSeedAuthority } from "../src/os/core/vault/wasm/fedos_master_seed_authority.js";
import type { AeadCiphertextHandle, AeadKeyHandle } from "../src/os/core/vault/wasm/fedos_wasm_loader.js";

/**
 * Commerce E2E Completion arc (Wave B, Agent I) — tests for
 * `WasmProductMediaEncryption` (`../src/os/commerce/catalog/wasm_product_media_encryption.ts`),
 * the previously-deferred `ProductMediaEncryptionPort` adapter.
 *
 * Every test here injects a FAKE `FedosMasterSeedAuthority` and (where the
 * flow reaches that far) a FAKE `WasmProductMediaEncryptionDeps` — no real
 * WASM authority, no real Rust boundary. This mirrors the same
 * fake-loader-boundary pattern
 * `test/secure_runtime_alpha_869_resolve_conversation_key_wiring.test.ts`
 * already uses for `FedosWasmMasterSeedAuthority` itself, one layer down.
 *
 * Test 13 is a REAL end-to-end round trip (real WASM authority + real
 * `encrypt()`/`exportCiphertext()`), conditioned on a built
 * `packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm` artifact being
 * present (`REAL_WASM_ARTIFACT_PRESENT` below) — self-skips with a clear
 * label when absent, rather than silently doing nothing. Coordinator
 * integration-gate note: this test also reproduces the real boot sequence
 * (`planLoad()` -> `attemptDevOnlyJsGlueImport()` -> `attemptDevOnlyWasmInitialization()`,
 * plus a `NODE_ENV=development` stub) a real caller performs once at app
 * startup — `createFedosWasmMasterSeedAuthority()` alone is not enough,
 * since it constructs a fresh, un-booted loader. See test 13's own inline
 * comment for the full account.
 */

const REAL_WASM_ARTIFACT_PRESENT = existsSync(
  new URL("../packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm", import.meta.url),
);

const FAKE_KEY: AeadKeyHandle = { kind: "AeadKeyHandle" } as unknown as AeadKeyHandle;
const FAKE_CIPHERTEXT_HANDLE: AeadCiphertextHandle = { kind: "AeadCiphertextHandle" } as unknown as AeadCiphertextHandle;
const FAKE_WIRE = '{"v":1,"alg":"chacha20poly1305","aad":"commerce_media","n":"AAA","ct":"BBB","tag":"CCC"}';

function fakeAuthority(overrides: Partial<FedosMasterSeedAuthority> = {}): FedosMasterSeedAuthority {
  return {
    isAvailable: vi.fn(async () => true),
    isCleared: vi.fn(async () => false),
    generate: vi.fn(async () => true),
    restoreSealed: vi.fn(async () => true),
    seal: vi.fn(async () => null),
    clear: vi.fn(async () => undefined),
    resolveConversationKey: vi.fn(async () => null),
    ...overrides,
  };
}

function fakeDeps(overrides: Partial<WasmProductMediaEncryptionDeps> = {}): WasmProductMediaEncryptionDeps {
  return {
    encrypt: vi.fn(async () => FAKE_CIPHERTEXT_HANDLE),
    exportCiphertext: vi.fn(async () => FAKE_WIRE as unknown as ReturnType<WasmProductMediaEncryptionDeps["exportCiphertext"]> extends Promise<infer T> ? T : never),
    ...overrides,
  };
}

const PLAINTEXT = new TextEncoder().encode("a product photo's plaintext bytes");

describe("WasmProductMediaEncryption", () => {
  it("1. resolveCommerceMediaKey absent (interface's own optional method not implemented) -- resolves null, never throws, never calls deps", async () => {
    const authority = fakeAuthority(); // no resolveCommerceMediaKey at all
    const deps = fakeDeps();
    const adapter = new WasmProductMediaEncryption(authority, deps);

    await expect(adapter.encrypt(PLAINTEXT)).resolves.toBeNull();
    expect(deps.encrypt).not.toHaveBeenCalled();
    expect(deps.exportCiphertext).not.toHaveBeenCalled();
  });

  it("2. resolveCommerceMediaKey resolves null (no Master Seed held / derivation failure) -- resolves null, never calls deps.encrypt", async () => {
    const authority = fakeAuthority({ resolveCommerceMediaKey: vi.fn(async () => null) });
    const deps = fakeDeps();
    const adapter = new WasmProductMediaEncryption(authority, deps);

    await expect(adapter.encrypt(PLAINTEXT)).resolves.toBeNull();
    expect(deps.encrypt).not.toHaveBeenCalled();
  });

  it("3. deps.encrypt resolves null (Runtime Service Loader-chain failure) -- resolves null, never calls deps.exportCiphertext", async () => {
    const authority = fakeAuthority({ resolveCommerceMediaKey: vi.fn(async () => FAKE_KEY) });
    const deps = fakeDeps({ encrypt: vi.fn(async () => null) });
    const adapter = new WasmProductMediaEncryption(authority, deps);

    await expect(adapter.encrypt(PLAINTEXT)).resolves.toBeNull();
    expect(deps.exportCiphertext).not.toHaveBeenCalled();
  });

  it("4. deps.exportCiphertext resolves null (serialize_aead_ciphertext failure) -- resolves null", async () => {
    const authority = fakeAuthority({ resolveCommerceMediaKey: vi.fn(async () => FAKE_KEY) });
    const deps = fakeDeps({ exportCiphertext: vi.fn(async () => null) });
    const adapter = new WasmProductMediaEncryption(authority, deps);

    await expect(adapter.encrypt(PLAINTEXT)).resolves.toBeNull();
  });

  it("5. resolveCommerceMediaKey throws -- fails closed to null, never rejects", async () => {
    const authority = fakeAuthority({
      resolveCommerceMediaKey: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    const adapter = new WasmProductMediaEncryption(authority, fakeDeps());

    await expect(adapter.encrypt(PLAINTEXT)).resolves.toBeNull();
  });

  it("6. deps.encrypt throws -- fails closed to null, never rejects", async () => {
    const authority = fakeAuthority({ resolveCommerceMediaKey: vi.fn(async () => FAKE_KEY) });
    const deps = fakeDeps({
      encrypt: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    const adapter = new WasmProductMediaEncryption(authority, deps);

    await expect(adapter.encrypt(PLAINTEXT)).resolves.toBeNull();
  });

  it("7. deps.exportCiphertext throws -- fails closed to null, never rejects", async () => {
    const authority = fakeAuthority({ resolveCommerceMediaKey: vi.fn(async () => FAKE_KEY) });
    const deps = fakeDeps({
      exportCiphertext: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    const adapter = new WasmProductMediaEncryption(authority, deps);

    await expect(adapter.encrypt(PLAINTEXT)).resolves.toBeNull();
  });

  it("8. success path -- returns the UTF-8 encoding of the exported wire string, round-trippable via TextDecoder", async () => {
    const authority = fakeAuthority({ resolveCommerceMediaKey: vi.fn(async () => FAKE_KEY) });
    const deps = fakeDeps();
    const adapter = new WasmProductMediaEncryption(authority, deps);

    const result = await adapter.encrypt(PLAINTEXT);
    expect(result).not.toBeNull();
    expect(result).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(result as Uint8Array)).toBe(FAKE_WIRE);
  });

  it("9. success path result never equals the plaintext bytes (a real encryption actually happened, not a passthrough)", async () => {
    const authority = fakeAuthority({ resolveCommerceMediaKey: vi.fn(async () => FAKE_KEY) });
    const adapter = new WasmProductMediaEncryption(authority, fakeDeps());

    const result = await adapter.encrypt(PLAINTEXT);
    expect(result).not.toBeNull();
    expect(Buffer.from(result as Uint8Array).equals(Buffer.from(PLAINTEXT))).toBe(false);
  });

  it("10. calls deps.encrypt with exactly the resolved key, the fixed ChaCha20Poly1305 algorithm, the fixed CommerceMedia AAD domain, and the caller's plaintext", async () => {
    const authority = fakeAuthority({ resolveCommerceMediaKey: vi.fn(async () => FAKE_KEY) });
    const deps = fakeDeps();
    const adapter = new WasmProductMediaEncryption(authority, deps);

    await adapter.encrypt(PLAINTEXT);
    expect(deps.encrypt).toHaveBeenCalledWith(FAKE_KEY, "ChaCha20Poly1305", "CommerceMedia", PLAINTEXT);
  });

  it("11. calls deps.exportCiphertext with exactly the handle deps.encrypt produced", async () => {
    const authority = fakeAuthority({ resolveCommerceMediaKey: vi.fn(async () => FAKE_KEY) });
    const deps = fakeDeps();
    const adapter = new WasmProductMediaEncryption(authority, deps);

    await adapter.encrypt(PLAINTEXT);
    expect(deps.exportCiphertext).toHaveBeenCalledWith(FAKE_CIPHERTEXT_HANDLE);
  });

  it("12. with no injected deps, defaults to the real encrypt()/exportCiphertext() Runtime Service exports (which themselves fail closed with no real WASM present) -- resolves null, never throws", async () => {
    const authority = fakeAuthority({ resolveCommerceMediaKey: vi.fn(async () => FAKE_KEY) });
    const adapter = new WasmProductMediaEncryption(authority); // no deps argument at all

    await expect(adapter.encrypt(PLAINTEXT)).resolves.toBeNull();
  });

  it.skipIf(!REAL_WASM_ARTIFACT_PRESENT)(
    "13. [only runs if packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm exists] real WASM + a real, freshly-generated Master Seed round-trips a genuine ciphertext",
    async () => {
      // Coordinator fix: the real boot sequence a production caller performs
      // once at app startup (never inside `FedosWasmMasterSeedAuthority`
      // itself) must be reproduced explicitly here — mirrors
      // `test/secure_runtime_alpha_5401_5480_real_vertical_slice.test.ts`'s
      // own established `primedWasmMasterSeedAuthority()`/`withDevelopmentNodeEnv()`
      // pattern exactly, rather than inventing a new one: `planLoad()`
      // (populates the artifact-check/dev-gate/import-readiness fields as a
      // side effect) -> `attemptDevOnlyJsGlueImport()` -> `attemptDevOnlyWasmInitialization()`
      // -- only then does `FedosWasmMasterSeedAuthority`'s own construct step
      // see every precondition satisfied. The dev-only gate additionally
      // requires `process.env.NODE_ENV === "development"` specifically (not
      // vitest's own ambient value) — stubbed for the duration of this one
      // test only, restored after, same as the established sibling test.
      const { FedosWasmLoaderSkeleton } = await import("../src/os/core/vault/wasm/fedos_wasm_loader.js");
      const { FedosWasmMasterSeedAuthority } = await import(
        "../src/os/core/vault/wasm/fedos_wasm_master_seed_authority.js"
      );
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      try {
        const loader = new FedosWasmLoaderSkeleton();
        loader.planLoad();
        const importResult = await loader.attemptDevOnlyJsGlueImport();
        expect(importResult.succeeded, JSON.stringify(importResult)).toBe(true);
        const wasmInit = await loader.attemptDevOnlyWasmInitialization();
        expect(wasmInit.succeeded, JSON.stringify(wasmInit)).toBe(true);

        const authority = new FedosWasmMasterSeedAuthority(loader);
        const generated = await authority.generate();
        expect(generated).toBe(true);

        const adapter = new WasmProductMediaEncryption(authority); // no injected deps -- the real Runtime Service path
        const result = await adapter.encrypt(PLAINTEXT);

        expect(result).not.toBeNull();
        expect(result).toBeInstanceOf(Uint8Array);
        expect(Buffer.from(result as Uint8Array).equals(Buffer.from(PLAINTEXT))).toBe(false);
        // The wire text is valid UTF-8 JSON carrying the CommerceMedia domain label somewhere in its envelope.
        const wireText = new TextDecoder().decode(result as Uint8Array);
        expect(() => JSON.parse(wireText)).not.toThrow();
      } finally {
        if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalNodeEnv;
      }
    },
  );
});

/**
 * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Coordinator
 * validation-gate fix) — regression coverage for the LIVE, 100%-reproducible
 * bug this suite could never have caught before: every test above injects a
 * fake `deps`, so the adapter's REAL default dependency resolution was
 * completely unexercised. In the real app that default resolved to the
 * DEV-ONLY `FedosWasmLoader` chain (`fedos_runtime_encrypt.ts`), whose gate
 * is unconditionally closed outside `NODE_ENV=development` — so a real,
 * unlocked production authority produced a genuine `AeadKeyHandle` and then
 * `encrypt()` returned `null` every single time, surfacing to a seller as
 * "protected content storage failed: failed".
 *
 * These tests assert the DEFAULT-RESOLUTION behavior directly, with no
 * injected `deps` — the exact thing the real composition root relies on.
 */
describe("WasmProductMediaEncryption -- production AEAD bridge preference (validation-gate fix)", () => {
  /** The structural shape a real `FedosProductionMasterSeedAuthority` satisfies -- see the adapter's own header for why this is duck-typed, never imported. */
  function productionLikeAuthority(overrides: Record<string, unknown> = {}): FedosMasterSeedAuthority {
    return {
      ...fakeAuthority({ resolveCommerceMediaKey: vi.fn(async () => FAKE_KEY) }),
      encryptAead: vi.fn(() => FAKE_CIPHERTEXT_HANDLE),
      serializeAeadCiphertext: vi.fn(() => FAKE_WIRE),
      ...overrides,
    } as unknown as FedosMasterSeedAuthority;
  }

  it("P1. with NO injected deps, an authority that offers the production AEAD bridge is used for BOTH halves -- the dev-only Runtime Service exports are never reached", async () => {
    const authority = productionLikeAuthority();
    const adapter = new WasmProductMediaEncryption(authority); // no deps -- the real composition-root call shape
    const result = await adapter.encrypt(PLAINTEXT);

    expect(result).not.toBeNull();
    expect(new TextDecoder().decode(result as Uint8Array)).toBe(FAKE_WIRE);
    expect((authority as unknown as { encryptAead: ReturnType<typeof vi.fn> }).encryptAead).toHaveBeenCalledTimes(1);
    expect((authority as unknown as { serializeAeadCiphertext: ReturnType<typeof vi.fn> }).serializeAeadCiphertext).toHaveBeenCalledTimes(1);
  });

  it("P2. the production bridge receives the SAME opaque key handle resolveCommerceMediaKey() returned, plus the fixed CommerceMedia/ChaCha20Poly1305 pair -- never a re-derived key, never a different domain", async () => {
    const authority = productionLikeAuthority();
    await new WasmProductMediaEncryption(authority).encrypt(PLAINTEXT);
    const encryptAead = (authority as unknown as { encryptAead: ReturnType<typeof vi.fn> }).encryptAead;
    expect(encryptAead).toHaveBeenCalledWith(FAKE_KEY, "ChaCha20Poly1305", "CommerceMedia", PLAINTEXT);
  });

  it("P3. an explicitly-injected deps object still wins over the production bridge (testability seam unchanged)", async () => {
    const authority = productionLikeAuthority();
    const deps = fakeDeps();
    await new WasmProductMediaEncryption(authority, deps).encrypt(PLAINTEXT);
    expect(deps.encrypt).toHaveBeenCalledTimes(1);
    expect((authority as unknown as { encryptAead: ReturnType<typeof vi.fn> }).encryptAead).not.toHaveBeenCalled();
  });

  it("P4. productionCommerceMediaEncryptionDepsFor() is all-or-nothing: a HALF-matching object (or null/undefined/a plain authority) yields null, so the adapter falls back rather than half-using a bridge", () => {
    expect(productionCommerceMediaEncryptionDepsFor(null)).toBeNull();
    expect(productionCommerceMediaEncryptionDepsFor(undefined)).toBeNull();
    expect(productionCommerceMediaEncryptionDepsFor(fakeAuthority())).toBeNull();
    expect(productionCommerceMediaEncryptionDepsFor({ encryptAead: () => null })).toBeNull();
    expect(productionCommerceMediaEncryptionDepsFor({ serializeAeadCiphertext: () => null })).toBeNull();
    expect(productionCommerceMediaEncryptionDepsFor({ encryptAead: () => null, serializeAeadCiphertext: () => null })).not.toBeNull();
  });

  it("P5. a THROWING production bridge still fails closed to null -- never a throw, never a plaintext fallback", async () => {
    const throwing = productionLikeAuthority({
      encryptAead: vi.fn(() => {
        throw new Error("wasm boundary blew up");
      }),
    });
    await expect(new WasmProductMediaEncryption(throwing).encrypt(PLAINTEXT)).resolves.toBeNull();

    const throwingSerialize = productionLikeAuthority({
      serializeAeadCiphertext: vi.fn(() => {
        throw new Error("wasm boundary blew up");
      }),
    });
    await expect(new WasmProductMediaEncryption(throwingSerialize).encrypt(PLAINTEXT)).resolves.toBeNull();
  });
});
