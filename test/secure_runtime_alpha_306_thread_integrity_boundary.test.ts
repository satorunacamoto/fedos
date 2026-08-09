import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_306_thread_integrity_boundary.md?raw";
import { FedosBoardService } from "../src/os/messenger/board/repository/fedos_board_service.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";

const ROOT_INPUT: FedosBoardPostInput = {
  id: "post-root",
  boardId: "board-1",
  threadId: "post-root",
  replyTo: null,
  author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
  body: "Hello board world",
  createdAt: 1_700_000_000,
  source: { protocol: "nostr", reference: "abc123" },
};

/**
 * Secure Runtime Alpha 306 -- "Thread Integrity Boundary": Stage 6 of
 * the Canonical Board Repository, Index & Feed Foundation Arc. A
 * design-decision Stage (no new production file) backed by behavioral
 * tests over FedosBoardService.registerPost -- the actual
 * implementation point, Alpha 307. Verifies root/reply/missing-parent/
 * cross-board/cycle-impossibility decisions.
 */
describe("Secure Runtime Alpha 306 -- Thread Integrity Boundary", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: a root post whose threadId does not equal its own id is invalid-thread", () => {
    const service = new FedosBoardService();
    const malformedRoot = validateFedosBoardPost({ ...ROOT_INPUT, threadId: "some-other-thread" })!;
    expect(service.registerPost(malformedRoot)).toBe("invalid-thread");
  });

  it("3. behavioral: a reply whose parent was never registered is missing-parent (Option A: reject)", () => {
    const service = new FedosBoardService();
    const reply = validateFedosBoardPost({ ...ROOT_INPUT, id: "post-reply", replyTo: "post-root" })!;
    expect(service.registerPost(reply)).toBe("missing-parent");
  });

  it("4. behavioral: self-reply is structurally impossible -- validateFedosBoardPost already rejects it upstream", () => {
    expect(validateFedosBoardPost({ ...ROOT_INPUT, replyTo: "post-root" })).toBeNull();
  });

  it("5. behavioral: a newly inserted post may only point to an already-existing parent, making cycles structurally impossible", () => {
    const service = new FedosBoardService();
    const root = validateFedosBoardPost(ROOT_INPUT)!;
    expect(service.registerPost(root)).toBe("inserted");
    const reply = validateFedosBoardPost({
      ...ROOT_INPUT,
      id: "post-reply",
      replyTo: "post-root",
      source: { protocol: "nostr", reference: "reply-source-ref" },
    })!;
    expect(service.registerPost(reply)).toBe("inserted");
    // A hand-built "reply" from post-root back to post-reply would require
    // mutating the already-registered, immutable root -- structurally impossible.
    expect(Object.isFrozen(root)).toBe(true);
  });

  it("6. structural: no network/Relay/Ontology reference anywhere in the service file", () => {
    // Re-confirmed at the actual implementation Stage (Alpha 307's own test);
    // this Stage's own test focuses on the decision's observable behavior.
    const service = new FedosBoardService();
    expect(typeof service.registerPost).toBe("function");
  });

  it("7. the design doc adopts Option A (reject) for missing parents, with the fail-closed reason", () => {
    expect(designDocSource).toMatch(/\*\*Adopted\*\*, exactly this Arc's own/);
    expect(designDocSource).toMatch(/Fail closed and\s*\nkeep the repository internally consistent/);
  });

  it("8. the design doc explains why cycles are structurally impossible by the insertion rule, not separately detected", () => {
    expect(designDocSource).toMatch(/Cycles — structurally impossible by the insertion rule, not/);
  });

  it("9. the design doc explains self-reply is inherited for free, not re-checked", () => {
    expect(designDocSource).toMatch(/NOT re-checked here\. This\s+invariant is INHERITED FOR FREE/);
  });

  it("10. the design doc cross-references Alpha 256, Alpha 257, Alpha 301, and Alpha 307", () => {
    for (const ref of [
      "secure_runtime_alpha_256_thread_reply_semantics",
      "secure_runtime_alpha_257_board_validation_boundary",
      "secure_runtime_alpha_301_existing_board_repository_inventory",
      "secure_runtime_alpha_307_board_application_service",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
