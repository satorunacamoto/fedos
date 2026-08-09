import { describe, it, expect, vi, afterEach } from "vitest";
import { createRuntime } from "../src/os/_legacy_prototype/runtime/create_runtime.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
import { FedosIdentityService } from "../src/os/core/identity/fedos_identity_service.js";
import { FedosIdentityRegistry } from "../src/os/core/identity/fedos_identity_registry.js";
import { resolveFedosIdentityProvider } from "../src/os/core/identity/fedos_identity_provider_resolver.js";
import type { FedosIdentityDescriptor } from "../src/os/core/identity/fedos_identity_descriptor.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_063_runtime_identity_descriptor_cache.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha061DocSource from "../docs/secure_runtime_alpha_061_identity_bootstrap_idempotency.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha062DocSource from "../docs/secure_runtime_alpha_062_identity_bootstrap_reset_review.md?raw";
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
 * Secure Runtime Alpha 063 -- "Runtime Identity Descriptor Cache": adds
 * a private `#descriptor` field and a sixth method, `currentIdentity()`,
 * to `FedosRuntimeIdentity`, caching the Descriptor from the most
 * recent successful `bootstrapIdentity()` completion. These tests
 * confirm the design doc's own structure, the exact implementation
 * shape, and behavioral confirmation of the null-transition table,
 * idempotency preservation, and Fail-Closed behavior -- plus exhaustive
 * regression coverage that every other method/file this Stage's own
 * mandate forbids touching remains completely unaffected.
 */
