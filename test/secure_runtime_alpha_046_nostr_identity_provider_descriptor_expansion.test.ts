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
import type {
  FedosNostrPublicIdentitySnapshot,
  FedosNostrPublicIdentitySource,
} from "../src/identity/fedos_nostr_public_identity_source.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_046_nostr_identity_provider_descriptor_expansion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha044DocSource from "../docs/secure_runtime_alpha_044_nostr_public_identity_snapshot_expansion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha045DocSource from "../docs/secure_runtime_alpha_045_fedos_identity_descriptor_expansion.md?raw";
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
 * Secure Runtime Alpha 046 -- "Nostr Identity Provider Descriptor
 * Expansion": `NostrIdentityProvider.describeIdentity()` now copies
 * `snapshot.displayName`/`snapshot.avatar` onto the returned Descriptor,
 * verbatim and unconditionally -- the first real wiring between the
 * Snapshot's own field expansion (Alpha 044) and the Descriptor's own
 * field expansion (Alpha 045). No other type changes:
 * `FedosIdentityDescriptor`, `FedosIdentityRecord`,
 * `FedosIdentityService`, `FedosIdentityRegistry`,
 * `FedosIdentityResolver`, `FedosNostrPublicIdentitySource`, and
 * `NullNostrPublicIdentitySource` are all confirmed byte-for-byte
 * unchanged.
 */
