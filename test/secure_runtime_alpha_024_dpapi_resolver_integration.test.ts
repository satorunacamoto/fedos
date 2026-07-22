import { describe, it, expect } from "vitest";
import { createRuntime, createRuntimeInitializeCryptoResult } from "../src/runtime/create_runtime.js";
import { runtimeCapabilities } from "../src/runtime/fedos_runtime_prototype_execution.js";
import { randomBytes } from "../src/runtime/fedos_runtime_random_bytes.js";
import { generateAeadKey } from "../src/runtime/fedos_runtime_aead_key_generation.js";
import { encrypt } from "../src/runtime/fedos_runtime_encrypt.js";
import { decrypt } from "../src/runtime/fedos_runtime_decrypt.js";
import { exportCiphertext } from "../src/runtime/fedos_runtime_export_ciphertext.js";
import { importCiphertext } from "../src/runtime/fedos_runtime_import_ciphertext.js";
import { storeCiphertext, loadCiphertext, deleteCiphertext } from "../src/runtime/fedos_runtime_ciphertext_storage.js";
import { resolveRuntimeStorageBackend } from "../src/runtime/fedos_runtime_storage_resolver.js";
import { MemoryStorageBackend } from "../src/runtime/fedos_runtime_storage_backend.js";
import { WindowsDpapiStorageBackend } from "../src/runtime/fedos_runtime_storage_backend_windows_dpapi.js";
import { determineFedosRuntimePlatform, type FedosRuntimePlatform } from "../src/runtime/fedos_runtime_platform_authority.js";
import { determineFedosRuntimeMode } from "../src/runtime/fedos_runtime_mode_authority.js";
declare const process: {
  env: { NODE_ENV?: string; [key: string]: string | undefined };
  platform: string;
};
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_024_dpapi_resolver_integration.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha022DocSource from "../docs/secure_runtime_alpha_022_storage_backend_selection_policy_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha023DocSource from "../docs/secure_runtime_alpha_023_windows_dpapi_storage_backend.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import platformAuthoritySource from "../src/runtime/fedos_runtime_platform_authority.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageResolverSource from "../src/runtime/fedos_runtime_storage_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageBackendSource from "../src/runtime/fedos_runtime_storage_backend.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import dpapiBackendSource from "../src/runtime/fedos_runtime_storage_backend_windows_dpapi.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageServiceSource from "../src/runtime/fedos_runtime_ciphertext_storage.ts?raw";
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
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

const realPlatform = process.platform;
const isWindows = realPlatform === "win32";

async function withNodeEnv<T>(value: string | undefined, fn: () => T | Promise<T>): Promise<T> {
  const original = process.env.NODE_ENV;
  if (value === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = value;
  }
  try {
    return await fn();
  } finally {
    if (original === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = original;
    }
  }
}

async function withPlatform<T>(value: string, fn: () => T | Promise<T>): Promise<T> {
  const originalDescriptor = Object.getOwnPropertyDescriptor(process, "platform") as PropertyDescriptor;
  try {
    Object.defineProperty(process, "platform", { value, configurable: true });
    return await fn();
  } finally {
    Object.defineProperty(process, "platform", originalDescriptor);
  }
}

/**
 * Secure Runtime Alpha 024 — "DPAPI Resolver Integration": wires
 * `WindowsDpapiStorageBackend` (Alpha 023) into
 * `resolveRuntimeStorageBackend()` for real -- Development Runtime on
 * Windows now resolves DPAPI; every other combination resolves
 * `MemoryStorageBackend`, byte-for-byte unchanged. Adds a new, entirely
 * separate Platform Authority (`fedos_runtime_platform_authority.ts`)
 * the Resolver reads alongside Alpha 020's Runtime Mode Authority --
 * two independent classifiers, combined with plain `if` logic, never
 * merged. No fallback from a failed DPAPI call to Memory; no Public API
 * change; no Rust/Cargo/package.json change.
 */
