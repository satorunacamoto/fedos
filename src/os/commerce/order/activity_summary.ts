/**
 * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc,
 * Agent D — friction-ledger row #14 / arc §32/§36: the pure counting logic
 * behind the real activity/badge data query
 * (`handleCommerceActivitySummary()`, `fedos_electron_beta_main.cts`).
 * Split out into its own pure, testable function rather than left inline
 * in the Electron composition root, mirroring this codebase's own
 * established "domain logic stays pure and testable; the composition root
 * only wires real repositories into it" discipline.
 *
 * Deliberately reads only the closed `OrderStatus` vocabulary
 * (`../order/order_types.js`) — never re-derives or duplicates any Order
 * state-machine rule, and never mutates anything.
 *
 * FedOS Commerce "Purchase Completion" mega-arc (Agent U) — added the
 * seller `unpaid` bucket. Before this change, `CommerceSellerActivitySummary`
 * had NO bucket for "accepted" orders (a merchant's own real question:
 * "which are unpaid?"), even though the renderer's separate, UNTESTED
 * `COMMERCE_ATTENTION_STATUS_LABELS`/`renderCommerceMerchantAttention()`
 * (`fedos_electron_beta_renderer.ts`) already displayed exactly this bucket
 * under the label "Accepted — awaiting buyer payment" — two parallel,
 * divergent implementations of the same concept, only one of which was
 * ever tested. This file remains the ONE tested source of truth; the
 * renderer is being wired to read `unpaid` from here instead of
 * re-deriving it inline (see that file's own updated comments).
 *
 * Integration seam for the Coordinator: Agent P (payment transport) may
 * change WHAT produces the `"paid"` transition (a real settlement instead
 * of the local simulator) but never the `OrderStatus` vocabulary itself —
 * this module reads only `order.status`, so no change is expected here
 * when Agent P lands, only in whatever calls `applyOrderAction()`.
 */

/** Structural mirror of the real `Order` shape — only the field this function reads. */
export interface CommerceActivitySummaryOrderLike {
  readonly id: string;
  readonly status: string;
}

export interface CommerceBuyerActivitySummary {
  readonly draft: number;
  readonly awaitingSellerAcceptance: number;
  readonly readyToPay: number;
  readonly inFulfillment: number;
  readonly readyToAcknowledge: number;
  readonly readyToComplete: number;
  readonly readyReceipts: number;
}

export interface CommerceSellerActivitySummary {
  readonly newSubmitted: number;
  /**
   * FedOS Commerce "Purchase Completion" mega-arc (Agent U) — orders this
   * seller accepted but that are still waiting on the buyer to pay
   * (`OrderStatus === "accepted"`). Answers the seller's own "which are
   * unpaid?" question — previously only shown by the renderer's separate,
   * untested attention-list copy ("Accepted — awaiting buyer payment"),
   * never by this tested summary.
   */
  readonly unpaid: number;
  readonly paidReadyToFulfill: number;
  readonly fulfillingInProgress: number;
  readonly completedAwaitingReceipt: number;
}

function countByStatus(orders: readonly CommerceActivitySummaryOrderLike[], status: string): number {
  return orders.filter((order) => order.status === status).length;
}

/**
 * Buyer-role counts for `orders` (already filtered by the caller to "orders
 * where this actor is the buyer" — this function performs no filtering of
 * its own). `hasReceipt(orderId)` lets the caller inject a real durable
 * receipt-store lookup without this function depending on any persistence
 * concept directly.
 */
export function computeCommerceBuyerActivitySummary(
  orders: readonly CommerceActivitySummaryOrderLike[],
  hasReceipt: (orderId: string) => boolean,
): CommerceBuyerActivitySummary {
  return {
    draft: countByStatus(orders, "created"),
    awaitingSellerAcceptance: countByStatus(orders, "submitted"),
    readyToPay: countByStatus(orders, "accepted"),
    inFulfillment: countByStatus(orders, "paid") + countByStatus(orders, "fulfilling"),
    readyToAcknowledge: countByStatus(orders, "fulfilling"),
    readyToComplete: countByStatus(orders, "delivered"),
    readyReceipts: orders.filter((order) => order.status === "completed" && hasReceipt(order.id)).length,
  };
}

/** Seller-role counts for `orders` (already filtered by the caller to "orders where this actor is the seller"). */
export function computeCommerceSellerActivitySummary(
  orders: readonly CommerceActivitySummaryOrderLike[],
  hasReceipt: (orderId: string) => boolean,
): CommerceSellerActivitySummary {
  return {
    newSubmitted: countByStatus(orders, "submitted"),
    unpaid: countByStatus(orders, "accepted"),
    paidReadyToFulfill: countByStatus(orders, "paid"),
    fulfillingInProgress: countByStatus(orders, "fulfilling"),
    completedAwaitingReceipt: orders.filter((order) => order.status === "completed" && !hasReceipt(order.id)).length,
  };
}
