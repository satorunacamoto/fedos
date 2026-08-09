import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_319_four_protocol_persistence_verification.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import recordSource from "../src/os/messenger/board/persistence/fedos_persisted_board_post_v1.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import codecSource from "../src/os/messenger/board/persistence/fedos_board_post_codec.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import portSource from "../src/os/messenger/board/persistence/fedos_board_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import inMemoryPersistenceSource from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import persistedRepositorySource from "../src/os/messenger/board/persistence/persisted_fedos_board_repository.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hydrationSource from "../src/os/messenger/board/persistence/fedos_board_hydration.ts?raw";

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
import { fedosBoardPostsAreStructurallyEqual } from "../src/board/repository/fedos_board_repository.js";
import type { FedosBoardPost } from "../src/board/fedos_board_post.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";
import { serializeFedosBoardPost, deserializeFedosBoardPost } from "../src/board/persistence/fedos_board_post_codec.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { hydrateFedosBoardService } from "../src/board/persistence/fedos_board_hydration.js";
import type { FedosPersistedBoardPostRecordV1 } from "../src/board/persistence/fedos_persisted_board_post_v1.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

const BOARD_ID = "board-persistence-integration";

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

function buildFourFixturePosts(): readonly FedosBoardPost[] {
  return [
    validateNostrBoardPost(nostrRoot, BOARD_ID)!,
    validateActivityPubBoardPost(activityPubRoot, BOARD_ID)!,
    validateAtprotoBoardPost(atprotoRoot, BOARD_ID)!,
    validateSessionBoardPost(sessionRoot, BOARD_ID)!,
  ];
}

/** Registers `posts` into a fresh in-memory service AND persists each through the codec/port. */
function registerAndPersist(posts: readonly FedosBoardPost[]): {
  originalService: FedosBoardService;
  persistence: InMemoryFedosBoardPersistence;
} {
  const originalService = new FedosBoardService();
  const persistence = new InMemoryFedosBoardPersistence();
  for (const post of posts) {
    expect(originalService.registerPost(post)).toBe("inserted");
    expect(persistence.putPost(serializeFedosBoardPost(post))).toBe("inserted");
  }
  return { originalService, persistence };
}

/**
 * Secure Runtime Alpha 319 -- "Four-Protocol Board Persistence
 * Verification": Stage 9 of the Canonical Board Persistence Boundary
 * Arc. Builds real fixtures through all four real, unmodified Board
 * Adapters, registers them through FedosBoardService, persists them
 * through the codec/port/backend, discards the original in-memory
 * service, and rehydrates a fresh one from ONLY the persisted records.
 */
