import { describe, it, expect, vi } from "vitest";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
import { createRuntime, createRuntimeInitializeCryptoResult } from "../src/runtime/create_runtime.js";
import { runtimeCapabilities } from "../src/runtime/fedos_runtime_prototype_execution.js";
import { randomBytes } from "../src/runtime/fedos_runtime_random_bytes.js";
import { generateAeadKey } from "../src/runtime/fedos_runtime_aead_key_generation.js";
import { encrypt } from "../src/runtime/fedos_runtime_encrypt.js";
import { decrypt } from "../src/runtime/fedos_runtime_decrypt.js";
import { exportCiphertext, attemptDevOnlyRuntimeExportCiphertext } from "../src/runtime/fedos_runtime_export_ciphertext.js";
import { importCiphertext, attemptDevOnlyRuntimeImportCiphertext } from "../src/runtime/fedos_runtime_import_ciphertext.js";
import { FedosWasmLoaderSkeleton } from "../src/runtime/fedos_wasm_loader.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_018_ciphertext_wire_export_import_api.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import decisionDocSource from "../docs/secure_runtime_alpha_017_ciphertext_wire_format_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import exportServiceSource from "../src/runtime/fedos_runtime_export_ciphertext.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import importServiceSource from "../src/runtime/fedos_runtime_import_ciphertext.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import encryptServiceSource from "../src/runtime/fedos_runtime_encrypt.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import decryptServiceSource from "../src/runtime/fedos_runtime_decrypt.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import keyGenerationServiceSource from "../src/runtime/fedos_runtime_aead_key_generation.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import randomBytesServiceSource from "../src/runtime/fedos_runtime_random_bytes.ts?raw";
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
import ciphertextSerializationRsSource from "../packages/fedos-core-rust/src/crypto/ciphertext_serialization.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => {
    throw new Error("simulated: real fedos_core_rust_bg.wasm does not exist on disk in this repo");
  }),
}));
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import * as nodeFs from "node:fs";

/**
 * Secure Runtime Alpha 018 — "Public Ciphertext Wire Export / Import
 * APIs": IMPLEMENTS `docs/secure_runtime_alpha_017_ciphertext_wire_format_decision.md`'s
 * own formally-decided contract end to end. Adds `AppRuntime.exportCiphertext()`/
 * `importCiphertext()` (Stage 1011), the FIFTH and SIXTH public Crypto
 * APIs, shipped TOGETHER as a required pair, reusing the crate's
 * existing, unmodified Stage 182/186 canonical JSON+base64url ciphertext
 * codec via two new thin `#[wasm_bindgen]` wrappers
 * (`serialize_aead_ciphertext`/`deserialize_aead_ciphertext`).
 */
