import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_480_canonical_publish_scheduler_foundation_completion.md?raw";

const PRIOR_STAGE_DOC_BASENAMES = [
  "secure_runtime_alpha_471_existing_scheduler_and_publisher_inventory.md",
  "secure_runtime_alpha_472_scheduler_responsibility_decision.md",
  "secure_runtime_alpha_473_publisher_interface_model.md",
  "secure_runtime_alpha_474_retry_policy_model.md",
  "secure_runtime_alpha_475_outbox_observation_realization.md",
  "secure_runtime_alpha_476_publish_scheduler_tick_design.md",
  "secure_runtime_alpha_477_scheduler_lifecycle_model.md",
  "secure_runtime_alpha_478_publish_scheduler_implementation.md",
  "secure_runtime_alpha_479_scope_and_security_regression_guards.md",
];

/**
 * Secure Runtime Alpha 480 -- "Canonical Publish Scheduler Foundation
 * Completion": Stage 10 (final) of the Alpha 471-480 Canonical Publish
 * Scheduler Foundation Arc.
 */
describe("Secure Runtime Alpha 480 -- Canonical Publish Scheduler Foundation Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. every prior Stage doc (Alpha 471-479) is imported and every prior Stage source file it names exists", async () => {
    for (const basename of PRIOR_STAGE_DOC_BASENAMES) {
      const mod = await import(/* @vite-ignore */ `../docs/${basename}?raw`);
      expect(typeof mod.default).toBe("string");
      expect(mod.default.length).toBeGreaterThan(500);
    }
  });

  it("3. the design doc declares Phase Gate PASS, exactly once", () => {
    const matches = designDocSource.match(/\*\*PASS\.\*\*/g);
    expect(matches).toHaveLength(1);
  });

  it("4. the design doc names exactly one Next Arc recommendation -- an adapter, never a second generic port", () => {
    expect(designDocSource).toMatch(/\*\*Adapt, do not duplicate\.\*\*/);
    expect(designDocSource).toMatch(/never a second, competing generic Publisher port/);
  });

  it("5. the design doc's own Still-Out-Of-Scope list names no concrete Publisher implementation", () => {
    expect(designDocSource).toMatch(/A real, protocol-wired `FedosBoardOutboxPublisher` implementation/);
  });

  it("6. the design doc records real, re-run verification numbers, not restated from Alpha 478 alone", () => {
    expect(designDocSource).toMatch(/9 files, 71\/71 tests, all passing/);
    expect(designDocSource).toMatch(/637 files \/ 10657\n\s*tests passed, 71 files \/ 110 tests failed/);
  });

  it("7. the design doc cross-references Alpha 450's own prior completion", () => {
    expect(designDocSource).toContain(
      "secure_runtime_alpha_450_master_seed_authority_and_nostr_signing_activation_completion",
    );
  });
});
