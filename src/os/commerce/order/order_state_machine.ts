/**
 * FedOS Commerce End-to-End Completion arc (Agent O) — Order domain, the
 * guarded transition function(s). Companion to `order_types.ts` (shapes)
 * and the intended home for Gap #3's largest missing piece: an actual,
 * exhaustively-tested state machine (`docs/architecture/COMMERCE-STATE-MACHINES.md`
 * previously found NONE existed for Order, Payment, or Delivery).
 *
 * PAYMENT/DELIVERY INTEGRATION SEAM (read this before wiring Agent P's real
 * payment code or Agent D's real delivery code to this file):
 *   - This module NEVER imports `src/os/commerce/payment/`. `PaymentStatus`
 *     and `OrderPaymentEvidence` (`order_types.ts`) are LOCAL placeholder
 *     declarations, not re-exports.
 *   - The only way an Order can reach `"paid"` is `applyOrderAction(order,
 *     { type: "confirm_payment", actor: { kind: "payment_evidence" },
 *     evidence })` with `evidence.status === "settled"`. The actor's `kind`
 *     MUST be exactly `"payment_evidence"` — a `"customer"`/`"merchant"`
 *     actor is REJECTED even if it supplies a perfectly well-formed
 *     `evidence` payload (see `commerce_order_authority.test.ts`). This is
 *     the concrete fix for the gap `docs/commerce/COMMERCE-GAP-CLASSIFICATION.md`
 *     Gap #5 and `COMMERCE-TABLETOP-EXERCISES.md` Failure Case A describe:
 *     the payment boundary's own `ingestCallback()` accepts unauthenticated
 *     callbacks, so the state machine consuming it must not trust a bare
 *     claim either.
 *   - WHO is allowed to construct a `{ kind: "payment_evidence" }` actor is
 *     this module's whole security boundary and is NOT enforced here — it
 *     is the coordinator's integration-gate responsibility to ensure only a
 *     genuinely verified payment callback path (Agent P's real, signature/
 *     HMAC-checked `PaymentProvider.ingestCallback()` result) ever
 *     constructs one. This module's contract to Agent P/the coordinator:
 *     call `applyOrderAction` with `evidence.paymentId` set to the SAME
 *     `paymentId` the real `PaymentDecision`/`PaymentEvidence` carries, and
 *     `evidence.orderId` set to this Order's `id`. First accepted evidence
 *     BINDS `order.paymentId`; a later evidence event with a DIFFERENT
 *     `paymentId` for the same Order is rejected (`evidence_mismatch`) —
 *     this is the concrete fix for Failure Case E (duplicate/conflicting
 *     confirmation must not double-grant): a second `"settled"` evidence
 *     for the SAME `paymentId` while already `"paid"` is accepted as a
 *     no-op, not a repeated transition.
 *   - The identical pattern applies to delivery: `"delivered"` is reached
 *     only via `{ type: "confirm_delivery", actor: { kind:
 *     "delivery_evidence" } }`. Agent D's Wave B work should replace
 *     `OrderDeliveryEvidence`/`DeliveryStatus` wholesale if its real design
 *     differs — this arc's version is a placeholder seam, not a committed
 *     design.
 *   - `refunded`/`expired`/`error` payment evidence and `failed` delivery
 *     evidence are accepted as INPUT (so a caller can report them without
 *     the call being an error) but cause NO transition — Order has no
 *     refund/failure state yet. This is a known, documented gap; see the
 *     final report's PARTIAL/BLOCKED notes.
 */

import type {
  CreateOrderInput,
  Order,
  OrderAction,
  OrderActor,
  OrderActorKind,
  OrderActionType,
  OrderRejectionCode,
  OrderStatus,
  OrderTransitionRecord,
  OrderTransitionResult,
} from "./order_types.js";

function ok(order: Order): OrderTransitionResult {
  return { ok: true, order };
}

function fail(code: OrderRejectionCode, reason: string): OrderTransitionResult {
  return { ok: false, code, reason };
}

function appendHistory(
  order: Order,
  to: OrderStatus,
  action: OrderActionType,
  actorKind: OrderActorKind,
  at: number,
  reason?: string,
): readonly OrderTransitionRecord[] {
  const record: OrderTransitionRecord = {
    from: order.status,
    to,
    action,
    actorKind,
    at,
    ...(reason !== undefined ? { reason } : {}),
  };
  return [...order.history, record];
}

/**
 * Which `OrderActorKind` may even ATTEMPT each action, independent of the
 * Order's current status. Checked FIRST, before any state/identity check —
 * this is the structural half of the "a bare claim must never cause a
 * payment/delivery transition" guarantee: even if an action is otherwise
 * perfectly timed, the wrong actor kind is rejected before anything else
 * is evaluated.
 */
const AUTHORIZED_ACTOR_KINDS: Readonly<Record<OrderActionType, readonly OrderActorKind[]>> = {
  submit: ["customer"],
  cancel: ["customer"],
  accept: ["merchant"],
  reject: ["merchant"],
  confirm_payment: ["payment_evidence"],
  fulfill: ["merchant"],
  confirm_delivery: ["delivery_evidence"],
  complete: ["customer", "merchant"],
};

