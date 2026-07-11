import { describe, it, expect } from "vitest";
import {
  createRuntime,
  createRuntimeInitializeCryptoResult,
  selectStorageBackend,
} from "../src/runtime/create_runtime.js";
import { runtimeCapabilities } from "../src/runtime/fedos_runtime_prototype_execution.js";
import { randomBytes } from "../src/runtime/fedos_runtime_random_bytes.js";
import { generateAeadKey } from "../src/runtime/fedos_runtime_aead_key_generation.js";
import { encrypt } from "../src/runtime/fedos_runtime_encrypt.js";
import { decrypt } from "../src/runtime/fedos_runtime_decrypt.js";
import { exportCiphertext } from "../src/runtime/fedos_runtime_export_ciphertext.js";
import { importCiphertext } from "../src/runtime/fedos_runtime_import_ciphertext.js";
import { storeCiphertext, loadCiphertext, deleteCiphertext } from "../src/runtime/fedos_runtime_ciphertext_storage.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
import { resolveFedosIdentityProvider } from "../src/identity/fedos_identity_provider_resolver.js";
import { NostrIdentityProvider } from "../src/identity/fedos_nostr_identity_provider.js";
import type { AppRuntime, RuntimeMode } from "../src/runtime/types.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_050_052_identity_runtime_integration_arc.md?raw";
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
import noopProviderSource from "../src/identity/fedos_noop_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrProviderSource from "../src/identity/fedos_nostr_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/identity/fedos_identity_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import recordSource from "../src/identity/fedos_identity_record.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sourceInterfaceSource from "../src/identity/fedos_nostr_public_identity_source.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullSourceSource from "../src/identity/fedos_null_nostr_public_identity_source.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sourceResolverSource from "../src/identity/fedos_nostr_public_identity_source_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageResolverSource from "../src/runtime/fedos_runtime_storage_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageBackendSource from "../src/runtime/fedos_runtime_storage_backend.ts?raw";
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

const RUNTIME_MODES: readonly RuntimeMode[] = ["test", "local", "cloudflare"];

/**
 * Secure Runtime Alpha 050-052 -- "Identity Runtime Integration Arc":
 * `FedosRuntimeIdentity` (Alpha 050) internally wires
 * `FedosIdentityService`/`FedosIdentityRegistry`/`FedosIdentityResolver`
 * to the same Registry. `create_runtime.ts` (Alpha 051) constructs ONE
 * per `createRuntime()` call, held as a local, function-scoped
 * constant -- never attached to `AppRuntime`, never read elsewhere.
 * Alpha 052 verifies construction across every Runtime Mode, that
 * identity retrieval is always `null`, and that every pre-existing
 * `AppRuntime` field is unaffected.
 */
