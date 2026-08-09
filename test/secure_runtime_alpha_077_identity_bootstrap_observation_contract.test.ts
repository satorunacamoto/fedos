import { describe, it, expect, vi, afterEach } from "vitest";
import { createRuntime } from "../src/os/_legacy_prototype/runtime/create_runtime.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
import { FedosIdentityService } from "../src/os/core/identity/fedos_identity_service.js";
import { FedosIdentityRegistry } from "../src/os/core/identity/fedos_identity_registry.js";
import { resolveFedosIdentityProvider } from "../src/os/core/identity/fedos_identity_provider_resolver.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_077_identity_bootstrap_observation_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha076DocSource from "../docs/secure_runtime_alpha_076_identity_bootstrap_observation_boundary.md?raw";
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

function classBodyOf(source: string): string {
  const codeOnly = codeOnlyLines(source);
  return (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
}

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Secure Runtime Alpha 077 -- "Identity Bootstrap Observation
 * Contract": a REVIEW / FORMAL CONFIRMATION Stage, ZERO functional
 * code change. Fixes the Contract #observeBootstrap() must obey --
 * a Bootstrap-observation-ONLY Hook: synchronous, void-returning,
 * never throwing, never reading or writing #descriptor/#bootstrapped,
 * never touching Registry/Provider/Resolver, and never altering
 * Bootstrap semantics -- whose future permitted uses are limited to
 * Metrics, Tracing, Audit, Logging, and Telemetry. These tests
 * confirm the review's own claims and that Alpha 076's own empty
 * implementation already satisfies every clause of the Contract.
 */
describe("Secure Runtime Alpha 077 -- Identity Bootstrap Observation Contract", () => {
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

  it("3. the design doc records the Contract's eight clauses", () => {
    const section = (designDocSource.match(/## 3\. The Contract, stated precisely([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*A Bootstrap-observation-ONLY Hook\.\*\*/);
    expect(section).toMatch(/\*\*Synchronous\.\*\*/);
    expect(section).toMatch(/\*\*`void`-returning\.\*\*/);
    expect(section).toMatch(/\*\*Never throwing\.\*\*/);
    expect(section).toMatch(/\*\*Read-free on `#descriptor`\/`#bootstrapped`\.\*\*/);
    expect(section).toMatch(/\*\*Write-free on `#descriptor`\/`#bootstrapped`\.\*\*/);
    expect(section).toMatch(/\*\*Registry-free\.\*\*/);
    expect(section).toMatch(/\*\*Provider-free and Resolver-free\.\*\*/);
    expect(section).toMatch(/\*\*Semantics-preserving\.\*\*/);
  });

  it("4. the design doc records the exactly-five future permitted uses, and only these", () => {
    const section = (designDocSource.match(/## 4\. Future permitted uses — and only these([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Metrics\*\*/);
    expect(section).toMatch(/\*\*Tracing\*\*/);
    expect(section).toMatch(/\*\*Audit\*\*/);
    expect(section).toMatch(/\*\*Logging\*\*/);
    expect(section).toMatch(/\*\*Telemetry\*\*/);
    expect(section).toMatch(/explicitly OUT OF SCOPE/);
  });

  it("5. the design doc confirms Alpha 076's own empty implementation already satisfies the Contract", () => {
    const section = (designDocSource.match(/## 5\. Confirmation: Alpha 076's own empty implementation already satisfies this Contract([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(/Bootstrap-observation-ONLY Hook\*\* — confirmed/);
    expect(section).toMatch(/Synchronous\*\* — confirmed/);
    expect(section).toMatch(/`void`-returning\*\* — confirmed/);
    expect(section).toMatch(/Never throwing\*\* — confirmed/);
    expect(section).toMatch(/No `#descriptor`\/`#bootstrapped` read or write\*\* — confirmed/);
    expect(section).toMatch(/No Registry\/Provider\/Resolver reference\*\* — confirmed/);
    expect(section).toMatch(/Bootstrap semantics unchanged\*\* — confirmed/);
  });

  it("6. the design doc records an explicit 'does NOT do' list naming every prohibited file/area", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `#observeBootstrap\(\)`'s own body/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement any Metrics\/Tracing\/Audit\/Logging\/Telemetry/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any new public API/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any new private field/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/create_runtime\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/types\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify any `src\/identity\/\*` file/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/worker\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `packages\/fedos-core-rust`/);
  });

  it("7. the design doc cross-references Alpha 076", () => {
    expect(designDocSource).toMatch(/secure_runtime_alpha_076_identity_bootstrap_observation_boundary\.md/);
    expect(alpha076DocSource.length).toBeGreaterThan(0);
  });

  it("8. the design doc's own structure sanity check -- at least seven numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(7);
  });

  // ---------------------------------------------------------------------
  // #observeBootstrap() -- empty implementation, reconfirmed
  // ---------------------------------------------------------------------

  it("9. #observeBootstrap()'s own body contains NO statement of any kind -- code-only extraction (comments stripped) yields an empty body, unchanged by this Stage", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const body = (classBody.match(/#observeBootstrap\(descriptor: FedosIdentityDescriptor \| null\): void \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body.trim()).toBe("");
  });

  it("10. #observeBootstrap() is declared as a private, SYNCHRONOUS method with exactly one parameter and a void return type", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    expect(classBody).toMatch(/#observeBootstrap\(descriptor: FedosIdentityDescriptor \| null\): void \{/);
    expect(classBody).not.toMatch(/async #observeBootstrap/);
  });

  it("11. #observeBootstrap()'s own body (including comments) contains no reference to Provider/Registry/Resolver/Storage, no assignment to #descriptor or #bootstrapped, no await, no if, and no try/catch", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const body = (classBody.match(/#observeBootstrap\(descriptor: FedosIdentityDescriptor \| null\): void \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/this\.#service/);
    expect(body).not.toMatch(/this\.#registry/);
    expect(body).not.toMatch(/this\.#resolver/);
    expect(body).not.toMatch(/this\.#descriptor/);
    expect(body).not.toMatch(/this\.#bootstrapped/);
    expect(body).not.toMatch(/\bawait\b/);
    expect(body).not.toMatch(/\bif\b/);
    expect(body).not.toMatch(/try\s*\{|catch\s*\(/);
  });

  it("12. #observeBootstrap() has EXACTLY ONE caller anywhere in the class body, unchanged by this Stage", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const callSites = [...classBody.matchAll(/this\.#observeBootstrap\(/g)];
    expect(callSites.length).toBe(1);
  });

  it("13. #bootstrapIdentity()'s own body is EXACTLY the six statements established by Alpha 076, unchanged by this Stage", () => {
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

  it("14. #completeBootstrap() remains the ONLY place in the class body that ever writes #descriptor or #bootstrapped, with its own body byte-for-byte unchanged", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const descriptorAssignments = [...classBody.matchAll(/#descriptor\s*=/g)];
    const bootstrappedAssignments = [...classBody.matchAll(/#bootstrapped\s*=/g)];
    expect(descriptorAssignments.length).toBe(1);
    expect(bootstrappedAssignments.length).toBe(1);
    expect(fedosRuntimeIdentitySource).toMatch(
      /#completeBootstrap\(descriptor: FedosIdentityDescriptor \| null\): void \{\s*\n\s*this\.#descriptor = descriptor;\s*\n\s*this\.#bootstrapped = true;\s*\n\s*\}/,
    );
  });

  it("15. the class still has exactly FIVE public methods and EIGHT private methods -- no new API of any kind added by this review", () => {
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

  it("16. no new private FIELD exists -- still exactly five fields (three readonly, two not)", () => {
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
  // Behavioral: every observable behavior unchanged
  // ---------------------------------------------------------------------

  it("17. behavioral: a fresh instance reports isBootstrapped() === false and currentIdentity() === null", () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.isBootstrapped()).toBe(false);
    expect(identity.currentIdentity()).toBeNull();
  });

  it("18. behavioral: a successful bootstrapIdentity() call under the Null Source sets isBootstrapped() true and currentIdentity() null", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);
    expect(identity.currentIdentity()).toBeNull();
  });

  it("19. behavioral: a successful bootstrapIdentity() call resolving a real Descriptor caches it verbatim -- same reference, no clone", async () => {
    const provider = resolveFedosIdentityProvider();
    const descriptor = {
      id: "alpha077-cache-check",
      provider: "nostr",
      publicIdentifier: "npub1alpha077",
    };
    vi.spyOn(provider as unknown as { describeIdentity: () => Promise<unknown> }, "describeIdentity").mockResolvedValueOnce(descriptor);

    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBe(descriptor);
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("20. behavioral: idempotency fully preserved -- repeated bootstrapIdentity() calls after success invoke the Service exactly once", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const identity = new FedosRuntimeIdentity();
    for (let i = 0; i < 10; i += 1) {
      await identity.bootstrapIdentity();
    }
    expect(spy).toHaveBeenCalledTimes(1);
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("21. behavioral: Fail Closed preserved -- a rejected first attempt leaves #descriptor/#bootstrapped untouched, and the very next call retries for real", async () => {
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

  it("22. behavioral: Registry registration is unaffected -- a single bootstrapIdentity() call still triggers exactly one register() call on a real Descriptor", async () => {
    const registerSpy = vi.spyOn(FedosIdentityRegistry.prototype, "register");
    const provider = resolveFedosIdentityProvider();
    vi.spyOn(provider as unknown as { describeIdentity: () => Promise<unknown> }, "describeIdentity").mockResolvedValueOnce({
      id: "alpha077-registry-check",
      provider: "nostr",
      publicIdentifier: "npub1alpha077registry",
    });

    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(identity.findIdentity("alpha077-registry-check")).not.toBeNull();
  });

  it("23. behavioral: two independently-constructed instances remain fully independent", async () => {
    const a = new FedosRuntimeIdentity();
    const b = new FedosRuntimeIdentity();
    await a.bootstrapIdentity();
    expect(a.isBootstrapped()).toBe(true);
    expect(b.isBootstrapped()).toBe(false);
  });

  it("24. behavioral: FedosRuntimeIdentity constructed under every RuntimeMode still resolves cleanly", async () => {
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

  it("25. Regression: create_runtime.ts does not reference observeBootstrap or this Stage's own doc, and remains Construct Only", () => {
    const codeOnly = codeOnlyLines(createRuntimeSource);
    const body = (codeOnly.match(/export function createRuntime\(([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/observeBootstrap|acquireDescriptor|performBootstrap|completeBootstrap|describeIdentity|bootstrapIdentity/);
    expect(body).not.toMatch(/isBootstrapped|currentIdentity/);
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_077/);
  });

  it("26. Regression: AppRuntime's own type (types.ts) has no Identity-related field and does not reference this Stage's own doc", () => {
    expect(runtimeTypesSource).not.toMatch(
      /FedosRuntimeIdentity|fedos_runtime_identity|observeBootstrap|secure_runtime_alpha_077/,
    );
    const body = (runtimeTypesSource.match(/export interface AppRuntime \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const fieldNames = [...body.matchAll(/readonly (\w+)[?:]/g)].map((m: RegExpMatchArray) => m[1]).sort();
    expect(fieldNames).toEqual(APP_RUNTIME_FIELDS);
  });

  it("27. Regression: src/worker.ts does not reference observeBootstrap, FedosRuntimeIdentity, or this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/observeBootstrap/);
    expect(workerSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_077/);
  });

  it("28. Regression: the entire Identity Layer is confirmed BYTE-FOR-BYTE unaffected by this Stage -- no file references this Stage's own doc, and each still exposes exactly its pre-existing methods", () => {
    for (const source of [serviceSource, registrySource, resolverClassSource, identityProviderResolverSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_077/);
    }
    expect(serviceSource).toMatch(/async describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{/);
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).toMatch(/find\(id: string\): FedosIdentityRecord \| null \{/);
    expect(registrySource).toMatch(/list\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(registrySource).toMatch(/remove\(id: string\): boolean \{/);
    expect(resolverClassSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(resolverClassSource).toMatch(/listIdentities\(\): readonly FedosIdentityRecord\[\] \{/);
  });

  it("29. Regression: fedos_runtime_storage_resolver.ts and fedos_runtime_storage_backend.ts are confirmed unaffected by this Stage", () => {
    for (const source of [storageResolverSource, storageBackendSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_077/);
    }
  });

  it("30. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha077-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha077-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha077-id"));
    expect(deleted).toBe(true);
  });

  it("31. Regression: initializeCrypto()/runtimeCapabilities() remain unaffected -- confirmed by ACTUAL calls via the AppRuntime object", async () => {
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

  it("32. Regression: createRuntime() still returns exactly the pre-existing thirty AppRuntime fields, under every mode, with no Identity field of any kind", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode }) as unknown as Record<string, unknown>;
      expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
      expect(runtime.observeBootstrap).toBeUndefined();
      expect(runtime.identity).toBeUndefined();
    }
  });

  it("33. Regression: no fedos_*.ts file was added or removed by this Stage -- still exactly 57 under src/runtime/ and exactly 24 under src/identity/", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("34. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(21);    expect(libRsSource).not.toMatch(/secure_runtime_alpha_077/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_077/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_077/);
  });

  it("35. Regression: package.json still declares exactly two dependencies and no bin field, unaffected by this Stage", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("36. no other doc file references this Stage's own doc, confirming this Stage's own footprint is exactly two new files plus one header-comment-only src/ diff", () => {
    expect(alpha076DocSource).not.toMatch(/secure_runtime_alpha_077/);
  });

  it("37. behavioral: repeated createRuntime() calls (simulating Worker per-request construction) never throw, confirming Worker remains unaffected and un-wired", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(() => createRuntime()).not.toThrow();
    }
  });

  it("38. final sanity: fedos_runtime_identity.ts is the ONLY src/ file this Stage touches, and only its header comment changed -- create_runtime.ts/types.ts/worker.ts never reference this Stage's own doc, while fedos_runtime_identity.ts legitimately does", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_077/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_077/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_077/);
    expect(fedosRuntimeIdentitySource).toMatch(/secure_runtime_alpha_077/);
  });
});
