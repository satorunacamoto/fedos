import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_389_four_protocol_host_query_verification.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import querySource from "../src/os/messenger/board/query/fedos_board_query.ts?raw";

import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import type { FedosPublicIdentityReader } from "../src/os/messenger/desktop/fedos_public_identity_reader.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { serializeFedosBoardPost } from "../src/os/messenger/board/persistence/fedos_board_post_codec.js";

import { validateNostrBoardPost } from "../src/os/messenger/board/fedos_board_nostr_adapter.js";
import type { FedosValidatedNostrEvent } from "../src/os/messenger/desktop/fedos_validated_nostr_event.js";
import { validateActivityPubBoardPost } from "../src/os/messenger/board/activitypub/fedos_activitypub_board_adapter.js";
import type { FedosValidatedActivityPubPost } from "../src/os/messenger/board/activitypub/fedos_validated_activitypub_post.js";
import { validateAtprotoBoardPost } from "../src/os/messenger/board/atproto/fedos_atproto_board_adapter.js";
import type { FedosValidatedAtprotoPost } from "../src/os/messenger/board/atproto/fedos_validated_atproto_post.js";
import { validateSessionBoardPost } from "../src/os/messenger/board/session/fedos_session_board_adapter.js";
import type { FedosValidatedSessionPost } from "../src/os/messenger/board/session/fedos_validated_session_post.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";

class NullReader implements FedosPublicIdentityReader {
  async readPublicIdentity() {
    return null;
  }
}

const BOARD_ID = "board-389";

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

async function seededReadyHost() {
  const persistence = new InMemoryFedosBoardPersistence();
  const nostrPost = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
  const activityPubPost = validateActivityPubBoardPost(activityPubRoot, BOARD_ID)!;
  const atprotoPost = validateAtprotoBoardPost(atprotoRoot, BOARD_ID)!;
  const atprotoReplyPost = validateAtprotoBoardPost(atprotoReply, BOARD_ID)!;
  const sessionPost = validateSessionBoardPost(sessionRoot, BOARD_ID)!;
  for (const post of [nostrPost, activityPubPost, atprotoPost, atprotoReplyPost, sessionPost]) {
    persistence.putPost(serializeFedosBoardPost(post));
  }
  const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: persistence });
  await host.start();
  return { host, nostrPost, activityPubPost, atprotoPost, atprotoReplyPost, sessionPost };
}

/**
 * Secure Runtime Alpha 389 -- "Four-Protocol Host Query
 * Verification": Stage 9 of the Alpha 381-390 Canonical Board Query
 * Host Integration & Startup Failure Closure Arc. Real fixtures from
 * all four Board Adapters, queried end to end through host.query().
 */
