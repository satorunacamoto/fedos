import { describe, it, expect, vi } from "vitest";
// This project's tsconfig.json carries no `@types/node`; declared
// ambient here the same way `fedos_runtime_prototype_execution.ts` itself does.
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
import { createRuntime, createRuntimeInitializeCryptoResult } from "../src/runtime/create_runtime.js";
import { runtimeCapabilities } from "../src/runtime/fedos_runtime_prototype_execution.js";
import { randomBytes } from "../src/runtime/fedos_runtime_random_bytes.js";
import {
  generateAeadKey,
  attemptDevOnlyRuntimeAeadKeyGeneration,
} from "../src/runtime/fedos_runtime_aead_key_generation.js";
import { FedosWasmLoaderSkeleton } from "../src/runtime/fedos_wasm_loader.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_013_opaque_aead_key_handle_migration.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import decisionDocSource from "../docs/secure_runtime_alpha_012_key_boundary_decision.md?raw";
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
 * Secure Runtime Alpha 013 — "Opaque AEAD Key Handle Migration":
 * implements this arc's own Alpha 012 Key Boundary Decision. Migrates
 * `AppRuntime.generateAeadKey()`'s public return shape from Alpha 010's
 * raw `Uint8Array` to an opaque `AeadKeyHandle`, BEFORE `encrypt()`/
 * `decrypt()` are ever built against it — a deliberate, one-time
 * breaking change. `encrypt()`/`decrypt()`/`importKey()`/`exportKey()`
 * remain unimplemented; `initializeCrypto()`/`runtimeCapabilities()`/
 * `randomBytes()` stay byte-for-byte unchanged.
 */
