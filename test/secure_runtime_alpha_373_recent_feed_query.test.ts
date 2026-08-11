import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_373_recent_feed_query.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import querySource from "../src/os/messenger/board/query/fedos_board_query.ts?raw";

import { FedosBoardQuery } from "../src/os/messenger/board/query/fedos_board_query.js";
import { FedosBoardService } from "../src/os/messenger/board/repository/fedos_board_service.js";
import { FedosBoardFeed } from "../src/os/messenger/board/repository/fedos_board_feed.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";
import { toFedosBoardId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import type { FedosBoardId } from "../src/os/messenger/board/fedos_board_identifiers.js";

function rootInput(id: string, createdAt: number): FedosBoardPostInput {
  return {
    id,
    boardId: "board-373",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
    body: `body-${id}`,
    createdAt,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

function seededService(): FedosBoardService {
  const service = new FedosBoardService();
  service.registerPost(validateFedosBoardPost(rootInput("post-1", 1_700_000_100))!);
  service.registerPost(validateFedosBoardPost(rootInput("post-2", 1_700_000_300))!);
  service.registerPost(validateFedosBoardPost(rootInput("post-3", 1_700_000_200))!);
  return service;
}

/**
 * Secure Runtime Alpha 373 -- "Recent Feed Query": Stage 3 of the
 * Alpha 371-380 Canonical Board Query Foundation Arc. Adds
 * FedosBoardQuery.recentFeed() -- createdAt DESC, id ASC tie-break,
 * matching FedosBoardFeed's own established order.
 */
describe("Secure Runtime Alpha 373 -- Recent Feed Query", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. behavioral: recentFeed() orders newest-first", () => {
    const boardId = toFedosBoardId("board-373") as FedosBoardId;
    const query = new FedosBoardQuery(seededService());
    const result = query.recentFeed(boardId);
    expect(result.posts.map((p) => p.id)).toEqual(["post-2", "post-3", "post-1"]);
  });

  it("3. behavioral: recentFeed()'s own default order is identical to FedosBoardFeed's own order", () => {
    const boardId = toFedosBoardId("board-373") as FedosBoardId;
    const service = seededService();
    const viaQuery = new FedosBoardQuery(service).recentFeed(boardId, undefined, { limit: 100 });
    const viaFeed = new FedosBoardFeed(service).listRecentPosts(boardId, 100);
    expect(viaQuery.posts.map((p) => p.id)).toEqual(viaFeed.map((p) => p.id));
  });

  it("4. behavioral: recentFeed() returns a unified result shape with total/hasMore, unlike FedosBoardFeed's bare array", () => {
    const boardId = toFedosBoardId("board-373") as FedosBoardId;
    const result = new FedosBoardQuery(seededService()).recentFeed(boardId);
    expect(result.total).toBe(3);
    expect(result.hasMore).toBe(false);
    expect(Array.isArray(result.posts)).toBe(true);
  });

  it("5. behavioral: an empty board returns an empty, well-formed result, never throws", () => {
    const boardId = toFedosBoardId("board-empty-373") as FedosBoardId;
    const result = new FedosBoardQuery(new FedosBoardService()).recentFeed(boardId);
    expect(result).toEqual({ posts: [], total: 0, offset: 0, limit: 20, hasMore: false });
  });

  it("6. structural: recentFeed() reimplements its own comparator rather than importing FedosBoardFeed", () => {
    expect(querySource).not.toMatch(/from ["'].*fedos_board_feed\.js["']/);
    expect(querySource).toMatch(/function feedOrder\(/);
  });

  it("7. the design doc explains why FedosBoardFeed's own limited API is not reused via delegation", () => {
    expect(designDocSource).toContain(
      "## 3. Why this reimplements the comparator rather than importing `FedosBoardFeed`'s own",
    );
  });

  it("8. the design doc cross-references Alpha 372, Alpha 308, and Alpha 371", () => {
    for (const ref of [
      "secure_runtime_alpha_372_canonical_board_query_contract",
      "secure_runtime_alpha_308_chronological_board_feed",
      "secure_runtime_alpha_371_existing_read_path_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
