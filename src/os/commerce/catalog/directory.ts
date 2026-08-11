/**
 * Stage 25 — read-only product directory + lookup helpers.
 *
 * A `ProductDirectory` is a source of `Product` definitions, mirroring the
 * Stage 11 space directory. The lookup/filter helpers are pure functions over a
 * product array so callers can use them without a directory instance.
 *
 * A `ProductAsset` pairs an asset id with its public `AssetMetadata` (Stage 22).
 * This layer surfaces PREVIEW metadata only — it resolves no bytes, serves no
 * file, and exposes no download/signed-URL/payment path.
 *
 * STATUS: inert scaffolding, not reachable from the shipped Electron app.
 */

import type { AssetMetadata } from "./asset_cache_types.js";
import { canViewProduct } from "./policy.js";
import type { Product, PurchaseGrant } from "./types.js";

/** An asset id paired with its descriptive metadata (no bytes). */
export interface ProductAsset {
  readonly id: string;
  readonly metadata: AssetMetadata;
}

/** A source of product definitions (synchronous, process-local). */
export interface ProductDirectory {
  list(): readonly Product[];
  get(id: string): Product | undefined;
}

/** Process-local directory backed by a fixed array. */
export class InMemoryProductDirectory implements ProductDirectory {
  readonly #products: readonly Product[];

  constructor(products: readonly Product[]) {
    this.#products = [...products];
  }

  list(): readonly Product[] {
    return this.#products;
  }

  get(id: string): Product | undefined {
    return findProductById(this.#products, id);
  }
}

/** Finds a product by exact id, or undefined. */
export function findProductById(
  products: readonly Product[],
  id: string,
): Product | undefined {
  return products.find((product) => product.id === id);
}

/**
 * Products the actor may view (per `canViewProduct`). A guest is an empty/omitted
 * pubkey; grants only matter for private products. Does not mutate the input.
 */
export function listViewableProducts(
  products: readonly Product[],
  actorPubkey = "",
  grants: readonly PurchaseGrant[] = [],
): Product[] {
  return products.filter(
    (product) => canViewProduct(actorPubkey, product, grants).allowed,
  );
}

/**
 * The asset entries that back a product, selected by `product.assetIds`. Unknown
 * ids are ignored; order follows the asset list. Does not mutate the input.
 */
export function getProductAssets(
  product: Product,
  assetMetadataList: readonly ProductAsset[],
): ProductAsset[] {
  const ids = new Set(product.assetIds);
  return assetMetadataList.filter((asset) => ids.has(asset.id));
}
