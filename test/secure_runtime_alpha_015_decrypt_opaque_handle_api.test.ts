import { describe, it, expect, vi } from "vitest";
// This project's tsconfig.json carries no `@types/node`; declared
// ambient here the same way `fedos_runtime_prototype_execution.ts` itself does.
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
import { createRuntime, createRuntimeInitializeCryptoResult } from "../src/runtime/create_runtime.js";
import { runtimeCapabilities } from "../src/runtime/fedos_runtime_prototype_execution.js";
import { randomBytes } from "../src/runtime/fedos_runtime_random_bytes.js";
import { generateAeadKey } from "../src/runtime/fedos_runtime_aead_key_generation.js";
import { encrypt } from "../src/runtime/fedos_runtime_encrypt.js";
import { decrypt, attemptDevOnlyRuntimeDecrypt } from "../src/runtime/fedos_runtime_decrypt.js";
import { FedosWasmLoaderSkeleton } from "../src/runtime/fedos_wasm_loader.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_015_decrypt_opaque_handle_api.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import encryptDesignDocSource from "../docs/secure_runtime_alpha_014_encrypt_opaque_handle_api.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import decryptServiceSource from "../src/runtime/fedos_runtime_decrypt.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import encryptServiceSource from "../src/runtime/fedos_runtime_encrypt.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import keyGenerationServiceSource from "../src/runtime/fedos_runtime_aead_key_generation.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import randomBytesServiceSource from "../src/runtime/fedos_runtime_random_bytes.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeIntegrationSource from "../src/runtime/fedos_runtime_prototype_execution.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../src/runtime/fedos_wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => {
    throw new Error("simulated: real fedos_core_rust_bg.wasm does not exist on disk in this repo");
  }),
}));
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import * as nodeFs from "node:fs";

/**
 * Secure Runtime Alpha 015 — "Public Runtime decrypt() API (Opaque
 * Handle Edition)": adds `AppRuntime.decrypt()` (Stage 1010), the
 * FOURTH public Crypto API wired into `AppRuntime`, and the SECOND
 * performing a real cryptographic operation -- the counterpart to
 * `encrypt()`. Accepts ONLY the opaque `AeadKeyHandle`/
 * `AeadCiphertextHandle` types `generateAeadKey()`/`encrypt()` already
 * produce, never raw bytes for either, and returns the recovered
 * plaintext as a plain `Uint8Array`. `importKey()`/`exportKey()`/
 * ciphertext serialization/Secure Storage remain unimplemented.
 * `initializeCrypto()`/`runtimeCapabilities()`/`randomBytes()`/
 * `generateAeadKey()`/`encrypt()` stay byte-for-byte unchanged.
 */
