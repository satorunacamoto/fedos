import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_379_four_protocol_query_verification.md?raw";

import { FedosBoardQuery } from "../src/os/messenger/board/query/fedos_board_query.js";
import { FedosBoardService } from "../src/os/messenger/board/repository/fedos_board_service.js";

import { validateNostrBoardPost } from "../src/os/messenger/board/fedos_board_nostr_adapter.js";
import type { FedosValidatedNostrEvent } from "../src/os/messenger/desktop/fedos_validated_nostr_event.js";
import { validateActivityPubBoardPost } from "../src/os/messenger/board/activitypub/fedos_activitypub_board_adapter.js";
import type { FedosValidatedActivityPubPost } from "../src/os/messenger/board/activitypub/fedos_validated_activitypub_post.js";
import { validateAtprotoBoardPost } from "../src/os/messenger/board/atproto/fedos_atproto_board_adapter.js";
import type { FedosValidatedAtprotoPost } from "../src/os/messenger/board/atproto/fedos_validated_atproto_post.js";
import { validateSessionBoardPost } from "../src/os/messenger/board/session/fedos_session_board_adapter.js";
import type { FedosValidatedSessionPost } from "../src/os/messenger/board/session/fedos_validated_session_post.js";

const BOARD_ID = "board-379";

const nostrRoot: FedosValidatedNostrEvent = {
  id: "a".repeat(64),
  pubkey: "b".repeat(64),
  created_at: 1_700_000_100,
  kind: 1,
  tags: [],
  content: "Hello from Nostr",
  sig: "c".repeat(128),
};

const activityPubRoot: FedosValidatedActivityPubPost = {
  objectId: "https://mastodon.example/users/alice/statuses/1",
  actorId: "https://mastodon.example/users/alice",
  content: "Hello from Mastodon",
  published: 1_700_000_200,
  inReplyTo: null,
  conversationRoot: null,
};

const atprotoRootUri = "at://did:plc:abc123/app.bsky.feed.post/root1";
const atprotoRoot: FedosValidatedAtprotoPost = {
  uri: atprotoRootUri,
  cid: "bafyroot1",
  authorDid: "did:plc:abc123",
  text: "Hello from Bluesky",
  createdAt: 1_700_000_300,
  replyRootUri: null,
  replyParentUri: null,
};
const atprotoReply: FedosValidatedAtprotoPost = {
  uri: "at://did:plc:abc123/app.bsky.feed.post/reply1",
  cid: "bafyreply1",
  authorDid: "did:plc:abc123",
  text: "Reply on Bluesky",
  createdAt: 1_700_000_800,
  replyRootUri: atprotoRootUri,
  replyParentUri: atprotoRootUri,
};

const sessionRoot: FedosValidatedSessionPost = {
  messageId: "sess-msg-1",
  sessionId: "05" + "a".repeat(64),
  authorId: "05" + "b".repeat(64),
  body: "Hello from Session",
  createdAt: 1_700_000_600,
  replyTo: null,
};

function seededService() {
  const service = new FedosBoardService();
  const nostrPost = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
  const activityPubPost = validateActivityPubBoardPost(activityPubRoot, BOARD_ID)!;
  const atprotoPost = validateAtprotoBoardPost(atprotoRoot, BOARD_ID)!;
  const atprotoReplyPost = validateAtprotoBoardPost(atprotoReply, BOARD_ID)!;
  const sessionPost = validateSessionBoardPost(sessionRoot, BOARD_ID)!;
  for (const post of [nostrPost, activityPubPost, atprotoPost, atprotoReplyPost, sessionPost]) {
    service.registerPost(post);
  }
  return { service, nostrPost, activityPubPost, atprotoPost, atprotoReplyPost, sessionPost };
}

/**
 * Secure Runtime Alpha 379 -- "Four-Protocol Query Verification":
 * Stage 9 of the Alpha 371-380 Canonical Board Query Foundation Arc.
 * Real fixtures from all four Board Adapters, queried end to end
 * through FedosBoardQuery -- no adapter is modified.
 */
