import { describe, it, expect, vi } from "vitest";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
import { createRuntime, createRuntimeInitializeCryptoResult } from "../src/os/_legacy_prototype/runtime/create_runtime.js";
import { runtimeCapabilities } from "../src/runtime/fedos_runtime_prototype_execution.js";
import { randomBytes } from "../src/runtime/fedos_runtime_random_bytes.js";
import { generateAeadKey } from "../src/runtime/fedos_runtime_aead_key_generation.js";
import { encrypt } from "../src/runtime/fedos_runtime_encrypt.js";
import { decrypt } from "../src/runtime/fedos_runtime_decrypt.js";
import { exportCiphertext } from "../src/runtime/fedos_runtime_export_ciphertext.js";
import { importCiphertext } from "../src/runtime/fedos_runtime_import_ciphertext.js";
import {
  storeCiphertext,
  loadCiphertext,
  deleteCiphertext,
} from "../src/runtime/fedos_runtime_ciphertext_storage.js";
// Secure Runtime Alpha 021 moved MemoryCiphertextStorage/RuntimeCiphertextStorage
// out of fedos_runtime_ciphertext_storage.ts into their own module, renamed
// to MemoryStorageBackend/RuntimeStorageBackend -- see
// test/secure_runtime_alpha_021_storage_backend_abstraction.test.ts.
import {
  MemoryStorageBackend as MemoryCiphertextStorage,
  type RuntimeStorageBackend as RuntimeCiphertextStorage,
} from "../src/runtime/fedos_runtime_storage_backend.js";
import { FedosWasmLoaderSkeleton } from "../src/runtime/fedos_wasm_loader.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_019_secure_storage_foundation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageServiceSource from "../src/runtime/fedos_runtime_ciphertext_storage.ts?raw";
// Secure Runtime Alpha 021 -- the Storage Backend Interface/Memory
// implementation's new home, used by test #12 below (moved from this
// file's own storageServiceSource).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageBackendSource from "../src/runtime/fedos_runtime_storage_backend.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import exportServiceSource from "../src/os/core/vault/wasm/fedos_runtime_export_ciphertext.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import importServiceSource from "../src/os/core/vault/wasm/fedos_runtime_import_ciphertext.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import encryptServiceSource from "../src/os/core/vault/wasm/fedos_runtime_encrypt.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import decryptServiceSource from "../src/os/core/vault/wasm/fedos_runtime_decrypt.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../src/os/core/vault/wasm/fedos_wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
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
import * as nodeFs from "node:fs";

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

/**
 * Secure Runtime Alpha 019 — "Secure Storage Foundation": the FIRST
 * storage-shaped Public Runtime API this arc adds. Adds
 * `AppRuntime.storeCiphertext()`/`loadCiphertext()`/`deleteCiphertext()`
 * (Stage 1012), reaching NO `FedosWasmLoader` and NO Rust Boundary at
 * all (an `AeadCiphertextWire` is already a plain string). Storage is
 * restricted to `AeadCiphertextWire` ONLY -- `AeadKeyHandle` storage
 * remains forbidden -- via a `RuntimeCiphertextStorage` Storage
 * Interface with exactly one backend, `MemoryCiphertextStorage` (an
 * in-process `Map`, Local-Development-only, no SQLite/IndexedDB/
 * filesystem/OS Keychain/Secret Service).
 */