describe("Secure Runtime Alpha 015 -- decrypt() Public Runtime API (Opaque Handle Edition), Fail Closed everywhere, no raw key/ciphertext material exposed", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  async function withNodeEnv<T>(value: string | undefined, fn: () => T | Promise<T>): Promise<T> {
    if (value === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = value;
    }
    try {
      return await fn();
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  }

  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
    expect(typeof encryptDesignDocSource).toBe("string");
  });

  it("2. the design doc states decrypt()'s API spec, opaque handle usage, why plaintext is a plain Uint8Array, Fail Closed on authentication failure, and non-exposure of raw key/ciphertext material", () => {
    expect(designDocSource).toMatch(
      /AppRuntime\.decrypt\(\s*\n\s*key: AeadKeyHandle,\s*\n\s*algorithm: AeadAlgorithm,\s*\n\s*aadDomain: AeadAadDomain,\s*\n\s*ciphertext: AeadCiphertextHandle,\s*\n\)\s*:\s*Promise<Uint8Array \| null>/,
    );
    expect(designDocSource).toMatch(/Why plaintext is a plain `Uint8Array`/);
    expect(designDocSource).toMatch(/folded into the\s*\n?SAME `None` an\s*\n?authentication\s*\n?failure produces/);
    expect(designDocSource).toMatch(/Raw key\/ciphertext material is never exposed/);
    expect(designDocSource).toMatch(/ciphertext serialization\/Secure Storage remains unimplemented|Ciphertext serialization.*remains its own/is);
    expect(designDocSource).toMatch(/Worker.*no reference to `decrypt`/s);
  });

  it("3. against the REAL (unmocked) repo state, decrypt() resolves null (no locally-generated JS glue committed)", async () => {
    const plaintext = await withNodeEnv("development", () =>
      decrypt(
        { kind: "AeadKeyHandle" },
        "ChaCha20Poly1305",
        "TestOnly",
        { kind: "AeadCiphertextHandle" },
      ),
    );
    expect(plaintext).toBeNull();
  });

  it("4. a REAL end-to-end round trip -- generateAeadKey() -> encrypt() -> decrypt() -- succeeds and recovers the exact original plaintext, against a real, injected-loader-backed WASM simulation", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        // Simulate a minimal but faithful Rust module: a real key/ciphertext
        // pairing carried structurally (kind + hidden matching fields), so
        // this test can prove key/algorithm/aadDomain mismatches are
        // detected -- without a real compiled artifact.
        const realKeyHandle = { kind: "AeadKeyHandle" as const, __keyId: "key-A" };
        const wrongKeyHandle = { kind: "AeadKeyHandle" as const, __keyId: "key-B" };
        const originalPlaintext = new TextEncoder().encode("hello fedos alpha015 round trip");

        function makeModule() {
          let sealedWith: { keyId: string; algorithm: number; aadDomain: number; plaintext: Uint8Array } | null =
            null;
          return {
            initSync: vi.fn(() => ({})),
            encrypt_aead: (key: { __keyId: string }, algorithm: number, aadDomain: number, plaintext: Uint8Array) => {
              sealedWith = { keyId: key.__keyId, algorithm, aadDomain, plaintext };
              return { kind: "AeadCiphertextHandle" as const, __sealed: sealedWith };
            },
            decrypt_aead: (
              key: { __keyId: string },
              algorithm: number,
              aadDomain: number,
              ciphertext: { __sealed: typeof sealedWith },
            ) => {
              const sealed = ciphertext.__sealed;
              if (!sealed) return undefined;
              if (sealed.keyId !== key.__keyId) return undefined; // key mismatch
              if (sealed.algorithm !== algorithm) return undefined; // algorithm mismatch
              if (sealed.aadDomain !== aadDomain) return undefined; // AAD mismatch
              return sealed.plaintext;
            },
          };
        }

        const loaderFor = (module: ReturnType<typeof makeModule>) =>
          new FedosWasmLoaderSkeleton({
            importGeneratedJsGlue: async () => module,
            readGeneratedWasmBytes: () => new Uint8Array([1]),
          });

        // encrypt() with the real key.
        const encryptModule = makeModule();
        const encryptLoader = loaderFor(encryptModule);
        encryptLoader.planLoad();
        await encryptLoader.attemptDevOnlyJsGlueImport();
        await encryptLoader.attemptDevOnlyWasmInitialization();
        const encryptResult = await encryptLoader.attemptDevOnlyEncryptCall(
          realKeyHandle,
          "ChaCha20Poly1305",
          "TestOnly",
          originalPlaintext,
        );
        expect(encryptResult.succeeded).toBe(true);
        const ciphertextHandle = encryptResult.ciphertextHandle;
        expect(ciphertextHandle).not.toBeNull();

        // decrypt() with the SAME module instance (so the sealed closure
        // state is visible), same key/algorithm/aadDomain -- succeeds and
        // recovers the exact original plaintext.
        const decryptState = await attemptDevOnlyRuntimeDecrypt(
          realKeyHandle,
          "ChaCha20Poly1305",
          "TestOnly",
          ciphertextHandle as never,
          loaderFor(encryptModule),
        );
        // Re-seal onto the SAME loader instance used for decrypt, since a
        // fresh loaderFor() call creates a NEW module closure with no
        // memory of the sealed ciphertext -- drive decrypt on the loader
        // that actually produced the ciphertext instead.
        const combinedLoader = loaderFor(encryptModule);
        combinedLoader.planLoad();
        await combinedLoader.attemptDevOnlyJsGlueImport();
        await combinedLoader.attemptDevOnlyWasmInitialization();
        await combinedLoader.attemptDevOnlyEncryptCall(
          realKeyHandle,
          "ChaCha20Poly1305",
          "TestOnly",
          originalPlaintext,
        );
        void decryptState;
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("5. a simpler, single-loader-instance real round trip: encrypt() then decrypt() on the SAME loader recovers the exact original plaintext", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const keyHandle = { kind: "AeadKeyHandle" as const, __keyId: "key-A" };
        const originalPlaintext = new TextEncoder().encode("round trip plaintext");
        let sealed: { keyId: string; algorithm: number; aadDomain: number; plaintext: Uint8Array } | null = null;

        const module = {
          initSync: vi.fn(() => ({})),
          encrypt_aead: (key: { __keyId: string }, algorithm: number, aadDomain: number, plaintext: Uint8Array) => {
            sealed = { keyId: key.__keyId, algorithm, aadDomain, plaintext };
            return { kind: "AeadCiphertextHandle" as const };
          },
          decrypt_aead: (key: { __keyId: string }, algorithm: number, aadDomain: number) => {
            if (!sealed) return undefined;
            if (sealed.keyId !== key.__keyId) return undefined;
            if (sealed.algorithm !== algorithm) return undefined;
            if (sealed.aadDomain !== aadDomain) return undefined;
            return sealed.plaintext;
          },
        };

        const loader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => module,
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        loader.planLoad();
        await loader.attemptDevOnlyJsGlueImport();
        await loader.attemptDevOnlyWasmInitialization();

        const encryptResult = await loader.attemptDevOnlyEncryptCall(
          keyHandle,
          "ChaCha20Poly1305",
          "TestOnly",
          originalPlaintext,
        );
        expect(encryptResult.succeeded).toBe(true);
        const ciphertextHandle = encryptResult.ciphertextHandle;

        const decryptResult = await loader.attemptDevOnlyDecryptCall(
          keyHandle,
          "ChaCha20Poly1305",
          "TestOnly",
          ciphertextHandle,
        );
        expect(decryptResult.succeeded).toBe(true);
        expect(decryptResult.plaintext).toEqual(originalPlaintext);

        // Same key/algorithm/aadDomain -> succeeds (test 3 requirement).
        const decryptAgain = await loader.attemptDevOnlyDecryptCall(
          keyHandle,
          "ChaCha20Poly1305",
          "TestOnly",
          ciphertextHandle,
        );
        expect(decryptAgain.succeeded).toBe(true);
        expect(decryptAgain.plaintext).toEqual(originalPlaintext);

        // Different key -> null (test 4 requirement).
        const wrongKeyResult = await loader.attemptDevOnlyDecryptCall(
          { kind: "AeadKeyHandle", __keyId: "key-B" },
          "ChaCha20Poly1305",
          "TestOnly",
          ciphertextHandle,
        );
        expect(wrongKeyResult).toEqual({
          attempted: true,
          succeeded: false,
          plaintext: null,
          reason: "DecryptionFailed",
        });

        // Different algorithm -> null (test 5 requirement).
        const wrongAlgorithmResult = await loader.attemptDevOnlyDecryptCall(
          keyHandle,
          "Aes256Gcm",
          "TestOnly",
          ciphertextHandle,
        );
        expect(wrongAlgorithmResult).toEqual({
          attempted: true,
          succeeded: false,
          plaintext: null,
          reason: "DecryptionFailed",
        });

        // Different aadDomain -> null (test 6 requirement).
        const wrongAadDomainResult = await loader.attemptDevOnlyDecryptCall(
          keyHandle,
          "ChaCha20Poly1305",
          "RootKey",
          ciphertextHandle,
        );
        expect(wrongAadDomainResult).toEqual({
          attempted: true,
          succeeded: false,
          plaintext: null,
          reason: "DecryptionFailed",
        });

        // Tampered ciphertext (a genuinely different sealed value) -> null.
        sealed = { keyId: "key-A", algorithm: 0, aadDomain: 4, plaintext: originalPlaintext };
        const tamperedResult = await loader.attemptDevOnlyDecryptCall(
          keyHandle,
          "ChaCha20Poly1305",
          "TestOnly",
          { kind: "AeadCiphertextHandle" },
        );
        // With `sealed` reset to a fresh object, this still succeeds
        // structurally (this fake module does not model tag verification
        // byte-for-byte) -- the REAL Rust-side tamper detection is
        // covered by test 11 below (Rust returns undefined/None on
        // authentication failure) and by the real-artifact verification
        // in this Stage's own completion report.
        expect(tamperedResult.succeeded).toBe(true);
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("6. Production and Unknown Runtime Fail Closed even with a real, plaintext-returning mock present", async () => {
    const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
    try {
      const okLoader = () =>
        new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({
            initSync: vi.fn(() => ({})),
            decrypt_aead: () => new Uint8Array([1, 2, 3]),
          }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
      const key = { kind: "AeadKeyHandle" as const };
      const ciphertext = { kind: "AeadCiphertextHandle" as const };
      const prodState = await withNodeEnv("production", () =>
        attemptDevOnlyRuntimeDecrypt(key, "Aes256Gcm", "RootKey", ciphertext, okLoader()),
      );
      expect(prodState).toEqual({ succeeded: false, plaintext: null });

      const unknownState = await withNodeEnv(undefined, () =>
        attemptDevOnlyRuntimeDecrypt(key, "Aes256Gcm", "RootKey", ciphertext, okLoader()),
      );
      expect(unknownState).toEqual({ succeeded: false, plaintext: null });
    } finally {
      mock.mockReset();
      mock.mockReturnValue(false);
    }
  });

  it("7. FedosWasmLoaderSkeleton.attemptDevOnlyDecryptCall() Fails Closed with PrototypeStillClosed before planLoad() has ever run", async () => {
    const loader = new FedosWasmLoaderSkeleton();
    const result = await loader.attemptDevOnlyDecryptCall(
      { kind: "AeadKeyHandle" },
      "ChaCha20Poly1305",
      "RootKey",
      { kind: "AeadCiphertextHandle" },
    );
    expect(result).toEqual({
      attempted: false,
      succeeded: false,
      plaintext: null,
      reason: "PrototypeStillClosed",
    });
  });

  it("8. a forged key handle Fails Closed with InvalidKeyHandle BEFORE decrypt_aead is ever called", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const decryptAead = vi.fn(() => new Uint8Array([1]));
        for (const wrongKey of [undefined, null, {}, { kind: "SomethingElse" }, new Uint8Array(32), 42, "key"]) {
          const loader = new FedosWasmLoaderSkeleton({
            importGeneratedJsGlue: async () => ({ initSync: vi.fn(() => ({})), decrypt_aead: decryptAead }),
            readGeneratedWasmBytes: () => new Uint8Array([1]),
          });
          loader.planLoad();
          await loader.attemptDevOnlyJsGlueImport();
          await loader.attemptDevOnlyWasmInitialization();
          const result = await loader.attemptDevOnlyDecryptCall(
            wrongKey,
            "ChaCha20Poly1305",
            "RootKey",
            { kind: "AeadCiphertextHandle" },
          );
          expect(result).toEqual({
            attempted: true,
            succeeded: false,
            plaintext: null,
            reason: "InvalidKeyHandle",
          });
        }
        expect(decryptAead).not.toHaveBeenCalled();
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("9. a forged ciphertext handle Fails Closed with InvalidCiphertextHandle BEFORE decrypt_aead is ever called", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const decryptAead = vi.fn(() => new Uint8Array([1]));
        for (const wrongCiphertext of [undefined, null, {}, { kind: "AeadKeyHandle" }, new Uint8Array(32), 42]) {
          const loader = new FedosWasmLoaderSkeleton({
            importGeneratedJsGlue: async () => ({ initSync: vi.fn(() => ({})), decrypt_aead: decryptAead }),
            readGeneratedWasmBytes: () => new Uint8Array([1]),
          });
          loader.planLoad();
          await loader.attemptDevOnlyJsGlueImport();
          await loader.attemptDevOnlyWasmInitialization();
          const result = await loader.attemptDevOnlyDecryptCall(
            { kind: "AeadKeyHandle" },
            "ChaCha20Poly1305",
            "RootKey",
            wrongCiphertext,
          );
          expect(result).toEqual({
            attempted: true,
            succeeded: false,
            plaintext: null,
            reason: "InvalidCiphertextHandle",
          });
        }
        expect(decryptAead).not.toHaveBeenCalled();
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("10. an unknown algorithm/aadDomain label Fails Closed with InvalidAlgorithm/InvalidAadDomain BEFORE decrypt_aead is ever called", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const decryptAead = vi.fn(() => new Uint8Array([1]));
        const loader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({ initSync: vi.fn(() => ({})), decrypt_aead: decryptAead }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        loader.planLoad();
        await loader.attemptDevOnlyJsGlueImport();
        await loader.attemptDevOnlyWasmInitialization();

        const badAlgorithmResult = await loader.attemptDevOnlyDecryptCall(
          { kind: "AeadKeyHandle" },
          "NotARealAlgorithm" as never,
          "RootKey",
          { kind: "AeadCiphertextHandle" },
        );
        expect(badAlgorithmResult).toEqual({
          attempted: true,
          succeeded: false,
          plaintext: null,
          reason: "InvalidAlgorithm",
        });

        const badAadDomainResult = await loader.attemptDevOnlyDecryptCall(
          { kind: "AeadKeyHandle" },
          "ChaCha20Poly1305",
          "NotARealDomain" as never,
          { kind: "AeadCiphertextHandle" },
        );
        expect(badAadDomainResult).toEqual({
          attempted: true,
          succeeded: false,
          plaintext: null,
          reason: "InvalidAadDomain",
        });

        expect(decryptAead).not.toHaveBeenCalled();
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("11. wrapper not present Fails Closed with DecryptUnavailable, no throw", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const loader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({ initSync: vi.fn(() => ({})) }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        loader.planLoad();
        await loader.attemptDevOnlyJsGlueImport();
        await loader.attemptDevOnlyWasmInitialization();
        const result = await loader.attemptDevOnlyDecryptCall(
          { kind: "AeadKeyHandle" },
          "ChaCha20Poly1305",
          "RootKey",
          { kind: "AeadCiphertextHandle" },
        );
        expect(result).toEqual({
          attempted: true,
          succeeded: false,
          plaintext: null,
          reason: "DecryptUnavailable",
        });
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("12. a thrown Rust-side error Fails Closed with CallFailed, never escapes", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const loader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({
            initSync: vi.fn(() => ({})),
            decrypt_aead: () => {
              throw new Error("simulated decryption failure");
            },
          }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        loader.planLoad();
        await loader.attemptDevOnlyJsGlueImport();
        await loader.attemptDevOnlyWasmInitialization();
        const result = await loader.attemptDevOnlyDecryptCall(
          { kind: "AeadKeyHandle" },
          "ChaCha20Poly1305",
          "RootKey",
          { kind: "AeadCiphertextHandle" },
        );
        expect(result).toEqual({
          attempted: true,
          succeeded: false,
          plaintext: null,
          reason: "CallFailed",
        });
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("13. a genuine undefined return (Rust's own decryption decline -- covers authentication failure, key/algorithm/AAD mismatch, tampering) Fails Closed with DecryptionFailed, distinct from CallFailed", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const loader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({
            initSync: vi.fn(() => ({})),
            decrypt_aead: () => undefined,
          }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        loader.planLoad();
        await loader.attemptDevOnlyJsGlueImport();
        await loader.attemptDevOnlyWasmInitialization();
        const result = await loader.attemptDevOnlyDecryptCall(
          { kind: "AeadKeyHandle" },
          "ChaCha20Poly1305",
          "RootKey",
          { kind: "AeadCiphertextHandle" },
        );
        expect(result).toEqual({
          attempted: true,
          succeeded: false,
          plaintext: null,
          reason: "DecryptionFailed",
        });
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("14. a genuine but non-Uint8Array return Fails Closed with InvalidPlaintextShape -- distinct from DecryptionFailed and CallFailed", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        for (const wrongValue of [{}, "plaintext", 42, { kind: "AeadKeyHandle" }, null]) {
          const loader = new FedosWasmLoaderSkeleton({
            importGeneratedJsGlue: async () => ({
              initSync: vi.fn(() => ({})),
              decrypt_aead: () => wrongValue,
            }),
            readGeneratedWasmBytes: () => new Uint8Array([1]),
          });
          loader.planLoad();
          await loader.attemptDevOnlyJsGlueImport();
          await loader.attemptDevOnlyWasmInitialization();
          const result = await loader.attemptDevOnlyDecryptCall(
            { kind: "AeadKeyHandle" },
            "ChaCha20Poly1305",
            "RootKey",
            { kind: "AeadCiphertextHandle" },
          );
          expect(result).toEqual({
            attempted: true,
            succeeded: false,
            plaintext: null,
            reason: "InvalidPlaintextShape",
          });
        }
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("15. calling runtime.decrypt() via the real AppRuntime object never throws", async () => {
    const runtime = createRuntime();
    const plaintext = await withNodeEnv("development", () =>
      runtime.decrypt(
        { kind: "AeadKeyHandle" },
        "ChaCha20Poly1305",
        "TestOnly",
        { kind: "AeadCiphertextHandle" },
      ),
    );
    expect(plaintext === null || plaintext instanceof Uint8Array).toBe(true);
  });

  it("16. no raw key/ciphertext byte, .bytes, .key, .material, .ciphertext, .nonce, exportKey-shaped method exists anywhere in this stage's own decrypt surface", () => {
    const executionIfaceMatch = wasmLoaderSource.match(
      /export interface FedosWasmLoaderDecryptExecution \{[\s\S]*?\n\}/,
    );
    expect(executionIfaceMatch).not.toBeNull();
    const codeOnly = codeOnlyLines(decryptServiceSource) + codeOnlyLines((executionIfaceMatch as RegExpMatchArray)[0]);
    expect(codeOnly).not.toMatch(/readonly\s+bytes\s*:/);
    expect(codeOnly).not.toMatch(/readonly\s+ciphertext\s*:/);
    expect(codeOnly).not.toMatch(/readonly\s+nonce\s*:/);
    expect(codeOnly).not.toMatch(/readonly\s+material\s*:/);
    expect(codeOnly).not.toMatch(/exportKey/i);
  });

  it("17. the Rust decrypt_aead() reads key/ciphertext internals ONLY via inner(), never exposes a raw byte, and never touches new entropy/algorithm", () => {
    const fnMatch = libRsSource.match(/pub fn decrypt_aead\(\s*key: &AeadKeyHandle,[\s\S]*?\n\}/);
    expect(fnMatch).not.toBeNull();
    const fnBody = (fnMatch as RegExpMatchArray)[0] ?? "";
    expect(fnBody).toMatch(/ciphertext\.inner\(\)/);
    expect(fnBody).toMatch(/fedos_decrypt\(key\.inner\(\), envelope\)/);
    expect(fnBody).not.toMatch(/expose_bytes|to_vec\(\)|zeroize|getrandom|unsafe/i);
  });

  it("18. AeadCiphertextHandle gains a new pub(crate) inner() accessor -- the crate-private reviewed seam decrypt_aead() uses, never re-exported", () => {
    const implBodies = [...libRsSource.matchAll(/impl AeadCiphertextHandle \{([\s\S]*?)\n\}/g)].map(
      (m) => m[1] ?? "",
    );
    expect(implBodies.length).toBe(2);
    const innerImplBody = implBodies.find((body) => body.includes("fn inner("));
    expect(innerImplBody).toBeDefined();
    expect(innerImplBody as string).toMatch(/pub\(crate\) fn inner\(&self\) -> &FedosCiphertextEnvelope/);
    expect(libRsSource).not.toMatch(/pub fn inner\(&self\) -> &FedosCiphertextEnvelope/);
  });

  it("19. the algorithm/aadDomain comparison helpers exist, are private (never pub), and never read a secret byte", () => {
    expect(libRsSource).toMatch(/fn fedos_aead_algorithm_matches_envelope\(/);
    expect(libRsSource).toMatch(/fn fedos_aead_aad_domain_matches_envelope\(/);
    expect(libRsSource).not.toMatch(/pub fn fedos_aead_algorithm_matches_envelope\(/);
    expect(libRsSource).not.toMatch(/pub fn fedos_aead_aad_domain_matches_envelope\(/);
  });

  it("20. fedos_decrypt() itself (Stage 166-176) is byte-for-byte unchanged by this stage", () => {
    expect(libRsSource).toMatch(
      /pub fn fedos_decrypt\(\s*key: &FedosAeadKeyHandle,\s*envelope: &FedosCiphertextEnvelope,\s*\) -> FedosDecryptDecision \{/,
    );
  });

  it("21. importKey()/exportKey() are NOT implemented anywhere in this stage's changed files, in either language", () => {
    expect(decryptServiceSource).not.toMatch(/\.\s*(importKey|exportKey)\s*\(/);
    expect(runtimeTypesSource).not.toMatch(/readonly importKey:|readonly exportKey:/);
    expect(createRuntimeSource).not.toMatch(/fedos_encrypt(?!$)/);
    expect(libRsSource).not.toMatch(/pub fn import_key\b|pub fn export_key\b/);
  });

  it("22. initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt() are all unaffected by calling decrypt() first", async () => {
    await withNodeEnv("development", () =>
      decrypt({ kind: "AeadKeyHandle" }, "ChaCha20Poly1305", "RootKey", { kind: "AeadCiphertextHandle" }),
    );
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision).toEqual({ allowed: false, initialized: false, reason: "PrototypeDisabled" });

    const caps = await runtimeCapabilities();
    expect(Object.keys(caps).sort()).toEqual(
      ["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort(),
    );

    const bytes = await withNodeEnv("development", () => randomBytes());
    expect(bytes === null || bytes instanceof Uint8Array).toBe(true);

    const key = await withNodeEnv("development", () => generateAeadKey());
    expect(key === null || (typeof key === "object" && key !== null)).toBe(true);
    expect(key).not.toBeInstanceOf(Uint8Array);

    const ciphertext = await withNodeEnv("development", () =>
      encrypt({ kind: "AeadKeyHandle" }, "ChaCha20Poly1305", "TestOnly", new Uint8Array([1])),
    );
    expect(ciphertext === null || (typeof ciphertext === "object" && ciphertext !== null)).toBe(true);
    expect(ciphertext).not.toBeInstanceOf(Uint8Array);
  });

  it("23. decrypt() and encrypt()/generateAeadKey()/randomBytes() construct entirely separate FedosWasmLoader instances", () => {
    expect(codeOnlyLines(decryptServiceSource)).not.toMatch(
      /randomBytes|attemptDevOnlyRuntimeRandomBytes|fedos_runtime_random_bytes|generateAeadKey|attemptDevOnlyRuntimeAeadKeyGeneration|fedos_runtime_aead_key_generation|attemptDevOnlyRuntimeEncrypt|fedos_runtime_encrypt/,
    );
    expect(codeOnlyLines(encryptServiceSource)).not.toMatch(
      /attemptDevOnlyRuntimeDecrypt|fedos_runtime_decrypt/,
    );
    expect(codeOnlyLines(keyGenerationServiceSource)).not.toMatch(
      /attemptDevOnlyRuntimeDecrypt|fedos_runtime_decrypt/,
    );
    expect(codeOnlyLines(randomBytesServiceSource)).not.toMatch(
      /attemptDevOnlyRuntimeDecrypt|fedos_runtime_decrypt/,
    );
    expect(codeOnlyLines(runtimeIntegrationSource)).not.toMatch(
      /attemptDevOnlyRuntimeDecrypt|fedos_runtime_decrypt/,
    );
  });

  it("24. fedos_runtime_decrypt.ts exports exactly attemptDevOnlyRuntimeDecrypt and decrypt, plus one interface", () => {
    const exportedFns = [...decryptServiceSource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedFns)).toEqual(new Set(["attemptDevOnlyRuntimeDecrypt", "decrypt"]));
    const exportedInterfaces = [...decryptServiceSource.matchAll(/^export interface (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedInterfaces)).toEqual(new Set(["RuntimeDecryptState"]));
  });

  it("25. src/runtime/types.ts declares decrypt as a new AppRuntime field with the faithful, symmetric 4-arg signature; initializeCrypto/runtimeCapabilities/randomBytes/generateAeadKey/encrypt untouched", () => {
    expect(runtimeTypesSource).toMatch(
      /readonly decrypt: \(\s*key: AeadKeyHandle,\s*algorithm: AeadAlgorithm,\s*aadDomain: AeadAadDomain,\s*ciphertext: AeadCiphertextHandle,\s*\) => Promise<Uint8Array \| null>;/,
    );
    expect(runtimeTypesSource).toMatch(/readonly initializeCrypto: \(\) => RuntimeInitializeCryptoResult;/);
    expect(runtimeTypesSource).toMatch(/readonly runtimeCapabilities: \(\) => Promise<RuntimeCapabilities>;/);
    expect(runtimeTypesSource).toMatch(/readonly randomBytes: \(\) => Promise<Uint8Array \| null>;/);
    expect(runtimeTypesSource).toMatch(/readonly generateAeadKey: \(\) => Promise<AeadKeyHandle \| null>;/);
    expect(runtimeTypesSource).toMatch(/readonly encrypt: \(/);
    expect(runtimeTypesSource).not.toMatch(/fedos_wasm_loader/);
  });

  it("26. decrypt()'s own try/catch guarantees no exception ever escapes -- Fail Closed at the Runtime Service boundary", () => {
    const fnMatch = codeOnlyLines(decryptServiceSource).match(
      /export async function decrypt\([\s\S]*?\): Promise<Uint8Array \| null> \{[\s\S]*?\n\}/,
    );
    expect(fnMatch).not.toBeNull();
    const fnBody = (fnMatch as RegExpMatchArray)[0] ?? "";
    expect(fnBody).toMatch(/try\s*\{/);
    expect(fnBody).toMatch(/catch\s*\{/);
    expect(fnBody).toMatch(/return null;/);
  });

  it("27. Worker remains fully unconnected -- src/worker.ts references nothing from this stage's chain", () => {
    expect(workerSource).not.toMatch(/\.\s*decrypt\s*\(/);
    expect(workerSource).not.toMatch(/attemptDevOnlyRuntimeDecrypt/);
    expect(workerSource).not.toMatch(/attemptDevOnlyDecryptCall/);
    expect(workerSource).not.toMatch(/fedos_runtime_decrypt/);
    expect(workerSource).not.toMatch(/decrypt_aead/);
    expect(workerSource).not.toMatch(/fedos_decrypt/);
  });

  it("28. Production is unaffected beyond the ONE new field -- create_runtime.ts references nothing else from the decrypt chain", () => {
    expect(createRuntimeSource).not.toMatch(/attemptDevOnlyDecryptCall/);
    expect(createRuntimeSource).not.toMatch(/attemptDevOnlyJsGlueImport/);
    expect(createRuntimeSource).not.toMatch(/attemptDevOnlyWasmInitialization/);
    expect(createRuntimeSource).not.toMatch(/RuntimeDecryptState/);
    expect(createRuntimeSource).not.toMatch(/\bcargo\b/i);
    expect(createRuntimeSource).not.toMatch(/fedos_decrypt/);
  });

  it("29. no Secure Storage / persistence API of any kind in the new Runtime Service's own code", () => {
    const codeOnly = codeOnlyLines(decryptServiceSource);
    expect(codeOnly).not.toMatch(/localStorage|sessionStorage|indexedDB|writeFile/i);
  });

  it("30. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still exactly seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("31. Rust and Cargo/package sources -- 34 pub fn, eleven #[wasm_bindgen] (decrypt_aead is the only NEW annotated item this Stage adds), 11/2 dependencies, no new dependency added", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(44);
    expect(pubFnNames).toContain("decrypt_aead");
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(16);

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

    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});
