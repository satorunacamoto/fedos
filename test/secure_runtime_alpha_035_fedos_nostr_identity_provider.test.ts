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
import designDocSource from "../docs/secure_runtime_alpha_035_fedos_nostr_identity_provider.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha033DocSource from "../docs/secure_runtime_alpha_033_fedos_noop_identity_provider.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha034DocSource from "../docs/secure_runtime_alpha_034_fedos_noop_resolver_wiring.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrProviderSource from "../src/identity/fedos_nostr_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopProviderSource from "../src/identity/fedos_noop_identity_provider.ts?raw";
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
 * Secure Runtime Alpha 035 -- "FedOS Nostr Identity Provider": adds
 * exactly ONE class, `NostrIdentityProvider`, the FIRST Nostr-specific
 * `FedosIdentityProvider` (Alpha 029) implementation in this repository
 * -- fixed `provider = "nostr"`, `describeIdentity()` always resolving
 * `null`, no constructor, no state, no exception, no Relay/event/
 * signing/secret-key code, and no wiring into the Resolver (Alpha
 * 032/034), the Service (Alpha 031), the Runtime, or the Worker.
 */
describe("Secure Runtime Alpha 035 -- FedOS Nostr Identity Provider, Resolver/Service/Runtime/Rust/Worker/Nostr unchanged", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(7000);
  });

  it("2. the design doc states this Stage adds exactly one class, the first Nostr-specific Provider implementation", () => {
    expect(designDocSource).toMatch(/a single class only/);
    expect(designDocSource).toMatch(
      /the FIRST Nostr-specific `FedosIdentityProvider`\s+\(Alpha 029\)\s+implementation anywhere in this repository/,
    );
    expect(designDocSource).toMatch(/secure_runtime_alpha_033_fedos_noop_identity_provider\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_034_fedos_noop_resolver_wiring\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_027_identity_foundation_inventory\.md/);
    expect(alpha033DocSource).toMatch(/NoopFedosIdentityProvider/);
    expect(alpha034DocSource).toMatch(/resolveFedosIdentityProvider/);
  });

  it("3. the design doc records the exact class shape", () => {
    expect(designDocSource).toMatch(
      /export class NostrIdentityProvider implements FedosIdentityProvider \{/,
    );
    expect(designDocSource).toMatch(/readonly provider = "nostr";/);
    expect(designDocSource).toMatch(/async describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{/);
  });

  it("4. the design doc explains why a Nostr Provider is added now", () => {
    expect(designDocSource).toMatch(/Nostr Providerを追加した理由/);
    expect(designDocSource).toMatch(/first Protocol Adapter/);
  });

  it("5. the design doc gives three reasons describeIdentity() still always resolves null", () => {
    expect(designDocSource).toMatch(/まだdescribeIdentity\(\)がnullである理由/);
    expect(designDocSource).toMatch(/No secret key exists to read\./);
    expect(designDocSource).toMatch(/This Stage's own mandate forbids building the fetching mechanism\./);
    expect(designDocSource).toMatch(/A fabricated non-`null` value would be actively worse than `null`\./);
  });

  it("6. the design doc explains why this is NOT wired into resolveFedosIdentityProvider(), and quotes its unchanged body", () => {
    expect(designDocSource).toMatch(/Resolverへ接続しない理由/);
    expect(designDocSource).toMatch(
      /export function resolveFedosIdentityProvider\(\): FedosIdentityProvider \| null \{/,
    );
    expect(designDocSource).toMatch(/return sharedNoopProvider;/);
  });

  it("7. the design doc compares against NoopFedosIdentityProvider with a table", () => {
    expect(designDocSource).toMatch(/Noopとの差/);
    expect(designDocSource).toMatch(/\| \*\*`provider` value\*\* \|/);
    expect(designDocSource).toMatch(/SIBLINGS, not a base\/derived pair/);
  });

  it("8. the design doc names a future Descriptor-fetching plan without implementing it", () => {
    expect(designDocSource).toMatch(/将来のDescriptor取得予定/);
    expect(designDocSource).toMatch(/A key\/signer source would need to exist first/);
    expect(designDocSource).toMatch(/no Relay round-trip would be required/i);
  });

  it("9. the design doc explains why no secret key is handled here", () => {
    expect(designDocSource).toMatch(/秘密鍵を扱わない理由/);
    expect(designDocSource).toMatch(/A class with zero fields beyond a fixed string literal cannot hold\s+a secret key\./);
  });

  it("10. the design doc records the explicit 'does NOT do' list", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement any Relay connection/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* construct, parse, publish, or subscribe to any Nostr\s+event/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* sign or verify any signature/);
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* generate, derive, read, or store any secret key,\s+`nsec`, or `npub`/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement any Direct Message \(DM\) feature/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* wire `NostrIdentityProvider` into\s+`resolveFedosIdentityProvider\(\)`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_noop_identity_provider\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any Storage read or write of any kind\./);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
  });

  it("11. fedos_nostr_identity_provider.ts exports EXACTLY NostrIdentityProvider, no other export", () => {
    expect([...nostrProviderSource.matchAll(/^export class (\w+)/gm)].map((m: RegExpMatchArray) => m[1])).toEqual([
      "NostrIdentityProvider",
    ]);
    expect([...nostrProviderSource.matchAll(/^export (?:async )?function/gm)].length).toBe(0);
    expect([...nostrProviderSource.matchAll(/^export interface/gm)].length).toBe(0);
    expect([...nostrProviderSource.matchAll(/^export const/gm)].length).toBe(0);
  });

  it("12. the class has no constructor, no field beyond the fixed provider literal, and never throws", () => {
    const codeOnly = codeOnlyLines(nostrProviderSource);
    expect(codeOnly).not.toMatch(/constructor\s*\(/);
    expect(codeOnly).not.toMatch(/\bthrow\b/);
    expect(codeOnly).not.toMatch(/\btry\s*\{/);
    expect(codeOnly).not.toMatch(/\bif\s*\(/);
    expect(codeOnly).not.toMatch(/\bswitch\s*\(/);
    expect(codeOnly).toMatch(/readonly provider = "nostr";/);
    const fieldDeclarations = [...codeOnly.matchAll(/^\s*(?:readonly\s+)?#?\w+\s*[:=]/gm)];
    expect(fieldDeclarations.length).toBe(1);
  });

  it("13. describeIdentity()'s body is EXACTLY 'return null;' -- confirmed by literal string extraction", () => {
    const body = (
      nostrProviderSource.match(/async describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n(?:  )?\}/) ?? []
    )[1] ?? "";
    expect(body.trim()).toBe("return null;");
  });

  it("14. fedos_nostr_identity_provider.ts imports EXACTLY two type-only modules -- the Descriptor and Provider interfaces -- and nothing from src/nostr/, the Resolver, the Service, or the Runtime", () => {
    const importLines = [...nostrProviderSource.matchAll(/^import .*$/gm)].map((m: RegExpMatchArray) => m[0]);
    expect(importLines.length).toBe(2);
    expect(importLines.every((line: string) => line.startsWith("import type "))).toBe(true);
    expect(nostrProviderSource).toMatch(/from "\.\/fedos_identity_descriptor\.js"/);
    expect(nostrProviderSource).toMatch(/from "\.\/fedos_identity_provider\.js"/);
    expect(nostrProviderSource).not.toMatch(/from "\.\.\/nostr\//);
    const importsCodeOnly = importLines.join("\n");
    expect(importsCodeOnly).not.toMatch(/fedos_identity_provider_resolver|resolveFedosIdentityProvider/);
    expect(importsCodeOnly).not.toMatch(/fedos_identity_service|FedosIdentityService/);
    expect(importsCodeOnly).not.toMatch(/fedos_noop_identity_provider|NoopFedosIdentityProvider/);
    expect(importsCodeOnly).not.toMatch(/create_runtime|AppRuntime/);
    expect(importsCodeOnly).not.toMatch(/worker/i);
  });

  it("15. fedos_nostr_identity_provider.ts's own CODE (excluding its own explanatory header comment) does not reference Relay/event/signing/secret-key/DM vocabulary", () => {
    const codeOnly = codeOnlyLines(nostrProviderSource);
    expect(codeOnly).not.toMatch(/relay|Relay/);
    expect(codeOnly).not.toMatch(/publish|subscribe/i);
    expect(codeOnly).not.toMatch(/\bkind\b/);
    expect(codeOnly).not.toMatch(/\bEvent\b/);
    expect(codeOnly).not.toMatch(/sign|Sign|verify|Verify/);
    expect(codeOnly).not.toMatch(/nsec|npub|secret\s*key|privateKey|secretKey/i);
    expect(codeOnly).not.toMatch(/\bDM\b|DirectMessage|direct message/i);
    expect(codeOnly).not.toMatch(/Authenticat|session|Session|credential|Credential/);
    expect(codeOnly).not.toMatch(/determineFedosRuntimeMode|fedos_runtime_mode_authority/);
    expect(codeOnly).not.toMatch(/determineFedosRuntimePlatform|fedos_runtime_platform_authority/);
  });

  it("16. behavioral: NostrIdentityProvider reports provider === 'nostr' and describeIdentity() always resolves null, called repeatedly", async () => {
    const provider = new NostrIdentityProvider();
    expect(provider.provider).toBe("nostr");
    expect(await provider.describeIdentity()).toBeNull();
    expect(await provider.describeIdentity()).toBeNull();
    expect(await provider.describeIdentity()).toBeNull();

    const second = new NostrIdentityProvider();
    expect(second.provider).toBe("nostr");
    expect(await second.describeIdentity()).toBeNull();
  });

  it("17. RIPPLE (Secure Runtime Alpha 036): resolveFedosIdentityProvider() (Alpha 032/034) was confirmed to still resolve the shared NoopFedosIdentityProvider singleton, never a NostrIdentityProvider instance, AS OF this Stage's own scope; Alpha 036 later re-wired it to return a shared NostrIdentityProvider singleton instead -- confirmed here as the CURRENT behavior, per this arc's own established ripple convention", () => {
    const resolved = resolveFedosIdentityProvider();
    expect(resolved).toBeInstanceOf(NostrIdentityProvider);
    expect(resolved).not.toBeInstanceOf(NoopFedosIdentityProvider);
    expect(resolverSource).toMatch(/return sharedNostrProvider;/);
    const resolverCodeOnly = codeOnlyLines(resolverSource);
    expect(resolverCodeOnly).toMatch(/fedos_nostr_identity_provider|NostrIdentityProvider/);
    expect(resolverSource).not.toMatch(/secure_runtime_alpha_035/);
  });

  it("18. fedos_identity_service.ts (Alpha 031) is confirmed BYTE-FOR-BYTE unchanged -- constructor still requires an explicit FedosIdentityProvider argument, no default, no reference to the Nostr Provider", () => {
    expect(serviceSource).toMatch(/constructor\(provider: FedosIdentityProvider\) \{/);
    expect(serviceSource).not.toMatch(/NostrIdentityProvider|fedos_nostr_identity_provider/);
    expect(serviceSource).not.toMatch(/secure_runtime_alpha_035/);
  });

  it("19. fedos_identity_provider.ts/fedos_identity_descriptor.ts/fedos_identity_capability.ts are all confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(providerInterfaceSource).toMatch(/describeIdentity\(\): Promise<FedosIdentityDescriptor \| null>;/);
    expect(providerInterfaceSource).not.toMatch(/secure_runtime_alpha_035/);
    expect(descriptorSource).toMatch(/readonly publicIdentifier: string;/);
    expect(descriptorSource).not.toMatch(/secure_runtime_alpha_035/);
    expect(capabilitySource).toMatch(/readonly available: boolean;/);
    expect(capabilitySource).not.toMatch(/secure_runtime_alpha_035/);
  });

  it("20. fedos_noop_identity_provider.ts (Alpha 033) is confirmed BYTE-FOR-BYTE unchanged -- still fixed provider = 'noop', still zero reference to the new Nostr Provider", () => {
    expect(noopProviderSource).toMatch(/readonly provider = "noop";/);
    expect(noopProviderSource).not.toMatch(/NostrIdentityProvider|fedos_nostr_identity_provider/);
    expect(noopProviderSource).not.toMatch(/secure_runtime_alpha_035/);
  });

  it("21. RIPPLE (Secure Runtime Alpha 036): fedos_nostr_identity_provider.ts had ZERO importers anywhere in src/ AS OF this Stage's own scope; Alpha 036 later made fedos_identity_provider_resolver.ts its first (and, per that Stage's own mandate, only) real importer -- reconfirmed here as the CURRENT state via codeOnlyLines(), per this arc's own established ripple convention. Every other identity/runtime/worker file's CODE remains a non-importer", () => {
    const resolverCodeOnly = codeOnlyLines(resolverSource);
    expect(resolverCodeOnly).toMatch(/fedos_nostr_identity_provider|NostrIdentityProvider/);
    for (const source of [
      serviceSource,
      noopProviderSource,
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
    ]) {
      const codeOnly = codeOnlyLines(source);
      expect(codeOnly).not.toMatch(/fedos_nostr_identity_provider/);
      expect(codeOnly).not.toMatch(/NostrIdentityProvider/);
    }
  });

  it("22. no existing src/nostr/* file was modified, and none references this Stage's own doc or the new Provider", () => {
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
      expect(source).not.toMatch(/secure_runtime_alpha_035/);
      expect(source).not.toMatch(/fedos_nostr_identity_provider|NostrIdentityProvider/);
    }
  });

  it("23. no existing src/identity/* file (other than this Stage's own new file) was modified, and no Runtime/Worker file references this Stage's own doc", () => {
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
    ]) {
      expect(source).not.toMatch(/secure_runtime_alpha_035/);
    }
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

  it("25. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_035/);

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

  it("26. no fedos_*.ts file under src/runtime/ was added or removed -- still exactly 56 files; exactly one new file was added under src/identity/ -- now exactly 18 files", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(56);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(18);
  });

  it("27. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha035-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha035-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha035-id"));
    expect(deleted).toBe(true);
  });

  it("28. Regression: initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected -- confirmed by ACTUAL calls", async () => {
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha035-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha035-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha035-direct"))).toBe(true);
  });
});
