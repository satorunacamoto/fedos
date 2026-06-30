/**
 * Stage 20 — read-only render helpers for creator products (Stage 17 model).
 *
 * Pure string builders. Every product-derived string (id, kind, title,
 * description, currency, status, visibility, linked space ids) is HTML-escaped.
 * These views are strictly read-only: there is NO destination link, NO buy /
 * checkout / payment affordance, and NO download. Pricing is shown as display
 * metadata only — this layer moves no money and serves no file.
 *
 * The product promotion slot is an EMPTY placeholder produced from the Stage 18
 * `buildProductPlacement` bridge; it renders no ad candidate and calls no
 * provider (Mock or EdgeRec) and no network.
 */

import type { Product } from "../commerce/types.js";
import { buildProductPlacement } from "../promotion/bridge.js";
import { escapeHtml } from "./html.js";
import { renderPromotionPlaceholder } from "./promotion.js";

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
