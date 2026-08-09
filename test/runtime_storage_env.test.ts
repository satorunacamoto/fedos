import { describe, it, expect } from "vitest";
import { createRuntime, selectStorageBackend } from "../src/os/_legacy_prototype/runtime/create_runtime.js";
import type { RuntimeEnv } from "../src/os/_legacy_prototype/runtime/types.js";
import { NoopStorageBackend, PlaceholderStorageBackend } from "../src/storage/noop_storage.js";
import type {
  StorageBackend,
  StorageDecision,
  StoragePacket,
  StorageReadDecision,
  StorageRef,
} from "../src/storage/types.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";

const runtimeSources = [runtimeSource, runtimeTypesSource].join("\n");

describe("Stage 109 — Storage backend runtime env selection", () => {
  it("1. no env -> NoopStorageBackend", () => {
    expect(selectStorageBackend()).toBeInstanceOf(NoopStorageBackend);
    expect(createRuntime().storageBackend).toBeInstanceOf(NoopStorageBackend);
  });

  it("2. STORAGE_PROVIDER=noop -> NoopStorageBackend", () => {
    const env: RuntimeEnv = { STORAGE_PROVIDER: "noop" };
    expect(selectStorageBackend(env)).toBeInstanceOf(NoopStorageBackend);
    expect(createRuntime(env).storageBackend).toBeInstanceOf(NoopStorageBackend);
  });

  it("3. STORAGE_PROVIDER=placeholder -> PlaceholderStorageBackend", () => {
    const env: RuntimeEnv = { STORAGE_PROVIDER: "placeholder" };
    expect(selectStorageBackend(env)).toBeInstanceOf(PlaceholderStorageBackend);
    expect(createRuntime(env).storageBackend).toBeInstanceOf(PlaceholderStorageBackend);
  });

  it("4. ENABLE_STORAGE_PLACEHOLDER truthy -> PlaceholderStorageBackend", () => {
    for (const flag of ["true", "1", "yes", "on", true] as const) {
      const env: RuntimeEnv = { ENABLE_STORAGE_PLACEHOLDER: flag };
      expect(selectStorageBackend(env)).toBeInstanceOf(PlaceholderStorageBackend);
    }
    // Falsy values must not opt in.
    for (const flag of ["false", "0", "no", "off", false] as const) {
      const env: RuntimeEnv = { ENABLE_STORAGE_PLACEHOLDER: flag };
      expect(selectStorageBackend(env)).toBeInstanceOf(NoopStorageBackend);
    }
  });

  it("5. invalid / unknown STORAGE_PROVIDER -> NoopStorageBackend", () => {
    for (const provider of ["google_drive", "sqlite", "", "PLACEHOLDER", "Noop"]) {
      const env: RuntimeEnv = { STORAGE_PROVIDER: provider };
      expect(selectStorageBackend(env)).toBeInstanceOf(NoopStorageBackend);
    }
  });

  it("6. overrides.storageBackend wins over env", () => {
    const stub = new NoopStorageBackend();
    const envPlaceholder: RuntimeEnv = { STORAGE_PROVIDER: "placeholder" };
    expect(selectStorageBackend(envPlaceholder, { storageBackend: stub })).toBe(stub);
    const rt = createRuntime(envPlaceholder, { storageBackend: stub });
    expect(rt.storageBackend).toBe(stub);
    expect(selectStorageBackend(undefined, { storageBackend: stub })).toBe(stub);
  });

  it("7. createRuntime does not call put/get/delete", async () => {
    let putCalls = 0;
    let getCalls = 0;
    let deleteCalls = 0;
    const spy: StorageBackend = {
      getStatus: (): StorageDecision => ({ allowed: false, state: "unavailable" }),
      put: async (_packet: StoragePacket): Promise<StorageDecision> => {
        putCalls += 1;
        return { allowed: false, state: "unavailable" };
      },
      get: async (_ref: StorageRef): Promise<StorageReadDecision> => {
        getCalls += 1;
        return { allowed: false, state: "unavailable" };
      },
      delete: async (_ref: StorageRef): Promise<StorageDecision> => {
        deleteCalls += 1;
        return { allowed: false, state: "unavailable" };
      },
    };
    const rt = createRuntime(undefined, { storageBackend: spy });
    expect(rt.storageBackend).toBe(spy);
    expect(putCalls).toBe(0);
    expect(getCalls).toBe(0);
    expect(deleteCalls).toBe(0);
    // getStatus() is a pure read; even it is not called by construction.
    expect(rt.storageBackend.getStatus).toBe(spy.getStatus);
  });

  it("8. Worker source never calls put/get/delete on a StorageBackend", () => {
    expect(workerSource).not.toMatch(/runtime\.storageBackend\s*\.\s*(put|get|delete)\s*\(/);
    expect(workerSource).not.toMatch(/storageBackend\s*\.\s*(put|get|delete)\s*\(/);
    expect(workerSource).not.toMatch(/new\s+(Noop|Placeholder)StorageBackend/);
  });

  it("9. Worker Env exposes only selection fields (STORAGE_PROVIDER / ENABLE_STORAGE_PLACEHOLDER)", () => {
    expect(workerSource).toMatch(/STORAGE_PROVIDER\?:\s*string/);
    expect(workerSource).toMatch(/ENABLE_STORAGE_PLACEHOLDER\?:\s*string/);
  });

  it("10. imports no Google Drive / Nostr WebSocket / SQLite / Bluetooth / Wi-Fi / IPFS client in the runtime sources", () => {
    const importLines = runtimeSources
      .split("\n")
      .filter((line: string) => /^\s*import\b/.test(line));
    const denylist = [
      "googleapis",
      "google-auth",
      "google.colab",
      "colab",
      "from \"ws\"",
      "from 'ws'",
      "websocket",
      "sqlite",
      "better-sqlite3",
      "bluetooth",
      "ipfs",
      "kubo",
    ];
    for (const line of importLines) {
      for (const banned of denylist) {
        expect(line.toLowerCase()).not.toContain(banned);
      }
    }
  });

  it("11. issues no fetch/file IO from the storage selection path", () => {
    expect(runtimeSources).not.toMatch(/\bfetch\s*\(\s*env\.STORAGE/);
    expect(runtimeSources).not.toMatch(/\breadFile|writeFile|readFileSync|writeFileSync\b/);
  });

  it("12. input env is not mutated by selectStorageBackend or createRuntime", () => {
    const env: RuntimeEnv = {
      STORAGE_PROVIDER: "placeholder",
      ENABLE_STORAGE_PLACEHOLDER: "true",
    };
    const before = { ...env };
    const beforeKeys = Object.keys(env).sort();
    selectStorageBackend(env);
    createRuntime(env);
    expect(Object.keys(env).sort()).toEqual(beforeKeys);
    for (const key of beforeKeys) {
      expect(env[key as keyof RuntimeEnv]).toBe(before[key as keyof RuntimeEnv]);
    }
  });

  it("13. never throws", async () => {
    expect(() => selectStorageBackend()).not.toThrow();
    expect(() => createRuntime({ STORAGE_PROVIDER: "placeholder" })).not.toThrow();
    const backend = createRuntime({ STORAGE_PROVIDER: "placeholder" }).storageBackend;
    await expect(
      backend.put({ backendKind: "external_placeholder", visibility: "unlisted" }),
    ).resolves.toBeDefined();
  });
});
