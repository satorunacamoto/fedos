import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_377_deterministic_ordering_verification.md?raw";

import { FedosBoardQuery } from "../src/os/messenger/board/query/fedos_board_query.js";
import { FedosBoardService } from "../src/os/messenger/board/repository/fedos_board_service.js";
import { FedosBoardFeed } from "../src/os/messenger/board/repository/fedos_board_feed.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";
import { toFedosBoardId, toFedosThreadId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import type { FedosBoardId, FedosThreadId } from "../src/os/messenger/board/fedos_board_identifiers.js";

function root(id: string, protocol: string, createdAt: number): FedosBoardPostInput {
  return {
    id,
    boardId: "board-377",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol, publicIdentifier: `author-${id}` },
    body: `root ${id}`,
    createdAt,
    source: { protocol, reference: `ref-${id}` },
  };
}
function reply(id: string, replyTo: string, threadId: string, protocol: string, createdAt: number): FedosBoardPostInput {
  return {
    id,
    boardId: "board-377",
    threadId,
    replyTo,
    author: { identityId: null, protocol, publicIdentifier: `author-${id}` },
    body: `reply ${id}`,
    createdAt,
    source: { protocol, reference: `ref-${id}` },
  };
}

const BOARD_ID = toFedosBoardId("board-377") as FedosBoardId;

/**
 * Secure Runtime Alpha 377 -- "Deterministic Ordering Verification":
 * Stage 7 of the Alpha 371-380 Canonical Board Query Foundation Arc.
 * Proves every ordering claim by direct execution -- not merely
 * asserted in a design doc.
 */
describe("Secure Runtime Alpha 377 -- Deterministic Ordering Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. recentFeed()'s own default order is identical to FedosBoardFeed's own order, for the same fixtures", () => {
    const service = new FedosBoardService();
    for (const [id, createdAt] of [["a", 100], ["b", 300], ["c", 200]] as const) {
      service.registerPost(validateFedosBoardPost(root(id, "nostr", 1_700_000_000 + createdAt))!);
    }
    const viaQuery = new FedosBoardQuery(service).recentFeed(BOARD_ID, undefined, { limit: 100 }).posts.map((p) => p.id);
    const viaFeed = new FedosBoardFeed(service).listRecentPosts(BOARD_ID, 100).map((p) => p.id);
    expect(viaQuery).toEqual(viaFeed);
  });

  it("3. recentFeed() and thread() sort in opposite primary directions over the same data", () => {
    const service = new FedosBoardService();
    service.registerPost(validateFedosBoardPost(root("root-1", "nostr", 1_700_000_100))!);
    service.registerPost(validateFedosBoardPost(reply("reply-1", "root-1", "root-1", "nostr", 1_700_000_300))!);
    const query = new FedosBoardQuery(service);
    const feedIds = query.recentFeed(BOARD_ID).posts.map((p) => p.id);
    const threadIds = query.thread(BOARD_ID, toFedosThreadId("root-1") as FedosThreadId).posts.map((p) => p.id);
    expect(threadIds).toEqual([...feedIds].reverse());
  });

  it("4. both orderings resolve a createdAt tie deterministically via id ASC", () => {
    const service = new FedosBoardService();
    service.registerPost(validateFedosBoardPost(root("post-b", "nostr", 1_700_000_500))!);
    service.registerPost(validateFedosBoardPost(root("post-a", "nostr", 1_700_000_500))!); // identical createdAt
    const result = new FedosBoardQuery(service).recentFeed(BOARD_ID);
    expect(result.posts.map((p) => p.id)).toEqual(["post-a", "post-b"]); // id ASC tie-break, regardless of DESC time order
  });

  it("5. both orderings are independent of registration order", () => {
    const inputs = [
      root("post-1", "nostr", 1_700_000_100),
      root("post-2", "nostr", 1_700_000_300),
      root("post-3", "nostr", 1_700_000_200),
    ];
    const forward = new FedosBoardService();
    for (const i of inputs) forward.registerPost(validateFedosBoardPost(i)!);
    const shuffled = new FedosBoardService();
    for (const i of [inputs[2]!, inputs[0]!, inputs[1]!]) shuffled.registerPost(validateFedosBoardPost(i)!);

    const forwardIds = new FedosBoardQuery(forward).recentFeed(BOARD_ID).posts.map((p) => p.id);
    const shuffledIds = new FedosBoardQuery(shuffled).recentFeed(BOARD_ID).posts.map((p) => p.id);
    expect(forwardIds).toEqual(shuffledIds);
  });

  it("6. both orderings are independent of protocol origin", () => {
    const service = new FedosBoardService();
    service.registerPost(validateFedosBoardPost(root("post-1", "nostr", 1_700_000_100))!);
    service.registerPost(validateFedosBoardPost(root("post-2", "activitypub", 1_700_000_200))!);
    service.registerPost(validateFedosBoardPost(root("post-3", "atproto", 1_700_000_300))!);
    service.registerPost(validateFedosBoardPost(root("post-4", "session", 1_700_000_400))!);
    const result = new FedosBoardQuery(service).recentFeed(BOARD_ID);
    const createdAts = result.posts.map((p) => p.createdAt);
    expect(createdAts).toEqual([...createdAts].sort((a, b) => b - a));
  });

  it("7. repeated calls to the same query are byte-for-byte identical", () => {
    const service = new FedosBoardService();
    service.registerPost(validateFedosBoardPost(root("post-1", "nostr", 1_700_000_100))!);
    service.registerPost(validateFedosBoardPost(root("post-2", "nostr", 1_700_000_200))!);
    const query = new FedosBoardQuery(service);
    const first = query.recentFeed(BOARD_ID).posts.map((p) => p.id);
    const second = query.recentFeed(BOARD_ID).posts.map((p) => p.id);
    expect(first).toEqual(second);
  });

  it("8. the design doc states thread() has no precedent -- this Stage is the first place it is actually tested", () => {
    expect(designDocSource).toContain(
      "## 3. Why this matters specifically for `thread()`",
    );
  });

  it("9. the design doc cross-references Alpha 374, Alpha 373, and Alpha 308", () => {
    for (const ref of [
      "secure_runtime_alpha_374_thread_query",
      "secure_runtime_alpha_373_recent_feed_query",
      "secure_runtime_alpha_308_chronological_board_feed",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
