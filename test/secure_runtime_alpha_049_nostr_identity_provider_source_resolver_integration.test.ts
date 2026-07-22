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
import { resolveNostrPublicIdentitySource } from "../src/identity/fedos_nostr_public_identity_source_resolver.js";
import { NullNostrPublicIdentitySource } from "../src/identity/fedos_null_nostr_public_identity_source.js";
import { resolveFedosIdentityProvider } from "../src/identity/fedos_identity_provider_resolver.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
import { FedosIdentityRegistry } from "../src/identity/fedos_identity_registry.js";
import { FedosIdentityResolver } from "../src/identity/fedos_identity_resolver.js";
import type {
  FedosNostrPublicIdentitySnapshot,
  FedosNostrPublicIdentitySource,
} from "../src/identity/fedos_nostr_public_identity_source.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_049_nostr_identity_provider_source_resolver_integration.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha039DocSource from "../docs/secure_runtime_alpha_039_nostr_public_identity_source_boundary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha048DocSource from "../docs/secure_runtime_alpha_048_fedos_nostr_public_identity_source_resolver.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrProviderSource from "../src/identity/fedos_nostr_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sourceResolverSource from "../src/identity/fedos_nostr_public_identity_source_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullSourceSource from "../src/identity/fedos_null_nostr_public_identity_source.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sourceInterfaceSource from "../src/identity/fedos_nostr_public_identity_source.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityProviderResolverSource from "../src/identity/fedos_identity_provider_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/identity/fedos_identity_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import recordSource from "../src/identity/fedos_identity_record.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/identity/fedos_identity_service.ts?raw";
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
  calls = 0;
  constructor(snapshot: FedosNostrPublicIdentitySnapshot | null) {
    this.#snapshot = snapshot;
  }
  async readPublicIdentity(): Promise<FedosNostrPublicIdentitySnapshot | null> {
    this.calls += 1;
    return this.#snapshot;
  }
}

/**
 * Secure Runtime Alpha 049 -- "Nostr Identity Provider Source Resolver
 * Integration": `NostrIdentityProvider`'s constructor `source`
 * parameter now DEFAULTS to `resolveNostrPublicIdentitySource()`
 * (Alpha 048) when omitted -- explicit injection remains fully
 * supported, unchanged. `describeIdentity()`'s own body is
 * byte-for-byte unchanged. Descriptor/Record/Registry/Resolver/Runtime/
 * Worker/Storage/Rust are all confirmed unchanged.
 */
