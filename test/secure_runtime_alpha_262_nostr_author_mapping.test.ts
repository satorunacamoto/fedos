import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_262_nostr_author_mapping.md?raw";
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

const ROOT_EVENT: FedosValidatedNostrEvent = {
  id: "a".repeat(64),
  pubkey: "b".repeat(64),
  created_at: 1_700_000_000,
  kind: 1,
  tags: [],
  content: "Hello board world",
  sig: "c".repeat(128),
};

/**
 * Secure Runtime Alpha 262 -- "Nostr Author Mapping": Stage 2 of the
 * Nostr Canonical Board Adapter Arc. A design-decision Stage backed by
 * behavioral tests of mapValidatedNostrEventToBoardPostInput's author
 * branch (Alpha 266) -- pubkey -> publicIdentifier verbatim,
 * identityId always null, no display name, no profile resolution.
 */
describe("Secure Runtime Alpha 262 -- Nostr Author Mapping", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. behavioral: pubkey is copied verbatim into publicIdentifier, no re-encoding", () => {
    const input = mapValidatedNostrEventToBoardPostInput(ROOT_EVENT, "board-1");
    expect(input).not.toBeNull();
    expect(input!.author.publicIdentifier).toBe(ROOT_EVENT.pubkey);
    expect(input!.author.publicIdentifier).not.toMatch(/^npub1/);
  });

  it("3. behavioral: identityId is always null", () => {
    const input = mapValidatedNostrEventToBoardPostInput(ROOT_EVENT, "board-1");
    expect(input!.author.identityId).toBeNull();
  });

  it("4. behavioral: protocol is always the fixed literal 'nostr', never read from the event", () => {
    const input = mapValidatedNostrEventToBoardPostInput(ROOT_EVENT, "board-1");
    expect(input!.author.protocol).toBe("nostr");
  });

  it("5. structural: no displayName/avatar/profile derivation exists IN CODE", () => {
    expect(codeOnly(adapterModuleSource)).not.toMatch(/displayName|avatar|profile/i);
  });

  it("6. structural: no relay/fetch/network access anywhere in the adapter, IN CODE", () => {
    expect(codeOnly(adapterModuleSource)).not.toMatch(/fetch\(|WebSocket|Relay|Subscription/);
  });

  it("7. behavioral: a different pubkey produces a different publicIdentifier, all else equal", () => {
    const other: FedosValidatedNostrEvent = { ...ROOT_EVENT, pubkey: "d".repeat(64) };
    const inputA = mapValidatedNostrEventToBoardPostInput(ROOT_EVENT, "board-1");
    const inputB = mapValidatedNostrEventToBoardPostInput(other, "board-1");
    expect(inputA!.author.publicIdentifier).not.toBe(inputB!.author.publicIdentifier);
  });

  it("8. the design doc cross-references Alpha 261, Alpha 254, and Alpha 266", () => {
    for (const ref of [
      "secure_runtime_alpha_261_nostr_board_field_inventory",
      "secure_runtime_alpha_254_canonical_board_author",
      "secure_runtime_alpha_266_nostr_board_adapter_implementation",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
