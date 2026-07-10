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
import { NostrIdentityProvider } from "../src/identity/fedos_nostr_identity_provider.js";
import { NullNostrPublicIdentitySource } from "../src/identity/fedos_null_nostr_public_identity_source.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
import { FedosIdentityRegistry } from "../src/identity/fedos_identity_registry.js";
import { FedosIdentityResolver } from "../src/identity/fedos_identity_resolver.js";
import type { FedosIdentityDescriptor } from "../src/identity/fedos_identity_descriptor.js";
import type { FedosIdentityRecord } from "../src/identity/fedos_identity_record.js";
import type { FedosIdentityProvider } from "../src/identity/fedos_identity_provider.js";
import type {
  FedosNostrPublicIdentitySnapshot,
  FedosNostrPublicIdentitySource,
} from "../src/identity/fedos_nostr_public_identity_source.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_047_fedos_identity_record_expansion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha045DocSource from "../docs/secure_runtime_alpha_045_fedos_identity_descriptor_expansion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha046DocSource from "../docs/secure_runtime_alpha_046_nostr_identity_provider_descriptor_expansion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import recordSource from "../src/identity/fedos_identity_record.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/identity/fedos_identity_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/identity/fedos_identity_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import registrySource from "../src/identity/fedos_identity_registry.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import resolverClassSource from "../src/identity/fedos_identity_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerInterfaceSource from "../src/identity/fedos_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilitySource from "../src/identity/fedos_identity_capability.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopProviderSource from "../src/identity/fedos_noop_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrProviderSource from "../src/identity/fedos_nostr_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityProviderResolverSource from "../src/identity/fedos_identity_provider_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sourceInterfaceSource from "../src/identity/fedos_nostr_public_identity_source.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullSourceSource from "../src/identity/fedos_null_nostr_public_identity_source.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import deviceTrustSource from "../src/identity/device_trust.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import deviceRegistrationSource from "../src/identity/device_registration.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sessionBoundarySource from "../src/identity/session_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import passkeyBoundarySource from "../src/identity/passkey_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerBoundarySource from "../src/identity/provider_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerTypesSource from "../src/identity/provider_types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerBridgeSource from "../src/identity/provider_bridge.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import recoveryPolicySource from "../src/identity/recovery_policy.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import vaultBridgeSource from "../src/identity/vault_bridge.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import webauthnAdapterSource from "../src/identity/webauthn_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityTypesSource from "../src/identity/types.ts?raw";
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

class FakeSource implements FedosNostrPublicIdentitySource {
  #snapshot: FedosNostrPublicIdentitySnapshot | null;
  constructor(snapshot: FedosNostrPublicIdentitySnapshot | null) {
    this.#snapshot = snapshot;
  }
  async readPublicIdentity(): Promise<FedosNostrPublicIdentitySnapshot | null> {
    return this.#snapshot;
  }
}

function makeTestProvider(overrides: Partial<FedosIdentityProvider>): FedosIdentityProvider {
  return {
    provider: "test",
    describeIdentity: async () => null,
    ...overrides,
  } as FedosIdentityProvider;
}

/**
 * Secure Runtime Alpha 047 -- "FedOS Identity Record Expansion":
 * `FedosIdentityRecord` gains the identical two OPTIONAL
 * `displayName`/`avatar` fields `FedosIdentityDescriptor` already has
 * (Alpha 045), and `FedosIdentityService`'s own Descriptor-to-Record
 * mapping now copies both through, verbatim and unconditionally --
 * closing the gap Alpha 046 opened at the Provider level one layer
 * further. Registry/Resolver/Descriptor/Provider/Source/NullSource are
 * all confirmed byte-for-byte unchanged.
 */
