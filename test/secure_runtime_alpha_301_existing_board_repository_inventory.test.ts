import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_301_existing_board_repository_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import threadQuerySource from "../src/query/thread_query.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageTypesSource from "../src/storage/types.ts?raw";

/**
 * Secure Runtime Alpha 301 -- "Existing Board Repository / Index / Feed
 * Inventory": Stage 1 of the Canonical Board Repository, Index & Feed
 * Foundation Arc (Alpha 301-310). Review only. Confirms no Board
 * Repository exists before this Arc, that the existing ranked feed
 * (thread_query.ts) is not reused, and that p2p/ is confirmed unrelated
 * without being staged/modified.
 */
describe("Secure Runtime Alpha 301 -- Existing Board Repository / Index / Feed Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc answers all ten required inventory questions from its own §3", () => {
    for (let i = 1; i <= 10; i++) {
      expect(designDocSource).toMatch(new RegExp(`### 3\\.${i} `));
    }
  });

  it("3. structural: thread_query.ts's own ranked feed (top/hot) is confirmed to exist and is not reused", () => {
    expect(threadQuerySource).toMatch(/scoreThread/);
    expect(threadQuerySource).toMatch(/"top"|"hot"/);
  });

  it("4. structural: StorageBackend is confirmed inert -- 'nothing is persisted because nothing runs'", () => {
    expect(storageTypesSource).toMatch(/nothing is persisted because[\s*]+nothing runs/);
  });

  it("5. the design doc confirms p2p/ is a wholly unrelated repository, not staged or modified", () => {
    expect(designDocSource).toMatch(/Global Imbalance Radar/);
    expect(designDocSource).toMatch(/it is not staged, not modified,\s*\nnot imported/);
  });

  it("6. the design doc concludes new files belong under src/board/repository/", () => {
    expect(designDocSource).toContain("src/board/repository/");
  });

  it("7. the design doc cross-references Alpha 300, Alpha 257, Alpha 256, and Alpha 253", () => {
    for (const ref of [
      "secure_runtime_alpha_300_session_board_adapter_completion",
      "secure_runtime_alpha_257_board_validation_boundary",
      "secure_runtime_alpha_256_thread_reply_semantics",
      "secure_runtime_alpha_253_board_source_provenance",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
