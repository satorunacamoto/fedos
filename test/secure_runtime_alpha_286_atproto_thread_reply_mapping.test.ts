import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_286_atproto_thread_reply_mapping.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterModuleSource from "../src/os/messenger/board/atproto/fedos_atproto_board_adapter.ts?raw";
import {
  mapValidatedAtprotoPostToBoardPostInput,
  validateAtprotoBoardPost,
} from "../src/board/atproto/fedos_atproto_board_adapter.js";
import type { FedosValidatedAtprotoPost } from "../src/board/atproto/fedos_validated_atproto_post.js";

const BASE_POST: FedosValidatedAtprotoPost = {
  uri: "at://did:plc:abc123/app.bsky.feed.post/xyz789",
  cid: "bafyabc123",
  authorDid: "did:plc:abc123",
  text: "Hello AT Protocol board world",
  createdAt: 1_700_000_000,
  replyRootUri: null,
  replyParentUri: null,
};

/**
 * Secure Runtime Alpha 286 -- "AT Protocol Thread and Reply Mapping":
 * Stage 6 of the AT Protocol Canonical Board Adapter Arc. A
 * design-decision Stage backed by behavioral tests -- direct root+parent
 * mapping (AT Protocol supplies both explicitly), invalid combinations
 * rejected fail-closed, self-parent reused from validateFedosBoardPost.
 */
describe("Secure Runtime Alpha 286 -- AT Protocol Thread and Reply Mapping", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: a root post (both reply fields null) sets threadId to its own uri and replyTo to null", () => {
    const input = mapValidatedAtprotoPostToBoardPostInput(BASE_POST, "board-1");
    expect(input!.replyTo).toBeNull();
    expect(input!.threadId).toBe(BASE_POST.uri);
  });

  it("3. behavioral: a reply with root+parent maps threadId=replyRootUri, replyTo=replyParentUri", () => {
    const rootUri = "at://did:plc:bob/app.bsky.feed.post/root1";
    const parentUri = "at://did:plc:carol/app.bsky.feed.post/parent1";
    const reply: FedosValidatedAtprotoPost = {
      ...BASE_POST,
      uri: "at://did:plc:abc123/app.bsky.feed.post/reply1",
      replyRootUri: rootUri,
      replyParentUri: parentUri,
    };
    const input = mapValidatedAtprotoPostToBoardPostInput(reply, "board-1");
    expect(input!.threadId).toBe(rootUri);
    expect(input!.replyTo).toBe(parentUri);
  });

  it("4. behavioral: a direct reply to root (replyRootUri === replyParentUri) is valid, NOT rejected", () => {
    const rootUri = "at://did:plc:bob/app.bsky.feed.post/root1";
    const directReply: FedosValidatedAtprotoPost = {
      ...BASE_POST,
      uri: "at://did:plc:abc123/app.bsky.feed.post/reply1",
      replyRootUri: rootUri,
      replyParentUri: rootUri,
    };
    const input = mapValidatedAtprotoPostToBoardPostInput(directReply, "board-1");
    expect(input).not.toBeNull();
    expect(input!.threadId).toBe(rootUri);
    expect(input!.replyTo).toBe(rootUri);
  });

  it("5. behavioral: missing root (parent present, root null) is rejected", () => {
    const missingRoot: FedosValidatedAtprotoPost = {
      ...BASE_POST,
      replyRootUri: null,
      replyParentUri: "at://did:plc:carol/app.bsky.feed.post/parent1",
    };
    expect(mapValidatedAtprotoPostToBoardPostInput(missingRoot, "board-1")).toBeNull();
  });

  it("6. behavioral: missing parent (root present, parent null) is rejected", () => {
    const missingParent: FedosValidatedAtprotoPost = {
      ...BASE_POST,
      replyRootUri: "at://did:plc:bob/app.bsky.feed.post/root1",
      replyParentUri: null,
    };
    expect(mapValidatedAtprotoPostToBoardPostInput(missingParent, "board-1")).toBeNull();
  });

  it("7. behavioral: self-root contradiction (claims own uri as root, but parent is a different post) is rejected", () => {
    const contradictory: FedosValidatedAtprotoPost = {
      ...BASE_POST,
      replyRootUri: BASE_POST.uri,
      replyParentUri: "at://did:plc:carol/app.bsky.feed.post/parent1",
    };
    expect(mapValidatedAtprotoPostToBoardPostInput(contradictory, "board-1")).toBeNull();
  });

  it("8. behavioral: self-parent is rejected by the composed validateFedosBoardPost boundary, not duplicated in the adapter", () => {
    const selfParent: FedosValidatedAtprotoPost = {
      ...BASE_POST,
      replyRootUri: BASE_POST.uri,
      replyParentUri: BASE_POST.uri,
    };
    // The mapping step itself succeeds (root === parent === uri passes the
    // self-root-contradiction check, since replyParentUri === uri) --
    // validateAtprotoBoardPost's composed validateFedosBoardPost call rejects it.
    expect(mapValidatedAtprotoPostToBoardPostInput(selfParent, "board-1")).not.toBeNull();
    expect(validateAtprotoBoardPost(selfParent, "board-1")).toBeNull();
  });

  it("9. structural: no AT-URI internal parsing (did/collection/rkey extraction) anywhere in the adapter", () => {
    expect(adapterModuleSource).not.toMatch(/new RegExp|\.split\(["']\/["']\)|collection|rkey/i);
  });

  it("10. structural: boardId is a required, caller-supplied parameter -- never derived from the post", () => {
    const inputA = mapValidatedAtprotoPostToBoardPostInput(BASE_POST, "board-alpha");
    const inputB = mapValidatedAtprotoPostToBoardPostInput(BASE_POST, "board-beta");
    expect(inputA!.boardId).toBe("board-alpha");
    expect(inputB!.boardId).toBe("board-beta");
  });

  it("11. the design doc's own invariant table assigns every invalid combination to a named layer", () => {
    expect(designDocSource).toMatch(/\| Invalid combination \| Checked by \| How \|/);
    expect(designDocSource).toContain("Root without parent");
    expect(designDocSource).toContain("Parent without root");
    expect(designDocSource).toContain("Self-parent");
  });

  it("12. the design doc confirms no branded-id casting is performed in the adapter", () => {
    expect(designDocSource).toMatch(/do not pretend an AT URI is itself\s*\na branded `BoardPostId`/);
  });

  it("13. the design doc cross-references Alpha 282, Alpha 256, Alpha 264, and Alpha 276", () => {
    for (const ref of [
      "secure_runtime_alpha_282_normalized_atproto_post_model",
      "secure_runtime_alpha_256_thread_reply_semantics",
      "secure_runtime_alpha_264_nostr_thread_mapping",
      "secure_runtime_alpha_276_activitypub_thread_reply_mapping",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
