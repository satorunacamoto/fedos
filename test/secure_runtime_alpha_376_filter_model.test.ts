import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_376_filter_model.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import querySource from "../src/os/messenger/board/query/fedos_board_query.ts?raw";

import { FedosBoardQuery } from "../src/board/query/fedos_board_query.js";
import { FedosBoardService } from "../src/board/repository/fedos_board_service.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";
import { toFedosBoardId, toFedosThreadId } from "../src/board/fedos_board_identifiers.js";
import type { FedosBoardId, FedosThreadId } from "../src/board/fedos_board_identifiers.js";

function input(
  id: string,
  protocol: "nostr" | "activitypub" | "atproto" | "session",
  author: string,
  createdAt: number,
): FedosBoardPostInput {
  return {
    id,
    boardId: "board-376",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol, publicIdentifier: author },
    body: `body-${id}`,
    createdAt,
    source: { protocol, reference: `ref-${id}` },
  };
}

function seededService(): FedosBoardService {
  const service = new FedosBoardService();
  service.registerPost(validateFedosBoardPost(input("nostr-a", "nostr", "author-a", 1_700_000_100))!);
  service.registerPost(validateFedosBoardPost(input("nostr-b", "nostr", "author-b", 1_700_000_200))!);
  service.registerPost(validateFedosBoardPost(input("ap-a", "activitypub", "author-a", 1_700_000_300))!);
  service.registerPost(validateFedosBoardPost(input("atproto-a", "atproto", "author-c", 1_700_000_400))!);
  return service;
}

/**
 * Secure Runtime Alpha 376 -- "Filter Model": Stage 6 of the Alpha
 * 371-380 Canonical Board Query Foundation Arc. Four dimensions
 * (protocol/authorPublicIdentifier/since/until), AND-only, evaluated
 * in one shared function used by both query methods.
 */
describe("Secure Runtime Alpha 376 -- Filter Model", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: no filter (undefined) matches every post -- a genuine no-op", () => {
    const boardId = toFedosBoardId("board-376") as FedosBoardId;
    const withoutFilter = new FedosBoardQuery(seededService()).recentFeed(boardId);
    const withEmptyFilter = new FedosBoardQuery(seededService()).recentFeed(boardId, {});
    expect(withoutFilter.total).toBe(4);
    expect(withEmptyFilter.total).toBe(4);
  });

  it("3. behavioral: protocol filter isolates exactly the matching protocol", () => {
    const boardId = toFedosBoardId("board-376") as FedosBoardId;
    const query = new FedosBoardQuery(seededService());
    expect(query.recentFeed(boardId, { protocol: "nostr" }).posts.map((p) => p.id).sort()).toEqual(["nostr-a", "nostr-b"]);
    expect(query.recentFeed(boardId, { protocol: "activitypub" }).posts.map((p) => p.id)).toEqual(["ap-a"]);
    expect(query.recentFeed(boardId, { protocol: "session" }).posts).toEqual([]);
  });

  it("4. behavioral: authorPublicIdentifier filter matches exactly, across protocols", () => {
    const boardId = toFedosBoardId("board-376") as FedosBoardId;
    const query = new FedosBoardQuery(seededService());
    const byAuthorA = query.recentFeed(boardId, { authorPublicIdentifier: "author-a" });
    expect(byAuthorA.posts.map((p) => p.id).sort()).toEqual(["ap-a", "nostr-a"]); // spans two protocols
  });

  it("5. behavioral: since/until bound createdAt inclusively", () => {
    const boardId = toFedosBoardId("board-376") as FedosBoardId;
    const query = new FedosBoardQuery(seededService());
    const inRange = query.recentFeed(boardId, { since: 1_700_000_200, until: 1_700_000_300 });
    expect(inRange.posts.map((p) => p.id).sort()).toEqual(["ap-a", "nostr-b"]);
    const exactBoundary = query.recentFeed(boardId, { since: 1_700_000_200, until: 1_700_000_200 });
    expect(exactBoundary.posts.map((p) => p.id)).toEqual(["nostr-b"]);
  });

  it("6. behavioral: combined filters use AND semantics, never OR", () => {
    const boardId = toFedosBoardId("board-376") as FedosBoardId;
    const query = new FedosBoardQuery(seededService());
    const combined = query.recentFeed(boardId, { protocol: "nostr", authorPublicIdentifier: "author-a" });
    expect(combined.posts.map((p) => p.id)).toEqual(["nostr-a"]);
    const noMatch = query.recentFeed(boardId, { protocol: "activitypub", authorPublicIdentifier: "author-b" });
    expect(noMatch.posts).toEqual([]);
  });

  it("7. behavioral: the same filter model applies identically to thread()", () => {
    const boardId = toFedosBoardId("board-376") as FedosBoardId;
    const service = seededService();
    // A reply to nostr-a, from a different protocol, inside the same thread.
    service.registerPost(
      validateFedosBoardPost({
        id: "nostr-a-reply",
        boardId: "board-376",
        threadId: "nostr-a",
        replyTo: "nostr-a",
        author: { identityId: null, protocol: "session", publicIdentifier: "author-d" },
        body: "reply body",
        createdAt: 1_700_000_150,
        source: { protocol: "session", reference: "reply-ref" },
      })!,
    );
    const threadId = toFedosThreadId("nostr-a") as FedosThreadId;
    const result = new FedosBoardQuery(service).thread(boardId, threadId, { protocol: "session" });
    expect(result.posts.map((p) => p.id)).toEqual(["nostr-a-reply"]);
  });

  it("8. structural: matchesFilter is the ONE function both recentFeed() and thread() call", () => {
    const matchesFilterOccurrences = (querySource.match(/matchesFilter\(post, filter\)/g) ?? []).length;
    expect(matchesFilterOccurrences).toBe(2);
    const functionDefinitions = (querySource.match(/function matchesFilter\(/g) ?? []).length;
    expect(functionDefinitions).toBe(1);
  });

  it("9. the design doc names all four rejected candidate filter dimensions with a stated reason each", () => {
    for (const rejected of [
      "**Text/body search.**",
      "**Reply-count / engagement threshold.**",
      "**`identityId` filter.**",
      "**`replyTo` filter",
    ]) {
      expect(designDocSource).toContain(rejected);
    }
  });

  it("10. the design doc cross-references Alpha 375, Alpha 372, Alpha 305, and Alpha 254", () => {
    for (const ref of [
      "secure_runtime_alpha_375_pagination_policy",
      "secure_runtime_alpha_372_canonical_board_query_contract",
      "secure_runtime_alpha_305_board_thread_index",
      "secure_runtime_alpha_254_canonical_board_author",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
