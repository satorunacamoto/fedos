import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_344_append_only_backend_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import inMemoryPersistenceSource from "../src/board/persistence/in_memory_fedos_board_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hydrationSource from "../src/board/persistence/fedos_board_hydration.ts?raw";

function normalize(source: string): string {
  return source.replace(/\s+/g, " ");
}

/**
 * Secure Runtime Alpha 344 -- "Append-only File Review": Stage 4 of
 * the Alpha 341-350 Board Durable Backend Re-evaluation & Local
 * Backend Selection Arc. Review only, implements NO append-only
 * backend. Re-examines append-only storage under the fact that a real
 * Host caller now exists.
 */
describe("Secure Runtime Alpha 344 -- Append-only File Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc reviews all eight required append-only dimensions", () => {
    for (const heading of [
      "## 1. Implementation complexity",
      "## 2. Recovery",
      "## 3. Replay",
      "## 4. Corruption",
      "## 5. Truncation",
      "## 6. Compaction",
      "## 7. Migration",
      "## 8. Scalability",
    ]) {
      expect(designDocSource).toContain(heading);
    }
  });

  it("3. structural: InMemoryFedosBoardPersistence's own Map-backed shape is the one an append-only index would mirror", () => {
    expect(inMemoryPersistenceSource).toMatch(/readonly #records = new Map<string, FedosPersistedBoardPostRecordV1>\(\);/);
  });

  it("4. structural: hydrateFedosBoardService's own order-independent sort is what makes replay order-agnostic", () => {
    expect(hydrationSource).toMatch(/compareBoardPostIdAsc/);
    expect(hydrationSource).toMatch(/\.sort\(compareBoardPostIdAsc\)/);
  });

  it("5. the design doc names the two distinct corruption shapes and does not conflate them", () => {
    expect(designDocSource).toMatch(/\*\*A structurally invalid but COMPLETE record\*\*/);
    expect(designDocSource).toMatch(/\*\*A trailing, INCOMPLETE record from a mid-write crash\*\*/);
  });

  it("6. the design doc names compaction as a real, unsolved problem -- not claimed simple", () => {
    expect(normalize(designDocSource)).toContain(
      "A REAL, currently-unsolved problem this Stage names but does not solve:",
    );
  });

  it("7. the design doc names its own honest conclusion -- lowest complexity, one open design problem, not hidden", () => {
    expect(normalize(designDocSource)).toContain(
      "explicitly deferred to the next Arc (Alpha 350 §5), not hidden or claimed already solved.",
    );
  });

  it("8. the design doc cross-references Alpha 343, Alpha 326, Alpha 318, and Alpha 314", () => {
    for (const ref of [
      "secure_runtime_alpha_343_sqlite_review",
      "secure_runtime_alpha_326_append_only_backend_review",
      "secure_runtime_alpha_318_board_hydration_index_rebuild",
      "secure_runtime_alpha_314_board_serialization_boundary",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
