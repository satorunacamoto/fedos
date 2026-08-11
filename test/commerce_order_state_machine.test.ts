import { describe, it, expect } from "vitest";
import {
  applyOrderAction,
  createOrder,
  getAvailableActions,
  isTerminalOrderStatus,
} from "../src/os/commerce/order/order_state_machine.js";
import {
  ORDER_STATUSES,
  type Order,
  type OrderAction,
  type OrderActionType,
  type OrderActor,
  type OrderStatus,
} from "../src/os/commerce/order/order_types.js";

const CUSTOMER = "1".repeat(64);
const OTHER_CUSTOMER = "2".repeat(64);
const MERCHANT = "f".repeat(64);
const OTHER_MERCHANT = "e".repeat(64);
const NOW = 1_700_000_000;

const CUSTOMER_ACTOR: OrderActor = { kind: "customer", pubkey: CUSTOMER };
const MERCHANT_ACTOR: OrderActor = { kind: "merchant", pubkey: MERCHANT };
const PAYMENT_EVIDENCE_ACTOR: OrderActor = { kind: "payment_evidence" };
const DELIVERY_EVIDENCE_ACTOR: OrderActor = { kind: "delivery_evidence" };

function freshOrder(overrides: Partial<Parameters<typeof createOrder>[0]> = {}): Order {
  const result = createOrder(
    {
      id: "order-1",
      productId: "product-1",
      sellerPubkey: MERCHANT,
      unitPriceCents: 500,
      currency: "USD",
      ...overrides,
    },
    CUSTOMER_ACTOR,
    NOW,
  );
  if (!result.ok) throw new Error(`fixture setup failed: ${result.reason}`);
  return result.order;
}

/** Drives `order` through `count` legal steps of the happy path, returning the resulting order. */
function advance(order: Order, steps: OrderAction[], startAt = NOW): Order {
  let current = order;
  let t = startAt;
  for (const action of steps) {
    t += 1;
    const result = applyOrderAction(current, action, t);
    if (!result.ok) {
      throw new Error(`advance() fixture step "${action.type}" unexpectedly rejected: ${result.reason}`);
    }
    current = result.order;
  }
  return current;
}

const SUBMIT: OrderAction = { type: "submit", actor: CUSTOMER_ACTOR };
const ACCEPT: OrderAction = { type: "accept", actor: MERCHANT_ACTOR };
const REJECT: OrderAction = { type: "reject", actor: MERCHANT_ACTOR };
const CANCEL: OrderAction = { type: "cancel", actor: CUSTOMER_ACTOR };
const CONFIRM_PAYMENT: OrderAction = {
  type: "confirm_payment",
  actor: PAYMENT_EVIDENCE_ACTOR,
  evidence: { orderId: "order-1", paymentId: "pay-1", status: "settled", observedAt: NOW, reason: "settled via test rail" },
};
const FULFILL: OrderAction = { type: "fulfill", actor: MERCHANT_ACTOR };
const CONFIRM_DELIVERY: OrderAction = {
  type: "confirm_delivery",
  actor: DELIVERY_EVIDENCE_ACTOR,
  evidence: { orderId: "order-1", deliveryId: "delivery-1", status: "delivered", observedAt: NOW, reason: "delivered via test rail" },
};
const COMPLETE_BY_CUSTOMER: OrderAction = { type: "complete", actor: CUSTOMER_ACTOR };
const COMPLETE_BY_MERCHANT: OrderAction = { type: "complete", actor: MERCHANT_ACTOR };

