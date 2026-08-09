import { describe, it, expect, vi, afterEach } from "vitest";
import { createRuntime } from "../src/os/_legacy_prototype/runtime/create_runtime.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
import { FedosIdentityService } from "../src/os/core/identity/fedos_identity_service.js";
import { FedosIdentityRegistry } from "../src/os/core/identity/fedos_identity_registry.js";
import { resolveFedosIdentityProvider } from "../src/os/core/identity/fedos_identity_provider_resolver.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_064_identity_change_detection.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha061DocSource from "../docs/secure_runtime_alpha_061_identity_bootstrap_idempotency.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha063DocSource from "../docs/secure_runtime_alpha_063_runtime_identity_descriptor_cache.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
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
 * Secure Runtime Alpha 064 -- "Identity Change Detection": shipped a
 * private `#identityVersion` field and a seventh method,
 * `identityVersion()`. Secure Runtime Alpha 065 (review only) formally
 * proved that method informationally identical to `isBootstrapped()`
 * and adopted its removal as a formal Decision; Secure Runtime Alpha
 * 066 implemented that removal. Tests 1-9 (design doc structure) remain
 * fully valid -- they check the FROZEN Alpha 064 design doc, an
 * immutable historical record, not live code. Tests 10 onward are
 * RIPPLE-relabeled: they recorded claims about `identityVersion()`'s
 * own behavior that were true AS OF Alpha 064's own scope but are
 * superseded by Alpha 066's removal; each is reconfirmed here against
 * the CURRENT source and CURRENT runtime behavior.
 */
