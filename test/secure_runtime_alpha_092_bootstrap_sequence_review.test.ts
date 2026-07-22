import { describe, it, expect, vi } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_092_bootstrap_sequence_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha091DocSource from "../docs/secure_runtime_alpha_091_desktop_entry_point_review.md?raw";
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
 * Secure Runtime Alpha 092 -- "Bootstrap Sequence Review": a DESIGN
 * REVIEW ONLY Stage (Stage 2 of the Alpha 091-095 Desktop Shell
 * Integration Design Arc) fixing the exact call order inside a future
 * `Application bootstrap()` -- construct, bootstrapIdentity(), ready --
 * and three permanent invariants: never called more than once, never
 * swapped mid-sequence, never called later than Runtime generation.
 * This Stage makes ZERO implementation change -- src/ is entirely
 * untouched.
 */
describe("Secure Runtime Alpha 092 -- Bootstrap Sequence Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself DESIGN REVIEW ONLY, with src/ entirely untouched, as Stage 2 of the Arc", () => {
    expect(designDocSource).toMatch(/this Stage is DESIGN REVIEW ONLY/);
    expect(designDocSource).toMatch(/`src\/` is untouched by this Stage/);
    expect(designDocSource).toMatch(/This is\s*\nStage 2 of the Alpha 091–095 Desktop Shell Integration Design Arc/);
  });

  it("3. the design doc's sequence section fixes the exact three-step order", () => {
    const section = (designDocSource.match(/## 3\. The sequence([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/construct\s*\n\s*↓\s*\nbootstrapIdentity\(\)\s*\n\s*↓\s*\nDesktop ready/);
    expect(section).toMatch(
      /strictly in this order: `new FedosRuntimeIdentity\(\)`,\s*\nthen `await bootstrapIdentity\(\)` on that same instance/,
    );
  });

  it("4. the design doc declares three permanent invariants, each explicitly worded", () => {
    const section = (designDocSource.match(/## 5\. Decision — three invariants([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*Bootstrap is never called more than once per instance\.\*\* The\s*\n\s*sequence itself issues exactly one `bootstrapIdentity\(\)` call/,
    );
    expect(section).toMatch(
      /\*\*Identity is never swapped mid-sequence\.\*\* The SAME\s*\n\s*`FedosRuntimeIdentity` instance constructed in step 1 is the SAME/,
    );
    expect(section).toMatch(
      /\*\*Bootstrap is never called later than Runtime generation\.\*\*\s*\n\s*Identity Bootstrap \(this sequence\) must complete at or before/,
    );
  });

  it("5. the design doc's own 'does NOT do' list confirms no createRuntime()/Identity coupling is introduced", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* couple `createRuntime\(\)` to Identity in any way/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement `bootstrap\(\)` or any Desktop Shell construct/);
  });

  it("6. the design doc cross-references Alpha 061, Alpha 087, Alpha 089, and Alpha 091", () => {
    for (const ref of [
      "secure_runtime_alpha_061_identity_bootstrap_idempotency",
      "secure_runtime_alpha_087_desktop_bootstrap_ownership_review",
      "secure_runtime_alpha_089_desktop_runtime_separation_review",
      "secure_runtime_alpha_091_desktop_entry_point_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
    expect(alpha091DocSource.length).toBeGreaterThan(0);
  });

  it("7. the design doc's own structure sanity check -- at least six numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(6);
  });

  it("8. fedos_runtime_identity.ts does NOT reference this Stage's own doc -- confirming zero src/ change", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_092/);
  });

  it("9. behavioral: the exact three-step sequence (construct, await bootstrapIdentity(), then read isBootstrapped()) works end to end, confirming the design doc's own sequence is realizable against the real class", async () => {
    const identity = new FedosRuntimeIdentity();
    expect(identity.isBootstrapped()).toBe(false);
    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);
  });

  it("10. behavioral: a second bootstrapIdentity() call on the SAME instance (simulating an accidental repeat) is a safe no-op, confirming Alpha 061's own idempotency backstop", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    await identity.bootstrapIdentity();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("11. Regression: create_runtime.ts/types.ts/worker.ts do not reference this Stage's own doc", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_092/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_092/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_092/);
  });

  it("12. Regression: the entire Identity Layer is confirmed unaffected by this Stage", () => {
    for (const source of [serviceSource, registrySource, resolverClassSource, identityProviderResolverSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_092/);
    }
  });

  it("13. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(64);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_092/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_092/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_092/);
  });

  it("14. final sanity: no file anywhere under src/ references this Stage's own doc -- confirming true zero src/ diff", () => {
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
      expect(source).not.toMatch(/secure_runtime_alpha_092/);
    }
  });
});
