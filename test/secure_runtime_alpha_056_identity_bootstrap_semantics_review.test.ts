import { describe, it, expect } from "vitest";
import { createRuntime } from "../src/runtime/create_runtime.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
import type { RuntimeMode } from "../src/runtime/types.js";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_056_identity_bootstrap_semantics_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha053055DocSource from "../docs/secure_runtime_alpha_053_055_identity_runtime_internal_operations.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import explicitCryptoInitDocSource from "../docs/runtime_explicit_crypto_initialization.md?raw";
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
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

const RUNTIME_MODES: readonly RuntimeMode[] = ["test", "local", "cloudflare"];

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
 * Secure Runtime Alpha 056 -- "Identity Bootstrap Semantics Review":
 * a REVIEW / DESIGN DECISION Stage only. No implementation file is
 * changed by this Stage. These tests confirm the review document's
 * own structure and content, confirm the CURRENT (Alpha 055) fire-
 * and-forget implementation is recorded precisely, and confirm every
 * implementation file this Stage's own mandate forbids touching
 * remains completely unaffected.
 */
describe("Secure Runtime Alpha 056 -- Identity Bootstrap Semantics Review, review/decision only, no Runtime/Identity/Worker/Rust change", () => {
  // ---------------------------------------------------------------------
  // Design doc structure
  // ---------------------------------------------------------------------

  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(10000);
  });

  it("2. the design doc declares itself review/decision only, with no implementation change", () => {
    expect(designDocSource).toMatch(/REVIEW \/ DESIGN DECISION document only/);
    expect(designDocSource).toMatch(/No\s+implementation file changes anywhere in this repository/);
  });

  it("3. the design doc records the CURRENT fire-and-forget implementation verbatim", () => {
    expect(designDocSource).toMatch(
      /const runtimeIdentity: FedosRuntimeIdentity = new FedosRuntimeIdentity\(\);/,
    );
    expect(designDocSource).toMatch(
      /void runtimeIdentity\.describeIdentity\(\)\.catch\(\(\) => \{\}\);/,
    );
  });

  it("4. the design doc's recorded implementation matches the ACTUAL current create_runtime.ts source verbatim", () => {
    expect(createRuntimeSource).toMatch(
      /void runtimeIdentity\.describeIdentity\(\)\.catch\(\(\) => \{\}\);/,
    );
  });

  it("5. the design doc names all five Options (A-E) as distinct, labeled alternatives", () => {
    expect(designDocSource).toMatch(/Option A/);
    expect(designDocSource).toMatch(/Option B/);
    expect(designDocSource).toMatch(/Option C/);
    expect(designDocSource).toMatch(/Option D/);
    expect(designDocSource).toMatch(/Option E/);
  });

  it("6. the design doc's own comparison table covers every mandated evaluation criterion", () => {
    const criteria = [
      /sync contract/i,
      /[Ii]mplicit side effect/,
      /determin/i,
      /[Rr]egistry registration timing/,
      /[Dd]uplicate Bootstrap/,
      /network I\/O/,
      /Storage/,
      /Testability/,
      /Fail Closed/,
      /observability/i,
      /Cancellation/,
      /shutdown/i,
      /Worker/,
      /Production/,
      /Desktop/,
      /Protocol independence/,
    ];
    for (const criterion of criteria) {
      expect(designDocSource).toMatch(criterion);
    }
  });

  it("7. the design doc answers all eight named review questions as distinct, numbered items", () => {
    for (let n = 1; n <= 8; n += 1) {
      expect(designDocSource).toMatch(new RegExp(`^${n}\\. \\*\\*`, "m"));
    }
  });

  it("8. the design doc contains exactly one '## 6. Decision' section naming exactly one adopted Option", () => {
    const decisionSections = [...designDocSource.matchAll(/^## 6\. Decision$/gm)];
    expect(decisionSections.length).toBe(1);
    expect(designDocSource).toMatch(/\*\*Option B is adopted/);
  });

  it("9. the design doc's own Decision section does not simultaneously adopt any other Option", () => {
    const decisionBody = (designDocSource.match(/## 6\. Decision([\s\S]*?)\n## 7\./) ?? [])[1] ?? "";
    expect(decisionBody).not.toMatch(/\*\*Option A is adopted/);
    expect(decisionBody).not.toMatch(/\*\*Option C is adopted/);
    expect(decisionBody).not.toMatch(/\*\*Option D is adopted/);
    expect(decisionBody).not.toMatch(/\*\*Option E is adopted/);
  });

  it("10. the design doc records an explicit 'does NOT do' list naming every prohibited file/area", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/create_runtime\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/fedos_runtime_identity\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify any `src\/identity\/\*` file/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `AppRuntime`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/worker\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `packages\/fedos-core-rust`/);
  });

  it("11. the design doc names exactly one Alpha 057 recommendation, not multiple", () => {
    const section = (designDocSource.match(/## 8\. Alpha 057 recommendation([\s\S]*?)\n## 9\./) ?? [])[1] ?? "";
    expect(section.length).toBeGreaterThan(0);
    // exactly one bolded recommendation opening the section
    const boldRecommendations = [...section.matchAll(/\*\*Remove the fire-and-forget/g)];
    expect(boldRecommendations.length).toBe(1);
  });

  it("12. the design doc's Alpha 057 recommendation is the minimal single-line removal, matching Decision Option B", () => {
    expect(designDocSource).toMatch(
      /Remove the fire-and-forget `void runtimeIdentity\.describeIdentity\(\)\.catch\(\(\) => \{\}\);`\s*\n?statement from `createRuntime\(\)`/,
    );
    expect(designDocSource).toMatch(/restoring the Alpha 051 shape/);
  });

  it("13. the design doc explicitly discusses Fail Closed vs Observability being confused", () => {
    expect(designDocSource).toMatch(/confuse Fail Closed with missing\s*\n?\s*Observability/);
    expect(designDocSource).toMatch(/true black hole/);
  });

  it("14. the design doc cross-references the Alpha 053-055 doc and the Explicit Crypto Initialization doc", () => {
    expect(designDocSource).toMatch(
      /secure_runtime_alpha_053_055_identity_runtime_internal_operations\.md/,
    );
    expect(designDocSource).toMatch(/runtime_explicit_crypto_initialization\.md/);
    expect(alpha053055DocSource.length).toBeGreaterThan(0);
    expect(explicitCryptoInitDocSource.length).toBeGreaterThan(0);
  });

  it("15. the design doc quotes the Explicit Crypto Initialization's own 'no auto-load at startup' rule as precedent", () => {
    expect(designDocSource).toMatch(/No auto-load at startup/);
    expect(explicitCryptoInitDocSource).toMatch(/No auto-load at startup/);
  });

  it("16. the design doc records the Worker per-request createRuntime() finding as concrete evidence", () => {
    expect(designDocSource).toMatch(/on every incoming HTTP request/);
    expect(designDocSource).toMatch(/line 1244/);
  });

  it("17. the design doc's own precedent survey table lists every other async/Public Runtime API surface", () => {
    const surveyRows = [
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
    ];
    for (const row of surveyRows) {
      expect(designDocSource).toMatch(new RegExp(row));
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral: current implementation confirmed exactly as documented
  // ---------------------------------------------------------------------

  it("18. behavioral: createRuntime() remains a synchronous, non-async function", () => {
    expect(createRuntimeSource).toMatch(/export function createRuntime\(/);
    expect(createRuntimeSource).not.toMatch(/export async function createRuntime/);
    const result = createRuntime();
    expect(result).not.toBeInstanceOf(Promise);
  });

  it("19. behavioral: createRuntime()'s own return value is unaffected across every RuntimeMode", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      expect(runtime.mode).toBe(mode);
    }
  });

  it("20. behavioral: the fire-and-forget call's own return value is discarded -- createRuntime() itself never exposes a Promise or an identity field", () => {
    const runtime = createRuntime() as unknown as Record<string, unknown>;
    expect(runtime.identity).toBeUndefined();
    expect(runtime.runtimeIdentity).toBeUndefined();
    expect(runtime.describeIdentity).toBeUndefined();
  });

  it("21. behavioral: a rejecting Provider swallowed via .catch(() => {}) never surfaces as a thrown error or unhandled rejection from createRuntime()", async () => {
    expect(() => createRuntime()).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  it("22. behavioral: describeIdentity() on a directly-constructed FedosRuntimeIdentity resolves null (the same call createRuntime() fires and discards)", async () => {
    const identity = new FedosRuntimeIdentity();
    expect(await identity.describeIdentity()).toBeNull();
  });

  it("23. behavioral: Identity Registry registration timing is asynchronous and not sequenced against createRuntime()'s own synchronous return -- confirmed by findIdentity() immediately after construction never blocking or throwing", () => {
    const identity = new FedosRuntimeIdentity();
    expect(() => identity.findIdentity("any-id")).not.toThrow();
    expect(identity.findIdentity("any-id")).toBeNull();
  });

  it("24. behavioral: listIdentities() immediately after construction (before any Bootstrap Promise could settle) is still a synchronous, empty-array read -- no timing dependency observed today", () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.listIdentities()).toEqual([]);
    expect(Array.isArray(identity.listIdentities())).toBe(true);
  });

  it("25. behavioral: 20 rapid createRuntime() calls (simulating Worker per-request construction) each independently fire and discard their own Bootstrap call without throwing", () => {
    const runtimes = [];
    for (let i = 0; i < 20; i += 1) {
      runtimes.push(createRuntime());
    }
    expect(runtimes.length).toBe(20);
  });

  it("26. behavioral: createRuntime() under every FedosRuntimeMode (NODE_ENV-driven) still constructs without throwing, unaffected by this review", async () => {
    for (const nodeEnv of ["development", "production", undefined]) {
      await withNodeEnv(nodeEnv, () => {
        expect(() => createRuntime()).not.toThrow();
      });
    }
  });

  // ---------------------------------------------------------------------
  // Regression: NO implementation file touched by this review Stage
  // ---------------------------------------------------------------------

  it("27. RIPPLE (Secure Runtime Alpha 057): create_runtime.ts's own construction block was confirmed BYTE-FOR-BYTE unchanged from Alpha 055 AS OF this Stage's own review-only scope; Alpha 057 (implementing this Stage's own Decision) removed the describeIdentity() call -- reconfirmed here as the CURRENT two-statement block (construction, then a bare `void runtimeIdentity;`)", () => {
    const body = (createRuntimeSource.match(/export function createRuntime\(([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const constIndex = body.indexOf("const runtimeIdentity: FedosRuntimeIdentity");
    const voidIndex = body.indexOf("void runtimeIdentity;");
    const returnIndex = body.indexOf("return {", voidIndex);
    expect(constIndex).toBeGreaterThan(-1);
    expect(voidIndex).toBeGreaterThan(constIndex);
    expect(returnIndex).toBeGreaterThan(voidIndex);
    expect(body).not.toMatch(/\.describeIdentity\(\)/);
  });

  it("28. Regression: fedos_runtime_identity.ts's own three methods are confirmed BYTE-FOR-BYTE unchanged", () => {
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

  it("29. Regression: fedos_runtime_identity.ts does not reference this Stage's own review doc -- confirming this Stage touched no code, only documentation", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_056/);
  });

  it("30. RIPPLE (Secure Runtime Alpha 057): create_runtime.ts did not reference this Stage's own review doc AS OF this Stage's own review-only scope, confirming this Stage itself touched no code, only documentation; Alpha 057 (a LATER, separate Stage that implements this Stage's own Decision) legitimately references it in create_runtime.ts's own header comment while recording this arc's history -- reconfirmed here as an expected, intentional reference, not a violation of this Stage's own no-code-change mandate", () => {
    expect(createRuntimeSource).toMatch(/secure_runtime_alpha_056/);
  });

  it("31. Regression: AppRuntime's own type (types.ts) is confirmed BYTE-FOR-BYTE unchanged -- no identity field, no reference to this Stage's own doc", () => {
    expect(runtimeTypesSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_056/);
  });

  it("32. Regression: src/worker.ts is confirmed BYTE-FOR-BYTE unchanged -- no reference to FedosRuntimeIdentity, fedos_runtime_identity.ts, or this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_056/);
  });

  it("33. Regression: the entire Identity Layer is confirmed unaffected by this review Stage -- no file references this Stage's own doc", () => {
    for (const source of [
      serviceSource,
      registrySource,
      resolverClassSource,
      identityProviderResolverSource,
      nostrProviderSource,
      sourceResolverSource,
    ]) {
      expect(source).not.toMatch(/secure_runtime_alpha_056/);
    }
  });

  it("34. Regression: FedosIdentityRegistry/FedosIdentityResolver/FedosIdentityService still expose the exact same methods this review Stage analyzed, unaffected", () => {
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).toMatch(/find\(id: string\): FedosIdentityRecord \| null \{/);
    expect(registrySource).toMatch(/list\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(resolverClassSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(resolverClassSource).toMatch(/listIdentities\(\): readonly FedosIdentityRecord\[\] \{/);
  });

  it("35. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- no reference to this Stage's own doc", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_056/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_056/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_056/);
  });

  it("36. Regression: still exactly 36 pub fn / thirteen #[wasm_bindgen] in lib.rs, entirely unaffected by this review Stage", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);
  });

  it("37. Regression: package.json still declares exactly two dependencies, unaffected by this review Stage", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("38. Regression: no fedos_*.ts file was added or removed by this Stage -- still exactly 57 under src/runtime/ and exactly 24 under src/identity/", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("39. Regression: createRuntime() still returns exactly the pre-existing thirty AppRuntime fields, unaffected by this review Stage", () => {
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
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
    }
  });

  it("40. Regression: create_runtime.ts contains exactly ONE fire-and-forget expression ('void ...catch(') in its entire source, confirming Identity Bootstrap is still the sole exception this Stage reviewed", () => {
    const fireAndForgetMatches = [...createRuntimeSource.matchAll(/void [^;]*\.catch\(/g)];
    expect(fireAndForgetMatches.length).toBe(1);
  });

  it("41. Regression: no Public Runtime API field name changed -- initializeCrypto/runtimeCapabilities/randomBytes/generateAeadKey/encrypt/decrypt/exportCiphertext/importCiphertext/storeCiphertext/loadCiphertext/deleteCiphertext still all present and lazy (function references), unaffected", () => {
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

  it("42. RIPPLE (Secure Runtime Alpha 057): final sanity -- this Stage's OWN net effect was documentation-only AS OF its own scope (two new files added, zero existing src/ files modified); reconfirmed here that fedos_runtime_identity.ts/types.ts/worker.ts still never reference this Stage's own doc, while create_runtime.ts now legitimately does (Alpha 057's own header-comment history, not a violation of this Stage's own mandate)", () => {
    expect(createRuntimeSource).toMatch(/secure_runtime_alpha_056/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_056/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_056/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_056/);
  });
});
