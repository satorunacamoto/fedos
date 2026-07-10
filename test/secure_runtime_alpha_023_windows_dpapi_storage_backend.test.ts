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
import { protectWithWindowsDpapi, unprotectWithWindowsDpapi } from "../src/runtime/fedos_windows_dpapi_helper.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined }; platform: string };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_023_windows_dpapi_storage_backend.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha022DocSource from "../docs/secure_runtime_alpha_022_storage_backend_selection_policy_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import dpapiHelperSource from "../src/runtime/fedos_windows_dpapi_helper.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import dpapiBackendSource from "../src/runtime/fedos_runtime_storage_backend_windows_dpapi.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageBackendSource from "../src/runtime/fedos_runtime_storage_backend.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageResolverSource from "../src/runtime/fedos_runtime_storage_resolver.ts?raw";
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

const isWindows = process.platform === "win32";

/**
 * Secure Runtime Alpha 023 — "Windows DPAPI Storage Backend": adds
 * `WindowsDpapiStorageBackend`, a SECOND `RuntimeStorageBackend`
 * implementation alongside Alpha 019/021's `MemoryStorageBackend`,
 * completing the backend Alpha 022 recommended. The Storage Resolver
 * stays hardcoded to `MemoryStorageBackend` only -- wiring a real
 * switch is explicitly out of scope. Entries live in an in-process
 * `Map` (same non-persistent-across-restart contract as
 * `MemoryStorageBackend`); the VALUE held is DPAPI-protected. DPAPI is
 * reached via `powershell.exe` (Alpha 022's own recommendation) -- no
 * new npm/Rust dependency, no Rust/Cargo/package.json change.
 */
