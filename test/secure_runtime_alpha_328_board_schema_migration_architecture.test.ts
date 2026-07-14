import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_328_board_schema_migration_architecture.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import recordSource from "../src/board/persistence/fedos_persisted_board_post_v1.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import codecSource from "../src/board/persistence/fedos_board_post_codec.ts?raw";

/**
 * Secure Runtime Alpha 328 -- "Board Schema and Migration Architecture":
 * Stage 8 of the Alpha 321-330 Board Durable Backend Selection &
 * Architecture Arc. Review only -- implements no migration. Freezes
 * persistence-layer ownership (Option B) of schemaVersion checks ahead
 * of any future backend, and confirms the frozen record/codec this
 * ownership model depends on is unchanged.
 */
describe("Secure Runtime Alpha 328 -- Board Schema and Migration Architecture", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc compares all three migration ownership models and adopts exactly one", () => {
    expect(designDocSource).toMatch(/## 3\. Migration ownership/);
    expect(designDocSource).toMatch(/\*\*B\. Board persistence layer owns migrations\.\*\* \*\*Adopted\.\*\*/);
    expect(designDocSource).toMatch(/\*\*C\. Separate migration coordinator\.\*\* Rejected FOR NOW/);
  });

  it("3. the design doc expresses the migration contract for all four candidate backends", () => {
    expect(designDocSource).toMatch(/## 4\. How each backend would express the same migration contract/);
    for (const backend of ["SQLite", "D1", "IndexedDB", "Append-only file"]) {
      expect(designDocSource).toContain(`**${backend}**`);
    }
  });

  it("4. structural: FedosPersistedBoardPostRecordV1 still fixes schemaVersion as the literal type 1", () => {
    expect(recordSource).toMatch(/readonly schemaVersion: 1;/);
  });

  it("5. structural: the codec still fails closed on an unrecognized schemaVersion (unchanged by this Arc)", () => {
    expect(codecSource).toMatch(/schemaVersion/);
  });

  it("6. the design doc requires every rebuildable structure to stay a pure function of stored records", () => {
    for (const term of [
      "Indexes remain rebuildable",
      "Feed order remains derived",
      "Source index remains rebuildable",
      "Ontology projection remains rebuildable",
    ]) {
      expect(designDocSource).toContain(term);
    }
  });

  it("7. the design doc cross-references Alpha 313, Alpha 314, Alpha 318, and Alpha 327", () => {
    for (const ref of [
      "secure_runtime_alpha_313_persisted_board_record_v1",
      "secure_runtime_alpha_314_board_serialization_boundary",
      "secure_runtime_alpha_318_board_hydration_index_rebuild",
      "secure_runtime_alpha_327_multi_environment_backend_strategy",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
