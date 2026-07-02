import { describe, it, expect, vi } from "vitest";
import {
  createRuntime,
  selectCryptoProvider,
} from "../src/runtime/create_runtime.js";
import type { RuntimeEnv } from "../src/runtime/types.js";
import { NoopCryptoProvider } from "../src/crypto/noop_crypto.js";
import { FedosCoreCryptoProvider } from "../src/crypto/fedos_core_adapter.js";
import type {
  CryptoDecision,
  CryptoProvider,
  DecryptRequest,
  DeriveKeyRequest,
  EncryptRequest,
  RandomBytesRequest,
} from "../src/crypto/types.js";
import { buildRuntimeStatusView } from "../src/render/runtime_status.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";

/** A crypto provider that records every method call — proves the runtime calls none. */
function makeSpyCryptoProvider(): { provider: CryptoProvider; calls: string[] } {
  const calls: string[] = [];
  const deny = (): CryptoDecision => ({ allowed: false, state: "unavailable", reason: "" });
  const provider: CryptoProvider = {
    getStatus: () => {
      calls.push("getStatus");
      return { state: "unavailable", reason: "" };
    },
    getCapabilities: () => {
      calls.push("getCapabilities");
      return [];
    },
    randomBytes: async (_r: RandomBytesRequest) => {
      calls.push("randomBytes");
      return deny();
    },
    deriveKey: async (_r: DeriveKeyRequest) => {
      calls.push("deriveKey");
      return deny();
    },
    encrypt: async (_r: EncryptRequest) => {
      calls.push("encrypt");
      return deny();
    },
    decrypt: async (_r: DecryptRequest) => {
      calls.push("decrypt");
      return deny();
    },
  };
  return { provider, calls };
}

