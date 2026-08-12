import { describe, expect, it } from "vitest";
import {
  applyInboundPrivateOrderSyncPayload,
  type InboundPrivateOrderSyncPayload,
} from "../src/os/commerce/events/commerce_private_order_apply.js";
import { applyOrderAction, createOrder, type Order } from "../src/os/commerce/order/index.js";

/**
 * FedOS Commerce Purchase Completion mega-arc (completion-lag fix round) —
 * the regression suite for the defect a live two-process E2E run found and
 * `commerce_private_order_apply.ts` exists to close.
 *
 * THE DEFECT, restated as the property under test: an inbound private-order
 * sync event that a process REFUSES only because its own local state has not
 * caught up yet must remain eligible for re-evaluation on a LATER BOUNDED
 * REFRESH IN THE SAME PROCESS — while an event that can never apply must be
 * retired immediately and permanently, and a genuine replay must stay a safe
 * no-op forever. The old inline implementation returned an indistinguishable
 * bare `return` for all three, and its caller had already written the event
 * id into a process-lifetime dedup set BEFORE attempting the apply, so
 * "not yet" was silently identical to "never".
 *
 * The two `describe` blocks at the bottom simulate the caller's real dedup
 * discipline (`commercePrivateOrderAppliedEventIds` in
 * `fedos_electron_beta_main.cts`) against a real local order repository, so
 * the refuse -> catch-up -> SAME EVENT APPLIES sequence is proven end to end
 * rather than asserted one outcome at a time.
 */

const BUYER = "b".repeat(64);
const SELLER = "5".repeat(64);
const MALLORY = "d".repeat(64);
const AT = 1_700_000_000;

function payload(overrides: Partial<InboundPrivateOrderSyncPayload> = {}): InboundPrivateOrderSyncPayload {
  return {
    orderId: "order-1",
    productId: "product-1",
    buyerPubkey: BUYER,
    sellerPubkey: SELLER,
    quantity: 1,
    unitPriceCents: 2500,
    currency: "USD",
    status: "completed",
    at: AT,
    ...overrides,
  };
}

/** A real local `Order` driven to `status` through the REAL state machine — never a hand-written object literal, so every fixture is a state the machine itself agrees is reachable. */
function orderAt(status: Order["status"]): Order {
  const created = createOrder(
    { id: "order-1", productId: "product-1", sellerPubkey: SELLER, unitPriceCents: 2500, currency: "USD", quantity: 1 },
    { kind: "customer", pubkey: BUYER },
    AT,
  );
  if (!created.ok || created.order === undefined) throw new Error("fixture: createOrder failed");
  let order = created.order;
  const step = (action: Parameters<typeof applyOrderAction>[1]): void => {
    const result = applyOrderAction(order, action, AT);
    if (!result.ok || result.order === undefined) throw new Error(`fixture: ${action.type} failed`);
    order = result.order;
  };
  if (status === "created") return order;
  step({ type: "submit", actor: { kind: "customer", pubkey: BUYER } });
  if (status === "submitted") return order;
  if (status === "cancelled") {
    step({ type: "cancel", actor: { kind: "customer", pubkey: BUYER } });
    return order;
  }
  if (status === "rejected") {
    step({ type: "reject", actor: { kind: "merchant", pubkey: SELLER } });
    return order;
  }
  step({ type: "accept", actor: { kind: "merchant", pubkey: SELLER } });
  if (status === "accepted") return order;
  step({
    type: "confirm_payment",
    actor: { kind: "payment_evidence" },
    evidence: { orderId: "order-1", paymentId: "payment-1", status: "settled", observedAt: AT, reason: "test" },
  });
  if (status === "paid") return order;
  step({ type: "fulfill", actor: { kind: "merchant", pubkey: SELLER } });
  if (status === "fulfilling") return order;
  step({
    type: "confirm_delivery",
    actor: { kind: "delivery_evidence" },
    evidence: { orderId: "order-1", deliveryId: "delivery-1", status: "delivered", observedAt: AT, reason: "test" },
  });
  if (status === "delivered") return order;
  step({ type: "complete", actor: { kind: "customer", pubkey: BUYER } });
  return order;
}

