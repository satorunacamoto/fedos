/**
 * Secure Runtime Alpha 5401-5480 — FedOS Direct Ratchet State and Sealed
 * Persistence Foundation Arc. Exercises `FedosWasmMasterSeedAuthority`'s
 * new `sealDirectRatchetSecret()`/`restoreDirectRatchetSecret()` methods
 * against the REAL, freshly-built WASM artifact end to end (real
 * Rust-side HKDF + ChaCha20-Poly1305 AEAD, not a mock) — the headline
 * sealed-persistence proof this Arc's own test requirements call for.
 *
 * Skips itself with a clear message if the real
 * `packages/fedos-core-rust/pkg/` is absent (gitignored; run
 * `npm run build:wasm` first).
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync } from "node:fs";
// @ts-expect-error see above.
import { join } from "node:path";

import { FedosWasmMasterSeedAuthority } from "../src/runtime/master_seed/fedos_wasm_master_seed_authority.js";
import { FedosWasmLoaderSkeleton } from "../src/runtime/fedos_wasm_loader.js";

declare const process: { cwd(): string; env: { NODE_ENV?: string; [key: string]: string | undefined } };

const WASM_PATH = join(process.cwd(), "packages", "fedos-core-rust", "pkg", "fedos_core_rust_bg.wasm");
const REAL_ARTIFACT_PRESENT = existsSync(WASM_PATH);

const suite = REAL_ARTIFACT_PRESENT ? describe : describe.skip;

async function withDevelopmentNodeEnv<T>(fn: () => Promise<T>): Promise<T> {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    return await fn();
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
}

/**
 * Mirrors `assembleFedosConversationProductionCryptoGraph()`'s own
 * established priming sequence
 * (`src/conversation/encryption/production/fedos_conversation_production_crypto_authority_factory.ts`)
 * — `FedosWasmMasterSeedAuthority` deliberately never drives
 * `planLoad()`/`attemptDevOnlyJsGlueImport()`/
 * `attemptDevOnlyWasmInitialization()` itself; the caller must, on the
 * SAME loader instance, before constructing the authority with it.
 */
async function generatedAuthority(): Promise<FedosWasmMasterSeedAuthority> {
  const loader = new FedosWasmLoaderSkeleton();
  loader.planLoad();
  await loader.attemptDevOnlyJsGlueImport();
  await loader.attemptDevOnlyWasmInitialization();
  const authority = new FedosWasmMasterSeedAuthority(loader);
  const generated = await authority.generate();
  expect(generated).toBe(true);
  return authority;
}

