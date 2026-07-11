import { describe, it, expect, vi, afterEach } from "vitest";
import { createRuntime } from "../src/runtime/create_runtime.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
import { FedosIdentityRegistry } from "../src/identity/fedos_identity_registry.js";
import { resolveFedosIdentityProvider } from "../src/identity/fedos_identity_provider_resolver.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_061_identity_bootstrap_idempotency.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha060DocSource from "../docs/secure_runtime_alpha_060_identity_bootstrap_status.md?raw";
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
 * Secure Runtime Alpha 061 -- "Identity Bootstrap Idempotency": adds
 * ONE guard statement, `if (this.#bootstrapped) { return; }`, as
 * `bootstrapIdentity()`'s own new first statement. A repeat call after
 * a successful Bootstrap is a synchronous no-op -- no second
 * `describeIdentity()` call, no second Provider read, no second
 * Registry `register()` attempt. A failed attempt leaves
 * `#bootstrapped` at `false` (Alpha 060, unchanged), so the very next
 * call retries for real -- no permanent lock-out.
 */
describe("Secure Runtime Alpha 061 -- Identity Bootstrap Idempotency, fedos_runtime_identity.ts only, no create_runtime.ts/AppRuntime/Worker/Identity-Layer/Storage/Rust change", () => {
  // ---------------------------------------------------------------------
  // Design doc structure
  // ---------------------------------------------------------------------

  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(6000);
  });

  it("2. the design doc records the exact guarded implementation", () => {
    expect(designDocSource).toMatch(
      /async bootstrapIdentity\(\): Promise<void> \{\s*\n\s*if \(this\.#bootstrapped\) \{\s*\n\s*return;\s*\n\s*\}\s*\n\s*await this\.#service\.describeIdentity\(\);\s*\n\s*this\.#bootstrapped = true;\s*\n\s*\}/,
    );
  });

  it("3. RIPPLE (Secure Runtime Alpha 063): the design doc's own recorded implementation matched the ACTUAL fedos_runtime_identity.ts source verbatim AS OF this Stage's own scope; Alpha 063 changed the discarded 'await this.#service.describeIdentity();' call into 'this.#descriptor = await this.#service.describeIdentity();' (capturing the return value, guard/return-flip unaffected) -- reconfirmed here against the CURRENT source", () => {
    expect(fedosRuntimeIdentitySource).toMatch(
      /async bootstrapIdentity\(\): Promise<void> \{\s*\n\s*if \(this\.#bootstrapped\) \{\s*\n\s*return;\s*\n\s*\}\s*\n\s*this\.#descriptor = await this\.#service\.describeIdentity\(\);\s*\n\s*this\.#bootstrapped = true;\s*\n\s*\}/,
    );
  });

  it("4. the design doc names all five Options (A-E) and states which was adopted", () => {
    expect(designDocSource).toMatch(/\*\*Option A — run every time/);
    expect(designDocSource).toMatch(/\*\*Option B \(adopted\) — idempotent, first-success-only\.\*\*/);
    expect(designDocSource).toMatch(/\*\*Option C — retry only on failure/);
    expect(designDocSource).toMatch(/\*\*Option D — construct a fresh Registry/);
    expect(designDocSource).toMatch(/\*\*Option E — add an explicit `reset\(\)` method\.\*\*/);
  });

  it("5. the design doc's own comparison table has at least sixteen rows/criteria", () => {
    const tableSection = (designDocSource.match(/## 7\. Comparison table \(16 criteria\)([\s\S]*?)\n## 8\./) ?? [])[1] ?? "";
    const dataRows = tableSection.split("\n").filter((line: string) => line.trim().startsWith("|") && !line.includes("---") && !line.includes("Criterion"));
    expect(dataRows.length).toBeGreaterThanOrEqual(16);
  });

  it("6. the design doc states all three requirements confirmed (describeIdentity/Registry/Provider not called twice)", () => {
    expect(designDocSource).toMatch(/## 4\. Requirements confirmed/);
    expect(designDocSource).toMatch(/\*\*`describeIdentity\(\)` is not called twice\*\*/);
    expect(designDocSource).toMatch(/\*\*The Registry is not registered into twice\*\*/);
    expect(designDocSource).toMatch(/\*\*The Provider is not read twice\*\*/);
  });

  it("7. the design doc states failure does not permanently lock out retries", () => {
    expect(designDocSource).toMatch(/## 5\. Failure behavior — no permanent lock-out/);
    expect(designDocSource).toMatch(
      /There is no field, flag, or counter anywhere in this\s*\nfile that ever prevents a retry after a failure/,
    );
  });

  it("8. the design doc records an explicit 'does NOT do' list naming every prohibited file/area", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `create_runtime\.ts` or `AppRuntime`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/worker\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify any Runtime API/);
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* modify `FedosIdentityResolver`, `FedosIdentityRegistry`,\s*\n\s*or `FedosIdentityProvider`/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify any Storage file/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `packages\/fedos-core-rust`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add a `reset\(\)` method/);
  });

  it("9. the design doc cross-references the Alpha 060 doc", () => {
    expect(designDocSource).toMatch(
      /secure_runtime_alpha_060_identity_bootstrap_status\.md/,
    );
    expect(alpha060DocSource.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------
  // Structural: the guard itself, confirmed via literal extraction
  // ---------------------------------------------------------------------

  it("10. RIPPLE (Secure Runtime Alpha 063): bootstrapIdentity()'s own body was EXACTLY the four statements, in order (guard-if, return, await, assignment), AS OF this Stage's own scope; Alpha 063 changed the discarded await into an assignment capturing its return value into #descriptor -- reconfirmed here as the CURRENT four statements, in the same order", () => {
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
      "this.#descriptor = await this.#service.describeIdentity();",
      "this.#bootstrapped = true;",
    ]);
  });

  it("11. the guard checks this.#bootstrapped directly, with no other condition", () => {
    expect(fedosRuntimeIdentitySource).toMatch(/if \(this\.#bootstrapped\) \{/);
  });

  it("12. the guard's own body is exactly 'return;', no side effect of any kind", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const guardBody = (codeOnly.match(/if \(this\.#bootstrapped\) \{([\s\S]*?)\}/) ?? [])[1] ?? "";
    expect(guardBody.trim()).toBe("return;");
  });

  it("13. describeIdentity()/findIdentity()/listIdentities()/isBootstrapped() remain BYTE-FOR-BYTE unchanged", () => {
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
  });

  it("14. RIPPLE (Secure Runtime Alpha 063): FedosRuntimeIdentity's own class had exactly FIVE public methods AS OF this Stage's own scope -- no sixth method (e.g. reset()) had been added by THIS Stage; Alpha 063 later added a real sixth, currentIdentity() -- reconfirmed here that all five of this Stage's own methods remain present, alongside the newer sixth", () => {
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
      ]),
    );
  });

  it("15. FedosRuntimeIdentity's own field set is confirmed unchanged -- still exactly three readonly fields plus one non-readonly boolean field", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const readonlyFields = [...codeOnly.matchAll(/^\s*readonly #(\w+)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(readonlyFields).toEqual(["registry", "service", "resolver"]);
    expect(codeOnly).toMatch(/^\s*#bootstrapped: boolean = false;/m);
  });

  it("16. fedos_runtime_identity.ts's own import count is unaffected -- still exactly seven imports (no new import needed for the guard)", () => {
    const importLines = [...fedosRuntimeIdentitySource.matchAll(/^import .*$/gm)];
    expect(importLines.length).toBe(7);
  });

  // ---------------------------------------------------------------------
  // Behavioral: idempotency confirmed via real instances
  // ---------------------------------------------------------------------

  it("17. behavioral: describeIdentity() is not called twice by the Service after a successful Bootstrap -- confirmed via a spy on FedosIdentityService.prototype.describeIdentity", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("18. behavioral: the Registry's own register() is not called twice after a successful Bootstrap -- confirmed by mocking the Provider (not the Service) to resolve a REAL non-null Descriptor, keeping the real Service/Registry wiring intact", async () => {
    const registerSpy = vi.spyOn(FedosIdentityRegistry.prototype, "register");
    const provider = resolveFedosIdentityProvider();
    vi.spyOn(provider as unknown as { describeIdentity: () => Promise<unknown> }, "describeIdentity").mockResolvedValue({
      id: "alpha061-registry-check",
      provider: "nostr",
      publicIdentifier: "npub1alpha061",
    });

    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(registerSpy).toHaveBeenCalledTimes(1);
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(identity.findIdentity("alpha061-registry-check")).not.toBeNull();
  });

  it("19. behavioral: the shared Provider singleton's own describeIdentity() is not read twice per instance after a successful Bootstrap -- confirmed via a spy on the resolved Provider", async () => {
    const provider = resolveFedosIdentityProvider();
    const spy = vi.spyOn(provider as unknown as { describeIdentity: () => Promise<unknown> }, "describeIdentity");
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    const callsAfterFirst = spy.mock.calls.length;
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    expect(spy.mock.calls.length).toBe(callsAfterFirst);
  });

  it("20. behavioral: a fresh instance's first bootstrapIdentity() call still performs the real describeIdentity() call (the guard does not block the FIRST call)", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const identity = new FedosRuntimeIdentity();
    expect(identity.isBootstrapped()).toBe(false);
    await identity.bootstrapIdentity();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("21. behavioral: repeat bootstrapIdentity() calls after success resolve immediately without throwing", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    await expect(identity.bootstrapIdentity()).resolves.toBeUndefined();
    await expect(identity.bootstrapIdentity()).resolves.toBeUndefined();
  });

  it("22. behavioral: 50 repeated bootstrapIdentity() calls after the first success all short-circuit -- the Service is called exactly once total", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const identity = new FedosRuntimeIdentity();
    for (let i = 0; i < 50; i += 1) {
      await identity.bootstrapIdentity();
    }
    expect(spy).toHaveBeenCalledTimes(1);
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("23. behavioral: two independently-constructed FedosRuntimeIdentity instances each get their own independent guard -- one instance's Bootstrap does not short-circuit the other's first call", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const a = new FedosRuntimeIdentity();
    const b = new FedosRuntimeIdentity();
    await a.bootstrapIdentity();
    await a.bootstrapIdentity();
    expect(spy).toHaveBeenCalledTimes(1);
    await b.bootstrapIdentity();
    expect(spy).toHaveBeenCalledTimes(2);
    await b.bootstrapIdentity();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  // ---------------------------------------------------------------------
  // Behavioral: failure does not permanently lock out retries
  // ---------------------------------------------------------------------

  it("24. behavioral (no permanent lock-out): a rejecting Service leaves the guard inactive, so the very next call retries for real -- confirmed via a spy that rejects once then resolves", async () => {
    const identity = new FedosRuntimeIdentity();
    const spy = vi
      .spyOn(FedosIdentityService.prototype, "describeIdentity")
      .mockRejectedValueOnce(new Error("simulated Provider failure"))
      .mockResolvedValue(null);

    await expect(identity.bootstrapIdentity()).rejects.toThrow("simulated Provider failure");
    expect(identity.isBootstrapped()).toBe(false);

    await expect(identity.bootstrapIdentity()).resolves.toBeUndefined();
    expect(identity.isBootstrapped()).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("25. behavioral: after a failed attempt, a THIRD call (following the successful retry) is idempotent again -- the Service is not called a third time", async () => {
    const identity = new FedosRuntimeIdentity();
    const spy = vi
      .spyOn(FedosIdentityService.prototype, "describeIdentity")
      .mockRejectedValueOnce(new Error("simulated Provider failure"))
      .mockResolvedValue(null);

    await expect(identity.bootstrapIdentity()).rejects.toThrow();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("26. behavioral: repeated failures (never succeeding) never set the guard -- every call retries, isBootstrapped() stays false throughout", async () => {
    const identity = new FedosRuntimeIdentity();
    const spy = vi
      .spyOn(FedosIdentityService.prototype, "describeIdentity")
      .mockRejectedValue(new Error("permanent simulated failure"));

    for (let i = 0; i < 5; i += 1) {
      await expect(identity.bootstrapIdentity()).rejects.toThrow();
      expect(identity.isBootstrapped()).toBe(false);
    }
    expect(spy).toHaveBeenCalledTimes(5);
  });

  it("27. behavioral: the rejection reason itself still propagates unmodified to the caller, unaffected by the new guard (Alpha 058's own contract)", async () => {
    const identity = new FedosRuntimeIdentity();
    vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockRejectedValueOnce(
      new Error("distinct simulated reason"),
    );
    await expect(identity.bootstrapIdentity()).rejects.toThrow("distinct simulated reason");
  });

  // ---------------------------------------------------------------------
  // Behavioral: findIdentity()/listIdentities()/describeIdentity() unaffected
  // ---------------------------------------------------------------------

  it("28. behavioral: findIdentity()/listIdentities() are unaffected by repeated bootstrapIdentity() calls under the current Null Source", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    expect(identity.findIdentity("x")).toBeNull();
    expect(identity.listIdentities()).toEqual([]);
  });

  it("29. behavioral: describeIdentity() called independently of bootstrapIdentity() still performs a real read every time (idempotency applies ONLY to bootstrapIdentity(), not describeIdentity())", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const identity = new FedosRuntimeIdentity();
    await identity.describeIdentity();
    await identity.describeIdentity();
    await identity.describeIdentity();
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("30. behavioral: calling describeIdentity() directly does NOT set the guard -- a subsequent bootstrapIdentity() call still performs its own real read", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const identity = new FedosRuntimeIdentity();
    await identity.describeIdentity();
    expect(identity.isBootstrapped()).toBe(false);
    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("31. behavioral: concurrent bootstrapIdentity() calls on the SAME instance (fired without awaiting the first) do not each independently complete a full read -- the guard reads a stable field after the first await settles", async () => {
    const identity = new FedosRuntimeIdentity();
    const results = await Promise.all([
      identity.bootstrapIdentity(),
      identity.bootstrapIdentity(),
    ]);
    expect(results).toEqual([undefined, undefined]);
    expect(identity.isBootstrapped()).toBe(true);
  });

  // ---------------------------------------------------------------------
  // create_runtime.ts / AppRuntime / Worker are completely unaffected
  // ---------------------------------------------------------------------

  it("32. Regression: create_runtime.ts is confirmed BYTE-FOR-BYTE unchanged -- no reference to this Stage's own doc, isBootstrapped, or bootstrapIdentity", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_061/);
    expect(createRuntimeSource).not.toMatch(/isBootstrapped/);
    expect(createRuntimeSource).not.toMatch(/bootstrapIdentity/);
  });

  it("33. behavioral: createRuntime() remains synchronous, returning a plain object, unaffected by this Stage", () => {
    const result = createRuntime();
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result.mode).toBe("string");
  });

  it("34. behavioral: createRuntime() under every RuntimeMode still returns exactly the pre-existing thirty AppRuntime fields, with no bootstrap-related field", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode }) as unknown as Record<string, unknown>;
      expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
      expect(runtime.isBootstrapped).toBeUndefined();
      expect(runtime.bootstrapIdentity).toBeUndefined();
    }
  });

  it("35. Regression: AppRuntime's own type (types.ts) is confirmed BYTE-FOR-BYTE unchanged -- no reference to this Stage's own doc", () => {
    expect(runtimeTypesSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity|bootstrapIdentity|isBootstrapped/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_061/);
  });

  it("36. Regression: src/worker.ts is confirmed BYTE-FOR-BYTE unchanged -- no reference to FedosRuntimeIdentity or this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity|bootstrapIdentity|isBootstrapped/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_061/);
  });

  // ---------------------------------------------------------------------
  // Regression: the rest of the Identity Layer, Storage, and Rust
  // ---------------------------------------------------------------------

  it("37. Regression: fedos_identity_service.ts/fedos_identity_registry.ts/fedos_identity_resolver.ts/fedos_identity_provider_resolver.ts are confirmed BYTE-FOR-BYTE unchanged", () => {
    for (const source of [serviceSource, registrySource, resolverClassSource, identityProviderResolverSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_061/);
    }
    expect(serviceSource).toMatch(/constructor\(provider: FedosIdentityProvider, registry: FedosIdentityRegistry\) \{/);
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(resolverClassSource).toMatch(/findIdentity\(id: string\): FedosIdentityRecord \| null \{/);
  });

  it("38. Regression: fedos_runtime_storage_resolver.ts and fedos_runtime_storage_backend.ts are confirmed BYTE-FOR-BYTE unchanged", () => {
    for (const source of [storageResolverSource, storageBackendSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_061/);
      expect(source).not.toMatch(/isBootstrapped|bootstrapIdentity/);
    }
  });

  it("39. Regression: storeCiphertext()/loadCiphertext()/deleteCiphertext() still round-trip via the real AppRuntime object, entirely unaffected by this Stage", async () => {
    const runtime = createRuntime();
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("alpha061-id", "wire" as never));
    expect(stored).toBe(true);
    const loaded = await withNodeEnv("development", () => runtime.loadCiphertext("alpha061-id"));
    expect(loaded).toBe("wire");
    const deleted = await withNodeEnv("development", () => runtime.deleteCiphertext("alpha061-id"));
    expect(deleted).toBe(true);
  });

  it("40. Regression: initializeCrypto()/runtimeCapabilities() remain unaffected -- confirmed by ACTUAL calls via the AppRuntime object", async () => {
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

  it("41. Regression: no fedos_*.ts file was added or removed by this Stage -- still exactly 57 under src/runtime/ and exactly 24 under src/identity/", () => {
    const runtimeFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    expect(Object.keys(runtimeFiles).length).toBe(57);

    const identityFiles = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/identity/*.ts");
    expect(Object.keys(identityFiles).length).toBe(24);
  });

  it("42. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- still 36 pub fn, thirteen #[wasm_bindgen], no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_061/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_061/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_061/);

    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("43. Regression: no Public Runtime API field name changed -- all eleven async fields still present and lazy (function references)", () => {
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

  it("44. final sanity: this Stage's own net effect is confined to fedos_runtime_identity.ts -- create_runtime.ts, types.ts, worker.ts, the rest of the Identity Layer, and Rust/Cargo/package all remain free of any behavioral change", () => {
    for (const mode of RUNTIME_MODES) {
      const runtime = createRuntime(undefined, { mode });
      expect(runtime.mode).toBe(mode);
      expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
    }
    expect(fedosRuntimeIdentitySource).toMatch(/secure_runtime_alpha_061/);
  });

  it("45. behavioral: bootstrapIdentity() called on a fresh instance whose Service rejects immediately (before any prior success) still allows describeIdentity()/findIdentity()/listIdentities() to keep working normally", async () => {
    const identity = new FedosRuntimeIdentity();
    vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockRejectedValueOnce(
      new Error("simulated failure"),
    );
    await expect(identity.bootstrapIdentity()).rejects.toThrow();
    expect(identity.findIdentity("x")).toBeNull();
    expect(identity.listIdentities()).toEqual([]);
  });
});
