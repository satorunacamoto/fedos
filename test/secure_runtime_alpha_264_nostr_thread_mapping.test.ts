import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_264_nostr_thread_mapping.md?raw";
import { mapValidatedNostrEventToBoardPostInput } from "../src/os/messenger/board/fedos_board_nostr_adapter.js";
import type { FedosValidatedNostrEvent } from "../src/os/messenger/desktop/fedos_validated_nostr_event.js";

const ROOT_ID = "a".repeat(64);
const PARENT_ID = "b".repeat(64);
const PUBKEY = "c".repeat(64);
const SIG = "d".repeat(128);

const BASE_EVENT: FedosValidatedNostrEvent = {
  id: "e".repeat(64),
  pubkey: PUBKEY,
  created_at: 1_700_000_000,
  kind: 1,
  tags: [],
  content: "Hello board world",
  sig: SIG,
};

/**
 * Secure Runtime Alpha 264 -- "Nostr Thread Mapping": Stage 4 of the
 * Nostr Canonical Board Adapter Arc. A design-decision Stage backed by
 * behavioral tests over resolveNostrThreadRefs/mapValidatedNostrEventToBoardPostInput
 * (Alpha 266) -- mirrors src/thread/thread.ts's own NIP-10 resolution
 * rule exactly, scoped to kind 1 only.
 */
describe("Secure Runtime Alpha 264 -- Nostr Thread Mapping", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: an event with no e tags is its own thread root", () => {
    const event: FedosValidatedNostrEvent = { ...BASE_EVENT, tags: [] };
    const input = mapValidatedNostrEventToBoardPostInput(event, "board-1");
    expect(input!.replyTo).toBeNull();
    expect(input!.threadId).toBe(event.id);
  });

  it("3. behavioral: marked root+reply tags resolve threadId=root, replyTo=reply", () => {
    const event: FedosValidatedNostrEvent = {
      ...BASE_EVENT,
      tags: [
        ["e", ROOT_ID, "", "root"],
        ["e", PARENT_ID, "", "reply"],
      ],
    };
    const input = mapValidatedNostrEventToBoardPostInput(event, "board-1");
    expect(input!.threadId).toBe(ROOT_ID);
    expect(input!.replyTo).toBe(PARENT_ID);
  });

  it("4. behavioral: deprecated positional form -- a single e tag is both root and reply", () => {
    const event: FedosValidatedNostrEvent = { ...BASE_EVENT, tags: [["e", ROOT_ID]] };
    const input = mapValidatedNostrEventToBoardPostInput(event, "board-1");
    expect(input!.threadId).toBe(ROOT_ID);
    expect(input!.replyTo).toBe(ROOT_ID);
  });

  it("5. behavioral: deprecated positional form -- multiple e tags, first is root, last is reply", () => {
    const middleId = "f".repeat(64);
    const event: FedosValidatedNostrEvent = {
      ...BASE_EVENT,
      tags: [["e", ROOT_ID], ["e", middleId], ["e", PARENT_ID]],
    };
    const input = mapValidatedNostrEventToBoardPostInput(event, "board-1");
    expect(input!.threadId).toBe(ROOT_ID);
    expect(input!.replyTo).toBe(PARENT_ID);
  });

  it("6. behavioral: a root-marked tag with no reply-marked tag -- deferred boundary, event becomes its own root", () => {
    const event: FedosValidatedNostrEvent = { ...BASE_EVENT, tags: [["e", ROOT_ID, "", "root"]] };
    const input = mapValidatedNostrEventToBoardPostInput(event, "board-1");
    expect(input!.replyTo).toBeNull();
    expect(input!.threadId).toBe(event.id);
  });

  it("7. behavioral: a reply-marked tag with no root-marked tag -- deferred boundary, threadId falls back to the parent", () => {
    const event: FedosValidatedNostrEvent = { ...BASE_EVENT, tags: [["e", PARENT_ID, "", "reply"]] };
    const input = mapValidatedNostrEventToBoardPostInput(event, "board-1");
    expect(input!.replyTo).toBe(PARENT_ID);
    expect(input!.threadId).toBe(PARENT_ID);
  });

  it("8. behavioral: a malformed e tag (non-64-hex id) is silently dropped, event still processed as root", () => {
    const event: FedosValidatedNostrEvent = { ...BASE_EVENT, tags: [["e", "not-a-valid-hex-id"]] };
    const input = mapValidatedNostrEventToBoardPostInput(event, "board-1");
    expect(input).not.toBeNull();
    expect(input!.replyTo).toBeNull();
    expect(input!.threadId).toBe(event.id);
  });

  it("9. behavioral: non-e tags (e.g. p tags) are ignored entirely", () => {
    const event: FedosValidatedNostrEvent = {
      ...BASE_EVENT,
      tags: [["p", PUBKEY], ["e", ROOT_ID, "", "root"], ["e", PARENT_ID, "", "reply"]],
    };
    const input = mapValidatedNostrEventToBoardPostInput(event, "board-1");
    expect(input!.threadId).toBe(ROOT_ID);
    expect(input!.replyTo).toBe(PARENT_ID);
  });

  it("10. behavioral: only kind 1 is accepted -- any other kind is rejected outright", () => {
    const kind0: FedosValidatedNostrEvent = { ...BASE_EVENT, kind: 0 };
    const kind7: FedosValidatedNostrEvent = { ...BASE_EVENT, kind: 7 };
    expect(mapValidatedNostrEventToBoardPostInput(kind0, "board-1")).toBeNull();
    expect(mapValidatedNostrEventToBoardPostInput(kind7, "board-1")).toBeNull();
  });

  it("11. the design doc names both deferred-boundary cases explicitly", () => {
    expect(designDocSource).toMatch(/A `"root"`-marked tag with no `"reply"`-marked tag/);
    expect(designDocSource).toMatch(/A `"reply"`-marked tag with no `"root"`-marked tag/);
  });

  it("12. the design doc cross-references Alpha 261, Alpha 256, and Alpha 266", () => {
    for (const ref of [
      "secure_runtime_alpha_261_nostr_board_field_inventory",
      "secure_runtime_alpha_256_thread_reply_semantics",
      "secure_runtime_alpha_266_nostr_board_adapter_implementation",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
