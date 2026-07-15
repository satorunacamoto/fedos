import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_394_write_failure_policy.md?raw";

/**
 * Secure Runtime Alpha 394 -- "Write Failure Policy": Stage 4 of the
 * Alpha 391-400 Desktop Host Durable Write Coordination Arc. Review
 * only. Names, for every failure shape this Arc's own instruction
 * lists, exactly what submitPost() (Alpha 395) does. Behavioral proof
 * of each case lives in Alpha 398's own test suite.
 */
describe("Secure Runtime Alpha 394 -- Write Failure Policy", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc names every failure shape this Arc's own instruction lists", () => {
    for (const heading of [
      '## 1. "Persistence succeeds, Repository fails"',
      '## 2. "Repository succeeds, Persistence fails"',
      '## 3. "Duplicate"',
      '## 4. "Conflict"',
      '## 5. "Unexpected exception"',
    ]) {
      expect(designDocSource).toContain(heading);
    }
  });

  it("3. the design doc declares the two dangerous partial-success shapes structurally unreachable, not merely handled", () => {
    const normalized = designDocSource.replace(/\s+/g, " ");
    expect(normalized).toContain("**Structurally unreachable**, by the Alpha 393 order");
    expect(normalized).toContain("**Structurally unreachable**, by construction");
    expect(normalized).toContain("Persistence is step 2, Repository is step 3");
  });

  it("4. the design doc commits to fail-closed language: never silently repair, never invent recovery", () => {
    const normalized = designDocSource.replace(/\s+/g, " ");
    expect(normalized).toContain("No case is silently repaired; no case invents a new recovery mechanism.");
  });

  it("5. the design doc explicitly declines automatic retry, transaction rollback, and a new Host state", () => {
    expect(designDocSource).toContain("**No automatic retry**");
    expect(designDocSource).toContain("**No transaction rollback mechanism**");
    expect(designDocSource).toContain("**No new Host state**");
  });

  it("6. the design doc honestly names the residual board() bypass this Arc does not close", () => {
    expect(designDocSource.replace(/\s+/g, " ")).toContain(
      "still reproduces the ORIGINAL memory-only-write gap (Alpha 367/389/390) exactly as before.",
    );
  });

  it("7. the design doc cross-references Alpha 393, Alpha 392, Alpha 356, and Alpha 382", () => {
    for (const ref of [
      "secure_runtime_alpha_393_write_transaction_order",
      "secure_runtime_alpha_392_write_coordination_ownership_decision",
      "secure_runtime_alpha_356_conflict_handling",
      "secure_runtime_alpha_382_host_startup_failure_closure",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
