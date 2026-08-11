import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_307_board_application_service.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/os/messenger/board/repository/fedos_board_service.ts?raw";
import { FedosBoardService } from "../src/os/messenger/board/repository/fedos_board_service.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

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
 * Secure Runtime Alpha 307 -- "Board Repository Application Service":
 * Stage 7 of the Canonical Board Repository, Index & Feed Foundation
 * Arc. Adds src/board/repository/fedos_board_service.ts, exporting
 * FedosBoardService -- all seven FedosBoardRegistrationResult outcomes,
 * atomic write coordination, no partial mutation on rejection.
 */
describe("Secure Runtime Alpha 307 -- Board Repository Application Service", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. inserted", () => {
    const service = new FedosBoardService();
    const root = validateFedosBoardPost(ROOT_INPUT)!;
    expect(service.registerPost(root)).toBe("inserted");
    expect(service.findPost(root.id)).toBe(root);
  });

  it("3. already-present", () => {
    const service = new FedosBoardService();
    const a = validateFedosBoardPost(ROOT_INPUT)!;
    const b = validateFedosBoardPost({ ...ROOT_INPUT })!;
    expect(service.registerPost(a)).toBe("inserted");
    expect(service.registerPost(b)).toBe("already-present");
  });

  it("4. post-id-conflict", () => {
    const service = new FedosBoardService();
    const original = validateFedosBoardPost(ROOT_INPUT)!;
    const different = validateFedosBoardPost({ ...ROOT_INPUT, body: "a totally different message" })!;
    expect(service.registerPost(original)).toBe("inserted");
    expect(service.registerPost(different)).toBe("post-id-conflict");
    expect(service.findPost(original.id)).toBe(original);
  });

  it("5. source-conflict", () => {
    const service = new FedosBoardService();
    const original = validateFedosBoardPost(ROOT_INPUT)!;
    const sameSourceDifferentId = validateFedosBoardPost({
      ...ROOT_INPUT,
      id: "post-different-id",
      threadId: "post-different-id",
    })!;
    expect(service.registerPost(original)).toBe("inserted");
    expect(service.registerPost(sameSourceDifferentId)).toBe("source-conflict");
    expect(service.findPost(sameSourceDifferentId.id)).toBeNull();
  });

  it("6. missing-parent", () => {
    const service = new FedosBoardService();
    const reply = validateFedosBoardPost({ ...ROOT_INPUT, id: "post-reply", replyTo: "post-root" })!;
    expect(service.registerPost(reply)).toBe("missing-parent");
    expect(service.findPost(reply.id)).toBeNull();
  });

  it("7. invalid-thread (root with mismatched threadId)", () => {
    const service = new FedosBoardService();
    const malformedRoot = validateFedosBoardPost({ ...ROOT_INPUT, threadId: "some-other-thread" })!;
    expect(service.registerPost(malformedRoot)).toBe("invalid-thread");
    expect(service.findPost(malformedRoot.id)).toBeNull();
  });

  it("8. invalid-thread (reply whose threadId disagrees with its real parent's threadId)", () => {
    const service = new FedosBoardService();
    const root = validateFedosBoardPost(ROOT_INPUT)!;
    expect(service.registerPost(root)).toBe("inserted");
    const badReply = validateFedosBoardPost({
      ...ROOT_INPUT,
      id: "post-reply",
      replyTo: "post-root",
      threadId: "post-reply", // disagrees with parent's own threadId ("post-root")
    })!;
    expect(service.registerPost(badReply)).toBe("invalid-thread");
  });

  it("9. cross-board-reply", () => {
    const service = new FedosBoardService();
    const root = validateFedosBoardPost(ROOT_INPUT)!;
    expect(service.registerPost(root)).toBe("inserted");
    const crossBoardReply = validateFedosBoardPost({
      ...ROOT_INPUT,
      id: "post-reply",
      boardId: "board-2",
      replyTo: "post-root",
    })!;
    expect(service.registerPost(crossBoardReply)).toBe("cross-board-reply");
    expect(service.findPost(crossBoardReply.id)).toBeNull();
  });

  it("10. atomicity: a rejected registration mutates nothing -- repository, source index, and board index all stay untouched", () => {
    const service = new FedosBoardService();
    const original = validateFedosBoardPost(ROOT_INPUT)!;
    service.registerPost(original);
    const different = validateFedosBoardPost({ ...ROOT_INPUT, body: "different content" })!;
    service.registerPost(different); // post-id-conflict
    expect(service.listBoardPosts(original.boardId)).toEqual([original]);
    expect(service.listThreadPosts(original.boardId, original.threadId)).toEqual([original]);
  });

  it("11. behavioral: a valid reply chain groups correctly under listThreadPosts", () => {
    const service = new FedosBoardService();
    const root = validateFedosBoardPost(ROOT_INPUT)!;
    const reply = validateFedosBoardPost({
      ...ROOT_INPUT,
      id: "post-reply",
      replyTo: "post-root",
      source: { protocol: "nostr", reference: "reply-source-ref" },
    })!;
    expect(service.registerPost(root)).toBe("inserted");
    expect(service.registerPost(reply)).toBe("inserted");
    const threadPosts = service.listThreadPosts(root.boardId, root.threadId);
    expect(threadPosts.map((p) => p.id).sort()).toEqual(["post-reply", "post-root"].sort());
  });

  it("12. structural: no throw statement, no Storage/Runtime/Desktop/protocol-adapter/p2p import IN CODE", () => {
    expect(codeOnly(serviceSource)).not.toMatch(/\bthrow\b/);
    expect(serviceSource).not.toMatch(
      /from ["']\.\.\/\.\.\/storage\/|from ["']\.\.\/\.\.\/runtime\/|from ["']\.\.\/\.\.\/desktop\/|nostr_adapter|activitypub_board_adapter|atproto_board_adapter|session_board_adapter|["'].*p2p.*["']/,
    );
  });

  it("13. the design doc names all seven outcomes as a fixed token union", () => {
    for (const outcome of [
      "inserted",
      "already-present",
      "post-id-conflict",
      "source-conflict",
      "missing-parent",
      "invalid-thread",
      "cross-board-reply",
    ]) {
      expect(designDocSource).toContain(`"${outcome}"`);
    }
  });

  it("14. the design doc cross-references Alpha 302, Alpha 303, Alpha 304, Alpha 305, and Alpha 306", () => {
    for (const ref of [
      "secure_runtime_alpha_302_board_repository_contract",
      "secure_runtime_alpha_303_in_memory_board_repository",
      "secure_runtime_alpha_304_board_source_index",
      "secure_runtime_alpha_305_board_thread_index",
      "secure_runtime_alpha_306_thread_integrity_boundary",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
