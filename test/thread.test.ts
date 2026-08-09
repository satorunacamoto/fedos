import { describe, it, expect } from "vitest";
import {
  buildThreads,
  getReplyTarget,
  getRootTarget,
} from "../src/os/_legacy_prototype/thread/thread.js";
import type { NostrEvent, NostrTag } from "../src/nostr/types.js";
import type { IngestedEvent } from "../src/os/_legacy_prototype/ingest/types.js";

const HEX128 = "b".repeat(128);

/** 64-char hex id from a short label (so tests stay readable). */
function id(label: string): string {
  return (label + "0".repeat(64)).slice(0, 64);
}

function event(
  label: string,
  opts: { created_at?: number; kind?: number; tags?: NostrTag[] } = {},
): NostrEvent {
  return {
    id: id(label),
    pubkey: "a".repeat(64),
    created_at: opts.created_at ?? 1000,
    kind: opts.kind ?? 1,
    tags: opts.tags ?? [],
    content: `content-${label}`,
    sig: HEX128,
  };
}

function ingest(e: NostrEvent): IngestedEvent {
  return { event: e, relayUrl: "wss://relay.test", ingestedAt: 1700000000000 };
}

/** e tag pointing at a labeled event, with optional NIP-10 marker. */
function eTag(label: string, marker?: string): NostrTag {
  return marker
    ? ["e", id(label), "wss://relay.test", marker]
    : ["e", id(label), "wss://relay.test"];
}

describe("getReplyTarget / getRootTarget", () => {
  it("returns null when there are no e tags", () => {
    const e = event("a");
    expect(getReplyTarget(e)).toBeNull();
    expect(getRootTarget(e)).toBeNull();
  });

  it("honors explicit root/reply markers", () => {
    const e = event("c", { tags: [eTag("a", "root"), eTag("b", "reply")] });
    expect(getRootTarget(e)).toBe(id("a"));
    expect(getReplyTarget(e)).toBe(id("b"));
  });

  it("treats a single markerless e tag as both root and reply", () => {
    const e = event("b", { tags: [eTag("a")] });
    expect(getRootTarget(e)).toBe(id("a"));
    expect(getReplyTarget(e)).toBe(id("a"));
  });

  it("uses first=root last=reply for multiple markerless e tags", () => {
    const e = event("d", { tags: [eTag("a"), eTag("b"), eTag("c")] });
    expect(getRootTarget(e)).toBe(id("a"));
    expect(getReplyTarget(e)).toBe(id("c"));
  });

  it("returns null reply when only a root marker is present", () => {
    const e = event("b", { tags: [eTag("a", "root")] });
    expect(getRootTarget(e)).toBe(id("a"));
    expect(getReplyTarget(e)).toBeNull();
  });
});

