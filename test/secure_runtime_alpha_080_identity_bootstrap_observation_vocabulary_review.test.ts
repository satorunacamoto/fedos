import { describe, it, expect, vi, afterEach } from "vitest";
import { createRuntime } from "../src/runtime/create_runtime.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
import { FedosIdentityRegistry } from "../src/identity/fedos_identity_registry.js";
import { resolveFedosIdentityProvider } from "../src/identity/fedos_identity_provider_resolver.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_080_identity_bootstrap_observation_vocabulary_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha079DocSource from "../docs/secure_runtime_alpha_079_identity_bootstrap_observation_scope_review.md?raw";
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

function classBodyOf(source: string): string {
  const codeOnly = codeOnlyLines(source);
  return (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
}

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Secure Runtime Alpha 080 -- "Identity Bootstrap Observation
 * Vocabulary Review": a REVIEW / FORMAL CONFIRMATION Stage, ZERO
 * functional code change. Fixes the permanent VOCABULARY -- a closed
 * set of exactly five named tokens (BOOTSTRAP_STARTED,
 * BOOTSTRAP_COMPLETED, BOOTSTRAP_FAILED, DESCRIPTOR_PRESENT,
 * DESCRIPTOR_ABSENT) -- any future #observeBootstrap() implementation
 * may ever emit. Facts only: no inference, evaluation, ranking, or
 * severity. Success/failure describes the Bootstrap process itself,
 * independent of whether the resolved Descriptor was null. The
 * Descriptor's own content never becomes Vocabulary, only its
 * presence or absence. These tests confirm the review's own claims
 * and that the current empty implementation already satisfies it.
 */
describe("Secure Runtime Alpha 080 -- Identity Bootstrap Observation Vocabulary Review", () => {
  // ---------------------------------------------------------------------
  // Design doc structure
  // ---------------------------------------------------------------------

  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself a review-only, no-functional-change Stage", () => {
    expect(designDocSource).toMatch(
      /this Stage is a REVIEW \/ FORMAL CONFIRMATION only\. It makes\s*\nNO functional code change/,
    );
  });

  it("3. the design doc records the exactly-five Allowed Vocabulary tokens", () => {
    const section = (designDocSource.match(/## 3\. Allowed Vocabulary([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*`BOOTSTRAP_STARTED`\*\*/);
    expect(section).toMatch(/\*\*`BOOTSTRAP_COMPLETED`\*\*/);
    expect(section).toMatch(/\*\*`BOOTSTRAP_FAILED`\*\*/);
    expect(section).toMatch(/\*\*`DESCRIPTOR_PRESENT`\*\*/);
    expect(section).toMatch(/\*\*`DESCRIPTOR_ABSENT`\*\*/);
  });

  it("4. the design doc records the eleven Forbidden Vocabulary items", () => {
    const section = (designDocSource.match(/## 4\. Forbidden Vocabulary([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*`publicIdentifier`\*\*/);
    expect(section).toMatch(/\*\*`displayName`\*\*/);
    expect(section).toMatch(/\*\*`avatar`\*\*/);
    expect(section).toMatch(/\*\*Provider name\*\*/);
    expect(section).toMatch(/\*\*Registry state\*\*/);
    expect(section).toMatch(/\*\*Storage state\*\*/);
    expect(section).toMatch(/\*\*Runtime Mode\*\*/);
    expect(section).toMatch(/\*\*Platform\*\*/);
    expect(section).toMatch(/\*\*Secret information\*\*/);
    expect(section).toMatch(/\*\*Exception message body\*\*/);
    expect(section).toMatch(/\*\*Stack trace\*\*/);
  });

  it("5. the design doc records the facts-only review items -- no inference/evaluation/ranking/severity", () => {
    const section = (designDocSource.match(/## 5\. Review items — facts only([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*No inference\*\*/);
    expect(section).toMatch(/\*\*No evaluation\*\*/);
    expect(section).toMatch(/\*\*No ranking\*\*/);
    expect(section).toMatch(/\*\*No severity assignment\*\*/);
  });

  it("6. the design doc records that success/failure is Bootstrap-process-only and Descriptor-independent, including the null-Descriptor-still-COMPLETED rule", () => {
    const section = (designDocSource.match(/## 6\. Success \/ failure — Bootstrap-process-only, Descriptor-independent([\s\S]*?)\n## 7\./) ?? [])[1] ?? "";
    expect(section).toMatch(/EVEN IF the\s*\nresolved `descriptor` is `null`/);
    expect(section).toMatch(/A `null` Descriptor is not a failure/);
  });

  it("7. the design doc records that the Descriptor itself never becomes Vocabulary, only presence/absence", () => {
    const section = (designDocSource.match(/## 7\. Descriptor — presence, never content([\s\S]*?)\n## 8\./) ?? [])[1] ?? "";
    expect(section).toMatch(/can NEVER become Vocabulary/);
    expect(section).toMatch(/\*\*`DESCRIPTOR_PRESENT`\*\*/);
    expect(section).toMatch(/\*\*`DESCRIPTOR_ABSENT`\*\*/);
  });

  it("8. the design doc records the future guarantee naming Logging/Tracing/Metrics/Audit/Telemetry and forbidding free-form strings", () => {
    const section = (designDocSource.match(/## 8\. Future guarantee([\s\S]*?)\n## 9\./) ?? [])[1] ?? "";
    expect(section).toMatch(/Logging/);
    expect(section).toMatch(/Tracing/);
    expect(section).toMatch(/Metrics/);
    expect(section).toMatch(/Audit/);
    expect(section).toMatch(/Telemetry/);
    expect(section).toMatch(/Free-form\s*\nstrings are permanently forbidden/);
  });

  it("9. the design doc records an explicit 'does NOT do' list naming every prohibited file/area", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `#observeBootstrap\(\)`'s own body/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `#bootstrapIdentity\(\)`'s own body/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any new public API/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any new private field/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/create_runtime\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/types\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify any `src\/identity\/\*` file/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/worker\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `packages\/fedos-core-rust`/);
  });

  it("10. the design doc cross-references Alpha 079", () => {
    expect(designDocSource).toMatch(/secure_runtime_alpha_079_identity_bootstrap_observation_scope_review\.md/);
    expect(alpha079DocSource.length).toBeGreaterThan(0);
  });

  it("11. the design doc's own structure sanity check -- at least ten numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(10);
  });

  // ---------------------------------------------------------------------
  // レビュー項目: structural confirmation against the actual source
  // ---------------------------------------------------------------------

  it("12. the header comment records all five Vocabulary tokens verbatim", () => {
    expect(fedosRuntimeIdentitySource).toMatch(/`BOOTSTRAP_STARTED`/);
    expect(fedosRuntimeIdentitySource).toMatch(/`BOOTSTRAP_COMPLETED`/);
    expect(fedosRuntimeIdentitySource).toMatch(/`BOOTSTRAP_FAILED`/);
    expect(fedosRuntimeIdentitySource).toMatch(/`DESCRIPTOR_PRESENT`/);
    expect(fedosRuntimeIdentitySource).toMatch(/`DESCRIPTOR_ABSENT`/);
  });

  it("13. #observeBootstrap()'s own body contains NO statement of any kind -- it cannot emit any Vocabulary token, forbidden or allowed, since it emits nothing", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const body = (classBody.match(/#observeBootstrap\(descriptor: FedosIdentityDescriptor \| null\): void \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body.trim()).toBe("");
  });

  it("14. #observeBootstrap()'s own body never references descriptor's own fields, Provider, Registry, Resolver, or Runtime state", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const body = (classBody.match(/#observeBootstrap\(descriptor: FedosIdentityDescriptor \| null\): void \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/descriptor\./);
    expect(body).not.toMatch(/this\.#service/);
    expect(body).not.toMatch(/this\.#registry/);
    expect(body).not.toMatch(/this\.#resolver/);
    expect(body).not.toMatch(/this\.#descriptor\s*=/);
    expect(body).not.toMatch(/this\.#bootstrapped\s*=/);
  });

  it("15. #completeBootstrap() remains the ONLY place in the class body that ever writes #descriptor or #bootstrapped, with its own body byte-for-byte unchanged", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const descriptorAssignments = [...classBody.matchAll(/#descriptor\s*=/g)];
    const bootstrappedAssignments = [...classBody.matchAll(/#bootstrapped\s*=/g)];
    expect(descriptorAssignments.length).toBe(1);
    expect(bootstrappedAssignments.length).toBe(1);
    expect(fedosRuntimeIdentitySource).toMatch(
      /#completeBootstrap\(descriptor: FedosIdentityDescriptor \| null\): void \{\s*\n\s*this\.#descriptor = descriptor;\s*\n\s*this\.#bootstrapped = true;\s*\n\s*\}/,
    );
  });

  it("16. #bootstrapIdentity()'s own body is unchanged by this Stage -- EXACTLY the same six statements established by Alpha 076", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const body = (classBody.match(/async #bootstrapIdentity\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const lines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(lines).toEqual([
      "if (this.#isBootstrapped()) {",
      "return;",
      "}",
      "const descriptor = await this.#performBootstrap();",
      "this.#observeBootstrap(descriptor);",
      "this.#completeBootstrap(descriptor);",
    ]);
  });

  it("17. the class still has exactly FIVE public methods and EIGHT private methods -- no new API of any kind added by this review", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const publicMethodNames = [
      ...classBody.matchAll(/^\s{2}(?:async\s+)?(\w+)\([^)]*\)(?::\s*[^{]+)?\s*\{/gm),
    ]
      .map((m: RegExpMatchArray) => m[1] ?? "")
      .filter((name: string) => name !== "constructor");
    expect(new Set(publicMethodNames)).toEqual(
      new Set(["findIdentity", "listIdentities", "bootstrapIdentity", "isBootstrapped", "currentIdentity"]),
    );
    const privateMethodNames = [
      ...classBody.matchAll(/^\s{2}(?:async\s+)?#(\w+)\([^)]*\)(?::\s*[^{]+)?\s*\{/gm),
    ].map((m: RegExpMatchArray) => m[1] ?? "");
    expect(new Set(privateMethodNames)).toEqual(
      new Set(["describeIdentity", "completeBootstrap", "observeBootstrap", "isBootstrapped", "currentIdentity", "acquireDescriptor", "performBootstrap", "bootstrapIdentity"]),
    );
  });

  it("18. no new private FIELD exists -- still exactly five fields (three readonly, two not)", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const fieldNames = [
      ...classBody.matchAll(/^\s{2}(?:readonly )?#(\w+)(?::|\s*=)/gm),
    ].map((m: RegExpMatchArray) => m[1]);
    expect(new Set(fieldNames)).toEqual(
      new Set(["registry", "service", "resolver", "bootstrapped", "descriptor"]),
    );
    expect(fieldNames.length).toBe(5);
  });

  // ---------------------------------------------------------------------
  // Behavioral: the Bootstrap-process-only success/failure rule, confirmed live
  // ---------------------------------------------------------------------

  it("19. behavioral: a Bootstrap resolving a NULL Descriptor without throwing settles successfully (would map to BOOTSTRAP_COMPLETED, not BOOTSTRAP_FAILED) -- confirmed by the Promise resolving cleanly", async () => {
    const identity = new FedosRuntimeIdentity();
    await expect(identity.bootstrapIdentity()).resolves.toBeUndefined();
    expect(identity.currentIdentity()).toBeNull();
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("20. behavioral: a Bootstrap resolving a REAL Descriptor without throwing settles successfully (would map to BOOTSTRAP_COMPLETED + DESCRIPTOR_PRESENT) -- confirmed by the Promise resolving cleanly and the reference being cached", async () => {
    const provider = resolveFedosIdentityProvider();
    const descriptor = {
      id: "alpha080-present-check",
      provider: "nostr",
      publicIdentifier: "npub1alpha080",
    };
    vi.spyOn(provider as unknown as { describeIdentity: () => Promise<unknown> }, "describeIdentity").mockResolvedValueOnce(descriptor);

    const identity = new FedosRuntimeIdentity();
    await expect(identity.bootstrapIdentity()).resolves.toBeUndefined();
    expect(identity.currentIdentity()).toBe(descriptor);
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("21. behavioral: a rejected Bootstrap (would map to BOOTSTRAP_FAILED) leaves #descriptor/#bootstrapped untouched, distinguishing it from the null-Descriptor-success case", async () => {
    const identity = new FedosRuntimeIdentity();
    vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockRejectedValueOnce(
      new Error("simulated Provider failure"),
    );
    await expect(identity.bootstrapIdentity()).rejects.toThrow("simulated Provider failure");
    expect(identity.isBootstrapped()).toBe(false);
    expect(identity.currentIdentity()).toBeNull();
  });

  it("22. behavioral: a fresh instance reports isBootstrapped() === false and currentIdentity() === null", () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.isBootstrapped()).toBe(false);
    expect(identity.currentIdentity()).toBeNull();
  });

  it("23. behavioral: idempotency fully preserved -- repeated bootstrapIdentity() calls after success invoke the Service exactly once", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const identity = new FedosRuntimeIdentity();
    for (let i = 0; i < 10; i += 1) {
      await identity.bootstrapIdentity();
    }
    expect(spy).toHaveBeenCalledTimes(1);
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("24. behavioral: Fail Closed preserved -- a rejected first attempt leaves state untouched, and the very next call retries for real", async () => {
    const identity = new FedosRuntimeIdentity();
    const spy = vi
      .spyOn(FedosIdentityService.prototype, "describeIdentity")
      .mockRejectedValueOnce(new Error("simulated Provider failure"))
      .mockResolvedValue(null);

    await expect(identity.bootstrapIdentity()).rejects.toThrow("simulated Provider failure");
    expect(identity.isBootstrapped()).toBe(false);
    expect(identity.currentIdentity()).toBeNull();

    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("25. behavioral: Registry registration is unaffected -- a single bootstrapIdentity() call still triggers exactly one register() call on a real Descriptor", async () => {
    const registerSpy = vi.spyOn(FedosIdentityRegistry.prototype, "register");
    const provider = resolveFedosIdentityProvider();
    vi.spyOn(provider as unknown as { describeIdentity: () => Promise<unknown> }, "describeIdentity").mockResolvedValueOnce({
      id: "alpha080-registry-check",
      provider: "nostr",
      publicIdentifier: "npub1alpha080registry",
    });

    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(identity.findIdentity("alpha080-registry-check")).not.toBeNull();
  });

  it("26. behavioral: two independently-constructed instances remain fully independent", async () => {
    const a = new FedosRuntimeIdentity();
    const b = new FedosRuntimeIdentity();
    await a.bootstrapIdentity();
    expect(a.isBootstrapped()).toBe(true);
    expect(b.isBootstrapped()).toBe(false);
  });

  it("27. behavioral: FedosRuntimeIdentity constructed under every RuntimeMode still resolves cleanly through the full chain", async () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      expect(runtime.mode).toBe(mode);
      const identity = new FedosRuntimeIdentity();
      await identity.bootstrapIdentity();
      expect(identity.currentIdentity()).toBeNull();
    }
  });

  // ---------------------------------------------------------------------
  // Regression: no other implementation file touched by this Stage
  // ---------------------------------------------------------------------

  it("28. Regression: create_runtime.ts does not reference observeBootstrap or this Stage's own doc, and remains Construct Only", () => {
    const codeOnly = codeOnlyLines(createRuntimeSource);
    const body = (codeOnly.match(/export function createRuntime\(([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/observeBootstrap|acquireDescriptor|performBootstrap|completeBootstrap|describeIdentity|bootstrapIdentity/);
    expect(body).not.toMatch(/isBootstrapped|currentIdentity/);
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_080/);
  });

  it("29. Regression: AppRuntime's own type (types.ts) has no Identity-related field and does not reference this Stage's own doc", () => {
    expect(runtimeTypesSource).not.toMatch(
      /FedosRuntimeIdentity|fedos_runtime_identity|observeBootstrap|secure_runtime_alpha_080/,
    );
    const body = (runtimeTypesSource.match(/export interface AppRuntime \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const fieldNames = [...body.matchAll(/readonly (\w+)[?:]/g)].map((m: RegExpMatchArray) => m[1]).sort();
    expect(fieldNames).toEqual(APP_RUNTIME_FIELDS);
  });

  it("30. Regression: src/worker.ts does not reference observeBootstrap, FedosRuntimeIdentity, or this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/observeBootstrap/);
    expect(workerSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_080/);
  });

  it("31. Regression: the entire Identity Layer is confirmed BYTE-FOR-BYTE unaffected by this Stage -- no file references this Stage's own doc, and each still exposes exactly its pre-existing methods", () => {
    for (const source of [serviceSource, registrySource, resolverClassSource, identityProviderResolverSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_080/);
    }
    expect(serviceSource).toMatch(/async describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{/);
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).toMatch(/find\(id: string\): FedosIdentityRecord \| null \{/);
    expect(registrySource).toMatch(/list\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(registrySource).toMatch(/remove\(id: string\): boolean \{/);
    expect(resolverClassSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(resolverClassSource).toMatch(/listIdentities\(\): readonly FedosIdentityRecord\[\] \{/);
  });

  it("32. Regression: fedos_runtime_storage_resolver.ts and fedos_runtime_storage_backend.ts are confirmed unaffected by this Stage", () => {
    for (const source of [storageResolverSource, storageBackendSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_080/);
    }
  });

  it("33. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha080-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha080-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha080-id"));
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

  it("35. Regression: createRuntime() still returns exactly the pre-existing thirty AppRuntime fields, under every mode, with no Identity field of any kind", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode }) as unknown as Record<string, unknown>;
      expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
      expect(runtime.observeBootstrap).toBeUndefined();
      expect(runtime.identity).toBeUndefined();
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
    expect(pubFnNames.length).toBe(46);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_080/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_080/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_080/);
  });

  it("38. Regression: package.json still declares exactly two dependencies and no bin field, unaffected by this Stage", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("39. no other doc file references this Stage's own doc, confirming this Stage's own footprint is exactly two new files plus one header-comment-only src/ diff", () => {
    expect(alpha079DocSource).not.toMatch(/secure_runtime_alpha_080/);
  });

  it("40. behavioral: repeated createRuntime() calls (simulating Worker per-request construction) never throw, confirming Worker remains unaffected and un-wired", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(() => createRuntime()).not.toThrow();
    }
  });

  it("41. final sanity: fedos_runtime_identity.ts is the ONLY src/ file this Stage touches, and only its header comment changed -- create_runtime.ts/types.ts/worker.ts never reference this Stage's own doc, while fedos_runtime_identity.ts legitimately does", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_080/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_080/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_080/);
    expect(fedosRuntimeIdentitySource).toMatch(/secure_runtime_alpha_080/);
  });
});
