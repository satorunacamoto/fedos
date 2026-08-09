import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_309_four_protocol_board_integration.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import repositorySource from "../src/os/messenger/board/repository/fedos_board_repository.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import inMemoryRepositorySource from "../src/os/messenger/board/repository/in_memory_fedos_board_repository.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sourceIndexSource from "../src/os/messenger/board/repository/fedos_board_source_index.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardIndexSource from "../src/os/messenger/board/repository/fedos_board_index.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/os/messenger/board/repository/fedos_board_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import feedSource from "../src/os/messenger/board/repository/fedos_board_feed.ts?raw";

import { validateNostrBoardPost } from "../src/board/fedos_board_nostr_adapter.js";
import type { FedosValidatedNostrEvent } from "../src/desktop/fedos_validated_nostr_event.js";
import { validateActivityPubBoardPost } from "../src/board/activitypub/fedos_activitypub_board_adapter.js";
import type { FedosValidatedActivityPubPost } from "../src/board/activitypub/fedos_validated_activitypub_post.js";
import { validateAtprotoBoardPost } from "../src/board/atproto/fedos_atproto_board_adapter.js";
import type { FedosValidatedAtprotoPost } from "../src/board/atproto/fedos_validated_atproto_post.js";
import { validateSessionBoardPost } from "../src/board/session/fedos_session_board_adapter.js";
import type { FedosValidatedSessionPost } from "../src/board/session/fedos_validated_session_post.js";

import { FedosBoardService } from "../src/board/repository/fedos_board_service.js";
import { FedosBoardFeed } from "../src/board/repository/fedos_board_feed.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

const BOARD_ID = "board-integration";

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

/**
 * Secure Runtime Alpha 309 -- "Four-Protocol Board Integration
 * Verification": Stage 9 of the Canonical Board Repository, Index &
 * Feed Foundation Arc. Builds real fixtures through all four real,
 * unmodified Board Adapters and registers them through one shared
 * FedosBoardService.
 */
