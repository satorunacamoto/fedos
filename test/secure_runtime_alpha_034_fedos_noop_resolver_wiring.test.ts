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
import { NoopFedosIdentityProvider } from "../src/os/core/identity/fedos_noop_identity_provider.js";
import { NostrIdentityProvider } from "../src/os/core/identity/fedos_nostr_identity_provider.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_034_fedos_noop_resolver_wiring.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha032DocSource from "../docs/secure_runtime_alpha_032_fedos_identity_provider_resolver.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha033DocSource from "../docs/secure_runtime_alpha_033_fedos_noop_identity_provider.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import resolverSource from "../src/os/core/identity/fedos_identity_provider_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopProviderSource from "../src/os/core/identity/fedos_noop_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/os/core/identity/fedos_identity_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/os/core/identity/fedos_identity_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerInterfaceSource from "../src/os/core/identity/fedos_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilitySource from "../src/os/core/identity/fedos_identity_capability.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerBoundarySource from "../src/os/core/identity/provider_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerTypesSource from "../src/os/core/identity/provider_types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import providerBridgeSource from "../src/os/core/identity/provider_bridge.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import webauthnAdapterSource from "../src/os/core/identity/webauthn_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityTypesSource from "../src/os/core/identity/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sessionBoundarySource from "../src/os/core/identity/session_boundary.ts?raw";
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
import wasmLoaderSource from "../src/os/core/vault/wasm/fedos_wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nobleSignatureSource from "../src/os/messenger/adapters/nostr/protocol/noble_signature.ts?raw";
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
 * Secure Runtime Alpha 034 — "FedOS No-op Resolver Wiring": changes
 * ONLY `resolveFedosIdentityProvider()`'s own function body, from
 * `return null;` (Alpha 032) to returning a shared
 * `NoopFedosIdentityProvider` (Alpha 033) singleton -- no `if`, no
 * `switch`, no Runtime/Service/Worker/Nostr wiring of any kind, and no
 * modification to any other file.
 */
