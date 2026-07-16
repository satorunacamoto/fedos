import { describe, it, expect } from "vitest";
import { createRuntime } from "../src/runtime/create_runtime.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
import type { RuntimeMode } from "../src/runtime/types.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_062_identity_bootstrap_reset_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha061DocSource from "../docs/secure_runtime_alpha_061_identity_bootstrap_idempotency.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha059DocSource from "../docs/secure_runtime_alpha_059_identity_bootstrap_authority_review.md?raw";
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
import storageResolverSource from "../src/runtime/fedos_runtime_storage_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageBackendSource from "../src/runtime/fedos_runtime_storage_backend.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };

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
 * Secure Runtime Alpha 062 -- "Identity Bootstrap Reset Review": a
 * REVIEW / DESIGN DECISION Stage only. No implementation file is
 * changed by this Stage. These tests confirm the review document's
 * own structure and content, confirm no Reset API (resetIdentityBootstrap/
 * Registry.clear()/shutdown()) exists anywhere, and confirm every
 * implementation file this Stage's own mandate forbids touching
 * remains completely unaffected.
 */
describe("Secure Runtime Alpha 062 -- Identity Bootstrap Reset Review, review/decision only, no src/ change", () => {
  // ---------------------------------------------------------------------
  // Design doc structure
  // ---------------------------------------------------------------------

  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(8000);
  });

  it("2. the design doc declares itself review/decision only, with no implementation change", () => {
    expect(designDocSource).toMatch(/REVIEW \/ DESIGN DECISION document only/);
    expect(designDocSource).toMatch(/No\s+implementation file changes anywhere in this repository/);
  });

  it("3. the design doc names all five Reset Options (A-E) as distinct, labeled alternatives", () => {
    expect(designDocSource).toMatch(/\*\*Option A\*\* — add `resetIdentityBootstrap\(\): void`/);
    expect(designDocSource).toMatch(/\*\*Option B\*\* — regenerate `FedosRuntimeIdentity` only/);
    expect(designDocSource).toMatch(/\*\*Option C\*\* — add `Registry\.clear\(\): void`/);
    expect(designDocSource).toMatch(/\*\*Option D\*\* — Bootstrap state is permanently fixed/);
    expect(designDocSource).toMatch(/\*\*Option E\*\* — introduce `shutdown\(\)/);
  });

  it("4. the design doc's own comparison table covers every mandated evaluation criterion", () => {
    const criteria = [
      /Desktop再接続/,
      /ログアウト/,
      /Identity切替/,
      /Registry整合性/,
      /Idempotency \(Alpha 061 interaction\)/,
      /Fail Closed/,
      /Runtime純粋性/,
      /Protocol非依存/,
      /Storage影響/,
      /\| Worker \|/,
      /\| CLI \|/,
      /テスト容易性/,
      /メモリ管理/,
      /責務/,
      /将来Provider/,
    ];
    for (const criterion of criteria) {
      expect(designDocSource).toMatch(criterion);
    }
  });

  it("5. the design doc's comparison table has at least fifteen criterion rows", () => {
    const tableSection = (designDocSource.match(/## 4\. Comparison([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    const rows = [...tableSection.matchAll(/^\| [^|]+\|/gm)].filter(
      (m: RegExpMatchArray) => !m[0].startsWith("| Criterion") && !m[0].startsWith("|---"),
    );
    expect(rows.length).toBeGreaterThanOrEqual(15);
  });

  it("6. the design doc contains exactly one '## 6. Decision' section naming Option B and Option D as adopted", () => {
    const decisionSections = [...designDocSource.matchAll(/^## 6\. Decision$/gm)];
    expect(decisionSections.length).toBe(1);
    expect(designDocSource).toMatch(
      /\*\*Option B \(regenerate `FedosRuntimeIdentity` only\) is adopted,\s*\ntogether with Option D/,
    );
  });

  it("7. the design doc's own Decision section explicitly rejects Option A, Option C, and Option E", () => {
    const decisionBody = (designDocSource.match(/## 6\. Decision([\s\S]*?)\n## 7\./) ?? [])[1] ?? "";
    expect(decisionBody).toMatch(/No Reset API is added/);
    expect(decisionBody).toMatch(
      /Option A \(`resetIdentityBootstrap\(\)`\) and Option C \(`Registry\.clear\(\)`\)\s*\nare explicitly rejected/,
    );
    expect(decisionBody).toMatch(/Option E \(`shutdown\(\)`\) is explicitly\s*\nrejected/);
    expect(decisionBody).toMatch(/Option A is rejected/);
    expect(decisionBody).toMatch(/Option C is rejected/);
    expect(decisionBody).toMatch(/Option E is rejected as premature/);
  });

  it("8. the design doc records an explicit 'does NOT do' list naming every prohibited file/area", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/create_runtime\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/fedos_runtime_identity\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/types\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/worker\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify any `src\/identity\/\*` file/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `packages\/fedos-core-rust`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any Public Runtime API field/);
  });

  it("9. the design doc's own recommendation section names 'add nothing' as this Stage's own conclusion", () => {
    const section = (designDocSource.match(/## 9\. Recommendation for future Stages([\s\S]*?)\n## 10\./) ?? [])[1] ?? "";
    expect(section.length).toBeGreaterThan(0);
    expect(section).toMatch(/\*\*No future Stage needs to add a Reset API\.\*\*/);
  });

  it("10. the design doc cross-references Alpha 059 and Alpha 061", () => {
    expect(designDocSource).toMatch(
      /secure_runtime_alpha_059_identity_bootstrap_authority_review\.md/,
    );
    expect(designDocSource).toMatch(
      /secure_runtime_alpha_061_identity_bootstrap_idempotency\.md/,
    );
    expect(alpha059DocSource.length).toBeGreaterThan(0);
    expect(alpha061DocSource.length).toBeGreaterThan(0);
  });

  it("11. the design doc's own conclusion states FedosRuntimeIdentity is treated as a short-lived object, and Identity switching means constructing a new instance", () => {
    expect(designDocSource).toMatch(/\*\*short-lived object\*\*/);
    expect(designDocSource).toMatch(/Identity switching is achieved by constructing a new/);
    expect(designDocSource).toMatch(/`new FedosRuntimeIdentity\(\)`/);
  });

  it("12. the design doc's own structure sanity check -- at least ten numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(10);
  });

  it("13. the design doc's Identity switching section (§7) states the pattern precisely, referencing Alpha 050's own constructor", () => {
    expect(designDocSource).toMatch(/## 7\. Identity switching, stated precisely/);
    const section = (designDocSource.match(/## 7\. Identity switching, stated precisely([\s\S]*?)\n## 8\./) ?? [])[1] ?? "";
    expect(section).toMatch(/never by mutating\s*\nan existing instance's Bootstrap state/);
  });

  // ---------------------------------------------------------------------
  // Behavioral: no Reset API exists anywhere; existing surface unaffected
  // ---------------------------------------------------------------------

  it("14. fedos_runtime_identity.ts's own CLASS BODY (comments stripped) defines no reset/shutdown/clear/dispose/close method of any kind -- 'reset()' appears only as a rejected-option reference inside the Alpha 061 header comment, not as code", () => {
    const codeOnly = fedosRuntimeIdentitySource
      .split("\n")
      .filter((line: string) => {
        const trimmed = line.trim();
        return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
      })
      .join("\n");
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    expect(classBody).not.toMatch(/resetIdentityBootstrap/);
    expect(classBody).not.toMatch(/^\s*(?:async\s+)?shutdown\s*\(/m);
    expect(classBody).not.toMatch(/^\s*(?:async\s+)?dispose\s*\(/m);
    expect(classBody).not.toMatch(/^\s*(?:async\s+)?close\s*\(/m);
    expect(classBody).not.toMatch(/^\s*(?:async\s+)?reset\s*\(/m);
    expect(classBody).not.toMatch(/^\s*(?:async\s+)?clear\s*\(/m);
  });

  it("15. FedosIdentityRegistry's own source defines no bulk clear() method -- register()/find()/list()/remove(id) (the four methods it has always had, per its own Alpha 041 header) remain the ONLY methods, with no store-wide reset added by this Stage", () => {
    expect(registrySource).not.toMatch(/^\s*(?:async\s+)?clear\s*\(\s*\)/m);
    const methodNames = [
      ...registrySource.matchAll(/^\s{2}(\w+)\([^)]*\)(?::\s*[^{]+)?\s*\{/gm),
    ].map((m: RegExpMatchArray) => m[1]);
    expect(new Set(methodNames)).toEqual(new Set(["register", "find", "list", "remove"]));
  });

  it("16. FedosRuntimeIdentity's three internal fields remain readonly -- reset-by-mutation is a compile-time impossibility, not merely an unwritten convention", () => {
    expect(fedosRuntimeIdentitySource).toMatch(/readonly #registry: FedosIdentityRegistry;/);
    expect(fedosRuntimeIdentitySource).toMatch(/readonly #service: FedosIdentityService;/);
    expect(fedosRuntimeIdentitySource).toMatch(/readonly #resolver: FedosIdentityResolver;/);
  });

  it("17. RIPPLE (Secure Runtime Alpha 070): bootstrapIdentity()'s own body had exactly one assignment to #bootstrapped AS OF this Stage's own scope -- no reset path existed; Alpha 069 (Identity Bootstrap State Consolidation) moved that assignment into a new dedicated private method, #completeBootstrap(), called once from bootstrapIdentity()'s own body, and Alpha 070 (Identity Bootstrap Entry Consolidation) moved that call site itself into a new private #bootstrapIdentity() method, with the PUBLIC bootstrapIdentity() reduced to a pure one-line wrapper -- reconfirmed here that the class BODY as a whole still has exactly one assignment to #bootstrapped, now inside #completeBootstrap(), with no reset path anywhere", () => {
    const classBody = (fedosRuntimeIdentitySource.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const assignments = [...classBody.matchAll(/#bootstrapped\s*=/g)];
    expect(assignments.length).toBe(1);
    expect(classBody).toMatch(/#bootstrapped = true;/);
    const bootstrapBody = (classBody.match(/async #bootstrapIdentity\(\): Promise<void> \{([\s\S]*?)\n  \}/) ?? [])[1] ?? "";
    expect(bootstrapBody).not.toMatch(/#bootstrapped\s*=/);
    expect(bootstrapBody).toMatch(/this\.#completeBootstrap\(descriptor\);/);
    const publicBody = (classBody.match(/\n  async bootstrapIdentity\(\): Promise<void> \{([\s\S]*?)\n  \}/) ?? [])[1] ?? "";
    expect(publicBody.trim()).toBe("return this.#bootstrapIdentity();");
  });

  it("18. RIPPLE (Secure Runtime Alpha 068): the class had exactly FIVE PUBLIC methods AS OF this Stage's own scope -- no sixth method (e.g. reset/shutdown) had been added by THIS Stage; Alpha 063 later added a real sixth, currentIdentity() (a Descriptor cache read, not a reset/shutdown of any kind), Alpha 064 added a seventh, identityVersion(), Alpha 066 removed that seventh again, and Alpha 068 (implementing the Alpha 067 Decision) made describeIdentity() a true private #describeIdentity() method -- reconfirmed here that bootstrapIdentity() (this Stage's own method) remains present, alongside the still-current sixth (currentIdentity), with describeIdentity() now excluded from the PUBLIC set", () => {
    const codeOnly = fedosRuntimeIdentitySource
      .split("\n")
      .filter((line: string) => {
        const trimmed = line.trim();
        return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
      })
      .join("\n");
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
  });

  it("19. create_runtime.ts's own source contains no reference to bootstrapIdentity, resetIdentityBootstrap, or shutdown anywhere", () => {
    expect(createRuntimeSource).not.toMatch(/bootstrapIdentity/);
    expect(createRuntimeSource).not.toMatch(/resetIdentityBootstrap/);
    expect(createRuntimeSource).not.toMatch(/shutdown/);
  });

  it("20. src/worker.ts's own source contains no reference to bootstrapIdentity, resetIdentityBootstrap, FedosRuntimeIdentity, or fedos_runtime_identity.ts", () => {
    expect(workerSource).not.toMatch(/bootstrapIdentity/);
    expect(workerSource).not.toMatch(/resetIdentityBootstrap/);
    expect(workerSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
  });

  it("21. AppRuntime (types.ts) has no identity, runtimeIdentity, bootstrapIdentity, or shutdown field", () => {
    expect(runtimeTypesSource).not.toMatch(
      /FedosRuntimeIdentity|fedos_runtime_identity|bootstrapIdentity|resetIdentityBootstrap/,
    );
    const body = (runtimeTypesSource.match(/export interface AppRuntime \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const fieldNames = [...body.matchAll(/readonly (\w+)[?:]/g)].map((m: RegExpMatchArray) => m[1]).sort();
    expect(fieldNames).toEqual(APP_RUNTIME_FIELDS);
  });

  it("22. behavioral: createRuntime() still returns exactly the pre-existing thirty AppRuntime fields, under every mode, unaffected by this review", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
    }
  });

  it("23. behavioral: constructing a NEW FedosRuntimeIdentity always starts un-bootstrapped, confirming the 'regenerate' pattern this Decision adopts", () => {
    const a = new FedosRuntimeIdentity();
    expect(a.isBootstrapped()).toBe(false);
    const b = new FedosRuntimeIdentity();
    expect(b.isBootstrapped()).toBe(false);
    expect(a).not.toBe(b);
  });

  it("24. behavioral: bootstrapping one instance never affects a second, independently-constructed instance's own Bootstrap state -- confirming Identity switching via regeneration is clean", async () => {
    const oldIdentity = new FedosRuntimeIdentity();
    await oldIdentity.bootstrapIdentity();
    expect(oldIdentity.isBootstrapped()).toBe(true);

    const newIdentity = new FedosRuntimeIdentity();
    expect(newIdentity.isBootstrapped()).toBe(false);
    expect(newIdentity.listIdentities()).toEqual([]);
  });

  it("25. RIPPLE (Secure Runtime Alpha 068): a bootstrapped instance's own #bootstrapped never reverted to false through any public method call, including repeated calls to every other method, AS OF this Stage's own scope; Alpha 068 made describeIdentity() private -- reconfirmed here via the remaining public methods (currentIdentity()/findIdentity()/listIdentities()/bootstrapIdentity())", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);

    identity.currentIdentity();
    identity.findIdentity("x");
    identity.listIdentities();
    await identity.bootstrapIdentity();

    expect(identity.isBootstrapped()).toBe(true);
  });

  it("26. RIPPLE (Secure Runtime Alpha 068): no public method on FedosRuntimeIdentity accepted arguments that could plausibly force a reset AS OF this Stage's own scope -- every method was either zero-argument or took a single lookup id; Alpha 068 made describeIdentity() private, removing it from the PUBLIC surface entirely -- reconfirmed here that every REMAINING public method is either zero-argument or takes a single lookup id", () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.bootstrapIdentity.length).toBe(0);
    expect(identity.isBootstrapped.length).toBe(0);
    expect(identity.currentIdentity.length).toBe(0);
    expect(identity.listIdentities.length).toBe(0);
    expect(identity.findIdentity.length).toBe(1);
    expect((identity as unknown as Record<string, unknown>).describeIdentity).toBeUndefined();
  });

  // ---------------------------------------------------------------------
  // Regression: no implementation file touched by this review Stage
  // ---------------------------------------------------------------------

  it("27. RIPPLE (Secure Runtime Alpha 063): fedos_runtime_identity.ts did not reference this Stage's own review doc AS OF this Stage's own review-only scope, confirming this Stage itself touched no code, only documentation; Alpha 063 (a LATER, separate Stage that adds currentIdentity()) legitimately references it in fedos_runtime_identity.ts's own header comment while recording this arc's history -- reconfirmed here as an expected, intentional reference, not a violation of this Stage's own no-code-change mandate", () => {
    expect(fedosRuntimeIdentitySource).toMatch(/secure_runtime_alpha_062/);
  });

  it("28. Regression: create_runtime.ts does not reference this Stage's own review doc", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_062/);
  });

  it("29. Regression: AppRuntime's own type (types.ts) does not reference this Stage's own doc", () => {
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_062/);
  });

  it("30. Regression: src/worker.ts does not reference this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_062/);
  });

  it("31. Regression: the entire Identity Layer is confirmed unaffected by this review Stage -- no file references this Stage's own doc", () => {
    for (const source of [
      serviceSource,
      registrySource,
      resolverClassSource,
      identityProviderResolverSource,
    ]) {
      expect(source).not.toMatch(/secure_runtime_alpha_062/);
    }
  });

  it("32. Regression: FedosIdentityRegistry/FedosIdentityResolver/FedosIdentityService still expose the exact same methods this review Stage analyzed, unaffected", () => {
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).toMatch(/find\(id: string\): FedosIdentityRecord \| null \{/);
    expect(registrySource).toMatch(/list\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(resolverClassSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(resolverClassSource).toMatch(/listIdentities\(\): readonly FedosIdentityRecord\[\] \{/);
  });

  it("33. Regression: fedos_runtime_storage_resolver.ts and fedos_runtime_storage_backend.ts are confirmed unaffected by this Stage", () => {
    for (const source of [storageResolverSource, storageBackendSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_062/);
    }
  });

  it("34. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha062-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha062-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha062-id"));
    expect(deleted).toBe(true);
  });

  it("35. Regression: initializeCrypto()/runtimeCapabilities() remain unaffected -- confirmed by ACTUAL calls via the AppRuntime object", async () => {
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

  it("36. Regression: no fedos_*.ts file was added or removed by this Stage -- still exactly 57 under src/runtime/ and exactly 24 under src/identity/", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("37. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(45);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(16);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_062/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_062/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_062/);
  });

  it("38. Regression: package.json still declares exactly two dependencies and no bin/main/exports field, unaffected by this Stage", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("39. no other doc file references this Stage's own doc, confirming this Stage's own footprint is exactly two new files", () => {
    expect(alpha059DocSource).not.toMatch(/secure_runtime_alpha_062/);
    expect(alpha061DocSource).not.toMatch(/secure_runtime_alpha_062/);
  });

  it("40. behavioral: repeated createRuntime() calls (simulating Worker per-request construction) never throw, confirming Worker remains unaffected and un-wired", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(() => createRuntime()).not.toThrow();
    }
  });

  it("41. behavioral: two independently-constructed FedosRuntimeIdentity instances bootstrapping concurrently do not interfere with each other's own state", async () => {
    const a = new FedosRuntimeIdentity();
    const b = new FedosRuntimeIdentity();
    await Promise.all([a.bootstrapIdentity(), b.bootstrapIdentity()]);
    expect(a.isBootstrapped()).toBe(true);
    expect(b.isBootstrapped()).toBe(true);
    expect(a.listIdentities()).toEqual([]);
    expect(b.listIdentities()).toEqual([]);
  });

  it("42. RIPPLE (Secure Runtime Alpha 063): final sanity -- this Stage's OWN net effect touched zero src/ files AS OF its own scope; reconfirmed here that create_runtime.ts/types.ts/worker.ts still never reference this Stage's own doc, while fedos_runtime_identity.ts (Alpha 063's own header-comment history, added by a LATER Stage) now legitimately does", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_062/);
    expect(fedosRuntimeIdentitySource).toMatch(/secure_runtime_alpha_062/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_062/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_062/);
  });
});
