import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_256_thread_reply_semantics.md?raw";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";

const BASE: FedosBoardPostInput = {
  id: "post-1",
  boardId: "board-general",
  threadId: "post-1",
  replyTo: null,
  author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
  body: "Hello board world",
  createdAt: 1_700_000_000,
  source: { protocol: "nostr", reference: "abcdef0123456789" },
};

/**
 * Secure Runtime Alpha 256 -- "Thread and Reply Semantics": Stage 6 of
 * the Canonical Board Model Foundation Arc. A design-decision Stage,
 * adding no new production file -- it fixes "Option C" (threadId = root,
 * replyTo = direct parent) and confirms which invariants
 * validateFedosBoardPost (Alpha 257) can and cannot check on its own.
 */
describe("Secure Runtime Alpha 256 -- Thread and Reply Semantics", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc adopts Option C for thread shape, with the invariant-to-layer table", () => {
    expect(designDocSource).toMatch(/\*\*Adopted\*\*,\s+exactly this Arc's own preferred candidate, and/);
    expect(designDocSource).toMatch(/\| Invariant \| Enforced by \| Why \|/);
  });

  it("3. the design doc decides NOT to add a title field this Arc, with rationale", () => {
    expect(designDocSource).toMatch(/\*\*Title policy: no title field this Arc\.\*\*/);
  });

  it("4. behavioral: a root post (replyTo null) validates", () => {
    const post = validateFedosBoardPost(BASE);
    expect(post).not.toBeNull();
    expect(post!.replyTo).toBeNull();
  });

  it("5. behavioral: a reply post (replyTo set to a different id) validates, with threadId naming the root", () => {
    const reply: FedosBoardPostInput = {
      ...BASE,
      id: "post-2",
      threadId: "post-1",
      replyTo: "post-1",
    };
    const post = validateFedosBoardPost(reply);
    expect(post).not.toBeNull();
    expect(post!.replyTo).toBe("post-1");
    expect(post!.threadId).toBe("post-1");
  });

  it("6. behavioral: nested replies are allowed -- replyTo may point at a non-root post within the same thread", () => {
    const nestedReply: FedosBoardPostInput = {
      ...BASE,
      id: "post-3",
      threadId: "post-1",
      replyTo: "post-2", // points at a reply, not the root
    };
    const post = validateFedosBoardPost(nestedReply);
    expect(post).not.toBeNull();
    expect(post!.replyTo).toBe("post-2");
    expect(post!.threadId).toBe("post-1");
  });

  it("7. behavioral: a post cannot reply to itself", () => {
    const selfReply: FedosBoardPostInput = { ...BASE, replyTo: "post-1" }; // id is also post-1
    expect(validateFedosBoardPost(selfReply)).toBeNull();
  });

  it("8. the design doc explicitly assigns same-board/cycle/missing-parent invariants to Board Application Logic, not this Arc", () => {
    expect(designDocSource).toMatch(/Board Application Logic \(future\)/);
    expect(designDocSource).toMatch(/Do not implement a graph database/);
  });

  it("9. the design doc explicitly defines missing-parent handling as an orphan reply", () => {
    expect(designDocSource).toMatch(/\*\*orphan reply\*\*/);
  });

  it("10. the design doc cross-references Alpha 255 and Alpha 257", () => {
    for (const ref of [
      "secure_runtime_alpha_255_canonical_board_post_model",
      "secure_runtime_alpha_257_board_validation_boundary",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
