import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_285_atproto_body_mapping.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterModuleSource from "../src/board/atproto/fedos_atproto_board_adapter.ts?raw";
import {
  mapValidatedAtprotoPostToBoardPostInput,
  validateAtprotoBoardPost,
} from "../src/board/atproto/fedos_atproto_board_adapter.js";
import { FEDOS_BOARD_POST_MAX_BODY_LENGTH } from "../src/board/fedos_board_post_validator.js";
import type { FedosValidatedAtprotoPost } from "../src/board/atproto/fedos_validated_atproto_post.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

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
 * Secure Runtime Alpha 285 -- "AT Protocol Body Mapping": Stage 5 of
 * the AT Protocol Canonical Board Adapter Arc. A design-decision Stage
 * backed by behavioral tests -- text -> body verbatim, no markup guard
 * (unlike ActivityPub), no rich-text/facet/embed/Markdown/HTML
 * handling.
 */
describe("Secure Runtime Alpha 285 -- AT Protocol Body Mapping", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: text is copied verbatim into body", () => {
    const input = mapValidatedAtprotoPostToBoardPostInput(BASE_POST, "board-1");
    expect(input!.body).toBe(BASE_POST.text);
  });

  it("3. behavioral: unlike ActivityPub, a raw < or > character is NOT rejected -- no markup guard exists", () => {
    const withAngle: FedosValidatedAtprotoPost = { ...BASE_POST, text: "5 > 3 and 2 < 4" };
    const input = mapValidatedAtprotoPostToBoardPostInput(withAngle, "board-1");
    expect(input).not.toBeNull();
    expect(input!.body).toBe("5 > 3 and 2 < 4");
  });

  it("4. behavioral: a body at exactly the max length validates; one character over is rejected by the composed boundary", () => {
    const atMax: FedosValidatedAtprotoPost = { ...BASE_POST, text: "x".repeat(FEDOS_BOARD_POST_MAX_BODY_LENGTH) };
    const overMax: FedosValidatedAtprotoPost = {
      ...BASE_POST,
      text: "x".repeat(FEDOS_BOARD_POST_MAX_BODY_LENGTH + 1),
    };
    expect(validateAtprotoBoardPost(atMax, "board-1")).not.toBeNull();
    expect(validateAtprotoBoardPost(overMax, "board-1")).toBeNull();
  });

  it("5. behavioral: empty text is rejected by the composed boundary, not special-cased by the adapter", () => {
    const empty: FedosValidatedAtprotoPost = { ...BASE_POST, text: "" };
    expect(validateAtprotoBoardPost(empty, "board-1")).toBeNull();
    expect(mapValidatedAtprotoPostToBoardPostInput(empty, "board-1")).not.toBeNull();
  });

  it("6. structural: no Markdown/HTML parser, no facet/embed/URL-preview/mention/hashtag reference IN CODE", () => {
    expect(codeOnly(adapterModuleSource)).not.toMatch(
      /marked|markdown|innerHTML|DOMPurify|\bfacet\b|\bembed\b|linkPreview|hashtag/i,
    );
  });

  it("7. structural: no markup-detection function exists in this adapter (unlike the ActivityPub adapter)", () => {
    expect(adapterModuleSource).not.toMatch(/containsRawMarkupCharacter/);
  });

  it("8. the design doc explains why no ActivityPub-style markup guard is needed here", () => {
    expect(designDocSource).toMatch(/No ActivityPub-style markup guard/);
  });

  it("9. the design doc cross-references Alpha 282, Alpha 255, Alpha 263, and Alpha 275", () => {
    for (const ref of [
      "secure_runtime_alpha_282_normalized_atproto_post_model",
      "secure_runtime_alpha_255_canonical_board_post_model",
      "secure_runtime_alpha_263_nostr_body_mapping",
      "secure_runtime_alpha_275_activitypub_body_mapping",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
