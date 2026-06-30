import { describe, it, expect } from "vitest";
import {
  validateEventStructure,
  isNostrEvent,
  serializeForId,
  computeEventId,
  verifyEventId,
} from "../src/nostr/event.js";
import { webCryptoSha256Hex } from "../src/nostr/crypto.js";
import type { NostrEvent, EventCore } from "../src/nostr/types.js";

const HEX64 = "a".repeat(64);
const HEX128 = "b".repeat(128);

const core: EventCore = {
  pubkey: HEX64,
  created_at: 1700000000,
  kind: 1,
  tags: [["e", "f".repeat(64), "", "reply"]],
  content: "hello nostr",
};

/** Builds a structurally-valid event whose id is the real sha256 of its core. */
async function buildValidEvent(): Promise<NostrEvent> {
  const id = await computeEventId(core, webCryptoSha256Hex);
  return { ...core, id, sig: HEX128 };
}

describe("validateEventStructure", () => {
  it("accepts a well-formed event", async () => {
    const event = await buildValidEvent();
    expect(validateEventStructure(event)).toEqual([]);
    expect(isNostrEvent(event)).toBe(true);
  });

  it("rejects non-objects", () => {
    expect(validateEventStructure(null)[0]?.field).toBe("<root>");
    expect(validateEventStructure(42).length).toBeGreaterThan(0);
    expect(validateEventStructure([])[0]?.field).toBe("<root>");
  });

  it("flags each malformed field", () => {
    const issues = validateEventStructure({
      id: "tooshort",
      pubkey: "XYZ",
      created_at: -1,
      kind: 1.5,
      tags: [["e", 123]],
      content: 42,
      sig: "nothex",
    });
    const fields = issues.map((i) => i.field).sort();
    expect(fields).toEqual(
      ["content", "created_at", "id", "kind", "pubkey", "sig", "tags"].sort(),
    );
  });

  it("rejects uppercase hex in id/pubkey (NIP-01 requires lowercase)", () => {
    const fields = validateEventStructure({
      id: "A".repeat(64),
      pubkey: HEX64,
      created_at: 1,
      kind: 1,
      tags: [],
      content: "",
      sig: HEX128,
    }).map((i) => i.field);
    expect(fields).toContain("id");
  });
});

describe("serializeForId", () => {
  it("produces the canonical [0,pubkey,created_at,kind,tags,content] form", () => {
    expect(serializeForId(core)).toBe(
      JSON.stringify([
        0,
        core.pubkey,
        core.created_at,
        core.kind,
        core.tags,
        core.content,
      ]),
    );
  });

  it("emits no insignificant whitespace", () => {
    expect(serializeForId(core)).not.toMatch(/\n|\t|, /);
  });
});

describe("verifyEventId", () => {
  it("accepts an event whose id matches its serialization", async () => {
    const event = await buildValidEvent();
    expect(await verifyEventId(event, webCryptoSha256Hex)).toBe(true);
  });

  it("rejects an event with a tampered id", async () => {
    const event = await buildValidEvent();
    const tampered: NostrEvent = { ...event, id: "c".repeat(64) };
    expect(await verifyEventId(tampered, webCryptoSha256Hex)).toBe(false);
  });

  it("rejects when content was changed after id was computed", async () => {
    const event = await buildValidEvent();
    const tampered: NostrEvent = { ...event, content: "tampered" };
    expect(await verifyEventId(tampered, webCryptoSha256Hex)).toBe(false);
  });
});
