/**
 * Stage 22 — asset cache boundary (types only).
 *
 * A cache for PUBLIC, non-sensitive media: previews, thumbnails, images, audio,
 * and video segments that may be served to anyone. It is deliberately a SEPARATE
 * boundary from the event cache and is designed so an R2 / HTTP / local / MeshKV
 * implementation can drop in later behind `AssetCache`.
 *
 * SCOPE GUARDRAILS: this layer is for public/unlisted assets only. It must NEVER
 * hold private or paid content, DM payloads, secrets, key material, payment, or
 * entitlement data — the policy in `policy.ts` rejects those, and the in-memory
 * implementation enforces it. MeshKV and R2 are NOT implemented in this stage.
 */

/** What sort of public media an asset is. */
export type AssetKind =
  | "image"
  | "video_segment"
  | "audio"
  | "preview"
  | "thumbnail"
  | "html_fragment"
  | "other";

/**
 * - public:   servable to anyone (cacheable).
 * - unlisted: servable to anyone who knows the key/URL (cacheable).
 * - private:  NOT cacheable here.
 * - paid:     NOT cacheable here (purchased originals never live in this cache).
 */
export type AssetVisibility = "public" | "unlisted" | "private" | "paid";

/** Descriptive metadata for an asset. Never includes the bytes themselves. */
export interface AssetMetadata {
  readonly kind: AssetKind;
  readonly visibility: AssetVisibility;
  /** MIME type, e.g. "image/png" (normalized to lowercase). */
  readonly contentType: string;
  /** Size of the payload in bytes (display/limit metadata). */
  readonly sizeBytes: number;
  /** Optional content hash, used for content-addressed keys when present. */
  readonly checksum?: string;
  /** Optional opaque origin pointer (e.g. a relay/event/space ref). */
  readonly source?: string;
  /** Free-form labels. A sensitive label (dm/secret/key/payment/…) blocks caching. */
  readonly tags: readonly string[];
  /** Unix ms the asset was produced, when known. */
  readonly createdAt?: number;
  /** Advisory time-to-live in seconds for cache entries. */
  readonly ttlSeconds?: number;
}

/** Deterministic, opaque cache key derived from an asset's metadata. */
export type AssetKey = string;

/** A stored asset: its bytes plus metadata and cache timing. */
export interface CachedAsset {
  readonly key: AssetKey;
  /** Raw payload. Bytes only — no decoding, no decryption. */
  readonly bytes: ArrayBuffer;
  readonly metadata: AssetMetadata;
  /** Unix ms when stored. */
  readonly cachedAt: number;
  /** Unix ms when this entry expires; absent means no expiry. */
  readonly expiresAt?: number;
}

/** Result of a cache-eligibility check: the answer plus a human-readable reason. */
export interface AssetCacheDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

/**
 * Async key/value store for public assets. Async so an R2 / HTTP / MeshKV-backed
 * implementation can drop in behind the same interface. `now` is injected into
 * `get`/`has` so expiry is deterministic and testable.
 */
export interface AssetCache {
  get(key: AssetKey, now: number): Promise<CachedAsset | undefined>;
  put(asset: CachedAsset): Promise<void>;
  has(key: AssetKey, now: number): Promise<boolean>;
  delete(key: AssetKey): Promise<void>;
  clear(): Promise<void>;
}
