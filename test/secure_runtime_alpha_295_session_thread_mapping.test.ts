import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_295_session_thread_mapping.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterModuleSource from "../src/board/session/fedos_session_board_adapter.ts?raw";
import {
  mapValidatedSessionPostToBoardPostInput,
  validateSessionBoardPost,
} from "../src/board/session/fedos_session_board_adapter.js";
import type { FedosValidatedSessionPost } from "../src/board/session/fedos_validated_session_post.js";

const BASE_POST: FedosValidatedSessionPost = {
  messageId: "sess-msg-A",
  sessionId: "05" + "a".repeat(64),
  authorId: "05" + "b".repeat(64),
  body: "Hello Session board world",
  createdAt: 1_700_000_000,
  replyTo: null,
};

/**
 * Secure Runtime Alpha 295 -- "Session Thread Mapping": Stage 5 of the
 * Session Canonical Board Gateway Adapter Arc. A design-decision Stage
 * backed by behavioral tests -- the adopted Gateway contract (no
 * replyTo -> root; replyTo present -> threadId = replyTo), no
 * inference, self-reply reused from validateFedosBoardPost.
 */
describe("Secure Runtime Alpha 295 -- Session Thread Mapping", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: a root post (replyTo null) sets threadId to its own messageId and replyTo to null", () => {
    const input = mapValidatedSessionPostToBoardPostInput(BASE_POST, "board-1");
    expect(input!.replyTo).toBeNull();
    expect(input!.threadId).toBe(BASE_POST.messageId);
  });

  it("3. behavioral: a reply sets threadId equal to replyTo (the direct parent, per the Gateway contract)", () => {
    const reply: FedosValidatedSessionPost = {
      ...BASE_POST,
      messageId: "sess-msg-B",
      replyTo: "sess-msg-A",
    };
    const input = mapValidatedSessionPostToBoardPostInput(reply, "board-1");
    expect(input!.threadId).toBe("sess-msg-A");
    expect(input!.replyTo).toBe("sess-msg-A");
  });

  it("4. behavioral: a nested reply chain produces a DIFFERENT threadId at each level -- the documented limitation", () => {
    const messageB: FedosValidatedSessionPost = { ...BASE_POST, messageId: "sess-msg-B", replyTo: "sess-msg-A" };
    const messageC: FedosValidatedSessionPost = { ...BASE_POST, messageId: "sess-msg-C", replyTo: "sess-msg-B" };
    const inputB = mapValidatedSessionPostToBoardPostInput(messageB, "board-1");
    const inputC = mapValidatedSessionPostToBoardPostInput(messageC, "board-1");
    expect(inputB!.threadId).toBe("sess-msg-A");
    expect(inputC!.threadId).toBe("sess-msg-B");
    expect(inputB!.threadId).not.toBe(inputC!.threadId);
  });

  it("5. behavioral: self-reply is rejected by the composed validateFedosBoardPost boundary, not duplicated in the adapter", () => {
    const selfReply: FedosValidatedSessionPost = { ...BASE_POST, replyTo: BASE_POST.messageId };
    expect(mapValidatedSessionPostToBoardPostInput(selfReply, "board-1")).not.toBeNull();
    expect(validateSessionBoardPost(selfReply, "board-1")).toBeNull();
  });

  it("6. structural: no inference/parsing of messageId or replyTo string shape anywhere in the adapter", () => {
    expect(adapterModuleSource).not.toMatch(/new RegExp|\.split\(|\.match\(/);
  });

  it("7. structural: boardId is a required, caller-supplied parameter -- never derived from the post", () => {
    const inputA = mapValidatedSessionPostToBoardPostInput(BASE_POST, "board-alpha");
    const inputB = mapValidatedSessionPostToBoardPostInput(BASE_POST, "board-beta");
    expect(inputA!.boardId).toBe("board-alpha");
    expect(inputB!.boardId).toBe("board-beta");
  });

  it("8. the design doc states the adopted Gateway contract and explicitly forbids inference", () => {
    expect(designDocSource).toMatch(/replyTo === null   ->  Root/);
    expect(designDocSource).toMatch(/推測禁止/);
  });

  it("9. the design doc names the honest limitation of this contract compared to the other three protocols", () => {
    expect(designDocSource).toMatch(/A named, honest limitation — not a silent one/);
  });

  it("10. the design doc cross-references Alpha 292, Alpha 256, Alpha 264, and Alpha 286", () => {
    for (const ref of [
      "secure_runtime_alpha_292_normalized_session_post_model",
      "secure_runtime_alpha_256_thread_reply_semantics",
      "secure_runtime_alpha_264_nostr_thread_mapping",
      "secure_runtime_alpha_286_atproto_thread_reply_mapping",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