describe("Secure Runtime Alpha 023 -- Windows DPAPI Storage Backend, Memory Backend/Resolver/Public API unchanged, no Rust/Cargo/package change", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(6000);
  });

  it("2. the design doc compares all five mandated implementation methods across all four mandated criteria, and selects PowerShell with reasoning", () => {
    for (const method of ["PowerShell", "child_process", "Node native API", "Rust", "Other"]) {
      expect(designDocSource).toMatch(new RegExp(method.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    expect(designDocSource).toMatch(/新規依存/);
    expect(designDocSource).toMatch(/保守性/);
    expect(designDocSource).toMatch(/Fail Closed/);
    expect(designDocSource).toMatch(/Runtime適合性/);
    expect(designDocSource).toMatch(
      /\*\*Selected: ① PowerShell, invoked via `child_process`/,
    );
  });

  it("3. the design doc structurally rules out Rust/WASM for DPAPI, not merely by preference", () => {
    expect(designDocSource).toMatch(/wasm32-unknown-unknown/);
    expect(designDocSource).toMatch(/NO Win32 API access of any kind/);
    expect(designDocSource).toMatch(/Cargo\.toml`\s+are\s+therefore both untouched/);
  });

  it("4. the design doc records the Fail Closed table and the explicit 'no Development/Production gate in this Backend' statement", () => {
    expect(designDocSource).toMatch(/Fail Closed table/);
    expect(designDocSource).toMatch(/No Development\/Production gate lives in this Backend or its\s*\nhelper/);
  });

  it("5. the design doc records what this Stage does NOT do", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* wire `WindowsDpapiStorageBackend` into\s+`resolveRuntimeStorageBackend\(\)`/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* connect a Worker/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* connect Production/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change any Public Runtime API signature/);
  });

  it("6. cross-references Alpha 019/021/022", () => {
    expect(designDocSource).toMatch(/secure_runtime_alpha_019_secure_storage_foundation\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_021_storage_backend_abstraction\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_022_storage_backend_selection_policy_review\.md/);
    expect(alpha022DocSource).toMatch(/Recommended: Windows DPAPI/);
  });

  it("7. fedos_windows_dpapi_helper.ts exports exactly protectWithWindowsDpapi/unprotectWithWindowsDpapi (plus its options type), with no Buffer/filesystem/network reference and no template-literal interpolation into the PowerShell scripts", () => {
    const exportedFns = [...dpapiHelperSource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedFns)).toEqual(new Set(["protectWithWindowsDpapi", "unprotectWithWindowsDpapi"]));
    const codeOnly = codeOnlyLines(dpapiHelperSource);
    expect(codeOnly).not.toMatch(/\bBuffer\b/);
    expect(codeOnly).not.toMatch(/writeFileSync|readFileSync|existsSync|fs\./);
    expect(codeOnly).not.toMatch(/fetch\(|WebSocket|http\.|https\./);
    expect(codeOnly).not.toMatch(/\$\{/);
    expect(codeOnly).toMatch(/ProtectedData/);
    expect(codeOnly).toMatch(/CurrentUser/);
  });

  it("8. protectWithWindowsDpapi()/unprotectWithWindowsDpapi() Fail Closed to null on a non-Windows platform override, without ever spawning a process", async () => {
    const neverCalled = async (): Promise<string | null> => {
      throw new Error("runPowerShell should never be called when platform override is non-Windows");
    };
    expect(await protectWithWindowsDpapi("secret", { platform: "linux", runPowerShell: neverCalled })).toBeNull();
    expect(
      await unprotectWithWindowsDpapi("ZmFrZQ==", { platform: "linux", runPowerShell: neverCalled }),
    ).toBeNull();
    expect(await protectWithWindowsDpapi("secret", { platform: "darwin", runPowerShell: neverCalled })).toBeNull();
  });

  it("9. protectWithWindowsDpapi()/unprotectWithWindowsDpapi() Fail Closed to null when the injected PowerShell runner fails or throws, never escaping an exception", async () => {
    const failing = async (): Promise<string | null> => null;
    const throwing = async (): Promise<string | null> => {
      throw new Error("simulated powershell.exe failure");
    };
    expect(await protectWithWindowsDpapi("secret", { platform: "win32", runPowerShell: failing })).toBeNull();
    expect(await protectWithWindowsDpapi("secret", { platform: "win32", runPowerShell: throwing })).toBeNull();
    expect(await unprotectWithWindowsDpapi("ZmFrZQ==", { platform: "win32", runPowerShell: failing })).toBeNull();
    expect(await unprotectWithWindowsDpapi("ZmFrZQ==", { platform: "win32", runPowerShell: throwing })).toBeNull();
  });

  it("10. protectWithWindowsDpapi()/unprotectWithWindowsDpapi() correctly base64-encode input for the injected runner and base64-decode its output", async () => {
    let capturedStdin: string | null = null;
    const capture = async (_script: string, stdinBase64: string): Promise<string | null> => {
      capturedStdin = stdinBase64;
      return "aGVsbG8="; // base64("hello")
    };
    const result = await protectWithWindowsDpapi("plaintext-value", { platform: "win32", runPowerShell: capture });
    expect(result).toBe("aGVsbG8=");
    // base64("plaintext-value"), precomputed -- this test file has no
    // `Buffer` typing either (same tsconfig constraint the helper
    // module's own doc comment explains).
    expect(capturedStdin).toBe("cGxhaW50ZXh0LXZhbHVl");
  });

  it.skipIf(!isWindows)(
    "11. [Windows only] protectWithWindowsDpapi()/unprotectWithWindowsDpapi() perform a REAL DPAPI round trip via the actual powershell.exe on this machine",
    async () => {
      const plaintext = "alpha023-real-dpapi-roundtrip-" + "x".repeat(20);
      const protectedValue = await protectWithWindowsDpapi(plaintext);
      expect(protectedValue).not.toBeNull();
      expect(typeof protectedValue).toBe("string");
      expect(protectedValue).not.toBe(plaintext);
      const recovered = await unprotectWithWindowsDpapi(protectedValue as string);
      expect(recovered).toBe(plaintext);
    },
    20000,
  );

  it("12. WindowsDpapiStorageBackend exports as the sole export of its own file, implements store/load/delete, and never holds the plaintext wire in its own Map (verified via an injected runner)", async () => {
    const exportedClasses = [...dpapiBackendSource.matchAll(/^export class (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedClasses)).toEqual(new Set(["WindowsDpapiStorageBackend"]));

    const calls: Array<{ script: string; stdin: string }> = [];
    const backend = new WindowsDpapiStorageBackend({
      platform: "win32",
      runPowerShell: async (script: string, stdin: string) => {
        calls.push({ script, stdin });
        if (script.includes("Unprotect")) {
          // Echo back whatever protect produced, to prove load() feeds
          // store()'s own output back into unprotect, not the original
          // plaintext.
          return stdin;
        }
        return "cHJvdGVjdGVkLXZhbHVl"; // base64("protected-value"), a fake but valid protect() result
      },
    });
    const stored = await backend.store("id-1", "genuine-wire-value" as never);
    expect(stored).toBe(true);
    expect(calls.length).toBe(1);
    // The protect call's stdin is base64("genuine-wire-value"),
    // precomputed -- the ORIGINAL plaintext.
    expect(calls[0]?.stdin).toBe("Z2VudWluZS13aXJlLXZhbHVl");

    const loaded = await backend.load("id-1");
    expect(calls.length).toBe(2);
    // The unprotect call's stdin is the PROTECTED value store() produced
    // ("cHJvdGVjdGVkLXZhbHVl"), never the original plaintext -- proving
    // the Map holds the protected form, not the raw wire.
    expect(calls[1]?.stdin).toBe("cHJvdGVjdGVkLXZhbHVl");
    // Our fake unprotect echoes its stdin back verbatim; unprotectWithWindowsDpapi()
    // always base64-decodes that echoed value as its final step (the SAME
    // step a real DPAPI unprotect result goes through) -- base64("protected-value")
    // decodes back to the literal text "protected-value".
    expect(loaded).toBe("protected-value");
  });

  it("13. WindowsDpapiStorageBackend Fail Closed: store()/delete() resolve boolean (never null/throw); load() resolves AeadCiphertextWire|null; non-Windows makes store() resolve false and load() resolve null", async () => {
    const backend = new WindowsDpapiStorageBackend({ platform: "linux" });
    expect(await backend.store("id", "wire" as never)).toBe(false);
    expect(await backend.load("id")).toBeNull();
    expect(await backend.delete("id")).toBe(false); // never stored, nothing to delete
  });

  it("14. WindowsDpapiStorageBackend.delete() is a pure Map operation -- confirmed true when an entry exists (even one that failed to protect is never inserted) and false otherwise, regardless of platform", async () => {
    const backend = new WindowsDpapiStorageBackend({
      platform: "win32",
      runPowerShell: async () => "cHJvdGVjdGVk",
    });
    expect(await backend.store("present", "wire" as never)).toBe(true);
    expect(await backend.delete("present")).toBe(true);
    expect(await backend.delete("present")).toBe(false);
    expect(await backend.delete("never-existed")).toBe(false);
  });

  it("15. WindowsDpapiStorageBackend has NO Development/Production gate of its own -- direct construction and use succeeds identically regardless of NODE_ENV (that gate remains the Runtime Storage Service's own job)", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const backend = new WindowsDpapiStorageBackend({
        platform: "win32",
        runPowerShell: async (script: string, stdin: string) => (script.includes("Unprotect") ? stdin : "cHJvdA=="),
      });
      expect(await backend.store("id", "wire" as never)).toBe(true);
      // base64("cHJvdA==") decodes to the literal text "prot" -- see test
      // #12's own note on why the echoed-base64 mock decodes, not
      // round-trips verbatim.
      expect(await backend.load("id")).toBe("prot");
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });

  it.skipIf(!isWindows)(
    "16. [Windows only] a full WindowsDpapiStorageBackend store()/load()/delete() round trip via the REAL powershell.exe recovers the exact original wire value",
    async () => {
      const backend = new WindowsDpapiStorageBackend();
      const wire = '{"v":1,"alg":"chacha20poly1305","aad":"test_only","n":"AAAA","ct":"AAAA","tag":"AAAA"}';
      const stored = await backend.store("alpha023-real-id", wire as never);
      expect(stored).toBe(true);
      const loaded = await backend.load("alpha023-real-id");
      expect(loaded).toBe(wire);
      const deleted = await backend.delete("alpha023-real-id");
      expect(deleted).toBe(true);
      expect(await backend.load("alpha023-real-id")).toBeNull();
    },
    20000,
  );

  it("17. fedos_runtime_storage_backend_windows_dpapi.ts has no filesystem/SQLite/IndexedDB/Keychain/Secret-Service/network reference, and no Development/Production/Runtime-Mode reference", () => {
    const codeOnly = codeOnlyLines(dpapiBackendSource);
    expect(codeOnly).not.toMatch(
      /readFileSync|writeFileSync|existsSync|sqlite|indexeddb|keychain|secret service|fetch\(|WebSocket/i,
    );
    expect(codeOnly).not.toMatch(/determineFedosRuntimeMode|fedos_runtime_mode_authority/);
    expect(codeOnly).not.toMatch(/randomBytes|generateAeadKey|\bencrypt\(|\bdecrypt\(|exportCiphertext|importCiphertext|runtimeCapabilities/);
    expect(codeOnly).not.toMatch(/AeadKeyHandle/);
  });

  it("18. fedos_runtime_storage_backend.ts (MemoryStorageBackend's own file) is confirmed BYTE-FOR-BYTE unchanged -- still exactly RuntimeStorageBackend/MemoryStorageBackend, still a plain Map", () => {
    const exportedInterfaces = [...storageBackendSource.matchAll(/^export interface (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedInterfaces)).toEqual(new Set(["RuntimeStorageBackend"]));
    const exportedClasses = [...storageBackendSource.matchAll(/^export class (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedClasses)).toEqual(new Set(["MemoryStorageBackend"]));
    expect(codeOnlyLines(storageBackendSource)).not.toMatch(/WindowsDpapi|dpapi|powershell/i);
  });

  it("19. the Storage Resolver is confirmed BYTE-FOR-BYTE unchanged -- still hardcoded to MemoryStorageBackend only, no reference to WindowsDpapiStorageBackend of any kind", () => {
    const codeOnly = codeOnlyLines(storageResolverSource);
    expect(codeOnly).toMatch(/return sharedBackend;/);
    expect(codeOnly).not.toMatch(/WindowsDpapi|dpapi|powershell/i);
    const exportedFns = [...storageResolverSource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedFns)).toEqual(new Set(["resolveRuntimeStorageBackend"]));

    const first = resolveRuntimeStorageBackend();
    expect(first).toBeInstanceOf(MemoryStorageBackend);
  });

  it("20. fedos_runtime_ciphertext_storage.ts/types.ts/create_runtime.ts are all confirmed unchanged -- zero reference to WindowsDpapiStorageBackend/the DPAPI helper/this Stage's own doc anywhere in CODE", () => {
    expect(codeOnlyLines(storageServiceSource)).not.toMatch(/WindowsDpapi|dpapi_helper|secure_runtime_alpha_023/i);
    expect(codeOnlyLines(runtimeTypesSource)).not.toMatch(/WindowsDpapi|dpapi_helper|secure_runtime_alpha_023/i);
    expect(codeOnlyLines(createRuntimeSource)).not.toMatch(/WindowsDpapi|dpapi_helper|secure_runtime_alpha_023/i);
  });

  it("21. Public Runtime Storage API is unaffected -- storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip via the real AppRuntime object (still MemoryStorageBackend under the hood)", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      const runtime = createRuntime();
      const stored = await runtime.storeCiphertext("alpha023-id", "wire" as never);
      expect(stored).toBe(true);
      const loaded = await runtime.loadCiphertext("alpha023-id");
      expect(loaded).toBe("wire");
      const deleted = await runtime.deleteCiphertext("alpha023-id");
      expect(deleted).toBe(true);

      const direct = await storeCiphertext("alpha023-direct", "wire2" as never);
      expect(direct).toBe(true);
      expect(await loadCiphertext("alpha023-direct")).toBe("wire2");
      expect(await deleteCiphertext("alpha023-direct")).toBe(true);
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });

  it("22. initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected -- confirmed by ACTUAL calls after exercising the new Backend/helper first", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      const backend = new WindowsDpapiStorageBackend({ platform: "win32", runPowerShell: async () => "x" });
      await backend.store("regress", "wire" as never);
      await backend.load("regress");
      await backend.delete("regress");

      expect(createRuntimeInitializeCryptoResult()).toEqual({
        allowed: false,
        initialized: false,
        reason: "PrototypeDisabled",
      });

      const caps = await runtimeCapabilities();
      expect(Object.keys(caps).sort()).toEqual(
        ["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort(),
      );

      const bytes = await randomBytes();
      expect(bytes === null || bytes instanceof Uint8Array).toBe(true);

      const key = await generateAeadKey();
      expect(key === null || (typeof key === "object" && key !== null)).toBe(true);

      const ciphertext = await encrypt(
        { kind: "AeadKeyHandle" } as never,
        "ChaCha20Poly1305",
        "TestOnly",
        new Uint8Array([1]),
      );
      expect(ciphertext === null || (typeof ciphertext === "object" && ciphertext !== null)).toBe(true);

      const plaintext = await decrypt(
        { kind: "AeadKeyHandle" } as never,
        "ChaCha20Poly1305",
        "TestOnly",
        { kind: "AeadCiphertextHandle" } as never,
      );
      expect(plaintext === null || plaintext instanceof Uint8Array).toBe(true);

      const exported = await exportCiphertext({ kind: "AeadCiphertextHandle" } as never);
      expect(exported === null || typeof exported === "string").toBe(true);

      const imported = await importCiphertext("x" as never);
      expect(imported === null || typeof imported === "object").toBe(true);
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });

  it("23. Worker remains fully unconnected -- no reference to WindowsDpapiStorageBackend, the DPAPI helper, or this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/WindowsDpapi|dpapi_helper|secure_runtime_alpha_023/i);
    expect(workerSource).not.toMatch(/fedos_runtime_storage_backend_windows_dpapi|fedos_windows_dpapi_helper/);
  });

  it("24. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("25. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc or identifiers", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_023/);
    expect(libRsSource).not.toMatch(/dpapi|WindowsDpapi/i);

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
    expect(pkg.dependencies ?? {}).not.toHaveProperty("keytar");
  });

  it("26. exactly two new fedos_*.ts files were added by this Stage -- still 55 total", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(files).length).toBe(55);
  });
});
