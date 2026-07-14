import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_349_backend_selection.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

function normalize(source: string): string {
  return source.replace(/\s+/g, " ");
}

/**
 * Secure Runtime Alpha 349 -- "Backend Selection": Stage 9 of the
 * Alpha 341-350 Board Durable Backend Re-evaluation & Local Backend
 * Selection Arc. Review only, implements NO backend. Issues the
 * Arc's own Selection Decision: Option A, append-only, first.
 */
describe("Secure Runtime Alpha 349 -- Backend Selection", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc selects Option A explicitly", () => {
    expect(normalize(designDocSource)).toContain(
      "**Option A: append-only file backend, selected as the first durable backend.**",
    );
  });

  it("3. the design doc rejects Options B, C, and D, each with a stated reason", () => {
    expect(designDocSource).toContain("- **Option D — continue deferring.** REJECTED.");
    expect(designDocSource).toContain("- **Option C — both simultaneously.** REJECTED.");
    expect(designDocSource).toMatch(/- \*\*Option B — SQLite first\.\*\* REJECTED for FIRST position, not for/);
  });

  it("4. the design doc applies all six named criteria to every option", () => {
    for (const criterion of [
      "Simplicity:",
      "Recoverability:",
      "Dependency footprint:",
      "Future migration:",
      "Testability:",
      "FedOS architecture consistency:",
    ]) {
      expect(designDocSource).toContain(criterion);
    }
  });

  it("5. Regression: no backend implementation exists -- package.json dependency count remains unchanged at 2", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("6. the design doc explicitly states SQLite is not foreclosed, naming it the anticipated migration destination", () => {
    expect(normalize(designDocSource)).toContain(
      "**Does not foreclose SQLite** — it is named, explicitly, as this",
    );
  });

  it("7. the design doc cross-references Alpha 348, Alpha 345, Alpha 344, Alpha 343, Alpha 346, and Alpha 329", () => {
    for (const ref of [
      "secure_runtime_alpha_348_deployment_review",
      "secure_runtime_alpha_345_crash_recovery_review",
      "secure_runtime_alpha_344_append_only_backend_review",
      "secure_runtime_alpha_343_sqlite_review",
      "secure_runtime_alpha_346_migration_strategy",
      "secure_runtime_alpha_329_first_durable_backend_selection",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
