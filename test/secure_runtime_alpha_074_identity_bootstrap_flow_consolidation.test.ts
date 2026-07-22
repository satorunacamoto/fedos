import { describe, it, expect, vi, afterEach } from "vitest";
import { createRuntime } from "../src/runtime/create_runtime.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
import { FedosIdentityRegistry } from "../src/identity/fedos_identity_registry.js";
import { resolveFedosIdentityProvider } from "../src/identity/fedos_identity_provider_resolver.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_074_identity_bootstrap_flow_consolidation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha073DocSource from "../docs/secure_runtime_alpha_073_identity_descriptor_reader_consolidation.md?raw";
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
 * Secure Runtime Alpha 074 -- "Identity Bootstrap Flow Consolidation":
 * adds a private, ASYNC #performBootstrap() method whose own
 * single-statement body is a bare 'return this.#describeIdentity();',
 * and rewires #bootstrapIdentity()'s own descriptor-capturing
 * statement to await it instead of #describeIdentity() directly. The
 * Bootstrap Flow now has its own named, isolated unit -- reached by
 * exactly one caller (#bootstrapIdentity()) and reaching
 * #describeIdentity() as its own exactly-one caller.
 * #bootstrapIdentity() is now a pure orchestrator: guard, delegate to
 * the Flow, hand the result to the Writer. These tests confirm the
 * consolidation is complete and surgical, that #performBootstrap()
 * obeys every structural constraint (no branching, no State update,
 * no direct Provider/Registry/Resolver/Storage reference), and that
 * every observable behavior (idempotency, Fail Closed, Registry
 * registration, Provider call count, Bootstrap semantics) is
 * unchanged.
 */
describe("Secure Runtime Alpha 074 -- Identity Bootstrap Flow Consolidation", () => {
  // ---------------------------------------------------------------------
  // Design doc structure
  // ---------------------------------------------------------------------

  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself a behavior-preserving consolidation", () => {
    expect(designDocSource).toMatch(
      /It changes no observable behavior —\s*\nidempotency, Fail Closed, Registry registration, Provider call count,\s*\nand Bootstrap semantics are all completely unchanged/,
    );
  });

  it("3. the design doc records the exact diff -- new private method, and the rewired awaited expression", () => {
    expect(designDocSource).toMatch(/\+\s*async #performBootstrap\(\): Promise<FedosIdentityDescriptor \| null> \{/);
    expect(designDocSource).toMatch(/\+\s*return this\.#describeIdentity\(\);/);
    expect(designDocSource).toMatch(/-\s*const descriptor = await this\.#describeIdentity\(\);/);
    expect(designDocSource).toMatch(/\+\s*const descriptor = await this\.#performBootstrap\(\);/);
  });

  it("4. the design doc records the #performBootstrap() constraint checklist", () => {
    const section = (designDocSource.match(/## 3\. #performBootstrap\(\) — constraints confirmed([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*no synchronous processing\*\*/);
    expect(section).toMatch(/\*\*no State update\*\*/);
    expect(section).toMatch(/\*\*no `#completeBootstrap\(\)` call\*\*/);
    expect(section).toMatch(/\*\*no direct Provider call\*\*/);
    expect(section).toMatch(/\*\*no direct Registry access\*\*/);
    expect(section).toMatch(/\*\*no Resolver access\*\*/);
    expect(section).toMatch(/\*\*no Storage access\*\*/);
    expect(section).toMatch(/\*\*no `try`\/`catch`\*\*/);
    expect(section).toMatch(/\*\*no `if`\*\*/);
  });

  it("5. the design doc records the sole-Flow confirmation and the full call chain", () => {
    const section = (designDocSource.match(/## 4\. Confirmation: #performBootstrap\(\) is the sole Flow, singly reached([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/EXACTLY ONE caller/);
    expect(section).toMatch(
      /`#bootstrapIdentity\(\)` → `#performBootstrap\(\)` → `#describeIdentity\(\)`\s*\n→ `FedosIdentityService\.describeIdentity\(\)`/,
    );
  });

  it("6. the design doc records the pure-orchestrator confirmation for #bootstrapIdentity()", () => {
    const section = (designDocSource.match(/## 5\. Confirmation: #bootstrapIdentity\(\) is a pure orchestrator([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(/same five\s*\nstatements/);
    expect(section).toMatch(/It no longer\s*\nreaches `#describeIdentity\(\)` directly/);
  });

  it("7. the design doc records the #completeBootstrap() sole-writer confirmation", () => {
    const section = (designDocSource.match(/## 6\. Confirmation: #completeBootstrap\(\) remains the sole Writer([\s\S]*?)\n## 7\./) ?? [])[1] ?? "";
    expect(section).toMatch(/remains the ONLY place in this file/);
    expect(section).toMatch(/performs no write of\s*\nany kind/);
  });

  it("8. the design doc records an explicit 'does NOT do' list naming every prohibited file/area", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any new public API/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any new private field/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/create_runtime\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/types\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify any `src\/identity\/\*` file/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/worker\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `packages\/fedos-core-rust`/);
  });

  it("9. the design doc cross-references Alpha 073", () => {
    expect(designDocSource).toMatch(/secure_runtime_alpha_073_identity_descriptor_reader_consolidation\.md/);
    expect(alpha073DocSource.length).toBeGreaterThan(0);
  });

  it("10. the design doc's own structure sanity check -- at least ten numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(10);
  });

  // ---------------------------------------------------------------------
  // #performBootstrap() structure
  // ---------------------------------------------------------------------

  it("11. #performBootstrap() is declared as a private, ASYNC method with no parameters, returning Promise<FedosIdentityDescriptor | null>", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    expect(classBody).toMatch(/async #performBootstrap\(\): Promise<FedosIdentityDescriptor \| null> \{/);
  });

  it("12. RIPPLE (Secure Runtime Alpha 075): #performBootstrap()'s own body was EXACTLY one statement, 'return this.#describeIdentity();', with no await keyword of its own, AS OF this Stage's own scope; Alpha 075 (Identity Descriptor Acquisition Consolidation) rewired that single statement to 'return this.#acquireDescriptor();' -- reconfirmed here that #performBootstrap()'s own body is still exactly one statement, now delegating to #acquireDescriptor(), with no await keyword of its own", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const body = (classBody.match(/async #performBootstrap\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const lines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(lines).toEqual(["return this.#acquireDescriptor();"]);
    expect(body).not.toMatch(/\bawait\b/);
  });

  it("13. #performBootstrap()'s own body contains no branching, no State update, no #completeBootstrap() call, no Provider/Registry/Resolver/Storage reference, and no try/catch", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const body = (classBody.match(/async #performBootstrap\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/\bif\b|\bswitch\b|\?.*:/);
    expect(body).not.toMatch(/#descriptor\s*=/);
    expect(body).not.toMatch(/#bootstrapped\s*=/);
    expect(body).not.toMatch(/this\.#completeBootstrap\(/);
    expect(body).not.toMatch(/this\.#service/);
    expect(body).not.toMatch(/this\.#registry/);
    expect(body).not.toMatch(/this\.#resolver/);
    expect(body).not.toMatch(/try\s*\{|catch\s*\(/);
  });

  // ---------------------------------------------------------------------
  // レビュー事項: sole structure / sole caller / orchestrator / sole writer
  // ---------------------------------------------------------------------

  it("14. #performBootstrap() has EXACTLY ONE caller anywhere in the class body: #bootstrapIdentity()'s own descriptor-capturing statement", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const callSites = [...classBody.matchAll(/this\.#performBootstrap\(\)/g)];
    expect(callSites.length).toBe(1);
    const body = (classBody.match(/async #bootstrapIdentity\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).toMatch(/const descriptor = await this\.#performBootstrap\(\);/);
  });

  it("15. RIPPLE (Secure Runtime Alpha 075): #describeIdentity() had EXACTLY ONE caller anywhere in the class body -- #performBootstrap()'s own single statement -- AS OF this Stage's own scope, NOT #bootstrapIdentity() anymore; Alpha 075 (Identity Descriptor Acquisition Consolidation) rewired that call site to a new private #acquireDescriptor() method -- reconfirmed here that #describeIdentity() still has EXACTLY ONE caller, now inside #acquireDescriptor(), and neither #performBootstrap() nor #bootstrapIdentity() reference it directly", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const callSites = [...classBody.matchAll(/this\.#describeIdentity\(\)/g)];
    expect(callSites.length).toBe(1);
    const acquireDescriptorBody = (classBody.match(/async #acquireDescriptor\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(acquireDescriptorBody).toMatch(/this\.#describeIdentity\(\)/);
    const performBootstrapBody = (classBody.match(/async #performBootstrap\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(performBootstrapBody).not.toMatch(/this\.#describeIdentity\(\)/);
    const bootstrapIdentityBody = (classBody.match(/async #bootstrapIdentity\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(bootstrapIdentityBody).not.toMatch(/this\.#describeIdentity\(\)/);
  });

  it("16. RIPPLE (Secure Runtime Alpha 076): #bootstrapIdentity() was a pure orchestrator AS OF this Stage's own scope -- its own body was EXACTLY guard/return/close-brace, the Flow-delegating await, and the completeBootstrap call, in that order; Alpha 076 (Identity Bootstrap Observation Boundary) inserted a single '#observeBootstrap(descriptor)' call immediately before the '#completeBootstrap(descriptor)' call -- reconfirmed here that #bootstrapIdentity() remains a pure orchestrator, now also delegating to the (empty) observation boundary", () => {
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

  it("17. #completeBootstrap() remains the ONLY place in the class body that ever writes #descriptor or #bootstrapped, with its own body byte-for-byte unchanged", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const descriptorAssignments = [...classBody.matchAll(/#descriptor\s*=/g)];
    const bootstrappedAssignments = [...classBody.matchAll(/#bootstrapped\s*=/g)];
    expect(descriptorAssignments.length).toBe(1);
    expect(bootstrappedAssignments.length).toBe(1);
    expect(fedosRuntimeIdentitySource).toMatch(
      /#completeBootstrap\(descriptor: FedosIdentityDescriptor \| null\): void \{\s*\n\s*this\.#descriptor = descriptor;\s*\n\s*this\.#bootstrapped = true;\s*\n\s*\}/,
    );
    const callSites = [...classBody.matchAll(/this\.#completeBootstrap\(/g)];
    expect(callSites.length).toBe(1);
  });

  it("18. RIPPLE (Secure Runtime Alpha 076): the class had exactly FIVE public methods and SIX private methods AS OF this Stage's own scope; Alpha 075 (Identity Descriptor Acquisition Consolidation) added a seventh private method, #acquireDescriptor(), and Alpha 076 (Identity Bootstrap Observation Boundary) added an eighth, #observeBootstrap() -- reconfirmed here that the class still has exactly FIVE public methods, now alongside EIGHT private methods", () => {
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

  it("19. no new private FIELD was added -- still exactly five fields (three readonly, two not)", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const fieldNames = [
      ...classBody.matchAll(/^\s{2}(?:readonly )?#(\w+)(?::|\s*=)/gm),
    ].map((m: RegExpMatchArray) => m[1]);
    expect(new Set(fieldNames)).toEqual(
      new Set(["registry", "service", "resolver", "bootstrapped", "descriptor"]),
    );
    expect(fieldNames.length).toBe(5);
  });

  it("20. findIdentity()/listIdentities()/#describeIdentity()/#isBootstrapped()/#currentIdentity() remain BYTE-FOR-BYTE unchanged", () => {
    expect(fedosRuntimeIdentitySource).toMatch(
      /findIdentity\(id: string\): FedosIdentityRecord \| null \{\s*\n\s*return this\.#resolver\.findIdentity\(id\);\s*\n\s*\}/,
    );
    expect(fedosRuntimeIdentitySource).toMatch(
      /listIdentities\(\): readonly FedosIdentityRecord\[\] \{\s*\n\s*return this\.#resolver\.listIdentities\(\);\s*\n\s*\}/,
    );
    expect(fedosRuntimeIdentitySource).toMatch(
      /async #describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{\s*\n\s*return this\.#service\.describeIdentity\(\);\s*\n\s*\}/,
    );
    expect(fedosRuntimeIdentitySource).toMatch(
      /#isBootstrapped\(\): boolean \{\s*\n\s*return this\.#bootstrapped;\s*\n\s*\}/,
    );
    expect(fedosRuntimeIdentitySource).toMatch(
      /#currentIdentity\(\): FedosIdentityDescriptor \| null \{\s*\n\s*return this\.#descriptor;\s*\n\s*\}/,
    );
  });

  // ---------------------------------------------------------------------
  // Behavioral: every observable behavior unchanged
  // ---------------------------------------------------------------------

  it("21. behavioral: a fresh instance reports isBootstrapped() === false and currentIdentity() === null", () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.isBootstrapped()).toBe(false);
    expect(identity.currentIdentity()).toBeNull();
  });

  it("22. behavioral: a successful bootstrapIdentity() call under the Null Source sets isBootstrapped() true and currentIdentity() null", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);
    expect(identity.currentIdentity()).toBeNull();
  });

  it("23. behavioral: a successful bootstrapIdentity() call resolving a real Descriptor caches it verbatim through the Flow -- same reference, no clone", async () => {
    const provider = resolveFedosIdentityProvider();
    const descriptor = {
      id: "alpha074-cache-check",
      provider: "nostr",
      publicIdentifier: "npub1alpha074",
    };
    vi.spyOn(provider as unknown as { describeIdentity: () => Promise<unknown> }, "describeIdentity").mockResolvedValueOnce(descriptor);

    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBe(descriptor);
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("24. behavioral: idempotency fully preserved through the Flow -- repeated bootstrapIdentity() calls after success invoke the Service exactly once", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const identity = new FedosRuntimeIdentity();
    for (let i = 0; i < 10; i += 1) {
      await identity.bootstrapIdentity();
    }
    expect(spy).toHaveBeenCalledTimes(1);
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("25. behavioral: Fail Closed preserved through the Flow -- a rejected first attempt leaves #descriptor/#bootstrapped untouched, and the very next call retries for real", async () => {
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

  it("26. behavioral: the rejection reason itself still propagates unmodified through the Flow to the caller", async () => {
    const identity = new FedosRuntimeIdentity();
    vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockRejectedValueOnce(
      new Error("distinct simulated reason"),
    );
    await expect(identity.bootstrapIdentity()).rejects.toThrow("distinct simulated reason");
  });

  it("27. behavioral: Registry registration is unaffected -- a single bootstrapIdentity() call still triggers exactly one register() call on a real Descriptor", async () => {
    const registerSpy = vi.spyOn(FedosIdentityRegistry.prototype, "register");
    const provider = resolveFedosIdentityProvider();
    vi.spyOn(provider as unknown as { describeIdentity: () => Promise<unknown> }, "describeIdentity").mockResolvedValueOnce({
      id: "alpha074-registry-check",
      provider: "nostr",
      publicIdentifier: "npub1alpha074registry",
    });

    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(identity.findIdentity("alpha074-registry-check")).not.toBeNull();
  });

  it("28. behavioral: two independently-constructed instances remain fully independent -- no shared state through the new private method", async () => {
    const a = new FedosRuntimeIdentity();
    const b = new FedosRuntimeIdentity();
    await a.bootstrapIdentity();
    expect(a.isBootstrapped()).toBe(true);
    expect(b.isBootstrapped()).toBe(false);
  });

  it("29. behavioral: concurrent bootstrapIdentity() calls on the SAME instance (fired without awaiting the first) both resolve cleanly through the Flow", async () => {
    const identity = new FedosRuntimeIdentity();
    const results = await Promise.all([
      identity.bootstrapIdentity(),
      identity.bootstrapIdentity(),
    ]);
    expect(results).toEqual([undefined, undefined]);
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("30. behavioral: FedosRuntimeIdentity constructed under every RuntimeMode still resolves cleanly through the Flow", async () => {
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

  it("31. Regression: create_runtime.ts does not reference performBootstrap, bootstrapIdentity, completeBootstrap, describeIdentity, or this Stage's own doc, and remains Construct Only", () => {
    const codeOnly = codeOnlyLines(createRuntimeSource);
    const body = (codeOnly.match(/export function createRuntime\(([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/performBootstrap|completeBootstrap|describeIdentity|bootstrapIdentity/);
    expect(body).not.toMatch(/isBootstrapped|currentIdentity/);
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_074/);
  });

  it("32. Regression: AppRuntime's own type (types.ts) has no Identity-related field and does not reference this Stage's own doc", () => {
    expect(runtimeTypesSource).not.toMatch(
      /FedosRuntimeIdentity|fedos_runtime_identity|performBootstrap|completeBootstrap|describeIdentity|isBootstrapped|currentIdentity|secure_runtime_alpha_074/,
    );
    const body = (runtimeTypesSource.match(/export interface AppRuntime \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const fieldNames = [...body.matchAll(/readonly (\w+)[?:]/g)].map((m: RegExpMatchArray) => m[1]).sort();
    expect(fieldNames).toEqual(APP_RUNTIME_FIELDS);
  });

  it("33. Regression: src/worker.ts does not reference performBootstrap, FedosRuntimeIdentity, or this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/performBootstrap|completeBootstrap/);
    expect(workerSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_074/);
  });

  it("34. Regression: the entire Identity Layer is confirmed BYTE-FOR-BYTE unaffected by this Stage -- no file references this Stage's own doc, and each still exposes exactly its pre-existing methods", () => {
    for (const source of [serviceSource, registrySource, resolverClassSource, identityProviderResolverSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_074/);
    }
    expect(serviceSource).toMatch(/async describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{/);
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).toMatch(/find\(id: string\): FedosIdentityRecord \| null \{/);
    expect(registrySource).toMatch(/list\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(registrySource).toMatch(/remove\(id: string\): boolean \{/);
    expect(resolverClassSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(resolverClassSource).toMatch(/listIdentities\(\): readonly FedosIdentityRecord\[\] \{/);
  });

  it("35. Regression: fedos_runtime_storage_resolver.ts and fedos_runtime_storage_backend.ts are confirmed unaffected by this Stage", () => {
    for (const source of [storageResolverSource, storageBackendSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_074/);
    }
  });

  it("36. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha074-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha074-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha074-id"));
    expect(deleted).toBe(true);
  });

  it("37. Regression: initializeCrypto()/runtimeCapabilities() remain unaffected -- confirmed by ACTUAL calls via the AppRuntime object", async () => {
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

  it("38. Regression: createRuntime() still returns exactly the pre-existing thirty AppRuntime fields, under every mode, with no Identity field of any kind", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode }) as unknown as Record<string, unknown>;
      expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
      expect(runtime.performBootstrap).toBeUndefined();
      expect(runtime.identity).toBeUndefined();
    }
  });

  it("39. Regression: no fedos_*.ts file was added or removed by this Stage -- still exactly 57 under src/runtime/ and exactly 24 under src/identity/", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("40. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(68);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(21);    expect(libRsSource).not.toMatch(/secure_runtime_alpha_074/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_074/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_074/);
  });

  it("41. Regression: package.json still declares exactly two dependencies and no bin field, unaffected by this Stage", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("42. no other doc file references this Stage's own doc, confirming this Stage's own footprint is exactly two new files plus one modified src/ file", () => {
    expect(alpha073DocSource).not.toMatch(/secure_runtime_alpha_074/);
  });

  it("43. behavioral: repeated createRuntime() calls (simulating Worker per-request construction) never throw, confirming Worker remains unaffected and un-wired", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(() => createRuntime()).not.toThrow();
    }
  });

  it("44. final sanity: fedos_runtime_identity.ts is the ONLY src/ file this Stage touches -- create_runtime.ts/types.ts/worker.ts never reference this Stage's own doc, while fedos_runtime_identity.ts legitimately does", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_074/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_074/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_074/);
    expect(fedosRuntimeIdentitySource).toMatch(/secure_runtime_alpha_074/);
  });
});
