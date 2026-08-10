import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_343_sqlite_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import tsconfigSource from "../tsconfig.json?raw";
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

function normalize(source: string): string {
  return source.replace(/\s+/g, " ");
}

/**
 * Secure Runtime Alpha 343 -- "SQLite Review": Stage 3 of the Alpha
 * 341-350 Board Durable Backend Re-evaluation & Local Backend
 * Selection Arc. Review only, implements NO SQLite backend.
 * Re-examines SQLite under the fact that a real Host caller now
 * exists.
 */
describe("Secure Runtime Alpha 343 -- SQLite Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc reviews all ten required SQLite dimensions", () => {
    for (const heading of [
      "## 1. Dependency impact",
      "## 2. Deployment",
      "## 3. Schema evolution / migrations",
      "## 4. Crash recovery",
      "## 5. Transaction semantics",
      "## 6. Indexes",
      "## 7. Query capability",
      "## 8. Maintenance",
      "## 9. Portability",
    ]) {
      expect(designDocSource).toContain(heading);
    }
  });

  it("3. structural: no SQLite dependency exists in package.json (this Stage implements nothing)", () => {
    const pkg = JSON.parse(packageJsonSource);
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(allDeps).some((name) => /sqlite/i.test(name))).toBe(false);
  });

  it("4. structural: no @types/node exists in tsconfig -- confirming the node:sqlite typing gap the design doc names", () => {
    const tsconfig = JSON.parse(tsconfigSource);
    expect(tsconfig.compilerOptions.types ?? []).not.toContain("node");
  });

  it("5. Regression: package.json dependency count remains unchanged at 2", () => {
    const pkg = JSON.parse(packageJsonSource);
    assertFedosRootDependencyInvariant(pkg.dependencies);
  });

  it("6. the design doc names both real Node-SQLite paths and rejects committing to either this Arc", () => {
    expect(designDocSource).toContain("A native module");
    expect(designDocSource).toContain("Node's built-in `node:sqlite`");
    expect(normalize(designDocSource)).toContain(
      "Either path is a real dependency-impact decision this Arc's own Absolute Prohibitions explicitly forbid making today",
    );
  });

  it("7. the design doc concludes SQLite is a strong second backend, not first", () => {
    expect(normalize(designDocSource)).toContain(
      "SQLite remains a strong SECOND backend candidate (Alpha 350's own migration path), not a strong FIRST one.",
    );
  });

  it("8. the design doc cross-references Alpha 342, Alpha 323, Alpha 322, and Alpha 328", () => {
    for (const ref of [
      "secure_runtime_alpha_342_current_persistence_review",
      "secure_runtime_alpha_323_sqlite_backend_review",
      "secure_runtime_alpha_322_durable_backend_requirements",
      "secure_runtime_alpha_328_board_schema_migration_architecture",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
