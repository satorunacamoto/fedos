/**
 * FedOS Commerce End-to-End Completion arc (Agent O) — Order domain, UI
 * module, part 1: pure view-model builders.
 *
 * Framework-agnostic by design: every export here is a pure function that
 * turns domain data (`Order`, and a read-only `Product` from
 * `../../catalog/types.js` — imported, never modified, per this arc's
 * scope) into a plain, serializable view-model object. Nothing here
 * touches the DOM, a specific UI framework, IPC, or storage — the
 * coordinator mounts these against `fedos_electron_beta_page.html`/
 * `renderer.ts` with its own glue, not this arc's.
 *
 * Structure matches the brief's two flows:
 *   Customer: Product Detail -> Create Order -> Review -> Submit -> Order
 *             status view.
 *   Merchant: Incoming Orders list -> inspect -> Accept/Reject ->
 *             Fulfillment view (stub only — no fake "delivered" control).
 *
 * NO control here ever lets a customer or merchant simulate payment or
 * delivery completion — see `order_ui_controller.ts`'s module doc for why
 * that is a structural omission, not an oversight.
 */

import type { Product } from "../../catalog/types.js";
import { getAvailableActions } from "../order_state_machine.js";
import type {
  Order,
  OrderActionType,
  OrderActorKind,
  OrderStatus,
  OrderTransitionRecord,
} from "../order_types.js";

/** Human-readable label for an `OrderStatus`, for any screen that displays one. */
export function describeOrderStatus(status: OrderStatus): string {
  switch (status) {
    case "created":
      return "Draft (not yet sent to merchant)";
    case "submitted":
      return "Submitted — awaiting merchant response";
    case "accepted":
      return "Accepted — awaiting payment";
    case "rejected":
      return "Rejected by merchant";
    case "paid":
      return "Paid — awaiting fulfillment";
    case "fulfilling":
      return "Fulfillment in progress";
    case "delivered":
      return "Delivered — awaiting order completion";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
  }
}

/** True for the two statuses where the NEXT step depends on external verified evidence (payment/delivery), never on a button in this UI. See `order_ui_controller.ts`. */
export function isAwaitingExternalEvidence(status: OrderStatus): boolean {
  return status === "accepted" || status === "fulfilling";
}

// ---------------------------------------------------------------------------
// Customer: Product Detail -> Create Order -> Review
// ---------------------------------------------------------------------------

/** The minimal, non-domain-owned draft a customer builds before `submit`. Not an `Order` — no id/status exists yet. */
export interface CreateOrderDraft {
  readonly productId: string;
  readonly productTitle: string;
  readonly sellerPubkey: string;
  readonly unitPriceCents: number;
  readonly currency: string;
  readonly quantity: number;
}

export interface CreateOrderDraftResult {
  readonly ok: boolean;
  readonly reason: string;
  readonly draft?: CreateOrderDraft;
}

/**
 * Builds the draft a "Create Order" screen would show, from a read-only
 * `Product` (Agent M's catalog type — never modified here) plus a
 * customer-chosen quantity. Pure; rejects (never throws) an inactive
 * product or a non-positive quantity — mirrors the shipped Product Detail
 * screen's own "Ordering not available yet" discipline: this only builds a
 * DRAFT, it never creates a real `Order` (that is `CustomerOrderController.createOrder`).
 */
export function buildCreateOrderDraft(product: Product, quantity: number): CreateOrderDraftResult {
  if (product.status !== "active") {
    return { ok: false, reason: `product is "${product.status}", not orderable` };
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, reason: "quantity must be a positive integer" };
  }
  return {
    ok: true,
    reason: "draft is orderable",
    draft: {
      productId: product.id,
      productTitle: product.title,
      sellerPubkey: product.creatorPubkey,
      unitPriceCents: product.priceCents,
      currency: product.currency,
      quantity,
    },
  };
}

export interface OrderReviewViewModel {
  readonly productTitle: string;
  readonly sellerPubkey: string;
  readonly quantity: number;
  readonly unitPriceCents: number;
  readonly totalCents: number;
  readonly currency: string;
}

/** The "Review" screen between Create Order and Submit — just arithmetic + display, no side effects. */
export function buildOrderReviewViewModel(draft: CreateOrderDraft): OrderReviewViewModel {
  return {
    productTitle: draft.productTitle,
    sellerPubkey: draft.sellerPubkey,
    quantity: draft.quantity,
    unitPriceCents: draft.unitPriceCents,
    totalCents: draft.unitPriceCents * draft.quantity,
    currency: draft.currency,
  };
}

// ---------------------------------------------------------------------------
// Customer: Order status view
// ---------------------------------------------------------------------------

