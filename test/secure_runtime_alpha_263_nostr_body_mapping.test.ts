import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_263_nostr_body_mapping.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterModuleSource from "../src/board/fedos_board_nostr_adapter.ts?raw";
import { mapValidatedNostrEventToBoardPostInput, validateNostrBoardPost } from "../src/board/fedos_board_nostr_adapter.js";
import { FEDOS_BOARD_POST_MAX_BODY_LENGTH } from "../src/board/fedos_board_post_validator.js";
import type { FedosValidatedNostrEvent } from "../src/desktop/fedos_validated_nostr_event.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

const BASE_EVENT: FedosValidatedNostrEvent = {
  id: "a".repeat(64),
  pubkey: "b".repeat(64),
  created_at: 1_700_000_000,
  kind: 1,
  tags: [],
  content: "Hello board world",
  sig: "c".repeat(128),
};

/**
 * Secure Runtime Alpha 263 -- "Nostr Body Mapping": Stage 3 of the
 * Nostr Canonical Board Adapter Arc. A design-decision Stage backed by
 * behavioral tests -- content -> body verbatim, no transformation, no
 * adapter-local truncation.
 */
describe("Secure Runtime Alpha 263 -- Nostr Body Mapping", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it("2. behavioral: content is copied verbatim into body, including internal whitespace", () => {
    const event: FedosValidatedNostrEvent = { ...BASE_EVENT, content: "  Hello   board\nworld  " };
    const input = mapValidatedNostrEventToBoardPostInput(event, "board-1");
    expect(input!.body).toBe("  Hello   board\nworld  ");
  });

  it("3. behavioral: a body at exactly the max length validates; one character over is rejected by the composed boundary", () => {
    const atMax: FedosValidatedNostrEvent = { ...BASE_EVENT, content: "x".repeat(FEDOS_BOARD_POST_MAX_BODY_LENGTH) };
    const overMax: FedosValidatedNostrEvent = {
      ...BASE_EVENT,
      content: "x".repeat(FEDOS_BOARD_POST_MAX_BODY_LENGTH + 1),
    };
    expect(validateNostrBoardPost(atMax, "board-1")).not.toBeNull();
    expect(validateNostrBoardPost(overMax, "board-1")).toBeNull();
  });

  it("4. behavioral: empty content is rejected by the composed boundary, not special-cased by the adapter", () => {
    const empty: FedosValidatedNostrEvent = { ...BASE_EVENT, content: "" };
    expect(validateNostrBoardPost(empty, "board-1")).toBeNull();
    // The mapping step itself still succeeds (content is a valid string type) --
    // it is validateFedosBoardPost's own non-empty-body rule that rejects it.
    expect(mapValidatedNostrEventToBoardPostInput(empty, "board-1")).not.toBeNull();
  });

  it("5. structural: no Markdown/HTML parser or renderer, no trim/normalize call, IN CODE", () => {
    expect(codeOnly(adapterModuleSource)).not.toMatch(
      /marked|markdown|innerHTML|DOMPurify|sanitize|\.trim\(\)|normalize\(/i,
    );
  });

  it("6. the design doc names the 10,000-character ceiling as an honest, named limitation", () => {
    expect(designDocSource).toMatch(/10,000-character\s+ceiling/);
  });

  it("7. the design doc cross-references Alpha 261, Alpha 255, and Alpha 257", () => {
    for (const ref of [
      "secure_runtime_alpha_261_nostr_board_field_inventory",
      "secure_runtime_alpha_255_canonical_board_post_model",
      "secure_runtime_alpha_257_board_validation_boundary",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