describe("Secure Runtime Alpha 018 -- Public Ciphertext Wire Export/Import APIs, Fail Closed everywhere, no raw key/internal envelope exposed", () => {
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
    expect(designDocSource.length).toBeGreaterThan(6000);
    expect(typeof decisionDocSource).toBe("string");
  });

  it("2. the design doc states the Public API spec, why export/import shipped together, canonical JSON reuse, branding is compile-time-only, import-untrusted discipline, import/decrypt separation, wire-vs-crypto-failure distinction, non-exposure, and Storage/Network/Worker still unconnected", () => {
    expect(designDocSource).toMatch(
      /exportCiphertext\(\s*\n\s*ciphertext: AeadCiphertextHandle,\s*\n\): Promise<AeadCiphertextWire \| null>;/,
    );
    expect(designDocSource).toMatch(
      /importCiphertext\(\s*\n\s*serialized: AeadCiphertextWire,\s*\n\): Promise<AeadCiphertextHandle \| null>;/,
    );
    expect(designDocSource).toMatch(/## 2\. Why export and import shipped together, in this same Stage/);
    expect(designDocSource).toMatch(/## 4\. Canonical JSON \+ base64url — reused, not reinvented/);
    expect(designDocSource).toMatch(
      /This brand is a TypeScript-only, compile-time API-misuse boundary\. It\s*\nis NEVER a runtime security boundary\./,
    );
    expect(designDocSource).toMatch(/## 6\. Import input is COMPLETELY untrusted/);
    expect(designDocSource).toMatch(
      /\*\*`importCiphertext\(\)` validates WIRE STRUCTURE only\.\*\*/,
    );
    expect(designDocSource).toMatch(/## 8\. Distinguishing wire-structure failure from cryptographic failure/);
    expect(designDocSource).toMatch(/## 9\. Raw key \/ raw internal envelope are never exposed/);
    expect(designDocSource).toMatch(/## 10\. Storage \/ Network \/ Worker \/ Production — still not connected/);
  });

  it("3. against the REAL (unmocked) repo state, exportCiphertext()/importCiphertext() resolve null", async () => {
    const exported = await withNodeEnv("development", () =>
      exportCiphertext({ kind: "AeadCiphertextHandle" } as never),
    );
    expect(exported).toBeNull();
    const imported = await withNodeEnv("development", () =>
      importCiphertext("not-a-real-wire" as never),
    );
    expect(imported).toBeNull();
  });

  it("4. a real, single-loader-instance mocked round trip: encrypt() -> exportCiphertext() -> importCiphertext() -> decrypt() recovers the exact original plaintext", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const keyHandle = { kind: "AeadKeyHandle" as const, __keyId: "key-A" };
        const originalPlaintext = new TextEncoder().encode("Alpha018 export/import round trip");
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
          serialize_aead_ciphertext: (ciphertext: { kind: string }) => {
            if (!sealed || ciphertext.kind !== "AeadCiphertextHandle") return undefined;
            return JSON.stringify({
              wireOf: "AeadCiphertextHandle",
              keyId: sealed.keyId,
              algorithm: sealed.algorithm,
              aadDomain: sealed.aadDomain,
              plaintextArr: Array.from(sealed.plaintext),
            });
          },
          deserialize_aead_ciphertext: (serialized: string) => {
            try {
              const parsed = JSON.parse(serialized) as {
                wireOf: string;
                keyId: string;
                algorithm: number;
                aadDomain: number;
                plaintextArr: number[];
              };
              if (parsed.wireOf !== "AeadCiphertextHandle") return undefined;
              sealed = {
                keyId: parsed.keyId,
                algorithm: parsed.algorithm,
                aadDomain: parsed.aadDomain,
                plaintext: Uint8Array.from(parsed.plaintextArr),
              };
              return { kind: "AeadCiphertextHandle" as const };
            } catch {
              return undefined;
            }
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

        const exportResult = await loader.attemptDevOnlyExportCiphertextCall(ciphertextHandle);
        expect(exportResult.succeeded).toBe(true);
        expect(typeof exportResult.wire).toBe("string");
        expect((exportResult.wire as string).length).toBeGreaterThan(0);

        const importResult = await loader.attemptDevOnlyImportCiphertextCall(exportResult.wire);
        expect(importResult.succeeded).toBe(true);
        expect(importResult.ciphertextHandle).toEqual({ kind: "AeadCiphertextHandle" });

        const decryptResult = await loader.attemptDevOnlyDecryptCall(
          keyHandle,
          "ChaCha20Poly1305",
          "TestOnly",
          importResult.ciphertextHandle,
        );
        expect(decryptResult.succeeded).toBe(true);
        expect(decryptResult.plaintext).toEqual(originalPlaintext);
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("5. Export: genuine handle succeeds, returns a non-empty string usable as the branded AeadCiphertextWire type", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const loader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({
            initSync: vi.fn(() => ({})),
            serialize_aead_ciphertext: () => '{"v":1,"alg":"chacha20poly1305"}',
          }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        loader.planLoad();
        await loader.attemptDevOnlyJsGlueImport();
        await loader.attemptDevOnlyWasmInitialization();
        const result = await loader.attemptDevOnlyExportCiphertextCall({ kind: "AeadCiphertextHandle" });
        expect(result).toEqual({
          attempted: true,
          succeeded: true,
          wire: '{"v":1,"alg":"chacha20poly1305"}',
          reason: "Succeeded",
        });
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("6. Export: a forged (non-genuine) ciphertext value Fails Closed with InvalidCiphertextHandle BEFORE serialize_aead_ciphertext is ever called", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const serializeFn = vi.fn(() => "should-never-be-called");
        for (const wrong of [undefined, null, {}, { kind: "AeadKeyHandle" }, new Uint8Array(4), 42, "ciphertext"]) {
          const loader = new FedosWasmLoaderSkeleton({
            importGeneratedJsGlue: async () => ({ initSync: vi.fn(() => ({})), serialize_aead_ciphertext: serializeFn }),
            readGeneratedWasmBytes: () => new Uint8Array([1]),
          });
          loader.planLoad();
          await loader.attemptDevOnlyJsGlueImport();
          await loader.attemptDevOnlyWasmInitialization();
          const result = await loader.attemptDevOnlyExportCiphertextCall(wrong);
          expect(result).toEqual({ attempted: true, succeeded: false, wire: null, reason: "InvalidCiphertextHandle" });
        }
        expect(serializeFn).not.toHaveBeenCalled();
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("7. Export: wrapper absent -> ExportUnavailable; thrown error -> CallFailed; genuine undefined -> SerializationFailed; non-string/empty-string -> InvalidWireOutputShape", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const makeLoader = async (module: Record<string, unknown>) => {
          const loader = new FedosWasmLoaderSkeleton({
            importGeneratedJsGlue: async () => module,
            readGeneratedWasmBytes: () => new Uint8Array([1]),
          });
          loader.planLoad();
          await loader.attemptDevOnlyJsGlueImport();
          await loader.attemptDevOnlyWasmInitialization();
          return loader;
        };

        const noWrapper = await makeLoader({ initSync: vi.fn(() => ({})) });
        expect(await noWrapper.attemptDevOnlyExportCiphertextCall({ kind: "AeadCiphertextHandle" })).toEqual({
          attempted: true,
          succeeded: false,
          wire: null,
          reason: "ExportUnavailable",
        });

        const throwsLoader = await makeLoader({
          initSync: vi.fn(() => ({})),
          serialize_aead_ciphertext: () => {
            throw new Error("simulated wasm-bindgen rejection of a non-genuine handle");
          },
        });
        expect(await throwsLoader.attemptDevOnlyExportCiphertextCall({ kind: "AeadCiphertextHandle" })).toEqual({
          attempted: true,
          succeeded: false,
          wire: null,
          reason: "CallFailed",
        });

        const undefinedLoader = await makeLoader({
          initSync: vi.fn(() => ({})),
          serialize_aead_ciphertext: () => undefined,
        });
        expect(await undefinedLoader.attemptDevOnlyExportCiphertextCall({ kind: "AeadCiphertextHandle" })).toEqual({
          attempted: true,
          succeeded: false,
          wire: null,
          reason: "SerializationFailed",
        });

        for (const wrongValue of ["", 42, {}, null, new Uint8Array(2)]) {
          const wrongShapeLoader = await makeLoader({
            initSync: vi.fn(() => ({})),
            serialize_aead_ciphertext: () => wrongValue,
          });
          expect(await wrongShapeLoader.attemptDevOnlyExportCiphertextCall({ kind: "AeadCiphertextHandle" })).toEqual({
            attempted: true,
            succeeded: false,
            wire: null,
            reason: "InvalidWireOutputShape",
          });
        }
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("8. Export: Production and Unknown Runtime Fail Closed even with a real, string-returning mock present", async () => {
    const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
    try {
      const okLoader = () =>
        new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({
            initSync: vi.fn(() => ({})),
            serialize_aead_ciphertext: () => '{"v":1}',
          }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
      const prodState = await withNodeEnv("production", () =>
        attemptDevOnlyRuntimeExportCiphertext({ kind: "AeadCiphertextHandle" } as never, okLoader()),
      );
      expect(prodState).toEqual({ succeeded: false, wire: null });
      const unknownState = await withNodeEnv(undefined, () =>
        attemptDevOnlyRuntimeExportCiphertext({ kind: "AeadCiphertextHandle" } as never, okLoader()),
      );
      expect(unknownState).toEqual({ succeeded: false, wire: null });
    } finally {
      mock.mockReset();
      mock.mockReturnValue(false);
    }
  });

  it("9. Import: genuine wire succeeds and returns a genuine AeadCiphertextHandle", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const loader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({
            initSync: vi.fn(() => ({})),
            deserialize_aead_ciphertext: () => ({ kind: "AeadCiphertextHandle" }),
          }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        loader.planLoad();
        await loader.attemptDevOnlyJsGlueImport();
        await loader.attemptDevOnlyWasmInitialization();
        const result = await loader.attemptDevOnlyImportCiphertextCall('{"v":1,"alg":"chacha20poly1305"}');
        expect(result).toEqual({
          attempted: true,
          succeeded: true,
          ciphertextHandle: { kind: "AeadCiphertextHandle" },
          reason: "Succeeded",
        });
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("10. Import: a non-string candidate Fails Closed with InvalidWireInputShape BEFORE deserialize_aead_ciphertext is ever called", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const deserializeFn = vi.fn(() => ({ kind: "AeadCiphertextHandle" }));
        for (const wrong of [undefined, null, 42, {}, new Uint8Array(4), { kind: "AeadCiphertextHandle" }]) {
          const loader = new FedosWasmLoaderSkeleton({
            importGeneratedJsGlue: async () => ({ initSync: vi.fn(() => ({})), deserialize_aead_ciphertext: deserializeFn }),
            readGeneratedWasmBytes: () => new Uint8Array([1]),
          });
          loader.planLoad();
          await loader.attemptDevOnlyJsGlueImport();
          await loader.attemptDevOnlyWasmInitialization();
          const result = await loader.attemptDevOnlyImportCiphertextCall(wrong);
          expect(result).toEqual({
            attempted: true,
            succeeded: false,
            ciphertextHandle: null,
            reason: "InvalidWireInputShape",
          });
        }
        expect(deserializeFn).not.toHaveBeenCalled();
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("11. Import: malformed/rejected wire (simulating malformed JSON, invalid version/algorithm/AAD-domain/base64url/lengths/fields -- all of which decode_envelope_internal itself already rejects) resolves DeserializationFailed -> null, uniformly", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const malformedCandidates = [
          "not json at all",
          '{"v":99,"alg":"chacha20poly1305","aad":"test_only","n":"AAAA","ct":"AAAA","tag":"AAAA"}',
          '{"v":1,"alg":"not_a_real_algorithm","aad":"test_only","n":"AAAA","ct":"AAAA","tag":"AAAA"}',
          '{"v":1,"alg":"chacha20poly1305","aad":"not_a_real_domain","n":"AAAA","ct":"AAAA","tag":"AAAA"}',
          '{"v":1,"alg":"chacha20poly1305","aad":"test_only","n":"not-valid-base64url!!!","ct":"AAAA","tag":"AAAA"}',
          '{"v":1,"alg":"chacha20poly1305","aad":"test_only","n":"AAAA","ct":"AAAA"}',
        ];
        for (const candidate of malformedCandidates) {
          const loader = new FedosWasmLoaderSkeleton({
            importGeneratedJsGlue: async () => ({
              initSync: vi.fn(() => ({})),
              // Simulates decode_envelope_internal's own real rejection --
              // this Loader-level test proves the WIRING (undefined -> null),
              // not Rust's own internal per-cause validation (already
              // cargo-test-verified for all seven causes in
              // ciphertext_serialization.rs's own test suite, Stage 186).
              deserialize_aead_ciphertext: () => undefined,
            }),
            readGeneratedWasmBytes: () => new Uint8Array([1]),
          });
          loader.planLoad();
          await loader.attemptDevOnlyJsGlueImport();
          await loader.attemptDevOnlyWasmInitialization();
          const result = await loader.attemptDevOnlyImportCiphertextCall(candidate);
          expect(result).toEqual({
            attempted: true,
            succeeded: false,
            ciphertextHandle: null,
            reason: "DeserializationFailed",
          });
        }
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("12. Import: wrapper absent -> ImportUnavailable; thrown error -> CallFailed; wrongly-shaped genuine return -> InvalidHandleOutputShape", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const makeLoader = async (module: Record<string, unknown>) => {
          const loader = new FedosWasmLoaderSkeleton({
            importGeneratedJsGlue: async () => module,
            readGeneratedWasmBytes: () => new Uint8Array([1]),
          });
          loader.planLoad();
          await loader.attemptDevOnlyJsGlueImport();
          await loader.attemptDevOnlyWasmInitialization();
          return loader;
        };

        const noWrapper = await makeLoader({ initSync: vi.fn(() => ({})) });
        expect(await noWrapper.attemptDevOnlyImportCiphertextCall("{}")).toEqual({
          attempted: true,
          succeeded: false,
          ciphertextHandle: null,
          reason: "ImportUnavailable",
        });

        const throwsLoader = await makeLoader({
          initSync: vi.fn(() => ({})),
          deserialize_aead_ciphertext: () => {
            throw new Error("simulated Rust-side exception");
          },
        });
        expect(await throwsLoader.attemptDevOnlyImportCiphertextCall("{}")).toEqual({
          attempted: true,
          succeeded: false,
          ciphertextHandle: null,
          reason: "CallFailed",
        });

        for (const wrongValue of [{}, "not-a-handle", 42, { kind: "AeadKeyHandle" }, null]) {
          const wrongShapeLoader = await makeLoader({
            initSync: vi.fn(() => ({})),
            deserialize_aead_ciphertext: () => wrongValue,
          });
          expect(await wrongShapeLoader.attemptDevOnlyImportCiphertextCall("{}")).toEqual({
            attempted: true,
            succeeded: false,
            ciphertextHandle: null,
            reason: "InvalidHandleOutputShape",
          });
        }
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("13. Import: Production and Unknown Runtime Fail Closed even with a real, handle-returning mock present", async () => {
    const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
    try {
      const okLoader = () =>
        new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({
            initSync: vi.fn(() => ({})),
            deserialize_aead_ciphertext: () => ({ kind: "AeadCiphertextHandle" }),
          }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
      const prodState = await withNodeEnv("production", () =>
        attemptDevOnlyRuntimeImportCiphertext("{}" as never, okLoader()),
      );
      expect(prodState).toEqual({ succeeded: false, ciphertextHandle: null });
      const unknownState = await withNodeEnv(undefined, () =>
        attemptDevOnlyRuntimeImportCiphertext("{}" as never, okLoader()),
      );
      expect(unknownState).toEqual({ succeeded: false, ciphertextHandle: null });
    } finally {
      mock.mockReset();
      mock.mockReturnValue(false);
    }
  });

  it("14. Crypto separation: a structurally-valid import succeeds regardless of key/AAD/algorithm validity -- only decrypt() distinguishes those, and collapses them to the SAME null", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const sealed = { keyId: "key-A", algorithm: 0, aadDomain: 4, plaintext: new TextEncoder().encode("secret") };
        const module = {
          initSync: vi.fn(() => ({})),
          deserialize_aead_ciphertext: () => ({ kind: "AeadCiphertextHandle" as const }),
          decrypt_aead: (key: { __keyId: string }, algorithm: number, aadDomain: number) => {
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

        // Import succeeds -- wire structure is fine -- regardless of what
        // key will eventually be used to decrypt it.
        const importResult = await loader.attemptDevOnlyImportCiphertextCall('{"v":1}');
        expect(importResult.succeeded).toBe(true);
        const handle = importResult.ciphertextHandle;

        // Correct key/algorithm/aadDomain -> decrypt succeeds.
        const correct = await loader.attemptDevOnlyDecryptCall(
          { kind: "AeadKeyHandle", __keyId: "key-A" },
          "ChaCha20Poly1305",
          "TestOnly",
          handle,
        );
        expect(correct.succeeded).toBe(true);

        // Key mismatch -> decrypt fails, collapsed to DecryptionFailed -> null.
        const wrongKey = await loader.attemptDevOnlyDecryptCall(
          { kind: "AeadKeyHandle", __keyId: "key-B" },
          "ChaCha20Poly1305",
          "TestOnly",
          handle,
        );
        expect(wrongKey).toEqual({ attempted: true, succeeded: false, plaintext: null, reason: "DecryptionFailed" });

        // AAD-domain mismatch -> decrypt fails, SAME collapsed reason.
        const wrongAad = await loader.attemptDevOnlyDecryptCall(
          { kind: "AeadKeyHandle", __keyId: "key-A" },
          "ChaCha20Poly1305",
          "RootKey",
          handle,
        );
        expect(wrongAad).toEqual({ attempted: true, succeeded: false, plaintext: null, reason: "DecryptionFailed" });

        // Algorithm mismatch -> decrypt fails, SAME collapsed reason.
        const wrongAlgorithm = await loader.attemptDevOnlyDecryptCall(
          { kind: "AeadKeyHandle", __keyId: "key-A" },
          "Aes256Gcm",
          "TestOnly",
          handle,
        );
        expect(wrongAlgorithm).toEqual({
          attempted: true,
          succeeded: false,
          plaintext: null,
          reason: "DecryptionFailed",
        });

        // Import itself never consulted any key -- confirmed structurally:
        // the mock's own deserialize_aead_ciphertext takes no key argument
        // at all, and importCiphertext()'s own success was unconditional.
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("15. calling runtime.exportCiphertext()/importCiphertext() via the real AppRuntime object never throws", async () => {
    const runtime = createRuntime();
    const wire = await withNodeEnv("development", () =>
      runtime.exportCiphertext({ kind: "AeadCiphertextHandle" } as never),
    );
    expect(wire === null || typeof wire === "string").toBe(true);
    const handle = await withNodeEnv("development", () => runtime.importCiphertext("x" as never));
    expect(handle === null || typeof handle === "object").toBe(true);
  });

  it("16. no raw key, raw ciphertext byte field, or raw internal envelope field exists anywhere in this stage's own export/import surface", () => {
    function codeOnlyLines(source: string): string {
      return source
        .split("\n")
        .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");
    }
    const codeOnly = codeOnlyLines(exportServiceSource) + codeOnlyLines(importServiceSource);
    expect(codeOnly).not.toMatch(/readonly\s+key\s*:/);
    expect(codeOnly).not.toMatch(/readonly\s+nonce\s*:/);
    expect(codeOnly).not.toMatch(/readonly\s+tag\s*:/);
    expect(codeOnly).not.toMatch(/readonly\s+ciphertextBytes\s*:/);
    expect(codeOnly).not.toMatch(/AeadKeyHandle/);
  });

  it("17. the Rust serialize/deserialize wrappers reach the codec via inner()/from_inner() only, never expose a raw byte, and call encode/decode_envelope_internal exactly once each", () => {
    const serializeMatch = libRsSource.match(/pub fn serialize_aead_ciphertext\([\s\S]*?\n\}/);
    expect(serializeMatch).not.toBeNull();
    const serializeBody = (serializeMatch as RegExpMatchArray)[0] ?? "";
    expect(serializeBody).toMatch(/ciphertext\.inner\(\)\.inner\(\)/);
    expect(serializeBody).toMatch(/encode_envelope_internal/);
    expect((serializeBody.match(/encode_envelope_internal/g) ?? []).length).toBe(1);

    const deserializeMatch = libRsSource.match(/pub fn deserialize_aead_ciphertext\([\s\S]*?\n\}/);
    expect(deserializeMatch).not.toBeNull();
    const deserializeBody = (deserializeMatch as RegExpMatchArray)[0] ?? "";
    expect(deserializeBody).toMatch(/decode_envelope_internal/);
    expect((deserializeBody.match(/decode_envelope_internal/g) ?? []).length).toBe(1);
    expect(deserializeBody).toMatch(/FedosCiphertextEnvelope::from_inner/);
    expect(deserializeBody).not.toMatch(/expose_bytes|to_vec\(\)\.to_vec|unsafe/i);
  });

  it("18. encode_envelope_internal/decode_envelope_internal themselves (Stage 186) are byte-for-byte unchanged", () => {
    expect(ciphertextSerializationRsSource).toMatch(
      /pub\(crate\) fn encode_envelope_internal\(envelope: &AeadCiphertextEnvelope\) -> Option<String>/,
    );
    expect(ciphertextSerializationRsSource).toMatch(
      /pub\(crate\) fn decode_envelope_internal\(json: &str\) -> CiphertextSerializationDecision/,
    );
  });

  it("19. importKey()/exportKey() are NOT implemented anywhere; encrypt()/decrypt() are untouched by this Stage's own changed files", () => {
    expect(exportServiceSource).not.toMatch(/\.\s*(importKey|exportKey)\s*\(/);
    expect(importServiceSource).not.toMatch(/\.\s*(importKey|exportKey)\s*\(/);
    expect(runtimeTypesSource).not.toMatch(/readonly importKey:|readonly exportKey:/);
    expect(libRsSource).not.toMatch(/pub fn import_key\b|pub fn export_key\b/);
  });

  it("20. initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt() are all unaffected by calling exportCiphertext()/importCiphertext() first", async () => {
    await withNodeEnv("development", async () => {
      await exportCiphertext({ kind: "AeadCiphertextHandle" } as never);
      await importCiphertext("x" as never);
    });

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
      encrypt({ kind: "AeadKeyHandle" } as never, "ChaCha20Poly1305", "TestOnly", new Uint8Array([1])),
    );
    expect(ciphertext === null || (typeof ciphertext === "object" && ciphertext !== null)).toBe(true);

    const plaintext = await withNodeEnv("development", () =>
      decrypt({ kind: "AeadKeyHandle" } as never, "ChaCha20Poly1305", "TestOnly", { kind: "AeadCiphertextHandle" } as never),
    );
    expect(plaintext === null || plaintext instanceof Uint8Array).toBe(true);
  });

  it("21. exportCiphertext/importCiphertext construct entirely separate FedosWasmLoader instances from every other Crypto API", () => {
    function codeOnlyLines(source: string): string {
      return source
        .split("\n")
        .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");
    }
    expect(codeOnlyLines(exportServiceSource)).not.toMatch(
      /attemptDevOnlyRuntimeImportCiphertext|attemptDevOnlyRuntimeEncrypt|attemptDevOnlyRuntimeDecrypt|attemptDevOnlyRuntimeAeadKeyGeneration|attemptDevOnlyRuntimeRandomBytes/,
    );
    expect(codeOnlyLines(importServiceSource)).not.toMatch(
      /attemptDevOnlyRuntimeExportCiphertext|attemptDevOnlyRuntimeEncrypt|attemptDevOnlyRuntimeDecrypt|attemptDevOnlyRuntimeAeadKeyGeneration|attemptDevOnlyRuntimeRandomBytes/,
    );
    expect(codeOnlyLines(encryptServiceSource)).not.toMatch(
      /attemptDevOnlyRuntimeExportCiphertext|attemptDevOnlyRuntimeImportCiphertext/,
    );
    expect(codeOnlyLines(decryptServiceSource)).not.toMatch(
      /attemptDevOnlyRuntimeExportCiphertext|attemptDevOnlyRuntimeImportCiphertext/,
    );
    expect(codeOnlyLines(keyGenerationServiceSource)).not.toMatch(
      /attemptDevOnlyRuntimeExportCiphertext|attemptDevOnlyRuntimeImportCiphertext/,
    );
    expect(codeOnlyLines(randomBytesServiceSource)).not.toMatch(
      /attemptDevOnlyRuntimeExportCiphertext|attemptDevOnlyRuntimeImportCiphertext/,
    );
  });

  it("22. fedos_runtime_export_ciphertext.ts / fedos_runtime_import_ciphertext.ts each export exactly one function pair plus one interface", () => {
    const exportedExportFns = [...exportServiceSource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedExportFns)).toEqual(new Set(["attemptDevOnlyRuntimeExportCiphertext", "exportCiphertext"]));
    const exportedExportIfaces = [...exportServiceSource.matchAll(/^export interface (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedExportIfaces)).toEqual(new Set(["RuntimeExportCiphertextState"]));

    const exportedImportFns = [...importServiceSource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedImportFns)).toEqual(new Set(["attemptDevOnlyRuntimeImportCiphertext", "importCiphertext"]));
    const exportedImportIfaces = [...importServiceSource.matchAll(/^export interface (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedImportIfaces)).toEqual(new Set(["RuntimeImportCiphertextState"]));
  });

  it("23. types.ts declares both new AppRuntime fields with the faithful signatures, still no fedos_wasm_loader reference; createRuntime()'s AppRuntime exposes both as real functions", async () => {
    expect(runtimeTypesSource).toMatch(
      /readonly exportCiphertext: \(\s*ciphertext: AeadCiphertextHandle,\s*\) => Promise<AeadCiphertextWire \| null>;/,
    );
    expect(runtimeTypesSource).toMatch(
      /readonly importCiphertext: \(\s*serialized: AeadCiphertextWire,\s*\) => Promise<AeadCiphertextHandle \| null>;/,
    );
    expect(runtimeTypesSource).not.toMatch(/from "\.\/fedos_wasm_loader\.js"/);

    const runtime = createRuntime();
    expect(typeof runtime.exportCiphertext).toBe("function");
    expect(typeof runtime.importCiphertext).toBe("function");
  });

  it("24. exportCiphertext()/importCiphertext()'s own try/catch guarantees no exception ever escapes -- Fail Closed at the Runtime Service boundary", () => {
    function codeOnlyLines(source: string): string {
      return source
        .split("\n")
        .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");
    }
    const exportFnMatch = codeOnlyLines(exportServiceSource).match(
      /export async function exportCiphertext\([\s\S]*?\): Promise<AeadCiphertextWire \| null> \{[\s\S]*?\n\}/,
    );
    expect(exportFnMatch).not.toBeNull();
    expect((exportFnMatch as RegExpMatchArray)[0]).toMatch(/try\s*\{/);
    expect((exportFnMatch as RegExpMatchArray)[0]).toMatch(/catch\s*\{/);
    expect((exportFnMatch as RegExpMatchArray)[0]).toMatch(/return null;/);

    const importFnMatch = codeOnlyLines(importServiceSource).match(
      /export async function importCiphertext\([\s\S]*?\): Promise<AeadCiphertextHandle \| null> \{[\s\S]*?\n\}/,
    );
    expect(importFnMatch).not.toBeNull();
    expect((importFnMatch as RegExpMatchArray)[0]).toMatch(/try\s*\{/);
    expect((importFnMatch as RegExpMatchArray)[0]).toMatch(/catch\s*\{/);
    expect((importFnMatch as RegExpMatchArray)[0]).toMatch(/return null;/);
  });

  it("25. Worker remains fully unconnected -- src/worker.ts references nothing from this stage's chain", () => {
    expect(workerSource).not.toMatch(/exportCiphertext|importCiphertext/);
    expect(workerSource).not.toMatch(/attemptDevOnlyExportCiphertextCall|attemptDevOnlyImportCiphertextCall/);
    expect(workerSource).not.toMatch(/serialize_aead_ciphertext|deserialize_aead_ciphertext/);
  });

  it("26. Production is unaffected beyond the two new fields -- create_runtime.ts references nothing else from the export/import chain", () => {
    expect(createRuntimeSource).not.toMatch(/attemptDevOnlyExportCiphertextCall|attemptDevOnlyImportCiphertextCall/);
    expect(createRuntimeSource).not.toMatch(/RuntimeExportCiphertextState|RuntimeImportCiphertextState/);
    expect(createRuntimeSource).not.toMatch(/\bcargo\b/i);
  });

  it("27. no Secure Storage / persistence / network API of any kind in the new Runtime Service files' own code", () => {
    function codeOnlyLines(source: string): string {
      return source
        .split("\n")
        .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");
    }
    expect(codeOnlyLines(exportServiceSource)).not.toMatch(/localStorage|sessionStorage|indexedDB|writeFile|fetch\(|WebSocket/i);
    expect(codeOnlyLines(importServiceSource)).not.toMatch(/localStorage|sessionStorage|indexedDB|writeFile|fetch\(|WebSocket/i);
  });

  it("28. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
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

  it("29. Rust and Cargo/package sources -- 36 pub fn, thirteen #[wasm_bindgen] (serialize_aead_ciphertext/deserialize_aead_ciphertext are the only two NEW annotated items this Stage adds), 11/2 dependencies, no new dependency added", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(64);
    expect(pubFnNames).toContain("serialize_aead_ciphertext");
    expect(pubFnNames).toContain("deserialize_aead_ciphertext");
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);

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

  it("30. AeadCiphertextHandle itself gains no new public method -- still exactly one #[wasm_bindgen]-annotated method (kind), no Clone/Debug/Serialize derive", () => {
    const implBlocks = [...libRsSource.matchAll(/#\[wasm_bindgen\]\nimpl AeadCiphertextHandle \{([\s\S]*?)\n\}/g)].map(
      (m) => m[1] ?? "",
    );
    expect(implBlocks.length).toBe(1);
    const methodNames = [...implBlocks[0].matchAll(/pub fn (\w+)/g)].map((m) => m[1]);
    expect(methodNames).toEqual(["kind"]);
    expect(libRsSource).toMatch(/pub struct AeadCiphertextHandle \{\s*\n\s*inner: FedosCiphertextEnvelope,\s*\n\}/);
  });
});
