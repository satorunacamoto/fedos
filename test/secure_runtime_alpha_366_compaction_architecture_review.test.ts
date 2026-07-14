import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_366_compaction_architecture_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import implementationSource from "../src/board/persistence/append_only_fedos_board_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import persistedRecordSource from "../src/board/persistence/fedos_persisted_board_post_v1.ts?raw";

function normalize(source: string): string {
  return source.replace(/\s+/g, " ");
}

/**
 * Secure Runtime Alpha 366 -- "Compaction Architecture Review (Design
 * Only)": Stage 6 of the Alpha 361-370 Board Recovery & Host
 * Robustness Arc. DESIGN ONLY -- no compaction implementation
 * anywhere in this Stage or this Arc.
 */
describe("Secure Runtime Alpha 366 -- Compaction Architecture Review (Design Only)", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc states no code, no compaction implementation, anywhere in this Stage", () => {
    expect(normalize(designDocSource)).toContain(
      "No code, no compaction implementation, anywhere in this Stage.",
    );
  });

  it("3. the design doc concludes compaction is not currently justified by real data need", () => {
    expect(normalize(designDocSource)).toContain(
      "The append-only log, as it exists today, therefore NEVER contains a",
    );
  });

  it("4. structural: no compaction function exists anywhere in the actual implementation", () => {
    expect(implementationSource).not.toMatch(/compact/i);
  });

  it("5. structural: the persisted record type still carries no moderation/delete field -- confirming compaction has no superseded-record concept to reclaim yet", () => {
    expect(persistedRecordSource).not.toMatch(/readonly (moderation\w*|deletedAt|superseded\w*):/i);
  });

  it("6. the design doc's own compaction design uses atomic rename, never in-place rewrite", () => {
    expect(designDocSource).toContain("atomically rename tempPath over filePath");
    expect(normalize(designDocSource)).toContain("**Atomicity via rename, not in-place rewrite.**");
  });

  it("7. the design doc explicitly forbids running compaction automatically inside putPost()'s own hot path", () => {
    expect(designDocSource).toContain(
      "## 4. Why compaction must never run inside `putPost()`'s own hot path",
    );
  });

  it("8. the design doc reaffirms the compacted format is unchanged, satisfying this Arc's own format-preservation requirement", () => {
    expect(normalize(designDocSource)).toContain("The format is UNCHANGED");
  });

  it("9. the design doc cross-references Alpha 364, Alpha 360, Alpha 354, and Alpha 313", () => {
    for (const ref of [
      "secure_runtime_alpha_364_recovery_strategy",
      "secure_runtime_alpha_360_append_only_backend_completion",
      "secure_runtime_alpha_354_append_semantics",
      "secure_runtime_alpha_313_persisted_board_record_v1",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
