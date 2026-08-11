/**
 * Stage 24 — Cloudflare R2 adapter for the public `AssetCache` boundary.
 *
 * R2 is the ORIGIN STORE for public/unlisted media (previews, thumbnails, video
 * segments), complementing the MeshKV peer cache. This file ships the boundary
 * only: a minimal `R2LikeBucket`/`R2LikeObject` interface (so the real
 * `@cloudflare/workers-types` `R2Bucket` drops in, and tests inject a fake), a
 * `MockR2Bucket`, and the adapter that gates every write through `canCacheAsset`.
 *
 * SCOPE GUARDRAILS: public bytes only. It must NEVER store private/paid content,
 * DMs, secrets, key material, or payment/entitlement data — the policy gate
 * refuses those, and no purchased original is ever placed here. This is NOT a
 * delivery path: there are no signed URLs, no download endpoints, no payment, and
 * no DRM. It performs no external HTTP/`fetch` of its own — all I/O goes through
 * the injected bucket. `clear()` is a deliberate no-op (no safe bulk wipe).
 */

import { canCacheAsset, normalizeAssetMetadata } from "./policy.js";
import type { AssetCache, AssetKey, AssetMetadata, CachedAsset } from "./types.js";

/** Minimal subset of an R2 object this adapter reads. */
export interface R2LikeObject {
  arrayBuffer(): Promise<ArrayBuffer>;
  readonly customMetadata?: Record<string, string>;
  readonly httpMetadata?: { readonly contentType?: string };
}

/** Options accepted by `R2LikeBucket.put`. */
export interface R2LikePutOptions {
  readonly httpMetadata?: { readonly contentType?: string };
  readonly customMetadata?: Record<string, string>;
}

/** Minimal subset of an R2 bucket this adapter uses (a real `R2Bucket` fits). */
export interface R2LikeBucket {
  get(key: string): Promise<R2LikeObject | null>;
  put(key: string, value: ArrayBuffer, options?: R2LikePutOptions): Promise<void>;
  head(key: string): Promise<R2LikeObject | null>;
  delete(key: string): Promise<void>;
}

export interface R2AssetCacheOptions {
  readonly bucket: R2LikeBucket;
  /**
   * Reject non-cacheable assets on `put` (default true). This guardrail keeps
   * private/paid/sensitive bytes out of origin storage — keep it on.
   */
  readonly enforcePolicy?: boolean;
}

/** customMetadata keys used to round-trip our cache fields through R2. */
const META_KEY = "assetMeta";
const CACHED_AT_KEY = "cachedAt";
const EXPIRES_AT_KEY = "expiresAt";

/** Copies an ArrayBuffer so neither side can mutate the other's bytes. */
function cloneBytes(bytes: ArrayBuffer): ArrayBuffer {
  return bytes.slice(0);
}

/** Structural check that a parsed value is usable `AssetMetadata`. */
function isAssetMetadata(value: unknown): value is AssetMetadata {
  if (value === null || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m["kind"] === "string" &&
    typeof m["visibility"] === "string" &&
    typeof m["contentType"] === "string" &&
    typeof m["sizeBytes"] === "number" &&
    Array.isArray(m["tags"])
  );
}

interface RestoredEntry {
  readonly metadata: AssetMetadata;
  readonly cachedAt: number;
  readonly expiresAt?: number;
}

/** Rebuilds our cache fields from an object's customMetadata, or null if invalid. */
function restoreEntry(obj: R2LikeObject): RestoredEntry | null {
  const cm = obj.customMetadata;
  if (!cm) return null;

  const rawMeta = cm[META_KEY];
  if (typeof rawMeta !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawMeta);
  } catch {
    return null;
  }
  if (!isAssetMetadata(parsed)) return null;

  const cachedAtRaw = cm[CACHED_AT_KEY];
  const cachedAt = cachedAtRaw === undefined ? Number.NaN : Number(cachedAtRaw);
  if (!Number.isFinite(cachedAt)) return null;

  const expiresAtRaw = cm[EXPIRES_AT_KEY];
  if (expiresAtRaw !== undefined) {
    const expiresAt = Number(expiresAtRaw);
    if (Number.isFinite(expiresAt)) {
      return { metadata: parsed, cachedAt, expiresAt };
    }
  }
  return { metadata: parsed, cachedAt };
}

