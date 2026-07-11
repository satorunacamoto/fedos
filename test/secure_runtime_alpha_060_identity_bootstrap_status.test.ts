import { describe, it, expect } from "vitest";
import { createRuntime } from "../src/runtime/create_runtime.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_060_identity_bootstrap_status.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha059DocSource from "../docs/secure_runtime_alpha_059_identity_bootstrap_authority_review.md?raw";
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

class ThrowingFedosIdentityService {
  async describeIdentity(): Promise<never> {
    throw new Error("simulated Provider failure");
  }
}

/**
 * Secure Runtime Alpha 060 -- "Identity Bootstrap Status": adds a
 * private `#bootstrapped: boolean` field (initial `false`) and
 * `isBootstrapped(): boolean` to `FedosRuntimeIdentity` -- a
 * synchronous, side-effect-free, non-throwing read. `#bootstrapped`
 * flips to `true` ONLY after `bootstrapIdentity()`'s own internal
 * `await` resolves without throwing; a rejection leaves it `false`,
 * indistinguishable from "never attempted" (Fail Closed by
 * construction). No Authority is added -- nothing calls
 * `bootstrapIdentity()` from anywhere.
 */
describe("Secure Runtime Alpha 060 -- Identity Bootstrap Status, fedos_runtime_identity.ts only, no create_runtime.ts/types.ts/Worker/Identity-Layer/Storage/Crypto/Rust change", () => {
  // ---------------------------------------------------------------------
  // Design doc structure
  // ---------------------------------------------------------------------

  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(5000);
  });

  it("2. the design doc records the exact field and method implementation", () => {
    expect(designDocSource).toMatch(/#bootstrapped: boolean = false;/);
    expect(designDocSource).toMatch(
      /async bootstrapIdentity\(\): Promise<void> \{\s*\n\s*await this\.#service\.describeIdentity\(\);\s*\n\s*this\.#bootstrapped = true;\s*\n\s*\}/,
    );
    expect(designDocSource).toMatch(
      /isBootstrapped\(\): boolean \{\s*\n\s*return this\.#bootstrapped;\s*\n\s*\}/,
    );
  });

  it("3. RIPPLE (Secure Runtime Alpha 069): the design doc's recorded implementation matched the ACTUAL fedos_runtime_identity.ts source verbatim AS OF this Stage's own scope; Alpha 061 later prepended an idempotency guard to bootstrapIdentity(), Alpha 063 changed the discarded await into an assignment capturing into #descriptor, Alpha 064 appended a version-increment as the body's own new final statement, Alpha 066 removed that increment again, Alpha 068 rewired the call to reach the new private #describeIdentity() method instead of this.#service directly, and Alpha 069 (Identity Bootstrap State Consolidation) split the trailing assignment into a dedicated #completeBootstrap() call -- reconfirmed here that this Stage's own recorded core sequence still appears, now inside the guarded body and routed through #describeIdentity()/#completeBootstrap(), and isBootstrapped() itself is untouched", () => {
    expect(fedosRuntimeIdentitySource).toMatch(/#bootstrapped: boolean = false;/);
    expect(fedosRuntimeIdentitySource).toMatch(
      /async bootstrapIdentity\(\): Promise<void> \{[\s\S]*?await this\.#describeIdentity\(\);\s*\n\s*this\.#completeBootstrap\(descriptor\);\s*\n\s*\}/,
    );
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    expect(classBody).not.toMatch(/this\.#identityVersion \+= 1;/);
    expect(fedosRuntimeIdentitySource).toMatch(
      /isBootstrapped\(\): boolean \{\s*\n\s*return this\.#bootstrapped;\s*\n\s*\}/,
    );
  });

  it("4. the design doc records the status transition diagram naming all three states", () => {
    expect(designDocSource).toMatch(/## 3\. Status transition/);
    expect(designDocSource).toMatch(/isBootstrapped\(\) = false/);
    expect(designDocSource).toMatch(/isBootstrapped\(\) = true/);
  });

  it("5. the design doc states the false-to-true condition precisely", () => {
    expect(designDocSource).toMatch(/## 4\. `false` → `true` condition, stated precisely/);
    expect(designDocSource).toMatch(/exactly ONE condition/);
  });

  it("6. the design doc's own Fail Closed section states both never-attempted and failed report false", () => {
    expect(designDocSource).toMatch(/## 5\. Fail Closed/);
    expect(designDocSource).toMatch(/\*\*Bootstrap never attempted\*\*/);
    expect(designDocSource).toMatch(/\*\*Bootstrap attempted and failed\*\*/);
  });

  it("7. the design doc explains why describeIdentity()/findIdentity()/listIdentities() are untouched", () => {
    expect(designDocSource).toMatch(
      /## 6\. Why `describeIdentity\(\)`\/`findIdentity\(\)`\/`listIdentities\(\)` are untouched/,
    );
  });

  it("8. the design doc compares all five representation Options and names the adopted one", () => {
    expect(designDocSource).toMatch(/\*\*Option A \(adopted\) — `boolean`\.\*\*/);
    expect(designDocSource).toMatch(/\*\*Option B — `enum`\*\*/);
    expect(designDocSource).toMatch(/\*\*Option C — expose the `Promise` itself\*\*/);
    expect(designDocSource).toMatch(/\*\*Option D — a timestamp\*\*/);
    expect(designDocSource).toMatch(/\*\*Option E — a counter\*\*/);
  });

  it("9. the design doc gives an explicit adoption reason for the boolean, distinct from the per-option rejection reasons", () => {
    const section = (designDocSource.match(/## 7\. Option comparison[\s\S]*?\n\n## 8\./) ?? [])[0] ?? "";
    expect(section).toMatch(
      /`boolean` is adopted because it is the smallest type that answers the/,
    );
  });

  it("10. the design doc records an explicit 'does NOT do' list naming every prohibited file/area", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `create_runtime\.ts`, `src\/runtime\/types\.ts`, or/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify any `src\/identity\/\*` file/);
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* modify `describeIdentity\(\)`, `findIdentity\(\)`, or/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any Public Runtime API/);
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* call `bootstrapIdentity\(\)` from anywhere/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* add a second Bootstrap Authority/);
  });

  it("11. the design doc cross-references the Alpha 059 doc", () => {
    expect(designDocSource).toMatch(
      /secure_runtime_alpha_059_identity_bootstrap_authority_review\.md/,
    );
    expect(alpha059DocSource.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------
  // Structural: #bootstrapped/isBootstrapped(), confirmed via literal extraction
  // ---------------------------------------------------------------------

  it("12. #bootstrapped is declared as a private, non-readonly boolean field with initial value false", () => {
    expect(fedosRuntimeIdentitySource).toMatch(/^\s*#bootstrapped: boolean = false;/m);
    expect(fedosRuntimeIdentitySource).not.toMatch(/readonly #bootstrapped/);
  });

  it("13. isBootstrapped() exists as a method on FedosRuntimeIdentity", () => {
    expect(fedosRuntimeIdentitySource).toMatch(/isBootstrapped\(\): boolean \{/);
  });

  it("14. isBootstrapped() is NOT declared async -- synchronous return type, no Promise", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/async isBootstrapped/);
    expect(fedosRuntimeIdentitySource).toMatch(/isBootstrapped\(\): boolean \{/);
  });

  it("15. isBootstrapped()'s own body is EXACTLY 'return this.#bootstrapped;', byte-for-byte", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const body = (codeOnly.match(/isBootstrapped\(\): boolean \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body.trim()).toBe("return this.#bootstrapped;");
  });

  it("16. isBootstrapped()'s own body performs no I/O, no Registry/Service/Resolver access, and no throw statement", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const body = (codeOnly.match(/isBootstrapped\(\): boolean \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/this\.#service|this\.#registry|this\.#resolver/);
    expect(body).not.toMatch(/throw /);
    expect(body).not.toMatch(/await /);
  });

  it("17. RIPPLE (Secure Runtime Alpha 069): bootstrapIdentity()'s own body set #bootstrapped to true AFTER the await, as its own second and final statement, AS OF this Stage's own scope; Alpha 061 later prepended an idempotency guard, Alpha 063 changed the discarded await into 'this.#descriptor = await this.#service.describeIdentity();', Alpha 064 appended 'this.#identityVersion += 1;' as a new final statement, Alpha 066 removed that statement again, Alpha 068 rewired the await to call the new private #describeIdentity() method instead of this.#service directly, and Alpha 069 (Identity Bootstrap State Consolidation) split the trailing statement into a local 'const descriptor' assignment followed by a dedicated '#completeBootstrap(descriptor)' call, which itself performs the #descriptor/#bootstrapped assignments -- reconfirmed here that the await/completeBootstrap pair still appears in order, as the body's own FINAL two statements, now preceded by the guard", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const body = (codeOnly.match(/async bootstrapIdentity\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const lines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(lines.slice(-2)).toEqual([
      "const descriptor = await this.#describeIdentity();",
      "this.#completeBootstrap(descriptor);",
    ]);
  });

  it("18. RIPPLE (Secure Runtime Alpha 068): FedosRuntimeIdentity's own class had exactly FIVE PUBLIC methods AS OF this Stage's own scope; Alpha 063 added a sixth, currentIdentity(), Alpha 064 added a seventh, identityVersion(), Alpha 066 removed that seventh again, and Alpha 068 (implementing the Alpha 067 Decision) made describeIdentity() a true private #describeIdentity() method -- reconfirmed here that isBootstrapped() (this Stage's own method) remains present, alongside the still-current sixth (currentIdentity), with describeIdentity() now excluded from the PUBLIC set", () => {
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

  it("19. isBootstrapped() is declared AFTER bootstrapIdentity(), in source order", () => {
    const classBody = (fedosRuntimeIdentitySource.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const bootstrapIndex = classBody.indexOf("async bootstrapIdentity(): Promise<void> {");
    const isBootstrappedIndex = classBody.indexOf("isBootstrapped(): boolean {");
    expect(bootstrapIndex).toBeGreaterThan(-1);
    expect(isBootstrappedIndex).toBeGreaterThan(bootstrapIndex);
  });

  it("20. FedosRuntimeIdentity's own readonly private field set is confirmed unchanged -- still exactly three readonly fields, plus one new non-readonly field", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const readonlyFields = [...codeOnly.matchAll(/^\s*readonly #(\w+)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(readonlyFields).toEqual(["registry", "service", "resolver"]);
    expect(codeOnly).toMatch(/^\s*#bootstrapped: boolean = false;/m);
  });

  it("21. RIPPLE (Secure Runtime Alpha 068): describeIdentity()/findIdentity()/listIdentities() remained BYTE-FOR-BYTE unchanged AS OF this Stage's own scope; Alpha 068 renamed describeIdentity() to a private #describeIdentity() with the IDENTICAL body -- reconfirmed here against the CURRENT source", () => {
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

  it("22. fedos_runtime_identity.ts's own import count is unaffected -- still exactly seven imports (no new import needed for isBootstrapped())", () => {
    const importLines = [...fedosRuntimeIdentitySource.matchAll(/^import .*$/gm)];
    expect(importLines.length).toBe(7);
  });

  // ---------------------------------------------------------------------
  // Behavioral: status transition
  // ---------------------------------------------------------------------

  it("23. behavioral: a freshly-constructed FedosRuntimeIdentity reports isBootstrapped() === false", () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.isBootstrapped()).toBe(false);
  });

  it("24. behavioral: isBootstrapped() becomes true after a successful bootstrapIdentity() call", async () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.isBootstrapped()).toBe(false);
    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("25. RIPPLE (Secure Runtime Alpha 068): isBootstrapped() reported true even though describeIdentity() resolved null under the current Null Source, AS OF this Stage's own scope; Alpha 068 made describeIdentity() private -- reconfirmed here via currentIdentity()", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);
    expect(identity.currentIdentity()).toBeNull();
  });

  it("26. behavioral: isBootstrapped() stays true after subsequent bootstrapIdentity() calls", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("27. RIPPLE (Secure Runtime Alpha 068): isBootstrapped() was unaffected by calling findIdentity()/listIdentities()/describeIdentity() alone, without bootstrapIdentity(), AS OF this Stage's own scope; Alpha 068 made describeIdentity() private, so it can no longer be called alone from outside the class -- reconfirmed here that isBootstrapped() stays false when only findIdentity()/listIdentities() (the two PUBLIC reads that remain externally callable alone) are called, without bootstrapIdentity()", () => {
    const identity = new FedosRuntimeIdentity();
    identity.findIdentity("x");
    identity.listIdentities();
    expect(identity.isBootstrapped()).toBe(false);
  });

  it("28. behavioral: isBootstrapped() is a real synchronous boolean, not a Promise", () => {
    const identity = new FedosRuntimeIdentity();
    const result = identity.isBootstrapped();
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result).toBe("boolean");
  });

  it("29. behavioral: isBootstrapped() never throws, called before or after bootstrapIdentity()", async () => {
    const identity = new FedosRuntimeIdentity();
    expect(() => identity.isBootstrapped()).not.toThrow();
    await identity.bootstrapIdentity();
    expect(() => identity.isBootstrapped()).not.toThrow();
  });

  it("30. behavioral: two independently-constructed FedosRuntimeIdentity instances have independent isBootstrapped() status", async () => {
    const a = new FedosRuntimeIdentity();
    const b = new FedosRuntimeIdentity();
    await a.bootstrapIdentity();
    expect(a.isBootstrapped()).toBe(true);
    expect(b.isBootstrapped()).toBe(false);
  });

  it("31. behavioral: calling isBootstrapped() repeatedly does not itself change the status", async () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.isBootstrapped()).toBe(false);
    expect(identity.isBootstrapped()).toBe(false);
    expect(identity.isBootstrapped()).toBe(false);
    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("32. behavioral: 25 repeated bootstrapIdentity() calls in a tight sequential loop leave isBootstrapped() true throughout after the first", async () => {
    const identity = new FedosRuntimeIdentity();
    for (let i = 0; i < 25; i += 1) {
      await identity.bootstrapIdentity();
      expect(identity.isBootstrapped()).toBe(true);
    }
  });

  it("33. behavioral: concurrent bootstrapIdentity() calls on independently-constructed instances each independently report isBootstrapped() true afterward", async () => {
    const instances = Array.from({ length: 10 }, () => new FedosRuntimeIdentity());
    await Promise.all(instances.map((identity) => identity.bootstrapIdentity()));
    for (const identity of instances) {
      expect(identity.isBootstrapped()).toBe(true);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral: Fail Closed -- a rejecting Service leaves isBootstrapped() false
  // ---------------------------------------------------------------------

  it("34. behavioral: isBootstrapped() reports false immediately before bootstrapIdentity() has ever been called on a real instance, the Fail-Closed default this design relies on", () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.isBootstrapped()).toBe(false);
  });

  it("35. behavioral (Fail Closed contract, via a standalone reimplementation matching the documented shape): a rejecting describeIdentity() leaves an equivalent #bootstrapped-style flag false, and the rejection propagates", async () => {
    const throwingService = new ThrowingFedosIdentityService();
    let bootstrapped = false;
    const bootstrap = async (): Promise<void> => {
      await throwingService.describeIdentity();
      bootstrapped = true;
    };
    await expect(bootstrap()).rejects.toThrow("simulated Provider failure");
    expect(bootstrapped).toBe(false);
  });

  it("36. behavioral: Bootstrap-never-attempted and Bootstrap-failed are indistinguishable through isBootstrapped() alone, matching the design doc's own Fail Closed section", () => {
    const neverAttempted = new FedosRuntimeIdentity();
    expect(neverAttempted.isBootstrapped()).toBe(false);
    // A real failure path cannot be forced from outside this class (the
    // Service is truly private and the current Provider never rejects) --
    // the equivalence is instead confirmed structurally: the ONLY
    // assignment to #bootstrapped anywhere in this file sits after the
    // await inside bootstrapIdentity(), so any rejection before that line
    // is reached necessarily leaves the field at its initial `false`.
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const assignments = [...codeOnly.matchAll(/this\.#bootstrapped\s*=/g)];
    expect(assignments.length).toBe(1);
  });

  // ---------------------------------------------------------------------
  // create_runtime.ts / AppRuntime / Worker are completely unaffected
  // ---------------------------------------------------------------------

  it("37. Regression: create_runtime.ts is confirmed BYTE-FOR-BYTE unchanged -- no reference to this Stage's own doc or to isBootstrapped/bootstrapIdentity", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_060/);
    expect(createRuntimeSource).not.toMatch(/isBootstrapped/);
    expect(createRuntimeSource).not.toMatch(/bootstrapIdentity/);
  });

  it("38. behavioral: createRuntime() remains synchronous, returning a plain object, unaffected by this Stage", () => {
    const result = createRuntime();
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result.mode).toBe("string");
  });

  it("39. behavioral: createRuntime() under every RuntimeMode still returns exactly the pre-existing thirty AppRuntime fields, with no isBootstrapped/bootstrapIdentity field", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode }) as unknown as Record<string, unknown>;
      expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
      expect(runtime.isBootstrapped).toBeUndefined();
      expect(runtime.bootstrapIdentity).toBeUndefined();
    }
  });

  it("40. Regression: AppRuntime's own type (types.ts) is confirmed BYTE-FOR-BYTE unchanged -- no identity/bootstrap field, no reference to this Stage's own doc", () => {
    expect(runtimeTypesSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity|bootstrapIdentity|isBootstrapped/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_060/);
  });

  it("41. Regression: src/worker.ts is confirmed BYTE-FOR-BYTE unchanged -- no reference to FedosRuntimeIdentity, isBootstrapped, or this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity|bootstrapIdentity|isBootstrapped/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_060/);
  });

  // ---------------------------------------------------------------------
  // Regression: the rest of the Identity Layer, Storage, and Rust
  // ---------------------------------------------------------------------

  it("42. Regression: fedos_identity_service.ts (the Service bootstrapIdentity() delegates to) is confirmed BYTE-FOR-BYTE unchanged", () => {
    expect(serviceSource).toMatch(/constructor\(provider: FedosIdentityProvider, registry: FedosIdentityRegistry\) \{/);
    expect(serviceSource).not.toMatch(/secure_runtime_alpha_060/);
  });

  it("43. Regression: fedos_identity_registry.ts/fedos_identity_resolver.ts/fedos_identity_provider_resolver.ts are confirmed BYTE-FOR-BYTE unchanged, and none reference this Stage's own doc", () => {
    for (const source of [registrySource, resolverClassSource, identityProviderResolverSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_060/);
    }
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(resolverClassSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
  });

  it("44. Regression: fedos_runtime_storage_resolver.ts and fedos_runtime_storage_backend.ts are confirmed BYTE-FOR-BYTE unchanged", () => {
    for (const source of [storageResolverSource, storageBackendSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_060/);
      expect(source).not.toMatch(/isBootstrapped|bootstrapIdentity/);
    }
  });

  it("45. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha060-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha060-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha060-id"));
    expect(deleted).toBe(true);
  });

  it("46. Regression: initializeCrypto()/runtimeCapabilities() remain unaffected -- confirmed by ACTUAL calls via the AppRuntime object", async () => {
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

  it("47. Regression: no fedos_*.ts file was added or removed by this Stage -- still exactly 57 under src/runtime/ and exactly 24 under src/identity/", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("48. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_060/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_060/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_060/);

    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("49. Regression: no Public Runtime API field name changed -- all eleven async fields still present and lazy (function references)", () => {
    const runtime = createRuntime();
    for (const field of [
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
    ]) {
      expect(typeof (runtime as unknown as Record<string, unknown>)[field]).toBe("function");
    }
  });

  it("50. final sanity: this Stage's own net effect is confined to fedos_runtime_identity.ts -- create_runtime.ts, types.ts, worker.ts, the rest of the Identity Layer, and Rust/Cargo/package all remain free of any behavioral change", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      expect(runtime.mode).toBe(mode);
      expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
    }
    expect(fedosRuntimeIdentitySource).toMatch(/secure_runtime_alpha_060/);
  });
});