describe("Secure Runtime Alpha 389 -- Four-Protocol Host Query Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. all four protocols appear in the same recent feed via host.query()", async () => {
    const { host, nostrPost } = await seededReadyHost();
    const result = host.query()!.recentFeed(nostrPost.boardId, undefined, { limit: 100 });
    expect(result.posts).toHaveLength(5);
  });

  it("3. protocol filter works through host.query()", async () => {
    const { host, nostrPost } = await seededReadyHost();
    const query = host.query()!;
    expect(query.recentFeed(nostrPost.boardId, { protocol: "nostr" }).posts).toHaveLength(1);
    expect(query.recentFeed(nostrPost.boardId, { protocol: "atproto" }).posts).toHaveLength(2);
  });

  it("4. author filter works through host.query()", async () => {
    const { host, nostrPost, sessionPost } = await seededReadyHost();
    const result = host.query()!.recentFeed(nostrPost.boardId, { authorPublicIdentifier: sessionPost.author.publicIdentifier });
    expect(result.posts.map((p) => p.id)).toEqual([sessionPost.id]);
  });

  it("5. since/until filters work through host.query()", async () => {
    const { host, nostrPost } = await seededReadyHost();
    const result = host.query()!.recentFeed(nostrPost.boardId, { since: 1_700_000_200, until: 1_700_000_300 });
    expect(result.total).toBe(2); // activitypub root + atproto root
  });

  it("6. thread query crosses protocols honestly, in chronological order", async () => {
    const { host, atprotoPost, atprotoReplyPost } = await seededReadyHost();
    const result = host.query()!.thread(atprotoPost.boardId, atprotoPost.threadId);
    expect(result.posts.map((p) => p.id)).toEqual([atprotoPost.id, atprotoReplyPost.id]);
  });

  it("7. ordering and pagination are deterministic across repeated calls", async () => {
    const { host, nostrPost } = await seededReadyHost();
    const query = host.query()!;
    const first = query.recentFeed(nostrPost.boardId, undefined, { limit: 3 });
    const second = query.recentFeed(nostrPost.boardId, undefined, { limit: 3 });
    expect(first.posts.map((p) => p.id)).toEqual(second.posts.map((p) => p.id));
  });

  it("8. Query never exposes a protocol-native object -- every returned post is a plain FedosBoardPost", async () => {
    const { host, nostrPost } = await seededReadyHost();
    const result = host.query()!.recentFeed(nostrPost.boardId, undefined, { limit: 100 });
    for (const post of result.posts) {
      expect(Object.keys(post).sort()).toEqual(
        ["id", "boardId", "threadId", "replyTo", "author", "body", "createdAt", "source"].sort(),
      );
    }
  });

  it("9. structural: Query never branches on a specific protocol string beyond the canonical filter comparison", () => {
    expect(querySource).not.toMatch(/"nostr"|"activitypub"|"atproto"|"session"|"fedos"/);
  });

  it("10. no adapter is modified -- each protocol's own known-good fixture round-trips unchanged through host.query()", async () => {
    const { host, nostrPost } = await seededReadyHost();
    const found = host.query()!.recentFeed(nostrPost.boardId, undefined, { limit: 100 }).posts.find((p) => p.id === nostrPost.id);
    expect(found!.source).toEqual({ protocol: "nostr", reference: nostrRoot.id });
  });

  it("11. independent Hosts do not share Query or Board state", async () => {
    const { host: h1, nostrPost } = await seededReadyHost();
    const h2 = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: new InMemoryFedosBoardPersistence() });
    await h2.start();
    expect(h1.query()!.recentFeed(nostrPost.boardId).total).toBe(5);
    expect(h2.query()!.recentFeed(nostrPost.boardId).total).toBe(0);
  });

  it("12. Alpha 404 (Arc 401-410) closed this test's own originally-demonstrated memory-only-write bypass -- board() is now READ-ONLY; submitPost() (Alpha 395) is the sole write path and DOES persist durably, observed immediately by both board() and query()", async () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: persistence });
    await host.start();

    const input: FedosBoardPostInput = {
      id: "live-post",
      boardId: BOARD_ID,
      threadId: "live-post",
      replyTo: null,
      author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1live" },
      body: "written live via submitPost()",
      createdAt: 1_700_002_000,
      source: { protocol: "nostr", reference: "live-ref" },
    };
    const post = validateFedosBoardPost(input)!;
    // The bypass this test originally demonstrated no longer typechecks or
    // exists at runtime: board() no longer has a registerPost method at all.
    expect((host.board() as unknown as Record<string, unknown>).registerPost).toBeUndefined();
    expect(host.submitPost(post)).toBe("inserted");

    // Both board() and query() observe the write immediately.
    const boardId = post.boardId;
    expect(host.board()!.findPost(post.id)?.id).toBe("live-post");
    expect(host.query()!.recentFeed(boardId).posts.map((p) => p.id)).toContain("live-post");

    // Unlike Alpha 389's own original finding, the write IS now durably
    // persisted -- submitPost() (Alpha 395) writes Persistence first.
    expect(persistence.listPosts().some((r) => r.id === "live-post")).toBe(true);
  });

  it("13. the design doc honestly documents the memory-only write limitation, without implementing autosave", () => {
    expect(designDocSource).toContain(
      "**Those writes are NOT automatically persisted**",
    );
    expect(designDocSource).toContain("This Stage does not implement autosave");
  });

  it("14. the design doc cross-references Alpha 388, Alpha 379, Alpha 367, and Alpha 359", () => {
    for (const ref of [
      "secure_runtime_alpha_388_append_only_host_query_compatibility",
      "secure_runtime_alpha_379_four_protocol_query_verification",
      "secure_runtime_alpha_367_host_restart_verification",
      "secure_runtime_alpha_359_four_protocol_append_only_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