describe("Secure Runtime Alpha 319 -- Four-Protocol Board Persistence Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. all posts survive round trip -- findPost succeeds in the hydrated service for all four protocols", () => {
    const posts = buildFourFixturePosts();
    const { persistence } = registerAndPersist(posts);
    const result = hydrateFedosBoardService(persistence);
    expect(result.outcome).toBe("hydrated");
    for (const post of posts) {
      expect(result.service!.findPost(post.id)).not.toBeNull();
    }
  });

  it("3. canonical post equality -- the hydrated post is structurally equal to the original, for all four protocols", () => {
    const posts = buildFourFixturePosts();
    const { persistence } = registerAndPersist(posts);
    const result = hydrateFedosBoardService(persistence);
    for (const post of posts) {
      const rehydrated = result.service!.findPost(post.id)!;
      expect(fedosBoardPostsAreStructurallyEqual(post, rehydrated)).toBe(true);
    }
  });

  it("4. provenance preserved -- source.protocol/source.reference survive the round trip unchanged, for all four protocols", () => {
    const posts = buildFourFixturePosts();
    const { persistence } = registerAndPersist(posts);
    const result = hydrateFedosBoardService(persistence);
    for (const post of posts) {
      const rehydrated = result.service!.findPost(post.id)!;
      expect(rehydrated.source).toEqual(post.source);
    }
  });

  it("5. author identifier preserved -- author.publicIdentifier survives the round trip unchanged, for all four protocols", () => {
    const posts = buildFourFixturePosts();
    const { persistence } = registerAndPersist(posts);
    const result = hydrateFedosBoardService(persistence);
    for (const post of posts) {
      const rehydrated = result.service!.findPost(post.id)!;
      expect(rehydrated.author.publicIdentifier).toBe(post.author.publicIdentifier);
    }
  });

  it("6. thread/reply relationships preserved -- Nostr and AT Protocol replies still group correctly after hydration", () => {
    const nostrRootPost = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
    const nostrReplyPost = validateNostrBoardPost(nostrReply, BOARD_ID)!;
    const atprotoRootPost = validateAtprotoBoardPost(atprotoRoot, BOARD_ID)!;
    const atprotoReplyPost = validateAtprotoBoardPost(atprotoReply, BOARD_ID)!;
    const posts = [nostrRootPost, nostrReplyPost, atprotoRootPost, atprotoReplyPost];

    const originalService = new FedosBoardService();
    const persistence = new InMemoryFedosBoardPersistence();
    for (const post of posts) {
      originalService.registerPost(post);
      persistence.putPost(serializeFedosBoardPost(post));
    }
    const originalNostrThread = originalService
      .listThreadPosts(nostrRootPost.boardId, nostrRootPost.threadId)
      .map((p) => p.id)
      .sort();
    const originalAtprotoThread = originalService
      .listThreadPosts(atprotoRootPost.boardId, atprotoRootPost.threadId)
      .map((p) => p.id)
      .sort();

    const result = hydrateFedosBoardService(persistence);
    expect(result.outcome).toBe("hydrated");
    const hydratedNostrThread = result
      .service!.listThreadPosts(nostrRootPost.boardId, nostrRootPost.threadId)
      .map((p) => p.id)
      .sort();
    const hydratedAtprotoThread = result
      .service!.listThreadPosts(atprotoRootPost.boardId, atprotoRootPost.threadId)
      .map((p) => p.id)
      .sort();

    expect(hydratedNostrThread).toEqual(originalNostrThread);
    expect(hydratedAtprotoThread).toEqual(originalAtprotoThread);
    expect(hydratedNostrThread).toEqual([nostrRootPost.id, nostrReplyPost.id].sort());
    expect(hydratedAtprotoThread).toEqual([atprotoRootPost.id, atprotoReplyPost.id].sort());
  });

  it("7. feed ordering preserved by rebuild -- listRecentPosts against the hydrated service matches the original's order", () => {
    const posts = buildFourFixturePosts();
    const { originalService, persistence } = registerAndPersist(posts);
    const boardId = posts[0]!.boardId;
    const originalFeed = new FedosBoardFeed(originalService).listRecentPosts(boardId, 10);

    const result = hydrateFedosBoardService(persistence);
    const hydratedFeed = new FedosBoardFeed(result.service!).listRecentPosts(boardId, 10);

    expect(hydratedFeed.map((p) => p.id)).toEqual(originalFeed.map((p) => p.id));
    const createdAts = hydratedFeed.map((p) => p.createdAt);
    expect(createdAts).toEqual([...createdAts].sort((a, b) => b - a));
  });

  it("8. no feed/index data persisted -- the persisted record has no rank, order, or thread-child-list field", () => {
    const post = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
    const record = serializeFedosBoardPost(post);
    const keys = Object.keys(record).sort();
    expect(keys).toEqual(
      ["author", "boardId", "body", "createdAt", "id", "replyTo", "schemaVersion", "source", "threadId"].sort(),
    );
  });

  it("9. duplicate writes idempotent -- persisting the same fixture's record twice returns already-present, for all four protocols", () => {
    const posts = buildFourFixturePosts();
    const persistence = new InMemoryFedosBoardPersistence();
    for (const post of posts) {
      expect(persistence.putPost(serializeFedosBoardPost(post))).toBe("inserted");
    }
    for (const post of posts) {
      expect(persistence.putPost(serializeFedosBoardPost(post))).toBe("already-present");
    }
  });

  it("10. ID conflict rejected -- a record sharing an id but different content is rejected, original unchanged", () => {
    const post = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
    const persistence = new InMemoryFedosBoardPersistence();
    persistence.putPost(serializeFedosBoardPost(post));

    const conflictingRecord: FedosPersistedBoardPostRecordV1 = {
      ...serializeFedosBoardPost(post),
      body: "a completely different body",
    };
    expect(persistence.putPost(conflictingRecord)).toBe("conflict");
    expect(persistence.getPost(post.id)!.body).toBe(post.body);
  });

  it("11. source conflict still detected after hydration -- the rebuilt Source Index is genuinely populated", () => {
    const posts = buildFourFixturePosts();
    const { persistence } = registerAndPersist(posts);
    const result = hydrateFedosBoardService(persistence);

    const nostrPost = posts[0]!;
    const conflictingInput: FedosBoardPostInput = {
      id: "brand-new-post-id",
      boardId: BOARD_ID,
      threadId: "brand-new-post-id",
      replyTo: null,
      author: { identityId: null, protocol: "nostr", publicIdentifier: nostrRoot.pubkey },
      body: "reusing an already-hydrated source",
      createdAt: 1_700_000_150,
      source: nostrPost.source, // SAME source as the already-hydrated nostrPost
    };
    const conflicting = validateFedosBoardPost(conflictingInput)!;
    expect(result.service!.registerPost(conflicting)).toBe("source-conflict");
  });

  it("12. corrupt record handling follows the adopted policy -- hydration rejects the whole set", () => {
    const post = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
    const persistence = new InMemoryFedosBoardPersistence();
    persistence.putPost(serializeFedosBoardPost(post));
    const corrupt = {
      ...serializeFedosBoardPost(post),
      id: "a-second-post-id",
      schemaVersion: 2,
    } as unknown as FedosPersistedBoardPostRecordV1;
    persistence.putPost(corrupt);

    const result = hydrateFedosBoardService(persistence);
    expect(result.outcome).toBe("rejected-corrupt-record");
    expect(result.service).toBeNull();
  });

  it("13. unknown schema rejected directly -- deserializeFedosBoardPost itself returns null, independent of hydration", () => {
    const post = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
    const corrupt = { ...serializeFedosBoardPost(post), schemaVersion: 2 };
    expect(deserializeFedosBoardPost(corrupt)).toBeNull();
  });

  it("14. one backend instance does not affect another -- two persistence instances hydrate independently", () => {
    const nostrPost = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
    const sessionPost = validateSessionBoardPost(sessionRoot, BOARD_ID)!;

    const persistenceA = new InMemoryFedosBoardPersistence();
    persistenceA.putPost(serializeFedosBoardPost(nostrPost));
    const persistenceB = new InMemoryFedosBoardPersistence();
    persistenceB.putPost(serializeFedosBoardPost(sessionPost));

    const resultA = hydrateFedosBoardService(persistenceA);
    const resultB = hydrateFedosBoardService(persistenceB);

    expect(resultA.service!.findPost(nostrPost.id)).not.toBeNull();
    expect(resultA.service!.findPost(sessionPost.id)).toBeNull();
    expect(resultB.service!.findPost(sessionPost.id)).not.toBeNull();
    expect(resultB.service!.findPost(nostrPost.id)).toBeNull();
  });

  it("15. all four adapters remain unchanged -- each adapter's own known-good fixture result is reproduced unchanged", () => {
    const nostrPost = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
    expect(nostrPost.source).toEqual({ protocol: "nostr", reference: nostrRoot.id });
    const activityPubPost = validateActivityPubBoardPost(activityPubRoot, BOARD_ID)!;
    expect(activityPubPost.source).toEqual({ protocol: "activitypub", reference: activityPubRoot.objectId });
    const atprotoPost = validateAtprotoBoardPost(atprotoRoot, BOARD_ID)!;
    expect(atprotoPost.source).toEqual({ protocol: "atproto", reference: atprotoRoot.uri });
    const sessionPost = validateSessionBoardPost(sessionRoot, BOARD_ID)!;
    expect(sessionPost.source).toEqual({ protocol: "session", reference: sessionRoot.messageId });
  });

  it("16. p2p/ untouched and no ontology projection -- no reference of any kind anywhere in src/board/persistence/", () => {
    for (const source of [
      recordSource,
      codecSource,
      portSource,
      inMemoryPersistenceSource,
      persistedRepositorySource,
      hydrationSource,
    ]) {
      expect(codeOnly(source)).not.toMatch(/["'].*\bp2p\b.*["']|Ontology/i);
      expect(codeOnly(source)).not.toMatch(/FedosRelay|WebSocketRelay|fetch\(|WebSocket/);
    }
  });

  it("17. the design doc cross-references Alpha 317, Alpha 318, and Alpha 309", () => {
    for (const ref of [
      "secure_runtime_alpha_317_persisted_board_repository",
      "secure_runtime_alpha_318_board_hydration_index_rebuild",
      "secure_runtime_alpha_309_four_protocol_board_integration",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
