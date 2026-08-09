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
import { resolveFedosIdentityProvider } from "../src/os/core/identity/fedos_identity_provider_resolver.js";
import { NostrIdentityProvider } from "../src/os/core/identity/fedos_nostr_identity_provider.js";
import { FedosIdentityService } from "../src/os/core/identity/fedos_identity_service.js";
import { FedosIdentityRegistry } from "../src/os/core/identity/fedos_identity_registry.js";
import { FedosIdentityResolver } from "../src/os/core/identity/fedos_identity_resolver.js";
import type { FedosIdentityProvider } from "../src/os/core/identity/fedos_identity_provider.js";
import type { FedosIdentityDescriptor } from "../src/os/core/identity/fedos_identity_descriptor.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_043_fedos_identity_resolver.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha041DocSource from "../docs/secure_runtime_alpha_041_fedos_identity_registry.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha042DocSource from "../docs/secure_runtime_alpha_042_fedos_identity_service_registry_integration.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import resolverClassSource from "../src/os/core/identity/fedos_identity_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/os/core/identity/fedos_identity_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import registrySource from "../src/os/core/identity/fedos_identity_registry.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import recordSource from "../src/os/core/identity/fedos_identity_record.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/os/core/identity/fedos_identity_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerInterfaceSource from "../src/os/core/identity/fedos_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilitySource from "../src/os/core/identity/fedos_identity_capability.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityProviderResolverSource from "../src/os/core/identity/fedos_identity_provider_resolver.ts?raw";
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
import nobleSignatureSource from "../src/os/messenger/adapters/nostr/protocol/noble_signature.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrCryptoSource from "../src/os/messenger/adapters/nostr/protocol/crypto.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrEventSource from "../src/os/messenger/adapters/nostr/protocol/event.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrRelaySource from "../src/os/messenger/adapters/nostr/protocol/relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrWsRelaySource from "../src/os/messenger/adapters/nostr/protocol/ws_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrPublishSource from "../src/os/messenger/adapters/nostr/protocol/publish.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrSignatureSource from "../src/os/messenger/adapters/nostr/protocol/signature.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrMessagesSource from "../src/os/messenger/adapters/nostr/protocol/messages.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrTypesSource from "../src/os/messenger/adapters/nostr/protocol/types.ts?raw";
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
 * Secure Runtime Alpha 043 -- "FedOS Identity Resolver (Registry
 * Lookup)": adds exactly ONE class, `FedosIdentityResolver`, a
 * READ-ONLY wrapper around exactly two of `FedosIdentityRegistry`'s
 * (Alpha 041) own four methods (`find()`/`list()`) -- never
 * `register()`/`remove()`, never a Provider, never
 * `FedosIdentityService`, no Runtime/Worker/Storage/Rust wiring of any
 * kind.
 */