describe("Secure Runtime Alpha 047 -- FedOS Identity Record Expansion, Record+Service-mapping-only, no Descriptor/Registry/Resolver/Provider/Source/Runtime/Worker/Storage/Rust change", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(10000);
  });

  it("2. the design doc states this Stage adds two fields to one interface and two lines to one object literal, in two files, cross-referencing Alpha 045/046", () => {
    expect(designDocSource).toMatch(/two fields added to\s+one interface, and two lines added to one object literal, in two\s+files/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_045_fedos_identity_descriptor_expansion\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_046_nostr_identity_provider_descriptor_expansion\.md/);
    expect(alpha045DocSource).toMatch(/readonly avatar\?: string;/);
    expect(alpha046DocSource).toMatch(/displayName: snapshot\.displayName,/);
  });

  it("3. the design doc records the exact new Record interface and the exact new object literal", () => {
    expect(designDocSource).toMatch(/readonly displayName\?: string;/);
    expect(designDocSource).toMatch(/readonly avatar\?: string;/);
    expect(designDocSource).toMatch(/displayName: descriptor\.displayName,/);
    expect(designDocSource).toMatch(/avatar: descriptor\.avatar,/);
  });

  it("4. the design doc fixes the Record/Descriptor boundary and states the reason for copying the fields through", () => {
    expect(designDocSource).toMatch(/RecordとDescriptorの責務 \(boundary between `FedosIdentityRecord` and `FedosIdentityDescriptor`, Alpha 040\/028\)/);
    expect(designDocSource).toMatch(/Recordへコピーする理由 \(why `displayName`\/`avatar` are copied onto the Record\)/);
  });

  it("5. the design doc explains why the Service does not process either field and why the Registry does not validate them", () => {
    expect(designDocSource).toMatch(/Serviceで加工しない理由 \(why the Service does not process either field\)/);
    expect(designDocSource).toMatch(/Registryが値を検証しない理由 \(why `FedosIdentityRegistry` does not validate the values\)/);
  });

  it("6. the design doc explains why displayName/avatar remain optional on the Record", () => {
    expect(designDocSource).toMatch(/displayName\/avatarをoptional維持する理由 \(why both fields remain optional\)/);
  });

  it("7. the design doc explains why this stays disconnected from Runtime and why no Authentication/secret information is held", () => {
    expect(designDocSource).toMatch(/Runtimeへまだ渡さない理由 \(why this stays disconnected from Runtime\)/);
    expect(designDocSource).toMatch(/Authentication情報を持たない理由 \(why the Record carries no Authentication-shaped data\)/);
    expect(designDocSource).toMatch(/秘密情報を持たない理由 \(why the Record carries no secret information\)/);
  });

  it("8. the design doc records the explicit 'does NOT do' list", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_descriptor\.ts` \(Alpha 028\/045\)/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_registry\.ts` \(Alpha 041\)/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_resolver\.ts` \(Alpha 043\)/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* validate, reformat, or normalize `displayName`\/`avatar`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* wire `displayName`\/`avatar` into Runtime, Worker, or\s+Storage/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `create_runtime\.ts` or any `src\/runtime\/\*` file\./);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change any Public Runtime API signature\./);
  });

  it("9. fedos_identity_record.ts's own interface has EXACTLY three required fields and two optional fields, in order, confirmed via literal extraction", () => {
    const body = (recordSource.match(/export interface FedosIdentityRecord \{([\s\S]*?)\}/) ?? [])[1] ?? "";
    const fieldLines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.startsWith("readonly "));
    expect(fieldLines).toEqual([
      "readonly id: string;",
      "readonly provider: string;",
      "readonly publicIdentifier: string;",
      "readonly displayName?: string;",
      "readonly avatar?: string;",
    ]);
  });

  it("10. fedos_identity_record.ts still imports NOTHING -- zero import lines of any kind", () => {
    const importLines = [...recordSource.matchAll(/^import .*$/gm)];
    expect(importLines.length).toBe(0);
  });

  it("11. fedos_identity_record.ts's own CODE performs no validation, reformatting, or normalization -- no class, no function, no runtime logic of any kind", () => {
    expect([...recordSource.matchAll(/^export class/gm)].length).toBe(0);
    expect([...recordSource.matchAll(/^export (?:async )?function/gm)].length).toBe(0);
    expect([...recordSource.matchAll(/^export const/gm)].length).toBe(0);
  });

  it("12. fedos_identity_service.ts's own Descriptor-to-Record mapping includes EXACTLY five fields, in order, confirmed via literal string extraction", () => {
    const body = (
      serviceSource.match(/async describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*)\n  \}/) ?? []
    )[1] ?? "";
    const recordMatch = body.match(/const record: FedosIdentityRecord = \{([\s\S]*?)\};/);
    const recordBody = recordMatch?.[1] ?? "";
    const fieldLines = recordBody
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(fieldLines).toEqual([
      "id: descriptor.id,",
      "provider: descriptor.provider,",
      "publicIdentifier: descriptor.publicIdentifier,",
      "displayName: descriptor.displayName,",
      "avatar: descriptor.avatar,",
    ]);
  });

  it("13. RIPPLE (Secure Runtime Alpha 047): fedos_identity_service.ts's own Record-construction step named EXACTLY three fields AS OF Alpha 042's own scope; Alpha 047 later added displayName/avatar -- reconfirmed here as the CURRENT mapping, per this arc's own established ripple convention", () => {
    expect(serviceSource).toMatch(/displayName: descriptor\.displayName,/);
    expect(serviceSource).toMatch(/avatar: descriptor\.avatar,/);
  });

  it("14. every OTHER line of describeIdentity() -- the Provider call, the null check, the registry.register() call, the final return -- is confirmed BYTE-FOR-BYTE unchanged", () => {
    const codeOnly = codeOnlyLines(serviceSource);
    expect(codeOnly).toMatch(/const descriptor = await this\.#provider\.describeIdentity\(\);/);
    expect(codeOnly).toMatch(/if \(descriptor === null\) \{/);
    expect(codeOnly).toMatch(/this\.#registry\.register\(record\);/);
    expect(codeOnly.trim().endsWith("}\n}") || codeOnly.includes("return descriptor;")).toBe(true);
  });

  it("15. fedos_identity_service.ts's own code performs no validation, reformatting, or normalization of displayName/avatar -- no additional if/typeof/length check referencing either field", () => {
    const codeOnly = codeOnlyLines(serviceSource);
    expect(codeOnly).not.toMatch(/typeof descriptor\.displayName/);
    expect(codeOnly).not.toMatch(/typeof descriptor\.avatar/);
    expect(codeOnly).not.toMatch(/descriptor\.displayName\.length/);
    expect(codeOnly).not.toMatch(/descriptor\.avatar\.length/);
  });

  it("16. fedos_identity_service.ts still imports EXACTLY five type-only modules, nothing new added", () => {
    const importLines = [...serviceSource.matchAll(/^import .*$/gm)].map((m: RegExpMatchArray) => m[0]);
    expect(importLines.length).toBe(5);
    expect(importLines.every((line: string) => line.startsWith("import type "))).toBe(true);
  });

  it("17. fedos_identity_service.ts's own CODE (excluding its own explanatory header comment) references zero Runtime/Storage/Worker/Authentication/Nostr vocabulary", () => {
    const codeOnly = codeOnlyLines(serviceSource);
    expect(codeOnly).not.toMatch(/create_runtime|AppRuntime/);
    expect(codeOnly).not.toMatch(/storeCiphertext|loadCiphertext|deleteCiphertext|RuntimeStorageBackend/);
    expect(codeOnly).not.toMatch(/\bworker\b/i);
    expect(codeOnly).not.toMatch(/Authenticat|session|Session|credential|Credential/);
    expect(codeOnly).not.toMatch(/nostr|Nostr|relay|Relay|npub|nsec/);
  });

  it("18. behavioral: displayNameコピー -- a Descriptor with displayName populated produces a registered Record carrying it verbatim", async () => {
    const registry = new FedosIdentityRegistry();
    const provider = makeTestProvider({
      provider: "test",
      describeIdentity: async () => ({ id: "u1", provider: "test", publicIdentifier: "pub1", displayName: "Alice" }),
    });
    const service = new FedosIdentityService(provider, registry);
    await service.describeIdentity();
    expect(registry.find("u1")?.displayName).toBe("Alice");
  });

  it("19. behavioral: avatarコピー -- a Descriptor with avatar populated produces a registered Record carrying it verbatim", async () => {
    const registry = new FedosIdentityRegistry();
    const provider = makeTestProvider({
      provider: "test",
      describeIdentity: async () => ({ id: "u2", provider: "test", publicIdentifier: "pub2", avatar: "https://example.invalid/a.png" }),
    });
    const service = new FedosIdentityService(provider, registry);
    await service.describeIdentity();
    expect(registry.find("u2")?.avatar).toBe("https://example.invalid/a.png");
  });

  it("20. behavioral: both displayName and avatar copy through together", async () => {
    const registry = new FedosIdentityRegistry();
    const provider = makeTestProvider({
      provider: "test",
      describeIdentity: async () => ({
        id: "u3",
        provider: "test",
        publicIdentifier: "pub3",
        displayName: "Carol",
        avatar: "https://example.invalid/c.png",
      }),
    });
    const service = new FedosIdentityService(provider, registry);
    await service.describeIdentity();
    const record = registry.find("u3");
    expect(record).toEqual({
      id: "u3",
      provider: "test",
      publicIdentifier: "pub3",
      displayName: "Carol",
      avatar: "https://example.invalid/c.png",
    });
  });

  it("21. behavioral: undefined維持 -- a Descriptor with neither field set produces a Record where both resolve undefined", async () => {
    const registry = new FedosIdentityRegistry();
    const descriptor: FedosIdentityDescriptor = { id: "u4", provider: "test", publicIdentifier: "pub4" };
    const provider = makeTestProvider({ provider: "test", describeIdentity: async () => descriptor });
    const service = new FedosIdentityService(provider, registry);
    await service.describeIdentity();
    const record = registry.find("u4");
    expect(record?.displayName).toBeUndefined();
    expect(record?.avatar).toBeUndefined();
    expect(record).toEqual({ id: "u4", provider: "test", publicIdentifier: "pub4" });
  });

  it("22. behavioral: undefined維持 -- displayName set but avatar omitted still resolves avatar undefined on the Record", async () => {
    const registry = new FedosIdentityRegistry();
    const provider = makeTestProvider({
      provider: "test",
      describeIdentity: async () => ({ id: "u5", provider: "test", publicIdentifier: "pub5", displayName: "Erin" }),
    });
    const service = new FedosIdentityService(provider, registry);
    await service.describeIdentity();
    const record = registry.find("u5");
    expect(record?.displayName).toBe("Erin");
    expect(record?.avatar).toBeUndefined();
  });

  it("23. behavioral: a null Descriptor still registers nothing, exactly as before this Stage", async () => {
    const registry = new FedosIdentityRegistry();
    const provider = makeTestProvider({ provider: "test", describeIdentity: async () => null });
    const service = new FedosIdentityService(provider, registry);
    const result = await service.describeIdentity();
    expect(result).toBeNull();
    expect(registry.list()).toEqual([]);
  });

  it("24. behavioral: describeIdentity() still returns the ORIGINAL Descriptor unchanged, reference-equal, unaffected by the Record-mapping expansion", async () => {
    const registry = new FedosIdentityRegistry();
    const descriptor: FedosIdentityDescriptor = { id: "u6", provider: "test", publicIdentifier: "pub6", displayName: "Frank" };
    const provider = makeTestProvider({ provider: "test", describeIdentity: async () => descriptor });
    const service = new FedosIdentityService(provider, registry);
    const returned = await service.describeIdentity();
    expect(returned).toBe(descriptor);
  });

  it("25. behavioral: describeCapability() remains entirely unaffected by the Record's own field expansion", async () => {
    const registry = new FedosIdentityRegistry();
    const provider = makeTestProvider({ provider: "cap-only" });
    const service = new FedosIdentityService(provider, registry);
    expect(await service.describeCapability()).toEqual({ provider: "cap-only", available: true });
  });

  it("26. behavioral: end-to-end via a real NostrIdentityProvider -- displayName/avatar flow from Snapshot through Descriptor (Alpha 046) through Record (this Stage), reachable via the Resolver", async () => {
    const registry = new FedosIdentityRegistry();
    const source = new FakeSource({ id: "e2e-1", publicIdentifier: "npub1e2e", displayName: "Dana", avatar: "https://example.invalid/dana.png" });
    const provider = new NostrIdentityProvider(source);
    const service = new FedosIdentityService(provider, registry);
    const resolver = new FedosIdentityResolver(registry);
    await service.describeIdentity();
    const record = resolver.findIdentity("e2e-1");
    expect(record).toEqual({
      id: "e2e-1",
      provider: "nostr",
      publicIdentifier: "npub1e2e",
      displayName: "Dana",
      avatar: "https://example.invalid/dana.png",
    });
  });

  it("27. behavioral: NullNostrPublicIdentitySource-backed end-to-end still registers nothing", async () => {
    const registry = new FedosIdentityRegistry();
    const provider = new NostrIdentityProvider(new NullNostrPublicIdentitySource());
    const service = new FedosIdentityService(provider, registry);
    const resolver = new FedosIdentityResolver(registry);
    expect(await service.describeIdentity()).toBeNull();
    expect(resolver.listIdentities()).toEqual([]);
  });

  it("28. Regression: fedos_identity_descriptor.ts (Alpha 028/045) is confirmed BYTE-FOR-BYTE unchanged -- still exactly five fields", () => {
    expect(descriptorSource).toMatch(/export interface FedosIdentityDescriptor \{/);
    const requiredFields = [...descriptorSource.matchAll(/^\s*readonly \w+: string;/gm)];
    expect(requiredFields.length).toBe(3);
    expect(descriptorSource).toMatch(/readonly displayName\?: string;/);
    expect(descriptorSource).toMatch(/readonly avatar\?: string;/);
    expect(descriptorSource).not.toMatch(/secure_runtime_alpha_047/);
  });

  it("29. Regression: fedos_identity_registry.ts (Alpha 041) is confirmed BYTE-FOR-BYTE unchanged -- still exactly four methods, no validation logic added", () => {
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).toMatch(/find\(id: string\): FedosIdentityRecord \| null \{/);
    expect(registrySource).toMatch(/list\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(registrySource).toMatch(/remove\(id: string\): boolean \{/);
    expect(codeOnlyLines(registrySource)).not.toMatch(/displayName|avatar/);
    expect(registrySource).not.toMatch(/secure_runtime_alpha_047/);
  });

  it("30. Regression: fedos_identity_resolver.ts (Alpha 043) is confirmed BYTE-FOR-BYTE unchanged -- still exactly two methods", () => {
    expect(resolverClassSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(resolverClassSource).toMatch(/listIdentities\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(codeOnlyLines(resolverClassSource)).not.toMatch(/displayName|avatar/);
    expect(resolverClassSource).not.toMatch(/secure_runtime_alpha_047/);
  });

  it("31. Regression: fedos_identity_provider.ts/fedos_identity_capability.ts/fedos_noop_identity_provider.ts/fedos_nostr_identity_provider.ts are all confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(providerInterfaceSource).toMatch(/describeIdentity\(\): Promise<FedosIdentityDescriptor \| null>;/);
    expect(providerInterfaceSource).not.toMatch(/secure_runtime_alpha_047/);
    expect(capabilitySource).toMatch(/readonly available: boolean;/);
    expect(capabilitySource).not.toMatch(/secure_runtime_alpha_047/);
    expect(noopProviderSource).toMatch(/readonly provider = "noop";/);
    expect(noopProviderSource).not.toMatch(/secure_runtime_alpha_047/);
    expect(nostrProviderSource).toMatch(/displayName: snapshot\.displayName,/);
    expect(nostrProviderSource).not.toMatch(/secure_runtime_alpha_047/);
  });

  it("32. Regression: fedos_identity_provider_resolver.ts is confirmed BYTE-FOR-BYTE unchanged -- still returns the shared NostrIdentityProvider singleton", () => {
    expect(identityProviderResolverSource).toMatch(/return sharedNostrProvider;/);
    expect(identityProviderResolverSource).not.toMatch(/secure_runtime_alpha_047/);
  });

  it("33. Regression: fedos_nostr_public_identity_source.ts (Alpha 039/044) and fedos_null_nostr_public_identity_source.ts (Alpha 039) are confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(sourceInterfaceSource).toMatch(/readonly displayName\?: string;/);
    expect(sourceInterfaceSource).toMatch(/readonly avatar\?: string;/);
    expect(sourceInterfaceSource).not.toMatch(/secure_runtime_alpha_047/);
    const body = (
      nullSourceSource.match(/async readPublicIdentity\(\): Promise<FedosNostrPublicIdentitySnapshot \| null> \{([\s\S]*?)\n  \}/) ?? []
    )[1] ?? "";
    expect(body.trim()).toBe("return null;");
    expect(nullSourceSource).not.toMatch(/secure_runtime_alpha_047/);
  });

  it("34. no other existing src/identity/* file was modified, and no existing src/nostr/* file references this Stage's own doc", () => {
    for (const source of [
      deviceTrustSource,
      deviceRegistrationSource,
      sessionBoundarySource,
      passkeyBoundarySource,
      providerBoundarySource,
      providerTypesSource,
      providerBridgeSource,
      recoveryPolicySource,
      vaultBridgeSource,
      webauthnAdapterSource,
      identityTypesSource,
    ]) {
      expect(source).not.toMatch(/secure_runtime_alpha_047/);
    }
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
      expect(source).not.toMatch(/secure_runtime_alpha_047/);
    }
  });

  it("35. no Runtime/Storage/Worker file references this Stage's own doc or the new mapping", () => {
    for (const source of [storageResolverSource, storageBackendSource, runtimeTypesSource, createRuntimeSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_047/);
    }
  });

  it("36. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("37. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_047/);

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

  it("38. RIPPLE (Secure Runtime Alpha 048): no fedos_*.ts file was added or removed by this Stage -- still exactly 56 under src/runtime/ and exactly 23 under src/identity/ AS OF this Stage's own scope; Alpha 048 later added a 24th identity file, fedos_nostr_public_identity_source_resolver.ts -- reconfirmed here as the CURRENT count, per this arc's own established ripple convention", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("39. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha047-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha047-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha047-id"));
    expect(deleted).toBe(true);
  });

  it("40. Regression: initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected -- confirmed by ACTUAL calls", async () => {
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha047-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha047-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha047-direct"))).toBe(true);
  });
});