describe("commerce_private_order_apply: 'not yet' is retryable, and is NOT the same as 'never'", () => {
  it("THE live-proven case -- the buyer's \"completed\" arriving while the seller's local Order is still \"fulfilling\" is retry-later, never a permanent drop", () => {
    const result = applyInboundPrivateOrderSyncPayload({
      existingOrder: orderAt("fulfilling"),
      senderPubkeyHex: BUYER,
      payload: payload({ status: "completed" }),
    });
    expect(result.outcome).toBe("retry-later");
  });

  it("the SAME \"completed\" event applies cleanly once the local Order has caught up to \"delivered\"", () => {
    const result = applyInboundPrivateOrderSyncPayload({
      existingOrder: orderAt("delivered"),
      senderPubkeyHex: BUYER,
      payload: payload({ status: "completed" }),
    });
    expect(result.outcome).toBe("applied");
    if (result.outcome !== "applied") throw new Error("unreachable");
    expect(result.order.status).toBe("completed");
  });

  it("an event for an order this process has not materialized yet is retry-later (the submit that creates it may still arrive)", () => {
    const result = applyInboundPrivateOrderSyncPayload({
      existingOrder: undefined,
      senderPubkeyHex: SELLER,
      payload: payload({ status: "fulfilling" }),
    });
    expect(result.outcome).toBe("retry-later");
  });

  it("a \"fulfilling\" event arriving before the local Order reached \"paid\" is retry-later, and applies once it has", () => {
    const early = applyInboundPrivateOrderSyncPayload({
      existingOrder: orderAt("accepted"),
      senderPubkeyHex: SELLER,
      payload: payload({ status: "fulfilling" }),
    });
    expect(early.outcome).toBe("retry-later");

    const later = applyInboundPrivateOrderSyncPayload({
      existingOrder: orderAt("paid"),
      senderPubkeyHex: SELLER,
      payload: payload({ status: "fulfilling" }),
    });
    expect(later.outcome).toBe("applied");
  });

  it("an \"accepted\" event arriving before the local Order was even submitted is retry-later", () => {
    const result = applyInboundPrivateOrderSyncPayload({
      existingOrder: orderAt("created"),
      senderPubkeyHex: SELLER,
      payload: payload({ status: "accepted" }),
    });
    expect(result.outcome).toBe("retry-later");
  });
});

describe("commerce_private_order_apply: genuinely inapplicable events are retired, never retried forever (bounded)", () => {
  it("a REPLAY of an already-applied transition is permanently-inapplicable (the local Order has reached the status the event asks for)", () => {
    const result = applyInboundPrivateOrderSyncPayload({
      existingOrder: orderAt("completed"),
      senderPubkeyHex: BUYER,
      payload: payload({ status: "completed" }),
    });
    expect(result.outcome).toBe("permanently-inapplicable");
  });

  it("a STALE event whose window the local Order has already moved past is permanently-inapplicable", () => {
    // "accepted" is only ever legal from "submitted"; this order is long past it.
    const result = applyInboundPrivateOrderSyncPayload({
      existingOrder: orderAt("delivered"),
      senderPubkeyHex: SELLER,
      payload: payload({ status: "accepted" }),
    });
    expect(result.outcome).toBe("permanently-inapplicable");
  });

  it("any event against a TERMINAL local Order is permanently-inapplicable", () => {
    for (const terminal of ["rejected", "cancelled"] as const) {
      const result = applyInboundPrivateOrderSyncPayload({
        existingOrder: orderAt(terminal),
        senderPubkeyHex: BUYER,
        payload: payload({ status: "completed" }),
      });
      expect(result.outcome, `terminal status "${terminal}"`).toBe("permanently-inapplicable");
    }
  });

  it("an event carrying a DIFFERENT order's economics is permanently-inapplicable (and never mutates the local order)", () => {
    for (const override of [{ productId: "other-product" }, { unitPriceCents: 999_999 }, { quantity: 7 }, { currency: "EUR" }]) {
      const result = applyInboundPrivateOrderSyncPayload({
        existingOrder: orderAt("delivered"),
        senderPubkeyHex: BUYER,
        payload: payload({ status: "completed", ...override }),
      });
      expect(result.outcome, JSON.stringify(override)).toBe("permanently-inapplicable");
    }
  });

  it("an unsupported status string is permanently-inapplicable (it can never become supported later)", () => {
    for (const status of ["paid", "delivered", "created", "banana"]) {
      const result = applyInboundPrivateOrderSyncPayload({
        existingOrder: orderAt("fulfilling"),
        senderPubkeyHex: BUYER,
        payload: payload({ status }),
      });
      expect(result.outcome, status).toBe("permanently-inapplicable");
    }
  });
});

describe("commerce_private_order_apply: the trust boundary is unchanged -- 'retry-later' never means 'not checked'", () => {
  it("a third party cannot materialize an order, and is retired rather than retried", () => {
    const result = applyInboundPrivateOrderSyncPayload({
      existingOrder: undefined,
      senderPubkeyHex: MALLORY,
      payload: payload({ status: "submitted" }),
    });
    expect(result.outcome).toBe("permanently-inapplicable");
  });

  it("the SELLER cannot send the buyer-only \"cancelled\", even at a local status where cancel would be legal", () => {
    const result = applyInboundPrivateOrderSyncPayload({
      existingOrder: orderAt("submitted"),
      senderPubkeyHex: SELLER,
      payload: payload({ status: "cancelled" }),
    });
    expect(result.outcome).toBe("permanently-inapplicable");
  });

  it("the BUYER cannot send the merchant-only \"accepted\"/\"rejected\"/\"fulfilling\"", () => {
    for (const status of ["accepted", "rejected", "fulfilling"]) {
      const result = applyInboundPrivateOrderSyncPayload({
        existingOrder: orderAt("submitted"),
        senderPubkeyHex: BUYER,
        payload: payload({ status }),
      });
      expect(result.outcome, status).toBe("permanently-inapplicable");
    }
  });

  it("a third party cannot complete an order that IS at the qualifying status", () => {
    const result = applyInboundPrivateOrderSyncPayload({
      existingOrder: orderAt("delivered"),
      senderPubkeyHex: MALLORY,
      payload: payload({ status: "completed" }),
    });
    expect(result.outcome).toBe("permanently-inapplicable");
  });
});

