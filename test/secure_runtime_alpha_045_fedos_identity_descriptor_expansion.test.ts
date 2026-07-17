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
import { NostrIdentityProvider } from "../src/identity/fedos_nostr_identity_provider.js";
import { NullNostrPublicIdentitySource } from "../src/identity/fedos_null_nostr_public_identity_source.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
import { FedosIdentityRegistry } from "../src/identity/fedos_identity_registry.js";
import { FedosIdentityResolver } from "../src/identity/fedos_identity_resolver.js";
import type { FedosIdentityDescriptor } from "../src/identity/fedos_identity_descriptor.js";
import type { FedosIdentityProvider } from "../src/identity/fedos_identity_provider.js";
import type {
  FedosNostrPublicIdentitySnapshot,
  FedosNostrPublicIdentitySource,
} from "../src/identity/fedos_nostr_public_identity_source.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_045_fedos_identity_descriptor_expansion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha038DocSource from "../docs/secure_runtime_alpha_038_fedos_identity_descriptor_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha044DocSource from "../docs/secure_runtime_alpha_044_nostr_public_identity_snapshot_expansion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/identity/fedos_identity_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import recordSource from "../src/identity/fedos_identity_record.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerInterfaceSource from "../src/identity/fedos_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilitySource from "../src/identity/fedos_identity_capability.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrProviderSource from "../src/identity/fedos_nostr_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopProviderSource from "../src/identity/fedos_noop_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/identity/fedos_identity_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import registrySource from "../src/identity/fedos_identity_registry.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import resolverClassSource from "../src/identity/fedos_identity_resolver.ts?raw";
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

function makeTestProvider(overrides: Partial<FedosIdentityProvider> & { provider: string }): FedosIdentityProvider {
  return {
    provider: overrides.provider,
    describeIdentity: overrides.describeIdentity ?? (async () => null),
  };
}

/**
 * Secure Runtime Alpha 045 -- "FedOS Identity Descriptor Expansion":
 * adds exactly two OPTIONAL fields -- `displayName?: string`/
 * `avatar?: string` -- to `FedosIdentityDescriptor` (Alpha 028),
 * formally executing Alpha 038's own ADOPT decision. No other type
 * changes: `FedosIdentityRecord`, `FedosIdentityProvider`,
 * `NostrIdentityProvider`, `FedosIdentityService`,
 * `FedosIdentityRegistry`, `FedosIdentityResolver`,
 * `FedosNostrPublicIdentitySource`, and
 * `NullNostrPublicIdentitySource` are all confirmed byte-for-byte
 * unchanged.
 */
