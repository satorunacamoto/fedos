/**
 * Stage 7 — Cloudflare Workers KV implementation of `EventCache`.
 *
 * Drop-in for `InMemoryEventCache` behind the same interface. It stores each
 * `CachedEventBatch` as JSON under a namespaced key and relies on KV's own
 * `expirationTtl` for eventual eviction, while the app still decides hit/stale
 * from `batch.expiresAt` (so a logical TTL below KV's 60s floor still behaves
 * correctly: KV keeps the entry a bit longer, but `get` reports it stale).
 *
 * This is a cache, NOT a verified or durable store: KV is eventually consistent,
 * entries can be evicted early, and nothing here verifies signatures.
 */

import type {
  CacheKey,
  CacheLookupResult,
  CachedEventBatch,
  EventCache,
} from "./types.js";

/**
 * Minimal subset of the Cloudflare `KVNamespace` surface this adapter uses.
 * A real `KVNamespace` satisfies it structurally; tests provide a mock.
 */
export interface KvLikeNamespace {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface KvEventCacheOptions {
  readonly kv: KvLikeNamespace;
  /** Key namespace prefix. Default: "nostr-cache:". */
  readonly keyPrefix?: string;
}

const DEFAULT_PREFIX = "nostr-cache:";
/** Cloudflare KV rejects expirationTtl below 60 seconds. */
const KV_MIN_TTL_SECONDS = 60;

/** Structural guard so a corrupt/foreign KV value is treated as a miss. */
function isCachedEventBatch(value: unknown): value is CachedEventBatch {
  if (value === null || typeof value !== "object") return false;
  const b = value as Record<string, unknown>;
  return (
    typeof b["key"] === "string" &&
    typeof b["relayUrl"] === "string" &&
    Array.isArray(b["events"]) &&
    typeof b["cachedAt"] === "number" &&
    typeof b["expiresAt"] === "number"
  );
}

export class KvEventCache implements EventCache {
  readonly #kv: KvLikeNamespace;
  readonly #prefix: string;

  constructor(options: KvEventCacheOptions) {
    this.#kv = options.kv;
    this.#prefix = options.keyPrefix ?? DEFAULT_PREFIX;
  }

  #namespaced(key: CacheKey): string {
    return `${this.#prefix}${key}`;
  }

  async get(key: CacheKey, now: number): Promise<CacheLookupResult> {
    const raw = await this.#kv.get(this.#namespaced(key));
    if (raw === null) return { status: "miss" };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { status: "miss" }; // corrupt value -> treat as absent
    }
    if (!isCachedEventBatch(parsed)) return { status: "miss" };

    if (now >= parsed.expiresAt) return { status: "stale", batch: parsed };
    return { status: "hit", batch: parsed };
  }

  async set(batch: CachedEventBatch): Promise<void> {
    // Logical TTL is derived from the batch itself (deterministic, no clock).
    const remainingSeconds = Math.ceil((batch.expiresAt - batch.cachedAt) / 1000);
    if (remainingSeconds <= 0) return; // already expired — nothing useful to store

    const expirationTtl = Math.max(remainingSeconds, KV_MIN_TTL_SECONDS);
    await this.#kv.put(this.#namespaced(batch.key), JSON.stringify(batch), {
      expirationTtl,
    });
  }

  async delete(key: CacheKey): Promise<void> {
    await this.#kv.delete(this.#namespaced(key));
  }

  /**
   * No-op by design. Cloudflare KV has no safe atomic "clear", and blindly
   * enumerating + deleting every key risks wiping unrelated data in a shared
   * namespace. Evict individual keys with `delete`, or rely on `expirationTtl`.
   */
  async clear(): Promise<void> {
    // intentionally does nothing
  }
}
