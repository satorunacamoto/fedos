import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_323_sqlite_backend_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";

/**
 * Secure Runtime Alpha 323 -- "Candidate A: SQLite Backend Review":
 * Stage 3 of the Alpha 321-330 Board Durable Backend Selection &
 * Architecture Arc. Review only -- adds no SQLite dependency of any
 * kind. Confirms SQLite is technically capable but requires both a new,
 * prohibited dependency and a Desktop host process that does not exist.
 */
describe("Secure Runtime Alpha 323 -- Candidate A: SQLite Backend Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc names the concrete prerequisites before implementation", () => {
    expect(designDocSource).toMatch(/## 3\. What concrete shell\/runtime would be required before implementation/);
    expect(designDocSource).toMatch(/A real Desktop host PROCESS/);
  });

  it("3. Regression: no SQLite dependency exists in package.json", () => {
    const pkg = JSON.parse(packageJsonSource);
    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    for (const name of Object.keys(allDeps)) {
      expect(name.toLowerCase()).not.toContain("sqlite");
    }
  });

  it("4. Regression: no SQLite dependency exists in Cargo.toml", () => {
    expect(cargoTomlSource.toLowerCase()).not.toContain("sqlite");
  });

  it("5. Regression: package.json dependency count remains unchanged at 2", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("6. the design doc confirms Worker/browser incompatibility and Windows path fragility already observed in this checkout", () => {
    expect(designDocSource).toMatch(/Worker incompatibility\.\*\* Complete/);
    expect(designDocSource).toMatch(/Browser incompatibility\.\*\* Complete/);
    expect(designDocSource).toMatch(/checkout path contains\s*spaces and non-ASCII characters/);
  });

  it("7. the design doc's conclusion defers, rather than rejects, SQLite on technical merit", () => {
    expect(designDocSource).toMatch(/Not rejected\s*on technical merit/);
  });

  it("8. the design doc cross-references Alpha 321 and Alpha 322", () => {
    for (const ref of [
      "secure_runtime_alpha_321_board_deployment_runtime_inventory",
      "secure_runtime_alpha_322_durable_backend_requirements",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
