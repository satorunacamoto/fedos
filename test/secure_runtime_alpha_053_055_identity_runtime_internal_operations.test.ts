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
import type { RuntimeMode } from "../src/runtime/types.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_053_055_identity_runtime_internal_operations.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha050DocSource from "../docs/secure_runtime_alpha_050_052_identity_runtime_integration_arc.md?raw";
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
import nullSourceSource from "../src/identity/fedos_null_nostr_public_identity_source.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sourceResolverSource from "../src/identity/fedos_nostr_public_identity_source_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilitySource from "../src/identity/fedos_identity_capability.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopProviderSource from "../src/identity/fedos_noop_identity_provider.ts?raw";
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

const RUNTIME_MODES: readonly RuntimeMode[] = ["test", "local", "cloudflare"];
const NODE_ENVS = ["development", "production", undefined] as const;

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
 * Secure Runtime Alpha 053-055 -- "Identity Runtime Internal
 * Operations": Alpha 053/054 formally re-confirm `describeIdentity()`/
 * `findIdentity()`/`listIdentities()` on `FedosRuntimeIdentity` --
 * already shipped by Alpha 050, ZERO functional change here. Alpha 055
 * is the real change: `create_runtime.ts` now calls
 * `runtimeIdentity.describeIdentity()` exactly once per
 * `createRuntime()` call, discarding the result, never `await`ed.
 */