describe("createOrder", () => {
  it("1. builds a CREATED order owned by the creating customer", () => {
    const order = freshOrder();
    expect(order.status).toBe("created");
    expect(order.buyerPubkey).toBe(CUSTOMER);
    expect(order.sellerPubkey).toBe(MERCHANT);
    expect(order.quantity).toBe(1);
    expect(order.history).toHaveLength(1);
    expect(order.history[0]).toMatchObject({ from: null, to: "created", action: "create" });
  });

  it("2. defaults quantity to 1, accepts an explicit positive integer quantity", () => {
    expect(freshOrder({ quantity: 3 }).quantity).toBe(3);
  });

  it("3. rejects a non-customer creator", () => {
    const result = createOrder(
      { id: "x", productId: "p", sellerPubkey: MERCHANT, unitPriceCents: 100, currency: "USD" },
      MERCHANT_ACTOR,
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unauthorized_actor");
  });

  it("4. rejects invalid input: empty id/productId/sellerPubkey, negative price, non-positive/fractional quantity", () => {
    const base = { id: "x", productId: "p", sellerPubkey: MERCHANT, unitPriceCents: 100, currency: "USD" };
    for (const overrides of [
      { id: "" },
      { productId: "" },
      { sellerPubkey: "" },
      { unitPriceCents: -1 },
      { quantity: 0 },
      { quantity: -1 },
      { quantity: 1.5 },
    ]) {
      const result = createOrder({ ...base, ...overrides }, CUSTOMER_ACTOR, NOW);
      expect(result.ok, JSON.stringify(overrides)).toBe(false);
      if (!result.ok) expect(result.code).toBe("invalid_input");
    }
  });
});

describe("legal transitions — every one succeeds", () => {
  it("5. submit: created -> submitted", () => {
    const result = applyOrderAction(freshOrder(), SUBMIT, NOW + 1);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.order.status).toBe("submitted");
  });

  it("6. cancel: created -> cancelled", () => {
    const result = applyOrderAction(freshOrder(), CANCEL, NOW + 1);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.order.status).toBe("cancelled");
  });

  it("7. cancel: submitted -> cancelled", () => {
    const order = advance(freshOrder(), [SUBMIT]);
    const result = applyOrderAction(order, CANCEL, NOW + 10);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.order.status).toBe("cancelled");
  });

  it("8. accept: submitted -> accepted", () => {
    const order = advance(freshOrder(), [SUBMIT]);
    const result = applyOrderAction(order, ACCEPT, NOW + 10);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.order.status).toBe("accepted");
  });

  it("9. reject: submitted -> rejected", () => {
    const order = advance(freshOrder(), [SUBMIT]);
    const result = applyOrderAction(order, REJECT, NOW + 10);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.order.status).toBe("rejected");
  });

  it("10. confirm_payment (settled): accepted -> paid, binds paymentId", () => {
    const order = advance(freshOrder(), [SUBMIT, ACCEPT]);
    const result = applyOrderAction(order, CONFIRM_PAYMENT, NOW + 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.order.status).toBe("paid");
      expect(result.order.paymentId).toBe("pay-1");
    }
  });

  it("11. fulfill: paid -> fulfilling", () => {
    const order = advance(freshOrder(), [SUBMIT, ACCEPT, CONFIRM_PAYMENT]);
    const result = applyOrderAction(order, FULFILL, NOW + 10);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.order.status).toBe("fulfilling");
  });

  it("12. confirm_delivery (delivered): fulfilling -> delivered, binds deliveryId", () => {
    const order = advance(freshOrder(), [SUBMIT, ACCEPT, CONFIRM_PAYMENT, FULFILL]);
    const result = applyOrderAction(order, CONFIRM_DELIVERY, NOW + 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.order.status).toBe("delivered");
      expect(result.order.deliveryId).toBe("delivery-1");
    }
  });

  it("13. complete: delivered -> completed, by customer", () => {
    const order = advance(freshOrder(), [SUBMIT, ACCEPT, CONFIRM_PAYMENT, FULFILL, CONFIRM_DELIVERY]);
    const result = applyOrderAction(order, COMPLETE_BY_CUSTOMER, NOW + 10);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.order.status).toBe("completed");
  });

  it("14. complete: delivered -> completed, by merchant", () => {
    const order = advance(freshOrder(), [SUBMIT, ACCEPT, CONFIRM_PAYMENT, FULFILL, CONFIRM_DELIVERY]);
    const result = applyOrderAction(order, COMPLETE_BY_MERCHANT, NOW + 10);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.order.status).toBe("completed");
  });

  it("15. the full happy path end-to-end reaches completed with a full history trail", () => {
    const order = advance(freshOrder(), [
      SUBMIT,
      ACCEPT,
      CONFIRM_PAYMENT,
      FULFILL,
      CONFIRM_DELIVERY,
      COMPLETE_BY_CUSTOMER,
    ]);
    expect(order.status).toBe("completed");
    expect(order.history.map((h) => h.to)).toEqual([
      "created",
      "submitted",
      "accepted",
      "paid",
      "fulfilling",
      "delivered",
      "completed",
    ]);
  });
});

