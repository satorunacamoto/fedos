import { describe, it, expect } from "vitest";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
import { createRuntime, createRuntimeInitializeCryptoResult } from "../src/runtime/create_runtime.js";
import { runtimeCapabilities } from "../src/runtime/fedos_runtime_prototype_execution.js";
import { randomBytes } from "../src/runtime/fedos_runtime_random_bytes.js";
import { generateAeadKey } from "../src/runtime/fedos_runtime_aead_key_generation.js";
import { encrypt } from "../src/runtime/fedos_runtime_encrypt.js";
import { decrypt } from "../src/runtime/fedos_runtime_decrypt.js";
import { exportCiphertext } from "../src/runtime/fedos_runtime_export_ciphertext.js";
import { importCiphertext } from "../src/runtime/fedos_runtime_import_ciphertext.js";
import { storeCiphertext, loadCiphertext, deleteCiphertext } from "../src/runtime/fedos_runtime_ciphertext_storage.js";
import { MemoryStorageBackend, type RuntimeStorageBackend } from "../src/runtime/fedos_runtime_storage_backend.js";
import { resolveRuntimeStorageBackend } from "../src/runtime/fedos_runtime_storage_resolver.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_021_storage_backend_abstraction.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageServiceSource from "../src/runtime/fedos_runtime_ciphertext_storage.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageBackendSource from "../src/runtime/fedos_runtime_storage_backend.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageResolverSource from "../src/runtime/fedos_runtime_storage_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
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

/**
 * Secure Runtime Alpha 021 — "Storage Backend Abstraction Layer": moves
 * Alpha 019's `RuntimeCiphertextStorage`/`MemoryCiphertextStorage` out of
 * the Runtime Storage Service into their own module (renamed
 * `RuntimeStorageBackend`/`MemoryStorageBackend`), and adds a Storage
 * Resolver (`resolveRuntimeStorageBackend()`) as the ONE seam a future
 * OS-backed backend would be selected through. No persistent storage is
 * implemented; `MemoryStorageBackend`'s own behavior and every Public
 * Runtime API signature are byte-for-byte unchanged.
 */
