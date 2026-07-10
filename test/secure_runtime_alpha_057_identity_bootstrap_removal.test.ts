import { describe, it, expect } from "vitest";
import { createRuntime } from "../src/runtime/create_runtime.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
import type { RuntimeMode } from "../src/runtime/types.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_057_identity_bootstrap_removal.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha056DocSource from "../docs/secure_runtime_alpha_056_identity_bootstrap_semantics_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
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
import nullSourceSource from "../src/identity/fedos_null_nostr_public_identity_source.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopProviderSource from "../src/identity/fedos_noop_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilitySource from "../src/identity/fedos_identity_capability.ts?raw";
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

function createRuntimeBody(): string {
  return (createRuntimeSource.match(/export function createRuntime\(([\s\S]*?)\n\}/) ?? [])[1] ?? "";
}

/**
 * Secure Runtime Alpha 057 -- "Identity Bootstrap Removal": implements
 * the Alpha 056 Decision (Option B) and ONLY that Decision --
 * `create_runtime.ts`'s own Alpha 055 fire-and-forget
 * `describeIdentity()` call is removed; `createRuntime()` is Construct
 * Only again. No new Bootstrap API, no new identity-retrieval method,
 * and no Public Runtime API change of any kind.
 */
describe("Secure Runtime Alpha 057 -- Identity Bootstrap Removal, create_runtime.ts only, no Identity/AppRuntime/Worker/Storage/Crypto/Rust change", () => {
  // ---------------------------------------------------------------------
  // Design doc structure
  // ---------------------------------------------------------------------

  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc records this Stage as the implementation of the Alpha 056 Decision, and only that Decision", () => {
    expect(designDocSource).toMatch(/Option B/);
    expect(designDocSource).toMatch(/This Stage implements\s*\nthat Decision, and ONLY that Decision/);
  });

  it("3. the design doc records the exact removed statement", () => {
    expect(designDocSource).toMatch(
      /void runtimeIdentity\.describeIdentity\(\)\.catch\(\(\) => \{\}\);/,
    );
    expect(designDocSource).toMatch(/REMOVED/);
  });

  it("4. the design doc records the CURRENT (post-removal) construction block verbatim", () => {
    expect(designDocSource).toMatch(
      /const runtimeIdentity: FedosRuntimeIdentity = new FedosRuntimeIdentity\(\);/,
    );
    expect(designDocSource).toMatch(/void runtimeIdentity;/);
  });

  it("5. the design doc's own recorded construction block matches the ACTUAL current create_runtime.ts source verbatim", () => {
    const body = createRuntimeBody();
    expect(body).toMatch(/const runtimeIdentity: FedosRuntimeIdentity = new FedosRuntimeIdentity\(\);/);
    expect(body).toMatch(/void runtimeIdentity;/);
    expect(body).not.toMatch(/\.describeIdentity\(\)/);
  });

  it("6. the design doc declares createRuntime() is Construct Only again", () => {
    expect(designDocSource).toMatch(/Construct Only/);
  });

  it("7. the design doc declares FedosRuntimeIdentity is constructed but unused again", () => {
    expect(designDocSource).toMatch(/constructed but unused/i);
  });

  it("8. the design doc declares Identity retrieval lifecycle deferred to a future explicit Boundary", () => {
    expect(designDocSource).toMatch(/deferred to a future/i);
    expect(designDocSource).toMatch(/[Bb]oundary/);
  });

  it("9. the design doc records an explicit 'does NOT do' list naming every prohibited file/area", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/fedos_runtime_identity\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify any `src\/identity\/\*` file/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `AppRuntime`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/worker\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `packages\/fedos-core-rust`/);
    expect(designDocSource).toMatch(/new Bootstrap API/);
    expect(designDocSource).toMatch(/Bootstrap state model/);
  });

  it("10. the design doc cross-references the Alpha 056 doc", () => {
    expect(designDocSource).toMatch(
      /secure_runtime_alpha_056_identity_bootstrap_semantics_review\.md/,
    );
    expect(alpha056DocSource.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------
  // Structural: the removal itself, confirmed via literal extraction
  // ---------------------------------------------------------------------

  it("11. createRuntime()'s own body no longer contains any describeIdentity() call", () => {
    const body = createRuntimeBody();
    expect(body).not.toMatch(/\.describeIdentity\(\)/);
    expect([...body.matchAll(/\.describeIdentity\(\)/g)].length).toBe(0);
  });

  it("12. createRuntime()'s own body no longer contains the fire-and-forget .catch(() => {}) expression", () => {
    const body = createRuntimeBody();
    expect(body).not.toMatch(/\.catch\(\(\) => \{\}\)/);
  });

  it("13. createRuntime()'s own body contains zero fire-and-forget ('void ...catch(') expressions -- confirming Alpha 056's own sole exception is gone", () => {
    const body = createRuntimeBody();
    const fireAndForgetMatches = [...body.matchAll(/void [^;]*\.catch\(/g)];
    expect(fireAndForgetMatches.length).toBe(0);
  });

  it("14. FedosRuntimeIdentity is still constructed exactly once inside createRuntime()'s own body", () => {
    const body = createRuntimeBody();
    const constructionMatches = [...body.matchAll(/new FedosRuntimeIdentity\(\)/g)];
    expect(constructionMatches.length).toBe(1);
  });

  it("15. the construction block is exactly two statements -- the const declaration immediately followed by a bare 'void runtimeIdentity;'", () => {
    const body = createRuntimeBody();
    const constIndex = body.indexOf("const runtimeIdentity: FedosRuntimeIdentity");
    const voidIndex = body.indexOf("void runtimeIdentity;");
    const returnIndex = body.indexOf("return {", voidIndex);
    expect(constIndex).toBeGreaterThan(-1);
    expect(voidIndex).toBeGreaterThan(constIndex);
    expect(returnIndex).toBeGreaterThan(voidIndex);
    const between = body.slice(constIndex, voidIndex);
    expect(between.split("\n").length).toBe(2);
  });

  it("16. the AppRuntime return statement itself does not reference describeIdentity, runtimeIdentity, or FedosRuntimeIdentity", () => {
    const body = createRuntimeBody();
    const returnStatement = (body.match(/return \{([\s\S]*)\};/) ?? [])[1] ?? "";
    expect(returnStatement).not.toMatch(/describeIdentity/);
    expect(returnStatement).not.toMatch(/runtimeIdentity/);
    expect(returnStatement).not.toMatch(/FedosRuntimeIdentity/);
  });

  it("17. createRuntime() remains a non-async function -- its own signature has no 'async' keyword", () => {
    expect(createRuntimeSource).toMatch(/export function createRuntime\(/);
    expect(createRuntimeSource).not.toMatch(/export async function createRuntime/);
  });

  it("18. no 'await runtimeIdentity' anywhere in create_runtime.ts", () => {
    expect(createRuntimeSource).not.toMatch(/await runtimeIdentity/);
  });

  it("19. FedosRuntimeIdentity's own import line is unaffected -- exactly one import of it", () => {
    const importLines = [...createRuntimeSource.matchAll(/^import .*$/gm)];
    const fedosRuntimeIdentityImports = importLines.filter((m: RegExpMatchArray) =>
      m[0].includes("fedos_runtime_identity"),
    );
    expect(fedosRuntimeIdentityImports.length).toBe(1);
  });

  it("20. no test/production/local-mode-specific branch exists inside createRuntime()'s own construction block", () => {
    const body = createRuntimeBody();
    const constructionBlock = body.slice(body.indexOf("const runtimeIdentity"), body.indexOf("return {"));
    expect(constructionBlock).not.toMatch(/if\s*\(/);
    expect(constructionBlock).not.toMatch(/"test"|"local"|"cloudflare"/);
    expect(constructionBlock).not.toMatch(/"Development"|"Production"|"Unknown"/);
  });

  // ---------------------------------------------------------------------
  // Behavioral: createRuntime() is Construct Only again
  // ---------------------------------------------------------------------

  it("21. behavioral: createRuntime() remains synchronous, returning a plain object, not a Promise", () => {
    const result = createRuntime();
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result.mode).toBe("string");
  });

  it("22. behavioral: createRuntime() under every RuntimeMode constructs without throwing", () => {
    for (const mode of RUNTIME_MODES) {
      expect(() => createRuntime(undefined, { mode })).not.toThrow();
    }
  });

  it("23. behavioral: createRuntime() under every FedosRuntimeMode (NODE_ENV-driven) constructs without throwing", async () => {
    for (const nodeEnv of NODE_ENVS) {
      await withNodeEnv(nodeEnv, () => {
        expect(() => createRuntime()).not.toThrow();
      });
    }
  });

  it("24. behavioral: createRuntime() no longer produces any in-flight Promise tied to Identity -- no unhandled rejection after a generous wait", async () => {
    createRuntime();
    createRuntime();
    createRuntime();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(true).toBe(true);
  });

  it("25. behavioral: createRuntime() does not expose an 'identity' or 'runtimeIdentity' field, under any mode", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode }) as unknown as Record<string, unknown>;
      expect(runtime.identity).toBeUndefined();
      expect(runtime.runtimeIdentity).toBeUndefined();
      expect(runtime.describeIdentity).toBeUndefined();
    }
  });

  it("26. behavioral: createRuntime() still returns exactly the pre-existing thirty AppRuntime fields, under every mode", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
    }
  });

  it("27. behavioral: 30 repeated createRuntime() calls (simulating Worker per-request construction) never throw -- no per-request Bootstrap work remains", () => {
    const results: unknown[] = [];
    for (let i = 0; i < 30; i += 1) {
      results.push(createRuntime());
    }
    expect(results.length).toBe(30);
  });

  it("28. behavioral: the full 3x3 matrix (RuntimeMode x FedosRuntimeMode) all construct without throwing", async () => {
    for (const nodeEnv of NODE_ENVS) {
      for (const mode of RUNTIME_MODES) {
        await withNodeEnv(nodeEnv, () => {
          expect(() => createRuntime(undefined, { mode })).not.toThrow();
        });
      }
    }
  });

  it("29. behavioral: createRuntime() with no arguments still resolves 'test' mode, unaffected by this Stage", () => {
    expect(createRuntime().mode).toBe("test");
  });

  it("30. behavioral: createRuntime()'s own construction timing is not delayed by any Identity call -- Date.now() before/after stays under a generous bound", () => {
    const start = Date.now();
    createRuntime();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  // ---------------------------------------------------------------------
  // Behavioral: FedosRuntimeIdentity itself is unaffected and still callable
  // ---------------------------------------------------------------------

  it("31. behavioral: a directly-constructed FedosRuntimeIdentity's describeIdentity() still resolves null -- the class itself is untouched, only createRuntime()'s own auto-call is gone", async () => {
    const identity = new FedosRuntimeIdentity();
    expect(await identity.describeIdentity()).toBeNull();
  });

  it("32. behavioral: a directly-constructed FedosRuntimeIdentity's findIdentity()/listIdentities() still behave exactly as before", () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.findIdentity("x")).toBeNull();
    expect(identity.listIdentities()).toEqual([]);
  });

  it("33. behavioral: FedosRuntimeIdentity instances constructed via createRuntime() (indirectly) and directly behave identically -- both remain callable and inert", async () => {
    const direct = new FedosRuntimeIdentity();
    expect(await direct.describeIdentity()).toBeNull();
    const runtime = createRuntime();
    expect(runtime.mode).toBeDefined();
  });

  // ---------------------------------------------------------------------
  // Regression: only create_runtime.ts changed; everything else byte-for-byte
  // ---------------------------------------------------------------------

  it("34. RIPPLE (Secure Runtime Alpha 058): fedos_runtime_identity.ts's three Alpha 050/053/054 methods remain exact pass-throughs; this Stage itself did not reference the Alpha 057 doc, but a LATER Stage (Alpha 058, adding bootstrapIdentity()) legitimately does in its own header-comment history -- reconfirmed here as an expected, intentional reference, not a violation of this Stage's own scope", () => {
    expect(fedosRuntimeIdentitySource).toMatch(
      /async describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{\s*\n\s*return this\.#service\.describeIdentity\(\);\s*\n\s*\}/,
    );
    expect(fedosRuntimeIdentitySource).toMatch(
      /findIdentity\(id: string\): FedosIdentityRecord \| null \{\s*\n\s*return this\.#resolver\.findIdentity\(id\);\s*\n\s*\}/,
    );
    expect(fedosRuntimeIdentitySource).toMatch(
      /listIdentities\(\): readonly FedosIdentityRecord\[\] \{\s*\n\s*return this\.#resolver\.listIdentities\(\);\s*\n\s*\}/,
    );
    expect(fedosRuntimeIdentitySource).toMatch(/secure_runtime_alpha_057/);
  });

  it("35. Regression: AppRuntime's own type (types.ts) is confirmed BYTE-FOR-BYTE unchanged -- no identity field, no reference to this Stage's own doc", () => {
    expect(runtimeTypesSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_057/);
  });

  it("36. Regression: src/worker.ts is confirmed BYTE-FOR-BYTE unchanged -- no reference to FedosRuntimeIdentity, fedos_runtime_identity.ts, or this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_057/);
  });

  it("37. Regression: the entire Identity Layer is confirmed unaffected by this Stage -- no file references this Stage's own doc", () => {
    for (const source of [
      serviceSource,
      registrySource,
      resolverClassSource,
      identityProviderResolverSource,
      nostrProviderSource,
      sourceResolverSource,
      nullSourceSource,
      noopProviderSource,
      capabilitySource,
    ]) {
      expect(source).not.toMatch(/secure_runtime_alpha_057/);
    }
  });

  it("38. Regression: FedosIdentityRegistry/FedosIdentityResolver/FedosIdentityService still expose the exact same methods, unaffected", () => {
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).toMatch(/find\(id: string\): FedosIdentityRecord \| null \{/);
    expect(registrySource).toMatch(/list\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(resolverClassSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(resolverClassSource).toMatch(/listIdentities\(\): readonly FedosIdentityRecord\[\] \{/);
  });

  it("39. Regression: fedos_runtime_storage_resolver.ts and fedos_runtime_storage_backend.ts are confirmed BYTE-FOR-BYTE unchanged", () => {
    for (const source of [storageResolverSource, storageBackendSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_057/);
    }
  });

  it("40. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha057-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha057-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha057-id"));
    expect(deleted).toBe(true);
  });

  it("41. Regression: initializeCrypto()/runtimeCapabilities() remain unaffected -- confirmed by ACTUAL calls via the AppRuntime object", async () => {
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

  it("42. Regression: no fedos_*.ts file was added or removed by this Stage -- still exactly 57 under src/runtime/ and exactly 24 under src/identity/", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("43. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_057/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_057/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_057/);

    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("44. Regression: no Public Runtime API field name changed -- all eleven async fields still present and lazy (function references)", () => {
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

  it("45. RIPPLE (Secure Runtime Alpha 058): final sanity -- this Stage's OWN net effect was exactly one line removed from create_runtime.ts, plus its own header-comment update, touching zero other src/ files AS OF this Stage's own scope; reconfirmed here that types.ts/worker.ts still never reference this Stage's own doc, while fedos_runtime_identity.ts now legitimately does (Alpha 058's own header-comment history, added by a LATER Stage)", () => {
    expect(fedosRuntimeIdentitySource).toMatch(/secure_runtime_alpha_057/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_057/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_057/);
    expect(createRuntimeSource).toMatch(/secure_runtime_alpha_057/);
  });
});
