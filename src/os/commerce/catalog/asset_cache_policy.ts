/**
 * Runtime Ownership Extraction Arc — Root Cause D fix (vendored copy).
 *
 * Verbatim vendored copy of `src/os/_legacy_prototype/asset/policy.ts` at
 * the time of this fork, paired with `./asset_cache_types.ts`. See that
 * file's header for the full rationale.
 *
 * Stage 22 — pure asset-cache policy.
 *
 * Decides whether an asset may live in the public asset cache and derives a
 * deterministic key for it. All functions are pure: they read the metadata and
 * return a decision / key / normalized copy, and never mutate the input, hit
 * storage, or move bytes.
 *
 * Only `public`/`unlisted` assets with no sensitive tag are cacheable. Anything
 * `private`/`paid`, or tagged dm/secret/key/payment/entitlement, is rejected —
 * purchased originals, DMs, secrets, and payment/entitlement data never belong
 * in this cache.
 */

import type { AssetCacheDecision, AssetMetadata } from "./asset_cache_types.js";

/** Tag tokens that mark an asset as never-cacheable. */
const FORBIDDEN_TAG_TOKENS: ReadonlySet<string> = new Set([
  "dm",
  "secret",
  "key",
  "payment",
  "entitlement",
]);

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
 * True if any tag carries a sensitive token. Tags are split on common separators
 * so namespaced labels ("payment:stripe", "user-secret") are caught while plain
 * words that merely contain a token ("monkey", "keyword") are not.
 */
function hasForbiddenTag(tags: readonly string[]): boolean {
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    for (const segment of tag.toLowerCase().split(/[:\-_/\s.]+/)) {
      if (FORBIDDEN_TAG_TOKENS.has(segment)) return true;
    }
  }
  return false;
}

/** True if the visibility alone permits public caching (public or unlisted). */
export function isPublicCacheable(metadata: AssetMetadata): boolean {
  return metadata.visibility === "public" || metadata.visibility === "unlisted";
}

/**
 * Whether an asset may be cached. Requires a cacheable visibility AND no
 * sensitive tag. Returns a denial with a reason rather than throwing.
 */
export function canCacheAsset(metadata: AssetMetadata): AssetCacheDecision {
  if (!isPublicCacheable(metadata)) {
    return {
      allowed: false,
      reason: `visibility "${metadata.visibility}" is not cacheable`,
    };
  }
  if (hasForbiddenTag(metadata.tags)) {
    return {
      allowed: false,
      reason: "asset carries a sensitive tag (dm/secret/key/payment/entitlement)",
    };
  }
  return {
    allowed: true,
    reason: `${metadata.visibility} ${metadata.kind} is cacheable`,
  };
}

/**
 * Returns a normalized copy of the metadata: content type trimmed/lowercased,
 * size floored to a non-negative integer, and tags trimmed of empties, deduped,
 * and sorted (so keys are order-independent). Does not mutate the input.
 */
export function normalizeAssetMetadata(metadata: AssetMetadata): AssetMetadata {
  const tags = Array.from(
    new Set(
      metadata.tags.filter(
        (tag): tag is string => typeof tag === "string" && tag.length > 0,
      ),
    ),
  ).sort();
  const sizeBytes =
    Number.isFinite(metadata.sizeBytes) && metadata.sizeBytes > 0
      ? Math.floor(metadata.sizeBytes)
      : 0;
  return {
    kind: metadata.kind,
    visibility: metadata.visibility,
    contentType: metadata.contentType.trim().toLowerCase(),
    sizeBytes,
    ...(metadata.checksum !== undefined ? { checksum: metadata.checksum } : {}),
    ...(metadata.source !== undefined ? { source: metadata.source } : {}),
    tags,
    ...(metadata.createdAt !== undefined ? { createdAt: metadata.createdAt } : {}),
    ...(metadata.ttlSeconds !== undefined ? { ttlSeconds: metadata.ttlSeconds } : {}),
  };
}

/**
 * Builds a deterministic key for an asset. Content-addressed when a checksum is
 * present; otherwise derived from the normalized identifying metadata (so tag
 * ordering does not change the key). Does not mutate the input.
 */
export function createAssetKey(metadata: AssetMetadata): string {
  const m = normalizeAssetMetadata(metadata);
  const basis = m.checksum
    ? `checksum:${m.checksum}`
    : JSON.stringify([
        m.kind,
        m.visibility,
        m.contentType,
        m.sizeBytes,
        m.source ?? "",
        m.tags,
      ]);
  return `asset:${fnv1a(basis)}`;
}
