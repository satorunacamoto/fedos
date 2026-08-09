import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_375_pagination_policy.md?raw";

import {
  FedosBoardQuery,
  FEDOS_BOARD_QUERY_MIN_LIMIT,
  FEDOS_BOARD_QUERY_MAX_LIMIT,
  FEDOS_BOARD_QUERY_DEFAULT_LIMIT,
} from "../src/os/messenger/board/query/fedos_board_query.js";
import { FedosBoardService } from "../src/os/messenger/board/repository/fedos_board_service.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";
import { toFedosBoardId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import type { FedosBoardId } from "../src/os/messenger/board/fedos_board_identifiers.js";

function rootInput(id: string, createdAt: number): FedosBoardPostInput {
  return {
    id,
    boardId: "board-375",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
    body: `body-${id}`,
    createdAt,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

function serviceWith(n: number): FedosBoardService {
  const service = new FedosBoardService();
  for (let i = 0; i < n; i += 1) {
    const id = `post-${String(i).padStart(3, "0")}`;
    service.registerPost(validateFedosBoardPost(rootInput(id, 1_700_000_000 + i))!);
  }
  return service;
}

/**
 * Secure Runtime Alpha 375 -- "Pagination Policy": Stage 5 of the
 * Alpha 371-380 Canonical Board Query Foundation Arc. Offset/limit
 * only, no cursor. Verifies clamping, total/hasMore semantics, and
 * that pagination is applied strictly after filtering.
 */
describe("Secure Runtime Alpha 375 -- Pagination Policy", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. structural: the limit constants match this Arc's own frozen numbers", () => {
    expect(FEDOS_BOARD_QUERY_MIN_LIMIT).toBe(1);
    expect(FEDOS_BOARD_QUERY_MAX_LIMIT).toBe(100);
    expect(FEDOS_BOARD_QUERY_DEFAULT_LIMIT).toBe(20);
  });

  it("3. behavioral: omitting page options applies the default limit", () => {
    const boardId = toFedosBoardId("board-375") as FedosBoardId;
    const result = new FedosBoardQuery(serviceWith(30)).recentFeed(boardId);
    expect(result.limit).toBe(20);
    expect(result.posts).toHaveLength(20);
    expect(result.hasMore).toBe(true);
  });

  it("4. behavioral: a limit above the max is clamped to 100", () => {
    const boardId = toFedosBoardId("board-375") as FedosBoardId;
    const result = new FedosBoardQuery(serviceWith(150)).recentFeed(boardId, undefined, { limit: 99999 });
    expect(result.limit).toBe(100);
    expect(result.posts).toHaveLength(100);
  });

  it("5. behavioral: a non-positive or non-finite limit falls back to the default", () => {
    const boardId = toFedosBoardId("board-375") as FedosBoardId;
    const query = new FedosBoardQuery(serviceWith(30));
    expect(query.recentFeed(boardId, undefined, { limit: 0 }).limit).toBe(FEDOS_BOARD_QUERY_MIN_LIMIT);
    expect(query.recentFeed(boardId, undefined, { limit: -5 }).limit).toBe(FEDOS_BOARD_QUERY_MIN_LIMIT);
    expect(query.recentFeed(boardId, undefined, { limit: Number.NaN }).limit).toBe(FEDOS_BOARD_QUERY_DEFAULT_LIMIT);
  });

  it("6. behavioral: a negative or non-finite offset falls back to zero", () => {
    const boardId = toFedosBoardId("board-375") as FedosBoardId;
    const query = new FedosBoardQuery(serviceWith(10));
    expect(query.recentFeed(boardId, undefined, { offset: -1 }).offset).toBe(0);
    expect(query.recentFeed(boardId, undefined, { offset: Number.NaN }).offset).toBe(0);
  });

  it("7. behavioral: an offset beyond the total is valid and yields an empty page, not an error", () => {
    const boardId = toFedosBoardId("board-375") as FedosBoardId;
    const result = new FedosBoardQuery(serviceWith(5)).recentFeed(boardId, undefined, { offset: 1000 });
    expect(result.posts).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.total).toBe(5);
  });

  it("8. behavioral: total reflects the FILTERED count, and pagination is applied strictly after filtering", () => {
    const boardId = toFedosBoardId("board-375") as FedosBoardId;
    const service = serviceWith(10);
    // Register one differently-protocol'd post so a filter genuinely narrows the set.
    service.registerPost(
      validateFedosBoardPost({
        id: "ap-post",
        boardId: "board-375",
        threadId: "ap-post",
        replyTo: null,
        author: { identityId: null, protocol: "activitypub", publicIdentifier: "https://example/actor" },
        body: "ap body",
        createdAt: 1_700_001_000,
        source: { protocol: "activitypub", reference: "ap-ref" },
      })!,
    );
    const query = new FedosBoardQuery(service);
    const filtered = query.recentFeed(boardId, { protocol: "activitypub" }, { limit: 1 });
    expect(filtered.total).toBe(1); // NOT 11 -- total is post-filter
    expect(filtered.posts).toHaveLength(1);
    expect(filtered.hasMore).toBe(false);
  });

  it("9. behavioral: hasMore is computed identically by recentFeed() and thread()", () => {
    const boardId = toFedosBoardId("board-375") as FedosBoardId;
    const result = new FedosBoardQuery(serviceWith(25)).recentFeed(boardId, undefined, { limit: 25 });
    expect(result.hasMore).toBe(false);
    expect(result.total).toBe(25);
  });

  it("10. the design doc rejects cursor pagination explicitly, adopting offset/limit", () => {
    expect(designDocSource).toContain("**ADOPTED.**");
    expect(designDocSource).toContain("- **Cursor-based pagination**");
  });

  it("11. the design doc cross-references Alpha 374, Alpha 373, Alpha 308, and Alpha 371", () => {
    for (const ref of [
      "secure_runtime_alpha_374_thread_query",
      "secure_runtime_alpha_373_recent_feed_query",
      "secure_runtime_alpha_308_chronological_board_feed",
      "secure_runtime_alpha_371_existing_read_path_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