/**
 * The end-to-end proof. These two tests replay the caller's REAL dedup
 * discipline (`fedos_electron_beta_main.cts`'s
 * `commercePrivateOrderAppliedEventIds` + `applyInboundPrivateOrderSyncNonFatal()`
 * shell, reproduced here in six lines because the Electron main process
 * cannot be imported under vitest) across MULTIPLE REFRESHES OF ONE
 * PROCESS.
 */
describe("commerce_private_order_apply: multi-refresh, single-process replay of the real caller's dedup discipline", () => {
  /** The exact shell `applyInboundPrivateOrderSyncNonFatal()` now is. */
  function refresh(store: { order: Order | undefined }, appliedEventIds: Set<string>, events: readonly { id: string; sender: string; payload: InboundPrivateOrderSyncPayload }[]): void {
    for (const event of events) {
      if (appliedEventIds.has(event.id)) continue;
      const result = applyInboundPrivateOrderSyncPayload({
        existingOrder: store.order,
        senderPubkeyHex: event.sender,
        payload: event.payload,
      });
      if (result.outcome === "retry-later") continue;
      appliedEventIds.add(event.id);
      if (result.outcome === "applied") store.order = result.order;
    }
  }

  it("REGRESSION: an event refused before the local state qualified is re-evaluated and APPLIES on a later refresh of the SAME process", () => {
    const store = { order: orderAt("fulfilling") as Order | undefined };
    const appliedEventIds = new Set<string>();
    const completedEvent = { id: "event-completed", sender: BUYER, payload: payload({ status: "completed" }) };

    // Refresh #1 -- exactly the live-proven situation: the order-sync pass
    // runs before the delivery pass has moved the local Order to
    // "delivered", so the event is (correctly) refused.
    refresh(store, appliedEventIds, [completedEvent]);
    expect(store.order?.status).toBe("fulfilling");
    expect(appliedEventIds.has("event-completed"), "a merely-early refusal must NOT consume the event id").toBe(false);

    // The delivery pass (later in the SAME refresh, in the real app) moves
    // the local Order to "delivered".
    store.order = orderAt("delivered");

    // Refresh #2 -- SAME process, SAME dedup set, SAME event. This is the
    // assertion that fails on the pre-fix implementation.
    refresh(store, appliedEventIds, [completedEvent]);
    expect(store.order?.status).toBe("completed");
    expect(appliedEventIds.has("event-completed"), "once genuinely applied the event id IS retired").toBe(true);
  });

  it("BOUNDEDNESS: a genuinely inapplicable event is retired on its first evaluation and never re-evaluated, and re-delivering an applied event is a safe no-op forever", () => {
    const store = { order: orderAt("delivered") as Order | undefined };
    const appliedEventIds = new Set<string>();
    const staleEvent = { id: "event-stale", sender: SELLER, payload: payload({ status: "accepted" }) };
    const wrongOrderEvent = { id: "event-wrong-order", sender: BUYER, payload: payload({ status: "completed", productId: "some-other-product" }) };
    const completedEvent = { id: "event-completed", sender: BUYER, payload: payload({ status: "completed" }) };

    refresh(store, appliedEventIds, [staleEvent, wrongOrderEvent, completedEvent]);
    expect(store.order?.status).toBe("completed");
    expect([...appliedEventIds].sort()).toEqual(["event-completed", "event-stale", "event-wrong-order"]);

    // Ten more refreshes with the relay replaying everything: no further
    // state change, and nothing ever leaves the dedup set.
    const before = store.order;
    for (let i = 0; i < 10; i += 1) refresh(store, appliedEventIds, [staleEvent, wrongOrderEvent, completedEvent]);
    expect(store.order).toBe(before);
    expect(appliedEventIds.size).toBe(3);
  });

  it("IDEMPOTENCY IS NOT WEAKENED: even with the dedup set emptied (a fresh process re-reading the relay's whole history), replaying every event leaves the final state identical", () => {
    const store = { order: orderAt("delivered") as Order | undefined };
    const completedEvent = { id: "event-completed", sender: BUYER, payload: payload({ status: "completed" }) };

    refresh(store, new Set<string>(), [completedEvent]);
    const afterFirst = store.order;
    expect(afterFirst?.status).toBe("completed");

    // A brand-new (empty) dedup set every time -- the state machine's own
    // status guard, not the Set, is what makes this safe.
    for (let i = 0; i < 5; i += 1) refresh(store, new Set<string>(), [completedEvent]);
    expect(store.order).toBe(afterFirst);
    expect(store.order?.history.filter((h) => h.action === "complete").length).toBe(1);
  });
});
