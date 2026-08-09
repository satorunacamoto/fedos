/**
 * Stage 20 / 25 — read-only render helpers for creator products (Stage 17 model).
 *
 * Pure string builders. Every product-derived string (id, kind, title,
 * description, currency, status, visibility, linked space ids) is HTML-escaped.
 * These views are strictly read-only: there is NO destination link, NO buy /
 * checkout / payment affordance, and NO download. Pricing is shown as display
 * metadata only — this layer moves no money and serves no file.
 *
 * Stage 25 adds the directory/page/route surface: `renderProductDirectory`,
 * `renderProductPage`, `renderAssetPreviewList`, `renderProductNotFound`, and
 * `renderProductAccessDenied`. The asset preview list shows PREVIEW metadata for
 * public/unlisted assets ONLY — `private`/`paid` assets are filtered out, no
 * bytes are embedded, and no download/signed-URL/payment affordance is rendered.
 *
 * The product promotion slot is an EMPTY placeholder produced from the Stage 18
 * `buildProductPlacement` bridge; it renders no ad candidate and calls no
 * provider (Mock or EdgeRec) and no network.
 */

import type { ProductAsset } from "../../commerce/catalog/directory.js";
import type { AccessDecision, Product } from "../../commerce/catalog/types.js";
import { buildProductPlacement } from "../promotion/bridge.js";
import { escapeHtml, shortenHex } from "./html.js";
import { renderPromotionPlaceholder } from "./promotion.js";

/** Asset visibilities that may be previewed in a read-only public view. */
const PREVIEWABLE: ReadonlySet<string> = new Set(["public", "unlisted"]);

/** Builds a safe `?product=<id>` href (URL-encoded then attribute-escaped). */
function productHref(id: string, actorPubkey?: string): string {
  let href = `?product=${encodeURIComponent(id)}`;
  if (actorPubkey) href += `&actor=${encodeURIComponent(actorPubkey)}`;
  return escapeHtml(href);
}

/** A small escaped "viewing as <pubkey>" line, or empty when guest. */
function viewingAs(actorPubkey?: string): string {
  if (!actorPubkey) return "";
  return `<p class="viewing-as">viewing as <code>${escapeHtml(shortenHex(actorPubkey))}</code></p>`;
}

/** Formats the display price as `<CURRENCY> <amount>` (metadata only). */
function formatPrice(priceCents: number, currency: string): string {
  const amount = Number.isFinite(priceCents) ? (priceCents / 100).toFixed(2) : "0.00";
  return `${escapeHtml(currency)} ${amount}`;
}

/** A compact, escaped product label: its kind and title. */
export function renderProductLabel(product: Product): string {
  return (
    `<span class="product-label product-${escapeHtml(product.kind)}" ` +
    `title="${escapeHtml(product.id)}">` +
    `<span class="product-kind">${escapeHtml(product.kind)}</span> ` +
    `<span class="product-title">${escapeHtml(product.title)}</span>` +
    `</span>`
  );
}

/**
 * A read-only product summary: title/kind, optional description, price +
 * currency, status, visibility, and linked space ids. No links or actions.
 */
export function renderProductSummary(product: Product): string {
  const desc = product.description
    ? `<p class="product-desc">${escapeHtml(product.description)}</p>`
    : "";
  const spaces =
    product.linkedSpaceIds.length > 0
      ? product.linkedSpaceIds.map((id) => `<code>${escapeHtml(id)}</code>`).join(", ")
      : "—";
  return (
    `<section class="product-summary" data-product="${escapeHtml(product.id)}">` +
    `<h2>${renderProductLabel(product)}</h2>` +
    desc +
    `<dl class="product-meta">` +
    `<dt>price</dt><dd class="product-price">${formatPrice(product.priceCents, product.currency)}</dd>` +
    `<dt>status</dt><dd>${escapeHtml(product.status)}</dd>` +
    `<dt>visibility</dt><dd>${escapeHtml(product.visibility)}</dd>` +
    `<dt>spaces</dt><dd class="product-spaces">${spaces}</dd>` +
    `</dl>` +
    `<p class="product-note">Read-only product listing.</p>` +
    `</section>`
  );
}

/**
 * An EMPTY `product_sidebar` promotion placeholder for a product. Uses the pure
 * `buildProductPlacement` bridge to derive the slot; renders no ad candidate,
 * calls no provider, and touches no network.
 */
export function renderProductPromotionPlaceholder(product: Product): string {
  const request = buildProductPlacement(product);
  return renderPromotionPlaceholder(request.placement, "Promotion placeholder");
}

/**
 * A read-only directory of products, each linking to its `?product=<id>` page.
 * Callers pass the already-filtered viewable set (e.g. `listViewableProducts`);
 * this helper does no access checks. All product-derived text is escaped.
 */
