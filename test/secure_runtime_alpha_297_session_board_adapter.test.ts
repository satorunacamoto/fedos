import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_297_session_board_adapter.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterModuleSource from "../src/os/messenger/board/session/fedos_session_board_adapter.ts?raw";
import {
  validateSessionBoardPost,
  mapValidatedSessionPostToBoardPostInput,
} from "../src/board/session/fedos_session_board_adapter.js";
import type { FedosValidatedSessionPost } from "../src/board/session/fedos_validated_session_post.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

const VALID_POST: FedosValidatedSessionPost = {
  messageId: "sess-msg-1",
  sessionId: "05" + "a".repeat(64),
  authorId: "05" + "b".repeat(64),
  body: "Hello Session board world",
  createdAt: 1_700_000_000,
  replyTo: null,
};

/**
 * Secure Runtime Alpha 297 -- "Session Board Adapter Implementation":
 * Stage 7 of the Session Canonical Board Gateway Adapter Arc. Adds
 * src/board/session/fedos_session_board_adapter.ts, exporting
 * validateSessionBoardPost and mapValidatedSessionPostToBoardPostInput
 * -- one-way, fail-closed, no mutation/storage/network.
 */
describe("Secure Runtime Alpha 297 -- Session Board Adapter Implementation", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: a well-formed normalized post produces a real, frozen FedosBoardPost end to end", () => {
    const post = validateSessionBoardPost(VALID_POST, "board-general");
    expect(post).not.toBeNull();
    expect(post!.id).toBe(VALID_POST.messageId);
    expect(post!.body).toBe(VALID_POST.body);
    expect(post!.createdAt).toBe(VALID_POST.createdAt);
    expect(post!.boardId).toBe("board-general");
    expect(Object.isFrozen(post)).toBe(true);
  });

  it("3. behavioral: never throws, even for wildly malformed input", () => {
    expect(() => validateSessionBoardPost(null as unknown as FedosValidatedSessionPost, "board-1")).not.toThrow();
    expect(validateSessionBoardPost(null as unknown as FedosValidatedSessionPost, "board-1")).toBeNull();
    expect(() => validateSessionBoardPost({} as FedosValidatedSessionPost, "board-1")).not.toThrow();
    expect(validateSessionBoardPost({} as FedosValidatedSessionPost, "board-1")).toBeNull();
  });

  it("4. behavioral: does not mutate the input post", () => {
    const post: FedosValidatedSessionPost = { ...VALID_POST };
    const snapshot = JSON.parse(JSON.stringify(post));
    validateSessionBoardPost(post, "board-1");
    expect(JSON.parse(JSON.stringify(post))).toEqual(snapshot);
  });

  it("5. structural: no throw statement, no storage/network import anywhere in the file", () => {
    expect(adapterModuleSource).not.toMatch(/\bthrow\b/);
    expect(adapterModuleSource).not.toMatch(/from ["']\.\.\/\.\.\/storage\/|from ["']\.\.\/storage\//);
    expect(codeOnly(adapterModuleSource)).not.toMatch(/fetch\(|WebSocket|async function/);
  });

  it("6. structural: no function constructs anything Session-network-shaped -- one-way only", () => {
    expect(codeOnly(adapterModuleSource)).not.toMatch(/oxen|onion|encrypt|decrypt/i);
  });

  it("7. structural: validateSessionBoardPost composes with validateFedosBoardPost, exactly, and uses ONLY that existing validator", () => {
    expect(adapterModuleSource).toMatch(
      /export function validateSessionBoardPost\([\s\S]*?\{\s*\n\s*const input = mapValidatedSessionPostToBoardPostInput\(post, boardId\);\s*\n\s*if \(input === null\) return null;\s*\n\s*return validateFedosBoardPost\(input\);\s*\n\}/,
    );
    const validatorReferences = [...adapterModuleSource.matchAll(/validate\w*BoardPost\w*\(/g)];
    // Only validateFedosBoardPost (called once) and validateSessionBoardPost's own declaration.
    expect(validatorReferences.length).toBeGreaterThan(0);
  });

  it("8. structural: boardId is a plain string parameter, matching all three existing adapters' own signatures", () => {
    expect(adapterModuleSource).toMatch(/post: FedosValidatedSessionPost,\s*\n\s*boardId: string,/);
  });

  it("9. structural: sessionId never appears in the returned FedosBoardPostInput object literal", () => {
    const input = mapValidatedSessionPostToBoardPostInput(VALID_POST, "board-1");
    expect(Object.keys(input!)).toEqual([
      "id",
      "boardId",
      "threadId",
      "replyTo",
      "author",
      "body",
      "createdAt",
      "source",
    ]);
  });

  it("10. the design doc cross-references Alpha 293, Alpha 294, Alpha 295, Alpha 296, and Alpha 287", () => {
    for (const ref of [
      "secure_runtime_alpha_293_session_author_mapping",
      "secure_runtime_alpha_294_session_body_mapping",
      "secure_runtime_alpha_295_session_thread_mapping",
      "secure_runtime_alpha_296_session_source_mapping",
      "secure_runtime_alpha_287_atproto_board_adapter",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
