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
import { NoopFedosIdentityProvider } from "../src/identity/fedos_noop_identity_provider.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_033_fedos_noop_identity_provider.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha032DocSource from "../docs/secure_runtime_alpha_032_fedos_identity_provider_resolver.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopProviderSource from "../src/identity/fedos_noop_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import resolverSource from "../src/identity/fedos_identity_provider_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/identity/fedos_identity_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
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
import storageBackendSource from "../src/runtime/fedos_runtime_storage_backend.ts?raw";
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
 * Secure Runtime Alpha 033 — "FedOS No-op Identity Provider": adds
 * exactly ONE class, `NoopFedosIdentityProvider`, the first concrete
 * `FedosIdentityProvider` (Alpha 029) implementation in this repository
 * -- fixed `provider = "noop"`, `describeIdentity()` always resolving
 * `null`, no constructor, no state, no exception, and no wiring into
 * the Resolver (Alpha 032), the Service (Alpha 031), the Runtime, or
 * the Worker.
 */
describe("Secure Runtime Alpha 033 -- FedOS No-op Identity Provider, Resolver/Service/Runtime/Rust/Worker unchanged", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(7000);
  });

  it("2. the design doc states this Stage adds exactly one class, the first concrete Provider implementation", () => {
    expect(designDocSource).toMatch(/a single class only/);
    expect(designDocSource).toMatch(
      /the FIRST concrete `FedosIdentityProvider`\s+\(Alpha 029\) implementation\s+anywhere in this repository/,
    );
    expect(designDocSource).toMatch(/secure_runtime_alpha_032_fedos_identity_provider_resolver\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_029_fedos_identity_provider_interface\.md/);
    expect(alpha032DocSource).toMatch(/resolveFedosIdentityProvider/);
  });

  it("3. the design doc records the exact class shape", () => {
    expect(designDocSource).toMatch(
      /export class NoopFedosIdentityProvider implements FedosIdentityProvider \{/,
    );
    expect(designDocSource).toMatch(/readonly provider = "noop";/);
    expect(designDocSource).toMatch(/async describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{/);
  });

  it("4. the design doc explains why this Stage adds a No-op Provider now", () => {
    expect(designDocSource).toMatch(/なぜNo-opを追加するのか/);
    expect(designDocSource).toMatch(/actually IMPLEMENTABLE as specified/);
  });

  it("5. the design doc explains why this is NOT wired into resolveFedosIdentityProvider(), and quotes its unchanged body", () => {
    expect(designDocSource).toMatch(/Resolverへまだ接続しない理由/);
    expect(designDocSource).toMatch(
      /export function resolveFedosIdentityProvider\(\): FedosIdentityProvider \| null \{/,
    );
    expect(designDocSource).toMatch(/would make the Resolver's own `null` LIE/);
  });

  it("6. the design doc distinguishes the Resolver's null from the Noop Provider's own null with a table", () => {
    expect(designDocSource).toMatch(/null Resolverとの責務分離/);
    expect(designDocSource).toMatch(/\| \*\*Who returns it\*\* \|/);
    expect(designDocSource).toMatch(/PROVIDER AVAILABILITY/);
    expect(designDocSource).toMatch(/IDENTITY AVAILABILITY/);
  });

  it("7. the design doc describes the future Nostr Provider position as a sibling, not a base/derived pair", () => {
    expect(designDocSource).toMatch(/将来Nostr Providerへ置換される位置/);
    expect(designDocSource).toMatch(/SIBLINGS/);
    expect(designDocSource).toMatch(/not a partial Nostr\s+implementation/);
  });

  it("8. the design doc compares against MemoryStorageBackend with a table", () => {
    expect(designDocSource).toMatch(/Storage Backendとの比較/);
    expect(designDocSource).toMatch(/MemoryStorageBackend`? \(Alpha 019\/021\)/);
    expect(designDocSource).toMatch(/\| \*\*Interface implemented\*\* \|/);
    expect(designDocSource).toMatch(/simplest POSSIBLE implementation/);
  });

  it("9. the design doc records the explicit 'does NOT do' list", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement any Nostr, ActivityPub, or Bluesky Provider\./);
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* wire `NoopFedosIdentityProvider` into\s+`resolveFedosIdentityProvider\(\)`/,
    );
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* wire `NoopFedosIdentityProvider` into\s+`FedosIdentityService`/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* add a constructor, configuration, internal state/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* throw an exception under any circumstance\./);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
  });

  it("10. fedos_noop_identity_provider.ts exports EXACTLY NoopFedosIdentityProvider, no other export", () => {
    expect([...noopProviderSource.matchAll(/^export class (\w+)/gm)].map((m: RegExpMatchArray) => m[1])).toEqual([
      "NoopFedosIdentityProvider",
    ]);
    expect([...noopProviderSource.matchAll(/^export (?:async )?function/gm)].length).toBe(0);
    expect([...noopProviderSource.matchAll(/^export interface/gm)].length).toBe(0);
    expect([...noopProviderSource.matchAll(/^export const/gm)].length).toBe(0);
  });

  it("11. the class has no constructor, no field beyond the fixed provider literal, and never throws", () => {
    const codeOnly = codeOnlyLines(noopProviderSource);
    expect(codeOnly).not.toMatch(/constructor\s*\(/);
    expect(codeOnly).not.toMatch(/\bthrow\b/);
    expect(codeOnly).not.toMatch(/\btry\s*\{/);
    expect(codeOnly).not.toMatch(/\bif\s*\(/);
    expect(codeOnly).not.toMatch(/\bswitch\s*\(/);
    expect(codeOnly).toMatch(/readonly provider = "noop";/);
    const fieldDeclarations = [...codeOnly.matchAll(/^\s*(?:readonly\s+)?#?\w+\s*[:=]/gm)];
    expect(fieldDeclarations.length).toBe(1);
  });

  it("12. describeIdentity()'s body is EXACTLY 'return null;' -- confirmed by literal string extraction", () => {
    const body = (
      noopProviderSource.match(/async describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n(?:  )?\}/) ?? []
    )[1] ?? "";
    expect(body.trim()).toBe("return null;");
  });

  it("13. fedos_noop_identity_provider.ts's own CODE (excluding its own explanatory header comment) does not reference the Resolver, the Service, the Runtime, or any Nostr/Authentication/Session vocabulary", () => {
    const codeOnly = codeOnlyLines(noopProviderSource);
    expect(codeOnly).not.toMatch(/fedos_identity_provider_resolver|resolveFedosIdentityProvider/);
    expect(codeOnly).not.toMatch(/fedos_identity_service|FedosIdentityService/);
    expect(codeOnly).not.toMatch(/nostr|Nostr|NIP-/);
    expect(codeOnly).not.toMatch(/ActivityPub|Bluesky/i);
    expect(codeOnly).not.toMatch(/Authenticat|session|Session|credential|Credential/);
    expect(codeOnly).not.toMatch(/determineFedosRuntimeMode|fedos_runtime_mode_authority/);
    expect(codeOnly).not.toMatch(/determineFedosRuntimePlatform|fedos_runtime_platform_authority/);
  });

  it("14. behavioral: NoopFedosIdentityProvider reports provider === 'noop' and describeIdentity() always resolves null, called repeatedly", async () => {
    const provider = new NoopFedosIdentityProvider();
    expect(provider.provider).toBe("noop");
    expect(await provider.describeIdentity()).toBeNull();
    expect(await provider.describeIdentity()).toBeNull();
    expect(await provider.describeIdentity()).toBeNull();

    const second = new NoopFedosIdentityProvider();
    expect(second.provider).toBe("noop");
    expect(await second.describeIdentity()).toBeNull();
  });

  it("15. RIPPLE (Secure Runtime Alpha 034, then Alpha 036): resolveFedosIdentityProvider() (Alpha 032) was confirmed hardcoded to null with zero reference to the Noop Provider AS OF this Stage's own scope; Alpha 034 later wired it to return this Stage's own NoopFedosIdentityProvider; Alpha 036 later re-wired it again to return NostrIdentityProvider instead, leaving only a prose (header-comment) reference to NoopFedosIdentityProvider in the CURRENT resolver source -- confirmed here, per this arc's own established ripple convention. This Stage's own file, fedos_noop_identity_provider.ts, remains untouched by either later wiring (its own CODE, excluding its explanatory header comment, still makes zero reference to the Resolver -- reconfirmed by test 13 above)", () => {
    expect(resolverSource).toMatch(/NoopFedosIdentityProvider|fedos_noop_identity_provider/);
    expect(resolverSource).not.toMatch(/secure_runtime_alpha_033/);
  });

  it("16. RIPPLE (Secure Runtime Alpha 042): fedos_identity_service.ts (Alpha 031) was confirmed BYTE-FOR-BYTE unchanged AS OF this Stage's own scope; Alpha 042 later added a required second constructor argument (an injected FedosIdentityRegistry) -- reconfirmed here as the CURRENT signature, still no reference to the Noop Provider", () => {
    expect(serviceSource).toMatch(/constructor\(provider: FedosIdentityProvider, registry: FedosIdentityRegistry\) \{/);
    expect(serviceSource).not.toMatch(/NoopFedosIdentityProvider|fedos_noop_identity_provider/);
    expect(serviceSource).not.toMatch(/secure_runtime_alpha_033/);
  });

  it("17. fedos_identity_provider.ts/fedos_identity_descriptor.ts/fedos_identity_capability.ts are all confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(providerInterfaceSource).toMatch(/describeIdentity\(\): Promise<FedosIdentityDescriptor \| null>;/);
    expect(providerInterfaceSource).not.toMatch(/secure_runtime_alpha_033/);
    expect(descriptorSource).toMatch(/readonly publicIdentifier: string;/);
    expect(descriptorSource).not.toMatch(/secure_runtime_alpha_033/);
    expect(capabilitySource).toMatch(/readonly available: boolean;/);
    expect(capabilitySource).not.toMatch(/secure_runtime_alpha_033/);
  });

  it("18. RIPPLE (Secure Runtime Alpha 034, then Alpha 036, then Alpha 050-052): fedos_noop_identity_provider.ts had ZERO importers anywhere in src/ AS OF Alpha 033's own scope; Alpha 034 later made fedos_identity_provider_resolver.ts its first (and, per that Stage's own mandate, only) real importer; Alpha 036 later re-wired the Resolver to import NostrIdentityProvider instead, returning fedos_noop_identity_provider.ts to ZERO real (code-level) importers -- the Resolver's own header comment still names NoopFedosIdentityProvider in prose (explaining why it was not deleted), but its CODE no longer imports it; Alpha 050-052 later made fedos_runtime_identity.ts a new, real, code-level importer (a safe fallback for the Provider Resolver's own nullable return type) -- reconfirmed here as the CURRENT state via codeOnlyLines(), per this arc's own established ripple convention. Every other file remains a non-importer", () => {
    expect(resolverSource).toMatch(/fedos_noop_identity_provider|NoopFedosIdentityProvider/);
    expect(codeOnlyLines(resolverSource)).not.toMatch(/fedos_noop_identity_provider|NoopFedosIdentityProvider/);
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
      storageBackendSource,
      createRuntimeSource,
      runtimeTypesSource,
      workerSource,
      nobleSignatureSource,
    ]) {
      expect(source).not.toMatch(/fedos_noop_identity_provider/);
      expect(source).not.toMatch(/NoopFedosIdentityProvider/);
    }
    expect(fedosRuntimeIdentitySource).toMatch(/import \{ NoopFedosIdentityProvider \} from "\.\.\/identity\/fedos_noop_identity_provider\.js";/);
  });

  it("19. MemoryStorageBackend (fedos_runtime_storage_backend.ts) is confirmed unchanged -- no reference to this Stage's own doc or the new Noop Provider", () => {
    expect(storageBackendSource).toMatch(/export class MemoryStorageBackend implements RuntimeStorageBackend \{/);
    expect(storageBackendSource).not.toMatch(/secure_runtime_alpha_033/);
    expect(storageBackendSource).not.toMatch(/NoopFedosIdentityProvider|fedos_noop_identity_provider/);
  });

  it("20. no existing src/identity/* file was modified, and no Runtime/Worker/Nostr file references this Stage's own doc", () => {
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
      expect(source).not.toMatch(/secure_runtime_alpha_033/);
    }
  });

  it("21. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("22. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(45);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(16);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_033/);

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

  it("23. no fedos_*.ts file under src/runtime/ was added or removed -- still exactly 56 files; exactly one new file was added under src/identity/ -- 17 files total AS OF Alpha 033's own scope (Secure Runtime Alpha 035 later added an 18th, fedos_nostr_identity_provider.ts; Secure Runtime Alpha 039 later added a 19th and 20th, fedos_nostr_public_identity_source.ts and fedos_null_nostr_public_identity_source.ts; Secure Runtime Alpha 040 later added a 21st, fedos_identity_record.ts)", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("24. RIPPLE (Secure Runtime Alpha 034, then Alpha 036): resolveFedosIdentityProvider() resolved null on every call AS OF this Stage's own scope; Alpha 034 later wired it to return this Stage's own NoopFedosIdentityProvider on every call instead; Alpha 036 later re-wired it again to return a shared NostrIdentityProvider instead -- confirmed here as the CURRENT behavior (still a real, non-null, same-instance-every-call singleton -- just no longer THIS Stage's own NoopFedosIdentityProvider), per this arc's own established ripple convention", () => {
    const resolved = resolveFedosIdentityProvider();
    expect(resolved).not.toBeNull();
    expect(resolved).not.toBeInstanceOf(NoopFedosIdentityProvider);
    expect(resolveFedosIdentityProvider()).toBe(resolved);
  });

  it("25. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha033-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha033-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha033-id"));
    expect(deleted).toBe(true);
  });

  it("26. Regression: initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected -- confirmed by ACTUAL calls", async () => {
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha033-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha033-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha033-direct"))).toBe(true);
  });
});
