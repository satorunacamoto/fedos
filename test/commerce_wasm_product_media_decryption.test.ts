import { describe, it, expect, vi } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig — same pattern `test/commerce_wasm_product_media_encryption.test.ts` already uses.
import { existsSync } from "node:fs";

import {
  WasmProductMediaDecryption,
  type WasmProductMediaDecryptionDeps,
} from "../src/os/commerce/catalog/wasm_product_media_decryption.js";
import { WasmProductMediaEncryption } from "../src/os/commerce/catalog/wasm_product_media_encryption.js";
import type { FedosMasterSeedAuthority } from "../src/os/core/vault/wasm/fedos_master_seed_authority.js";
import type { AeadCiphertextHandle, AeadKeyHandle } from "../src/os/core/vault/wasm/fedos_wasm_loader.js";

/**
 * Commerce FINAL Closure arc (Agent M) — tests for
 * `WasmProductMediaDecryption`
 * (`../src/os/commerce/catalog/wasm_product_media_decryption.ts`), the
 * decrypt-direction counterpart to
 * `test/commerce_wasm_product_media_encryption.test.ts`'s
 * `WasmProductMediaEncryption` suite. Mirrors that file's own structure
 * and fake-loader-boundary pattern exactly.
 *
 * Test 13 is a REAL end-to-end round trip (real WASM authority + real
 * `importCiphertext()`/`decrypt()`), conditioned on a built
 * `packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm` artifact being
 * present — self-skips with a clear label when absent.
 */

const REAL_WASM_ARTIFACT_PRESENT = existsSync(
  new URL("../packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm", import.meta.url),
);

const FAKE_KEY: AeadKeyHandle = { kind: "AeadKeyHandle" } as unknown as AeadKeyHandle;
const FAKE_CIPHERTEXT_HANDLE: AeadCiphertextHandle = { kind: "AeadCiphertextHandle" } as unknown as AeadCiphertextHandle;
const FAKE_WIRE = '{"v":1,"alg":"chacha20poly1305","aad":"commerce_media","n":"AAA","ct":"BBB","tag":"CCC"}';
const FAKE_PLAINTEXT = new TextEncoder().encode("a product photo's plaintext bytes");

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

function fakeDeps(overrides: Partial<WasmProductMediaDecryptionDeps> = {}): WasmProductMediaDecryptionDeps {
  return {
    importCiphertext: vi.fn(async () => FAKE_CIPHERTEXT_HANDLE),
    decrypt: vi.fn(async () => FAKE_PLAINTEXT),
    ...overrides,
  };
}

const CIPHERTEXT_BYTES = new TextEncoder().encode(FAKE_WIRE);

