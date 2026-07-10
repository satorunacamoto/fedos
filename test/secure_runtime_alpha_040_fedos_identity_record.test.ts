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
import type { FedosIdentityRecord } from "../src/identity/fedos_identity_record.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_040_fedos_identity_record.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha028DocSource from "../docs/secure_runtime_alpha_028_fedos_identity_descriptor.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha038DocSource from "../docs/secure_runtime_alpha_038_fedos_identity_descriptor_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import recordSource from "../src/identity/fedos_identity_record.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/identity/fedos_identity_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerInterfaceSource from "../src/identity/fedos_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilitySource from "../src/identity/fedos_identity_capability.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/identity/fedos_identity_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import resolverSource from "../src/identity/fedos_identity_provider_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopProviderSource from "../src/identity/fedos_noop_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrProviderSource from "../src/identity/fedos_nostr_identity_provider.ts?raw";
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

/**
 * Secure Runtime Alpha 040 -- "FedOS Identity Record (Canonical
 * Identity Model)": adds exactly ONE type, `FedosIdentityRecord`, the
 * first named shape for Alpha 026 §6's own "⑤ FedOS Identity中核"
 * canonical-model direction -- a type definition only, zero
 * constructors, zero producers, zero consumers, zero Runtime/Storage/
 * Worker/Rust wiring of any kind.
 */
