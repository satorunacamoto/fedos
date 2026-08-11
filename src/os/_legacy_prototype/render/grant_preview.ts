/**
 * Stage 48 — product grant preview render helpers (display only, no grant).
 *
 * Shows what a `PurchaseGrant` (see `src/commerce/types.ts`) WOULD look like
 * if one were ever issued from an `accepted_placeholder` `PaymentDecision`
 * (Stage 44's `src/payment/`) — WITHOUT ever calling
 * `paymentDecisionToGrant` and WITHOUT issuing a real `PurchaseGrant`. This is
 * a preview of a future step, not the step itself: `GrantPreviewView.source`
 * is always `"preview_only"` and `.access` is always `"not_granted"`.
 *
 * This file NEVER claims a payment was made, settled, or that a purchase
 * completed, bought, or was owned, and it NEVER claims access/entitlement/
 * download was granted or unlocked. Copy is deliberately "Preview only." /
 * "No PurchaseGrant has been issued." / "No access has been granted." — each
 * as its own explicit sentence (Stage 56 polish; previously combined into one
 * run-on sentence). Every product/decision/actor-derived string is
 * HTML-escaped.
 */

import type { Product } from "../../commerce/catalog/types.js";
import type { PaymentDecision } from "../../commerce/payment/types.js";
import { escapeHtml, shortenHex } from "./html.js";

/**
 * Fixed, honest explanation of what this preview is (and is not) — two
 * explicit, separately-matchable sentences. The standalone "Preview only."
 * notice is rendered separately in `renderGrantPreview`, so it is not
 * repeated here.
 */
const PREVIEW_REASON = "No PurchaseGrant has been issued. No access has been granted.";

/**
 * A DISPLAY-ONLY view of what a grant record might look like. `source` is
 * always `"preview_only"` (never `"manual"`/`"payment"`/`"promo"` — those are
 * real `PurchaseGrantSource` values this preview must never impersonate) and
 * `access` is always `"not_granted"`. This is intentionally NOT a
 * `PurchaseGrant` — it carries no `grantedAt` entitlement semantics, so it can
 * never be mistaken for one at the type level.
 */
export interface GrantPreviewView {
  readonly productId: string;
  readonly productTitle: string;
  readonly actorPubkey?: string;
  readonly source: "preview_only";
  readonly access: "not_granted";
  readonly reason: string;
  /** Unix timestamp (seconds) the preview was built, when known. */
  readonly createdAt?: number;
}

/**
 * Builds a `GrantPreviewView` ONLY when `decision` is an allowed
 * `accepted_placeholder` — every other status (`pending`/`rejected`/
 * `unavailable`/`error`) returns `null`. Never calls `paymentDecisionToGrant`
 * and never constructs a `PurchaseGrant`. Pure: does not mutate `product` or
 * `decision`. `now` defaults to the current time and is injectable for tests.
 */
export function buildGrantPreview(
  product: Product,
  decision: PaymentDecision,
  actorPubkey?: string,
  now: number = Date.now(),
): GrantPreviewView | null {
  if (!decision.allowed || decision.status !== "accepted_placeholder") return null;
  return {
    productId: product.id,
    productTitle: product.title,
    ...(actorPubkey ? { actorPubkey } : {}),
    source: "preview_only",
    access: "not_granted",
    reason: PREVIEW_REASON,
    createdAt: Math.floor(now / 1000),
  };
}

/**
 * Renders the grant preview panel. Shows the product, the fixed
 * `preview_only`/`not_granted` fields, and an escaped buyer preview reference
 * (when present) — never a `PurchaseGrant`, never an entitlement, never a
 * download/signed-URL affordance. Every string is HTML-escaped.
 */
export function renderGrantPreview(view: GrantPreviewView): string {
  const actor = view.actorPubkey
    ? `<p class="grant-preview-actor">buyer preview reference: ` +
      `<code>${escapeHtml(shortenHex(view.actorPubkey))}</code></p>`
    : "";
  return (
    `<section class="grant-preview" data-product="${escapeHtml(view.productId)}" ` +
    `data-testid="grant-preview" aria-label="Grant preview, preview only">` +
    `<h3>Grant preview</h3>` +
    `<p class="grant-preview-note">Preview only.</p>` +
    `<dl class="grant-preview-meta">` +
    `<dt>product</dt><dd>${escapeHtml(view.productTitle)}</dd>` +
    `<dt>source</dt><dd>${escapeHtml(view.source)}</dd>` +
    `<dt>access</dt><dd>${escapeHtml(view.access)}</dd>` +
    `</dl>` +
    actor +
    `<p class="grant-preview-reason">${escapeHtml(view.reason)}</p>` +
    `</section>`
  );
}

/**
 * Shown when a grant preview cannot be offered (any non-`accepted_placeholder`
 * decision). `reason` is escaped; this renders no grant fields at all.
 */
export function renderGrantPreviewUnavailable(reason: string): string {
  return (
    `<section class="grant-preview grant-preview-unavailable" ` +
    `data-testid="grant-preview-unavailable" aria-label="Grant preview unavailable">` +
    `<h3>Grant preview unavailable</h3>` +
    `<p class="grant-preview-unavailable-reason">${escapeHtml(reason)}</p>` +
    `</section>`
  );
}
