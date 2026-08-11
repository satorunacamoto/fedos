import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_364_recovery_strategy.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import implementationSource from "../src/os/messenger/board/persistence/append_only_fedos_board_persistence.ts?raw";

function normalize(source: string): string {
  return source.replace(/\s+/g, " ");
}

/**
 * Secure Runtime Alpha 364 -- "Recovery Strategy": Stage 4 of the
 * Alpha 361-370 Board Recovery & Host Robustness Arc. DESIGN ONLY --
 * no recovery tool is implemented anywhere in this Arc. Fixes a
 * salvage-recovery algorithm as pseudocode.
 */
describe("Secure Runtime Alpha 364 -- Recovery Strategy", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc states no recovery tool is implemented anywhere in this Arc", () => {
    expect(normalize(designDocSource)).toContain(
      "No recovery tool is implemented anywhere in this Arc.",
    );
  });

  it("3. structural: no salvage/recovery function exists anywhere in the actual implementation", () => {
    expect(implementationSource).not.toMatch(/salvage|recover/i);
  });

  it("4. the design doc's own pseudocode never overwrites the source file -- reads from source, writes to a new destination", () => {
    expect(designDocSource).toContain("function salvageAppendOnlyLog(sourcePath, destinationPath):");
    expect(normalize(designDocSource)).toContain(
      "the original corrupt file is NEVER modified or",
    );
  });

  it("5. the design doc explains 'stop at the first unparseable line' rather than 'skip and continue'", () => {
    expect(designDocSource).toContain("# Stop at the FIRST unparseable line -- do not skip past it");
  });

  it("6. the design doc explicitly refuses to auto-resolve category C conflicts, proposing detection only", () => {
    expect(designDocSource).toContain(
      "## 5. Why category C (conflicting duplicate) is NOT given an automated resolution",
    );
  });

  it("7. the design doc reaffirms 'never repair automatically' from Alpha 357 as absolute", () => {
    expect(normalize(designDocSource)).toContain('"Never repair automatically" (Alpha 357) remains absolute');
  });

  it("8. the design doc cross-references Alpha 363, Alpha 357, and Alpha 352", () => {
    for (const ref of [
      "secure_runtime_alpha_363_corruption_classification",
      "secure_runtime_alpha_357_crash_review",
      "secure_runtime_alpha_352_append_only_record_format",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
