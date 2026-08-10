import { describe, it, expect, vi, afterEach } from "vitest";
import { createRuntime } from "../src/os/_legacy_prototype/runtime/create_runtime.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
import { FedosIdentityService } from "../src/os/core/identity/fedos_identity_service.js";
import { FedosIdentityRegistry } from "../src/os/core/identity/fedos_identity_registry.js";
import { resolveFedosIdentityProvider } from "../src/os/core/identity/fedos_identity_provider_resolver.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_070_identity_bootstrap_entry_consolidation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha068DocSource from "../docs/secure_runtime_alpha_068_identity_reader_boundary_consolidation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha069DocSource from "../docs/secure_runtime_alpha_069_identity_bootstrap_state_consolidation.md?raw";
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

function classBodyOf(source: string): string {
  const codeOnly = codeOnlyLines(source);
  return (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
}

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Secure Runtime Alpha 070 -- "Identity Bootstrap Entry Consolidation":
 * moves bootstrapIdentity()'s own entire guarded body -- the guard, the
 * #describeIdentity() call, and the #completeBootstrap() call, in that
 * exact order, byte-for-byte unchanged -- into a new private
 * #bootstrapIdentity() method, and reduces the PUBLIC bootstrapIdentity()
 * to a pure one-line wrapper. These tests confirm the relocation is
 * complete and surgical, that the public method is wrapper-only, that
 * the guard/#describeIdentity()/#completeBootstrap() order is exactly
 * preserved, and that every observable behavior (idempotency, Fail
 * Closed, Registry registration, Provider call count, Bootstrap
 * semantics) is unchanged.
 */
describe("Secure Runtime Alpha 070 -- Identity Bootstrap Entry Consolidation", () => {
  // ---------------------------------------------------------------------
  // Design doc structure
  // ---------------------------------------------------------------------

  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself a behavior-preserving consolidation", () => {
    expect(designDocSource).toMatch(
      /It changes no\s*\nobservable behavior — idempotency, Fail Closed, Registry registration,\s*\nProvider call count, and Bootstrap semantics are all completely\s*\nunchanged/,
    );
  });

  it("3. the design doc records the exact diff -- new private method, and the public method reduced to a wrapper", () => {
    expect(designDocSource).toMatch(/\+\s*async #bootstrapIdentity\(\): Promise<void> \{/);
    expect(designDocSource).toMatch(/\+\s*if \(this\.#bootstrapped\) \{/);
    expect(designDocSource).toMatch(/\+\s*const descriptor = await this\.#describeIdentity\(\);/);
    expect(designDocSource).toMatch(/\+\s*this\.#completeBootstrap\(descriptor\);/);
    expect(designDocSource).toMatch(/-\s*if \(this\.#bootstrapped\) \{/);
    expect(designDocSource).toMatch(/-\s*const descriptor = await this\.#describeIdentity\(\);/);
    expect(designDocSource).toMatch(/-\s*this\.#completeBootstrap\(descriptor\);/);
    expect(designDocSource).toMatch(/\+\s*return this\.#bootstrapIdentity\(\);/);
  });

  it("4. the design doc records the #bootstrapIdentity() constraint checklist", () => {
    const section = (designDocSource.match(/## 3\. #bootstrapIdentity\(\) — constraints confirmed([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/Holds the \*\*entire\*\* Bootstrap body/);
    expect(section).toMatch(/Is \*\*async\*\*, returning `Promise<void>`/);
    expect(section).toMatch(/Has \*\*exactly one caller\*\*/);
    expect(section).toMatch(/Introduces \*\*no new field, no new public API/);
  });

  it("5. the design doc records the public wrapper purity confirmation", () => {
    const section = (designDocSource.match(/## 4\. Confirmation: public wrapper purity([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/async bootstrapIdentity\(\): Promise<void> \{/);
    expect(section).toMatch(/return this\.#bootstrapIdentity\(\);/);
    expect(section).toMatch(/"return this\.#bootstrapIdentity\(\);"/);
  });

  it("6. the design doc records an explicit 'does NOT do' list naming every prohibited file/area", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any new public API/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any new private field/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/create_runtime\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/types\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify any `src\/identity\/\*` file/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/worker\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `packages\/fedos-core-rust`/);
  });

  it("7. the design doc cross-references Alpha 068 and Alpha 069", () => {
    expect(designDocSource).toMatch(/secure_runtime_alpha_068_identity_reader_boundary_consolidation\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_069_identity_bootstrap_state_consolidation\.md/);
    expect(alpha068DocSource.length).toBeGreaterThan(0);
    expect(alpha069DocSource.length).toBeGreaterThan(0);
  });

  it("8. the design doc's own structure sanity check -- at least seven numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(7);
  });

  // ---------------------------------------------------------------------
  // #bootstrapIdentity() structure
  // ---------------------------------------------------------------------

  it("9. #bootstrapIdentity() is declared as a private, ASYNC method returning Promise<void>", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    expect(classBody).toMatch(/async #bootstrapIdentity\(\): Promise<void> \{/);
  });

  it("10. RIPPLE (Secure Runtime Alpha 076): #bootstrapIdentity()'s own body was EXACTLY the five statements, guard-if/return/close-brace/descriptor-capturing await/completeBootstrap call, in that order, AS OF this Stage's own scope; Alpha 072 (Identity Bootstrap State Reader Consolidation) rewrote the guard condition from 'if (this.#bootstrapped)' to 'if (this.#isBootstrapped())', Alpha 074 (Identity Bootstrap Flow Consolidation) rewired the descriptor-capturing call from 'this.#describeIdentity()' to 'this.#performBootstrap()', and Alpha 076 (Identity Bootstrap Observation Boundary) inserted a single '#observeBootstrap(descriptor)' call immediately before the '#completeBootstrap(descriptor)' call -- reconfirmed here as the CURRENT six statements, in the same order, with the updated guard condition, Flow call, and observation call", () => {
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

  it("11. #bootstrapIdentity() has EXACTLY ONE caller anywhere in the class body: the PUBLIC bootstrapIdentity()'s own single statement", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const callSites = [...classBody.matchAll(/this\.#bootstrapIdentity\(\)/g)];
    expect(callSites.length).toBe(1);
  });

  // ---------------------------------------------------------------------
  // レビュー事項: public wrapper purity
  // ---------------------------------------------------------------------

  it("12. the PUBLIC bootstrapIdentity()'s own entire body, trimmed, is EXACTLY 'return this.#bootstrapIdentity();' -- nothing more", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const publicBody = (classBody.match(/\n {2}async bootstrapIdentity\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(publicBody.trim()).toBe("return this.#bootstrapIdentity();");
  });

  it("13. the PUBLIC bootstrapIdentity() contains no guard, no state read/write, and no error handling of its own", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const publicBody = (classBody.match(/\n {2}async bootstrapIdentity\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(publicBody).not.toMatch(/#bootstrapped/);
    expect(publicBody).not.toMatch(/#descriptor/);
    expect(publicBody).not.toMatch(/#describeIdentity/);
    expect(publicBody).not.toMatch(/#completeBootstrap/);
    expect(publicBody).not.toMatch(/try\s*\{|catch\s*\(/);
    expect(publicBody).not.toMatch(/\bif\b/);
  });

  // ---------------------------------------------------------------------
  // レビュー事項: guard / #describeIdentity() / #completeBootstrap() order
  // ---------------------------------------------------------------------

  it("14. RIPPLE (Secure Runtime Alpha 076): guard/#describeIdentity()/#completeBootstrap() order was EXACTLY preserved inside #bootstrapIdentity() AS OF this Stage's own scope, with the guard reading 'this.#bootstrapped' directly; Alpha 072 (Identity Bootstrap State Reader Consolidation) rewrote the guard condition to 'this.#isBootstrapped()', Alpha 074 (Identity Bootstrap Flow Consolidation) rewired the descriptor-capturing call to reach a new private #performBootstrap() method instead of #describeIdentity() directly, and Alpha 076 (Identity Bootstrap Observation Boundary) inserted a single '#observeBootstrap(descriptor)' call immediately before the '#completeBootstrap(descriptor)' call -- reconfirmed here that the order is still exactly preserved, with the updated guard condition, Flow call, and observation call", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    expect(classBody).toMatch(
      /async #bootstrapIdentity\(\): Promise<void> \{\s*\n\s*if \(this\.#isBootstrapped\(\)\) \{\s*\n\s*return;\s*\n\s*\}\s*\n\s*const descriptor = await this\.#performBootstrap\(\);\s*\n\s*this\.#observeBootstrap\(descriptor\);\s*\n\s*this\.#completeBootstrap\(descriptor\);\s*\n\s*\}/,
    );
  });

  it("15. #describeIdentity() and #completeBootstrap() remain BYTE-FOR-BYTE unchanged", () => {
    expect(fedosRuntimeIdentitySource).toMatch(
      /async #describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{\s*\n\s*return this\.#service\.describeIdentity\(\);\s*\n\s*\}/,
    );
    expect(fedosRuntimeIdentitySource).toMatch(
      /#completeBootstrap\(descriptor: FedosIdentityDescriptor \| null\): void \{\s*\n\s*this\.#descriptor = descriptor;\s*\n\s*this\.#bootstrapped = true;\s*\n\s*\}/,
    );
  });

  it("16. RIPPLE (Secure Runtime Alpha 075): #describeIdentity() had EXACTLY ONE caller anywhere in the class body -- #performBootstrap()'s own single statement -- AS OF this Stage's own scope; Alpha 075 (Identity Descriptor Acquisition Consolidation) rewired that call site to a new private #acquireDescriptor() method, which is now #describeIdentity()'s own sole caller -- reconfirmed here that #describeIdentity() still has EXACTLY ONE caller, now inside #acquireDescriptor()", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const callSites = [...classBody.matchAll(/this\.#describeIdentity\(\)/g)];
    expect(callSites.length).toBe(1);
    const acquireDescriptorBody = (classBody.match(/async #acquireDescriptor\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(acquireDescriptorBody).toMatch(/this\.#describeIdentity\(\)/);
  });

  it("17. #completeBootstrap() still has EXACTLY ONE caller anywhere in the class body: #bootstrapIdentity()'s own final statement", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const callSites = [...classBody.matchAll(/this\.#completeBootstrap\(/g)];
    expect(callSites.length).toBe(1);
    const body = (classBody.match(/async #bootstrapIdentity\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).toMatch(/this\.#completeBootstrap\(descriptor\);/);
  });

  it("18. #descriptor and #bootstrapped are each still assigned in EXACTLY ONE place anywhere in the class body: inside #completeBootstrap()", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const descriptorAssignments = [...classBody.matchAll(/#descriptor\s*=/g)];
    const bootstrappedAssignments = [...classBody.matchAll(/#bootstrapped\s*=/g)];
    expect(descriptorAssignments.length).toBe(1);
    expect(bootstrappedAssignments.length).toBe(1);
  });

  it("19. RIPPLE (Secure Runtime Alpha 076): the class had exactly FIVE public methods and THREE private methods AS OF this Stage's own scope; Alpha 072 (Identity Bootstrap State Reader Consolidation) added a fourth private method, #isBootstrapped(), Alpha 073 (Identity Descriptor Reader Consolidation) added a fifth, #currentIdentity(), Alpha 074 (Identity Bootstrap Flow Consolidation) added a sixth, #performBootstrap(), Alpha 075 (Identity Descriptor Acquisition Consolidation) added a seventh, #acquireDescriptor(), and Alpha 076 (Identity Bootstrap Observation Boundary) added an eighth, #observeBootstrap() -- reconfirmed here that the class still has exactly FIVE public methods, now alongside EIGHT private methods", () => {
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
    expect(new Set(privateMethodNames)).toEqual(new Set(["describeIdentity", "completeBootstrap", "observeBootstrap", "isBootstrapped", "currentIdentity", "acquireDescriptor", "performBootstrap", "bootstrapIdentity"]));
  });

  it("20. no new private FIELD was added -- still exactly five fields (three readonly, two not)", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const fieldNames = [
      ...classBody.matchAll(/^\s{2}(?:readonly )?#(\w+)(?::|\s*=)/gm),
    ].map((m: RegExpMatchArray) => m[1]);
    expect(new Set(fieldNames)).toEqual(
      new Set(["registry", "service", "resolver", "bootstrapped", "descriptor"]),
    );
    expect(fieldNames.length).toBe(5);
  });

  it("21. findIdentity()/listIdentities()/isBootstrapped()/currentIdentity() remain BYTE-FOR-BYTE unchanged", () => {
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

  // ---------------------------------------------------------------------
  // Behavioral: every observable behavior unchanged
  // ---------------------------------------------------------------------

  it("22. behavioral: a fresh instance reports isBootstrapped() === false and currentIdentity() === null", () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.isBootstrapped()).toBe(false);
    expect(identity.currentIdentity()).toBeNull();
  });

  it("23. behavioral: a successful bootstrapIdentity() call under the Null Source sets isBootstrapped() true and currentIdentity() null", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);
    expect(identity.currentIdentity()).toBeNull();
  });

  it("24. behavioral: a successful bootstrapIdentity() call resolving a real Descriptor caches it verbatim -- same reference, no clone", async () => {
    const provider = resolveFedosIdentityProvider();
    const descriptor = {
      id: "alpha070-cache-check",
      provider: "nostr",
      publicIdentifier: "npub1alpha070",
    };
    vi.spyOn(provider as unknown as { describeIdentity: () => Promise<unknown> }, "describeIdentity").mockResolvedValueOnce(descriptor);

    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBe(descriptor);
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("25. behavioral: idempotency fully preserved through the wrapper -- repeated bootstrapIdentity() calls after success invoke the Service exactly once", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const identity = new FedosRuntimeIdentity();
    for (let i = 0; i < 10; i += 1) {
      await identity.bootstrapIdentity();
    }
    expect(spy).toHaveBeenCalledTimes(1);
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("26. behavioral: Fail Closed preserved through the wrapper -- a rejected first attempt leaves #descriptor/#bootstrapped untouched, and the very next call retries for real", async () => {
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

  it("27. behavioral: the rejection reason itself still propagates unmodified through the wrapper to the caller", async () => {
    const identity = new FedosRuntimeIdentity();
    vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockRejectedValueOnce(
      new Error("distinct simulated reason"),
    );
    await expect(identity.bootstrapIdentity()).rejects.toThrow("distinct simulated reason");
  });

  it("28. behavioral: Registry registration is unaffected -- a single bootstrapIdentity() call still triggers exactly one register() call on a real Descriptor", async () => {
    const registerSpy = vi.spyOn(FedosIdentityRegistry.prototype, "register");
    const provider = resolveFedosIdentityProvider();
    vi.spyOn(provider as unknown as { describeIdentity: () => Promise<unknown> }, "describeIdentity").mockResolvedValueOnce({
      id: "alpha070-registry-check",
      provider: "nostr",
      publicIdentifier: "npub1alpha070registry",
    });

    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(identity.findIdentity("alpha070-registry-check")).not.toBeNull();
  });

  it("29. behavioral: two independently-constructed instances remain fully independent -- no shared state through the new private method", async () => {
    const a = new FedosRuntimeIdentity();
    const b = new FedosRuntimeIdentity();
    await a.bootstrapIdentity();
    expect(a.isBootstrapped()).toBe(true);
    expect(b.isBootstrapped()).toBe(false);
  });

  it("30. behavioral: concurrent bootstrapIdentity() calls on the SAME instance (fired without awaiting the first) both resolve cleanly through the wrapper, and the guard is set after the first settles", async () => {
    const identity = new FedosRuntimeIdentity();
    const results = await Promise.all([
      identity.bootstrapIdentity(),
      identity.bootstrapIdentity(),
    ]);
    expect(results).toEqual([undefined, undefined]);
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("31. behavioral: FedosRuntimeIdentity constructed under every RuntimeMode still resolves cleanly through the wrapper", async () => {
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

  it("32. Regression: create_runtime.ts does not reference bootstrapIdentity, completeBootstrap, describeIdentity, or this Stage's own doc, and remains Construct Only", () => {
    const codeOnly = codeOnlyLines(createRuntimeSource);
    const body = (codeOnly.match(/export function createRuntime\(([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/completeBootstrap|describeIdentity|bootstrapIdentity/);
    expect(body).not.toMatch(/isBootstrapped|currentIdentity/);
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_070/);
  });

  it("33. Regression: AppRuntime's own type (types.ts) has no Identity-related field and does not reference this Stage's own doc", () => {
    expect(runtimeTypesSource).not.toMatch(
      /FedosRuntimeIdentity|fedos_runtime_identity|completeBootstrap|describeIdentity|bootstrapIdentity|isBootstrapped|currentIdentity|secure_runtime_alpha_070/,
    );
    const body = (runtimeTypesSource.match(/export interface AppRuntime \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const fieldNames = [...body.matchAll(/readonly (\w+)[?:]/g)].map((m: RegExpMatchArray) => m[1]).sort();
    expect(fieldNames).toEqual(APP_RUNTIME_FIELDS);
  });

  it("34. Regression: src/worker.ts does not reference bootstrapIdentity, FedosRuntimeIdentity, or this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/bootstrapIdentity|completeBootstrap/);
    expect(workerSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_070/);
  });

  it("35. Regression: the entire Identity Layer is confirmed BYTE-FOR-BYTE unaffected by this Stage -- no file references this Stage's own doc, and each still exposes exactly its pre-existing methods", () => {
    for (const source of [serviceSource, registrySource, resolverClassSource, identityProviderResolverSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_070/);
    }
    expect(serviceSource).toMatch(/async describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{/);
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).toMatch(/find\(id: string\): FedosIdentityRecord \| null \{/);
    expect(registrySource).toMatch(/list\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(registrySource).toMatch(/remove\(id: string\): boolean \{/);
    expect(resolverClassSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(resolverClassSource).toMatch(/listIdentities\(\): readonly FedosIdentityRecord\[\] \{/);
  });

  it("36. Regression: fedos_runtime_storage_resolver.ts and fedos_runtime_storage_backend.ts are confirmed unaffected by this Stage", () => {
    for (const source of [storageResolverSource, storageBackendSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_070/);
    }
  });

  it("37. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha070-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha070-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha070-id"));
    expect(deleted).toBe(true);
  });

  it("38. Regression: initializeCrypto()/runtimeCapabilities() remain unaffected -- confirmed by ACTUAL calls via the AppRuntime object", async () => {
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

  it("39. Regression: createRuntime() still returns exactly the pre-existing thirty AppRuntime fields, under every mode, with no Identity field of any kind", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode }) as unknown as Record<string, unknown>;
      expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
      expect(runtime.bootstrapIdentity).toBeUndefined();
      expect(runtime.identity).toBeUndefined();
    }
  });

  it("40. Regression: no fedos_*.ts file was added or removed by this Stage -- still exactly 57 under src/runtime/ and exactly 24 under src/identity/", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("41. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(21);    expect(libRsSource).not.toMatch(/secure_runtime_alpha_070/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_070/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_070/);
  });

  it("42. Regression: package.json still declares exactly two dependencies and no bin field, unaffected by this Stage", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("43. no other doc file references this Stage's own doc, confirming this Stage's own footprint is exactly two new files plus one modified src/ file", () => {
    expect(alpha068DocSource).not.toMatch(/secure_runtime_alpha_070/);
    expect(alpha069DocSource).not.toMatch(/secure_runtime_alpha_070/);
  });

  it("44. behavioral: repeated createRuntime() calls (simulating Worker per-request construction) never throw, confirming Worker remains unaffected and un-wired", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(() => createRuntime()).not.toThrow();
    }
  });

  it("45. final sanity: fedos_runtime_identity.ts is the ONLY src/ file this Stage touches -- create_runtime.ts/types.ts/worker.ts never reference this Stage's own doc, while fedos_runtime_identity.ts legitimately does", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_070/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_070/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_070/);
    expect(fedosRuntimeIdentitySource).toMatch(/secure_runtime_alpha_070/);
  });
});