suite("Alpha 5401-5480 — Direct Ratchet sealed-secret authority (REAL WASM)", () => {
  it("1. seal then restore round-trips the exact plaintext under the real Rust boundary", async () => {
    await withDevelopmentNodeEnv(async () => {
      const authority = await generatedAuthority();
      const secret = new TextEncoder().encode("placeholder ratchet secret, never a real derived key");
      const sealed = await authority.sealDirectRatchetSecret("local-device-1", "remote-device-1", "conv-1", 0, secret);
      expect(sealed).not.toBeNull();
      expect(typeof sealed).toBe("string");

      const restored = await authority.restoreDirectRatchetSecret(
        "local-device-1",
        "remote-device-1",
        "conv-1",
        0,
        sealed as string,
      );
      expect(restored).not.toBeNull();
      expect(Array.from(restored as Uint8Array)).toEqual(Array.from(secret));
    });
  });

  it("2. the sealed blob is opaque hex -- no plaintext marker leaks into it", async () => {
    await withDevelopmentNodeEnv(async () => {
      const authority = await generatedAuthority();
      const secret = new TextEncoder().encode("do-not-leak-this-marker-anywhere");
      const sealed = await authority.sealDirectRatchetSecret("local-1", "remote-1", "conv-1", 0, secret);
      expect(sealed).not.toBeNull();
      const blob = sealed as string;
      expect(blob).not.toContain("do-not-leak-this-marker-anywhere");
      expect(/^[0-9a-f]+$/.test(blob)).toBe(true);
    });
  });

  it("3. restore fails closed under a different local device", async () => {
    await withDevelopmentNodeEnv(async () => {
      const authority = await generatedAuthority();
      const sealed = await authority.sealDirectRatchetSecret("local-1", "remote-1", "conv-1", 0, new Uint8Array([9, 9, 9]));
      const restored = await authority.restoreDirectRatchetSecret("local-WRONG", "remote-1", "conv-1", 0, sealed as string);
      expect(restored).toBeNull();
    });
  });

  it("4. restore fails closed under a different remote device", async () => {
    await withDevelopmentNodeEnv(async () => {
      const authority = await generatedAuthority();
      const sealed = await authority.sealDirectRatchetSecret("local-1", "remote-1", "conv-1", 0, new Uint8Array([9, 9, 9]));
      const restored = await authority.restoreDirectRatchetSecret("local-1", "remote-WRONG", "conv-1", 0, sealed as string);
      expect(restored).toBeNull();
    });
  });

  it("5. restore fails closed under a different conversation", async () => {
    await withDevelopmentNodeEnv(async () => {
      const authority = await generatedAuthority();
      const sealed = await authority.sealDirectRatchetSecret("local-1", "remote-1", "conv-1", 0, new Uint8Array([9, 9, 9]));
      const restored = await authority.restoreDirectRatchetSecret("local-1", "remote-1", "conv-WRONG", 0, sealed as string);
      expect(restored).toBeNull();
    });
  });

  it("6. restore fails closed under a different generation", async () => {
    await withDevelopmentNodeEnv(async () => {
      const authority = await generatedAuthority();
      const sealed = await authority.sealDirectRatchetSecret("local-1", "remote-1", "conv-1", 0, new Uint8Array([9, 9, 9]));
      const restored = await authority.restoreDirectRatchetSecret("local-1", "remote-1", "conv-1", 1, sealed as string);
      expect(restored).toBeNull();
    });
  });

  it("7. restore fails closed on a tampered sealed blob", async () => {
    await withDevelopmentNodeEnv(async () => {
      const authority = await generatedAuthority();
      const sealed = await authority.sealDirectRatchetSecret("local-1", "remote-1", "conv-1", 0, new Uint8Array([9, 9, 9]));
      const chars = (sealed as string).split("");
      const flipIndex = 30 % chars.length;
      chars[flipIndex] = chars[flipIndex] === "0" ? "1" : "0";
      const tampered = chars.join("");
      const restored = await authority.restoreDirectRatchetSecret("local-1", "remote-1", "conv-1", 0, tampered);
      expect(restored).toBeNull();
    });
  });

  it("8. restore fails closed on a malformed sealed blob", async () => {
    await withDevelopmentNodeEnv(async () => {
      const authority = await generatedAuthority();
      for (const malformed of ["", "not-hex-zz", "abc"]) {
        const restored = await authority.restoreDirectRatchetSecret("local-1", "remote-1", "conv-1", 0, malformed);
        expect(restored).toBeNull();
      }
    });
  });

  it("9. two independent sessions (different conversations) derive independent sealed blobs that never cross-open", async () => {
    await withDevelopmentNodeEnv(async () => {
      const authority = await generatedAuthority();
      const secretA = new TextEncoder().encode("session A secret");
      const secretB = new TextEncoder().encode("session B secret");
      const sealedA = await authority.sealDirectRatchetSecret("local-1", "remote-1", "conv-A", 0, secretA);
      const sealedB = await authority.sealDirectRatchetSecret("local-1", "remote-1", "conv-B", 0, secretB);

      const crossOpen = await authority.restoreDirectRatchetSecret("local-1", "remote-1", "conv-B", 0, sealedA as string);
      expect(crossOpen).toBeNull();

      const restoredA = await authority.restoreDirectRatchetSecret("local-1", "remote-1", "conv-A", 0, sealedA as string);
      const restoredB = await authority.restoreDirectRatchetSecret("local-1", "remote-1", "conv-B", 0, sealedB as string);
      expect(Array.from(restoredA as Uint8Array)).toEqual(Array.from(secretA));
      expect(Array.from(restoredB as Uint8Array)).toEqual(Array.from(secretB));
    });
  });

  it("10. seal fails closed before generate() -- a constructed-but-empty authority never seals", async () => {
    await withDevelopmentNodeEnv(async () => {
      const loader = new FedosWasmLoaderSkeleton();
      loader.planLoad();
      await loader.attemptDevOnlyJsGlueImport();
      await loader.attemptDevOnlyWasmInitialization();
      const authority = new FedosWasmMasterSeedAuthority(loader);
      const sealed = await authority.sealDirectRatchetSecret("local-1", "remote-1", "conv-1", 0, new Uint8Array([1]));
      expect(sealed).toBeNull();
    });
  });
});
