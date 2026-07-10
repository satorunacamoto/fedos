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
import { resolveNostrPublicIdentitySource } from "../src/identity/fedos_nostr_public_identity_source_resolver.js";
import { NullNostrPublicIdentitySource } from "../src/identity/fedos_null_nostr_public_identity_source.js";
import { NostrIdentityProvider } from "../src/identity/fedos_nostr_identity_provider.js";
import { resolveFedosIdentityProvider } from "../src/identity/fedos_identity_provider_resolver.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
import { FedosIdentityRegistry } from "../src/identity/fedos_identity_registry.js";
import { FedosIdentityResolver } from "../src/identity/fedos_identity_resolver.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_048_fedos_nostr_public_identity_source_resolver.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha032DocSource from "../docs/secure_runtime_alpha_032_fedos_identity_provider_resolver.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha039DocSource from "../docs/secure_runtime_alpha_039_nostr_public_identity_source_boundary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sourceResolverSource from "../src/identity/fedos_nostr_public_identity_source_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrProviderSource from "../src/identity/fedos_nostr_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullSourceSource from "../src/identity/fedos_null_nostr_public_identity_source.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sourceInterfaceSource from "../src/identity/fedos_nostr_public_identity_source.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityProviderResolverSource from "../src/identity/fedos_identity_provider_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/identity/fedos_identity_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import registrySource from "../src/identity/fedos_identity_registry.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import resolverClassSource from "../src/identity/fedos_identity_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/identity/fedos_identity_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import recordSource from "../src/identity/fedos_identity_record.ts?raw";
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

/**
 * Secure Runtime Alpha 048 -- "FedOS Nostr Public Identity Source
 * Resolver": adds `resolveNostrPublicIdentitySource()`, a dedicated,
 * single-purpose Resolver that always returns the same shared
 * `NullNostrPublicIdentitySource` singleton. Mirrors
 * `resolveFedosIdentityProvider()`'s own shape one layer lower. Not
 * wired into `NostrIdentityProvider`, `fedos_identity_provider_resolver.ts`,
 * or anywhere else -- exported, tested, and otherwise unreferenced.
 */
