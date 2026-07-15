import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_407_four_protocol_durable_write_verification.md?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";

import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import type { FedosPublicIdentityReader } from "../src/desktop/fedos_public_identity_reader.js";
import { AppendOnlyFedosBoardPersistence } from "../src/board/persistence/append_only_fedos_board_persistence.js";

import { validateNostrBoardPost } from "../src/board/fedos_board_nostr_adapter.js";
import type { FedosValidatedNostrEvent } from "../src/desktop/fedos_validated_nostr_event.js";
import { validateActivityPubBoardPost } from "../src/board/activitypub/fedos_activitypub_board_adapter.js";
import type { FedosValidatedActivityPubPost } from "../src/board/activitypub/fedos_validated_activitypub_post.js";
import { validateAtprotoBoardPost } from "../src/board/atproto/fedos_atproto_board_adapter.js";
import type { FedosValidatedAtprotoPost } from "../src/board/atproto/fedos_validated_atproto_post.js";
import { validateSessionBoardPost } from "../src/board/session/fedos_session_board_adapter.js";
import type { FedosValidatedSessionPost } from "../src/board/session/fedos_validated_session_post.js";

class NullReader implements FedosPublicIdentityReader {
  async readPublicIdentity() {
    return null;
  }
}

const BOARD_ID = "board-407";

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
  objectId: "https://mastodon.example/users/alice/statuses/407",
  actorId: "https://mastodon.example/users/alice",
  content: "Hello from Mastodon",
  published: 1_700_000_200,
  inReplyTo: null,
  conversationRoot: null,
};
const atprotoRootUri = "at://did:plc:abc407/app.bsky.feed.post/root1";
const atprotoRoot: FedosValidatedAtprotoPost = {
  uri: atprotoRootUri,
  cid: "bafyroot407",
  authorDid: "did:plc:abc407",
  text: "Hello from Bluesky",
  createdAt: 1_700_000_300,
  replyRootUri: null,
  replyParentUri: null,
};
const atprotoReply: FedosValidatedAtprotoPost = {
  uri: "at://did:plc:abc407/app.bsky.feed.post/reply1",
  cid: "bafyreply407",
  authorDid: "did:plc:abc407",
  text: "Reply on Bluesky",
  createdAt: 1_700_000_800,
  replyRootUri: atprotoRootUri,
  replyParentUri: atprotoRootUri,
};
const sessionRoot: FedosValidatedSessionPost = {
  messageId: "sess-msg-407",
  sessionId: "05" + "a".repeat(64),
  authorId: "05" + "b".repeat(64),
  body: "Hello from Session",
  createdAt: 1_700_000_600,
  replyTo: null,
};

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

/**
 * Secure Runtime Alpha 407 -- "Four-Protocol Durable Write
 * Verification": Stage 7 of the Alpha 401-410 Desktop Host Canonical
 * Write Boundary Closure Arc. Verification only. Full write -> observe
 * -> restart -> re-observe cycle, real fixtures, real durable backend,
 * through the NEW read-only board() accessor.
 */
describe("Secure Runtime Alpha 407 -- Four-Protocol Durable Write Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: all four protocols submit, observed by board() and query(), survive a real restart, re-observed by both again", async () => {
    dir = mkdtempSync(join(tmpdir(), "a407-"));
    const filePath = join(dir, "board.jsonl");

    const persistence1 = new AppendOnlyFedosBoardPersistence(filePath);
    const host1 = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: persistence1 });
    await host1.start();

    const nostrPost = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
    const activityPubPost = validateActivityPubBoardPost(activityPubRoot, BOARD_ID)!;
    const atprotoPost = validateAtprotoBoardPost(atprotoRoot, BOARD_ID)!;
    const atprotoReplyPost = validateAtprotoBoardPost(atprotoReply, BOARD_ID)!;
    const sessionPost = validateSessionBoardPost(sessionRoot, BOARD_ID)!;

    for (const post of [nostrPost, activityPubPost, atprotoPost, atprotoReplyPost, sessionPost]) {
      expect(host1.submitPost(post)).toBe("inserted");
    }

    // Step 3/4: Reader and Query BOTH observe, pre-restart.
    expect(host1.board()!.findPost(nostrPost.id)?.id).toBe(nostrPost.id);
    expect(host1.query()!.recentFeed(nostrPost.boardId, undefined, { limit: 100 }).total).toBe(5);

    // Step 5: stop.
    await host1.stop();

    // Step 6: fresh, independent Host on the SAME file.
    const persistence2 = new AppendOnlyFedosBoardPersistence(filePath);
    const host2 = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: persistence2 });
    await host2.start();

    // Step 7/8: Reader and Query BOTH observe the hydrated posts.
    const hydratedReader = host2.board()!;
    for (const post of [nostrPost, activityPubPost, atprotoPost, atprotoReplyPost, sessionPost]) {
      const found = hydratedReader.findPost(post.id);
      expect(found).not.toBeNull();
      expect(found!.body).toBe(post.body);
      expect(found!.author).toEqual(post.author);
      expect(found!.source).toEqual(post.source);
    }
    expect(host2.query()!.recentFeed(nostrPost.boardId, undefined, { limit: 100 }).total).toBe(5);

    // Thread grouping preserved across the restart.
    const thread = host2.query()!.thread(atprotoPost.boardId, atprotoPost.threadId);
    expect(thread.posts.map((p) => p.id)).toEqual([atprotoPost.id, atprotoReplyPost.id]);
    expect(hydratedReader.listThreadPosts(atprotoPost.boardId, atprotoPost.threadId).map((p) => p.id).sort()).toEqual(
      [atprotoPost.id, atprotoReplyPost.id].sort(),
    );

    // Independent Hosts do not share memory -- distinct Reader/Query instances.
    expect(host1.board()).not.toBe(host2.board());
    expect(host1.query()).not.toBe(host2.query());
  });

  it("3. behavioral: duplicates do not append a second log line", async () => {
    dir = mkdtempSync(join(tmpdir(), "a407-"));
    const filePath = join(dir, "board.jsonl");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: persistence });
    await host.start();

    const post = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
    expect(host.submitPost(post)).toBe("inserted");
    expect(host.submitPost(validateNostrBoardPost(nostrRoot, BOARD_ID)!)).toBe("already-present");
    expect(persistence.listPosts().filter((r) => r.id === post.id)).toHaveLength(1);
  });

  it("4. behavioral: conflicts do not append", async () => {
    dir = mkdtempSync(join(tmpdir(), "a407-"));
    const filePath = join(dir, "board.jsonl");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: persistence });
    await host.start();

    const post = validateActivityPubBoardPost(activityPubRoot, BOARD_ID)!;
    expect(host.submitPost(post)).toBe("inserted");
    const conflicting = validateActivityPubBoardPost({ ...activityPubRoot, content: "a different message entirely" }, BOARD_ID)!;
    expect(host.submitPost(conflicting)).toBe("post-id-conflict");
    expect(persistence.listPosts().filter((r) => r.id === post.id)).toHaveLength(1);
  });

  it("5. the design doc confirms no adapter is modified", () => {
    expect(designDocSource).toContain("this Stage's own test suite imports");
    expect(designDocSource).toContain("UNMODIFIED");
  });

  it("6. the design doc cross-references Alpha 405, Alpha 399, Alpha 397, and Alpha 389", () => {
    for (const ref of [
      "secure_runtime_alpha_405_submit_post_authority_verification",
      "secure_runtime_alpha_399_write_restart_integration_verification",
      "secure_runtime_alpha_397_write_protocol_neutrality_verification",
      "secure_runtime_alpha_389_four_protocol_host_query_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
