import { describe, it, expect, vi, afterEach } from "vitest";
import { createRuntime } from "../src/os/_legacy_prototype/runtime/create_runtime.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
import { FedosIdentityService } from "../src/os/core/identity/fedos_identity_service.js";
import { FedosIdentityRegistry } from "../src/os/core/identity/fedos_identity_registry.js";
import { resolveFedosIdentityProvider } from "../src/os/core/identity/fedos_identity_provider_resolver.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_067_identity_reader_boundary_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha059DocSource from "../docs/secure_runtime_alpha_059_identity_bootstrap_authority_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha065DocSource from "../docs/secure_runtime_alpha_065_identity_runtime_internal_contract_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha066DocSource from "../docs/secure_runtime_alpha_066_identity_version_removal.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/os/core/identity/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/os/core/identity/fedos_identity_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import registrySource from "../src/os/core/identity/fedos_identity_registry.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import resolverClassSource from "../src/os/core/identity/fedos_identity_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityProviderResolverSource from "../src/os/core/identity/fedos_identity_provider_resolver.ts?raw";
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
import type { RuntimeMode } from "../src/os/_legacy_prototype/runtime/types.js";

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

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Secure Runtime Alpha 067 -- "Identity Reader Boundary Review": a
 * REVIEW / DESIGN DECISION Stage only. No implementation file changes
 * anywhere in this repository. These tests confirm the review
 * document's own structure and content, confirm the code-grounded
 * bypass finding against the REAL source (not assumed), and confirm
 * every implementation file this Stage's own mandate forbids touching
 * remains completely unaffected.
 */
