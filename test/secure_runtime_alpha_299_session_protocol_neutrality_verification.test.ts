import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_299_session_protocol_neutrality_verification.md?raw";
import {
  validateSessionBoardPost,
  mapValidatedSessionPostToBoardPostInput,
} from "../src/os/messenger/board/session/fedos_session_board_adapter.js";
import { FEDOS_BOARD_POST_MAX_BODY_LENGTH } from "../src/os/messenger/board/fedos_board_post_validator.js";
import type { FedosValidatedSessionPost } from "../src/os/messenger/board/session/fedos_validated_session_post.js";
import { validateNostrBoardPost } from "../src/os/messenger/board/fedos_board_nostr_adapter.js";
import type { FedosValidatedNostrEvent } from "../src/os/messenger/desktop/fedos_validated_nostr_event.js";
import { validateActivityPubBoardPost } from "../src/os/messenger/board/activitypub/fedos_activitypub_board_adapter.js";
import type { FedosValidatedActivityPubPost } from "../src/os/messenger/board/activitypub/fedos_validated_activitypub_post.js";
import { validateAtprotoBoardPost } from "../src/os/messenger/board/atproto/fedos_atproto_board_adapter.js";
import type { FedosValidatedAtprotoPost } from "../src/os/messenger/board/atproto/fedos_validated_atproto_post.js";

const SESSION_ROOT: FedosValidatedSessionPost = {
  messageId: "sess-msg-root",
  sessionId: "05" + "a".repeat(64),
  authorId: "05" + "b".repeat(64),
  body: "Hello Session board world",
  createdAt: 1_700_000_000,
  replyTo: null,
};

const NOSTR_FIXTURE: FedosValidatedNostrEvent = {
  id: "a".repeat(64),
  pubkey: "b".repeat(64),
  created_at: 1_700_000_000,
  kind: 1,
  tags: [],
  content: "Hello board world",
  sig: "c".repeat(128),
};

const ACTIVITYPUB_FIXTURE: FedosValidatedActivityPubPost = {
  objectId: "https://mastodon.example/users/alice/statuses/123456789012345678",
  actorId: "https://mastodon.example/users/alice",
  content: "Hello from Mastodon",
  published: 1_700_000_000,
  inReplyTo: null,
  conversationRoot: null,
};

const ATPROTO_FIXTURE: FedosValidatedAtprotoPost = {
  uri: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3jwdwj2ctlk26",
  cid: "bafyreieqzq3fjqkq2m2djqmrqzq",
  authorDid: "did:plc:z72i7hdynmk6r22z27h6tvur",
  text: "Hello from Bluesky",
  createdAt: 1_700_000_000,
  replyRootUri: null,
  replyParentUri: null,
};

/**
 * Secure Runtime Alpha 299 -- "Session Protocol Neutrality and Fixture
 * Verification": Stage 9 of the Session Canonical Board Gateway Adapter
 * Arc. Real, executed fixture tests covering the full required 8-case
 * matrix, protocol-neutrality shape comparison against Nostr,
 * ActivityPub, and AT Protocol, and confirmation all three existing
 * adapters' own observable behavior is unchanged.
 */
