import { describe, it, expect, vi } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig — same pattern `test/architecture_boundary_commerce.test.ts` already uses.
import { existsSync } from "node:fs";

import {
  WasmProductMediaEncryption,
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
 * A REAL end-to-end round trip (real WASM authority + real `encrypt()`/
 * `exportCiphertext()`) would additionally require a built
 * `packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm` artifact. This
 * worktree has none (confirmed below, not assumed) — building it is the
 * coordinator's territory (avoids concurrent Cargo builds colliding with
 * other agents' worktrees), so no such test is added here. If a future
 * run of this suite finds the artifact present, the `it.skipIf` below
 * documents exactly what is skipped and why, rather than silently doing
 * nothing.
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
      const { createFedosWasmMasterSeedAuthority } = await import(
        "../src/os/core/vault/wasm/fedos_wasm_master_seed_authority.js"
      );
      const authority = createFedosWasmMasterSeedAuthority();
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
    },
  );
});
