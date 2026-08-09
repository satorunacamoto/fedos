import { describe, it, expect } from "vitest";
import {
  queryThreads,
  scoreThread,
  countDescendants,
  filterThread,
  MAX_LIMIT,
} from "../src/os/_legacy_prototype/query/thread_query.js";
import { buildThreads } from "../src/os/_legacy_prototype/thread/thread.js";
import type { NostrEvent, NostrTag } from "../src/nostr/types.js";
import type { IngestedEvent } from "../src/os/_legacy_prototype/ingest/types.js";
import type { ThreadBuildResult } from "../src/os/_legacy_prototype/thread/types.js";

const SIG = "0".repeat(128);

/** Encodes a (possibly non-hex) label into a valid 64-char hex string. */
function hexLabel(label: string, pad: string): string {
  const hex = Array.from(label, (c) =>
    c.charCodeAt(0).toString(16).padStart(2, "0"),
  ).join("");
  return (hex + pad.repeat(64)).slice(0, 64);
}

function id(label: string): string {
  return hexLabel(label, "0");
}

function pub(label: string): string {
  return hexLabel(label, "f");
}

function ingest(
  label: string,
  opts: {
    pubkey?: string;
    content?: string;
    created_at?: number;
    tags?: NostrTag[];
  } = {},
): IngestedEvent {
  const event: NostrEvent = {
    id: id(label),
    pubkey: opts.pubkey ?? pub("a"),
    created_at: opts.created_at ?? 1000,
    kind: 1,
    tags: opts.tags ?? [],
    content: opts.content ?? `content-${label}`,
    sig: SIG,
  };
  return { event, relayUrl: "wss://relay.test", ingestedAt: 1700000000000 };
}

function reply(label: string, parent: string, opts: Parameters<typeof ingest>[1] = {}) {
  return ingest(label, { ...opts, tags: [["e", id(parent), "", "reply"]] });
}

/** root r1 (created 100), root r2 (created 200, +2 replies), root r3 (created 300). */
function sampleResult(): ThreadBuildResult {
  return buildThreads([
    ingest("r1", { created_at: 100 }),
    ingest("r2", { created_at: 200 }),
    reply("a", "r2", { created_at: 210 }),
    reply("b", "r2", { created_at: 220 }),
    ingest("r3", { created_at: 300 }),
  ]);
}

describe("countDescendants", () => {
  it("counts all nested descendants", () => {
    const res = buildThreads([
      ingest("r", { created_at: 1 }),
      reply("a", "r", { created_at: 2 }),
      reply("b", "a", { created_at: 3 }),
    ]);
    expect(countDescendants(res.roots[0]!)).toBe(2);
  });
});

describe("queryThreads sort", () => {
  it("1. new: root created_at DESC", () => {
    const r = queryThreads(sampleResult(), { sort: "new" });
    expect(r.roots.map((n) => n.event.id)).toEqual([id("r3"), id("r2"), id("r1")]);
  });

  it("2. old: root created_at ASC", () => {
    const r = queryThreads(sampleResult(), { sort: "old" });
    expect(r.roots.map((n) => n.event.id)).toEqual([id("r1"), id("r2"), id("r3")]);
  });

  it("3. top: descendant count DESC (r2 has replies)", () => {
    const r = queryThreads(sampleResult(), { sort: "top" });
    expect(r.roots[0]?.event.id).toBe(id("r2"));
  });

  it("4. hot: scoreThread DESC, deterministic", () => {
    const a = queryThreads(sampleResult(), { sort: "hot" });
    const b = queryThreads(sampleResult(), { sort: "hot" });
    expect(a.roots.map((n) => n.event.id)).toEqual(b.roots.map((n) => n.event.id));
    expect(a.roots[0]?.event.id).toBe(id("r2")); // most engaged
  });

  it("top/hot tie-break falls to created_at DESC then id ASC", () => {
    // r1 and r3 both have 0 descendants -> tie -> created_at DESC: r3 before r1.
    const r = queryThreads(sampleResult(), { sort: "top" });
    const ids = r.roots.map((n) => n.event.id);
    expect(ids.indexOf(id("r3"))).toBeLessThan(ids.indexOf(id("r1")));
  });
});

describe("scoreThread", () => {
  it("is higher for more engaged threads", () => {
    const res = sampleResult();
    const r2 = res.nodesById.get(id("r2"))!;
    const r1 = res.nodesById.get(id("r1"))!;
    expect(scoreThread(r2)).toBeGreaterThan(scoreThread(r1));
  });
});