export interface OrderStatusViewModel {
  readonly orderId: string;
  readonly status: OrderStatus;
  readonly statusLabel: string;
  readonly totalCents: number;
  readonly currency: string;
  /** Actions the state machine would currently accept from this actor kind — drives which buttons a screen may show. */
  readonly availableActions: readonly OrderActionType[];
  readonly awaitingExternalEvidence: boolean;
  readonly history: readonly OrderTransitionRecord[];
}

/** Builds the customer-facing (or merchant-facing, via `actorKind`) Order status view model. Pure — reads only. */
export function buildCustomerOrderStatusViewModel(order: Order, actorKind: OrderActorKind = "customer"): OrderStatusViewModel {
  return {
    orderId: order.id,
    status: order.status,
    statusLabel: describeOrderStatus(order.status),
    totalCents: order.unitPriceCents * order.quantity,
    currency: order.currency,
    availableActions: getAvailableActions(order, actorKind),
    awaitingExternalEvidence: isAwaitingExternalEvidence(order.status),
    history: order.history,
  };
}

// ---------------------------------------------------------------------------
// Merchant: Incoming Orders list -> inspect -> Accept/Reject -> Fulfillment
// ---------------------------------------------------------------------------

export interface MerchantOrderSummary {
  readonly orderId: string;
  readonly productId: string;
  readonly buyerPubkey: string;
  readonly status: OrderStatus;
  readonly statusLabel: string;
  readonly totalCents: number;
  readonly currency: string;
  readonly createdAt: number;
}

export interface MerchantIncomingOrdersViewModel {
  /** Orders requiring a merchant decision right now (accept/reject). */
  readonly incoming: readonly MerchantOrderSummary[];
  /** Orders past acceptance but not yet closed (accepted/paid/fulfilling/delivered). */
  readonly inProgress: readonly MerchantOrderSummary[];
  /** Terminal orders (rejected/completed/cancelled). */
  readonly closed: readonly MerchantOrderSummary[];
}

function toSummary(order: Order): MerchantOrderSummary {
  return {
    orderId: order.id,
    productId: order.productId,
    buyerPubkey: order.buyerPubkey,
    status: order.status,
    statusLabel: describeOrderStatus(order.status),
    totalCents: order.unitPriceCents * order.quantity,
    currency: order.currency,
    createdAt: order.createdAt,
  };
}

const IN_PROGRESS_STATUSES: readonly OrderStatus[] = ["accepted", "paid", "fulfilling", "delivered"];
const CLOSED_STATUSES: readonly OrderStatus[] = ["rejected", "completed", "cancelled"];

/** The merchant's "Incoming Orders" screen, grouped by what the merchant needs to do. Pure — reads only, never mutates `orders`. */
export function buildMerchantIncomingOrdersViewModel(orders: readonly Order[]): MerchantIncomingOrdersViewModel {
  return {
    incoming: orders.filter((o) => o.status === "submitted").map(toSummary),
    inProgress: orders.filter((o) => IN_PROGRESS_STATUSES.includes(o.status)).map(toSummary),
    closed: orders.filter((o) => CLOSED_STATUSES.includes(o.status)).map(toSummary),
  };
}

export interface MerchantOrderDetailViewModel {
  readonly orderId: string;
  readonly status: OrderStatus;
  readonly statusLabel: string;
  readonly buyerPubkey: string;
  readonly productId: string;
  readonly quantity: number;
  readonly totalCents: number;
  readonly currency: string;
  readonly availableActions: readonly OrderActionType[];
  /**
   * Non-empty ONLY when the order is `"fulfilling"` — explicitly explains
   * why no "mark delivered" control exists, per the brief's requirement:
   * "Fulfillment view (stub is fine if Delivery isn't ready — no fake
   * 'delivered' button)."
   */
  readonly fulfillmentStubNote: string | undefined;
  readonly history: readonly OrderTransitionRecord[];
}

export function buildMerchantOrderDetailViewModel(order: Order): MerchantOrderDetailViewModel {
  return {
    orderId: order.id,
    status: order.status,
    statusLabel: describeOrderStatus(order.status),
    buyerPubkey: order.buyerPubkey,
    productId: order.productId,
    quantity: order.quantity,
    totalCents: order.unitPriceCents * order.quantity,
    currency: order.currency,
    availableActions: getAvailableActions(order, "merchant"),
    fulfillmentStubNote:
      order.status === "fulfilling"
        ? "Fulfillment in progress. Delivery will be confirmed by verified delivery evidence when that capability lands (Wave B) — this screen deliberately has no manual \"mark delivered\" control."
        : undefined,
    history: order.history,
  };
}
