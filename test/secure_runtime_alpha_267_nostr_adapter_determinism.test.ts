import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_267_nostr_adapter_determinism.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterModuleSource from "../src/os/messenger/board/fedos_board_nostr_adapter.ts?raw";
import { validateNostrBoardPost, mapValidatedNostrEventToBoardPostInput } from "../src/board/fedos_board_nostr_adapter.js";
import type { FedosValidatedNostrEvent } from "../src/desktop/fedos_validated_nostr_event.js";

const ROOT_EVENT: FedosValidatedNostrEvent = {
  id: "a".repeat(64),
  pubkey: "b".repeat(64),
  created_at: 1_700_000_000,
  kind: 1,
  tags: [],
  content: "Hello board world",
  sig: "c".repeat(128),
};

const REPLY_EVENT: FedosValidatedNostrEvent = {
  ...ROOT_EVENT,
  id: "d".repeat(64),
  tags: [
    ["e", "e".repeat(64), "", "root"],
    ["e", "f".repeat(64), "", "reply"],
  ],
};

const POSITIONAL_EVENT: FedosValidatedNostrEvent = {
  ...ROOT_EVENT,
  id: "1".repeat(64),
  tags: [["e", "2".repeat(64)]],
};

/**
 * Secure Runtime Alpha 267 -- "Nostr Adapter Determinism Verification":
 * Stage 7 of the Nostr Canonical Board Adapter Arc. Verifies, by real
 * repeated calls, that the same event always produces the same
 * BoardPost and different event ids always produce different
 * BoardPosts.
 */
describe("Secure Runtime Alpha 267 -- Nostr Adapter Determinism Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it("2. same root event, called twice, produces deeply-equal mapping output", () => {
    const a = mapValidatedNostrEventToBoardPostInput(ROOT_EVENT, "board-1");
    const b = mapValidatedNostrEventToBoardPostInput(ROOT_EVENT, "board-1");
    expect(a).toEqual(b);
  });

  it("3. same reply event, called twice, produces deeply-equal mapping output", () => {
    const a = mapValidatedNostrEventToBoardPostInput(REPLY_EVENT, "board-1");
    const b = mapValidatedNostrEventToBoardPostInput(REPLY_EVENT, "board-1");
    expect(a).toEqual(b);
  });

  it("4. same positional-tag event, called twice, produces deeply-equal mapping output", () => {
    const a = mapValidatedNostrEventToBoardPostInput(POSITIONAL_EVENT, "board-1");
    const b = mapValidatedNostrEventToBoardPostInput(POSITIONAL_EVENT, "board-1");
    expect(a).toEqual(b);
  });

  it("5. ten consecutive calls all agree, ruling out any once-per-process memoization bug", () => {
    const results = Array.from({ length: 10 }, () => validateNostrBoardPost(REPLY_EVENT, "board-1"));
    for (const result of results) {
      expect(result).toEqual(results[0]);
    }
  });

  it("6. different event ids produce different BoardPost ids and source references", () => {
    const a = validateNostrBoardPost(ROOT_EVENT, "board-1");
    const b = validateNostrBoardPost({ ...ROOT_EVENT, id: "9".repeat(64) }, "board-1");
    expect(a!.id).not.toBe(b!.id);
    expect(a!.source.reference).not.toBe(b!.source.reference);
  });

  it("7. different pubkeys produce different author.publicIdentifier; different content produces different body", () => {
    const a = validateNostrBoardPost(ROOT_EVENT, "board-1");
    const b = validateNostrBoardPost({ ...ROOT_EVENT, pubkey: "9".repeat(64) }, "board-1");
    const c = validateNostrBoardPost({ ...ROOT_EVENT, content: "a different message" }, "board-1");
    expect(a!.author.publicIdentifier).not.toBe(b!.author.publicIdentifier);
    expect(a!.body).not.toBe(c!.body);
  });

  it("8. structural: no Math.random/Date.now/new Date/crypto.getRandomValues anywhere in the adapter", () => {
    expect(adapterModuleSource).not.toMatch(/Math\.random|Date\.now|new Date|crypto\.getRandomValues/);
  });

  it("9. the design doc cross-references Alpha 266 and Alpha 257", () => {
    for (const ref of [
      "secure_runtime_alpha_266_nostr_board_adapter_implementation",
      "secure_runtime_alpha_257_board_validation_boundary",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