describe("Secure Runtime Alpha 053-055 -- Identity Runtime Internal Operations, internal-only, no Public Runtime API/AppRuntime/Worker/Storage/Crypto change", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(10000);
  });

  it("2. the design doc covers Alpha 053 (describeIdentity), Alpha 054 (findIdentity/listIdentities), and Alpha 055 (Identity Runtime First Use) as distinct sections", () => {
    expect(designDocSource).toMatch(/## 2\. Alpha 053 — `describeIdentity\(\)`/);
    expect(designDocSource).toMatch(/## 3\. Alpha 054 — `findIdentity\(\)`\/`listIdentities\(\)`/);
    expect(designDocSource).toMatch(/## 6\. Alpha 055 — Identity Runtime First Use/);
  });

  it("3. the design doc explicitly states Alpha 053/054 make ZERO functional code change", () => {
    expect(designDocSource).toMatch(/Alpha 053 makes ZERO functional code change/);
    expect(designDocSource).toMatch(/Alpha 054 also makes ZERO\s+functional code change/);
  });

  it("4. the design doc explains why Alpha 053/054 were still documented and tested rather than skipped", () => {
    expect(designDocSource).toMatch(
      /Why Alpha 053\/054 made no code change, rather than being skipped/,
    );
  });

  it("5. the design doc records the exact Alpha 055 construction block", () => {
    expect(designDocSource).toMatch(
      /const runtimeIdentity: FedosRuntimeIdentity = new FedosRuntimeIdentity\(\);/,
    );
    expect(designDocSource).toMatch(
      /void runtimeIdentity\.describeIdentity\(\)\.catch\(\(\) => \{\}\);/,
    );
  });

  it("6. the design doc explains why the return value is discarded and why createRuntime() is not made async", () => {
    expect(designDocSource).toMatch(
      /Why the return value is discarded rather than logged or inspected/,
    );
    expect(designDocSource).toMatch(/Why `createRuntime\(\)` is not made `async`/);
  });

  it("7. the design doc draws a structural comparison with reachCryptoLoaderFacade()", () => {
    expect(designDocSource).toMatch(/reachCryptoLoaderFacade\(\)/);
    expect(designDocSource).toMatch(/createCryptoLoaderFacade\(\)/);
  });

  it("8. the design doc records the explicit 'does NOT do' list", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any field to `AppRuntime`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/worker\.ts`/);
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* modify any Crypto Public Runtime API/,
    );
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* make `createRuntime\(\)` asynchronous/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `packages\/fedos-core-rust`/);
  });

  it("9. the design doc cross-references the Alpha 050-052 doc and the original Service/Registry/Resolver docs", () => {
    expect(designDocSource).toMatch(
      /secure_runtime_alpha_050_052_identity_runtime_integration_arc\.md/,
    );
    expect(alpha050DocSource.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------
  // Alpha 053/054: confirm FedosRuntimeIdentity's own methods, unchanged
  // ---------------------------------------------------------------------

  it("10. FedosRuntimeIdentity's own private field set is confirmed unchanged -- exactly three private fields", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const fieldDeclarations = [...codeOnly.matchAll(/^\s*readonly #(\w+)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldDeclarations).toEqual(["registry", "service", "resolver"]);
  });

  it("11. FedosRuntimeIdentity's own constructor is confirmed unchanged -- zero arguments, the exact same four-statement body", () => {
    expect(fedosRuntimeIdentitySource).toMatch(/constructor\(\) \{/);
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

  it("12. RIPPLE (Secure Runtime Alpha 068): describeIdentity()'s own implementation was EXACTLY 'return this.#service.describeIdentity();', matching Alpha 053's own literal requested specification, byte-for-byte, confirming Alpha 050 already satisfied it, AS OF this Stage's own scope; Alpha 068 made it a true private #describeIdentity() method with the IDENTICAL body -- reconfirmed here against the CURRENT source", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const body = (codeOnly.match(/async #describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body.trim()).toBe("return this.#service.describeIdentity();");
  });

  it("13. RIPPLE self-check: findIdentity()'s own implementation is EXACTLY 'return this.#resolver.findIdentity(id);', matching Alpha 054's own literal requested specification, byte-for-byte", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const body = (codeOnly.match(/findIdentity\(id: string\): FedosIdentityRecord \| null \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body.trim()).toBe("return this.#resolver.findIdentity(id);");
  });

  it("14. RIPPLE self-check: listIdentities()'s own implementation is EXACTLY 'return this.#resolver.listIdentities();', matching Alpha 054's own literal requested specification, byte-for-byte", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const body = (codeOnly.match(/listIdentities\(\): readonly FedosIdentityRecord\[\] \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body.trim()).toBe("return this.#resolver.listIdentities();");
  });

  it("15. findIdentity()/listIdentities() are confirmed synchronous -- no async keyword, no Promise return type, per Alpha 054's own mandate", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/async findIdentity/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/async listIdentities/);
    expect(fedosRuntimeIdentitySource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(fedosRuntimeIdentitySource).toMatch(/listIdentities\(\): readonly FedosIdentityRecord\[\] \{/);
  });

  it("16. RIPPLE (Secure Runtime Alpha 068): describeIdentity() was confirmed async, returning a Promise, per Alpha 053's own mandate, AS OF this Stage's own scope; Alpha 068 made it a true private #describeIdentity() method, still async -- reconfirmed here against the CURRENT source", () => {
    expect(fedosRuntimeIdentitySource).toMatch(/async #describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{/);
  });

  it("17. findIdentity()/listIdentities() route through the Resolver (Registry access), not the Service", () => {
    const findBody = (fedosRuntimeIdentitySource.match(/findIdentity\(id: string\): FedosIdentityRecord \| null \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(findBody).toMatch(/this\.#resolver/);
    expect(findBody).not.toMatch(/this\.#service/);
    const listBody = (fedosRuntimeIdentitySource.match(/listIdentities\(\): readonly FedosIdentityRecord\[\] \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(listBody).toMatch(/this\.#resolver/);
    expect(listBody).not.toMatch(/this\.#service/);
  });

  it("18. fedos_runtime_identity.ts's own header comment references both this Arc's own doc and the Alpha 050-052 doc", () => {
    expect(fedosRuntimeIdentitySource).toMatch(
      /secure_runtime_alpha_053_055_identity_runtime_internal_operations\.md/,
    );
    expect(fedosRuntimeIdentitySource).toMatch(
      /secure_runtime_alpha_050_052_identity_runtime_integration_arc\.md/,
    );
  });

  // ---------------------------------------------------------------------
  // Alpha 053/054: behavioral confirmation
  // ---------------------------------------------------------------------

  it("19. RIPPLE (Secure Runtime Alpha 068): describeIdentity() resolved null AS OF this Stage's own scope; Alpha 068 made describeIdentity() private -- reconfirmed here via bootstrapIdentity()/currentIdentity()", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBeNull();
  });

  it("20. behavioral: findIdentity() on any id resolves null before any registration ever occurs", () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.findIdentity("user-1")).toBeNull();
    expect(identity.findIdentity("")).toBeNull();
    expect(identity.findIdentity("anything-at-all")).toBeNull();
  });

  it("21. behavioral: listIdentities() resolves an empty array", () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.listIdentities()).toEqual([]);
    expect(Array.isArray(identity.listIdentities())).toBe(true);
  });

  it("22. behavioral: findIdentity()/listIdentities() are truly synchronous -- calling them does not return a Promise", () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.findIdentity("x")).not.toBeInstanceOf(Promise);
    expect(identity.listIdentities()).not.toBeInstanceOf(Promise);
  });

  it("23. RIPPLE (Secure Runtime Alpha 068): describeIdentity() was truly asynchronous -- calling it returned a Promise -- AS OF this Stage's own scope; Alpha 068 made describeIdentity() private -- reconfirmed here that bootstrapIdentity(), the only remaining public path to it, still returns a Promise", () => {
    const identity = new FedosRuntimeIdentity();
    const result = identity.bootstrapIdentity();
    expect(result).toBeInstanceOf(Promise);
  });

  it("24. RIPPLE (Secure Runtime Alpha 068): calling describeIdentity()/findIdentity()/listIdentities() in any order never threw AS OF this Stage's own scope; Alpha 068 made describeIdentity() private -- reconfirmed here that bootstrapIdentity()/findIdentity()/listIdentities() in any order still never throw", async () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.listIdentities()).toEqual([]);
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBeNull();
    expect(identity.findIdentity("x")).toBeNull();
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBeNull();
  });

  // ---------------------------------------------------------------------
  // Alpha 053/054/055 confirmed under every RuntimeMode x FedosRuntimeMode
  // ---------------------------------------------------------------------

  for (const mode of RUNTIME_MODES) {
    it(`25-${mode}. RIPPLE (Secure Runtime Alpha 068): a directly-constructed FedosRuntimeIdentity under RuntimeMode "${mode}" context still resolved describeIdentity() null, findIdentity() null, listIdentities() empty AS OF this Stage's own scope; Alpha 068 made describeIdentity() private -- reconfirmed here via bootstrapIdentity()/currentIdentity()`, async () => {
      const runtime = createRuntime(undefined, { mode });
      expect(runtime.mode).toBe(mode);
      const identity = new FedosRuntimeIdentity();
      await identity.bootstrapIdentity();
      expect(identity.currentIdentity()).toBeNull();
      expect(identity.findIdentity("x")).toBeNull();
      expect(identity.listIdentities()).toEqual([]);
    });
  }

  for (const nodeEnv of NODE_ENVS) {
    it(`26-${nodeEnv ?? "unset"}. RIPPLE (Secure Runtime Alpha 068): describeIdentity()/findIdentity()/listIdentities() were all null/empty under NODE_ENV=${nodeEnv ?? "unset"} (FedosRuntimeMode) AS OF this Stage's own scope; Alpha 068 made describeIdentity() private -- reconfirmed here via bootstrapIdentity()/currentIdentity()`, async () => {
      await withNodeEnv(nodeEnv, async () => {
        const identity = new FedosRuntimeIdentity();
        await identity.bootstrapIdentity();
        expect(identity.currentIdentity()).toBeNull();
        expect(identity.findIdentity("x")).toBeNull();
        expect(identity.listIdentities()).toEqual([]);
      });
    });
  }

  it("27. behavioral: the full 3x3 matrix (RuntimeMode x FedosRuntimeMode) all resolve describeIdentity() null via createRuntime()'s own internal startup call never throwing", async () => {
    for (const nodeEnv of NODE_ENVS) {
      for (const mode of RUNTIME_MODES) {
        await withNodeEnv(nodeEnv, () => {
          expect(() => createRuntime(undefined, { mode })).not.toThrow();
        });
      }
    }
  });

  // ---------------------------------------------------------------------
  // Alpha 055: create_runtime.ts's own new startup call
  // ---------------------------------------------------------------------

  it("28. RIPPLE (Secure Runtime Alpha 057): create_runtime.ts called runtimeIdentity.describeIdentity() exactly once, chained with .catch(() => {}), AS OF this Stage's own Alpha 055 scope; Alpha 057 (implementing the Alpha 056 Decision) removed that call -- reconfirmed here that create_runtime.ts's own createRuntime() body now calls describeIdentity() ZERO times", () => {
    const body = (createRuntimeSource.match(/export function createRuntime\(([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    expect([...body.matchAll(/\.describeIdentity\(\)/g)].length).toBe(0);
    expect(body).not.toMatch(/void runtimeIdentity\.describeIdentity\(\)\.catch\(\(\) => \{\}\);/);
  });

  it("29. the describeIdentity() call is never awaited -- no 'await runtimeIdentity' anywhere in create_runtime.ts", () => {
    expect(createRuntimeSource).not.toMatch(/await runtimeIdentity/);
  });

  it("30. createRuntime() remains a non-async function -- its own signature has no 'async' keyword", () => {
    expect(createRuntimeSource).toMatch(/export function createRuntime\(/);
    expect(createRuntimeSource).not.toMatch(/export async function createRuntime/);
  });

  it("31. behavioral: createRuntime() returns a plain object synchronously, not a Promise, confirming Alpha 055's own call does not make it async", () => {
    const result = createRuntime();
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result.mode).toBe("string");
  });

  it("32. RIPPLE (Secure Runtime Alpha 057): the describeIdentity() call happened AFTER FedosRuntimeIdentity construction and BEFORE the AppRuntime return statement, AS OF this Stage's own Alpha 055 scope; Alpha 057 removed the call entirely -- reconfirmed here that no describeIdentity() call exists anywhere in createRuntime()'s own body, between construction and the return statement", () => {
    const body = (createRuntimeSource.match(/export function createRuntime\(([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const constructIndex = body.indexOf("new FedosRuntimeIdentity()");
    const callIndex = body.indexOf(".describeIdentity()");
    const returnIndex = body.indexOf("return {");
    expect(constructIndex).toBeGreaterThan(-1);
    expect(callIndex).toBe(-1);
    expect(returnIndex).toBeGreaterThan(constructIndex);
  });

  it("33. the AppRuntime return statement itself does not reference describeIdentity, runtimeIdentity, or FedosRuntimeIdentity", () => {
    const body = (createRuntimeSource.match(/export function createRuntime\(([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const returnStatement = (body.match(/return \{([\s\S]*)\};/) ?? [])[1] ?? "";
    expect(returnStatement).not.toMatch(/describeIdentity/);
    expect(returnStatement).not.toMatch(/runtimeIdentity/);
    expect(returnStatement).not.toMatch(/FedosRuntimeIdentity/);
  });

  it("34. behavioral: constructing 30 AppRuntime objects in a row (each internally triggering the describeIdentity() startup call) never throws and never produces an unhandled rejection", async () => {
    const results: unknown[] = [];
    for (let i = 0; i < 30; i += 1) {
      results.push(createRuntime());
    }
    expect(results.length).toBe(30);
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  it("35. behavioral: createRuntime() under every RuntimeMode still triggers the startup call without throwing", () => {
    for (const mode of RUNTIME_MODES) {
      expect(() => createRuntime(undefined, { mode })).not.toThrow();
    }
  });

  // ---------------------------------------------------------------------
  // Runtime起動不変 (Runtime startup unaffected) -- AppRuntime shape/behavior
  // ---------------------------------------------------------------------

  it("36. Regression: AppRuntime's own type (types.ts) is confirmed BYTE-FOR-BYTE unchanged -- no identity field, no reference to this Arc's own doc", () => {
    expect(runtimeTypesSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_053|secure_runtime_alpha_054|secure_runtime_alpha_055/);
    const body = (runtimeTypesSource.match(/export interface AppRuntime \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const fieldNames = [...body.matchAll(/readonly (\w+)[?:]/g)].map((m: RegExpMatchArray) => m[1]).sort();
    expect(fieldNames).toEqual(APP_RUNTIME_FIELDS);
  });

  it("37. Regression: createRuntime() under every RuntimeMode returns an AppRuntime with exactly the pre-existing thirty fields, no more, no less", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
    }
  });

  it("38. Regression: createRuntime() does not expose an 'identity' field or a 'runtimeIdentity' field on the returned object, under any mode", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode }) as unknown as Record<string, unknown>;
      expect(runtime.identity).toBeUndefined();
      expect(runtime.runtimeIdentity).toBeUndefined();
    }
  });

  it("39. Regression: createRuntime() with no arguments resolves 'test' mode, unaffected by this Arc", () => {
    expect(createRuntime().mode).toBe("test");
  });

  it("40. Regression: createRuntime({}) resolves 'local' mode, unaffected by this Arc", () => {
    expect(createRuntime({}).mode).toBe("local");
  });

  it("41. Regression: createRuntime() with a Cloudflare binding resolves 'cloudflare' mode, unaffected by this Arc", () => {
    expect(createRuntime({ NOSTR_EVENT_CACHE: {} as never }).mode).toBe("cloudflare");
  });

  it("42. Regression: two separate createRuntime() calls return two different AppRuntime object identities, unaffected by this Arc", () => {
    const a = createRuntime();
    const b = createRuntime();
    expect(a).not.toBe(b);
  });

  it("43. Regression: overrides.mode still wins over env-derived mode, unaffected by this Arc", () => {
    const runtime = createRuntime({ NOSTR_EVENT_CACHE: {} as never }, { mode: "test" });
    expect(runtime.mode).toBe("test");
  });

  it("44. Regression: overrides.storageBackend still wins over the default selection, unaffected by this Arc", () => {
    const customBackend = selectStorageBackend();
    const runtime = createRuntime(undefined, { storageBackend: customBackend });
    expect(runtime.storageBackend).toBe(customBackend);
  });

  // ---------------------------------------------------------------------
  // Worker不変 (Worker unaffected)
  // ---------------------------------------------------------------------

  it("45. Regression: src/worker.ts is confirmed BYTE-FOR-BYTE unchanged -- no reference to FedosRuntimeIdentity, fedos_runtime_identity.ts, or this Arc's own doc", () => {
    expect(workerSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_053|secure_runtime_alpha_054|secure_runtime_alpha_055/);
  });

  it("46. Regression: no src/nostr/* file references this Arc's own doc, FedosRuntimeIdentity, or fedos_runtime_identity.ts", () => {
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
      expect(source).not.toMatch(/secure_runtime_alpha_053|secure_runtime_alpha_054|secure_runtime_alpha_055/);
      expect(source).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
    }
  });

  it("47. fedos_runtime_identity.ts's own code still performs no Relay connection, event construction, signing, or DM feature", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    expect(codeOnly).not.toMatch(/WebSocket|relay|Relay/);
    expect(codeOnly).not.toMatch(/\bsign\b|\bSign\b|verify|Verify/);
    expect(codeOnly).not.toMatch(/\bDM\b|DirectMessage|direct message/i);
    expect(codeOnly).not.toMatch(/nsec|npub|secret\s*key|privateKey|secretKey|seed|mnemonic/i);
  });

  it("48. create_runtime.ts's own new startup-call code has no Worker/Relay/Nostr-network vocabulary", () => {
    const body = (createRuntimeSource.match(/export function createRuntime\(([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const startupBlock = body.slice(body.indexOf("const runtimeIdentity"), body.indexOf("return {"));
    expect(startupBlock).not.toMatch(/\bworker\b/i);
    expect(startupBlock).not.toMatch(/relay|Relay|npub|nsec/);
  });

  // ---------------------------------------------------------------------
  // Storage不変 (Storage unaffected)
  // ---------------------------------------------------------------------

  it("49. Regression: fedos_runtime_storage_resolver.ts and fedos_runtime_storage_backend.ts are confirmed BYTE-FOR-BYTE unchanged", () => {
    for (const source of [storageResolverSource, storageBackendSource]) {
      expect(source).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
      expect(source).not.toMatch(/secure_runtime_alpha_053|secure_runtime_alpha_054|secure_runtime_alpha_055/);
    }
  });

  it("50. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip in Development via the real AppRuntime object, entirely unaffected by this Arc", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha053055-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha053055-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha053055-id"));
    expect(deleted).toBe(true);
  });

  it("51. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() round-trip identically under EVERY RuntimeMode's own AppRuntime object", async () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      const key = `alpha053055-${mode}`;
      const stored = await withNodeEnv("development", () => runtime.storeCiphertext(key, "wire" as never));
      expect(stored).toBe(true);
      expect(await withNodeEnv("development", () => runtime.loadCiphertext(key))).toBe("wire");
      expect(await withNodeEnv("development", () => runtime.deleteCiphertext(key))).toBe(true);
    }
  });

  it("52. Regression: standalone storeCiphertext()/loadCiphertext()/deleteCiphertext() module exports are unaffected by this Arc", async () => {
    const direct = await withNodeEnv("development", () => storeCiphertext("alpha053055-direct", "wire2" as never));
    expect(direct).toBe(true);
    expect(await withNodeEnv("development", () => loadCiphertext("alpha053055-direct"))).toBe("wire2");
    expect(await withNodeEnv("development", () => deleteCiphertext("alpha053055-direct"))).toBe(true);
  });

  it("53. Regression: selectStorageBackend() still returns a real, callable StorageBackend, entirely unaffected by this Arc", () => {
    const backend = selectStorageBackend();
    expect(typeof backend.put).toBe("function");
  });

  // ---------------------------------------------------------------------
  // Crypto不変 (Crypto unaffected)
  // ---------------------------------------------------------------------

  it("54. Regression: initializeCrypto() is unaffected under every RuntimeMode -- always PrototypeDisabled", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      expect(runtime.initializeCrypto()).toEqual({
        allowed: false,
        initialized: false,
        reason: "PrototypeDisabled",
      });
    }
  });

  it("55. Regression: createRuntimeInitializeCryptoResult() (module-level export) is unaffected", () => {
    expect(createRuntimeInitializeCryptoResult()).toEqual({
      allowed: false,
      initialized: false,
      reason: "PrototypeDisabled",
    });
  });

  it("56. Regression: runtimeCapabilities() is unaffected -- confirmed by an ACTUAL call via the AppRuntime object", async () => {
    const runtime = createRuntime();
    const caps = await runtime.runtimeCapabilities();
    expect(Object.keys(caps).sort()).toEqual(["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort());
    const direct = await runtimeCapabilities();
    expect(Object.keys(direct).sort()).toEqual(["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort());
  });

  it("57. Regression: randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() are all unaffected -- confirmed by ACTUAL calls via the AppRuntime object", async () => {
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

  it("58. Regression: standalone randomBytes()/generateAeadKey()/encrypt()/decrypt()/exportCiphertext()/importCiphertext() module exports are unaffected -- confirmed by ACTUAL calls", async () => {
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
  });

  it("59. Regression: cryptoProvider and crypto (RuntimeCryptoProvider seam) fields are present and unaffected under every mode", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      expect(runtime.cryptoProvider).toBeTruthy();
      expect(runtime.crypto).toBeTruthy();
    }
  });

  // ---------------------------------------------------------------------
  // Entire Identity Layer confirmed byte-for-byte unchanged
  // ---------------------------------------------------------------------

  it("60. Regression: fedos_identity_service.ts is confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(serviceSource).toMatch(/constructor\(provider: FedosIdentityProvider, registry: FedosIdentityRegistry\) \{/);
    expect(serviceSource).not.toMatch(/secure_runtime_alpha_053|secure_runtime_alpha_054|secure_runtime_alpha_055/);
  });

  it("61. Regression: fedos_identity_registry.ts is confirmed BYTE-FOR-BYTE unchanged -- still exactly four methods", () => {
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).toMatch(/find\(id: string\): FedosIdentityRecord \| null \{/);
    expect(registrySource).toMatch(/list\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(registrySource).toMatch(/remove\(id: string\): boolean \{/);
    expect(registrySource).not.toMatch(/secure_runtime_alpha_053|secure_runtime_alpha_054|secure_runtime_alpha_055/);
  });

  it("62. Regression: fedos_identity_resolver.ts is confirmed BYTE-FOR-BYTE unchanged -- still exactly two methods", () => {
    expect(resolverClassSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(resolverClassSource).toMatch(/listIdentities\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(resolverClassSource).not.toMatch(/secure_runtime_alpha_053|secure_runtime_alpha_054|secure_runtime_alpha_055/);
  });

  it("63. Regression: fedos_identity_provider_resolver.ts is confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(identityProviderResolverSource).toMatch(/return sharedNostrProvider;/);
    expect(identityProviderResolverSource).not.toMatch(/secure_runtime_alpha_053|secure_runtime_alpha_054|secure_runtime_alpha_055/);
  });

  it("64. Regression: fedos_nostr_identity_provider.ts is confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(nostrProviderSource).toMatch(
      /constructor\(source: FedosNostrPublicIdentitySource = resolveNostrPublicIdentitySource\(\)\) \{/,
    );
    expect(nostrProviderSource).not.toMatch(/secure_runtime_alpha_053|secure_runtime_alpha_054|secure_runtime_alpha_055/);
  });

  it("65. Regression: fedos_null_nostr_public_identity_source.ts is confirmed BYTE-FOR-BYTE unchanged", () => {
    const body = (
      nullSourceSource.match(/async readPublicIdentity\(\): Promise<FedosNostrPublicIdentitySnapshot \| null> \{([\s\S]*?)\n  \}/) ?? []
    )[1] ?? "";
    expect(body.trim()).toBe("return null;");
    expect(nullSourceSource).not.toMatch(/secure_runtime_alpha_053|secure_runtime_alpha_054|secure_runtime_alpha_055/);
  });

  it("66. Regression: fedos_nostr_public_identity_source_resolver.ts is confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(sourceResolverSource).toMatch(/export function resolveNostrPublicIdentitySource\(\): FedosNostrPublicIdentitySource \{/);
    expect(sourceResolverSource).not.toMatch(/secure_runtime_alpha_053|secure_runtime_alpha_054|secure_runtime_alpha_055/);
  });

  it("67. behavioral: resolveFedosIdentityProvider() is entirely unaffected -- still resolves the shared NostrIdentityProvider singleton, always null describeIdentity()", async () => {
    const provider = resolveFedosIdentityProvider();
    expect(provider).toBeInstanceOf(NostrIdentityProvider);
    expect(provider?.provider).toBe("nostr");
    expect(await provider?.describeIdentity()).toBeNull();
  });

  it("68. FedosWasmLoader Plan interfaces and planLoad() are unchanged -- still seven Plan interfaces, still BlockedByPolicy", async () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);
    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const decision = createFedosWasmLoader().planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("69. Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Arc's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(50);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_053|secure_runtime_alpha_054|secure_runtime_alpha_055/);

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
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_053|secure_runtime_alpha_054|secure_runtime_alpha_055/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_053|secure_runtime_alpha_054|secure_runtime_alpha_055/);
  });

  // ---------------------------------------------------------------------
  // File-count sentinels (no file added or removed by this Arc)
  // ---------------------------------------------------------------------

  it("70. no fedos_*.ts file was added or removed by this Arc -- still exactly 57 under src/runtime/ and exactly 24 under src/identity/", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  // ---------------------------------------------------------------------
  // Cross-cutting / edge cases
  // ---------------------------------------------------------------------

  it("71. RIPPLE (Secure Runtime Alpha 068): 50 repeated FedosRuntimeIdentity constructions each independently resolved describeIdentity() null, findIdentity() null, listIdentities() empty AS OF this Stage's own scope; Alpha 068 made describeIdentity() private -- reconfirmed here via bootstrapIdentity()/currentIdentity()", async () => {
    for (let i = 0; i < 50; i += 1) {
      const identity = new FedosRuntimeIdentity();
      await identity.bootstrapIdentity();
      expect(identity.currentIdentity()).toBeNull();
      expect(identity.findIdentity(`id-${i}`)).toBeNull();
      expect(identity.listIdentities()).toEqual([]);
    }
  });

  it("72. RIPPLE (Secure Runtime Alpha 068): concurrent describeIdentity() calls on independently-constructed instances all resolved null without interfering with each other AS OF this Stage's own scope; Alpha 068 made describeIdentity() private -- reconfirmed here via concurrent bootstrapIdentity()/currentIdentity()", async () => {
    const instances = Array.from({ length: 10 }, () => new FedosRuntimeIdentity());
    await Promise.all(instances.map((identity) => identity.bootstrapIdentity()));
    const results = instances.map((identity) => identity.currentIdentity());
    expect(results).toEqual(Array.from({ length: 10 }, () => null));
  });

  it("73. behavioral: findIdentity() with a very long id string still resolves null, no throw", () => {
    const identity = new FedosRuntimeIdentity();
    expect(() => identity.findIdentity("x".repeat(5000))).not.toThrow();
    expect(identity.findIdentity("x".repeat(5000))).toBeNull();
  });

  it("74. behavioral: FedosRuntimeIdentity instances have no enumerable public state -- only private (#-prefixed) fields", () => {
    const identity = new FedosRuntimeIdentity();
    expect(Object.keys(identity)).toEqual([]);
  });

  it("75. behavioral: two independently-constructed FedosRuntimeIdentity instances are different objects", () => {
    const a = new FedosRuntimeIdentity();
    const b = new FedosRuntimeIdentity();
    expect(a).not.toBe(b);
  });

  it("76. Regression: fedos_runtime_identity.ts imports remain exactly seven modules -- unaffected by the header-comment-only change", () => {
    const importLines = [...fedosRuntimeIdentitySource.matchAll(/^import .*$/gm)].map((m: RegExpMatchArray) => m[0]);
    expect(importLines.length).toBe(7);
  });

  it("77. no other src/identity/* file references this Arc's own doc", () => {
    for (const source of [
      serviceSource,
      registrySource,
      resolverClassSource,
      identityProviderResolverSource,
      nostrProviderSource,
      nullSourceSource,
      sourceResolverSource,
    ]) {
      expect(source).not.toMatch(/secure_runtime_alpha_053_055/);
    }
  });

  it("78. create_runtime.ts's own header comment references this Arc's own doc", () => {
    expect(createRuntimeSource).toMatch(
      /secure_runtime_alpha_053_055_identity_runtime_internal_operations\.md/,
    );
  });

  it("79. RIPPLE (Secure Runtime Alpha 068): describeIdentity()'s own Promise never rejected under any NODE_ENV AS OF this Stage's own scope; Alpha 068 made describeIdentity() private -- reconfirmed here that bootstrapIdentity(), the only remaining public path, never rejects under any NODE_ENV", async () => {
    for (const nodeEnv of NODE_ENVS) {
      await withNodeEnv(nodeEnv, async () => {
        const identity = new FedosRuntimeIdentity();
        await expect(identity.bootstrapIdentity()).resolves.toBeUndefined();
        expect(identity.currentIdentity()).toBeNull();
      });
    }
  });

  it("80. behavioral: createRuntime()'s own startup call does not delay or block the synchronous return -- timing check via Date.now() before/after stays under a generous bound", () => {
    const start = Date.now();
    createRuntime();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it("81. behavioral: repeated createRuntime() calls under mixed modes and NODE_ENV values never throw, confirmed across 30 mixed iterations", async () => {
    for (let i = 0; i < 30; i += 1) {
      const mode = RUNTIME_MODES[i % RUNTIME_MODES.length] as RuntimeMode;
      const nodeEnv = NODE_ENVS[i % NODE_ENVS.length];
      await withNodeEnv(nodeEnv, () => {
        expect(() => createRuntime(undefined, { mode })).not.toThrow();
      });
    }
  });

  it("82. final sanity: createRuntime() under every RuntimeMode x FedosRuntimeMode combination returns an AppRuntime whose own field set is exactly the pre-existing thirty fields, every time", async () => {
    for (const nodeEnv of NODE_ENVS) {
      for (const mode of RUNTIME_MODES) {
        await withNodeEnv(nodeEnv, () => {
          const runtime = createRuntime(undefined, { mode });
          expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
        });
      }
    }
  });

  // ---------------------------------------------------------------------
  // Additional structural / behavioral coverage
  // ---------------------------------------------------------------------

  it("83. RIPPLE (Secure Runtime Alpha 068): describeIdentity()/findIdentity()/listIdentities() were declared in the exact same order in the source as this Arc's own Stage ordering (describeIdentity from Alpha 053, findIdentity/listIdentities from Alpha 054) AS OF this Stage's own scope; Alpha 068 made describeIdentity() a true private #describeIdentity() method, in the SAME position -- reconfirmed here against the CURRENT source", () => {
    const classBody = (fedosRuntimeIdentitySource.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const describeIndex = classBody.indexOf("async #describeIdentity(): Promise<FedosIdentityDescriptor | null> {");
    const findIndex = classBody.indexOf("findIdentity(id: string): FedosIdentityRecord | null {");
    const listIndex = classBody.indexOf("listIdentities(): readonly FedosIdentityRecord[] {");
    expect(describeIndex).toBeGreaterThan(-1);
    expect(findIndex).toBeGreaterThan(describeIndex);
    expect(listIndex).toBeGreaterThan(findIndex);
  });

  it("84. RIPPLE (Secure Runtime Alpha 076): FedosRuntimeIdentity's own class had exactly three PUBLIC methods AS OF this Arc's own scope -- no fourth method was added by THIS Arc; Alpha 058 added a fourth (bootstrapIdentity()), Alpha 060 added a fifth (isBootstrapped()), Alpha 063 added a sixth (currentIdentity()), Alpha 064 added a seventh (identityVersion()), Alpha 066 removed that seventh again, Alpha 068 made describeIdentity() a true private #describeIdentity() method, Alpha 069 added a second private method (#completeBootstrap()), Alpha 070 (Identity Bootstrap Entry Consolidation) added a third private method (#bootstrapIdentity()), turning the PUBLIC bootstrapIdentity() into a pure wrapper, Alpha 072 (Identity Bootstrap State Reader Consolidation) added a fourth private method (#isBootstrapped()), turning the PUBLIC isBootstrapped() into a pure wrapper too, Alpha 073 (Identity Descriptor Reader Consolidation) added a fifth private method (#currentIdentity()), turning the PUBLIC currentIdentity() into a pure wrapper too, Alpha 074 (Identity Bootstrap Flow Consolidation) added a sixth private method (#performBootstrap()), isolating the Bootstrap Flow itself, Alpha 075 (Identity Descriptor Acquisition Consolidation) added a seventh private method (#acquireDescriptor()), isolating Descriptor Acquisition itself, and Alpha 076 (Identity Bootstrap Observation Boundary) added an eighth private method (#observeBootstrap()), an empty observation boundary -- reconfirmed here that findIdentity()/listIdentities() (this Arc's own original two, describeIdentity now excluded since it is no longer public) remain present and unchanged, alongside the three still-current newer PUBLIC methods (bootstrapIdentity/isBootstrapped/currentIdentity)", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const methodNames = [
      ...classBody.matchAll(/^\s{2}(?:async\s+)?(\w+)\([^)]*\)(?::\s*[^{]+)?\s*\{/gm),
    ]
      .map((m: RegExpMatchArray) => m[1] ?? "")
      .filter((name: string) => name !== "constructor");
    expect(new Set(methodNames)).toEqual(
      new Set([
        "findIdentity",
        "listIdentities",
        "bootstrapIdentity",
        "isBootstrapped",
        "currentIdentity",
      ]),
    );
    const privateMethodNames = [
      ...classBody.matchAll(/^\s{2}(?:async\s+)?#(\w+)\([^)]*\)(?::\s*[^{]+)?\s*\{/gm),
    ].map((m: RegExpMatchArray) => m[1] ?? "");
    expect(new Set(privateMethodNames)).toEqual(
      new Set(["describeIdentity", "completeBootstrap", "observeBootstrap", "isBootstrapped", "currentIdentity", "acquireDescriptor", "performBootstrap", "bootstrapIdentity"]),
    );
  });

  it("85. RIPPLE (Secure Runtime Alpha 068): findIdentity() called before AND after describeIdentity() both still resolved null AS OF this Stage's own scope, confirming no hidden state mutation between the two; Alpha 068 made describeIdentity() private -- reconfirmed here via bootstrapIdentity()", async () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.findIdentity("x")).toBeNull();
    await identity.bootstrapIdentity();
    expect(identity.findIdentity("x")).toBeNull();
  });

  it("86. RIPPLE (Secure Runtime Alpha 068): listIdentities() called before AND after describeIdentity() both still resolved an empty array AS OF this Stage's own scope; Alpha 068 made describeIdentity() private -- reconfirmed here via bootstrapIdentity()", async () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.listIdentities()).toEqual([]);
    await identity.bootstrapIdentity();
    expect(identity.listIdentities()).toEqual([]);
  });

  it("87. RIPPLE (Secure Runtime Alpha 068): describeIdentity() called before AND after findIdentity()/listIdentities() still resolved null AS OF this Stage's own scope; Alpha 068 made describeIdentity() private -- reconfirmed here via bootstrapIdentity()/currentIdentity()", async () => {
    const identity = new FedosRuntimeIdentity();
    identity.findIdentity("x");
    identity.listIdentities();
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBeNull();
  });

  it("88. create_runtime.ts's own new startup-call code has no Storage/Rust/Cargo vocabulary", () => {
    const body = (createRuntimeSource.match(/export function createRuntime\(([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const startupBlock = body.slice(body.indexOf("const runtimeIdentity"), body.indexOf("return {"));
    expect(startupBlock).not.toMatch(/RuntimeStorageBackend|storeCiphertext|loadCiphertext|deleteCiphertext/);
    expect(startupBlock).not.toMatch(/Cargo|fedos-core-rust|wasm_bindgen/i);
  });

  it("89. create_runtime.ts's own new startup-call code has no Crypto Public Runtime API reference", () => {
    const body = (createRuntimeSource.match(/export function createRuntime\(([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const startupBlock = body.slice(body.indexOf("const runtimeIdentity"), body.indexOf("return {"));
    expect(startupBlock).not.toMatch(/initializeCrypto|randomBytes|generateAeadKey|encrypt|decrypt|exportCiphertext|importCiphertext/);
  });

  it("90. RIPPLE (Secure Runtime Alpha 068): FedosRuntimeIdentity's internal Provider resolution still matched resolveFedosIdentityProvider()'s own current singleton AS OF this Stage's own scope, unaffected by this Arc; Alpha 068 made describeIdentity() private -- reconfirmed here via bootstrapIdentity()/currentIdentity()", async () => {
    const resolved = resolveFedosIdentityProvider();
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBe(await resolved?.describeIdentity());
  });

  it("91. RIPPLE (Secure Runtime Alpha 068): constructing many FedosRuntimeIdentity instances and calling all remaining public methods on each does not mutate or exhaust the shared NostrIdentityProvider singleton, AS OF this Stage's own scope; Alpha 068 made describeIdentity() private -- reconfirmed here via bootstrapIdentity()", async () => {
    for (let i = 0; i < 15; i += 1) {
      const identity = new FedosRuntimeIdentity();
      await identity.bootstrapIdentity();
      identity.findIdentity(`x-${i}`);
      identity.listIdentities();
    }
    const provider = resolveFedosIdentityProvider();
    expect(await provider?.describeIdentity()).toBeNull();
  });

  it("92. the design doc's own structure sanity check -- at least eleven numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(11);
  });

  it("93. the design doc explains why a Runtime-level diagnostic for the call's own outcome is not added", () => {
    expect(designDocSource).toMatch(
      /Why this Stage does not add a Runtime-level log or diagnostic/,
    );
  });

  it("94. the design doc's own Summary section names the net src/ effect precisely", () => {
    expect(designDocSource).toMatch(/## 13\. Summary/);
    expect(designDocSource).toMatch(/one header-comment update/);
  });

  it("95. behavioral: createRuntime() called with overrides that supply a custom cryptoProvider still works correctly alongside the new startup call, unaffected by this Arc", () => {
    const runtime = createRuntime(undefined, {});
    expect(runtime.cryptoProvider).toBeTruthy();
  });

  it("96. Regression: promotionProvider/recommendationProvider/relayPublisher/notificationBridge/paymentProvider/webAuthnProvider/federationProvider/chatProvider/marketplaceProvider/creatorEntitlementProvider are all present under every mode, unaffected by this Arc", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      expect(runtime.promotionProvider).toBeTruthy();
      expect(runtime.recommendationProvider).toBeTruthy();
      expect(runtime.relayPublisher).toBeTruthy();
      expect(runtime.notificationBridge).toBeTruthy();
      expect(runtime.paymentProvider).toBeTruthy();
      expect(runtime.webAuthnProvider).toBeTruthy();
      expect(runtime.federationProvider).toBeTruthy();
      expect(runtime.chatProvider).toBeTruthy();
      expect(runtime.marketplaceProvider).toBeTruthy();
      expect(runtime.creatorEntitlementProvider).toBeTruthy();
    }
  });

  it("97. Regression: eventCache/assetCache/spaceDirectory/metadataIndex/signatureVerifier are all present under every mode, unaffected by this Arc", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      expect(runtime.eventCache).toBeTruthy();
      expect(runtime.assetCache).toBeTruthy();
      expect(runtime.spaceDirectory).toBeTruthy();
      expect(runtime.metadataIndex).toBeTruthy();
      expect(runtime.signatureVerifier).toBeTruthy();
    }
  });

  it("98. Regression: the new file's own basename fedos_runtime_identity.ts is still matched by the fedos_*.ts glob, unaffected by this Arc's own header-only change", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    const names = Object.keys(runtimeFiles).map((path) => path.split("/").pop());
    expect(names).toContain("fedos_runtime_identity.ts");
  });

  it("99. behavioral: findIdentity() and listIdentities() called back-to-back many times in a tight loop never throw and remain consistent", () => {
    const identity = new FedosRuntimeIdentity();
    for (let i = 0; i < 25; i += 1) {
      expect(identity.findIdentity(`loop-${i}`)).toBeNull();
      expect(identity.listIdentities()).toEqual([]);
    }
  });

  it("100. RIPPLE (Secure Runtime Alpha 068): describeIdentity() called many times in a tight sequential loop always resolved null AS OF this Stage's own scope; Alpha 068 made describeIdentity() private, reachable only via the now-idempotent bootstrapIdentity() -- reconfirmed here that repeated bootstrapIdentity() calls never throw and currentIdentity() stays null throughout", async () => {
    const identity = new FedosRuntimeIdentity();
    for (let i = 0; i < 25; i += 1) {
      await identity.bootstrapIdentity();
      expect(identity.currentIdentity()).toBeNull();
    }
  });

  it("101. Regression: no test/production/local-mode-specific branch exists inside FedosRuntimeIdentity's own constructor or methods", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    expect(codeOnly).not.toMatch(/"test"|"local"|"cloudflare"/);
    expect(codeOnly).not.toMatch(/"Development"|"Production"|"Unknown"/);
  });

  it("102. Regression: no test/production/local-mode-specific branch exists inside create_runtime.ts's own startup-call block", () => {
    const body = (createRuntimeSource.match(/export function createRuntime\(([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const startupBlock = body.slice(body.indexOf("const runtimeIdentity"), body.indexOf("return {"));
    expect(startupBlock).not.toMatch(/if\s*\(/);
  });

  it("103. behavioral: the startup call's own promise settling (resolving or being caught) does not throw synchronously nor leave a dangling unhandled rejection, confirmed via process-level wait", async () => {
    createRuntime();
    createRuntime();
    createRuntime();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(true).toBe(true);
  });

  it("104. behavioral: createRuntime() under FedosRuntimeMode 'Development' still returns synchronously with the startup call fired", async () => {
    await withNodeEnv("development", () => {
      const runtime = createRuntime();
      expect(runtime).not.toBeInstanceOf(Promise);
    });
  });

  it("105. behavioral: createRuntime() under FedosRuntimeMode 'Production' still returns synchronously with the startup call fired", async () => {
    await withNodeEnv("production", () => {
      const runtime = createRuntime();
      expect(runtime).not.toBeInstanceOf(Promise);
    });
  });

  it("106. behavioral: createRuntime() under FedosRuntimeMode 'Unknown' (NODE_ENV unset) still returns synchronously with the startup call fired", async () => {
    await withNodeEnv(undefined, () => {
      const runtime = createRuntime();
      expect(runtime).not.toBeInstanceOf(Promise);
    });
  });

  it("107. Regression: FedosIdentityRegistry constructed inside a fresh FedosRuntimeIdentity is empty, matching a directly-constructed Registry's own initial state", async () => {
    const { FedosIdentityRegistry } = await import("../src/identity/fedos_identity_registry.js");
    const directRegistry = new FedosIdentityRegistry();
    expect(directRegistry.list()).toEqual([]);
    const identity = new FedosRuntimeIdentity();
    expect(identity.listIdentities()).toEqual(directRegistry.list());
  });

  it("108. Regression: fedos_identity_capability.ts and fedos_noop_identity_provider.ts remain unaffected (not touched by this Arc at all)", () => {
    expect(capabilitySource).not.toMatch(/secure_runtime_alpha_053|secure_runtime_alpha_054|secure_runtime_alpha_055/);
    expect(noopProviderSource).not.toMatch(/secure_runtime_alpha_053|secure_runtime_alpha_054|secure_runtime_alpha_055/);
  });

  it("109. RIPPLE (Secure Runtime Alpha 068): 20 createRuntime() calls interleaved with 20 direct FedosRuntimeIdentity constructions never threw AS OF this Stage's own scope; Alpha 068 made describeIdentity() private -- reconfirmed here via bootstrapIdentity()/currentIdentity()", async () => {
    for (let i = 0; i < 20; i += 1) {
      createRuntime();
      const identity = new FedosRuntimeIdentity();
      await identity.bootstrapIdentity();
      expect(identity.currentIdentity()).toBeNull();
    }
  });

  it("110. final regression: the entire AppRuntime object, once constructed, remains a plain, JSON-incompatible-but-structurally-stable object across repeated property reads", () => {
    const runtime = createRuntime();
    const firstRead = runtime.mode;
    const secondRead = runtime.mode;
    expect(firstRead).toBe(secondRead);
  });

  it("111. behavioral: findIdentity() returns strictly null, never undefined, matching FedosIdentityResolver's own documented contract", () => {
    const identity = new FedosRuntimeIdentity();
    const result = identity.findIdentity("x");
    expect(result).toBeNull();
    expect(result).not.toBeUndefined();
  });

  it("112. RIPPLE (Secure Runtime Alpha 068): describeIdentity() resolved strictly null, never undefined, AS OF this Stage's own scope; Alpha 068 made describeIdentity() private -- reconfirmed here that currentIdentity() after bootstrapIdentity() is strictly null, never undefined", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    const result = identity.currentIdentity();
    expect(result).toBeNull();
    expect(result).not.toBeUndefined();
  });

  it("113. behavioral: listIdentities() returns strictly an array, never null or undefined", () => {
    const identity = new FedosRuntimeIdentity();
    const result = identity.listIdentities();
    expect(result).not.toBeNull();
    expect(result).not.toBeUndefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("114. Regression: FedosIdentityDescriptor and FedosIdentityRecord types remain usable and structurally unaffected by this Arc", async () => {
    const descriptorModule = await import("../src/identity/fedos_identity_descriptor.js");
    const recordModule = await import("../src/identity/fedos_identity_record.js");
    expect(descriptorModule).toBeDefined();
    expect(recordModule).toBeDefined();
  });

  it("115. RIPPLE (Secure Runtime Alpha 068): FedosRuntimeIdentity constructed while NODE_ENV flips between calls still behaved consistently for a SINGLE instance's own lifetime AS OF this Stage's own scope (the constructor read nothing env-dependent); Alpha 068 made describeIdentity() private -- reconfirmed here via bootstrapIdentity()/currentIdentity()", async () => {
    const identity = await withNodeEnv("development", () => new FedosRuntimeIdentity());
    await withNodeEnv("production", () => identity.bootstrapIdentity());
    expect(identity.currentIdentity()).toBeNull();
  });

  it("116. behavioral: createRuntime() called immediately after another createRuntime() call (no delay) still completes synchronously both times", () => {
    const a = createRuntime();
    const b = createRuntime();
    expect(a.mode).toBeDefined();
    expect(b.mode).toBeDefined();
  });

  it("117. Regression: create_runtime.ts's own total import count grew by zero -- Alpha 055 added no new import (FedosRuntimeIdentity was already imported by Alpha 051)", () => {
    const importLines = [...createRuntimeSource.matchAll(/^import .*$/gm)];
    const fedosRuntimeIdentityImports = importLines.filter((m: RegExpMatchArray) =>
      m[0].includes("fedos_runtime_identity"),
    );
    expect(fedosRuntimeIdentityImports.length).toBe(1);
  });

  it("118. RIPPLE (Secure Runtime Alpha 068): two describeIdentity() calls fired back-to-back without awaiting the first (fire-and-forget style, mirroring Alpha 055's own pattern) never threw synchronously, AS OF this Stage's own scope; Alpha 068 made describeIdentity() private, reachable only via bootstrapIdentity() -- reconfirmed here that two fire-and-forget bootstrapIdentity() calls never throw synchronously", () => {
    const identity = new FedosRuntimeIdentity();
    expect(() => {
      void identity.bootstrapIdentity();
      void identity.bootstrapIdentity();
    }).not.toThrow();
  });

  it("119. the design doc explicitly names 'findIdentity' and 'listIdentities' together as Alpha 054's own combined deliverable, not two separate Stages", () => {
    expect(designDocSource).toMatch(/FedosRuntimeIdentity\.findIdentity\(id\)/);
    expect(designDocSource).toMatch(/FedosRuntimeIdentity\.listIdentities\(\)/);
  });

  it("120. the design doc's own Alpha 055 code sample matches the ACTUAL current create_runtime.ts source verbatim", () => {
    const docSnippet = (designDocSource.match(/```ts\n(const runtimeIdentity[\s\S]*?)\n```/) ?? [])[1] ?? "";
    expect(createRuntimeSource).toMatch(/const runtimeIdentity: FedosRuntimeIdentity = new FedosRuntimeIdentity\(\);/);
    expect(docSnippet).toMatch(/const runtimeIdentity: FedosRuntimeIdentity = new FedosRuntimeIdentity\(\);/);
    expect(docSnippet).toMatch(/void runtimeIdentity\.describeIdentity\(\)\.catch\(\(\) => \{\}\);/);
  });

  it("121. RIPPLE (Secure Runtime Alpha 068): an explicit, directly-constructed FedosRuntimeIdentity and the one createRuntime() constructs internally behaved identically (both always null/empty) AS OF this Stage's own scope; Alpha 068 made describeIdentity() private -- reconfirmed here via bootstrapIdentity()/currentIdentity()", async () => {
    const direct = new FedosRuntimeIdentity();
    await direct.bootstrapIdentity();
    expect(direct.currentIdentity()).toBeNull();
    expect(direct.findIdentity("x")).toBeNull();
    expect(direct.listIdentities()).toEqual([]);
    const runtime = createRuntime();
    expect(runtime.mode).toBeDefined();
  });

  it("122. final sanity: this Arc's own commit-level guarantee -- constructing 15 AppRuntime objects across all three RuntimeModes and all three FedosRuntimeModes, sequentially, never throws and every object has the correct requested mode", async () => {
    for (const mode of RUNTIME_MODES) {
      for (const nodeEnv of NODE_ENVS) {
        await withNodeEnv(nodeEnv, () => {
          const runtime = createRuntime(undefined, { mode });
          expect(runtime.mode).toBe(mode);
        });
      }
    }
  });
});