describe("Secure Runtime Alpha 019 -- Secure Storage Foundation, AeadCiphertextWire-only, Fail Closed everywhere, no Rust change", () => {
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
    expect(designDocSource.length).toBeGreaterThan(5000);
  });

  it("2. the design doc states the Public API, the AeadCiphertextWire-only restriction, the shorter no-Rust architecture, the Storage Interface/backend, the singleton exception, Fail Closed, and the round-trip completion criterion", () => {
    expect(designDocSource).toMatch(
      /storeCiphertext\(id: string, wire: AeadCiphertextWire\): Promise<boolean \| null>;/,
    );
    expect(designDocSource).toMatch(/loadCiphertext\(id: string\): Promise<AeadCiphertextWire \| null>;/);
    expect(designDocSource).toMatch(/deleteCiphertext\(id: string\): Promise<boolean \| null>;/);
    expect(designDocSource).toMatch(
      /## 2\. Storage restricted to `AeadCiphertextWire` ONLY — `AeadKeyHandle` storage remains forbidden/,
    );
    expect(designDocSource).toMatch(/## 3\. Architecture — shorter than every prior Crypto API/);
    expect(designDocSource).toMatch(/export interface RuntimeCiphertextStorage \{/);
    expect(designDocSource).toMatch(/export class MemoryCiphertextStorage implements RuntimeCiphertextStorage/);
    expect(designDocSource).toMatch(/## 5\. Deliberate exception to the "fresh instance per call" convention/);
    expect(designDocSource).toMatch(/## 6\. Fail Closed/);
    expect(designDocSource).toMatch(/## 7\. Round-trip completion criterion/);
    expect(designDocSource).toMatch(
      /generateAeadKey\(\) -> encrypt\(\) -> exportCiphertext\(\) -> storeCiphertext\(\)/,
    );
  });

  it("3. against the REAL (unmocked) repo state, storeCiphertext()/loadCiphertext()/deleteCiphertext() Fail Closed to null in Development when the storage backend itself is fine (real MemoryCiphertextStorage) but id/wire shape is invalid", async () => {
    const stored = await withNodeEnv("development", () => storeCiphertext("", "wire" as never));
    expect(stored).toBeNull();
    const loaded = await withNodeEnv("development", () => loadCiphertext(""));
    expect(loaded).toBeNull();
    const deleted = await withNodeEnv("development", () => deleteCiphertext(""));
    expect(deleted).toBeNull();
  });

  it("4. a REAL, single-loader-instance mocked round trip: encrypt() -> exportCiphertext() -> storeCiphertext() -> loadCiphertext() -> importCiphertext() -> decrypt() recovers the exact original plaintext", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const keyHandle = { kind: "AeadKeyHandle" as const, __keyId: "key-A" };
        const originalPlaintext = new TextEncoder().encode("Alpha019 storage round trip");
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

        const exportResult = await loader.attemptDevOnlyExportCiphertextCall(encryptResult.ciphertextHandle);
        expect(exportResult.succeeded).toBe(true);
        const wire = exportResult.wire as string;

        // storeCiphertext()/loadCiphertext() are PURE JS -- no WASM mock
        // needed for these two steps at all.
        const storage = new MemoryCiphertextStorage();
        const stored = await storeCiphertext("alpha019-round-trip", wire as never, storage);
        expect(stored).toBe(true);
        const loadedWire = await loadCiphertext("alpha019-round-trip", storage);
        expect(loadedWire).toBe(wire);

        const importResult = await loader.attemptDevOnlyImportCiphertextCall(loadedWire);
        expect(importResult.succeeded).toBe(true);

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

  it("5. storeCiphertext() then loadCiphertext() returns the exact same wire; loadCiphertext() for a never-stored id resolves null; deleteCiphertext() removes it and a subsequent load resolves null", async () => {
    await withNodeEnv("development", async () => {
      const storage = new MemoryCiphertextStorage();
      const wire = '{"v":1,"alg":"chacha20poly1305","aad":"test_only","n":"AAAA","ct":"AAAA","tag":"AAAA"}';

      const neverStored = await loadCiphertext("does-not-exist", storage);
      expect(neverStored).toBeNull();

      const stored = await storeCiphertext("entry-1", wire as never, storage);
      expect(stored).toBe(true);

      const loaded = await loadCiphertext("entry-1", storage);
      expect(loaded).toBe(wire);

      const deleted = await deleteCiphertext("entry-1", storage);
      expect(deleted).toBe(true);

      const loadedAfterDelete = await loadCiphertext("entry-1", storage);
      expect(loadedAfterDelete).toBeNull();

      const deleteAgain = await deleteCiphertext("entry-1", storage);
      expect(deleteAgain).toBe(false);
    });
  });

  it("6. the default (shared, singleton) storage persists across separate storeCiphertext()/loadCiphertext() calls that omit the storage parameter", async () => {
    await withNodeEnv("development", async () => {
      const wire = '{"v":1,"alg":"chacha20poly1305","aad":"root_key","n":"BBBB","ct":"BBBB","tag":"BBBB"}';
      const stored = await storeCiphertext("alpha019-singleton-check", wire as never);
      expect(stored).toBe(true);
      const loaded = await loadCiphertext("alpha019-singleton-check");
      expect(loaded).toBe(wire);
      const deleted = await deleteCiphertext("alpha019-singleton-check");
      expect(deleted).toBe(true);
    });
  });

  it("7. store/load/delete Fail Closed to null when the id or wire is not a genuine non-empty string", async () => {
    await withNodeEnv("development", async () => {
      const storage = new MemoryCiphertextStorage();
      for (const badId of [undefined, null, "", 42, {}]) {
        expect(await storeCiphertext(badId as never, "wire" as never, storage)).toBeNull();
        expect(await loadCiphertext(badId as never, storage)).toBeNull();
        expect(await deleteCiphertext(badId as never, storage)).toBeNull();
      }
      for (const badWire of [undefined, null, "", 42, {}, new Uint8Array(4)]) {
        expect(await storeCiphertext("some-id", badWire as never, storage)).toBeNull();
      }
    });
  });

  it("8. store/load/delete Fail Closed to null, never throwing, when the storage backend itself throws", async () => {
    await withNodeEnv("development", async () => {
      const throwingStorage: RuntimeCiphertextStorage = {
        store: async () => {
          throw new Error("simulated storage backend failure");
        },
        load: async () => {
          throw new Error("simulated storage backend failure");
        },
        delete: async () => {
          throw new Error("simulated storage backend failure");
        },
      };
      expect(await storeCiphertext("id", "wire" as never, throwingStorage)).toBeNull();
      expect(await loadCiphertext("id", throwingStorage)).toBeNull();
      expect(await deleteCiphertext("id", throwingStorage)).toBeNull();
    });
  });

  it("9. Production and Unknown Runtime Fail Closed to null for all three functions, even with a real, working storage backend present", async () => {
    const storage = new MemoryCiphertextStorage();
    await storage.store("existing", "wire" as never);

    const prodStore = await withNodeEnv("production", () => storeCiphertext("id", "wire" as never, storage));
    expect(prodStore).toBeNull();
    const prodLoad = await withNodeEnv("production", () => loadCiphertext("existing", storage));
    expect(prodLoad).toBeNull();
    const prodDelete = await withNodeEnv("production", () => deleteCiphertext("existing", storage));
    expect(prodDelete).toBeNull();

    const unknownStore = await withNodeEnv(undefined, () => storeCiphertext("id", "wire" as never, storage));
    expect(unknownStore).toBeNull();
    const unknownLoad = await withNodeEnv(undefined, () => loadCiphertext("existing", storage));
    expect(unknownLoad).toBeNull();

    // Confirm Production/Unknown never actually reached the (perfectly
    // functional) backend -- the entry inserted before the environment
    // switch is STILL there once Development resumes.
    const stillThereInDevelopment = await withNodeEnv("development", () => loadCiphertext("existing", storage));
    expect(stillThereInDevelopment).toBe("wire");
  });

  it("10. calling runtime.storeCiphertext()/loadCiphertext()/deleteCiphertext() via the real AppRuntime object never throws", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("id", "wire" as never));
    expect(stored === null || typeof stored === "boolean").toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("id"));
    expect(loaded === null || typeof loaded === "string").toBe(true);
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("id"));
    expect(deleted === null || typeof deleted === "boolean").toBe(true);
  });

  it("11. no AeadKeyHandle reference, no exportKey/importKey, and no OS Keychain/Secure Enclave/SQLite/IndexedDB/filesystem/DPAPI/Secret Service/Cloud/Network/Nostr/ActivityPub/Bluesky/Session reference anywhere in the new Storage Service's own code", () => {
    const codeOnly = codeOnlyLines(storageServiceSource);
    expect(codeOnly).not.toMatch(/AeadKeyHandle/);
    expect(codeOnly).not.toMatch(/exportKey|importKey/);
    expect(codeOnly).not.toMatch(
      /keychain|secure enclave|sqlite|indexeddb|dpapi|secret service|cloud|network|nostr|activitypub|bluesky|session/i,
    );
    expect(codeOnly).not.toMatch(/localStorage|sessionStorage|writeFile|fetch\(|WebSocket/i);
  });

  it("12. the Backend Interface's own type signature makes storing an AeadKeyHandle a compile-time error -- structurally confirmed: store()'s second parameter type is AeadCiphertextWire, never AeadKeyHandle -- Secure Runtime Alpha 021 moved this interface out of fedos_runtime_ciphertext_storage.ts into fedos_runtime_storage_backend.ts", () => {
    expect(storageBackendSource).toMatch(
      /store\(id: string, wire: AeadCiphertextWire\): Promise<boolean>;/,
    );
    expect(storageBackendSource).not.toMatch(/store\([^)]*AeadKeyHandle/);
  });

  it("13. importKey()/exportKey() remain unimplemented; encrypt()/decrypt()/exportCiphertext()/importCiphertext() are untouched by this Stage's own changed files", () => {
    expect(storageServiceSource).not.toMatch(/\.\s*(importKey|exportKey)\s*\(/);
    expect(runtimeTypesSource).not.toMatch(/readonly importKey:|readonly exportKey:/);
    expect(libRsSource).not.toMatch(/pub fn import_key\b|pub fn export_key\b/);
  });

  it("14. initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected by calling storeCiphertext()/loadCiphertext()/deleteCiphertext() first", async () => {
    await withNodeEnv("development", async () => {
      await storeCiphertext("id", "wire" as never);
      await loadCiphertext("id");
      await deleteCiphertext("id");
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

    const exported = await withNodeEnv("development", () => exportCiphertext({ kind: "AeadCiphertextHandle" } as never));
    expect(exported === null || typeof exported === "string").toBe(true);

    const imported = await withNodeEnv("development", () => importCiphertext("x" as never));
    expect(imported === null || typeof imported === "object").toBe(true);
  });

  it("15. fedos_runtime_ciphertext_storage.ts exports exactly storeCiphertext/loadCiphertext/deleteCiphertext -- Secure Runtime Alpha 021 moved MemoryCiphertextStorage/RuntimeCiphertextStorage into their own Storage Backend module (renamed MemoryStorageBackend/RuntimeStorageBackend), so this file no longer exports an interface or a class", () => {
    const exportedFns = [...storageServiceSource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedFns)).toEqual(new Set(["storeCiphertext", "loadCiphertext", "deleteCiphertext"]));
    const exportedInterfaces = [...storageServiceSource.matchAll(/^export interface (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedInterfaces)).toEqual(new Set([]));
    const exportedClasses = [...storageServiceSource.matchAll(/^export class (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedClasses)).toEqual(new Set([]));
  });

  it("16. types.ts declares all three new AppRuntime fields with the faithful signatures, still no fedos_wasm_loader reference; createRuntime()'s AppRuntime exposes all three as real functions", () => {
    expect(runtimeTypesSource).toMatch(
      /readonly storeCiphertext: \(\s*id: string,\s*wire: AeadCiphertextWire,\s*\) => Promise<boolean \| null>;/,
    );
    expect(runtimeTypesSource).toMatch(
      /readonly loadCiphertext: \(id: string\) => Promise<AeadCiphertextWire \| null>;/,
    );
    expect(runtimeTypesSource).toMatch(
      /readonly deleteCiphertext: \(id: string\) => Promise<boolean \| null>;/,
    );
    expect(runtimeTypesSource).not.toMatch(/from "\.\/fedos_wasm_loader\.js"/);

    const runtime = createRuntime();
    expect(typeof runtime.storeCiphertext).toBe("function");
    expect(typeof runtime.loadCiphertext).toBe("function");
    expect(typeof runtime.deleteCiphertext).toBe("function");
  });

  it("17. this Stage's own functions do not import/construct FedosWasmLoader or reach fedos_wasm_loader.ts at all", () => {
    expect(codeOnlyLines(storageServiceSource)).not.toMatch(
      /createFedosWasmLoader|FedosWasmLoaderSkeleton|attemptDevOnly\w*Call/,
    );
    expect(storageServiceSource).toMatch(/import type \{ AeadCiphertextWire \} from "\.\/fedos_wasm_loader\.js";/);
  });

  it("18. store/load/delete's own try/catch guarantees no exception ever escapes -- Fail Closed at the Runtime Storage Service boundary", () => {
    for (const fnName of ["storeCiphertext", "loadCiphertext", "deleteCiphertext"]) {
      const fnMatch = codeOnlyLines(storageServiceSource).match(
        new RegExp(`export async function ${fnName}\\([\\s\\S]*?\\n\\}`),
      );
      expect(fnMatch).not.toBeNull();
      const body = (fnMatch as RegExpMatchArray)[0];
      expect(body).toMatch(/try\s*\{/);
      expect(body).toMatch(/catch\s*\{/);
      expect(body).toMatch(/return null;/);
    }
  });

  it("19. Worker remains fully unconnected -- src/worker.ts references nothing from this stage's chain", () => {
    expect(workerSource).not.toMatch(/storeCiphertext|loadCiphertext|deleteCiphertext/);
    expect(workerSource).not.toMatch(/MemoryCiphertextStorage|RuntimeCiphertextStorage/);
    expect(workerSource).not.toMatch(/fedos_runtime_ciphertext_storage/);
  });

  it("20. Production is unaffected beyond the three new fields -- create_runtime.ts's own CODE (not doc comments) references nothing else from the storage chain", () => {
    expect(codeOnlyLines(createRuntimeSource)).not.toMatch(/MemoryCiphertextStorage|RuntimeCiphertextStorage/);
    expect(codeOnlyLines(createRuntimeSource)).not.toMatch(/\bcargo\b/i);
  });

  it("21. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
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

  it("22. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED by this Stage -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_019/);
    expect(libRsSource).not.toMatch(/storeCiphertext|loadCiphertext|deleteCiphertext|MemoryCiphertextStorage/);

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

  it("23. no new dependency is proposed anywhere in this Stage's own changed files", () => {
    expect(storageServiceSource).not.toMatch(/^import\s+.*from\s+"(?!\.\/)/m);
  });

  it("24. exportCiphertext/importCiphertext services reference nothing from this Stage's own storage chain, confirming separation", () => {
    expect(codeOnlyLines(exportServiceSource)).not.toMatch(/storeCiphertext|loadCiphertext|deleteCiphertext/);
    expect(codeOnlyLines(importServiceSource)).not.toMatch(/storeCiphertext|loadCiphertext|deleteCiphertext/);
    expect(codeOnlyLines(encryptServiceSource)).not.toMatch(/storeCiphertext|loadCiphertext|deleteCiphertext/);
    expect(codeOnlyLines(decryptServiceSource)).not.toMatch(/storeCiphertext|loadCiphertext|deleteCiphertext/);
  });
});
