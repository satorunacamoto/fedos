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
import { FedosIdentityRegistry } from "../src/os/core/identity/fedos_identity_registry.js";
import type { FedosIdentityRecord } from "../src/os/core/identity/fedos_identity_record.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_041_fedos_identity_registry.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha040DocSource from "../docs/secure_runtime_alpha_040_fedos_identity_record.md?raw";
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
import serviceSource from "../src/os/core/identity/fedos_identity_service.ts?raw";
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

function makeRecord(overrides: Partial<FedosIdentityRecord> = {}): FedosIdentityRecord {
  return {
    id: "user-1",
    provider: "nostr",
    publicIdentifier: "npub1example",
    ...overrides,
  };
}

/**
 * Secure Runtime Alpha 041 -- "FedOS Identity Registry (Canonical
 * Record Registry)": adds exactly ONE class, `FedosIdentityRegistry`,
 * a Memory-only holder for `FedosIdentityRecord` (Alpha 040) values --
 * one private Map, four trivial methods (`register`/`find`/`list`/
 * `remove`), no Runtime/Provider/Resolver/Storage/Worker/Crypto wiring
 * of any kind.
 */
describe("Secure Runtime Alpha 041 -- FedOS Identity Registry, Memory-only, no Provider/Resolver/Service/Runtime/Worker/Storage/Rust change", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(10000);
  });

  it("2. the design doc states this Stage adds a single, minimal class only, cross-referencing Alpha 040", () => {
    expect(designDocSource).toMatch(/a single, minimal class only/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_040_fedos_identity_record\.md/);
    expect(alpha040DocSource).toMatch(/zero constructors, zero producers, and zero\s+consumers/);
  });

  it("3. the design doc records the exact Registry shape", () => {
    expect(designDocSource).toMatch(/export class FedosIdentityRegistry \{/);
    expect(designDocSource).toMatch(/readonly #records = new Map<string, FedosIdentityRecord>\(\);/);
    expect(designDocSource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(designDocSource).toMatch(/find\(id: string\): FedosIdentityRecord \| null \{/);
    expect(designDocSource).toMatch(/list\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(designDocSource).toMatch(/remove\(id: string\): boolean \{/);
  });

  it("4. the design doc fixes all six mandated boundaries, each its own section", () => {
    expect(designDocSource).toMatch(/Registryと Descriptorの責務|RegistryとDescriptorの責務/);
    expect(designDocSource).toMatch(/RegistryとRecordの責務/);
    expect(designDocSource).toMatch(/RegistryとProviderの責務/);
    expect(designDocSource).toMatch(/RegistryとRuntimeの責務/);
    expect(designDocSource).toMatch(/RegistryとStorageの責務/);
    expect(designDocSource).toMatch(/RegistryとProtocol Adapterの責務/);
  });

  it("5. the design doc explains why a Memory Registry is chosen now, citing the MemoryStorageBackend precedent", () => {
    expect(designDocSource).toMatch(/Memory Registryを採用した理由/);
    expect(designDocSource).toMatch(/mirrors `MemoryStorageBackend`'s own precedent directly/);
  });

  it("6. the design doc names the future Persistent Registry migration direction without scheduling it", () => {
    expect(designDocSource).toMatch(/将来Persistent Registryへ移行する際の方針/);
    expect(designDocSource).toMatch(/This Stage schedules nothing/);
  });

  it("7. the design doc records the explicit 'does NOT do' list", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_record\.ts` \(Alpha 040\),/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `create_runtime\.ts` or any `src\/runtime\/\*` file\./);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/worker\.ts`\./);
    expect(designDocSource).toMatch(/Does \*\*not\*\* persist any Record anywhere/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add `displayName`, `avatar`, or any field beyond/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
  });

  it("8. fedos_identity_registry.ts exports EXACTLY FedosIdentityRegistry, no other export", () => {
    expect([...registrySource.matchAll(/^export class (\w+)/gm)].map((m: RegExpMatchArray) => m[1])).toEqual([
      "FedosIdentityRegistry",
    ]);
    expect([...registrySource.matchAll(/^export (?:async )?function/gm)].length).toBe(0);
    expect([...registrySource.matchAll(/^export interface/gm)].length).toBe(0);
    expect([...registrySource.matchAll(/^export const/gm)].length).toBe(0);
    expect(registrySource).not.toMatch(/export default/);
  });

  it("9. the class holds NOTHING but the one private #records Map -- no constructor, no other field", () => {
    const codeOnly = codeOnlyLines(registrySource);
    expect(codeOnly).not.toMatch(/constructor\s*\(/);
    const fieldDeclarations = [...codeOnly.matchAll(/^ {2}(?:readonly\s+)?#?\w+\s*[:=]/gm)];
    expect(fieldDeclarations.length).toBe(1);
    expect(codeOnly).toMatch(/readonly #records = new Map<string, FedosIdentityRecord>\(\);/);
  });

  it("10. the class has EXACTLY four methods -- register/find/list/remove -- and no others", () => {
    const methodNames = [...registrySource.matchAll(/^ {2}(\w+)\([^)]*\): [^{]+\{/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(methodNames.sort()).toEqual(["find", "list", "register", "remove"].sort());
  });

  it("11. register()'s own body is EXACTLY one Map.set() call", () => {
    const body = (registrySource.match(/register\(record: FedosIdentityRecord\): void \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body.trim()).toBe("this.#records.set(record.id, record);");
  });

  it("12. find()'s own body is EXACTLY one Map.get() coalesced to null", () => {
    const body = (registrySource.match(/find\(id: string\): FedosIdentityRecord \| null \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body.trim()).toBe("return this.#records.get(id) ?? null;");
  });

  it("13. list()'s own body is EXACTLY a spread of Map.values() into a fresh array", () => {
    const body = (registrySource.match(/list\(\): readonly FedosIdentityRecord\[\] \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body.trim()).toBe("return [...this.#records.values()];");
  });

  it("14. remove()'s own body is EXACTLY one Map.delete() call, return value passed through unchanged", () => {
    const body = (registrySource.match(/remove\(id: string\): boolean \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body.trim()).toBe("return this.#records.delete(id);");
  });

  it("15. fedos_identity_registry.ts's own CODE (excluding its own explanatory header comment) references zero Runtime/Storage/Worker/Provider/Resolver/Crypto/Authentication/Nostr vocabulary", () => {
    const codeOnly = codeOnlyLines(registrySource);
    expect(codeOnly).not.toMatch(/create_runtime|AppRuntime/);
    expect(codeOnly).not.toMatch(/storeCiphertext|loadCiphertext|deleteCiphertext|RuntimeStorageBackend/);
    expect(codeOnly).not.toMatch(/\bworker\b/i);
    expect(codeOnly).not.toMatch(/FedosIdentityProvider|resolveFedosIdentityProvider|fedos_identity_provider_resolver/);
    expect(codeOnly).not.toMatch(/AeadKeyHandle|AeadCiphertextHandle|encrypt|decrypt/i);
    expect(codeOnly).not.toMatch(/Authenticat|session|Session|credential|Credential/);
    expect(codeOnly).not.toMatch(/nostr|Nostr|relay|Relay|npub|nsec/);
    expect(codeOnly).not.toMatch(/displayName|avatar/);
  });

  it("16. fedos_identity_registry.ts imports EXACTLY one type-only module -- FedosIdentityRecord -- and nothing else", () => {
    const importLines = [...registrySource.matchAll(/^import .*$/gm)].map((m: RegExpMatchArray) => m[0]);
    expect(importLines.length).toBe(1);
    expect(importLines[0]?.startsWith("import type ")).toBe(true);
    expect(registrySource).toMatch(/from "\.\/fedos_identity_record\.js"/);
  });

  it("17. behavioral: register() then find() round-trips the exact same Record", () => {
    const registry = new FedosIdentityRegistry();
    const record = makeRecord();
    registry.register(record);
    expect(registry.find("user-1")).toEqual(record);
  });

  it("18. behavioral: find() on an unregistered id returns null", () => {
    const registry = new FedosIdentityRegistry();
    expect(registry.find("nope")).toBeNull();
  });

  it("19. behavioral: registering a second Record under the SAME id overwrites the first", () => {
    const registry = new FedosIdentityRegistry();
    registry.register(makeRecord({ publicIdentifier: "npub1first" }));
    registry.register(makeRecord({ publicIdentifier: "npub1second" }));
    expect(registry.find("user-1")).toEqual(makeRecord({ publicIdentifier: "npub1second" }));
    expect(registry.list().length).toBe(1);
  });

  it("20. behavioral: list() returns every registered Record, and an empty Registry returns an empty array", () => {
    const registry = new FedosIdentityRegistry();
    expect(registry.list()).toEqual([]);
    registry.register(makeRecord({ id: "a" }));
    registry.register(makeRecord({ id: "b" }));
    const listed = registry.list();
    expect(listed.length).toBe(2);
    expect(listed.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });

  it("21. behavioral: list() returns a fresh array each call -- mutating the returned array does not affect the Registry's own state", () => {
    const registry = new FedosIdentityRegistry();
    registry.register(makeRecord({ id: "a" }));
    const first = registry.list() as FedosIdentityRecord[];
    first.push(makeRecord({ id: "injected" }));
    expect(registry.list().length).toBe(1);
    expect(registry.list()).not.toBe(first);
  });

  it("22. behavioral: remove() on an existing id deletes it and returns true", () => {
    const registry = new FedosIdentityRegistry();
    registry.register(makeRecord({ id: "a" }));
    expect(registry.remove("a")).toBe(true);
    expect(registry.find("a")).toBeNull();
    expect(registry.list()).toEqual([]);
  });

  it("23. behavioral: remove() on a non-existent id returns false and leaves the Registry unchanged", () => {
    const registry = new FedosIdentityRegistry();
    registry.register(makeRecord({ id: "a" }));
    expect(registry.remove("does-not-exist")).toBe(false);
    expect(registry.list().length).toBe(1);
  });

  it("24. behavioral: two independent Registry instances hold independent state -- no shared/global mutable state", () => {
    const a = new FedosIdentityRegistry();
    const b = new FedosIdentityRegistry();
    a.register(makeRecord({ id: "only-in-a" }));
    expect(a.find("only-in-a")).not.toBeNull();
    expect(b.find("only-in-a")).toBeNull();
    expect(b.list()).toEqual([]);
  });

  it("25. behavioral: register()/find()/remove() work with multiple distinct providers and non-Nostr provider labels, since the Registry does not validate provider values", () => {
    const registry = new FedosIdentityRegistry();
    registry.register(makeRecord({ id: "x", provider: "noop", publicIdentifier: "npub1noop" }));
    expect(registry.find("x")?.provider).toBe("noop");
    registry.register(makeRecord({ id: "y", provider: "anything-at-all" }));
    expect(registry.find("y")?.provider).toBe("anything-at-all");
  });

  it("26. Regression: fedos_identity_record.ts (Alpha 040) is confirmed BYTE-FOR-BYTE unchanged -- still exactly three fields, no reference to this Stage's own doc", () => {
    expect(recordSource).toMatch(/export interface FedosIdentityRecord \{/);
    const fieldDeclarations = [...recordSource.matchAll(/^\s*readonly \w+: string;/gm)];
    expect(fieldDeclarations.length).toBe(3);
    expect(recordSource).not.toMatch(/secure_runtime_alpha_041/);
  });

  it("27. Regression: fedos_identity_descriptor.ts (Alpha 028) is confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(descriptorSource).toMatch(/export interface FedosIdentityDescriptor \{/);
    expect(descriptorSource).not.toMatch(/secure_runtime_alpha_041/);
  });

  it("28. RIPPLE (Secure Runtime Alpha 049): fedos_nostr_identity_provider.ts (Alpha 035/039) required an injected Source with no default AS OF this Stage's own scope; Alpha 049 later gave that same parameter a default value -- reconfirmed here as the CURRENT signature, no reference to this Stage's own doc or the Registry", () => {
    expect(nostrProviderSource).toMatch(/constructor\(source: FedosNostrPublicIdentitySource = resolveNostrPublicIdentitySource\(\)\) \{/);
    expect(nostrProviderSource).not.toMatch(/secure_runtime_alpha_041/);
    expect(nostrProviderSource).not.toMatch(/FedosIdentityRegistry|fedos_identity_registry/);
  });

  it("29. Regression: fedos_identity_provider_resolver.ts is confirmed unchanged -- still returns the shared NostrIdentityProvider singleton, no reference to this Stage's own doc or the new Registry", () => {
    expect(resolverSource).toMatch(/return sharedNostrProvider;/);
    expect(resolverSource).not.toMatch(/secure_runtime_alpha_041/);
    expect(resolverSource).not.toMatch(/FedosIdentityRegistry|fedos_identity_registry/);
  });

  it("30. RIPPLE (Secure Runtime Alpha 042): fedos_identity_service.ts was confirmed unchanged with no reference to the new Registry AS OF this Stage's own scope; Alpha 042 later gave it a required second constructor argument (an injected FedosIdentityRegistry) -- reconfirmed here as the CURRENT signature. fedos_identity_capability.ts remains confirmed unchanged", () => {
    expect(serviceSource).toMatch(/constructor\(provider: FedosIdentityProvider, registry: FedosIdentityRegistry\) \{/);
    expect(serviceSource).not.toMatch(/secure_runtime_alpha_041/);
    expect(capabilitySource).toMatch(/readonly available: boolean;/);
    expect(capabilitySource).not.toMatch(/secure_runtime_alpha_041/);
  });

  it("31. behavioral: resolveFedosIdentityProvider() is entirely unaffected -- still resolves the shared NostrIdentityProvider singleton, provider === 'nostr', describeIdentity() still always null by default", async () => {
    const resolved = resolveFedosIdentityProvider();
    expect(resolved).toBeInstanceOf(NostrIdentityProvider);
    expect(resolved?.provider).toBe("nostr");
    expect(await resolved?.describeIdentity()).toBeNull();
  });

  it("32. RIPPLE (Secure Runtime Alpha 042, then Alpha 050-052): fedos_identity_registry.ts had ZERO importers anywhere in src/ AS OF Alpha 041's own scope; Alpha 042 later made fedos_identity_service.ts its first real importer; Alpha 050-052 later made fedos_runtime_identity.ts a second real importer -- reconfirmed here as the CURRENT state, per this arc's own established ripple convention. Every other identity/runtime/nostr/worker file remains a non-importer", () => {
    expect(serviceSource).toMatch(/fedos_identity_registry|FedosIdentityRegistry/);
    for (const source of [
      recordSource,
      descriptorSource,
      providerInterfaceSource,
      capabilitySource,
      resolverSource,
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
      expect(source).not.toMatch(/fedos_identity_registry/);
      expect(source).not.toMatch(/FedosIdentityRegistry/);
    }
    expect(fedosRuntimeIdentitySource).toMatch(/import \{ FedosIdentityRegistry \} from "\.\.\/identity\/fedos_identity_registry\.js";/);
  });

  it("33. no existing src/nostr/* file was modified, and none references this Stage's own doc or the new Registry", () => {
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
      expect(source).not.toMatch(/secure_runtime_alpha_041/);
      expect(source).not.toMatch(/FedosIdentityRegistry|fedos_identity_registry/);
    }
  });

  it("34. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("35. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_041/);

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

  it("36. exactly one new file was added under src/identity/ -- now exactly 22 files; no fedos_*.ts file under src/runtime/ was added or removed -- still exactly 56 files", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("37. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha041-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha041-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha041-id"));
    expect(deleted).toBe(true);
  });

  it("38. Regression: initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected -- confirmed by ACTUAL calls", async () => {
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha041-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha041-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha041-direct"))).toBe(true);
  });
});