describe("buildThreads", () => {
  it("1. single root event", () => {
    const res = buildThreads([ingest(event("a"))]);
    expect(res.roots).toHaveLength(1);
    expect(res.roots[0]?.event.id).toBe(id("a"));
    expect(res.roots[0]?.depth).toBe(0);
    expect(res.roots[0]?.parentId).toBeNull();
    expect(res.warnings).toHaveLength(0);
  });

  it("2. root + one reply", () => {
    const root = event("a", { created_at: 100 });
    const reply = event("b", { created_at: 200, tags: [eTag("a", "reply")] });
    const res = buildThreads([ingest(reply), ingest(root)]);

    expect(res.roots).toHaveLength(1);
    expect(res.roots[0]?.event.id).toBe(id("a"));
    expect(res.roots[0]?.children).toHaveLength(1);
    expect(res.roots[0]?.children[0]?.event.id).toBe(id("b"));
    expect(res.roots[0]?.children[0]?.depth).toBe(1);
    expect(res.roots[0]?.children[0]?.parentId).toBe(id("a"));
  });

  it("3. root + nested reply", () => {
    const a = event("a", { created_at: 100 });
    const b = event("b", { created_at: 200, tags: [eTag("a", "reply")] });
    const c = event("c", { created_at: 300, tags: [eTag("b", "reply")] });
    const res = buildThreads([ingest(a), ingest(b), ingest(c)]);

    const child = res.roots[0]?.children[0];
    expect(child?.event.id).toBe(id("b"));
    expect(child?.children[0]?.event.id).toBe(id("c"));
    expect(child?.children[0]?.depth).toBe(2);
  });

  it("4. branching replies are ordered created_at ASC", () => {
    const a = event("a", { created_at: 100 });
    const b = event("b", { created_at: 300, tags: [eTag("a", "reply")] });
    const c = event("c", { created_at: 200, tags: [eTag("a", "reply")] });
    const res = buildThreads([ingest(a), ingest(b), ingest(c)]);

    const ids = res.roots[0]?.children.map((n) => n.event.id);
    expect(ids).toEqual([id("c"), id("b")]); // 200 before 300
  });

  it("5. orphan reply is promoted to root with a warning", () => {
    // "ff" is valid hex but no such event is in the set -> orphan.
    const reply = event("b", { tags: [eTag("ff", "reply")] });
    const res = buildThreads([ingest(reply)]);

    expect(res.roots).toHaveLength(1);
    expect(res.roots[0]?.event.id).toBe(id("b"));
    expect(res.roots[0]?.parentId).toBeNull();
    expect(res.warnings).toContainEqual(
      expect.objectContaining({ kind: "orphan_reply", eventId: id("b") }),
    );
  });

  it("6. positional NIP-10 fallback links to the last e tag", () => {
    const a = event("a", { created_at: 100 });
    const b = event("b", { created_at: 200 });
    // markerless: first=root(a), last=reply(b)
    const c = event("c", { created_at: 300, tags: [eTag("a"), eTag("b")] });
    const res = buildThreads([ingest(a), ingest(b), ingest(c)]);

    const bNode = res.nodesById.get(id("b"));
    expect(bNode?.children[0]?.event.id).toBe(id("c"));
    expect(res.nodesById.get(id("c"))?.parentId).toBe(id("b"));
  });

  it("7. explicit reply marker takes priority over positional order", () => {
    // Reply marker points at b even though a appears first.
    const a = event("a", { created_at: 100 });
    const b = event("b", { created_at: 200 });
    const c = event("c", {
      created_at: 300,
      tags: [eTag("a", "root"), eTag("b", "reply")],
    });
    const res = buildThreads([ingest(a), ingest(b), ingest(c)]);
    expect(res.nodesById.get(id("c"))?.parentId).toBe(id("b"));
  });

  it("8. root threads ordered created_at DESC", () => {
    const a = event("a", { created_at: 100 });
    const b = event("b", { created_at: 300 });
    const c = event("c", { created_at: 200 });
    const res = buildThreads([ingest(a), ingest(b), ingest(c)]);
    expect(res.roots.map((n) => n.event.id)).toEqual([
      id("b"),
      id("c"),
      id("a"),
    ]);
  });

  it("9. equal created_at falls back to id ASC", () => {
    const a = event("a", { created_at: 100 });
    const b = event("b", { created_at: 100 });
    const res = buildThreads([ingest(b), ingest(a)]);
    // roots: created_at equal -> id ASC -> a before b
    expect(res.roots.map((n) => n.event.id)).toEqual([id("a"), id("b")]);
  });

  it("9b. equal created_at children fall back to id ASC", () => {
    const root = event("a", { created_at: 50 });
    const c1 = event("b", { created_at: 100, tags: [eTag("a", "reply")] });
    const c2 = event("c", { created_at: 100, tags: [eTag("a", "reply")] });
    const res = buildThreads([ingest(root), ingest(c2), ingest(c1)]);
    expect(res.roots[0]?.children.map((n) => n.event.id)).toEqual([
      id("b"),
      id("c"),
    ]);
  });

  it("10. cycle guard cuts the closing edge", () => {
    // a -> b -> a (mutual reply cycle)
    const a = event("a", { created_at: 100, tags: [eTag("b", "reply")] });
    const b = event("b", { created_at: 200, tags: [eTag("a", "reply")] });
    const res = buildThreads([ingest(a), ingest(b)]);

    // Exactly one of them is cut to a root; the tree stays finite.
    expect(res.roots.length).toBeGreaterThanOrEqual(1);
    expect(res.warnings.some((w) => w.kind === "cycle_detected")).toBe(true);
    expect(res.nodesById.size).toBe(2);

    // No node may be its own ancestor: walk all chains, bounded.
    for (const node of res.nodesById.values()) {
      let hops = 0;
      let cur: string | null = node.parentId;
      const seen = new Set<string>([node.event.id]);
      while (cur !== null) {
        expect(seen.has(cur)).toBe(false);
        seen.add(cur);
        cur = res.nodesById.get(cur)?.parentId ?? null;
        expect(hops++).toBeLessThan(10);
      }
    }
  });

  it("10b. self-reply is treated as a cycle and cut to root", () => {
    const a = event("a", { tags: [eTag("a", "reply")] });
    const res = buildThreads([ingest(a)]);
    expect(res.roots[0]?.parentId).toBeNull();
    expect(res.warnings).toContainEqual(
      expect.objectContaining({ kind: "cycle_detected", eventId: id("a") }),
    );
  });

  it("11. input array and elements are not mutated", () => {
    const a = event("a", { created_at: 200 });
    const b = event("b", { created_at: 100, tags: [eTag("a", "reply")] });
    const input = [ingest(a), ingest(b)];
    const snapshot = JSON.stringify(input);

    buildThreads(input);

    expect(JSON.stringify(input)).toBe(snapshot);
    expect(input[0]?.event.id).toBe(id("a")); // order preserved
    expect(input[0]?.event.tags).toEqual([]); // tags untouched
  });

  it("12. non-kind:1 events are excluded from the tree", () => {
    const note = event("a", { kind: 1 });
    const meta = event("b", { kind: 0 });
    const reaction = event("c", { kind: 7, tags: [eTag("a", "reply")] });
    const res = buildThreads([ingest(note), ingest(meta), ingest(reaction)]);

    expect(res.nodesById.has(id("b"))).toBe(false);
    expect(res.nodesById.has(id("c"))).toBe(false);
    expect(res.roots).toHaveLength(1);
    expect(res.roots[0]?.event.id).toBe(id("a"));
  });

  it("reports invalid e tags but still builds", () => {
    const bad: NostrTag = ["e", "not-hex", "wss://relay.test"];
    const e = event("a", { tags: [bad] });
    const res = buildThreads([ingest(e)]);
    expect(res.roots).toHaveLength(1);
    expect(res.warnings).toContainEqual(
      expect.objectContaining({ kind: "invalid_e_tag", eventId: id("a") }),
    );
  });

  it("drops duplicate ids with a warning (defensive)", () => {
    const first = event("a", { created_at: 100 });
    const second = event("a", { created_at: 999 });
    const res = buildThreads([ingest(first), ingest(second)]);
    expect(res.nodesById.size).toBe(1);
    expect(res.roots[0]?.event.created_at).toBe(100); // first wins
    expect(res.warnings).toContainEqual(
      expect.objectContaining({ kind: "duplicate_event", eventId: id("a") }),
    );
  });
});
