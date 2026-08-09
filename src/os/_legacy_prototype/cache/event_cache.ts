/**
 * Stage 6 — relay event cache boundary.
 *
 * Lets the live relay path serve repeat requests from memory instead of opening
 * a WebSocket every time. This module owns:
 *   - deterministic cache-key derivation (relay URL + normalized filters),
 *   - an in-memory `EventCache` implementation (dev/test only),
 *   - the get-or-fetch policy (hit / miss / stale fallback / bypass).
 *
 * It performs NO event de-duplication — that stays the ingest pipeline's job.
 * `InMemoryEventCache` is process-local and is lost on isolate restart.
 */

import type { NostrEvent } from "../../../nostr/types.js";
import type { NostrFilter } from "../../../nostr/relay.js";
import type {
  CacheKey,
  CacheLookupResult,
  CacheStatus,
  CachedEventBatch,
  EventCache,
} from "./types.js";

/** Stable comparison via canonical JSON (used to sort sets deterministically). */
function compareJson(a: unknown, b: unknown): number {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/**
 * Canonicalizes a value so object key order and array element order don't change
 * the result: objects become sorted [key, value] entry lists; arrays are sorted.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize).sort(compareJson);
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, canonicalize(v)] as const)
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  }
  return value;
}

/**
 * Returns a canonical, order-independent representation of a filter list.
 * Two filter lists that are equivalent up to key/array/list ordering produce
 * deeply-equal output. Does not mutate the input.
 */
export function normalizeFiltersForCache(filters: NostrFilter[]): unknown {
  return filters.map(canonicalize).sort(compareJson);
}

/** Deterministic 32-bit FNV-1a hash → 8-char hex. Not cryptographic. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Builds a deterministic cache key for (relayUrl, filters). Stable across filter
 * key/array/list ordering; different relay URLs yield different keys.
 */
export function createRelayCacheKey(
  relayUrl: string,
  filters: NostrFilter[],
): CacheKey {
  const canonical = JSON.stringify(normalizeFiltersForCache(filters));
  return `relay:${fnv1a(`${relayUrl}\n${canonical}`)}`;
}

/**
 * Process-local event cache. For development and tests only — it offers NO
 * persistence and is cleared whenever the isolate/process restarts.
 */
export class InMemoryEventCache implements EventCache {
  readonly #store = new Map<CacheKey, CachedEventBatch>();

  get size(): number {
    return this.#store.size;
  }

  async get(key: CacheKey, now: number): Promise<CacheLookupResult> {
    const batch = this.#store.get(key);
    if (!batch) return { status: "miss" };
    if (now >= batch.expiresAt) return { status: "stale", batch };
    return { status: "hit", batch };
  }

  async set(batch: CachedEventBatch): Promise<void> {
    this.#store.set(batch.key, batch);
  }

  async delete(key: CacheKey): Promise<void> {
    this.#store.delete(key);
  }

  async clear(): Promise<void> {
    this.#store.clear();
  }
}

export interface GetCachedOrFetchOptions {
  readonly cache: EventCache;
  readonly relayUrl: string;
  readonly filters: NostrFilter[];
  /** Fetches fresh events from the relay (called only on miss/stale/bypass). */
  readonly fetchEvents: () => Promise<NostrEvent[]>;
  /** Time-to-live in seconds. <= 0 bypasses the cache entirely. */
  readonly ttlSeconds: number;
  /** Current time in unix ms (injected for determinism). */
  readonly now: number;
}

export interface GetCachedOrFetchResult {
  readonly events: readonly NostrEvent[];
  readonly status: CacheStatus;
  readonly cacheKey: CacheKey;
  readonly cachedAt?: number;
  readonly expiresAt?: number;
  /** Set when a relay fetch failed but stale data was served as a fallback. */
  readonly error?: string;
}

/**
 * Get-or-fetch with stale fallback.
 *
 * - ttl <= 0           → bypass: fetch, never touch the cache.
 * - valid entry        → hit: serve cached events, no fetch.
 * - missing entry      → fetch fresh, store, return "miss".
 * - expired entry      → refetch; on success store + return "miss"; on failure
 *                        serve the stale events and return "stale".
 *
 * If a fetch fails and there is NO entry to fall back to, the error propagates
 * (the caller decides how to render the failure).
 */
export async function getCachedOrFetchEvents(
  options: GetCachedOrFetchOptions,
): Promise<GetCachedOrFetchResult> {
  const { cache, relayUrl, filters, fetchEvents, ttlSeconds, now } = options;
  const key = createRelayCacheKey(relayUrl, filters);

  if (ttlSeconds <= 0) {
    const events = await fetchEvents();
    return { events, status: "bypass", cacheKey: key };
  }

  const lookup = await cache.get(key, now);
  if (lookup.status === "hit" && lookup.batch) {
    return {
      events: lookup.batch.events,
      status: "hit",
      cacheKey: key,
      cachedAt: lookup.batch.cachedAt,
      expiresAt: lookup.batch.expiresAt,
    };
  }

  try {
    const events = await fetchEvents();
    const cachedAt = now;
    const expiresAt = now + ttlSeconds * 1000;
    await cache.set({ key, relayUrl, events, cachedAt, expiresAt });
    return { events, status: "miss", cacheKey: key, cachedAt, expiresAt };
  } catch (err) {
    if (lookup.status === "stale" && lookup.batch) {
      return {
        events: lookup.batch.events,
        status: "stale",
        cacheKey: key,
        cachedAt: lookup.batch.cachedAt,
        expiresAt: lookup.batch.expiresAt,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    throw err;
  }
}