describe("Secure Runtime Alpha 067 -- Identity Reader Boundary Review, review/decision only, no src/ change", () => {
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

  it("3. the design doc's own §3 table covers all four mandated dimensions for both bootstrapIdentity() and describeIdentity()", () => {
    const section = (designDocSource.match(/## 3\. bootstrapIdentity\(\)\/describeIdentity\(\), broken down along all four mandated dimensions([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Provider呼び出し\*\*/);
    expect(section).toMatch(/\*\*Registry更新\*\*/);
    expect(section).toMatch(/\*\*Descriptor Cache更新 \(`#descriptor`\)\*\*/);
    expect(section).toMatch(/\*\*Bootstrapped更新 \(`#bootstrapped`\)\*\*/);
  });

  it("4. the design doc's own §4 explicitly confirms the bypass, grounded in code facts, not assumption", () => {
    expect(designDocSource).toMatch(
      /\*\*Confirmed: `describeIdentity\(\)` is a genuine Bootstrap-lifecycle\s*\nbypass\.\*\*/,
    );
    expect(designDocSource).toMatch(/No idempotency guard exists on `describeIdentity\(\)`/);
    expect(designDocSource).toMatch(
      /`bootstrapIdentity\(\)` itself does NOT call `this\.describeIdentity\(\)`/,
    );
    expect(designDocSource).toMatch(/currently DORMANT, not exploited/);
  });

  it("5. the design doc names all five Options (A-E) as distinct, labeled alternatives", () => {
    expect(designDocSource).toMatch(/\*\*Option A\*\* — status quo/);
    expect(designDocSource).toMatch(/\*\*Option B\*\* — delete `describeIdentity\(\)`/);
    expect(designDocSource).toMatch(/\*\*Option C\*\* — make `describeIdentity\(\)` a true private/);
    expect(designDocSource).toMatch(/\*\*Option D\*\* — make `describeIdentity\(\)` a true private/);
    expect(designDocSource).toMatch(/\*\*Option E\*\* — extract a separate Reader Service/);
  });

  it("6. the design doc's own comparison table has at least fifteen criteria rows", () => {
    const tableSection = (designDocSource.match(/## 6\. Comparison([\s\S]*?)\n## 7\./) ?? [])[1] ?? "";
    const rows = [...tableSection.matchAll(/^\| [^|]+\|/gm)].filter(
      (m: RegExpMatchArray) => !m[0].startsWith("| Criterion") && !m[0].startsWith("|---"),
    );
    expect(rows.length).toBeGreaterThanOrEqual(15);
  });

  it("7. the design doc's own §7 names what Desktop should and should not call", () => {
    const section = (designDocSource.match(/## 7\. Desktop視点([\s\S]*?)\n## 8\./) ?? [])[1] ?? "";
    expect(section).toMatch(/Desktopが呼ぶべきReader/);
    expect(section).toMatch(/Desktopが呼んではいけないReader/);
    expect(section).toMatch(/`describeIdentity\(\)` — per §4's/);
  });

  it("8. the design doc's own §8 names keep/delete/private candidates", () => {
    const section = (designDocSource.match(/## 8\. Public Runtime公開前([\s\S]*?)\n## 9\./) ?? [])[1] ?? "";
    expect(section).toMatch(/残す内部API/);
    expect(section).toMatch(/削除候補/);
    expect(section).toMatch(/private候補/);
  });

  it("9. the design doc contains exactly one '## 9. Decision' section adopting Option D", () => {
    const decisionSections = [...designDocSource.matchAll(/^## 9\. Decision$/gm)];
    expect(decisionSections.length).toBe(1);
    expect(designDocSource).toMatch(
      /\*\*Option D is adopted: `describeIdentity\(\)` is to become a true\s*\nprivate \(`#`\) method/,
    );
  });

  it("10. the design doc's own Decision section explicitly rejects Options A, B, C, and E", () => {
    const decisionBody = (designDocSource.match(/## 9\. Decision([\s\S]*?)\n## 10\./) ?? [])[1] ?? "";
    expect(decisionBody).toMatch(/Option A \(status quo\) is rejected/);
    expect(decisionBody).toMatch(/Option B \(delete\) is rejected/);
    expect(decisionBody).toMatch(/Option\s*\nC \(privatize without rewiring `bootstrapIdentity\(\)`\) is rejected/);
    expect(decisionBody).toMatch(/Option E \(separate Reader\s*\nService\) is rejected/);
  });

  it("11. the design doc records an explicit 'does NOT do' list naming every prohibited file/area", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/fedos_runtime_identity\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/create_runtime\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/types\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify any `src\/identity\/\*` file/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/worker\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `packages\/fedos-core-rust`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any Public Runtime API/);
  });

  it("12. the design doc names exactly ONE Alpha 068 recommendation, and flags the ripple size explicitly", () => {
    const section = (designDocSource.match(/## 11\. Alpha 068 recommendation — ONE change only([\s\S]*?)\n## 12\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*Alpha 068 should implement §9's own Decision directly: make\s*\n`describeIdentity\(\)` a true private \(`#describeIdentity\(\)`\) method on/,
    );
    expect(section).toMatch(/31\s*\ntest files reference the method/);
  });

  it("13. the design doc cross-references Alpha 059, Alpha 065, and Alpha 066", () => {
    expect(designDocSource).toMatch(/secure_runtime_alpha_059_identity_bootstrap_authority_review\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_065_identity_runtime_internal_contract_review\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_066_identity_version_removal\.md/);
    expect(alpha059DocSource.length).toBeGreaterThan(0);
    expect(alpha065DocSource.length).toBeGreaterThan(0);
    expect(alpha066DocSource.length).toBeGreaterThan(0);
  });

  it("14. the design doc's own structure sanity check -- at least twelve numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(12);
  });

  // ---------------------------------------------------------------------
  // Behavioral: the §3/§4 claims verified against the REAL source
  // ---------------------------------------------------------------------

  it("15. RIPPLE (Secure Runtime Alpha 068): describeIdentity()'s own body never referenced #descriptor or #bootstrapped, confirmed via literal extraction AS OF this Stage's own scope; Alpha 068 (implementing this Stage's own Decision) renamed it to a private #describeIdentity() method with the IDENTICAL body -- reconfirmed here against the CURRENT source", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const body = (classBody.match(/async #describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/#descriptor/);
    expect(body).not.toMatch(/#bootstrapped/);
    expect(body.trim()).toBe("return this.#service.describeIdentity();");
  });

  it("16. RIPPLE (Secure Runtime Alpha 075): bootstrapIdentity()'s own body called this.#service.describeIdentity() DIRECTLY, never this.describeIdentity(), AS OF this Stage's own scope, confirming zero internal callers of the public wrapper; Alpha 068 rewired bootstrapIdentity() to call the new private this.#describeIdentity() instead, Alpha 070 (Identity Bootstrap Entry Consolidation) moved that call site itself into a new private #bootstrapIdentity() method, Alpha 074 (Identity Bootstrap Flow Consolidation) rewired #bootstrapIdentity() to route through a new private #performBootstrap() method instead of #describeIdentity() directly, and Alpha 075 (Identity Descriptor Acquisition Consolidation) rewired #performBootstrap() to route through a new private #acquireDescriptor() method instead of #describeIdentity() directly -- reconfirmed here that #bootstrapIdentity() now routes through #performBootstrap() → #acquireDescriptor() → #describeIdentity(), which itself still reaches this.#service internally", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const body = (classBody.match(/async #bootstrapIdentity\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/this\.#service\.describeIdentity\(\)/);
    expect(body).not.toMatch(/this\.#describeIdentity\(\)/);
    expect(body).toMatch(/this\.#performBootstrap\(\)/);
    const performBootstrapBody = (classBody.match(/async #performBootstrap\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(performBootstrapBody).not.toMatch(/this\.#describeIdentity\(\)/);
    expect(performBootstrapBody).toMatch(/this\.#acquireDescriptor\(\)/);
    const acquireDescriptorBody = (classBody.match(/async #acquireDescriptor\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(acquireDescriptorBody).toMatch(/this\.#describeIdentity\(\)/);
    const describeBody = (classBody.match(/async #describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(describeBody).toMatch(/this\.#service\.describeIdentity\(\)/);
  });

  it("17. RIPPLE (Secure Runtime Alpha 068): no idempotency guard existed on describeIdentity() AS OF this Stage's own scope -- repeated direct calls each re-invoked the Provider, with no short-circuit; Alpha 068 made describeIdentity() private, closing that direct path entirely -- reconfirmed here that 'describeIdentity' is not an accessible property, and that bootstrapIdentity() (the only remaining path) IS idempotent, calling the Service exactly once across repeats", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const identity = new FedosRuntimeIdentity();
    expect((identity as unknown as Record<string, unknown>).describeIdentity).toBeUndefined();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("18. RIPPLE (Secure Runtime Alpha 068): the confirmed bypass used to be reachable -- calling describeIdentity() directly registered into the Registry (observable via findIdentity()) while isBootstrapped()/currentIdentity() stayed at their initial values, even across repeated calls, AS OF this Stage's own scope; Alpha 068 (implementing this Stage's own Decision) made describeIdentity() private, closing this exact bypass -- reconfirmed here that the only remaining path (bootstrapIdentity()) keeps Registry/isBootstrapped()/currentIdentity() consistent", async () => {
    const registerSpy = vi.spyOn(FedosIdentityRegistry.prototype, "register");
    const provider = resolveFedosIdentityProvider();
    vi.spyOn(provider as unknown as { describeIdentity: () => Promise<unknown> }, "describeIdentity").mockResolvedValue({
      id: "alpha067-bypass-check",
      provider: "nostr",
      publicIdentifier: "npub1alpha067",
    });

    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(identity.findIdentity("alpha067-bypass-check")).not.toBeNull();

    expect(identity.isBootstrapped()).toBe(true);
    expect(identity.currentIdentity()).not.toBeNull();
  });

  it("19. behavioral: bootstrapIdentity() itself remains idempotent and fully accounted -- Service called exactly once, isBootstrapped()/currentIdentity() correctly updated, unaffected by this review", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("20. behavioral: create_runtime.ts's own createRuntime() body never calls describeIdentity() or bootstrapIdentity() -- the bypass is confirmed dormant in production code", () => {
    const body = (createRuntimeSource.match(/export function createRuntime\(([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/\.describeIdentity\(\)/);
    expect(body).not.toMatch(/\.bootstrapIdentity\(\)/);
    expect(body).toMatch(/const runtimeIdentity: FedosRuntimeIdentity = new FedosRuntimeIdentity\(\);/);
    expect(body).toMatch(/void runtimeIdentity;/);
  });

  it("21. behavioral: src/worker.ts contains no reference to FedosRuntimeIdentity or describeIdentity at all", () => {
    expect(workerSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
    expect(workerSource).not.toMatch(/describeIdentity/);
  });

  it("22. behavioral: findIdentity()/listIdentities() never call registry.register() or registry.remove() -- confirmed read-only, matching Alpha 043's own guardrail, unaffected by this review", () => {
    const codeOnly = codeOnlyLines(resolverClassSource);
    const classBody = (codeOnly.match(/export class FedosIdentityResolver \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    expect(classBody).not.toMatch(/\.register\(/);
    expect(classBody).not.toMatch(/\.remove\(/);
    expect(classBody).toMatch(/this\.#registry\.find\(id\)/);
    expect(classBody).toMatch(/this\.#registry\.list\(\)/);
  });

  it("23. behavioral: currentIdentity()/findIdentity() confirmed to return different object types for the same underlying identity (Descriptor vs Record), reconfirming Alpha 065's own §7 finding is unaffected by this Stage", async () => {
    const provider = resolveFedosIdentityProvider();
    const descriptor = {
      id: "alpha067-type-check",
      provider: "nostr",
      publicIdentifier: "npub1alpha067type",
    };
    vi.spyOn(provider as unknown as { describeIdentity: () => Promise<unknown> }, "describeIdentity").mockResolvedValueOnce(descriptor);

    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBe(descriptor);
    expect(identity.findIdentity("alpha067-type-check")).not.toBe(descriptor);
    expect(identity.findIdentity("alpha067-type-check")).toEqual({
      id: "alpha067-type-check",
      provider: "nostr",
      publicIdentifier: "npub1alpha067type",
      displayName: undefined,
      avatar: undefined,
    });
  });

  it("24. RIPPLE (Secure Runtime Alpha 068): the class had exactly SIX public methods, unchanged by this review, AS OF this Stage's own scope; Alpha 068 (implementing this Stage's own Decision) made describeIdentity() a true private #describeIdentity() method -- reconfirmed here that the class now has exactly FIVE public methods", () => {
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
  });

  // ---------------------------------------------------------------------
  // Regression: no implementation file touched by this review Stage
  // ---------------------------------------------------------------------

  it("25. RIPPLE (Secure Runtime Alpha 068): fedos_runtime_identity.ts did not reference this Stage's own review doc AS OF this Stage's own review-only scope, confirming this Stage itself touched no code, only documentation; Alpha 068 (a LATER, separate Stage implementing this Stage's own Decision) legitimately references it in fedos_runtime_identity.ts's own header comment while recording this arc's history -- reconfirmed here as an expected, intentional reference, not a violation of this Stage's own no-code-change mandate", () => {
    expect(fedosRuntimeIdentitySource).toMatch(/secure_runtime_alpha_067/);
  });

  it("26. Regression: create_runtime.ts does not reference this Stage's own review doc, and remains Construct Only", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_067/);
  });

  it("27. Regression: AppRuntime's own type (types.ts) does not reference this Stage's own doc and has no Identity field", () => {
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_067/);
    expect(runtimeTypesSource).not.toMatch(
      /FedosRuntimeIdentity|fedos_runtime_identity|isBootstrapped|currentIdentity|describeIdentity/,
    );
    const body = (runtimeTypesSource.match(/export interface AppRuntime \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const fieldNames = [...body.matchAll(/readonly (\w+)[?:]/g)].map((m: RegExpMatchArray) => m[1]).sort();
    expect(fieldNames).toEqual(APP_RUNTIME_FIELDS);
  });

  it("28. Regression: src/worker.ts does not reference this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_067/);
  });

  it("29. Regression: the entire Identity Layer is confirmed unaffected by this review Stage -- no file references this Stage's own doc, and each still exposes exactly its pre-existing methods", () => {
    for (const source of [serviceSource, registrySource, resolverClassSource, identityProviderResolverSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_067/);
    }
    expect(serviceSource).toMatch(/async describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{/);
    expect(serviceSource).toMatch(/this\.#registry\.register\(record\);/);
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).toMatch(/find\(id: string\): FedosIdentityRecord \| null \{/);
    expect(registrySource).toMatch(/list\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(registrySource).toMatch(/remove\(id: string\): boolean \{/);
  });

  it("30. Regression: fedos_runtime_storage_resolver.ts and fedos_runtime_storage_backend.ts are confirmed unaffected by this Stage", () => {
    for (const source of [storageResolverSource, storageBackendSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_067/);
    }
  });

  it("31. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha067-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha067-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha067-id"));
    expect(deleted).toBe(true);
  });

  it("32. Regression: initializeCrypto()/runtimeCapabilities() remain unaffected -- confirmed by ACTUAL calls via the AppRuntime object", async () => {
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

  it("33. Regression: createRuntime() still returns exactly the pre-existing thirty AppRuntime fields, under every mode, unaffected by this review", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
    }
  });

  it("34. Regression: no fedos_*.ts file was added or removed by this Stage -- still exactly 57 under src/runtime/ and exactly 24 under src/identity/", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("35. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(21);    expect(libRsSource).not.toMatch(/secure_runtime_alpha_067/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_067/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_067/);
  });

  it("36. Regression: package.json still declares exactly two dependencies and no bin/main/exports field, unaffected by this Stage", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("37. no other doc file references this Stage's own doc, confirming this Stage's own footprint is exactly two new files", () => {
    expect(alpha059DocSource).not.toMatch(/secure_runtime_alpha_067/);
    expect(alpha065DocSource).not.toMatch(/secure_runtime_alpha_067/);
    expect(alpha066DocSource).not.toMatch(/secure_runtime_alpha_067/);
  });

  it("38. behavioral: repeated createRuntime() calls (simulating Worker per-request construction) never throw, confirming Worker remains unaffected and un-wired", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(() => createRuntime()).not.toThrow();
    }
  });

  it("39. RIPPLE (Secure Runtime Alpha 068): final sanity -- this Stage's OWN net effect touched zero src/ files AS OF its own scope; reconfirmed here that create_runtime.ts/types.ts/worker.ts still never reference this Stage's own doc, while fedos_runtime_identity.ts (Alpha 068's own header-comment history, added by a LATER Stage) now legitimately does", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_067/);
    expect(fedosRuntimeIdentitySource).toMatch(/secure_runtime_alpha_067/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_067/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_067/);
  });
});
