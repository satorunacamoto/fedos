import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_329_first_durable_backend_selection.md?raw";

/**
 * Secure Runtime Alpha 329 -- "First Durable Backend Selection": Stage 9
 * of the Alpha 321-330 Board Durable Backend Selection & Architecture
 * Arc. Review only -- implements no backend. Issues the Arc's own
 * required selection: Option E, explicit deferral, reasoned against the
 * Decision Constraints rather than chosen by default.
 */
describe("Secure Runtime Alpha 329 -- First Durable Backend Selection", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc applies the Decision Constraints to all four candidates before selecting", () => {
    expect(designDocSource).toMatch(/## 2\. Decision Constraints, applied/);
    for (const candidate of ["SQLite", "IndexedDB", "D1", "Append-only file"]) {
      expect(designDocSource).toContain(`**${candidate}**`);
    }
  });

  it("3. the design doc selects Option E explicitly, not by default", () => {
    expect(designDocSource).toMatch(/## 3\. Selection/);
    expect(designDocSource).toMatch(/\*\*Option E: no backend yet, because no real host runtime exists for/);
  });

  it("4. the design doc states, for each deferred candidate, what must exist before it can be implemented", () => {
    expect(designDocSource).toMatch(
      /What must exist before each deferred backend can be implemented/,
    );
  });

  it("5. the design doc does not recommend p2p/Ontology as any backend", () => {
    expect(designDocSource.toLowerCase()).not.toMatch(/p2p\/.*as.*(backend|storage)/);
  });

  it("6. the design doc cross-references every one of Alpha 321 through Alpha 328", () => {
    for (let n = 321; n <= 328; n++) {
      expect(designDocSource).toMatch(new RegExp(`secure_runtime_alpha_${n}_`));
    }
  });
});