describe("queryThreads filters", () => {
  it("6. author filter keeps threads where any node matches", () => {
    const res = buildThreads([
      ingest("r1", { created_at: 100, pubkey: pub("x") }),
      ingest("r2", { created_at: 200, pubkey: pub("y") }),
      reply("a", "r2", { created_at: 210, pubkey: pub("z") }),
    ]);
    // Author z only appears as a reply inside r2's thread.
    const r = queryThreads(res, { authorPubkey: pub("z") });
    expect(r.roots.map((n) => n.event.id)).toEqual([id("r2")]);
  });

  it("7. text search matches root content", () => {
    const res = buildThreads([
      ingest("r1", { created_at: 100, content: "hello WORLD" }),
      ingest("r2", { created_at: 200, content: "nothing here" }),
    ]);
    const r = queryThreads(res, { text: "world" }); // case-insensitive
    expect(r.roots.map((n) => n.event.id)).toEqual([id("r1")]);
  });

  it("8. text search matches descendant content", () => {
    const res = buildThreads([
      ingest("r1", { created_at: 100, content: "root" }),
      reply("a", "r1", { created_at: 110, content: "buried treasure" }),
      ingest("r2", { created_at: 200, content: "unrelated" }),
    ]);
    const r = queryThreads(res, { text: "treasure" });
    expect(r.roots.map((n) => n.event.id)).toEqual([id("r1")]);
  });

  it("9. minReplies filters by descendant count", () => {
    const r = queryThreads(sampleResult(), { minReplies: 1 });
    expect(r.roots.map((n) => n.event.id)).toEqual([id("r2")]);
  });

  it("10. since/until filter on root created_at", () => {
    const since = queryThreads(sampleResult(), { since: 200, sort: "old" });
    expect(since.roots.map((n) => n.event.id)).toEqual([id("r2"), id("r3")]);

    const until = queryThreads(sampleResult(), { until: 200, sort: "old" });
    expect(until.roots.map((n) => n.event.id)).toEqual([id("r1"), id("r2")]);
  });
});

describe("queryThreads pagination", () => {
  it("11. limit/offset/hasMore/total", () => {
    const r = queryThreads(sampleResult(), { sort: "old", limit: 2, offset: 0 });
    expect(r.total).toBe(3);
    expect(r.roots.map((n) => n.event.id)).toEqual([id("r1"), id("r2")]);
    expect(r.hasMore).toBe(true);

    const page2 = queryThreads(sampleResult(), { sort: "old", limit: 2, offset: 2 });
    expect(page2.roots.map((n) => n.event.id)).toEqual([id("r3")]);
    expect(page2.hasMore).toBe(false);
  });

  it("offset beyond total yields empty page, hasMore false", () => {
    const r = queryThreads(sampleResult(), { offset: 99 });
    expect(r.roots).toHaveLength(0);
    expect(r.hasMore).toBe(false);
    expect(r.total).toBe(3);
  });

  it("12. limit is clamped to MAX_LIMIT", () => {
    const r = queryThreads(sampleResult(), { limit: 9999 });
    expect(r.limit).toBe(MAX_LIMIT);
  });
});

describe("queryThreads invalid options fallback", () => {
  it("13. invalid sort/limit/offset/minReplies fall back to safe defaults", () => {
    const r = queryThreads(sampleResult(), {
      sort: "sideways" as never,
      limit: -5,
      offset: -10,
      minReplies: -1,
      since: Number.NaN,
    });
    expect(r.sort).toBe("new");
    expect(r.limit).toBe(20); // default
    expect(r.offset).toBe(0);
    expect(r.options.minReplies).toBe(0);
    expect(r.options.since).toBeUndefined();
    expect(r.total).toBe(3); // since=NaN ignored, nothing filtered out
  });

  it("empty options return all roots in default (new) order", () => {
    const r = queryThreads(sampleResult());
    expect(r.sort).toBe("new");
    expect(r.roots.map((n) => n.event.id)).toEqual([id("r3"), id("r2"), id("r1")]);
  });
});

describe("filterThread", () => {
  it("returns the whole node when matching, null otherwise", () => {
    const res = sampleResult();
    const r2 = res.nodesById.get(id("r2"))!;
    expect(filterThread(r2, { minReplies: 1 })).toBe(r2); // unchanged whole thread
    expect(filterThread(r2, { minReplies: 99 })).toBeNull();
  });
});

describe("immutability", () => {
  it("14. does not mutate the input result or its roots", () => {
    const res = sampleResult();
    const rootsSnapshot = JSON.stringify(res.roots);
    const orderSnapshot = res.roots.map((n) => n.event.id);

    queryThreads(res, { sort: "top", limit: 1, text: "content" });

    expect(JSON.stringify(res.roots)).toBe(rootsSnapshot);
    expect(res.roots.map((n) => n.event.id)).toEqual(orderSnapshot);
  });
});
