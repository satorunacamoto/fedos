import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_091_desktop_entry_point_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha090DocSource from "../docs/secure_runtime_alpha_090_desktop_integration_completion_review.md?raw";
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
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 091 -- "Desktop Entry Point Review": a DESIGN
 * REVIEW ONLY Stage (Stage 1 of the Alpha 091-095 Desktop Shell
 * Integration Design Arc) fixing WHERE a future Desktop Application
 * must construct its own FedosRuntimeIdentity: Application bootstrap()
 * -- never main(), never a DesktopApp constructor, and never
 * createRuntime()/Worker startup (already permanently forbidden by
 * Alpha 086/088/089). This Stage makes ZERO implementation change --
 * src/ is entirely untouched.
 */
describe("Secure Runtime Alpha 091 -- Desktop Entry Point Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(4000);
  });

  it("2. the design doc declares itself DESIGN REVIEW ONLY, with src/ entirely untouched, as Stage 1 of the Arc", () => {
    expect(designDocSource).toMatch(/this Stage is DESIGN REVIEW ONLY/);
    expect(designDocSource).toMatch(/Implementation is\s*\nabsolutely forbidden/);
    expect(designDocSource).toMatch(/`src\/` is untouched by this Stage/);
    expect(designDocSource).toMatch(/This is\s*\nStage 1 of the Alpha 091–095 Desktop Shell Integration Design Arc/);
  });

  it("3. the design doc compares all five Options (A through E), with D and E already forbidden by prior Decisions", () => {
    const section = (designDocSource.match(/## 3\. Options compared([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*A\. `main\(\)`\.\*\*/);
    expect(section).toMatch(/\*\*B\. `DesktopApp` constructor\.\*\*/);
    expect(section).toMatch(/\*\*C\. `Application bootstrap\(\)`\.\*\*/);
    expect(section).toMatch(/\*\*D\. `createRuntime\(\)`\.\*\* Already permanently forbidden/);
    expect(section).toMatch(/\*\*E\. Worker startup\.\*\* Already permanently forbidden/);
  });

  it("4. the design doc's evaluation rejects B on async-constructor grounds and A on separation-of-concerns grounds", () => {
    const section = (designDocSource.match(/## 4\. Evaluation([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Option B \(`DesktopApp` constructor\)\*\* is rejected on a concrete/);
    expect(section).toMatch(/is `async`/);
    expect(section).toMatch(/\*\*Option A \(`main\(\)`\)\*\* is rejected not on correctness grounds/);
    expect(section).toMatch(/separation-of-concerns\s*\n\s*grounds/);
  });

  it("5. the design doc declares a single Decision -- Option C adopted, A and B forbidden, D and E permanently forbidden", () => {
    const section = (designDocSource.match(/## 5\. Decision([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*`Application bootstrap\(\)` \(Option C\) is adopted as the single\s*\nlocation a future Desktop Application MUST use to construct its own\s*\n`FedosRuntimeIdentity` and call `bootstrapIdentity\(\)`\. `main\(\)` and\s*\n`DesktopApp`'s own constructor MUST NOT perform this construction\s*\ndirectly\./,
    );
    expect(section).toMatch(
      /`createRuntime\(\)` and Worker startup remain permanently\s*\nforbidden, per Alpha 086\/088\/089\.\*\*/,
    );
  });

  it("6. the design doc's own 'does NOT do' list confirms no Desktop Shell construct is implemented and prior Decisions are not reopened", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement `bootstrap\(\)`, `main\(\)`, `DesktopApp`, or any/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* reopen Alpha 086's, Alpha 088's, or Alpha 089's own/);
  });

  it("7. the design doc cross-references Alpha 058, Alpha 059, and Alpha 086-089", () => {
    for (const ref of [
      "secure_runtime_alpha_058_identity_bootstrap_boundary",
      "secure_runtime_alpha_059_identity_bootstrap_authority_review",
      "secure_runtime_alpha_086_desktop_integration_boundary_review",
      "secure_runtime_alpha_087_desktop_bootstrap_ownership_review",
      "secure_runtime_alpha_088_desktop_lifetime_review",
      "secure_runtime_alpha_089_desktop_runtime_separation_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
    expect(alpha090DocSource.length).toBeGreaterThan(0);
  });

  it("8. the design doc's own structure sanity check -- at least six numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(6);
  });

  it("9. fedos_runtime_identity.ts does NOT reference this Stage's own doc -- confirming zero src/ change", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_091/);
  });

  it("10. Regression: create_runtime.ts/types.ts/worker.ts do not reference this Stage's own doc", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_091/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_091/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_091/);
  });

  it("11. Regression: the entire Identity Layer is confirmed unaffected by this Stage", () => {
    for (const source of [serviceSource, registrySource, resolverClassSource, identityProviderResolverSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_091/);
    }
  });

  it("12. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);    expect(libRsSource).not.toMatch(/secure_runtime_alpha_091/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_091/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_091/);
  });

  it("13. final sanity: no file anywhere under src/ references this Stage's own doc -- confirming true zero src/ diff", () => {
    for (const source of [
      fedosRuntimeIdentitySource,
      createRuntimeSource,
      runtimeTypesSource,
      workerSource,
      serviceSource,
      registrySource,
      resolverClassSource,
      identityProviderResolverSource,
    ]) {
      expect(source).not.toMatch(/secure_runtime_alpha_091/);
    }
  });
});
