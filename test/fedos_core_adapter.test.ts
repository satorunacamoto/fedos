import { describe, it, expect } from "vitest";
import {
  PlaceholderFedosCoreCrypto,
  createFedosCoreCrypto,
  FEDOS_CORE_CAPABILITIES,
} from "../packages/fedos-core-rust/src/index.js";
import type {
  FedosCoreCrypto,
  FedosCoreDecision,
} from "../packages/fedos-core-rust/src/index.js";
import { FedosCoreCryptoProvider } from "../src/crypto/fedos_core_adapter.js";
import type { CryptoProvider, EncryptRequest } from "../src/crypto/types.js";
// Sources as strings: prove no crypto-library import and no auto-wiring.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import pkgIndexSource from "../packages/fedos-core-rust/src/index.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import pkgTypesSource from "../packages/fedos-core-rust/src/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterSource from "../src/crypto/fedos_core_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/** A FedOS core whose every method throws — proves the adapter never leaks it. */
class ThrowingFedosCore implements FedosCoreCrypto {
  getStatus(): never {
    throw new Error("boom: secret=hunter2 endpoint=https://kdf.internal");
  }
  getCapabilities(): never {
    throw new Error("boom");
  }
  async randomBytes(): Promise<FedosCoreDecision> {
    throw new Error("boom: seed leaked");
  }
  async deriveKey(): Promise<FedosCoreDecision> {
    throw new Error("boom");
  }
  async encrypt(): Promise<FedosCoreDecision> {
    throw new Error("boom");
  }
  async decrypt(): Promise<FedosCoreDecision> {
    throw new Error("boom");
  }
}

/**
 * Stage 59 — FedOS core crypto package boundary tests.
 *
 * These assert the package is a placeholder-only boundary and the host adapter
 * delegates safely: unavailable everywhere, never throws, never mutates input,
 * imports no crypto library, ships no Rust/WASM binary, and is not auto-wired.
 */
describe("fedos-core-rust package boundary", () => {
  it("1. exports a placeholder core (class + factory)", () => {
    expect(PlaceholderFedosCoreCrypto).toBeTypeOf("function");
    expect(createFedosCoreCrypto).toBeTypeOf("function");
    const core = createFedosCoreCrypto();
    expect(core).toBeInstanceOf(PlaceholderFedosCoreCrypto);
  });

  it("2. core status is unavailable", () => {
    expect(createFedosCoreCrypto().getStatus().state).toBe("unavailable");
  });

  it("3. core capabilities are placeholders only", () => {
    const caps = createFedosCoreCrypto().getCapabilities();
    expect(caps.length).toBeGreaterThan(0);
    for (const cap of caps) {
      expect(cap).toMatch(/_placeholder$/);
      expect(FEDOS_CORE_CAPABILITIES).toContain(cap);
    }
  });

  it("core operations are all denied/unavailable (no bytes produced)", async () => {
    const core = createFedosCoreCrypto();
    const decision = await core.randomBytes({ length: 32 });
    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe("unavailable");
    expect(decision).not.toHaveProperty("bytes");
    expect(decision).not.toHaveProperty("output");
  });
});