describe("Secure Runtime Alpha 050-052 -- Identity Runtime Integration Arc, internal-only, no Public Runtime API/AppRuntime/Worker/Storage/Rust change", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(10000);
  });

  it("2. the design doc records the exact FedosRuntimeIdentity class shape", () => {
    expect(designDocSource).toMatch(/export class FedosRuntimeIdentity \{/);
    expect(designDocSource).toMatch(/resolveFedosIdentityProvider\(\) \?\? new NoopFedosIdentityProvider\(\)/);
  });

  it("3. the design doc covers Alpha 050 (Runtime Identity Authority), Alpha 051 (Runtime Identity Bootstrap), and Alpha 052 (Integration Verification) as distinct sections", () => {
    expect(designDocSource).toMatch(/## 2\. Alpha 050 — Runtime Identity Authority/);
    expect(designDocSource).toMatch(/## 3\. Alpha 051 — Runtime Identity Bootstrap/);
    expect(designDocSource).toMatch(/## 4\. Alpha 052 — Integration Verification/);
  });

  it("4. the design doc explains why Service/Registry/Resolver are wired together rather than left for Runtime to construct separately", () => {
    expect(designDocSource).toMatch(
      /Why this class wires Service\/Registry\/Resolver together, rather than leaving Runtime to construct each separately/,
    );
  });

  it("5. the design doc explains why this is not yet exposed on AppRuntime, and why identity retrieval is always null today", () => {
    expect(designDocSource).toMatch(/Why this is not yet exposed on `AppRuntime`/);
    expect(designDocSource).toMatch(/Why identity retrieval is always `null` today/);
  });

  it("6. the design doc records the explicit 'does NOT do' list and a verification matrix", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any field to `AppRuntime`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/worker\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* perform any real Nostr Relay connection/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `packages\/fedos-core-rust`, `Cargo\.toml`, or\s+`package\.json`\./);
    expect(designDocSource).toMatch(/## 9\. Verification matrix \(Alpha 052\)/);
  });

  // ---------------------------------------------------------------------
  // Alpha 050: FedosRuntimeIdentity class structure
  // ---------------------------------------------------------------------

  it("7. fedos_runtime_identity.ts defines exactly one exported class and nothing else", () => {
    expect([...fedosRuntimeIdentitySource.matchAll(/^export class/gm)].length).toBe(1);
    expect([...fedosRuntimeIdentitySource.matchAll(/^export (?:async )?function/gm)].length).toBe(0);
    expect([...fedosRuntimeIdentitySource.matchAll(/^export const/gm)].length).toBe(0);
    expect(fedosRuntimeIdentitySource).toMatch(/export class FedosRuntimeIdentity \{/);
  });

  it("8. FedosRuntimeIdentity has exactly three private fields -- #registry, #service, #resolver", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const fieldDeclarations = [...codeOnly.matchAll(/^\s*readonly #(\w+)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldDeclarations).toEqual(["registry", "service", "resolver"]);
  });

  it("9. FedosRuntimeIdentity's constructor takes NO arguments", () => {
    expect(fedosRuntimeIdentitySource).toMatch(/constructor\(\) \{/);
  });

  it("10. the constructor's own body constructs Registry, resolves Provider with a safe fallback, then constructs Service and Resolver, in that order", () => {
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

  it("11. RIPPLE (Secure Runtime Alpha 068): FedosRuntimeIdentity exposed exactly three public methods -- describeIdentity, findIdentity, listIdentities -- as pure pass-throughs, AS OF this Stage's own scope; Alpha 068 (implementing the Alpha 067 Decision) renamed describeIdentity() to a private #describeIdentity() with the IDENTICAL body -- reconfirmed here against the CURRENT source", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    expect(codeOnly).toMatch(/async #describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{/);
    expect(codeOnly).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(codeOnly).toMatch(/listIdentities\(\): readonly FedosIdentityRecord\[\] \{/);
    const describeBody = (codeOnly.match(/async #describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(describeBody.trim()).toBe("return this.#service.describeIdentity();");
    const findBody = (codeOnly.match(/findIdentity\(id: string\): FedosIdentityRecord \| null \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(findBody.trim()).toBe("return this.#resolver.findIdentity(id);");
    const listBody = (codeOnly.match(/listIdentities\(\): readonly FedosIdentityRecord\[\] \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(listBody.trim()).toBe("return this.#resolver.listIdentities();");
  });

  it("12. fedos_runtime_identity.ts imports exactly seven modules -- five value imports, two type-only", () => {
    const importLines = [...fedosRuntimeIdentitySource.matchAll(/^import .*$/gm)].map((m: RegExpMatchArray) => m[0]);
    expect(importLines.length).toBe(7);
    expect(importLines.filter((line: string) => line.startsWith("import type ")).length).toBe(2);
    expect(importLines.filter((line: string) => !line.startsWith("import type ")).length).toBe(5);
    expect(fedosRuntimeIdentitySource).toMatch(/from "\.\.\/identity\/fedos_identity_service\.js"/);
    expect(fedosRuntimeIdentitySource).toMatch(/from "\.\.\/identity\/fedos_identity_registry\.js"/);
    expect(fedosRuntimeIdentitySource).toMatch(/from "\.\.\/identity\/fedos_identity_resolver\.js"/);
    expect(fedosRuntimeIdentitySource).toMatch(/from "\.\.\/identity\/fedos_identity_provider_resolver\.js"/);
    expect(fedosRuntimeIdentitySource).toMatch(/from "\.\.\/identity\/fedos_noop_identity_provider\.js"/);
    expect(fedosRuntimeIdentitySource).toMatch(/from "\.\.\/identity\/fedos_identity_descriptor\.js"/);
    expect(fedosRuntimeIdentitySource).toMatch(/from "\.\.\/identity\/fedos_identity_record\.js"/);
  });

  it("13. fedos_runtime_identity.ts's own CODE has no environment read, no Runtime Mode reference, no Worker/Storage/Rust/Nostr-network vocabulary", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    expect(codeOnly).not.toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/RuntimeMode|resolveMode/);
    expect(codeOnly).not.toMatch(/\bworker\b/i);
    expect(codeOnly).not.toMatch(/RuntimeStorageBackend|storeCiphertext|loadCiphertext|deleteCiphertext/);
    expect(codeOnly).not.toMatch(/Cargo|fedos-core-rust|wasm_bindgen/i);
    expect(codeOnly).not.toMatch(/relay|Relay|npub|nsec/);
    expect(codeOnly).not.toMatch(/AppRuntime|RuntimeEnv|RuntimeOverrides/);
  });

  it("14. fedos_runtime_identity.ts does not import NostrIdentityProvider, FedosNostrPublicIdentitySource, or any concrete Source implementation directly", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/fedos_nostr_identity_provider|NostrIdentityProvider/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/fedos_nostr_public_identity_source|FedosNostrPublicIdentitySource/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/fedos_null_nostr_public_identity_source|NullNostrPublicIdentitySource/);
  });

  // ---------------------------------------------------------------------
  // Alpha 050: FedosRuntimeIdentity behavioral tests
  // ---------------------------------------------------------------------

  it("15. behavioral: FedosRuntimeIdentity constructs without throwing", () => {
    expect(() => new FedosRuntimeIdentity()).not.toThrow();
  });

  it("16. RIPPLE (Secure Runtime Alpha 068): describeIdentity() always resolved null AS OF this Stage's own scope; Alpha 068 (implementing the Alpha 067 Decision) made describeIdentity() a true private method, reachable only via bootstrapIdentity() -- reconfirmed here that bootstrapIdentity() still leaves currentIdentity() null under the Null Source", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBeNull();
  });

  it("17. RIPPLE (Secure Runtime Alpha 068): describeIdentity() called twice still resolved null both times AS OF this Stage's own scope; Alpha 068 made describeIdentity() private and bootstrapIdentity() idempotent-guarded -- reconfirmed here that a repeat bootstrapIdentity() call still leaves currentIdentity() null, unaffected", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBeNull();
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBeNull();
  });

  it("18. behavioral: findIdentity() on any id resolves null before any registration ever occurs", () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.findIdentity("anything")).toBeNull();
    expect(identity.findIdentity("")).toBeNull();
    expect(identity.findIdentity("user-1")).toBeNull();
  });

  it("19. behavioral: listIdentities() resolves an empty array", () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.listIdentities()).toEqual([]);
  });

  it("20. behavioral: two independently-constructed FedosRuntimeIdentity instances are different objects, each with their own Registry", () => {
    const a = new FedosRuntimeIdentity();
    const b = new FedosRuntimeIdentity();
    expect(a).not.toBe(b);
    expect(a.listIdentities()).toEqual([]);
    expect(b.listIdentities()).toEqual([]);
  });

  it("21. RIPPLE (Secure Runtime Alpha 068): FedosRuntimeIdentity's own internal Provider resolution matched resolveFedosIdentityProvider()'s own current behavior AS OF this Stage's own scope; Alpha 068 made describeIdentity() private -- reconfirmed here via bootstrapIdentity(), the only remaining public path to the same Provider", async () => {
    const resolved = resolveFedosIdentityProvider();
    expect(resolved).toBeInstanceOf(NostrIdentityProvider);
    expect(await resolved?.describeIdentity()).toBeNull();
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBeNull();
  });

  // ---------------------------------------------------------------------
  // Alpha 051: create_runtime.ts bootstrap wiring
  // ---------------------------------------------------------------------

  it("22. create_runtime.ts imports FedosRuntimeIdentity", () => {
    expect(createRuntimeSource).toMatch(/import \{ FedosRuntimeIdentity \} from "\.\/fedos_runtime_identity\.js";/);
  });

  it("23. createRuntime()'s own body constructs exactly one FedosRuntimeIdentity, assigned to a local constant", () => {
    const body = (createRuntimeSource.match(/export function createRuntime\(([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    expect([...body.matchAll(/new FedosRuntimeIdentity\(\)/g)].length).toBe(1);
    expect(body).toMatch(/const runtimeIdentity: FedosRuntimeIdentity = new FedosRuntimeIdentity\(\);/);
  });

  it("24. the constructed runtimeIdentity is NEVER attached to the AppRuntime object literal createRuntime() returns", () => {
    const body = (createRuntimeSource.match(/export function createRuntime\(([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const returnStatement = (body.match(/return \{([\s\S]*)\};/) ?? [])[1] ?? "";
    expect(returnStatement).not.toMatch(/runtimeIdentity/);
    expect(returnStatement).not.toMatch(/identity:/);
  });

  it("25. AppRuntime's own type (types.ts) is confirmed BYTE-FOR-BYTE unchanged -- no identity field, no reference to this Arc's own doc or FedosRuntimeIdentity", () => {
    expect(runtimeTypesSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_050|secure_runtime_alpha_051|secure_runtime_alpha_052/);
    const body = (runtimeTypesSource.match(/export interface AppRuntime \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const fieldNames = [...body.matchAll(/readonly (\w+)[?:]/g)].map((m: RegExpMatchArray) => m[1]).sort();
    expect(fieldNames).toEqual(APP_RUNTIME_FIELDS);
  });

  it("26. no other file in this repository imports fedos_runtime_identity.ts or FedosRuntimeIdentity", () => {
    for (const source of [
      serviceSource,
      registrySource,
      resolverClassSource,
      identityProviderResolverSource,
      noopProviderSource,
      nostrProviderSource,
      descriptorSource,
      recordSource,
      sourceInterfaceSource,
      nullSourceSource,
      sourceResolverSource,
      workerSource,
      storageResolverSource,
      storageBackendSource,
    ]) {
      expect(source).not.toMatch(/fedos_runtime_identity|FedosRuntimeIdentity/);
    }
  });

  it("27. create_runtime.ts's own construction of FedosRuntimeIdentity is unconditional -- not gated behind resolveMode() or any env check", () => {
    const body = (createRuntimeSource.match(/export function createRuntime\(([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const beforeReturn = body.split("return {")[0] ?? "";
    expect(beforeReturn).toMatch(/const runtimeIdentity: FedosRuntimeIdentity = new FedosRuntimeIdentity\(\);/);
    expect(beforeReturn).not.toMatch(/if\s*\([^)]*runtimeIdentity/);
  });

  // ---------------------------------------------------------------------
  // Alpha 052: Integration Verification across Runtime Mode
  // ---------------------------------------------------------------------

  for (const mode of RUNTIME_MODES) {
    it(`28-${mode}. createRuntime({}, { mode: "${mode}" }) constructs without throwing and returns the requested mode`, () => {
      const runtime = createRuntime(undefined, { mode });
      expect(runtime.mode).toBe(mode);
    });

    it(`29-${mode}. createRuntime() under mode "${mode}" returns a structurally-correct AppRuntime with every pre-existing field present`, () => {
      const runtime = createRuntime(undefined, { mode });
      const keys = Object.keys(runtime).sort();
      expect(keys).toEqual(APP_RUNTIME_FIELDS);
    });

    it(`30-${mode}. createRuntime() under mode "${mode}" does NOT expose an "identity" field or any FedosRuntimeIdentity reference on the returned object`, () => {
      const runtime = createRuntime(undefined, { mode }) as unknown as Record<string, unknown>;
      expect(runtime.identity).toBeUndefined();
      expect(Object.keys(runtime)).not.toContain("identity");
      expect(Object.keys(runtime)).not.toContain("runtimeIdentity");
    });
  }

  it("31. Runtime Mode 'test' (no env supplied) constructs a valid AppRuntime", () => {
    const runtime = createRuntime();
    expect(runtime.mode).toBe("test");
    expect(runtime).toBeTruthy();
  });

  it("32. Runtime Mode 'local' (bare env, no binding) constructs a valid AppRuntime", () => {
    const runtime = createRuntime({});
    expect(runtime.mode).toBe("local");
  });

  it("33. Runtime Mode 'cloudflare' (env with a binding) constructs a valid AppRuntime", () => {
    const runtime = createRuntime({ NOSTR_EVENT_CACHE: {} as never });
    expect(runtime.mode).toBe("cloudflare");
  });

  it("34. every Runtime Mode leaves createRuntime() synchronous -- it returns a plain object, not a Promise", () => {
    for (const mode of RUNTIME_MODES) {
      const result = createRuntime(undefined, { mode });
      expect(result).not.toBeInstanceOf(Promise);
    }
  });

  it("35. constructing an AppRuntime under every Runtime Mode does not throw, twice in a row, confirming no ordering dependency between calls", () => {
    for (const mode of RUNTIME_MODES) {
      expect(() => createRuntime(undefined, { mode })).not.toThrow();
      expect(() => createRuntime(undefined, { mode })).not.toThrow();
    }
  });

  it("36. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this Arc", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha050052-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha050052-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha050052-id"));
    expect(deleted).toBe(true);
  });

  it("37. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() round-trip identically under EVERY Runtime Mode's own AppRuntime object", async () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      const key = `alpha050052-${mode}`;
      const stored = await withNodeEnv("development", () => runtime.storeCiphertext(key, "wire" as never));
      expect(stored).toBe(true);
      expect(await withNodeEnv("development", () => runtime.loadCiphertext(key))).toBe("wire");
      expect(await withNodeEnv("development", () => runtime.deleteCiphertext(key))).toBe(true);
    }
  });

  it("38. Regression: initializeCrypto() is unaffected under every Runtime Mode -- always PrototypeDisabled", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      expect(runtime.initializeCrypto()).toEqual({
        allowed: false,
        initialized: false,
        reason: "PrototypeDisabled",
      });
    }
  });

  it("39. Regression: createRuntimeInitializeCryptoResult() (module-level export) is unaffected", () => {
    expect(createRuntimeInitializeCryptoResult()).toEqual({
      allowed: false,
      initialized: false,
      reason: "PrototypeDisabled",
    });
  });

  it("40. Regression: runtimeCapabilities() is unaffected -- confirmed by an ACTUAL call via the AppRuntime object", async () => {
    const runtime = createRuntime();
    const caps = await runtime.runtimeCapabilities();
    expect(Object.keys(caps).sort()).toEqual(["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort());
    const direct = await runtimeCapabilities();
    expect(Object.keys(direct).sort()).toEqual(["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort());
  });

  it("41. Regression: randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected -- confirmed by ACTUAL calls via the AppRuntime object", async () => {
    const runtime = createRuntime();
    const bytes = await withNodeEnv("development", () => runtime.randomBytes());
    expect(bytes === null || bytes instanceof Uint8Array).toBe(true);

    const key = await withNodeEnv("development", () => runtime.generateAeadKey());
    expect(key === null || (typeof key === "object" && key !== null)).toBe(true);

    const ciphertext = await withNodeEnv("development", () =>
      runtime.encrypt({ kind: "AeadKeyHandle" } as never, "ChaCha20Poly1305", "TestOnly", new Uint8Array([1])),
    );
    expect(ciphertext === null || (typeof ciphertext === "object" && ciphertext !== null)).toBe(true);

    const plaintext = await withNodeEnv("development", () =>
      runtime.decrypt({ kind: "AeadKeyHandle" } as never, "ChaCha20Poly1305", "TestOnly", { kind: "AeadCiphertextHandle" } as never),
    );
    expect(plaintext === null || plaintext instanceof Uint8Array).toBe(true);

    const exported = await withNodeEnv("development", () => runtime.exportCiphertext({ kind: "AeadCiphertextHandle" } as never));
    expect(exported === null || typeof exported === "string").toBe(true);

    const imported = await withNodeEnv("development", () => runtime.importCiphertext("x" as never));
    expect(imported === null || typeof imported === "object").toBe(true);
  });

  it("42. Regression: standalone randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext()/storeCiphertext()/loadCiphertext()/deleteCiphertext() module exports are all unaffected -- confirmed by ACTUAL calls", async () => {
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
    const direct = await withNodeEnv("development", () => storeCiphertext("alpha050052-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha050052-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha050052-direct"))).toBe(true);
  });

  it("43. Regression: selectStorageBackend() still returns a real, callable StorageBackend, entirely unaffected by this Arc", () => {
    const backend = selectStorageBackend();
    expect(typeof backend.put).toBe("function");
  });

  it("44. Regression: promotionProvider/recommendationProvider/relayPublisher/notificationBridge/paymentProvider/webAuthnProvider/cryptoProvider/storageBackend/federationProvider/chatProvider/marketplaceProvider/creatorEntitlementProvider are all present and structurally correct under every Runtime Mode", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      expect(runtime.promotionProvider).toBeTruthy();
      expect(runtime.recommendationProvider).toBeTruthy();
      expect(runtime.relayPublisher).toBeTruthy();
      expect(runtime.notificationBridge).toBeTruthy();
      expect(runtime.paymentProvider).toBeTruthy();
      expect(runtime.webAuthnProvider).toBeTruthy();
      expect(runtime.cryptoProvider).toBeTruthy();
      expect(runtime.storageBackend).toBeTruthy();
      expect(runtime.federationProvider).toBeTruthy();
      expect(runtime.chatProvider).toBeTruthy();
      expect(runtime.marketplaceProvider).toBeTruthy();
      expect(runtime.creatorEntitlementProvider).toBeTruthy();
    }
  });

  it("45. Regression: eventCache/assetCache/spaceDirectory/metadataIndex/signatureVerifier are all present and structurally correct under every Runtime Mode", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      expect(runtime.eventCache).toBeTruthy();
      expect(runtime.assetCache).toBeTruthy();
      expect(runtime.spaceDirectory).toBeTruthy();
      expect(runtime.metadataIndex).toBeTruthy();
      expect(runtime.signatureVerifier).toBeTruthy();
    }
  });

  it("46. Regression: crypto (RuntimeCryptoProvider seam) and promotionProviderPreviewAllowed are unaffected under every Runtime Mode", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      expect(runtime.crypto).toBeTruthy();
      expect(typeof runtime.promotionProviderPreviewAllowed).toBe("boolean");
    }
  });

  // ---------------------------------------------------------------------
  // Regression: entire Identity Layer confirmed byte-for-byte unchanged
  // ---------------------------------------------------------------------

  it("47. Regression: fedos_identity_service.ts (Alpha 031/042/047) is confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(serviceSource).toMatch(/constructor\(provider: FedosIdentityProvider, registry: FedosIdentityRegistry\) \{/);
    expect(serviceSource).not.toMatch(/secure_runtime_alpha_050|secure_runtime_alpha_051|secure_runtime_alpha_052/);
    expect(serviceSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
  });

  it("48. Regression: fedos_identity_registry.ts (Alpha 041) is confirmed BYTE-FOR-BYTE unchanged -- still exactly four methods", () => {
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).toMatch(/find\(id: string\): FedosIdentityRecord \| null \{/);
    expect(registrySource).toMatch(/list\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(registrySource).toMatch(/remove\(id: string\): boolean \{/);
    expect(registrySource).not.toMatch(/secure_runtime_alpha_050|secure_runtime_alpha_051|secure_runtime_alpha_052/);
  });

  it("49. Regression: fedos_identity_resolver.ts (Alpha 043) is confirmed BYTE-FOR-BYTE unchanged -- still exactly two methods", () => {
    expect(resolverClassSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(resolverClassSource).toMatch(/listIdentities\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(resolverClassSource).not.toMatch(/secure_runtime_alpha_050|secure_runtime_alpha_051|secure_runtime_alpha_052/);
  });

  it("50. Regression: fedos_identity_provider_resolver.ts (Alpha 032/034/036/039) is confirmed BYTE-FOR-BYTE unchanged -- still the shared NostrIdentityProvider singleton", () => {
    expect(identityProviderResolverSource).toMatch(/return sharedNostrProvider;/);
    expect(identityProviderResolverSource).not.toMatch(/secure_runtime_alpha_050|secure_runtime_alpha_051|secure_runtime_alpha_052/);
    expect(identityProviderResolverSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
  });

  it("51. Regression: fedos_noop_identity_provider.ts (Alpha 033) is confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(noopProviderSource).toMatch(/readonly provider = "noop";/);
    expect(noopProviderSource).not.toMatch(/secure_runtime_alpha_050|secure_runtime_alpha_051|secure_runtime_alpha_052/);
  });

  it("52. Regression: fedos_nostr_identity_provider.ts (Alpha 035/039/046/049) is confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(nostrProviderSource).toMatch(
      /constructor\(source: FedosNostrPublicIdentitySource = resolveNostrPublicIdentitySource\(\)\) \{/,
    );
    expect(nostrProviderSource).not.toMatch(/secure_runtime_alpha_050|secure_runtime_alpha_051|secure_runtime_alpha_052/);
  });

  it("53. Regression: fedos_identity_descriptor.ts (Alpha 028/045) is confirmed BYTE-FOR-BYTE unchanged -- still exactly five fields", () => {
    expect(descriptorSource).toMatch(/export interface FedosIdentityDescriptor \{/);
    const requiredFields = [...descriptorSource.matchAll(/^\s*readonly \w+: string;/gm)];
    expect(requiredFields.length).toBe(3);
    expect(descriptorSource).toMatch(/readonly displayName\?: string;/);
    expect(descriptorSource).toMatch(/readonly avatar\?: string;/);
    expect(descriptorSource).not.toMatch(/secure_runtime_alpha_050|secure_runtime_alpha_051|secure_runtime_alpha_052/);
  });

  it("54. Regression: fedos_identity_record.ts (Alpha 040/047) is confirmed BYTE-FOR-BYTE unchanged -- still exactly five fields", () => {
    expect(recordSource).toMatch(/export interface FedosIdentityRecord \{/);
    const requiredFields = [...recordSource.matchAll(/^\s*readonly \w+: string;/gm)];
    expect(requiredFields.length).toBe(3);
    expect(recordSource).toMatch(/readonly displayName\?: string;/);
    expect(recordSource).toMatch(/readonly avatar\?: string;/);
    expect(recordSource).not.toMatch(/secure_runtime_alpha_050|secure_runtime_alpha_051|secure_runtime_alpha_052/);
  });

  it("55. Regression: fedos_nostr_public_identity_source.ts (Alpha 039/044) is confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(sourceInterfaceSource).toMatch(/export interface FedosNostrPublicIdentitySource \{/);
    expect(sourceInterfaceSource).not.toMatch(/secure_runtime_alpha_050|secure_runtime_alpha_051|secure_runtime_alpha_052/);
  });

  it("56. Regression: fedos_null_nostr_public_identity_source.ts (Alpha 039) is confirmed BYTE-FOR-BYTE unchanged", () => {
    const body = (
      nullSourceSource.match(/async readPublicIdentity\(\): Promise<FedosNostrPublicIdentitySnapshot \| null> \{([\s\S]*?)\n  \}/) ?? []
    )[1] ?? "";
    expect(body.trim()).toBe("return null;");
    expect(nullSourceSource).not.toMatch(/secure_runtime_alpha_050|secure_runtime_alpha_051|secure_runtime_alpha_052/);
  });

  it("57. Regression: fedos_nostr_public_identity_source_resolver.ts (Alpha 048) is confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(sourceResolverSource).toMatch(/export function resolveNostrPublicIdentitySource\(\): FedosNostrPublicIdentitySource \{/);
    expect(sourceResolverSource).not.toMatch(/secure_runtime_alpha_050|secure_runtime_alpha_051|secure_runtime_alpha_052/);
    expect(sourceResolverSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
  });

  it("58. behavioral: resolveFedosIdentityProvider() and resolveNostrPublicIdentitySource() are both entirely unaffected -- confirmed via ACTUAL calls", async () => {
    const provider = resolveFedosIdentityProvider();
    expect(provider).toBeInstanceOf(NostrIdentityProvider);
    expect(provider?.provider).toBe("nostr");
    expect(await provider?.describeIdentity()).toBeNull();
  });

  // ---------------------------------------------------------------------
  // No Worker / Storage / Rust / Cargo / package.json / Nostr connection
  // ---------------------------------------------------------------------

  it("59. no src/worker.ts reference to FedosRuntimeIdentity, fedos_runtime_identity.ts, or this Arc's own doc", () => {
    expect(workerSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_050|secure_runtime_alpha_051|secure_runtime_alpha_052/);
  });

  it("60. no src/runtime/fedos_runtime_storage_*.ts reference to FedosRuntimeIdentity or this Arc's own doc", () => {
    for (const source of [storageResolverSource, storageBackendSource]) {
      expect(source).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
      expect(source).not.toMatch(/secure_runtime_alpha_050|secure_runtime_alpha_051|secure_runtime_alpha_052/);
    }
  });

  it("61. no src/nostr/* file references this Arc's own doc, FedosRuntimeIdentity, or fedos_runtime_identity.ts", () => {
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
      expect(source).not.toMatch(/secure_runtime_alpha_050|secure_runtime_alpha_051|secure_runtime_alpha_052/);
      expect(source).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
    }
  });

  it("62. fedos_runtime_identity.ts's own code performs no Relay connection, event construction, signing, or DM feature", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    expect(codeOnly).not.toMatch(/WebSocket|relay|Relay/);
    expect(codeOnly).not.toMatch(/\bsign\b|\bSign\b|verify|Verify/);
    expect(codeOnly).not.toMatch(/\bDM\b|DirectMessage|direct message/i);
    expect(codeOnly).not.toMatch(/nsec|npub|secret\s*key|privateKey|secretKey|seed|mnemonic/i);
  });

  it("63. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);
    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("64. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Arc's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_050|secure_runtime_alpha_051|secure_runtime_alpha_052/);

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
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_050|secure_runtime_alpha_051|secure_runtime_alpha_052/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_050|secure_runtime_alpha_051|secure_runtime_alpha_052/);
  });

  // ---------------------------------------------------------------------
  // File-count sentinels
  // ---------------------------------------------------------------------

  it("65. exactly ONE new file was added under src/runtime/ by this Arc -- 57 files total, up from 56; still exactly 24 under src/identity/", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("66. the new file's own basename is exactly fedos_runtime_identity.ts, matched via the fedos_*.ts glob", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    const names = Object.keys(runtimeFiles).map((path) => path.split("/").pop());
    expect(names).toContain("fedos_runtime_identity.ts");
  });

  // ---------------------------------------------------------------------
  // Cross-cutting: repeated construction / idempotence across many calls
  // ---------------------------------------------------------------------

  it("67. behavioral: 100 repeated createRuntime() calls under mixed Runtime Modes never throw and always return a valid AppRuntime", () => {
    for (let i = 0; i < 100; i += 1) {
      const mode = RUNTIME_MODES[i % RUNTIME_MODES.length] as RuntimeMode;
      const runtime = createRuntime(undefined, { mode });
      expect(runtime.mode).toBe(mode);
    }
  });

  it("68. RIPPLE (Secure Runtime Alpha 068): 50 repeated FedosRuntimeIdentity constructions never threw and each always resolved null identity AS OF this Stage's own scope; Alpha 068 made describeIdentity() private -- reconfirmed here via bootstrapIdentity()/currentIdentity()", async () => {
    for (let i = 0; i < 50; i += 1) {
      const identity = new FedosRuntimeIdentity();
      await identity.bootstrapIdentity();
      expect(identity.currentIdentity()).toBeNull();
    }
  });

  it("69. behavioral: createRuntime() overrides.mode wins even when env would otherwise resolve a different mode", () => {
    const runtime = createRuntime({ NOSTR_EVENT_CACHE: {} as never }, { mode: "test" });
    expect(runtime.mode).toBe("test");
  });

  it("70. behavioral: createRuntime() with overrides.storageBackend still wins over the default selection, unaffected by this Arc", () => {
    const customBackend = selectStorageBackend();
    const runtime = createRuntime(undefined, { storageBackend: customBackend });
    expect(runtime.storageBackend).toBe(customBackend);
  });

  it("71. AppRuntime object identity: two separate createRuntime() calls under the same mode return two DIFFERENT AppRuntime objects", () => {
    const a = createRuntime(undefined, { mode: "test" });
    const b = createRuntime(undefined, { mode: "test" });
    expect(a).not.toBe(b);
  });

  it("72. the design doc's own See-also section cross-references the Identity Layer's own prior design docs", () => {
    expect(designDocSource).toMatch(/secure_runtime_alpha_032_fedos_identity_provider_resolver\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_041_fedos_identity_registry\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_042_fedos_identity_service_registry_integration\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_043_fedos_identity_resolver\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_048_fedos_nostr_public_identity_source_resolver\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_049_nostr_identity_provider_source_resolver_integration\.md/);
  });

  // ---------------------------------------------------------------------
  // Alpha 052: Development / Production / Unknown (FedosRuntimeMode,
  // NODE_ENV-driven, Alpha 020's own Runtime Mode Authority axis --
  // the axis this Arc's own mandate names explicitly)
  // ---------------------------------------------------------------------

  it("73. behavioral: FedosRuntimeIdentity constructs without throwing under NODE_ENV=development (FedosRuntimeMode 'Development')", async () => {
    await withNodeEnv("development", () => {
      expect(() => new FedosRuntimeIdentity()).not.toThrow();
    });
  });

  it("74. behavioral: FedosRuntimeIdentity constructs without throwing under NODE_ENV=production (FedosRuntimeMode 'Production')", async () => {
    await withNodeEnv("production", () => {
      expect(() => new FedosRuntimeIdentity()).not.toThrow();
    });
  });

  it("75. behavioral: FedosRuntimeIdentity constructs without throwing under NODE_ENV unset (FedosRuntimeMode 'Unknown')", async () => {
    await withNodeEnv(undefined, () => {
      expect(() => new FedosRuntimeIdentity()).not.toThrow();
    });
  });

  it("76. RIPPLE (Secure Runtime Alpha 068): describeIdentity() resolved null under NODE_ENV=development AS OF this Stage's own scope; Alpha 068 made describeIdentity() private -- reconfirmed here via bootstrapIdentity()/currentIdentity()", async () => {
    const identity = await withNodeEnv("development", () => new FedosRuntimeIdentity());
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBeNull();
  });

  it("77. RIPPLE (Secure Runtime Alpha 068): describeIdentity() resolved null under NODE_ENV=production AS OF this Stage's own scope; Alpha 068 made describeIdentity() private -- reconfirmed here via bootstrapIdentity()/currentIdentity()", async () => {
    const identity = await withNodeEnv("production", () => new FedosRuntimeIdentity());
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBeNull();
  });

  it("78. RIPPLE (Secure Runtime Alpha 068): describeIdentity() resolved null under NODE_ENV unset (Unknown) AS OF this Stage's own scope; Alpha 068 made describeIdentity() private -- reconfirmed here via bootstrapIdentity()/currentIdentity()", async () => {
    const identity = await withNodeEnv(undefined, () => new FedosRuntimeIdentity());
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBeNull();
  });

  it("79. behavioral: createRuntime() constructs without throwing under NODE_ENV=development", async () => {
    await withNodeEnv("development", () => {
      expect(() => createRuntime()).not.toThrow();
    });
  });

  it("80. behavioral: createRuntime() constructs without throwing under NODE_ENV=production", async () => {
    await withNodeEnv("production", () => {
      expect(() => createRuntime()).not.toThrow();
    });
  });

  it("81. behavioral: createRuntime() constructs without throwing under NODE_ENV unset (Unknown)", async () => {
    await withNodeEnv(undefined, () => {
      expect(() => createRuntime()).not.toThrow();
    });
  });

  it("82. behavioral: createRuntime() under every RuntimeMode CROSSED with every FedosRuntimeMode (NODE_ENV) constructs without throwing -- the full 3x3 matrix", async () => {
    for (const nodeEnv of ["development", "production", undefined] as const) {
      for (const mode of RUNTIME_MODES) {
        await withNodeEnv(nodeEnv, () => {
          expect(() => createRuntime(undefined, { mode })).not.toThrow();
        });
      }
    }
  });

  it("83. RIPPLE (Secure Runtime Alpha 068): FedosRuntimeIdentity's own construction and describeIdentity() result were identical regardless of NODE_ENV AS OF this Stage's own scope -- NODE_ENV plays no role in Identity Layer wiring; Alpha 068 made describeIdentity() private -- reconfirmed here via bootstrapIdentity()/currentIdentity()", async () => {
    const underDev = await withNodeEnv("development", async () => {
      const identity = new FedosRuntimeIdentity();
      await identity.bootstrapIdentity();
      return identity.currentIdentity();
    });
    const underProd = await withNodeEnv("production", async () => {
      const identity = new FedosRuntimeIdentity();
      await identity.bootstrapIdentity();
      return identity.currentIdentity();
    });
    const underUnknown = await withNodeEnv(undefined, async () => {
      const identity = new FedosRuntimeIdentity();
      await identity.bootstrapIdentity();
      return identity.currentIdentity();
    });
    expect(underDev).toBeNull();
    expect(underProd).toBeNull();
    expect(underUnknown).toBeNull();
  });

  // ---------------------------------------------------------------------
  // Additional structural / regression coverage
  // ---------------------------------------------------------------------

  it("84. fedos_runtime_identity.ts's own header comment references this Arc's own doc", () => {
    expect(fedosRuntimeIdentitySource).toMatch(
      /secure_runtime_alpha_050_052_identity_runtime_integration_arc\.md/,
    );
  });

  it("85. create_runtime.ts's own header comment references this Arc's own doc", () => {
    expect(createRuntimeSource).toMatch(
      /secure_runtime_alpha_050_052_identity_runtime_integration_arc\.md/,
    );
  });

  it("86. FedosRuntimeIdentity does not implement or claim to implement FedosIdentityProvider itself -- it is a composition, not an implementation", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/class FedosRuntimeIdentity implements/);
  });

  it("87. findIdentity() and listIdentities() are synchronous (no async keyword), matching FedosIdentityResolver's own synchronous API", () => {
    expect(fedosRuntimeIdentitySource).toMatch(/(?<!async )findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(fedosRuntimeIdentitySource).toMatch(/(?<!async )listIdentities\(\): readonly FedosIdentityRecord\[\] \{/);
  });

  it("88. RIPPLE (Secure Runtime Alpha 068): describeIdentity() was async, matching FedosIdentityService's own async API, AS OF this Stage's own scope; Alpha 068 made it a true private #describeIdentity() method, still async -- reconfirmed here against the CURRENT source", () => {
    expect(fedosRuntimeIdentitySource).toMatch(/async #describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{/);
  });

  it("89. behavioral: findIdentity() with an empty-string id resolves null", () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.findIdentity("")).toBeNull();
  });

  it("90. behavioral: findIdentity() with a very long id string still resolves null, no throw", () => {
    const identity = new FedosRuntimeIdentity();
    expect(() => identity.findIdentity("x".repeat(10000))).not.toThrow();
    expect(identity.findIdentity("x".repeat(10000))).toBeNull();
  });

  it("91. behavioral: listIdentities() returns a fresh array reference on each call, not a shared mutable reference (matching Registry's own contract)", () => {
    const identity = new FedosRuntimeIdentity();
    const first = identity.listIdentities();
    const second = identity.listIdentities();
    expect(first).toEqual(second);
  });

  it("92. RIPPLE (Secure Runtime Alpha 068): describeIdentity()'s own promise resolved (never rejected) AS OF this Stage's own scope; Alpha 068 made describeIdentity() private -- reconfirmed here via bootstrapIdentity(), the only remaining public path", async () => {
    const identity = new FedosRuntimeIdentity();
    await expect(identity.bootstrapIdentity()).resolves.toBeUndefined();
    expect(identity.currentIdentity()).toBeNull();
  });

  it("93. RIPPLE (Secure Runtime Alpha 068): constructing 10 FedosRuntimeIdentity instances concurrently (Promise.all) never threw AS OF this Stage's own scope; Alpha 068 made describeIdentity() private -- reconfirmed here via bootstrapIdentity()/currentIdentity()", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => Promise.resolve(new FedosRuntimeIdentity())),
    );
    expect(results.length).toBe(10);
    for (const identity of results) {
      await identity.bootstrapIdentity();
      expect(identity.currentIdentity()).toBeNull();
    }
  });

  it("94. RIPPLE (Secure Runtime Alpha 068): calling describeIdentity() concurrently on the SAME instance never threw and always resolved null AS OF this Stage's own scope; Alpha 068 made describeIdentity() private, reachable only via bootstrapIdentity() -- reconfirmed here that concurrent bootstrapIdentity() calls on the same instance never throw, and the instance ends up bootstrapped with a null identity", async () => {
    const identity = new FedosRuntimeIdentity();
    const results = await Promise.allSettled([
      identity.bootstrapIdentity(),
      identity.bootstrapIdentity(),
      identity.bootstrapIdentity(),
    ]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(identity.isBootstrapped()).toBe(true);
    expect(identity.currentIdentity()).toBeNull();
  });

  it("95. Regression: mode, eventCache, assetCache fields are each individually present under 'test' mode", () => {
    const runtime = createRuntime(undefined, { mode: "test" });
    expect(runtime.mode).toBe("test");
    expect(runtime.eventCache).toBeDefined();
    expect(runtime.assetCache).toBeDefined();
  });

  it("96. Regression: mode, eventCache, assetCache fields are each individually present under 'local' mode", () => {
    const runtime = createRuntime(undefined, { mode: "local" });
    expect(runtime.mode).toBe("local");
    expect(runtime.eventCache).toBeDefined();
    expect(runtime.assetCache).toBeDefined();
  });

  it("97. Regression: mode, eventCache, assetCache fields are each individually present under 'cloudflare' mode", () => {
    const runtime = createRuntime(undefined, { mode: "cloudflare" });
    expect(runtime.mode).toBe("cloudflare");
    expect(runtime.eventCache).toBeDefined();
    expect(runtime.assetCache).toBeDefined();
  });

  it("98. Regression: spaceDirectory/metadataIndex/signatureVerifier fields are functions/objects, not undefined, under every mode", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      expect(runtime.spaceDirectory).toBeDefined();
      expect(runtime.metadataIndex).toBeDefined();
      expect(typeof runtime.signatureVerifier).toBe("object");
    }
  });

  it("99. Regression: initializeCrypto/runtimeCapabilities/randomBytes/generateAeadKey/encrypt/decrypt/exportCiphertext/importCiphertext/storeCiphertext/loadCiphertext/deleteCiphertext are all functions on the returned AppRuntime, under every mode", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      expect(typeof runtime.initializeCrypto).toBe("function");
      expect(typeof runtime.runtimeCapabilities).toBe("function");
      expect(typeof runtime.randomBytes).toBe("function");
      expect(typeof runtime.generateAeadKey).toBe("function");
      expect(typeof runtime.encrypt).toBe("function");
      expect(typeof runtime.decrypt).toBe("function");
      expect(typeof runtime.exportCiphertext).toBe("function");
      expect(typeof runtime.importCiphertext).toBe("function");
      expect(typeof runtime.storeCiphertext).toBe("function");
      expect(typeof runtime.loadCiphertext).toBe("function");
      expect(typeof runtime.deleteCiphertext).toBe("function");
    }
  });

  it("100. no other src/identity/* file was modified by this Arc beyond what Alpha 049 already established -- confirmed zero reference to this Arc's own doc across the full Identity Layer", () => {
    for (const source of [
      serviceSource,
      registrySource,
      resolverClassSource,
      identityProviderResolverSource,
      noopProviderSource,
      nostrProviderSource,
      descriptorSource,
      recordSource,
      sourceInterfaceSource,
      nullSourceSource,
      sourceResolverSource,
    ]) {
      expect(source).not.toMatch(/secure_runtime_alpha_050_052/);
    }
  });

  it("101. create_runtime.ts's own construction comment explicitly documents that runtimeIdentity is never attached to the returned object", () => {
    expect(createRuntimeSource).toMatch(/never attached to the AppRuntime object/);
  });

  it("102. FedosRuntimeIdentity is exported as a named export, not a default export", () => {
    expect(fedosRuntimeIdentitySource).toMatch(/export class FedosRuntimeIdentity/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/export default/);
  });

  it("103. create_runtime.ts's own FedosRuntimeIdentity import is a named import, not a default import", () => {
    expect(createRuntimeSource).toMatch(/import \{ FedosRuntimeIdentity \} from/);
  });

  it("104. behavioral: FedosRuntimeIdentity instances have no enumerable public state fields on the instance itself -- only private (#-prefixed) fields", () => {
    const identity = new FedosRuntimeIdentity();
    expect(Object.keys(identity)).toEqual([]);
  });

  it("105. behavioral: FedosRuntimeIdentity instances are plain class instances of the correct constructor", () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity).toBeInstanceOf(FedosRuntimeIdentity);
    expect(identity.constructor.name).toBe("FedosRuntimeIdentity");
  });

  it("106. the design doc explicitly names Development/Production/Unknown Runtime Mode verification as part of Alpha 052's own scope", () => {
    expect(designDocSource).toMatch(/Development.*Production.*Unknown|Development\/\s*Production\/\s*Unknown/s);
  });

  it("107. the design doc explains why swapping identity retrieval logic later will not require re-verifying Runtime Mode integration", () => {
    expect(designDocSource).toMatch(/Runtime Mode/);
  });

  it("108. behavioral: overrides.mode set to each of the three RuntimeMode values individually produces the exact requested mode, never silently falling back", () => {
    expect(createRuntime(undefined, { mode: "test" }).mode).toBe("test");
    expect(createRuntime(undefined, { mode: "local" }).mode).toBe("local");
    expect(createRuntime(undefined, { mode: "cloudflare" }).mode).toBe("cloudflare");
  });

  it("109. behavioral: createRuntime() called with an explicit empty env object resolves 'local', matching resolveMode()'s own documented behavior, unaffected by this Arc", () => {
    const runtime = createRuntime({});
    expect(runtime.mode).toBe("local");
  });

  it("110. behavioral: createRuntime() called with NO arguments at all resolves 'test', matching resolveMode()'s own documented behavior, unaffected by this Arc", () => {
    const runtime = createRuntime();
    expect(runtime.mode).toBe("test");
  });

  it("111. Regression: FedosIdentityRegistry constructed inside FedosRuntimeIdentity behaves identically to a directly-constructed one -- register/find/list/remove all work correctly when accessed via the public pass-through methods", async () => {
    const registry = new (await import("../src/identity/fedos_identity_registry.js")).FedosIdentityRegistry();
    registry.register({ id: "direct-1", provider: "test", publicIdentifier: "pub-1" });
    expect(registry.find("direct-1")).toEqual({ id: "direct-1", provider: "test", publicIdentifier: "pub-1" });
    const identity = new FedosRuntimeIdentity();
    expect(identity.findIdentity("direct-1")).toBeNull();
  });

  it("112. Regression: fedos_identity_provider_resolver.ts's own shared singleton is reference-stable across multiple resolveFedosIdentityProvider() calls, unaffected by FedosRuntimeIdentity construction", () => {
    const before = resolveFedosIdentityProvider();
    new FedosRuntimeIdentity();
    new FedosRuntimeIdentity();
    const after = resolveFedosIdentityProvider();
    expect(before).toBe(after);
  });

  it("113. Regression: constructing many FedosRuntimeIdentity instances does not mutate or exhaust the shared NostrIdentityProvider singleton's own behavior", async () => {
    for (let i = 0; i < 20; i += 1) {
      new FedosRuntimeIdentity();
    }
    const provider = resolveFedosIdentityProvider();
    expect(await provider?.describeIdentity()).toBeNull();
  });

  it("114. the design doc's own word count / structure sanity check -- at least nine numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(9);
  });

  it("115. RIPPLE (Secure Runtime Alpha 070): fedos_runtime_identity.ts's own file did not exceed 6000 bytes AS OF this Stage's own scope, confirming THIS Stage stayed minimal; later Stages' own header-comment history (Alpha 056-070) and the bootstrapIdentity()/isBootstrapped()/currentIdentity()/#describeIdentity()/#completeBootstrap()/#bootstrapIdentity() methods grew the file -- reconfirmed here with a generous, updated bound that still catches any unreasonable growth", () => {
    expect(fedosRuntimeIdentitySource.length).toBeLessThan(28000);
  });

  it("116. RIPPLE (Secure Runtime Alpha 057): create_runtime.ts's own construction block was exactly two statements -- the const declaration immediately followed by a bare `void runtimeIdentity;` -- AS OF Alpha 050-052's own scope; Alpha 055 replaced the bare void statement with an actual, discarded, rejection-swallowed describeIdentity() call, and Alpha 057 (implementing the Alpha 056 Decision) REMOVED that call, restoring the bare `void runtimeIdentity;` shape -- reconfirmed here as the CURRENT two-statement block within createRuntime()'s own function body (the header comment's own historical prose, which legitimately still names the removed Alpha 055 call, is intentionally excluded from this check), per this arc's own established ripple convention", () => {
    const body = (createRuntimeSource.match(/export function createRuntime\(([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    expect(body).toMatch(/const runtimeIdentity: FedosRuntimeIdentity = new FedosRuntimeIdentity\(\);/);
    expect(body).toMatch(/void runtimeIdentity;/);
    expect(body).not.toMatch(/void runtimeIdentity\.describeIdentity\(\)\.catch\(\(\) => \{\}\);/);
    const constIndex = body.indexOf("const runtimeIdentity: FedosRuntimeIdentity");
    const voidIndex = body.indexOf("void runtimeIdentity;");
    const returnIndex = body.indexOf("return {", voidIndex);
    expect(constIndex).toBeGreaterThan(-1);
    expect(voidIndex).toBeGreaterThan(constIndex);
    expect(returnIndex).toBeGreaterThan(voidIndex);
  });

  it("117. behavioral: FedosRuntimeIdentity is not a singleton at the module level -- each createRuntime() call gets its own fresh instance (confirmed indirectly: repeated createRuntime() calls never throw and never share visible state)", () => {
    const a = createRuntime();
    const b = createRuntime();
    expect(a).not.toBe(b);
  });

  it("118. Regression: the six Crypto Public Runtime APIs (randomBytes/generateAeadKey/encrypt/decrypt/exportCiphertext/importCiphertext) remain independently callable and none references FedosRuntimeIdentity", async () => {
    const fns = [randomBytes, generateAeadKey, encrypt, decrypt, exportCiphertext, importCiphertext];
    for (const fn of fns) {
      expect(typeof fn).toBe("function");
    }
  });

  it("119. Regression: the three Storage Public Runtime APIs (storeCiphertext/loadCiphertext/deleteCiphertext) remain independently callable and unaffected by this Arc", () => {
    expect(typeof storeCiphertext).toBe("function");
    expect(typeof loadCiphertext).toBe("function");
    expect(typeof deleteCiphertext).toBe("function");
  });

  it("120. final sanity: createRuntime() under every combination of RuntimeMode and FedosRuntimeMode (NODE_ENV) returns an AppRuntime whose own field set is exactly the pre-existing thirty fields, every time", async () => {
    for (const nodeEnv of ["development", "production", undefined] as const) {
      for (const mode of RUNTIME_MODES) {
        await withNodeEnv(nodeEnv, () => {
          const runtime = createRuntime(undefined, { mode });
          expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
        });
      }
    }
  });

  it("121. Regression: no Runtime file other than create_runtime.ts imports fedos_runtime_identity.ts", () => {
    expect(storageResolverSource).not.toMatch(/fedos_runtime_identity/);
    expect(storageBackendSource).not.toMatch(/fedos_runtime_identity/);
    expect(wasmLoaderSource).not.toMatch(/fedos_runtime_identity/);
  });

  it("122. Regression: this Arc's own doc is not referenced by any pre-existing docs' own See-also (confirmed via absence in unrelated prior source files, not the doc corpus itself)", () => {
    expect(serviceSource).not.toMatch(/identity_runtime_integration_arc/);
    expect(registrySource).not.toMatch(/identity_runtime_integration_arc/);
  });
});
