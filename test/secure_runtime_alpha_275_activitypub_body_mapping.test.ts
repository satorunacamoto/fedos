import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_275_activitypub_body_mapping.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterModuleSource from "../src/board/activitypub/fedos_activitypub_board_adapter.ts?raw";
import {
  mapValidatedActivityPubPostToBoardPostInput,
  validateActivityPubBoardPost,
} from "../src/board/activitypub/fedos_activitypub_board_adapter.js";
import { FEDOS_BOARD_POST_MAX_BODY_LENGTH } from "../src/board/fedos_board_post_validator.js";
import type { FedosValidatedActivityPubPost } from "../src/board/activitypub/fedos_validated_activitypub_post.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

const BASE_POST: FedosValidatedActivityPubPost = {
  objectId: "https://example.social/users/alice/statuses/1",
  actorId: "https://example.social/users/alice",
  content: "Hello ActivityPub board world",
  published: 1_700_000_000,
  inReplyTo: null,
  conversationRoot: null,
};

/**
 * Secure Runtime Alpha 275 -- "ActivityPub Body Mapping": Stage 5 of
 * the ActivityPub Canonical Board Adapter Arc. A design-decision Stage
 * backed by behavioral tests -- content -> body verbatim, a minimal
 * non-parsing markup guard as the fail-closed backstop, no Markdown/
 * rendering/link-preview/emoji/attachment handling.
 */
describe("Secure Runtime Alpha 275 -- ActivityPub Body Mapping", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: content is copied verbatim into body when it is plain text", () => {
    const input = mapValidatedActivityPubPostToBoardPostInput(BASE_POST, "board-1");
    expect(input!.body).toBe(BASE_POST.content);
  });

  it("3. behavioral: content carrying a raw < or > character is rejected outright, not stripped", () => {
    const withMarkup: FedosValidatedActivityPubPost = { ...BASE_POST, content: "<p>Hello</p>" };
    const withAngle: FedosValidatedActivityPubPost = { ...BASE_POST, content: "5 > 3 is true" };
    expect(mapValidatedActivityPubPostToBoardPostInput(withMarkup, "board-1")).toBeNull();
    expect(mapValidatedActivityPubPostToBoardPostInput(withAngle, "board-1")).toBeNull();
  });

  it("4. behavioral: a body at exactly the max length validates; one character over is rejected by the composed boundary", () => {
    const atMax: FedosValidatedActivityPubPost = { ...BASE_POST, content: "x".repeat(FEDOS_BOARD_POST_MAX_BODY_LENGTH) };
    const overMax: FedosValidatedActivityPubPost = {
      ...BASE_POST,
      content: "x".repeat(FEDOS_BOARD_POST_MAX_BODY_LENGTH + 1),
    };
    expect(validateActivityPubBoardPost(atMax, "board-1")).not.toBeNull();
    expect(validateActivityPubBoardPost(overMax, "board-1")).toBeNull();
  });

  it("5. behavioral: empty content is rejected by the composed boundary, not special-cased by the adapter", () => {
    const empty: FedosValidatedActivityPubPost = { ...BASE_POST, content: "" };
    expect(validateActivityPubBoardPost(empty, "board-1")).toBeNull();
    expect(mapValidatedActivityPubPostToBoardPostInput(empty, "board-1")).not.toBeNull();
  });

  it("6. structural: no Markdown/HTML parser, no link-preview, no emoji-expansion, no attachment-download reference IN CODE", () => {
    expect(codeOnly(adapterModuleSource)).not.toMatch(
      /marked|markdown|innerHTML|DOMPurify|linkPreview|emoji|downloadAttachment/i,
    );
  });

  it("7. structural: the markup guard performs no transformation -- it only ever returns a boolean", () => {
    expect(adapterModuleSource).toMatch(
      /function containsRawMarkupCharacter\(content: string\): boolean \{\s*\n\s*return content\.includes\("<"\) \|\| content\.includes\(">"\);\s*\n\}/,
    );
  });

  it("8. the design doc adopts Option B and names the honest false-positive limitation", () => {
    expect(designDocSource).toMatch(/\*\*Adopted\*\*,\s+exactly this Arc's own preferred candidate/);
    expect(designDocSource).toMatch(/\*\*A named, honest limitation, not a silent one:\*\*/);
  });

  it("9. the design doc cross-references Alpha 272, Alpha 255, and Alpha 263", () => {
    for (const ref of [
      "secure_runtime_alpha_272_normalized_activitypub_post_model",
      "secure_runtime_alpha_255_canonical_board_post_model",
      "secure_runtime_alpha_263_nostr_body_mapping",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
