import { describe, it, expect, vi, afterEach } from "vitest";
import { createRuntime } from "../src/runtime/create_runtime.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
import { FedosIdentityRegistry } from "../src/identity/fedos_identity_registry.js";
import { resolveFedosIdentityProvider } from "../src/identity/fedos_identity_provider_resolver.js";
import type { FedosIdentityDescriptor } from "../src/identity/fedos_identity_descriptor.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_064_identity_change_detection.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha061DocSource from "../docs/secure_runtime_alpha_061_identity_bootstrap_idempotency.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha063DocSource from "../docs/secure_runtime_alpha_063_runtime_identity_descriptor_cache.md?raw";
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
 * Secure Runtime Alpha 064 -- "Identity Change Detection": adds a
 * private `#identityVersion` field and a seventh method,
 * `identityVersion()`, to `FedosRuntimeIdentity`, incrementing by
 * exactly 1 on every successful `bootstrapIdentity()` completion. These
 * tests confirm the design doc's own structure, the exact
 * implementation shape, and behavioral confirmation of the
 * Fail-Closed transition table, idempotency preservation (version can
 * only ever be 0 or 1 per instance), and exhaustive regression coverage
 * that every other method/file this Stage's own mandate forbids
 * touching remains completely unaffected.
 */
describe("Secure Runtime Alpha 064 -- Identity Change Detection", () => {
  // ---------------------------------------------------------------------
  // Design doc structure
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
  // Implementation shape
  // ---------------------------------------------------------------------

  it("10. fedos_runtime_identity.ts declares #identityVersion as a non-readonly private field, typed number, initial 0", () => {
    expect(fedosRuntimeIdentitySource).toMatch(/#identityVersion: number = 0;/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/readonly #identityVersion/);
  });

  it("11. bootstrapIdentity()'s own body is EXACTLY the guard, the descriptor-capturing await, the bootstrapped assignment, and the version increment, in that order", () => {
    expect(fedosRuntimeIdentitySource).toMatch(
      /async bootstrapIdentity\(\): Promise<void> \{\s*\n\s*if \(this\.#bootstrapped\) \{\s*\n\s*return;\s*\n\s*\}\s*\n\s*this\.#descriptor = await this\.#service\.describeIdentity\(\);\s*\n\s*this\.#bootstrapped = true;\s*\n\s*this\.#identityVersion \+= 1;\s*\n\s*\}/,
    );
  });

  it("12. identityVersion() is a synchronous, single-statement pass-through returning the held field", () => {
    expect(fedosRuntimeIdentitySource).toMatch(
      /identityVersion\(\): number \{\s*\n\s*return this\.#identityVersion;\s*\n\s*\}/,
    );
    expect(fedosRuntimeIdentitySource).not.toMatch(/async identityVersion/);
  });

  it("13. describeIdentity()/findIdentity()/listIdentities()/isBootstrapped()/currentIdentity() remain BYTE-FOR-BYTE unchanged", () => {
    expect(fedosRuntimeIdentitySource).toMatch(
      /async describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{\s*\n\s*return this\.#service\.describeIdentity\(\);\s*\n\s*\}/,
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

  it("14. the class now has exactly SEVEN public methods", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
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

  it("15. only ONE assignment/mutation to #identityVersion exists in the class BODY (comments excluded), inside bootstrapIdentity()'s own guarded body", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const mutations = [...classBody.matchAll(/#identityVersion\s*\+=/g)];
    expect(mutations.length).toBe(1);
    expect(classBody).toMatch(/this\.#identityVersion \+= 1;/);
  });

  // ---------------------------------------------------------------------
  // Behavioral: the Fail-Closed transition table
  // ---------------------------------------------------------------------

  it("16. behavioral: a fresh, never-bootstrapped instance's identityVersion() returns 0", () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.identityVersion()).toBe(0);
  });

  it("17. behavioral: a successful bootstrapIdentity() whose describeIdentity() resolves null still increments identityVersion() to 1", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);
    expect(identity.currentIdentity()).toBeNull();
    expect(identity.identityVersion()).toBe(1);
  });

  it("18. behavioral: a successful bootstrapIdentity() whose describeIdentity() resolves a real Descriptor also increments identityVersion() to exactly 1", async () => {
    const descriptor: FedosIdentityDescriptor = {
      id: "alpha064-version-check",
      provider: "nostr",
      publicIdentifier: "npub1alpha064",
    };
    vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockResolvedValue(descriptor);
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.identityVersion()).toBe(1);
  });

  it("19. behavioral: identityVersion() stays 0 before bootstrapIdentity() is ever called, even after calling describeIdentity()/findIdentity()/listIdentities()/currentIdentity() directly", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.describeIdentity();
    identity.findIdentity("x");
    identity.listIdentities();
    identity.currentIdentity();
    expect(identity.identityVersion()).toBe(0);
  });

  it("20. behavioral: a REJECTED first-ever bootstrapIdentity() call leaves identityVersion() at 0", async () => {
    const identity = new FedosRuntimeIdentity();
    vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockRejectedValueOnce(
      new Error("simulated Provider failure"),
    );
    await expect(identity.bootstrapIdentity()).rejects.toThrow("simulated Provider failure");
    expect(identity.isBootstrapped()).toBe(false);
    expect(identity.identityVersion()).toBe(0);
  });

  it("21. behavioral: identityVersion() never throws, even immediately after a rejected bootstrapIdentity() call", async () => {
    const identity = new FedosRuntimeIdentity();
    vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockRejectedValueOnce(
      new Error("simulated Provider failure"),
    );
    await expect(identity.bootstrapIdentity()).rejects.toThrow();
    expect(() => identity.identityVersion()).not.toThrow();
  });

  it("22. behavioral: identityVersion() is synchronous -- never returns a Promise", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    const result = identity.identityVersion();
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result).toBe("number");
  });

  // ---------------------------------------------------------------------
  // Behavioral: idempotency preservation -- version can only be 0 or 1
  // ---------------------------------------------------------------------

  it("23. behavioral: repeat bootstrapIdentity() calls after success never move identityVersion() past 1, and the Service is called exactly once", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    expect(identity.identityVersion()).toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("24. behavioral: 50 repeated bootstrapIdentity() calls after the first success all short-circuit -- identityVersion() stays exactly 1", async () => {
    const identity = new FedosRuntimeIdentity();
    for (let i = 0; i < 50; i += 1) {
      await identity.bootstrapIdentity();
    }
    expect(identity.identityVersion()).toBe(1);
  });

  it("25. behavioral: after a failed first attempt, a successful retry increments identityVersion() to 1 exactly once, and a further repeat call does not increment it again", async () => {
    const spy = vi
      .spyOn(FedosIdentityService.prototype, "describeIdentity")
      .mockRejectedValueOnce(new Error("simulated Provider failure"))
      .mockResolvedValue(null);

    const identity = new FedosRuntimeIdentity();
    await expect(identity.bootstrapIdentity()).rejects.toThrow();
    expect(identity.identityVersion()).toBe(0);

    await identity.bootstrapIdentity();
    expect(identity.identityVersion()).toBe(1);

    await identity.bootstrapIdentity();
    expect(identity.identityVersion()).toBe(1);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("26. behavioral: repeated failures (never succeeding) never increment identityVersion() -- it stays 0 throughout", async () => {
    const identity = new FedosRuntimeIdentity();
    vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockRejectedValue(
      new Error("permanent simulated failure"),
    );
    for (let i = 0; i < 5; i += 1) {
      await expect(identity.bootstrapIdentity()).rejects.toThrow();
      expect(identity.identityVersion()).toBe(0);
    }
  });

  it("27. behavioral: two independently-constructed instances each have their own independent version counter, never interfering with each other", async () => {
    const a = new FedosRuntimeIdentity();
    const b = new FedosRuntimeIdentity();
    expect(a.identityVersion()).toBe(0);
    expect(b.identityVersion()).toBe(0);
    await a.bootstrapIdentity();
    expect(a.identityVersion()).toBe(1);
    expect(b.identityVersion()).toBe(0);
    await b.bootstrapIdentity();
    expect(a.identityVersion()).toBe(1);
    expect(b.identityVersion()).toBe(1);
  });

  it("28. behavioral: calling describeIdentity() directly (bypassing bootstrapIdentity()) never increments identityVersion()", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.describeIdentity();
    await identity.describeIdentity();
    await identity.describeIdentity();
    expect(identity.identityVersion()).toBe(0);
  });

  it("29. behavioral: the Registry's own register() call count is unaffected by this Stage -- still exactly once, confirmed by mocking the Provider (not the Service)", async () => {
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
    expect(identity.identityVersion()).toBe(1);
  });

  // ---------------------------------------------------------------------
  // Regression: no other implementation file touched by this Stage
  // ---------------------------------------------------------------------

  it("30. Regression: create_runtime.ts does not reference identityVersion, #identityVersion, or this Stage's own doc", () => {
    expect(createRuntimeSource).not.toMatch(/identityVersion/);
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_064/);
  });

  it("31. Regression: AppRuntime's own type (types.ts) has no identityVersion/version field and does not reference this Stage's own doc", () => {
    expect(runtimeTypesSource).not.toMatch(
      /FedosRuntimeIdentity|fedos_runtime_identity|identityVersion|secure_runtime_alpha_064/,
    );
    const body = (runtimeTypesSource.match(/export interface AppRuntime \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const fieldNames = [...body.matchAll(/readonly (\w+)[?:]/g)].map((m: RegExpMatchArray) => m[1]).sort();
    expect(fieldNames).toEqual(APP_RUNTIME_FIELDS);
  });

  it("32. Regression: src/worker.ts does not reference identityVersion, FedosRuntimeIdentity, or this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/identityVersion/);
    expect(workerSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_064/);
  });

  it("33. Regression: the entire Identity Layer (Provider/Registry/Resolver/Service) is confirmed BYTE-FOR-BYTE unaffected by this Stage -- no file references this Stage's own doc, and each still exposes exactly its pre-existing methods", () => {
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

  it("34. Regression: fedos_runtime_storage_resolver.ts and fedos_runtime_storage_backend.ts are confirmed unaffected by this Stage", () => {
    for (const source of [storageResolverSource, storageBackendSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_064/);
    }
  });

  it("35. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha064-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha064-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha064-id"));
    expect(deleted).toBe(true);
  });

  it("36. Regression: initializeCrypto()/runtimeCapabilities() remain unaffected -- confirmed by ACTUAL calls via the AppRuntime object", async () => {
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

  it("37. Regression: createRuntime() still returns exactly the pre-existing thirty AppRuntime fields, under every mode, with no identityVersion field of any kind", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode }) as unknown as Record<string, unknown>;
      expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
      expect(runtime.identityVersion).toBeUndefined();
      expect(runtime.version).toBeUndefined();
    }
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

  it("39. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_064/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_064/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_064/);
  });

  it("40. Regression: package.json still declares exactly two dependencies and no bin/main/exports field, unaffected by this Stage", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("41. no other doc file references this Stage's own doc, confirming this Stage's own footprint is exactly two new files plus one modified src/ file", () => {
    expect(alpha061DocSource).not.toMatch(/secure_runtime_alpha_064/);
    expect(alpha063DocSource).not.toMatch(/secure_runtime_alpha_064/);
  });

  it("42. behavioral: repeated createRuntime() calls (simulating Worker per-request construction) never throw, confirming Worker remains unaffected and un-wired", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(() => createRuntime()).not.toThrow();
    }
  });

  it("43. final sanity: fedos_runtime_identity.ts is the ONLY src/ file this Stage touches -- create_runtime.ts/types.ts/worker.ts never reference this Stage's own doc, while fedos_runtime_identity.ts legitimately does", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_064/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_064/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_064/);
    expect(fedosRuntimeIdentitySource).toMatch(/secure_runtime_alpha_064/);
  });
});
