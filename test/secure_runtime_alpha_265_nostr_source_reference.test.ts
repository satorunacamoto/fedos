import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_265_nostr_source_reference.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterModuleSource from "../src/board/fedos_board_nostr_adapter.ts?raw";
import { mapValidatedNostrEventToBoardPostInput } from "../src/board/fedos_board_nostr_adapter.js";
import type { FedosValidatedNostrEvent } from "../src/desktop/fedos_validated_nostr_event.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

const EVENT: FedosValidatedNostrEvent = {
  id: "a".repeat(64),
  pubkey: "b".repeat(64),
  created_at: 1_700_000_000,
  kind: 1,
  tags: [],
  content: "Hello board world",
  sig: "c".repeat(128),
};

/**
 * Secure Runtime Alpha 265 -- "Nostr Source Reference": Stage 5 of the
 * Nostr Canonical Board Adapter Arc. A design-decision Stage backed by
 * behavioral tests -- event.id -> source.reference, fixed "nostr"
 * protocol, no relay URL/connection state, boardId caller-supplied.
 */
describe("Secure Runtime Alpha 265 -- Nostr Source Reference", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it("2. behavioral: source.reference is the event id verbatim, source.protocol is the fixed literal 'nostr'", () => {
    const input = mapValidatedNostrEventToBoardPostInput(EVENT, "board-1");
    expect(input!.source).toEqual({ protocol: "nostr", reference: EVENT.id });
  });

  it("3. behavioral: boardId is passed through verbatim, never derived from the event", () => {
    const inputA = mapValidatedNostrEventToBoardPostInput(EVENT, "board-alpha");
    const inputB = mapValidatedNostrEventToBoardPostInput(EVENT, "board-beta");
    expect(inputA!.boardId).toBe("board-alpha");
    expect(inputB!.boardId).toBe("board-beta");
  });

  it("4. behavioral: an empty boardId is rejected", () => {
    expect(mapValidatedNostrEventToBoardPostInput(EVENT, "")).toBeNull();
  });

  it("5. structural: no relay URL, connection state, or transport metadata field anywhere IN CODE", () => {
    expect(codeOnly(adapterModuleSource)).not.toMatch(/relayUrl|relay_url|connectionState|subscriptionId/i);
  });

  it("6. the design doc confirms no relay URL, connection state, or transport metadata", () => {
    expect(designDocSource).toMatch(/\*\*No relay URL\.\*\*/);
    expect(designDocSource).toMatch(/\*\*No connection state\.\*\*/);
    expect(designDocSource).toMatch(/\*\*No transport metadata\.\*\*/);
  });

  it("7. the design doc cross-references Alpha 261, Alpha 253, and Alpha 259", () => {
    for (const ref of [
      "secure_runtime_alpha_261_nostr_board_field_inventory",
      "secure_runtime_alpha_253_board_source_provenance",
      "secure_runtime_alpha_259_protocol_neutrality_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
