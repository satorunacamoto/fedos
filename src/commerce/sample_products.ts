/**
 * Stage 25 — fixed sample products + grants + asset metadata for the read-only
 * demo. Not real listings: just enough variety (a public guide, a private pro
 * pack with a grant holder, a creator-only draft) to exercise the product
 * directory, the `?product=<id>` page, and the public/unlisted asset preview
 * filter.
 *
 * The asset metadata here is PREVIEW metadata only — it carries no bytes. Each
 * product mixes public/unlisted previews (shown) with a `paid` original
 * (hidden): this layer never surfaces, fetches, or delivers a purchased file.
 */

import type { ProductAsset } from "./directory.js";
import type { Product, PurchaseGrant } from "./types.js";

/** Creator who owns the sample products. */
export const SAMPLE_PRODUCT_CREATOR = "f".repeat(64);
/** A buyer who holds a valid grant for the private "pro-pack" product. */
export const SAMPLE_PRODUCT_BUYER = "1".repeat(64);

export const SAMPLE_PRODUCTS: Product[] = [
  {
    id: "guide-pdf",
    kind: "pdf",
    title: "Field Guide (PDF)",
    description: "A public field guide. Preview metadata only here.",
    creatorPubkey: SAMPLE_PRODUCT_CREATOR,
    priceCents: 500,
    currency: "USD",
    status: "active",
    visibility: "public",
    linkedSpaceIds: ["lounge"],
    linkedEventIds: [],
    assetIds: ["asset-guide-thumb", "asset-guide-preview", "asset-guide-full"],
  },
  {
    id: "pro-pack",
    kind: "zip",
    title: "Pro Pack (ZIP)",
    description: "A private bundle — visible to the creator and grant holders.",
    creatorPubkey: SAMPLE_PRODUCT_CREATOR,
    priceCents: 2500,
    currency: "USD",
    status: "active",
    visibility: "private",
    linkedSpaceIds: ["vault"],
    linkedEventIds: [],
    assetIds: ["asset-pro-preview", "asset-pro-full"],
  },
  {
    id: "draft-kit",
    kind: "template",
    title: "Draft Template Kit",
    description: "A work-in-progress draft — visible to its creator only.",
    creatorPubkey: SAMPLE_PRODUCT_CREATOR,
    priceCents: 0,
    currency: "USD",
    status: "draft",
    visibility: "public",
    linkedSpaceIds: [],
    linkedEventIds: [],
    assetIds: ["asset-kit-thumb"],
  },
];

/** External entitlement: the sample buyer may view the private pro-pack. */
export const SAMPLE_GRANTS: PurchaseGrant[] = [
  {
    productId: "pro-pack",
    buyerPubkey: SAMPLE_PRODUCT_BUYER,
    grantedAt: 1_700_000_000,
    source: "manual",
  },
];

/**
 * Descriptive asset metadata for the sample products (no bytes). Each product
 * deliberately includes a `paid` original alongside its public/unlisted
 * previews so the preview filter can be seen to HIDE the paid/private entries.
 */
export const SAMPLE_ASSET_METADATA: ProductAsset[] = [
  {
    id: "asset-guide-thumb",
    metadata: {
      kind: "thumbnail",
      visibility: "public",
      contentType: "image/png",
      sizeBytes: 2048,
      checksum: "sha256:guide-thumb",
      source: "demo:guide",
      tags: ["cover"],
    },
  },
  {
    id: "asset-guide-preview",
    metadata: {
      kind: "preview",
      visibility: "unlisted",
      contentType: "application/pdf",
      sizeBytes: 10240,
      checksum: "sha256:guide-preview",
      source: "demo:guide",
      tags: ["sample", "first-pages"],
    },
  },
  {
    id: "asset-guide-full",
    metadata: {
      // The purchased original — never previewed, never delivered here.
      kind: "other",
      visibility: "paid",
      contentType: "application/pdf",
      sizeBytes: 1_048_576,
      checksum: "sha256:guide-full",
      source: "demo:guide",
      tags: ["original"],
    },
  },
  {
    id: "asset-pro-preview",
    metadata: {
      kind: "preview",
      visibility: "public",
      contentType: "image/jpeg",
      sizeBytes: 4096,
      checksum: "sha256:pro-preview",
      source: "demo:pro",
      tags: ["sample"],
    },
  },
  {
    id: "asset-pro-full",
    metadata: {
      kind: "other",
      visibility: "paid",
      contentType: "application/zip",
      sizeBytes: 5_242_880,
      checksum: "sha256:pro-full",
      source: "demo:pro",
      tags: ["original"],
    },
  },
  {
    id: "asset-kit-thumb",
    metadata: {
      kind: "thumbnail",
      visibility: "public",
      contentType: "image/png",
      sizeBytes: 1024,
      checksum: "sha256:kit-thumb",
      source: "demo:kit",
      tags: ["wip"],
    },
  },
];
