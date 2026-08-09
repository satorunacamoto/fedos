import { describe, it, expect } from "vitest";
import { KvEventCache, type KvLikeNamespace } from "../src/os/_legacy_prototype/cache/kv_event_cache.js";
import type { NostrEvent } from "../src/nostr/types.js";
import type { CachedEventBatch } from "../src/os/_legacy_prototype/cache/types.js";

function event(idChar: string): NostrEvent {
  return {
    id: idChar.repeat(64),
    pubkey: "a".repeat(64),
    created_at: 1700000000,
    kind: 1,
    tags: [],
    content: `note-${idChar}`,
    sig: "b".repeat(128),
  };
}

function batch(
  events: NostrEvent[],
  cachedAt: number,
  expiresAt: number,
  key = "relay:abc123",
): CachedEventBatch {
  return { key, relayUrl: "wss://relay.test", events, cachedAt, expiresAt };
}

/** In-memory mock of the KV namespace surface. */
class MockKv implements KvLikeNamespace {
  store = new Map<string, string>();
  putCalls: { key: string; options?: { expirationTtl?: number } }[] = [];
  deleteCalls: string[] = [];
  getCalls = 0;

  async get(key: string): Promise<string | null> {
    this.getCalls++;
    return this.store.get(key) ?? null;
  }
  async put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void> {
    this.putCalls.push({ key, options });
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.deleteCalls.push(key);
    this.store.delete(key);
  }
}

describe("KvEventCache", () => {
  it("1. set then get returns a hit before expiry", async () => {
    const kv = new MockKv();
    const cache = new KvEventCache({ kv });
    await cache.set(batch([event("1")], 1000, 70000));
    const res = await cache.get("relay:abc123", 1500);
    expect(res.status).toBe("hit");
    expect(res.batch?.events).toHaveLength(1);
    expect(res.batch?.events[0]?.id).toBe(event("1").id);
  });

  it("2. returns stale once expired", async () => {
    const kv = new MockKv();
    const cache = new KvEventCache({ kv });
    await cache.set(batch([event("1")], 0, 60000));
    const res = await cache.get("relay:abc123", 60000); // now >= expiresAt
    expect(res.status).toBe("stale");
    expect(res.batch?.events).toHaveLength(1);
  });

  it("3. unknown key returns miss", async () => {
    const cache = new KvEventCache({ kv: new MockKv() });
    expect((await cache.get("relay:missing", 0)).status).toBe("miss");
  });

  it("4. delete removes the (namespaced) key", async () => {
    const kv = new MockKv();
    const cache = new KvEventCache({ kv });
    await cache.set(batch([event("1")], 0, 70000));
    await cache.delete("relay:abc123");
    expect(kv.deleteCalls).toEqual(["nostr-cache:relay:abc123"]);
    expect((await cache.get("relay:abc123", 0)).status).toBe("miss");
  });

  it("5. put uses the prefixed key (and a custom prefix is honored)", async () => {
    const kv = new MockKv();
    await new KvEventCache({ kv }).set(batch([event("1")], 0, 70000));
    expect(kv.putCalls[0]?.key).toBe("nostr-cache:relay:abc123");

    const kv2 = new MockKv();
    await new KvEventCache({ kv: kv2, keyPrefix: "custom:" }).set(
      batch([event("1")], 0, 70000),
    );
    expect(kv2.putCalls[0]?.key).toBe("custom:relay:abc123");
  });

  it("6. expirationTtl is clamped up to at least 60 seconds", async () => {
    const kv = new MockKv();
    // remaining = 30s logical TTL -> KV floor of 60.
    await new KvEventCache({ kv }).set(batch([event("1")], 0, 30000));
    expect(kv.putCalls[0]?.options?.expirationTtl).toBe(60);
  });

  it("uses the actual remaining TTL when above the floor", async () => {
    const kv = new MockKv();
    await new KvEventCache({ kv }).set(batch([event("1")], 0, 120000)); // 120s
    expect(kv.putCalls[0]?.options?.expirationTtl).toBe(120);
  });

  it("does not store an already-expired batch", async () => {
    const kv = new MockKv();
    await new KvEventCache({ kv }).set(batch([event("1")], 1000, 1000)); // ttl 0
    expect(kv.putCalls).toHaveLength(0);
  });

  it("7. a corrupt JSON value is treated as a miss (no throw)", async () => {
    const kv = new MockKv();
    kv.store.set("nostr-cache:relay:abc123", "not json {");
    const res = await new KvEventCache({ kv }).get("relay:abc123", 0);
    expect(res.status).toBe("miss");
  });

  it("treats a structurally-wrong value as a miss", async () => {
    const kv = new MockKv();
    kv.store.set("nostr-cache:relay:abc123", JSON.stringify({ nope: true }));
    const res = await new KvEventCache({ kv }).get("relay:abc123", 0);
    expect(res.status).toBe("miss");
  });

  it("8. clear is a safe no-op (no mass delete)", async () => {
    const kv = new MockKv();
    const cache = new KvEventCache({ kv });
    await cache.set(batch([event("1")], 0, 70000));
    await cache.clear();
    expect(kv.deleteCalls).toHaveLength(0);
    // The entry survives clear().
    expect((await cache.get("relay:abc123", 0)).status).toBe("hit");
  });

  it("9. does not mutate the input batch", async () => {
    const kv = new MockKv();
    const b = batch([event("1")], 0, 70000);
    const snapshot = JSON.stringify(b);
    await new KvEventCache({ kv }).set(b);
    expect(JSON.stringify(b)).toBe(snapshot);
  });
});