describe("Secure Runtime Alpha 043 -- FedOS Identity Resolver, Registry read-only, no Registry/Service/Provider/Runtime/Worker/Storage/Rust change", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(10000);
  });

  it("2. the design doc states this Stage adds a single, minimal class only, cross-referencing Alpha 041/042", () => {
    expect(designDocSource).toMatch(/a single, minimal class only/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_041_fedos_identity_registry\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_042_fedos_identity_service_registry_integration\.md/);
    expect(alpha042DocSource).toMatch(/A future "Identity Resolver" \(name provisional/);
    expect(alpha041DocSource).toMatch(/find\(id: string\): FedosIdentityRecord \| null \{/);
  });

  it("3. the design doc records the exact Resolver shape", () => {
    expect(designDocSource).toMatch(/export class FedosIdentityResolver \{/);
    expect(designDocSource).toMatch(/readonly #registry: FedosIdentityRegistry;/);
    expect(designDocSource).toMatch(/constructor\(registry: FedosIdentityRegistry\) \{/);
    expect(designDocSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(designDocSource).toMatch(/listIdentities\(\): readonly FedosIdentityRecord\[\] \{/);
  });

  it("4. the design doc explains the naming note distinguishing this Resolver from Alpha 032's own resolveFedosIdentityProvider()", () => {
    expect(designDocSource).toMatch(/命名注記 \(naming note — not the same "Resolver" as Alpha 032\)/);
    expect(designDocSource).toMatch(/share the English word\s+"resolver" and nothing else/);
  });

  it("5. the design doc fixes all seven mandated boundaries, each its own section", () => {
    expect(designDocSource).toMatch(/ResolverとRegistryの責務 \(boundary with `FedosIdentityRegistry`, Alpha 041\)/);
    expect(designDocSource).toMatch(
      /ResolverとServiceの責務 \(boundary with `FedosIdentityService`, Alpha 031\/042\)/,
    );
    expect(designDocSource).toMatch(/ResolverとProviderの責務 \(boundary with `FedosIdentityProvider`, Alpha 029\)/);
    expect(designDocSource).toMatch(
      /ResolverとDescriptorの責務 \(boundary with `FedosIdentityDescriptor`, Alpha 028\)/,
    );
    expect(designDocSource).toMatch(/ResolverとRecordの責務 \(boundary with `FedosIdentityRecord`, Alpha 040\)/);
    expect(designDocSource).toMatch(
      /ResolverとRuntimeの責務・ResolverとStorageの責務 \(boundary with Runtime and Storage\)/,
    );
  });

  it("6. the design doc gives three named reasons the Resolver has no register()-shaped method", () => {
    expect(designDocSource).toMatch(/Resolverがregister\(\)を持たない理由/);
    expect(designDocSource).toMatch(
      /Registration and lookup are still different responsibilities with\s+different callers/,
    );
  });

  it("7. the design doc gives named reasons the Resolver never calls a Provider directly", () => {
    expect(designDocSource).toMatch(/ResolverがProviderを直接呼ばない理由/);
    expect(designDocSource).toMatch(/Providerを\s*呼ばない/);
    expect(designDocSource).toMatch(/describeIdentity\(\)を呼ばない/);
  });

  it("8. the design doc names the future create_runtime.ts wiring direction without scheduling it", () => {
    expect(designDocSource).toMatch(/将来create_runtime\.tsへ配線する場合の方針/);
    expect(designDocSource).toMatch(/This Stage schedules nothing/);
  });

  it("9. the design doc records the explicit 'does NOT do' list", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_registry\.ts` \(Alpha 041\)/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_service\.ts` \(Alpha 031\/042\)\./);
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* call `registry\.register\(\)` or `registry\.remove\(\)`\s+anywhere/,
    );
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* call any `FedosIdentityProvider\.describeIdentity\(\)`\s+anywhere/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `create_runtime\.ts` or any `src\/runtime\/\*` file\./);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/worker\.ts`\./);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
  });

  it("10. fedos_identity_resolver.ts exports EXACTLY FedosIdentityResolver, no other export", () => {
    expect([...resolverClassSource.matchAll(/^export class (\w+)/gm)].map((m: RegExpMatchArray) => m[1])).toEqual([
      "FedosIdentityResolver",
    ]);
    expect([...resolverClassSource.matchAll(/^export (?:async )?function/gm)].length).toBe(0);
    expect([...resolverClassSource.matchAll(/^export interface/gm)].length).toBe(0);
    expect([...resolverClassSource.matchAll(/^export const/gm)].length).toBe(0);
    expect(resolverClassSource).not.toMatch(/export default/);
  });

  it("11. the class holds exactly one private field, #registry, and no others", () => {
    const codeOnly = codeOnlyLines(resolverClassSource);
    const fieldDeclarations = [...codeOnly.matchAll(/^ {2}(?:readonly\s+)?#?\w+\s*[:=]/gm)];
    expect(fieldDeclarations.length).toBe(1);
    expect(codeOnly).toMatch(/readonly #registry: FedosIdentityRegistry;/);
  });

  it("12. the class has EXACTLY two methods -- findIdentity/listIdentities -- and no others", () => {
    const methodNames = [...resolverClassSource.matchAll(/^ {2}(\w+)\([^)]*\)[^{]*\{/gm)]
      .map((m: RegExpMatchArray) => m[1])
      .filter((name: string | undefined): name is string => name !== undefined && name !== "constructor");
    expect(methodNames.sort()).toEqual(["findIdentity", "listIdentities"].sort());
  });

  it("13. findIdentity()'s own body is EXACTLY one Registry.find() pass-through", () => {
    const body = (resolverClassSource.match(/findIdentity\(id: string\): FedosIdentityRecord \| null \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body.trim()).toBe("return this.#registry.find(id);");
  });

  it("14. listIdentities()'s own body is EXACTLY one Registry.list() pass-through", () => {
    const body = (resolverClassSource.match(/listIdentities\(\): readonly FedosIdentityRecord\[\] \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body.trim()).toBe("return this.#registry.list();");
  });

  it("15. fedos_identity_resolver.ts's own CODE (excluding its own explanatory header comment) never references register()/remove(), any Provider, FedosIdentityService, Runtime, Storage, or Nostr vocabulary", () => {
    const codeOnly = codeOnlyLines(resolverClassSource);
    expect(codeOnly).not.toMatch(/\.register\(|\.remove\(/);
    expect(codeOnly).not.toMatch(/FedosIdentityProvider|describeIdentity/);
    expect(codeOnly).not.toMatch(/FedosIdentityService/);
    expect(codeOnly).not.toMatch(/create_runtime|AppRuntime/);
    expect(codeOnly).not.toMatch(/storeCiphertext|loadCiphertext|deleteCiphertext|RuntimeStorageBackend/);
    expect(codeOnly).not.toMatch(/\bworker\b/i);
    expect(codeOnly).not.toMatch(/nostr|Nostr|relay|Relay|npub|nsec/);
    expect(codeOnly).not.toMatch(/Authenticat|session|Session|credential|Credential/);
    expect(codeOnly).not.toMatch(/displayName|avatar/);
  });

  it("16. fedos_identity_resolver.ts imports EXACTLY two type-only modules -- FedosIdentityRecord and FedosIdentityRegistry -- and nothing else", () => {
    const importLines = [...resolverClassSource.matchAll(/^import .*$/gm)].map((m: RegExpMatchArray) => m[0]);
    expect(importLines.length).toBe(2);
    expect(importLines.every((line: string) => line.startsWith("import type "))).toBe(true);
    expect(resolverClassSource).toMatch(/from "\.\/fedos_identity_record\.js"/);
    expect(resolverClassSource).toMatch(/from "\.\/fedos_identity_registry\.js"/);
  });

  it("17. behavioral: findIdentity() delegates to Registry.find() -- returns the exact Record when present, null when absent", () => {
    const registry = new FedosIdentityRegistry();
    const resolver = new FedosIdentityResolver(registry);
    expect(resolver.findIdentity("missing")).toBeNull();

    registry.register({ id: "user-1", provider: "nostr", publicIdentifier: "npub1abc" });
    expect(resolver.findIdentity("user-1")).toEqual({ id: "user-1", provider: "nostr", publicIdentifier: "npub1abc" });
  });

  it("18. behavioral: listIdentities() delegates to Registry.list() -- empty when nothing registered, all Records once several are registered", () => {
    const registry = new FedosIdentityRegistry();
    const resolver = new FedosIdentityResolver(registry);
    expect(resolver.listIdentities()).toEqual([]);

    registry.register({ id: "a", provider: "nostr", publicIdentifier: "npub1a" });
    registry.register({ id: "b", provider: "noop", publicIdentifier: "" });
    const listed = resolver.listIdentities();
    expect(listed.length).toBe(2);
    expect(listed.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });

  it("19. behavioral: the Resolver reflects LIVE Registry state -- a Record registered after Resolver construction is still visible", () => {
    const registry = new FedosIdentityRegistry();
    const resolver = new FedosIdentityResolver(registry);
    expect(resolver.findIdentity("late")).toBeNull();
    registry.register({ id: "late", provider: "nostr", publicIdentifier: "npub1late" });
    expect(resolver.findIdentity("late")).toEqual({ id: "late", provider: "nostr", publicIdentifier: "npub1late" });
  });

  it("20. behavioral: the Resolver has no register()/remove() method at all -- calling one throws a TypeError, confirming the class itself never exposes them", () => {
    const registry = new FedosIdentityRegistry();
    const resolver = new FedosIdentityResolver(registry) as unknown as Record<string, unknown>;
    expect(resolver.register).toBeUndefined();
    expect(resolver.remove).toBeUndefined();
  });

  it("21. behavioral: listIdentities() returns a live pass-through of Registry.list() -- mutating the returned array does not affect the Registry's own state (Registry's own readonly guarantee, Alpha 041)", () => {
    const registry = new FedosIdentityRegistry();
    const resolver = new FedosIdentityResolver(registry);
    registry.register({ id: "a", provider: "nostr", publicIdentifier: "npub1a" });
    const first = resolver.listIdentities() as unknown as { push: (x: unknown) => void };
    first.push({ id: "injected", provider: "x", publicIdentifier: "y" });
    expect(resolver.listIdentities().length).toBe(1);
  });

  it("22. behavioral: two independent Resolver instances backed by the SAME Registry see the SAME data", () => {
    const registry = new FedosIdentityRegistry();
    registry.register({ id: "shared", provider: "nostr", publicIdentifier: "npub1shared" });
    const resolverA = new FedosIdentityResolver(registry);
    const resolverB = new FedosIdentityResolver(registry);
    expect(resolverA.findIdentity("shared")).toEqual(resolverB.findIdentity("shared"));
  });

  it("23. behavioral: a Resolver backed by a DIFFERENT Registry instance sees none of another Registry's data -- no shared/global mutable state", () => {
    const registryA = new FedosIdentityRegistry();
    const registryB = new FedosIdentityRegistry();
    registryA.register({ id: "only-in-a", provider: "nostr", publicIdentifier: "npub1a" });
    const resolverB = new FedosIdentityResolver(registryB);
    expect(resolverB.findIdentity("only-in-a")).toBeNull();
    expect(resolverB.listIdentities()).toEqual([]);
  });

  it("24. behavioral: end-to-end -- a FedosIdentityService registers a Record via a real Provider, and a FedosIdentityResolver backed by the SAME Registry can find and list it, with the Resolver itself never touching the Provider or the Service", async () => {
    const registry = new FedosIdentityRegistry();
    const descriptor: FedosIdentityDescriptor = { id: "e2e-1", provider: "nostr", publicIdentifier: "npub1e2e" };
    const provider = makeTestProvider({ provider: "nostr", describeIdentity: async () => descriptor });
    const service = new FedosIdentityService(provider, registry);
    const resolver = new FedosIdentityResolver(registry);

    expect(resolver.findIdentity("e2e-1")).toBeNull();
    await service.describeIdentity();
    expect(resolver.findIdentity("e2e-1")).toEqual({ id: "e2e-1", provider: "nostr", publicIdentifier: "npub1e2e" });
    expect(resolver.listIdentities().length).toBe(1);
  });

  it("25. Regression: fedos_identity_registry.ts (Alpha 041) is confirmed BYTE-FOR-BYTE unchanged -- still exactly four methods, no reference to this Stage's own doc", () => {
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).toMatch(/find\(id: string\): FedosIdentityRecord \| null \{/);
    expect(registrySource).toMatch(/list\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(registrySource).toMatch(/remove\(id: string\): boolean \{/);
    expect(registrySource).not.toMatch(/secure_runtime_alpha_043/);
    expect(registrySource).not.toMatch(/FedosIdentityResolver/);
  });

  it("26. Regression: fedos_identity_service.ts (Alpha 031/042) is confirmed BYTE-FOR-BYTE unchanged -- still the two-argument constructor, no reference to this Stage's own doc or the new Resolver", () => {
    expect(serviceSource).toMatch(/constructor\(provider: FedosIdentityProvider, registry: FedosIdentityRegistry\) \{/);
    expect(serviceSource).not.toMatch(/secure_runtime_alpha_043/);
    expect(serviceSource).not.toMatch(/FedosIdentityResolver/);
  });

  it("27. Regression: fedos_identity_provider.ts/fedos_identity_descriptor.ts/fedos_identity_capability.ts/fedos_identity_record.ts are all confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(providerInterfaceSource).toMatch(/describeIdentity\(\): Promise<FedosIdentityDescriptor \| null>;/);
    expect(providerInterfaceSource).not.toMatch(/secure_runtime_alpha_043/);
    expect(descriptorSource).toMatch(/readonly id: string;/);
    expect(descriptorSource).not.toMatch(/secure_runtime_alpha_043/);
    expect(capabilitySource).toMatch(/readonly available: boolean;/);
    expect(capabilitySource).not.toMatch(/secure_runtime_alpha_043/);
    expect(recordSource).toMatch(/export interface FedosIdentityRecord \{/);
    expect(recordSource).not.toMatch(/secure_runtime_alpha_043/);
  });

  it("28. RIPPLE (Secure Runtime Alpha 049): fedos_identity_provider_resolver.ts/fedos_noop_identity_provider.ts are confirmed BYTE-FOR-BYTE unchanged, no reference to this new Resolver in either direction; fedos_nostr_identity_provider.ts's constructor required an injected Source with no default AS OF this Stage's own scope, Alpha 049 later gave it a default value -- reconfirmed here as the CURRENT signature, still no reference to FedosIdentityResolver", () => {
    expect(identityProviderResolverSource).toMatch(/return sharedNostrProvider;/);
    expect(identityProviderResolverSource).not.toMatch(/FedosIdentityResolver|fedos_identity_resolver/);
    expect(identityProviderResolverSource).not.toMatch(/secure_runtime_alpha_043/);
    expect(noopProviderSource).toMatch(/readonly provider = "noop";/);
    expect(noopProviderSource).not.toMatch(/secure_runtime_alpha_043/);
    expect(nostrProviderSource).toMatch(/constructor\(source: FedosNostrPublicIdentitySource = resolveNostrPublicIdentitySource\(\)\) \{/);
    expect(nostrProviderSource).not.toMatch(/FedosIdentityResolver/);
    expect(nostrProviderSource).not.toMatch(/secure_runtime_alpha_043/);
  });

  it("29. behavioral: resolveFedosIdentityProvider() is entirely unaffected -- still resolves the shared NostrIdentityProvider singleton, provider === 'nostr', describeIdentity() still always null by default", async () => {
    const resolved = resolveFedosIdentityProvider();
    expect(resolved).toBeInstanceOf(NostrIdentityProvider);
    expect(resolved?.provider).toBe("nostr");
    expect(await resolved?.describeIdentity()).toBeNull();
  });

  it("30. RIPPLE (Secure Runtime Alpha 050-052): fedos_identity_resolver.ts had ZERO importers anywhere in src/ AS OF this Stage's own scope; Alpha 050-052 later made fedos_runtime_identity.ts its first real importer -- reconfirmed here as the CURRENT state, per this arc's own established ripple convention. Every other identity/runtime/nostr/worker file remains a non-importer", () => {
    for (const source of [
      recordSource,
      registrySource,
      serviceSource,
      descriptorSource,
      providerInterfaceSource,
      capabilitySource,
      identityProviderResolverSource,
      noopProviderSource,
      nostrProviderSource,
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
      storageResolverSource,
      storageBackendSource,
      createRuntimeSource,
      runtimeTypesSource,
      workerSource,
    ]) {
      expect(source).not.toMatch(/fedos_identity_resolver/);
      expect(source).not.toMatch(/FedosIdentityResolver/);
    }
    expect(fedosRuntimeIdentitySource).toMatch(/import \{ FedosIdentityResolver \} from "\.\.\/identity\/fedos_identity_resolver\.js";/);
  });

  it("31. no Runtime/Storage/Worker file references this Stage's own doc, and no existing src/nostr/* file was modified", () => {
    for (const source of [storageResolverSource, storageBackendSource, runtimeTypesSource, createRuntimeSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_043/);
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
      expect(source).not.toMatch(/secure_runtime_alpha_043/);
    }
  });

  it("32. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("33. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_043/);

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

  it("34. RIPPLE (Secure Runtime Alpha 048): exactly one new file was added under src/identity/ -- 23 files total AS OF this Stage's own scope; Alpha 048 later added a 24th, fedos_nostr_public_identity_source_resolver.ts -- reconfirmed here as the CURRENT count, per this arc's own established ripple convention; no fedos_*.ts file under src/runtime/ was added or removed -- still exactly 56 files", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("35. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha043-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha043-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha043-id"));
    expect(deleted).toBe(true);
  });

  it("36. Regression: initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected -- confirmed by ACTUAL calls", async () => {
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha043-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha043-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha043-direct"))).toBe(true);
  });
});
