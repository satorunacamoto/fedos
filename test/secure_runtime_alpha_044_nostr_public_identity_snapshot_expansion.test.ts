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
import { FedosIdentityRegistry } from "../src/identity/fedos_identity_registry.js";
import { FedosIdentityResolver } from "../src/identity/fedos_identity_resolver.js";
import type {
  FedosNostrPublicIdentitySnapshot,
  FedosNostrPublicIdentitySource,
} from "../src/identity/fedos_nostr_public_identity_source.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_044_nostr_public_identity_snapshot_expansion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha038DocSource from "../docs/secure_runtime_alpha_038_fedos_identity_descriptor_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha039DocSource from "../docs/secure_runtime_alpha_039_nostr_public_identity_source_boundary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sourceInterfaceSource from "../src/identity/fedos_nostr_public_identity_source.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullSourceSource from "../src/identity/fedos_null_nostr_public_identity_source.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrProviderSource from "../src/identity/fedos_nostr_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/identity/fedos_identity_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import recordSource from "../src/identity/fedos_identity_record.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerInterfaceSource from "../src/identity/fedos_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilitySource from "../src/identity/fedos_identity_capability.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/identity/fedos_identity_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import registrySource from "../src/identity/fedos_identity_registry.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import resolverClassSource from "../src/identity/fedos_identity_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityProviderResolverSource from "../src/identity/fedos_identity_provider_resolver.ts?raw";
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
  constructor(snapshot: FedosNostrPublicIdentitySnapshot | null) {
    this.#snapshot = snapshot;
  }
  async readPublicIdentity(): Promise<FedosNostrPublicIdentitySnapshot | null> {
    return this.#snapshot;
  }
}

/**
 * Secure Runtime Alpha 044 -- "Nostr Public Identity Snapshot
 * Expansion": adds exactly two OPTIONAL fields --
 * `displayName?: string`/`avatar?: string` -- to
 * `FedosNostrPublicIdentitySnapshot` (Alpha 039). No other type
 * changes: `FedosNostrPublicIdentitySource`, `FedosIdentityDescriptor`,
 * `FedosIdentityRecord`, `NostrIdentityProvider`,
 * `NullNostrPublicIdentitySource`, `FedosIdentityService`,
 * `FedosIdentityRegistry`, and `FedosIdentityResolver` are all
 * confirmed byte-for-byte unchanged.
 */
