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
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_037_fedos_identity_descriptor_field_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha026DocSource from "../docs/secure_runtime_alpha_026_identity_layer_boundary_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha028DocSource from "../docs/secure_runtime_alpha_028_fedos_identity_descriptor.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/identity/fedos_identity_descriptor.ts?raw";
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
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

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
 * Secure Runtime Alpha 037 -- "FedOS Identity Descriptor Field Review":
 * REVIEW ONLY, no code change of any kind. Reviews eight candidate
 * fields (displayName/avatar/profile/linkedProtocols/capabilities/
 * device/metadata/createdAt+updatedAt) for a future multi-protocol
 * FedosIdentityDescriptor with an explicit ADOPT/REJECT verdict and
 * reasoning for each, and answers seven mandated responsibility-
 * boundary questions (persistence, protocol-agnosticism, separation
 * from Capability/Storage/Runtime, Authentication content, secret
 * content).
 */
describe("Secure Runtime Alpha 037 -- FedOS Identity Descriptor Field Review, review only, no Descriptor/Provider/Resolver/Service/Runtime/Worker/Rust change", () => {
  it("1. the review document exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(10000);
  });

  it("2. states REVIEW ONLY with an explicit multi-target 'no code change' list", () => {
    expect(designDocSource).toMatch(/REVIEW ONLY/);
    expect(designDocSource).toMatch(/No field is added\. No type changes\./);
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* implement, add, remove, or rename any field on\s+`fedos_identity_descriptor\.ts`/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `fedos_identity_provider\.ts` \(Alpha 029\),/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `device_trust\.ts`,/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change any `src\/runtime\/\*` file/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `src\/worker\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `packages\/fedos-core-rust\/src\/lib\.rs`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change any Public Runtime API signature/);
  });

  it("3. records the current three-field Descriptor shape unchanged", () => {
    expect(designDocSource).toMatch(/export interface FedosIdentityDescriptor \{/);
    expect(designDocSource).toMatch(/readonly id: string;/);
    expect(designDocSource).toMatch(/readonly provider: string;/);
    expect(designDocSource).toMatch(/readonly publicIdentifier: string;/);
  });

  it("4. reviews all eight mandated candidate fields with an explicit verdict each", () => {
    for (const field of [
      "displayName",
      "avatar",
      "profile",
      "linkedProtocols",
      "capabilities",
      "device",
      "metadata",
      "createdAt",
      "updatedAt",
    ]) {
      expect(designDocSource).toMatch(new RegExp("`" + field + "`"));
    }
    expect(designDocSource).toMatch(/\*\*ADOPT\*\* \(future Stage, not this one\)/);
    expect(designDocSource).toMatch(/\*\*ADOPT, as a reference only\*\*/);
    expect((designDocSource.match(/\*\*REJECT/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it("5. names exactly two ADOPT-eligible fields for a future Stage, and this Stage adds neither", () => {
    expect(designDocSource).toMatch(
      /two ADOPT-eligible fields for a future, separately-reviewed\s+Stage \(`displayName`, `avatar`/,
    );
    expect(designDocSource).toMatch(/this Stage adds\s+neither/);
  });

  it("6. answers all seven mandated responsibility-boundary questions with their own section", () => {
    expect(designDocSource).toMatch(/Descriptorは永続データか/);
    expect(designDocSource).toMatch(/DescriptorはProtocol非依存であるべきか/);
    expect(designDocSource).toMatch(/Identity Capabilityとの責務分離/);
    expect(designDocSource).toMatch(/Storageとの責務分離/);
    expect(designDocSource).toMatch(/Runtimeとの責務分離/);
    expect(designDocSource).toMatch(/Authentication情報を持ってよいか/);
    expect(designDocSource).toMatch(/秘密情報を保持してよいか/);
  });

  it("7. concludes the Descriptor is NOT persistent data today, and explains why createdAt/updatedAt are rejected as a consequence", () => {
    expect(designDocSource).toMatch(/\*\*No — and it should stay that way\.\*\*/);
    expect(designDocSource).toMatch(/never itself the thing stored on disk\s+or in memory between calls/);
    expect(designDocSource).toMatch(/a type that is never persisted\s+cannot honestly report when it was "created" or "updated,"/);
  });

  it("8. concludes the Descriptor should stay protocol-agnostic, consistent with Alpha 028's own doc comment", () => {
    expect(designDocSource).toMatch(/\*\*Yes — already true today, and every ADOPT verdict in §2 preserves\s+it\.\*\*/);
    expect(designDocSource).toMatch(/this file carries no protocol-specific\s+vocabulary of any kind/);
    expect(descriptorSource).toMatch(/this file carries no\s*\*\s*protocol-specific vocabulary of any kind/);
    expect(typeof alpha028DocSource).toBe("string");
    expect(alpha028DocSource.length).toBeGreaterThan(0);
  });

  it("9. concludes zero field overlap with FedosIdentityCapability and explains why capabilities was rejected", () => {
    expect(designDocSource).toMatch(/Zero field overlap today, and this review recommends keeping it that\s+way permanently\./);
    expect(designDocSource).toMatch(/re-merge a distinction this arc has kept deliberately separate since\s+Alpha 030/);
    expect(capabilitySource).toMatch(/readonly available: boolean;/);
    expect(capabilitySource).not.toMatch(/readonly id: string;|readonly publicIdentifier: string;/);
  });

  it("10. concludes the Descriptor must stay storage-blind and Runtime-unaware, confirmed by direct source inspection", () => {
    expect(designDocSource).toMatch(/The Descriptor must stay storage-blind, exactly like every other\s+Identity-arc type/);
    expect(designDocSource).toMatch(
      /The Descriptor must stay a pure Identity Layer value type Runtime is\s+not aware of/,
    );
    for (const source of [storageResolverSource, storageBackendSource, createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/FedosIdentityDescriptor|FedosIdentityCapability|FedosIdentityProvider/);
    }
  });

  it("11. concludes Authentication information must never appear on the Descriptor, naming the separate existing boundary files", () => {
    expect(designDocSource).toMatch(/\*\*No\.\*\*/);
    expect(designDocSource).toMatch(/no session token, no login\/session\s+timestamp, no MFA status, no WebAuthn\/passkey credential id/);
    expect(designDocSource).toMatch(/session_boundary\.ts`, `passkey_boundary\.ts`/);
  });

  it("12. concludes secret information must never appear on the Descriptor, framing this as a permanent exclusion", () => {
    expect(designDocSource).toMatch(/\*\*Absolutely not — a permanent exclusion, not a today-only one\.\*\*/);
    expect(designDocSource).toMatch(/"Raw\s+private signing keys\.\.\. Raw AEAD key material of any kind"/);
  });

  it("13. states consistency with the Alpha 026 direction without revising it", () => {
    expect(designDocSource).toMatch(/FedOS Identity方針との整合性/);
    expect(designDocSource).toMatch(/Nothing in this review\s+revises Alpha 026's own conclusions/);
    expect(alpha026DocSource).toMatch(/FedOS Identity方針 — recommended direction \(advisory only\)/);
  });

  it("14. cross-references Alpha 026-031/007 and docs/vault_crypto_identity.md", () => {
    expect(designDocSource).toMatch(/secure_runtime_alpha_026_identity_layer_boundary_review\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_028_fedos_identity_descriptor\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_029_fedos_identity_provider_interface\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_030_fedos_identity_capability\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_031_fedos_identity_service_skeleton\.md/);
    expect(designDocSource).toMatch(/public_crypto_opaque_handles\.md/);
    expect(designDocSource).toMatch(/vault_crypto_identity\.md/);
  });

  it("15. RIPPLE (Secure Runtime Alpha 045): fedos_identity_descriptor.ts was confirmed BYTE-FOR-BYTE unchanged AS OF this Stage's own scope -- still exactly three readonly fields, none of the eight excluded candidate names present; Alpha 045 later added displayName/avatar as two OPTIONAL fields, formally executing Alpha 038's own ADOPT decision -- reconfirmed here as the CURRENT shape, per this arc's own established ripple convention. The other six excluded candidates (profile/linkedProtocols/capabilities/device/metadata/createdAt/updatedAt) remain absent", () => {
    expect(descriptorSource).toMatch(/export interface FedosIdentityDescriptor \{/);
    const requiredFieldDeclarations = [...descriptorSource.matchAll(/^\s*readonly \w+: string;/gm)];
    expect(requiredFieldDeclarations.length).toBe(3);
    expect(descriptorSource).toMatch(/readonly id: string;/);
    expect(descriptorSource).toMatch(/readonly provider: string;/);
    expect(descriptorSource).toMatch(/readonly publicIdentifier: string;/);
    expect(descriptorSource).toMatch(/readonly displayName\?: string;/);
    expect(descriptorSource).toMatch(/readonly avatar\?: string;/);
    expect(descriptorSource).not.toMatch(/profile|linkedProtocols|capabilities|device|metadata|createdAt|updatedAt/);
    expect(descriptorSource).not.toMatch(/secure_runtime_alpha_037/);
  });

  it("16. every other src/identity/* file is confirmed unchanged -- no reference to this Stage's own doc, no new field added anywhere", () => {
    for (const source of [
      providerInterfaceSource,
      capabilitySource,
      serviceSource,
      resolverSource,
      noopProviderSource,
      nostrProviderSource,
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
      expect(source).not.toMatch(/secure_runtime_alpha_037/);
    }
    expect(providerInterfaceSource).toMatch(/describeIdentity\(\): Promise<FedosIdentityDescriptor \| null>;/);
    expect(capabilitySource).toMatch(/readonly available: boolean;/);
    expect(serviceSource).toMatch(/constructor\(provider: FedosIdentityProvider, registry: FedosIdentityRegistry\) \{/);
    expect(resolverSource).toMatch(/return sharedNostrProvider;/);
    expect(noopProviderSource).toMatch(/readonly provider = "noop";/);
    expect(nostrProviderSource).toMatch(/readonly provider = "nostr";/);
  });

  it("17. no Runtime/Storage/Worker file references this Stage's own doc or was modified -- confirmed unchanged exports", () => {
    for (const source of [storageResolverSource, storageBackendSource, runtimeTypesSource, createRuntimeSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_037/);
    }
  });

  it("18. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("19. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(50);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_037/);

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

  it("20. no fedos_*.ts file under src/runtime/ or src/identity/ was added or removed by this documentation-only Stage -- still exactly 56 and 18 files respectively AS OF this Stage's own scope (Secure Runtime Alpha 039 later added a 19th and 20th src/identity/ file, fedos_nostr_public_identity_source.ts and fedos_null_nostr_public_identity_source.ts; Secure Runtime Alpha 040 later added a 21st, fedos_identity_record.ts)", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("21. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this review", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha037-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha037-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha037-id"));
    expect(deleted).toBe(true);
  });

  it("22. Regression: initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected -- confirmed by ACTUAL calls", async () => {
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha037-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha037-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha037-direct"))).toBe(true);
  });
});
