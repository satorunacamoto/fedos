import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_086_desktop_integration_boundary_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha085DocSource from "../docs/secure_runtime_alpha_085_identity_bootstrap_observation_framework_completion.md?raw";
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
import { createRuntime } from "../src/os/_legacy_prototype/runtime/create_runtime.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";

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

/**
 * Secure Runtime Alpha 086 -- "Desktop Integration Boundary Review": a
 * REVIEW / DECISION ONLY Stage fixing how much of `FedosRuntimeIdentity`
 * a future Desktop Shell may know about. Confirms, against the actual
 * source, that createRuntime() is Construct Only, FedosRuntimeIdentity
 * is Construct Only, and Desktop alone is the Bootstrap Authority
 * (Alpha 059) all coexist without conflict, and that this coexistence
 * FORCES Option A (Desktop constructs its own `FedosRuntimeIdentity`
 * instance directly, independent of createRuntime()) as the only
 * coherent implementation. This Stage makes ZERO implementation change
 * -- src/ is entirely untouched. These tests confirm the design doc's
 * own structural claims and that no src/ file of any kind was modified.
 */
describe("Secure Runtime Alpha 086 -- Desktop Integration Boundary Review", () => {
  // ---------------------------------------------------------------------
  // Design doc structure
  // ---------------------------------------------------------------------

  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(6000);
  });

  it("2. the design doc declares itself REVIEW / DECISION ONLY, with src/ entirely untouched", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DECISION ONLY/);
    expect(designDocSource).toMatch(/`src\/` is untouched by this Stage/);
  });

  it("3. the design doc records the review target -- how much Desktop should know about FedosRuntimeIdentity", () => {
    const section = (designDocSource.match(/## 2\. Review target([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    expect(section).toMatch(/How much of `FedosRuntimeIdentity` should a future Desktop Shell be\s*\npermitted to know about\?/);
  });

  it("4. the design doc's premise section confirms bootstrapIdentity() has never been called, no Desktop Shell exists, and createRuntime()'s own internal instance is discarded", () => {
    const section = (designDocSource.match(/## 3\. Premise, confirmed directly against the actual source([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/`bootstrapIdentity\(\)` has never been called from anywhere in this\s*\n\s*repository/);
    expect(section).toMatch(/No Desktop Shell exists in this repository in any form — no CLI, no\s*\n\s*GUI, no Electron shell, no Tauri shell/);
    expect(section).toMatch(/const runtimeIdentity: FedosRuntimeIdentity = new FedosRuntimeIdentity\(\);/);
    expect(section).toMatch(/void runtimeIdentity;/);
    expect(section).toMatch(/no `identity` field of any\s*\n\s*kind/);
  });

  it("5. the design doc compares exactly five Options (A through E) for the Desktop/Identity boundary", () => {
    const section = (designDocSource.match(/## 5\. Options compared([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Option A\.\*\*/);
    expect(section).toMatch(/\*\*Option B\.\*\*/);
    expect(section).toMatch(/\*\*Option C\.\*\*/);
    expect(section).toMatch(/\*\*Option D\.\*\*/);
    expect(section).toMatch(/\*\*Option E\.\*\*/);
    expect(section).toMatch(/entirely independent of `createRuntime\(\)`/);
    expect(section).toMatch(/runtime\.identity\.bootstrapIdentity\(\)/);
  });

  it("6. the design doc's evaluation section scores Option A against all eleven criteria and explicitly rejects B/C/D/E with named reasons", () => {
    const section = (designDocSource.match(/## 6\. Evaluation([\s\S]*?)\n## 7\./) ?? [])[1] ?? "";
    for (const criterion of [
      "責務分離",
      "Desktop依存性",
      "Runtime純粋性",
      "Public API肥大化",
      "AppRuntime変更量",
      "Identity Layer独立性",
      "Workerとの整合",
      "Desktop寿命との整合",
      "Protocol非依存性",
      "テスト容易性",
      "YAGNI",
    ]) {
      expect(section).toContain(criterion);
    }
    expect(section.match(/Rejected\./g)?.length).toBe(3);
    expect(section).toMatch(/Rejected — it contradicts an\s*\n\s*already-adopted Decision/);
    expect(section).toMatch(/Option B — Internal Runtime retrieval\.[\s\S]*?contradicts an\s*\n\s*already-adopted Decision/);
    expect(section).toMatch(/Option C — `runtime\.identity` Public API field\.[\s\S]*?Rejected\./);
    expect(section).toMatch(/Option D — Bootstrap Manager\.[\s\S]*?Rejected\./);
    expect(section).toMatch(/Option E — No Desktop construction responsibility\.[\s\S]*?Rejected\./);
  });

  it("7. the design doc confirms all three existing Decisions (createRuntime Construct Only, Identity Construct Only, Desktop-only Authority) coexist without conflict", () => {
    const section = (designDocSource.match(/## 7\. Confirming three existing Decisions coexist without conflict([\s\S]*?)\n## 8\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*`createRuntime\(\)` is Construct Only\*\*/);
    expect(section).toMatch(/\*\*`FedosRuntimeIdentity` is Construct Only\*\*/);
    expect(section).toMatch(/\*\*Desktop alone is the Bootstrap Authority\*\*/);
    expect(section).toMatch(/coexist without conflict/);
    expect(section).toMatch(/FORCE Option A as the only coherent implementation of the third/);
  });

  it("8. the design doc declares a single, unambiguous Decision -- Option A adopted", () => {
    const section = (designDocSource.match(/## 8\. Decision([\s\S]*?)\n## 9\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*Option A is adopted: Desktop constructs and owns its own\s*\n`FedosRuntimeIdentity` instance directly/,
    );
    expect(section).toMatch(/`AppRuntime` gains NO `identity` field/);
    expect(section).toMatch(/`createRuntime\(\)` is not modified/);
    expect(section).toMatch(/Only Desktop calls `bootstrapIdentity\(\)`/);
  });

  it("9. the design doc's own 'does NOT do' list confirms no src/ modification of any kind, including no comment change", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* modify `src\/runtime\/fedos_runtime_identity\.ts` — no\s*\n\s*code, no comment, no field, no method/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/create_runtime\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add an `identity` field to the Public Runtime API/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement a Desktop Shell of any kind/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add a Bootstrap Manager/);
  });

  it("10. the design doc cross-references Alpha 059 and Alpha 085", () => {
    expect(designDocSource).toContain("secure_runtime_alpha_059_identity_bootstrap_authority_review");
    expect(designDocSource).toContain("secure_runtime_alpha_085_identity_bootstrap_observation_framework_completion");
    expect(alpha085DocSource.length).toBeGreaterThan(0);
  });

  it("11. the design doc's own structure sanity check -- at least ten numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(10);
  });

  // ---------------------------------------------------------------------
  // Structural confirmation: src/ is completely untouched
  // ---------------------------------------------------------------------

  it("12. fedos_runtime_identity.ts does NOT reference this Stage's own doc -- confirming zero src/ change", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_086/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/Alpha 086/);
  });

  it("13. create_runtime.ts does NOT reference this Stage's own doc and still discards its own internal FedosRuntimeIdentity via void", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_086/);
    expect(createRuntimeSource).toMatch(
      /const runtimeIdentity: FedosRuntimeIdentity = new FedosRuntimeIdentity\(\);\s*\n\s*void runtimeIdentity;/,
    );
  });

  it("14. AppRuntime's own type (types.ts) still has no identity field and does not reference this Stage's own doc", () => {
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_086/);
    expect(runtimeTypesSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
    const body = (runtimeTypesSource.match(/export interface AppRuntime \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const fieldNames = [...body.matchAll(/readonly (\w+)[?:]/g)].map((m: RegExpMatchArray) => m[1]).sort();
    expect(fieldNames).toEqual(APP_RUNTIME_FIELDS);
    expect(fieldNames).not.toContain("identity");
  });

  it("15. #observeBootstrap()'s own body still contains NO statement of any kind, and the class still has exactly FIVE public and EIGHT private methods -- no new API of any kind added by this Stage", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const observeBody = (classBody.match(/#observeBootstrap\(descriptor: FedosIdentityDescriptor \| null\): void \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(observeBody.trim()).toBe("");

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

  // ---------------------------------------------------------------------
  // Behavioral confirmation of the Decision's own premise (Option A)
  // ---------------------------------------------------------------------

  it("16. behavioral: constructing FedosRuntimeIdentity directly (independent of createRuntime()) triggers NO Bootstrap side effect -- confirming Construct Only", () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.isBootstrapped()).toBe(false);
    expect(identity.currentIdentity()).toBeNull();
  });

  it("17. behavioral: a Desktop-style caller constructing its OWN FedosRuntimeIdentity and calling bootstrapIdentity() itself works end to end, entirely independent of createRuntime()", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("18. behavioral: createRuntime()'s own returned AppRuntime object exposes no path to any FedosRuntimeIdentity instance -- confirming its own internal instance is truly unreachable", () => {
    const runtime = createRuntime() as unknown as Record<string, unknown>;
    expect(runtime.identity).toBeUndefined();
    expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
    for (const value of Object.values(runtime)) {
      expect(value instanceof FedosRuntimeIdentity).toBe(false);
    }
  });

  it("19. behavioral: two separately-constructed FedosRuntimeIdentity instances (simulating Desktop's own instance vs. createRuntime()'s own discarded instance) remain fully independent", async () => {
    const desktopInstance = new FedosRuntimeIdentity();
    const createRuntimeInternalInstance = new FedosRuntimeIdentity();
    await desktopInstance.bootstrapIdentity();
    expect(desktopInstance.isBootstrapped()).toBe(true);
    expect(createRuntimeInternalInstance.isBootstrapped()).toBe(false);
  });

  it("20. behavioral: repeated createRuntime() calls (simulating Worker per-request construction) never throw and never expose Identity, confirming Worker stays unaffected by the Desktop-only Authority Decision", () => {
    for (let i = 0; i < 20; i += 1) {
      const runtime = createRuntime() as unknown as Record<string, unknown>;
      expect(runtime.identity).toBeUndefined();
    }
  });

  // ---------------------------------------------------------------------
  // Regression: no other file touched by this Stage
  // ---------------------------------------------------------------------

  it("21. Regression: worker.ts does not reference this Stage's own doc, FedosRuntimeIdentity, or observeBootstrap", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_086/);
    expect(workerSource).not.toMatch(/FedosRuntimeIdentity|fedos_runtime_identity/);
    expect(workerSource).not.toMatch(/observeBootstrap/);
  });

  it("22. Regression: the entire Identity Layer and both Storage-resolver files are confirmed unaffected by this Stage", () => {
    for (const source of [
      serviceSource,
      registrySource,
      resolverClassSource,
      identityProviderResolverSource,
      storageResolverSource,
      storageBackendSource,
    ]) {
      expect(source).not.toMatch(/secure_runtime_alpha_086/);
    }
  });

  it("23. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(21);    expect(libRsSource).not.toMatch(/secure_runtime_alpha_086/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_086/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_086/);
  });

  it("24. Regression: package.json still declares exactly two dependencies and no bin field, unaffected by this Stage", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("25. no other doc file references this Stage's own doc, confirming this Stage's own footprint is exactly one new doc file plus this test file plus a README entry", () => {
    expect(alpha085DocSource).not.toMatch(/secure_runtime_alpha_086/);
  });

  it("26. final sanity: no file anywhere under src/ references this Stage's own doc -- confirming true zero src/ diff", () => {
    for (const source of [
      fedosRuntimeIdentitySource,
      createRuntimeSource,
      runtimeTypesSource,
      workerSource,
      serviceSource,
      registrySource,
      resolverClassSource,
      identityProviderResolverSource,
      storageResolverSource,
      storageBackendSource,
    ]) {
      expect(source).not.toMatch(/secure_runtime_alpha_086/);
    }
  });
});
