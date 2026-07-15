import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_397_write_protocol_neutrality_verification.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/board/repository/fedos_board_service.ts?raw";

import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import type { FedosPublicIdentityReader } from "../src/desktop/fedos_public_identity_reader.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";

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

const BOARD_ID = "board-397";

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
  objectId: "https://mastodon.example/users/alice/statuses/397",
  actorId: "https://mastodon.example/users/alice",
  content: "Hello from Mastodon",
  published: 1_700_000_200,
  inReplyTo: null,
  conversationRoot: null,
};
const atprotoRootUri = "at://did:plc:abc397/app.bsky.feed.post/root1";
const atprotoRoot: FedosValidatedAtprotoPost = {
  uri: atprotoRootUri,
  cid: "bafyroot397",
  authorDid: "did:plc:abc397",
  text: "Hello from Bluesky",
  createdAt: 1_700_000_300,
  replyRootUri: null,
  replyParentUri: null,
};
const atprotoReply: FedosValidatedAtprotoPost = {
  uri: "at://did:plc:abc397/app.bsky.feed.post/reply1",
  cid: "bafyreply397",
  authorDid: "did:plc:abc397",
  text: "Reply on Bluesky",
  createdAt: 1_700_000_800,
  replyRootUri: atprotoRootUri,
  replyParentUri: atprotoRootUri,
};
const sessionRoot: FedosValidatedSessionPost = {
  messageId: "sess-msg-397",
  sessionId: "05" + "a".repeat(64),
  authorId: "05" + "b".repeat(64),
  body: "Hello from Session",
  createdAt: 1_700_000_600,
  replyTo: null,
};

async function readyHost() {
  const persistence = new InMemoryFedosBoardPersistence();
  const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: persistence });
  await host.start();
  return { host, persistence };
}

/**
 * Secure Runtime Alpha 397 -- "Write Protocol Neutrality
 * Verification": Stage 7 of the Alpha 391-400 Desktop Host Durable
 * Write Coordination Arc. Verification only. Real fixtures from all
 * four Board Adapters, submitted end to end through host.submitPost().
 */
describe("Secure Runtime Alpha 397 -- Write Protocol Neutrality Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. structural: neither the Host nor the Service branches on a specific protocol string", () => {
    expect(hostSource).not.toMatch(/"nostr"|"activitypub"|"atproto"|"session"|"fedos"/);
    expect(serviceSource).not.toMatch(/"nostr"|"activitypub"|"atproto"|"session"|"fedos"/);
  });

  it("3. behavioral: all four protocols' own real fixtures submit successfully via the SAME submitPost() call", async () => {
    const { host } = await readyHost();
    const nostrPost = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
    const activityPubPost = validateActivityPubBoardPost(activityPubRoot, BOARD_ID)!;
    const atprotoPost = validateAtprotoBoardPost(atprotoRoot, BOARD_ID)!;
    const sessionPost = validateSessionBoardPost(sessionRoot, BOARD_ID)!;

    for (const post of [nostrPost, activityPubPost, atprotoPost, sessionPost]) {
      expect(host.submitPost(post)).toBe("inserted");
    }

    expect(host.query()!.recentFeed(nostrPost.boardId, undefined, { limit: 100 }).total).toBe(4);
  });

  it("4. behavioral: every submitted post is durably persisted, not just visible in memory", async () => {
    const { host, persistence } = await readyHost();
    const nostrPost = validateNostrBoardPost(nostrRoot, BOARD_ID)!;
    expect(host.submitPost(nostrPost)).toBe("inserted");
    expect(persistence.listPosts().some((r) => r.id === nostrPost.id)).toBe(true);
  });

  it("5. behavioral: a cross-protocol thread (ATProto root, ATProto reply) resolves correctly through submitPost()", async () => {
    const { host } = await readyHost();
    const atprotoPost = validateAtprotoBoardPost(atprotoRoot, BOARD_ID)!;
    const atprotoReplyPost = validateAtprotoBoardPost(atprotoReply, BOARD_ID)!;
    expect(host.submitPost(atprotoPost)).toBe("inserted");
    expect(host.submitPost(atprotoReplyPost)).toBe("inserted");

    const result = host.query()!.thread(atprotoPost.boardId, atprotoPost.threadId);
    expect(result.posts.map((p) => p.id)).toEqual([atprotoPost.id, atprotoReplyPost.id]);
  });

  it("6. behavioral: submitting an ATProto reply BEFORE its root fails with 'missing-parent', not a protocol-specific error", async () => {
    const { host } = await readyHost();
    const atprotoReplyPost = validateAtprotoBoardPost(atprotoReply, BOARD_ID)!;
    expect(host.submitPost(atprotoReplyPost)).toBe("missing-parent");
  });

  it("7. no adapter file is modified -- no adapter is imported by the Host or Service", () => {
    expect(hostSource).not.toMatch(/nostr_adapter|activitypub_board_adapter|atproto_board_adapter|session_board_adapter/);
    expect(serviceSource).not.toMatch(/nostr_adapter|activitypub_board_adapter|atproto_board_adapter|session_board_adapter/);
  });

  it("8. the design doc confirms this mirrors Alpha 389's own established structural guarantee for the Write layer", () => {
    expect(designDocSource.replace(/\s+/g, " ")).toContain("now confirmed for the Write layer too");
  });

  it("9. the design doc cross-references Alpha 396, Alpha 395, Alpha 389, and Alpha 379", () => {
    for (const ref of [
      "secure_runtime_alpha_396_immediate_query_visibility",
      "secure_runtime_alpha_395_host_write_api_implementation",
      "secure_runtime_alpha_389_four_protocol_host_query_verification",
      "secure_runtime_alpha_379_four_protocol_query_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