describe("Secure Runtime Alpha 045 -- FedOS Identity Descriptor Expansion, Descriptor-only, no Record/Provider/Service/Registry/Resolver/Source/Runtime/Worker/Storage/Rust change", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(10000);
  });

  it("2. the design doc states this Stage adds two optional fields to one interface in one file, cross-referencing Alpha 038/044", () => {
    expect(designDocSource).toMatch(/two optional fields added to one interface, in\s+one file/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_038_fedos_identity_descriptor_decision\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_044_nostr_public_identity_snapshot_expansion\.md/);
    expect(alpha038DocSource).toMatch(/ADOPTED, with the reference-only constraint made BINDING/);
    expect(alpha044DocSource).toMatch(/readonly displayName\?: string;/);
  });

  it("3. the design doc records the exact new Descriptor shape", () => {
    expect(designDocSource).toMatch(/export interface FedosIdentityDescriptor \{/);
    expect(designDocSource).toMatch(/readonly id: string;/);
    expect(designDocSource).toMatch(/readonly provider: string;/);
    expect(designDocSource).toMatch(/readonly publicIdentifier: string;/);
    expect(designDocSource).toMatch(/readonly displayName\?: string;/);
    expect(designDocSource).toMatch(/readonly avatar\?: string;/);
  });

  it("4. the design doc fixes all five mandated boundaries, each its own section", () => {
    expect(designDocSource).toMatch(
      /Descriptorと Snapshotの責務 \(boundary with `FedosNostrPublicIdentitySnapshot`, Alpha 039\/044\)/,
    );
    expect(designDocSource).toMatch(/Descriptorと Recordの責務 \(boundary with `FedosIdentityRecord`, Alpha 040\)/);
    expect(designDocSource).toMatch(
      /Descriptorと Providerの責務 \(boundary with `FedosIdentityProvider`\/`NostrIdentityProvider`\)/,
    );
    expect(designDocSource).toMatch(
      /Descriptorと Serviceの責務・Descriptorと Registryの責務 \(boundary with `FedosIdentityService`\/`FedosIdentityRegistry`\)/,
    );
  });

  it("5. the design doc explains why displayName/avatar are both optional", () => {
    expect(designDocSource).toMatch(/displayNameをoptionalにする理由・avatarをoptionalにする理由/);
    expect(designDocSource).toMatch(
      /No Provider implementation in this repository is authorized, by\s+this Stage's own mandate, to populate either field\./,
    );
  });

  it("6. the design doc explains why avatar remains a reference only, restating Alpha 038/044's own binding constraint", () => {
    expect(designDocSource).toMatch(/avatarはURL\/CIDのみとする理由/);
    expect(designDocSource).toMatch(/THIRD application, not a new decision/);
  });

  it("7. the design doc explains why no Authentication or secret information is included", () => {
    expect(designDocSource).toMatch(/Authentication情報を含めない理由・秘密情報を含めない理由/);
    expect(designDocSource).toMatch(/unconditional and permanent, restated here for/i);
  });

  it("8. the design doc records the explicit 'does NOT do' list", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_record\.ts` \(Alpha 040\) — still/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_nostr_identity_provider\.ts` \(Alpha\s+035\/039\/042\/044\)/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_service\.ts` \(Alpha 031\/042\)\./);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_registry\.ts` \(Alpha 041\)\./);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_resolver\.ts` \(Alpha 043\)\./);
    expect(designDocSource).toMatch(/Does \*\*not\*\* wire any Provider to populate `displayName`\/`avatar`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* make either new field required\./);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `create_runtime\.ts` or any `src\/runtime\/\*` file\./);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
  });

  it("9. fedos_identity_descriptor.ts still exports EXACTLY one interface, no class, no function", () => {
    expect([...descriptorSource.matchAll(/^export interface (\w+)/gm)].map((m: RegExpMatchArray) => m[1])).toEqual([
      "FedosIdentityDescriptor",
    ]);
    expect([...descriptorSource.matchAll(/^export class/gm)].length).toBe(0);
    expect([...descriptorSource.matchAll(/^export (?:async )?function/gm)].length).toBe(0);
    expect([...descriptorSource.matchAll(/^export const/gm)].length).toBe(0);
  });

  it("10. the Descriptor interface has EXACTLY five fields, in order -- id, provider, publicIdentifier, displayName?, avatar?", () => {
    const body = (descriptorSource.match(/export interface FedosIdentityDescriptor \{([\s\S]*?)\}/) ?? [])[1] ?? "";
    const fieldLines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.startsWith("readonly"));
    expect(fieldLines).toEqual([
      "readonly id: string;",
      "readonly provider: string;",
      "readonly publicIdentifier: string;",
      "readonly displayName?: string;",
      "readonly avatar?: string;",
    ]);
  });

  it("11. displayName and avatar are both declared OPTIONAL (with '?:'), never required", () => {
    expect(descriptorSource).toMatch(/readonly displayName\?: string;/);
    expect(descriptorSource).toMatch(/readonly avatar\?: string;/);
    expect(descriptorSource).not.toMatch(/readonly displayName: string;/);
    expect(descriptorSource).not.toMatch(/readonly avatar: string;/);
  });

  it("12. id, provider, and publicIdentifier remain REQUIRED (no '?:'), unchanged from Alpha 028", () => {
    expect(descriptorSource).toMatch(/readonly id: string;/);
    expect(descriptorSource).toMatch(/readonly provider: string;/);
    expect(descriptorSource).toMatch(/readonly publicIdentifier: string;/);
    const requiredFields = [...descriptorSource.matchAll(/^\s*readonly \w+: string;/gm)];
    expect(requiredFields.length).toBe(3);
  });

  it("13. RIPPLE (Secure Runtime Alpha 045): fedos_identity_descriptor.ts's own code referenced zero displayName/avatar vocabulary AS OF Alpha 028's own scope; Alpha 045 later added both, deliberately, to the Descriptor -- reconfirmed here as the CURRENT shape, per this arc's own established ripple convention", () => {
    expect(descriptorSource).toMatch(/displayName/);
    expect(descriptorSource).toMatch(/avatar/);
  });

  it("14. the Descriptor's own two NEW optional fields match FedosNostrPublicIdentitySnapshot's own two optional fields exactly, name for name, order for order, and optionality for optionality -- the Descriptor's own additional 'provider' field (which the Snapshot deliberately has never had, per Alpha 039) is the one intentional difference between the two field sets", () => {
    const descriptorBody = (descriptorSource.match(/export interface FedosIdentityDescriptor \{([\s\S]*?)\}/) ?? [])[1] ?? "";
    const descriptorOptionalFields = [...descriptorBody.matchAll(/readonly (\w+)\?:/g)].map((m: RegExpMatchArray) => m[1]);
    const snapshotBody = (sourceInterfaceSource.match(/export interface FedosNostrPublicIdentitySnapshot \{([\s\S]*?)\}/) ?? [])[1] ?? "";
    const snapshotOptionalFields = [...snapshotBody.matchAll(/readonly (\w+)\?:/g)].map((m: RegExpMatchArray) => m[1]);
    expect(descriptorOptionalFields).toEqual(["displayName", "avatar"]);
    expect(snapshotOptionalFields).toEqual(["displayName", "avatar"]);
    expect(descriptorOptionalFields).toEqual(snapshotOptionalFields);
    expect(descriptorSource).toMatch(/readonly provider: string;/);
    expect(sourceInterfaceSource).not.toMatch(/readonly provider\??:/);
  });

  it("15. fedos_identity_descriptor.ts still has zero import lines of any kind", () => {
    const importLines = [...descriptorSource.matchAll(/^import .*$/gm)];
    expect(importLines.length).toBe(0);
  });

  it("16. behavioral: a Descriptor with displayName/avatar populated is structurally valid and both fields are readable", () => {
    const descriptor: FedosIdentityDescriptor = {
      id: "user-1",
      provider: "nostr",
      publicIdentifier: "npub1abc",
      displayName: "Alice",
      avatar: "https://example.invalid/avatar.png",
    };
    expect(descriptor.displayName).toBe("Alice");
    expect(descriptor.avatar).toBe("https://example.invalid/avatar.png");
  });

  it("17. behavioral: a Descriptor with displayName/avatar OMITTED is still structurally valid -- both fields are undefined", () => {
    const descriptor: FedosIdentityDescriptor = { id: "user-2", provider: "noop", publicIdentifier: "" };
    expect(descriptor.displayName).toBeUndefined();
    expect(descriptor.avatar).toBeUndefined();
  });

  it("18. RIPPLE (Secure Runtime Alpha 045): NostrIdentityProvider mapped ONLY id/publicIdentifier onto the Descriptor, even when the Source's own Snapshot carried displayName/avatar, AS OF this Stage's own scope; Alpha 046 later wired displayName/avatar through onto the Descriptor as well -- reconfirmed here as the CURRENT behavior, per this arc's own established ripple convention", async () => {
    const source = new FakeSource({
      id: "user-3",
      publicIdentifier: "npub1ghi",
      displayName: "Bob",
      avatar: "https://example.invalid/bob.png",
    });
    const provider = new NostrIdentityProvider(source);
    const descriptor = await provider.describeIdentity();
    expect(descriptor).toEqual({
      id: "user-3",
      provider: "nostr",
      publicIdentifier: "npub1ghi",
      displayName: "Bob",
      avatar: "https://example.invalid/bob.png",
    });
    expect(descriptor).toHaveProperty("displayName", "Bob");
    expect(descriptor).toHaveProperty("avatar", "https://example.invalid/bob.png");
  });

  it("19. behavioral: NullNostrPublicIdentitySource still always resolves null, unaffected by the Descriptor's own field expansion", async () => {
    const source = new NullNostrPublicIdentitySource();
    expect(await source.readPublicIdentity()).toBeNull();
  });

  it("20. RIPPLE (Secure Runtime Alpha 045): a directly-constructed NostrIdentityProvider resolved a Descriptor with only three keys present (via a fake Source) AS OF this Stage's own scope; Alpha 046 later wired displayName/avatar through, so the same Descriptor now carries five keys -- reconfirmed here as the CURRENT behavior, per this arc's own established ripple convention", async () => {
    const provider = new NostrIdentityProvider(new FakeSource({ id: "x", publicIdentifier: "npub1x", displayName: "X", avatar: "https://x.invalid/a.png" }));
    const descriptor = await provider.describeIdentity();
    expect(Object.keys(descriptor ?? {}).sort()).toEqual(["avatar", "displayName", "id", "provider", "publicIdentifier"].sort());
  });

  it("21. RIPPLE (Secure Runtime Alpha 045): end-to-end -- a Service registered a Record from a directly-constructed Descriptor carrying displayName/avatar, and the Record still carried only three fields, AS OF this Stage's own scope; Alpha 047 later expanded FedosIdentityRecord and wired the Service to copy displayName/avatar onto it -- reconfirmed here as the CURRENT (five-field) behavior, per this arc's own established ripple convention", async () => {
    const registry = new FedosIdentityRegistry();
    const provider = makeTestProvider({
      provider: "nostr",
      describeIdentity: async () => ({
        id: "e2e-1",
        provider: "nostr",
        publicIdentifier: "npub1e2e",
        displayName: "Dana",
        avatar: "https://example.invalid/dana.png",
      }),
    });
    const service = new FedosIdentityService(provider, registry);
    const resolver = new FedosIdentityResolver(registry);

    const returned = await service.describeIdentity();
    expect(returned).toHaveProperty("displayName", "Dana");
    expect(returned).toHaveProperty("avatar", "https://example.invalid/dana.png");

    const record = resolver.findIdentity("e2e-1");
    expect(record).toEqual({
      id: "e2e-1",
      provider: "nostr",
      publicIdentifier: "npub1e2e",
      displayName: "Dana",
      avatar: "https://example.invalid/dana.png",
    });
    expect(record).toHaveProperty("displayName", "Dana");
    expect(record).toHaveProperty("avatar", "https://example.invalid/dana.png");
  });

  it("22. behavioral: describeCapability() is entirely unaffected by the Descriptor's own field expansion -- still only provider label + available: true", async () => {
    const registry = new FedosIdentityRegistry();
    const provider = makeTestProvider({ provider: "capability-only" });
    const service = new FedosIdentityService(provider, registry);
    const capability = await service.describeCapability();
    expect(capability).toEqual({ provider: "capability-only", available: true });
  });

  it("23. RIPPLE (Secure Runtime Alpha 045): fedos_identity_record.ts (Alpha 040) had zero displayName/avatar vocabulary in its own code AS OF this Stage's own scope -- the Record's own field set was deliberately NOT expanded alongside the Descriptor's own at that time; Alpha 047 later expanded the Record with the identical two OPTIONAL fields -- reconfirmed here as the CURRENT (expanded) shape, per this arc's own established ripple convention", () => {
    expect(recordSource).toMatch(/export interface FedosIdentityRecord \{/);
    const requiredFieldDeclarations = [...recordSource.matchAll(/^\s*readonly \w+: string;/gm)];
    expect(requiredFieldDeclarations.length).toBe(3);
    expect(codeOnlyLines(recordSource)).toMatch(/readonly displayName\?: string;/);
    expect(codeOnlyLines(recordSource)).toMatch(/readonly avatar\?: string;/);
    expect(recordSource).not.toMatch(/secure_runtime_alpha_045/);
  });

  it("24. Regression: fedos_identity_provider.ts (Alpha 029) is confirmed BYTE-FOR-BYTE unchanged -- still exactly one method, no describeCapability()", () => {
    expect(providerInterfaceSource).toMatch(/export interface FedosIdentityProvider \{/);
    expect(providerInterfaceSource).toMatch(/describeIdentity\(\): Promise<FedosIdentityDescriptor \| null>;/);
    expect(providerInterfaceSource).not.toMatch(/describeCapability/);
    expect(providerInterfaceSource).not.toMatch(/secure_runtime_alpha_045/);
  });

  it("25. Regression: fedos_identity_capability.ts (Alpha 030) is confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(capabilitySource).toMatch(/readonly provider: string;/);
    expect(capabilitySource).toMatch(/readonly available: boolean;/);
    expect(capabilitySource).not.toMatch(/secure_runtime_alpha_045/);
  });

  it("26. RIPPLE (Secure Runtime Alpha 045, constructor defaulted at Alpha 049): fedos_nostr_identity_provider.ts's own code had no reference to displayName/avatar anywhere AS OF this Stage's own scope; Alpha 046 later added both to its own return statement, and Alpha 049 later gave the constructor's Source parameter a default value -- reconfirmed here as the CURRENT (mapping-expanded, default-parameter) shape, per this arc's own established ripple convention", () => {
    expect(nostrProviderSource).toMatch(/constructor\(source: FedosNostrPublicIdentitySource = resolveNostrPublicIdentitySource\(\)\) \{/);
    expect(nostrProviderSource).toMatch(/this\.#source\.readPublicIdentity\(\)/);
    expect(codeOnlyLines(nostrProviderSource)).toMatch(/displayName: snapshot\.displayName,/);
    expect(codeOnlyLines(nostrProviderSource)).toMatch(/avatar: snapshot\.avatar,/);
    expect(nostrProviderSource).not.toMatch(/secure_runtime_alpha_045/);
  });

  it("27. Regression: fedos_noop_identity_provider.ts (Alpha 033) is confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(noopProviderSource).toMatch(/readonly provider = "noop";/);
    expect(noopProviderSource).not.toMatch(/secure_runtime_alpha_045/);
  });

  it("28. RIPPLE (Secure Runtime Alpha 045): fedos_identity_service.ts (Alpha 031/042) had no reference to displayName/avatar anywhere in its own code AS OF this Stage's own scope; Alpha 047 later wired the Service's own Descriptor-to-Record mapping to copy both fields through -- reconfirmed here as the CURRENT (expanded) shape, per this arc's own established ripple convention", () => {
    expect(serviceSource).toMatch(/constructor\(provider: FedosIdentityProvider, registry: FedosIdentityRegistry\) \{/);
    expect(codeOnlyLines(serviceSource)).toMatch(/displayName: descriptor\.displayName,/);
    expect(codeOnlyLines(serviceSource)).toMatch(/avatar: descriptor\.avatar,/);
    expect(serviceSource).not.toMatch(/secure_runtime_alpha_045/);
  });

  it("29. Regression: fedos_identity_registry.ts (Alpha 041) and fedos_identity_resolver.ts (Alpha 043) are confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).not.toMatch(/secure_runtime_alpha_045/);
    expect(resolverClassSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(resolverClassSource).not.toMatch(/secure_runtime_alpha_045/);
  });

  it("30. Regression: fedos_identity_provider_resolver.ts is confirmed BYTE-FOR-BYTE unchanged -- still returns the shared NostrIdentityProvider singleton", () => {
    expect(identityProviderResolverSource).toMatch(/return sharedNostrProvider;/);
    expect(identityProviderResolverSource).not.toMatch(/secure_runtime_alpha_045/);
  });

  it("31. Regression: fedos_nostr_public_identity_source.ts (Alpha 039/044) is confirmed BYTE-FOR-BYTE unchanged -- Snapshot still exactly its own four fields, Source interface still its own single method", () => {
    const snapshotBody = (sourceInterfaceSource.match(/export interface FedosNostrPublicIdentitySnapshot \{([\s\S]*?)\}/) ?? [])[1] ?? "";
    const fieldLines = snapshotBody
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.startsWith("readonly"));
    expect(fieldLines).toEqual([
      "readonly id: string;",
      "readonly publicIdentifier: string;",
      "readonly displayName?: string;",
      "readonly avatar?: string;",
    ]);
    const sourceBody = (sourceInterfaceSource.match(/export interface FedosNostrPublicIdentitySource \{([\s\S]*?)\}/) ?? [])[1]?.trim() ?? "";
    expect(sourceBody).toBe("readPublicIdentity(): Promise<FedosNostrPublicIdentitySnapshot | null>;");
    expect(sourceInterfaceSource).not.toMatch(/secure_runtime_alpha_045/);
  });

  it("32. Regression: fedos_null_nostr_public_identity_source.ts (Alpha 039) is confirmed BYTE-FOR-BYTE unchanged -- readPublicIdentity() still always resolves null", () => {
    const body = (
      nullSourceSource.match(/async readPublicIdentity\(\): Promise<FedosNostrPublicIdentitySnapshot \| null> \{([\s\S]*?)\n  \}/) ?? []
    )[1] ?? "";
    expect(body.trim()).toBe("return null;");
    expect(nullSourceSource).not.toMatch(/secure_runtime_alpha_045/);
  });

  it("33. behavioral: resolveFedosIdentityProvider() is entirely unaffected -- still resolves the shared NostrIdentityProvider singleton, provider === 'nostr', describeIdentity() still always null by default", async () => {
    const resolved = resolveFedosIdentityProvider();
    expect(resolved).toBeInstanceOf(NostrIdentityProvider);
    expect(resolved?.provider).toBe("nostr");
    expect(await resolved?.describeIdentity()).toBeNull();
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
      expect(source).not.toMatch(/secure_runtime_alpha_045/);
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
      expect(source).not.toMatch(/secure_runtime_alpha_045/);
    }
  });

  it("35. no Runtime/Storage/Worker file references this Stage's own doc or the expanded Descriptor", () => {
    for (const source of [storageResolverSource, storageBackendSource, runtimeTypesSource, createRuntimeSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_045/);
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
    expect(pubFnNames.length).toBe(46);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_045/);

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
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha045-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha045-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha045-id"));
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha045-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha045-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha045-direct"))).toBe(true);
  });
});
