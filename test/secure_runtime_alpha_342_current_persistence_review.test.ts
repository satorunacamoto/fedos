import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_342_current_persistence_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import portSource from "../src/board/persistence/fedos_board_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import repositorySource from "../src/board/persistence/persisted_fedos_board_repository.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hydrationSource from "../src/board/persistence/fedos_board_hydration.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import codecSource from "../src/board/persistence/fedos_board_post_codec.ts?raw";

function normalize(source: string): string {
  return source.replace(/\s+/g, " ");
}

/**
 * Secure Runtime Alpha 342 -- "Current Persistence Review": Stage 2 of
 * the Alpha 341-350 Board Durable Backend Re-evaluation & Local
 * Backend Selection Arc. Review only. Separates genuinely
 * backend-independent persistence assumptions from what merely
 * happens to be true of InMemoryFedosBoardPersistence today. No
 * redesign.
 */
describe("Secure Runtime Alpha 342 -- Current Persistence Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. structural: the port is still synchronous -- no Promise return anywhere in its own interface", () => {
    expect(portSource).toMatch(/export interface FedosBoardPersistence \{/);
    expect(portSource).not.toMatch(/Promise</);
  });

  it("3. structural: the port still has no delete method", () => {
    expect(portSource).not.toMatch(/deletePost|removePost|\bdelete\(/);
  });

  it("4. structural: PersistedFedosBoardRepository still conservatively maps a persistence 'failed' write to 'conflict'", () => {
    expect(repositorySource).toMatch(/if \(result === "failed"\) \{/);
    expect(repositorySource).toMatch(/return "conflict";/);
  });

  it("5. structural: hydrateFedosBoardService still reads listPosts() exactly once and branches on no backend-specific field", () => {
    expect(hydrationSource).toMatch(/persistence\.listPosts\(\)/);
    expect(hydrationSource).not.toMatch(/InMemoryFedosBoardPersistence|sqlite|Sqlite|SQLite/);
  });

  it("6. structural: serialization still performs no JSON.stringify/JSON.parse step", () => {
    expect(codecSource).not.toMatch(/JSON\.stringify|JSON\.parse/);
  });

  it("7. the design doc names all four backend-independent properties it freezes", () => {
    const normalized = normalize(designDocSource);
    expect(normalized).toContain("**Synchronous.**");
    expect(normalized).toContain("**No database vocabulary.**");
    expect(normalized).toContain("**No `delete` method.**");
    expect(normalized).toContain("**`FedosBoardPersistenceWriteResult`**");
  });

  it("8. the design doc explicitly states no redesign is proposed", () => {
    expect(normalize(designDocSource)).toContain("redesign is proposed anywhere in this Stage.**");
  });

  it("9. the design doc cross-references Alpha 341, Alpha 315, Alpha 317, Alpha 318, and Alpha 314", () => {
    for (const ref of [
      "secure_runtime_alpha_341_host_capability_inventory",
      "secure_runtime_alpha_315_board_persistence_port",
      "secure_runtime_alpha_317_persisted_board_repository",
      "secure_runtime_alpha_318_board_hydration_index_rebuild",
      "secure_runtime_alpha_314_board_serialization_boundary",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
