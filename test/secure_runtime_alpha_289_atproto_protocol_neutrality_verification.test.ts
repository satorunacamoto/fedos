import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_289_atproto_protocol_neutrality_verification.md?raw";
import {
  validateAtprotoBoardPost,
  mapValidatedAtprotoPostToBoardPostInput,
} from "../src/os/messenger/board/atproto/fedos_atproto_board_adapter.js";
import { FEDOS_BOARD_POST_MAX_BODY_LENGTH } from "../src/os/messenger/board/fedos_board_post_validator.js";
import type { FedosValidatedAtprotoPost } from "../src/os/messenger/board/atproto/fedos_validated_atproto_post.js";
import { validateNostrBoardPost } from "../src/os/messenger/board/fedos_board_nostr_adapter.js";
import type { FedosValidatedNostrEvent } from "../src/os/messenger/desktop/fedos_validated_nostr_event.js";
import { validateActivityPubBoardPost } from "../src/os/messenger/board/activitypub/fedos_activitypub_board_adapter.js";
import type { FedosValidatedActivityPubPost } from "../src/os/messenger/board/activitypub/fedos_validated_activitypub_post.js";

const BLUESKY_ROOT: FedosValidatedAtprotoPost = {
  uri: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3jwdwj2ctlk26",
  cid: "bafyreieqzq3fjqkq2m2djqmrqzqmrqzqmrqzqmrqzqmrqzqmrqzqmrqzq",
  authorDid: "did:plc:z72i7hdynmk6r22z27h6tvur",
  text: "Hello from Bluesky",
  createdAt: 1_700_000_000,
  replyRootUri: null,
  replyParentUri: null,
};

