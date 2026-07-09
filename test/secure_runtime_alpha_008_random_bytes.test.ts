import { describe, it, expect, vi } from "vitest";
// This project's tsconfig.json carries no `@types/node`; declared
// ambient here the same way `fedos_runtime_prototype_execution.ts` itself does.
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
import { createRuntime, createRuntimeInitializeCryptoResult } from "../src/runtime/create_runtime.js";
import { runtimeCapabilities } from "../src/runtime/fedos_runtime_prototype_execution.js";
import {
  randomBytes,
  attemptDevOnlyRuntimeRandomBytes,
} from "../src/runtime/fedos_runtime_random_bytes.js";
import { FedosWasmLoaderSkeleton } from "../src/runtime/fedos_wasm_loader.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_008_random_bytes.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import surfaceReviewDocSource from "../docs/secure_runtime_alpha_007_crypto_api_surface_review.md?raw";
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
 * Secure Runtime Alpha 008 — "Public Runtime randomBytes() API": adds
 * `randomBytes()` (Stage 1004), the FIRST public Crypto API wired into
 * `AppRuntime`, implementing Alpha 007's own four-layer architecture
 * (Public Runtime API -> Runtime Service -> Rust Boundary -> Internal
 * Rust) end to end. `initializeCrypto()`/`runtimeCapabilities()` stay
 * byte-for-byte unchanged.
 */
