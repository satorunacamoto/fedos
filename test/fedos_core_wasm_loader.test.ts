import { describe, it, expect, vi } from "vitest";
import {
  NoopFedosCoreWasmLoader,
  PlaceholderFedosCoreWasmLoader,
  PlaceholderFedosCoreCrypto,
  fedosCoreWasmDecisionToCore,
  loadFedosCoreWasm,
  FEDOS_CORE_WASM_LOADER_CAPABILITIES,
} from "../packages/fedos-core-rust/src/index.js";
import type {
  FedosCoreWasmLoader,
  FedosCoreWasmLoadRequest,
} from "../packages/fedos-core-rust/src/index.js";
// Sources as strings: prove no crypto/WASM instantiate/fetch/dynamic-import and
// no auto-wiring into the host.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../packages/fedos-core-rust/src/wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
import { fedosCoreRustGitTrackedPaths } from "./support/fedos_core_rust_git_tracked_paths.js";

/** A loader whose load() throws — proves the safe wrapper never propagates it. */
class ThrowingWasmLoader implements FedosCoreWasmLoader {
  getStatus() {
    return { state: "error" as const, reason: "" };
  }
  getCapabilities() {
    return [];
  }
  async load(): Promise<never> {
    throw new Error("boom: url=https://cdn.internal/core.wasm integrity=sha384-secret");
  }
  unload() {
    return { allowed: false, state: "error" as const, reason: "" };
  }
}

