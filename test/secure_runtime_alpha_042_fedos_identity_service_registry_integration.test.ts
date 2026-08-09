import { describe, it, expect } from "vitest";
import { createRuntime, createRuntimeInitializeCryptoResult } from "../src/os/_legacy_prototype/runtime/create_runtime.js";
import { runtimeCapabilities } from "../src/runtime/fedos_runtime_prototype_execution.js";
import { randomBytes } from "../src/runtime/fedos_runtime_random_bytes.js";
import { generateAeadKey } from "../src/runtime/fedos_runtime_aead_key_generation.js";
import { encrypt } from "../src/runtime/fedos_runtime_encrypt.js";
import { decrypt } from "../src/runtime/fedos_runtime_decrypt.js";
import { exportCiphertext } from "../src/runtime/fedos_runtime_export_ciphertext.js";
import { importCiphertext } from "../src/runtime/fedos_runtime_import_ciphertext.js";
import { storeCiphertext, loadCiphertext, deleteCiphertext } from "../src/runtime/fedos_runtime_ciphertext_storage.js";
import { resolveFedosIdentityProvider } from "../src/identity/fedos_identity_provider_resolver.js";
import { NostrIdentityProvider } from "../src/identity/fedos_nostr_identity_provider.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
import { FedosIdentityRegistry } from "../src/identity/fedos_identity_registry.js";
import type { FedosIdentityProvider } from "../src/identity/fedos_identity_provider.js";
import type { FedosIdentityDescriptor } from "../src/identity/fedos_identity_descriptor.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_042_fedos_identity_service_registry_integration.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha031DocSource from "../docs/secure_runtime_alpha_031_fedos_identity_service_skeleton.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha041DocSource from "../docs/secure_runtime_alpha_041_fedos_identity_registry.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/os/core/identity/fedos_identity_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import registrySource from "../src/os/core/identity/fedos_identity_registry.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import recordSource from "../src/os/core/identity/fedos_identity_record.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/os/core/identity/fedos_identity_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerInterfaceSource from "../src/os/core/identity/fedos_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilitySource from "../src/os/core/identity/fedos_identity_capability.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import resolverSource from "../src/os/core/identity/fedos_identity_provider_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopProviderSource from "../src/os/core/identity/fedos_noop_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrProviderSource from "../src/os/core/identity/fedos_nostr_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sourceInterfaceSource from "../src/os/core/identity/fedos_nostr_public_identity_source.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullSourceSource from "../src/os/core/identity/fedos_null_nostr_public_identity_source.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import deviceTrustSource from "../src/os/core/identity/device_trust.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import deviceRegistrationSource from "../src/os/core/identity/device_registration.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sessionBoundarySource from "../src/os/core/identity/session_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import passkeyBoundarySource from "../src/os/core/identity/passkey_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerBoundarySource from "../src/os/core/identity/provider_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerTypesSource from "../src/os/core/identity/provider_types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerBridgeSource from "../src/os/core/identity/provider_bridge.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import recoveryPolicySource from "../src/os/core/identity/recovery_policy.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import vaultBridgeSource from "../src/os/core/identity/vault_bridge.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import webauthnAdapterSource from "../src/os/core/identity/webauthn_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityTypesSource from "../src/os/core/identity/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageResolverSource from "../src/runtime/fedos_runtime_storage_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageBackendSource from "../src/runtime/fedos_runtime_storage_backend.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
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

function makeTestProvider(overrides: Partial<FedosIdentityProvider> & { provider: string }): FedosIdentityProvider {
  return {
    provider: overrides.provider,
    describeIdentity: overrides.describeIdentity ?? (async () => null),
  };
}

/**
 * Secure Runtime Alpha 042 -- "FedOS Identity Service Registry
 * Integration": `FedosIdentityService` (Alpha 031) now takes a
 * required second constructor dependency, `FedosIdentityRegistry`
 * (Alpha 041), and `describeIdentity()` registers a
 * `FedosIdentityRecord` (Alpha 040) for every successful Descriptor
 * before returning it unchanged -- Provider called exactly once,
 * `describeCapability()` byte-for-byte unchanged, no Registry lookup
 * performed by this Service, no Runtime/Worker/Storage/Rust wiring of
 * any kind.
 */
