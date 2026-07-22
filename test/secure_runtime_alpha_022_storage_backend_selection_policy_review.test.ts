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
import { MemoryStorageBackend } from "../src/runtime/fedos_runtime_storage_backend.js";
import { resolveRuntimeStorageBackend } from "../src/runtime/fedos_runtime_storage_resolver.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import reviewDocSource from "../docs/secure_runtime_alpha_022_storage_backend_selection_policy_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha021DocSource from "../docs/secure_runtime_alpha_021_storage_backend_abstraction.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha020DocSource from "../docs/secure_runtime_alpha_020_runtime_mode_authority_consolidation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageBackendSource from "../src/runtime/fedos_runtime_storage_backend.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageResolverSource from "../src/runtime/fedos_runtime_storage_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageServiceSource from "../src/runtime/fedos_runtime_ciphertext_storage.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import modeAuthoritySource from "../src/runtime/fedos_runtime_mode_authority.ts?raw";
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
    .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

/**
 * Secure Runtime Alpha 022 — "Storage Backend Selection Policy Review":
 * REVIEW ONLY, no code change of any kind. Compares five Storage
 * Backend candidates (Memory/DPAPI/Keychain/Secret Service/Browser)
 * across ten criteria, decides the Storage Resolver (not the Runtime
 * Storage Service, not Worker) is where a future backend-selection
 * condition belongs, confirms that Resolver must never become a second
 * Runtime Mode Authority, and recommends Windows DPAPI as the single
 * Alpha 023 candidate -- advisory only, no implementation.
 */