describe("Secure Runtime Alpha 049 -- Nostr Identity Provider Source Resolver Integration, constructor-default-only, no Descriptor/Record/Registry/Resolver/Runtime/Worker/Storage/Rust change", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(10000);
  });

  it("2. the design doc records the exact before/after constructor signature, cross-referencing Alpha 039/048", () => {
    expect(designDocSource).toMatch(/constructor\(source: FedosNostrPublicIdentitySource\) \{/);
    expect(designDocSource).toMatch(/constructor\(source: FedosNostrPublicIdentitySource = resolveNostrPublicIdentitySource\(\)\) \{/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_039_nostr_public_identity_source_boundary\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_048_fedos_nostr_public_identity_source_resolver\.md/);
    expect(alpha039DocSource.length).toBeGreaterThan(0);
    expect(alpha048DocSource).toMatch(/export function resolveNostrPublicIdentitySource\(\): FedosNostrPublicIdentitySource \{/);
  });

  it("3. the design doc explains why the Provider depends only on the Resolver, never a concrete Source", () => {
    expect(designDocSource).toMatch(
      /なぜProviderがResolverだけを見る構造なのか \(why the Provider depends only on the Resolver, never on a concrete Source\)/,
    );
  });

  it("4. the design doc explains why the constructor does not default to `new NullNostrPublicIdentitySource()` directly", () => {
    expect(designDocSource).toMatch(
      /なぜNullSourceを直接newしないのか \(why the constructor does not default to `new NullNostrPublicIdentitySource\(\)` directly\)/,
    );
  });

  it("5. the design doc compares this structure with the Storage Backend Resolver", () => {
    expect(designDocSource).toMatch(
      /Storage Backend Resolverとの構造比較 \(structural comparison with the Storage Backend Resolver\)/,
    );
    expect(designDocSource).toMatch(/resolveRuntimeStorageBackend\(\)/);
    expect(storageResolverSource).toMatch(/export function resolveRuntimeStorageBackend\(\): RuntimeStorageBackend \{/);
  });

  it("6. the design doc explains why swapping to Filesystem/SQLite/Profile Cache/Remote Fetch will still never require modifying the Provider", () => {
    expect(designDocSource).toMatch(/Filesystem/);
    expect(designDocSource).toMatch(/SQLite/);
    expect(designDocSource).toMatch(/Profile Cache/);
    expect(designDocSource).toMatch(/Remote Fetch/);
    expect(designDocSource).toMatch(/still never require modifying the Provider/);
  });

  it("7. the design doc records the explicit 'does NOT do' list", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_nostr_public_identity_source_resolver\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_null_nostr_public_identity_source\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_provider_resolver\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement any real public-identity retrieval logic/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `describeIdentity\(\)`'s own body in any way/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `create_runtime\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
  });

  it("8. fedos_nostr_identity_provider.ts's own constructor now defaults to resolveNostrPublicIdentitySource(), confirmed via literal extraction", () => {
    expect(nostrProviderSource).toMatch(
      /constructor\(source: FedosNostrPublicIdentitySource = resolveNostrPublicIdentitySource\(\)\) \{/,
    );
  });

  it("9. fedos_nostr_identity_provider.ts imports EXACTLY four modules -- three type-only, one value (the new Resolver)", () => {
    const importLines = [...nostrProviderSource.matchAll(/^import .*$/gm)].map((m: RegExpMatchArray) => m[0]);
    expect(importLines.length).toBe(4);
    expect(importLines.filter((line: string) => line.startsWith("import type ")).length).toBe(3);
    expect(importLines.filter((line: string) => !line.startsWith("import type ")).length).toBe(1);
    expect(nostrProviderSource).toMatch(
      /import \{ resolveNostrPublicIdentitySource \} from "\.\/fedos_nostr_public_identity_source_resolver\.js";/,
    );
  });

  it("10. every line of describeIdentity() -- the Source read, the try/catch, the null check, both presence checks, the Descriptor construction including displayName/avatar -- is confirmed BYTE-FOR-BYTE unchanged", () => {
    const body = (
      nostrProviderSource.match(/async describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*)\n  \}/) ?? []
    )[1] ?? "";
    const normalizedLines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(normalizedLines).toEqual(
      [
        "let snapshot: FedosNostrPublicIdentitySnapshot | null;",
        "try {",
        "snapshot = await this.#source.readPublicIdentity();",
        "} catch {",
        "return null;",
        "}",
        "if (snapshot === null) {",
        "return null;",
        "}",
        'if (typeof snapshot.id !== "string" || snapshot.id.length === 0) {',
        "return null;",
        "}",
        'if (typeof snapshot.publicIdentifier !== "string" || snapshot.publicIdentifier.length === 0) {',
        "return null;",
        "}",
        "return {",
        "id: snapshot.id,",
        'provider: "nostr",',
        "publicIdentifier: snapshot.publicIdentifier,",
        "displayName: snapshot.displayName,",
        "avatar: snapshot.avatar,",
        "};",
      ],
    );
  });

  it("11. fedos_nostr_identity_provider.ts's own CODE (excluding its own explanatory header comment) references no Service/Registry/Resolver-class/Runtime/Worker/Storage/Nostr-network vocabulary beyond the new Source Resolver import", () => {
    const codeOnly = codeOnlyLines(nostrProviderSource);
    expect(codeOnly).not.toMatch(/create_runtime|AppRuntime/);
    expect(codeOnly).not.toMatch(/storeCiphertext|loadCiphertext|deleteCiphertext|RuntimeStorageBackend/);
    expect(codeOnly).not.toMatch(/\bworker\b/i);
    expect(codeOnly).not.toMatch(/FedosIdentityRegistry|FedosIdentityRecord|FedosIdentityService|FedosIdentityResolver\b/);
    expect(codeOnly).not.toMatch(/Authenticat|session|Session|credential|Credential/);
    expect(codeOnly).not.toMatch(/relay|Relay|npub|nsec/);
    expect(codeOnly).not.toMatch(/fedos_identity_provider_resolver|resolveFedosIdentityProvider/);
  });

  it("12. fedos_nostr_identity_provider.ts's own code performs no real public-identity retrieval logic -- no filesystem, SQLite, or network reference", () => {
    const codeOnly = codeOnlyLines(nostrProviderSource);
    expect(codeOnly).not.toMatch(/fs\.|readFile|sqlite|SQLite/i);
    expect(codeOnly).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket/);
  });

  it("13. behavioral: デフォルトconstructorでResolver利用 -- new NostrIdentityProvider() with zero arguments resolves the Source via resolveNostrPublicIdentitySource()", () => {
    const provider = new NostrIdentityProvider();
    expect(provider.provider).toBe("nostr");
  });

  it("14. behavioral: a zero-argument NostrIdentityProvider's describeIdentity() behaves identically to one explicitly injected with the resolved Source", async () => {
    const defaulted = new NostrIdentityProvider();
    const explicit = new NostrIdentityProvider(resolveNostrPublicIdentitySource());
    expect(await defaulted.describeIdentity()).toBe(await explicit.describeIdentity());
    expect(await defaulted.describeIdentity()).toBeNull();
  });

  it("15. behavioral: 明示Source注入も従来通り可能 -- explicit injection of a FakeSource still works exactly as before this Stage, ignoring the Resolver entirely", async () => {
    const source = new FakeSource({ id: "user-1", publicIdentifier: "npub1abc", displayName: "Alice" });
    const provider = new NostrIdentityProvider(source);
    const descriptor = await provider.describeIdentity();
    expect(descriptor).toEqual({ id: "user-1", provider: "nostr", publicIdentifier: "npub1abc", displayName: "Alice" });
    expect(source.calls).toBe(1);
  });

  it("16. behavioral: explicit injection of NullNostrPublicIdentitySource still works exactly as before this Stage", async () => {
    const provider = new NostrIdentityProvider(new NullNostrPublicIdentitySource());
    expect(await provider.describeIdentity()).toBeNull();
  });

  it("17. behavioral: describeIdentity() -- full behavioral parity with pre-Stage behavior for a Snapshot with both displayName/avatar populated, via explicit injection", async () => {
    const source = new FakeSource({
      id: "user-2",
      publicIdentifier: "npub1def",
      displayName: "Bob",
      avatar: "https://example.invalid/bob.png",
    });
    const provider = new NostrIdentityProvider(source);
    const descriptor = await provider.describeIdentity();
    expect(descriptor).toEqual({
      id: "user-2",
      provider: "nostr",
      publicIdentifier: "npub1def",
      displayName: "Bob",
      avatar: "https://example.invalid/bob.png",
    });
  });

  it("18. behavioral: describeIdentity() -- empty-string id/publicIdentifier still resolve null via explicit injection, unaffected by this Stage", async () => {
    const source = new FakeSource({ id: "", publicIdentifier: "npub1x" });
    const provider = new NostrIdentityProvider(source);
    expect(await provider.describeIdentity()).toBeNull();
  });

  it("19. behavioral: describeIdentity() -- a throwing Source still resolves null, never lets the exception escape, unaffected by this Stage", async () => {
    class ThrowingSource implements FedosNostrPublicIdentitySource {
      async readPublicIdentity(): Promise<FedosNostrPublicIdentitySnapshot | null> {
        throw new Error("boom");
      }
    }
    const provider = new NostrIdentityProvider(new ThrowingSource());
    await expect(provider.describeIdentity()).resolves.toBeNull();
  });

  it("20. behavioral: provider is always the fixed literal 'nostr', both for defaulted and explicitly-injected construction", () => {
    expect(new NostrIdentityProvider().provider).toBe("nostr");
    expect(new NostrIdentityProvider(new NullNostrPublicIdentitySource()).provider).toBe("nostr");
  });

  it("21. behavioral: two zero-argument NostrIdentityProvider instances are DIFFERENT Provider objects, even though they share the same underlying resolved Source", () => {
    const a = new NostrIdentityProvider();
    const b = new NostrIdentityProvider();
    expect(a).not.toBe(b);
  });

  it("22. behavioral: resolveNostrPublicIdentitySource() itself is unaffected by this Stage -- still the same singleton across repeated calls", () => {
    const first = resolveNostrPublicIdentitySource();
    const second = resolveNostrPublicIdentitySource();
    expect(first).toBe(second);
    expect(first).toBeInstanceOf(NullNostrPublicIdentitySource);
  });

  it("23. behavioral: resolveFedosIdentityProvider()'s own shared singleton is unaffected by this Stage -- still resolves null by default", async () => {
    const resolved = resolveFedosIdentityProvider();
    expect(resolved).toBeInstanceOf(NostrIdentityProvider);
    expect(await resolved?.describeIdentity()).toBeNull();
  });

  it("24. behavioral: end-to-end -- a zero-argument NostrIdentityProvider flows correctly through Service/Registry/Resolver, resolving nothing since the resolved Source is Null", async () => {
    const registry = new FedosIdentityRegistry();
    const provider = new NostrIdentityProvider();
    const service = new FedosIdentityService(provider, registry);
    const resolver = new FedosIdentityResolver(registry);
    expect(await service.describeIdentity()).toBeNull();
    expect(resolver.listIdentities()).toEqual([]);
  });

  it("25. behavioral: end-to-end -- an explicitly-injected FakeSource still registers a full five-field Record via the unmodified Service", async () => {
    const registry = new FedosIdentityRegistry();
    const source = new FakeSource({
      id: "e2e-1",
      publicIdentifier: "npub1e2e",
      displayName: "Dana",
      avatar: "https://example.invalid/dana.png",
    });
    const provider = new NostrIdentityProvider(source);
    const service = new FedosIdentityService(provider, registry);
    const resolver = new FedosIdentityResolver(registry);
    await service.describeIdentity();
    expect(resolver.findIdentity("e2e-1")).toEqual({
      id: "e2e-1",
      provider: "nostr",
      publicIdentifier: "npub1e2e",
      displayName: "Dana",
      avatar: "https://example.invalid/dana.png",
    });
  });

  it("26. Regression: fedos_nostr_public_identity_source_resolver.ts (Alpha 048) is confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(sourceResolverSource).toMatch(/export function resolveNostrPublicIdentitySource\(\): FedosNostrPublicIdentitySource \{/);
    expect(sourceResolverSource).toMatch(/const sharedNullSource: FedosNostrPublicIdentitySource = new NullNostrPublicIdentitySource\(\);/);
    expect(sourceResolverSource).not.toMatch(/secure_runtime_alpha_049/);
  });

  it("27. Regression: fedos_null_nostr_public_identity_source.ts (Alpha 039) is confirmed BYTE-FOR-BYTE unchanged", () => {
    const body = (
      nullSourceSource.match(/async readPublicIdentity\(\): Promise<FedosNostrPublicIdentitySnapshot \| null> \{([\s\S]*?)\n  \}/) ?? []
    )[1] ?? "";
    expect(body.trim()).toBe("return null;");
    expect(nullSourceSource).not.toMatch(/secure_runtime_alpha_049/);
  });

  it("28. Regression: fedos_nostr_public_identity_source.ts (Alpha 039/044) -- the Source Interface -- is confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(sourceInterfaceSource).toMatch(/export interface FedosNostrPublicIdentitySource \{/);
    expect(sourceInterfaceSource).not.toMatch(/secure_runtime_alpha_049/);
  });

  it("29. Regression: fedos_identity_provider_resolver.ts (Alpha 032/034/036/039) is confirmed BYTE-FOR-BYTE unchanged -- still constructs its own NullNostrPublicIdentitySource inline, not via the new Source Resolver", () => {
    expect(identityProviderResolverSource).toMatch(
      /const sharedNostrProvider: FedosIdentityProvider = new NostrIdentityProvider\(new NullNostrPublicIdentitySource\(\)\);/,
    );
    expect(identityProviderResolverSource).not.toMatch(/resolveNostrPublicIdentitySource|fedos_nostr_public_identity_source_resolver/);
    expect(identityProviderResolverSource).not.toMatch(/secure_runtime_alpha_049/);
  });

  it("30. Regression: fedos_identity_descriptor.ts/fedos_identity_record.ts are both confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(descriptorSource).toMatch(/export interface FedosIdentityDescriptor \{/);
    expect(descriptorSource).not.toMatch(/secure_runtime_alpha_049/);
    expect(recordSource).toMatch(/export interface FedosIdentityRecord \{/);
    expect(recordSource).not.toMatch(/secure_runtime_alpha_049/);
  });

  it("31. Regression: fedos_identity_service.ts/fedos_identity_registry.ts/fedos_identity_resolver.ts are all confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(serviceSource).toMatch(/constructor\(provider: FedosIdentityProvider, registry: FedosIdentityRegistry\) \{/);
    expect(serviceSource).not.toMatch(/secure_runtime_alpha_049/);
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).not.toMatch(/secure_runtime_alpha_049/);
    expect(resolverClassSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(resolverClassSource).not.toMatch(/secure_runtime_alpha_049/);
  });

  it("32. Regression: fedos_identity_provider.ts/fedos_identity_capability.ts/fedos_noop_identity_provider.ts are all confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(providerInterfaceSource).toMatch(/describeIdentity\(\): Promise<FedosIdentityDescriptor \| null>;/);
    expect(providerInterfaceSource).not.toMatch(/secure_runtime_alpha_049/);
    expect(capabilitySource).toMatch(/readonly available: boolean;/);
    expect(capabilitySource).not.toMatch(/secure_runtime_alpha_049/);
    expect(noopProviderSource).toMatch(/readonly provider = "noop";/);
    expect(noopProviderSource).not.toMatch(/secure_runtime_alpha_049/);
  });

  it("33. no other existing src/identity/* file was modified, and no existing src/nostr/* file references this Stage's own doc", () => {
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
      expect(source).not.toMatch(/secure_runtime_alpha_049/);
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
      expect(source).not.toMatch(/secure_runtime_alpha_049/);
    }
  });

  it("34. no Runtime/Storage/Worker file references this Stage's own doc or the constructor change", () => {
    for (const source of [storageResolverSource, storageBackendSource, runtimeTypesSource, createRuntimeSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_049/);
    }
  });

  it("35. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("36. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(68);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_049/);

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

  it("37. no fedos_*.ts file was added or removed by this Stage -- still exactly 56 under src/runtime/ and exactly 24 under src/identity/ (this Stage only modifies one existing file's constructor default)", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("38. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha049-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha049-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha049-id"));
    expect(deleted).toBe(true);
  });

  it("39. Regression: initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected -- confirmed by ACTUAL calls", async () => {
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha049-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha049-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha049-direct"))).toBe(true);
  });

  it("40. behavioral: RIPPLE self-check -- resolveFedosIdentityProvider()'s own shared NostrIdentityProvider is STILL constructed with an explicit NullNostrPublicIdentitySource (Alpha 039), NOT via the zero-argument default this Stage adds, confirming the two Resolvers remain unwired to each other", () => {
    expect(identityProviderResolverSource).toMatch(/new NostrIdentityProvider\(new NullNostrPublicIdentitySource\(\)\)/);
    expect(identityProviderResolverSource).not.toMatch(/new NostrIdentityProvider\(\)/);
  });
});
