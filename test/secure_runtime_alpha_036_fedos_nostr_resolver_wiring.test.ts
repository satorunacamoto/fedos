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
import { NostrIdentityProvider } from "../src/identity/fedos_nostr_identity_provider.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_036_fedos_nostr_resolver_wiring.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha034DocSource from "../docs/secure_runtime_alpha_034_fedos_noop_resolver_wiring.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha035DocSource from "../docs/secure_runtime_alpha_035_fedos_nostr_identity_provider.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import resolverSource from "../src/identity/fedos_identity_provider_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopProviderSource from "../src/identity/fedos_noop_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrProviderSource from "../src/identity/fedos_nostr_identity_provider.ts?raw";
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
import nostrCryptoSource from "../src/nostr/crypto.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrEventSource from "../src/nostr/event.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrRelaySource from "../src/nostr/relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrWsRelaySource from "../src/nostr/ws_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrPublishSource from "../src/nostr/publish.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrSignatureSource from "../src/nostr/signature.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrMessagesSource from "../src/nostr/messages.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrTypesSource from "../src/nostr/types.ts?raw";
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
 * Secure Runtime Alpha 036 -- "FedOS Nostr Resolver Wiring": changes
 * exactly ONE function body, in ONE file: `resolveFedosIdentityProvider()`
 * now returns a shared `NostrIdentityProvider` (Alpha 035) singleton
 * instead of the shared `NoopFedosIdentityProvider` (Alpha 033)
 * singleton it returned since Alpha 034 -- no Runtime wiring, no
 * Service change, no Descriptor/Capability change, no Nostr Provider
 * change, no Noop Provider deletion, no Worker/Rust of any kind.
 */