describe("FedosCoreCryptoProvider adapter", () => {
  it("4. implements the host CryptoProvider interface", () => {
    const provider: CryptoProvider = new FedosCoreCryptoProvider();
    expect(provider.getStatus).toBeTypeOf("function");
    expect(provider.getCapabilities).toBeTypeOf("function");
    expect(provider.randomBytes).toBeTypeOf("function");
    expect(provider.deriveKey).toBeTypeOf("function");
    expect(provider.encrypt).toBeTypeOf("function");
    expect(provider.decrypt).toBeTypeOf("function");
  });

  it("5. delegates getStatus / getCapabilities to the injected core", () => {
    const provider = new FedosCoreCryptoProvider(createFedosCoreCrypto());
    expect(provider.getStatus().state).toBe("unavailable");
    const caps = provider.getCapabilities();
    expect(caps.length).toBeGreaterThan(0);
    for (const cap of caps) expect(cap).toMatch(/_placeholder$/);
  });

  it("without a core, behaves like NoopCryptoProvider (unavailable, no caps)", () => {
    const provider = new FedosCoreCryptoProvider();
    expect(provider.getStatus().state).toBe("unavailable");
    expect(provider.getCapabilities()).toEqual([]);
  });

  it("6. randomBytes returns unavailable", async () => {
    const provider = new FedosCoreCryptoProvider(createFedosCoreCrypto());
    const decision = await provider.randomBytes({ length: 32 });
    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe("unavailable");
  });

  it("7. deriveKey returns unavailable", async () => {
    const provider = new FedosCoreCryptoProvider(createFedosCoreCrypto());
    const decision = await provider.deriveKey({ kdf: "hkdf" });
    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe("unavailable");
  });

  it("8. encrypt returns unavailable", async () => {
    const provider = new FedosCoreCryptoProvider(createFedosCoreCrypto());
    const decision = await provider.encrypt({ algorithm: "chacha20poly1305" });
    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe("unavailable");
  });

  it("9. decrypt returns unavailable", async () => {
    const provider = new FedosCoreCryptoProvider(createFedosCoreCrypto());
    const decision = await provider.decrypt({ algorithm: "chacha20poly1305" });
    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe("unavailable");
  });

  it("10. catches a throwing core and never leaks its error text", async () => {
    const provider = new FedosCoreCryptoProvider(new ThrowingFedosCore());
    // getStatus / getCapabilities never throw.
    expect(provider.getStatus().state).toBe("error");
    expect(provider.getStatus().reason).not.toMatch(/hunter2|kdf\.internal/);
    expect(provider.getCapabilities()).toEqual([]);
    // Every operation resolves to an error decision, never rejects.
    for (const decision of await Promise.all([
      provider.randomBytes({ length: 16 }),
      provider.deriveKey({}),
      provider.encrypt({}),
      provider.decrypt({}),
    ])) {
      expect(decision.allowed).toBe(false);
      expect(decision.state).toBe("error");
      expect(decision.reason).not.toMatch(/seed|boom|hunter2/);
    }
  });

  it("11. does not mutate the input request", async () => {
    const provider = new FedosCoreCryptoProvider(createFedosCoreCrypto());
    const request: EncryptRequest = {
      algorithm: "aes_gcm",
      keyRef: "handle-1",
      plaintextRef: "handle-2",
      aad: "v1",
    };
    const snapshot = JSON.stringify(request);
    await provider.encrypt(request);
    expect(JSON.stringify(request)).toBe(snapshot);
  });
});

describe("FedOS core is not auto-wired into the core", () => {
  it("12. Runtime source has no fedos-core auto-wire", () => {
    expect(runtimeSource.toLowerCase()).not.toContain("fedos");
  });

  it("13. Worker source has no fedos-core auto-wire", () => {
    expect(workerSource.toLowerCase()).not.toContain("fedos");
  });
});

describe("FedOS core package has no real cryptography", () => {
  it("14. imports no crypto / WASM library", () => {
    const sources = [pkgIndexSource, pkgTypesSource, adapterSource].join("\n");
    const importLines = sources
      .split("\n")
      .filter((line) => /^\s*import\b/.test(line));
    const denylist = [
      "chacha20poly1305",
      "@noble/ciphers",
      "@noble/hashes",
      "aes-gcm",
      "argon2",
      "bip39",
      "node:crypto",
      "tweetnacl",
      "libsodium",
      ".wasm",
      "wasm-bindgen",
    ];
    for (const line of importLines) {
      for (const pkg of denylist) {
        expect(line, `import must not pull in ${pkg}`).not.toContain(pkg);
      }
    }
    // The package types file imports nothing at all (fully standalone).
    expect(pkgTypesSource).not.toMatch(/^\s*import\b/m);
  });

  it("15. no WASM / Rust binary is committed to the package", () => {
    // Enumerate every committed file in the package via Vite's glob (no import,
    // keys only) — no node:fs types needed. Assert none is a WASM/Rust artifact.
    const files = (
      import.meta as unknown as {
        glob: (pattern: string) => Record<string, unknown>;
      }
    ).glob("../packages/fedos-core-rust/**/*");
    const paths = Object.keys(files);
    // Sanity: the glob actually found the package's committed files.
    expect(paths.some((p) => p.endsWith("/src/index.ts"))).toBe(true);
    const forbidden = /\.(wasm|rs|rlib|so|dll|dylib|node|a|o)$/i;
    const forbiddenName = /\/(Cargo\.toml|Cargo\.lock)$/i;
    for (const path of paths) {
      expect(forbidden.test(path), `unexpected binary: ${path}`).toBe(false);
      expect(forbiddenName.test(path), `unexpected Rust file: ${path}`).toBe(
        false,
      );
    }
  });
});