describe("Secure Runtime Alpha 299 -- Session Protocol Neutrality and Fixture Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. Root", () => {
    const post = validateSessionBoardPost(SESSION_ROOT, "board-1");
    expect(post!.replyTo).toBeNull();
    expect(post!.threadId).toBe(SESSION_ROOT.messageId);
  });

  it("3. Reply", () => {
    const reply: FedosValidatedSessionPost = {
      ...SESSION_ROOT,
      messageId: "sess-msg-reply",
      replyTo: SESSION_ROOT.messageId,
    };
    const post = validateSessionBoardPost(reply, "board-1");
    expect(post!.replyTo).toBe(SESSION_ROOT.messageId);
    expect(post!.threadId).toBe(SESSION_ROOT.messageId);
  });

  it("4. Unicode", () => {
    const unicode: FedosValidatedSessionPost = {
      ...SESSION_ROOT,
      body: "こんにちは世界 🌍 café naïve Zürich Ñoño 👋",
    };
    const post = validateSessionBoardPost(unicode, "board-1");
    expect(post!.body).toBe(unicode.body);
  });

  it("5. 長文 (long text, at the ceiling and one over)", () => {
    const atMax: FedosValidatedSessionPost = { ...SESSION_ROOT, body: "x".repeat(FEDOS_BOARD_POST_MAX_BODY_LENGTH) };
    const overMax: FedosValidatedSessionPost = {
      ...SESSION_ROOT,
      body: "x".repeat(FEDOS_BOARD_POST_MAX_BODY_LENGTH + 1),
    };
    expect(validateSessionBoardPost(atMax, "board-1")).not.toBeNull();
    expect(validateSessionBoardPost(overMax, "board-1")).toBeNull();
  });

  it("6. 空本文 (empty body) rejection", () => {
    expect(validateSessionBoardPost({ ...SESSION_ROOT, body: "" }, "board-1")).toBeNull();
  });

  it("7. 不正Author (malformed author -- empty) rejection", () => {
    expect(mapValidatedSessionPostToBoardPostInput({ ...SESSION_ROOT, authorId: "" }, "board-1")).toBeNull();
  });

  it("8. 不正MessageId (malformed message id -- empty) rejection", () => {
    expect(mapValidatedSessionPostToBoardPostInput({ ...SESSION_ROOT, messageId: "" }, "board-1")).toBeNull();
  });

  it("9. Determinism", () => {
    const results = Array.from({ length: 10 }, () => validateSessionBoardPost(SESSION_ROOT, "board-1"));
    for (const result of results) {
      expect(result).toEqual(results[0]);
    }
    const other = validateSessionBoardPost({ ...SESSION_ROOT, messageId: "sess-msg-different" }, "board-1");
    expect(other!.id).not.toBe(results[0]!.id);
  });

  it("10. resulting FedosBoardPost uses the exact same shape as Nostr-, ActivityPub-, and AT-Protocol-produced BoardPost", () => {
    const sessionPost = validateSessionBoardPost(SESSION_ROOT, "board-1");
    const nostrPost = validateNostrBoardPost(NOSTR_FIXTURE, "board-1");
    const activityPubPost = validateActivityPubBoardPost(ACTIVITYPUB_FIXTURE, "board-1");
    const atprotoPost = validateAtprotoBoardPost(ATPROTO_FIXTURE, "board-1");
    const shape = Object.keys(sessionPost!).sort();
    expect(shape).toEqual(Object.keys(nostrPost!).sort());
    expect(shape).toEqual(Object.keys(activityPubPost!).sort());
    expect(shape).toEqual(Object.keys(atprotoPost!).sort());
  });

  it("11. no Session/Oxen protocol object, onion envelope, sessionId, or credential appears on the result", () => {
    const post = validateSessionBoardPost(SESSION_ROOT, "board-1");
    const serialized = JSON.stringify(post);
    expect(serialized).not.toContain(SESSION_ROOT.sessionId);
    for (const forbidden of ["oxen", "onion", "accessToken", "privateKey"]) {
      expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("12. the Nostr Board Adapter's own observable behavior is unchanged", () => {
    const post = validateNostrBoardPost(NOSTR_FIXTURE, "board-1");
    expect(post!.source).toEqual({ protocol: "nostr", reference: NOSTR_FIXTURE.id });
  });

  it("13. the ActivityPub Board Adapter's own observable behavior is unchanged", () => {
    const post = validateActivityPubBoardPost(ACTIVITYPUB_FIXTURE, "board-1");
    expect(post!.source).toEqual({ protocol: "activitypub", reference: ACTIVITYPUB_FIXTURE.objectId });
  });

  it("14. the AT Protocol Board Adapter's own observable behavior is unchanged", () => {
    const post = validateAtprotoBoardPost(ATPROTO_FIXTURE, "board-1");
    expect(post!.source).toEqual({ protocol: "atproto", reference: ATPROTO_FIXTURE.uri });
  });

  it("15. the design doc cross-references Alpha 297, Alpha 289, Alpha 279, Alpha 269, and Alpha 259", () => {
    for (const ref of [
      "secure_runtime_alpha_297_session_board_adapter",
      "secure_runtime_alpha_289_atproto_protocol_neutrality_verification",
      "secure_runtime_alpha_279_activitypub_protocol_neutrality_verification",
      "secure_runtime_alpha_269_nostr_adapter_protocol_neutrality_review",
      "secure_runtime_alpha_259_protocol_neutrality_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
