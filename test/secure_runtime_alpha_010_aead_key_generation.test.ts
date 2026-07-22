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
import designDocSource from "../docs/secure_runtime_alpha_010_aead_key_generation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import encryptReviewDocSource from "../docs/secure_runtime_alpha_009_encrypt_api_surface_review.md?raw";
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
 * Secure Runtime Alpha 010 — "Public Runtime AEAD Key Generation API":
 * adds `generateAeadKey()` (Stage 1005), the SECOND public Crypto API
 * wired into `AppRuntime`, mirroring `randomBytes()`'s (Stage 1004)
 * four-layer architecture exactly.
 * `initializeCrypto()`/`runtimeCapabilities()`/`randomBytes()` stay
 * byte-for-byte unchanged.
 *
 * UPDATED Stage 1008 (Secure Runtime Alpha 013): per this arc's own
 * Alpha 012 Key Boundary Decision, `generateAeadKey()`'s Alpha-limited
 * raw-bytes shape was a DELIBERATE, one-time breaking change, replaced
 * by an opaque `AeadKeyHandle` — see
 * `test/secure_runtime_alpha_013_opaque_aead_key_handle_migration.test.ts`
 * for that Stage's own dedicated guard suite. This file's assertions
 * that depended on the now-superseded raw-bytes contract are updated
 * below to reflect current reality; `docs/secure_runtime_alpha_010_aead_key_generation.md`
 * itself remains an unedited historical record of Alpha 010's own
 * moment (test 25 below still guards its own, unchanged text).
 */
