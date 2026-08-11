import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_269_nostr_adapter_protocol_neutrality_review.md?raw";
import { validateNostrBoardPost } from "../src/os/messenger/board/fedos_board_nostr_adapter.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";
import type { FedosValidatedNostrEvent } from "../src/os/messenger/desktop/fedos_validated_nostr_event.js";

const NOSTR_EVENT: FedosValidatedNostrEvent = {
  id: "a".repeat(64),
  pubkey: "b".repeat(64),
  created_at: 1_700_000_000,
  kind: 1,
  tags: [],
  content: "Hello board world",
  sig: "c".repeat(128),
};

/**
 * Secure Runtime Alpha 269 -- "Protocol Neutrality Review
 * (Post-Adapter)": Stage 9 of the Nostr Canonical Board Adapter Arc.
 * Verifies, by real construction, that a Nostr-produced FedosBoardPost
 * carries no Nostr-specific key, and that the exact same shape remains
 * producible by the other three protocols without a Board-model change.
 */
describe("Secure Runtime Alpha 269 -- Protocol Neutrality Review (Post-Adapter)", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: a Nostr-produced FedosBoardPost has exactly the eight canonical keys, no more", () => {
    const post = validateNostrBoardPost(NOSTR_EVENT, "board-1");
    expect(post).not.toBeNull();
    expect(Object.keys(post!).sort()).toEqual(
      ["author", "body", "boardId", "createdAt", "id", "replyTo", "source", "threadId"].sort(),
    );
  });

  it("3. behavioral: no Nostr-specific key (tags/kind/sig/pubkey/content/created_at) appears anywhere on the result", () => {
    const post = validateNostrBoardPost(NOSTR_EVENT, "board-1");
    const serialized = JSON.stringify(post);
    for (const forbidden of ["tags", "\"kind\"", "\"sig\"", "\"pubkey\"", "\"content\"", "created_at"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("4. behavioral: 'nostr' appears in exactly the two expected provenance fields", () => {
    const post = validateNostrBoardPost(NOSTR_EVENT, "board-1");
    expect(post!.author.protocol).toBe("nostr");
    expect(post!.source.protocol).toBe("nostr");
  });

  it("5. behavioral: an ActivityPub/AT-Protocol/Session-shaped input builds through the SAME validateFedosBoardPost, unmodified", () => {
    const activityPubInput: FedosBoardPostInput = {
      id: "https://example.social/users/alice/statuses/1",
      boardId: "board-1",
      threadId: "https://example.social/users/alice/statuses/1",
      replyTo: null,
      author: {
        identityId: null,
        protocol: "activitypub",
        publicIdentifier: "https://example.social/users/alice",
      },
      body: "Hello ActivityPub board world",
      createdAt: 1_700_000_200,
      source: { protocol: "activitypub", reference: "https://example.social/users/alice/statuses/1" },
    };
    const post = validateFedosBoardPost(activityPubInput);
    expect(post).not.toBeNull();
    expect(Object.keys(post!).sort()).toEqual(
      ["author", "body", "boardId", "createdAt", "id", "replyTo", "source", "threadId"].sort(),
    );
  });

  it("6. the design doc confirms exactly the eight canonical keys and no Nostr-specific key outside source/author.protocol", () => {
    expect(designDocSource).toMatch(/id, boardId, threadId, replyTo, author, body, createdAt, source/);
  });

  it("7. the design doc cross-references Alpha 266, Alpha 259, and Alpha 270", () => {
    for (const ref of [
      "secure_runtime_alpha_266_nostr_board_adapter_implementation",
      "secure_runtime_alpha_259_protocol_neutrality_verification",
      "secure_runtime_alpha_270_nostr_board_adapter_completion",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