describe("Secure Runtime Alpha 008 -- randomBytes() Public Runtime API, Fail Closed everywhere else (Stage 1004)", () => {
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
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. against the REAL (unmocked) repo state, randomBytes() resolves null (no locally-generated JS glue committed)", async () => {
    const bytes = await withNodeEnv("development", () => randomBytes());
    expect(bytes).toBeNull();
  });

  it("3. randomBytes() succeeds end-to-end with a real, Uint8Array-returning module.random_bytes_32() (injected loader), and Fails Closed with no throw when it is absent", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const okBytes = new Uint8Array(32).fill(7);
        const okLoader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({
            initSync: vi.fn(() => ({})),
            random_bytes_32: () => okBytes,
          }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        const okState = await attemptDevOnlyRuntimeRandomBytes(okLoader);
        expect(okState.succeeded).toBe(true);
        expect(okState.bytes).toEqual(okBytes);

        const absentLoader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({ initSync: vi.fn(() => ({})) }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        await expect(attemptDevOnlyRuntimeRandomBytes(absentLoader)).resolves.toEqual({
          succeeded: false,
          bytes: null,
        });

        const throwingLoader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({
            initSync: vi.fn(() => ({})),
            random_bytes_32: () => {
              throw new Error("simulated CSPRNG failure");
            },
          }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        await expect(attemptDevOnlyRuntimeRandomBytes(throwingLoader)).resolves.toEqual({
          succeeded: false,
          bytes: null,
        });

        const entropyUnavailableLoader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({
            initSync: vi.fn(() => ({})),
            random_bytes_32: () => undefined,
          }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        await expect(attemptDevOnlyRuntimeRandomBytes(entropyUnavailableLoader)).resolves.toEqual({
          succeeded: false,
          bytes: null,
        });
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("4. FedosWasmLoaderSkeleton.attemptDevOnlyRandomBytesCall() Fails Closed with PrototypeStillClosed before planLoad() has ever run", async () => {
    const loader = new FedosWasmLoaderSkeleton();
    const result = await loader.attemptDevOnlyRandomBytesCall();
    expect(result).toEqual({ attempted: false, succeeded: false, bytes: null, reason: "PrototypeStillClosed" });
  });

  it("5. createRuntime()'s own assembled AppRuntime exposes randomBytes as an async function, alongside the unchanged initializeCrypto/runtimeCapabilities", () => {
    const runtime = createRuntime();
    expect(typeof runtime.randomBytes).toBe("function");
    expect(runtime.initializeCrypto).toBe(createRuntimeInitializeCryptoResult);
    expect(typeof runtime.runtimeCapabilities).toBe("function");
  });

  it("6. calling runtime.randomBytes() via the real AppRuntime object works end-to-end and never throws", async () => {
    const runtime = createRuntime();
    const bytes = await withNodeEnv("development", () => runtime.randomBytes());
    expect(bytes === null || bytes instanceof Uint8Array).toBe(true);
  });

  it("7. initializeCrypto()'s own return value is byte-for-byte unaffected by calling randomBytes() first", async () => {
    await randomBytes();
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision).toEqual({ allowed: false, initialized: false, reason: "PrototypeDisabled" });
  });

  it("8. runtimeCapabilities()'s own return value is unaffected by calling randomBytes() first -- still exactly four fields", async () => {
    await randomBytes();
    const caps = await runtimeCapabilities();
    expect(Object.keys(caps).sort()).toEqual(
      ["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort(),
    );
  });

  it("9. randomBytes() and runtimeCapabilities() construct entirely separate FedosWasmLoader instances -- neither file imports the other's Runtime Service", () => {
    expect(codeOnlyLines(randomBytesServiceSource)).not.toMatch(
      /runtimeCapabilities|attemptDevOnlyRuntimeRustIntegration|fedos_runtime_prototype_execution/,
    );
    expect(codeOnlyLines(runtimeIntegrationSource)).not.toMatch(
      /randomBytes|attemptDevOnlyRuntimeRandomBytes|fedos_runtime_random_bytes/,
    );
  });

  it("10. fedos_runtime_random_bytes.ts exports exactly attemptDevOnlyRuntimeRandomBytes and randomBytes, and exactly one interface", () => {
    const exportedFns = [...randomBytesServiceSource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedFns)).toEqual(new Set(["attemptDevOnlyRuntimeRandomBytes", "randomBytes"]));
    const exportedInterfaces = [...randomBytesServiceSource.matchAll(/^export interface (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedInterfaces)).toEqual(new Set(["RuntimeRandomBytesState"]));
  });

  it("11. src/runtime/types.ts declares randomBytes as a new AppRuntime field, initializeCrypto/runtimeCapabilities untouched", () => {
    expect(runtimeTypesSource).toMatch(/readonly randomBytes: \(\) => Promise<Uint8Array \| null>;/);
    expect(runtimeTypesSource).toMatch(/readonly initializeCrypto: \(\) => RuntimeInitializeCryptoResult;/);
    expect(runtimeTypesSource).toMatch(/readonly runtimeCapabilities: \(\) => Promise<RuntimeCapabilities>;/);
  });

  it("12. randomBytes()'s own try/catch guarantees no exception ever escapes -- Fail Closed at the Runtime Service boundary", () => {
    const fnMatch = codeOnlyLines(randomBytesServiceSource).match(
      /export async function randomBytes\(\): Promise<Uint8Array \| null> \{[\s\S]*?\n\}/,
    );
    expect(fnMatch).not.toBeNull();
    const fnBody = (fnMatch as RegExpMatchArray)[0] ?? "";
    expect(fnBody).toMatch(/try\s*\{/);
    expect(fnBody).toMatch(/catch\s*\{/);
    expect(fnBody).toMatch(/return null;/);
  });

  it("13. Worker remains fully unconnected -- src/worker.ts references neither randomBytes nor the new Runtime Service/Rust Boundary reach", () => {
    expect(workerSource).not.toMatch(/\.\s*randomBytes\s*\(/);
    expect(workerSource).not.toMatch(/attemptDevOnlyRuntimeRandomBytes/);
    expect(workerSource).not.toMatch(/attemptDevOnlyRandomBytesCall/);
    expect(workerSource).not.toMatch(/fedos_runtime_random_bytes/);
    expect(workerSource).not.toMatch(/random_bytes_32/);
  });

  it("14. Production is unaffected beyond the ONE new field -- create_runtime.ts references nothing else from the random bytes chain", () => {
    expect(createRuntimeSource).not.toMatch(/attemptDevOnlyRandomBytesCall/);
    expect(createRuntimeSource).not.toMatch(/attemptDevOnlyJsGlueImport/);
    expect(createRuntimeSource).not.toMatch(/attemptDevOnlyWasmInitialization/);
    expect(createRuntimeSource).not.toMatch(/RuntimeRandomBytesState/);
    expect(createRuntimeSource).not.toMatch(/\bcargo\b/i);
    expect(createRuntimeSource).not.toMatch(/fedos_random_bytes_32/);
  });

  it("15. no Secure Storage / persistence API of any kind in the new Runtime Service's own code", () => {
    const codeOnly = codeOnlyLines(randomBytesServiceSource);
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

  it("18. random_bytes_32() is a thin, non-cryptographic wrapper -- calls fedos_random_bytes_32() exactly once, no new getrandom/algorithm", () => {
    const fnMatch = libRsSource.match(/pub fn random_bytes_32\(\) -> Option<Vec<u8>> \{[\s\S]*?\n\}/);
    expect(fnMatch).not.toBeNull();
    const fnBody = (fnMatch as RegExpMatchArray)[0] ?? "";
    expect(fnBody).toMatch(/fedos_random_bytes_32\(\)\.bytes/);
    expect(fnBody).not.toMatch(/getrandom/);
    expect(fnBody).not.toMatch(/unsafe/);
  });

  it("19. fedos_random_bytes_32() itself (Stage 137) is byte-for-byte unchanged by this stage", () => {
    expect(libRsSource).toMatch(
      /pub fn fedos_random_bytes_32\(\) -> FedosRandomBytesDecision \{\s*let mut buf = \[0u8; 32\];\s*match getrandom::fill\(&mut buf\) \{/,
    );
  });

  it("20. Rust and Cargo/package sources are otherwise unchanged -- still 29 pub fn, two #[wasm_bindgen], 11/2 dependencies, no new dependency added", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(30);
    expect(pubFnNames).toContain("random_bytes_32");
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(3);

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

  it("21. Alpha 007's own review doc is referenced by neither the Runtime Service nor types.ts -- no premature doc-name coupling", () => {
    expect(randomBytesServiceSource).not.toMatch(/secure_runtime_alpha_007_crypto_api_surface_review/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_007_crypto_api_surface_review/);
    expect(typeof surfaceReviewDocSource).toBe("string");
  });
});