describe("Stage 65 — Crypto provider runtime env selection (disabled by default)", () => {
  it("1. overrides.cryptoProvider wins over env", () => {
    const stub = new NoopCryptoProvider();
    const envFedos: RuntimeEnv = { CRYPTO_PROVIDER: "fedos" };
    expect(selectCryptoProvider(envFedos, { cryptoProvider: stub })).toBe(stub);
    expect(createRuntime(envFedos, { cryptoProvider: stub }).cryptoProvider).toBe(stub);
    expect(selectCryptoProvider(undefined, { cryptoProvider: stub })).toBe(stub);
  });

  it("2. CRYPTO_PROVIDER=noop -> NoopCryptoProvider", () => {
    const env: RuntimeEnv = { CRYPTO_PROVIDER: "noop" };
    expect(selectCryptoProvider(env)).toBeInstanceOf(NoopCryptoProvider);
    expect(createRuntime(env).cryptoProvider).toBeInstanceOf(NoopCryptoProvider);
  });

  it("3. CRYPTO_PROVIDER=fedos -> FedosCoreCryptoProvider (placeholder core only)", () => {
    const env: RuntimeEnv = { CRYPTO_PROVIDER: "fedos" };
    const provider = selectCryptoProvider(env);
    expect(provider).toBeInstanceOf(FedosCoreCryptoProvider);
    // The injected core is the inert placeholder: still unavailable, placeholder caps.
    expect(provider.getStatus().state).toBe("unavailable");
    const caps = provider.getCapabilities();
    expect(caps.length).toBeGreaterThan(0);
    for (const cap of caps) expect(cap).toMatch(/_placeholder$/);
    expect(createRuntime(env).cryptoProvider).toBeInstanceOf(FedosCoreCryptoProvider);
  });

  it("4. ENABLE_CRYPTO_PLACEHOLDER truthy -> FedosCoreCryptoProvider", () => {
    for (const flag of ["true", "1", "yes", "on", true] as const) {
      const env: RuntimeEnv = { ENABLE_CRYPTO_PLACEHOLDER: flag };
      expect(selectCryptoProvider(env)).toBeInstanceOf(FedosCoreCryptoProvider);
    }
    // Falsy values must not opt in.
    for (const flag of ["false", "0", "no", "off", false, ""] as const) {
      const env: RuntimeEnv = { ENABLE_CRYPTO_PLACEHOLDER: flag };
      expect(selectCryptoProvider(env)).toBeInstanceOf(NoopCryptoProvider);
    }
  });

  it("5. invalid / unknown CRYPTO_PROVIDER -> NoopCryptoProvider", () => {
    for (const provider of ["aes", "rust", "wasm", "", "FEDOS", "Noop"]) {
      const env: RuntimeEnv = { CRYPTO_PROVIDER: provider };
      expect(selectCryptoProvider(env)).toBeInstanceOf(NoopCryptoProvider);
    }
  });

  it("6. disabled by default: no env -> NoopCryptoProvider", () => {
    expect(selectCryptoProvider()).toBeInstanceOf(NoopCryptoProvider);
    expect(createRuntime().cryptoProvider).toBeInstanceOf(NoopCryptoProvider);
  });

  it("7. createRuntime never calls a crypto provider method (randomBytes/deriveKey/encrypt/decrypt)", () => {
    const { provider, calls } = makeSpyCryptoProvider();
    const rt = createRuntime({ CRYPTO_PROVIDER: "fedos" }, { cryptoProvider: provider });
    expect(rt.cryptoProvider).toBe(provider);
    expect(calls).not.toContain("randomBytes");
    expect(calls).not.toContain("deriveKey");
    expect(calls).not.toContain("encrypt");
    expect(calls).not.toContain("decrypt");
  });

  it("8. createRuntime performs no WASM instantiation and issues no fetch", async () => {
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true } as Response));
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    const originalFetch = globalThis.fetch;
    (globalThis as { fetch?: unknown }).fetch = fetchSpy;
    try {
      createRuntime({ CRYPTO_PROVIDER: "fedos" });
      createRuntime({ ENABLE_CRYPTO_PLACEHOLDER: "true" });
      selectCryptoProvider({ CRYPTO_PROVIDER: "fedos" });
    } finally {
      (globalThis as { fetch?: unknown }).fetch = originalFetch;
      instantiate.mockRestore();
      compile.mockRestore();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
  });

  it("9. runtime status page shows a crypto label only, calling no provider method", () => {
    const { provider, calls } = makeSpyCryptoProvider();
    const runtime = createRuntime(undefined, { cryptoProvider: provider });
    const view = buildRuntimeStatusView(runtime);
    const crypto = view.components.find((c) => c.name === "cryptoProvider");
    expect(crypto).toBeDefined();
    expect(crypto!.category).toBe("security");
    // A coarse constructor label only; no provider method was called.
    expect(calls).toEqual([]);
  });

  it("10. Worker source runs no crypto op and no WASM loader", () => {
    expect(workerSource).not.toMatch(/\.\s*randomBytes\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*deriveKey\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*encrypt\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*decrypt\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*begin\s*\(/);
    expect(workerSource.toLowerCase()).not.toContain("wasm_loader");
  });

  it("11. runtime touches no navigator.credentials and no WebAssembly / fetch call site", () => {
    const runtimeSources = [runtimeSource, runtimeTypesSource].join("\n");
    expect(runtimeSources).not.toContain("navigator.credentials");
    expect(runtimeSources).not.toMatch(/WebAssembly\s*\.\s*(instantiate|compile)\s*\(/);
    expect(runtimeSources).not.toMatch(/\bfetch\s*\(/);
    // Building a runtime does not throw even though there is no `navigator`/WASM.
    expect(() => createRuntime({ CRYPTO_PROVIDER: "fedos" })).not.toThrow();
  });

  it("12. input env is not mutated by selectCryptoProvider or createRuntime", () => {
    const env: RuntimeEnv = {
      CRYPTO_PROVIDER: "fedos",
      ENABLE_CRYPTO_PLACEHOLDER: "true",
    };
    const before = { ...env };
    const beforeKeys = Object.keys(env).sort();
    selectCryptoProvider(env);
    createRuntime(env);
    expect(Object.keys(env).sort()).toEqual(beforeKeys);
    for (const key of beforeKeys) {
      expect(env[key as keyof RuntimeEnv]).toBe(before[key as keyof RuntimeEnv]);
    }
  });
});
