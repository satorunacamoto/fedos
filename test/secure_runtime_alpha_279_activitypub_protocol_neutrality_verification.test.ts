import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_279_activitypub_protocol_neutrality_verification.md?raw";
import {
  validateActivityPubBoardPost,
  mapValidatedActivityPubPostToBoardPostInput,
} from "../src/os/messenger/board/activitypub/fedos_activitypub_board_adapter.js";
import { FEDOS_BOARD_POST_MAX_BODY_LENGTH } from "../src/os/messenger/board/fedos_board_post_validator.js";
import type { FedosValidatedActivityPubPost } from "../src/os/messenger/board/activitypub/fedos_validated_activitypub_post.js";
import { validateNostrBoardPost } from "../src/os/messenger/board/fedos_board_nostr_adapter.js";
import type { FedosValidatedNostrEvent } from "../src/os/messenger/desktop/fedos_validated_nostr_event.js";

const MASTODON_ROOT: FedosValidatedActivityPubPost = {
  objectId: "https://mastodon.example/users/alice/statuses/123456789012345678",
  actorId: "https://mastodon.example/users/alice",
  content: "Hello from Mastodon",
  published: 1_700_000_000,
  inReplyTo: null,
  conversationRoot: null,
};

const GENERIC_ACTIVITYPUB_ROOT: FedosValidatedActivityPubPost = {
  objectId: "https://social.example/objects/a1b2c3d4",
  actorId: "https://social.example/actors/bob",
  content: "Hello from a generic ActivityPub server",
  published: 1_700_000_100,
  inReplyTo: null,
  conversationRoot: null,
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

/**
 * Secure Runtime Alpha 279 -- "ActivityPub Protocol Neutrality and
 * Fixture Verification": Stage 9 of the ActivityPub Canonical Board
 * Adapter Arc. Real, executed fixture tests covering the full required
 * matrix, protocol-neutrality shape comparison against Nostr, and
 * confirmation the Nostr Adapter's own observable behavior is
 * unchanged.
 */
describe("Secure Runtime Alpha 279 -- ActivityPub Protocol Neutrality and Fixture Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. Mastodon-style Create(Note), normalized upstream", () => {
    const post = validateActivityPubBoardPost(MASTODON_ROOT, "board-fediverse");
    expect(post).not.toBeNull();
    expect(post!.author.publicIdentifier).toBe(MASTODON_ROOT.actorId);
  });

  it("3. generic ActivityPub Note", () => {
    const post = validateActivityPubBoardPost(GENERIC_ACTIVITYPUB_ROOT, "board-fediverse");
    expect(post).not.toBeNull();
    expect(post!.body).toBe(GENERIC_ACTIVITYPUB_ROOT.content);
  });

  it("4. root post", () => {
    const post = validateActivityPubBoardPost(MASTODON_ROOT, "board-1");
    expect(post!.replyTo).toBeNull();
    expect(post!.threadId).toBe(MASTODON_ROOT.objectId);
  });

  it("5. reply with explicit root", () => {
    const reply: FedosValidatedActivityPubPost = {
      ...MASTODON_ROOT,
      objectId: "https://mastodon.example/users/alice/statuses/999",
      inReplyTo: "https://mastodon.example/users/bob/statuses/500",
      conversationRoot: "https://mastodon.example/users/bob/statuses/100",
    };
    const post = validateActivityPubBoardPost(reply, "board-1");
    expect(post!.replyTo).toBe(reply.inReplyTo);
    expect(post!.threadId).toBe(reply.conversationRoot);
  });

  it("6. reply without root, per the adopted failure policy", () => {
    const reply: FedosValidatedActivityPubPost = {
      ...MASTODON_ROOT,
      inReplyTo: "https://mastodon.example/users/bob/statuses/500",
      conversationRoot: null,
    };
    expect(validateActivityPubBoardPost(reply, "board-1")).toBeNull();
  });

  it("7. Unicode text is mapped verbatim into body", () => {
    const unicode: FedosValidatedActivityPubPost = {
      ...MASTODON_ROOT,
      content: "こんにちは世界 🌍 café naïve Zürich Ñoño",
    };
    const post = validateActivityPubBoardPost(unicode, "board-1");
    expect(post!.body).toBe(unicode.content);
  });

  it("8. empty content rejection", () => {
    expect(validateActivityPubBoardPost({ ...MASTODON_ROOT, content: "" }, "board-1")).toBeNull();
  });

  it("9. oversized body rejection", () => {
    const oversized: FedosValidatedActivityPubPost = {
      ...MASTODON_ROOT,
      content: "x".repeat(FEDOS_BOARD_POST_MAX_BODY_LENGTH + 1),
    };
    expect(validateActivityPubBoardPost(oversized, "board-1")).toBeNull();
  });

  it("10. malformed actor URI (empty) rejection", () => {
    expect(mapValidatedActivityPubPostToBoardPostInput({ ...MASTODON_ROOT, actorId: "" }, "board-1")).toBeNull();
  });

  it("11. malformed object URI (empty) rejection", () => {
    expect(mapValidatedActivityPubPostToBoardPostInput({ ...MASTODON_ROOT, objectId: "" }, "board-1")).toBeNull();
  });

  it("12. self-reply rejection", () => {
    const selfReply: FedosValidatedActivityPubPost = {
      ...MASTODON_ROOT,
      inReplyTo: MASTODON_ROOT.objectId,
      conversationRoot: MASTODON_ROOT.objectId,
    };
    expect(validateActivityPubBoardPost(selfReply, "board-1")).toBeNull();
  });

  it("13. deterministic repeated mapping", () => {
    const results = Array.from({ length: 10 }, () => validateActivityPubBoardPost(MASTODON_ROOT, "board-1"));
    for (const result of results) {
      expect(result).toEqual(results[0]);
    }
    const other = validateActivityPubBoardPost(
      { ...MASTODON_ROOT, objectId: "https://mastodon.example/users/alice/statuses/999999" },
      "board-1",
    );
    expect(other!.id).not.toBe(results[0]!.id);
  });

  it("14. resulting FedosBoardPost uses the same shape as a Nostr-produced BoardPost", () => {
    const activityPubPost = validateActivityPubBoardPost(MASTODON_ROOT, "board-1");
    const nostrPost = validateNostrBoardPost(NOSTR_FIXTURE, "board-1");
    expect(Object.keys(activityPubPost!).sort()).toEqual(Object.keys(nostrPost!).sort());
  });

  it("15. no ActivityPub Activity, JSON-LD context, inbox/outbox, HTTP Signature, or Mastodon-specific field on the result", () => {
    const post = validateActivityPubBoardPost(MASTODON_ROOT, "board-1");
    const serialized = JSON.stringify(post);
    for (const forbidden of ["@context", "\"type\"", "inbox", "outbox", "signature", "keyId", "preferredUsername"]) {
      expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("16. no HTML in the result -- the raw-markup fixture was rejected, never silently accepted", () => {
    const withHtml: FedosValidatedActivityPubPost = { ...MASTODON_ROOT, content: "<script>alert(1)</script>" };
    expect(validateActivityPubBoardPost(withHtml, "board-1")).toBeNull();
  });

  it("17. the Nostr Board Adapter's own observable behavior is unchanged -- same fixture, same result as the prior Arc's own determinism check", () => {
    const post = validateNostrBoardPost(NOSTR_FIXTURE, "board-1");
    expect(post).not.toBeNull();
    expect(post!.id).toBe(NOSTR_FIXTURE.id);
    expect(post!.author.publicIdentifier).toBe(NOSTR_FIXTURE.pubkey);
    expect(post!.body).toBe(NOSTR_FIXTURE.content);
    expect(post!.source).toEqual({ protocol: "nostr", reference: NOSTR_FIXTURE.id });
  });

  it("18. the design doc cross-references Alpha 277, Alpha 269, and Alpha 259", () => {
    for (const ref of [
      "secure_runtime_alpha_277_activitypub_board_adapter",
      "secure_runtime_alpha_269_nostr_adapter_protocol_neutrality_review",
      "secure_runtime_alpha_259_protocol_neutrality_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
