import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_257_board_validation_boundary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import validatorModuleSource from "../src/os/messenger/board/fedos_board_post_validator.ts?raw";
import {
  validateFedosBoardPost,
  FEDOS_BOARD_POST_MAX_BODY_LENGTH,
  FEDOS_BOARD_POST_MIN_CREATED_AT,
  FEDOS_BOARD_POST_MAX_CREATED_AT,
  type FedosBoardPostInput,
} from "../src/os/messenger/board/fedos_board_post_validator.js";

const VALID: FedosBoardPostInput = {
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
 * Secure Runtime Alpha 257 -- "Canonical Board Validation Boundary":
 * Stage 7 of the Canonical Board Model Foundation Arc. Adds
 * src/board/fedos_board_post_validator.ts, exporting
 * validateFedosBoardPost -- a typed builder ("Option B"), fail-closed,
 * no exception, deep-copy + freeze.
 */
describe("Secure Runtime Alpha 257 -- Canonical Board Validation Boundary", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc adopts Option B (typed builder), not Option A/C", () => {
    expect(designDocSource).toMatch(/\*\*Adopted: Option B\*\*/);
  });

  it("3. accepts a well-formed input and rejects a malformed one, in the SAME call shape", () => {
    expect(validateFedosBoardPost(VALID)).not.toBeNull();
    expect(validateFedosBoardPost({ ...VALID, id: "" })).toBeNull();
  });

  it("4. fails closed on every empty/missing id field", () => {
    expect(validateFedosBoardPost({ ...VALID, id: "" })).toBeNull();
    expect(validateFedosBoardPost({ ...VALID, id: "   " })).toBeNull();
    expect(validateFedosBoardPost({ ...VALID, boardId: "" })).toBeNull();
    expect(validateFedosBoardPost({ ...VALID, threadId: "" })).toBeNull();
  });

  it("5. fails closed on a self-reply", () => {
    expect(validateFedosBoardPost({ ...VALID, replyTo: VALID.id })).toBeNull();
  });

  it("6. fails closed on an empty or oversized body", () => {
    expect(validateFedosBoardPost({ ...VALID, body: "" })).toBeNull();
    expect(validateFedosBoardPost({ ...VALID, body: "x".repeat(FEDOS_BOARD_POST_MAX_BODY_LENGTH) })).not.toBeNull();
    expect(
      validateFedosBoardPost({ ...VALID, body: "x".repeat(FEDOS_BOARD_POST_MAX_BODY_LENGTH + 1) }),
    ).toBeNull();
  });

  it("7. fails closed on a createdAt outside the valid domain, including an accidental-milliseconds value", () => {
    expect(validateFedosBoardPost({ ...VALID, createdAt: FEDOS_BOARD_POST_MIN_CREATED_AT - 1 })).toBeNull();
    expect(validateFedosBoardPost({ ...VALID, createdAt: FEDOS_BOARD_POST_MAX_CREATED_AT + 1 })).toBeNull();
    expect(validateFedosBoardPost({ ...VALID, createdAt: 1.5 })).toBeNull();
    expect(validateFedosBoardPost({ ...VALID, createdAt: Number.NaN })).toBeNull();
    // A millisecond timestamp for "now" is ~1_752_000_000_000 -- far above the seconds ceiling.
    expect(validateFedosBoardPost({ ...VALID, createdAt: 1_752_000_000_000 })).toBeNull();
  });

  it("8. fails closed on an unknown source/author protocol", () => {
    expect(
      validateFedosBoardPost({ ...VALID, source: { protocol: "bluesky", reference: "x" } }),
    ).toBeNull();
    expect(
      validateFedosBoardPost({
        ...VALID,
        author: { identityId: null, protocol: "bluesky", publicIdentifier: "x" },
      }),
    ).toBeNull();
  });

  it("9. fails closed on an empty publicIdentifier or source reference", () => {
    expect(
      validateFedosBoardPost({
        ...VALID,
        author: { identityId: null, protocol: "nostr", publicIdentifier: "" },
      }),
    ).toBeNull();
    expect(validateFedosBoardPost({ ...VALID, source: { protocol: "nostr", reference: "" } })).toBeNull();
  });

  it("10. never throws, even for a completely empty object cast to the input type", () => {
    expect(() => validateFedosBoardPost({} as FedosBoardPostInput)).not.toThrow();
    expect(validateFedosBoardPost({} as FedosBoardPostInput)).toBeNull();
  });

  it("11. deep-copies nested author/source -- mutating the input object after validation does not affect the result", () => {
    const input: FedosBoardPostInput = {
      ...VALID,
      author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
      source: { protocol: "nostr", reference: "abcdef0123456789" },
    };
    const post = validateFedosBoardPost(input);
    expect(post).not.toBeNull();
    (input.author as { publicIdentifier: string }).publicIdentifier = "mutated";
    expect(post!.author.publicIdentifier).toBe("npub1example");
  });

  it("12. freezes the output, including nested author/source", () => {
    const post = validateFedosBoardPost(VALID);
    expect(post).not.toBeNull();
    expect(Object.isFrozen(post)).toBe(true);
    expect(Object.isFrozen(post!.author)).toBe(true);
    expect(Object.isFrozen(post!.source)).toBe(true);
  });

  it("13. structural: no throw statement, no cryptographic/network/storage import anywhere in this file", () => {
    expect(validatorModuleSource).not.toMatch(/\bthrow\b/);
    expect(validatorModuleSource).not.toMatch(/from ["']\.\.\/nostr\/|from ["']\.\.\/desktop\/|from ["']\.\.\/crypto\/|from ["']\.\.\/storage\//);
    expect(validatorModuleSource).not.toMatch(/fetch\(|WebSocket|async function/);
  });

  it("14. the design doc cross-references Alpha 255, Alpha 256, and Alpha 245", () => {
    for (const ref of [
      "secure_runtime_alpha_255_canonical_board_post_model",
      "secure_runtime_alpha_256_thread_reply_semantics",
      "secure_runtime_alpha_245_combined_inbound_event_validator",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
