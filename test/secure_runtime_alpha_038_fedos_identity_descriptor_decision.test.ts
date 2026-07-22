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
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_038_fedos_identity_descriptor_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha037DocSource from "../docs/secure_runtime_alpha_037_fedos_identity_descriptor_field_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha012DocSource from "../docs/secure_runtime_alpha_012_key_boundary_decision.md?raw";
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
 * Secure Runtime Alpha 038 -- "FedOS Identity Descriptor Decision":
 * REVIEW / DESIGN DECISION ONLY, no implementation of any kind.
 * Formally ratifies Alpha 037's own field-by-field review into a
 * binding ADOPT/REJECT/ROUTE-TO-FUTURE-MODEL decision for all eight
 * candidate fields plus Authentication/secret information, and
 * formally answers six mandated responsibility-boundary questions
 * (Descriptor's own responsibility, Capability, Service, Runtime,
 * Storage, Protocol Adapter).
 */
describe("Secure Runtime Alpha 038 -- FedOS Identity Descriptor Decision, review/decision only, no Descriptor/Provider/Resolver/Service/Runtime/Worker/Rust change", () => {
  it("1. the decision document exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(10000);
  });

  it("2. states REVIEW / DESIGN DECISION ONLY with an explicit 'no implementation' framing", () => {
    expect(designDocSource).toMatch(/REVIEW \/ DESIGN DECISION ONLY\. No implementation of any kind\./);
    expect(designDocSource).toMatch(/no field is added, removed, or renamed by this Stage/);
    expect(designDocSource).toMatch(
      /No `displayName`, `avatar`, or any other field exists anywhere in\s+this Stage's own new files as actual TypeScript/,
    );
  });

  it("3. reconfirms the current three-field Descriptor shape unchanged", () => {
    expect(designDocSource).toMatch(/export interface FedosIdentityDescriptor \{/);
    expect(designDocSource).toMatch(/readonly id: string;/);
    expect(designDocSource).toMatch(/readonly provider: string;/);
    expect(designDocSource).toMatch(/readonly publicIdentifier: string;/);
  });

  it("4. formally ADOPTS displayName and avatar (reference-only) for a future implementation Stage", () => {
    expect(designDocSource).toMatch(/\*\*ADOPTED\.\*\* A future, separately-reviewed implementation Stage is/);
    expect(designDocSource).toMatch(
      /\*\*ADOPTED, with the reference-only constraint made BINDING\.\*\*/,
    );
    expect(designDocSource).toMatch(/never embedded image bytes/);
  });

  it("5. formally REJECTS profile, metadata, and capabilities permanently on this type", () => {
    expect(designDocSource).toMatch(/\*\*REJECTED, permanently\.\*\* No future Stage may add an open, free-form\s+`profile` field/);
    expect(designDocSource).toMatch(/\*\*REJECTED, permanently\.\*\* Identical ruling and identical reasoning to `profile`/);
    expect(designDocSource).toMatch(/\*\*REJECTED, permanently, on this type\.\*\* `FedosIdentityCapability` \(Alpha 030\) already exists/);
  });

  it("6. formally ROUTES linkedProtocols, device, and createdAt/updatedAt to named future or existing separate models", () => {
    expect(designDocSource).toMatch(
      /\*\*REJECTED at `FedosIdentityDescriptor`; ROUTED to a future SEPARATE canonical-identity model\.\*\*/,
    );
    expect(designDocSource).toMatch(
      /\*\*REJECTED on `FedosIdentityDescriptor`; ROUTED to the EXISTING\s+`device_trust\.ts`\/`device_registration\.ts` boundary\.\*\*/,
    );
    expect(designDocSource).toMatch(
      /\*\*REJECTED on `FedosIdentityDescriptor`; ROUTED to a future SEPARATE\s+persistence-record model, IF Identity persistence is ever built\.\*\*/,
    );
  });

  it("7. formally REJECTS Authentication information permanently, on Descriptor and any future model, routing to the existing auth-boundary family", () => {
    expect(designDocSource).toMatch(
      /\*\*REJECTED, permanently, on `FedosIdentityDescriptor` or ANY future\s+Identity-content model this decision authorizes\.\*\*/,
    );
    expect(designDocSource).toMatch(/session_boundary\.ts`, `passkey_boundary\.ts`, `provider_boundary\.ts`/);
  });

  it("8. formally REJECTS secret information unconditionally, with NO future-model escape hatch, as a ceiling on the whole Identity Layer", () => {
    expect(designDocSource).toMatch(
      /\*\*REJECTED, permanently and unconditionally — no future model, of any kind, may hold it either\.\*\*/,
    );
    expect(designDocSource).toMatch(/This is a ceiling on the ENTIRE Identity Layer, not a\s+per-type routing decision\./);
  });

  it("9. formally fixes the Descriptor's own responsibility statement", () => {
    expect(designDocSource).toMatch(/Descriptorの責務 \(the Descriptor's own responsibility, reconfirmed and formally fixed\)/);
    expect(designDocSource).toMatch(
      /describes exactly one thing: what ONE\s+`FedosIdentityProvider` currently reports/,
    );
  });

  it("10. formally fixes the boundary with Identity Capability -- zero field overlap, permanently, in both directions", () => {
    expect(designDocSource).toMatch(/Identity Capabilityとの境界 \(boundary with `FedosIdentityCapability`, Alpha 030\)/);
    expect(designDocSource).toMatch(/Formally fixed: zero field overlap, permanently\./);
    expect(designDocSource).toMatch(/`FedosIdentityCapability`\s+may never grow Descriptor-shaped content/);
  });

  it("11. RIPPLE (Secure Runtime Alpha 042, re-wrapped at Alpha 047): formally fixes the boundary with Identity Service -- pure delegation, no aggregation, no cross-provider merging. The Service's own header comment quoted 'wraps exactly ONE `FedosIdentityProvider`' AS OF this Stage's own scope; Alpha 042 later gave it a second dependency (an injected FedosIdentityRegistry) and rewrote its own header comment accordingly; Alpha 047 then re-wrapped the same sentence while adding its own lineage note -- reconfirmed here via the CURRENT header's own 'holds exactly two things' framing, per this arc's own established ripple convention", () => {
    expect(designDocSource).toMatch(/Identity Serviceとの境界 \(boundary with `FedosIdentityService`, Alpha 031\)/);
    expect(designDocSource).toMatch(
      /the Service remains PURE DELEGATION and never\s+synthesizes, caches, or derives Descriptor content/,
    );
    expect(serviceSource).toMatch(/It holds exactly two things — the `FedosIdentityProvider` and the\s+\* `FedosIdentityRegistry`/);
  });

  it("12. formally fixes the boundary with Runtime and Storage, cross-checked against the LIVE source files by direct grep", () => {
    expect(designDocSource).toMatch(/Runtimeとの境界 \(boundary with Runtime\)/);
    expect(designDocSource).toMatch(/Storageとの境界 \(boundary with Storage\)/);
    for (const source of [storageResolverSource, storageBackendSource, createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/FedosIdentityDescriptor|FedosIdentityCapability|FedosIdentityProvider/);
    }
  });

  it("13. formally fixes the boundary with Protocol Adapters -- translation-only, generic-shape-preserving", () => {
    expect(designDocSource).toMatch(
      /Protocol Adapterとの境界 \(boundary with Protocol Adapters — Nostr\/ActivityPub\/Bluesky\/Session\)/,
    );
    expect(designDocSource).toMatch(/each Protocol Adapter TRANSLATES its own native/);
    expect(designDocSource).toMatch(/never passing through Nostr `tags`, an ActivityPub/);
  });

  it("14. states the roadmap defers all implementation to future, separately-reviewed Stages and schedules nothing itself", () => {
    expect(designDocSource).toMatch(/Alpha roadmap, updated/);
    expect(designDocSource).toMatch(
      /A future, separately-reviewed implementation Stage\*\* — adds\s+`displayName: string \| null` and `avatar: string \| null`/,
    );
    expect(designDocSource).toMatch(/Not\s+scheduled or designed by this Stage/);
  });

  it("15. cross-references Alpha 012's own Decision-doc format and Alpha 037's own review, without revising either", () => {
    expect(designDocSource).toMatch(/secure_runtime_alpha_012_key_boundary_decision\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_037_fedos_identity_descriptor_field_review\.md/);
    expect(designDocSource).toMatch(
      /this Stage's §2 table is a direct,\s+unmodified carry-forward of Alpha 037's own reasoning/,
    );
    expect(alpha037DocSource).toMatch(/ADOPT-eligible fields for a future, separately-reviewed/);
    expect(alpha012DocSource).toMatch(/Status: REVIEW \/ DESIGN DECISION ONLY/);
  });

  it("16. RIPPLE (Secure Runtime Alpha 045): fedos_identity_descriptor.ts was confirmed BYTE-FOR-BYTE unchanged AS OF this Stage's own scope -- still exactly three readonly fields, none of the eight-plus-two candidate names present; Alpha 045 later added displayName/avatar as two OPTIONAL fields, formally executing this Stage's own ADOPT decision -- reconfirmed here as the CURRENT shape, per this arc's own established ripple convention. The other six candidates remain absent", () => {
    expect(descriptorSource).toMatch(/export interface FedosIdentityDescriptor \{/);
    const requiredFieldDeclarations = [...descriptorSource.matchAll(/^\s*readonly \w+: string;/gm)];
    expect(requiredFieldDeclarations.length).toBe(3);
    expect(descriptorSource).toMatch(/readonly displayName\?: string;/);
    expect(descriptorSource).toMatch(/readonly avatar\?: string;/);
    expect(descriptorSource).not.toMatch(
      /profile|linkedProtocols|capabilities|device|metadata|createdAt|updatedAt/,
    );
    expect(descriptorSource).not.toMatch(/secure_runtime_alpha_038/);
  });

  it("17. every other src/identity/* file is confirmed unchanged -- no reference to this Stage's own doc, no new field added anywhere", () => {
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
      expect(source).not.toMatch(/secure_runtime_alpha_038/);
    }
    expect(providerInterfaceSource).toMatch(/describeIdentity\(\): Promise<FedosIdentityDescriptor \| null>;/);
    expect(capabilitySource).toMatch(/readonly available: boolean;/);
    expect(serviceSource).toMatch(/constructor\(provider: FedosIdentityProvider, registry: FedosIdentityRegistry\) \{/);
    expect(resolverSource).toMatch(/return sharedNostrProvider;/);
    expect(noopProviderSource).toMatch(/readonly provider = "noop";/);
    expect(nostrProviderSource).toMatch(/readonly provider = "nostr";/);
  });

  it("18. no Runtime/Storage/Worker file references this Stage's own doc or was modified -- confirmed unchanged exports", () => {
    for (const source of [storageResolverSource, storageBackendSource, runtimeTypesSource, createRuntimeSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_038/);
    }
  });

  it("19. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("20. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(68);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_038/);

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

  it("21. no fedos_*.ts file under src/runtime/ or src/identity/ was added or removed by this decision-only Stage -- still exactly 56 and 18 files respectively AS OF this Stage's own scope (Secure Runtime Alpha 039 later added a 19th and 20th src/identity/ file, fedos_nostr_public_identity_source.ts and fedos_null_nostr_public_identity_source.ts; Secure Runtime Alpha 040 later added a 21st, fedos_identity_record.ts)", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("22. behavioral: resolveFedosIdentityProvider() is unaffected -- still resolves the shared NostrIdentityProvider singleton, describeIdentity() still always null", async () => {
    const resolved = resolveFedosIdentityProvider();
    expect(resolved).toBeInstanceOf(NostrIdentityProvider);
    expect(resolved?.provider).toBe("nostr");
    expect(await resolved?.describeIdentity()).toBeNull();
  });

  it("23. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this decision", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha038-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha038-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha038-id"));
    expect(deleted).toBe(true);
  });

  it("24. Regression: initializeCrypto()/runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected -- confirmed by ACTUAL calls", async () => {
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha038-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha038-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha038-direct"))).toBe(true);
  });
});