describe("Secure Runtime Alpha 063 -- Runtime Identity Descriptor Cache", () => {
  // ---------------------------------------------------------------------
  // Design doc structure
  // ---------------------------------------------------------------------

  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(8000);
  });

  it("2. the design doc names all five Options (A-E) as distinct, labeled alternatives", () => {
    expect(designDocSource).toMatch(/\*\*Option A\*\* — cache the last-resolved Descriptor/);
    expect(designDocSource).toMatch(/\*\*Option B\*\* — no cache: `currentIdentity\(\)`/);
    expect(designDocSource).toMatch(/\*\*Option C\*\* — read through the Registry/);
    expect(designDocSource).toMatch(/\*\*Option D\*\* — read through the Resolver/);
    expect(designDocSource).toMatch(/\*\*Option E\*\* — hold the in-flight `Promise/);
  });

  it("3. the design doc's own comparison table covers every mandated evaluation criterion, with at least fifteen rows", () => {
    const criteria = [
      /同期契約/,
      /throw禁止/,
      /clone禁止/,
      /Data shape/,
      /Idempotency \(Alpha 061 interaction\)/,
      /Fail Closed/,
      /Runtime純粋性/,
      /Protocol非依存/,
      /Storage影響/,
      /Registry影響/,
      /\| Worker \|/,
      /テスト容易性/,
      /責務/,
      /将来Provider/,
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
      /\*\*Option A \(cache the last-resolved Descriptor in a private field\) is\s*\nadopted\.\*\*/,
    );
  });

  it("5. the design doc's own Fail Closed section (§5) contains a null-transition table with at least five rows", () => {
    expect(designDocSource).toMatch(/## 5\. Fail Closed — the null transition table/);
    const section = (designDocSource.match(/## 5\. Fail Closed — the null transition table([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
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
    expect(section).toMatch(/\*\*`isBootstrapped\(\)` unchanged\*\*/);
    expect(section).toMatch(/stays idempotent/);
    expect(section).toMatch(/\*\*`findIdentity\(\)`\/`listIdentities\(\)` unchanged\*\*/);
    expect(section).toMatch(/\*\*Registry unchanged\*\*/);
    expect(section).toMatch(/\*\*Provider unchanged\*\*/);
    expect(section).toMatch(/\*\*Storage unchanged\*\*/);
    expect(section).toMatch(/\*\*`create_runtime\.ts` unchanged\*\*/);
    expect(section).toMatch(/\*\*`AppRuntime` unchanged\*\*/);
    expect(section).toMatch(/\*\*Worker unchanged\*\*/);
    expect(section).toMatch(/\*\*Rust unchanged\*\*/);
  });

  it("8. the design doc cross-references Alpha 061 and Alpha 062", () => {
    expect(designDocSource).toMatch(/secure_runtime_alpha_061_identity_bootstrap_idempotency\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_062_identity_bootstrap_reset_review\.md/);
    expect(alpha061DocSource.length).toBeGreaterThan(0);
    expect(alpha062DocSource.length).toBeGreaterThan(0);
  });

  it("9. the design doc's own structure sanity check -- at least nine numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(9);
  });

  // ---------------------------------------------------------------------
  // Implementation shape
  // ---------------------------------------------------------------------

  it("10. fedos_runtime_identity.ts declares #descriptor as a non-readonly private field, typed FedosIdentityDescriptor | null", () => {
    expect(fedosRuntimeIdentitySource).toMatch(
      /#descriptor: FedosIdentityDescriptor \| null = null;/,
    );
    expect(fedosRuntimeIdentitySource).not.toMatch(/readonly #descriptor/);
  });

  it("11. RIPPLE (Secure Runtime Alpha 076): bootstrapIdentity()'s own body was EXACTLY the guard, the descriptor-capturing await, and the bootstrapped assignment, in that order, AS OF this Stage's own scope; Alpha 064 appended a version-increment as a new final statement, Alpha 066 removed that statement again, Alpha 068 rewired the await to call the new private #describeIdentity() method instead of this.#service directly, Alpha 069 (Identity Bootstrap State Consolidation) split the trailing assignment into a local 'const descriptor' capture followed by a dedicated '#completeBootstrap(descriptor)' call, Alpha 070 (Identity Bootstrap Entry Consolidation) moved this ENTIRE body into a new private #bootstrapIdentity() method, with the PUBLIC bootstrapIdentity() reduced to a pure one-line wrapper, Alpha 072 (Identity Bootstrap State Reader Consolidation) rewrote the guard condition from 'if (this.#bootstrapped)' to 'if (this.#isBootstrapped())', Alpha 074 (Identity Bootstrap Flow Consolidation) rewired the descriptor-capturing call from 'this.#describeIdentity()' to 'this.#performBootstrap()', and Alpha 076 (Identity Bootstrap Observation Boundary) inserted a single '#observeBootstrap(descriptor)' call immediately before the '#completeBootstrap(descriptor)' call -- reconfirmed here that the CURRENT body is still exactly guard/await/observeBootstrap/completeBootstrap, in shape, now inside #bootstrapIdentity()", () => {
    const classBody = (fedosRuntimeIdentitySource.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    expect(classBody).toMatch(
      /async #bootstrapIdentity\(\): Promise<void> \{\s*\n\s*if \(this\.#isBootstrapped\(\)\) \{\s*\n\s*return;\s*\n\s*\}\s*\n\s*const descriptor = await this\.#performBootstrap\(\);\s*\n\s*this\.#observeBootstrap\(descriptor\);\s*\n\s*this\.#completeBootstrap\(descriptor\);\s*\n\s*\}/,
    );
    expect(classBody).toMatch(
      /\n  async bootstrapIdentity\(\): Promise<void> \{\s*\n\s*return this\.#bootstrapIdentity\(\);\s*\n\s*\}/,
    );
  });

  it("12. currentIdentity() is a synchronous, single-statement pass-through returning the held reference", () => {
    expect(fedosRuntimeIdentitySource).toMatch(
      /currentIdentity\(\): FedosIdentityDescriptor \| null \{\s*\n\s*return this\.#descriptor;\s*\n\s*\}/,
    );
    expect(fedosRuntimeIdentitySource).not.toMatch(/async currentIdentity/);
  });

  it("13. RIPPLE (Secure Runtime Alpha 068): describeIdentity()/findIdentity()/listIdentities()/isBootstrapped() remained BYTE-FOR-BYTE unchanged AS OF this Stage's own scope; Alpha 068 renamed describeIdentity() to a private #describeIdentity() with the IDENTICAL body -- reconfirmed here against the CURRENT source", () => {
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
  });

  it("14. RIPPLE (Secure Runtime Alpha 068): the class had exactly SIX PUBLIC methods AS OF this Stage's own scope; Alpha 064 added a seventh, identityVersion(), Alpha 066 removed it again, and Alpha 068 (implementing the Alpha 067 Decision) made describeIdentity() a true private #describeIdentity() method -- reconfirmed here that the class now has exactly FIVE public methods (currentIdentity() this Stage's own method, included), with describeIdentity() excluded from the PUBLIC set but present as a private method", () => {
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

  it("15. RIPPLE (Secure Runtime Alpha 074): only ONE assignment to #descriptor existed in the class BODY (comments excluded) AS OF this Stage's own scope, inside bootstrapIdentity()'s own guarded body; Alpha 068 rewired the capturing call to the new private #describeIdentity() method, Alpha 069 (Identity Bootstrap State Consolidation) moved the #descriptor assignment itself into a new dedicated private method, #completeBootstrap(), Alpha 070 (Identity Bootstrap Entry Consolidation) moved the call site itself into a new private #bootstrapIdentity() method, and Alpha 074 (Identity Bootstrap Flow Consolidation) rewired the descriptor-capturing call from 'this.#describeIdentity()' to 'this.#performBootstrap()' -- reconfirmed here that exactly one assignment to #descriptor still exists in the class body, now inside #completeBootstrap()", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const assignments = [...classBody.matchAll(/#descriptor\s*=/g)];
    expect(assignments.length).toBe(1);
    expect(classBody).toMatch(/this\.#descriptor = descriptor;/);
    const bootstrapBody = (classBody.match(/async #bootstrapIdentity\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(bootstrapBody).not.toMatch(/#descriptor\s*=/);
    expect(bootstrapBody).toMatch(/const descriptor = await this\.#performBootstrap\(\);/);
  });

  // ---------------------------------------------------------------------
  // Behavioral: the null-transition table
  // ---------------------------------------------------------------------

  it("16. behavioral: a fresh, never-bootstrapped instance's currentIdentity() returns null", () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.currentIdentity()).toBeNull();
  });

  it("17. behavioral: a successful bootstrapIdentity() whose describeIdentity() resolves null leaves currentIdentity() at null", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);
    expect(identity.currentIdentity()).toBeNull();
  });

  it("18. RIPPLE (Secure Runtime Alpha 068): currentIdentity() was null before bootstrapIdentity() was ever called, even after calling describeIdentity()/findIdentity()/listIdentities() directly, AS OF this Stage's own scope; Alpha 068 made describeIdentity() private, so it can no longer be called directly at all -- reconfirmed here via the remaining directly-callable reads (findIdentity()/listIdentities())", () => {
    const identity = new FedosRuntimeIdentity();
    identity.findIdentity("x");
    identity.listIdentities();
    expect(identity.currentIdentity()).toBeNull();
    expect(identity.isBootstrapped()).toBe(false);
  });

  it("19. behavioral: a REJECTED first-ever bootstrapIdentity() call leaves currentIdentity() at null", async () => {
    const identity = new FedosRuntimeIdentity();
    vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockRejectedValueOnce(
      new Error("simulated Provider failure"),
    );
    await expect(identity.bootstrapIdentity()).rejects.toThrow("simulated Provider failure");
    expect(identity.isBootstrapped()).toBe(false);
    expect(identity.currentIdentity()).toBeNull();
  });

  it("20. behavioral: a successful bootstrapIdentity() whose describeIdentity() resolves a real Descriptor caches it, returned verbatim (same reference, no clone)", async () => {
    const descriptor: FedosIdentityDescriptor = {
      id: "alpha063-descriptor-check",
      provider: "nostr",
      publicIdentifier: "npub1alpha063",
    };
    vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockResolvedValue(descriptor);

    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBe(descriptor);
  });

  it("21. behavioral: currentIdentity() never throws, even immediately after a rejected bootstrapIdentity() call", async () => {
    const identity = new FedosRuntimeIdentity();
    vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockRejectedValueOnce(
      new Error("simulated Provider failure"),
    );
    await expect(identity.bootstrapIdentity()).rejects.toThrow();
    expect(() => identity.currentIdentity()).not.toThrow();
  });

  it("22. behavioral: currentIdentity() is synchronous -- never returns a Promise", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    const result = identity.currentIdentity();
    expect(result).not.toBeInstanceOf(Promise);
  });

  // ---------------------------------------------------------------------
  // Behavioral: idempotency preservation (Alpha 061 interaction)
  // ---------------------------------------------------------------------

  it("23. behavioral: repeat bootstrapIdentity() calls after success never change an already-cached Descriptor, and the Service is called exactly once", async () => {
    const descriptor: FedosIdentityDescriptor = {
      id: "alpha063-idempotency-check",
      provider: "nostr",
      publicIdentifier: "npub1alpha063idem",
    };
    const spy = vi
      .spyOn(FedosIdentityService.prototype, "describeIdentity")
      .mockResolvedValue(descriptor);

    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(identity.currentIdentity()).toBe(descriptor);
  });

  it("24. behavioral: after a failed first attempt, a successful retry caches the Descriptor, and a further repeat call does not re-invoke the Service", async () => {
    const descriptor: FedosIdentityDescriptor = {
      id: "alpha063-retry-check",
      provider: "nostr",
      publicIdentifier: "npub1alpha063retry",
    };
    const spy = vi
      .spyOn(FedosIdentityService.prototype, "describeIdentity")
      .mockRejectedValueOnce(new Error("simulated Provider failure"))
      .mockResolvedValue(descriptor);

    const identity = new FedosRuntimeIdentity();
    await expect(identity.bootstrapIdentity()).rejects.toThrow();
    expect(identity.currentIdentity()).toBeNull();

    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBe(descriptor);

    await identity.bootstrapIdentity();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(identity.currentIdentity()).toBe(descriptor);
  });

  it("25. behavioral: the Registry's own register() call count is unaffected by this Stage -- still exactly once after repeated Bootstrap calls, confirmed by mocking the Provider (not the Service)", async () => {
    const registerSpy = vi.spyOn(FedosIdentityRegistry.prototype, "register");
    const provider = resolveFedosIdentityProvider();
    vi.spyOn(provider as unknown as { describeIdentity: () => Promise<unknown> }, "describeIdentity").mockResolvedValue({
      id: "alpha063-registry-check",
      provider: "nostr",
      publicIdentifier: "npub1alpha063registry",
    });

    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(identity.currentIdentity()).not.toBeNull();
    expect(identity.findIdentity("alpha063-registry-check")).not.toBeNull();
  });

  it("26. behavioral: two independently-constructed instances each cache their own Descriptor, never interfering with each other", async () => {
    const descriptorA: FedosIdentityDescriptor = {
      id: "alpha063-a",
      provider: "nostr",
      publicIdentifier: "npub1a",
    };
    const descriptorB: FedosIdentityDescriptor = {
      id: "alpha063-b",
      provider: "nostr",
      publicIdentifier: "npub1b",
    };
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    spy.mockResolvedValueOnce(descriptorA).mockResolvedValueOnce(descriptorB);

    const a = new FedosRuntimeIdentity();
    const b = new FedosRuntimeIdentity();
    await a.bootstrapIdentity();
    await b.bootstrapIdentity();

    expect(a.currentIdentity()).toBe(descriptorA);
    expect(b.currentIdentity()).toBe(descriptorB);
  });

  it("27. RIPPLE (Secure Runtime Alpha 068): calling describeIdentity() directly (bypassing bootstrapIdentity()) used to never change currentIdentity()'s own cached value, AS OF this Stage's own scope; Alpha 068 (implementing the Alpha 067 Decision) made describeIdentity() private, closing that bypass entirely -- reconfirmed here that 'describeIdentity' is not an accessible property on the instance, and repeat bootstrapIdentity() calls leave currentIdentity() unchanged", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBeNull();
    expect((identity as unknown as Record<string, unknown>).describeIdentity).toBeUndefined();

    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBeNull();
  });

  // ---------------------------------------------------------------------
  // Regression: no other implementation file touched by this Stage
  // ---------------------------------------------------------------------

  it("28. Regression: create_runtime.ts does not reference currentIdentity, #descriptor, or this Stage's own doc", () => {
    expect(createRuntimeSource).not.toMatch(/currentIdentity/);
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_063/);
  });

  it("29. Regression: AppRuntime's own type (types.ts) has no identity/currentIdentity/descriptor field and does not reference this Stage's own doc", () => {
    expect(runtimeTypesSource).not.toMatch(
      /FedosRuntimeIdentity|fedos_runtime_identity|currentIdentity|secure_runtime_alpha_063/,
    );
    const body = (runtimeTypesSource.match(/export interface AppRuntime \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const fieldNames = [...body.matchAll(/readonly (\w+)[?:]/g)].map((m: RegExpMatchArray) => m[1]).sort();
    expect(fieldNames).toEqual(APP_RUNTIME_FIELDS);
  });

  it("30. Regression: src/worker.ts does not reference currentIdentity, FedosRuntimeIdentity, or this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/currentIdentity/);
    expect(workerSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_063/);
  });

  it("31. Regression: the entire Identity Layer (Provider/Registry/Resolver/Service) is confirmed BYTE-FOR-BYTE unaffected by this Stage -- no file references this Stage's own doc, and Registry/Resolver/Service still expose exactly their pre-existing methods", () => {
    for (const source of [serviceSource, registrySource, resolverClassSource, identityProviderResolverSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_063/);
    }
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).toMatch(/find\(id: string\): FedosIdentityRecord \| null \{/);
    expect(registrySource).toMatch(/list\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(registrySource).toMatch(/remove\(id: string\): boolean \{/);
    expect(resolverClassSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(resolverClassSource).toMatch(/listIdentities\(\): readonly FedosIdentityRecord\[\] \{/);
  });

  it("32. Regression: fedos_runtime_storage_resolver.ts and fedos_runtime_storage_backend.ts are confirmed unaffected by this Stage", () => {
    for (const source of [storageResolverSource, storageBackendSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_063/);
    }
  });

  it("33. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha063-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha063-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha063-id"));
    expect(deleted).toBe(true);
  });

  it("34. Regression: initializeCrypto()/runtimeCapabilities() remain unaffected -- confirmed by ACTUAL calls via the AppRuntime object", async () => {
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

  it("35. Regression: createRuntime() still returns exactly the pre-existing thirty AppRuntime fields, under every mode, with no currentIdentity/descriptor field of any kind", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode }) as unknown as Record<string, unknown>;
      expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
      expect(runtime.currentIdentity).toBeUndefined();
      expect(runtime.identity).toBeUndefined();
      expect(runtime.descriptor).toBeUndefined();
    }
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
    expect(pubFnNames.length).toBe(69);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(21);    expect(libRsSource).not.toMatch(/secure_runtime_alpha_063/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_063/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_063/);
  });

  it("38. Regression: package.json still declares exactly two dependencies and no bin/main/exports field, unaffected by this Stage", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("39. no other doc file references this Stage's own doc, confirming this Stage's own footprint is exactly two new files plus one modified src/ file", () => {
    expect(alpha061DocSource).not.toMatch(/secure_runtime_alpha_063/);
    expect(alpha062DocSource).not.toMatch(/secure_runtime_alpha_063/);
  });

  it("40. behavioral: repeated createRuntime() calls (simulating Worker per-request construction) never throw, confirming Worker remains unaffected and un-wired", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(() => createRuntime()).not.toThrow();
    }
  });

  it("41. final sanity: fedos_runtime_identity.ts is the ONLY src/ file this Stage touches -- create_runtime.ts/types.ts/worker.ts never reference this Stage's own doc, while fedos_runtime_identity.ts legitimately does", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_063/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_063/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_063/);
    expect(fedosRuntimeIdentitySource).toMatch(/secure_runtime_alpha_063/);
  });
});
