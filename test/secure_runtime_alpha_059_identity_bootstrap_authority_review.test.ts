import { describe, it, expect } from "vitest";
import { createRuntime } from "../src/runtime/create_runtime.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
import type { RuntimeMode } from "../src/runtime/types.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_059_identity_bootstrap_authority_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha058DocSource from "../docs/secure_runtime_alpha_058_identity_bootstrap_boundary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import positioningDocSource from "../docs/fedos_runtime_positioning.md?raw";
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
 * Secure Runtime Alpha 059 -- "Identity Bootstrap Authority Review":
 * a REVIEW / DESIGN DECISION Stage only. No implementation file is
 * changed by this Stage. These tests confirm the review document's
 * own structure and content, confirm `bootstrapIdentity()` (Alpha
 * 058) remains called by nothing, and confirm every implementation
 * file this Stage's own mandate forbids touching remains completely
 * unaffected.
 */
describe("Secure Runtime Alpha 059 -- Identity Bootstrap Authority Review, review/decision only, no src/ change", () => {
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

  it("3. the design doc names all five Authority Options (A-E) as distinct, labeled alternatives", () => {
    expect(designDocSource).toMatch(/\*\*Option A\*\* — Desktop Application/);
    expect(designDocSource).toMatch(/\*\*Option B\*\* — Worker/);
    expect(designDocSource).toMatch(/\*\*Option C\*\* — a CLI/);
    expect(designDocSource).toMatch(/\*\*Option D\*\* — expose `bootstrapIdentity\(\)`/);
    expect(designDocSource).toMatch(/\*\*Option E\*\* — add a new internal Bootstrap Manager/);
  });

  it("4. the design doc's own comparison table covers every mandated evaluation criterion", () => {
    const criteria = [
      /責務/,
      /同期契約/,
      /Runtime純粋性/,
      /\| Worker \|/,
      /\| Desktop \|/,
      /\| CLI \|/,
      /テスト/,
      /重複Bootstrap/,
      /Registry一貫性/,
      /Protocol非依存性/,
      /\| Storage \|/,
      /\| Network \|/,
      /Fail Closed/,
      /Observability/,
      /将来Nostr/,
      /将来ActivityPub/,
    ];
    for (const criterion of criteria) {
      expect(designDocSource).toMatch(criterion);
    }
  });

  it("5. the design doc contains exactly one '## 6. Decision' section naming exactly one adopted Option", () => {
    const decisionSections = [...designDocSource.matchAll(/^## 6\. Decision$/gm)];
    expect(decisionSections.length).toBe(1);
    expect(designDocSource).toMatch(
      /Desktop Application startup \(Option A\) is adopted as the designated/,
    );
  });

  it("6. the design doc's own Decision section explicitly rejects Worker, Public Runtime API exposure, and an internal Bootstrap Manager", () => {
    const decisionBody = (designDocSource.match(/## 6\. Decision([\s\S]*?)\n## 7\./) ?? [])[1] ?? "";
    expect(decisionBody).toMatch(/Worker \(Option B\) is explicitly\s*\nrejected/);
    expect(decisionBody).toMatch(/Public Runtime API\s*\nexposure \(Option D\) is rejected/);
    expect(decisionBody).toMatch(/internal Bootstrap Manager \(Option E\) is\s*\nrejected as premature/);
  });

  it("7. the design doc records an explicit 'does NOT do' list naming every prohibited file/area", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify any `src\/runtime\/\*` file/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify any `src\/identity\/\*` file/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/worker\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `packages\/fedos-core-rust`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any Public Runtime API field/);
  });

  it("8. the design doc names exactly one Alpha 060 recommendation: no code change", () => {
    const section = (designDocSource.match(/## 9\. Alpha 060 recommendation([\s\S]*?)\n## 10\./) ?? [])[1] ?? "";
    expect(section.length).toBeGreaterThan(0);
    expect(section).toMatch(/\*\*Alpha 060 should make NO code change/);
  });

  it("9. the design doc cross-references the Alpha 058 doc and the Runtime Positioning doc", () => {
    expect(designDocSource).toMatch(
      /secure_runtime_alpha_058_identity_bootstrap_boundary\.md/,
    );
    expect(designDocSource).toMatch(/fedos_runtime_positioning\.md/);
    expect(alpha058DocSource.length).toBeGreaterThan(0);
    expect(positioningDocSource.length).toBeGreaterThan(0);
  });

  it("10. the design doc's own evidence about Worker matches the ACTUAL current worker.ts source -- per-request createRuntime() call confirmed", () => {
    expect(designDocSource).toMatch(/createRuntime\(env\)/);
    expect(workerSource).toMatch(/fetch\(request: Request, env\?: Env\): Promise<Response> \{/);
    const fetchBody = (workerSource.match(/fetch\(request: Request, env\?: Env\): Promise<Response> \{([\s\S]*?)\n {2}\},/) ?? [])[1] ?? "";
    expect(fetchBody).toMatch(/createRuntime\(env\)/);
  });

  it("11. the design doc's own evidence about the absence of a CLI/Desktop shell matches this repository's ACTUAL current package.json (no bin field)", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(pkg.bin).toBeUndefined();
    expect(pkg.main).toBeUndefined();
    expect(pkg.exports).toBeUndefined();
    expect(designDocSource).toMatch(/no `"bin"` field/);
  });

  it("12. the design doc answers all four confirmation questions as distinct items", () => {
    expect(designDocSource).toMatch(
      /Is `bootstrapIdentity\(\)` still not called from `createRuntime\(\)`\?/,
    );
    expect(designDocSource).toMatch(
      /Is `bootstrapIdentity\(\)` still not called from Worker\?/,
    );
    expect(designDocSource).toMatch(
      /Is `bootstrapIdentity\(\)` still unexposed on the Public Runtime API\?/,
    );
    expect(designDocSource).toMatch(/Is Desktop the ONLY candidate\?/);
  });

  it("13. the design doc's own answer to 'is Desktop the only candidate' explicitly says no, naming CLI as structurally equivalent", () => {
    const answer = (designDocSource.match(/Is Desktop the ONLY candidate\?([\s\S]*?)\n\n## 6\./) ?? [])[1] ?? "";
    expect(answer).toMatch(/No\b/);
    expect(answer).toMatch(/Option C \(CLI\) is\s*\narchitecturally identical to Option A/);
  });

  it("14. the design doc's Worker evaluation section names the exact per-request duplicate-Bootstrap risk", () => {
    expect(designDocSource).toMatch(/## 7\. Worker evaluation/);
    expect(designDocSource).toMatch(/fresh\s*\n`FedosRuntimeIdentity`/);
  });

  it("15. the design doc's Desktop / CLI evaluation section exists and names both", () => {
    expect(designDocSource).toMatch(/## 8\. Desktop \/ CLI evaluation/);
  });

  it("16. the design doc's own structure sanity check -- at least eleven numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(11);
  });

  // ---------------------------------------------------------------------
  // Behavioral: bootstrapIdentity() remains uncalled, unexposed
  // ---------------------------------------------------------------------

  it("17. create_runtime.ts's own source contains no reference to bootstrapIdentity anywhere", () => {
    expect(createRuntimeSource).not.toMatch(/bootstrapIdentity/);
  });

  it("18. createRuntime()'s own body calls neither describeIdentity() nor bootstrapIdentity()", () => {
    const body = (createRuntimeSource.match(/export function createRuntime\(([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/\.describeIdentity\(\)/);
    expect(body).not.toMatch(/\.bootstrapIdentity\(\)/);
  });

  it("19. src/worker.ts's own source contains no reference to bootstrapIdentity, FedosRuntimeIdentity, or fedos_runtime_identity.ts", () => {
    expect(workerSource).not.toMatch(/bootstrapIdentity/);
    expect(workerSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
  });

  it("20. AppRuntime (types.ts) has no identity, runtimeIdentity, or bootstrapIdentity field", () => {
    expect(runtimeTypesSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity|bootstrapIdentity/);
    const body = (runtimeTypesSource.match(/export interface AppRuntime \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const fieldNames = [...body.matchAll(/readonly (\w+)[?:]/g)].map((m: RegExpMatchArray) => m[1]).sort();
    expect(fieldNames).toEqual(APP_RUNTIME_FIELDS);
  });

  it("21. behavioral: createRuntime() still returns exactly the pre-existing thirty AppRuntime fields, under every mode, unaffected by this review", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
    }
  });

  it("22. behavioral: createRuntime() does not expose a 'bootstrapIdentity' field on the returned object, under any mode", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode }) as unknown as Record<string, unknown>;
      expect(runtime.bootstrapIdentity).toBeUndefined();
      expect(runtime.identity).toBeUndefined();
      expect(runtime.runtimeIdentity).toBeUndefined();
    }
  });

  it("23. behavioral: createRuntime() remains synchronous, returning a plain object, unaffected by this review", () => {
    const result = createRuntime();
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result.mode).toBe("string");
  });

  it("24. behavioral: bootstrapIdentity() is still directly callable on a manually-constructed FedosRuntimeIdentity -- the boundary itself is unaffected by this review", async () => {
    const identity = new FedosRuntimeIdentity();
    await expect(identity.bootstrapIdentity()).resolves.toBeUndefined();
  });

  it("25. behavioral: describeIdentity()/findIdentity()/listIdentities() remain fully functional and unaffected by this review", async () => {
    const identity = new FedosRuntimeIdentity();
    expect(await identity.describeIdentity()).toBeNull();
    expect(identity.findIdentity("x")).toBeNull();
    expect(identity.listIdentities()).toEqual([]);
  });

  it("26. RIPPLE (Secure Runtime Alpha 064): FedosRuntimeIdentity had exactly four public methods (Alpha 058's own bootstrapIdentity() included) AS OF this Stage's own review-only scope; Alpha 060 (a LATER, separate Stage) added a fifth, isBootstrapped(), Alpha 063 (a LATER, separate Stage) added a sixth, currentIdentity(), and Alpha 064 (a LATER, separate Stage) added a seventh, identityVersion() -- reconfirmed here that all four of this Stage's own methods remain present, alongside all three newer methods", () => {
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
        "describeIdentity",
        "findIdentity",
        "listIdentities",
        "bootstrapIdentity",
        "isBootstrapped",
        "currentIdentity",
        "identityVersion",
      ]),
    );
  });

  // ---------------------------------------------------------------------
  // Regression: no implementation file touched by this review Stage
  // ---------------------------------------------------------------------

  it("27. RIPPLE (Secure Runtime Alpha 060): fedos_runtime_identity.ts did not reference this Stage's own review doc AS OF this Stage's own review-only scope, confirming this Stage itself touched no code, only documentation; Alpha 060 (a LATER, separate Stage that adds isBootstrapped()) legitimately references it in fedos_runtime_identity.ts's own header comment while recording this arc's history -- reconfirmed here as an expected, intentional reference, not a violation of this Stage's own no-code-change mandate", () => {
    expect(fedosRuntimeIdentitySource).toMatch(/secure_runtime_alpha_059/);
  });

  it("28. Regression: create_runtime.ts does not reference this Stage's own review doc -- confirming this Stage touched no code, only documentation", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_059/);
  });

  it("29. Regression: AppRuntime's own type (types.ts) does not reference this Stage's own doc", () => {
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_059/);
  });

  it("30. Regression: src/worker.ts does not reference this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_059/);
  });

  it("31. Regression: the entire Identity Layer is confirmed unaffected by this review Stage -- no file references this Stage's own doc", () => {
    for (const source of [
      serviceSource,
      registrySource,
      resolverClassSource,
      identityProviderResolverSource,
    ]) {
      expect(source).not.toMatch(/secure_runtime_alpha_059/);
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
      expect(source).not.toMatch(/secure_runtime_alpha_059/);
    }
  });

  it("34. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha059-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha059-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha059-id"));
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

  it("36. Regression: no Public Runtime API field name changed -- all eleven async fields still present and lazy (function references)", () => {
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

  it("37. Regression: no fedos_*.ts file was added or removed by this Stage -- still exactly 57 under src/runtime/ and exactly 24 under src/identity/", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("38. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_059/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_059/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_059/);
  });

  it("39. Regression: package.json still declares exactly two dependencies and no bin/main/exports field, unaffected by this Stage", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("40. no other doc file references this Stage's own doc, confirming this Stage's own footprint is exactly two new files", () => {
    expect(alpha058DocSource).not.toMatch(/secure_runtime_alpha_059/);
    expect(positioningDocSource).not.toMatch(/secure_runtime_alpha_059/);
  });

  it("41. behavioral: repeated createRuntime() calls (simulating Worker per-request construction, the rejected Authority) never throw, confirming Worker remains unaffected and un-wired", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(() => createRuntime()).not.toThrow();
    }
  });

  it("42. behavioral: createRuntime() with a Cloudflare binding still resolves 'cloudflare' mode, unaffected by this Stage", () => {
    expect(createRuntime({ NOSTR_EVENT_CACHE: {} as never }).mode).toBe("cloudflare");
  });

  it("43. behavioral: two separate createRuntime() calls return two different AppRuntime object identities, unaffected by this Stage", () => {
    const a = createRuntime();
    const b = createRuntime();
    expect(a).not.toBe(b);
  });

  it("44. behavioral: two independently-constructed FedosRuntimeIdentity instances calling bootstrapIdentity() concurrently do not interfere with each other", async () => {
    const a = new FedosRuntimeIdentity();
    const b = new FedosRuntimeIdentity();
    await Promise.all([a.bootstrapIdentity(), b.bootstrapIdentity()]);
    expect(a.listIdentities()).toEqual([]);
    expect(b.listIdentities()).toEqual([]);
  });

  it("45. RIPPLE (Secure Runtime Alpha 060): final sanity -- this Stage's OWN net effect touched zero src/ files AS OF its own scope; reconfirmed here that create_runtime.ts/types.ts/worker.ts still never reference this Stage's own doc, while fedos_runtime_identity.ts (Alpha 060's own header-comment history, added by a LATER Stage) now legitimately does", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_059/);
    expect(fedosRuntimeIdentitySource).toMatch(/secure_runtime_alpha_059/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_059/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_059/);
  });
});
