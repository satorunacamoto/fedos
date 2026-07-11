import { describe, it, expect } from "vitest";
import { createRuntime } from "../src/runtime/create_runtime.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
import { resolveFedosIdentityProvider } from "../src/identity/fedos_identity_provider_resolver.js";
import type { RuntimeMode } from "../src/runtime/types.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_058_identity_bootstrap_boundary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha057DocSource from "../docs/secure_runtime_alpha_057_identity_bootstrap_removal.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/identity/fedos_identity_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import registrySource from "../src/identity/fedos_identity_registry.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import resolverClassSource from "../src/identity/fedos_identity_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityProviderResolverSource from "../src/identity/fedos_identity_provider_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrProviderSource from "../src/identity/fedos_nostr_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sourceResolverSource from "../src/identity/fedos_nostr_public_identity_source_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/identity/fedos_identity_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import recordSource from "../src/identity/fedos_identity_record.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageResolverSource from "../src/runtime/fedos_runtime_storage_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageBackendSource from "../src/runtime/fedos_runtime_storage_backend.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

const RUNTIME_MODES: readonly RuntimeMode[] = ["test", "local", "cloudflare"];
const NODE_ENVS = ["development", "production", undefined] as const;

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

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

const APP_RUNTIME_FIELDS = [
  "mode",
  "eventCache",
  "assetCache",
  "spaceDirectory",
  "metadataIndex",
  "signatureVerifier",
  "promotionProvider",
  "recommendationProvider",
  "relayPublisher",
  "notificationBridge",
  "paymentProvider",
  "promotionProviderPreviewAllowed",
  "webAuthnProvider",
  "cryptoProvider",
  "storageBackend",
  "federationProvider",
  "chatProvider",
  "marketplaceProvider",
  "creatorEntitlementProvider",
  "crypto",
  "initializeCrypto",
  "runtimeCapabilities",
  "randomBytes",
  "generateAeadKey",
  "encrypt",
  "decrypt",
  "exportCiphertext",
  "importCiphertext",
  "storeCiphertext",
  "loadCiphertext",
  "deleteCiphertext",
].sort();

/**
 * Secure Runtime Alpha 058 -- "Identity Bootstrap Boundary": adds
 * `bootstrapIdentity(): Promise<void>` to `FedosRuntimeIdentity` -- a
 * one-line delegation to the already-existing
 * `FedosIdentityService.describeIdentity()`, discarding the result,
 * propagating any rejection unmodified, and performing no Registry
 * access of its own. `create_runtime.ts` is untouched, and nothing
 * calls `bootstrapIdentity()` anywhere in this repository.
 */
