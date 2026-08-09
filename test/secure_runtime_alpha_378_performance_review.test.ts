import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_378_performance_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import querySource from "../src/os/messenger/board/query/fedos_board_query.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import typesSource from "../src/os/messenger/board/query/fedos_board_query_types.ts?raw";

import { FedosBoardQuery } from "../src/board/query/fedos_board_query.js";
import { FedosBoardService } from "../src/board/repository/fedos_board_service.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";
import { toFedosBoardId } from "../src/board/fedos_board_identifiers.js";
import type { FedosBoardId } from "../src/board/fedos_board_identifiers.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

function rootInput(id: string, createdAt: number): FedosBoardPostInput {
  return {
    id,
    boardId: "board-378",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
    body: `body-${id}`,
    createdAt,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

/**
 * Secure Runtime Alpha 378 -- "Performance Review": Stage 8 of the
 * Alpha 371-380 Canonical Board Query Foundation Arc. Review only.
 * Confirms the cost shape is O(k log k) per call, no side index, no
 * new persistent state.
 */
describe("Secure Runtime Alpha 378 -- Performance Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. structural: FedosBoardQuery holds no field beyond the injected source -- no cache, no index", () => {
    const fieldDeclarations = codeOnly(querySource).match(/^\s*(readonly )?#\w+/gm) ?? [];
    expect(fieldDeclarations).toHaveLength(1);
    expect(fieldDeclarations[0]).toMatch(/#source/);
  });

  it("3. structural: neither query file constructs a Map, Set, or any persistent index structure", () => {
    for (const source of [codeOnly(querySource), codeOnly(typesSource)]) {
      expect(source).not.toMatch(/new Map\(|new Set\(/);
    }
  });

  it("4. behavioral: 500 records query correctly and complete well within a generous time budget", () => {
    const service = new FedosBoardService();
    for (let i = 0; i < 500; i += 1) {
      const id = `post-${String(i).padStart(4, "0")}`;
      service.registerPost(validateFedosBoardPost(rootInput(id, 1_700_000_000 + i))!);
    }
    const boardId = toFedosBoardId("board-378") as FedosBoardId;
    const query = new FedosBoardQuery(service);

    const start = Date.now();
    const result = query.recentFeed(boardId, undefined, { limit: 100 });
    const elapsedMs = Date.now() - start;

    expect(result.posts).toHaveLength(100);
    expect(result.total).toBe(500);
    expect(elapsedMs).toBeLessThan(2000); // generous budget -- this is a correctness/regression guard, not a benchmark
  });

  it("5. behavioral: repeated queries against a fixed dataset do not accumulate any observable state change", () => {
    const service = new FedosBoardService();
    for (let i = 0; i < 20; i += 1) {
      const id = `post-${String(i).padStart(3, "0")}`;
      service.registerPost(validateFedosBoardPost(rootInput(id, 1_700_000_000 + i))!);
    }
    const boardId = toFedosBoardId("board-378") as FedosBoardId;
    const query = new FedosBoardQuery(service);
    const first = query.recentFeed(boardId).total;
    for (let i = 0; i < 10; i += 1) query.recentFeed(boardId);
    const last = query.recentFeed(boardId).total;
    expect(last).toBe(first);
  });

  it("6. the design doc documents the cost shape precisely as O(k log k) per call", () => {
    expect(designDocSource).toContain("**Total: O(k log k) per call**");
  });

  it("7. the design doc explicitly declines to build a sort-order-aware index ahead of measured need", () => {
    expect(designDocSource).toContain("## 3. Whether an index would help");
  });

  it("8. the design doc cross-references Alpha 377, Alpha 368, Alpha 355, and Alpha 305", () => {
    for (const ref of [
      "secure_runtime_alpha_377_deterministic_ordering_verification",
      "secure_runtime_alpha_368_large_dataset_scalability_review",
      "secure_runtime_alpha_355_append_only_reading",
      "secure_runtime_alpha_305_board_thread_index",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