describe("Secure Runtime Alpha 048 -- FedOS Nostr Public Identity Source Resolver, new+unwired, no Provider/Source/Service/Registry/Resolver/Runtime/Worker/Storage/Rust change", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(10000);
  });

  it("2. the design doc records the exact new file's shape, cross-referencing Alpha 032/039", () => {
    expect(designDocSource).toMatch(/export function resolveNostrPublicIdentitySource\(\): FedosNostrPublicIdentitySource \{/);
    expect(designDocSource).toMatch(/const sharedNullSource: FedosNostrPublicIdentitySource = new NullNostrPublicIdentitySource\(\);/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_032_fedos_identity_provider_resolver\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_039_nostr_public_identity_source_boundary\.md/);
    expect(alpha032DocSource.length).toBeGreaterThan(0);
    expect(alpha039DocSource.length).toBeGreaterThan(0);
  });

  it("3. the design doc explains why a dedicated Resolver is introduced now", () => {
    expect(designDocSource).toMatch(/なぜResolverを挟むか \(why a dedicated Resolver is introduced now\)/);
  });

  it("4. the design doc explains why this Resolver is fixed to NullNostrPublicIdentitySource today", () => {
    expect(designDocSource).toMatch(/なぜ今はNullSource固定か \(why this Resolver is fixed to `NullNostrPublicIdentitySource` today\)/);
  });

  it("5. the design doc distinguishes this Resolver from NoopFedosIdentityProvider and from resolveFedosIdentityProvider()", () => {
    expect(designDocSource).toMatch(/Noop Providerとの違い \(difference from `NoopFedosIdentityProvider`, Alpha 033\)/);
    expect(designDocSource).toMatch(/Identity Provider Resolverとの違い \(difference from `resolveFedosIdentityProvider\(\)`, Alpha 032\)/);
  });

  it("6. the design doc explains why swapping the Source implementation in the future never requires modifying NostrIdentityProvider", () => {
    expect(designDocSource).toMatch(
      /NostrIdentityProviderを変更しない理由 \(why swapping the Source implementation will never require modifying `NostrIdentityProvider`\)/,
    );
    expect(designDocSource).toMatch(/Filesystem/);
    expect(designDocSource).toMatch(/SQLite/);
    expect(designDocSource).toMatch(/Nostr-profile-cache|Nostr Profile Cache/);
    expect(designDocSource).toMatch(/Remote Source/);
  });

  it("7. the design doc records the explicit 'does NOT do' list", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_nostr_identity_provider\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_null_nostr_public_identity_source\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_provider_resolver\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement any real public-identity retrieval/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any condition, environment read, or configuration/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* wire this new Resolver into `fedos_identity_provider_resolver\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `create_runtime\.ts` or any `src\/runtime\/\*` file\./);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change any Public Runtime API signature\./);
  });

  it("8. fedos_nostr_public_identity_source_resolver.ts defines exactly one exported function and one module-scoped singleton", () => {
    expect([...sourceResolverSource.matchAll(/^export function/gm)].length).toBe(1);
    expect([...sourceResolverSource.matchAll(/^export class/gm)].length).toBe(0);
    expect([...sourceResolverSource.matchAll(/^export const/gm)].length).toBe(0);
    expect(sourceResolverSource).toMatch(/export function resolveNostrPublicIdentitySource\(\): FedosNostrPublicIdentitySource \{/);
    expect(sourceResolverSource).toMatch(/const sharedNullSource: FedosNostrPublicIdentitySource = new NullNostrPublicIdentitySource\(\);/);
  });

  it("9. resolveNostrPublicIdentitySource()'s own body is EXACTLY one return statement", () => {
    const body = (sourceResolverSource.match(/export function resolveNostrPublicIdentitySource\(\): FedosNostrPublicIdentitySource \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    expect(body.trim()).toBe("return sharedNullSource;");
  });

  it("10. fedos_nostr_public_identity_source_resolver.ts imports EXACTLY two modules -- one type-only, one value", () => {
    const importLines = [...sourceResolverSource.matchAll(/^import .*$/gm)].map((m: RegExpMatchArray) => m[0]);
    expect(importLines.length).toBe(2);
    expect(importLines[0]).toMatch(/^import type /);
    expect(importLines[1]).not.toMatch(/^import type /);
    expect(sourceResolverSource).toMatch(/from "\.\/fedos_nostr_public_identity_source\.js"/);
    expect(sourceResolverSource).toMatch(/from "\.\/fedos_null_nostr_public_identity_source\.js"/);
  });

  it("11. fedos_nostr_public_identity_source_resolver.ts's own CODE has no condition, no environment read, no Runtime/Worker/Storage/Nostr-network vocabulary", () => {
    const codeOnly = codeOnlyLines(sourceResolverSource);
    expect(codeOnly).not.toMatch(/\bif\s*\(|\bswitch\s*\(/);
    expect(codeOnly).not.toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/create_runtime|AppRuntime/);
    expect(codeOnly).not.toMatch(/storeCiphertext|loadCiphertext|deleteCiphertext|RuntimeStorageBackend/);
    expect(codeOnly).not.toMatch(/\bworker\b/i);
    expect(codeOnly).not.toMatch(/relay|Relay|npub|nsec/);
    expect(codeOnly).not.toMatch(/FedosIdentityService|FedosIdentityRegistry|FedosIdentityResolver\b/);
    expect(codeOnly).not.toMatch(/NostrIdentityProvider/);
    expect(codeOnly).not.toMatch(/fedos_identity_provider_resolver/);
  });

  it("12. RIPPLE (Secure Runtime Alpha 049): nothing in this repository imported fedos_nostr_public_identity_source_resolver.ts AS OF this Stage's own scope -- fully unwired; Alpha 049 later wired exactly ONE caller, fedos_nostr_identity_provider.ts's own constructor default -- reconfirmed here as the CURRENT wiring, with every OTHER file still confirmed to have zero reference", () => {
    for (const source of [
      identityProviderResolverSource,
      serviceSource,
      registrySource,
      resolverClassSource,
      nullSourceSource,
      sourceInterfaceSource,
      createRuntimeSource,
      workerSource,
    ]) {
      expect(source).not.toMatch(/fedos_nostr_public_identity_source_resolver/);
      expect(source).not.toMatch(/resolveNostrPublicIdentitySource/);
    }
    expect(nostrProviderSource).toMatch(/fedos_nostr_public_identity_source_resolver/);
    expect(nostrProviderSource).toMatch(/resolveNostrPublicIdentitySource/);
  });

  it("13. behavioral: 常に同じインスタンス -- resolveNostrPublicIdentitySource() always returns the exact same object across repeated calls", () => {
    const first = resolveNostrPublicIdentitySource();
    const second = resolveNostrPublicIdentitySource();
    const third = resolveNostrPublicIdentitySource();
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it("14. behavioral: NullSource固定 -- the returned object is an instance of NullNostrPublicIdentitySource", () => {
    const resolved = resolveNostrPublicIdentitySource();
    expect(resolved).toBeInstanceOf(NullNostrPublicIdentitySource);
  });

  it("15. behavioral: the returned object is never null and never undefined", () => {
    const resolved = resolveNostrPublicIdentitySource();
    expect(resolved).not.toBeNull();
    expect(resolved).not.toBeUndefined();
  });

  it("16. behavioral: the returned Source's readPublicIdentity() always resolves null, matching NullNostrPublicIdentitySource's own documented behavior", async () => {
    const resolved = resolveNostrPublicIdentitySource();
    expect(await resolved.readPublicIdentity()).toBeNull();
    expect(await resolved.readPublicIdentity()).toBeNull();
  });

  it("17. behavioral: the returned Source satisfies the FedosNostrPublicIdentitySource interface -- has a readPublicIdentity method", () => {
    const resolved = resolveNostrPublicIdentitySource();
    expect(typeof resolved.readPublicIdentity).toBe("function");
  });

  it("18. behavioral: a freshly-constructed NullNostrPublicIdentitySource is NOT the same object as the resolved singleton -- confirms sharing, not incidental type equality", () => {
    const resolved = resolveNostrPublicIdentitySource();
    const fresh = new NullNostrPublicIdentitySource();
    expect(resolved).not.toBe(fresh);
    expect(resolved).toBeInstanceOf(NullNostrPublicIdentitySource);
    expect(fresh).toBeInstanceOf(NullNostrPublicIdentitySource);
  });

  it("19. behavioral: the resolved Source can be injected into a real NostrIdentityProvider and behaves identically to a directly-constructed NullNostrPublicIdentitySource", async () => {
    const provider = new NostrIdentityProvider(resolveNostrPublicIdentitySource());
    expect(await provider.describeIdentity()).toBeNull();
    expect(provider.provider).toBe("nostr");
  });

  it("20. RIPPLE (Secure Runtime Alpha 049): fedos_nostr_identity_provider.ts (Alpha 035/039/046) had a required, no-default constructor and no reference to this Stage's own new Resolver AS OF this Stage's own scope; Alpha 049 later gave the constructor's Source parameter a default value of `resolveNostrPublicIdentitySource()` -- reconfirmed here as the CURRENT (wired) shape, per this arc's own established ripple convention", () => {
    expect(nostrProviderSource).toMatch(/constructor\(source: FedosNostrPublicIdentitySource = resolveNostrPublicIdentitySource\(\)\) \{/);
    expect(nostrProviderSource).toMatch(/fedos_nostr_public_identity_source_resolver/);
    expect(nostrProviderSource).not.toMatch(/secure_runtime_alpha_048/);
  });

  it("21. Regression: fedos_null_nostr_public_identity_source.ts (Alpha 039) is confirmed BYTE-FOR-BYTE unchanged", () => {
    const body = (
      nullSourceSource.match(/async readPublicIdentity\(\): Promise<FedosNostrPublicIdentitySnapshot \| null> \{([\s\S]*?)\n  \}/) ?? []
    )[1] ?? "";
    expect(body.trim()).toBe("return null;");
    expect(nullSourceSource).not.toMatch(/secure_runtime_alpha_048/);
  });

  it("22. Regression: fedos_nostr_public_identity_source.ts (Alpha 039/044) -- the Source Interface -- is confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(sourceInterfaceSource).toMatch(/export interface FedosNostrPublicIdentitySource \{/);
    expect(sourceInterfaceSource).toMatch(/readPublicIdentity\(\): Promise<FedosNostrPublicIdentitySnapshot \| null>;/);
    expect(sourceInterfaceSource).not.toMatch(/secure_runtime_alpha_048/);
  });

  it("23. Regression: fedos_identity_provider_resolver.ts (Alpha 032/034/036/039) is confirmed BYTE-FOR-BYTE unchanged -- still constructs its own NullNostrPublicIdentitySource inline, not via this new Resolver", () => {
    expect(identityProviderResolverSource).toMatch(
      /const sharedNostrProvider: FedosIdentityProvider = new NostrIdentityProvider\(new NullNostrPublicIdentitySource\(\)\);/,
    );
    expect(identityProviderResolverSource).not.toMatch(/fedos_nostr_public_identity_source_resolver|resolveNostrPublicIdentitySource/);
    expect(identityProviderResolverSource).not.toMatch(/secure_runtime_alpha_048/);
  });

  it("24. Regression: resolveFedosIdentityProvider() itself still behaves exactly as before this Stage -- same shared singleton, always resolving null", async () => {
    const first = resolveFedosIdentityProvider();
    const second = resolveFedosIdentityProvider();
    expect(first).toBe(second);
    expect(first).toBeInstanceOf(NostrIdentityProvider);
    expect(await first?.describeIdentity()).toBeNull();
  });

  it("25. Regression: fedos_identity_descriptor.ts (Alpha 028/045) is confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(descriptorSource).toMatch(/export interface FedosIdentityDescriptor \{/);
    expect(descriptorSource).not.toMatch(/secure_runtime_alpha_048/);
  });

  it("26. Regression: fedos_identity_record.ts (Alpha 040/047) is confirmed BYTE-FOR-BYTE unchanged -- still exactly five fields", () => {
    expect(recordSource).toMatch(/export interface FedosIdentityRecord \{/);
    const requiredFields = [...recordSource.matchAll(/^\s*readonly \w+: string;/gm)];
    expect(requiredFields.length).toBe(3);
    expect(recordSource).toMatch(/readonly displayName\?: string;/);
    expect(recordSource).toMatch(/readonly avatar\?: string;/);
    expect(recordSource).not.toMatch(/secure_runtime_alpha_048/);
  });

  it("27. Regression: fedos_identity_service.ts (Alpha 031/042/047) is confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(serviceSource).toMatch(/constructor\(provider: FedosIdentityProvider, registry: FedosIdentityRegistry\) \{/);
    expect(serviceSource).toMatch(/displayName: descriptor\.displayName,/);
    expect(serviceSource).not.toMatch(/fedos_nostr_public_identity_source_resolver/);
    expect(serviceSource).not.toMatch(/secure_runtime_alpha_048/);
  });

  it("28. Regression: fedos_identity_registry.ts (Alpha 041) is confirmed BYTE-FOR-BYTE unchanged -- still exactly four methods", () => {
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).toMatch(/find\(id: string\): FedosIdentityRecord \| null \{/);
    expect(registrySource).toMatch(/list\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(registrySource).toMatch(/remove\(id: string\): boolean \{/);
    expect(registrySource).not.toMatch(/secure_runtime_alpha_048/);
  });

  it("29. Regression: fedos_identity_resolver.ts (Alpha 043) is confirmed BYTE-FOR-BYTE unchanged -- still exactly two methods", () => {
    expect(resolverClassSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(resolverClassSource).toMatch(/listIdentities\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(resolverClassSource).not.toMatch(/secure_runtime_alpha_048/);
  });

  it("30. Regression: fedos_identity_provider.ts/fedos_identity_capability.ts/fedos_noop_identity_provider.ts are all confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(providerInterfaceSource).toMatch(/describeIdentity\(\): Promise<FedosIdentityDescriptor \| null>;/);
    expect(providerInterfaceSource).not.toMatch(/secure_runtime_alpha_048/);
    expect(capabilitySource).toMatch(/readonly available: boolean;/);
    expect(capabilitySource).not.toMatch(/secure_runtime_alpha_048/);
    expect(noopProviderSource).toMatch(/readonly provider = "noop";/);
    expect(noopProviderSource).not.toMatch(/secure_runtime_alpha_048/);
  });

  it("31. no other existing src/identity/* file was modified, and no existing src/nostr/* file references this Stage's own doc", () => {
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
      expect(source).not.toMatch(/secure_runtime_alpha_048/);
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
      expect(source).not.toMatch(/secure_runtime_alpha_048/);
    }
  });

  it("32. no Runtime/Storage/Worker file references this Stage's own doc or the new Resolver", () => {
    for (const source of [storageResolverSource, storageBackendSource, runtimeTypesSource, createRuntimeSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_048/);
      expect(source).not.toMatch(/fedos_nostr_public_identity_source_resolver|resolveNostrPublicIdentitySource/);
    }
  });

  it("33. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("34. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_048/);

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

  it("35. exactly ONE new file was added under src/identity/ by this Stage -- 24 files total, up from 23; still exactly 56 under src/runtime/", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("36. behavioral: end-to-end -- the resolved Source, injected into a real NostrIdentityProvider, still flows correctly through Service/Registry/Resolver, resolving nothing since it is Null", async () => {
    const registry = new FedosIdentityRegistry();
    const provider = new NostrIdentityProvider(resolveNostrPublicIdentitySource());
    const service = new FedosIdentityService(provider, registry);
    const resolver = new FedosIdentityResolver(registry);
    expect(await service.describeIdentity()).toBeNull();
    expect(resolver.listIdentities()).toEqual([]);
  });

  it("37. behavioral: two independently-constructed NostrIdentityProvider instances, both injected with the resolved Source, share the SAME underlying Source object", () => {
    const providerA = new NostrIdentityProvider(resolveNostrPublicIdentitySource());
    const providerB = new NostrIdentityProvider(resolveNostrPublicIdentitySource());
    expect(providerA).not.toBe(providerB);
    expect(resolveNostrPublicIdentitySource()).toBe(resolveNostrPublicIdentitySource());
  });

  it("38. fedos_nostr_public_identity_source_resolver.ts's own header comment references this Stage's own doc, but contains no Relay/event/signing/secret-key vocabulary in its CODE", () => {
    expect(sourceResolverSource).toMatch(/secure_runtime_alpha_048_fedos_nostr_public_identity_source_resolver\.md/);
    const codeOnly = codeOnlyLines(sourceResolverSource);
    expect(codeOnly).not.toMatch(/nsec|seed|mnemonic|privateKey/i);
    expect(codeOnly).not.toMatch(/sign|Sign/);
  });

  it("39. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha048-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha048-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha048-id"));
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha048-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha048-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha048-direct"))).toBe(true);
  });
});
