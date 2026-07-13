import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_276_activitypub_thread_reply_mapping.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterModuleSource from "../src/board/activitypub/fedos_activitypub_board_adapter.ts?raw";
import {
  mapValidatedActivityPubPostToBoardPostInput,
  validateActivityPubBoardPost,
} from "../src/board/activitypub/fedos_activitypub_board_adapter.js";
import type { FedosValidatedActivityPubPost } from "../src/board/activitypub/fedos_validated_activitypub_post.js";

const BASE_POST: FedosValidatedActivityPubPost = {
  objectId: "https://example.social/users/alice/statuses/1",
  actorId: "https://example.social/users/alice",
  content: "Hello ActivityPub board world",
  published: 1_700_000_000,
  inReplyTo: null,
  conversationRoot: null,
};

/**
 * Secure Runtime Alpha 276 -- "ActivityPub Thread and Reply Mapping":
 * Stage 6 of the ActivityPub Canonical Board Adapter Arc. A
 * design-decision Stage backed by behavioral tests -- root/reply
 * mapping, Option C for the reply-without-root case, self-reply reused
 * from validateFedosBoardPost not duplicated.
 */
describe("Secure Runtime Alpha 276 -- ActivityPub Thread and Reply Mapping", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: a root post (inReplyTo null) sets threadId to its own objectId and replyTo to null", () => {
    const input = mapValidatedActivityPubPostToBoardPostInput(BASE_POST, "board-1");
    expect(input!.replyTo).toBeNull();
    expect(input!.threadId).toBe(BASE_POST.objectId);
  });

  it("3. behavioral: a reply with an explicit root maps threadId=conversationRoot, replyTo=inReplyTo", () => {
    const rootId = "https://example.social/users/bob/statuses/0";
    const parentId = "https://example.social/users/carol/statuses/5";
    const reply: FedosValidatedActivityPubPost = {
      ...BASE_POST,
      objectId: "https://example.social/users/alice/statuses/9",
      inReplyTo: parentId,
      conversationRoot: rootId,
    };
    const input = mapValidatedActivityPubPostToBoardPostInput(reply, "board-1");
    expect(input!.threadId).toBe(rootId);
    expect(input!.replyTo).toBe(parentId);
  });

  it("4. behavioral: a reply without a known root is rejected outright -- Option C", () => {
    const parentId = "https://example.social/users/carol/statuses/5";
    const reply: FedosValidatedActivityPubPost = {
      ...BASE_POST,
      inReplyTo: parentId,
      conversationRoot: null,
    };
    expect(mapValidatedActivityPubPostToBoardPostInput(reply, "board-1")).toBeNull();
  });

  it("5. behavioral: self-reply is rejected by the composed validateFedosBoardPost boundary, not duplicated in the adapter", () => {
    const selfReply: FedosValidatedActivityPubPost = {
      ...BASE_POST,
      inReplyTo: BASE_POST.objectId,
      conversationRoot: BASE_POST.objectId,
    };
    // The mapping step itself succeeds (it has no self-reply check of its own) --
    // validateActivityPubBoardPost's composed validateFedosBoardPost call rejects it.
    expect(mapValidatedActivityPubPostToBoardPostInput(selfReply, "board-1")).not.toBeNull();
    expect(validateActivityPubBoardPost(selfReply, "board-1")).toBeNull();
  });

  it("6. structural: no URL parsing, regex, or Mastodon status-id extraction anywhere in the adapter", () => {
    expect(adapterModuleSource).not.toMatch(/new RegExp|\/statuses\/|\.split\(["']\//);
  });

  it("7. structural: boardId is a required, caller-supplied parameter -- never derived from the post", () => {
    const inputA = mapValidatedActivityPubPostToBoardPostInput(BASE_POST, "board-alpha");
    const inputB = mapValidatedActivityPubPostToBoardPostInput(BASE_POST, "board-beta");
    expect(inputA!.boardId).toBe("board-alpha");
    expect(inputB!.boardId).toBe("board-beta");
  });

  it("8. the design doc adopts Option C for the reply-without-root case, with rationale", () => {
    expect(designDocSource).toMatch(/\*\*Adopted\*\*,\s+exactly this Arc's own\s+preferred\s+candidate\./);
  });

  it("9. the design doc's own invariant table assigns every required invariant to a named layer", () => {
    expect(designDocSource).toMatch(/\| Invariant \| Enforced by \| Why \|/);
    expect(designDocSource).toContain("No self-reply");
    expect(designDocSource).toContain("No cross-board assumption");
    expect(designDocSource).toContain("No cycle construction");
  });

  it("10. the design doc cross-references Alpha 272, Alpha 256, and Alpha 264", () => {
    for (const ref of [
      "secure_runtime_alpha_272_normalized_activitypub_post_model",
      "secure_runtime_alpha_256_thread_reply_semantics",
      "secure_runtime_alpha_264_nostr_thread_mapping",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
