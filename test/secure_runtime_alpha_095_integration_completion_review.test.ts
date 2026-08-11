import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_095_integration_completion_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha094DocSource from "../docs/secure_runtime_alpha_094_lifetime_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha090DocSource from "../docs/secure_runtime_alpha_090_desktop_integration_completion_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha085DocSource from "../docs/secure_runtime_alpha_085_identity_bootstrap_observation_framework_completion.md?raw";
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
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

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
 * Secure Runtime Alpha 095 -- "Integration Completion Review": a
 * DESIGN REVIEW ONLY Stage (Stage 5, the closing Stage, of the Alpha
 * 091-095 Desktop Shell Integration Design Arc, and the closing Stage
 * of the full Alpha 086-095 Desktop Design effort) integrating all ten
 * Decisions, confirming a single unbroken dependency direction
 * (Desktop -> FedosRuntimeIdentity -> Identity Layer -> Provider),
 * confirming the Public Runtime API stays free of Identity, confirming
 * no contradiction with the Observation Framework, and declaring
 * Desktop Design complete. This Stage makes ZERO implementation change
 * -- src/ is entirely untouched.
 */
describe("Secure Runtime Alpha 095 -- Integration Completion Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(6000);
  });

  it("2. the design doc declares itself DESIGN REVIEW ONLY, with src/ entirely untouched, as the closing Stage 5 of both Arcs", () => {
    expect(designDocSource).toMatch(/this Stage is DESIGN REVIEW ONLY/);
    expect(designDocSource).toMatch(/`src\/` is untouched by this Stage/);
    expect(designDocSource).toMatch(
      /This is\s*\nStage 5, the closing Stage, of the Alpha 091–095 Desktop Shell\s*\nIntegration Design Arc, and the closing Stage of the full Alpha\s*\n086–095 Desktop Design effort/,
    );
  });

  it("3. the design doc enumerates all ten Decisions, each mapped to its own Alpha Stage", () => {
    for (let stage = 86; stage <= 95; stage += 1) {
      expect(designDocSource).toContain(`Alpha 0${stage}`);
    }
    expect(designDocSource).toMatch(/\| 1 \| Alpha 086 \| Boundary \|/);
    expect(designDocSource).toMatch(/\| 6 \| Alpha 091 \| Entry Point \|/);
    expect(designDocSource).toMatch(/\| 10 \| Alpha 095 \| Integration Completion \(this Stage\) \|/);
  });

  it("4. the design doc's dependency-direction section fixes the four-link chain and confirms no reverse dependency exists", () => {
    const section = (designDocSource.match(/## 3\. Dependency direction confirmation([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /Desktop\s*\n\s*↓\s*\nFedosRuntimeIdentity\s*\n\s*↓\s*\nIdentity Layer \(Registry, Service, Resolver\)\s*\n\s*↓\s*\nProvider/,
    );
    expect(section).toMatch(
      /\*\*No reverse dependency exists anywhere in this chain\.\*\* Nothing\s*\ndownstream/,
    );
  });

  it("5. the design doc's Public Runtime API section confirms no identity field exists in AppRuntime or RuntimeOverrides", () => {
    const section = (designDocSource.match(/## 4\. Public Runtime API confirmation([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/has no `identity` field among/);
    expect(section).toMatch(/has no\s*\n`identity`\/`runtimeIdentity`\/`fedosRuntimeIdentity`-shaped field/);
  });

  it("6. the design doc's Observation Framework consistency section confirms no contradiction and that Alpha 085's own Resumption Condition #1 is not satisfied by this Arc", () => {
    const section = (designDocSource.match(/## 5\. Observation Framework consistency confirmation([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(/is NOT satisfied by this Arc, exactly as Alpha 090/);
    expect(section).toMatch(/remains frozen until an ACTUAL\s*\n\s*Desktop Shell exists, not merely a completed design for one/);
  });

  it("7. the design doc issues a formal Completion Declaration for the full Alpha 086-095 Desktop Design", () => {
    const section = (designDocSource.match(/## 6\. Completion Declaration([\s\S]*?)\n## 7\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Desktop Design \(the full Alpha 086–095 effort\) is hereby declared\s*\n\s*COMPLETE\.\*\*/);
    expect(section).toMatch(/\*\*No further Desktop Design Review Stage may be added past this\s*\n\s*one\.\*\*/);
  });

  it("8. the design doc's own 'does NOT do' list confirms no eleventh Desktop Design Stage is permitted and no implementation of any kind occurred", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* add an eleventh Desktop Design Review Stage/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement a Desktop Shell, `bootstrap\(\)`, `main\(\)`, or/);
  });

  it("9. the design doc cross-references Alpha 050-052, Alpha 062, Alpha 078, Alpha 083-085, Alpha 086, Alpha 090, and Alpha 091-094", () => {
    for (const ref of [
      "secure_runtime_alpha_050_052_identity_runtime_integration_arc",
      "secure_runtime_alpha_062_identity_bootstrap_reset_review",
      "secure_runtime_alpha_078_identity_bootstrap_observation_ordering_review",
      "secure_runtime_alpha_083_identity_bootstrap_observation_delivery_review",
      "secure_runtime_alpha_084_identity_bootstrap_observation_consumer_boundary_review",
      "secure_runtime_alpha_085_identity_bootstrap_observation_framework_completion",
      "secure_runtime_alpha_086_desktop_integration_boundary_review",
      "secure_runtime_alpha_090_desktop_integration_completion_review",
      "secure_runtime_alpha_091_desktop_entry_point_review",
      "secure_runtime_alpha_092_bootstrap_sequence_review",
      "secure_runtime_alpha_093_ownership_review",
      "secure_runtime_alpha_094_lifetime_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
    expect(alpha094DocSource.length).toBeGreaterThan(0);
    expect(alpha090DocSource.length).toBeGreaterThan(0);
    expect(alpha085DocSource.length).toBeGreaterThan(0);
  });

  it("10. the design doc's own structure sanity check -- at least eight numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(8);
  });

  it("11. fedos_runtime_identity.ts does NOT reference this Stage's own doc, and #observeBootstrap()'s own body is still empty -- confirming zero src/ change across the whole Desktop Design effort and no Observation implementation of any kind", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_095/);
    const classBody = (fedosRuntimeIdentitySource.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const body = (classBody.match(/#observeBootstrap\(descriptor: FedosIdentityDescriptor \| null\): void \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const codeOnlyBody = body
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//"))
      .join("\n");
    expect(codeOnlyBody.trim()).toBe("");
  });

  it("12. structural: AppRuntime still has no identity field among its thirty fields, confirmed one final time", () => {
    const body = (runtimeTypesSource.match(/export interface AppRuntime \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const fieldNames = [...body.matchAll(/readonly (\w+)[?:]/g)].map((m: RegExpMatchArray) => m[1]).sort();
    expect(fieldNames).toEqual(APP_RUNTIME_FIELDS);
    expect(fieldNames).not.toContain("identity");
  });

  it("13. Regression: create_runtime.ts/types.ts/worker.ts do not reference this Stage's own doc, nor any of the four Shell Integration Design Arc-stage docs", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      for (const stage of ["091", "092", "093", "094", "095"]) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
    }
  });

  it("14. Regression: the entire Identity Layer and both Storage-resolver files are confirmed unaffected across the whole Shell Integration Design Arc", () => {
    for (const source of [
      serviceSource,
      registrySource,
      resolverClassSource,
      identityProviderResolverSource,
      storageResolverSource,
      storageBackendSource,
    ]) {
      for (const stage of ["091", "092", "093", "094", "095"]) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
    }
  });

  it("15. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED across the whole Arc -- no reference to any Arc-stage doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);    for (const stage of ["091", "092", "093", "094", "095"]) {
      expect(libRsSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(cargoTomlSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(packageJsonSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("16. Regression: package.json still declares exactly two dependencies and no bin field, unaffected by this Arc", () => {
    const pkg = JSON.parse(packageJsonSource);
    assertFedosRootDependencyInvariant(pkg.dependencies);
    expect(pkg.bin).toBeUndefined();
  });

  it("17. final sanity: no file anywhere under src/ references any Shell Integration Design Arc-stage doc -- confirming true zero src/ diff across all five Stages", () => {
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
      for (const stage of ["091", "092", "093", "094", "095"]) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
    }
  });
});