function isActorKindAuthorized(action: OrderActionType, actorKind: OrderActorKind): boolean {
  return AUTHORIZED_ACTOR_KINDS[action].includes(actorKind);
}

/** True when a `"customer"`/`"merchant"` actor's pubkey matches the Order's corresponding party. Evidence-kind actors have no identity to check (authorized by kind alone). */
function isActorIdentityAuthorized(order: Order, actor: OrderActor): boolean {
  if (actor.kind === "customer") return actor.pubkey === order.buyerPubkey;
  if (actor.kind === "merchant") return actor.pubkey === order.sellerPubkey;
  return true;
}

/**
 * Creates a new Order in `"created"` status. The only constructor — there
 * is no way to construct an `Order` object directly outside this function
 * (mirrors `catalog/policy.ts`'s pure-decision style).
 */
export function createOrder(input: CreateOrderInput, actor: OrderActor, now: number): OrderTransitionResult {
  if (actor.kind !== "customer" || actor.pubkey === undefined || actor.pubkey.length === 0) {
    return fail("unauthorized_actor", "only a customer may create an order");
  }
  if (input.id.length === 0) return fail("invalid_input", "id must be non-empty");
  if (input.productId.length === 0) return fail("invalid_input", "productId must be non-empty");
  if (input.sellerPubkey.length === 0) return fail("invalid_input", "sellerPubkey must be non-empty");
  if (input.unitPriceCents < 0) return fail("invalid_input", "unitPriceCents must be non-negative");
  const quantity = input.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1) {
    return fail("invalid_input", "quantity must be a positive integer");
  }

  const order: Order = {
    id: input.id,
    productId: input.productId,
    buyerPubkey: actor.pubkey,
    sellerPubkey: input.sellerPubkey,
    status: "created",
    quantity,
    unitPriceCents: input.unitPriceCents,
    currency: input.currency,
    createdAt: now,
    updatedAt: now,
    history: [{ from: null, to: "created", action: "create", actorKind: "customer", at: now }],
  };
  return ok(order);
}

function transitionSubmit(order: Order, actor: OrderActor, now: number): OrderTransitionResult {
  if (order.status !== "created") return fail("invalid_state", `cannot submit from status "${order.status}"`);
  return ok({ ...order, status: "submitted", updatedAt: now, history: appendHistory(order, "submitted", "submit", actor.kind, now) });
}

function transitionCancel(order: Order, actor: OrderActor, now: number, reason?: string): OrderTransitionResult {
  if (order.status !== "created" && order.status !== "submitted") {
    return fail("invalid_state", `cancel is only permitted before acceptance (current status "${order.status}")`);
  }
  return ok({
    ...order,
    status: "cancelled",
    updatedAt: now,
    history: appendHistory(order, "cancelled", "cancel", actor.kind, now, reason),
  });
}

function transitionAccept(order: Order, actor: OrderActor, now: number): OrderTransitionResult {
  if (order.status !== "submitted") return fail("invalid_state", `cannot accept from status "${order.status}"`);
  return ok({ ...order, status: "accepted", updatedAt: now, history: appendHistory(order, "accepted", "accept", actor.kind, now) });
}

function transitionReject(order: Order, actor: OrderActor, now: number, reason?: string): OrderTransitionResult {
  if (order.status !== "submitted") return fail("invalid_state", `cannot reject from status "${order.status}"`);
  return ok({
    ...order,
    status: "rejected",
    updatedAt: now,
    history: appendHistory(order, "rejected", "reject", actor.kind, now, reason),
  });
}

function transitionConfirmPayment(
  order: Order,
  actor: OrderActor,
  now: number,
  evidence: { orderId: string; paymentId: string; status: "settled" | "expired" | "refunded" | "error"; reason: string },
): OrderTransitionResult {
  if (evidence.orderId !== order.id) {
    return fail("evidence_mismatch", "payment evidence orderId does not match this order");
  }
  if (order.status === "paid") {
    // Idempotency (Failure Case E): a repeat "settled" event for the SAME
    // paymentId is a no-op success, not an error and not a second
    // transition. A DIFFERENT paymentId while already paid is a mismatch.
    if (evidence.status === "settled" && evidence.paymentId === order.paymentId) {
      return ok(order);
    }
    return fail("evidence_mismatch", "order is already paid by a different payment");
  }
  if (order.status !== "accepted") {
    return fail("invalid_state", `cannot confirm payment from status "${order.status}"`);
  }
  if (evidence.status !== "settled") {
    return fail("evidence_not_settled", `payment evidence status "${evidence.status}" does not confirm settlement`);
  }
  return ok({
    ...order,
    status: "paid",
    paymentId: evidence.paymentId,
    paymentStatus: "accepted_placeholder",
    updatedAt: now,
    history: appendHistory(order, "paid", "confirm_payment", actor.kind, now, evidence.reason),
  });
}

