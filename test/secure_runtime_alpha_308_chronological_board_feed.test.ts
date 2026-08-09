import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_308_chronological_board_feed.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import feedSource from "../src/os/messenger/board/repository/fedos_board_feed.ts?raw";
import {
  FedosBoardFeed,
  FEDOS_BOARD_FEED_MIN_LIMIT,
  FEDOS_BOARD_FEED_MAX_LIMIT,
  type FedosBoardFeedSource,
} from "../src/board/repository/fedos_board_feed.js";
import { FedosBoardService } from "../src/board/repository/fedos_board_service.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";
import type { FedosBoardPost } from "../src/board/fedos_board_post.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

const BASE_INPUT: FedosBoardPostInput = {
  id: "post-1",
  boardId: "board-1",
  threadId: "post-1",
  replyTo: null,
  author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
  body: "Hello board world",
  createdAt: 1_700_000_000,
  source: { protocol: "nostr", reference: "ref-1" },
};

function buildPost(overrides: Partial<FedosBoardPostInput>): FedosBoardPost {
  return validateFedosBoardPost({ ...BASE_INPUT, ...overrides })!;
}

/**
 * Secure Runtime Alpha 308 -- "Chronological Board Feed": Stage 8 of
 * the Canonical Board Repository, Index & Feed Foundation Arc. Adds
 * src/board/repository/fedos_board_feed.ts, exporting FedosBoardFeed --
 * createdAt DESC / id ASC tie-break, [1, 100] clamped limit, no
 * ranking.
 */
describe("Secure Runtime Alpha 308 -- Chronological Board Feed", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: posts are ordered createdAt DESC", () => {
    const older = buildPost({ id: "post-older", threadId: "post-older", source: { protocol: "nostr", reference: "r1" }, createdAt: 1_700_000_000 });
    const newer = buildPost({ id: "post-newer", threadId: "post-newer", source: { protocol: "nostr", reference: "r2" }, createdAt: 1_700_000_500 });
    const source: FedosBoardFeedSource = { listBoardPosts: () => [older, newer] };
    const feed = new FedosBoardFeed(source);
    const result = feed.listRecentPosts(older.boardId, 10);
    expect(result.map((p) => p.id)).toEqual(["post-newer", "post-older"]);
  });

  it("3. behavioral: tie-break is id ASC when createdAt is equal", () => {
    const postB = buildPost({ id: "post-b", threadId: "post-b", source: { protocol: "nostr", reference: "r1" } });
    const postA = buildPost({ id: "post-a", threadId: "post-a", source: { protocol: "nostr", reference: "r2" } });
    const source: FedosBoardFeedSource = { listBoardPosts: () => [postB, postA] };
    const feed = new FedosBoardFeed(source);
    const result = feed.listRecentPosts(postA.boardId, 10);
    expect(result.map((p) => p.id)).toEqual(["post-a", "post-b"]);
  });

  it("4. behavioral: limit is respected", () => {
    const posts = [1, 2, 3, 4, 5].map((n) =>
      buildPost({ id: `post-${n}`, threadId: `post-${n}`, source: { protocol: "nostr", reference: `r${n}` }, createdAt: 1_700_000_000 + n }),
    );
    const source: FedosBoardFeedSource = { listBoardPosts: () => posts };
    const feed = new FedosBoardFeed(source);
    expect(feed.listRecentPosts(posts[0]!.boardId, 2)).toHaveLength(2);
  });

  it("5. behavioral: limit <= 0 and non-finite values normalize to the minimum (1)", () => {
    const posts = [1, 2, 3].map((n) =>
      buildPost({ id: `post-${n}`, threadId: `post-${n}`, source: { protocol: "nostr", reference: `r${n}` } }),
    );
    const source: FedosBoardFeedSource = { listBoardPosts: () => posts };
    const feed = new FedosBoardFeed(source);
    expect(feed.listRecentPosts(posts[0]!.boardId, 0)).toHaveLength(FEDOS_BOARD_FEED_MIN_LIMIT);
    expect(feed.listRecentPosts(posts[0]!.boardId, -5)).toHaveLength(FEDOS_BOARD_FEED_MIN_LIMIT);
    expect(feed.listRecentPosts(posts[0]!.boardId, Number.NaN)).toHaveLength(FEDOS_BOARD_FEED_MIN_LIMIT);
    expect(feed.listRecentPosts(posts[0]!.boardId, Number.POSITIVE_INFINITY)).toHaveLength(FEDOS_BOARD_FEED_MIN_LIMIT);
  });

  it("6. behavioral: a limit above the maximum is clamped to 100; non-integer limits are floored", () => {
    const posts = Array.from({ length: 150 }, (_, i) =>
      buildPost({
        id: `post-${i}`,
        threadId: `post-${i}`,
        source: { protocol: "nostr", reference: `r${i}` },
        createdAt: 1_700_000_000 + i,
      }),
    );
    const source: FedosBoardFeedSource = { listBoardPosts: () => posts };
    const feed = new FedosBoardFeed(source);
    expect(feed.listRecentPosts(posts[0]!.boardId, 1000)).toHaveLength(FEDOS_BOARD_FEED_MAX_LIMIT);
    expect(feed.listRecentPosts(posts[0]!.boardId, 3.9)).toHaveLength(3);
  });

  it("7. behavioral: no mutation of the source's own returned array", () => {
    const posts = [buildPost({})];
    const source: FedosBoardFeedSource = { listBoardPosts: () => posts };
    const feed = new FedosBoardFeed(source);
    feed.listRecentPosts(posts[0]!.boardId, 10);
    expect(posts).toEqual([posts[0]]); // untouched, same single-element array
  });

  it("8. behavioral: board-specific -- a FedosBoardService's own listBoardPosts satisfies FedosBoardFeedSource structurally", () => {
    const service = new FedosBoardService();
    const post = buildPost({});
    service.registerPost(post);
    const feed = new FedosBoardFeed(service);
    expect(feed.listRecentPosts(post.boardId, 10)).toEqual([post]);
  });

  it("9. structural: no ranking/score/personalization/random reference IN CODE", () => {
    expect(codeOnly(feedSource)).not.toMatch(/rank|score|personaliz|recommend|Math\.random/i);
  });

  it("10. structural: no FedosBoardFeedEntry wrapper exists -- returns FedosBoardPost[] directly", () => {
    expect(feedSource).not.toMatch(/FedosBoardFeedEntry/);
  });

  it("11. the design doc states the tie-break direction explicitly", () => {
    expect(designDocSource).toMatch(/LEXICOGRAPHICALLY SMALLER `id`\s*\nsorts FIRST/);
  });

  it("12. the design doc documents the exact limit normalization policy", () => {
    expect(designDocSource).toMatch(/Adopted: normalize/);
  });

  it("13. the design doc cross-references Alpha 301, Alpha 307, and Alpha 309", () => {
    for (const ref of [
      "secure_runtime_alpha_301_existing_board_repository_inventory",
      "secure_runtime_alpha_307_board_application_service",
      "secure_runtime_alpha_309_four_protocol_board_integration",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
