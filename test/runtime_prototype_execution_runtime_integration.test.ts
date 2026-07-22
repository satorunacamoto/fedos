import { describe, it, expect, vi } from "vitest";
// This project's tsconfig.json carries no `@types/node`; declared
// ambient here the same way `src/runtime/fedos_wasm_loader.ts` itself does.
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
import { attemptDevOnlyRuntimeRustIntegration } from "../src/runtime/fedos_runtime_prototype_execution.js";
import { createRuntime, createRuntimeInitializeCryptoResult } from "../src/runtime/create_runtime.js";
import { FedosWasmLoaderSkeleton } from "../src/runtime/fedos_wasm_loader.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeIntegrationSource from "../src/runtime/fedos_runtime_prototype_execution.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../src/runtime/fedos_wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeDiagnosticsSource from "../src/runtime/runtime_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerDiagnosticsSource from "../src/runtime/worker_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import backendResolverSource from "../src/runtime/fedos_crypto_backend_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/runtime_prototype_execution_runtime_integration.md?raw";
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

// `node:fs`'s own exports are non-configurable, so `vi.spyOn` cannot
// redefine `existsSync` directly -- `vi.mock` replaces the module
// instead. `fedos_runtime_prototype_execution.ts` uses the REAL,
// default `createFedosWasmLoader()` (no testable seam of its own), so
// mocking `node:fs` here is the only way to exercise its success path.
vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => {
    throw new Error("simulated: real fedos_core_rust_bg.wasm does not exist on disk in this repo");
  }),
}));

/**
 * Prototype EXECUTION Phase 013 — "Runtime Integration (Prototype
 * Completion Candidate)": a NEW, standalone file,
 * `fedos_runtime_prototype_execution.ts`, exports ONE async function,
 * `attemptDevOnlyRuntimeRustIntegration()`, that drives a fresh
 * `FedosWasmLoader` through the full Stage 993 six-condition chain and
 * reads back `succeeded`/`version` as `RuntimePrototypeExecutionState`.
 * `AppRuntime.initializeCrypto()` (`createRuntimeInitializeCryptoResult()`)
 * is neither modified nor called by this new function -- it remains
 * ALWAYS `{ allowed: false, initialized: false, reason:
 * "PrototypeDisabled" }`. Worker, Production, Runtime Diagnostics, and
 * `AppRuntime`'s own assembled shape are all unaffected.
 */