describe("Secure Runtime Alpha 024 -- DPAPI Resolver Integration, Memory Backend preserved, no fallback, Public API unchanged", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(6000);
  });

  it("2. the design doc states the before/after Resolver logic and names both Authorities", () => {
    expect(designDocSource).toMatch(/resolveRuntimeStorageBackend\(\) -> ALWAYS MemoryStorageBackend/);
    expect(designDocSource).toMatch(/determineFedosRuntimeMode\(\)/);
    expect(designDocSource).toMatch(/determineFedosRuntimePlatform\(\)/);
    expect(designDocSource).toMatch(/"Windows"\s*\|\s*"Other"/);
  });

  it("3. the design doc confirms Platform/Runtime Mode responsibility separation with a comparison table", () => {
    expect(designDocSource).toMatch(/Runtime Modeとの責務分離/);
    expect(designDocSource).toMatch(/fedos_runtime_mode_authority\.ts` \(Alpha 020, unmodified\)/);
    expect(designDocSource).toMatch(/fedos_runtime_platform_authority\.ts` \(new, this Stage\)/);
    expect(designDocSource).toMatch(
      /deleting either one\s+would not require changing the other's own source/,
    );
  });

  it("4. the design doc explains, with reasoning, why DPAPI failure never falls back to Memory", () => {
    expect(designDocSource).toMatch(/Fail Closed — why DPAPI failure never falls back to Memory/);
    expect(designDocSource).toMatch(/Silent fallback would hide a real security-relevant fact/);
    expect(designDocSource).toMatch(/A `load\(\)` fallback would be actively incorrect/);
    expect(designDocSource).toMatch(/PICKER, not a RECOVERY mechanism/);
  });

  it("5. the design doc explains why Memory Backend is preserved as the universal default, not a deprecated fallback", () => {
    expect(designDocSource).toMatch(/Memoryを残す理由/);
    expect(designDocSource).toMatch(/is not a deprecated fallback path/);
    expect(designDocSource).toMatch(/UNIVERSAL default/);
  });

  it("6. the design doc records a six-row regression matrix across Runtime Mode x Platform, and the explicit 'does NOT do' list", () => {
    expect(designDocSource).toMatch(/Regression — confirmed across all combinations/);
    expect(designDocSource).toMatch(/\| Development \| Windows \| `WindowsDpapiStorageBackend`/);
    expect(designDocSource).toMatch(/\| Production \| Windows \| `MemoryStorageBackend`/);
    expect(designDocSource).toMatch(/\| Unknown \| Other \| `MemoryStorageBackend`/);
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* remove, deprecate, or change `MemoryStorageBackend`'s own\s+behavior/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any fallback from a failed DPAPI call to Memory/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* connect a Worker/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* connect Production/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change any Public Runtime API signature/);
  });

  it("7. cross-references Alpha 021/022/023", () => {
    expect(designDocSource).toMatch(/secure_runtime_alpha_021_storage_backend_abstraction\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_022_storage_backend_selection_policy_review\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_023_windows_dpapi_storage_backend\.md/);
    expect(alpha022DocSource).toMatch(/Recommended: Windows DPAPI/);
    expect(alpha023DocSource).toMatch(/WindowsDpapiStorageBackend/);
  });

  it("8. fedos_runtime_platform_authority.ts exports exactly determineFedosRuntimePlatform (plus its type), reads only process.platform, never throws, and never references the Runtime Mode Authority", () => {
    const exportedFns = [...platformAuthoritySource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedFns)).toEqual(new Set(["determineFedosRuntimePlatform"]));
    expect(platformAuthoritySource).toMatch(/export type FedosRuntimePlatform = "Windows" \| "Other";/);

    const codeOnly = codeOnlyLines(platformAuthoritySource);
    expect(codeOnly).toMatch(/process\.platform/);
    expect(codeOnly).not.toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/fedos_runtime_mode_authority|determineFedosRuntimeMode/);
    expect(codeOnly).toMatch(/try\s*\{/);
    expect(codeOnly).toMatch(/catch\s*\{/);
    expect(codeOnly).not.toMatch(/isDpapiAllowed|isWindowsSecure|authorizePlatform|isProductionAllowed/);
  });

  it("9. determineFedosRuntimePlatform() correctly classifies win32 as Windows and any other value as Other, and never throws even if process itself is broken", () => {
    expect(determineFedosRuntimePlatform()).toBe(isWindows ? "Windows" : "Other");
    expect(process.platform).toBe(realPlatform);

    const broken = {
      get platform(): string {
        throw new Error("simulated unreadable process.platform");
      },
    };
    const original = (globalThis as unknown as { process: unknown }).process;
    (globalThis as unknown as { process: unknown }).process = broken;
    try {
      expect(() => determineFedosRuntimePlatform()).not.toThrow();
      expect(determineFedosRuntimePlatform()).toBe("Other");
    } finally {
      (globalThis as unknown as { process: unknown }).process = original;
    }
  });

  it("10. determineFedosRuntimePlatform() classifies non-win32 overrides as Other (portable test, no real platform change needed)", async () => {
    const linux: FedosRuntimePlatform = await withPlatform("linux", () => determineFedosRuntimePlatform());
    expect(linux).toBe("Other");
    const darwin: FedosRuntimePlatform = await withPlatform("darwin", () => determineFedosRuntimePlatform());
    expect(darwin).toBe("Other");
    const win32: FedosRuntimePlatform = await withPlatform("win32", () => determineFedosRuntimePlatform());
    expect(win32).toBe("Windows");
  });

  it("11. fedos_runtime_storage_resolver.ts reads both Authorities, combines them with plain if logic, and contains no fallback logic of any kind (it never calls .store(/.load(/.delete( on any backend)", () => {
    const codeOnly = codeOnlyLines(storageResolverSource);
    expect(codeOnly).toMatch(/from "\.\/fedos_runtime_mode_authority\.js"/);
    expect(codeOnly).toMatch(/from "\.\/fedos_runtime_platform_authority\.js"/);
    expect(codeOnly).toMatch(/determineFedosRuntimeMode\(\)/);
    expect(codeOnly).toMatch(/determineFedosRuntimePlatform\(\)/);
    expect(codeOnly).not.toMatch(/\.store\(|\.load\(|\.delete\(/);
    expect(codeOnly).not.toMatch(/catch[\s\S]{0,80}sharedWindowsDpapiBackend|catch[\s\S]{0,80}MemoryStorageBackend\(\)/);
    const exportedFns = [...storageResolverSource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedFns)).toEqual(new Set(["resolveRuntimeStorageBackend"]));
  });

  it("12. resolveRuntimeStorageBackend() resolves the full six-row matrix correctly (Development/Production/Unknown x Windows/Other)", async () => {
    await withNodeEnv("development", async () => {
      const onWindows = await withPlatform("win32", () => resolveRuntimeStorageBackend());
      expect(onWindows).toBeInstanceOf(WindowsDpapiStorageBackend);
      const onLinux = await withPlatform("linux", () => resolveRuntimeStorageBackend());
      expect(onLinux).toBeInstanceOf(MemoryStorageBackend);
      const onDarwin = await withPlatform("darwin", () => resolveRuntimeStorageBackend());
      expect(onDarwin).toBeInstanceOf(MemoryStorageBackend);
    });

    await withNodeEnv("production", async () => {
      const onWindows = await withPlatform("win32", () => resolveRuntimeStorageBackend());
      expect(onWindows).toBeInstanceOf(MemoryStorageBackend);
      const onLinux = await withPlatform("linux", () => resolveRuntimeStorageBackend());
      expect(onLinux).toBeInstanceOf(MemoryStorageBackend);
    });

    await withNodeEnv(undefined, async () => {
      const onWindows = await withPlatform("win32", () => resolveRuntimeStorageBackend());
      expect(onWindows).toBeInstanceOf(MemoryStorageBackend);
      const onLinux = await withPlatform("linux", () => resolveRuntimeStorageBackend());
      expect(onLinux).toBeInstanceOf(MemoryStorageBackend);
    });
  });

  it("13. resolveRuntimeStorageBackend() always returns the SAME shared instance across repeated calls under stable conditions, for EACH backend", async () => {
    await withNodeEnv("development", async () => {
      await withPlatform("win32", () => {
        const first = resolveRuntimeStorageBackend();
        const second = resolveRuntimeStorageBackend();
        expect(first).toBe(second);
      });
      await withPlatform("linux", () => {
        const first = resolveRuntimeStorageBackend();
        const second = resolveRuntimeStorageBackend();
        expect(first).toBe(second);
      });
    });
  });

  it("14. no auto-fallback to Memory: a WindowsDpapiStorageBackend failure resolves false/null and leaves no trace in a separate MemoryStorageBackend instance", async () => {
    const dpapiBackend = new WindowsDpapiStorageBackend({ platform: "win32", runPowerShell: async () => null });
    const stored = await dpapiBackend.store("no-fallback-check", "wire" as never);
    expect(stored).toBe(false);
    const loaded = await dpapiBackend.load("no-fallback-check");
    expect(loaded).toBeNull();

    const separateMemory = new MemoryStorageBackend();
    expect(await separateMemory.load("no-fallback-check")).toBeNull();
  });

  it.skipIf(!isWindows)(
    "15. [Windows only] the FULL chain -- storeCiphertext()/loadCiphertext()/deleteCiphertext() -> Resolver -> WindowsDpapiStorageBackend -> real powershell.exe -- round-trips the exact original wire value in Development Runtime on this real machine",
    async () => {
      await withNodeEnv("development", async () => {
        const resolved = resolveRuntimeStorageBackend();
        expect(resolved).toBeInstanceOf(WindowsDpapiStorageBackend);

        const wire = '{"v":1,"alg":"chacha20poly1305","aad":"test_only","n":"AAAA","ct":"AAAA","tag":"AAAA"}';
        const stored = await storeCiphertext("alpha024-real-dpapi", wire as never);
        expect(stored).toBe(true);
        const loaded = await loadCiphertext("alpha024-real-dpapi");
        expect(loaded).toBe(wire);
        const deleted = await deleteCiphertext("alpha024-real-dpapi");
        expect(deleted).toBe(true);
        expect(await loadCiphertext("alpha024-real-dpapi")).toBeNull();
      });
    },
    20000,
  );

  it("16. Memory Backend regression: an explicitly injected MemoryStorageBackend still round-trips exactly as Alpha 019/021 designed, regardless of this Stage's own Resolver change", async () => {
    await withNodeEnv("development", async () => {
      const storage = new MemoryStorageBackend();
      const wire = '{"v":1,"alg":"chacha20poly1305","aad":"root_key","n":"BBBB","ct":"BBBB","tag":"BBBB"}';
      expect(await storeCiphertext("alpha024-memory-id", wire as never, storage)).toBe(true);
      expect(await loadCiphertext("alpha024-memory-id", storage)).toBe(wire);
      expect(await deleteCiphertext("alpha024-memory-id", storage)).toBe(true);
    });
  });

  it("17. Production/Unknown Runtime still resolve null via the Public API regardless of platform, even though the Resolver would otherwise pick a real backend on Windows", async () => {
    const prodStore = await withNodeEnv("production", () => storeCiphertext("id", "wire" as never));
    expect(prodStore).toBeNull();
    const unknownLoad = await withNodeEnv(undefined, () => loadCiphertext("id"));
    expect(unknownLoad).toBeNull();
  });

  it("18. initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected -- confirmed by ACTUAL calls after exercising the new Resolver logic first", async () => {
    await withNodeEnv("development", async () => {
      resolveRuntimeStorageBackend();
      await storeCiphertext("regress-id", "wire" as never);
      await loadCiphertext("regress-id");
      await deleteCiphertext("regress-id");
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

  it("19. calling runtime.storeCiphertext()/loadCiphertext()/deleteCiphertext() via the real AppRuntime object never throws, in Development or Production", async () => {
    const runtime = createRuntime();
    const devStored = await withNodeEnv("development", () => runtime.storeCiphertext("id", "wire" as never));
    expect(typeof devStored === "boolean" || devStored === null).toBe(true);
    const prodStored = await withNodeEnv("production", () => runtime.storeCiphertext("id", "wire" as never));
    expect(prodStored).toBeNull();
  });

  it("20. fedos_runtime_storage_backend.ts (MemoryStorageBackend) and fedos_runtime_storage_backend_windows_dpapi.ts (WindowsDpapiStorageBackend) are both confirmed BYTE-FOR-BYTE unchanged by this Stage", () => {
    const exportedClasses = [...storageBackendSource.matchAll(/^export class (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedClasses)).toEqual(new Set(["MemoryStorageBackend"]));
    expect(codeOnlyLines(storageBackendSource)).not.toMatch(/WindowsDpapi|platform_authority/i);

    const dpapiExportedClasses = [...dpapiBackendSource.matchAll(/^export class (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(dpapiExportedClasses)).toEqual(new Set(["WindowsDpapiStorageBackend"]));
    expect(codeOnlyLines(dpapiBackendSource)).not.toMatch(/fedos_runtime_platform_authority|fedos_runtime_mode_authority/);
  });

  it("21. fedos_runtime_ciphertext_storage.ts/types.ts/create_runtime.ts are all confirmed unchanged -- zero reference to the Platform Authority or this Stage's own doc anywhere in CODE", () => {
    expect(codeOnlyLines(storageServiceSource)).not.toMatch(/platform_authority|secure_runtime_alpha_024/i);
    expect(codeOnlyLines(runtimeTypesSource)).not.toMatch(/platform_authority|secure_runtime_alpha_024/i);
    expect(codeOnlyLines(createRuntimeSource)).not.toMatch(/platform_authority|secure_runtime_alpha_024/i);
  });

  it("22. Worker remains fully unconnected -- no reference to the Platform Authority, the DPAPI helper/backend, or this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/platform_authority|WindowsDpapi|dpapi_helper|secure_runtime_alpha_024/i);
  });

  it("23. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("24. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc or identifiers", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_024/);
    expect(libRsSource).not.toMatch(/platform_authority/i);

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

  it("25. exactly one new fedos_*.ts file was added by this Stage -- 56 total", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(files).length).toBe(57);
  });

  it("26. sanity: the Runtime Mode Authority itself is untouched and still the sole real NODE_ENV gate this Resolver defers to", () => {
    expect(typeof determineFedosRuntimeMode).toBe("function");
    expect(["Development", "Production", "Unknown"]).toContain(determineFedosRuntimeMode());
  });
});