const GENERIC_ATPROTO_ROOT: FedosValidatedAtprotoPost = {
  uri: "at://did:web:example.com/app.bsky.feed.post/generic1",
  cid: "bafygenericcid1",
  authorDid: "did:web:example.com",
  text: "Hello from a generic AT Protocol app",
  createdAt: 1_700_000_100,
  replyRootUri: null,
  replyParentUri: null,
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

/**
 * Secure Runtime Alpha 289 -- "AT Protocol Protocol Neutrality and
 * Fixture Verification": Stage 9 of the AT Protocol Canonical Board
 * Adapter Arc. Real, executed fixture tests covering the full required
 * 17-case matrix, protocol-neutrality shape comparison against BOTH
 * Nostr and ActivityPub, and confirmation both existing adapters' own
 * observable behavior is unchanged.
 */
describe("Secure Runtime Alpha 289 -- AT Protocol Protocol Neutrality and Fixture Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. Bluesky-style root app.bsky.feed.post, normalized upstream", () => {
    const post = validateAtprotoBoardPost(BLUESKY_ROOT, "board-fediverse");
    expect(post).not.toBeNull();
    expect(post!.author.publicIdentifier).toBe(BLUESKY_ROOT.authorDid);
  });

  it("3. Bluesky-style nested reply", () => {
    const rootUri = "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/root1";
    const parentUri = "at://did:plc:other/app.bsky.feed.post/parent1";
    const reply: FedosValidatedAtprotoPost = {
      ...BLUESKY_ROOT,
      uri: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/reply1",
      replyRootUri: rootUri,
      replyParentUri: parentUri,
    };
    const post = validateAtprotoBoardPost(reply, "board-1");
    expect(post!.threadId).toBe(rootUri);
    expect(post!.replyTo).toBe(parentUri);
  });

  it("4. generic AT Protocol normalized post", () => {
    const post = validateAtprotoBoardPost(GENERIC_ATPROTO_ROOT, "board-1");
    expect(post).not.toBeNull();
    expect(post!.body).toBe(GENERIC_ATPROTO_ROOT.text);
  });

  it("5. root post", () => {
    const post = validateAtprotoBoardPost(BLUESKY_ROOT, "board-1");
    expect(post!.replyTo).toBeNull();
    expect(post!.threadId).toBe(BLUESKY_ROOT.uri);
  });

  it("6. reply with root + parent", () => {
    const reply: FedosValidatedAtprotoPost = {
      ...BLUESKY_ROOT,
      uri: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/reply2",
      replyRootUri: "at://did:plc:other/app.bsky.feed.post/root2",
      replyParentUri: "at://did:plc:other/app.bsky.feed.post/parent2",
    };
    const post = validateAtprotoBoardPost(reply, "board-1");
    expect(post).not.toBeNull();
  });

  it("7. missing root", () => {
    const missingRoot: FedosValidatedAtprotoPost = {
      ...BLUESKY_ROOT,
      replyRootUri: null,
      replyParentUri: "at://did:plc:other/app.bsky.feed.post/parent1",
    };
    expect(validateAtprotoBoardPost(missingRoot, "board-1")).toBeNull();
  });

  it("8. missing parent", () => {
    const missingParent: FedosValidatedAtprotoPost = {
      ...BLUESKY_ROOT,
      replyRootUri: "at://did:plc:other/app.bsky.feed.post/root1",
      replyParentUri: null,
    };
    expect(validateAtprotoBoardPost(missingParent, "board-1")).toBeNull();
  });

  it("9. self-parent", () => {
    const selfParent: FedosValidatedAtprotoPost = {
      ...BLUESKY_ROOT,
      replyRootUri: BLUESKY_ROOT.uri,
      replyParentUri: BLUESKY_ROOT.uri,
    };
    expect(validateAtprotoBoardPost(selfParent, "board-1")).toBeNull();
  });

  it("10. Unicode text is mapped verbatim into body", () => {
    const unicode: FedosValidatedAtprotoPost = {
      ...BLUESKY_ROOT,
      text: "こんにちは世界 🌍 café naïve Zürich Ñoño",
    };
    const post = validateAtprotoBoardPost(unicode, "board-1");
    expect(post!.body).toBe(unicode.text);
  });

  it("11. empty text rejection", () => {
    expect(validateAtprotoBoardPost({ ...BLUESKY_ROOT, text: "" }, "board-1")).toBeNull();
  });

  it("12. oversized body rejection", () => {
    const oversized: FedosValidatedAtprotoPost = {
      ...BLUESKY_ROOT,
      text: "x".repeat(FEDOS_BOARD_POST_MAX_BODY_LENGTH + 1),
    };
    expect(validateAtprotoBoardPost(oversized, "board-1")).toBeNull();
  });

  it("13. malformed DID (empty) rejection", () => {
    expect(mapValidatedAtprotoPostToBoardPostInput({ ...BLUESKY_ROOT, authorDid: "" }, "board-1")).toBeNull();
  });

  it("14. malformed AT URI (empty) rejection", () => {
    expect(mapValidatedAtprotoPostToBoardPostInput({ ...BLUESKY_ROOT, uri: "" }, "board-1")).toBeNull();
  });

  it("15. malformed CID (empty) rejection", () => {
    expect(mapValidatedAtprotoPostToBoardPostInput({ ...BLUESKY_ROOT, cid: "" }, "board-1")).toBeNull();
  });

  it("16. deterministic repeated mapping", () => {
    const results = Array.from({ length: 10 }, () => validateAtprotoBoardPost(BLUESKY_ROOT, "board-1"));
    for (const result of results) {
      expect(result).toEqual(results[0]);
    }
  });

  it("17. same URI with different CID -> same identity (documented behavior)", () => {
    const differentCid: FedosValidatedAtprotoPost = { ...BLUESKY_ROOT, cid: "bafydifferentversion" };
    const postA = validateAtprotoBoardPost(BLUESKY_ROOT, "board-1");
    const postB = validateAtprotoBoardPost(differentCid, "board-1");
    expect(postA!.id).toBe(postB!.id);
    expect(postA!.source).toEqual(postB!.source);
  });

  it("18. different URI -> separation confirmed", () => {
    const postA = validateAtprotoBoardPost(BLUESKY_ROOT, "board-1");
    const postB = validateAtprotoBoardPost(GENERIC_ATPROTO_ROOT, "board-1");
    expect(postA!.id).not.toBe(postB!.id);
    expect(postA!.threadId).not.toBe(postB!.threadId);
  });

  it("19. resulting FedosBoardPost uses the exact same shape as Nostr- and ActivityPub-produced BoardPost", () => {
    const atprotoPost = validateAtprotoBoardPost(BLUESKY_ROOT, "board-1");
    const nostrPost = validateNostrBoardPost(NOSTR_FIXTURE, "board-1");
    const activityPubPost = validateActivityPubBoardPost(ACTIVITYPUB_FIXTURE, "board-1");
    expect(Object.keys(atprotoPost!).sort()).toEqual(Object.keys(nostrPost!).sort());
    expect(Object.keys(atprotoPost!).sort()).toEqual(Object.keys(activityPubPost!).sort());
  });

  it("20. no AT Protocol record object, Lexicon object, facets, embed, DID document, PDS/App View/Relay endpoint, token, or cid on the result", () => {
    const post = validateAtprotoBoardPost(BLUESKY_ROOT, "board-1");
    const serialized = JSON.stringify(post).toLowerCase();
    for (const forbidden of [
      "$type",
      "facet",
      "embed",
      "diddoc",
      "pds",
      "service",
      "accessjwt",
      "refreshjwt",
      BLUESKY_ROOT.cid.toLowerCase(),
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("21. the Nostr Board Adapter's own observable behavior is unchanged", () => {
    const post = validateNostrBoardPost(NOSTR_FIXTURE, "board-1");
    expect(post).not.toBeNull();
    expect(post!.id).toBe(NOSTR_FIXTURE.id);
    expect(post!.source).toEqual({ protocol: "nostr", reference: NOSTR_FIXTURE.id });
  });

  it("22. the ActivityPub Board Adapter's own observable behavior is unchanged", () => {
    const post = validateActivityPubBoardPost(ACTIVITYPUB_FIXTURE, "board-1");
    expect(post).not.toBeNull();
    expect(post!.id).toBe(ACTIVITYPUB_FIXTURE.objectId);
    expect(post!.source).toEqual({ protocol: "activitypub", reference: ACTIVITYPUB_FIXTURE.objectId });
  });

  it("23. the design doc cross-references Alpha 287, Alpha 279, Alpha 269, and Alpha 259", () => {
    for (const ref of [
      "secure_runtime_alpha_287_atproto_board_adapter",
      "secure_runtime_alpha_279_activitypub_protocol_neutrality_verification",
      "secure_runtime_alpha_269_nostr_adapter_protocol_neutrality_review",
      "secure_runtime_alpha_259_protocol_neutrality_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
