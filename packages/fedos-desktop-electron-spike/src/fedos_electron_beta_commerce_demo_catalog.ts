/**
 * Commerce Reachable Catalog + Product Surface, Phase 1.
 *
 * Deterministic, repository-authored, fictional demo catalog for the
 * FIRST reachable Commerce vertical slice in the shipped FedOS Desktop
 * app. No real customer/business data — every product, merchant, and
 * image here is synthetic and safe to ship in this repository.
 *
 * Deliberately NOT reusing `src/os/commerce/catalog/sample_products.ts`
 * (the pre-pivot Stage 25 fixtures: `guide-pdf`/`pro-pack`/`draft-kit`)
 * — those exist to exercise visibility/grant edge cases (private,
 * draft, grant-gated) for the *domain layer's own* tests, not to be a
 * customer-facing storefront demo. This is a separate, purpose-built
 * catalog: 3 active/public products, 2 distinct merchant personas, one
 * product with an image and two without (missing-image fallback gets
 * DOUBLE coverage, per this arc's acceptance bar of "at least one").
 *
 * `Product.creatorPubkey` here is a synthetic, deterministic hex string
 * (never a real key) — this package never signs or publishes anything
 * with it; it exists only to satisfy the real `Product` type's shape
 * from `os/commerce` and to key the merchant display-label lookup
 * below.
 *
 * Media: `Product`/`AssetMetadata` (the real `os/commerce` domain types)
 * carry no image bytes anywhere today (confirmed: `AssetMetadata` has
 * `contentType`/`sizeBytes`/`checksum`/opaque `source`, never real
 * bytes or a data URI). Rather than widen the commerce DOMAIN model for
 * one demo slice, media is kept entirely at THIS composition/adapter
 * layer — a plain `productId -> ProductMediaImage` map the Electron
 * main process consults when assembling the DTO it sends to the
 * renderer over IPC. This keeps `src/os/commerce/**` completely
 * untouched (zero risk to its existing boundary tests) while still
 * shipping a real, safely-rendered image for one product.
 */

import { FEDOS_COMMERCE_DEMO_MEDIA_AURORA_STUDY } from "./fedos_electron_beta_commerce_demo_media.js";

/** Mirrors `Product` from `src/os/commerce/catalog/types.ts` structurally (see that file's own header for the real, canonical shape). */
export interface FedosCommerceDemoProduct {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly description?: string;
  readonly creatorPubkey: string;
  readonly priceCents: number;
  readonly currency: string;
  readonly status: string;
  readonly visibility: string;
  readonly linkedSpaceIds: readonly string[];
  readonly linkedEventIds: readonly string[];
  readonly assetIds: readonly string[];
}

export interface FedosCommerceDemoProductMediaImage {
  readonly kind: "image";
  readonly dataUri: string;
  readonly mimeType: string;
  readonly contentHash: string;
  readonly sizeBytes: number;
  readonly altText: string;
}

const MERCHANT_NORTHLIGHT = "a".repeat(64);
const MERCHANT_RIVERBEND = "b".repeat(64);

/** Merchant persona -> a coarse, human-readable display label (never a real business). */
export const FEDOS_COMMERCE_DEMO_MERCHANT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  [MERCHANT_NORTHLIGHT]: "Northlight Studio",
  [MERCHANT_RIVERBEND]: "Riverbend Makerspace",
});

export const FEDOS_COMMERCE_DEMO_PRODUCTS: readonly FedosCommerceDemoProduct[] = Object.freeze([
  Object.freeze({
    id: "aurora-study",
    kind: "other",
    title: "Digital Art Print — Aurora Study",
    description: "A limited digital print exploring a violet-to-amber gradient. Demo listing only.",
    creatorPubkey: MERCHANT_NORTHLIGHT,
    priceCents: 1800,
    currency: "USD",
    status: "active",
    visibility: "public",
    linkedSpaceIds: [],
    linkedEventIds: [],
    assetIds: ["aurora-study-image"],
  }),
  Object.freeze({
    id: "terra-keycaps",
    kind: "other",
    title: "Mechanical Keyboard Keycap Set — Terra",
    description: "An earth-toned artisan keycap set, 104 keys. Demo listing only.",
    creatorPubkey: MERCHANT_NORTHLIGHT,
    priceCents: 6500,
    currency: "USD",
    status: "active",
    visibility: "public",
    linkedSpaceIds: [],
    linkedEventIds: [],
    assetIds: [],
  }),
  Object.freeze({
    id: "workshop-woodworking-intro",
    kind: "other",
    title: "Local Workshop Ticket — Intro to Woodworking",
    description: "One seat at a beginner-friendly, in-person woodworking session. Demo listing only.",
    creatorPubkey: MERCHANT_RIVERBEND,
    priceCents: 4500,
    currency: "USD",
    status: "active",
    visibility: "public",
    linkedSpaceIds: [],
    linkedEventIds: [],
    assetIds: [],
  }),
]);

/** productId -> image media. Products absent from this map render the missing-image fallback. */
export const FEDOS_COMMERCE_DEMO_PRODUCT_MEDIA: Readonly<Record<string, FedosCommerceDemoProductMediaImage>> = Object.freeze({
  "aurora-study": Object.freeze({
    kind: "image",
    dataUri: FEDOS_COMMERCE_DEMO_MEDIA_AURORA_STUDY.dataUri,
    mimeType: FEDOS_COMMERCE_DEMO_MEDIA_AURORA_STUDY.mimeType,
    contentHash: FEDOS_COMMERCE_DEMO_MEDIA_AURORA_STUDY.contentHash,
    sizeBytes: FEDOS_COMMERCE_DEMO_MEDIA_AURORA_STUDY.sizeBytes,
    altText: FEDOS_COMMERCE_DEMO_MEDIA_AURORA_STUDY.altText,
  }),
});

export function fedosCommerceDemoMerchantLabel(creatorPubkey: string): string {
  return FEDOS_COMMERCE_DEMO_MERCHANT_LABELS[creatorPubkey] ?? "Unknown merchant";
}
