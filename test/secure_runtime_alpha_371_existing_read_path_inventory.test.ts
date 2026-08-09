import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_371_existing_read_path_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/board/repository/fedos_board_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import feedSource from "../src/board/repository/fedos_board_feed.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import indexSource from "../src/board/repository/fedos_board_index.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import repositorySource from "../src/board/repository/fedos_board_repository.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import threadQuerySource from "../src/os/_legacy_prototype/query/thread_query.ts?raw";

/**
 * Secure Runtime Alpha 371 -- "Existing Read Path Inventory": Stage 1
 * of the Alpha 371-380 Canonical Board Query Foundation Arc. Review
 * only. Inventories every existing Board read path and confirms the
 * unrelated src/query/thread_query.ts is not touched or reused.
 */
describe("Secure Runtime Alpha 371 -- Existing Read Path Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. structural: FedosBoardService's own two list methods are unchanged", () => {
    expect(serviceSource).toMatch(/listBoardPosts\(boardId: FedosBoardId\): readonly FedosBoardPost\[\]/);
    expect(serviceSource).toMatch(/listThreadPosts\(boardId: FedosBoardId, threadId: FedosThreadId\): readonly FedosBoardPost\[\]/);
  });

  it("3. structural: FedosBoardFeed's own listRecentPosts signature and limit constants are unchanged", () => {
    expect(feedSource).toMatch(/listRecentPosts\(boardId: FedosBoardId, limit: number\): readonly FedosBoardPost\[\]/);
    expect(feedSource).toMatch(/FEDOS_BOARD_FEED_MIN_LIMIT = 1/);
    expect(feedSource).toMatch(/FEDOS_BOARD_FEED_MAX_LIMIT = 100/);
  });

  it("4. structural: FedosBoardIndex still returns Set-derived (unordered) arrays -- confirming no documented sort exists there", () => {
    expect(indexSource).toMatch(/listBoardPostIds\(boardId: FedosBoardId\): readonly FedosBoardPostId\[\] \{/);
    expect(indexSource).toMatch(/return set === undefined \? \[\] : \[\.\.\.set\];/);
  });

  it("5. structural: FedosBoardRepository's own frozen contract is unchanged", () => {
    expect(repositorySource).toMatch(/export interface FedosBoardRepository \{/);
    expect(repositorySource).toMatch(/register\(post: FedosBoardPost\): FedosBoardRepositoryWriteResult;/);
  });

  it("6. structural: this Arc's own new query layer imports nothing from, and src/query/thread_query.ts imports nothing from, the Board layer", () => {
    expect(threadQuerySource).not.toMatch(/FedosBoardPost|FedosBoardService|FedosBoardQuery|from ["'].*\/board\//);
  });

  it("7. the design doc's own table names all four existing read paths", () => {
    for (const path of [
      "FedosBoardService.findPost",
      "FedosBoardService.listBoardPosts",
      "FedosBoardService.listThreadPosts",
      "FedosBoardFeed.listRecentPosts",
    ]) {
      expect(designDocSource).toContain(path);
    }
  });

  it("8. the design doc names all four precise gaps this Arc closes", () => {
    expect(designDocSource).toContain(
      "## 4. What is missing, precisely",
    );
    expect(designDocSource).toMatch(/No filtering exists anywhere in the Board layer/);
    expect(designDocSource).toMatch(/No offset pagination exists anywhere in the Board layer/);
    expect(designDocSource).toMatch(/Thread reads have no deterministic order/);
    expect(designDocSource).toMatch(/No unified result shape/);
  });

  it("9. the design doc cross-references Alpha 370, Alpha 308, Alpha 307, Alpha 305, and Alpha 302", () => {
    for (const ref of [
      "secure_runtime_alpha_370_recovery_robustness_completion",
      "secure_runtime_alpha_308_chronological_board_feed",
      "secure_runtime_alpha_307_board_application_service",
      "secure_runtime_alpha_305_board_thread_index",
      "secure_runtime_alpha_302_board_repository_contract",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
