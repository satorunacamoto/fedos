import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_327_multi_environment_backend_strategy.md?raw";

/**
 * Secure Runtime Alpha 327 -- "Multi-Environment Backend Strategy":
 * Stage 7 of the Alpha 321-330 Board Durable Backend Selection &
 * Architecture Arc. Review only. Compares the five named
 * multi-environment strategies against the Alpha 321 environment
 * inventory and adopts deferral (Option E) over an early commitment to
 * any backend-pairing strategy (Options B/D).
 */
describe("Secure Runtime Alpha 327 -- Multi-Environment Backend Strategy", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc states the Preferred Principle: uniform port, differing physical backend", () => {
    expect(designDocSource).toMatch(/## 2\. Preferred principle/);
    expect(designDocSource).toMatch(/stay IDENTICAL across every environment/);
  });

  it("3. the design doc evaluates and rejects Option A (universal backend) and Option C (IndexedDB-everywhere)", () => {
    expect(designDocSource).toMatch(/Option A — one universal backend for every environment/);
    expect(designDocSource).toContain("Rejected.");
    expect(designDocSource).toMatch(/Rejected for the same reason as Option B's IndexedDB half\./);
  });

  it("4. the design doc adopts Option E over Option B/D as the strategy", () => {
    expect(designDocSource).toMatch(/Option E — only one initial backend; defer all others/);
    expect(designDocSource).toMatch(/carried\s+forward as the adopted strategy in Alpha 329/);
  });

  it("5. the design doc applies every one of the fifteen required evaluation criteria", () => {
    for (const criterion of [
      "Current real environment",
      "User ownership",
      "Offline operation",
      "Hosted federation",
      "Implementation cost",
      "Maintenance burden",
      "Portability",
      "Test coverage",
      "Migration compatibility",
      "Persistence-port compatibility",
      "Semantic equivalence",
      "Backup",
      "Future sync",
      "Security boundary",
      "Operational deployment",
    ]) {
      expect(designDocSource).toContain(criterion);
    }
  });

  it("6. the design doc cross-references all four candidate reviews and Alpha 321", () => {
    for (const ref of [
      "secure_runtime_alpha_321_board_deployment_runtime_inventory",
      "secure_runtime_alpha_323_sqlite_backend_review",
      "secure_runtime_alpha_324_indexeddb_backend_review",
      "secure_runtime_alpha_325_d1_backend_review",
      "secure_runtime_alpha_326_append_only_backend_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
