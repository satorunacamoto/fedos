/**
 * Stage 114 — Marketplace listing preview UI skeleton (read-only, opt-in).
 *
 * Pure string builders showing a `MarketplaceListingDescriptor`
 * (`src/marketplace/types.ts`) as a read-only preview page — sample/static
 * data only, gated behind an explicit `?marketplacePreview=1` flag in the
 * Worker (see `src/worker.ts`). Every listing-derived string is
 * HTML-escaped.
 *
 * NEVER rendered here (the type itself has no such field, see
 * `docs/marketplace_boundary.md`): a price, payment method, checkout/
 * session reference, download URL, or signed URL. The one "buy" affordance
 * this page renders is a permanently `disabled` button — clicking it does
 * nothing, and no `MarketplaceProvider`/`PaymentProvider` is ever called
 * from this file.
 *
 * `marketplaceListingToNostrCandidate` (Stage 113,
 * `src/federation/nostr_mapping.ts`) is a PURE, unsigned mapping function —
 * calling it here to show a listing's candidate `kindLabel` opens no relay
 * and sends nothing.
 */

import { marketplaceListingToNostrCandidate } from "../federation/nostr_mapping.js";
import type { MarketplaceListingDescriptor } from "../marketplace/types.js";
import { escapeHtml } from "./html.js";

/** Static sample listings for the preview page. Never fetched, never live. */
export const SAMPLE_LISTINGS: readonly MarketplaceListingDescriptor[] = [
  {
    idRef: "listing-ebook-1",
    creatorRef: "creator-alice",
    kind: "digital_product_placeholder",
    visibility: "public",
    metadata: { category: "guide" },
  },
  {
    idRef: "listing-membership-1",
    creatorRef: "creator-bob",
    kind: "membership_placeholder",
    visibility: "public",
  },
  {
    idRef: "listing-tip-1",
    creatorRef: "creator-carol",
    kind: "tip_placeholder",
    visibility: "unlisted",
  },
];

/**
 * A single listing's read-only preview: kind, visibility, creator/id
 * references, and (when the PURE `marketplaceListingToNostrCandidate`
 * mapping accepts it) its candidate `kindLabel` only. Ends with a
 * permanently `disabled` "buy" placeholder button — no purchase flow, no
 * price, no checkout, no download.
 */
export function renderMarketplaceListingPreview(
  listing: MarketplaceListingDescriptor,
): string {
  const mapping = marketplaceListingToNostrCandidate(listing);
  const nostrRow =
    mapping.allowed && mapping.candidate
      ? `<dt>nostr candidate</dt><dd><code>${escapeHtml(mapping.candidate.kindLabel)}</code></dd>`
      : "";
  const creatorRow = listing.creatorRef
    ? `<dt>creator</dt><dd><code>${escapeHtml(listing.creatorRef)}</code></dd>`
    : "";
  return (
    `<li class="marketplace-preview-item" data-listing="${escapeHtml(listing.idRef ?? "")}">` +
    `<dl class="marketplace-preview-meta">` +
    `<dt>kind</dt><dd>${escapeHtml(listing.kind)}</dd>` +
    `<dt>visibility</dt><dd>${escapeHtml(listing.visibility)}</dd>` +
    creatorRow +
    nostrRow +
    `</dl>` +
    `<button type="button" class="marketplace-buy-button" disabled ` +
    `title="Preview only — purchasing is not implemented">Buy (preview only)</button>` +
    `</li>`
  );
}

/**
 * The full read-only marketplace preview page: a note explaining it is
 * preview-only, then each listing's preview. NO purchase form, NO checkout,
 * NO price, NO download/signed URL exists anywhere on this page.
 */
export function renderMarketplacePreviewPage(
  listings: readonly MarketplaceListingDescriptor[],
): string {
  const items = listings.map(renderMarketplaceListingPreview).join("");
  return (
    `<section class="marketplace-preview-page">` +
    `<h2>Marketplace preview</h2>` +
    `<p class="marketplace-preview-note">Read-only sample preview — no purchase, ` +
    `payment, or download happens from this page.</p>` +
    `<ul class="marketplace-preview-list">${items}</ul>` +
    `</section>`
  );
}