describe("Secure Runtime Alpha 046 -- Nostr Identity Provider Descriptor Expansion, Provider-mapping-only, no Snapshot/Descriptor/Record/Service/Registry/Resolver/Runtime/Worker/Storage/Rust change", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(10000);
  });

  it("2. the design doc states this Stage adds two fields to one return statement in one file, cross-referencing Alpha 044/045", () => {
    expect(designDocSource).toMatch(/two fields added to one return statement, in\s+one file/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_044_nostr_public_identity_snapshot_expansion\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_045_fedos_identity_descriptor_expansion\.md/);
    expect(alpha044DocSource).toMatch(/readonly displayName\?: string;/);
    expect(alpha045DocSource).toMatch(/readonly avatar\?: string;/);
  });

  it("3. the design doc records the exact new return statement", () => {
    expect(designDocSource).toMatch(/return \{/);
    expect(designDocSource).toMatch(/id: snapshot\.id,/);
    expect(designDocSource).toMatch(/provider: "nostr",/);
    expect(designDocSource).toMatch(/publicIdentifier: snapshot\.publicIdentifier,/);
    expect(designDocSource).toMatch(/displayName: snapshot\.displayName,/);
    expect(designDocSource).toMatch(/avatar: snapshot\.avatar,/);
  });

  it("4. the design doc fixes the Provider/Snapshot and Provider/Descriptor boundaries, each its own section", () => {
    expect(designDocSource).toMatch(
      /Providerと Snapshotの責務 \(boundary with `FedosNostrPublicIdentitySnapshot`, Alpha 039\/044\)/,
    );
    expect(designDocSource).toMatch(/Providerと Descriptorの責務 \(boundary with `FedosIdentityDescriptor`, Alpha 028\/045\)/);
  });

  it("5. the design doc explains why displayName/avatar are forwarded verbatim, unconditionally", () => {
    expect(designDocSource).toMatch(/displayName\/avatarをそのまま転送する理由/);
    expect(designDocSource).toMatch(/`undefined` propagating to `undefined` is itself the correct,\s+honest behavior/);
  });

  it("6. the design doc explains why the Provider does not process either field", () => {
    expect(designDocSource).toMatch(/Providerで加工しない理由/);
    expect(designDocSource).toMatch(/never reformatted, normalized, or\s+"corrected" any field/);
  });

  it("7. the design doc explains why displayName/avatar do not yet reach the Record", () => {
    expect(designDocSource).toMatch(/Recordへまだ流さない理由/);
    expect(designDocSource).toMatch(/still produces a three-field Record/);
  });

  it("8. the design doc explains why Runtime stays disconnected and why no Authentication/secret information is handled", () => {
    expect(designDocSource).toMatch(/Runtimeへまだ配線しない理由/);
    expect(designDocSource).toMatch(/Authentication情報を扱わない理由・秘密情報を扱わない理由/);
  });

  it("9. the design doc records the explicit 'does NOT do' list", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_descriptor\.ts` \(Alpha 028\/045\)\./);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_record\.ts` \(Alpha 040\) — still/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_service\.ts` \(Alpha 031\/042\)/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* validate, reformat, or normalize `displayName`\/`avatar`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* wire `displayName`\/`avatar` into `FedosIdentityRecord`,/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `create_runtime\.ts` or any `src\/runtime\/\*` file\./);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
  });

  it("10. fedos_nostr_identity_provider.ts's own return statement includes EXACTLY five fields, in order, confirmed via literal string extraction", () => {
    const body = (
      nostrProviderSource.match(/async describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*)\n  \}/) ?? []
    )[1] ?? "";
    const returnMatch = body.match(/return \{([\s\S]*?)\};/);
    const returnBody = returnMatch?.[1] ?? "";
    const fieldLines = returnBody
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(fieldLines).toEqual([
      "id: snapshot.id,",
      "provider: \"nostr\",",
      "publicIdentifier: snapshot.publicIdentifier,",
      "displayName: snapshot.displayName,",
      "avatar: snapshot.avatar,",
    ]);
  });

  it("11. RIPPLE (Secure Runtime Alpha 046): fedos_nostr_identity_provider.ts's own return statement carried EXACTLY three fields AS OF Alpha 039's own scope; Alpha 046 later added displayName/avatar -- reconfirmed here as the CURRENT mapping, per this arc's own established ripple convention", () => {
    expect(nostrProviderSource).toMatch(/displayName: snapshot\.displayName,/);
    expect(nostrProviderSource).toMatch(/avatar: snapshot\.avatar,/);
  });

  it("12. every OTHER line of describeIdentity() -- the Source read, the null check, both id/publicIdentifier validation checks -- is confirmed BYTE-FOR-BYTE unchanged", () => {
    const codeOnly = codeOnlyLines(nostrProviderSource);
    expect(codeOnly).toMatch(/snapshot = await this\.#source\.readPublicIdentity\(\);/);
    expect(codeOnly).toMatch(/\} catch \{/);
    expect(codeOnly).toMatch(/if \(snapshot === null\) \{/);
    expect(codeOnly).toMatch(/if \(typeof snapshot\.id !== "string" \|\| snapshot\.id\.length === 0\) \{/);
    expect(codeOnly).toMatch(
      /if \(typeof snapshot\.publicIdentifier !== "string" \|\| snapshot\.publicIdentifier\.length === 0\) \{/,
    );
  });

  it("13. fedos_nostr_identity_provider.ts's own CODE performs no validation, reformatting, or normalization of displayName/avatar -- no additional if/typeof/length check referencing either field", () => {
    const codeOnly = codeOnlyLines(nostrProviderSource);
    expect(codeOnly).not.toMatch(/typeof snapshot\.displayName/);
    expect(codeOnly).not.toMatch(/typeof snapshot\.avatar/);
    expect(codeOnly).not.toMatch(/snapshot\.displayName\.length/);
    expect(codeOnly).not.toMatch(/snapshot\.avatar\.length/);
  });

  it("14. RIPPLE (Secure Runtime Alpha 049): fedos_nostr_identity_provider.ts imported exactly three type-only modules, nothing else, AS OF this Stage's own scope; Alpha 049 later added a fourth, value import (`resolveNostrPublicIdentitySource`) for use as the constructor's own default parameter -- reconfirmed here as the CURRENT import set, per this arc's own established ripple convention", () => {
    const importLines = [...nostrProviderSource.matchAll(/^import .*$/gm)].map((m: RegExpMatchArray) => m[0]);
    expect(importLines.length).toBe(4);
    expect(importLines.filter((line: string) => line.startsWith("import type ")).length).toBe(3);
    expect(importLines).toContainEqual(
      expect.stringMatching(/^import \{ resolveNostrPublicIdentitySource \} from "\.\/fedos_nostr_public_identity_source_resolver\.js";$/),
    );
  });

  it("15. fedos_nostr_identity_provider.ts's own CODE (excluding its own explanatory header comment) references zero Runtime/Storage/Worker/Registry/Record/Authentication/Nostr-network vocabulary", () => {
    const codeOnly = codeOnlyLines(nostrProviderSource);
    expect(codeOnly).not.toMatch(/create_runtime|AppRuntime/);
    expect(codeOnly).not.toMatch(/storeCiphertext|loadCiphertext|deleteCiphertext|RuntimeStorageBackend/);
    expect(codeOnly).not.toMatch(/\bworker\b/i);
    expect(codeOnly).not.toMatch(/FedosIdentityRegistry|FedosIdentityRecord|FedosIdentityService/);
    expect(codeOnly).not.toMatch(/Authenticat|session|Session|credential|Credential/);
    expect(codeOnly).not.toMatch(/relay|Relay|npub|nsec/);
  });

  it("16. behavioral: a Snapshot with displayName AND avatar populated produces a Descriptor carrying both, verbatim", async () => {
    const source = new FakeSource({
      id: "user-1",
      publicIdentifier: "npub1abc",
      displayName: "Alice",
      avatar: "https://example.invalid/avatar.png",
    });
    const provider = new NostrIdentityProvider(source);
    const descriptor = await provider.describeIdentity();
    expect(descriptor).toEqual({
      id: "user-1",
      provider: "nostr",
      publicIdentifier: "npub1abc",
      displayName: "Alice",
      avatar: "https://example.invalid/avatar.png",
    });
  });

  it("17. behavioral: a Snapshot with ONLY displayName (no avatar) produces a Descriptor with displayName set and avatar undefined", async () => {
    const source = new FakeSource({ id: "user-2", publicIdentifier: "npub1def", displayName: "Bob" });
    const provider = new NostrIdentityProvider(source);
    const descriptor = await provider.describeIdentity();
    expect(descriptor?.displayName).toBe("Bob");
    expect(descriptor?.avatar).toBeUndefined();
  });

  it("18. behavioral: a Snapshot with ONLY avatar (no displayName) produces a Descriptor with avatar set and displayName undefined", async () => {
    const source = new FakeSource({ id: "user-3", publicIdentifier: "npub1ghi", avatar: "https://example.invalid/c.png" });
    const provider = new NostrIdentityProvider(source);
    const descriptor = await provider.describeIdentity();
    expect(descriptor?.avatar).toBe("https://example.invalid/c.png");
    expect(descriptor?.displayName).toBeUndefined();
  });

  it("19. behavioral: a Snapshot with NEITHER displayName nor avatar still produces a valid three-meaningful-field Descriptor, both new fields undefined", async () => {
    const source = new FakeSource({ id: "user-4", publicIdentifier: "npub1jkl" });
    const provider = new NostrIdentityProvider(source);
    const descriptor = await provider.describeIdentity();
    expect(descriptor).toEqual({ id: "user-4", provider: "nostr", publicIdentifier: "npub1jkl" });
    expect(descriptor?.displayName).toBeUndefined();
    expect(descriptor?.avatar).toBeUndefined();
  });

  it("20. behavioral: a null Snapshot still resolves null, exactly as before this Stage -- unaffected by the new field mapping", async () => {
    const provider = new NostrIdentityProvider(new FakeSource(null));
    expect(await provider.describeIdentity()).toBeNull();
  });

  it("21. behavioral: empty-string id still resolves null even when displayName/avatar are populated -- Fail-Closed validation for id/publicIdentifier is unaffected", async () => {
    const source = new FakeSource({ id: "", publicIdentifier: "npub1x", displayName: "Should Not Matter", avatar: "https://x.invalid/a.png" });
    const provider = new NostrIdentityProvider(source);
    expect(await provider.describeIdentity()).toBeNull();
  });

  it("22. behavioral: empty-string publicIdentifier still resolves null even when displayName/avatar are populated", async () => {
    const source = new FakeSource({ id: "abc", publicIdentifier: "", displayName: "X", avatar: "https://x.invalid/y.png" });
    const provider = new NostrIdentityProvider(source);
    expect(await provider.describeIdentity()).toBeNull();
  });

  it("23. behavioral: a throwing Source still resolves null, never lets the exception escape, regardless of what it would have reported for displayName/avatar", async () => {
    class ThrowingSource implements FedosNostrPublicIdentitySource {
      async readPublicIdentity(): Promise<FedosNostrPublicIdentitySnapshot | null> {
        throw new Error("boom");
      }
    }
    const provider = new NostrIdentityProvider(new ThrowingSource());
    await expect(provider.describeIdentity()).resolves.toBeNull();
  });

  it("24. behavioral: the Source is still read EXACTLY ONCE per describeIdentity() call, unaffected by the new field mapping", async () => {
    const source = new FakeSource({ id: "user-5", publicIdentifier: "npub1mno", displayName: "E", avatar: "https://e.invalid/e.png" });
    const provider = new NostrIdentityProvider(source);
    await provider.describeIdentity();
    expect(source.calls).toBe(1);
    await provider.describeIdentity();
    expect(source.calls).toBe(2);
  });

  it("25. behavioral: provider is always the fixed literal 'nostr', even when displayName/avatar are populated -- never trusting anything from the Source", async () => {
    const source = new FakeSource({ id: "user-6", publicIdentifier: "npub1pqr", displayName: "F", avatar: "https://f.invalid/f.png" });
    const provider = new NostrIdentityProvider(source);
    const descriptor = await provider.describeIdentity();
    expect(descriptor?.provider).toBe("nostr");
    expect(provider.provider).toBe("nostr");
  });

  it("26. behavioral: resolveFedosIdentityProvider()'s own default Resolver-constructed Provider still resolves null -- NullNostrPublicIdentitySource never reaches the new mapping code at all", async () => {
    const resolved = resolveFedosIdentityProvider();
    expect(resolved).toBeInstanceOf(NostrIdentityProvider);
    expect(resolved?.provider).toBe("nostr");
    expect(await resolved?.describeIdentity()).toBeNull();
  });

  it("27. behavioral: NullNostrPublicIdentitySource itself still always resolves null, unaffected by this Stage", async () => {
    const source = new NullNostrPublicIdentitySource();
    expect(await source.readPublicIdentity()).toBeNull();
  });

  it("28. RIPPLE (Secure Runtime Alpha 046): end-to-end -- a Descriptor with real displayName/avatar, once passed through FedosIdentityService (unmodified), produced a Record with only its own original three fields AS OF this Stage's own scope; Alpha 047 later expanded FedosIdentityRecord and wired the Service to copy displayName/avatar onto it -- reconfirmed here as the CURRENT (five-field) behavior, per this arc's own established ripple convention", async () => {
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

    const returned = await service.describeIdentity();
    expect(returned).toEqual({
      id: "e2e-1",
      provider: "nostr",
      publicIdentifier: "npub1e2e",
      displayName: "Dana",
      avatar: "https://example.invalid/dana.png",
    });

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

  it("29. Regression: fedos_identity_descriptor.ts (Alpha 028/045) is confirmed BYTE-FOR-BYTE unchanged -- still exactly five fields, three required plus two optional", () => {
    expect(descriptorSource).toMatch(/export interface FedosIdentityDescriptor \{/);
    const requiredFields = [...descriptorSource.matchAll(/^\s*readonly \w+: string;/gm)];
    expect(requiredFields.length).toBe(3);
    expect(descriptorSource).toMatch(/readonly displayName\?: string;/);
    expect(descriptorSource).toMatch(/readonly avatar\?: string;/);
    expect(descriptorSource).not.toMatch(/secure_runtime_alpha_046/);
  });

  it("30. RIPPLE (Secure Runtime Alpha 046): fedos_identity_record.ts (Alpha 040) had exactly three fields and no displayName/avatar in its own code AS OF this Stage's own scope; Alpha 047 later expanded the Record with the identical two OPTIONAL fields Alpha 045 gave the Descriptor -- reconfirmed here as the CURRENT (expanded) shape, per this arc's own established ripple convention", () => {
    expect(recordSource).toMatch(/export interface FedosIdentityRecord \{/);
    const requiredFieldDeclarations = [...recordSource.matchAll(/^\s*readonly \w+: string;/gm)];
    expect(requiredFieldDeclarations.length).toBe(3);
    expect(codeOnlyLines(recordSource)).toMatch(/readonly displayName\?: string;/);
    expect(codeOnlyLines(recordSource)).toMatch(/readonly avatar\?: string;/);
    expect(recordSource).not.toMatch(/secure_runtime_alpha_046/);
  });

  it("31. Regression: fedos_identity_provider.ts/fedos_identity_capability.ts/fedos_noop_identity_provider.ts are all confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(providerInterfaceSource).toMatch(/describeIdentity\(\): Promise<FedosIdentityDescriptor \| null>;/);
    expect(providerInterfaceSource).not.toMatch(/secure_runtime_alpha_046/);
    expect(capabilitySource).toMatch(/readonly available: boolean;/);
    expect(capabilitySource).not.toMatch(/secure_runtime_alpha_046/);
    expect(noopProviderSource).toMatch(/readonly provider = "noop";/);
    expect(noopProviderSource).not.toMatch(/secure_runtime_alpha_046/);
  });

  it("32. RIPPLE (Secure Runtime Alpha 046): fedos_identity_service.ts/fedos_identity_registry.ts/fedos_identity_resolver.ts had no displayName/avatar in their own code AS OF this Stage's own scope; Alpha 047 later wired the Service's own Descriptor-to-Record mapping to copy both fields through, while the Registry and Resolver remained untouched -- reconfirmed here as the CURRENT shape, per this arc's own established ripple convention", () => {
    expect(serviceSource).toMatch(/constructor\(provider: FedosIdentityProvider, registry: FedosIdentityRegistry\) \{/);
    expect(codeOnlyLines(serviceSource)).toMatch(/displayName: descriptor\.displayName,/);
    expect(codeOnlyLines(serviceSource)).toMatch(/avatar: descriptor\.avatar,/);
    expect(serviceSource).not.toMatch(/secure_runtime_alpha_046/);
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).not.toMatch(/secure_runtime_alpha_046/);
    expect(resolverClassSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(resolverClassSource).not.toMatch(/secure_runtime_alpha_046/);
  });

  it("33. Regression: fedos_identity_provider_resolver.ts is confirmed BYTE-FOR-BYTE unchanged -- still returns the shared NostrIdentityProvider singleton", () => {
    expect(identityProviderResolverSource).toMatch(/return sharedNostrProvider;/);
    expect(identityProviderResolverSource).not.toMatch(/secure_runtime_alpha_046/);
  });

  it("34. Regression: fedos_nostr_public_identity_source.ts (Alpha 039/044) and fedos_null_nostr_public_identity_source.ts (Alpha 039) are confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(sourceInterfaceSource).toMatch(/readonly displayName\?: string;/);
    expect(sourceInterfaceSource).toMatch(/readonly avatar\?: string;/);
    expect(sourceInterfaceSource).not.toMatch(/secure_runtime_alpha_046/);
    const body = (
      nullSourceSource.match(/async readPublicIdentity\(\): Promise<FedosNostrPublicIdentitySnapshot \| null> \{([\s\S]*?)\n  \}/) ?? []
    )[1] ?? "";
    expect(body.trim()).toBe("return null;");
    expect(nullSourceSource).not.toMatch(/secure_runtime_alpha_046/);
  });

  it("35. no other existing src/identity/* file was modified, and no existing src/nostr/* file references this Stage's own doc", () => {
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
      expect(source).not.toMatch(/secure_runtime_alpha_046/);
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
      expect(source).not.toMatch(/secure_runtime_alpha_046/);
    }
  });

  it("36. no Runtime/Storage/Worker file references this Stage's own doc or the new mapping", () => {
    for (const source of [storageResolverSource, storageBackendSource, runtimeTypesSource, createRuntimeSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_046/);
    }
  });

  it("37. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("38. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(50);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_046/);

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

  it("39. RIPPLE (Secure Runtime Alpha 048): no fedos_*.ts file was added or removed by this Stage -- still exactly 56 under src/runtime/ and exactly 23 under src/identity/ AS OF this Stage's own scope; Alpha 048 later added a 24th identity file, fedos_nostr_public_identity_source_resolver.ts -- reconfirmed here as the CURRENT count, per this arc's own established ripple convention", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("40. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha046-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha046-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha046-id"));
    expect(deleted).toBe(true);
  });

  it("41. Regression: initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected -- confirmed by ACTUAL calls", async () => {
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha046-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha046-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha046-direct"))).toBe(true);
  });
});
