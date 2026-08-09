import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_294_session_body_mapping.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterModuleSource from "../src/os/messenger/board/session/fedos_session_board_adapter.ts?raw";
import {
  mapValidatedSessionPostToBoardPostInput,
  validateSessionBoardPost,
} from "../src/os/messenger/board/session/fedos_session_board_adapter.js";
import { FEDOS_BOARD_POST_MAX_BODY_LENGTH } from "../src/os/messenger/board/fedos_board_post_validator.js";
import type { FedosValidatedSessionPost } from "../src/os/messenger/board/session/fedos_validated_session_post.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

const BASE_POST: FedosValidatedSessionPost = {
  messageId: "sess-msg-1",
  sessionId: "05" + "a".repeat(64),
  authorId: "05" + "b".repeat(64),
  body: "Hello Session board world",
  createdAt: 1_700_000_000,
  replyTo: null,
};

/**
 * Secure Runtime Alpha 294 -- "Session Body Mapping": Stage 4 of the
 * Session Canonical Board Gateway Adapter Arc. A design-decision Stage
 * backed by behavioral tests -- body -> body verbatim, no processing/
 * Markdown/HTML/Emoji conversion, no markup guard.
 */
describe("Secure Runtime Alpha 294 -- Session Body Mapping", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it("2. behavioral: body is copied verbatim", () => {
    const input = mapValidatedSessionPostToBoardPostInput(BASE_POST, "board-1");
    expect(input!.body).toBe(BASE_POST.body);
  });

  it("3. behavioral: emoji characters are preserved verbatim, not converted or stripped", () => {
    const emoji: FedosValidatedSessionPost = { ...BASE_POST, body: "Hello 👋 world 🌍 :smile:" };
    const input = mapValidatedSessionPostToBoardPostInput(emoji, "board-1");
    expect(input!.body).toBe("Hello 👋 world 🌍 :smile:");
  });

  it("4. behavioral: a raw < or > character is NOT rejected -- no markup guard exists here either", () => {
    const withAngle: FedosValidatedSessionPost = { ...BASE_POST, body: "5 > 3 and 2 < 4" };
    const input = mapValidatedSessionPostToBoardPostInput(withAngle, "board-1");
    expect(input).not.toBeNull();
    expect(input!.body).toBe("5 > 3 and 2 < 4");
  });

  it("5. behavioral: a body at exactly the max length validates; one character over is rejected by the composed boundary", () => {
    const atMax: FedosValidatedSessionPost = { ...BASE_POST, body: "x".repeat(FEDOS_BOARD_POST_MAX_BODY_LENGTH) };
    const overMax: FedosValidatedSessionPost = {
      ...BASE_POST,
      body: "x".repeat(FEDOS_BOARD_POST_MAX_BODY_LENGTH + 1),
    };
    expect(validateSessionBoardPost(atMax, "board-1")).not.toBeNull();
    expect(validateSessionBoardPost(overMax, "board-1")).toBeNull();
  });

  it("6. behavioral: empty body is rejected by the composed boundary, not special-cased by the adapter", () => {
    const empty: FedosValidatedSessionPost = { ...BASE_POST, body: "" };
    expect(validateSessionBoardPost(empty, "board-1")).toBeNull();
    expect(mapValidatedSessionPostToBoardPostInput(empty, "board-1")).not.toBeNull();
  });

  it("7. structural: no Markdown/HTML parser, no emoji-conversion function IN CODE", () => {
    expect(codeOnly(adapterModuleSource)).not.toMatch(/marked|markdown|innerHTML|DOMPurify|emojiToShortcode|convertEmoji/i);
  });

  it("8. the design doc confirms no markup guard exists, consistent with Nostr and AT Protocol", () => {
    expect(designDocSource).toMatch(/No markup guard — consistent with Nostr and AT Protocol, not\s*\nActivityPub/);
  });

  it("9. the design doc cross-references Alpha 292, Alpha 255, Alpha 263, and Alpha 285", () => {
    for (const ref of [
      "secure_runtime_alpha_292_normalized_session_post_model",
      "secure_runtime_alpha_255_canonical_board_post_model",
      "secure_runtime_alpha_263_nostr_body_mapping",
      "secure_runtime_alpha_285_atproto_body_mapping",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