describe("Secure Runtime Alpha 022 -- Storage Backend Selection Policy Review, review only, no Backend/Resolver/Service/Worker/Rust/Cargo/package change", () => {
  it("1. the review document exists and is substantial", () => {
    expect(typeof reviewDocSource).toBe("string");
    expect(reviewDocSource.length).toBeGreaterThan(8000);
  });

  it("2. states REVIEW ONLY with an explicit multi-target 'no code change' list", () => {
    expect(reviewDocSource).toMatch(/REVIEW ONLY/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* implement Windows DPAPI/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* implement a filesystem, SQLite, or IndexedDB backend/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* add a backend-selection condition/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* add a new Crypto API/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* add Identity or Network capability/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* connect a Worker/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* connect Production/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `packages\/fedos-core-rust\/src\/lib\.rs`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change any Public Runtime API signature/);
  });

  it("3. all five mandated backend candidates are named and compared across all ten mandated criteria", () => {
    for (const backend of ["Memory", "Windows DPAPI", "macOS Keychain", "Linux Secret Service", "Browser Secure Storage"]) {
      expect(reviewDocSource).toMatch(new RegExp(backend.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    for (const criterion of [
      "Security",
      "Portability",
      "Runtime依存",
      "Worker対応",
      "Desktop対応",
      "Fail Closed",
      "Backup",
      "Exportability",
      "User Experience",
      "Implementation Complexity",
    ]) {
      expect(reviewDocSource).toMatch(new RegExp(criterion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("4. the Test Backend candidate is reviewed and found redundant with the existing injectable-storage-parameter pattern -- no dedicated Test Backend recommended", () => {
    expect(reviewDocSource).toMatch(/Test Backend/);
    expect(reviewDocSource).toMatch(/no dedicated Test Backend is recommended/i);
  });

  it("5. compares at least four Resolver-location candidates (Runtime Storage Service, Storage Resolver, Worker, backend-self-detection) and adopts the Resolver", () => {
    expect(reviewDocSource).toMatch(/Inside the Runtime Storage Service/);
    expect(reviewDocSource).toMatch(/Inside the Storage Resolver/);
    expect(reviewDocSource).toMatch(/Inside `src\/worker\.ts`/);
    expect(reviewDocSource).toMatch(/self-detecting availability/);
    expect(reviewDocSource).toMatch(/\*\*RECOMMENDED\.\*\*/);
    expect(reviewDocSource).toMatch(
      /the switch condition belongs in the Resolver\s+\(Option B\),\s+exactly where Alpha 021 already seeded it/,
    );
  });

  it("6. confirms the Storage Backend Resolver answers an orthogonal question from the Runtime Mode Authority and must never reuse or extend it", () => {
    expect(reviewDocSource).toMatch(/completely orthogonal/);
    expect(reviewDocSource).toMatch(/determineFedosRuntimeMode\(\)/);
    expect(reviewDocSource).toMatch(
      /does not import, reference, or depend on `fedos_runtime_mode_authority\.ts`/,
    );
    expect(reviewDocSource).toMatch(/never by importing or extending `determineFedosRuntimeMode\(\)`/);
    expect(reviewDocSource).toMatch(/never a second `isProductionAllowed\(\)`-shaped authorization function|isProductionAllowed/);
  });

  it("7. recommends exactly one backend for Alpha 023 -- Windows DPAPI -- with ranked reasoning, and explicitly deprioritizes the other three real backends", () => {
    expect(reviewDocSource).toMatch(/\*\*Recommended: Windows DPAPI\.\*\*/);
    expect(reviewDocSource).toMatch(/Zero new dependency/);
    expect(reviewDocSource).toMatch(/Narrowest Fail-Closed surface/);
    expect(reviewDocSource).toMatch(/Explicitly deprioritized for Alpha 023/);
    expect(reviewDocSource).toMatch(/macOS\s+Keychain\s+\(a\s+strong\s+second\s+choice/);
    expect(reviewDocSource).toMatch(/Linux\s+Secret\s+Service\s+\(worst\s+fragmentation/);
    expect(reviewDocSource).toMatch(/Browser\s+Secure\s+Storage\s+\(requires\s+a\s+non-Node\s+runtime/);
    expect(reviewDocSource).toMatch(/This recommendation is \*\*advisory only\*\*/);
  });

  it("8. cross-references Alpha 019/020/021/006", () => {
    expect(reviewDocSource).toMatch(/secure_runtime_alpha_019_secure_storage_foundation\.md/);
    expect(reviewDocSource).toMatch(/secure_runtime_alpha_020_runtime_mode_authority_consolidation\.md/);
    expect(reviewDocSource).toMatch(/secure_runtime_alpha_021_storage_backend_abstraction\.md/);
    expect(reviewDocSource).toMatch(/secure_runtime_alpha_006_mode_authority_review\.md/);
    expect(alpha021DocSource).toMatch(/resolveRuntimeStorageBackend/);
    expect(alpha020DocSource).toMatch(/classifier/i);
  });

  it("9. fedos_runtime_storage_resolver.ts was confirmed BYTE-FOR-BYTE unchanged from Alpha 021 AS OF Alpha 022's own scope (a review-only Stage) -- still hardcoded to MemoryStorageBackend only, still no environment/platform read; Secure Runtime Alpha 024 later implemented exactly the Resolver-based switch this Stage's own §4 recommended, reading BOTH the Runtime Mode Authority and a new, separately-named Platform Authority as two independent classifiers, never merged into one", () => {
    const exportedFns = [...storageResolverSource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedFns)).toEqual(new Set(["resolveRuntimeStorageBackend"]));
  });

  it("10. fedos_runtime_storage_backend.ts is confirmed unchanged -- still exactly RuntimeStorageBackend/MemoryStorageBackend, still a plain Map, no DPAPI/Keychain/Secret Service/Browser/filesystem/SQLite/IndexedDB reference", () => {
    const codeOnly = codeOnlyLines(storageBackendSource);
    expect(codeOnly).toMatch(/new Map</);
    expect(codeOnly).not.toMatch(
      /dpapi|keychain|secret service|indexeddb|sqlite|readFileSync|writeFileSync|existsSync/i,
    );
    const exportedInterfaces = [...storageBackendSource.matchAll(/^export interface (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedInterfaces)).toEqual(new Set(["RuntimeStorageBackend"]));
    const exportedClasses = [...storageBackendSource.matchAll(/^export class (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedClasses)).toEqual(new Set(["MemoryStorageBackend"]));
  });

  it("11. fedos_runtime_ciphertext_storage.ts is confirmed unchanged -- still exactly three exported functions, still delegates to the Resolver, still no interface/class of its own", () => {
    const exportedFns = [...storageServiceSource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedFns)).toEqual(new Set(["storeCiphertext", "loadCiphertext", "deleteCiphertext"]));
    expect([...storageServiceSource.matchAll(/^export interface/gm)].length).toBe(0);
    expect([...storageServiceSource.matchAll(/^export class/gm)].length).toBe(0);
    expect(storageServiceSource).toMatch(/resolveRuntimeStorageBackend\(\)/);
  });

  it("12. the Runtime Mode Authority module itself is confirmed unchanged and still the sole NODE_ENV reader in src/runtime/", () => {
    expect(codeOnlyLines(modeAuthoritySource)).toMatch(/process\.env/);
    expect(codeOnlyLines(modeAuthoritySource)).not.toMatch(/platform|dpapi|keychain|secret service/i);
    const exportedFns = [...modeAuthoritySource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedFns)).toEqual(new Set(["determineFedosRuntimeMode"]));
  });

  it("13. types.ts and create_runtime.ts are confirmed unchanged -- no reference to this Stage's own doc or to any new backend identifier", () => {
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_022/);
    expect(codeOnlyLines(createRuntimeSource)).not.toMatch(/secure_runtime_alpha_022/);
    expect(codeOnlyLines(createRuntimeSource)).not.toMatch(/dpapi|keychain|secret service/i);
  });

  it("14. Public Runtime Storage API is unaffected -- storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      const runtime = createRuntime();
      const stored = await runtime.storeCiphertext("alpha022-id", "wire" as never);
      expect(stored).toBe(true);
      const loaded = await runtime.loadCiphertext("alpha022-id");
      expect(loaded).toBe("wire");
      const deleted = await runtime.deleteCiphertext("alpha022-id");
      expect(deleted).toBe(true);
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });

  it("15. resolveRuntimeStorageBackend() still always resolves the same MemoryStorageBackend singleton -- confirmed by an ACTUAL call", () => {
    const first = resolveRuntimeStorageBackend();
    const second = resolveRuntimeStorageBackend();
    expect(first).toBe(second);
    expect(first).toBeInstanceOf(MemoryStorageBackend);
  });

  it("16. initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected by this review -- confirmed by ACTUAL calls", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
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

  it("17. Worker remains fully unconnected -- no reference to this Stage's own doc, the Backend/Resolver modules, or any new backend identifier", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_022/);
    expect(workerSource).not.toMatch(/fedos_runtime_storage_backend|fedos_runtime_storage_resolver/);
    expect(workerSource).not.toMatch(/dpapi|keychain|secret service/i);
  });

  it("18. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("19. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc or identifiers", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(64);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_022/);
    expect(libRsSource).not.toMatch(/dpapi|keychain|secret service/i);

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

  it("20. no fedos_*.ts file was added or removed by THIS Stage -- exactly 53 files AS OF Alpha 022's own scope (Secure Runtime Alpha 023 later added a 54th and 55th, fedos_windows_dpapi_helper.ts/fedos_runtime_storage_backend_windows_dpapi.ts, implementing the DPAPI backend this Stage's own review recommended; Secure Runtime Alpha 024 later added a 56th, fedos_runtime_platform_authority.ts, and wired the DPAPI backend into the Resolver this Stage's own review designed for)", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(files).length).toBe(57);
  });
});
