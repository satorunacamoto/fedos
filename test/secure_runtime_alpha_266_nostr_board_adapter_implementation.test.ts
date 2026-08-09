import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_266_nostr_board_adapter_implementation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterModuleSource from "../src/os/messenger/board/fedos_board_nostr_adapter.ts?raw";
import {
  validateNostrBoardPost,
  mapValidatedNostrEventToBoardPostInput,
  FEDOS_BOARD_NOSTR_SUPPORTED_KIND,
} from "../src/board/fedos_board_nostr_adapter.js";
import type { FedosValidatedNostrEvent } from "../src/desktop/fedos_validated_nostr_event.js";

const VALID_EVENT: FedosValidatedNostrEvent = {
  id: "a".repeat(64),
  pubkey: "b".repeat(64),
  created_at: 1_700_000_000,
  kind: 1,
  tags: [],
  content: "Hello board world",
  sig: "c".repeat(128),
};

/**
 * Secure Runtime Alpha 266 -- "Nostr Board Adapter Implementation":
 * Stage 6 of the Nostr Canonical Board Adapter Arc. Adds
 * src/board/fedos_board_nostr_adapter.ts, exporting
 * validateNostrBoardPost and mapValidatedNostrEventToBoardPostInput --
 * one-way, fail-closed, no mutation/storage/network.
 */
describe("Secure Runtime Alpha 266 -- Nostr Board Adapter Implementation", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. FEDOS_BOARD_NOSTR_SUPPORTED_KIND is exactly 1", () => {
    expect(FEDOS_BOARD_NOSTR_SUPPORTED_KIND).toBe(1);
  });

  it("3. behavioral: a well-formed validated event produces a real, frozen FedosBoardPost end to end", () => {
    const post = validateNostrBoardPost(VALID_EVENT, "board-general");
    expect(post).not.toBeNull();
    expect(post!.id).toBe(VALID_EVENT.id);
    expect(post!.body).toBe(VALID_EVENT.content);
    expect(post!.createdAt).toBe(VALID_EVENT.created_at);
    expect(post!.boardId).toBe("board-general");
    expect(Object.isFrozen(post)).toBe(true);
  });

  it("4. behavioral: never throws, even for wildly malformed input", () => {
    expect(() => validateNostrBoardPost(null as unknown as FedosValidatedNostrEvent, "board-1")).not.toThrow();
    expect(validateNostrBoardPost(null as unknown as FedosValidatedNostrEvent, "board-1")).toBeNull();
    expect(() => validateNostrBoardPost({} as FedosValidatedNostrEvent, "board-1")).not.toThrow();
    expect(validateNostrBoardPost({} as FedosValidatedNostrEvent, "board-1")).toBeNull();
  });

  it("5. behavioral: does not mutate the input event", () => {
    const event: FedosValidatedNostrEvent = { ...VALID_EVENT, tags: [["e", "d".repeat(64), "", "root"]] };
    const snapshot = JSON.parse(JSON.stringify(event));
    validateNostrBoardPost(event, "board-1");
    expect(JSON.parse(JSON.stringify(event))).toEqual(snapshot);
  });

  it("6. structural: no throw statement, no storage/network import anywhere in the file", () => {
    expect(adapterModuleSource).not.toMatch(/\bthrow\b/);
    expect(adapterModuleSource).not.toMatch(/from ["']\.\.\/storage\//);
    expect(adapterModuleSource).not.toMatch(/fetch\(|WebSocket|async function/);
  });

  it("7. structural: no function constructs anything Nostr-wire-shaped -- one-way only", () => {
    expect(adapterModuleSource).not.toMatch(/FedosNostrWireEvent|sig:\s*["']|buildUnsignedTextNote/);
  });

  it("8. structural: mapValidatedNostrEventToBoardPostInput composes with validateFedosBoardPost, exactly", () => {
    expect(adapterModuleSource).toMatch(
      /export function validateNostrBoardPost\([\s\S]*?\{\s*\n\s*const input = mapValidatedNostrEventToBoardPostInput\(event, boardId\);\s*\n\s*if \(input === null\) return null;\s*\n\s*return validateFedosBoardPost\(input\);\s*\n\}/,
    );
  });

  it("9. the design doc cross-references Alpha 262, Alpha 263, Alpha 264, Alpha 265, and Alpha 257", () => {
    for (const ref of [
      "secure_runtime_alpha_262_nostr_author_mapping",
      "secure_runtime_alpha_263_nostr_body_mapping",
      "secure_runtime_alpha_264_nostr_thread_mapping",
      "secure_runtime_alpha_265_nostr_source_reference",
      "secure_runtime_alpha_257_board_validation_boundary",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
