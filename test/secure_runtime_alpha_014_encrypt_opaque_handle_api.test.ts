import { describe, it, expect, vi } from "vitest";
// This project's tsconfig.json carries no `@types/node`; declared
// ambient here the same way `fedos_runtime_prototype_execution.ts` itself does.
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
import { createRuntime, createRuntimeInitializeCryptoResult } from "../src/runtime/create_runtime.js";
import { runtimeCapabilities } from "../src/runtime/fedos_runtime_prototype_execution.js";
import { randomBytes } from "../src/runtime/fedos_runtime_random_bytes.js";
import { generateAeadKey } from "../src/runtime/fedos_runtime_aead_key_generation.js";
import { encrypt, attemptDevOnlyRuntimeEncrypt } from "../src/runtime/fedos_runtime_encrypt.js";
import { FedosWasmLoaderSkeleton } from "../src/runtime/fedos_wasm_loader.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_014_encrypt_opaque_handle_api.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import keyBoundaryDecisionDocSource from "../docs/secure_runtime_alpha_012_key_boundary_decision.md?raw";
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
 * Secure Runtime Alpha 014 — "Public Runtime encrypt() API (Opaque
 * Handle Edition)": adds `AppRuntime.encrypt()` (Stage 1009), the THIRD
 * public Crypto API wired into `AppRuntime`, and the FIRST performing a
 * real cryptographic operation. Built directly against Alpha 013's
 * opaque `AeadKeyHandle` -- `encrypt()` accepts ONLY an opaque handle,
 * never raw bytes, and returns an opaque `AeadCiphertextHandle`, never
 * raw ciphertext bytes. `decrypt()`/`importKey()`/`exportKey()` remain
 * unimplemented. `initializeCrypto()`/`runtimeCapabilities()`/
 * `randomBytes()`/`generateAeadKey()` stay byte-for-byte unchanged.
 */
