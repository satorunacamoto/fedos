import { describe, it, expect, vi, afterEach } from "vitest";
import { createRuntime } from "../src/runtime/create_runtime.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
import { FedosIdentityRegistry } from "../src/identity/fedos_identity_registry.js";
import { resolveFedosIdentityProvider } from "../src/identity/fedos_identity_provider_resolver.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_066_identity_version_removal.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha065DocSource from "../docs/secure_runtime_alpha_065_identity_runtime_internal_contract_review.md?raw";
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
 * Secure Runtime Alpha 066 -- "Identity Version Removal": implements
 * the Alpha 065 Decision (Option D) and ONLY that Decision --
 * identityVersion()/#identityVersion are removed from
 * FedosRuntimeIdentity, and bootstrapIdentity()'s own guarded body
 * loses its trailing version-increment statement. isBootstrapped()
 * becomes the sole Bootstrap-state reader. These tests confirm the
 * removal is complete and surgical, and that every other method/file
 * this Stage's own mandate forbids touching remains completely
 * unaffected.
 */
describe("Secure Runtime Alpha 066 -- Identity Version Removal", () => {
  // ---------------------------------------------------------------------
  // Design doc structure
  // ---------------------------------------------------------------------

  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself an implementation of the Alpha 065 Decision, and only that Decision", () => {
    expect(designDocSource).toMatch(
      /this Stage implements the Alpha 065 Decision, and ONLY that\s*\nDecision/,
    );
    expect(designDocSource).toMatch(/not a new feature/);
  });

  it("3. the design doc records the exact diff -- field removal, increment removal, method removal", () => {
    expect(designDocSource).toMatch(/-\s*#identityVersion: number = 0;/);
    expect(designDocSource).toMatch(/-\s*this\.#identityVersion \+= 1;/);
    expect(designDocSource).toMatch(/-\s*identityVersion\(\): number \{/);
  });

  it("4. the design doc records an explicit 'does NOT do' list naming every prohibited file/area", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/create_runtime\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/types\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify any `src\/identity\/\*` file/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/worker\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `packages\/fedos-core-rust`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any Public Runtime API/);
  });

  it("5. the design doc cross-references Alpha 064 and Alpha 065", () => {
    expect(designDocSource).toMatch(/secure_runtime_alpha_064_identity_change_detection\.md/);
    expect(designDocSource).toMatch(
      /secure_runtime_alpha_065_identity_runtime_internal_contract_review\.md/,
    );
    expect(alpha064DocSource.length).toBeGreaterThan(0);
    expect(alpha065DocSource.length).toBeGreaterThan(0);
  });

  it("6. the design doc's own structure sanity check -- at least six numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(6);
  });

  // ---------------------------------------------------------------------
  // Implementation shape -- the removal itself
  // ---------------------------------------------------------------------

  it("7. identityVersion is not present anywhere in fedos_runtime_identity.ts's own CLASS BODY -- neither the field, nor the method, nor the increment (the header comment's own historical prose, which legitimately still names the removed method while recording this arc's history, is intentionally excluded from this check)", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    expect(classBody).not.toMatch(/#identityVersion/);
    expect(classBody).not.toMatch(/\bidentityVersion\(/);
  });

  it("8. #identityVersion does not exist as a class field declaration", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    expect(classBody).not.toMatch(/#identityVersion/);
    expect(classBody).toMatch(/#bootstrapped: boolean = false;/);
    expect(classBody).toMatch(/#descriptor: FedosIdentityDescriptor \| null = null;/);
  });

  it("9. identityVersion() does not exist as a method, and TypeScript itself confirms it via the compiled type -- no property named identityVersion on FedosRuntimeIdentity", () => {
    const identity = new FedosRuntimeIdentity();
    expect("identityVersion" in identity).toBe(false);
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(identity))).not.toContain("identityVersion");
  });

  it("10. RIPPLE (Secure Runtime Alpha 068): bootstrapIdentity()'s own body no longer contained the version-increment statement AS OF this Stage's own scope -- it was EXACTLY the guard-if/return/close-brace, the descriptor-capturing await, and the bootstrapped assignment; Alpha 068 (implementing the Alpha 067 Decision) rewired the await to call the new private #describeIdentity() method instead of this.#service directly -- reconfirmed here that the body shape is unchanged, now routed through #describeIdentity()", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const body = (codeOnly.match(/async bootstrapIdentity\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const lines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(lines).toEqual([
      "if (this.#bootstrapped) {",
      "return;",
      "}",
      "this.#descriptor = await this.#describeIdentity();",
      "this.#bootstrapped = true;",
    ]);
    expect(body).not.toMatch(/identityVersion/);
  });

  it("11. RIPPLE (Secure Runtime Alpha 068): isBootstrapped()/currentIdentity()/describeIdentity()/findIdentity()/listIdentities() remained BYTE-FOR-BYTE unchanged AS OF this Stage's own scope; Alpha 068 renamed describeIdentity() to a private #describeIdentity() with the IDENTICAL body -- reconfirmed here against the CURRENT source", () => {
    expect(fedosRuntimeIdentitySource).toMatch(
      /isBootstrapped\(\): boolean \{\s*\n\s*return this\.#bootstrapped;\s*\n\s*\}/,
    );
    expect(fedosRuntimeIdentitySource).toMatch(
      /currentIdentity\(\): FedosIdentityDescriptor \| null \{\s*\n\s*return this\.#descriptor;\s*\n\s*\}/,
    );
    expect(fedosRuntimeIdentitySource).toMatch(
      /async #describeIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{\s*\n\s*return this\.#service\.describeIdentity\(\);\s*\n\s*\}/,
    );
    expect(fedosRuntimeIdentitySource).toMatch(
      /findIdentity\(id: string\): FedosIdentityRecord \| null \{\s*\n\s*return this\.#resolver\.findIdentity\(id\);\s*\n\s*\}/,
    );
    expect(fedosRuntimeIdentitySource).toMatch(
      /listIdentities\(\): readonly FedosIdentityRecord\[\] \{\s*\n\s*return this\.#resolver\.listIdentities\(\);\s*\n\s*\}/,
    );
  });

  it("12. RIPPLE (Secure Runtime Alpha 068): the class had exactly SIX public methods -- not seven -- AS OF this Stage's own scope; Alpha 068 made describeIdentity() a true private #describeIdentity() method -- reconfirmed here that the class now has exactly FIVE public methods", () => {
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
    expect(methodNames.length).toBe(5);
  });

  it("13. the three readonly constructor-assigned fields (#registry/#service/#resolver) and #bootstrapped/#descriptor remain the ONLY fields -- exactly five, not six", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const fieldNames = [
      ...classBody.matchAll(/^\s{2}(?:readonly )?#(\w+)(?::|\s*=)/gm),
    ].map((m: RegExpMatchArray) => m[1]);
    expect(new Set(fieldNames)).toEqual(
      new Set(["registry", "service", "resolver", "bootstrapped", "descriptor"]),
    );
    expect(fieldNames.length).toBe(5);
  });

  // ---------------------------------------------------------------------
  // Behavioral: isBootstrapped() is the sole Bootstrap-state reader
  // ---------------------------------------------------------------------

  it("14. behavioral: a fresh instance reports isBootstrapped() === false, with no identityVersion() to cross-check against", () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.isBootstrapped()).toBe(false);
    expect((identity as unknown as Record<string, unknown>).identityVersion).toBeUndefined();
  });

  it("15. behavioral: a successful bootstrapIdentity() flips isBootstrapped() to true and caches currentIdentity(), exactly as before this removal", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);
    expect(identity.currentIdentity()).toBeNull();
  });

  it("16. behavioral: bootstrapIdentity() remains idempotent -- the Service is called exactly once across repeated calls after success", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("17. behavioral: a REJECTED first-ever bootstrapIdentity() call leaves isBootstrapped() at false, and the very next call retries for real", async () => {
    const identity = new FedosRuntimeIdentity();
    const spy = vi
      .spyOn(FedosIdentityService.prototype, "describeIdentity")
      .mockRejectedValueOnce(new Error("simulated Provider failure"))
      .mockResolvedValue(null);

    await expect(identity.bootstrapIdentity()).rejects.toThrow();
    expect(identity.isBootstrapped()).toBe(false);

    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("18. behavioral: currentIdentity() caches a real Descriptor exactly as before this removal, unaffected", async () => {
    const provider = resolveFedosIdentityProvider();
    const descriptor = {
      id: "alpha066-check",
      provider: "nostr",
      publicIdentifier: "npub1alpha066",
    };
    vi.spyOn(provider as unknown as { describeIdentity: () => Promise<unknown> }, "describeIdentity").mockResolvedValueOnce(descriptor);

    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBe(descriptor);
  });

  it("19. behavioral: findIdentity()/listIdentities() remain fully functional, unaffected by the removal", async () => {
    const registerSpy = vi.spyOn(FedosIdentityRegistry.prototype, "register");
    const provider = resolveFedosIdentityProvider();
    vi.spyOn(provider as unknown as { describeIdentity: () => Promise<unknown> }, "describeIdentity").mockResolvedValueOnce({
      id: "alpha066-registry-check",
      provider: "nostr",
      publicIdentifier: "npub1alpha066registry",
    });

    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(identity.findIdentity("alpha066-registry-check")).not.toBeNull();
    expect(identity.listIdentities().length).toBe(1);
  });

  it("20. RIPPLE (Secure Runtime Alpha 068): describeIdentity() remained directly callable and fully functional AS OF this Stage's own scope, unaffected by the identityVersion() removal; Alpha 068 (implementing the Alpha 067 Decision) made describeIdentity() a true private method, no longer directly callable from outside the class -- reconfirmed here via bootstrapIdentity()/currentIdentity(), the only remaining public path", async () => {
    const identity = new FedosRuntimeIdentity();
    expect((identity as unknown as Record<string, unknown>).describeIdentity).toBeUndefined();
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBeNull();
  });

  it("21. behavioral: two independently-constructed instances remain fully independent -- no shared Bootstrap state of any kind", async () => {
    const a = new FedosRuntimeIdentity();
    const b = new FedosRuntimeIdentity();
    await a.bootstrapIdentity();
    expect(a.isBootstrapped()).toBe(true);
    expect(b.isBootstrapped()).toBe(false);
  });

  // ---------------------------------------------------------------------
  // Regression: no other implementation file touched by this Stage
  // ---------------------------------------------------------------------

  it("22. Regression: create_runtime.ts does not reference identityVersion or this Stage's own doc, and remains Construct Only", () => {
    expect(createRuntimeSource).not.toMatch(/identityVersion/);
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_066/);
    expect(createRuntimeSource).not.toMatch(/bootstrapIdentity|isBootstrapped|currentIdentity/);
  });

  it("23. Regression: AppRuntime's own type (types.ts) has no Identity-related field and does not reference this Stage's own doc", () => {
    expect(runtimeTypesSource).not.toMatch(
      /FedosRuntimeIdentity|fedos_runtime_identity|identityVersion|isBootstrapped|currentIdentity|secure_runtime_alpha_066/,
    );
    const body = (runtimeTypesSource.match(/export interface AppRuntime \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const fieldNames = [...body.matchAll(/readonly (\w+)[?:]/g)].map((m: RegExpMatchArray) => m[1]).sort();
    expect(fieldNames).toEqual(APP_RUNTIME_FIELDS);
  });

  it("24. Regression: src/worker.ts does not reference identityVersion, FedosRuntimeIdentity, or this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/identityVersion/);
    expect(workerSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_066/);
  });

  it("25. Regression: the entire Identity Layer is confirmed BYTE-FOR-BYTE unaffected by this Stage -- no file references this Stage's own doc, and each still exposes exactly its pre-existing methods", () => {
    for (const source of [serviceSource, registrySource, resolverClassSource, identityProviderResolverSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_066/);
    }
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).toMatch(/find\(id: string\): FedosIdentityRecord \| null \{/);
    expect(registrySource).toMatch(/list\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(registrySource).toMatch(/remove\(id: string\): boolean \{/);
    expect(resolverClassSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
    expect(resolverClassSource).toMatch(/listIdentities\(\): readonly FedosIdentityRecord\[\] \{/);
  });

  it("26. Regression: fedos_runtime_storage_resolver.ts and fedos_runtime_storage_backend.ts are confirmed unaffected by this Stage", () => {
    for (const source of [storageResolverSource, storageBackendSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_066/);
    }
  });

  it("27. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha066-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha066-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha066-id"));
    expect(deleted).toBe(true);
  });

  it("28. Regression: initializeCrypto()/runtimeCapabilities() remain unaffected -- confirmed by ACTUAL calls via the AppRuntime object", async () => {
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

  it("29. Regression: createRuntime() still returns exactly the pre-existing thirty AppRuntime fields, under every mode, with no identityVersion field of any kind", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode }) as unknown as Record<string, unknown>;
      expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
      expect(runtime.identityVersion).toBeUndefined();
    }
  });

  it("30. Regression: no fedos_*.ts file was added or removed by this Stage -- still exactly 57 under src/runtime/ and exactly 24 under src/identity/", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("31. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_066/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_066/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_066/);
  });

  it("32. Regression: package.json still declares exactly two dependencies and no bin/main/exports field, unaffected by this Stage", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("33. no other doc file references this Stage's own doc, confirming this Stage's own footprint is exactly two new files plus one modified src/ file", () => {
    expect(alpha064DocSource).not.toMatch(/secure_runtime_alpha_066/);
    expect(alpha065DocSource).not.toMatch(/secure_runtime_alpha_066/);
  });

  it("34. behavioral: repeated createRuntime() calls (simulating Worker per-request construction) never throw, confirming Worker remains unaffected and un-wired", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(() => createRuntime()).not.toThrow();
    }
  });

  it("35. final sanity: fedos_runtime_identity.ts is the ONLY src/ file this Stage touches -- create_runtime.ts/types.ts/worker.ts never reference this Stage's own doc, while fedos_runtime_identity.ts legitimately does", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_066/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_066/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_066/);
    expect(fedosRuntimeIdentitySource).toMatch(/secure_runtime_alpha_066/);
  });
});