describe("Secure Runtime Alpha 309 -- Four-Protocol Board Integration Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. all four protocols become FedosBoardPost", () => {
    expect(validateNostrBoardPost(nostrRoot, BOARD_ID)).not.toBeNull();
    expect(validateActivityPubBoardPost(activityPubRoot, BOARD_ID)).not.toBeNull();
    expect(validateAtprotoBoardPost(atprotoRoot, BOARD_ID)).not.toBeNull();
    expect(validateSessionBoardPost(sessionRoot, BOARD_ID)).not.toBeNull();
  });

  it("3. all four register through the same FedosBoardService", () => {
    const service = new FedosBoardService();
    expect(service.registerPost(validateNostrBoardPost(nostrRoot, BOARD_ID)!)).toBe("inserted");
    expect(service.registerPost(validateActivityPubBoardPost(activityPubRoot, BOARD_ID)!)).toBe("inserted");
    expect(service.registerPost(validateAtprotoBoardPost(atprotoRoot, BOARD_ID)!)).toBe("inserted");
    expect(service.registerPost(validateSessionBoardPost(sessionRoot, BOARD_ID)!)).toBe("inserted");
  });

  it("4. all four appear in one Board feed, and protocol origin does not affect ordering", () => {
    const service = new FedosBoardService();
    const nostrPost = validateNostrBoardPost(nostrRoot, BOARD_ID)!; // createdAt 1_700_000_100
    service.registerPost(nostrPost);
    service.registerPost(validateActivityPubBoardPost(activityPubRoot, BOARD_ID)!); // 1_700_000_200
    service.registerPost(validateAtprotoBoardPost(atprotoRoot, BOARD_ID)!); // 1_700_000_300
    service.registerPost(validateSessionBoardPost(sessionRoot, BOARD_ID)!); // 1_700_000_600
    const feed = new FedosBoardFeed(service);
    const recent = feed.listRecentPosts(nostrPost.boardId, 10);
    expect(recent).toHaveLength(4);
    // Strictly newest-first by createdAt, independent of which protocol produced which post.
    const createdAts = recent.map((p) => p.createdAt);
    expect(createdAts).toEqual([...createdAts].sort((a, b) => b - a));
    expect(recent[0]!.source.protocol).toBe("session"); // the latest createdAt
    expect(recent[3]!.source.protocol).toBe("nostr"); // the earliest createdAt
  });

  it("5. thread replies from supported fixtures (Nostr, AT Protocol) group correctly", () => {
    const service = new FedosBoardService();
    const nostrRootPost = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
    const nostrReplyPost = validateNostrBoardPost(nostrReply, BOARD_ID)!;
    const atprotoRootPost = validateAtprotoBoardPost(atprotoRoot, BOARD_ID)!;
    const atprotoReplyPost = validateAtprotoBoardPost(atprotoReply, BOARD_ID)!;

    expect(service.registerPost(nostrRootPost)).toBe("inserted");
    expect(service.registerPost(nostrReplyPost)).toBe("inserted");
    expect(service.registerPost(atprotoRootPost)).toBe("inserted");
    expect(service.registerPost(atprotoReplyPost)).toBe("inserted");

    const nostrThread = service.listThreadPosts(nostrRootPost.boardId, nostrRootPost.threadId);
    expect(nostrThread.map((p) => p.id).sort()).toEqual([nostrRootPost.id, nostrReplyPost.id].sort());

    const atprotoThread = service.listThreadPosts(atprotoRootPost.boardId, atprotoRootPost.threadId);
    expect(atprotoThread.map((p) => p.id).sort()).toEqual([atprotoRootPost.id, atprotoReplyPost.id].sort());
  });

  it("6. source deduplication works independently per protocol, and is idempotent", () => {
    const service = new FedosBoardService();
    const nostrPost = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
    const activityPubPost = validateActivityPubBoardPost(activityPubRoot, BOARD_ID)!;
    const atprotoPost = validateAtprotoBoardPost(atprotoRoot, BOARD_ID)!;
    const sessionPost = validateSessionBoardPost(sessionRoot, BOARD_ID)!;

    for (const post of [nostrPost, activityPubPost, atprotoPost, sessionPost]) {
      expect(service.registerPost(post)).toBe("inserted");
    }
    // Re-register every fixture a second time -- idempotent, independent per protocol.
    for (const post of [nostrPost, activityPubPost, atprotoPost, sessionPost]) {
      expect(service.registerPost(post)).toBe("already-present");
    }
    expect(service.listBoardPosts(nostrPost.boardId)).toHaveLength(4);
  });

  it("7. source conflict fails closed", () => {
    const service = new FedosBoardService();
    const nostrPost = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
    expect(service.registerPost(nostrPost)).toBe("inserted");

    const conflictingInput: FedosBoardPostInput = {
      id: "different-post-id",
      boardId: BOARD_ID,
      threadId: "different-post-id",
      replyTo: null,
      author: { identityId: null, protocol: "nostr", publicIdentifier: nostrRoot.pubkey },
      body: "A different message reusing the same source",
      createdAt: 1_700_000_150,
      source: { protocol: "nostr", reference: nostrRoot.id }, // SAME source as nostrPost
    };
    const conflicting = validateFedosBoardPost(conflictingInput)!;
    expect(service.registerPost(conflicting)).toBe("source-conflict");
    expect(service.findPost(conflicting.id)).toBeNull();
  });

  it("8. post ID conflict fails closed", () => {
    const service = new FedosBoardService();
    const nostrPost = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
    expect(service.registerPost(nostrPost)).toBe("inserted");

    const conflictingInput: FedosBoardPostInput = {
      id: nostrPost.id, // SAME id
      boardId: BOARD_ID,
      threadId: nostrPost.id,
      replyTo: null,
      author: { identityId: null, protocol: "nostr", publicIdentifier: nostrRoot.pubkey },
      body: "A different message with the same id",
      createdAt: 1_700_000_150,
      source: { protocol: "nostr", reference: "totally-different-source" },
    };
    const conflicting = validateFedosBoardPost(conflictingInput)!;
    expect(service.registerPost(conflicting)).toBe("post-id-conflict");
    expect(service.findPost(nostrPost.id)!.body).toBe(nostrPost.body);
  });

  it("9. missing parent rejected", () => {
    const service = new FedosBoardService();
    const nostrReplyPost = validateNostrBoardPost(nostrReply, BOARD_ID)!; // root ("a"*64) never registered
    expect(service.registerPost(nostrReplyPost)).toBe("missing-parent");
  });

  it("10. cross-board reply rejected", () => {
    const service = new FedosBoardService();
    const atprotoRootPost = validateAtprotoBoardPost(atprotoRoot, BOARD_ID)!;
    expect(service.registerPost(atprotoRootPost)).toBe("inserted");
    const crossBoardReplyPost = validateAtprotoBoardPost(atprotoReply, "a-completely-different-board")!;
    expect(service.registerPost(crossBoardReplyPost)).toBe("cross-board-reply");
  });

  it("11. duplicate registration does not duplicate indexes", () => {
    const service = new FedosBoardService();
    const nostrPost = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
    service.registerPost(nostrPost);
    service.registerPost(nostrPost);
    service.registerPost(nostrPost);
    expect(service.listBoardPosts(nostrPost.boardId)).toHaveLength(1);
    expect(service.listThreadPosts(nostrPost.boardId, nostrPost.threadId)).toHaveLength(1);
  });

  it("12. repository instances remain isolated", () => {
    const serviceA = new FedosBoardService();
    const serviceB = new FedosBoardService();
    const nostrPost = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
    serviceA.registerPost(nostrPost);
    expect(serviceA.listBoardPosts(nostrPost.boardId)).toHaveLength(1);
    expect(serviceB.listBoardPosts(nostrPost.boardId)).toHaveLength(0);
  });

  it("13. feed output is deterministic", () => {
    const service = new FedosBoardService();
    const nostrPost = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
    service.registerPost(nostrPost);
    service.registerPost(validateActivityPubBoardPost(activityPubRoot, BOARD_ID)!);
    service.registerPost(validateAtprotoBoardPost(atprotoRoot, BOARD_ID)!);
    service.registerPost(validateSessionBoardPost(sessionRoot, BOARD_ID)!);
    const feed = new FedosBoardFeed(service);
    const first = feed.listRecentPosts(nostrPost.boardId, 10);
    const second = feed.listRecentPosts(nostrPost.boardId, 10);
    expect(first).toEqual(second);
  });

  it("14. no p2p import, no Ontology Engine call, no Relay call, no network, no Storage anywhere in src/board/repository/", () => {
    for (const source of [
      repositorySource,
      inMemoryRepositorySource,
      sourceIndexSource,
      boardIndexSource,
      serviceSource,
      feedSource,
    ]) {
      expect(codeOnly(source)).not.toMatch(/["'].*\bp2p\b.*["']|Ontology/i);
      expect(codeOnly(source)).not.toMatch(/FedosRelay|WebSocketRelay|fetch\(|WebSocket/);
      expect(source).not.toMatch(/from ["']\.\.\/\.\.\/storage\/|from ["']\.\.\/storage\//);
    }
  });

  it("15. no adapter is modified -- each adapter's own known-good fixture result is reproduced unchanged", () => {
    const nostrPost = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
    expect(nostrPost.source).toEqual({ protocol: "nostr", reference: nostrRoot.id });
    const activityPubPost = validateActivityPubBoardPost(activityPubRoot, BOARD_ID)!;
    expect(activityPubPost.source).toEqual({ protocol: "activitypub", reference: activityPubRoot.objectId });
    const atprotoPost = validateAtprotoBoardPost(atprotoRoot, BOARD_ID)!;
    expect(atprotoPost.source).toEqual({ protocol: "atproto", reference: atprotoRoot.uri });
    const sessionPost = validateSessionBoardPost(sessionRoot, BOARD_ID)!;
    expect(sessionPost.source).toEqual({ protocol: "session", reference: sessionRoot.messageId });
  });

  it("16. the design doc cross-references Alpha 307, Alpha 308, and all four adapter Arcs' own neutrality Stages", () => {
    for (const ref of [
      "secure_runtime_alpha_307_board_application_service",
      "secure_runtime_alpha_308_chronological_board_feed",
      "secure_runtime_alpha_299_session_protocol_neutrality_verification",
      "secure_runtime_alpha_289_atproto_protocol_neutrality_verification",
      "secure_runtime_alpha_279_activitypub_protocol_neutrality_verification",
      "secure_runtime_alpha_269_nostr_adapter_protocol_neutrality_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
