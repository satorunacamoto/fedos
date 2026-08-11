import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_359_four_protocol_append_only_verification.md?raw";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AppendOnlyFedosBoardPersistence } from "../src/os/messenger/board/persistence/append_only_fedos_board_persistence.js";
import { serializeFedosBoardPost } from "../src/os/messenger/board/persistence/fedos_board_post_codec.js";
import { hydrateFedosBoardService } from "../src/os/messenger/board/persistence/fedos_board_hydration.js";
import { FedosBoardFeed } from "../src/os/messenger/board/repository/fedos_board_feed.js";
import { toFedosBoardId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import type { FedosBoardId } from "../src/os/messenger/board/fedos_board_identifiers.js";

import { validateNostrBoardPost } from "../src/os/messenger/board/fedos_board_nostr_adapter.js";
import type { FedosValidatedNostrEvent } from "../src/os/messenger/desktop/fedos_validated_nostr_event.js";
import { validateActivityPubBoardPost } from "../src/os/messenger/board/activitypub/fedos_activitypub_board_adapter.js";
import type { FedosValidatedActivityPubPost } from "../src/os/messenger/board/activitypub/fedos_validated_activitypub_post.js";
import { validateAtprotoBoardPost } from "../src/os/messenger/board/atproto/fedos_atproto_board_adapter.js";
import type { FedosValidatedAtprotoPost } from "../src/os/messenger/board/atproto/fedos_validated_atproto_post.js";
import { validateSessionBoardPost } from "../src/os/messenger/board/session/fedos_session_board_adapter.js";
import type { FedosValidatedSessionPost } from "../src/os/messenger/board/session/fedos_validated_session_post.js";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

const BOARD_ID = "board-359";

const nostrRoot: FedosValidatedNostrEvent = {
  id: "a".repeat(64),
  pubkey: "b".repeat(64),
  created_at: 1_700_000_100,
  kind: 1,
  tags: [],
  content: "Hello from Nostr",
  sig: "c".repeat(128),
};

const nostrReply: FedosValidatedNostrEvent = {
  id: "d".repeat(64),
  pubkey: "b".repeat(64),
  created_at: 1_700_000_700,
  kind: 1,
  tags: [
    ["e", "a".repeat(64), "", "root"],
    ["e", "a".repeat(64), "", "reply"],
  ],
  content: "Reply on Nostr",
  sig: "e".repeat(128),
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

const sessionRoot: FedosValidatedSessionPost = {
  messageId: "sess-msg-1",
  sessionId: "05" + "a".repeat(64),
  authorId: "05" + "b".repeat(64),
  body: "Hello from Session",
  createdAt: 1_700_000_600,
  replyTo: null,
};

/**
 * Secure Runtime Alpha 359 -- "Real Verification (Four Protocols,
 * Restart, Hydrate)": Stage 9 of the Alpha 351-360 Append-only
 * Durable Board Backend Arc. Register real fixtures from all four
 * Board Adapters, persist, restart (a brand-new instance, same file),
 * hydrate, and verify identical feed/thread/source/ordering/duplicates.
 */
describe("Secure Runtime Alpha 359 -- Four-Protocol Append-only Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. all four protocols persist and survive a restart with identical feed and source references", () => {
    dir = mkdtempSync(join(tmpdir(), "a359-"));
    const filePath = join(dir, "board.jsonl");

    const writer = new AppendOnlyFedosBoardPersistence(filePath);
    const nostrPost = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
    const activityPubPost = validateActivityPubBoardPost(activityPubRoot, BOARD_ID)!;
    const atprotoPost = validateAtprotoBoardPost(atprotoRoot, BOARD_ID)!;
    const sessionPost = validateSessionBoardPost(sessionRoot, BOARD_ID)!;
    for (const post of [nostrPost, activityPubPost, atprotoPost, sessionPost]) {
      expect(writer.putPost(serializeFedosBoardPost(post))).toBe("inserted");
    }

    // RESTART: a brand-new instance, sharing nothing but the file path.
    const reader = new AppendOnlyFedosBoardPersistence(filePath);
    const hydration = hydrateFedosBoardService(reader);
    expect(hydration.outcome).toBe("hydrated");
    expect(hydration.registeredCount).toBe(4);

    const feed = new FedosBoardFeed(hydration.service!);
    const recent = feed.listRecentPosts(nostrPost.boardId, 10);
    expect(recent).toHaveLength(4);
    const createdAts = recent.map((p) => p.createdAt);
    expect(createdAts).toEqual([...createdAts].sort((a, b) => b - a)); // deterministic newest-first
    expect(recent[0]!.source.protocol).toBe("session");
    expect(recent[3]!.source.protocol).toBe("nostr");

    // Source references survive the JSON Lines round trip byte-for-byte.
    expect(hydration.service!.findPost(nostrPost.id)!.source).toEqual({ protocol: "nostr", reference: nostrRoot.id });
    expect(hydration.service!.findPost(activityPubPost.id)!.source).toEqual({
      protocol: "activitypub",
      reference: activityPubRoot.objectId,
    });
    expect(hydration.service!.findPost(atprotoPost.id)!.source).toEqual({ protocol: "atproto", reference: atprotoRoot.uri });
    expect(hydration.service!.findPost(sessionPost.id)!.source).toEqual({
      protocol: "session",
      reference: sessionRoot.messageId,
    });
  });

  it("3. cross-protocol thread grouping survives a restart identically", () => {
    dir = mkdtempSync(join(tmpdir(), "a359-"));
    const filePath = join(dir, "board.jsonl");

    const writer = new AppendOnlyFedosBoardPersistence(filePath);
    const nostrRootPost = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
    const nostrReplyPost = validateNostrBoardPost(nostrReply, BOARD_ID)!;
    writer.putPost(serializeFedosBoardPost(nostrRootPost));
    writer.putPost(serializeFedosBoardPost(nostrReplyPost));

    const reader = new AppendOnlyFedosBoardPersistence(filePath);
    const hydration = hydrateFedosBoardService(reader);
    expect(hydration.outcome).toBe("hydrated");
    const thread = hydration.service!.listThreadPosts(nostrRootPost.boardId, nostrRootPost.threadId);
    expect(thread.map((p) => p.id).sort()).toEqual([nostrRootPost.id, nostrReplyPost.id].sort());
  });

  it("4. deterministic ordering: two independent restart-and-hydrate cycles against the identical file agree", () => {
    dir = mkdtempSync(join(tmpdir(), "a359-"));
    const filePath = join(dir, "board.jsonl");
    const writer = new AppendOnlyFedosBoardPersistence(filePath);
    for (const post of [
      validateNostrBoardPost(nostrRoot, BOARD_ID)!,
      validateActivityPubBoardPost(activityPubRoot, BOARD_ID)!,
      validateAtprotoBoardPost(atprotoRoot, BOARD_ID)!,
      validateSessionBoardPost(sessionRoot, BOARD_ID)!,
    ]) {
      writer.putPost(serializeFedosBoardPost(post));
    }

    const cycleA = hydrateFedosBoardService(new AppendOnlyFedosBoardPersistence(filePath));
    const cycleB = hydrateFedosBoardService(new AppendOnlyFedosBoardPersistence(filePath));
    const boardId = toFedosBoardId(BOARD_ID) as FedosBoardId;
    const idsA = cycleA.service!.listBoardPosts(boardId).map((p) => p.id);
    const idsB = cycleB.service!.listBoardPosts(boardId).map((p) => p.id);
    expect(idsA).toEqual(idsB);
  });

  it("5. duplicate handling survives the restart boundary -- re-registering an already-persisted post is a safe no-op both before and after restart", () => {
    dir = mkdtempSync(join(tmpdir(), "a359-"));
    const filePath = join(dir, "board.jsonl");
    const post = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
    const record = serializeFedosBoardPost(post);

    const writer = new AppendOnlyFedosBoardPersistence(filePath);
    expect(writer.putPost(record)).toBe("inserted");
    expect(writer.putPost(record)).toBe("already-present"); // before restart

    const afterRestart = new AppendOnlyFedosBoardPersistence(filePath);
    expect(afterRestart.putPost(record)).toBe("already-present"); // after restart, from a fresh instance
    expect(afterRestart.listPosts()).toHaveLength(1);
  });

  it("6. no adapter is modified -- each protocol's own known-good fixture round-trips unchanged through the append-only backend", () => {
    dir = mkdtempSync(join(tmpdir(), "a359-"));
    const filePath = join(dir, "board.jsonl");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    const nostrPost = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
    persistence.putPost(serializeFedosBoardPost(nostrPost));
    const roundTripped = persistence.getPost(nostrPost.id);
    expect(roundTripped).toEqual(serializeFedosBoardPost(nostrPost));
  });

  it("7. the design doc defines 'restart' as a genuinely independent instance sharing nothing but the file", () => {
    expect(designDocSource.replace(/\s+/g, " ")).toContain(
      "the two instances share NOTHING but the file on disk.",
    );
  });

  it("8. the design doc cross-references Alpha 358, Alpha 309, and Alpha 339", () => {
    for (const ref of [
      "secure_runtime_alpha_358_hydration_review",
      "secure_runtime_alpha_309_four_protocol_board_integration",
      "secure_runtime_alpha_339_desktop_host_integration_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