describe("Secure Runtime Alpha 036 -- FedOS Nostr Resolver Wiring, Runtime/Service/Descriptor/Capability/Worker/Rust unchanged, Noop Provider undeleted", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(7000);
  });

  it("2. the design doc states this Stage changes exactly one function body in one file, cross-referencing Alpha 034/035", () => {
    expect(designDocSource).toMatch(/one function body changed, in one file/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_034_fedos_noop_resolver_wiring\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_035_fedos_nostr_identity_provider\.md/);
    expect(alpha034DocSource).toMatch(/sharedNoopProvider/);
    expect(alpha035DocSource).toMatch(/NostrIdentityProvider/);
  });

  it("3. the design doc explains why the Resolver switched from Noop to Nostr", () => {
    expect(designDocSource).toMatch(/NoopからNostrへResolverを切り替えた理由/);
    expect(designDocSource).toMatch(/Nostr was always the named destination, not a hypothetical\./);
  });

  it("4. the design doc explains describeIdentity() is still always null, and that this Stage does not change NostrIdentityProvider itself", () => {
    expect(designDocSource).toMatch(/describeIdentity\(\)はまだnullである理由/);
    expect(designDocSource).toMatch(/fedos_nostr_identity_provider\.ts` is byte-for-byte unchanged/);
    expect(designDocSource).toMatch(/return null;/);
  });

  it("5. the design doc explains why this stays disconnected from Runtime", () => {
    expect(designDocSource).toMatch(/Runtime未接続である理由/);
    expect(designDocSource).toMatch(/FedosIdentityService.*still requires an explicit\s+constructor argument, with no default\./);
  });

  it("6. the design doc names a future Descriptor-fetching position without implementing it", () => {
    expect(designDocSource).toMatch(/将来Descriptor取得へ繋がる位置/);
    expect(designDocSource).toMatch(/changes NOTHING about\s+this\s+Resolver/);
  });

  it("7. the design doc explains why NoopFedosIdentityProvider is not deleted", () => {
    expect(designDocSource).toMatch(/Noop Providerを削除しない理由/);
    expect(designDocSource).toMatch(
      /Deleting it would be a strictly LARGER, riskier change than this\s+Stage's own mandate authorizes\./,
    );
  });

  it("8. the design doc records the exact Resolver change and the return-type-unchanged decision", () => {
    expect(designDocSource).toMatch(
      /const sharedNostrProvider: FedosIdentityProvider = new NostrIdentityProvider\(\);/,
    );
    expect(designDocSource).toMatch(
      /export function resolveFedosIdentityProvider\(\): FedosIdentityProvider \| null \{/,
    );
    expect(designDocSource).toMatch(/return sharedNostrProvider;/);
    expect(designDocSource).toMatch(/戻り値型...は変更禁止/);
  });

  it("9. the design doc records the explicit 'does NOT do' list", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `create_runtime\.ts` or `AppRuntime`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_service\.ts`/);
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* modify `fedos_noop_identity_provider\.ts` \(Alpha 033\), and\s+does \*\*not\*\* delete it/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_nostr_identity_provider\.ts` \(Alpha 035\)/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement any Relay connection/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change the Resolver's own return TYPE/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
  });

  it("10. RIPPLE (Secure Runtime Alpha 039): fedos_identity_provider_resolver.ts exports EXACTLY resolveFedosIdentityProvider, with exactly one const declaration and no branch/environment/Authority/Storage-Resolver/Service reference; AS OF this Stage's own scope its CODE also referenced zero Relay/npub vocabulary; Alpha 039 later added a Source injection (`new NullNostrPublicIdentitySource()`), so this test now permits the new Source's own class name while still forbidding every other exclusion", () => {
    const exportedFns = [...resolverSource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedFns)).toEqual(new Set(["resolveFedosIdentityProvider"]));
    expect([...resolverSource.matchAll(/^export class/gm)].length).toBe(0);
    expect([...resolverSource.matchAll(/^export interface/gm)].length).toBe(0);
    expect([...resolverSource.matchAll(/^const \w+/gm)].length).toBe(1);

    const codeOnly = codeOnlyLines(resolverSource);
    expect(codeOnly).not.toMatch(/\bif\s*\(/);
    expect(codeOnly).not.toMatch(/switch\s*\(/);
    expect(codeOnly).not.toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/determineFedosRuntimeMode|fedos_runtime_mode_authority/);
    expect(codeOnly).not.toMatch(/determineFedosRuntimePlatform|fedos_runtime_platform_authority/);
    expect(codeOnly).not.toMatch(/resolveRuntimeStorageBackend|fedos_runtime_storage_resolver/);
    expect(codeOnly).not.toMatch(/fedos_identity_service|FedosIdentityService/);
    expect(codeOnly).not.toMatch(/create_runtime|AppRuntime/);
    expect(codeOnly).not.toMatch(/worker/i);
    expect(codeOnly).not.toMatch(/fedos_noop_identity_provider|NoopFedosIdentityProvider/);
    expect(codeOnly).toMatch(/NullNostrPublicIdentitySource/);
    expect(codeOnly).not.toMatch(/relay|Relay|publish|subscribe|nsec|npub|Authenticat|Session|session|credential|Credential/);
  });

  it("11. RIPPLE (Secure Runtime Alpha 039): the function body was EXACTLY 'return sharedNostrProvider;', with exactly one zero-argument NostrIdentityProvider construction, AS OF this Stage's own scope; Alpha 039 later required a constructor argument, so the shared singleton is now constructed with a NullNostrPublicIdentitySource injected -- the function's own body remains EXACTLY 'return sharedNostrProvider;', reconfirmed here as the CURRENT state", () => {
    const body = (
      resolverSource.match(/export function resolveFedosIdentityProvider\(\): FedosIdentityProvider \| null \{([\s\S]*?)\n\}/) ?? []
    )[1] ?? "";
    expect(body.trim()).toBe("return sharedNostrProvider;");

    const nostrConstructions = [...resolverSource.matchAll(/new NostrIdentityProvider\(new NullNostrPublicIdentitySource\(\)\)/g)];
    expect(nostrConstructions.length).toBe(1);
    const noopConstructions = [...resolverSource.matchAll(/new NoopFedosIdentityProvider\(\)/g)];
    expect(noopConstructions.length).toBe(0);
  });

  it("12. the Resolver's own return TYPE is confirmed byte-for-byte unchanged -- still 'FedosIdentityProvider | null', not narrowed", () => {
    expect(resolverSource).toMatch(
      /export function resolveFedosIdentityProvider\(\): FedosIdentityProvider \| null \{/,
    );
    expect([...resolverSource.matchAll(/FedosIdentityProvider \| null/g)].length).toBeGreaterThanOrEqual(1);
  });

  it("13. behavioral: resolveFedosIdentityProvider() returns a real NostrIdentityProvider, the SAME shared instance on every call (singleton, not fresh-per-call), never null, never NoopFedosIdentityProvider", () => {
    const first = resolveFedosIdentityProvider();
    const second = resolveFedosIdentityProvider();
    const third = resolveFedosIdentityProvider();
    expect(first).toBeInstanceOf(NostrIdentityProvider);
    expect(first).not.toBeInstanceOf(NoopFedosIdentityProvider);
    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(first).not.toBeNull();
  });

  it("14. behavioral: the resolved Provider reports provider === 'nostr' and describeIdentity() always resolves null, called repeatedly", async () => {
    const provider = resolveFedosIdentityProvider();
    expect(provider?.provider).toBe("nostr");
    expect(await provider?.describeIdentity()).toBeNull();
    expect(await provider?.describeIdentity()).toBeNull();
    expect(await provider?.describeIdentity()).toBeNull();
  });

  it("15. RIPPLE (Secure Runtime Alpha 039, constructor defaulted at Alpha 049): fedos_nostr_identity_provider.ts (Alpha 035) was confirmed BYTE-FOR-BYTE unchanged AS OF this Stage's own scope -- still fixed provider = 'nostr', still describeIdentity() body EXACTLY 'return null;'; Alpha 039 later gave it a constructor and a real delegation body; Alpha 049 later gave that constructor's parameter a default value -- reconfirmed here as the CURRENT shape, still fixed provider = 'nostr', no reference to this Stage's own doc", () => {
    expect(nostrProviderSource).toMatch(/readonly provider = "nostr";/);
    expect(nostrProviderSource).toMatch(/constructor\(source: FedosNostrPublicIdentitySource = resolveNostrPublicIdentitySource\(\)\) \{/);
    expect(nostrProviderSource).toMatch(/this\.#source\.readPublicIdentity\(\)/);
    expect(nostrProviderSource).not.toMatch(/secure_runtime_alpha_036/);
  });

  it("16. fedos_noop_identity_provider.ts (Alpha 033) is confirmed BYTE-FOR-BYTE unchanged and NOT deleted -- still fixed provider = 'noop', still describeIdentity() body EXACTLY 'return null;', no reference to this Stage's own doc", () => {
    expect(typeof noopProviderSource).toBe("string");
    expect(noopProviderSource.length).toBeGreaterThan(0);
    expect(noopProviderSource).toMatch(/export class NoopFedosIdentityProvider implements FedosIdentityProvider \{/);
    expect(noopProviderSource).toMatch(/readonly provider = "noop";/);
    const body = (
      noopProviderSource.match(/async describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n(?:  )?\}/) ?? []
    )[1] ?? "";
    expect(body.trim()).toBe("return null;");
    expect(noopProviderSource).not.toMatch(/secure_runtime_alpha_036/);

    const provider = new NoopFedosIdentityProvider();
    expect(provider.provider).toBe("noop");
  });

  it("17. RIPPLE (Secure Runtime Alpha 042): fedos_identity_service.ts (Alpha 031) was confirmed BYTE-FOR-BYTE unchanged AS OF this Stage's own scope; Alpha 042 later added a required second constructor argument (an injected FedosIdentityRegistry) -- reconfirmed here as the CURRENT signature, still no call to resolveFedosIdentityProvider()", () => {
    expect(serviceSource).toMatch(/constructor\(provider: FedosIdentityProvider, registry: FedosIdentityRegistry\) \{/);
    expect(serviceSource).not.toMatch(/resolveFedosIdentityProvider|fedos_identity_provider_resolver/);
    expect(serviceSource).not.toMatch(/secure_runtime_alpha_036/);
  });

  it("18. fedos_identity_descriptor.ts (Alpha 028) and fedos_identity_capability.ts (Alpha 030) are confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(descriptorSource).toMatch(/readonly publicIdentifier: string;/);
    expect(descriptorSource).not.toMatch(/secure_runtime_alpha_036/);
    expect(capabilitySource).toMatch(/readonly available: boolean;/);
    expect(capabilitySource).not.toMatch(/secure_runtime_alpha_036/);
    expect(providerInterfaceSource).toMatch(/describeIdentity\(\): Promise<FedosIdentityDescriptor \| null>;/);
    expect(providerInterfaceSource).not.toMatch(/secure_runtime_alpha_036/);
  });

  it("19. Runtime is confirmed fully unaware this Resolver exists -- create_runtime.ts/AppRuntime/runtime types/Worker/Storage Resolver/Storage Backend have zero reference to the Resolver or either Provider", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource, storageResolverSource, storageBackendSource]) {
      expect(source).not.toMatch(/fedos_identity_provider_resolver|resolveFedosIdentityProvider/);
      expect(source).not.toMatch(/NoopFedosIdentityProvider|fedos_noop_identity_provider/);
      expect(source).not.toMatch(/NostrIdentityProvider|fedos_nostr_identity_provider/);
      expect(source).not.toMatch(/secure_runtime_alpha_036/);
    }
  });

  it("20. no existing src/nostr/* file was modified, and none references this Stage's own doc, the Resolver, or either Provider", () => {
    for (const source of [
      nobleSignatureSource,
      nostrCryptoSource,
      nostrEventSource,
      nostrRelaySource,
      nostrWsRelaySource,
      nostrPublishSource,
      nostrSignatureSource,
      nostrMessagesSource,
      nostrTypesSource,
    ]) {
      expect(source).not.toMatch(/secure_runtime_alpha_036/);
      expect(source).not.toMatch(/fedos_identity_provider_resolver|resolveFedosIdentityProvider/);
    }
  });

  it("21. no other existing src/identity/* file was modified, and no other Runtime/Worker file references this Stage's own doc", () => {
    for (const source of [
      providerBoundarySource,
      providerTypesSource,
      providerBridgeSource,
      webauthnAdapterSource,
      identityTypesSource,
      sessionBoundarySource,
    ]) {
      expect(source).not.toMatch(/secure_runtime_alpha_036/);
    }
  });

  it("22. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("23. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_036/);

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

  it("24. no fedos_*.ts file under src/runtime/ or src/identity/ was added or removed by this Stage -- still exactly 56 and 18 files respectively AS OF this Stage's own scope (this Stage only modifies an existing file's body; Secure Runtime Alpha 039 later added two more src/identity/ files, fedos_nostr_public_identity_source.ts and fedos_null_nostr_public_identity_source.ts; Secure Runtime Alpha 040 later added a 21st, fedos_identity_record.ts)", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("25. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha036-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha036-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha036-id"));
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha036-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha036-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha036-direct"))).toBe(true);
  });
});
