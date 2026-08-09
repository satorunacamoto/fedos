import { describe, it, expect } from "vitest";
import { ingestRawEvents, dedupeById } from "../src/os/_legacy_prototype/ingest/ingest.js";
import {
  InMemoryRelayAdapter,
  eventMatchesFilter,
} from "../src/nostr/relay.js";
import type { NostrEvent } from "../src/nostr/types.js";

const HEX64 = "a".repeat(64);
const HEX128 = "b".repeat(128);

function makeEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: "1".repeat(64),
    pubkey: HEX64,
    created_at: 1700000000,
    kind: 1,
    tags: [],
    content: "note",
    sig: HEX128,
    ...overrides,
  };
}

const CTX = { relayUrl: "wss://relay.test", now: 1700000001000 };

describe("ingestRawEvents", () => {
  it("accepts valid events and annotates relay + timestamp", () => {
    const event = makeEvent();
    const result = ingestRawEvents([event], CTX);

    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0]?.event).toEqual(event);
    expect(result.accepted[0]?.relayUrl).toBe("wss://relay.test");
    expect(result.accepted[0]?.ingestedAt).toBe(1700000001000);
    expect(result.rejected).toHaveLength(0);
    expect(result.duplicates).toBe(0);
  });

  it("separates structurally-invalid values into rejected", () => {
    const result = ingestRawEvents([makeEvent(), { not: "an event" }, 99], CTX);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(2);
    expect(result.rejected[0]?.issues.length).toBeGreaterThan(0);
  });

  it("drops duplicates within the same batch", () => {
    const a = makeEvent({ id: "a".repeat(64) });
    const dup = makeEvent({ id: "a".repeat(64), content: "later copy" });
    const b = makeEvent({ id: "2".repeat(64) });

    const result = ingestRawEvents([a, dup, b], CTX);
    expect(result.accepted).toHaveLength(2);
    expect(result.duplicates).toBe(1);
  });

  it("treats events already in seenIds as duplicates", () => {
    const event = makeEvent({ id: "3".repeat(64) });
    const result = ingestRawEvents([event], {
      ...CTX,
      seenIds: new Set(["3".repeat(64)]),
    });
    expect(result.accepted).toHaveLength(0);
    expect(result.duplicates).toBe(1);
  });

  it("is deterministic (pure)", () => {
    const batch = [makeEvent({ id: "4".repeat(64) }), { bad: true }];
    expect(ingestRawEvents(batch, CTX)).toEqual(ingestRawEvents(batch, CTX));
  });
});

describe("dedupeById", () => {
  it("keeps the first occurrence of each id", () => {
    const first = makeEvent({ id: "a".repeat(64), content: "first" });
    const second = makeEvent({ id: "a".repeat(64), content: "second" });
    const out = dedupeById([first, second]);
    expect(out).toHaveLength(1);
    expect(out[0]?.content).toBe("first");
  });
});

describe("relay filtering", () => {
  it("matches by kind, author and #e tag", () => {
    const event = makeEvent({
      kind: 1,
      pubkey: "d".repeat(64),
      tags: [["e", "e".repeat(64)]],
    });
    expect(eventMatchesFilter(event, { kinds: [1] })).toBe(true);
    expect(eventMatchesFilter(event, { kinds: [0] })).toBe(false);
    expect(eventMatchesFilter(event, { authors: ["d".repeat(64)] })).toBe(true);
    expect(eventMatchesFilter(event, { "#e": ["e".repeat(64)] })).toBe(true);
    expect(eventMatchesFilter(event, { "#e": ["f".repeat(64)] })).toBe(false);
  });

  it("respects since/until bounds", () => {
    const event = makeEvent({ created_at: 1000 });
    expect(eventMatchesFilter(event, { since: 999, until: 1001 })).toBe(true);
    expect(eventMatchesFilter(event, { since: 1001 })).toBe(false);
    expect(eventMatchesFilter(event, { until: 999 })).toBe(false);
  });
});

describe("InMemoryRelayAdapter", () => {
  it("returns matching events newest-first and honors limit", async () => {
    const older = makeEvent({ id: "1".repeat(64), created_at: 100 });
    const newer = makeEvent({ id: "2".repeat(64), created_at: 200 });
    const adapter = new InMemoryRelayAdapter("wss://relay.test", [older, newer]);

    const all = await adapter.query([{ kinds: [1] }]);
    expect(all.map((e) => e.id)).toEqual(["2".repeat(64), "1".repeat(64)]);

    const limited = await adapter.query([{ kinds: [1], limit: 1 }]);
    expect(limited).toHaveLength(1);
    expect(limited[0]?.id).toBe("2".repeat(64));
  });

  it("returns everything for an empty filter list", async () => {
    const adapter = new InMemoryRelayAdapter("wss://relay.test", [makeEvent()]);
    expect(await adapter.query([])).toHaveLength(1);
  });
});
