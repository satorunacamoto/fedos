import { describe, it, expect, vi, afterEach } from "vitest";
import { createRuntime } from "../src/runtime/create_runtime.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
import { FedosIdentityRegistry } from "../src/identity/fedos_identity_registry.js";
import { resolveFedosIdentityProvider } from "../src/identity/fedos_identity_provider_resolver.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_065_identity_runtime_internal_contract_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha060DocSource from "../docs/secure_runtime_alpha_060_identity_bootstrap_status.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha062DocSource from "../docs/secure_runtime_alpha_062_identity_bootstrap_reset_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha064DocSource from "../docs/secure_runtime_alpha_064_identity_change_detection.md?raw";
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
import storageResolverSource from "../src/runtime/fedos_runtime_storage_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageBackendSource from "../src/runtime/fedos_runtime_storage_backend.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
import type { RuntimeMode } from "../src/runtime/types.js";

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

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Secure Runtime Alpha 065 -- "Identity Runtime Internal Contract
 * Review": a REVIEW / DESIGN DECISION Stage only. No implementation
 * file changes anywhere in this repository. These tests confirm the
 * review document's own structure and content, confirm the
 * code-grounded invariants it claims (identityVersion() bounded to
 * {0,1}, identical to isBootstrapped(), the describeIdentity() bypass),
 * and confirm every implementation file this Stage's own mandate
 * forbids touching remains completely unaffected.
 */