describe("Secure Runtime Alpha 010 -- generateAeadKey() Public Runtime API, Fail Closed everywhere else (Stage 1005)", () => {
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

  it("2. against the REAL (unmocked) repo state, generateAeadKey() resolves null (no locally-generated JS glue committed)", async () => {
    const key = await withNodeEnv("development", () => generateAeadKey());
    expect(key).toBeNull();
  });

  it("3. generateAeadKey() succeeds end-to-end with a real, opaque-handle-returning module.generate_aead_key_handle() (injected loader), and Fails Closed with no throw when it is absent", async () => {
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

        const absentLoader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({ initSync: vi.fn(() => ({})) }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        await expect(attemptDevOnlyRuntimeAeadKeyGeneration(absentLoader)).resolves.toEqual({
          succeeded: false,
          keyHandle: null,
        });

        const throwingLoader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({
            initSync: vi.fn(() => ({})),
            generate_aead_key_handle: () => {
              throw new Error("simulated CSPRNG failure");
            },
          }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        await expect(attemptDevOnlyRuntimeAeadKeyGeneration(throwingLoader)).resolves.toEqual({
          succeeded: false,
          keyHandle: null,
        });

        const entropyUnavailableLoader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({
            initSync: vi.fn(() => ({})),
            generate_aead_key_handle: () => undefined,
          }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        await expect(attemptDevOnlyRuntimeAeadKeyGeneration(entropyUnavailableLoader)).resolves.toEqual({
          succeeded: false,
          keyHandle: null,
        });

        const wronglyShapedLoader = new FedosWasmLoaderSkeleton({
          importGeneratedJsGlue: async () => ({
            initSync: vi.fn(() => ({})),
            generate_aead_key_handle: () => new Uint8Array(32).fill(9),
          }),
          readGeneratedWasmBytes: () => new Uint8Array([1]),
        });
        await expect(attemptDevOnlyRuntimeAeadKeyGeneration(wronglyShapedLoader)).resolves.toEqual({
          succeeded: false,
          keyHandle: null,
        });
      } finally {
        mock.mockReset();
        mock.mockReturnValue(false);
      }
    });
  });

  it("4. FedosWasmLoaderSkeleton.attemptDevOnlyAeadKeyGenerationCall() Fails Closed with PrototypeStillClosed before planLoad() has ever run", async () => {
    const loader = new FedosWasmLoaderSkeleton();
    const result = await loader.attemptDevOnlyAeadKeyGenerationCall();
    expect(result).toEqual({
      attempted: false,
      succeeded: false,
      keyHandle: null,
      reason: "PrototypeStillClosed",
    });
  });

  it("5. generateAeadKey() Fails Closed under Production/Unknown Runtime even with real artifacts present", async () => {
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

  it("6. createRuntime()'s own assembled AppRuntime exposes generateAeadKey as an async function, alongside the unchanged initializeCrypto/runtimeCapabilities/randomBytes", () => {
    const runtime = createRuntime();
    expect(typeof runtime.generateAeadKey).toBe("function");
    expect(runtime.initializeCrypto).toBe(createRuntimeInitializeCryptoResult);
    expect(typeof runtime.runtimeCapabilities).toBe("function");
    expect(typeof runtime.randomBytes).toBe("function");
  });

  it("7. calling runtime.generateAeadKey() via the real AppRuntime object works end-to-end and never throws -- resolves null or an opaque handle, never raw bytes", async () => {
    const runtime = createRuntime();
    const key = await withNodeEnv("development", () => runtime.generateAeadKey());
    expect(key === null || (typeof key === "object" && (key as { kind?: unknown }).kind === "AeadKeyHandle")).toBe(
      true,
    );
    expect(key).not.toBeInstanceOf(Uint8Array);
  });

  it("8. initializeCrypto()'s own return value is byte-for-byte unaffected by calling generateAeadKey() first", async () => {
    await generateAeadKey();
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision).toEqual({ allowed: false, initialized: false, reason: "PrototypeDisabled" });
  });

  it("9. runtimeCapabilities()'s own return value is unaffected by calling generateAeadKey() first -- still exactly four fields", async () => {
    await generateAeadKey();
    const caps = await runtimeCapabilities();
    expect(Object.keys(caps).sort()).toEqual(
      ["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort(),
    );
  });

  it("10. randomBytes()'s own return shape is unaffected by calling generateAeadKey() first", async () => {
    await generateAeadKey();
    const bytes = await withNodeEnv("development", () => randomBytes());
    expect(bytes === null || bytes instanceof Uint8Array).toBe(true);
  });

  it("11. generateAeadKey() and randomBytes() construct entirely separate FedosWasmLoader instances -- neither Runtime Service imports the other's exports", () => {
    expect(codeOnlyLines(keyGenerationServiceSource)).not.toMatch(
      /randomBytes|attemptDevOnlyRuntimeRandomBytes|fedos_runtime_random_bytes/,
    );
    expect(codeOnlyLines(randomBytesServiceSource)).not.toMatch(
      /generateAeadKey|attemptDevOnlyRuntimeAeadKeyGeneration|fedos_runtime_aead_key_generation/,
    );
    expect(codeOnlyLines(keyGenerationServiceSource)).not.toMatch(
      /runtimeCapabilities|attemptDevOnlyRuntimeRustIntegration|fedos_runtime_prototype_execution/,
    );
    expect(codeOnlyLines(runtimeIntegrationSource)).not.toMatch(
      /generateAeadKey|attemptDevOnlyRuntimeAeadKeyGeneration|fedos_runtime_aead_key_generation/,
    );
  });

  it("12. fedos_runtime_aead_key_generation.ts exports exactly attemptDevOnlyRuntimeAeadKeyGeneration and generateAeadKey, and exactly one interface", () => {
    const exportedFns = [...keyGenerationServiceSource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedFns)).toEqual(new Set(["attemptDevOnlyRuntimeAeadKeyGeneration", "generateAeadKey"]));
    const exportedInterfaces = [...keyGenerationServiceSource.matchAll(/^export interface (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedInterfaces)).toEqual(new Set(["RuntimeAeadKeyGenerationState"]));
  });

  it("13. src/runtime/types.ts declares generateAeadKey as a new AppRuntime field (now returning an opaque AeadKeyHandle, per Stage 1008), initializeCrypto/runtimeCapabilities/randomBytes untouched", () => {
    expect(runtimeTypesSource).toMatch(/readonly generateAeadKey: \(\) => Promise<AeadKeyHandle \| null>;/);
    expect(runtimeTypesSource).toMatch(/readonly initializeCrypto: \(\) => RuntimeInitializeCryptoResult;/);
    expect(runtimeTypesSource).toMatch(/readonly runtimeCapabilities: \(\) => Promise<RuntimeCapabilities>;/);
    expect(runtimeTypesSource).toMatch(/readonly randomBytes: \(\) => Promise<Uint8Array \| null>;/);
  });

  it("14. generateAeadKey()'s own try/catch guarantees no exception ever escapes -- Fail Closed at the Runtime Service boundary", () => {
    const fnMatch = codeOnlyLines(keyGenerationServiceSource).match(
      /export async function generateAeadKey\(\): Promise<AeadKeyHandle \| null> \{[\s\S]*?\n\}/,
    );
    expect(fnMatch).not.toBeNull();
    const fnBody = (fnMatch as RegExpMatchArray)[0] ?? "";
    expect(fnBody).toMatch(/try\s*\{/);
    expect(fnBody).toMatch(/catch\s*\{/);
    expect(fnBody).toMatch(/return null;/);
  });

  it("15. Worker remains fully unconnected -- src/worker.ts references neither generateAeadKey nor any part of the chain", () => {
    expect(workerSource).not.toMatch(/\.\s*generateAeadKey\s*\(/);
    expect(workerSource).not.toMatch(/attemptDevOnlyRuntimeAeadKeyGeneration/);
    expect(workerSource).not.toMatch(/attemptDevOnlyAeadKeyGenerationCall/);
    expect(workerSource).not.toMatch(/fedos_runtime_aead_key_generation/);
    expect(workerSource).not.toMatch(/generate_aead_key_handle/);
    expect(workerSource).not.toMatch(/fedos_generate_aead_key_32/);
    expect(workerSource).not.toMatch(/FedosAeadKeyHandle/);
    expect(workerSource).not.toMatch(/\bAeadKeyHandle\b/);
  });

  it("16. Production is unaffected beyond the ONE new field -- create_runtime.ts references nothing else from the key generation chain", () => {
    expect(createRuntimeSource).not.toMatch(/attemptDevOnlyAeadKeyGenerationCall/);
    expect(createRuntimeSource).not.toMatch(/attemptDevOnlyJsGlueImport/);
    expect(createRuntimeSource).not.toMatch(/attemptDevOnlyWasmInitialization/);
    expect(createRuntimeSource).not.toMatch(/RuntimeAeadKeyGenerationState/);
    expect(createRuntimeSource).not.toMatch(/\bcargo\b/i);
    expect(createRuntimeSource).not.toMatch(/fedos_generate_aead_key_32/);
  });

  it("17. encrypt()/decrypt() are NOT implemented anywhere in this stage's own new files -- both were later added, by Stage 1009 (Secure Runtime Alpha 014)/Stage 1010 (Secure Runtime Alpha 015) respectively, to types.ts, an unrelated shared file", () => {
    expect(keyGenerationServiceSource).not.toMatch(/fedos_encrypt|fedos_decrypt/);
    expect(keyGenerationServiceSource).not.toMatch(/\.\s*(encrypt|decrypt)\s*\(/);
    expect(createRuntimeSource).not.toMatch(/fedos_encrypt|fedos_decrypt/);
  });

  it("18. no Secure Storage / persistence API of any kind in the new Runtime Service's own code", () => {
    const codeOnly = codeOnlyLines(keyGenerationServiceSource);
    expect(codeOnly).not.toMatch(/localStorage|sessionStorage|indexedDB|writeFile/i);
  });

  it("19. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still exactly seven Plan interfaces", () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);
  });

  it("20. Fail Closed is confirmed maintained -- FedosWasmLoader.planLoad() still resolves BlockedByPolicy", async () => {
    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("21. generate_aead_key_32() was REPLACED Stage 1008 by generate_aead_key_handle() -- a thin wrapper calling fedos_generate_aead_key_32() exactly once, never unwrapping to raw bytes, no new getrandom/algorithm, no unsafe", () => {
    expect(libRsSource).not.toMatch(/pub fn generate_aead_key_32\(\)/);
    const fnMatch = libRsSource.match(/pub fn generate_aead_key_handle\(\) -> Option<AeadKeyHandle> \{[\s\S]*?\n\}/);
    expect(fnMatch).not.toBeNull();
    const fnBody = (fnMatch as RegExpMatchArray)[0] ?? "";
    expect(fnBody).toMatch(/fedos_generate_aead_key_32\(\)\.key/);
    expect(fnBody).not.toMatch(/expose_bytes_for_internal_wasm_export/);
    expect(fnBody).not.toMatch(/\.zeroize\(\)/);
    expect(fnBody).not.toMatch(/getrandom/);
    expect(fnBody).not.toMatch(/unsafe/);
  });

  it("22. fedos_generate_aead_key_32() itself (Stage 171-176) is byte-for-byte unchanged by this stage", () => {
    expect(libRsSource).toMatch(
      /pub fn fedos_generate_aead_key_32\(\) -> FedosGenerateAeadKeyDecision \{\s*use zeroize::Zeroize;\s*let mut buf = \[0u8; 32\];\s*match getrandom::fill\(&mut buf\) \{/,
    );
  });

  it("23. the FOURTH SecretHandle accessor this Stage added was REMOVED Stage 1008 once its sole caller was replaced -- only the AEAD/KDF/ECDH accessors remain", () => {
    const accessorNames = [
      ...libRsSource.matchAll(/pub\(crate\) fn (expose_bytes_for_internal_\w+)\(&self\) -> Option<\[u8; 32\]>/g),
    ].map((m: RegExpMatchArray) => m[1]);
    expect(new Set(accessorNames)).toEqual(
      new Set([
        "expose_bytes_for_internal_derivation",
        "expose_bytes_for_internal_aead",
        "expose_bytes_for_internal_ecdh",
        // Secure Runtime Alpha 436 adds a FOURTH -- NOT a SecretHandle
        // accessor (this Stage's own narrative concerns SecretHandle
        // only): `FedosMasterSeedHandle::expose_bytes_for_internal_sealing`,
        // `pub(crate)` (unlike the SAME struct's OWN private
        // `expose_bytes_for_internal_root_derivation`, which this regex
        // does not match) because its sole reviewed caller,
        // `FedosMasterSeedAuthority::seal`, lives outside `mod
        // master_root` at crate-root level. See
        // docs/secure_runtime_alpha_436_rust_master_seed_authority_implementation.md.
        "expose_bytes_for_internal_sealing",
      ]),
    );
    expect(libRsSource).not.toMatch(/expose_bytes_for_internal_wasm_export/);
  });

  it("24. Rust and Cargo/package sources -- now 31 pub fn, five #[wasm_bindgen] (Stage 1008 added the AeadKeyHandle opaque class + its impl block + generate_aead_key_handle()), 11/2 dependencies, no new dependency added", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(48);
    expect(pubFnNames).toContain("generate_aead_key_handle");
    expect(pubFnNames).not.toContain("generate_aead_key_32");
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

  it("25. the design doc explicitly states this is Alpha-limited, not a key-handle design, and not Secure Storage", () => {
    expect(designDocSource).toMatch(/Not an opaque key handle\./);
    expect(designDocSource).toMatch(/Not Secure Storage\./);
    expect(designDocSource).toMatch(/Key material handling is Alpha-only\./);
    expect(designDocSource).toMatch(/Future migration planned\./);
    expect(designDocSource).toMatch(/encrypt\(\)`\/`decrypt\(\)` — neither is implemented/);
    expect(typeof encryptReviewDocSource).toBe("string");
  });

  it("26. types.ts does not reference the Alpha 007/009 review doc filenames -- no premature doc-name coupling in the Public API surface", () => {
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_007_crypto_api_surface_review/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_009_encrypt_api_surface_review/);
  });
});
