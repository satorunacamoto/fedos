import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hydrationSource from "../src/board/persistence/fedos_board_hydration.ts?raw";
import { PersistedFedosBoardRepository } from "../src/board/persistence/persisted_fedos_board_repository.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { hydrateFedosBoardService } from "../src/board/persistence/fedos_board_hydration.js";

/**
 * Secure Runtime Alpha 555 -- "Unnecessary Repository Investigation":
 * Stage 15 of the Alpha 541-560 Publish Runtime Operational Review
 * Arc. Review test only.
 */
describe("Secure Runtime Alpha 555 -- Unnecessary Repository Investigation", () => {
  it("1. hydrateFedosBoardService never references PersistedFedosBoardRepository anywhere in its own source", () => {
    expect(hydrationSource).not.toMatch(/PersistedFedosBoardRepository/);
  });

  it("2. PersistedFedosBoardRepository is a real, working, fully-testable class -- not broken, merely unwired", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const repository = new PersistedFedosBoardRepository(persistence);
    expect(repository.listPosts()).toEqual([]);
  });

  it("3. hydrateFedosBoardService's own resulting service starts with zero posts even when a SEPARATE PersistedFedosBoardRepository over the SAME persistence would report the same -- no shared backing store, no constructor path connecting the two", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const separateRepository = new PersistedFedosBoardRepository(persistence);
    const hydration = hydrateFedosBoardService(persistence);

    expect(hydration.outcome).toBe("hydrated");
    expect(separateRepository.listPosts()).toEqual([]);
    // hydration.service exposes no listPosts() of its own (a DIFFERENT, narrower
    // API than FedosBoardRepository) -- confirming it is not itself a
    // PersistedFedosBoardRepository or any FedosBoardRepository implementation
    // directly, only a FedosBoardService wrapping an unrelated in-memory one.
    expect((hydration.service as unknown as Record<string, unknown>).listPosts).toBeUndefined();
  });
});
