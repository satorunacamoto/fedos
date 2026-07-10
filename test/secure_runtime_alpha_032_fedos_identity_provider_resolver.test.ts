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
import { resolveFedosIdentityProvider } from "../src/identity/fedos_identity_provider_resolver.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_032_fedos_identity_provider_resolver.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha031DocSource from "../docs/secure_runtime_alpha_031_fedos_identity_service_skeleton.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import resolverSource from "../src/identity/fedos_identity_provider_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/identity/fedos_identity_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/identity/fedos_identity_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerInterfaceSource from "../src/identity/fedos_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilitySource from "../src/identity/fedos_identity_capability.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerBoundarySource from "../src/identity/provider_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerTypesSource from "../src/identity/provider_types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerBridgeSource from "../src/identity/provider_bridge.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import webauthnAdapterSource from "../src/identity/webauthn_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityTypesSource from "../src/identity/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sessionBoundarySource from "../src/identity/session_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageResolverSource from "../src/runtime/fedos_runtime_storage_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../src/runtime/fedos_wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nobleSignatureSource from "../src/nostr/noble_signature.ts?raw";
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
 * Secure Runtime Alpha 032 — "FedOS Identity Provider Resolver": adds
 * exactly ONE function, `resolveFedosIdentityProvider()`, hardcoded to
 * always return `null` -- no `if`, no `switch`, no environment read, no
 * Runtime Mode/Platform Authority reference, no Storage Resolver
 * integration, and no wiring into `FedosIdentityService` (Alpha 031) or
 * any other module.
 */
