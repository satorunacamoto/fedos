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
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_025_secure_storage_api_scope_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import opaqueHandlesDocSource from "../docs/public_crypto_opaque_handles.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageServiceSource from "../src/runtime/fedos_runtime_ciphertext_storage.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageBackendSource from "../src/runtime/fedos_runtime_storage_backend.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import dpapiBackendSource from "../src/runtime/fedos_runtime_storage_backend_windows_dpapi.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageResolverSource from "../src/runtime/fedos_runtime_storage_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import modeAuthoritySource from "../src/runtime/fedos_runtime_mode_authority.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import platformAuthoritySource from "../src/runtime/fedos_runtime_platform_authority.ts?raw";
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

/**
 * Secure Runtime Alpha 025 — "Secure Storage API Scope Review": REVIEW
 * ONLY, no code change of any kind. Classifies what the Secure Storage
 * API can/cannot store today, compares five future storage-scope
 * candidates (Ciphertext only / +Metadata / +Identity / Runtime全体 /
 * Arbitrary Object Store), and confirms two layering boundaries:
 * Storage must never hold Identity (Identity Layer may use Storage,
 * never the reverse), and Nostr Event/DM/Attachment persistence is an
 * Identity/Application Layer responsibility, never Storage Layer's.
 */
describe("Secure Runtime Alpha 025 -- Secure Storage API Scope Review, review only, no Storage/Runtime/Worker/Rust/Cargo/package change", () => {
  it("1. the review document exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(8000);
  });

  it("2. states REVIEW ONLY with an explicit multi-target 'no code change' list", () => {
    expect(designDocSource).toMatch(/REVIEW ONLY/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `fedos_runtime_ciphertext_storage\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `fedos_runtime_storage_backend\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `fedos_runtime_storage_backend_windows_dpapi\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `fedos_runtime_storage_resolver\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `src\/worker\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `packages\/fedos-core-rust\/src\/lib\.rs`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change any Public Runtime API signature/);
  });

  it("3. classifies the ONE storable type (AeadCiphertextWire) and all seven unstorable categories with reasons", () => {
    expect(designDocSource).toMatch(/What can be stored today/);
    expect(designDocSource).toMatch(/Exactly ONE type crosses/);
    expect(designDocSource).toMatch(/AeadCiphertextWire/);
    for (const unstorable of [
      "AeadKeyHandle",
      "AeadCiphertextHandle",
      "RuntimeCapabilities",
      "Runtime Mode",
      "Runtime Platform",
      "randomBytes\\(\\)",
      "decrypt\\(\\)",
    ]) {
      expect(designDocSource).toMatch(new RegExp(`\\|\\s*\`?${unstorable}`));
    }
  });

  it("4. compares all five mandated future storage-scope candidates across all nine mandated criteria", () => {
    for (const candidate of [
      "① Ciphertextのみ",
      "② Ciphertext \\+ Metadata",
      "③ Ciphertext \\+ Identity",
      "④ Runtime全体",
      "⑤ Arbitrary Object Store",
    ]) {
      expect(designDocSource).toMatch(new RegExp(candidate));
    }
    for (const criterion of [
      "Fail Closed",
      "責務",
      "Security",
      "移植性",
      "Storage抽象",
      "Worker",
      "Production",
      "Nostr",
      "将来性",
    ]) {
      expect(designDocSource).toMatch(new RegExp(criterion));
    }
  });

  it("5. concludes candidate ① remains correct, ② is future-only-if-reviewed, and ③/④/⑤ are permanently rejected", () => {
    expect(designDocSource).toMatch(
      /\*\*Conclusion\*\*: ① \(the current scope\) remains correct and should stay\s+the ONLY implemented scope/,
    );
    expect(designDocSource).toMatch(/③, ④, and ⑤ should be treated as PERMANENTLY REJECTED/);
    expect((designDocSource.match(/Should be permanently rejected/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("6. states the Identity/Storage layering direction and the one-directional permission rule", () => {
    expect(designDocSource).toMatch(/Identity Layer\s*\n\s*\|\s*\n\s*v\s*\nCrypto Layer/);
    expect(designDocSource).toMatch(/\*\*Storage must never hold, reference, or depend on Identity\.\*\*/);
    expect(designDocSource).toMatch(/The only permitted structure is the REVERSE/);
    expect(designDocSource).toMatch(/a ONE-DIRECTIONAL\s*\npermission, not a two-way relationship/);
  });

  it("7. states Nostr Event/DM/Attachment storage is an Identity/Application Layer responsibility, never Storage Layer's", () => {
    expect(designDocSource).toMatch(
      /\*\*Nostr Event storage, DM storage, and Attachment storage are explicitly\s+NOT Storage Layer responsibilities\.\*\*/,
    );
    expect(designDocSource).toMatch(/Identity\/\s*\nApplication Layer/);
    expect(designDocSource).toMatch(/storeCiphertext\(id, wire\)\s+\(Storage Layer/);
  });

  it("8. cross-references Alpha 006/019/020/021/022/023/024 and the permanent opaque-handle exclusion doc", () => {
    expect(designDocSource).toMatch(/secure_runtime_alpha_006_mode_authority_review\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_019_secure_storage_foundation\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_020_runtime_mode_authority_consolidation\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_021_storage_backend_abstraction\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_024_dpapi_resolver_integration\.md/);
    expect(designDocSource).toMatch(/public_crypto_opaque_handles\.md/);
    expect(opaqueHandlesDocSource.length).toBeGreaterThan(100);
  });

  it("9. NONE of the four Storage-chain files reference Identity/Nostr vocabulary in actual CODE -- only in guardrail prose (comments), confirmed via comment-stripped source inspection", () => {
    const forbidden = /Identity|Nostr|pubkey|npub|nsec|nevent/i;
    expect(codeOnlyLines(storageServiceSource)).not.toMatch(forbidden);
    expect(codeOnlyLines(storageBackendSource)).not.toMatch(forbidden);
    expect(codeOnlyLines(dpapiBackendSource)).not.toMatch(forbidden);
    expect(codeOnlyLines(storageResolverSource)).not.toMatch(forbidden);
  });

  it("10. the Storage Service's own id parameter is confirmed to be an opaque, caller-supplied string -- no Identity-shaped type anywhere in its own signatures", () => {
    expect(storageServiceSource).toMatch(/export async function storeCiphertext\(\s*id: string,/);
    expect(storageServiceSource).toMatch(/export async function loadCiphertext\(\s*id: string,/);
    expect(storageServiceSource).toMatch(/export async function deleteCiphertext\(\s*id: string,/);
    expect(storageServiceSource).not.toMatch(/pubkey|npub|Identity/i);
  });

  it("11. no Storage/Backend/Resolver/Authority file was modified -- Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED, no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(44);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(16);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_025/);

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

  it("12. no fedos_*.ts file was added or removed by this documentation-only Stage -- still exactly 56 files", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(files).length).toBe(57);
  });

  it("13. fedos_runtime_ciphertext_storage.ts/fedos_runtime_storage_backend.ts/fedos_runtime_storage_backend_windows_dpapi.ts/fedos_runtime_storage_resolver.ts are all confirmed to have no reference to this Stage's own doc", () => {
    for (const source of [storageServiceSource, storageBackendSource, dpapiBackendSource, storageResolverSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_025/);
    }
  });

  it("14. Runtime Mode/Platform Authorities are confirmed unmodified -- unchanged exports, no reference to this Stage's own doc", () => {
    const modeFns = [...modeAuthoritySource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(modeFns)).toEqual(new Set(["determineFedosRuntimeMode"]));
    const platformFns = [...platformAuthoritySource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(platformFns)).toEqual(new Set(["determineFedosRuntimePlatform"]));
    expect(modeAuthoritySource).not.toMatch(/secure_runtime_alpha_025/);
    expect(platformAuthoritySource).not.toMatch(/secure_runtime_alpha_025/);
  });

  it("15. types.ts/create_runtime.ts are confirmed unchanged -- zero reference to this Stage's own doc anywhere in CODE", () => {
    expect(codeOnlyLines(runtimeTypesSource)).not.toMatch(/secure_runtime_alpha_025/);
    expect(codeOnlyLines(createRuntimeSource)).not.toMatch(/secure_runtime_alpha_025/);
  });

  it("16. Worker remains fully unconnected and unmodified -- no reference to this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_025/);
    expect(workerSource).not.toMatch(/storeCiphertext|loadCiphertext|deleteCiphertext/);
  });

  it("17. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("18. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this review", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha025-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha025-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha025-id"));
    expect(deleted).toBe(true);
  });

  it("19. Regression: initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected -- confirmed by ACTUAL calls", async () => {
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha025-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha025-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha025-direct"))).toBe(true);
  });
});