describe("illegal (state, action) combinations — every one rejects", () => {
  // Exhaustive matrix: for every OrderStatus, attempt every OrderActionType
  // with a maximally-privileged, correctly-identified actor and (where
  // needed) well-formed evidence. Only the pairs in LEGAL below may
  // succeed; every other pair must be rejected with "invalid_state" (never
  // silently succeed, never throw).
  const ACTIONS: OrderActionType[] = [
    "submit",
    "cancel",
    "accept",
    "reject",
    "confirm_payment",
    "fulfill",
    "confirm_delivery",
    "complete",
  ];

  const LEGAL: ReadonlySet<string> = new Set([
    "created:submit",
    "created:cancel",
    "submitted:cancel",
    "submitted:accept",
    "submitted:reject",
    "accepted:confirm_payment",
    "paid:fulfill",
    "fulfilling:confirm_delivery",
    "delivered:complete",
  ]);

  function actionFor(type: OrderActionType, order: Order): OrderAction {
    switch (type) {
      case "submit":
        return { type, actor: CUSTOMER_ACTOR };
      case "cancel":
        return { type, actor: CUSTOMER_ACTOR };
      case "accept":
        return { type, actor: MERCHANT_ACTOR };
      case "reject":
        return { type, actor: MERCHANT_ACTOR };
      case "fulfill":
        return { type, actor: MERCHANT_ACTOR };
      case "complete":
        return { type, actor: CUSTOMER_ACTOR };
      case "confirm_payment":
        return {
          type,
          actor: PAYMENT_EVIDENCE_ACTOR,
          evidence: { orderId: order.id, paymentId: "pay-x", status: "settled", observedAt: NOW, reason: "x" },
        };
      case "confirm_delivery":
        return {
          type,
          actor: DELIVERY_EVIDENCE_ACTOR,
          evidence: { orderId: order.id, deliveryId: "delivery-x", status: "delivered", observedAt: NOW, reason: "x" },
        };
    }
  }

  /** Builds an order sitting at each reachable status via the real state machine (never fabricated). */
  function orderAtStatus(status: OrderStatus): Order | undefined {
    const base = freshOrder();
    switch (status) {
      case "created":
        return base;
      case "submitted":
        return advance(base, [SUBMIT]);
      case "accepted":
        return advance(base, [SUBMIT, ACCEPT]);
      case "rejected":
        return advance(base, [SUBMIT, REJECT]);
      case "paid":
        return advance(base, [SUBMIT, ACCEPT, CONFIRM_PAYMENT]);
      case "fulfilling":
        return advance(base, [SUBMIT, ACCEPT, CONFIRM_PAYMENT, FULFILL]);
      case "delivered":
        return advance(base, [SUBMIT, ACCEPT, CONFIRM_PAYMENT, FULFILL, CONFIRM_DELIVERY]);
      case "completed":
        return advance(base, [SUBMIT, ACCEPT, CONFIRM_PAYMENT, FULFILL, CONFIRM_DELIVERY, COMPLETE_BY_CUSTOMER]);
      case "cancelled":
        return advance(base, [CANCEL]);
    }
  }

  for (const status of ORDER_STATUSES) {
    for (const actionType of ACTIONS) {
      const key = `${status}:${actionType}`;
      const shouldSucceed = LEGAL.has(key);
      it(`16. [${key}] ${shouldSucceed ? "succeeds" : "is rejected"}`, () => {
        const order = orderAtStatus(status);
        expect(order, `could not construct fixture at status "${status}"`).toBeDefined();
        if (order === undefined) return;
        const result = applyOrderAction(order, actionFor(actionType, order), NOW + 1000);
        expect(result.ok).toBe(shouldSucceed);
        if (!result.ok) {
          // Usually "invalid_state" (wrong status for this action). The two
          // evidence-carrying actions can also reject with
          // "evidence_mismatch" when re-attempted with a DIFFERENT
          // paymentId/deliveryId than the one already bound at a
          // already-settled status ("paid"/"delivered") — still a correct
          // rejection, just a more specific reason; see
          // commerce_order_authority.test.ts for the idempotent
          // SAME-id-twice case, which is a success, not a rejection.
          expect(["invalid_state", "evidence_mismatch"]).toContain(result.code);
        }
      });
    }
  }
});