function transitionFulfill(order: Order, actor: OrderActor, now: number): OrderTransitionResult {
  if (order.status !== "paid") return fail("invalid_state", `cannot fulfill from status "${order.status}"`);
  return ok({ ...order, status: "fulfilling", updatedAt: now, history: appendHistory(order, "fulfilling", "fulfill", actor.kind, now) });
}

function transitionConfirmDelivery(
  order: Order,
  actor: OrderActor,
  now: number,
  evidence: { orderId: string; deliveryId: string; status: "delivered" | "failed"; reason: string },
): OrderTransitionResult {
  if (evidence.orderId !== order.id) {
    return fail("evidence_mismatch", "delivery evidence orderId does not match this order");
  }
  if (order.status === "delivered") {
    if (evidence.status === "delivered" && evidence.deliveryId === order.deliveryId) {
      return ok(order);
    }
    return fail("evidence_mismatch", "order is already delivered by a different delivery");
  }
  if (order.status !== "fulfilling") {
    return fail("invalid_state", `cannot confirm delivery from status "${order.status}"`);
  }
  if (evidence.status !== "delivered") {
    return fail("evidence_not_settled", `delivery evidence status "${evidence.status}" does not confirm delivery`);
  }
  return ok({
    ...order,
    status: "delivered",
    deliveryId: evidence.deliveryId,
    deliveryStatus: "delivered",
    updatedAt: now,
    history: appendHistory(order, "delivered", "confirm_delivery", actor.kind, now, evidence.reason),
  });
}

function transitionComplete(order: Order, actor: OrderActor, now: number): OrderTransitionResult {
  if (order.status !== "delivered") return fail("invalid_state", `cannot complete from status "${order.status}"`);
  return ok({ ...order, status: "completed", updatedAt: now, history: appendHistory(order, "completed", "complete", actor.kind, now) });
}

/**
 * Applies one authorized `OrderAction` to an existing `Order`, returning
 * either the new `Order` or a rejection — NEVER throws, NEVER mutates
 * `order`. Authority is checked in a fixed order for every action:
 *   1. Is this actor KIND even allowed to attempt this action at all
 *      (`AUTHORIZED_ACTOR_KINDS`)? This is the check that makes a bare
 *      customer/merchant "I paid"/"I delivered it" claim structurally
 *      impossible to accept, regardless of timing.
 *   2. For a `"customer"`/`"merchant"` actor, does its `pubkey` match the
 *      Order's corresponding party?
 *   3. Is the CURRENT status legal for this action?
 *   4. (evidence-carrying actions only) Does the evidence's own `orderId`/
 *      settlement status support the transition?
 */
export function applyOrderAction(order: Order, action: OrderAction, now: number): OrderTransitionResult {
  if (!isActorKindAuthorized(action.type, action.actor.kind)) {
    return fail(
      "unauthorized_actor",
      `actor kind "${action.actor.kind}" is not authorized to perform "${action.type}"`,
    );
  }
  if (!isActorIdentityAuthorized(order, action.actor)) {
    return fail("unauthorized_actor", `actor pubkey does not match the order's ${action.actor.kind}`);
  }

  switch (action.type) {
    case "submit":
      return transitionSubmit(order, action.actor, now);
    case "cancel":
      return transitionCancel(order, action.actor, now, action.reason);
    case "accept":
      return transitionAccept(order, action.actor, now);
    case "reject":
      return transitionReject(order, action.actor, now, action.reason);
    case "confirm_payment":
      return transitionConfirmPayment(order, action.actor, now, action.evidence);
    case "fulfill":
      return transitionFulfill(order, action.actor, now);
    case "confirm_delivery":
      return transitionConfirmDelivery(order, action.actor, now, action.evidence);
    case "complete":
      return transitionComplete(order, action.actor, now);
  }
}

/**
 * Which `OrderActionType`s are legal to attempt RIGHT NOW for a given
 * order + actor kind — i.e. would currently pass both the actor-kind gate
 * and the status gate (identity/evidence details are not evaluated, since
 * this is a display helper, not itself an authority decision). Intended
 * for the UI module: "only show a Submit/Cancel/Accept/... affordance the
 * state machine would actually accept."
 */
export function getAvailableActions(order: Order, actorKind: OrderActorKind): readonly OrderActionType[] {
  const candidates: OrderActionType[] = [
    "submit",
    "cancel",
    "accept",
    "reject",
    "confirm_payment",
    "fulfill",
    "confirm_delivery",
    "complete",
  ];
  return candidates.filter((type) => {
    if (!isActorKindAuthorized(type, actorKind)) return false;
    switch (type) {
      case "submit":
        return order.status === "created";
      case "cancel":
        return order.status === "created" || order.status === "submitted";
      case "accept":
      case "reject":
        return order.status === "submitted";
      case "confirm_payment":
        return order.status === "accepted";
      case "fulfill":
        return order.status === "paid";
      case "confirm_delivery":
        return order.status === "fulfilling";
      case "complete":
        return order.status === "delivered";
    }
  });
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return status === "rejected" || status === "completed" || status === "cancelled";
}
