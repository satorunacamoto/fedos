import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_287_atproto_board_adapter.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterModuleSource from "../src/board/atproto/fedos_atproto_board_adapter.ts?raw";
import {
  validateAtprotoBoardPost,
  mapValidatedAtprotoPostToBoardPostInput,
} from "../src/board/atproto/fedos_atproto_board_adapter.js";
import type { FedosValidatedAtprotoPost } from "../src/board/atproto/fedos_validated_atproto_post.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

const VALID_POST: FedosValidatedAtprotoPost = {
  uri: "at://did:plc:abc123/app.bsky.feed.post/xyz789",
  cid: "bafyabc123",
  authorDid: "did:plc:abc123",
  text: "Hello AT Protocol board world",
  createdAt: 1_700_000_000,
  replyRootUri: null,
  replyParentUri: null,
};

/**
 * Secure Runtime Alpha 287 -- "AT Protocol Board Adapter
 * Implementation": Stage 7 of the AT Protocol Canonical Board Adapter
 * Arc. Adds src/board/atproto/fedos_atproto_board_adapter.ts, exporting
 * validateAtprotoBoardPost and mapValidatedAtprotoPostToBoardPostInput
 * -- one-way, fail-closed, no mutation/storage/network.
 */
describe("Secure Runtime Alpha 287 -- AT Protocol Board Adapter Implementation", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: a well-formed normalized post produces a real, frozen FedosBoardPost end to end", () => {
    const post = validateAtprotoBoardPost(VALID_POST, "board-general");
    expect(post).not.toBeNull();
    expect(post!.id).toBe(VALID_POST.uri);
    expect(post!.body).toBe(VALID_POST.text);
    expect(post!.createdAt).toBe(VALID_POST.createdAt);
    expect(post!.boardId).toBe("board-general");
    expect(Object.isFrozen(post)).toBe(true);
  });

  it("3. behavioral: never throws, even for wildly malformed input", () => {
    expect(() => validateAtprotoBoardPost(null as unknown as FedosValidatedAtprotoPost, "board-1")).not.toThrow();
    expect(validateAtprotoBoardPost(null as unknown as FedosValidatedAtprotoPost, "board-1")).toBeNull();
    expect(() => validateAtprotoBoardPost({} as FedosValidatedAtprotoPost, "board-1")).not.toThrow();
    expect(validateAtprotoBoardPost({} as FedosValidatedAtprotoPost, "board-1")).toBeNull();
  });

  it("4. behavioral: does not mutate the input post", () => {
    const post: FedosValidatedAtprotoPost = { ...VALID_POST };
    const snapshot = JSON.parse(JSON.stringify(post));
    validateAtprotoBoardPost(post, "board-1");
    expect(JSON.parse(JSON.stringify(post))).toEqual(snapshot);
  });

  it("5. structural: no throw statement, no storage/network import anywhere in the file", () => {
    expect(adapterModuleSource).not.toMatch(/\bthrow\b/);
    expect(adapterModuleSource).not.toMatch(/from ["']\.\.\/\.\.\/storage\/|from ["']\.\.\/storage\//);
    expect(codeOnly(adapterModuleSource)).not.toMatch(/fetch\(|WebSocket|async function|XRPC/);
  });

  it("6. structural: no function constructs anything AT-Protocol-record-shaped -- one-way only", () => {
    expect(codeOnly(adapterModuleSource)).not.toMatch(/app\.bsky\.feed\.post|\$type|repo:|collection:/);
  });

  it("7. structural: validateAtprotoBoardPost composes with validateFedosBoardPost, exactly", () => {
    expect(adapterModuleSource).toMatch(
      /export function validateAtprotoBoardPost\([\s\S]*?\{\s*\n\s*const input = mapValidatedAtprotoPostToBoardPostInput\(post, boardId\);\s*\n\s*if \(input === null\) return null;\s*\n\s*return validateFedosBoardPost\(input\);\s*\n\}/,
    );
  });

  it("8. structural: boardId is a plain string parameter, matching both existing adapters' own signatures", () => {
    expect(adapterModuleSource).toMatch(/post: FedosValidatedAtprotoPost,\s*\n\s*boardId: string,/);
  });

  it("9. structural: cid never appears in the returned FedosBoardPostInput object literal", () => {
    const input = mapValidatedAtprotoPostToBoardPostInput(VALID_POST, "board-1");
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

  it("10. the design doc cross-references Alpha 283, Alpha 284, Alpha 285, Alpha 286, and Alpha 277", () => {
    for (const ref of [
      "secure_runtime_alpha_283_atproto_source_provenance",
      "secure_runtime_alpha_284_atproto_author_mapping",
      "secure_runtime_alpha_285_atproto_body_mapping",
      "secure_runtime_alpha_286_atproto_thread_reply_mapping",
      "secure_runtime_alpha_277_activitypub_board_adapter",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