export function renderProductDirectory(
  products: readonly Product[],
  actorPubkey?: string,
): string {
  const header = `<h2>Products</h2>${viewingAs(actorPubkey)}`;
  if (products.length === 0) {
    return `<section class="product-directory">${header}<p class="empty">No products available.</p></section>`;
  }
  const items = products
    .map((product) => {
      const desc = product.description
        ? `<p class="product-desc">${escapeHtml(product.description)}</p>`
        : "";
      return (
        `<li class="product-item">` +
        `<a href="${productHref(product.id, actorPubkey)}">${escapeHtml(product.title)}</a> ` +
        `<span class="product-meta">${escapeHtml(product.kind)} · ` +
        `${escapeHtml(product.status)} · ${escapeHtml(product.visibility)}</span>` +
        desc +
        `</li>`
      );
    })
    .join("");
  return `<section class="product-directory">${header}<ul>${items}</ul></section>`;
}

/**
 * A single asset preview row: descriptive metadata labels only (kind, content
 * type, size, source, checksum, tags). It embeds NO bytes, NO download link,
 * NO signed URL, and NO buy/payment affordance. Every asset-derived string is
 * escaped; the size is a number.
 */
function renderAssetPreview(asset: ProductAsset): string {
  const m = asset.metadata;
  const tags =
    m.tags.length > 0
      ? m.tags.map((t) => `<li class="asset-tag">${escapeHtml(t)}</li>`).join("")
      : "";
  const tagList = tags ? `<ul class="asset-tags">${tags}</ul>` : "";
  const source = m.source
    ? `<dt>source</dt><dd><code>${escapeHtml(m.source)}</code></dd>`
    : "";
  const checksum = m.checksum
    ? `<dt>checksum</dt><dd><code>${escapeHtml(m.checksum)}</code></dd>`
    : "";
  return (
    `<li class="asset-preview asset-${escapeHtml(m.kind)}" ` +
    `data-asset="${escapeHtml(asset.id)}">` +
    `<dl class="asset-meta">` +
    `<dt>kind</dt><dd>${escapeHtml(m.kind)}</dd>` +
    `<dt>visibility</dt><dd>${escapeHtml(m.visibility)}</dd>` +
    `<dt>type</dt><dd>${escapeHtml(m.contentType)}</dd>` +
    `<dt>size</dt><dd>${m.sizeBytes} bytes</dd>` +
    source +
    checksum +
    `</dl>` +
    tagList +
    `<p class="asset-note">Preview metadata only — no file is served here.</p>` +
    `</li>`
  );
}

/**
 * Renders the public/unlisted asset previews for a product. `private` and
 * `paid` assets are filtered out entirely — they are never listed, labeled, or
 * linked. Bytes are never embedded; this is metadata only.
 */
export function renderAssetPreviewList(assets: readonly ProductAsset[]): string {
  const previewable = assets.filter((asset) =>
    PREVIEWABLE.has(asset.metadata.visibility),
  );
  if (previewable.length === 0) {
    return (
      `<section class="asset-previews">` +
      `<h3>Previews</h3>` +
      `<p class="empty">No public previews available.</p>` +
      `</section>`
    );
  }
  const items = previewable.map(renderAssetPreview).join("");
  return (
    `<section class="asset-previews">` +
    `<h3>Previews (${previewable.length})</h3>` +
    `<ul class="asset-preview-list">${items}</ul>` +
    `</section>`
  );
}

/** Options for `renderProductPage`. */
export interface ProductPageOptions {
  /** Render the (empty) promotion placeholder. Default true (sample mode). */
  readonly promotions?: boolean;
  /** Viewer pubkey, shown escaped as a "viewing as" line when present. */
  readonly actorPubkey?: string;
}

/**
 * The read-only product page: summary, the view-decision reason, the
 * public/unlisted asset previews, and (by default) an EMPTY promotion
 * placeholder. Assumes the caller already decided the actor MAY view the
 * product (`viewDecision.allowed`); a denied actor gets `renderProductAccessDenied`
 * instead. No download, payment, signed URL, or destination link is rendered.
 */
export function renderProductPage(
  product: Product,
  viewDecision: AccessDecision,
  assets: readonly ProductAsset[],
  options: ProductPageOptions = {},
): string {
  const showPromotions = options.promotions ?? true;
  const promo = showPromotions ? renderProductPromotionPlaceholder(product) : "";
  return (
    `<section class="product-page" data-product="${escapeHtml(product.id)}">` +
    viewingAs(options.actorPubkey) +
    renderProductSummary(product) +
    `<p class="product-access">access: ${escapeHtml(viewDecision.reason)}</p>` +
    renderAssetPreviewList(assets) +
    promo +
    `<p class="product-back"><a href="?">← back</a></p>` +
    `</section>`
  );
}

/** Shown when `?product=<id>` names a product that does not exist. */
export function renderProductNotFound(productId: string): string {
  return (
    `<section class="product-error">` +
    `<h2>Product not found</h2>` +
    `<p>No product with id <code>${escapeHtml(productId)}</code>.</p>` +
    `</section>`
  );
}

/** Shown when the actor may not view the requested product. */
export function renderProductAccessDenied(
  product: Product,
  decision: AccessDecision,
): string {
  return (
    `<section class="product-error">` +
    `<h2>Access denied</h2>` +
    `<p>${escapeHtml(product.title)}: ${escapeHtml(decision.reason)}</p>` +
    `</section>`
  );
}