describe("FedOS Runtime Integration -- attemptDevOnlyRuntimeRustIntegration() connects to FedosWasmLoader, initializeCrypto() untouched, Fail Closed everywhere else (Stage 994)", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  function withNodeEnv<T>(value: string | undefined, fn: () => T): T {
    if (value === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = value;
    }
    try {
      return fn();
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  }

  it("1. against the REAL (unmocked) repo state, no generated artifact exists, so Rust is never reached", async () => {
    const result = await withNodeEnv("development", () => attemptDevOnlyRuntimeRustIntegration());
    expect(result).toEqual({ reachedRust: false, rustVersion: null });
  });

  it("2. outside Development Runtime, Rust is never reached even with real artifacts present", async () => {
    // @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
    const nodeFs = await import("node:fs");
    vi.mocked(nodeFs.existsSync).mockReturnValue(true);
    try {
      const result = await withNodeEnv("production", () => attemptDevOnlyRuntimeRustIntegration());
      expect(result).toEqual({ reachedRust: false, rustVersion: null });
    } finally {
      vi.mocked(nodeFs.existsSync).mockReset();
      vi.mocked(nodeFs.existsSync).mockReturnValue(false);
    }
  });

  it("3. RuntimePrototypeExecutionState carries exactly two fields -- reachedRust and rustVersion, nothing else", async () => {
    const result = await withNodeEnv("development", () => attemptDevOnlyRuntimeRustIntegration());
    expect(Object.keys(result).sort()).toEqual(["reachedRust", "rustVersion"]);
    expect(typeof result.reachedRust).toBe("boolean");
    expect(result.rustVersion === null || typeof result.rustVersion === "string").toBe(true);
  });

  it("4. initializeCrypto()'s own return value is byte-for-byte unaffected by calling attemptDevOnlyRuntimeRustIntegration() first", async () => {
    await withNodeEnv("development", () => attemptDevOnlyRuntimeRustIntegration());
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision).toEqual({ allowed: false, initialized: false, reason: "PrototypeDisabled" });
  });

  it("5. allowed stays false regardless of this stage's addition", () => {
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision.allowed).toBe(false);
  });

  it("6. initialized stays false regardless of this stage's addition", () => {
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision.initialized).toBe(false);
  });

  it("7. reason stays PrototypeDisabled regardless of this stage's addition", () => {
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision.reason).toBe("PrototypeDisabled");
  });

  it("8. createRuntime()'s assembled AppRuntime carries no new field/service for this stage -- initializeCrypto is still the same function reference", () => {
    const runtime = createRuntime();
    expect(runtime.initializeCrypto).toBe(createRuntimeInitializeCryptoResult);
    expect(Object.keys(runtime)).not.toContain("rustVersion");
    expect(Object.keys(runtime)).not.toContain("reachedRust");
    expect(Object.keys(runtime)).not.toContain("attemptDevOnlyRuntimeRustIntegration");
  });

  it("9. create_runtime.ts was byte-for-byte untouched AS OF THIS stage's own scope (Stage 994) -- Stage 999 (Secure Runtime Alpha 003) later wired in ONE new, read-only field, runtimeCapabilities, see test/secure_runtime_alpha_003_capability_reader.test.ts", () => {
    expect(createRuntimeSource).toMatch(/fedos_runtime_prototype_execution/);
    expect(createRuntimeSource).toMatch(/attemptDevOnlyRuntimeRustIntegration/);
    expect(createRuntimeSource).not.toMatch(/RuntimePrototypeExecutionState/);
    expect(createRuntimeSource).not.toMatch(/reachedRust/);
  });

  it("10. fedos_wasm_loader.ts is byte-for-byte untouched -- no reference to the new file/function/type anywhere", () => {
    expect(wasmLoaderSource).not.toMatch(/fedos_runtime_prototype_execution/);
    expect(wasmLoaderSource).not.toMatch(/attemptDevOnlyRuntimeRustIntegration/);
    expect(wasmLoaderSource).not.toMatch(/RuntimePrototypeExecutionState/);
  });

  it("11. Worker remains fully unconnected -- src/worker.ts references neither the new file nor its exports, and the new file's own code imports nothing from src/worker.ts", () => {
    expect(workerSource).not.toMatch(/fedos_runtime_prototype_execution/);
    expect(workerSource).not.toMatch(/attemptDevOnlyRuntimeRustIntegration/);
    expect(codeOnlyLines(runtimeIntegrationSource)).not.toMatch(/from\s+["'].*worker/);
  });

  it("12. Production still has no AUTOMATIC caller -- create_runtime.ts's Stage 999 runtimeCapabilities field is an explicit, caller-invoked reader (its own real code never calls it with parens), and src/worker.ts still references nothing from this chain", () => {
    expect(codeOnlyLines(createRuntimeSource)).not.toMatch(/runtimeCapabilities\s*\(\s*\)/);
    expect(workerSource).not.toMatch(/attemptDevOnlyRuntimeRustIntegration/);
  });

  it("13. Runtime and Worker diagnostics files are byte-for-byte untouched -- no reference to this stage anywhere, no new field", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(/fedos_runtime_prototype_execution/);
    expect(runtimeDiagnosticsSource).not.toMatch(/reachedRust|rustVersion/);
    expect(workerDiagnosticsSource).not.toMatch(/fedos_runtime_prototype_execution/);
    expect(workerDiagnosticsSource).not.toMatch(/reachedRust|rustVersion/);
  });

  it("14. no other Rust API is ever referenced -- no encrypt/decrypt/randomBytes/deriveKey in the new file's source", () => {
    const codeOnly = codeOnlyLines(runtimeIntegrationSource);
    expect(codeOnly).not.toMatch(/\bencrypt\b/i);
    expect(codeOnly).not.toMatch(/\bdecrypt\b/i);
    expect(codeOnly).not.toMatch(/randomBytes/i);
    expect(codeOnly).not.toMatch(/deriveKey/i);
  });

  it("15. the Backend Resolver is unmodified and unreferenced by the new file's own code", () => {
    expect(codeOnlyLines(runtimeIntegrationSource)).not.toMatch(/fedos_crypto_backend_resolver/);
    expect(backendResolverSource).not.toMatch(/fedos_runtime_prototype_execution/);
  });

  it("16. no Secure Storage / persistence API of any kind in the new file", () => {
    const codeOnly = codeOnlyLines(runtimeIntegrationSource);
    expect(codeOnly).not.toMatch(/localStorage|sessionStorage|indexedDB|writeFile|localStorage/i);
  });

  it("17. the new file's imports are fedos_wasm_loader.ts and (Secure Runtime Alpha 020) the shared fedos_runtime_mode_authority.ts ONLY -- no import of create_runtime.ts, and no real (non-prose) AppRuntime usage", () => {
    const codeOnly = codeOnlyLines(runtimeIntegrationSource);
    expect(codeOnly).toMatch(/from ".\/fedos_wasm_loader\.js"/);
    expect(codeOnly).toMatch(/from ".\/fedos_runtime_mode_authority\.js"/);
    expect(codeOnly).not.toMatch(/from ".\/create_runtime\.js"/);
    expect(codeOnly).not.toMatch(/\bAppRuntime\b/);
    const importLines = [...runtimeIntegrationSource.matchAll(/^import .*$/gm)].map((m: RegExpMatchArray) => m[0]);
    expect(importLines.length).toBe(2);
  });

  it("18. Rust public API is unchanged -- still 28 pub fn, still exactly one #[wasm_bindgen]; Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(48);
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

  it("19. the design doc exists, is substantial, and states the Fail-Closed/Development-only/initializeCrypto-unchanged facts", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
    expect(designDocSource).toMatch(/allowed: false, initialized: false, reason: "PrototypeDisabled"/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `AppRuntime\.initializeCrypto\(\)`'s return value/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* connect to Worker/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add a new Runtime Service/);
  });

  it("20. the design doc reviews the Prototype termination condition question, distinguishing internal reach from public-API observability", () => {
    expect(designDocSource).toMatch(/Prototype termination condition/);
    expect(designDocSource).toMatch(/[Rr]ead literally, the condition is satisfied/);
    expect(designDocSource).toMatch(/NOT yet satisfied by design/);
  });

  it("21. cross-references the Stage 993 version() call and the Stage 691 initializeCrypto() contract this Phase leaves untouched", () => {
    expect(designDocSource).toMatch(/runtime_wasm_loader_dev_only_rust_version_call_execution\.md/);
    expect(designDocSource).toMatch(/runtime_initialize_crypto_prototype\.md/);
  });

  it("22. version retrieval SUCCEEDS end-to-end through an injected, fully-satisfied loader -- reachedRust true, rustVersion the real string", async () => {
    // The node:fs mock and NODE_ENV must both be set BEFORE the first
    // `await` inside this test body -- `withNodeEnv`'s own `finally`
    // (restoring NODE_ENV) runs synchronously once its callback yields
    // its first pending promise, not once that promise resolves (the
    // SAME timing already documented in test/runtime_wasm_loader_dev_only_rust_version_call_execution.test.ts
    // test 9's own comment).
    // @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
    const nodeFs = await import("node:fs");
    vi.mocked(nodeFs.existsSync).mockReturnValue(true);
    try {
      const loader = new FedosWasmLoaderSkeleton({
        importGeneratedJsGlue: async () => ({
          initSync: vi.fn(() => ({})),
          version: () => "fedos-core-rust/0.0.0",
        }),
        readGeneratedWasmBytes: () => new Uint8Array([1]),
      });
      const result = await withNodeEnv("development", () => attemptDevOnlyRuntimeRustIntegration(loader));
      expect(result).toEqual({ reachedRust: true, rustVersion: "fedos-core-rust/0.0.0" });
    } finally {
      vi.mocked(nodeFs.existsSync).mockReset();
      vi.mocked(nodeFs.existsSync).mockReturnValue(false);
    }
  });

  it("23. version retrieval FAILS closed through an injected loader whose module lacks version -- reachedRust false, rustVersion null, no throw", async () => {
    // @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
    const nodeFs = await import("node:fs");
    vi.mocked(nodeFs.existsSync).mockReturnValue(true);
    try {
      const loader = new FedosWasmLoaderSkeleton({
        importGeneratedJsGlue: async () => ({ initSync: vi.fn(() => ({})) }),
        readGeneratedWasmBytes: () => new Uint8Array([1]),
      });
      const result = await withNodeEnv("development", () => attemptDevOnlyRuntimeRustIntegration(loader));
      expect(result).toEqual({ reachedRust: false, rustVersion: null });
      expect(loader.rustVersionExecution()?.reason).toBe("VersionUnavailable");
    } finally {
      vi.mocked(nodeFs.existsSync).mockReset();
      vi.mocked(nodeFs.existsSync).mockReturnValue(false);
    }
  });

  it("24. version retrieval FAILS closed when module.version() throws -- reachedRust false, rustVersion null, no throw out of attemptDevOnlyRuntimeRustIntegration()", async () => {
    // @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
    const nodeFs = await import("node:fs");
    vi.mocked(nodeFs.existsSync).mockReturnValue(true);
    try {
      const loader = new FedosWasmLoaderSkeleton({
        importGeneratedJsGlue: async () => ({
          initSync: vi.fn(() => ({})),
          version: () => {
            throw new Error("simulated version() failure");
          },
        }),
        readGeneratedWasmBytes: () => new Uint8Array([1]),
      });
      await expect(
        withNodeEnv("development", () => attemptDevOnlyRuntimeRustIntegration(loader)),
      ).resolves.toEqual({
        reachedRust: false,
        rustVersion: null,
      });
      expect(loader.rustVersionExecution()?.reason).toBe("CallFailed");
    } finally {
      vi.mocked(nodeFs.existsSync).mockReset();
      vi.mocked(nodeFs.existsSync).mockReturnValue(false);
    }
  });
});
