import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_305_board_thread_index.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardIndexSource from "../src/os/messenger/board/repository/fedos_board_index.ts?raw";
import { FedosBoardIndex } from "../src/board/repository/fedos_board_index.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";

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
 * Secure Runtime Alpha 305 -- "Board and Thread Index": Stage 5 of the
 * Canonical Board Repository, Index & Feed Foundation Arc. Adds
 * src/board/repository/fedos_board_index.ts, exporting FedosBoardIndex
 * -- ID-only, board-partitioned, thread-partitioned by (boardId,
 * threadId), no cross-board contamination.
 */
describe("Secure Runtime Alpha 305 -- Board and Thread Index", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: root and replies are indexed under the same threadId", () => {
    const index = new FedosBoardIndex();
    const root = validateFedosBoardPost(ROOT_INPUT)!;
    const reply = validateFedosBoardPost({
      ...ROOT_INPUT,
      id: "post-reply",
      replyTo: "post-root",
    })!;
    index.register(root);
    index.register(reply);
    const threadIds = index.listThreadPostIds(root.boardId, root.threadId);
    expect([...threadIds].sort()).toEqual(["post-reply", "post-root"].sort());
  });

  it("3. behavioral: posts are separated by boardId", () => {
    const index = new FedosBoardIndex();
    const postBoardA = validateFedosBoardPost(ROOT_INPUT)!;
    const postBoardB = validateFedosBoardPost({ ...ROOT_INPUT, id: "post-b", boardId: "board-2", threadId: "post-b" })!;
    index.register(postBoardA);
    index.register(postBoardB);
    expect(index.listBoardPostIds(postBoardA.boardId)).toEqual(["post-root"]);
    expect(index.listBoardPostIds(postBoardB.boardId)).toEqual(["post-b"]);
  });

  it("4. behavioral: same post registered twice remains one index entry", () => {
    const index = new FedosBoardIndex();
    const root = validateFedosBoardPost(ROOT_INPUT)!;
    expect(index.register(root)).toBe("inserted");
    expect(index.register(root)).toBe("already-present");
    expect(index.listBoardPostIds(root.boardId)).toHaveLength(1);
    expect(index.listThreadPostIds(root.boardId, root.threadId)).toHaveLength(1);
  });

  it("5. behavioral: a conflicting re-registration (different boardId/threadId for the same id) is not indexed", () => {
    const index = new FedosBoardIndex();
    const root = validateFedosBoardPost(ROOT_INPUT)!;
    index.register(root);
    // Simulate a conflicting location for the same id (hand-built, bypassing the service layer).
    const conflicting = { ...root, boardId: "board-2" as typeof root.boardId };
    expect(index.register(conflicting)).toBe("conflict");
    expect(index.listBoardPostIds("board-2" as typeof root.boardId)).toEqual([]);
    expect(index.listBoardPostIds(root.boardId)).toEqual(["post-root"]);
  });

  it("6. behavioral: cross-board contamination is impossible even with an equal threadId string value", () => {
    const index = new FedosBoardIndex();
    const postBoardA = validateFedosBoardPost({ ...ROOT_INPUT, id: "post-x", boardId: "board-A", threadId: "shared-thread-id" })!;
    const postBoardB = validateFedosBoardPost({ ...ROOT_INPUT, id: "post-y", boardId: "board-B", threadId: "shared-thread-id" })!;
    index.register(postBoardA);
    index.register(postBoardB);
    expect(index.listThreadPostIds(postBoardA.boardId, postBoardA.threadId)).toEqual(["post-x"]);
    expect(index.listThreadPostIds(postBoardB.boardId, postBoardB.threadId)).toEqual(["post-y"]);
  });

  it("7. behavioral: returned arrays are independent -- a new array is returned every call", () => {
    const index = new FedosBoardIndex();
    const root = validateFedosBoardPost(ROOT_INPUT)!;
    index.register(root);
    const first = index.listBoardPostIds(root.boardId);
    const second = index.listBoardPostIds(root.boardId);
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });

  it("8. behavioral: unknown board/thread return empty arrays, not undefined or throw", () => {
    const index = new FedosBoardIndex();
    const unregistered = validateFedosBoardPost({ ...ROOT_INPUT, id: "post-unregistered", boardId: "board-unknown" })!;
    expect(() => index.listBoardPostIds(unregistered.boardId)).not.toThrow();
    expect(index.listBoardPostIds(unregistered.boardId)).toEqual([]);
    expect(index.listThreadPostIds(unregistered.boardId, unregistered.threadId)).toEqual([]);
  });

  it("9. structural: no parent/child graph traversal or search-shaped method IN CODE", () => {
    expect(codeOnly(boardIndexSource)).not.toMatch(/children|parent|search|fullText/i);
  });

  it("10. the design doc cross-references Alpha 301, Alpha 256, Alpha 302, and Alpha 306", () => {
    for (const ref of [
      "secure_runtime_alpha_301_existing_board_repository_inventory",
      "secure_runtime_alpha_256_thread_reply_semantics",
      "secure_runtime_alpha_302_board_repository_contract",
      "secure_runtime_alpha_306_thread_integrity_boundary",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
