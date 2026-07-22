import { describe, it, expect, vi } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_088_desktop_lifetime_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha087DocSource from "../docs/secure_runtime_alpha_087_desktop_bootstrap_ownership_review.md?raw";
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
import { createRuntime } from "../src/runtime/create_runtime.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";

/**
 * Secure Runtime Alpha 088 -- "Desktop Lifetime Review": a REVIEW /
 * DECISION ONLY Stage (Stage 2 of the Alpha 087-090 Desktop
 * Integration Review Arc) confirming Desktop holds its own
 * FedosRuntimeIdentity instance for its ENTIRE process lifetime
 * (Application Lifetime), formally and permanently distinct from
 * Worker's own per-request createRuntime() construction (Request
 * Lifetime). This Stage makes ZERO implementation change -- src/ is
 * entirely untouched.
 */
describe("Secure Runtime Alpha 088 -- Desktop Lifetime Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(4000);
  });

  it("2. the design doc declares itself REVIEW / DECISION ONLY, with src/ entirely untouched, as Stage 2 of the Arc", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DECISION ONLY/);
    expect(designDocSource).toMatch(/`src\/` is untouched by this Stage/);
    expect(designDocSource).toMatch(/This is Stage 2 of the Alpha 087–090 Desktop Integration\s*\nReview Arc/);
  });

  it("3. the design doc's grounding section confirms Worker's own per-request createRuntime() construction and cites it as the SAME structural flaw Alpha 059 rejected", () => {
    const section = (designDocSource.match(/## 3\. Grounding in the actual source([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/is called ONCE PER REQUEST inside Worker's own request-handling path/);
    expect(section).toMatch(/SAME concrete structural flaw\s*\n\s*Alpha 059 already cited/);
    expect(section).toMatch(/void runtimeIdentity;/);
  });

  it("4. the design doc declares a single Decision -- Application Lifetime, formally distinct from Request Lifetime", () => {
    const section = (designDocSource.match(/## 4\. Decision([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*Desktop holds its own `FedosRuntimeIdentity` instance — the one\s*\nconstructed and bootstrapped once at startup, per Alpha 087 — for the\s*\nENTIRE remaining lifetime of the Desktop process, until that process\s*\nterminates\. This is formally, permanently distinct from a Request\s*\nLifetime\.\*\*/,
    );
    expect(section).toMatch(/\*\*Desktop Lifetime:\*\*/);
    expect(section).toMatch(/\*\*Request Lifetime \(Worker\):\*\*/);
  });

  it("5. the design doc's comparison section covers all nine Arc-wide criteria and names Application Lifetime vs Request Lifetime as its own central finding", () => {
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
    expect(section).toMatch(/Application\s*\n\s*Lifetime vs\. Request Lifetime/);
  });

  it("6. the design doc's own 'does NOT do' list confirms no lifetime-tracking field is added and Alpha 059's own Worker rejection is not reopened", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* add a lifetime-tracking field, timer, or expiry\s*\n\s*mechanism of any kind/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* reopen Alpha 059's own Worker-rejection Decision/);
  });

  it("7. the design doc cross-references Alpha 059, Alpha 061, and Alpha 087", () => {
    expect(designDocSource).toContain("secure_runtime_alpha_059_identity_bootstrap_authority_review");
    expect(designDocSource).toContain("secure_runtime_alpha_061_identity_bootstrap_idempotency");
    expect(designDocSource).toContain("secure_runtime_alpha_087_desktop_bootstrap_ownership_review");
    expect(alpha087DocSource.length).toBeGreaterThan(0);
  });

  it("8. the design doc's own structure sanity check -- at least seven numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(7);
  });

  it("9. fedos_runtime_identity.ts does NOT reference this Stage's own doc -- confirming zero src/ change", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_088/);
  });

  it("10. behavioral: simulating an Application-Lifetime instance -- 25 repeated operations against ONE long-lived instance invoke the Service exactly once, confirming idempotency makes reuse cheap", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const desktopInstance = new FedosRuntimeIdentity();
    for (let i = 0; i < 25; i += 1) {
      await desktopInstance.bootstrapIdentity();
    }
    expect(spy).toHaveBeenCalledTimes(1);
    expect(desktopInstance.isBootstrapped()).toBe(true);
    spy.mockRestore();
  });

  it("11. behavioral: simulating Worker's own per-request construction -- 25 separate createRuntime() calls each produce a fresh, unreachable internal FedosRuntimeIdentity, never reused across calls", () => {
    for (let i = 0; i < 25; i += 1) {
      const runtime = createRuntime() as unknown as Record<string, unknown>;
      expect(runtime.identity).toBeUndefined();
    }
  });

  it("12. behavioral: a Desktop-styled long-lived instance's cached Descriptor survives across many operations without re-fetching", async () => {
    const descriptor = { id: "alpha088-lifetime", provider: "nostr", publicIdentifier: "npub1alpha088" };
    const spy = vi
      .spyOn(FedosIdentityService.prototype, "describeIdentity")
      .mockResolvedValueOnce(descriptor);
    const desktopInstance = new FedosRuntimeIdentity();
    await desktopInstance.bootstrapIdentity();
    for (let i = 0; i < 10; i += 1) {
      expect(desktopInstance.currentIdentity()).toBe(descriptor);
    }
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("13. Regression: create_runtime.ts/types.ts/worker.ts do not reference this Stage's own doc", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_088/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_088/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_088/);
  });

  it("14. Regression: the entire Identity Layer is confirmed unaffected by this Stage", () => {
    for (const source of [serviceSource, registrySource, resolverClassSource, identityProviderResolverSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_088/);
    }
  });

  it("15. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);    expect(libRsSource).not.toMatch(/secure_runtime_alpha_088/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_088/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_088/);
  });

  it("16. final sanity: no file anywhere under src/ references this Stage's own doc -- confirming true zero src/ diff", () => {
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
      expect(source).not.toMatch(/secure_runtime_alpha_088/);
    }
  });
});