describe("Stage 63 — FedOS Core WASM loader boundary (disabled by default)", () => {
  it("1. Noop loader is permanently disabled / allowed false", async () => {
    const loader = new NoopFedosCoreWasmLoader();
    expect(loader.getStatus().state).toBe("disabled");
    expect(loader.getCapabilities()).toEqual([]);
    const decision = await loader.load({ source: "placeholder" });
    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe("disabled");
    expect(decision.core).toBeUndefined();
    expect(loader.unload().state).toBe("disabled");
  });

  it("2. Placeholder loader constructor does nothing (starts unloaded, no core)", () => {
    const loader = new PlaceholderFedosCoreWasmLoader();
    expect(loader.getStatus().state).toBe("unloaded");
    const caps = loader.getCapabilities();
    expect(caps.length).toBeGreaterThan(0);
    for (const cap of caps) {
      expect(cap).toMatch(/_placeholder$/);
      expect(FEDOS_CORE_WASM_LOADER_CAPABILITIES).toContain(cap);
    }
  });

  it("3. load does not fetch", async () => {
    const spy = vi.fn(() => Promise.resolve({ ok: true } as Response));
    const original = globalThis.fetch;
    (globalThis as { fetch?: unknown }).fetch = spy;
    try {
      const loader = new PlaceholderFedosCoreWasmLoader();
      await loader.load({ source: "placeholder", moduleRef: "core", integrityRef: "sri" });
      await new NoopFedosCoreWasmLoader().load({ source: "placeholder" });
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
    // Belt-and-braces: the source never references fetch at all.
    expect(wasmLoaderSource).not.toMatch(/\bfetch\s*\(/);
  });

  it("4. load does not call WebAssembly.instantiate / compile", async () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      const loader = new PlaceholderFedosCoreWasmLoader();
      await loader.load({ source: "placeholder" });
    } finally {
      instantiate.mockRestore();
      compile.mockRestore();
    }
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
    expect(wasmLoaderSource).not.toContain("WebAssembly");
  });

  it("5. load returns the inert placeholder core only", async () => {
    const loader = new PlaceholderFedosCoreWasmLoader();
    const decision = await loader.load({ source: "placeholder" });
    expect(decision.allowed).toBe(true);
    expect(decision.state).toBe("loaded_placeholder");
    expect(decision.core).toBeInstanceOf(PlaceholderFedosCoreCrypto);
    // The "loaded" core is itself permanently unavailable — no real crypto.
    expect(decision.core?.getStatus().state).toBe("unavailable");
    // No bytes/module/url is ever exposed on the decision.
    expect(decision).not.toHaveProperty("bytes");
    expect(decision).not.toHaveProperty("module");
    expect(decision).not.toHaveProperty("url");
    // Bridge helper extracts exactly that core (and undefined when disabled).
    expect(fedosCoreWasmDecisionToCore(decision)).toBe(decision.core);
    const disabled = await loader.load({ source: "disabled" });
    expect(disabled.allowed).toBe(false);
    expect(disabled.state).toBe("disabled");
    expect(fedosCoreWasmDecisionToCore(disabled)).toBeUndefined();
  });

  it("6. moduleRef / integrityRef are opaque labels, never resolved or echoed", async () => {
    const loader = new PlaceholderFedosCoreWasmLoader();
    const request: FedosCoreWasmLoadRequest = {
      source: "placeholder",
      moduleRef: "https://cdn.example/core.wasm",
      integrityRef: "sha384-shouldNotAppear",
    };
    const withRefs = await loader.load(request);
    const withoutRefs = await loader.load({ source: "placeholder" });
    // Behavior is identical regardless of the labels — they are not resolved.
    expect(withRefs.state).toBe(withoutRefs.state);
    expect(withRefs.allowed).toBe(withoutRefs.allowed);
    // The reason never echoes the label values (no leaked URL/hash).
    expect(withRefs.reason).not.toContain("cdn.example");
    expect(withRefs.reason).not.toContain("sha384-shouldNotAppear");
  });

  it("7. unload changes state only (drops any placeholder core)", async () => {
    const loader = new PlaceholderFedosCoreWasmLoader();
    await loader.load({ source: "placeholder" });
    expect(loader.getStatus().state).toBe("loaded_placeholder");
    const decision = loader.unload();
    expect(decision.state).toBe("unloaded");
    expect(decision.allowed).toBe(false);
    expect(decision.core).toBeUndefined();
    expect(loader.getStatus().state).toBe("unloaded");
  });

  it("8. loader errors are caught by loadFedosCoreWasm (never thrown, never leaked)", async () => {
    const decision = await loadFedosCoreWasm(new ThrowingWasmLoader(), {
      source: "placeholder",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe("error");
    expect(decision.core).toBeUndefined();
    expect(decision.reason).not.toMatch(/cdn\.internal|sha384-secret|boom|\.wasm/);
  });

  it("9. does not mutate the input request", async () => {
    const loader = new PlaceholderFedosCoreWasmLoader();
    const request: FedosCoreWasmLoadRequest = {
      source: "placeholder",
      moduleRef: "handle-1",
      integrityRef: "handle-2",
    };
    const snapshot = JSON.stringify(request);
    await loader.load(request);
    await loadFedosCoreWasm(loader, request);
    expect(JSON.stringify(request)).toBe(snapshot);
  });
});

describe("FedOS Core WASM loader is not auto-wired into the core", () => {
  // Stage 65 lets `createRuntime` SELECT a crypto provider (whose FedOS option
  // wraps only the inert `PlaceholderFedosCoreCrypto`) — so the runtime docstrings
  // now legitimately mention WASM. What must stay absent is the LOADER itself:
  // no `FedosCoreWasmLoader`, no `wasm_loader` import, and no `.load(` call.
  it("10. Runtime source wires no WASM loader (placeholder core only)", () => {
    const src = runtimeSource.toLowerCase();
    expect(src).not.toContain("fedoscorewasmloader");
    expect(src).not.toContain("wasm_loader");
    expect(runtimeSource).not.toMatch(/\.\s*load\s*\(/);
  });

  it("11. Worker source has no WASM loader auto-wire", () => {
    const src = workerSource.toLowerCase();
    expect(src).not.toContain("wasm_loader");
    expect(src).not.toContain("fedoscorewasmloader");
  });
});

describe("FedOS Core WASM loader ships no WASM/Rust and no cryptography", () => {
  it("12. no .wasm file is committed to the package", () => {
    const paths = fedosCoreRustGitTrackedPaths();
    expect(paths.some((p) => p.endsWith("/src/wasm_loader.ts"))).toBe(true);
    for (const path of paths) {
      expect(/\.wasm$/i.test(path), `unexpected WASM binary: ${path}`).toBe(false);
    }
  });

  it("13. a Rust crate skeleton is allowed, but no compiled/build artifacts", () => {
    // Stage 69 adds a minimal Rust crate skeleton (Cargo.toml + src/lib.rs). What
    // must stay absent is any COMPILED output: no `.wasm`, no `.rlib`/`.so`/
    // `.dll`/`.dylib`/`.node`/`.a`/`.o`, and no `target/`/`build/` artifacts.
    // `Cargo.lock` is the one deliberate exception -- it is now intentionally
    // tracked, see docs/secure_runtime_p0_closure_cargo_lock_policy_supersession.md.
    const paths = fedosCoreRustGitTrackedPaths();
    // Positive proof of the stated exception: Cargo.lock IS tracked.
    expect(paths.some((path) => path.endsWith("/Cargo.lock"))).toBe(true);
    const forbidden = /\.(wasm|rlib|so|dll|dylib|node|a|o)$/i;
    const forbiddenDir = /\/(target|build)\//i;
    for (const path of paths) {
      expect(forbidden.test(path), `unexpected compiled artifact: ${path}`).toBe(false);
      expect(forbiddenDir.test(path), `unexpected build dir artifact: ${path}`).toBe(false);
    }
  });

  it("14. imports no crypto / WASM library", () => {
    const importLines = wasmLoaderSource
      .split("\n")
      .filter((line: string) => /^\s*import\b/.test(line));
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
      "hkdf",
    ];
    for (const line of importLines) {
      for (const pkg of denylist) {
        expect(line.toLowerCase(), `import must not pull in ${pkg}`).not.toContain(pkg);
      }
    }
  });

  it("15. performs no dynamic import()", () => {
    expect(wasmLoaderSource).not.toMatch(/\bimport\s*\(/);
    expect(wasmLoaderSource).not.toMatch(/await\s+import\b/);
  });
});