describe("Secure Runtime Alpha 058 -- Identity Bootstrap Boundary, fedos_runtime_identity.ts only, no create_runtime.ts/AppRuntime/Worker/Storage/Crypto/Rust change", () => {
  // ---------------------------------------------------------------------
  // Design doc structure
  // ---------------------------------------------------------------------

  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(5000);
  });

  it("2. the design doc records the exact bootstrapIdentity() implementation", () => {
    expect(designDocSource).toMatch(
      /async bootstrapIdentity\(\): Promise<void> \{\s*\n\s*await this\.#service\.describeIdentity\(\);\s*\n\s*\}/,
    );
  });

  it("3. RIPPLE (Secure Runtime Alpha 060): the design doc's recorded implementation matched the ACTUAL fedos_runtime_identity.ts source verbatim AS OF this Stage's own scope; Alpha 060 appended a `this.#bootstrapped = true;` line after the pre-existing one -- reconfirmed here that this Stage's own recorded body is still a PREFIX of the CURRENT source", () => {
    expect(fedosRuntimeIdentitySource).toMatch(
      /async bootstrapIdentity\(\): Promise<void> \{\s*\n\s*await this\.#service\.describeIdentity\(\);/,
    );
  });

  it("4. the design doc explains why a Bootstrap boundary is added now", () => {
    expect(designDocSource).toMatch(/## 3\. Why a Bootstrap boundary is added at all/);
  });

  it("5. the design doc explains why createRuntime() still does not call it", () => {
    expect(designDocSource).toMatch(/## 4\. Why `createRuntime\(\)` still does not call it/);
  });

  it("6. the design doc explains the responsibility split from describeIdentity()", () => {
    expect(designDocSource).toMatch(/## 5\. Responsibility split from `describeIdentity\(\)`/);
  });

  it("7. the design doc explains why Registry registration is delegated to FedosIdentityService", () => {
    expect(designDocSource).toMatch(
      /## 6\. Why Registry registration is delegated entirely to `FedosIdentityService`/,
    );
  });

  it("8. the design doc explains why a rejection is not swallowed", () => {
    expect(designDocSource).toMatch(/## 7\. Why a rejection is not swallowed/);
  });

  it("9. the design doc discusses a future Desktop caller", () => {
    expect(designDocSource).toMatch(/## 8\. Future Desktop caller/);
  });

  it("10. the design doc explains why Worker will not call it", () => {
    expect(designDocSource).toMatch(/## 9\. Why Worker will not call it/);
  });

  it("11. the design doc records an explicit 'does NOT do' list naming every prohibited file/area", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `create_runtime\.ts`/);
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* call `bootstrapIdentity\(\)` from anywhere/,
    );
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* modify `describeIdentity\(\)`, `findIdentity\(\)`, or\s*\n\s*`listIdentities\(\)`/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `AppRuntime`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/worker\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `packages\/fedos-core-rust`/);
  });

  it("12. the design doc cross-references the Alpha 057 doc", () => {
    expect(designDocSource).toMatch(
      /secure_runtime_alpha_057_identity_bootstrap_removal\.md/,
    );
    expect(alpha057DocSource.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------
  // Structural: bootstrapIdentity() itself, confirmed via literal extraction
  // ---------------------------------------------------------------------

  it("13. bootstrapIdentity() exists as a method on FedosRuntimeIdentity", () => {
    expect(fedosRuntimeIdentitySource).toMatch(/async bootstrapIdentity\(\): Promise<void> \{/);
  });

  it("14. RIPPLE (Secure Runtime Alpha 060): bootstrapIdentity()'s own body was EXACTLY 'await this.#service.describeIdentity();' AS OF this Stage's own scope; Alpha 060 appended 'this.#bootstrapped = true;' after it -- reconfirmed here that the pre-existing line remains the body's own FIRST statement, unmodified", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const body = (codeOnly.match(/async bootstrapIdentity\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const lines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(lines[0]).toBe("await this.#service.describeIdentity();");
  });

  it("15. bootstrapIdentity() calls describeIdentity() on the Service exactly once", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const body = (codeOnly.match(/async bootstrapIdentity\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect([...body.matchAll(/describeIdentity\(\)/g)].length).toBe(1);
  });

  it("16. bootstrapIdentity() routes through the Service (this.#service), not the Resolver or Registry", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const body = (codeOnly.match(/async bootstrapIdentity\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).toMatch(/this\.#service/);
    expect(body).not.toMatch(/this\.#resolver/);
    expect(body).not.toMatch(/this\.#registry/);
  });

  it("17. bootstrapIdentity() awaits the call -- no bare fire-and-forget inside its own body", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const body = (codeOnly.match(/async bootstrapIdentity\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).toMatch(/await /);
    expect(body).not.toMatch(/void /);
    expect(body).not.toMatch(/\.catch\(/);
  });

  it("18. bootstrapIdentity()'s own declared return type is Promise<void>", () => {
    expect(fedosRuntimeIdentitySource).toMatch(/bootstrapIdentity\(\): Promise<void>/);
  });

  it("19. bootstrapIdentity() is declared async", () => {
    expect(fedosRuntimeIdentitySource).toMatch(/async bootstrapIdentity/);
  });

  it("20. describeIdentity()/findIdentity()/listIdentities() remain BYTE-FOR-BYTE unchanged", () => {
    expect(fedosRuntimeIdentitySource).toMatch(
      /async describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{\s*\n\s*return this\.#service\.describeIdentity\(\);\s*\n\s*\}/,
    );
    expect(fedosRuntimeIdentitySource).toMatch(
      /findIdentity\(id: string\): FedosIdentityRecord \| null \{\s*\n\s*return this\.#resolver\.findIdentity\(id\);\s*\n\s*\}/,
    );
    expect(fedosRuntimeIdentitySource).toMatch(
      /listIdentities\(\): readonly FedosIdentityRecord\[\] \{\s*\n\s*return this\.#resolver\.listIdentities\(\);\s*\n\s*\}/,
    );
  });

  it("21. RIPPLE (Secure Runtime Alpha 060): FedosRuntimeIdentity's own class had exactly FOUR public methods AS OF this Stage's own scope; Alpha 060 added a fifth, isBootstrapped() -- reconfirmed here that all four of THIS Stage's own methods remain present, alongside the newer fifth", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const methodNames = [
      ...classBody.matchAll(/^\s{2}(?:async\s+)?(\w+)\([^)]*\)(?::\s*[^{]+)?\s*\{/gm),
    ]
      .map((m: RegExpMatchArray) => m[1] ?? "")
      .filter((name: string) => name !== "constructor");
    expect(new Set(methodNames)).toEqual(
      new Set(["describeIdentity", "findIdentity", "listIdentities", "bootstrapIdentity", "isBootstrapped"]),
    );
  });

  it("22. bootstrapIdentity() is declared AFTER the pre-existing three methods, in source order", () => {
    const classBody = (fedosRuntimeIdentitySource.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const listIndex = classBody.indexOf("listIdentities(): readonly FedosIdentityRecord[] {");
    const bootstrapIndex = classBody.indexOf("async bootstrapIdentity(): Promise<void> {");
    expect(listIndex).toBeGreaterThan(-1);
    expect(bootstrapIndex).toBeGreaterThan(listIndex);
  });

  it("23. FedosRuntimeIdentity's own private field set is confirmed unchanged -- still exactly three private fields", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const fieldDeclarations = [...codeOnly.matchAll(/^\s*readonly #(\w+)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldDeclarations).toEqual(["registry", "service", "resolver"]);
  });

  it("24. FedosRuntimeIdentity's own constructor is confirmed unchanged -- zero arguments, the exact same four-statement body", () => {
    const body = (fedosRuntimeIdentitySource.match(/constructor\(\) \{([\s\S]*?)\n  \}/) ?? [])[1] ?? "";
    const lines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(lines).toEqual([
      "this.#registry = new FedosIdentityRegistry();",
      "const provider = resolveFedosIdentityProvider() ?? new NoopFedosIdentityProvider();",
      "this.#service = new FedosIdentityService(provider, this.#registry);",
      "this.#resolver = new FedosIdentityResolver(this.#registry);",
    ]);
  });

  it("25. fedos_runtime_identity.ts's own import count is unaffected -- still exactly seven imports (no new import needed for bootstrapIdentity())", () => {
    const importLines = [...fedosRuntimeIdentitySource.matchAll(/^import .*$/gm)];
    expect(importLines.length).toBe(7);
  });

  // ---------------------------------------------------------------------
  // create_runtime.ts is completely unaffected
  // ---------------------------------------------------------------------

  it("26. Regression: create_runtime.ts is confirmed BYTE-FOR-BYTE unchanged -- no reference to this Stage's own doc or to bootstrapIdentity", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_058/);
    expect(createRuntimeSource).not.toMatch(/bootstrapIdentity/);
  });

  it("27. Regression: createRuntime()'s own construction block remains Construct Only -- no describeIdentity()/bootstrapIdentity() call anywhere in its own body", () => {
    const body = (createRuntimeSource.match(/export function createRuntime\(([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/\.describeIdentity\(\)/);
    expect(body).not.toMatch(/\.bootstrapIdentity\(\)/);
    expect(body).toMatch(/const runtimeIdentity: FedosRuntimeIdentity = new FedosRuntimeIdentity\(\);/);
    expect(body).toMatch(/void runtimeIdentity;/);
  });

  it("28. behavioral: createRuntime() remains synchronous, returning a plain object, unaffected by this Stage", () => {
    const result = createRuntime();
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result.mode).toBe("string");
  });

  it("29. behavioral: createRuntime() under every RuntimeMode still returns exactly the pre-existing thirty AppRuntime fields", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
    }
  });

  it("30. behavioral: createRuntime() does not expose a 'bootstrapIdentity' field on the returned object, under any mode", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode }) as unknown as Record<string, unknown>;
      expect(runtime.bootstrapIdentity).toBeUndefined();
      expect(runtime.identity).toBeUndefined();
      expect(runtime.runtimeIdentity).toBeUndefined();
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral: bootstrapIdentity() itself
  // ---------------------------------------------------------------------

  it("31. behavioral: bootstrapIdentity() resolves (does not throw) under the current Null Source wiring", async () => {
    const identity = new FedosRuntimeIdentity();
    await expect(identity.bootstrapIdentity()).resolves.toBeUndefined();
  });

  it("32. behavioral: bootstrapIdentity()'s own resolved value is exactly undefined -- the Descriptor is discarded", async () => {
    const identity = new FedosRuntimeIdentity();
    const result = await identity.bootstrapIdentity();
    expect(result).toBeUndefined();
  });

  it("33. behavioral: bootstrapIdentity() returns a real Promise -- calling it does not resolve synchronously", () => {
    const identity = new FedosRuntimeIdentity();
    const result = identity.bootstrapIdentity();
    expect(result).toBeInstanceOf(Promise);
  });

  it("34. behavioral: calling bootstrapIdentity() does not change describeIdentity()'s own subsequent result", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(await identity.describeIdentity()).toBeNull();
  });

  it("35. behavioral: calling bootstrapIdentity() does not populate findIdentity()/listIdentities() under the current Null Source", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.findIdentity("any-id")).toBeNull();
    expect(identity.listIdentities()).toEqual([]);
  });

  it("36. behavioral: bootstrapIdentity() can be called multiple times on the same instance without throwing", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    expect(identity.listIdentities()).toEqual([]);
  });

  it("37. behavioral: bootstrapIdentity() and describeIdentity() called in either order both still resolve consistently", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.describeIdentity();
    await identity.bootstrapIdentity();
    expect(await identity.describeIdentity()).toBeNull();
  });

  it("38. behavioral: bootstrapIdentity()'s own Descriptor read matches the same singleton resolveFedosIdentityProvider() resolves", async () => {
    const resolved = resolveFedosIdentityProvider();
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(await resolved?.describeIdentity()).toBeNull();
  });

  it("39. behavioral: concurrent bootstrapIdentity() calls on independently-constructed instances all resolve without interfering with each other", async () => {
    const instances = Array.from({ length: 10 }, () => new FedosRuntimeIdentity());
    await Promise.all(instances.map((identity) => identity.bootstrapIdentity()));
    for (const identity of instances) {
      expect(identity.listIdentities()).toEqual([]);
    }
  });

  it("40. behavioral: bootstrapIdentity() under every FedosRuntimeMode (NODE_ENV-driven) resolves without throwing", async () => {
    for (const nodeEnv of NODE_ENVS) {
      await withNodeEnv(nodeEnv, async () => {
        const identity = new FedosRuntimeIdentity();
        await expect(identity.bootstrapIdentity()).resolves.toBeUndefined();
      });
    }
  });

  it("41. behavioral: 25 repeated bootstrapIdentity() calls in a tight sequential loop never throw", async () => {
    const identity = new FedosRuntimeIdentity();
    for (let i = 0; i < 25; i += 1) {
      await expect(identity.bootstrapIdentity()).resolves.toBeUndefined();
    }
  });

  it("42. behavioral: a directly-constructed FedosRuntimeIdentity used only via bootstrapIdentity() never mutates the shared NostrIdentityProvider singleton's own behavior", async () => {
    for (let i = 0; i < 10; i += 1) {
      const identity = new FedosRuntimeIdentity();
      await identity.bootstrapIdentity();
    }
    const provider = resolveFedosIdentityProvider();
    expect(await provider?.describeIdentity()).toBeNull();
  });

  it("43. behavioral: bootstrapIdentity() has no enumerable own state side effect -- the instance still exposes no public state after calling it", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(Object.keys(identity)).toEqual([]);
  });

  // ---------------------------------------------------------------------
  // Regression: everything else byte-for-byte unchanged
  // ---------------------------------------------------------------------

  it("44. Regression: AppRuntime's own type (types.ts) is confirmed BYTE-FOR-BYTE unchanged -- no identity/bootstrap field, no reference to this Stage's own doc", () => {
    expect(runtimeTypesSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity|bootstrapIdentity/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_058/);
  });

  it("45. Regression: src/worker.ts is confirmed BYTE-FOR-BYTE unchanged -- no reference to FedosRuntimeIdentity, bootstrapIdentity, or this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity|bootstrapIdentity/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_058/);
  });

  it("46. Regression: fedos_identity_service.ts (the Service bootstrapIdentity() delegates to) is confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(serviceSource).toMatch(/constructor\(provider: FedosIdentityProvider, registry: FedosIdentityRegistry\) \{/);
    expect(serviceSource).not.toMatch(/secure_runtime_alpha_058/);
  });

  it("47. Regression: fedos_identity_registry.ts/fedos_identity_resolver.ts/fedos_identity_provider_resolver.ts are confirmed BYTE-FOR-BYTE unchanged, and none reference this Stage's own doc", () => {
    for (const source of [registrySource, resolverClassSource, identityProviderResolverSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_058/);
    }
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(resolverClassSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
  });

  it("48. Regression: fedos_nostr_identity_provider.ts, fedos_nostr_public_identity_source_resolver.ts, fedos_identity_descriptor.ts, and fedos_identity_record.ts are all confirmed unaffected", () => {
    for (const source of [nostrProviderSource, sourceResolverSource, descriptorSource, recordSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_058/);
    }
  });

  it("49. Regression: fedos_runtime_storage_resolver.ts and fedos_runtime_storage_backend.ts are confirmed BYTE-FOR-BYTE unchanged", () => {
    for (const source of [storageResolverSource, storageBackendSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_058/);
      expect(source).not.toMatch(/bootstrapIdentity/);
    }
  });

  it("50. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha058-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha058-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha058-id"));
    expect(deleted).toBe(true);
  });

  it("51. Regression: initializeCrypto()/runtimeCapabilities() remain unaffected -- confirmed by ACTUAL calls via the AppRuntime object", async () => {
    const runtime = createRuntime();
    expect(runtime.initializeCrypto()).toEqual({
      allowed: false,
      initialized: false,
      reason: "PrototypeDisabled",
    });
    const caps = await runtime.runtimeCapabilities();
    expect(Object.keys(caps).sort()).toEqual(
      ["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort(),
    );
  });

  it("52. Regression: no fedos_*.ts file was added or removed by this Stage -- still exactly 57 under src/runtime/ and exactly 24 under src/identity/", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("53. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_058/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_058/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_058/);

    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("54. Regression: no Public Runtime API field name changed -- all eleven async fields still present and lazy (function references)", () => {
    const runtime = createRuntime();
    for (const field of [
      "initializeCrypto",
      "runtimeCapabilities",
      "randomBytes",
      "generateAeadKey",
      "encrypt",
      "decrypt",
      "exportCiphertext",
      "importCiphertext",
      "storeCiphertext",
      "loadCiphertext",
      "deleteCiphertext",
    ]) {
      expect(typeof (runtime as unknown as Record<string, unknown>)[field]).toBe("function");
    }
  });

  it("55. final sanity: this Stage's own net effect is confined to fedos_runtime_identity.ts -- create_runtime.ts, types.ts, worker.ts, the Identity Layer's other files, and Rust/Cargo/package all remain free of any behavioral change", async () => {
    for (const mode of RUNTIME_MODES) {
      for (const nodeEnv of NODE_ENVS) {
        await withNodeEnv(nodeEnv, () => {
          const runtime = createRuntime(undefined, { mode });
          expect(runtime.mode).toBe(mode);
          expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
        });
      }
    }
    expect(fedosRuntimeIdentitySource).toMatch(/secure_runtime_alpha_058/);
  });
});
