/**
 * Stage 45 — product purchase preview render helpers (placeholder only).
 *
 * Renders a "Purchase preview" panel from a `Product` and a `PaymentDecision`
 * (Stage 44's `src/payment/`). This is a MOCK of a purchase affordance, not a
 * real one: it shows the product's display price/currency, the placeholder
 * rail name, and a disabled "Checkout disabled" button. It NEVER renders an
 * invoice, a checkout URL, a payment address, a QR code, a wallet secret, a
 * card form, or any "paid"/"settled"/"purchased" claim — no payment is ever
 * processed by this file, and it issues no `fetch`.
 *
 * Every product/decision-derived string (id, title, currency, rail, reason,
 * and any buyer pubkey) is HTML-escaped.
 */

import type { Product } from "../commerce/types.js";
import type { PaymentDecision } from "../payment/types.js";
import { escapeHtml, shortenHex } from "./html.js";

/** Options for `renderPurchasePreview`. */
export interface PurchasePreviewOptions {
  /**
   * A CANDIDATE buyer pubkey shown for display only (e.g. from `?actor=`).
   * Never used to process payment or issue a grant — display metadata only.
   */
  readonly buyerPubkey?: string;
}

/**
 * A small, escaped line disclosing the raw decision: its status, rail, and
 * reason. No invoice/checkout/payment content — a coarse, honest status
 * readout only.
 */
export function renderPaymentDecision(decision: PaymentDecision): string {
  return (
    `<p class="payment-decision" data-status="${escapeHtml(decision.status)}" ` +
    `data-rail="${escapeHtml(decision.rail)}">` +
    `<span class="payment-decision-status">${escapeHtml(decision.status)}</span> — ` +
    `<span class="payment-decision-reason">${escapeHtml(decision.reason)}</span>` +
    `</p>`
  );
}

/**
 * Shown when a purchase preview cannot be offered at all (a draft/archived
 * product, an invalid price, or any non-accepted payment decision). `reason`
 * is escaped; this renders no button and no payment affordance.
 */
export function renderPurchaseUnavailable(reason: string): string {
  return (
    `<section class="purchase-preview purchase-preview-unavailable">` +
    `<h3>Purchase preview unavailable</h3>` +
    `<p class="purchase-unavailable-reason">${escapeHtml(reason)}</p>` +
    `</section>`
  );
}

/**
 * Renders the purchase preview panel for a product given a `PaymentDecision`
 * (typically from `PlaceholderPaymentProvider.requestPayment`, built via
 * `productToPaymentRequest`/`canRequestPaymentForProduct`). When the decision
 * is not `accepted_placeholder` (or not `allowed`), this delegates to
 * `renderPurchaseUnavailable` with the decision's reason.
 *
 * An accepted preview shows: a "Purchase preview" heading, the display
 * price/currency, the placeholder rail name, a "No payment is processed"
 * note, and a DISABLED "Checkout disabled" button. It NEVER renders an
 * invoice, checkout URL, payment address, QR code, wallet secret, card form,
 * or a "paid"/"settled"/"purchased" claim — and it never calls
 * `paymentDecisionToGrant` or issues a grant.
 */
export function renderPurchasePreview(
  product: Product,
  decision: PaymentDecision,
  options: PurchasePreviewOptions = {},
): string {
  if (!decision.allowed || decision.status !== "accepted_placeholder") {
    return renderPurchaseUnavailable(decision.reason);
  }

  const amount = Number.isFinite(product.priceCents)
    ? (product.priceCents / 100).toFixed(2)
    : "0.00";
  const buyer = options.buyerPubkey
    ? `<p class="purchase-buyer-candidate">buyer candidate: ` +
      `<code>${escapeHtml(shortenHex(options.buyerPubkey))}</code></p>`
    : "";

  return (
    `<section class="purchase-preview" data-product="${escapeHtml(product.id)}">` +
    `<h3>Purchase preview</h3>` +
    `<dl class="purchase-preview-meta">` +
    `<dt>price</dt><dd>${escapeHtml(product.currency)} ${amount}</dd>` +
    `<dt>rail</dt><dd>${escapeHtml(decision.rail)}</dd>` +
    `</dl>` +
    buyer +
    renderPaymentDecision(decision) +
    `<p class="purchase-preview-note">No payment is processed.</p>` +
    `<button type="button" disabled class="purchase-checkout-disabled">Checkout disabled</button>` +
    `</section>`
  );
}