/**
 * `AssetCache` over an R2 bucket. Bytes live in R2; the asset's metadata,
 * `cachedAt`, and `expiresAt` round-trip through R2 `customMetadata` (content
 * type also in `httpMetadata`). Every write is policy-gated; bytes and metadata
 * are cloned/normalized so the input is never mutated.
 */
export class R2AssetCache implements AssetCache {
  readonly #bucket: R2LikeBucket;
  readonly #enforcePolicy: boolean;

  constructor(options: R2AssetCacheOptions) {
    this.#bucket = options.bucket;
    this.#enforcePolicy = options.enforcePolicy ?? true;
  }

  async put(asset: CachedAsset): Promise<void> {
    if (this.#enforcePolicy) {
      const decision = canCacheAsset(asset.metadata);
      if (!decision.allowed) {
        throw new Error(`asset not cacheable: ${decision.reason}`);
      }
    }
    const metadata = normalizeAssetMetadata(asset.metadata);
    const bytes = cloneBytes(asset.bytes);
    const customMetadata: Record<string, string> = {
      [META_KEY]: JSON.stringify(metadata),
      [CACHED_AT_KEY]: String(asset.cachedAt),
      ...(asset.expiresAt !== undefined
        ? { [EXPIRES_AT_KEY]: String(asset.expiresAt) }
        : {}),
    };
    await this.#bucket.put(asset.key, bytes, {
      httpMetadata: { contentType: metadata.contentType },
      customMetadata,
    });
  }

  async get(key: AssetKey, now: number): Promise<CachedAsset | undefined> {
    const obj = await this.#bucket.get(key);
    if (!obj) return undefined;
    const entry = restoreEntry(obj);
    if (!entry) return undefined; // malformed metadata -> miss
    if (entry.expiresAt !== undefined && now >= entry.expiresAt) {
      return undefined; // expired -> miss
    }
    const bytes = await obj.arrayBuffer();
    return {
      key,
      bytes: cloneBytes(bytes),
      metadata: entry.metadata,
      cachedAt: entry.cachedAt,
      ...(entry.expiresAt !== undefined ? { expiresAt: entry.expiresAt } : {}),
    };
  }

  async has(key: AssetKey, now: number): Promise<boolean> {
    const obj = await this.#bucket.head(key);
    if (!obj) return false;
    const entry = restoreEntry(obj);
    if (!entry) return false;
    if (entry.expiresAt !== undefined && now >= entry.expiresAt) return false;
    return true;
  }

  async delete(key: AssetKey): Promise<void> {
    await this.#bucket.delete(key);
  }

  /**
   * Deliberate no-op. R2 has no safe atomic bulk wipe and the bucket may hold
   * objects this adapter did not write; clearing per key is the caller's job.
   */
  async clear(): Promise<void> {
    /* intentionally does nothing — see the doc comment */
  }
}

interface StoredR2 {
  readonly bytes: ArrayBuffer;
  readonly customMetadata?: Record<string, string>;
  readonly httpMetadata?: { readonly contentType?: string };
}

/**
 * In-process `R2LikeBucket` for tests/dev: a plain map, NO network. Records call
 * counts so tests can assert which operations ran.
 */
export class MockR2Bucket implements R2LikeBucket {
  readonly #store = new Map<string, StoredR2>();
  readonly calls = { get: 0, put: 0, head: 0, delete: 0 };

  get size(): number {
    return this.#store.size;
  }

  #toObject(stored: StoredR2): R2LikeObject {
    return {
      arrayBuffer: () => Promise.resolve(stored.bytes),
      ...(stored.customMetadata ? { customMetadata: stored.customMetadata } : {}),
      ...(stored.httpMetadata ? { httpMetadata: stored.httpMetadata } : {}),
    };
  }

  async get(key: string): Promise<R2LikeObject | null> {
    this.calls.get += 1;
    const stored = this.#store.get(key);
    return stored ? this.#toObject(stored) : null;
  }

  async head(key: string): Promise<R2LikeObject | null> {
    this.calls.head += 1;
    const stored = this.#store.get(key);
    return stored ? this.#toObject(stored) : null;
  }

  async put(key: string, value: ArrayBuffer, options?: R2LikePutOptions): Promise<void> {
    this.calls.put += 1;
    this.#store.set(key, {
      bytes: value,
      ...(options?.customMetadata ? { customMetadata: options.customMetadata } : {}),
      ...(options?.httpMetadata ? { httpMetadata: options.httpMetadata } : {}),
    });
  }

  async delete(key: string): Promise<void> {
    this.calls.delete += 1;
    this.#store.delete(key);
  }
}