describe("getAvailableActions", () => {
  it("17. matches the legal-transition matrix per actor kind", () => {
    const created = freshOrder();
    expect(getAvailableActions(created, "customer")).toEqual(["submit", "cancel"]);
    expect(getAvailableActions(created, "merchant")).toEqual([]);

    const submitted = advance(created, [SUBMIT]);
    expect(getAvailableActions(submitted, "customer")).toEqual(["cancel"]);
    expect(getAvailableActions(submitted, "merchant")).toEqual(["accept", "reject"]);

    const accepted = advance(created, [SUBMIT, ACCEPT]);
    expect(getAvailableActions(accepted, "payment_evidence")).toEqual(["confirm_payment"]);
    expect(getAvailableActions(accepted, "customer")).toEqual([]);
    expect(getAvailableActions(accepted, "merchant")).toEqual([]);

    const paid = advance(created, [SUBMIT, ACCEPT, CONFIRM_PAYMENT]);
    expect(getAvailableActions(paid, "merchant")).toEqual(["fulfill"]);

    const fulfilling = advance(created, [SUBMIT, ACCEPT, CONFIRM_PAYMENT, FULFILL]);
    expect(getAvailableActions(fulfilling, "delivery_evidence")).toEqual(["confirm_delivery"]);
    expect(getAvailableActions(fulfilling, "merchant")).toEqual([]);

    const delivered = advance(created, [SUBMIT, ACCEPT, CONFIRM_PAYMENT, FULFILL, CONFIRM_DELIVERY]);
    expect(getAvailableActions(delivered, "customer")).toEqual(["complete"]);
    expect(getAvailableActions(delivered, "merchant")).toEqual(["complete"]);

    const completed = advance(created, [SUBMIT, ACCEPT, CONFIRM_PAYMENT, FULFILL, CONFIRM_DELIVERY, COMPLETE_BY_CUSTOMER]);
    for (const kind of ["customer", "merchant", "payment_evidence", "delivery_evidence"] as const) {
      expect(getAvailableActions(completed, kind)).toEqual([]);
    }
  });
});

describe("isTerminalOrderStatus", () => {
  it("18. true for rejected/completed/cancelled, false otherwise", () => {
    for (const status of ORDER_STATUSES) {
      const expected = status === "rejected" || status === "completed" || status === "cancelled";
      expect(isTerminalOrderStatus(status)).toBe(expected);
    }
  });
});

describe("purity", () => {
  it("19. applyOrderAction does not mutate its input order", () => {
    const order = advance(freshOrder(), [SUBMIT]);
    const snapshot = JSON.stringify(order);
    applyOrderAction(order, ACCEPT, NOW + 10);
    expect(JSON.stringify(order)).toBe(snapshot);
  });
});