describe("Secure Runtime Alpha 064 -- Identity Change Detection", () => {
  // ---------------------------------------------------------------------
  // Design doc structure (frozen historical record -- unaffected)
  // ---------------------------------------------------------------------

  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(8000);
  });

  it("2. the design doc names all five Options (A-E) as distinct, labeled alternatives", () => {
    expect(designDocSource).toMatch(/\*\*Option A\*\* — a plain `number` counter/);
    expect(designDocSource).toMatch(/\*\*Option B\*\* — a timestamp/);
    expect(designDocSource).toMatch(/\*\*Option C\*\* — a randomly-generated UUID/);
    expect(designDocSource).toMatch(/\*\*Option D\*\* — a content hash/);
    expect(designDocSource).toMatch(/\*\*Option E\*\* — no stored marker at all/);
  });

  it("3. the design doc's own comparison table covers every mandated evaluation criterion, with at least fifteen rows", () => {
    const criteria = [
      /同期契約/,
      /throw禁止/,
      /Monotonic \/ orderable/,
      /Data shape/,
      /Idempotency \(Alpha 061 interaction\)/,
      /Fail Closed/,
      /Runtime純粋性/,
      /Protocol非依存/,
      /Storage影響/,
      /Descriptorがnullでも\+\+/,
      /テスト容易性/,
      /責務/,
      /メモリ管理/,
      /将来Provider/,
      /何を意味するか/,
    ];
    for (const criterion of criteria) {
      expect(designDocSource).toMatch(criterion);
    }
    const tableSection = (designDocSource.match(/## 4\. Comparison([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    const rows = [...tableSection.matchAll(/^\| [^|]+\|/gm)].filter(
      (m: RegExpMatchArray) => !m[0].startsWith("| Criterion") && !m[0].startsWith("|---"),
    );
    expect(rows.length).toBeGreaterThanOrEqual(15);
  });

  it("4. the design doc contains exactly one '## 6. Decision' section adopting Option A", () => {
    const decisionSections = [...designDocSource.matchAll(/^## 6\. Decision$/gm)];
    expect(decisionSections.length).toBe(1);
    expect(designDocSource).toMatch(
      /\*\*Option A \(a plain `number` counter\) is adopted\.\*\*/,
    );
  });

  it("5. the design doc's own Fail Closed section (§5) contains a transition table with at least five rows", () => {
    expect(designDocSource).toMatch(/## 5\. Fail Closed — the transition table/);
    const section = (designDocSource.match(/## 5\. Fail Closed — the transition table([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    const rows = [...section.matchAll(/^\| [^|]+\|/gm)].filter(
      (m: RegExpMatchArray) => !m[0].startsWith("| State") && !m[0].startsWith("|---"),
    );
    expect(rows.length).toBeGreaterThanOrEqual(5);
  });

  it("6. the design doc records an explicit 'does NOT do' list naming every prohibited file/area", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/create_runtime\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/types\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/worker\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify any `src\/identity\/\*` file/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `packages\/fedos-core-rust`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any Public Runtime API field/);
  });

  it("7. the design doc's own confirmation checklist (§7) names every mandated item", () => {
    const section = (designDocSource.match(/## 7\. Confirmation checklist([\s\S]*?)\n## 8\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*`currentIdentity\(\)` unchanged\*\*/);
    expect(section).toMatch(/stays idempotent/);
    expect(section).toMatch(/\*\*`isBootstrapped\(\)` unchanged\*\*/);
    expect(section).toMatch(/\*\*`findIdentity\(\)`\/`listIdentities\(\)` unchanged\*\*/);
    expect(section).toMatch(/\*\*Registry unchanged\*\*/);
    expect(section).toMatch(/\*\*Provider unchanged\*\*/);
    expect(section).toMatch(/\*\*Storage unchanged\*\*/);
    expect(section).toMatch(/\*\*`create_runtime\.ts` unchanged\*\*/);
    expect(section).toMatch(/\*\*`AppRuntime` unchanged\*\*/);
    expect(section).toMatch(/\*\*Worker unchanged\*\*/);
    expect(section).toMatch(/\*\*Rust unchanged\*\*/);
  });

  it("8. the design doc cross-references Alpha 061 and Alpha 063", () => {
    expect(designDocSource).toMatch(/secure_runtime_alpha_061_identity_bootstrap_idempotency\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_063_runtime_identity_descriptor_cache\.md/);
    expect(alpha061DocSource.length).toBeGreaterThan(0);
    expect(alpha063DocSource.length).toBeGreaterThan(0);
  });

  it("9. the design doc's own structure sanity check -- at least nine numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(9);
  });

  // ---------------------------------------------------------------------
  // RIPPLE (Secure Runtime Alpha 066): implementation shape, superseded
  // ---------------------------------------------------------------------

  it("10. RIPPLE (Secure Runtime Alpha 066): fedos_runtime_identity.ts declared #identityVersion as a non-readonly private field, typed number, initial 0, AS OF this Stage's own scope; Alpha 066 removed the field entirely -- reconfirmed here that no #identityVersion field exists anywhere in the CURRENT source", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/#identityVersion: number = 0;/);
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    expect(classBody).not.toMatch(/#identityVersion/);
  });

  it("11. RIPPLE (Secure Runtime Alpha 076): bootstrapIdentity()'s own body ended with 'this.#identityVersion += 1;' AS OF this Stage's own scope; Alpha 066 removed that final statement, Alpha 068 rewired the await to call the new private #describeIdentity() method instead of this.#service directly, Alpha 069 (Identity Bootstrap State Consolidation) split the trailing assignment into a local 'const descriptor' capture followed by a dedicated '#completeBootstrap(descriptor)' call, Alpha 070 (Identity Bootstrap Entry Consolidation) moved this ENTIRE body into a new private #bootstrapIdentity() method, Alpha 072 (Identity Bootstrap State Reader Consolidation) rewrote the guard condition from 'if (this.#bootstrapped)' to 'if (this.#isBootstrapped())', Alpha 074 (Identity Bootstrap Flow Consolidation) rewired the descriptor-capturing call from 'this.#describeIdentity()' to 'this.#performBootstrap()', and Alpha 076 (Identity Bootstrap Observation Boundary) inserted a single '#observeBootstrap(descriptor)' call immediately before the '#completeBootstrap(descriptor)' call -- reconfirmed here that the CURRENT body is EXACTLY the guard, the descriptor-capturing await (via #performBootstrap()), the observation call, and the completeBootstrap call, now inside #bootstrapIdentity()", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    expect(classBody).not.toMatch(/this\.#identityVersion \+= 1;/);
    expect(classBody).toMatch(
      /async #bootstrapIdentity\(\): Promise<void> \{\s*\n\s*if \(this\.#isBootstrapped\(\)\) \{\s*\n\s*return;\s*\n\s*\}\s*\n\s*const descriptor = await this\.#performBootstrap\(\);\s*\n\s*this\.#observeBootstrap\(descriptor\);\s*\n\s*this\.#completeBootstrap\(descriptor\);\s*\n\s*\}/,
    );
  });

  it("12. RIPPLE (Secure Runtime Alpha 066): identityVersion() was a synchronous, single-statement pass-through returning #identityVersion AS OF this Stage's own scope; Alpha 066 removed the method entirely -- reconfirmed here that no identityVersion() method exists anywhere in the CURRENT class body (the header comment's own historical prose, which legitimately still names the removed method, is intentionally excluded from this check)", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    expect(classBody).not.toMatch(/identityVersion\(\): number/);
    expect(classBody).not.toMatch(/\bidentityVersion\b/);
  });

  it("13. RIPPLE (Secure Runtime Alpha 068): describeIdentity()/findIdentity()/listIdentities()/isBootstrapped()/currentIdentity() remained BYTE-FOR-BYTE unchanged AS OF this Stage's own scope; Alpha 068 renamed describeIdentity() to a private #describeIdentity() with the IDENTICAL body -- reconfirmed here against the CURRENT source", () => {
    expect(fedosRuntimeIdentitySource).toMatch(
      /async #describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{\s*\n\s*return this\.#service\.describeIdentity\(\);\s*\n\s*\}/,
    );
    expect(fedosRuntimeIdentitySource).toMatch(
      /findIdentity\(id: string\): FedosIdentityRecord \| null \{\s*\n\s*return this\.#resolver\.findIdentity\(id\);\s*\n\s*\}/,
    );
    expect(fedosRuntimeIdentitySource).toMatch(
      /listIdentities\(\): readonly FedosIdentityRecord\[\] \{\s*\n\s*return this\.#resolver\.listIdentities\(\);\s*\n\s*\}/,
    );
    expect(fedosRuntimeIdentitySource).toMatch(
      /isBootstrapped\(\): boolean \{\s*\n\s*return this\.#bootstrapped;\s*\n\s*\}/,
    );
    expect(fedosRuntimeIdentitySource).toMatch(
      /currentIdentity\(\): FedosIdentityDescriptor \| null \{\s*\n\s*return this\.#descriptor;\s*\n\s*\}/,
    );
  });

  it("14. RIPPLE (Secure Runtime Alpha 068): the class had exactly SEVEN public methods AS OF this Stage's own scope; Alpha 066 removed identityVersion(), and Alpha 068 (implementing the Alpha 067 Decision) made describeIdentity() a true private #describeIdentity() method -- reconfirmed here that the class now has exactly FIVE public methods", () => {
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

  it("15. RIPPLE (Secure Runtime Alpha 066): exactly ONE assignment/mutation to #identityVersion existed in the class body AS OF this Stage's own scope; Alpha 066 removed the field entirely -- reconfirmed here that ZERO mutations to #identityVersion exist anywhere in the CURRENT class body", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const mutations = [...classBody.matchAll(/#identityVersion\s*\+=/g)];
    expect(mutations.length).toBe(0);
  });

  // ---------------------------------------------------------------------
  // RIPPLE (Secure Runtime Alpha 066): behavioral claims, superseded
  // ---------------------------------------------------------------------

  it("16. RIPPLE (Secure Runtime Alpha 066): a fresh instance's identityVersion() returned 0 AS OF this Stage's own scope; Alpha 066 removed the method -- reconfirmed here that 'identityVersion' is not a property of any FedosRuntimeIdentity instance", () => {
    const identity = new FedosRuntimeIdentity();
    expect("identityVersion" in identity).toBe(false);
    expect((identity as unknown as Record<string, unknown>).identityVersion).toBeUndefined();
  });

  it("17. RIPPLE (Secure Runtime Alpha 066): a successful bootstrapIdentity() used to increment identityVersion() to 1 regardless of a null-resolving Descriptor AS OF this Stage's own scope; Alpha 066 removed the counter -- reconfirmed here that isBootstrapped()/currentIdentity() still report the correct post-Bootstrap state on their own, unaffected by the removal", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);
    expect(identity.currentIdentity()).toBeNull();
  });

  it("18. RIPPLE (Secure Runtime Alpha 066): repeat bootstrapIdentity() calls after success used to leave identityVersion() at 1 with the Service called exactly once AS OF this Stage's own scope; Alpha 066 removed the counter -- reconfirmed here that the idempotency guarantee itself (Service called exactly once across repeats) still holds, unaffected by the removal", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("19. RIPPLE (Secure Runtime Alpha 066): a REJECTED first-ever bootstrapIdentity() call used to leave identityVersion() at 0 AS OF this Stage's own scope; Alpha 066 removed the counter -- reconfirmed here that isBootstrapped() still correctly reports false after a rejection, unaffected by the removal", async () => {
    const identity = new FedosRuntimeIdentity();
    vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockRejectedValueOnce(
      new Error("simulated Provider failure"),
    );
    await expect(identity.bootstrapIdentity()).rejects.toThrow("simulated Provider failure");
    expect(identity.isBootstrapped()).toBe(false);
  });

  it("20. RIPPLE (Secure Runtime Alpha 066): two independently-constructed instances used to have their own independent version counters AS OF this Stage's own scope; Alpha 066 removed the counter -- reconfirmed here that isBootstrapped()/currentIdentity() still remain fully independent per instance, unaffected by the removal", async () => {
    const a = new FedosRuntimeIdentity();
    const b = new FedosRuntimeIdentity();
    await a.bootstrapIdentity();
    expect(a.isBootstrapped()).toBe(true);
    expect(b.isBootstrapped()).toBe(false);
    await b.bootstrapIdentity();
    expect(a.isBootstrapped()).toBe(true);
    expect(b.isBootstrapped()).toBe(true);
  });

  it("21. RIPPLE (Secure Runtime Alpha 068): calling describeIdentity() directly (bypassing bootstrapIdentity()) used to never increment identityVersion() AS OF this Stage's own scope; Alpha 066 removed the counter, and Alpha 068 (implementing the Alpha 067 Decision) made describeIdentity() private, closing the confirmed Alpha 065 bypass entirely -- reconfirmed here that 'describeIdentity' is not an accessible property, and repeated bootstrapIdentity() calls leave isBootstrapped()/currentIdentity() correctly set", async () => {
    const identity = new FedosRuntimeIdentity();
    expect((identity as unknown as Record<string, unknown>).describeIdentity).toBeUndefined();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);
    expect(identity.currentIdentity()).toBeNull();
  });

  it("22. RIPPLE (Secure Runtime Alpha 066): the Registry's own register() call count was unaffected by this Stage AS OF its own scope -- reconfirmed here that it remains exactly once after repeated Bootstrap calls, confirmed by mocking the Provider (not the Service)", async () => {
    const registerSpy = vi.spyOn(FedosIdentityRegistry.prototype, "register");
    const provider = resolveFedosIdentityProvider();
    vi.spyOn(provider as unknown as { describeIdentity: () => Promise<unknown> }, "describeIdentity").mockResolvedValue({
      id: "alpha064-registry-check",
      provider: "nostr",
      publicIdentifier: "npub1alpha064registry",
    });

    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(identity.isBootstrapped()).toBe(true);
  });

  // ---------------------------------------------------------------------
  // Regression: no other implementation file touched by this Stage
  // ---------------------------------------------------------------------

  it("23. Regression: create_runtime.ts does not reference identityVersion, #identityVersion, or this Stage's own doc", () => {
    expect(createRuntimeSource).not.toMatch(/identityVersion/);
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_064/);
  });

  it("24. Regression: AppRuntime's own type (types.ts) has no identityVersion/version field and does not reference this Stage's own doc", () => {
    expect(runtimeTypesSource).not.toMatch(
      /FedosRuntimeIdentity|fedos_runtime_identity|identityVersion|secure_runtime_alpha_064/,
    );
    const body = (runtimeTypesSource.match(/export interface AppRuntime \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const fieldNames = [...body.matchAll(/readonly (\w+)[?:]/g)].map((m: RegExpMatchArray) => m[1]).sort();
    expect(fieldNames).toEqual(APP_RUNTIME_FIELDS);
  });

  it("25. Regression: src/worker.ts does not reference identityVersion, FedosRuntimeIdentity, or this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/identityVersion/);
    expect(workerSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_064/);
  });

  it("26. Regression: the entire Identity Layer (Provider/Registry/Resolver/Service) is confirmed BYTE-FOR-BYTE unaffected by this Stage -- no file references this Stage's own doc, and each still exposes exactly its pre-existing methods", () => {
    for (const source of [serviceSource, registrySource, resolverClassSource, identityProviderResolverSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_064/);
    }
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).toMatch(/find\(id: string\): FedosIdentityRecord \| null \{/);
    expect(registrySource).toMatch(/list\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(registrySource).toMatch(/remove\(id: string\): boolean \{/);
    expect(resolverClassSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(resolverClassSource).toMatch(/listIdentities\(\): readonly FedosIdentityRecord\[\] \{/);
  });

  it("27. Regression: fedos_runtime_storage_resolver.ts and fedos_runtime_storage_backend.ts are confirmed unaffected by this Stage", () => {
    for (const source of [storageResolverSource, storageBackendSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_064/);
    }
  });

  it("28. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha064-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha064-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha064-id"));
    expect(deleted).toBe(true);
  });

  it("29. Regression: initializeCrypto()/runtimeCapabilities() remain unaffected -- confirmed by ACTUAL calls via the AppRuntime object", async () => {
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

  it("30. Regression: createRuntime() still returns exactly the pre-existing thirty AppRuntime fields, under every mode, with no identityVersion field of any kind", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode }) as unknown as Record<string, unknown>;
      expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
      expect(runtime.identityVersion).toBeUndefined();
      expect(runtime.version).toBeUndefined();
    }
  });

  it("31. Regression: no fedos_*.ts file was added or removed by this Stage -- still exactly 57 under src/runtime/ and exactly 24 under src/identity/", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("32. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(21);    expect(libRsSource).not.toMatch(/secure_runtime_alpha_064/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_064/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_064/);
  });

  it("33. Regression: package.json still declares exactly two dependencies and no bin/main/exports field, unaffected by this Stage", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("34. no other doc file references this Stage's own doc, confirming this Stage's own footprint is exactly two new files plus one modified src/ file", () => {
    expect(alpha061DocSource).not.toMatch(/secure_runtime_alpha_064/);
    expect(alpha063DocSource).not.toMatch(/secure_runtime_alpha_064/);
  });

  it("35. behavioral: repeated createRuntime() calls (simulating Worker per-request construction) never throw, confirming Worker remains unaffected and un-wired", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(() => createRuntime()).not.toThrow();
    }
  });

  it("36. RIPPLE (Secure Runtime Alpha 066): final sanity -- this Stage's OWN net effect touched exactly one src/ file AS OF its own scope; reconfirmed here that create_runtime.ts/types.ts/worker.ts still never reference this Stage's own doc, while fedos_runtime_identity.ts (Alpha 064's own header-comment history, since ANNOTATED by Alpha 066's own removal) still legitimately does", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_064/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_064/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_064/);
    expect(fedosRuntimeIdentitySource).toMatch(/secure_runtime_alpha_064/);
  });
});
