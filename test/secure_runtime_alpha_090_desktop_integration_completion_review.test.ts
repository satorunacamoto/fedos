import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_090_desktop_integration_completion_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha089DocSource from "../docs/secure_runtime_alpha_089_desktop_runtime_separation_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha085DocSource from "../docs/secure_runtime_alpha_085_identity_bootstrap_observation_framework_completion.md?raw";
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

const DESKTOP_INTEGRATION_ELEMENTS = ["Boundary", "Bootstrap Ownership", "Lifetime", "Runtime Separation"];

/**
 * Secure Runtime Alpha 090 -- "Desktop Integration Completion Review":
 * a REVIEW / DECISION ONLY Stage (Stage 4, the closing Stage, of the
 * Alpha 087-090 Desktop Integration Review Arc) integrating Alpha
 * 086-089, confirming their mutual consistency, and formally declaring
 * the Desktop Integration Design Phase COMPLETE -- frozen until a real
 * Desktop Shell is implemented. This Stage makes ZERO implementation
 * change -- src/ is entirely untouched.
 */
describe("Secure Runtime Alpha 090 -- Desktop Integration Completion Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(4000);
  });

  it("2. the design doc declares itself REVIEW / DECISION ONLY, with src/ entirely untouched, as the closing Stage 4 of the Arc", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DECISION ONLY/);
    expect(designDocSource).toMatch(/`src\/` is untouched by this Stage/);
    expect(designDocSource).toMatch(
      /This is Stage 4, the closing Stage, of the Alpha 087–090\s*\nDesktop Integration Review Arc/,
    );
  });

  it("3. the design doc enumerates all four Desktop Integration Decisions, each mapped to its own Alpha Stage", () => {
    for (const element of DESKTOP_INTEGRATION_ELEMENTS) {
      expect(designDocSource).toContain(element);
    }
    expect(designDocSource).toMatch(/\| 1 \| Alpha 086 \| Boundary \|/);
    expect(designDocSource).toMatch(/\| 2 \| Alpha 087 \| Bootstrap Ownership \|/);
    expect(designDocSource).toMatch(/\| 3 \| Alpha 088 \| Lifetime \|/);
    expect(designDocSource).toMatch(/\| 4 \| Alpha 089 \| Runtime Separation \|/);
  });

  it("4. the design doc's mutual-consistency section confirms no contradiction exists between any pair of the four Decisions", () => {
    const section = (designDocSource.match(/## 3\. Mutual consistency confirmation([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/No contradiction exists between any pair of the four/);
    expect(section).toMatch(/Decision 1 \(Boundary\)/);
    expect(section).toMatch(/Decision 2 \(Ownership\)/);
    expect(section).toMatch(/Decision 3 \(Lifetime\)/);
    expect(section).toMatch(/Decision 4 \(Separation\)/);
  });

  it("5. the design doc issues a formal Completion Declaration with all required elements", () => {
    const section = (designDocSource.match(/## 4\. Completion Declaration([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Desktop Integration Design Phase is hereby declared COMPLETE\.\*\*/);
    expect(section).toMatch(/Alpha 086 through Alpha 089 are frozen as ONE integrated Desktop\s*\n\s*Integration Boundary/);
    expect(section).toMatch(/\*\*No further Desktop Integration Review Stage may be added past\s*\n\s*this one\.\*\*/);
    expect(section).toMatch(/\*\*Design stays frozen until a real Desktop Shell is implemented\.\*\*/);
  });

  it("6. the design doc explicitly relates this Arc's own completion to Alpha 085's own Resumption Condition #1, without claiming Observation resumes", () => {
    const section = (designDocSource.match(/## 5\. Relationship to the Observation Framework's own Completion([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(/directly satisfies Alpha 085's\s*\nown Resumption Condition #1/);
    expect(section).toMatch(/Observation therefore remains frozen \(per Alpha 085\) even\s*\nafter this Arc's own completion, until an actual Desktop Shell exists\s*\nin this repository/);
  });

  it("7. the design doc's own 'does NOT do' list confirms the Observation Framework is untouched and no fifth Desktop Integration Stage is permitted", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* modify anything related to the Observation Framework\s*\n\s*\(Alpha 076–085\)/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* add a fifth Desktop Integration Review Stage/);
  });

  it("8. the design doc cross-references Alpha 085 through Alpha 089", () => {
    for (const ref of [
      "secure_runtime_alpha_085_identity_bootstrap_observation_framework_completion",
      "secure_runtime_alpha_086_desktop_integration_boundary_review",
      "secure_runtime_alpha_087_desktop_bootstrap_ownership_review",
      "secure_runtime_alpha_088_desktop_lifetime_review",
      "secure_runtime_alpha_089_desktop_runtime_separation_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
    expect(alpha089DocSource.length).toBeGreaterThan(0);
    expect(alpha085DocSource.length).toBeGreaterThan(0);
  });

  it("9. the design doc's own structure sanity check -- at least seven numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(7);
  });

  it("10. fedos_runtime_identity.ts does NOT reference this Stage's own doc -- confirming zero src/ change across the entire Arc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_090/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_087/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_088/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_089/);
  });

  it("11. Regression: create_runtime.ts/types.ts/worker.ts do not reference this Stage's own doc or any Arc-stage doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      for (const stage of ["087", "088", "089", "090"]) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
    }
  });

  it("12. Regression: the entire Identity Layer is confirmed unaffected across the whole Arc", () => {
    for (const source of [serviceSource, registrySource, resolverClassSource, identityProviderResolverSource]) {
      for (const stage of ["087", "088", "089", "090"]) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
    }
  });

  it("13. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED across the whole Arc -- no reference to any Arc-stage doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(48);
    for (const stage of ["087", "088", "089", "090"]) {
      expect(libRsSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(cargoTomlSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(packageJsonSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("14. Regression: package.json still declares exactly two dependencies and no bin field, unaffected by this Arc", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("15. final sanity: no file anywhere under src/ references any Arc-stage doc -- confirming true zero src/ diff across all four Stages", () => {
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
      for (const stage of ["087", "088", "089", "090"]) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
    }
  });
});
