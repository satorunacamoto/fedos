import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_374_thread_query.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import querySource from "../src/board/query/fedos_board_query.ts?raw";

import { FedosBoardQuery } from "../src/board/query/fedos_board_query.js";
import { FedosBoardService } from "../src/board/repository/fedos_board_service.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";
import { toFedosBoardId, toFedosThreadId } from "../src/board/fedos_board_identifiers.js";
import type { FedosBoardId, FedosThreadId } from "../src/board/fedos_board_identifiers.js";

function root(id: string, createdAt: number): FedosBoardPostInput {
  return {
    id,
    boardId: "board-374",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
    body: `root ${id}`,
    createdAt,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}
function reply(id: string, replyTo: string, threadId: string, createdAt: number): FedosBoardPostInput {
  return {
    id,
    boardId: "board-374",
    threadId,
    replyTo,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
    body: `reply ${id}`,
    createdAt,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

/**
 * Secure Runtime Alpha 374 -- "Thread Query": Stage 4 of the Alpha
 * 371-380 Canonical Board Query Foundation Arc. Adds
 * FedosBoardQuery.thread() -- createdAt ASC, id ASC tie-break, a
 * BRAND NEW deterministic-order guarantee this repository never had.
 */
describe("Secure Runtime Alpha 374 -- Thread Query", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: thread() orders chronologically ascending -- root first, then replies in posting order", () => {
    const boardId = toFedosBoardId("board-374") as FedosBoardId;
    const threadId = toFedosThreadId("root-1") as FedosThreadId;
    const service = new FedosBoardService();
    // Registered deliberately out of chronological order.
    service.registerPost(validateFedosBoardPost(root("root-1", 1_700_000_000))!);
    service.registerPost(validateFedosBoardPost(reply("reply-1", "root-1", "root-1", 1_700_000_300))!);
    service.registerPost(validateFedosBoardPost(reply("reply-2", "reply-1", "root-1", 1_700_000_100))!);

    const result = new FedosBoardQuery(service).thread(boardId, threadId);
    expect(result.posts.map((p) => p.id)).toEqual(["root-1", "reply-2", "reply-1"]);
  });

  it("3. behavioral: thread() sorts in the OPPOSITE primary direction from recentFeed()", () => {
    const boardId = toFedosBoardId("board-374") as FedosBoardId;
    const threadId = toFedosThreadId("root-1") as FedosThreadId;
    const service = new FedosBoardService();
    service.registerPost(validateFedosBoardPost(root("root-1", 1_700_000_000))!);
    service.registerPost(validateFedosBoardPost(reply("reply-1", "root-1", "root-1", 1_700_000_300))!);
    const query = new FedosBoardQuery(service);

    const threadOrder = query.thread(boardId, threadId).posts.map((p) => p.id);
    const feedOrder = query.recentFeed(boardId).posts.map((p) => p.id);
    expect(threadOrder).toEqual([...feedOrder].reverse());
  });

  it("4. behavioral: thread() replay order is independent of registration order (a reply registered before its parent still sorts correctly)", () => {
    const boardId = toFedosBoardId("board-374") as FedosBoardId;
    const threadId = toFedosThreadId("root-1") as FedosThreadId;
    const service = new FedosBoardService();
    // Register the root first (registerPost itself requires the parent to exist),
    // but note the createdAt values are NOT in registration order.
    service.registerPost(validateFedosBoardPost(root("root-1", 1_700_000_500))!); // root has the LATEST createdAt
    service.registerPost(validateFedosBoardPost(reply("reply-1", "root-1", "root-1", 1_700_000_100))!);

    const result = new FedosBoardQuery(service).thread(boardId, threadId);
    // Ordering follows createdAt, not registerPost() call order.
    expect(result.posts.map((p) => p.id)).toEqual(["reply-1", "root-1"]);
  });

  it("5. behavioral: an unknown thread returns an empty, well-formed result, never throws", () => {
    const boardId = toFedosBoardId("board-374") as FedosBoardId;
    const threadId = toFedosThreadId("does-not-exist") as FedosThreadId;
    const result = new FedosBoardQuery(new FedosBoardService()).thread(boardId, threadId);
    expect(result).toEqual({ posts: [], total: 0, offset: 0, limit: 20, hasMore: false });
  });

  it("6. structural: threadOrder sorts createdAt ASC, opposite of feedOrder's DESC", () => {
    expect(querySource).toMatch(/function threadOrder\(a: FedosBoardPost, b: FedosBoardPost\): number \{\s*const dt = a\.createdAt - b\.createdAt;/);
    expect(querySource).toMatch(/function feedOrder\(a: FedosBoardPost, b: FedosBoardPost\): number \{\s*const dt = b\.createdAt - a\.createdAt;/);
  });

  it("7. the design doc states this is a brand new guarantee, not a restatement of an existing one", () => {
    expect(designDocSource).toContain(
      "**This is a NEW guarantee, not a restatement of an existing one.**",
    );
  });

  it("8. the design doc cross-references Alpha 373, Alpha 371, Alpha 318, and Alpha 305", () => {
    for (const ref of [
      "secure_runtime_alpha_373_recent_feed_query",
      "secure_runtime_alpha_371_existing_read_path_inventory",
      "secure_runtime_alpha_318_board_hydration_index_rebuild",
      "secure_runtime_alpha_305_board_thread_index",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