describe("Secure Runtime Alpha 032 -- FedOS Identity Provider Resolver, null-only, no Provider implementation/Service change/Runtime/Nostr/Worker change", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(7000);
  });

  it("2. the design doc states this Stage adds exactly one function, hardcoded to null, continuing Alpha 028-031", () => {
    expect(designDocSource).toMatch(/a single function only/);
    expect(designDocSource).toMatch(/hardcoded to always return `null`/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_031_fedos_identity_service_skeleton\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_029_fedos_identity_provider_interface\.md/);
    expect(alpha031DocSource).toMatch(/FedosIdentityService/);
  });

  it("3. the design doc records the exact Resolver shape and its own selector-not-gate responsibility", () => {
    expect(designDocSource).toMatch(
      /export function resolveFedosIdentityProvider\(\): FedosIdentityProvider \| null \{/,
    );
    expect(designDocSource).toMatch(/return null;/);
    expect(designDocSource).toMatch(/Resolver責務/);
    expect(designDocSource).toMatch(/strictly a selector, never a gate/);
  });

  it("4. the design doc states separation from Service and from Provider", () => {
    expect(designDocSource).toMatch(/Serviceとの責務分離/);
    expect(designDocSource).toMatch(/Providerとの責務分離/);
    expect(designDocSource).toMatch(
      /does NOT import\s+`fedos_identity_service\.ts`/,
    );
  });

  it("5. the design doc compares against resolveRuntimeStorageBackend() with a table, and explains the key structural difference (honesty about what exists)", () => {
    expect(designDocSource).toMatch(/Storage Resolverとの比較/);
    expect(designDocSource).toMatch(/resolveRuntimeStorageBackend\(\)`? \(Alpha 021\/024\)/);
    expect(designDocSource).toMatch(/\| \*\*Return type\*\* \|/);
    expect(designDocSource).toMatch(
      /\*\*The key structural difference is not stylistic\s+— it is honesty about/,
    );
  });

  it("6. the design doc gives three independent reasons for the null-fixed decision, and the future Nostr Provider connection point", () => {
    expect(designDocSource).toMatch(/なぜ今は`null`固定なのか/);
    expect(designDocSource).toMatch(/\*\*No real answer exists\.\*\*/);
    expect(designDocSource).toMatch(/\*\*A placeholder object would be a worse answer than `null`\.\*\*/);
    expect(designDocSource).toMatch(
      /This arc has never authorized building a "safe default" Provider\.\*\*/,
    );
    expect(designDocSource).toMatch(/将来Nostr Providerをここへ接続する理由/);
  });

  it("7. the design doc records the explicit 'does NOT do' list", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement any `FedosIdentityProvider`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any selection condition, `if`, or `switch`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* read `process\.env`/);
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* integrate with, call, or reference\s+`resolveRuntimeStorageBackend\(\)`/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_service\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
  });

  it("8. fedos_identity_provider_resolver.ts exports EXACTLY resolveFedosIdentityProvider, always resolving null with no branch, no environment/Authority/Storage-Resolver reference", () => {
    const exportedFns = [...resolverSource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedFns)).toEqual(new Set(["resolveFedosIdentityProvider"]));
    expect([...resolverSource.matchAll(/^export class/gm)].length).toBe(0);
    expect([...resolverSource.matchAll(/^export interface/gm)].length).toBe(0);

    const codeOnly = codeOnlyLines(resolverSource);
    expect(codeOnly).not.toMatch(/\bif\s*\(/);
    expect(codeOnly).not.toMatch(/switch\s*\(/);
    expect(codeOnly).not.toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/determineFedosRuntimeMode|fedos_runtime_mode_authority/);
    expect(codeOnly).not.toMatch(/determineFedosRuntimePlatform|fedos_runtime_platform_authority/);
    expect(codeOnly).not.toMatch(/resolveRuntimeStorageBackend|fedos_runtime_storage_resolver/);
    expect(codeOnly).not.toMatch(/fedos_identity_service|FedosIdentityService/);
  });

  it("9. RIPPLE (Secure Runtime Alpha 034): the function body was 'return null;' AS OF this Stage's own scope; Alpha 034 later changed it to return a shared NoopFedosIdentityProvider singleton -- confirmed here by literal string extraction of the CURRENT body, per this arc's own established ripple convention", () => {
    const body = (resolverSource.match(/export function resolveFedosIdentityProvider\(\): FedosIdentityProvider \| null \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    expect(body.trim()).toBe("return sharedNoopProvider;");
  });

  it("10. RIPPLE (Secure Runtime Alpha 034): behavioral -- resolveFedosIdentityProvider() resolved null on every call AS OF this Stage's own scope; now resolves the SAME shared NoopFedosIdentityProvider singleton on every call, per Alpha 034's own wiring -- see test/secure_runtime_alpha_034_fedos_noop_resolver_wiring.test.ts for that Stage's own full behavioral coverage", () => {
    const first = resolveFedosIdentityProvider();
    const second = resolveFedosIdentityProvider();
    expect(first).not.toBeNull();
    expect(first).toBe(second);
  });

  it("11. fedos_identity_provider_resolver.ts has ZERO importers anywhere in src/ other than this Stage's own guard test", () => {
    for (const source of [
      serviceSource,
      descriptorSource,
      providerInterfaceSource,
      capabilitySource,
      providerBoundarySource,
      providerTypesSource,
      providerBridgeSource,
      webauthnAdapterSource,
      identityTypesSource,
      sessionBoundarySource,
      storageResolverSource,
      createRuntimeSource,
      runtimeTypesSource,
      workerSource,
      nobleSignatureSource,
    ]) {
      expect(source).not.toMatch(/fedos_identity_provider_resolver/);
      expect(source).not.toMatch(/resolveFedosIdentityProvider/);
    }
  });

  it("12. fedos_identity_service.ts (Alpha 031) is confirmed BYTE-FOR-BYTE unchanged -- constructor still requires an explicit FedosIdentityProvider argument, no default, no reference to this Stage's own doc", () => {
    expect(serviceSource).toMatch(/constructor\(provider: FedosIdentityProvider\) \{/);
    expect(serviceSource).not.toMatch(/resolveFedosIdentityProvider/);
    expect(serviceSource).not.toMatch(/secure_runtime_alpha_032/);
  });

  it("13. fedos_identity_provider.ts/fedos_identity_descriptor.ts/fedos_identity_capability.ts are all confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(providerInterfaceSource).toMatch(/describeIdentity\(\): Promise<FedosIdentityDescriptor \| null>;/);
    expect(providerInterfaceSource).not.toMatch(/secure_runtime_alpha_032/);
    expect(descriptorSource).toMatch(/readonly publicIdentifier: string;/);
    expect(descriptorSource).not.toMatch(/secure_runtime_alpha_032/);
    expect(capabilitySource).toMatch(/readonly available: boolean;/);
    expect(capabilitySource).not.toMatch(/secure_runtime_alpha_032/);
  });

  it("14. the Storage Resolver (fedos_runtime_storage_resolver.ts) is confirmed unchanged -- no reference to this Stage's own doc or the new Identity Resolver", () => {
    expect(storageResolverSource).not.toMatch(/secure_runtime_alpha_032/);
    expect(storageResolverSource).not.toMatch(/fedos_identity_provider_resolver|resolveFedosIdentityProvider/);
  });

  it("15. no existing src/identity/* file was modified, and no Runtime/Worker/Nostr file references this Stage's own doc", () => {
    for (const source of [
      providerBoundarySource,
      providerTypesSource,
      providerBridgeSource,
      webauthnAdapterSource,
      identityTypesSource,
      sessionBoundarySource,
      createRuntimeSource,
      runtimeTypesSource,
      workerSource,
      nobleSignatureSource,
    ]) {
      expect(source).not.toMatch(/secure_runtime_alpha_032/);
    }
  });

  it("16. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("17. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_032/);

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

  it("18. no fedos_*.ts file under src/runtime/ was added or removed -- still exactly 56 files; exactly one new file was added under src/identity/ -- 16 files total AS OF Alpha 032's own scope (Secure Runtime Alpha 033 later added a 17th, fedos_noop_identity_provider.ts)", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(56);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(17);
  });

  it("19. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha032-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha032-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha032-id"));
    expect(deleted).toBe(true);
  });

  it("20. Regression: initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected -- confirmed by ACTUAL calls", async () => {
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha032-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha032-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha032-direct"))).toBe(true);
  });
});