describe("Secure Runtime Alpha 014 -- encrypt() Public Runtime API (Opaque Handle Edition), Fail Closed everywhere, no raw key/ciphertext material exposed", () => {
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
    expect(typeof keyBoundaryDecisionDocSource).toBe("string");
  });

  it("2. the design doc states encrypt() accepts ONLY an opaque handle, names the Opaque Ciphertext Handle reasoning, and confirms decrypt()/importKey()/exportKey() remain unimplemented", () => {
    expect(designDocSource).toMatch(/accepts ONLY an\s*\n?opaque handle, never a raw `Uint8Array` key/);
    expect(designDocSource).toMatch(/Why an Opaque Ciphertext Handle, not raw bytes\./);
    expect(designDocSource).toMatch(/`decrypt\(\)`\/`importKey\(\)`\/\s*\n?`exportKey\(\)` remain unimplemented/);
    expect(designDocSource).toMatch(/Fail Closed/);
  });

  it("3. against the REAL (unmocked) repo state, encrypt() resolves null (no locally-generated JS glue committed)", async () => {
    const key = await withNodeEnv("development", () => generateAeadKey());
    expect(key).toBeNull();
    const ciphertext = await withNodeEnv("development", () =>
      encrypt({ kind: "AeadKeyHandle" }, "ChaCha20Poly1305", "TestOnly", new Uint8Array([1, 2, 3])),
    );
    expect(ciphertext).toBeNull();
  });

  it("4. encrypt() succeeds end-to-end with a real, opaque-handle-returning module.encrypt_aead() (injected loader)", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const okKeyHandle = { kind: "AeadKeyHandle" as const };
        const okCiphertextHandle = { kind: "AeadCiphertextHandle" as const };
        const okLoader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({
            initSync: vi.fn(() => ({})),
            encrypt_aead: (
              key: unknown,
              algorithm: number,
              aadDomain: number,
              plaintext: Uint8Array,
            ) => {
              expect(key).toBe(okKeyHandle);
              expect(algorithm).toBe(0);
              expect(aadDomain).toBe(4);
              expect(plaintext).toBeInstanceOf(Uint8Array);
              return okCiphertextHandle;
            },
          }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        const state = await attemptDevOnlyRuntimeEncrypt(
          okKeyHandle,
          "ChaCha20Poly1305",
          "TestOnly",
          new Uint8Array([9, 9, 9]),
          okLoader,
        );
        expect(state.succeeded).toBe(true);
        expect(state.ciphertextHandle).toEqual(okCiphertextHandle);
        expect(state.ciphertextHandle).not.toBeInstanceOf(Uint8Array);
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("5. Production and Unknown Runtime Fail Closed even with a real, handle-returning mock present", async () => {
    const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
    try {
      const okLoader = () =>
        new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({
            initSync: vi.fn(() => ({})),
            encrypt_aead: () => ({ kind: "AeadCiphertextHandle" }),
          }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
      const key = { kind: "AeadKeyHandle" as const };
      const prodState = await withNodeEnv("production", () =>
        attemptDevOnlyRuntimeEncrypt(key, "Aes256Gcm", "RootKey", new Uint8Array([1]), okLoader()),
      );
      expect(prodState).toEqual({ succeeded: false, ciphertextHandle: null });

      const unknownState = await withNodeEnv(undefined, () =>
        attemptDevOnlyRuntimeEncrypt(key, "Aes256Gcm", "RootKey", new Uint8Array([1]), okLoader()),
      );
      expect(unknownState).toEqual({ succeeded: false, ciphertextHandle: null });
    } finally {
      mock.mockReset();
      mock.mockReturnValue(false);
    }
  });

  it("6. FedosWasmLoaderSkeleton.attemptDevOnlyEncryptCall() Fails Closed with PrototypeStillClosed before planLoad() has ever run", async () => {
    const loader = new FedosWasmLoaderSkeleton();
    const result = await loader.attemptDevOnlyEncryptCall(
      { kind: "AeadKeyHandle" },
      "ChaCha20Poly1305",
      "RootKey",
      new Uint8Array([1]),
    );
    expect(result).toEqual({
      attempted: false,
      succeeded: false,
      ciphertextHandle: null,
      reason: "PrototypeStillClosed",
    });
  });

  it("7. an invalid key handle Fails Closed with InvalidKeyHandle BEFORE encrypt_aead is ever called, even when the export exists and is valid", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const encryptAead = vi.fn(() => ({ kind: "AeadCiphertextHandle" }));
        for (const wrongKey of [undefined, null, {}, { kind: "SomethingElse" }, new Uint8Array(32), 42, "key"]) {
          const loader = new FedosWasmLoaderSkeleton({
            importGeneratedJsGlue: async () => ({
              initSync: vi.fn(() => ({})),
              encrypt_aead: encryptAead,
            }),
            readGeneratedWasmBytes: () => new Uint8Array([1]),
          });
          loader.planLoad();
          await loader.attemptDevOnlyJsGlueImport();
          await loader.attemptDevOnlyWasmInitialization();
          const result = await loader.attemptDevOnlyEncryptCall(
            wrongKey,
            "ChaCha20Poly1305",
            "RootKey",
            new Uint8Array([1]),
          );
          expect(result).toEqual({
            attempted: true,
            succeeded: false,
            ciphertextHandle: null,
            reason: "InvalidKeyHandle",
          });
        }
        expect(encryptAead).not.toHaveBeenCalled();
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("8. wrapper not present Fails Closed with EncryptUnavailable, no throw", async () => {
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
        const result = await loader.attemptDevOnlyEncryptCall(
          { kind: "AeadKeyHandle" },
          "ChaCha20Poly1305",
          "RootKey",
          new Uint8Array([1]),
        );
        expect(result).toEqual({
          attempted: true,
          succeeded: false,
          ciphertextHandle: null,
          reason: "EncryptUnavailable",
        });
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("9. a thrown Rust-side error Fails Closed with CallFailed, never escapes", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const loader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({
            initSync: vi.fn(() => ({})),
            encrypt_aead: () => {
              throw new Error("simulated encryption failure");
            },
          }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        loader.planLoad();
        await loader.attemptDevOnlyJsGlueImport();
        await loader.attemptDevOnlyWasmInitialization();
        const result = await loader.attemptDevOnlyEncryptCall(
          { kind: "AeadKeyHandle" },
          "ChaCha20Poly1305",
          "RootKey",
          new Uint8Array([1]),
        );
        expect(result).toEqual({
          attempted: true,
          succeeded: false,
          ciphertextHandle: null,
          reason: "CallFailed",
        });
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("10. a genuine undefined return (Rust's own encryption decline) Fails Closed with EncryptionFailed, distinct from CallFailed", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const loader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({
            initSync: vi.fn(() => ({})),
            encrypt_aead: () => undefined,
          }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        loader.planLoad();
        await loader.attemptDevOnlyJsGlueImport();
        await loader.attemptDevOnlyWasmInitialization();
        const result = await loader.attemptDevOnlyEncryptCall(
          { kind: "AeadKeyHandle" },
          "ChaCha20Poly1305",
          "RootKey",
          new Uint8Array([1]),
        );
        expect(result).toEqual({
          attempted: true,
          succeeded: false,
          ciphertextHandle: null,
          reason: "EncryptionFailed",
        });
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("11. a genuine but WRONGLY-shaped return Fails Closed with InvalidCiphertextShape -- distinct from EncryptionFailed and CallFailed", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        for (const wrongValue of [new Uint8Array(16), {}, { kind: "AeadKeyHandle" }, 42, "ciphertext", null]) {
          const loader = new FedosWasmLoaderSkeleton({
            importGeneratedJsGlue: async () => ({
              initSync: vi.fn(() => ({})),
              encrypt_aead: () => wrongValue,
            }),
            readGeneratedWasmBytes: () => new Uint8Array([1]),
          });
          loader.planLoad();
          await loader.attemptDevOnlyJsGlueImport();
          await loader.attemptDevOnlyWasmInitialization();
          const result = await loader.attemptDevOnlyEncryptCall(
            { kind: "AeadKeyHandle" },
            "ChaCha20Poly1305",
            "RootKey",
            new Uint8Array([1]),
          );
          expect(result).toEqual({
            attempted: true,
            succeeded: false,
            ciphertextHandle: null,
            reason: "InvalidCiphertextShape",
          });
        }
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("12. calling runtime.encrypt() via the real AppRuntime object never throws and never resolves raw bytes", async () => {
    const runtime = createRuntime();
    const ciphertext = await withNodeEnv("development", () =>
      runtime.encrypt({ kind: "AeadKeyHandle" }, "ChaCha20Poly1305", "TestOnly", new Uint8Array([1, 2, 3])),
    );
    expect(
      ciphertext === null || (typeof ciphertext === "object" && ciphertext !== null),
    ).toBe(true);
    expect(ciphertext).not.toBeInstanceOf(Uint8Array);
  });

  it("13. no raw key/ciphertext byte, .bytes, .key, .material, .ciphertext, .nonce, exportKey-shaped method, toJSON, or leaking toString exists anywhere in this stage's own AeadCiphertextHandle surface", () => {
    const ifaceMatch = wasmLoaderSource.match(/export interface AeadCiphertextHandle \{[\s\S]*?\n\}/);
    const executionIfaceMatch = wasmLoaderSource.match(
      /export interface FedosWasmLoaderEncryptExecution \{[\s\S]*?\n\}/,
    );
    expect(ifaceMatch).not.toBeNull();
    expect(executionIfaceMatch).not.toBeNull();
    const codeOnly =
      codeOnlyLines(encryptServiceSource) +
      codeOnlyLines((ifaceMatch as RegExpMatchArray)[0]) +
      codeOnlyLines((executionIfaceMatch as RegExpMatchArray)[0]);
    expect(codeOnly).not.toMatch(/\.bytes\b/);
    expect(codeOnly).not.toMatch(/readonly\s+bytes\s*:/);
    expect(codeOnly).not.toMatch(/readonly\s+ciphertext\s*:/);
    expect(codeOnly).not.toMatch(/readonly\s+nonce\s*:/);
    expect(codeOnly).not.toMatch(/readonly\s+material\s*:/);
    expect(codeOnly).not.toMatch(/exportKey/i);
    expect(codeOnly).not.toMatch(/toJSON/);
    expect(codeOnly).not.toMatch(/\.toString\s*\(\s*\)/);
  });

  it("14. the AeadCiphertextHandle TypeScript interface declares exactly one field, kind, and nothing else", () => {
    const ifaceMatch = wasmLoaderSource.match(/export interface AeadCiphertextHandle \{([\s\S]*?)\n\}/);
    expect(ifaceMatch).not.toBeNull();
    const body = (ifaceMatch as RegExpMatchArray)[1] ?? "";
    const fields = [...body.matchAll(/readonly\s+([a-zA-Z0-9_]+)\s*:/g)].map((m) => m[1]);
    expect(fields).toEqual(["kind"]);
  });

  it("15. the Rust AeadCiphertextHandle opaque class derives nothing, exposes exactly one method (kind), and has no public constructor or raw-byte getter", () => {
    const structMatch = libRsSource.match(/pub struct AeadCiphertextHandle \{[\s\S]*?\n\}/);
    expect(structMatch).not.toBeNull();
    expect((structMatch as RegExpMatchArray)[0]).not.toMatch(/#\[derive/);

    const implMatch = libRsSource.match(/impl AeadCiphertextHandle \{([\s\S]*?)\n\}/);
    expect(implMatch).not.toBeNull();
    const implBody = (implMatch as RegExpMatchArray)[1] ?? "";
    const methodNames = [...implBody.matchAll(/\bfn\s+([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
    expect(methodNames).toEqual(["kind"]);
    expect(implBody).not.toMatch(/fn\s+new\b/);
    expect(implBody).not.toMatch(/as_bytes|to_vec|expose|serialize|to_bytes/i);
    expect(libRsSource).not.toMatch(/impl AsRef<\[u8\]> for AeadCiphertextHandle/);
  });

  it("16. encrypt_aead() is a thin wrapper -- calls fedos_encrypt() exactly once, never reads a raw byte out of key or the envelope, no new algorithm/nonce policy, no unsafe", () => {
    const fnMatch = libRsSource.match(
      /pub fn encrypt_aead\(\s*key: &AeadKeyHandle,[\s\S]*?\n\}/,
    );
    expect(fnMatch).not.toBeNull();
    const fnBody = (fnMatch as RegExpMatchArray)[0] ?? "";
    expect(fnBody).toMatch(/fedos_encrypt\(algorithm, key\.inner\(\), aad_domain, plaintext\)/);
    expect(fnBody).not.toMatch(/expose_bytes|to_vec|zeroize|getrandom|unsafe/i);
  });

  it("17. AeadKeyHandle gains a new pub(crate) inner() accessor -- the crate-private reviewed seam encrypt_aead() uses, never re-exported", () => {
    // AeadKeyHandle now has TWO impl blocks: the #[wasm_bindgen]-annotated
    // one (kind() getter, Stage 1008) and a PLAIN one added this Stage
    // (inner(), never itself wasm_bindgen-exported since it must stay
    // pub(crate)-only). Match all occurrences and find the one with inner().
    const implBodies = [...libRsSource.matchAll(/impl AeadKeyHandle \{([\s\S]*?)\n\}/g)].map((m) => m[1] ?? "");
    expect(implBodies.length).toBe(2);
    const innerImplBody = implBodies.find((body) => body.includes("fn inner("));
    expect(innerImplBody).toBeDefined();
    expect(innerImplBody as string).toMatch(/pub\(crate\) fn inner\(&self\) -> &FedosAeadKeyHandle/);
    expect(libRsSource).not.toMatch(/pub fn inner\(&self\) -> &FedosAeadKeyHandle/);
  });

  it("18. fedos_encrypt() itself (Stage 166-176) is byte-for-byte unchanged by this stage", () => {
    expect(libRsSource).toMatch(
      /pub fn fedos_encrypt\(\s*algorithm: FedosAeadAlgorithm,\s*key: &FedosAeadKeyHandle,\s*aad_domain: FedosAeadAadDomain,\s*plaintext: &\[u8\],\s*\) -> FedosEncryptDecision \{/,
    );
  });

  it("19. importKey()/exportKey() are NOT implemented anywhere in this stage's changed files, in either language -- decrypt() was later added by Stage 1010 (Secure Runtime Alpha 015)", () => {
    expect(encryptServiceSource).not.toMatch(/fedos_decrypt/);
    expect(encryptServiceSource).not.toMatch(/\.\s*(decrypt|importKey|exportKey)\s*\(/);
    expect(runtimeTypesSource).not.toMatch(/readonly importKey:|readonly exportKey:/);
    expect(createRuntimeSource).not.toMatch(/fedos_decrypt/);
    expect(libRsSource).not.toMatch(/pub fn import_key\b|pub fn export_key\b/);
  });

  it("20. initializeCrypto()'s own return value is byte-for-byte unaffected by calling encrypt() first", async () => {
    await withNodeEnv("development", () =>
      encrypt({ kind: "AeadKeyHandle" }, "ChaCha20Poly1305", "RootKey", new Uint8Array([1])),
    );
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision).toEqual({ allowed: false, initialized: false, reason: "PrototypeDisabled" });
  });

  it("21. runtimeCapabilities()/randomBytes()/generateAeadKey() are unaffected by calling encrypt() first", async () => {
    await withNodeEnv("development", () =>
      encrypt({ kind: "AeadKeyHandle" }, "ChaCha20Poly1305", "RootKey", new Uint8Array([1])),
    );
    const caps = await runtimeCapabilities();
    expect(Object.keys(caps).sort()).toEqual(
      ["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort(),
    );
    const bytes = await withNodeEnv("development", () => randomBytes());
    expect(bytes === null || bytes instanceof Uint8Array).toBe(true);
    const key = await withNodeEnv("development", () => generateAeadKey());
    expect(key === null || (typeof key === "object" && key !== null)).toBe(true);
    expect(key).not.toBeInstanceOf(Uint8Array);
  });

  it("22. encrypt() and generateAeadKey()/randomBytes() construct entirely separate FedosWasmLoader instances", () => {
    expect(codeOnlyLines(encryptServiceSource)).not.toMatch(
      /randomBytes|attemptDevOnlyRuntimeRandomBytes|fedos_runtime_random_bytes|generateAeadKey|attemptDevOnlyRuntimeAeadKeyGeneration|fedos_runtime_aead_key_generation/,
    );
    expect(codeOnlyLines(keyGenerationServiceSource)).not.toMatch(
      /encrypt\(|attemptDevOnlyRuntimeEncrypt|fedos_runtime_encrypt/,
    );
    expect(codeOnlyLines(randomBytesServiceSource)).not.toMatch(
      /attemptDevOnlyRuntimeEncrypt|fedos_runtime_encrypt/,
    );
    expect(codeOnlyLines(runtimeIntegrationSource)).not.toMatch(
      /attemptDevOnlyRuntimeEncrypt|fedos_runtime_encrypt/,
    );
  });

  it("23. fedos_runtime_encrypt.ts exports exactly attemptDevOnlyRuntimeEncrypt and encrypt, plus one interface", () => {
    const exportedFns = [...encryptServiceSource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedFns)).toEqual(new Set(["attemptDevOnlyRuntimeEncrypt", "encrypt"]));
    const exportedInterfaces = [...encryptServiceSource.matchAll(/^export interface (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedInterfaces)).toEqual(new Set(["RuntimeEncryptState"]));
  });

  it("24. src/runtime/types.ts declares encrypt as a new AppRuntime field with the faithful 4-arg signature; initializeCrypto/runtimeCapabilities/randomBytes/generateAeadKey untouched", () => {
    expect(runtimeTypesSource).toMatch(
      /readonly encrypt: \(\s*key: AeadKeyHandle,\s*algorithm: AeadAlgorithm,\s*aadDomain: AeadAadDomain,\s*plaintext: Uint8Array,\s*\) => Promise<AeadCiphertextHandle \| null>;/,
    );
    expect(runtimeTypesSource).toMatch(/readonly initializeCrypto: \(\) => RuntimeInitializeCryptoResult;/);
    expect(runtimeTypesSource).toMatch(/readonly runtimeCapabilities: \(\) => Promise<RuntimeCapabilities>;/);
    expect(runtimeTypesSource).toMatch(/readonly randomBytes: \(\) => Promise<Uint8Array \| null>;/);
    expect(runtimeTypesSource).toMatch(/readonly generateAeadKey: \(\) => Promise<AeadKeyHandle \| null>;/);
    expect(runtimeTypesSource).not.toMatch(/fedos_wasm_loader/);
  });

  it("25. encrypt()'s own try/catch guarantees no exception ever escapes -- Fail Closed at the Runtime Service boundary", () => {
    const fnMatch = codeOnlyLines(encryptServiceSource).match(
      /export async function encrypt\([\s\S]*?\): Promise<AeadCiphertextHandle \| null> \{[\s\S]*?\n\}/,
    );
    expect(fnMatch).not.toBeNull();
    const fnBody = (fnMatch as RegExpMatchArray)[0] ?? "";
    expect(fnBody).toMatch(/try\s*\{/);
    expect(fnBody).toMatch(/catch\s*\{/);
    expect(fnBody).toMatch(/return null;/);
  });

  it("26. Worker remains fully unconnected -- src/worker.ts references nothing from this stage's chain", () => {
    expect(workerSource).not.toMatch(/\.\s*encrypt\s*\(/);
    expect(workerSource).not.toMatch(/attemptDevOnlyRuntimeEncrypt/);
    expect(workerSource).not.toMatch(/attemptDevOnlyEncryptCall/);
    expect(workerSource).not.toMatch(/fedos_runtime_encrypt/);
    expect(workerSource).not.toMatch(/encrypt_aead/);
    expect(workerSource).not.toMatch(/fedos_encrypt/);
    expect(workerSource).not.toMatch(/\bAeadCiphertextHandle\b/);
  });

  it("27. Production is unaffected beyond the ONE new field -- create_runtime.ts references nothing else from the encrypt chain", () => {
    expect(createRuntimeSource).not.toMatch(/attemptDevOnlyEncryptCall/);
    expect(createRuntimeSource).not.toMatch(/attemptDevOnlyJsGlueImport/);
    expect(createRuntimeSource).not.toMatch(/attemptDevOnlyWasmInitialization/);
    expect(createRuntimeSource).not.toMatch(/RuntimeEncryptState/);
    expect(createRuntimeSource).not.toMatch(/\bcargo\b/i);
    expect(createRuntimeSource).not.toMatch(/fedos_encrypt/);
  });

  it("28. no Secure Storage / persistence API of any kind in the new Runtime Service's own code", () => {
    const codeOnly = codeOnlyLines(encryptServiceSource);
    expect(codeOnly).not.toMatch(/localStorage|sessionStorage|indexedDB|writeFile/i);
  });

  it("29. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still exactly seven Plan interfaces, still BlockedByPolicy", async () => {
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

  it("30. Rust and Cargo/package sources -- 33 pub fn, ten #[wasm_bindgen] (FedosAeadAlgorithm/FedosAeadAadDomain annotated + AeadCiphertextHandle struct/impl + encrypt_aead), 11/2 dependencies, no new dependency added", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(64);
    expect(pubFnNames).toContain("encrypt_aead");
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
});
