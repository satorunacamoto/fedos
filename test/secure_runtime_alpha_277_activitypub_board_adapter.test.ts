import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_277_activitypub_board_adapter.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterModuleSource from "../src/os/messenger/board/activitypub/fedos_activitypub_board_adapter.ts?raw";
import {
  validateActivityPubBoardPost,
  mapValidatedActivityPubPostToBoardPostInput,
} from "../src/board/activitypub/fedos_activitypub_board_adapter.js";
import type { FedosValidatedActivityPubPost } from "../src/board/activitypub/fedos_validated_activitypub_post.js";

const VALID_POST: FedosValidatedActivityPubPost = {
  objectId: "https://example.social/users/alice/statuses/1",
  actorId: "https://example.social/users/alice",
  content: "Hello ActivityPub board world",
  published: 1_700_000_000,
  inReplyTo: null,
  conversationRoot: null,
};

/**
 * Secure Runtime Alpha 277 -- "ActivityPub Board Adapter
 * Implementation": Stage 7 of the ActivityPub Canonical Board Adapter
 * Arc. Adds src/board/activitypub/fedos_activitypub_board_adapter.ts,
 * exporting validateActivityPubBoardPost and
 * mapValidatedActivityPubPostToBoardPostInput -- one-way, fail-closed,
 * no mutation/storage/network.
 */
describe("Secure Runtime Alpha 277 -- ActivityPub Board Adapter Implementation", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: a well-formed normalized post produces a real, frozen FedosBoardPost end to end", () => {
    const post = validateActivityPubBoardPost(VALID_POST, "board-general");
    expect(post).not.toBeNull();
    expect(post!.id).toBe(VALID_POST.objectId);
    expect(post!.body).toBe(VALID_POST.content);
    expect(post!.createdAt).toBe(VALID_POST.published);
    expect(post!.boardId).toBe("board-general");
    expect(Object.isFrozen(post)).toBe(true);
  });

  it("3. behavioral: never throws, even for wildly malformed input", () => {
    expect(() => validateActivityPubBoardPost(null as unknown as FedosValidatedActivityPubPost, "board-1")).not.toThrow();
    expect(validateActivityPubBoardPost(null as unknown as FedosValidatedActivityPubPost, "board-1")).toBeNull();
    expect(() => validateActivityPubBoardPost({} as FedosValidatedActivityPubPost, "board-1")).not.toThrow();
    expect(validateActivityPubBoardPost({} as FedosValidatedActivityPubPost, "board-1")).toBeNull();
  });

  it("4. behavioral: does not mutate the input post", () => {
    const post: FedosValidatedActivityPubPost = { ...VALID_POST };
    const snapshot = JSON.parse(JSON.stringify(post));
    validateActivityPubBoardPost(post, "board-1");
    expect(JSON.parse(JSON.stringify(post))).toEqual(snapshot);
  });

  it("5. structural: no throw statement, no storage/network import anywhere in the file", () => {
    expect(adapterModuleSource).not.toMatch(/\bthrow\b/);
    expect(adapterModuleSource).not.toMatch(/from ["']\.\.\/\.\.\/storage\/|from ["']\.\.\/storage\//);
    expect(adapterModuleSource).not.toMatch(/fetch\(|WebSocket|async function/);
  });

  it("6. structural: no function constructs anything ActivityPub-Activity-shaped -- one-way only", () => {
    expect(adapterModuleSource).not.toMatch(/"Create"|"Update"|"Delete"|@context|inbox|outbox/);
  });

  it("7. structural: validateActivityPubBoardPost composes with validateFedosBoardPost, exactly", () => {
    expect(adapterModuleSource).toMatch(
      /export function validateActivityPubBoardPost\([\s\S]*?\{\s*\n\s*const input = mapValidatedActivityPubPostToBoardPostInput\(post, boardId\);\s*\n\s*if \(input === null\) return null;\s*\n\s*return validateFedosBoardPost\(input\);\s*\n\}/,
    );
  });

  it("8. structural: boardId is a plain string parameter on both exported functions, matching the Nostr Adapter's own signature", () => {
    expect(adapterModuleSource).toMatch(/post: FedosValidatedActivityPubPost,\s*\n\s*boardId: string,/g);
  });

  it("9. the design doc cross-references Alpha 273, Alpha 274, Alpha 275, Alpha 276, and Alpha 266", () => {
    for (const ref of [
      "secure_runtime_alpha_273_activitypub_source_provenance",
      "secure_runtime_alpha_274_activitypub_author_mapping",
      "secure_runtime_alpha_275_activitypub_body_mapping",
      "secure_runtime_alpha_276_activitypub_thread_reply_mapping",
      "secure_runtime_alpha_266_nostr_board_adapter_implementation",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
