import { describe, it, expect, vi } from "vitest";
import {
  createRelayCacheKey,
  normalizeFiltersForCache,
  InMemoryEventCache,
  getCachedOrFetchEvents,
} from "../src/os/_legacy_prototype/cache/event_cache.js";
import type { NostrEvent } from "../src/nostr/types.js";
import type { NostrFilter } from "../src/nostr/relay.js";
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

const RELAY = "wss://relay.test";

function batch(
  key: string,
  events: NostrEvent[],
  cachedAt: number,
  expiresAt: number,
): CachedEventBatch {
  return { key, relayUrl: RELAY, events, cachedAt, expiresAt };
}

describe("createRelayCacheKey", () => {
  it("1. is deterministic for the same input", () => {
    const filters: NostrFilter[] = [{ kinds: [1], authors: ["x"] }];
    expect(createRelayCacheKey(RELAY, filters)).toBe(
      createRelayCacheKey(RELAY, filters),
    );
  });

  it("2. is stable under filter key and array order changes", () => {
    const a = createRelayCacheKey(RELAY, [{ kinds: [1, 2], authors: ["x", "y"] }]);
    const b = createRelayCacheKey(RELAY, [{ authors: ["y", "x"], kinds: [2, 1] }]);
    expect(a).toBe(b);
  });

  it("is stable under filter-list order changes", () => {
    const a = createRelayCacheKey(RELAY, [{ kinds: [1] }, { kinds: [7] }]);
    const b = createRelayCacheKey(RELAY, [{ kinds: [7] }, { kinds: [1] }]);
    expect(a).toBe(b);
  });

  it("3. differs for different relay URLs", () => {
    const filters: NostrFilter[] = [{ kinds: [1] }];
    expect(createRelayCacheKey("wss://a.example", filters)).not.toBe(
      createRelayCacheKey("wss://b.example", filters),
    );
  });

  it("normalizeFiltersForCache does not mutate its input", () => {
    const filters: NostrFilter[] = [{ kinds: [2, 1], authors: ["y", "x"] }];
    const snapshot = JSON.stringify(filters);
    normalizeFiltersForCache(filters);
    expect(JSON.stringify(filters)).toBe(snapshot);
  });
});

describe("InMemoryEventCache", () => {
  it("4. set then get returns a hit before expiry", async () => {
    const cache = new InMemoryEventCache();
    const key = createRelayCacheKey(RELAY, [{ kinds: [1] }]);
    await cache.set(batch(key, [event("1")], 1000, 2000));
    const result = await cache.get(key, 1500);
    expect(result.status).toBe("hit");
    expect(result.batch?.events).toHaveLength(1);
  });

  it("5. returns stale once expired", async () => {
    const cache = new InMemoryEventCache();
    const key = createRelayCacheKey(RELAY, [{ kinds: [1] }]);
    await cache.set(batch(key, [event("1")], 1000, 2000));
    const result = await cache.get(key, 2000); // now >= expiresAt
    expect(result.status).toBe("stale");
    expect(result.batch?.events).toHaveLength(1);
  });

  it("returns miss for an unknown key", async () => {
    const cache = new InMemoryEventCache();
    expect((await cache.get("nope", 0)).status).toBe("miss");
  });
});

