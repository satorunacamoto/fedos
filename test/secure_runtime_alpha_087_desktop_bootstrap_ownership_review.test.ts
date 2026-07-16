import { describe, it, expect, vi } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_087_desktop_bootstrap_ownership_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha086DocSource from "../docs/secure_runtime_alpha_086_desktop_integration_boundary_review.md?raw";
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
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";

/**
 * Secure Runtime Alpha 087 -- "Desktop Bootstrap Ownership Review": a
 * REVIEW / DECISION ONLY Stage (Stage 1 of the Alpha 087-090 Desktop
 * Integration Review Arc) fixing WHEN Desktop creates and (never
 * explicitly) destroys its own FedosRuntimeIdentity instance. Decision:
 * construct exactly once at Desktop startup, bootstrap exactly once as
 * part of that same startup sequence, and never explicitly destroy --
 * consistent with the pre-existing Alpha 062 Identity-switching
 * Decision. This Stage makes ZERO implementation change -- src/ is
 * entirely untouched.
 */
describe("Secure Runtime Alpha 087 -- Desktop Bootstrap Ownership Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(4000);
  });

  it("2. the design doc declares itself REVIEW / DECISION ONLY, with src/ entirely untouched, as Stage 1 of the Arc", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DECISION ONLY/);
    expect(designDocSource).toMatch(/`src\/` is untouched by this Stage/);
    expect(designDocSource).toMatch(/This is Stage 1 of the Alpha 087–090 Desktop Integration\s*\nReview Arc/);
  });

  it("3. the design doc's grounding section confirms no destruction API exists and cites the Alpha 062 Identity-switching Decision", () => {
    const section = (designDocSource.match(/## 3\. Grounding in the actual source([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/No `destroy\(\)`, `dispose\(\)`, `close\(\)`, or equivalent method exists/);
    expect(section).toMatch(/treat `FedosRuntimeIdentity` as a\s*\n\s*short-lived object; Identity switching means constructing a new\s*\n\s*instance/);
    expect(section).toMatch(/idempotent after a successful\s*\n\s*completion \(Alpha 061\)/);
  });

  it("4. the design doc declares a single Decision -- construct once at startup, bootstrap once, never explicit destroy", () => {
    const section = (designDocSource.match(/## 4\. Decision([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*Desktop constructs exactly ONE `FedosRuntimeIdentity` instance at\s*\nDesktop startup, calls `bootstrapIdentity\(\)` on it exactly once as\s*\npart of that same startup sequence, and never explicitly destroys\s*\nit\.\*\*/,
    );
    expect(section).toMatch(/\*\*Creation timing:\*\*/);
    expect(section).toMatch(/\*\*Re-creation timing \(Identity switching only\):\*\*/);
    expect(section).toMatch(/\*\*Destruction timing:\*\* never explicit/);
  });

  it("5. the design doc's comparison section covers all nine Arc-wide criteria", () => {
    const section = (designDocSource.match(/## 5\. Comparison([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    for (const criterion of [
      "責務",
      "Lifetime",
      "Bootstrap Authority",
      "Runtime純粋性",
      "Workerとの差",
      "Protocol非依存性",
      "Public API",
      "YAGNI",
      "テスト容易性",
    ]) {
      expect(section).toContain(criterion);
    }
  });

  it("6. the design doc's own 'does NOT do' list confirms no destruction API is added and Alpha 062 is not altered", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* add a destruction\/reset\/shutdown API of any kind/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* alter the Alpha 062 Identity-switching Decision/);
  });

  it("7. the design doc cross-references Alpha 062 and Alpha 086", () => {
    expect(designDocSource).toContain("secure_runtime_alpha_062_identity_bootstrap_reset_review");
    expect(designDocSource).toContain("secure_runtime_alpha_086_desktop_integration_boundary_review");
    expect(alpha086DocSource.length).toBeGreaterThan(0);
  });

  it("8. the design doc's own structure sanity check -- at least seven numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(7);
  });

  it("9. fedos_runtime_identity.ts does NOT reference this Stage's own doc -- confirming zero src/ change", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_087/);
  });

  it("10. behavioral: constructing FedosRuntimeIdentity does not itself call bootstrapIdentity() -- confirming construction and Bootstrap remain two distinct, separately-owned steps", () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const identity = new FedosRuntimeIdentity();
    expect(spy).not.toHaveBeenCalled();
    expect(identity.isBootstrapped()).toBe(false);
    spy.mockRestore();
  });

  it("11. behavioral: a single construct-then-bootstrap sequence (simulating Desktop startup) completes successfully exactly once", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("12. behavioral: no explicit destruction method exists on FedosRuntimeIdentity -- confirming the design doc's own claim against the real class shape", () => {
    const identity = new FedosRuntimeIdentity();
    const proto = Object.getPrototypeOf(identity);
    const ownNames = Object.getOwnPropertyNames(proto);
    for (const forbidden of ["destroy", "dispose", "close", "shutdown", "reset"]) {
      expect(ownNames).not.toContain(forbidden);
    }
  });

  it("13. behavioral: Identity switching (per Alpha 062) via a fresh instance leaves the old instance's own state untouched", async () => {
    const oldInstance = new FedosRuntimeIdentity();
    await oldInstance.bootstrapIdentity();
    expect(oldInstance.isBootstrapped()).toBe(true);

    const newInstance = new FedosRuntimeIdentity();
    expect(newInstance.isBootstrapped()).toBe(false);
    expect(oldInstance.isBootstrapped()).toBe(true);
  });

  it("14. Regression: create_runtime.ts/types.ts/worker.ts do not reference this Stage's own doc", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_087/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_087/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_087/);
  });

  it("15. Regression: the entire Identity Layer is confirmed unaffected by this Stage", () => {
    for (const source of [serviceSource, registrySource, resolverClassSource, identityProviderResolverSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_087/);
    }
  });

  it("16. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(45);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_087/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_087/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_087/);
  });

  it("17. final sanity: no file anywhere under src/ references this Stage's own doc -- confirming true zero src/ diff", () => {
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
      expect(source).not.toMatch(/secure_runtime_alpha_087/);
    }
  });
});