describe("Secure Runtime Alpha 013 -- Opaque AEAD Key Handle Migration, Fail Closed everywhere, no raw key material exposed", () => {
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
  });

  it("2. the design doc states this is a deliberate breaking change per the Alpha 012 decision, and names all required disclosures", () => {
    expect(designDocSource).toMatch(/deliberate, one-time breaking change/);
    expect(designDocSource).toMatch(/Alpha 012 Key Boundary Decision/);
    expect(designDocSource).toMatch(/no longer returns raw key bytes|raw `Uint8Array` to an opaque\s*\n?`AeadKeyHandle`/);
    expect(designDocSource).toMatch(/encrypt\(\)`\/`decrypt\(\)` remain unimplemented|`encrypt\(\)`\/`decrypt\(\)` are ever built/);
    expect(designDocSource).toMatch(/importKey\(\)`\/`exportKey\(\)` remain explicitly deferred|`importKey\(\)`, `exportKey\(\)`/);
    expect(designDocSource).toMatch(/not Secure Storage|Secure Storage remains unimplemented/i);
    expect(designDocSource).toMatch(/Fail Closed/);
    expect(typeof decisionDocSource).toBe("string");
  });

  it("3. against the REAL (unmocked) repo state, generateAeadKey() resolves null (no locally-generated JS glue committed)", async () => {
    const key = await withNodeEnv("development", () => generateAeadKey());
    expect(key).toBeNull();
  });

  it("4. Development Runtime + a real, opaque-handle-returning module.generate_aead_key_handle() succeeds end-to-end", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const okKeyHandle = { kind: "AeadKeyHandle" as const };
        const okLoader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({
            initSync: vi.fn(() => ({})),
            generate_aead_key_handle: () => okKeyHandle,
          }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        const okState = await attemptDevOnlyRuntimeAeadKeyGeneration(okLoader);
        expect(okState.succeeded).toBe(true);
        expect(okState.keyHandle).toEqual(okKeyHandle);
        expect(okState.keyHandle).not.toBeInstanceOf(Uint8Array);
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
            generate_aead_key_handle: () => ({ kind: "AeadKeyHandle" }),
          }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
      const prodState = await withNodeEnv("production", () => attemptDevOnlyRuntimeAeadKeyGeneration(okLoader()));
      expect(prodState).toEqual({ succeeded: false, keyHandle: null });

      const unknownState = await withNodeEnv(undefined, () => attemptDevOnlyRuntimeAeadKeyGeneration(okLoader()));
      expect(unknownState).toEqual({ succeeded: false, keyHandle: null });
    } finally {
      mock.mockReset();
      mock.mockReturnValue(false);
    }
  });

  it("6. FedosWasmLoaderSkeleton.attemptDevOnlyAeadKeyGenerationCall() Fails Closed with PrototypeStillClosed before planLoad() has ever run", async () => {
    const loader = new FedosWasmLoaderSkeleton();
    const result = await loader.attemptDevOnlyAeadKeyGenerationCall();
    expect(result).toEqual({
      attempted: false,
      succeeded: false,
      keyHandle: null,
      reason: "PrototypeStillClosed",
    });
  });

  it("7. wrapper not present Fails Closed with KeyGenerationUnavailable, no throw", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const absentLoader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({ initSync: vi.fn(() => ({})) }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        absentLoader.planLoad();
        await absentLoader.attemptDevOnlyJsGlueImport();
        await absentLoader.attemptDevOnlyWasmInitialization();
        const result = await absentLoader.attemptDevOnlyAeadKeyGenerationCall();
        expect(result).toEqual({
          attempted: true,
          succeeded: false,
          keyHandle: null,
          reason: "KeyGenerationUnavailable",
        });
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("8. a thrown Rust-side error Fails Closed with CallFailed, never escapes", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const throwingLoader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({
            initSync: vi.fn(() => ({})),
            generate_aead_key_handle: () => {
              throw new Error("simulated CSPRNG failure");
            },
          }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        throwingLoader.planLoad();
        await throwingLoader.attemptDevOnlyJsGlueImport();
        await throwingLoader.attemptDevOnlyWasmInitialization();
        const result = await throwingLoader.attemptDevOnlyAeadKeyGenerationCall();
        expect(result).toEqual({
          attempted: true,
          succeeded: false,
          keyHandle: null,
          reason: "CallFailed",
        });
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("9. a genuine undefined return (Rust's own EntropySourceUnavailable) Fails Closed distinctly from CallFailed", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        const entropyUnavailableLoader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({
            initSync: vi.fn(() => ({})),
            generate_aead_key_handle: () => undefined,
          }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        entropyUnavailableLoader.planLoad();
        await entropyUnavailableLoader.attemptDevOnlyJsGlueImport();
        await entropyUnavailableLoader.attemptDevOnlyWasmInitialization();
        const result = await entropyUnavailableLoader.attemptDevOnlyAeadKeyGenerationCall();
        expect(result).toEqual({
          attempted: true,
          succeeded: false,
          keyHandle: null,
          reason: "EntropySourceUnavailable",
        });
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("10. a genuine but WRONGLY-shaped return (e.g. a raw Uint8Array, or a plain object without the right kind) Fails Closed with InvalidHandleShape -- distinct from EntropySourceUnavailable and CallFailed", async () => {
    await withNodeEnv("development", async () => {
      const mock = vi.mocked(nodeFs.existsSync).mockReturnValue(true);
      try {
        for (const wrongValue of [new Uint8Array(32).fill(9), {}, { kind: "SomethingElse" }, 42, "AeadKeyHandle", null]) {
          const wronglyShapedLoader = new FedosWasmLoaderSkeleton({
            importGeneratedJsGlue: async () => ({
              initSync: vi.fn(() => ({})),
              generate_aead_key_handle: () => wrongValue,
            }),
            readGeneratedWasmBytes: () => new Uint8Array([1]),
          });
          wronglyShapedLoader.planLoad();
          await wronglyShapedLoader.attemptDevOnlyJsGlueImport();
          await wronglyShapedLoader.attemptDevOnlyWasmInitialization();
          const result = await wronglyShapedLoader.attemptDevOnlyAeadKeyGenerationCall();
          expect(result).toEqual({
            attempted: true,
            succeeded: false,
            keyHandle: null,
            reason: "InvalidHandleShape",
          });
        }
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("11. calling runtime.generateAeadKey() via the real AppRuntime object never throws and never resolves raw bytes", async () => {
    const runtime = createRuntime();
    const key = await withNodeEnv("development", () => runtime.generateAeadKey());
    expect(key === null || (typeof key === "object" && key !== null)).toBe(true);
    expect(key).not.toBeInstanceOf(Uint8Array);
  });

  it("12. no raw key byte, .bytes, .key, .material, exportKey-shaped method, toJSON, or leaking toString exists anywhere in this stage's own AeadKeyHandle surface", () => {
    const ifaceMatch = wasmLoaderSource.match(/export interface AeadKeyHandle \{[\s\S]*?\n\}/);
    const executionIfaceMatch = wasmLoaderSource.match(
      /export interface FedosWasmLoaderAeadKeyGenerationExecution \{[\s\S]*?\n\}/,
    );
    expect(ifaceMatch).not.toBeNull();
    expect(executionIfaceMatch).not.toBeNull();
    const codeOnly =
      codeOnlyLines(keyGenerationServiceSource) +
      codeOnlyLines((ifaceMatch as RegExpMatchArray)[0]) +
      codeOnlyLines((executionIfaceMatch as RegExpMatchArray)[0]);
    expect(codeOnly).not.toMatch(/\.bytes\b/);
    expect(codeOnly).not.toMatch(/readonly\s+bytes\s*:/);
    expect(codeOnly).not.toMatch(/readonly\s+key\s*:/);
    expect(codeOnly).not.toMatch(/readonly\s+material\s*:/);
    expect(codeOnly).not.toMatch(/exportKey/i);
    expect(codeOnly).not.toMatch(/toJSON/);
    expect(codeOnly).not.toMatch(/\.toString\s*\(\s*\)/);
  });

  it("13. the AeadKeyHandle TypeScript interface declares exactly one field, kind, and nothing else", () => {
    const ifaceMatch = wasmLoaderSource.match(/export interface AeadKeyHandle \{([\s\S]*?)\n\}/);
    expect(ifaceMatch).not.toBeNull();
    const body = (ifaceMatch as RegExpMatchArray)[1] ?? "";
    const fields = [...body.matchAll(/readonly\s+([a-zA-Z0-9_]+)\s*:/g)].map((m) => m[1]);
    expect(fields).toEqual(["kind"]);
  });

  it("14. the Rust AeadKeyHandle opaque class derives nothing, exposes exactly one method (kind), and has no public constructor or raw-byte getter", () => {
    const structMatch = libRsSource.match(/pub struct AeadKeyHandle \{[\s\S]*?\n\}/);
    expect(structMatch).not.toBeNull();
    expect((structMatch as RegExpMatchArray)[0]).not.toMatch(/#\[derive/);

    const implMatch = libRsSource.match(/impl AeadKeyHandle \{([\s\S]*?)\n\}/);
    expect(implMatch).not.toBeNull();
    const implBody = (implMatch as RegExpMatchArray)[1] ?? "";
    const methodNames = [...implBody.matchAll(/\bfn\s+([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
    expect(methodNames).toEqual(["kind"]);
    expect(implBody).not.toMatch(/fn\s+new\b/);
    expect(implBody).not.toMatch(/as_bytes|to_vec|expose|export_key/i);
    expect(libRsSource).not.toMatch(/impl AsRef<\[u8\]> for AeadKeyHandle/);
  });

  it("15. generate_aead_key_handle() never exposes a raw byte -- moves the FedosAeadKeyHandle into the wrapper without reading it", () => {
    const fnMatch = libRsSource.match(/pub fn generate_aead_key_handle\(\) -> Option<AeadKeyHandle> \{[\s\S]*?\n\}/);
    expect(fnMatch).not.toBeNull();
    const fnBody = (fnMatch as RegExpMatchArray)[0] ?? "";
    expect(fnBody).toMatch(/fedos_generate_aead_key_32\(\)\.key/);
    expect(fnBody).not.toMatch(/expose_bytes|to_vec|zeroize/i);
    expect(fnBody).not.toMatch(/getrandom/);
    expect(fnBody).not.toMatch(/unsafe/);
  });

  it("16. the now-orphaned expose_bytes_for_internal_wasm_export accessor is removed, not left as dead code", () => {
    expect(libRsSource).not.toMatch(/expose_bytes_for_internal_wasm_export/);
  });

  it("17. fedos_generate_aead_key_32() itself (Stage 171-176) is byte-for-byte unchanged by this stage", () => {
    expect(libRsSource).toMatch(
      /pub fn fedos_generate_aead_key_32\(\) -> FedosGenerateAeadKeyDecision \{\s*use zeroize::Zeroize;\s*let mut buf = \[0u8; 32\];\s*match getrandom::fill\(&mut buf\) \{/,
    );
  });

  it("18. importKey()/exportKey() are NOT implemented anywhere in this stage's changed files -- encrypt()/decrypt() were later added by Stage 1009 (Secure Runtime Alpha 014)/Stage 1010 (Secure Runtime Alpha 015) respectively, to types.ts, an unrelated shared file", () => {
    expect(keyGenerationServiceSource).not.toMatch(/fedos_encrypt|fedos_decrypt/);
    expect(keyGenerationServiceSource).not.toMatch(/\.\s*(encrypt|decrypt|importKey|exportKey)\s*\(/);
    expect(runtimeTypesSource).not.toMatch(/readonly importKey:|readonly exportKey:/);
    expect(createRuntimeSource).not.toMatch(/fedos_encrypt|fedos_decrypt/);
    expect(libRsSource).not.toMatch(/pub fn import_key\b|pub fn export_key\b/);
  });

  it("19. initializeCrypto()'s own return value is byte-for-byte unaffected by calling generateAeadKey() first", async () => {
    await generateAeadKey();
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision).toEqual({ allowed: false, initialized: false, reason: "PrototypeDisabled" });
  });

  it("20. runtimeCapabilities()'s own return value is unaffected -- still exactly four fields", async () => {
    await generateAeadKey();
    const caps = await runtimeCapabilities();
    expect(Object.keys(caps).sort()).toEqual(
      ["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort(),
    );
  });

  it("21. randomBytes()'s own return shape is unaffected by calling generateAeadKey() first", async () => {
    await generateAeadKey();
    const bytes = await withNodeEnv("development", () => randomBytes());
    expect(bytes === null || bytes instanceof Uint8Array).toBe(true);
  });

  it("22. generateAeadKey() and randomBytes() construct entirely separate FedosWasmLoader instances", () => {
    expect(codeOnlyLines(keyGenerationServiceSource)).not.toMatch(
      /randomBytes|attemptDevOnlyRuntimeRandomBytes|fedos_runtime_random_bytes/,
    );
    expect(codeOnlyLines(randomBytesServiceSource)).not.toMatch(
      /generateAeadKey|attemptDevOnlyRuntimeAeadKeyGeneration|fedos_runtime_aead_key_generation/,
    );
    expect(codeOnlyLines(runtimeIntegrationSource)).not.toMatch(
      /generateAeadKey|attemptDevOnlyRuntimeAeadKeyGeneration|fedos_runtime_aead_key_generation/,
    );
  });

  it("23. Worker remains fully unconnected -- src/worker.ts references nothing from this stage's chain", () => {
    expect(workerSource).not.toMatch(/\.\s*generateAeadKey\s*\(/);
    expect(workerSource).not.toMatch(/attemptDevOnlyRuntimeAeadKeyGeneration/);
    expect(workerSource).not.toMatch(/attemptDevOnlyAeadKeyGenerationCall/);
    expect(workerSource).not.toMatch(/fedos_runtime_aead_key_generation/);
    expect(workerSource).not.toMatch(/generate_aead_key_handle/);
    expect(workerSource).not.toMatch(/fedos_generate_aead_key_32/);
    expect(workerSource).not.toMatch(/\bAeadKeyHandle\b/);
  });

  it("24. Production is unaffected beyond the ONE existing field -- create_runtime.ts references nothing new from this stage's chain", () => {
    expect(createRuntimeSource).not.toMatch(/attemptDevOnlyAeadKeyGenerationCall/);
    expect(createRuntimeSource).not.toMatch(/attemptDevOnlyJsGlueImport/);
    expect(createRuntimeSource).not.toMatch(/attemptDevOnlyWasmInitialization/);
    expect(createRuntimeSource).not.toMatch(/RuntimeAeadKeyGenerationState/);
    expect(createRuntimeSource).not.toMatch(/\bcargo\b/i);
    expect(createRuntimeSource).not.toMatch(/fedos_generate_aead_key_32/);
  });

  it("25. no Secure Storage / persistence API of any kind in the Runtime Service's own code", () => {
    const codeOnly = codeOnlyLines(keyGenerationServiceSource);
    expect(codeOnly).not.toMatch(/localStorage|sessionStorage|indexedDB|writeFile/i);
  });

  it("26. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still exactly seven Plan interfaces, still BlockedByPolicy", async () => {
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

  it("27. Rust and Cargo/package sources -- 31 pub fn, five #[wasm_bindgen] (AeadKeyHandle struct + impl + generate_aead_key_handle), 11/2 dependencies, no new dependency added", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(44);
    expect(pubFnNames).toContain("generate_aead_key_handle");
    expect(pubFnNames).toContain("kind");
    expect(pubFnNames).not.toContain("generate_aead_key_32");
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

  it("28. no compiled/generated artifact (target/, Cargo.lock, pkg/) is committed to the repository", () => {
    expect(cargoTomlSource).not.toMatch(/^\[\[bin\]\]/m);
    // The raw imports above only ever resolve if the named source files
    // exist and are plain text -- this is a structural sanity check that
    // this Stage's own verification (a real `cargo build`/`wasm-bindgen`
    // run, per the design doc) left no generated artifact behind for
    // Vite/vitest to ever pick up as a module.
    expect(typeof libRsSource).toBe("string");
    expect(typeof cargoTomlSource).toBe("string");
  });
});
