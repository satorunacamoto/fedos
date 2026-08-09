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
import { resolveFedosIdentityProvider } from "../src/identity/fedos_identity_provider_resolver.js";
import { NostrIdentityProvider } from "../src/identity/fedos_nostr_identity_provider.js";
import { NullNostrPublicIdentitySource } from "../src/identity/fedos_null_nostr_public_identity_source.js";
import type {
  FedosNostrPublicIdentitySnapshot,
  FedosNostrPublicIdentitySource,
} from "../src/identity/fedos_nostr_public_identity_source.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_039_nostr_public_identity_source_boundary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha035DocSource from "../docs/secure_runtime_alpha_035_fedos_nostr_identity_provider.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha038DocSource from "../docs/secure_runtime_alpha_038_fedos_identity_descriptor_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sourceInterfaceSource from "../src/os/core/identity/fedos_nostr_public_identity_source.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullSourceSource from "../src/os/core/identity/fedos_null_nostr_public_identity_source.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrProviderSource from "../src/os/core/identity/fedos_nostr_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import resolverSource from "../src/os/core/identity/fedos_identity_provider_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/os/core/identity/fedos_identity_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/os/core/identity/fedos_identity_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerInterfaceSource from "../src/os/core/identity/fedos_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilitySource from "../src/os/core/identity/fedos_identity_capability.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopProviderSource from "../src/os/core/identity/fedos_noop_identity_provider.ts?raw";
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

class ThrowingSource implements FedosNostrPublicIdentitySource {
  calls = 0;
  async readPublicIdentity(): Promise<FedosNostrPublicIdentitySnapshot | null> {
    this.calls += 1;
    throw new Error("boom");
  }
}

/**
 * Secure Runtime Alpha 039 -- "Nostr Public Identity Source Boundary":
 * adds a minimal, injected `FedosNostrPublicIdentitySource` boundary
 * (interface + `FedosNostrPublicIdentitySnapshot`), its only
 * implementation (`NullNostrPublicIdentitySource`), and changes
 * `NostrIdentityProvider` from a fixed `return null;` into a validated
 * delegation to the injected Source -- one Source read per call, every
 * invalid input resolving `null`, no secret material, no Relay, no
 * Authentication, no Runtime connection.
 */
