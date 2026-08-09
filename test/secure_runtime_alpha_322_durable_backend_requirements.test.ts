import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_322_durable_backend_requirements.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import portSource from "../src/os/messenger/board/persistence/fedos_board_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import inMemoryPersistenceSource from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.ts?raw";

/**
 * Secure Runtime Alpha 322 -- "Durable Backend Requirements": Stage 2 of
 * the Alpha 321-330 Board Durable Backend Selection & Architecture Arc.
 * Review only. Freezes MUST/SHOULD/NOT YET against the already-frozen
 * FedosBoardPersistence port and hydration contracts, before any
 * candidate backend technology is compared.
 */
describe("Secure Runtime Alpha 322 -- Durable Backend Requirements", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc has separate MUST / SHOULD / NOT YET sections", () => {
    expect(designDocSource).toMatch(/## 2\. MUST/);
    expect(designDocSource).toMatch(/## 3\. SHOULD/);
    expect(designDocSource).toMatch(/## 4\. NOT YET/);
  });

  it("3. the design doc's MUST list matches the frozen port's own write-result vocabulary", () => {
    for (const term of ["\"inserted\"", "\"already-present\"", "\"conflict\"", "\"failed\""]) {
      expect(designDocSource).toContain(term);
    }
  });

  it("4. structural: the frozen port still exposes exactly putPost/getPost/listPosts, no delete", () => {
    expect(portSource).toMatch(/putPost\(record: FedosPersistedBoardPostRecordV1\): FedosBoardPersistenceWriteResult;/);
    expect(portSource).toMatch(/getPost\(id: string\): FedosPersistedBoardPostRecordV1 \| null;/);
    expect(portSource).toMatch(/listPosts\(\): readonly FedosPersistedBoardPostRecordV1\[\];/);
    expect(portSource).not.toMatch(/deletePost|removePost/);
  });

  it("5. structural: InMemoryFedosBoardPersistence still guarantees independent instances (no module-level mutable state)", () => {
    expect(inMemoryPersistenceSource).toMatch(/no module-level[\s*]+mutable state exists in this file/);
  });

  it("6. the design doc explicitly excludes encryption at rest, concurrent writers, and browser/Desktop hard requirements from MUST", () => {
    expect(designDocSource).toMatch(/\*\*Encryption at rest\*\* — explicitly out of scope/);
    expect(designDocSource).toMatch(/\*\*Concurrent writers\*\*/);
    expect(designDocSource).toMatch(/\*\*Browser support\*\* — no browser environment exists/);
  });

  it("7. the design doc cross-references Alpha 321, Alpha 315, Alpha 313, and Alpha 318", () => {
    for (const ref of [
      "secure_runtime_alpha_321_board_deployment_runtime_inventory",
      "secure_runtime_alpha_315_board_persistence_port",
      "secure_runtime_alpha_313_persisted_board_record_v1",
      "secure_runtime_alpha_318_board_hydration_index_rebuild",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
