import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_369_durability_fsync_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import implementationSource from "../src/os/messenger/board/persistence/append_only_fedos_board_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

function normalize(source: string): string {
  return source.replace(/\s+/g, " ");
}

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

/**
 * Secure Runtime Alpha 369 -- "Durability & fsync Review": Stage 9 of
 * the Alpha 361-370 Board Recovery & Host Robustness Arc. Review
 * only. fsync is NOT added anywhere in this Arc, though this Stage
 * confirms it technically could be, without violating any hard
 * constraint.
 */
describe("Secure Runtime Alpha 369 -- Durability & fsync Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc states fsync is NOT added anywhere in this Arc, in its own status line", () => {
    expect(normalize(designDocSource)).toContain(
      "**Status: this Stage is REVIEW ONLY — it makes NO code change of any kind. `fsync` is NOT added anywhere in this Arc.**",
    );
  });

  it("3. structural: no fsyncSync/fdatasyncSync call exists anywhere in the actual implementation -- confirming the decision holds", () => {
    expect(codeOnly(implementationSource)).not.toMatch(/fsyncSync|fdatasyncSync|fsync\(|fdatasync\(/);
  });

  it("4. structural: no fsync-related dependency was added to package.json", () => {
    const pkg = JSON.parse(packageJsonSource);
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(allDeps).length).toBeGreaterThan(0); // sanity: deps object is populated
    expect(Object.keys(allDeps).some((name) => /fsync|sync-fs/i.test(name))).toBe(false);
  });

  it("5. the design doc confirms fsync is addable without a new dependency, without a format change, and without an interface change", () => {
    expect(designDocSource).toContain("## 2. Could `fsync` be added without a new dependency?");
    expect(designDocSource).toContain("## 3. Could `fsync` be added without changing the current record format?");
    expect(designDocSource).toContain(
      "## 4. Could `fsync` be added without changing `FedosBoardPersistence`'s own public interface?",
    );
  });

  it("6. the design doc names three independent reasons it is still not added, despite being technically addable", () => {
    expect(designDocSource).toContain("**It would change OBSERVABLE PERFORMANCE behavior**");
    expect(designDocSource).toContain("**No real, demonstrated requirement calls for it yet**");
    expect(normalize(designDocSource)).toContain(
      "**The exact durability/latency TRADE-OFF an operator would want is",
    );
  });

  it("7. the design doc restates the durability guarantee more precisely than Alpha 352 did -- safe against process crash, not against true power loss", () => {
    expect(normalize(designDocSource)).toContain(
      "guaranteed durable against a PROCESS crash",
    );
    expect(normalize(designDocSource)).toContain(
      "Only a true POWER-LOSS event",
    );
  });

  it("8. the design doc cross-references Alpha 352, Alpha 345, Alpha 353, and Alpha 366", () => {
    for (const ref of [
      "secure_runtime_alpha_352_append_only_record_format",
      "secure_runtime_alpha_345_crash_recovery_review",
      "secure_runtime_alpha_353_append_only_persistence_implementation",
      "secure_runtime_alpha_366_compaction_architecture_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