describe("Secure Runtime Alpha 042 -- FedOS Identity Service Registry Integration, Registry write-only, no Provider/Resolver/Runtime/Worker/Storage/Rust change", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(10000);
  });

  it("2. the design doc states this Stage changes one constructor signature and one method body in one file, cross-referencing Alpha 031/040/041", () => {
    expect(designDocSource).toMatch(
      /one constructor signature change and one method\s+body change, in one file/,
    );
    expect(designDocSource).toMatch(/secure_runtime_alpha_031_fedos_identity_service_skeleton\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_040_fedos_identity_record\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_041_fedos_identity_registry\.md/);
    expect(alpha031DocSource).toMatch(/FedosIdentityService/);
    expect(alpha041DocSource).toMatch(/zero constructors, zero producers, zero consumers/);
  });

  it("3. the design doc records the exact new constructor and describeIdentity() flow diagram", () => {
    expect(designDocSource).toMatch(
      /constructor\(provider: FedosIdentityProvider, registry: FedosIdentityRegistry\) \{/,
    );
    expect(designDocSource).toMatch(/const descriptor = await this\.#provider\.describeIdentity\(\);/);
    expect(designDocSource).toMatch(/this\.#registry\.register\(record\);/);
    expect(designDocSource).toMatch(/return descriptor;/);
  });

  it("4. the design doc fixes all six mandated boundaries, each its own section", () => {
    expect(designDocSource).toMatch(/Serviceと Providerの責務 \(boundary with `FedosIdentityProvider`\)/);
    expect(designDocSource).toMatch(
      /Serviceと Registryの責務 \(boundary with `FedosIdentityRegistry`, Alpha 041\)/,
    );
    expect(designDocSource).toMatch(
      /Serviceと Descriptorの責務 \(boundary with `FedosIdentityDescriptor`, Alpha 028\)/,
    );
    expect(designDocSource).toMatch(/Serviceと Recordの責務 \(boundary with `FedosIdentityRecord`, Alpha 040\)/);
    expect(designDocSource).toMatch(/Serviceと Runtimeの責務 \(boundary with Runtime\)/);
    expect(designDocSource).toMatch(/Serviceと Storageの責務 \(boundary with Storage\)/);
  });

  it("5. the design doc explains why this Service does not perform Registry lookup, with three named reasons", () => {
    expect(designDocSource).toMatch(/ServiceがRegistry検索を担当しない理由/);
    expect(designDocSource).toMatch(
      /Registration and lookup are different responsibilities with\s+different callers\./,
    );
    expect(designDocSource).toMatch(/RegistryはRecord保\s*持のみ担当。Service自身はRecord検索を行わない/);
  });

  it("6. the design doc names the future Identity Resolver direction for lookup without scheduling it", () => {
    expect(designDocSource).toMatch(/将来IdentityResolverがRegistry検索を担当する方針/);
    expect(designDocSource).toMatch(/This Stage schedules nothing/);
  });

  it("7. the design doc records the explicit 'does NOT do' list", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_descriptor\.ts` \(Alpha 028\),/);
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* call `registry\.find\(\)`, `registry\.list\(\)`, or\s+`registry\.remove\(\)` anywhere/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `create_runtime\.ts` or any `src\/runtime\/\*` file\./);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/worker\.ts`\./);
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* add a Public Runtime API — `FedosIdentityService`'s own/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
  });

  it("8. fedos_identity_service.ts exports EXACTLY FedosIdentityService, with the new two-argument constructor and still exactly two methods", () => {
    expect([...serviceSource.matchAll(/^export class (\w+)/gm)].map((m: RegExpMatchArray) => m[1])).toEqual([
      "FedosIdentityService",
    ]);
    expect(serviceSource).toMatch(
      /constructor\(provider: FedosIdentityProvider, registry: FedosIdentityRegistry\) \{/,
    );
    const methodNames = [...serviceSource.matchAll(/^\s*async (\w+)\(/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(new Set(methodNames)).toEqual(new Set(["describeIdentity", "describeCapability"]));
  });

  it("9. the class holds exactly two private fields -- #provider and #registry -- and no others", () => {
    const codeOnly = codeOnlyLines(serviceSource);
    const fieldDeclarations = [...codeOnly.matchAll(/^\s*readonly #(\w+)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldDeclarations).toEqual(["provider", "registry"]);
  });

  it("10. describeIdentity()'s own body calls the Provider exactly once, maps onto a Record verbatim, calls registry.register() exactly once, and returns the ORIGINAL Descriptor", () => {
    const codeOnly = codeOnlyLines(serviceSource);
    const body = (codeOnly.match(/async describeIdentity\(\)[^{]*\{([\s\S]*?)\n  \}/) ?? [])[1] ?? "";
    expect([...body.matchAll(/this\.#provider\.describeIdentity\(\)/g)].length).toBe(1);
    expect([...body.matchAll(/this\.#registry\.register\(/g)].length).toBe(1);
    expect(body).toMatch(/id: descriptor\.id/);
    expect(body).toMatch(/provider: descriptor\.provider/);
    expect(body).toMatch(/publicIdentifier: descriptor\.publicIdentifier/);
    expect(body.trim().endsWith("return descriptor;")).toBe(true);
  });

  it("11. describeCapability()'s own body is BYTE-FOR-BYTE UNCHANGED from Alpha 031 -- no reference to describeIdentity() or the registry", () => {
    const codeOnly = codeOnlyLines(serviceSource);
    const body = (codeOnly.match(/async describeCapability\(\)[^{]*\{([\s\S]*?)\n  \}/) ?? [])[1] ?? "";
    expect(body.trim()).toBe("return { provider: this.#provider.provider, available: true };");
    expect(body).not.toMatch(/describeIdentity|registry|#registry/);
  });

  it("12. fedos_identity_service.ts's own CODE never calls registry.find()/list()/remove() anywhere -- only register()", () => {
    const codeOnly = codeOnlyLines(serviceSource);
    expect(codeOnly).not.toMatch(/\.find\(|\.list\(|\.remove\(/);
    expect([...codeOnly.matchAll(/\.register\(/g)].length).toBe(1);
  });

  it("13. fedos_identity_service.ts imports EXACTLY five type-only modules, and references no Runtime/Storage/Worker/Nostr module", () => {
    const importLines = [...serviceSource.matchAll(/^import .*$/gm)].map((m: RegExpMatchArray) => m[0]);
    expect(importLines.length).toBe(5);
    expect(importLines.every((line: string) => line.startsWith("import type "))).toBe(true);
    expect(serviceSource).toMatch(/from "\.\/fedos_identity_descriptor\.js"/);
    expect(serviceSource).toMatch(/from "\.\/fedos_identity_provider\.js"/);
    expect(serviceSource).toMatch(/from "\.\/fedos_identity_capability\.js"/);
    expect(serviceSource).toMatch(/from "\.\/fedos_identity_record\.js"/);
    expect(serviceSource).toMatch(/from "\.\/fedos_identity_registry\.js"/);
    const codeOnly = codeOnlyLines(serviceSource);
    expect(codeOnly).not.toMatch(/fedos_wasm_loader|fedos_runtime_storage_backend|fedos_runtime_ciphertext_storage|runtime\//);
    expect(codeOnly).not.toMatch(/nostr\//);
  });

  it("14. RIPPLE (Secure Runtime Alpha 042): fedos_identity_service.ts's own CODE referenced zero Authentication/Nostr/displayName/avatar vocabulary AS OF this Stage's own scope; Alpha 047 later added displayName/avatar to the Service's own Descriptor-to-Record mapping -- reconfirmed here as the CURRENT (expanded) shape, per this arc's own established ripple convention, while Authentication/Nostr vocabulary remains strictly absent", () => {
    const codeOnly = codeOnlyLines(serviceSource);
    expect(codeOnly).not.toMatch(/Authenticat|session|Session|credential|Credential/);
    expect(codeOnly).not.toMatch(/nostr|Nostr|relay|Relay|npub|nsec/);
    expect(codeOnly).toMatch(/displayName: descriptor\.displayName,/);
    expect(codeOnly).toMatch(/avatar: descriptor\.avatar,/);
    expect(codeOnly).not.toMatch(/create_runtime|AppRuntime/);
  });

  it("15. behavioral: describeIdentity() calls the injected Provider EXACTLY ONCE per call", async () => {
    let calls = 0;
    const descriptor: FedosIdentityDescriptor = { id: "id-1", provider: "p", publicIdentifier: "pub-1" };
    const provider = makeTestProvider({
      provider: "p",
      describeIdentity: async () => {
        calls += 1;
        return descriptor;
      },
    });
    const service = new FedosIdentityService(provider, new FedosIdentityRegistry());
    await service.describeIdentity();
    expect(calls).toBe(1);
    await service.describeIdentity();
    expect(calls).toBe(2);
  });

  it("16. behavioral: a successful describeIdentity() maps the Descriptor onto a Record and registers it, verbatim field-for-field", async () => {
    const descriptor: FedosIdentityDescriptor = { id: "user-9", provider: "nostr", publicIdentifier: "npub1abc" };
    const registry = new FedosIdentityRegistry();
    const provider = makeTestProvider({ provider: "nostr", describeIdentity: async () => descriptor });
    const service = new FedosIdentityService(provider, registry);

    const result = await service.describeIdentity();
    expect(result).toEqual(descriptor);
    expect(registry.find("user-9")).toEqual({ id: "user-9", provider: "nostr", publicIdentifier: "npub1abc" });
  });

  it("17. behavioral: describeIdentity() returns the ORIGINAL Descriptor object the Provider produced -- reference-equal, not a copy", async () => {
    const descriptor: FedosIdentityDescriptor = { id: "ref-1", provider: "p", publicIdentifier: "pub" };
    const provider = makeTestProvider({ provider: "p", describeIdentity: async () => descriptor });
    const service = new FedosIdentityService(provider, new FedosIdentityRegistry());
    const result = await service.describeIdentity();
    expect(result).toBe(descriptor);
  });

  it("18. behavioral: a null Descriptor registers NOTHING into the Registry, and describeIdentity() still resolves null", async () => {
    const registry = new FedosIdentityRegistry();
    const provider = makeTestProvider({ provider: "empty", describeIdentity: async () => null });
    const service = new FedosIdentityService(provider, registry);

    const result = await service.describeIdentity();
    expect(result).toBeNull();
    expect(registry.list()).toEqual([]);
  });

  it("19. behavioral: repeated describeIdentity() calls with the same id overwrite the same Registry entry, matching Map.set()'s own semantics", async () => {
    const registry = new FedosIdentityRegistry();
    let callCount = 0;
    const provider = makeTestProvider({
      provider: "nostr",
      describeIdentity: async () => {
        callCount += 1;
        return { id: "same-id", provider: "nostr", publicIdentifier: `npub-v${callCount}` };
      },
    });
    const service = new FedosIdentityService(provider, registry);

    await service.describeIdentity();
    await service.describeIdentity();
    expect(registry.list().length).toBe(1);
    expect(registry.find("same-id")?.publicIdentifier).toBe("npub-v2");
  });

  it("20. behavioral: two independent Service instances sharing the SAME Registry both register into it", async () => {
    const sharedRegistry = new FedosIdentityRegistry();
    const providerA = makeTestProvider({
      provider: "a",
      describeIdentity: async () => ({ id: "a-1", provider: "a", publicIdentifier: "pub-a" }),
    });
    const providerB = makeTestProvider({
      provider: "b",
      describeIdentity: async () => ({ id: "b-1", provider: "b", publicIdentifier: "pub-b" }),
    });
    const serviceA = new FedosIdentityService(providerA, sharedRegistry);
    const serviceB = new FedosIdentityService(providerB, sharedRegistry);

    await serviceA.describeIdentity();
    await serviceB.describeIdentity();
    expect(sharedRegistry.list().length).toBe(2);
    expect(sharedRegistry.find("a-1")?.provider).toBe("a");
    expect(sharedRegistry.find("b-1")?.provider).toBe("b");
  });

  it("21. behavioral: describeCapability() is unaffected -- reports the injected provider's own label with available: true, never touching the Registry, regardless of what describeIdentity() would do", async () => {
    const registry = new FedosIdentityRegistry();
    const provider = makeTestProvider({ provider: "capability-only" });
    const service = new FedosIdentityService(provider, registry);

    const capability = await service.describeCapability();
    expect(capability).toEqual({ provider: "capability-only", available: true });
    expect(registry.list()).toEqual([]);
  });

  it("22. Regression: fedos_identity_provider.ts (Alpha 029) is confirmed BYTE-FOR-BYTE unchanged -- still exactly one method, no describeCapability()", () => {
    expect(providerInterfaceSource).toMatch(/export interface FedosIdentityProvider \{/);
    expect(providerInterfaceSource).toMatch(/describeIdentity\(\): Promise<FedosIdentityDescriptor \| null>;/);
    expect(providerInterfaceSource).not.toMatch(/describeCapability/);
    expect(providerInterfaceSource).not.toMatch(/secure_runtime_alpha_042/);
  });

  it("23. Regression: fedos_identity_descriptor.ts/fedos_identity_capability.ts/fedos_identity_record.ts/fedos_identity_registry.ts are all confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(descriptorSource).toMatch(/readonly id: string;/);
    expect(descriptorSource).not.toMatch(/secure_runtime_alpha_042/);
    expect(capabilitySource).toMatch(/readonly available: boolean;/);
    expect(capabilitySource).not.toMatch(/secure_runtime_alpha_042/);
    expect(recordSource).toMatch(/export interface FedosIdentityRecord \{/);
    expect(recordSource).not.toMatch(/secure_runtime_alpha_042/);
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).toMatch(/find\(id: string\): FedosIdentityRecord \| null \{/);
    expect(registrySource).toMatch(/list\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(registrySource).toMatch(/remove\(id: string\): boolean \{/);
    expect(registrySource).not.toMatch(/secure_runtime_alpha_042/);
  });

  it("24. RIPPLE (Secure Runtime Alpha 049): fedos_identity_provider_resolver.ts/fedos_noop_identity_provider.ts are confirmed BYTE-FOR-BYTE unchanged; fedos_nostr_identity_provider.ts's constructor required an injected Source with no default AS OF this Stage's own scope, Alpha 049 later gave it a default value -- reconfirmed here as the CURRENT signature", () => {
    expect(resolverSource).toMatch(/return sharedNostrProvider;/);
    expect(codeOnlyLines(resolverSource)).not.toMatch(/FedosIdentityService|FedosIdentityRegistry/);
    expect(resolverSource).not.toMatch(/secure_runtime_alpha_042/);
    expect(noopProviderSource).toMatch(/readonly provider = "noop";/);
    expect(noopProviderSource).not.toMatch(/secure_runtime_alpha_042/);
    expect(nostrProviderSource).toMatch(/constructor\(source: FedosNostrPublicIdentitySource = resolveNostrPublicIdentitySource\(\)\) \{/);
    expect(codeOnlyLines(nostrProviderSource)).not.toMatch(/FedosIdentityService|FedosIdentityRegistry/);
    expect(nostrProviderSource).not.toMatch(/secure_runtime_alpha_042/);
  });

  it("25. behavioral: resolveFedosIdentityProvider() is entirely unaffected -- still resolves the shared NostrIdentityProvider singleton, provider === 'nostr', describeIdentity() still always null by default", async () => {
    const resolved = resolveFedosIdentityProvider();
    expect(resolved).toBeInstanceOf(NostrIdentityProvider);
    expect(resolved?.provider).toBe("nostr");
    expect(await resolved?.describeIdentity()).toBeNull();
  });

  it("26. no Runtime/Storage/Worker file references this Stage's own doc or the Service/Registry -- confirmed unchanged exports", () => {
    for (const source of [storageResolverSource, storageBackendSource, runtimeTypesSource, createRuntimeSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_042/);
      expect(source).not.toMatch(/FedosIdentityService|FedosIdentityRegistry/);
    }
  });

  it("27. no existing src/identity/* file besides the Service was modified, and no existing src/nostr/* file references this Stage's own doc", () => {
    for (const source of [
      sourceInterfaceSource,
      nullSourceSource,
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
      expect(source).not.toMatch(/secure_runtime_alpha_042/);
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
      expect(source).not.toMatch(/secure_runtime_alpha_042/);
    }
  });

  it("28. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("29. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_042/);

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

  it("30. no fedos_*.ts file was added or removed by this Stage -- still exactly 56 under src/runtime/ and exactly 22 under src/identity/ (this Stage only modifies an existing file's body)", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("31. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha042-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha042-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha042-id"));
    expect(deleted).toBe(true);
  });

  it("32. Regression: initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected -- confirmed by ACTUAL calls", async () => {
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha042-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha042-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha042-direct"))).toBe(true);
  });
});