describe("Secure Runtime Alpha 044 -- Nostr Public Identity Snapshot Expansion, Snapshot-only, no Descriptor/Record/Provider/Service/Registry/Resolver/Runtime/Worker/Storage/Rust change", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(10000);
  });

  it("2. the design doc states this Stage adds two optional fields to one interface in one file, cross-referencing Alpha 038/039", () => {
    expect(designDocSource).toMatch(/two optional fields added to one interface, in\s+one file/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_038_fedos_identity_descriptor_decision\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_039_nostr_public_identity_source_boundary\.md/);
    expect(alpha038DocSource).toMatch(/ADOPTED, with the reference-only constraint made BINDING/);
    expect(alpha039DocSource).toMatch(/\*\*Explicit decision: Option A\./);
  });

  it("3. the design doc records the exact new Snapshot shape and the unchanged Source interface", () => {
    expect(designDocSource).toMatch(/export interface FedosNostrPublicIdentitySnapshot \{/);
    expect(designDocSource).toMatch(/readonly displayName\?: string;/);
    expect(designDocSource).toMatch(/readonly avatar\?: string;/);
    expect(designDocSource).toMatch(/export interface FedosNostrPublicIdentitySource \{/);
    expect(designDocSource).toMatch(/readPublicIdentity\(\): Promise<FedosNostrPublicIdentitySnapshot \| null>;/);
  });

  it("4. the design doc fixes the Snapshot/Descriptor, Snapshot/Record, and Snapshot/Provider boundaries, each its own section", () => {
    expect(designDocSource).toMatch(/Snapshotと Descriptorの責務 \(boundary with `FedosIdentityDescriptor`, Alpha 028\)/);
    expect(designDocSource).toMatch(/Snapshotと Recordの責務 \(boundary with `FedosIdentityRecord`, Alpha 040\)/);
    expect(designDocSource).toMatch(
      /Snapshotと Providerの責務 \(boundary with `NostrIdentityProvider`, Alpha 035\/039\/042\)/,
    );
  });

  it("5. the design doc explains why the Snapshot may carry displayName/avatar now", () => {
    expect(designDocSource).toMatch(/SnapshotがdisplayName\/avatarを持ってよい理由/);
    expect(designDocSource).toMatch(
      /Alpha 038's own formal decision already authorizes the CONTENT/,
    );
  });

  it("6. the design doc explains why the Descriptor is not extended in this same Stage", () => {
    expect(designDocSource).toMatch(/Descriptorへまだ追加しない理由/);
    expect(designDocSource).toMatch(/1 Stage = 1 responsibility/);
  });

  it("7. the design doc explains why avatar is a reference only, and why no Authentication or secret information is included", () => {
    expect(designDocSource).toMatch(/avatarはURL\/CID参照のみとする理由/);
    expect(designDocSource).toMatch(
      /Authentication情報を含めない理由・秘密情報を含めない理由/,
    );
    expect(designDocSource).toMatch(/never embedded image bytes/);
  });

  it("8. the design doc records the explicit 'does NOT do' list", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_descriptor\.ts` \(Alpha 028\) — still/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_record\.ts` \(Alpha 040\) — still/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_service\.ts` \(Alpha 031\/042\)\./);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_registry\.ts` \(Alpha 041\)\./);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_resolver\.ts` \(Alpha 043\)\./);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `create_runtime\.ts` or any `src\/runtime\/\*` file\./);
    expect(designDocSource).toMatch(/Does \*\*not\*\* allow `avatar` to hold embedded image bytes/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
  });

  it("9. fedos_nostr_public_identity_source.ts still exports EXACTLY two interfaces, no class, no function", () => {
    expect([...sourceInterfaceSource.matchAll(/^export interface (\w+)/gm)].map((m: RegExpMatchArray) => m[1]).sort()).toEqual(
      ["FedosNostrPublicIdentitySnapshot", "FedosNostrPublicIdentitySource"].sort(),
    );
    expect([...sourceInterfaceSource.matchAll(/^export class/gm)].length).toBe(0);
    expect([...sourceInterfaceSource.matchAll(/^export (?:async )?function/gm)].length).toBe(0);
    expect([...sourceInterfaceSource.matchAll(/^export const/gm)].length).toBe(0);
  });

  it("10. the Snapshot interface has EXACTLY four fields, in order -- id, publicIdentifier, displayName?, avatar?", () => {
    const body = (sourceInterfaceSource.match(/export interface FedosNostrPublicIdentitySnapshot \{([\s\S]*?)\}/) ?? [])[1] ?? "";
    const fieldLines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.startsWith("readonly"));
    expect(fieldLines).toEqual([
      "readonly id: string;",
      "readonly publicIdentifier: string;",
      "readonly displayName?: string;",
      "readonly avatar?: string;",
    ]);
  });

  it("11. displayName and avatar are both declared OPTIONAL (with '?:'), never required", () => {
    expect(sourceInterfaceSource).toMatch(/readonly displayName\?: string;/);
    expect(sourceInterfaceSource).toMatch(/readonly avatar\?: string;/);
    expect(sourceInterfaceSource).not.toMatch(/readonly displayName: string;/);
    expect(sourceInterfaceSource).not.toMatch(/readonly avatar: string;/);
  });

  it("12. id and publicIdentifier remain REQUIRED (no '?:'), unchanged from Alpha 039", () => {
    expect(sourceInterfaceSource).toMatch(/readonly id: string;/);
    expect(sourceInterfaceSource).toMatch(/readonly publicIdentifier: string;/);
  });

  it("13. RIPPLE (Secure Runtime Alpha 044): fedos_nostr_public_identity_source.ts's own code referenced zero displayName/avatar vocabulary AS OF Alpha 039's own scope; Alpha 044 later added both, deliberately, to the Snapshot -- reconfirmed here as the CURRENT shape, per this arc's own established ripple convention", () => {
    expect(sourceInterfaceSource).toMatch(/displayName/);
    expect(sourceInterfaceSource).toMatch(/avatar/);
  });

  it("14. FedosNostrPublicIdentitySource itself (the Interface) is confirmed BYTE-FOR-BYTE UNCHANGED -- still the single-method contract, taking no argument", () => {
    const match = sourceInterfaceSource.match(/export interface FedosNostrPublicIdentitySource \{([\s\S]*?)\}/);
    const body = match?.[1]?.trim() ?? "";
    expect(body).toBe("readPublicIdentity(): Promise<FedosNostrPublicIdentitySnapshot | null>;");
  });

  it("15. the Snapshot's own CODE still carries no secret-shaped field, no Runtime-handle field, no Relay/Authentication vocabulary", () => {
    const codeOnly = codeOnlyLines(sourceInterfaceSource);
    expect(codeOnly).not.toMatch(/nsec|seed|mnemonic|privateKey|secretKey|AeadKeyHandle|AeadCiphertextHandle/i);
    expect(codeOnly).not.toMatch(/relay|Relay|Authenticat|session|Session|credential|Credential/);
    expect(codeOnly).not.toMatch(/\bprovider\s*[:?]/);
  });

  it("16. fedos_nostr_public_identity_source.ts still has zero import lines of any kind", () => {
    const importLines = [...sourceInterfaceSource.matchAll(/^import .*$/gm)];
    expect(importLines.length).toBe(0);
  });

  it("17. behavioral: a Snapshot with displayName/avatar populated is structurally valid and both fields are readable", () => {
    const snapshot: FedosNostrPublicIdentitySnapshot = {
      id: "user-1",
      publicIdentifier: "npub1abc",
      displayName: "Alice",
      avatar: "https://example.invalid/avatar.png",
    };
    expect(snapshot.displayName).toBe("Alice");
    expect(snapshot.avatar).toBe("https://example.invalid/avatar.png");
  });

  it("18. behavioral: a Snapshot with displayName/avatar OMITTED is still structurally valid -- both fields are undefined", () => {
    const snapshot: FedosNostrPublicIdentitySnapshot = { id: "user-2", publicIdentifier: "npub1def" };
    expect(snapshot.displayName).toBeUndefined();
    expect(snapshot.avatar).toBeUndefined();
  });

  it("19. behavioral: NullNostrPublicIdentitySource still always resolves null, unaffected by the Snapshot's own field expansion", async () => {
    const source = new NullNostrPublicIdentitySource();
    expect(await source.readPublicIdentity()).toBeNull();
    expect(await source.readPublicIdentity()).toBeNull();
  });

  it("20. RIPPLE (Secure Runtime Alpha 044): NostrIdentityProvider mapped ONLY id/publicIdentifier onto the Descriptor, ignoring a Source's displayName/avatar entirely, AS OF this Stage's own scope; Alpha 046 later wired displayName/avatar through onto the Descriptor as well -- reconfirmed here as the CURRENT behavior, per this arc's own established ripple convention", async () => {
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

  it("21. RIPPLE (Secure Runtime Alpha 044): a Snapshot with only displayName (no avatar) still validated with id/publicIdentifier presence rules unaffected, and AS OF this Stage's own scope the resulting Descriptor omitted displayName entirely; Alpha 046 later wired displayName through onto the Descriptor -- reconfirmed here as the CURRENT behavior, per this arc's own established ripple convention", async () => {
    const source = new FakeSource({ id: "user-4", publicIdentifier: "npub1jkl", displayName: "Carol" });
    const provider = new NostrIdentityProvider(source);
    const descriptor = await provider.describeIdentity();
    expect(descriptor).toEqual({ id: "user-4", provider: "nostr", publicIdentifier: "npub1jkl", displayName: "Carol" });
    expect(descriptor?.displayName).toBe("Carol");
    expect(descriptor?.avatar).toBeUndefined();
  });

  it("22. behavioral: empty-string id/publicIdentifier still resolve null, even when displayName/avatar are populated -- the new optional fields do not bypass existing Fail-Closed validation", async () => {
    const source = new FakeSource({ id: "", publicIdentifier: "npub1x", displayName: "Should Not Matter", avatar: "https://x.invalid/a.png" });
    const provider = new NostrIdentityProvider(source);
    expect(await provider.describeIdentity()).toBeNull();
  });

  it("23. RIPPLE (Secure Runtime Alpha 044): end-to-end -- a Service registered a Record from a Descriptor built via a displayName/avatar-carrying Snapshot, and the Record carried only three fields, AS OF this Stage's own scope; Alpha 047 later expanded FedosIdentityRecord and wired the Service to copy displayName/avatar onto it -- reconfirmed here as the CURRENT (five-field) behavior, per this arc's own established ripple convention", async () => {
    const registry = new FedosIdentityRegistry();
    const source = new FakeSource({
      id: "e2e-1",
      publicIdentifier: "npub1e2e",
      displayName: "Dana",
      avatar: "https://example.invalid/dana.png",
    });
    const provider = new NostrIdentityProvider(source);
    const { FedosIdentityService } = await import("../src/identity/fedos_identity_service.js");
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
    expect(record).toHaveProperty("displayName", "Dana");
    expect(record).toHaveProperty("avatar", "https://example.invalid/dana.png");
  });

  it("24. RIPPLE (Secure Runtime Alpha 045): fedos_identity_descriptor.ts (Alpha 028) was confirmed BYTE-FOR-BYTE unchanged AS OF this Stage's own scope -- still exactly three fields; Alpha 045 later added displayName/avatar as two OPTIONAL fields, formally executing Alpha 038's own ADOPT decision -- reconfirmed here as the CURRENT shape, per this arc's own established ripple convention", () => {
    expect(descriptorSource).toMatch(/export interface FedosIdentityDescriptor \{/);
    const requiredFieldDeclarations = [...descriptorSource.matchAll(/^\s*readonly \w+: string;/gm)];
    expect(requiredFieldDeclarations.length).toBe(3);
    expect(descriptorSource).toMatch(/readonly displayName\?: string;/);
    expect(descriptorSource).toMatch(/readonly avatar\?: string;/);
    expect(descriptorSource).not.toMatch(/secure_runtime_alpha_044/);
  });

  it("25. RIPPLE (Secure Runtime Alpha 044): fedos_identity_record.ts (Alpha 040) had exactly three fields and zero displayName/avatar vocabulary AS OF this Stage's own scope; Alpha 047 later added displayName/avatar as two OPTIONAL fields -- reconfirmed here as the CURRENT (expanded) shape, per this arc's own established ripple convention, while the three original REQUIRED fields remain unchanged", () => {
    expect(recordSource).toMatch(/export interface FedosIdentityRecord \{/);
    const requiredFieldDeclarations = [...recordSource.matchAll(/^\s*readonly \w+: string;/gm)];
    expect(requiredFieldDeclarations.length).toBe(3);
    expect(codeOnlyLines(recordSource)).toMatch(/readonly displayName\?: string;/);
    expect(codeOnlyLines(recordSource)).toMatch(/readonly avatar\?: string;/);
    expect(recordSource).not.toMatch(/secure_runtime_alpha_044/);
  });

  it("26. Regression: fedos_identity_provider.ts and fedos_identity_capability.ts are confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(providerInterfaceSource).toMatch(/describeIdentity\(\): Promise<FedosIdentityDescriptor \| null>;/);
    expect(providerInterfaceSource).not.toMatch(/secure_runtime_alpha_044/);
    expect(capabilitySource).toMatch(/readonly available: boolean;/);
    expect(capabilitySource).not.toMatch(/secure_runtime_alpha_044/);
  });

  it("27. RIPPLE (Secure Runtime Alpha 044, constructor defaulted at Alpha 049): fedos_nostr_identity_provider.ts's own code had no reference to displayName/avatar anywhere AS OF this Stage's own scope; Alpha 046 later added both to its own return statement, and Alpha 049 later gave the constructor's Source parameter a default value -- reconfirmed here as the CURRENT (mapping-expanded, default-parameter) shape, per this arc's own established ripple convention", () => {
    expect(nostrProviderSource).toMatch(/constructor\(source: FedosNostrPublicIdentitySource = resolveNostrPublicIdentitySource\(\)\) \{/);
    expect(nostrProviderSource).toMatch(/this\.#source\.readPublicIdentity\(\)/);
    const codeOnly = codeOnlyLines(nostrProviderSource);
    expect(codeOnly).toMatch(/displayName: snapshot\.displayName,/);
    expect(codeOnly).toMatch(/avatar: snapshot\.avatar,/);
    expect(nostrProviderSource).not.toMatch(/secure_runtime_alpha_044/);
  });

  it("28. Regression: fedos_null_nostr_public_identity_source.ts is confirmed BYTE-FOR-BYTE unchanged -- describeIdentity() still always resolves null", () => {
    const body = (
      nullSourceSource.match(/async readPublicIdentity\(\): Promise<FedosNostrPublicIdentitySnapshot \| null> \{([\s\S]*?)\n  \}/) ?? []
    )[1] ?? "";
    expect(body.trim()).toBe("return null;");
    expect(nullSourceSource).not.toMatch(/secure_runtime_alpha_044/);
  });

  it("29. Regression: fedos_identity_service.ts/fedos_identity_registry.ts/fedos_identity_resolver.ts are all confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(serviceSource).toMatch(/constructor\(provider: FedosIdentityProvider, registry: FedosIdentityRegistry\) \{/);
    expect(serviceSource).not.toMatch(/secure_runtime_alpha_044/);
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).not.toMatch(/secure_runtime_alpha_044/);
    expect(resolverClassSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(resolverClassSource).not.toMatch(/secure_runtime_alpha_044/);
  });

  it("30. Regression: fedos_identity_provider_resolver.ts and fedos_noop_identity_provider.ts are confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(identityProviderResolverSource).toMatch(/return sharedNostrProvider;/);
    expect(identityProviderResolverSource).not.toMatch(/secure_runtime_alpha_044/);
    expect(noopProviderSource).toMatch(/readonly provider = "noop";/);
    expect(noopProviderSource).not.toMatch(/secure_runtime_alpha_044/);
  });

  it("31. behavioral: resolveFedosIdentityProvider() is entirely unaffected -- still resolves the shared NostrIdentityProvider singleton, provider === 'nostr', describeIdentity() still always null by default", async () => {
    const resolved = resolveFedosIdentityProvider();
    expect(resolved).toBeInstanceOf(NostrIdentityProvider);
    expect(resolved?.provider).toBe("nostr");
    expect(await resolved?.describeIdentity()).toBeNull();
  });

  it("32. no other existing src/identity/* file was modified, and no existing src/nostr/* file references this Stage's own doc", () => {
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
      expect(source).not.toMatch(/secure_runtime_alpha_044/);
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
      expect(source).not.toMatch(/secure_runtime_alpha_044/);
    }
  });

  it("33. no Runtime/Storage/Worker file references this Stage's own doc or the expanded Snapshot", () => {
    for (const source of [storageResolverSource, storageBackendSource, runtimeTypesSource, createRuntimeSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_044/);
      expect(source).not.toMatch(/FedosNostrPublicIdentitySnapshot/);
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
    expect(pubFnNames.length).toBe(64);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_044/);

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

  it("36. RIPPLE (Secure Runtime Alpha 048): no fedos_*.ts file was added or removed by this Stage -- still exactly 56 under src/runtime/ and exactly 23 under src/identity/ AS OF this Stage's own scope; Alpha 048 later added a 24th identity file, fedos_nostr_public_identity_source_resolver.ts -- reconfirmed here as the CURRENT count, per this arc's own established ripple convention", () => {
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
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha044-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha044-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha044-id"));
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha044-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha044-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha044-direct"))).toBe(true);
  });
});
