/**
 * Stage 44 — pure bridge between `Product`/`PurchaseGrant` (commerce layer)
 * and the payment boundary. All functions are pure: they read a `Product` or
 * `PaymentDecision` and return a request/decision/grant (or `null`), and
 * never mutate inputs, charge money, contact a rail, or verify a payment.
 *
 * `productToPaymentRequest` never runs for a non-`active` product or a
 * negative price (see `canRequestPaymentForProduct`), and strips any
 * card/wallet/secret-looking metadata before it ever reaches a
 * `PaymentRequest`. `paymentDecisionToGrant` builds a `PurchaseGrant` ONLY
 * from an `accepted_placeholder` decision, and always with `source: "manual"`
 * (or `"promo"`, never `"payment"`) — this boundary never verifies a real
 * payment, so it must never claim one settled.
 *
 * STATUS: inert scaffolding, not reachable from the shipped Electron app.
 */

import type { Product, PurchaseGrant, PurchaseGrantSource } from "../catalog/types.js";
import { sanitizePaymentMetadata } from "./noop_payment.js";
import type { PaymentDecision, PaymentRail, PaymentRequest } from "./types.js";

/** Neutral rail used for the pre-request eligibility check (no rail is chosen yet). */
const DEFAULT_RAIL: PaymentRail = "manual_placeholder";

function decide(
  product: Product,
  allowed: boolean,
  status: PaymentDecision["status"],
  reason: string,
): PaymentDecision {
  return { allowed, status, rail: DEFAULT_RAIL, reason, productId: product.id };
}

/**
 * Whether a payment MAY be requested for this product at all — before any
 * `PaymentRequest` is built. An `active` product with a non-negative price is
 * eligible (`pending`); a draft/archived product or an invalid price is
 * `rejected`. This never contacts a rail; it is a listing-state check only.
 */
export function canRequestPaymentForProduct(product: Product): PaymentDecision {
  if (product.status !== "active") {
    return decide(
      product,
      false,
      "rejected",
      `${product.status} product cannot accept a payment request`,
    );
  }
  if (!Number.isFinite(product.priceCents) || product.priceCents < 0) {
    return decide(product, false, "rejected", "product has an invalid (negative) price");
  }
  return decide(product, true, "pending", "active product with a valid price may request payment");
}

/** Caller-supplied options for building a `PaymentRequest` from a product. */
export interface ProductPaymentRequestOptions {
  readonly rail?: PaymentRail;
  /** Non-secret display metadata; any card/wallet/secret-looking entry is dropped. */
  readonly metadata?: Readonly<Record<string, string>>;
  readonly createdAt?: number;
}

/**
 * Builds a `PaymentRequest` from a product's display price/currency/id, or
 * `null` when `canRequestPaymentForProduct` rejects it (draft/archived
 * status, or a negative price). Never mutates `product` or `options`; any
 * sensitive-looking metadata entry is stripped before it reaches the request.
 */
export function productToPaymentRequest(
  product: Product,
  buyerPubkey?: string,
  options: ProductPaymentRequestOptions = {},
): PaymentRequest | null {
  if (!canRequestPaymentForProduct(product).allowed) return null;

  const metadata = sanitizePaymentMetadata(options.metadata);

  return {
    productId: product.id,
    ...(buyerPubkey !== undefined ? { buyerPubkey } : {}),
    amountCents: product.priceCents,
    currency: product.currency,
    rail: options.rail ?? DEFAULT_RAIL,
    ...(metadata !== undefined ? { metadata } : {}),
    ...(options.createdAt !== undefined ? { createdAt: options.createdAt } : {}),
  };
}

/** A `PurchaseGrant` source this bridge is allowed to produce — never `"payment"`. */
export type PlaceholderGrantSource = Extract<PurchaseGrantSource, "manual" | "promo">;

/** Caller-supplied options for turning an accepted decision into a grant. */
export interface PaymentDecisionToGrantOptions {
  /** Defaults to `"manual"`. This boundary never verifies a real payment, so `"payment"` is not offered here. */
  readonly source?: PlaceholderGrantSource;
  /** Unix seconds. Defaults to `Math.floor(Date.now() / 1000)`. */
  readonly grantedAt?: number;
}

/**
 * Turns a `PaymentDecision` into a `PurchaseGrant`, ONLY when the decision is
 * `accepted_placeholder` (`allowed` and a known `buyerPubkey`) — every other
 * status (`pending`/`rejected`/`unavailable`/`error`) returns `null`. The
 * grant is always `manual`/`promo`-sourced: this boundary never confirms a
 * real payment, so it must never mark a grant as payment-settled.
 */
export function paymentDecisionToGrant(
  decision: PaymentDecision,
  options: PaymentDecisionToGrantOptions = {},
): PurchaseGrant | null {
  if (!decision.allowed || decision.status !== "accepted_placeholder") return null;
  if (decision.buyerPubkey === undefined || decision.buyerPubkey.length === 0) return null;

  return {
    productId: decision.productId,
    buyerPubkey: decision.buyerPubkey,
    grantedAt: options.grantedAt ?? Math.floor(Date.now() / 1000),
    source: options.source ?? "manual",
  };
}