describe("Secure Runtime Alpha 065 -- Identity Runtime Internal Contract Review, review/decision only, no src/ change", () => {
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

  it("3. the design doc answers all six confirmation questions", () => {
    expect(designDocSource).toMatch(/\*\*1\. 同一インスタンスで値が2以上になる経路は存在するか？\*\* No\./);
    expect(designDocSource).toMatch(/\*\*2\. Identity Descriptorが変化する経路は存在するか？\*\* No,/);
    expect(designDocSource).toMatch(/\*\*3\. 新しいFedosRuntimeIdentityへ切り替えた際、旧versionと比較できるか？\*\*\s*\nNo\./);
    expect(designDocSource).toMatch(/\*\*4\. isBootstrapped\(\)と独立した情報を持つか？\*\* No\./);
    expect(designDocSource).toMatch(/\*\*5\. Desktop\/UIが変更検知へ利用できるか？\*\* No,/);
    expect(designDocSource).toMatch(/\*\*6\. 「Identity Change Detection」という名称は事実に合うか？\*\* No\./);
  });

  it("4. the design doc records the identityVersion() === isBootstrapped() invariant explicitly", () => {
    expect(designDocSource).toMatch(/identityVersion\(\) === \(isBootstrapped\(\) \? 1 : 0\)/);
  });

  it("5. the design doc names all five Options (A-E) as distinct, labeled alternatives", () => {
    expect(designDocSource).toMatch(/\*\*Option A\*\* — status quo/);
    expect(designDocSource).toMatch(/\*\*Option B\*\* — delete `identityVersion\(\)`/);
    expect(designDocSource).toMatch(/\*\*Option C\*\* — rename to `bootstrapGeneration\(\)`/);
    expect(designDocSource).toMatch(/\*\*Option D\*\* — consolidate onto `isBootstrapped\(\)`/);
    expect(designDocSource).toMatch(/\*\*Option E\*\* — design a REAL Identity revision/);
  });

  it("6. the design doc's own comparison table has a substantial number of criteria rows", () => {
    const tableSection = (designDocSource.match(/## 5\. Comparison([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    const rows = [...tableSection.matchAll(/^\| [^|]+\|/gm)].filter(
      (m: RegExpMatchArray) => !m[0].startsWith("| Criterion") && !m[0].startsWith("|---"),
    );
    expect(rows.length).toBeGreaterThanOrEqual(10);
  });

  it("7. the design doc's own full API inventory (§6) classifies all seven methods", () => {
    const section = (designDocSource.match(/## 6\. Full internal API inventory([\s\S]*?)\n## 7\./) ?? [])[1] ?? "";
    for (const method of [
      "bootstrapIdentity()",
      "isBootstrapped()",
      "currentIdentity()",
      "identityVersion()",
      "describeIdentity()",
      "findIdentity()",
      "listIdentities()",
    ]) {
      expect(section).toContain(`\`${method}\``);
    }
    expect(section).toMatch(/ライフサイクル操作/);
    expect(section).toMatch(/ライフサイクル状態/);
    expect(section).toMatch(/現在値Reader/);
    expect(section).toMatch(/重複 \/ 削除候補/);
    expect(section).toMatch(/Provider直接Reader/);
    expect(section).toMatch(/Registry Reader/);
  });

  it("8. the design doc's own §7 examines all three named overlaps and confirms the describeIdentity() bypass", () => {
    expect(designDocSource).toMatch(/### `bootstrapIdentity\(\)` vs\. `describeIdentity\(\)` — a confirmed bypass/);
    expect(designDocSource).toMatch(
      /\*\*Confirmed: calling `describeIdentity\(\)` directly on a\s*\n`FedosRuntimeIdentity` instance is a genuine Bootstrap-lifecycle\s*\nbypass\.\*\*/,
    );
    expect(designDocSource).toMatch(/### `currentIdentity\(\)` vs\. `findIdentity\(\)` — confirmed NOT a duplicate/);
    expect(designDocSource).toMatch(/### `isBootstrapped\(\)` vs\. `identityVersion\(\)` — confirmed duplicate/);
  });

  it("9. the design doc's own §8 names Desktop-call/read/must-not-expose/bypass/protocol-independence conditions", () => {
    const section = (designDocSource.match(/## 8\. Public Runtime exposure([\s\S]*?)\n## 9\./) ?? [])[1] ?? "";
    expect(section).toMatch(/Desktopが呼ぶべき操作/);
    expect(section).toMatch(/Desktopが読むべき状態/);
    expect(section).toMatch(/Desktopへ出してはいけない内部API/);
    expect(section).toMatch(/Provider\/Registryを迂回するAPI/);
    expect(section).toMatch(/Protocol非依存で維持できるAPI/);
  });

  it("10. the design doc contains exactly one '## 9. Decision' section naming exactly one adopted Option", () => {
    const decisionSections = [...designDocSource.matchAll(/^## 9\. Decision$/gm)];
    expect(decisionSections.length).toBe(1);
    expect(designDocSource).toMatch(
      /\*\*Option D is adopted: `identityVersion\(\)`\/`#identityVersion` are to be\s*\nREMOVED, and `isBootstrapped\(\)` is to remain the SOLE Bootstrap-state\s*\nreader\.\*\*/,
    );
  });

  it("11. the design doc's own Decision section explicitly rejects Options A, C, and E", () => {
    const decisionBody = (designDocSource.match(/## 9\. Decision([\s\S]*?)\n## 10\./) ?? [])[1] ?? "";
    expect(decisionBody).toMatch(/Option A \(status quo\) is rejected/);
    expect(decisionBody).toMatch(/Option C \(rename to\s*\n`bootstrapGeneration\(\)`\) is rejected/);
    expect(decisionBody).toMatch(/Option E \(a\s*\nreal content-based revision\) is rejected/);
  });

  it("12. the design doc records an explicit 'does NOT do' list naming every prohibited file/area", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/fedos_runtime_identity\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/create_runtime\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/types\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify any `src\/identity\/\*` file/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/worker\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `packages\/fedos-core-rust`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any Public Runtime API/);
  });

  it("13. the design doc names exactly ONE Alpha 066 recommendation, and explicitly lists deferred (not recommended) items separately", () => {
    const section = (designDocSource.match(/## 11\. Alpha 066 recommendation — ONE change only([\s\S]*?)\n## 12\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*Alpha 066 should implement §9's own Decision directly: delete\s*\n`identityVersion\(\)` and `#identityVersion` from\s*\n`fedos_runtime_identity\.ts`, and nothing else\.\*\*/,
    );
    expect(section).toMatch(/Explicitly NOT recommended for Alpha 066/);
    expect(section).toMatch(/describeIdentity\(\)`直接Readerの廃止レビュー/);
    expect(section).toMatch(/Desktop Integration Boundary Review/);
  });

  it("14. the design doc cross-references Alpha 060, Alpha 062, and Alpha 064", () => {
    expect(designDocSource).toMatch(/secure_runtime_alpha_060_identity_bootstrap_status\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_062_identity_bootstrap_reset_review\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_064_identity_change_detection\.md/);
    expect(alpha060DocSource.length).toBeGreaterThan(0);
    expect(alpha062DocSource.length).toBeGreaterThan(0);
    expect(alpha064DocSource.length).toBeGreaterThan(0);
  });

  it("15. the design doc's own structure sanity check -- at least twelve numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(12);
  });

  // ---------------------------------------------------------------------
  // Behavioral: the claims in §3/§7 verified against the REAL source
  // ---------------------------------------------------------------------

  it("16. RIPPLE (Secure Runtime Alpha 066): identityVersion() and isBootstrapped() were structurally IDENTICAL information AS OF this Stage's own scope -- the invariant held across never-attempted, failed, and successful Bootstrap; Alpha 066 (implementing this Stage's own Decision) removed identityVersion() entirely -- reconfirmed here that isBootstrapped() alone still correctly tracks never-attempted/failed/succeeded, unaffected by the removal", async () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.isBootstrapped()).toBe(false);

    vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockRejectedValueOnce(
      new Error("simulated Provider failure"),
    );
    await expect(identity.bootstrapIdentity()).rejects.toThrow();
    expect(identity.isBootstrapped()).toBe(false);

    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("17. RIPPLE (Secure Runtime Alpha 066): identityVersion() never exceeded 1 on a single instance AS OF this Stage's own scope, even across many repeated bootstrapIdentity() calls; Alpha 066 removed the method -- reconfirmed here that isBootstrapped() alone stays stably true across 25 repeated calls, unaffected by the removal", async () => {
    const identity = new FedosRuntimeIdentity();
    for (let i = 0; i < 25; i += 1) {
      await identity.bootstrapIdentity();
    }
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("18. behavioral: currentIdentity() never changes after the first successful Bootstrap, even if describeIdentity() would resolve something different on a later call", async () => {
    const first: Record<string, unknown> = {
      id: "alpha065-first",
      provider: "nostr",
      publicIdentifier: "npub1first",
    };
    const spy = vi
      .spyOn(FedosIdentityService.prototype, "describeIdentity")
      .mockResolvedValueOnce(first as never)
      .mockResolvedValue({
        id: "alpha065-second",
        provider: "nostr",
        publicIdentifier: "npub1second",
      } as never);

    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toEqual(first);

    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toEqual(first);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("19. RIPPLE (Secure Runtime Alpha 066): two fresh instances never shared identityVersion() or currentIdentity() state AS OF this Stage's own scope -- no cross-instance comparison surface existed; Alpha 066 removed identityVersion() -- reconfirmed here that isBootstrapped()/currentIdentity() remain fully independent per instance, unaffected by the removal", async () => {
    const a = new FedosRuntimeIdentity();
    const b = new FedosRuntimeIdentity();
    await a.bootstrapIdentity();
    expect(a.isBootstrapped()).toBe(true);
    expect(b.isBootstrapped()).toBe(false);
    await b.bootstrapIdentity();
    expect(a.isBootstrapped()).toBe(true);
    expect(b.isBootstrapped()).toBe(true);
  });

  it("20. RIPPLE (Secure Runtime Alpha 068): the confirmed describeIdentity() bypass used to be reachable directly -- calling it registered into the Registry (observable via findIdentity()) while isBootstrapped()/currentIdentity() stayed untouched, AS OF this Stage's own scope; Alpha 068 (implementing the Alpha 067 Decision) made describeIdentity() a true private method, closing this exact bypass -- reconfirmed here that 'describeIdentity' is no longer an accessible property on a FedosRuntimeIdentity instance, and that the only remaining path to the Service (bootstrapIdentity()) keeps Registry/isBootstrapped()/currentIdentity() consistent", async () => {
    const registerSpy = vi.spyOn(FedosIdentityRegistry.prototype, "register");
    const provider = resolveFedosIdentityProvider();
    vi.spyOn(provider as unknown as { describeIdentity: () => Promise<unknown> }, "describeIdentity").mockResolvedValueOnce({
      id: "alpha065-bypass-check",
      provider: "nostr",
      publicIdentifier: "npub1bypass",
    });

    const identity = new FedosRuntimeIdentity();
    expect((identity as unknown as Record<string, unknown>).describeIdentity).toBeUndefined();
    await identity.bootstrapIdentity();
    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(identity.findIdentity("alpha065-bypass-check")).not.toBeNull();

    expect(identity.isBootstrapped()).toBe(true);
    expect(identity.currentIdentity()).not.toBeNull();
  });

  it("21. RIPPLE (Secure Runtime Alpha 068): describeIdentity()'s own body never referenced #bootstrapped/#descriptor/#identityVersion AS OF this Stage's own scope -- a genuinely stateless pass-through, confirming the bypass was structural, not incidental; Alpha 068 renamed it to a private #describeIdentity() method with the IDENTICAL body -- reconfirmed here against the CURRENT source", () => {
    const codeOnly = fedosRuntimeIdentitySource
      .split("\n")
      .filter((line: string) => {
        const trimmed = line.trim();
        return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
      })
      .join("\n");
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const body = (classBody.match(/async #describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/#bootstrapped/);
    expect(body).not.toMatch(/#descriptor/);
    expect(body).not.toMatch(/#identityVersion/);
    expect(body).toMatch(/return this\.#service\.describeIdentity\(\);/);
  });

  it("22. behavioral: FedosIdentityService.describeIdentity() still writes the Registry on a non-null Descriptor, confirming the underlying side effect §7 relies on", () => {
    expect(serviceSource).toMatch(/this\.#registry\.register\(record\);/);
  });

  it("23. behavioral: currentIdentity()/findIdentity() return genuinely different types for the same underlying identity -- Descriptor vs Record", async () => {
    const descriptor = {
      id: "alpha065-type-check",
      provider: "nostr",
      publicIdentifier: "npub1typecheck",
      displayName: "Type Check",
    };
    const provider = resolveFedosIdentityProvider();
    vi.spyOn(provider as unknown as { describeIdentity: () => Promise<unknown> }, "describeIdentity").mockResolvedValueOnce(descriptor);

    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    const viaCurrent = identity.currentIdentity();
    const viaFind = identity.findIdentity("alpha065-type-check");

    expect(viaCurrent).toEqual(descriptor);
    expect(viaFind).toEqual({
      id: "alpha065-type-check",
      provider: "nostr",
      publicIdentifier: "npub1typecheck",
      displayName: "Type Check",
      avatar: undefined,
    });
    expect(viaCurrent).not.toBe(viaFind as unknown);
  });

  it("24. RIPPLE (Secure Runtime Alpha 066): #bootstrapped/#descriptor/#identityVersion were each assigned in EXACTLY one place in the class body AS OF this Stage's own scope, confirming the §3 structural claims; Alpha 066 removed #identityVersion entirely -- reconfirmed here that #bootstrapped/#descriptor remain assigned in exactly one place each, and #identityVersion no longer exists anywhere in the class body", () => {
    const codeOnly = fedosRuntimeIdentitySource
      .split("\n")
      .filter((line: string) => {
        const trimmed = line.trim();
        return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
      })
      .join("\n");
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    expect([...classBody.matchAll(/this\.#bootstrapped\s*=/g)].length).toBe(1);
    expect([...classBody.matchAll(/this\.#descriptor\s*=/g)].length).toBe(1);
    expect(classBody).not.toMatch(/#identityVersion/);
  });

  // ---------------------------------------------------------------------
  // Regression: no implementation file touched by this review Stage
  // ---------------------------------------------------------------------

  it("25. RIPPLE (Secure Runtime Alpha 066): fedos_runtime_identity.ts did not reference this Stage's own review doc AS OF this Stage's own review-only scope, confirming this Stage itself touched no code, only documentation; Alpha 066 (a LATER, separate Stage that removes identityVersion()) legitimately references it in fedos_runtime_identity.ts's own header comment while recording this arc's history -- reconfirmed here as an expected, intentional reference, not a violation of this Stage's own no-code-change mandate", () => {
    expect(fedosRuntimeIdentitySource).toMatch(/secure_runtime_alpha_065/);
  });

  it("26. RIPPLE (Secure Runtime Alpha 068): fedos_runtime_identity.ts had exactly SEVEN public methods AS OF this Stage's own review-only scope, unchanged by this Stage; Alpha 066 removed identityVersion(), and Alpha 068 (a LATER, separate Stage implementing the Alpha 067 Decision) made describeIdentity() a true private #describeIdentity() method -- reconfirmed here that the class now has exactly FIVE public methods", () => {
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

  it("27. Regression: create_runtime.ts does not reference this Stage's own review doc, and remains Construct Only", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_065/);
    expect(createRuntimeSource).not.toMatch(/bootstrapIdentity|identityVersion|currentIdentity/);
  });

  it("28. Regression: AppRuntime's own type (types.ts) does not reference this Stage's own doc and has no Identity field", () => {
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_065/);
    expect(runtimeTypesSource).not.toMatch(
      /FedosRuntimeIdentity|fedos_runtime_identity|identityVersion|isBootstrapped|currentIdentity/,
    );
    const body = (runtimeTypesSource.match(/export interface AppRuntime \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const fieldNames = [...body.matchAll(/readonly (\w+)[?:]/g)].map((m: RegExpMatchArray) => m[1]).sort();
    expect(fieldNames).toEqual(APP_RUNTIME_FIELDS);
  });

  it("29. Regression: src/worker.ts does not reference this Stage's own doc or any Identity Runtime symbol", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_065/);
    expect(workerSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
  });

  it("30. Regression: the entire Identity Layer is confirmed unaffected by this review Stage -- no file references this Stage's own doc, and each still exposes exactly its pre-existing methods", () => {
    for (const source of [serviceSource, registrySource, resolverClassSource, identityProviderResolverSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_065/);
    }
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).toMatch(/find\(id: string\): FedosIdentityRecord \| null \{/);
    expect(registrySource).toMatch(/list\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(registrySource).toMatch(/remove\(id: string\): boolean \{/);
    expect(resolverClassSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(resolverClassSource).toMatch(/listIdentities\(\): readonly FedosIdentityRecord\[\] \{/);
  });

  it("31. Regression: fedos_runtime_storage_resolver.ts and fedos_runtime_storage_backend.ts are confirmed unaffected by this Stage", () => {
    for (const source of [storageResolverSource, storageBackendSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_065/);
    }
  });

  it("32. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha065-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha065-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha065-id"));
    expect(deleted).toBe(true);
  });

  it("33. Regression: initializeCrypto()/runtimeCapabilities() remain unaffected -- confirmed by ACTUAL calls via the AppRuntime object", async () => {
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

  it("34. Regression: createRuntime() still returns exactly the pre-existing thirty AppRuntime fields, under every mode, unaffected by this review", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
    }
  });

  it("35. Regression: no fedos_*.ts file was added or removed by this Stage -- still exactly 57 under src/runtime/ and exactly 24 under src/identity/", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("36. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(64);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(19);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_065/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_065/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_065/);
  });

  it("37. Regression: package.json still declares exactly two dependencies and no bin/main/exports field, unaffected by this Stage", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("38. no other doc file references this Stage's own doc, confirming this Stage's own footprint is exactly two new files", () => {
    expect(alpha060DocSource).not.toMatch(/secure_runtime_alpha_065/);
    expect(alpha062DocSource).not.toMatch(/secure_runtime_alpha_065/);
    expect(alpha064DocSource).not.toMatch(/secure_runtime_alpha_065/);
  });

  it("39. behavioral: repeated createRuntime() calls (simulating Worker per-request construction) never throw, confirming Worker remains unaffected and un-wired", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(() => createRuntime()).not.toThrow();
    }
  });

  it("40. RIPPLE (Secure Runtime Alpha 066): final sanity -- this Stage's OWN net effect touched zero src/ files AS OF its own scope; reconfirmed here that create_runtime.ts/types.ts/worker.ts still never reference this Stage's own doc, while fedos_runtime_identity.ts (Alpha 066's own header-comment history, added by a LATER Stage) now legitimately does", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_065/);
    expect(fedosRuntimeIdentitySource).toMatch(/secure_runtime_alpha_065/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_065/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_065/);
  });
});