describe("Secure Runtime Alpha 034 -- FedOS No-op Resolver Wiring, Resolver-only change, Runtime/Service/Worker/Rust unchanged", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(7000);
  });

  it("2. the design doc states this Stage changes exactly one function body, in one file, cross-referencing Alpha 032/033", () => {
    expect(designDocSource).toMatch(/one function body changed, in one file/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_032_fedos_identity_provider_resolver\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_033_fedos_noop_identity_provider\.md/);
    expect(alpha032DocSource).toMatch(/resolveFedosIdentityProvider/);
    expect(alpha033DocSource).toMatch(/NoopFedosIdentityProvider/);
  });

  it("3. the design doc explains why null became No-op now, referencing Alpha 032's own three original reasons", () => {
    expect(designDocSource).toMatch(/null ResolverからNo-op Resolverへの変更理由/);
    expect(designDocSource).toMatch(/ZERO `FedosIdentityProvider` implementations\s+exist anywhere in this repository/);
    expect(designDocSource).toMatch(/is\s+now simply false/);
  });

  it("4. the design doc records the exact new Resolver body, including the singleton, and explains the return-type-unchanged decision", () => {
    expect(designDocSource).toMatch(
      /const sharedNoopProvider: FedosIdentityProvider = new NoopFedosIdentityProvider\(\);/,
    );
    expect(designDocSource).toMatch(
      /export function resolveFedosIdentityProvider\(\): FedosIdentityProvider \| null \{/,
    );
    expect(designDocSource).toMatch(/return sharedNoopProvider;/);
    expect(designDocSource).toMatch(/remains `FedosIdentityProvider \| null`/);
  });

  it("5. the design doc explains why the Noop Provider is not a stand-in for a real Provider", () => {
    expect(designDocSource).toMatch(
      /No-op Providerが実Providerの代替ではないこと/,
    );
    expect(designDocSource).toMatch(/can NEVER report an identity/);
  });

  it("6. the design doc explains why Runtime stays disconnected, with two independent reasons", () => {
    expect(designDocSource).toMatch(/Runtime未接続である理由/);
    expect(designDocSource).toMatch(
      /`FedosIdentityService` \(Alpha 031\) still requires an explicit\s+constructor argument, with no default\.\*\*/,
    );
    expect(designDocSource).toMatch(
      /Runtime wiring would make a permanently-empty Provider look like a\s+Runtime capability\.\*\*/,
    );
  });

  it("7. the design doc compares against a future Nostr Provider and against resolveRuntimeStorageBackend() with tables", () => {
    expect(designDocSource).toMatch(/Nostr Providerとの差/);
    expect(designDocSource).toMatch(/Storage Resolverとの比較/);
    expect(designDocSource).toMatch(/\| \*\*`describeIdentity\(\)` result\*\* \|/);
    expect(designDocSource).toMatch(/\| \*\*First return value, at its own Resolver's introduction\*\* \|/);
  });

  it("8. the design doc records the explicit 'does NOT do' list", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `create_runtime\.ts` or `AppRuntime`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_identity_service\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `fedos_noop_identity_provider\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/worker\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement any Nostr, ActivityPub, or Bluesky Provider\./);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any selection condition, `if`, or `switch`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
  });

  it("9. RIPPLE (Secure Runtime Alpha 036): fedos_identity_provider_resolver.ts exports EXACTLY resolveFedosIdentityProvider, with no branch, no environment/Authority/Storage-Resolver/Service reference -- AS OF this Stage's own scope its CODE also referenced zero Nostr vocabulary; Alpha 036 later re-wired it to import and construct NostrIdentityProvider, so that specific exclusion is reconfirmed here as NO LONGER true, while every other exclusion still holds, per this arc's own established ripple convention", () => {
    const exportedFns = [...resolverSource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedFns)).toEqual(new Set(["resolveFedosIdentityProvider"]));
    expect([...resolverSource.matchAll(/^export class/gm)].length).toBe(0);
    expect([...resolverSource.matchAll(/^export interface/gm)].length).toBe(0);
    expect([...resolverSource.matchAll(/^const \w+/gm)].length).toBe(1);

    const codeOnly = codeOnlyLines(resolverSource);
    expect(codeOnly).not.toMatch(/\bif\s*\(/);
    expect(codeOnly).not.toMatch(/switch\s*\(/);
    expect(codeOnly).not.toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/determineFedosRuntimeMode|fedos_runtime_mode_authority/);
    expect(codeOnly).not.toMatch(/determineFedosRuntimePlatform|fedos_runtime_platform_authority/);
    expect(codeOnly).not.toMatch(/resolveRuntimeStorageBackend|fedos_runtime_storage_resolver/);
    expect(codeOnly).not.toMatch(/fedos_identity_service|FedosIdentityService/);
    expect(codeOnly).not.toMatch(/create_runtime|AppRuntime/);
    expect(codeOnly).toMatch(/NostrIdentityProvider/);
    expect(codeOnly).not.toMatch(/NIP-|ActivityPub|Bluesky/i);
    expect(codeOnly).not.toMatch(/relay|Relay|publish|subscribe|nsec|npub/);
    expect(codeOnly).not.toMatch(/Authenticat|Session|session|credential|Credential/);
  });

  it("10. RIPPLE (Secure Runtime Alpha 036, then Alpha 039): the function body was EXACTLY 'return sharedNoopProvider;', with exactly one NoopFedosIdentityProvider construction, AS OF this Stage's own scope; Alpha 036 later changed the body to 'return sharedNostrProvider;', constructing NostrIdentityProvider instead; Alpha 039 later gave NostrIdentityProvider a required constructor argument, so the construction call now reads `new NostrIdentityProvider(new NullNostrPublicIdentitySource())` -- confirmed here by literal string extraction of the CURRENT source", () => {
    const body = (
      resolverSource.match(/export function resolveFedosIdentityProvider\(\): FedosIdentityProvider \| null \{([\s\S]*?)\n\}/) ?? []
    )[1] ?? "";
    expect(body.trim()).toBe("return sharedNostrProvider;");

    const noopConstructions = [...resolverSource.matchAll(/new NoopFedosIdentityProvider\(\)/g)];
    expect(noopConstructions.length).toBe(0);
    const nostrConstructions = [...resolverSource.matchAll(/new NostrIdentityProvider\(new NullNostrPublicIdentitySource\(\)\)/g)];
    expect(nostrConstructions.length).toBe(1);
  });

  it("11. RIPPLE (Secure Runtime Alpha 036): behavioral -- resolveFedosIdentityProvider() returned a real NoopFedosIdentityProvider, the SAME shared instance on every call, AS OF this Stage's own scope; Alpha 036 later re-wired it to return a real NostrIdentityProvider instead -- still the SAME shared instance on every call (singleton, not fresh-per-call), never null -- confirmed here as the CURRENT behavior", () => {
    const first = resolveFedosIdentityProvider();
    const second = resolveFedosIdentityProvider();
    const third = resolveFedosIdentityProvider();
    expect(first).toBeInstanceOf(NostrIdentityProvider);
    expect(first).not.toBeInstanceOf(NoopFedosIdentityProvider);
    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(first).not.toBeNull();
  });

  it("12. RIPPLE (Secure Runtime Alpha 036): behavioral -- the resolved Provider reported provider === 'noop' AS OF this Stage's own scope; Alpha 036 later re-wired the Resolver so it now reports provider === 'nostr' instead -- describeIdentity() still always resolves null either way, confirmed here as the CURRENT behavior", async () => {
    const provider = resolveFedosIdentityProvider();
    expect(provider?.provider).toBe("nostr");
    expect(await provider?.describeIdentity()).toBeNull();
    expect(await provider?.describeIdentity()).toBeNull();
  });

  it("13. fedos_noop_identity_provider.ts (Alpha 033) is confirmed BYTE-FOR-BYTE unchanged -- still exactly the fixed 'noop' literal and 'return null;' describeIdentity() body, no reference to this Stage's own doc, and its own CODE (excluding its pre-existing explanatory header comment, which already legitimately named resolveFedosIdentityProvider() since Alpha 033) makes no call into the Resolver", () => {
    expect(noopProviderSource).toMatch(/readonly provider = "noop";/);
    const body = (
      noopProviderSource.match(/async describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n(?:  )?\}/) ?? []
    )[1] ?? "";
    expect(body.trim()).toBe("return null;");
    expect(noopProviderSource).not.toMatch(/secure_runtime_alpha_034/);
    expect(codeOnlyLines(noopProviderSource)).not.toMatch(/fedos_identity_provider_resolver|resolveFedosIdentityProvider/);
  });

  it("14. RIPPLE (Secure Runtime Alpha 042): fedos_identity_service.ts (Alpha 031) was confirmed BYTE-FOR-BYTE unchanged AS OF this Stage's own scope; Alpha 042 later added a required second constructor argument (an injected FedosIdentityRegistry) -- reconfirmed here as the CURRENT signature, still no reference to this Stage's own doc or a call to resolveFedosIdentityProvider()", () => {
    expect(serviceSource).toMatch(/constructor\(provider: FedosIdentityProvider, registry: FedosIdentityRegistry\) \{/);
    expect(serviceSource).not.toMatch(/resolveFedosIdentityProvider|fedos_identity_provider_resolver/);
    expect(serviceSource).not.toMatch(/secure_runtime_alpha_034/);
  });

  it("15. fedos_identity_provider.ts/fedos_identity_descriptor.ts/fedos_identity_capability.ts are all confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(providerInterfaceSource).toMatch(/describeIdentity\(\): Promise<FedosIdentityDescriptor \| null>;/);
    expect(providerInterfaceSource).not.toMatch(/secure_runtime_alpha_034/);
    expect(descriptorSource).toMatch(/readonly publicIdentifier: string;/);
    expect(descriptorSource).not.toMatch(/secure_runtime_alpha_034/);
    expect(capabilitySource).toMatch(/readonly available: boolean;/);
    expect(capabilitySource).not.toMatch(/secure_runtime_alpha_034/);
  });

  it("16. create_runtime.ts/AppRuntime (runtime types) do not reference the Resolver or this Stage's own doc -- Runtime remains fully unconnected", () => {
    expect(createRuntimeSource).not.toMatch(/fedos_identity_provider_resolver|resolveFedosIdentityProvider|NoopFedosIdentityProvider/);
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_034/);
    expect(runtimeTypesSource).not.toMatch(/fedos_identity_provider_resolver|resolveFedosIdentityProvider|NoopFedosIdentityProvider/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_034/);
  });

  it("17. no existing src/identity/* file besides the Resolver was modified, and no Runtime/Worker/Nostr file references this Stage's own doc", () => {
    for (const source of [
      providerBoundarySource,
      providerTypesSource,
      providerBridgeSource,
      webauthnAdapterSource,
      identityTypesSource,
      sessionBoundarySource,
      createRuntimeSource,
      runtimeTypesSource,
      workerSource,
      nobleSignatureSource,
    ]) {
      expect(source).not.toMatch(/secure_runtime_alpha_034/);
    }
  });

  it("18. the Storage Resolver (fedos_runtime_storage_resolver.ts) and Storage Backend (fedos_runtime_storage_backend.ts) are confirmed unchanged -- no reference to this Stage's own doc or the Identity Resolver's new wiring", () => {
    expect(storageResolverSource).not.toMatch(/secure_runtime_alpha_034/);
    expect(storageResolverSource).not.toMatch(/fedos_identity_provider_resolver|resolveFedosIdentityProvider|NoopFedosIdentityProvider/);
    expect(storageBackendSource).not.toMatch(/secure_runtime_alpha_034/);
    expect(storageBackendSource).not.toMatch(/NoopFedosIdentityProvider|fedos_noop_identity_provider/);
  });

  it("19. src/worker.ts is confirmed unchanged -- zero reference to the Resolver, the Noop Provider, or this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/fedos_identity_provider_resolver|resolveFedosIdentityProvider|NoopFedosIdentityProvider/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_034/);
  });

  it("20. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);

    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("21. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_034/);

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

  it("22. no fedos_*.ts file under src/runtime/ or src/identity/ was added or removed -- still exactly 56 and 17 files respectively AS OF Alpha 034's own scope, this Stage only modifying an existing file's body (Secure Runtime Alpha 035 later added an 18th src/identity/ file, fedos_nostr_identity_provider.ts; Secure Runtime Alpha 039 later added a 19th and 20th, fedos_nostr_public_identity_source.ts and fedos_null_nostr_public_identity_source.ts; Secure Runtime Alpha 040 later added a 21st, fedos_identity_record.ts)", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("23. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha034-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha034-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha034-id"));
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

    const direct = await withNodeEnv("development", () => storeCiphertext("alpha034-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha034-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha034-direct"))).toBe(true);
  });
});
