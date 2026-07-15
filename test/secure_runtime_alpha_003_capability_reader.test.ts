import { describe, it, expect, vi } from "vitest";
// This project's tsconfig.json carries no `@types/node`; declared
// ambient here the same way `fedos_runtime_prototype_execution.ts` itself does.
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
import { createRuntime, createRuntimeInitializeCryptoResult } from "../src/runtime/create_runtime.js";
import {
  runtimeCapabilities,
  attemptDevOnlyRuntimeRustIntegration,
} from "../src/runtime/fedos_runtime_prototype_execution.js";
import { FedosWasmLoaderSkeleton } from "../src/runtime/fedos_wasm_loader.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_003_capability_reader.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import surfaceReviewDocSource from "../docs/secure_runtime_alpha_002_public_surface_review.md?raw";
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
import runtimeDiagnosticsSource from "../src/runtime/runtime_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerDiagnosticsSource from "../src/runtime/worker_crypto_diagnostics.ts?raw";
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
 * Secure Runtime Alpha 003 — "Runtime Capability Reader": adds
 * `runtimeCapabilities()` (Stage 999), the FIRST read-only field wired
 * into `AppRuntime`, backed EXCLUSIVELY by the existing
 * `attemptDevOnlyRuntimeRustIntegration()` (Stage 994, unmodified).
 * `initializeCrypto()`'s own contract stays byte-for-byte unchanged.
 */