describe("Secure Runtime Alpha 379 -- Four-Protocol Query Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. recentFeed() returns all four protocols' own posts, correctly ordered", () => {
    const { service, nostrPost } = seededService();
    const result = new FedosBoardQuery(service).recentFeed(nostrPost.boardId, undefined, { limit: 100 });
    expect(result.posts).toHaveLength(5);
    const createdAts = result.posts.map((p) => p.createdAt);
    expect(createdAts).toEqual([...createdAts].sort((a, b) => b - a));
  });

  it("3. protocol filter isolates each of the four protocols in turn, and a fifth reserved token yields zero matches", () => {
    const { service, nostrPost } = seededService();
    const query = new FedosBoardQuery(service);
    expect(query.recentFeed(nostrPost.boardId, { protocol: "nostr" }).posts).toHaveLength(1);
    expect(query.recentFeed(nostrPost.boardId, { protocol: "activitypub" }).posts).toHaveLength(1);
    expect(query.recentFeed(nostrPost.boardId, { protocol: "atproto" }).posts).toHaveLength(2); // root + reply
    expect(query.recentFeed(nostrPost.boardId, { protocol: "session" }).posts).toHaveLength(1);
    expect(query.recentFeed(nostrPost.boardId, { protocol: "fedos" }).posts).toEqual([]); // reserved, never registered
  });

  it("4. thread() correctly groups a cross-protocol-capable thread in chronological order", () => {
    const { service, atprotoPost, atprotoReplyPost } = seededService();
    const result = new FedosBoardQuery(service).thread(atprotoPost.boardId, atprotoPost.threadId);
    expect(result.posts.map((p) => p.id)).toEqual([atprotoPost.id, atprotoReplyPost.id]); // root before reply
  });

  it("5. authorPublicIdentifier filtering works identically across all four protocols' own author shapes", () => {
    const { service, nostrPost, activityPubPost, atprotoPost, sessionPost } = seededService();
    const query = new FedosBoardQuery(service);
    expect(query.recentFeed(nostrPost.boardId, { authorPublicIdentifier: nostrPost.author.publicIdentifier }).posts).toHaveLength(1);
    expect(query.recentFeed(nostrPost.boardId, { authorPublicIdentifier: activityPubPost.author.publicIdentifier }).posts).toHaveLength(1);
    expect(query.recentFeed(nostrPost.boardId, { authorPublicIdentifier: atprotoPost.author.publicIdentifier }).posts.length).toBeGreaterThanOrEqual(1);
    expect(query.recentFeed(nostrPost.boardId, { authorPublicIdentifier: sessionPost.author.publicIdentifier }).posts).toHaveLength(1);
  });

  it("6. pagination composes correctly with a mixed-protocol result set", () => {
    const { service, nostrPost } = seededService();
    const result = new FedosBoardQuery(service).recentFeed(nostrPost.boardId, undefined, { limit: 2 });
    expect(result.posts).toHaveLength(2);
    expect(result.total).toBe(5);
    expect(result.hasMore).toBe(true);
  });

  it("7. no adapter is modified -- each protocol's own known-good fixture result is reproduced unchanged", () => {
    const { nostrPost, activityPubPost, atprotoPost, sessionPost } = seededService();
    expect(nostrPost.source).toEqual({ protocol: "nostr", reference: nostrRoot.id });
    expect(activityPubPost.source).toEqual({ protocol: "activitypub", reference: activityPubRoot.objectId });
    expect(atprotoPost.source).toEqual({ protocol: "atproto", reference: atprotoRoot.uri });
    expect(sessionPost.source).toEqual({ protocol: "session", reference: sessionRoot.messageId });
  });

  it("8. the design doc cross-references Alpha 378, Alpha 309, and Alpha 359", () => {
    for (const ref of [
      "secure_runtime_alpha_378_performance_review",
      "secure_runtime_alpha_309_four_protocol_board_integration",
      "secure_runtime_alpha_359_four_protocol_append_only_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
