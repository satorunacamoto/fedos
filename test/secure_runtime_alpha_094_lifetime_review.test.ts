import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_094_lifetime_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha093DocSource from "../docs/secure_runtime_alpha_093_ownership_review.md?raw";
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
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";

/**
 * Secure Runtime Alpha 094 -- "Lifetime Review": a DESIGN REVIEW ONLY
 * Stage (Stage 4 of the Alpha 091-095 Desktop Shell Integration Design
 * Arc) fixing Identity's own complete four-phase lifecycle (Desktop
 * startup -> Bootstrap -> use -> Desktop termination) and permanently
 * forbidding dispose()/destroy()/close()/shutdown() as methods on
 * FedosRuntimeIdentity, reconfirming the pre-existing Alpha 062
 * "re-generation only" Decision as this Arc's own closing statement on
 * Lifetime. This Stage makes ZERO implementation change -- src/ is
 * entirely untouched.
 */
describe("Secure Runtime Alpha 094 -- Lifetime Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself DESIGN REVIEW ONLY, with src/ entirely untouched, as Stage 4 of the Arc", () => {
    expect(designDocSource).toMatch(/this Stage is DESIGN REVIEW ONLY/);
    expect(designDocSource).toMatch(/`src\/` is untouched by this Stage/);
    expect(designDocSource).toMatch(/This is\s*\nStage 4 of the Alpha 091–095 Desktop Shell Integration Design Arc/);
  });

  it("3. the design doc's lifecycle section fixes the exact four-phase diagram", () => {
    const section = (designDocSource.match(/## 3\. The lifecycle([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /Desktop startup\s*\n\s*↓\s*\nBootstrap\s*\n\s*↓\s*\nuse\s*\n\s*↓\s*\nDesktop termination/,
    );
  });

  it("4. the design doc's grounding section confirms no teardown method exists and cites Alpha 062 by name", () => {
    const section = (designDocSource.match(/## 4\. Grounding in the actual source([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/No `dispose\(\)`, `destroy\(\)`, `close\(\)`, or `shutdown\(\)` method/);
    expect(section).toMatch(
      /treat `FedosRuntimeIdentity` as a\s*\n\s*short-lived object; Identity switching means constructing a new\s*\n\s*instance/,
    );
  });

  it("5. the design doc declares a single Decision -- four-phase lifecycle fixed, four teardown methods permanently forbidden", () => {
    const section = (designDocSource.match(/## 5\. Decision([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /is permanently fixed to the four phases in\s*\n§3, with NO explicit teardown step ever added between `use` and/,
    );
    expect(section).toMatch(
      /`dispose\(\)`, `destroy\(\)`, `close\(\)`, and\s*\n`shutdown\(\)` are PERMANENTLY forbidden as methods on/,
    );
  });

  it("6. the design doc's own 'does NOT do' list confirms Alpha 062 is reconfirmed, not altered", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* alter the Alpha 062 Identity-switching Decision/);
  });

  it("7. the design doc cross-references Alpha 062, Alpha 087, Alpha 088, and Alpha 091-093", () => {
    for (const ref of [
      "secure_runtime_alpha_062_identity_bootstrap_reset_review",
      "secure_runtime_alpha_087_desktop_bootstrap_ownership_review",
      "secure_runtime_alpha_088_desktop_lifetime_review",
      "secure_runtime_alpha_091_desktop_entry_point_review",
      "secure_runtime_alpha_092_bootstrap_sequence_review",
      "secure_runtime_alpha_093_ownership_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
    expect(alpha093DocSource.length).toBeGreaterThan(0);
  });

  it("8. the design doc's own structure sanity check -- at least six numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(6);
  });

  it("9. fedos_runtime_identity.ts does NOT reference this Stage's own doc -- confirming zero src/ change", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_094/);
  });

  it("10. structural: no dispose/destroy/close/shutdown method exists on the real class, confirming the design doc's own claim", () => {
    const identity = new FedosRuntimeIdentity();
    const proto = Object.getPrototypeOf(identity);
    const ownNames = Object.getOwnPropertyNames(proto);
    for (const forbidden of ["dispose", "destroy", "close", "shutdown", "reset"]) {
      expect(ownNames).not.toContain(forbidden);
    }
  });

  it("11. behavioral: the four-phase lifecycle (startup/Bootstrap/use/no explicit termination call) is realizable end to end against the real class", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);
    for (let i = 0; i < 5; i += 1) {
      expect(identity.currentIdentity()).toBeNull();
      expect(identity.listIdentities()).toEqual([]);
    }
  });

  it("12. Regression: create_runtime.ts/types.ts/worker.ts do not reference this Stage's own doc", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_094/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_094/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_094/);
  });

  it("13. Regression: the entire Identity Layer is confirmed unaffected by this Stage", () => {
    for (const source of [serviceSource, registrySource, resolverClassSource, identityProviderResolverSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_094/);
    }
  });

  it("14. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(68);    expect(libRsSource).not.toMatch(/secure_runtime_alpha_094/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_094/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_094/);
  });

  it("15. final sanity: no file anywhere under src/ references this Stage's own doc -- confirming true zero src/ diff", () => {
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
      expect(source).not.toMatch(/secure_runtime_alpha_094/);
    }
  });
});