describe("Secure Runtime Alpha 003 -- runtimeCapabilities() Runtime Capability Reader, Fail Closed everywhere else (Stage 999)", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  // Awaits `fn()`'s own result INSIDE the `try` (not `return fn()`,
  // which would let `finally` run as soon as the returned promise is
  // merely CREATED, before it settles) -- required here because
  // `runtimeCapabilities()` reads `NODE_ENV` (via `determineRuntimeState()`)
  // only AFTER its own internal `await attemptDevOnlyRuntimeRustIntegration()`
  // chain resolves, unlike `FedosWasmLoader.planLoad()`'s synchronous,
  // up-front read.
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

  it("1. against the REAL (unmocked) repo state, runtimeCapabilities() reports rustReachable:false, rustVersion:null, prototypeCompleted:true", async () => {
    const caps = await withNodeEnv("development", () => runtimeCapabilities());
    expect(caps.prototypeCompleted).toBe(true);
    expect(caps.rustReachable).toBe(false);
    expect(caps.rustVersion).toBeNull();
  });

  it("2. runtimeMode reflects NODE_ENV -- development/production/otherwise-Unknown (renamed from runtimeState/\"Prototype\" by Stage 1001, Secure Runtime Alpha 005 -- see test/secure_runtime_alpha_005_runtime_state_naming_cleanup.test.ts)", async () => {
    const devCaps = await withNodeEnv("development", () => runtimeCapabilities());
    expect(devCaps.runtimeMode).toBe("Development");

    const prodCaps = await withNodeEnv("production", () => runtimeCapabilities());
    expect(prodCaps.runtimeMode).toBe("Production");

    const otherCaps = await withNodeEnv(undefined, () => runtimeCapabilities());
    expect(otherCaps.runtimeMode).toBe("Unknown");

    const testCaps = await withNodeEnv("test", () => runtimeCapabilities());
    expect(testCaps.runtimeMode).toBe("Unknown");
  });

  it("3. RuntimeCapabilities carries exactly four fields", async () => {
    const caps = await runtimeCapabilities();
    expect(Object.keys(caps).sort()).toEqual(["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort());
  });

  it("4. createRuntime()'s own assembled AppRuntime exposes runtimeCapabilities as an async function, alongside the unchanged initializeCrypto", () => {
    const runtime = createRuntime();
    expect(typeof runtime.runtimeCapabilities).toBe("function");
    expect(runtime.initializeCrypto).toBe(createRuntimeInitializeCryptoResult);
  });

  it("5. calling runtime.runtimeCapabilities() via the real AppRuntime object works end-to-end", async () => {
    const runtime = createRuntime();
    const caps = await withNodeEnv("development", () => runtime.runtimeCapabilities());
    expect(caps.prototypeCompleted).toBe(true);
    expect(typeof caps.rustReachable).toBe("boolean");
  });

  it("6. initializeCrypto()'s own return value is byte-for-byte unaffected by calling runtimeCapabilities() first", async () => {
    await runtimeCapabilities();
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision).toEqual({ allowed: false, initialized: false, reason: "PrototypeDisabled" });
  });

  it("7. allowed/initialized/reason each individually stay fixed regardless of this stage's addition", () => {
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision.allowed).toBe(false);
    expect(decision.initialized).toBe(false);
    expect(decision.reason).toBe("PrototypeDisabled");
  });

  it("8. runtimeCapabilities() succeeds end-to-end with real, string-returning module.version() (injected loader), and Fails Closed with no throw when it is absent", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const okLoader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({
            initSync: vi.fn(() => ({})),
            version: () => "fedos-core-rust/0.0.0",
          }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        const okState = await attemptDevOnlyRuntimeRustIntegration(okLoader);
        expect(okState).toEqual({ reachedRust: true, rustVersion: "fedos-core-rust/0.0.0" });

        const failLoader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({ initSync: vi.fn(() => ({})) }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        await expect(attemptDevOnlyRuntimeRustIntegration(failLoader)).resolves.toEqual({
          reachedRust: false,
          rustVersion: null,
        });
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("9. runtimeCapabilities() calls attemptDevOnlyRuntimeRustIntegration() -- its OWN source references no other Rust-reach method directly", () => {
    const codeOnly = codeOnlyLines(runtimeIntegrationSource);
    const fnMatch = codeOnly.match(/async function runtimeCapabilities\(\): Promise<RuntimeCapabilities> \{[\s\S]*?\n\}/);
    expect(fnMatch).not.toBeNull();
    const fnBody = (fnMatch as RegExpMatchArray)[0] ?? "";
    expect(fnBody.length).toBeGreaterThan(0);
    expect(fnBody).toMatch(/attemptDevOnlyRuntimeRustIntegration\(\)/);
    expect(fnBody).not.toMatch(/attemptDevOnlyRustVersionCall/);
    expect(fnBody).not.toMatch(/attemptDevOnlyJsGlueImport/);
    expect(fnBody).not.toMatch(/attemptDevOnlyWasmInitialization/);
    expect(fnBody).not.toMatch(/createFedosWasmLoader/);
  });

  it("10. runtimeCapabilities() is the ONLY new export wired into AppRuntime this stage -- exactly two exported members from fedos_runtime_prototype_execution.ts", () => {
    const exportedFns = [...runtimeIntegrationSource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedFns)).toEqual(new Set(["attemptDevOnlyRuntimeRustIntegration", "runtimeCapabilities"]));
    const exportedInterfaces = [...runtimeIntegrationSource.matchAll(/^export interface (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedInterfaces)).toEqual(
      new Set(["RuntimePrototypeExecutionState", "RuntimeCapabilities"]),
    );
  });

  it("11. src/runtime/types.ts declares runtimeCapabilities as the only new AppRuntime field this stage, initializeCrypto's own field untouched", () => {
    expect(runtimeTypesSource).toMatch(/readonly runtimeCapabilities: \(\) => Promise<RuntimeCapabilities>;/);
    expect(runtimeTypesSource).toMatch(/readonly initializeCrypto: \(\) => RuntimeInitializeCryptoResult;/);
  });

  it("12. no new Rust API is referenced anywhere in the new function's own code -- no encrypt/decrypt/randomBytes/deriveKey", () => {
    const codeOnly = codeOnlyLines(runtimeIntegrationSource);
    expect(codeOnly).not.toMatch(/\bencrypt\b/i);
    expect(codeOnly).not.toMatch(/\bdecrypt\b/i);
    expect(codeOnly).not.toMatch(/randomBytes/i);
    expect(codeOnly).not.toMatch(/deriveKey/i);
  });

  it("13. Worker remains fully unconnected -- src/worker.ts references neither runtimeCapabilities nor the Rust-reach chain", () => {
    expect(workerSource).not.toMatch(/runtimeCapabilities/);
    expect(workerSource).not.toMatch(/attemptDevOnlyRuntimeRustIntegration/);
    expect(workerSource).not.toMatch(/fedos_runtime_prototype_execution/);
  });

  it("14. Production is unaffected beyond the ONE new field -- create_runtime.ts references nothing else from the Rust-reach chain", () => {
    expect(createRuntimeSource).not.toMatch(/attemptDevOnlyRustVersionCall/);
    expect(createRuntimeSource).not.toMatch(/attemptDevOnlyJsGlueImport/);
    expect(createRuntimeSource).not.toMatch(/attemptDevOnlyWasmInitialization/);
    expect(createRuntimeSource).not.toMatch(/RuntimePrototypeExecutionState/);
  });

  it("15. no Secure Storage / persistence API of any kind in the new function's own code", () => {
    const codeOnly = codeOnlyLines(runtimeIntegrationSource);
    expect(codeOnly).not.toMatch(/localStorage|sessionStorage|indexedDB|writeFile/i);
  });

  it("16. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still exactly seven Plan interfaces", () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);
  });

  it("17. Fail Closed is confirmed maintained -- FedosWasmLoader.planLoad() still resolves BlockedByPolicy", async () => {
    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("18. Rust/Cargo/package sources are unchanged -- still 28 pub fn, one #[wasm_bindgen], 11/2 dependencies", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(44);
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

  it("19. neither diagnostics file gained a field or reference from this stage", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(/runtimeCapabilities|RuntimeCapabilities/);
    expect(workerDiagnosticsSource).not.toMatch(/runtimeCapabilities|RuntimeCapabilities/);
  });

  it("20. the design doc exists, is substantial, and states what this Phase does NOT do", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `initializeCrypto\(\)`'s return contract/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* connect to Worker/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add Secure Storage of any kind/);
  });

  it("21. cross-references the Alpha 002 review this Phase implements and the Stage 994 integration it reuses", () => {
    expect(designDocSource).toMatch(/secure_runtime_alpha_002_public_surface_review\.md/);
    expect(designDocSource).toMatch(/runtime_prototype_execution_runtime_integration\.md/);
    expect(surfaceReviewDocSource).toMatch(/runtimeCapabilities\(\)/);
  });
});