describe("getCachedOrFetchEvents", () => {
  const baseFilters: NostrFilter[] = [{ kinds: [1] }];

  it("6. ttl <= 0 bypasses the cache (fetch, no store)", async () => {
    const cache = new InMemoryEventCache();
    const fetchEvents = vi.fn(async () => [event("1")]);
    const res = await getCachedOrFetchEvents({
      cache,
      relayUrl: RELAY,
      filters: baseFilters,
      fetchEvents,
      ttlSeconds: 0,
      now: 1000,
    });
    expect(res.status).toBe("bypass");
    expect(fetchEvents).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(0);
  });

  it("7. a valid cache entry is a hit and avoids fetching", async () => {
    const cache = new InMemoryEventCache();
    const key = createRelayCacheKey(RELAY, baseFilters);
    await cache.set(batch(key, [event("1")], 1000, 9000));
    const fetchEvents = vi.fn(async () => [event("2")]);

    const res = await getCachedOrFetchEvents({
      cache,
      relayUrl: RELAY,
      filters: baseFilters,
      fetchEvents,
      ttlSeconds: 60,
      now: 2000,
    });
    expect(res.status).toBe("hit");
    expect(res.events.map((e) => e.id)).toEqual(["1".repeat(64)]);
    expect(fetchEvents).not.toHaveBeenCalled();
  });

  it("8. a miss fetches and stores", async () => {
    const cache = new InMemoryEventCache();
    const fetchEvents = vi.fn(async () => [event("1")]);
    const res = await getCachedOrFetchEvents({
      cache,
      relayUrl: RELAY,
      filters: baseFilters,
      fetchEvents,
      ttlSeconds: 60,
      now: 1000,
    });
    expect(res.status).toBe("miss");
    expect(fetchEvents).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(1);
    // Stored with a fresh expiry.
    const stored = await cache.get(res.cacheKey, 1000);
    expect(stored.status).toBe("hit");
  });

  it("9. a stale entry triggers a refetch that updates the cache", async () => {
    const cache = new InMemoryEventCache();
    const key = createRelayCacheKey(RELAY, baseFilters);
    await cache.set(batch(key, [event("9")], 0, 1000)); // old, expired at 1000
    const fetchEvents = vi.fn(async () => [event("8")]); // new

    const res = await getCachedOrFetchEvents({
      cache,
      relayUrl: RELAY,
      filters: baseFilters,
      fetchEvents,
      ttlSeconds: 60,
      now: 5000, // past expiry
    });
    expect(res.status).toBe("miss"); // served fresh data
    expect(res.events.map((e) => e.id)).toEqual([event("8").id]);
    expect(fetchEvents).toHaveBeenCalledTimes(1);
    const stored = await cache.get(key, 5000);
    expect(stored.status).toBe("hit");
    expect(stored.batch?.events[0]?.id).toBe(event("8").id);
  });

  it("10. a stale entry with a failing refetch falls back to stale", async () => {
    const cache = new InMemoryEventCache();
    const key = createRelayCacheKey(RELAY, baseFilters);
    await cache.set(batch(key, [event("9")], 0, 1000));
    const fetchEvents = vi.fn(async () => {
      throw new Error("relay down");
    });

    const res = await getCachedOrFetchEvents({
      cache,
      relayUrl: RELAY,
      filters: baseFilters,
      fetchEvents,
      ttlSeconds: 60,
      now: 5000,
    });
    expect(res.status).toBe("stale");
    expect(res.events[0]?.id).toBe(event("9").id);
    expect(res.error).toContain("relay down");
  });

  it("propagates the error on a miss with no fallback", async () => {
    const cache = new InMemoryEventCache();
    const fetchEvents = vi.fn(async () => {
      throw new Error("relay down");
    });
    await expect(
      getCachedOrFetchEvents({
        cache,
        relayUrl: RELAY,
        filters: baseFilters,
        fetchEvents,
        ttlSeconds: 60,
        now: 1000,
      }),
    ).rejects.toThrow("relay down");
  });

  it("11. does not mutate the input filters", async () => {
    const cache = new InMemoryEventCache();
    const filters: NostrFilter[] = [{ kinds: [2, 1], authors: ["y", "x"] }];
    const snapshot = JSON.stringify(filters);
    await getCachedOrFetchEvents({
      cache,
      relayUrl: RELAY,
      filters,
      fetchEvents: async () => [event("1")],
      ttlSeconds: 60,
      now: 1000,
    });
    expect(JSON.stringify(filters)).toBe(snapshot);
  });

  it("12. leaves duplicate de-duplication to the ingest path", async () => {
    // The cache stores events verbatim, including duplicate ids.
    const cache = new InMemoryEventCache();
    const dup = [event("1"), event("1"), event("2")];
    const res = await getCachedOrFetchEvents({
      cache,
      relayUrl: RELAY,
      filters: baseFilters,
      fetchEvents: async () => dup,
      ttlSeconds: 60,
      now: 1000,
    });
    expect(res.events).toHaveLength(3); // not de-duplicated here
  });
});