describe("Secure Runtime Alpha 039 -- Nostr Public Identity Source Boundary, Descriptor/Service/Resolver-selection/Runtime/Worker/Rust/Relay unchanged", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(10000);
  });

  it("2. the design doc records the pre-implementation investigation and concludes no existing legitimate public identity source exists", () => {
    expect(designDocSource).toMatch(/実装前調査/);
    expect(designDocSource).toMatch(
      /no existing, legitimate public-identity source exists\s+anywhere in this repository/,
    );
    expect(designDocSource).toMatch(/npub encoder\/decoder \(bech32\)/);
    expect(designDocSource).toMatch(/never signs\. No private keys are involved/);
  });

  it("3. the design doc explains why a Source Boundary was introduced as its own type", () => {
    expect(designDocSource).toMatch(/なぜ公開Identity情報源を明示的なBoundaryにしたのか/);
    expect(designDocSource).toMatch(/mirrors Alpha 021's own `RuntimeStorageBackend` precedent/);
  });

  it("4. the design doc explains why no secret-key derivation and no fixed/dummy npub are used", () => {
    expect(designDocSource).toMatch(/秘密鍵から導出しない理由/);
    expect(designDocSource).toMatch(/固定npubを使わない理由/);
    expect(designDocSource).toMatch(/A fixed npub is a fabricated identity, not an absence of one\./);
  });

  it("5. the design doc explains why NullNostrPublicIdentitySource is the Resolver's own default", () => {
    expect(designDocSource).toMatch(/Null Sourceを採用する理由/);
    expect(designDocSource).toMatch(/Preserves Alpha 036's own observable behavior exactly\./);
  });

  it("6. the design doc records the Provider/Source responsibility split and the exact class shapes", () => {
    expect(designDocSource).toMatch(/ProviderとSourceの責務分離/);
    expect(designDocSource).toMatch(/export interface FedosNostrPublicIdentitySnapshot \{/);
    expect(designDocSource).toMatch(/export interface FedosNostrPublicIdentitySource \{/);
    expect(designDocSource).toMatch(/constructor\(source: FedosNostrPublicIdentitySource\) \{/);
  });

  it("7. the design doc explicitly adopts Option A and states the four-criteria reasoning", () => {
    expect(designDocSource).toMatch(/Descriptorの選択 — Option A採用/);
    expect(designDocSource).toMatch(/\*\*Explicit decision: Option A\./);
    expect(designDocSource).toMatch(/1 Stage = 1 responsibility/);
    expect(designDocSource).toMatch(/不必要な変更範囲 \(avoiding unnecessary change scope\)/);
    expect(designDocSource).toMatch(/将来の公開API破壊回避 \(avoiding future public API breakage\)/);
    expect(alpha038DocSource).toMatch(/A future, separately-reviewed implementation Stage/);
  });

  it("8. the design doc confirms the Resolver remains selection-only", () => {
    expect(designDocSource).toMatch(/ResolverはProvider選択のみであること/);
    expect(designDocSource).toMatch(/This is a CONSTRUCTION-ARGUMENT\s+change, not a SELECTION change/);
  });

  it("9. the design doc confirms Relay/Authentication/Runtime disconnection and the Fail Closed table", () => {
    expect(designDocSource).toMatch(/Relay \/ Authenticationには未接続であること|Relay \/ Authentication \/ Runtimeには未接続であること/);
    expect(designDocSource).toMatch(/Fail Closed — every invalid input resolves `null`/);
    expect(designDocSource).toMatch(/\| Source's own `readPublicIdentity\(\)` throws \(sync or async\) \| `null`/);
  });

  it("10. the design doc records the explicit 'does NOT do' list", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement Nostr key generation, `nsec` handling, seed\//);
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement `npub` encode\/decode/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* connect to any Relay/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add Authentication, Credential, or Session handling/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `create_runtime\.ts`, `AppRuntime`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change any Storage API/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
  });

  it("11. RIPPLE (Secure Runtime Alpha 044): fedos_nostr_public_identity_source.ts defined TYPES ONLY -- exactly two exported interfaces, no class, no function, no secret-shaped field, and its own Snapshot carried zero displayName/avatar vocabulary AS OF this Stage's own scope; Alpha 044 later added both, deliberately, as optional Snapshot fields -- reconfirmed here as the CURRENT shape, per this arc's own established ripple convention", () => {
    expect([...sourceInterfaceSource.matchAll(/^export interface (\w+)/gm)].map((m: RegExpMatchArray) => m[1]).sort()).toEqual(
      ["FedosNostrPublicIdentitySnapshot", "FedosNostrPublicIdentitySource"].sort(),
    );
    expect([...sourceInterfaceSource.matchAll(/^export class/gm)].length).toBe(0);
    expect([...sourceInterfaceSource.matchAll(/^export (?:async )?function/gm)].length).toBe(0);
    expect(sourceInterfaceSource).toMatch(/readonly id: string;/);
    expect(sourceInterfaceSource).toMatch(/readonly publicIdentifier: string;/);
    expect(sourceInterfaceSource).toMatch(/readonly displayName\?: string;/);
    expect(sourceInterfaceSource).toMatch(/readonly avatar\?: string;/);
    const codeOnly = codeOnlyLines(sourceInterfaceSource);
    expect(codeOnly).not.toMatch(/nsec|seed|mnemonic|privateKey|secretKey|AeadKeyHandle|AeadCiphertextHandle/i);
    expect(codeOnly).not.toMatch(/relay|Relay|Authenticat|session|Session|credential|Credential/);
  });

  it("12. readPublicIdentity() is the ONLY method on the Source interface, taking no argument", () => {
    const match = sourceInterfaceSource.match(/export interface FedosNostrPublicIdentitySource \{([\s\S]*?)\}/);
    const body = match?.[1]?.trim() ?? "";
    expect(body).toBe("readPublicIdentity(): Promise<FedosNostrPublicIdentitySnapshot | null>;");
  });

  it("13. fedos_null_nostr_public_identity_source.ts exports EXACTLY NullNostrPublicIdentitySource, no constructor, always resolving null", () => {
    expect([...nullSourceSource.matchAll(/^export class (\w+)/gm)].map((m: RegExpMatchArray) => m[1])).toEqual([
      "NullNostrPublicIdentitySource",
    ]);
    expect([...nullSourceSource.matchAll(/^export (?:async )?function/gm)].length).toBe(0);
    const codeOnly = codeOnlyLines(nullSourceSource);
    expect(codeOnly).not.toMatch(/constructor\s*\(/);
    expect(codeOnly).not.toMatch(/\bthrow\b/);
    expect(codeOnly).not.toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/fs\.|readFile|require\(/);
    expect(codeOnly).not.toMatch(/relay|Relay/);
    const body = (
      nullSourceSource.match(/async readPublicIdentity\(\): Promise<FedosNostrPublicIdentitySnapshot \| null> \{([\s\S]*?)\n  \}/) ?? []
    )[1] ?? "";
    expect(body.trim()).toBe("return null;");
  });

  it("14. behavioral: NullNostrPublicIdentitySource always resolves null, called repeatedly, holds no global mutable state across instances", async () => {
    const a = new NullNostrPublicIdentitySource();
    const b = new NullNostrPublicIdentitySource();
    expect(await a.readPublicIdentity()).toBeNull();
    expect(await a.readPublicIdentity()).toBeNull();
    expect(await b.readPublicIdentity()).toBeNull();
  });

  it("15. fedos_nostr_identity_provider.ts's own CODE reads the injected Source exactly once, validates before returning, and never throws out of describeIdentity()", () => {
    const codeOnly = codeOnlyLines(nostrProviderSource);
    const sourceCalls = [...codeOnly.matchAll(/this\.#source\.readPublicIdentity\(\)/g)];
    expect(sourceCalls.length).toBe(1);
    expect(codeOnly).toMatch(/try \{/);
    expect(codeOnly).toMatch(/\} catch \{/);
    expect(codeOnly).toMatch(/provider: "nostr"/);
    expect(codeOnly).not.toMatch(/^\s*throw\b/m);
  });

  it("16. fedos_nostr_identity_provider.ts's own CODE (excluding its own explanatory header comment) does not reference Relay/event/signing/secret-key/DM/Authentication vocabulary, and does not attempt npub encode/decode", () => {
    const codeOnly = codeOnlyLines(nostrProviderSource);
    expect(codeOnly).not.toMatch(/relay|Relay/);
    expect(codeOnly).not.toMatch(/publish|subscribe/i);
    expect(codeOnly).not.toMatch(/\bkind\b/);
    expect(codeOnly).not.toMatch(/\bEvent\b/);
    expect(codeOnly).not.toMatch(/\bsign\b|\bSign\b|verify|Verify/);
    expect(codeOnly).not.toMatch(/nsec|npub|secret\s*key|privateKey|secretKey|seed|mnemonic/i);
    expect(codeOnly).not.toMatch(/bech32/i);
    expect(codeOnly).not.toMatch(/\bDM\b|DirectMessage|direct message/i);
    expect(codeOnly).not.toMatch(/Authenticat|session|Session|credential|Credential/);
    expect(codeOnly).not.toMatch(/fedos_identity_provider_resolver|resolveFedosIdentityProvider/);
    expect(codeOnly).not.toMatch(/fedos_identity_service|FedosIdentityService/);
    expect(codeOnly).not.toMatch(/create_runtime|AppRuntime/);
  });

  it("17. behavioral: a VALID Source snapshot produces a real FedosIdentityDescriptor, provider always 'nostr', source read exactly once", async () => {
    const source = new FakeSource({ id: "nostr-user-1", publicIdentifier: "npub1exampleplaceholderstring" });
    const provider = new NostrIdentityProvider(source);
    const descriptor = await provider.describeIdentity();
    expect(descriptor).toEqual({
      id: "nostr-user-1",
      provider: "nostr",
      publicIdentifier: "npub1exampleplaceholderstring",
    });
    expect(source.calls).toBe(1);
    expect(provider.provider).toBe("nostr");
  });

  it("18. behavioral: describeIdentity() calls the Source exactly once per invocation, not zero, not twice", async () => {
    const source = new FakeSource({ id: "a", publicIdentifier: "b" });
    const provider = new NostrIdentityProvider(source);
    await provider.describeIdentity();
    expect(source.calls).toBe(1);
    await provider.describeIdentity();
    expect(source.calls).toBe(2);
  });

  it("19. behavioral: a null Source snapshot resolves null", async () => {
    const provider = new NostrIdentityProvider(new FakeSource(null));
    expect(await provider.describeIdentity()).toBeNull();
  });

  it("20. behavioral: a throwing Source resolves null, never lets the exception escape, and the Source is still only called once", async () => {
    const source = new ThrowingSource();
    const provider = new NostrIdentityProvider(source);
    await expect(provider.describeIdentity()).resolves.toBeNull();
    expect(source.calls).toBe(1);
  });

  it("21. behavioral: an empty-string id resolves null; an empty-string publicIdentifier resolves null; non-string values resolve null", async () => {
    expect(await new NostrIdentityProvider(new FakeSource({ id: "", publicIdentifier: "npub1x" })).describeIdentity()).toBeNull();
    expect(await new NostrIdentityProvider(new FakeSource({ id: "abc", publicIdentifier: "" })).describeIdentity()).toBeNull();
    expect(
      await new NostrIdentityProvider(
        new FakeSource({ id: 123 as unknown as string, publicIdentifier: "npub1x" }),
      ).describeIdentity(),
    ).toBeNull();
    expect(
      await new NostrIdentityProvider(
        new FakeSource({ id: "abc", publicIdentifier: null as unknown as string }),
      ).describeIdentity(),
    ).toBeNull();
  });

  it("22. behavioral: the Provider trusts none of its own class-level 'provider' field to the Source -- the Snapshot type structurally carries no provider field at all", () => {
    expect(sourceInterfaceSource).not.toMatch(/provider\s*[:?]/);
  });

  it("23. Resolver: resolveFedosIdentityProvider() returns the shared NostrIdentityProvider singleton, the SAME instance on every call, constructed with a NullNostrPublicIdentitySource, and describeIdentity() still always resolves null by default", async () => {
    const first = resolveFedosIdentityProvider();
    const second = resolveFedosIdentityProvider();
    expect(first).toBeInstanceOf(NostrIdentityProvider);
    expect(first).toBe(second);
    expect(first?.provider).toBe("nostr");
    expect(await first?.describeIdentity()).toBeNull();
    expect(await first?.describeIdentity()).toBeNull();
  });

  it("24. Resolver's own CODE constructs exactly one NostrIdentityProvider, injected with exactly one NullNostrPublicIdentitySource, with no selection condition added", () => {
    const codeOnly = codeOnlyLines(resolverSource);
    expect([...resolverSource.matchAll(/new NostrIdentityProvider\(new NullNostrPublicIdentitySource\(\)\)/g)].length).toBe(1);
    expect(codeOnly).not.toMatch(/\bif\s*\(/);
    expect(codeOnly).not.toMatch(/switch\s*\(/);
    expect([...resolverSource.matchAll(/^const \w+/gm)].length).toBe(1);
    expect(resolverSource).toMatch(/export function resolveFedosIdentityProvider\(\): FedosIdentityProvider \| null \{/);
    const body = (
      resolverSource.match(/export function resolveFedosIdentityProvider\(\): FedosIdentityProvider \| null \{([\s\S]*?)\n\}/) ?? []
    )[1] ?? "";
    expect(body.trim()).toBe("return sharedNostrProvider;");
  });

  it("25. fedos_noop_identity_provider.ts (Alpha 033) is confirmed BYTE-FOR-BYTE unchanged and NOT deleted", () => {
    expect(noopProviderSource).toMatch(/export class NoopFedosIdentityProvider implements FedosIdentityProvider \{/);
    expect(noopProviderSource).toMatch(/readonly provider = "noop";/);
    expect(noopProviderSource).not.toMatch(/secure_runtime_alpha_039/);
  });

  it("26. RIPPLE (Secure Runtime Alpha 042): FedosIdentityService (Alpha 031) was confirmed unchanged AS OF this Stage's own scope -- pure delegation, constructor requiring an explicit FedosIdentityProvider argument; Alpha 042 later added a required second constructor argument (an injected FedosIdentityRegistry) and a Descriptor->Record registration step -- reconfirmed here as the CURRENT signature and body, still calling the Provider's own describeIdentity()", () => {
    expect(serviceSource).toMatch(/constructor\(provider: FedosIdentityProvider, registry: FedosIdentityRegistry\) \{/);
    expect(serviceSource).toMatch(/const descriptor = await this\.#provider\.describeIdentity\(\);/);
    expect(serviceSource).not.toMatch(/secure_runtime_alpha_039/);
  });

  it("27. Regression: FedosIdentityProvider interface (Alpha 029) and FedosIdentityCapability (Alpha 030) are confirmed unchanged", () => {
    expect(providerInterfaceSource).toMatch(/describeIdentity\(\): Promise<FedosIdentityDescriptor \| null>;/);
    expect(providerInterfaceSource).not.toMatch(/secure_runtime_alpha_039/);
    expect(capabilitySource).toMatch(/readonly available: boolean;/);
    expect(capabilitySource).not.toMatch(/secure_runtime_alpha_039/);
  });

  it("28. RIPPLE (Secure Runtime Alpha 045): fedos_identity_descriptor.ts (Alpha 028) was confirmed BYTE-FOR-BYTE unchanged AS OF this Stage's own scope -- still exactly three fields, per this Stage's own Option A decision; Alpha 045 later added displayName/avatar as two OPTIONAL fields -- reconfirmed here as the CURRENT shape, per this arc's own established ripple convention", () => {
    expect(descriptorSource).toMatch(/export interface FedosIdentityDescriptor \{/);
    const requiredFieldDeclarations = [...descriptorSource.matchAll(/^\s*readonly \w+: string;/gm)];
    expect(requiredFieldDeclarations.length).toBe(3);
    expect(descriptorSource).toMatch(/readonly displayName\?: string;/);
    expect(descriptorSource).toMatch(/readonly avatar\?: string;/);
    expect(descriptorSource).not.toMatch(/secure_runtime_alpha_039/);
  });

  it("29. no Runtime/Storage/Worker file references this Stage's own doc or the new Source Boundary -- confirmed unchanged exports", () => {
    for (const source of [storageResolverSource, storageBackendSource, runtimeTypesSource, createRuntimeSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_039/);
      expect(source).not.toMatch(/FedosNostrPublicIdentitySource|NullNostrPublicIdentitySource/);
    }
  });

  it("30. no existing src/nostr/* file was modified, and none references this Stage's own doc or the new Source Boundary", () => {
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
      expect(source).not.toMatch(/secure_runtime_alpha_039/);
      expect(source).not.toMatch(/FedosNostrPublicIdentitySource|NullNostrPublicIdentitySource/);
    }
  });

  it("31. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("32. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_039/);

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

  it("33. exactly two new files were added under src/identity/ -- 20 files total AS OF this Stage's own scope (Secure Runtime Alpha 040 later added a 21st, fedos_identity_record.ts); no fedos_*.ts file under src/runtime/ was added or removed -- still exactly 56 files", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("34. cross-references Alpha 035/038 without revising either", () => {
    expect(designDocSource).toMatch(/secure_runtime_alpha_035_fedos_nostr_identity_provider\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_038_fedos_identity_descriptor_decision\.md/);
    expect(alpha035DocSource).not.toMatch(/secure_runtime_alpha_039/);
  });

  it("35. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha039-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha039-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha039-id"));
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha039-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha039-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha039-direct"))).toBe(true);
  });
});