describe("WasmProductMediaDecryption", () => {
  it("1. resolveCommerceMediaKey absent -- resolves null, never throws, never calls deps", async () => {
    const authority = fakeAuthority(); // no resolveCommerceMediaKey at all
    const deps = fakeDeps();
    const adapter = new WasmProductMediaDecryption(authority, deps);

    await expect(adapter.decrypt(CIPHERTEXT_BYTES)).resolves.toBeNull();
    expect(deps.importCiphertext).not.toHaveBeenCalled();
    expect(deps.decrypt).not.toHaveBeenCalled();
  });

  it("2. resolveCommerceMediaKey resolves null -- resolves null, never calls deps.importCiphertext", async () => {
    const authority = fakeAuthority({ resolveCommerceMediaKey: vi.fn(async () => null) });
    const deps = fakeDeps();
    const adapter = new WasmProductMediaDecryption(authority, deps);

    await expect(adapter.decrypt(CIPHERTEXT_BYTES)).resolves.toBeNull();
    expect(deps.importCiphertext).not.toHaveBeenCalled();
  });

  it("3. deps.importCiphertext resolves null (malformed/tampered wire text) -- resolves null, never calls deps.decrypt", async () => {
    const authority = fakeAuthority({ resolveCommerceMediaKey: vi.fn(async () => FAKE_KEY) });
    const deps = fakeDeps({ importCiphertext: vi.fn(async () => null) });
    const adapter = new WasmProductMediaDecryption(authority, deps);

    await expect(adapter.decrypt(CIPHERTEXT_BYTES)).resolves.toBeNull();
    expect(deps.decrypt).not.toHaveBeenCalled();
  });

  it("4. deps.decrypt resolves null (WRONG KEY / wrong domain / tampered ciphertext -- decrypt_aead()'s own single collapsed failure) -- resolves null", async () => {
    const authority = fakeAuthority({ resolveCommerceMediaKey: vi.fn(async () => FAKE_KEY) });
    const deps = fakeDeps({ decrypt: vi.fn(async () => null) });
    const adapter = new WasmProductMediaDecryption(authority, deps);

    await expect(adapter.decrypt(CIPHERTEXT_BYTES)).resolves.toBeNull();
  });

  it("5. resolveCommerceMediaKey throws -- fails closed to null, never rejects", async () => {
    const authority = fakeAuthority({
      resolveCommerceMediaKey: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    const adapter = new WasmProductMediaDecryption(authority, fakeDeps());

    await expect(adapter.decrypt(CIPHERTEXT_BYTES)).resolves.toBeNull();
  });

  it("6. deps.importCiphertext throws -- fails closed to null, never rejects", async () => {
    const authority = fakeAuthority({ resolveCommerceMediaKey: vi.fn(async () => FAKE_KEY) });
    const deps = fakeDeps({
      importCiphertext: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    const adapter = new WasmProductMediaDecryption(authority, deps);

    await expect(adapter.decrypt(CIPHERTEXT_BYTES)).resolves.toBeNull();
  });

  it("7. deps.decrypt throws -- fails closed to null, never rejects", async () => {
    const authority = fakeAuthority({ resolveCommerceMediaKey: vi.fn(async () => FAKE_KEY) });
    const deps = fakeDeps({
      decrypt: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    const adapter = new WasmProductMediaDecryption(authority, deps);

    await expect(adapter.decrypt(CIPHERTEXT_BYTES)).resolves.toBeNull();
  });

  it("8. success path -- returns the exact plaintext deps.decrypt produced", async () => {
    const authority = fakeAuthority({ resolveCommerceMediaKey: vi.fn(async () => FAKE_KEY) });
    const deps = fakeDeps();
    const adapter = new WasmProductMediaDecryption(authority, deps);

    const result = await adapter.decrypt(CIPHERTEXT_BYTES);
    expect(result).not.toBeNull();
    expect(Buffer.from(result as Uint8Array).equals(Buffer.from(FAKE_PLAINTEXT))).toBe(true);
  });

  it("9. calls deps.importCiphertext with the UTF-8-decoded wire text (exact inverse of WasmProductMediaEncryption's own UTF-8 encode step)", async () => {
    const authority = fakeAuthority({ resolveCommerceMediaKey: vi.fn(async () => FAKE_KEY) });
    const deps = fakeDeps();
    const adapter = new WasmProductMediaDecryption(authority, deps);

    await adapter.decrypt(CIPHERTEXT_BYTES);
    expect(deps.importCiphertext).toHaveBeenCalledWith(FAKE_WIRE);
  });

  it("10. calls deps.decrypt with exactly the resolved key, the fixed ChaCha20Poly1305 algorithm, the fixed CommerceMedia AAD domain, and the imported handle", async () => {
    const authority = fakeAuthority({ resolveCommerceMediaKey: vi.fn(async () => FAKE_KEY) });
    const deps = fakeDeps();
    const adapter = new WasmProductMediaDecryption(authority, deps);

    await adapter.decrypt(CIPHERTEXT_BYTES);
    expect(deps.decrypt).toHaveBeenCalledWith(FAKE_KEY, "ChaCha20Poly1305", "CommerceMedia", FAKE_CIPHERTEXT_HANDLE);
  });

  it("11. MALFORMED CIPHERTEXT BYTES: bytes that are not valid UTF-8 JSON never throw -- TextDecoder + importCiphertext's own wire-structure validation fail closed", async () => {
    const authority = fakeAuthority({ resolveCommerceMediaKey: vi.fn(async () => FAKE_KEY) });
    const deps = fakeDeps({ importCiphertext: vi.fn(async () => null) }); // a real importCiphertext() would reject malformed wire text this way
    const adapter = new WasmProductMediaDecryption(authority, deps);

    const garbage = new Uint8Array([0xff, 0xfe, 0x00, 0x01, 0x02]);
    await expect(adapter.decrypt(garbage)).resolves.toBeNull();
  });

  it("12. with no injected deps, defaults to the real importCiphertext()/decrypt() Runtime Service exports (which themselves fail closed with no real WASM present) -- resolves null, never throws", async () => {
    const authority = fakeAuthority({ resolveCommerceMediaKey: vi.fn(async () => FAKE_KEY) });
    const adapter = new WasmProductMediaDecryption(authority); // no deps argument at all

    await expect(adapter.decrypt(CIPHERTEXT_BYTES)).resolves.toBeNull();
  });

  it.skipIf(!REAL_WASM_ARTIFACT_PRESENT)(
    "13. [only runs if packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm exists] real WASM + a real, freshly-generated Master Seed round-trips a genuine ciphertext produced by WasmProductMediaEncryption back to the exact original plaintext",
    async () => {
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

        const encryptionAdapter = new WasmProductMediaEncryption(authority);
        const decryptionAdapter = new WasmProductMediaDecryption(authority);

        const ciphertext = await encryptionAdapter.encrypt(FAKE_PLAINTEXT);
        expect(ciphertext).not.toBeNull();
        if (ciphertext === null) throw new Error("unreachable");

        const recovered = await decryptionAdapter.decrypt(ciphertext);
        expect(recovered).not.toBeNull();
        expect(Buffer.from(recovered as Uint8Array).equals(Buffer.from(FAKE_PLAINTEXT))).toBe(true);

        // A DIFFERENT (never-generated) authority's key must not decrypt this ciphertext.
        const strangerLoader = new FedosWasmLoaderSkeleton();
        strangerLoader.planLoad();
        await strangerLoader.attemptDevOnlyJsGlueImport();
        await strangerLoader.attemptDevOnlyWasmInitialization();
        const strangerAuthority = new FedosWasmMasterSeedAuthority(strangerLoader);
        expect(await strangerAuthority.generate()).toBe(true);
        const strangerDecryption = new WasmProductMediaDecryption(strangerAuthority);
        expect(await strangerDecryption.decrypt(ciphertext)).toBeNull();
      } finally {
        if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = originalNodeEnv;
      }
    },
  );
});
