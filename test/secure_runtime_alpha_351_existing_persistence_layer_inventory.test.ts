import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_351_existing_persistence_layer_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import portSource from "../src/board/persistence/fedos_board_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import repositorySource from "../src/board/persistence/persisted_fedos_board_repository.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hydrationSource from "../src/board/persistence/fedos_board_hydration.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import codecSource from "../src/board/persistence/fedos_board_post_codec.ts?raw";

import type { FedosBoardPersistence } from "../src/board/persistence/fedos_board_persistence.js";

function normalize(source: string): string {
  return source.replace(/\s+/g, " ");
}

/**
 * Secure Runtime Alpha 351 -- "Existing Persistence Layer Inventory":
 * Stage 1 of the Alpha 351-360 Append-only Durable Board Backend Arc.
 * Review only. Re-confirms FedosBoardPersistence, PersistedFedosBoardRepository,
 * hydration, and serialization all require ZERO interface change for
 * a new append-only backend.
 */
describe("Secure Runtime Alpha 351 -- Existing Persistence Layer Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. structural: FedosBoardPersistence's own three-method shape is unchanged", () => {
    expect(portSource).toMatch(/export interface FedosBoardPersistence \{/);
    expect(portSource).toMatch(/putPost\(record: FedosPersistedBoardPostRecordV1\): FedosBoardPersistenceWriteResult;/);
    expect(portSource).toMatch(/getPost\(id: string\): FedosPersistedBoardPostRecordV1 \| null;/);
    expect(portSource).toMatch(/listPosts\(\): readonly FedosPersistedBoardPostRecordV1\[\];/);
  });

  it("3. structural: PersistedFedosBoardRepository's own conservative 'failed' mapping is unchanged", () => {
    expect(repositorySource).toMatch(/if \(result === "failed"\) \{/);
    expect(repositorySource).toMatch(/return "conflict";/);
  });

  it("4. structural: hydrateFedosBoardService's own signature is unchanged", () => {
    expect(hydrationSource).toMatch(/export function hydrateFedosBoardService\(persistence: FedosBoardPersistence\): FedosBoardHydrationResult/);
  });

  it("5. structural: the codec still performs no JSON step -- confirming this Arc's own backend is the first to introduce one", () => {
    expect(codecSource).not.toMatch(/JSON\.stringify|JSON\.parse/);
  });

  it("6. type-level: a type satisfying FedosBoardPersistence today would satisfy it identically after this Arc", () => {
    const shapeCheck: FedosBoardPersistence = {
      putPost: () => "inserted",
      getPost: () => null,
      listPosts: () => [],
    };
    expect(typeof shapeCheck.putPost).toBe("function");
  });

  it("7. the design doc concludes no interface change is required, structurally, before implementation", () => {
    expect(normalize(designDocSource)).toContain("before any implementation code is written.");
    expect(normalize(designDocSource)).toContain('"Preserve every existing public interface,"');
  });

  it("8. the design doc cross-references Alpha 350, Alpha 342, Alpha 315, Alpha 317, and Alpha 318", () => {
    for (const ref of [
      "secure_runtime_alpha_350_backend_reevaluation_completion",
      "secure_runtime_alpha_342_current_persistence_review",
      "secure_runtime_alpha_315_board_persistence_port",
      "secure_runtime_alpha_317_persisted_board_repository",
      "secure_runtime_alpha_318_board_hydration_index_rebuild",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
