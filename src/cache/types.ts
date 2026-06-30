import type { NostrEvent } from "../nostr/types.js";

/** Opaque, deterministic cache key derived from relay URL + filters. */
export type CacheKey = string;

/**
 * How a fetch was served:
 *  - "hit":    valid (non-expired) cache entry, no relay fetch.
 *  - "miss":   no usable entry; fetched fresh from the relay and stored.
 *  - "stale":  an expired entry existed and the refetch FAILED, so the stale
 *              data was served as a fallback.
 *  - "bypass": caching was skipped (ttl <= 0); fetched without reading/writing.
 */
export type CacheStatus = "hit" | "miss" | "stale" | "bypass";

/** A stored batch of events for one (relay, filters) key. */
export interface CachedEventBatch {
  readonly key: CacheKey;
  readonly relayUrl: string;
  readonly events: readonly NostrEvent[];
  /** Unix ms when stored. */
  readonly cachedAt: number;
  /** Unix ms when this entry becomes stale. */
  readonly expiresAt: number;
}

/** Result of a cache lookup (bypass is decided above the cache, not here). */
export interface CacheLookupResult {
  readonly status: "hit" | "miss" | "stale";
  /** Present for "hit" and "stale"; absent for "miss". */
  readonly batch?: CachedEventBatch;
}

/**
 * Async key/value store for event batches. Async so a Cloudflare KV/D1/R2-backed
 * implementation can drop in later behind the same interface. `now` is injected
 * into `get` so expiry is deterministic and testable.
 */
export interface EventCache {
  get(key: CacheKey, now: number): Promise<CacheLookupResult>;
  set(batch: CachedEventBatch): Promise<void>;
  delete(key: CacheKey): Promise<void>;
  clear(): Promise<void>;
}