describe("Secure Runtime Alpha 021 -- Storage Backend Abstraction Layer, Public API unchanged, Memory-only, Fail Closed unchanged", () => {
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
    expect(designDocSource.length).toBeGreaterThan(4000);
  });

  it("2. the design doc names the before/after architecture, the Backend Interface, the Memory Backend, and the Resolver's future-extension purpose", () => {
    expect(designDocSource).toMatch(/Alpha 019/);
    expect(designDocSource).toMatch(/Alpha 020/);
    expect(designDocSource).toMatch(/Storage Resolver/);
    expect(designDocSource).toMatch(/RuntimeStorageBackend/);
    expect(designDocSource).toMatch(/MemoryStorageBackend/);
    expect(designDocSource).toMatch(/resolveRuntimeStorageBackend/);
    expect(designDocSource).toMatch(/DPAPI/);
    expect(designDocSource).toMatch(/Keychain/);
    expect(designDocSource).toMatch(/Secret Service/);
    expect(designDocSource).toMatch(/SQLite/);
  });

  it("3. the design doc records what this Stage does NOT do", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement a persistent Storage Backend/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add.*backend-selection condition/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* connect a Worker/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* connect Production/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change any Public Runtime API signature/);
  });

  it("4. fedos_runtime_storage_backend.ts exports exactly RuntimeStorageBackend and MemoryStorageBackend, and the interface shape matches Alpha 019's original exactly", () => {
    const exportedInterfaces = [...storageBackendSource.matchAll(/^export interface (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedInterfaces)).toEqual(new Set(["RuntimeStorageBackend"]));
    const exportedClasses = [...storageBackendSource.matchAll(/^export class (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedClasses)).toEqual(new Set(["MemoryStorageBackend"]));
    expect(storageBackendSource).toMatch(/store\(id: string, wire: AeadCiphertextWire\): Promise<boolean>;/);
    expect(storageBackendSource).toMatch(/load\(id: string\): Promise<AeadCiphertextWire \| null>;/);
    expect(storageBackendSource).toMatch(/delete\(id: string\): Promise<boolean>;/);
    expect(storageBackendSource).not.toMatch(/store\([^)]*AeadKeyHandle/);
  });

  it("5. MemoryStorageBackend is a plain in-process Map -- no filesystem/SQLite/IndexedDB/DPAPI/Keychain/Secret Service/Cloud/Network reference anywhere in the backend module", () => {
    const codeOnly = codeOnlyLines(storageBackendSource);
    expect(codeOnly).toMatch(/new Map</);
    expect(codeOnly).not.toMatch(
      /keychain|secure enclave|sqlite|indexeddb|dpapi|secret service|cloud|network|nostr|activitypub|bluesky|session/i,
    );
    expect(codeOnly).not.toMatch(/localStorage|sessionStorage|writeFile|fetch\(|WebSocket|readFileSync|existsSync/i);
    expect(codeOnly).not.toMatch(/AeadKeyHandle/);
  });

  it("6. MemoryStorageBackend's own behavior matches Alpha 019's MemoryCiphertextStorage exactly: store always resolves true, load resolves null for a missing id, delete reports whether an entry existed", async () => {
    const backend: RuntimeStorageBackend = new MemoryStorageBackend();
    expect(await backend.load("missing")).toBeNull();
    expect(await backend.store("id-1", "wire-1" as never)).toBe(true);
    expect(await backend.load("id-1")).toBe("wire-1");
    expect(await backend.delete("id-1")).toBe(true);
    expect(await backend.load("id-1")).toBeNull();
    expect(await backend.delete("id-1")).toBe(false);
  });

  it("7. fedos_runtime_storage_resolver.ts exports exactly resolveRuntimeStorageBackend, and it was hardcoded with no environment/platform read AS OF Alpha 021's own scope -- Secure Runtime Alpha 024 later wired in a real Development+Windows-gated switch, per this file's own top-of-file 'a future Stage may add a real selection condition here' note", () => {
    const exportedFns = [...storageResolverSource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedFns)).toEqual(new Set(["resolveRuntimeStorageBackend"]));
  });

  it("8. resolveRuntimeStorageBackend() always returns the SAME shared MemoryStorageBackend instance across repeated calls (singleton, not fresh-per-call)", async () => {
    const first = resolveRuntimeStorageBackend();
    const second = resolveRuntimeStorageBackend();
    expect(first).toBe(second);
    expect(first).toBeInstanceOf(MemoryStorageBackend);

    await first.store("resolver-singleton-check", "wire-value" as never);
    expect(await second.load("resolver-singleton-check")).toBe("wire-value");
    await first.delete("resolver-singleton-check");
  });

  it("9. fedos_runtime_ciphertext_storage.ts exports exactly storeCiphertext/loadCiphertext/deleteCiphertext -- no interface, no class, no backend construction of its own", () => {
    const exportedFns = [...storageServiceSource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedFns)).toEqual(new Set(["storeCiphertext", "loadCiphertext", "deleteCiphertext"]));
    expect([...storageServiceSource.matchAll(/^export interface/gm)].length).toBe(0);
    expect([...storageServiceSource.matchAll(/^export class/gm)].length).toBe(0);
    expect(codeOnlyLines(storageServiceSource)).not.toMatch(/new Map</);
    expect(storageServiceSource).toMatch(/from "\.\/fedos_runtime_storage_backend\.js"/);
    expect(storageServiceSource).toMatch(/from "\.\/fedos_runtime_storage_resolver\.js"/);
    expect(storageServiceSource).toMatch(/resolveRuntimeStorageBackend\(\)/);
  });

  it("10. Public Runtime Storage API signatures are unchanged: storeCiphertext(id, wire)/loadCiphertext(id)/deleteCiphertext(id) with the same required-parameter shape", () => {
    expect(storageServiceSource).toMatch(
      /export async function storeCiphertext\(\s*id: string,\s*wire: AeadCiphertextWire,\s*storage: RuntimeStorageBackend = resolveRuntimeStorageBackend\(\),\s*\): Promise<boolean \| null>/,
    );
    expect(storageServiceSource).toMatch(
      /export async function loadCiphertext\(\s*id: string,\s*storage: RuntimeStorageBackend = resolveRuntimeStorageBackend\(\),\s*\): Promise<AeadCiphertextWire \| null>/,
    );
    expect(storageServiceSource).toMatch(
      /export async function deleteCiphertext\(\s*id: string,\s*storage: RuntimeStorageBackend = resolveRuntimeStorageBackend\(\),\s*\): Promise<boolean \| null>/,
    );
  });

  it("11. types.ts's three storage fields keep their exact faithful signatures -- unchanged by this Stage", () => {
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
    // Doc-comment PROSE is allowed to mention the Resolver by name (see
    // the storeCiphertext/loadCiphertext/deleteCiphertext field comments
    // above) -- only a real import/reference from CODE is forbidden.
    expect(codeOnlyLines(runtimeTypesSource)).not.toMatch(
      /fedos_runtime_storage_backend|fedos_runtime_storage_resolver/,
    );
  });

  it("12. against the real (unmocked) repo state, storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development and are still Fail Closed to null for invalid id/wire shape", async () => {
    await withNodeEnv("development", async () => {
      const stored = await storeCiphertext("alpha021-id", "wire-value" as never);
      expect(stored).toBe(true);
      const loaded = await loadCiphertext("alpha021-id");
      expect(loaded).toBe("wire-value");
      const deleted = await deleteCiphertext("alpha021-id");
      expect(deleted).toBe(true);

      expect(await storeCiphertext("", "wire" as never)).toBeNull();
      expect(await loadCiphertext("")).toBeNull();
      expect(await deleteCiphertext("")).toBeNull();
    });
  });

  it("13. Production and Unknown Runtime still Fail Closed to null for all three functions, even with a real, working resolved backend present", async () => {
    await withNodeEnv("development", () => storeCiphertext("alpha021-prod-check", "wire" as never));

    const prodStore = await withNodeEnv("production", () => storeCiphertext("id", "wire" as never));
    expect(prodStore).toBeNull();
    const prodLoad = await withNodeEnv("production", () => loadCiphertext("alpha021-prod-check"));
    expect(prodLoad).toBeNull();
    const prodDelete = await withNodeEnv("production", () => deleteCiphertext("alpha021-prod-check"));
    expect(prodDelete).toBeNull();

    const unknownLoad = await withNodeEnv(undefined, () => loadCiphertext("alpha021-prod-check"));
    expect(unknownLoad).toBeNull();

    const stillThereInDevelopment = await withNodeEnv("development", () => loadCiphertext("alpha021-prod-check"));
    expect(stillThereInDevelopment).toBe("wire");
  });

  it("14. an injected storage backend (a fresh MemoryStorageBackend, and a throwing custom backend) both still work exactly as Alpha 019 designed", async () => {
    await withNodeEnv("development", async () => {
      const storage = new MemoryStorageBackend();
      expect(await storeCiphertext("iso-id", "wire" as never, storage)).toBe(true);
      expect(await loadCiphertext("iso-id", storage)).toBe("wire");

      const throwingStorage: RuntimeStorageBackend = {
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

  it("15. calling runtime.storeCiphertext()/loadCiphertext()/deleteCiphertext() via the real AppRuntime object still round-trips and never throws", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha021-runtime-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha021-runtime-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha021-runtime-id"));
    expect(deleted).toBe(true);
  });

  it("16. initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected by exercising store/load/delete and the Resolver first", async () => {
    await withNodeEnv("development", async () => {
      resolveRuntimeStorageBackend();
      await storeCiphertext("id", "wire" as never);
      await loadCiphertext("id");
      await deleteCiphertext("id");
    });

    expect(createRuntimeInitializeCryptoResult()).toEqual({
      allowed: false,
      initialized: false,
      reason: "PrototypeDisabled",
    });

    const caps = await runtimeCapabilities();
    expect(Object.keys(caps).sort()).toEqual(["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort());

    const bytes = await withNodeEnv("development", () => randomBytes());
    expect(bytes === null || bytes instanceof Uint8Array).toBe(true);

    const key = await withNodeEnv("development", () => generateAeadKey());
    expect(key === null || (typeof key === "object" && key !== null)).toBe(true);

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

  it("17. Worker remains fully unconnected to the Storage Backend/Resolver modules", () => {
    expect(workerSource).not.toMatch(/fedos_runtime_storage_backend|fedos_runtime_storage_resolver/);
    expect(workerSource).not.toMatch(/RuntimeStorageBackend|MemoryStorageBackend|resolveRuntimeStorageBackend/);
  });

  it("18. Production (create_runtime.ts's own CODE, not doc comments) references nothing from the Backend/Resolver modules directly -- it only reaches storeCiphertext/loadCiphertext/deleteCiphertext, unchanged", () => {
    expect(codeOnlyLines(createRuntimeSource)).not.toMatch(
      /fedos_runtime_storage_backend|fedos_runtime_storage_resolver|RuntimeStorageBackend|MemoryStorageBackend|resolveRuntimeStorageBackend/,
    );
  });

  it("19. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("20. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED by this Stage -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this stage's own doc or identifiers", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_021/);
    expect(libRsSource).not.toMatch(/RuntimeStorageBackend|MemoryStorageBackend|resolveRuntimeStorageBackend/);

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

  it("21. no new Storage API or Crypto API surface exists -- the Backend/Resolver modules export nothing beyond the Interface/class/one resolver function; importKey/exportKey remain unimplemented", () => {
    expect(storageBackendSource).not.toMatch(/\.\s*(importKey|exportKey)\s*\(/);
    expect(storageResolverSource).not.toMatch(/\.\s*(importKey|exportKey)\s*\(/);
    expect(runtimeTypesSource).not.toMatch(/readonly importKey:|readonly exportKey:/);
    expect(libRsSource).not.toMatch(/pub fn import_key\b|pub fn export_key\b/);
  });

  it("22. no exception ever escapes storeCiphertext()/loadCiphertext()/deleteCiphertext() -- Fail Closed at the Runtime Storage Service boundary is unchanged", () => {
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
});
