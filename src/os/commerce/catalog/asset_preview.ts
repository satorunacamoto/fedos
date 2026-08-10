/**
 * Stage 35 — resolve a product's PREVIEW asset metadata from the runtime.
 *
 * The Stage 25 product page rendered fixed sample `ProductAsset` metadata. This
 * helper lets the `?product=<id>` route ALSO consult the runtime's `AssetCache`
 * for preview metadata, while keeping the exact same guarantees:
 *
 *   - METADATA ONLY. A cache hit contributes `cached.metadata` and nothing else —
 *     the asset's bytes are NEVER read into a `ProductAsset` and never reach the
 *     render/HTML layer. There is no download, signed URL, delivery, or payment.
 *   - PUBLIC / UNLISTED ONLY. `private` and `paid` assets — and anything tagged
 *     sensitive (dm/secret/key/payment/entitlement) — are filtered out and never
 *     listed, labeled, or linked. The filter reuses the Stage 22 cache policy.
 *   - SAMPLE FALLBACK. The fixed sample metadata is the baseline; the cache only
 *     OVERRIDES an entry on a hit. A cache miss or a cache error is swallowed and
 *     the sample metadata is used instead.
 *   - PURE-ish: it never mutates the product, the sample list, or a cached asset.
 *
 * The cache is consulted ONLY when a caller passes one (the product route does).
 * The board / directory paths call this helper without a cache, so no asset
 * lookup happens there.
 *
 * STATUS: inert scaffolding, not reachable from the shipped Electron app.
 */

import type { AssetCache, AssetMetadata } from "./asset_cache_types.js";
import { canCacheAsset } from "./asset_cache_policy.js";
import type { ProductAsset } from "./directory.js";
import type { Product } from "./types.js";

/**
 * True if this metadata may be shown as a public read-only preview: a
 * `public`/`unlisted` visibility AND no sensitive tag. Reuses the Stage 22
 * asset-cache policy so `private`/`paid` and dm/secret/key/payment/entitlement
 * tagged assets are excluded consistently.
 */
export function isPreviewAssetVisible(metadata: AssetMetadata): boolean {
  return canCacheAsset(metadata).allowed;
}

/**
 * Keep an asset only if it is previewable, returning a fresh metadata-only
 * `ProductAsset` (never the bytes — a `ProductAsset` has none). Returns `null`
 * for a `private`/`paid`/sensitive asset. Does not mutate the input.
 */
export function filterPreviewAssetMetadata(asset: ProductAsset): ProductAsset | null {
  if (!isPreviewAssetVisible(asset.metadata)) return null;
  return { id: asset.id, metadata: asset.metadata };
}

/**
 * Resolve the previewable asset metadata for a product, in `product.assetIds`
 * order. For each id: start from the sample metadata, then — if an `assetCache`
 * is supplied — try `assetCache.get(id, now)` and, on a hit, use the cached
 * asset's METADATA ONLY (its bytes are discarded). A cache miss or a thrown cache
 * error leaves the sample fallback in place. Ids with no metadata anywhere are
 * skipped, and `private`/`paid`/sensitive assets are filtered out. Never mutates
 * the product, the sample list, or a cached asset.
 */
export async function resolveProductAssetPreviews(
  product: Product,
  assetMetadataList: readonly ProductAsset[],
  assetCache?: AssetCache,
  now: number = Date.now(),
): Promise<ProductAsset[]> {
  // Index the sample metadata that belongs to this product (the baseline).
  const wantedIds = new Set(product.assetIds);
  const sampleById = new Map<string, ProductAsset>();
  for (const asset of assetMetadataList) {
    if (wantedIds.has(asset.id)) sampleById.set(asset.id, asset);
  }

  const previews: ProductAsset[] = [];
  for (const assetId of product.assetIds) {
    let entry = sampleById.get(assetId);

    if (assetCache) {
      try {
        const cached = await assetCache.get(assetId, now);
        if (cached) {
          // Metadata ONLY — the cached bytes are deliberately discarded here.
          entry = { id: assetId, metadata: cached.metadata };
        }
        // A miss (undefined) keeps the sample fallback.
      } catch {
        // A cache error is swallowed; the sample fallback stands.
      }
    }

    if (!entry) continue; // no metadata from cache or sample -> skip this id
    const visible = filterPreviewAssetMetadata(entry);
    if (visible) previews.push(visible);
  }

  return previews;
}
