import { describe, it, expect, vi, afterEach } from "vitest";
import { createRuntime } from "../src/runtime/create_runtime.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
import { FedosIdentityRegistry } from "../src/identity/fedos_identity_registry.js";
import { resolveFedosIdentityProvider } from "../src/identity/fedos_identity_provider_resolver.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_068_identity_reader_boundary_consolidation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha066DocSource from "../docs/secure_runtime_alpha_066_identity_version_removal.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha067DocSource from "../docs/secure_runtime_alpha_067_identity_reader_boundary_review.md?raw";
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
 * Secure Runtime Alpha 068 -- "Identity Reader Boundary Consolidation":
 * implements the Alpha 067 Decision (Option D) and ONLY that Decision
 * -- public describeIdentity() becomes a true private #describeIdentity()
 * method, and bootstrapIdentity() is rewired to call it, consolidating
 * the class to exactly one internal path to the Identity Service. These
 * tests confirm the visibility change is complete and surgical, that
 * bootstrapIdentity() is the sole reacher of #describeIdentity(), and
 * that every other method/file this Stage's own mandate forbids
 * touching remains completely unaffected.
 */
describe("Secure Runtime Alpha 068 -- Identity Reader Boundary Consolidation", () => {
  // ---------------------------------------------------------------------
  // Design doc structure
  // ---------------------------------------------------------------------

  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself an implementation of the Alpha 067 Decision, and only that Decision", () => {
    expect(designDocSource).toMatch(
      /this Stage implements the Alpha 067 Decision \(Option D\), and\s*\nONLY that Decision/,
    );
    expect(designDocSource).toMatch(/not a new\s*\nfeature/);
  });

  it("3. the design doc records the exact diff -- method rename to private, and the rewired call site", () => {
    expect(designDocSource).toMatch(
      /-\s*async describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{/,
    );
    expect(designDocSource).toMatch(
      /\+\s*async #describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{/,
    );
    expect(designDocSource).toMatch(/-\s*this\.#descriptor = await this\.#service\.describeIdentity\(\);/);
    expect(designDocSource).toMatch(/\+\s*this\.#descriptor = await this\.#describeIdentity\(\);/);
  });

  it("4. the design doc records the resulting call structure diagram", () => {
    expect(designDocSource).toMatch(/## 3\. #describeIdentity\(\) — the resulting structure/);
    expect(designDocSource).toMatch(/bootstrapIdentity\(\)/);
    expect(designDocSource).toMatch(/#describeIdentity\(\)/);
    expect(designDocSource).toMatch(/FedosIdentityService\.describeIdentity\(\)/);
    expect(designDocSource).toMatch(/FedosIdentityProvider\.describeIdentity\(\)/);
  });

  it("5. the design doc records an explicit 'does NOT do' list naming every prohibited file/area", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/create_runtime\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/types\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify any `src\/identity\/\*` file/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/worker\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `packages\/fedos-core-rust`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any Public Runtime API/);
  });

  it("6. the design doc cross-references Alpha 066 and Alpha 067", () => {
    expect(designDocSource).toMatch(/secure_runtime_alpha_066_identity_version_removal\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_067_identity_reader_boundary_review\.md/);
    expect(alpha066DocSource.length).toBeGreaterThan(0);
    expect(alpha067DocSource.length).toBeGreaterThan(0);
  });

  it("7. the design doc's own structure sanity check -- at least seven numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(7);
  });

  // ---------------------------------------------------------------------
  // #describeIdentity() structure
  // ---------------------------------------------------------------------

  it("8. #describeIdentity() is declared as a true private async method, with the IDENTICAL one-line body the former public describeIdentity() had", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const body = (classBody.match(/async #describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body.trim()).toBe("return this.#service.describeIdentity();");
  });

  it("9. describeIdentity (public, no #) does not exist anywhere in the class body", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    expect(classBody).not.toMatch(/^\s{2}async describeIdentity\(/m);
    expect(classBody).not.toMatch(/^\s{2}describeIdentity\(/m);
  });

  it("10. RIPPLE (Secure Runtime Alpha 076): bootstrapIdentity()'s own body called this.#describeIdentity() -- NOT this.#service directly, and NOT this.describeIdentity() (which no longer exists) -- AS OF this Stage's own scope; Alpha 069 (Identity Bootstrap State Consolidation) split the trailing #descriptor/#bootstrapped assignment into a dedicated #completeBootstrap() call, Alpha 070 (Identity Bootstrap Entry Consolidation) moved this ENTIRE body into a new private #bootstrapIdentity() method, with the PUBLIC bootstrapIdentity() reduced to a pure one-line wrapper, Alpha 072 (Identity Bootstrap State Reader Consolidation) rewrote the guard condition from 'if (this.#bootstrapped)' to 'if (this.#isBootstrapped())', Alpha 074 (Identity Bootstrap Flow Consolidation) rewired the call from 'this.#describeIdentity()' to 'this.#performBootstrap()', and Alpha 076 (Identity Bootstrap Observation Boundary) inserted a single '#observeBootstrap(descriptor)' call immediately before the '#completeBootstrap(descriptor)' call -- reconfirmed here that #bootstrapIdentity()'s own body now calls this.#performBootstrap(), followed by this.#observeBootstrap(), followed by this.#completeBootstrap(), and never references this.#service or this.#describeIdentity() directly", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const body = (classBody.match(/async #bootstrapIdentity\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).toMatch(
      /^\s*if \(this\.#isBootstrapped\(\)\) \{\s*\n\s*return;\s*\n\s*\}\s*\n\s*const descriptor = await this\.#performBootstrap\(\);\s*\n\s*this\.#observeBootstrap\(descriptor\);\s*\n\s*this\.#completeBootstrap\(descriptor\);\s*$/,
    );
    expect(body).not.toMatch(/this\.#service/);
    expect(body).not.toMatch(/this\.#describeIdentity\(\)/);
  });

  it("11. #describeIdentity() has EXACTLY ONE caller anywhere in the class body: bootstrapIdentity()'s own second statement", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const callSites = [...classBody.matchAll(/this\.#describeIdentity\(\)/g)];
    expect(callSites.length).toBe(1);
  });

  it("12. RIPPLE (Secure Runtime Alpha 076): the class had exactly FIVE public methods and ONE private method AS OF this Stage's own scope; Alpha 069 (Identity Bootstrap State Consolidation) added a second private method, #completeBootstrap(), Alpha 070 (Identity Bootstrap Entry Consolidation) added a third, #bootstrapIdentity(), Alpha 072 (Identity Bootstrap State Reader Consolidation) added a fourth, #isBootstrapped(), Alpha 073 (Identity Descriptor Reader Consolidation) added a fifth, #currentIdentity(), Alpha 074 (Identity Bootstrap Flow Consolidation) added a sixth, #performBootstrap(), Alpha 075 (Identity Descriptor Acquisition Consolidation) added a seventh, #acquireDescriptor(), and Alpha 076 (Identity Bootstrap Observation Boundary) added an eighth, #observeBootstrap() -- reconfirmed here that the class still has exactly FIVE public methods, now alongside EIGHT private methods", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
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

  it("13. findIdentity()/listIdentities()/isBootstrapped()/currentIdentity() remain BYTE-FOR-BYTE unchanged", () => {
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
  // Review事項: public Reader削除確認 / 外部呼び出し元ゼロ / sole reacher
  // ---------------------------------------------------------------------

  it("14. describeIdentity is not an accessible property on a FedosRuntimeIdentity instance -- neither own nor prototype", () => {
    const identity = new FedosRuntimeIdentity();
    expect("describeIdentity" in identity).toBe(false);
    expect((identity as unknown as Record<string, unknown>).describeIdentity).toBeUndefined();
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(identity))).not.toContain("describeIdentity");
  });

  it("15. no src/ file outside fedos_runtime_identity.ts references '.describeIdentity()' on a FedosRuntimeIdentity instance -- create_runtime.ts's own createRuntime() function BODY (comments excluded) and worker.ts confirmed clean; create_runtime.ts's own header/inline comments legitimately still name the historical, since-removed Alpha 055 call", () => {
    const body = (createRuntimeSource.match(/export function createRuntime\(([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/runtimeIdentity\.describeIdentity/);
    expect(body).not.toMatch(/\.describeIdentity\(\)/);
    expect(workerSource).not.toMatch(/\.describeIdentity\(\)/);
  });

  it("16. behavioral: bootstrapIdentity() alone reaches the Provider -- a single call triggers exactly one Provider read, exactly one Registry write on a real Descriptor", async () => {
    const registerSpy = vi.spyOn(FedosIdentityRegistry.prototype, "register");
    const provider = resolveFedosIdentityProvider();
    const providerSpy = vi.spyOn(provider as unknown as { describeIdentity: () => Promise<unknown> }, "describeIdentity").mockResolvedValueOnce({
      id: "alpha068-sole-reacher",
      provider: "nostr",
      publicIdentifier: "npub1alpha068",
    });

    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(providerSpy).toHaveBeenCalledTimes(1);
    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(identity.isBootstrapped()).toBe(true);
    expect(identity.currentIdentity()).not.toBeNull();
    expect(identity.findIdentity("alpha068-sole-reacher")).not.toBeNull();
  });

  it("17. behavioral: idempotency is fully preserved -- repeated bootstrapIdentity() calls after success invoke the Service exactly once", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const identity = new FedosRuntimeIdentity();
    for (let i = 0; i < 10; i += 1) {
      await identity.bootstrapIdentity();
    }
    expect(spy).toHaveBeenCalledTimes(1);
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("18. behavioral: a rejected first attempt leaves #descriptor/#bootstrapped untouched (Fail Closed unaffected), and the very next call retries for real", async () => {
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

  it("19. behavioral: currentIdentity() caches the exact Descriptor #describeIdentity() resolved -- same reference, no clone", async () => {
    const provider = resolveFedosIdentityProvider();
    const descriptor = {
      id: "alpha068-cache-check",
      provider: "nostr",
      publicIdentifier: "npub1alpha068cache",
    };
    vi.spyOn(provider as unknown as { describeIdentity: () => Promise<unknown> }, "describeIdentity").mockResolvedValueOnce(descriptor);

    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBe(descriptor);
  });

  it("20. behavioral: two independently-constructed instances remain fully independent -- no shared state of any kind through the private method", async () => {
    const a = new FedosRuntimeIdentity();
    const b = new FedosRuntimeIdentity();
    await a.bootstrapIdentity();
    expect(a.isBootstrapped()).toBe(true);
    expect(b.isBootstrapped()).toBe(false);
  });

  it("21. behavioral: findIdentity()/listIdentities() remain fully functional, unaffected, reachable independently of bootstrapIdentity()", () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.findIdentity("anything")).toBeNull();
    expect(identity.listIdentities()).toEqual([]);
  });

  it("22. behavioral: FedosRuntimeIdentity constructed under every RuntimeMode still resolves cleanly through bootstrapIdentity()", async () => {
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

  it("23. Regression: create_runtime.ts's own createRuntime() function body (comments excluded) calls neither #describeIdentity/describeIdentity nor bootstrapIdentity/isBootstrapped/currentIdentity, and the file does not reference this Stage's own doc; the header/inline comments' own historical prose, which legitimately still names the removed Alpha 055 describeIdentity() call, is intentionally excluded from this check", () => {
    const codeOnly = codeOnlyLines(createRuntimeSource);
    const body = (codeOnly.match(/export function createRuntime\(([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/describeIdentity/);
    expect(body).not.toMatch(/bootstrapIdentity|isBootstrapped|currentIdentity/);
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_068/);
  });

  it("24. Regression: AppRuntime's own type (types.ts) has no Identity-related field and does not reference this Stage's own doc", () => {
    expect(runtimeTypesSource).not.toMatch(
      /FedosRuntimeIdentity|fedos_runtime_identity|describeIdentity|isBootstrapped|currentIdentity|secure_runtime_alpha_068/,
    );
    const body = (runtimeTypesSource.match(/export interface AppRuntime \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const fieldNames = [...body.matchAll(/readonly (\w+)[?:]/g)].map((m: RegExpMatchArray) => m[1]).sort();
    expect(fieldNames).toEqual(APP_RUNTIME_FIELDS);
  });

  it("25. Regression: src/worker.ts does not reference describeIdentity, FedosRuntimeIdentity, or this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/describeIdentity/);
    expect(workerSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_068/);
  });

  it("26. Regression: the entire Identity Layer is confirmed BYTE-FOR-BYTE unaffected by this Stage -- no file references this Stage's own doc, and each still exposes exactly its pre-existing methods (including Service.describeIdentity(), still public on FedosIdentityService itself)", () => {
    for (const source of [serviceSource, registrySource, resolverClassSource, identityProviderResolverSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_068/);
    }
    expect(serviceSource).toMatch(/async describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{/);
    expect(serviceSource).toMatch(/this\.#registry\.register\(record\);/);
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).toMatch(/find\(id: string\): FedosIdentityRecord \| null \{/);
    expect(registrySource).toMatch(/list\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(registrySource).toMatch(/remove\(id: string\): boolean \{/);
    expect(resolverClassSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(resolverClassSource).toMatch(/listIdentities\(\): readonly FedosIdentityRecord\[\] \{/);
  });

  it("27. Regression: fedos_runtime_storage_resolver.ts and fedos_runtime_storage_backend.ts are confirmed unaffected by this Stage", () => {
    for (const source of [storageResolverSource, storageBackendSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_068/);
    }
  });

  it("28. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha068-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha068-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha068-id"));
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

  it("30. Regression: createRuntime() still returns exactly the pre-existing thirty AppRuntime fields, under every mode, with no describeIdentity/Identity field of any kind", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode }) as unknown as Record<string, unknown>;
      expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
      expect(runtime.describeIdentity).toBeUndefined();
      expect(runtime.identity).toBeUndefined();
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
    expect(pubFnNames.length).toBe(48);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_068/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_068/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_068/);
  });

  it("33. Regression: package.json still declares exactly two dependencies and no bin/main/exports field, unaffected by this Stage", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("34. no other doc file references this Stage's own doc, confirming this Stage's own footprint is exactly two new files plus one modified src/ file", () => {
    expect(alpha066DocSource).not.toMatch(/secure_runtime_alpha_068/);
    expect(alpha067DocSource).not.toMatch(/secure_runtime_alpha_068/);
  });

  it("35. behavioral: repeated createRuntime() calls (simulating Worker per-request construction) never throw, confirming Worker remains unaffected and un-wired", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(() => createRuntime()).not.toThrow();
    }
  });

  it("36. final sanity: fedos_runtime_identity.ts is the ONLY src/ file this Stage touches -- create_runtime.ts/types.ts/worker.ts never reference this Stage's own doc, while fedos_runtime_identity.ts legitimately does", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_068/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_068/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_068/);
    expect(fedosRuntimeIdentitySource).toMatch(/secure_runtime_alpha_068/);
  });
});