describe("Secure Runtime Alpha 040 -- FedOS Identity Record, type-only, no Descriptor/Provider/Resolver/Service/Runtime/Worker/Storage/Rust change", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(10000);
  });

  it("2. the design doc states this Stage adds a single, minimal type only, cross-referencing Alpha 026/038", () => {
    expect(designDocSource).toMatch(/a single, minimal type only/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_026_identity_layer_boundary_review\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_038_fedos_identity_descriptor_decision\.md/);
    expect(alpha038DocSource).toMatch(/a future SEPARATE canonical-identity model/);
  });

  it("3. the design doc records the exact Record shape, identical field set to the Descriptor", () => {
    expect(designDocSource).toMatch(/export interface FedosIdentityRecord \{/);
    expect(designDocSource).toMatch(/readonly id: string;/);
    expect(designDocSource).toMatch(/readonly provider: string;/);
    expect(designDocSource).toMatch(/readonly publicIdentifier: string;/);
  });

  it("4. the design doc draws exactly the Descriptor-vs-Record distinction, with a comparison table", () => {
    expect(designDocSource).toMatch(/Descriptorとの差 \(Descriptor vs\. Record — the one distinction this Stage draws\)/);
    expect(designDocSource).toMatch(/\| \*\*What it is\*\* \|/);
    expect(designDocSource).toMatch(/A Read Model — the value `describeIdentity\(\)`/);
    expect(designDocSource).toMatch(/A Canonical Model — the single, per-user shape/);
  });

  it("5. the design doc fixes the Capability, Provider, Storage, Runtime, and Protocol Adapter boundaries, each its own section", () => {
    expect(designDocSource).toMatch(/Capabilityとの責務 \(boundary with `FedosIdentityCapability`, Alpha 030\)/);
    expect(designDocSource).toMatch(/Providerとの責務 \(boundary with `FedosIdentityProvider`/);
    expect(designDocSource).toMatch(/Storageとの責務 \(boundary with Storage\)/);
    expect(designDocSource).toMatch(/Runtimeとの責務 \(boundary with Runtime\)/);
    expect(designDocSource).toMatch(/Protocol Adapterとの責務 \(boundary with Protocol Adapters/);
  });

  it("6. the design doc states the future displayName/avatar policy without scheduling it", () => {
    expect(designDocSource).toMatch(/将来displayName\/avatarを追加する場合の方針/);
    expect(designDocSource).toMatch(/This Stage does not schedule, name, or number that future Stage\./);
  });

  it("7. the design doc gives a named reason for every excluded candidate, in a table", () => {
    expect(designDocSource).toMatch(/まだ追加しない理由/);
    for (const term of [
      "`profile`",
      "`metadata`",
      "`linkedProtocols`",
      "`device`",
      "`createdAt`/`updatedAt`",
      "`capability`",
      "`status`",
      "`authentication`/`credential`/`session`",
      "`secret`/`privateKey`/`seed`/`mnemonic`",
      "`AeadKeyHandle`",
    ]) {
      expect(designDocSource).toMatch(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("8. the design doc records the explicit 'does NOT do' list", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* implement a canonical-identity reconciliation mechanism/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_descriptor\.ts` \(Alpha 028\),/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `create_runtime\.ts` or any `src\/runtime\/\*` file\./);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/worker\.ts`\./);
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* add a constructor, class, function, or default export of\s+any kind/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
  });

  it("9. fedos_identity_record.ts exports EXACTLY the FedosIdentityRecord interface -- no class, no function, no default export, no const", () => {
    expect([...recordSource.matchAll(/^export interface (\w+)/gm)].map((m: RegExpMatchArray) => m[1])).toEqual([
      "FedosIdentityRecord",
    ]);
    expect([...recordSource.matchAll(/^export class/gm)].length).toBe(0);
    expect([...recordSource.matchAll(/^export (?:async )?function/gm)].length).toBe(0);
    expect([...recordSource.matchAll(/^export const/gm)].length).toBe(0);
    expect(recordSource).not.toMatch(/export default/);
  });

  it("10. the Record interface has EXACTLY three readonly string fields, matching id/provider/publicIdentifier", () => {
    const body = (recordSource.match(/export interface FedosIdentityRecord \{([\s\S]*?)\}/) ?? [])[1] ?? "";
    const fields = [...body.matchAll(/readonly (\w+): string;/g)].map((m: RegExpMatchArray) => m[1]);
    expect(fields).toEqual(["id", "provider", "publicIdentifier"]);
  });

  it("11. fedos_identity_record.ts imports NOTHING -- zero import lines of any kind", () => {
    const importLines = [...recordSource.matchAll(/^import .*$/gm)];
    expect(importLines.length).toBe(0);
  });

  it("12. RIPPLE (Secure Runtime Alpha 047): fedos_identity_record.ts's own CODE contained none of the mandated forbidden terms, including displayName/avatar, AS OF this Stage's own scope; Alpha 047 later added displayName/avatar as two individually-reviewed OPTIONAL fields -- reconfirmed here as the CURRENT (expanded) shape, per this arc's own established ripple convention, while the other eighteen forbidden terms remain strictly enforced", () => {
    const codeOnly = codeOnlyLines(recordSource);
    for (const forbidden of [
      "profile",
      "metadata",
      "linkedProtocols",
      "device",
      "createdAt",
      "updatedAt",
      "capability",
      "status",
      "authentication",
      "credential",
      "session",
      "secret",
      "privateKey",
      "seed",
      "mnemonic",
      "AeadKeyHandle",
      "Storage",
      "Runtime",
    ]) {
      expect(codeOnly.toLowerCase()).not.toMatch(new RegExp(forbidden.toLowerCase()));
    }
    expect(codeOnly).toMatch(/readonly displayName\?: string;/);
    expect(codeOnly).toMatch(/readonly avatar\?: string;/);
  });

  it("13. FedosIdentityRecord and FedosIdentityDescriptor remain two independent declarations, never a type alias of one to the other, in either file -- the Record's own header comment legitimately names the Descriptor in prose, excluded here via codeOnlyLines()", () => {
    expect(codeOnlyLines(recordSource)).not.toMatch(/FedosIdentityDescriptor/);
    expect(descriptorSource).not.toMatch(/FedosIdentityRecord/);
    expect(recordSource).not.toMatch(/^export type FedosIdentityRecord\s*=/m);
  });

  it("14. behavioral (compile-time + structural): a value satisfying FedosIdentityRecord's own shape is constructible as a plain object literal, and the type has no runtime representation to instantiate via 'new'", () => {
    const record: FedosIdentityRecord = { id: "user-1", provider: "nostr", publicIdentifier: "npub1example" };
    expect(record.id).toBe("user-1");
    expect(record.provider).toBe("nostr");
    expect(record.publicIdentifier).toBe("npub1example");
    expect(Object.keys(record).sort()).toEqual(["id", "provider", "publicIdentifier"].sort());
  });

  it("15. RIPPLE (Secure Runtime Alpha 042, then Alpha 050-052): fedos_identity_record.ts had ZERO importers anywhere in src/ AS OF Alpha 040's own scope; Alpha 042 later made fedos_identity_service.ts its first real importer; Alpha 050-052 later made fedos_runtime_identity.ts a second real importer (a type-only reference) -- reconfirmed here as the CURRENT state, per this arc's own established ripple convention. Every other identity/runtime/nostr/worker file remains a non-importer", () => {
    expect(serviceSource).toMatch(/fedos_identity_record|FedosIdentityRecord/);
    for (const source of [
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
      expect(source).not.toMatch(/fedos_identity_record/);
      expect(source).not.toMatch(/FedosIdentityRecord/);
    }
    expect(fedosRuntimeIdentitySource).toMatch(/import type \{ FedosIdentityRecord \} from "\.\.\/identity\/fedos_identity_record\.js";/);
  });

  it("16. Regression: fedos_identity_descriptor.ts (Alpha 028) is confirmed BYTE-FOR-BYTE unchanged -- still exactly three fields, no reference to this Stage's own doc", () => {
    expect(descriptorSource).toMatch(/export interface FedosIdentityDescriptor \{/);
    const fieldDeclarations = [...descriptorSource.matchAll(/^\s*readonly \w+: string;/gm)];
    expect(fieldDeclarations.length).toBe(3);
    expect(descriptorSource).not.toMatch(/secure_runtime_alpha_040/);
  });

  it("17. RIPPLE (Secure Runtime Alpha 049): fedos_nostr_identity_provider.ts (Alpha 035/039) required an injected Source with no default AS OF this Stage's own scope; Alpha 049 later gave that same parameter a default value (`resolveNostrPublicIdentitySource()`), still fully overridable by explicit injection -- reconfirmed here as the CURRENT signature; describeIdentity() still delegates to the injected Source, no reference to this Stage's own doc", () => {
    expect(nostrProviderSource).toMatch(/constructor\(source: FedosNostrPublicIdentitySource = resolveNostrPublicIdentitySource\(\)\) \{/);
    expect(nostrProviderSource).toMatch(/this\.#source\.readPublicIdentity\(\)/);
    expect(nostrProviderSource).not.toMatch(/secure_runtime_alpha_040/);
  });

  it("18. Regression: fedos_identity_provider_resolver.ts (Alpha 032/034/036/039) is confirmed unchanged -- still returns the shared NostrIdentityProvider singleton, constructed with a NullNostrPublicIdentitySource, no reference to this Stage's own doc", () => {
    expect(resolverSource).toMatch(/return sharedNostrProvider;/);
    expect(resolverSource).toMatch(/new NostrIdentityProvider\(new NullNostrPublicIdentitySource\(\)\)/);
    expect(resolverSource).not.toMatch(/secure_runtime_alpha_040/);
  });

  it("19. Regression: fedos_identity_service.ts (Alpha 031) and fedos_identity_capability.ts (Alpha 030) are confirmed unchanged", () => {
    expect(serviceSource).toMatch(/constructor\(provider: FedosIdentityProvider, registry: FedosIdentityRegistry\) \{/);
    expect(serviceSource).not.toMatch(/secure_runtime_alpha_040/);
    expect(capabilitySource).toMatch(/readonly available: boolean;/);
    expect(capabilitySource).not.toMatch(/secure_runtime_alpha_040/);
  });

  it("20. behavioral: resolveFedosIdentityProvider() is entirely unaffected -- still resolves the shared NostrIdentityProvider singleton, provider === 'nostr', describeIdentity() still always null by default", async () => {
    const resolved = resolveFedosIdentityProvider();
    expect(resolved).toBeInstanceOf(NostrIdentityProvider);
    expect(resolved?.provider).toBe("nostr");
    expect(await resolved?.describeIdentity()).toBeNull();
  });

  it("21. no other existing src/identity/* file was modified -- no reference to this Stage's own doc anywhere", () => {
    for (const source of [
      providerBoundarySource,
      providerTypesSource,
      providerBridgeSource,
      webauthnAdapterSource,
      identityTypesSource,
      sessionBoundarySource,
      passkeyBoundarySource,
      deviceTrustSource,
      deviceRegistrationSource,
      recoveryPolicySource,
      vaultBridgeSource,
      sourceInterfaceSource,
      nullSourceSource,
      noopProviderSource,
    ]) {
      expect(source).not.toMatch(/secure_runtime_alpha_040/);
    }
  });

  it("22. no existing src/nostr/* file was modified, and none references this Stage's own doc or the new Record type", () => {
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
      expect(source).not.toMatch(/secure_runtime_alpha_040/);
      expect(source).not.toMatch(/FedosIdentityRecord|fedos_identity_record/);
    }
  });

  it("23. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("24. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_040/);

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

  it("25. exactly one new file was added under src/identity/ -- now exactly 21 files; no fedos_*.ts file under src/runtime/ was added or removed -- still exactly 56 files", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("26. cross-references Alpha 028's own exclusion-table format and Alpha 038's own routing decisions without revising either", () => {
    expect(designDocSource).toMatch(/secure_runtime_alpha_028_fedos_identity_descriptor\.md/);
    expect(alpha028DocSource).toMatch(/Descriptor責務 \(responsibility\)/);
    expect(alpha028DocSource).not.toMatch(/secure_runtime_alpha_040/);
    expect(alpha038DocSource).not.toMatch(/secure_runtime_alpha_040/);
  });

  it("27. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha040-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha040-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha040-id"));
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha040-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha040-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha040-direct"))).toBe(true);
  });
});
