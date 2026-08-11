import { describe, it, expect } from "vitest";
import { applyOrderAction, createOrder } from "../src/os/commerce/order/order_state_machine.js";
import type { Order, OrderAction, OrderActor } from "../src/os/commerce/order/order_types.js";

/**
 * Order authority tests (brief §13 — Order authority).
 *
 * The load-bearing property this file exists to prove: a bare customer or
 * merchant CLAIM of "I paid" (or "I delivered it") must NEVER by itself
 * cause the state machine's payment/delivery-equivalent transition, and no
 * AI/bot actor may ever cause one either (there is no such actor kind —
 * see `order_types.ts`'s `OrderActorKind`). Every test below exercises the
 * REAL `applyOrderAction`/`createOrder` functions — nothing here is a
 * comment/convention substitute for a runtime check.
 */

const CUSTOMER = "1".repeat(64);
const OTHER_CUSTOMER = "2".repeat(64);
const MERCHANT = "f".repeat(64);
const OTHER_MERCHANT = "e".repeat(64);
const NOW = 1_700_000_000;

const CUSTOMER_ACTOR: OrderActor = { kind: "customer", pubkey: CUSTOMER };
const MERCHANT_ACTOR: OrderActor = { kind: "merchant", pubkey: MERCHANT };

function freshOrder(): Order {
  const result = createOrder(
    { id: "order-1", productId: "product-1", sellerPubkey: MERCHANT, unitPriceCents: 500, currency: "USD" },
    CUSTOMER_ACTOR,
    NOW,
  );
  if (!result.ok) throw new Error("fixture setup failed");
  return result.order;
}

function advance(order: Order, steps: OrderAction[]): Order {
  let current = order;
  let t = NOW;
  for (const action of steps) {
    t += 1;
    const result = applyOrderAction(current, action, t);
    if (!result.ok) throw new Error(`fixture step "${action.type}" rejected: ${result.reason}`);
    current = result.order;
  }
  return current;
}

const SUBMIT: OrderAction = { type: "submit", actor: CUSTOMER_ACTOR };
const ACCEPT: OrderAction = { type: "accept", actor: MERCHANT_ACTOR };

describe("payment authority — the load-bearing guarantee", () => {
  it("1. a raw CUSTOMER claim of settled payment is REJECTED, order stays accepted (not paid)", () => {
    const order = advance(freshOrder(), [SUBMIT, ACCEPT]);
    const result = applyOrderAction(
      order,
      {
        type: "confirm_payment",
        actor: { kind: "customer", pubkey: CUSTOMER },
        evidence: { orderId: order.id, paymentId: "pay-1", status: "settled", observedAt: NOW, reason: "I paid, trust me" },
      },
      NOW + 10,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unauthorized_actor");
  });

  it("2. a raw MERCHANT claim of settled payment is REJECTED, order stays accepted (not paid)", () => {
    const order = advance(freshOrder(), [SUBMIT, ACCEPT]);
    const result = applyOrderAction(
      order,
      {
        type: "confirm_payment",
        actor: { kind: "merchant", pubkey: MERCHANT },
        evidence: { orderId: order.id, paymentId: "pay-1", status: "settled", observedAt: NOW, reason: "customer says they paid" },
      },
      NOW + 10,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unauthorized_actor");
    expect(order.status).toBe("accepted");
  });

  it("3. only actor.kind === \"payment_evidence\" can cause the paid transition", () => {
    const order = advance(freshOrder(), [SUBMIT, ACCEPT]);
    const result = applyOrderAction(
      order,
      {
        type: "confirm_payment",
        actor: { kind: "payment_evidence" },
        evidence: { orderId: order.id, paymentId: "pay-1", status: "settled", observedAt: NOW, reason: "verified settlement" },
      },
      NOW + 10,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.order.status).toBe("paid");
  });

  it("4. there is no AI/bot actor kind that can be constructed at all (structural check on the type surface)", () => {
    // TypeScript enforces this at compile time (OrderActorKind has exactly
    // four members) — this test documents/pins that fact at the value
    // level too: every valid kind is one of the four, and attempting to
    // widen with an arbitrary string and cast it through does NOT get
    // authorized for confirm_payment.
    const order = advance(freshOrder(), [SUBMIT, ACCEPT]);
    const forgedActor = { kind: "ai_agent" } as unknown as OrderActor;
    const result = applyOrderAction(
      order,
      {
        type: "confirm_payment",
        actor: forgedActor,
        evidence: { orderId: order.id, paymentId: "pay-1", status: "settled", observedAt: NOW, reason: "bot claim" },
      },
      NOW + 10,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unauthorized_actor");
  });

  it("5. payment evidence for the WRONG order (orderId mismatch) is rejected", () => {
    const order = advance(freshOrder(), [SUBMIT, ACCEPT]);
    const result = applyOrderAction(
      order,
      {
        type: "confirm_payment",
        actor: { kind: "payment_evidence" },
        evidence: { orderId: "some-other-order", paymentId: "pay-1", status: "settled", observedAt: NOW, reason: "x" },
      },
      NOW + 10,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("evidence_mismatch");
  });

  it("6. non-settled evidence (expired/refunded/error) never causes the paid transition", () => {
    const order = advance(freshOrder(), [SUBMIT, ACCEPT]);
    for (const status of ["expired", "refunded", "error"] as const) {
      const result = applyOrderAction(
        order,
        {
          type: "confirm_payment",
          actor: { kind: "payment_evidence" },
          evidence: { orderId: order.id, paymentId: "pay-1", status, observedAt: NOW, reason: "x" },
        },
        NOW + 10,
      );
      expect(result.ok, status).toBe(false);
      if (!result.ok) expect(result.code).toBe("evidence_not_settled");
    }
  });

  it("7. duplicate settled evidence for the SAME paymentId while already paid is idempotent (no double transition, no error)", () => {
    const paid = advance(freshOrder(), [
      SUBMIT,
      ACCEPT,
      {
        type: "confirm_payment",
        actor: { kind: "payment_evidence" },
        evidence: { orderId: "order-1", paymentId: "pay-1", status: "settled", observedAt: NOW, reason: "first settlement" },
      },
    ]);
    expect(paid.status).toBe("paid");
    const repeat = applyOrderAction(
      paid,
      {
        type: "confirm_payment",
        actor: { kind: "payment_evidence" },
        evidence: { orderId: paid.id, paymentId: "pay-1", status: "settled", observedAt: NOW + 1, reason: "duplicate webhook delivery" },
      },
      NOW + 20,
    );
    expect(repeat.ok).toBe(true);
    if (repeat.ok) {
      expect(repeat.order.status).toBe("paid");
      expect(repeat.order.history).toHaveLength(paid.history.length); // no new history entry was appended
    }
  });

  it("8. settled evidence for a DIFFERENT paymentId while already paid is rejected (no double-grant across payments)", () => {
    const paid = advance(freshOrder(), [
      SUBMIT,
      ACCEPT,
      {
        type: "confirm_payment",
        actor: { kind: "payment_evidence" },
        evidence: { orderId: "order-1", paymentId: "pay-1", status: "settled", observedAt: NOW, reason: "first settlement" },
      },
    ]);
    const result = applyOrderAction(
      paid,
      {
        type: "confirm_payment",
        actor: { kind: "payment_evidence" },
        evidence: { orderId: paid.id, paymentId: "pay-2", status: "settled", observedAt: NOW + 1, reason: "a second, different payment" },
      },
      NOW + 20,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("evidence_mismatch");
  });
});

describe("delivery authority — mirrors the payment discipline", () => {
  function paidOrder(): Order {
    return advance(freshOrder(), [
      SUBMIT,
      ACCEPT,
      {
        type: "confirm_payment",
        actor: { kind: "payment_evidence" },
        evidence: { orderId: "order-1", paymentId: "pay-1", status: "settled", observedAt: NOW, reason: "settled" },
      },
      { type: "fulfill", actor: MERCHANT_ACTOR },
    ]);
  }

  it("9. a raw MERCHANT claim of delivery is REJECTED", () => {
    const fulfilling = paidOrder();
    const result = applyOrderAction(
      fulfilling,
      {
        type: "confirm_delivery",
        actor: { kind: "merchant", pubkey: MERCHANT },
        evidence: { orderId: fulfilling.id, deliveryId: "d-1", status: "delivered", observedAt: NOW, reason: "I shipped it" },
      },
      NOW + 10,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unauthorized_actor");
    expect(fulfilling.status).toBe("fulfilling");
  });

  it("10. a raw CUSTOMER claim of delivery is REJECTED", () => {
    const fulfilling = paidOrder();
    const result = applyOrderAction(
      fulfilling,
      {
        type: "confirm_delivery",
        actor: { kind: "customer", pubkey: CUSTOMER },
        evidence: { orderId: fulfilling.id, deliveryId: "d-1", status: "delivered", observedAt: NOW, reason: "I got it" },
      },
      NOW + 10,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unauthorized_actor");
  });

  it("11. only actor.kind === \"delivery_evidence\" causes the delivered transition", () => {
    const fulfilling = paidOrder();
    const result = applyOrderAction(
      fulfilling,
      {
        type: "confirm_delivery",
        actor: { kind: "delivery_evidence" },
        evidence: { orderId: fulfilling.id, deliveryId: "d-1", status: "delivered", observedAt: NOW, reason: "verified" },
      },
      NOW + 10,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.order.status).toBe("delivered");
  });
});

describe("customer authority", () => {
  it("12. only the order's own buyer may submit/cancel; a different customer is rejected", () => {
    const order = freshOrder();
    const impersonator: OrderActor = { kind: "customer", pubkey: OTHER_CUSTOMER };
    const submitResult = applyOrderAction(order, { type: "submit", actor: impersonator }, NOW + 1);
    expect(submitResult.ok).toBe(false);
    if (!submitResult.ok) expect(submitResult.code).toBe("unauthorized_actor");

    const cancelResult = applyOrderAction(order, { type: "cancel", actor: impersonator }, NOW + 1);
    expect(cancelResult.ok).toBe(false);
    if (!cancelResult.ok) expect(cancelResult.code).toBe("unauthorized_actor");
  });

  it("13. a merchant may never submit or cancel a customer's order", () => {
    const order = freshOrder();
    const submitResult = applyOrderAction(order, { type: "submit", actor: MERCHANT_ACTOR }, NOW + 1);
    expect(submitResult.ok).toBe(false);
    if (!submitResult.ok) expect(submitResult.code).toBe("unauthorized_actor");

    const cancelResult = applyOrderAction(order, { type: "cancel", actor: MERCHANT_ACTOR }, NOW + 1);
    expect(cancelResult.ok).toBe(false);
    if (!cancelResult.ok) expect(cancelResult.code).toBe("unauthorized_actor");
  });

  it("14. cancel policy: permitted before acceptance (created/submitted), forbidden from accepted onward", () => {
    const accepted = advance(freshOrder(), [SUBMIT, ACCEPT]);
    const result = applyOrderAction(accepted, { type: "cancel", actor: CUSTOMER_ACTOR }, NOW + 10);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_state");
  });
});

describe("merchant authority", () => {
  it("15. only the order's own seller may accept/reject/fulfill; a different merchant is rejected", () => {
    const submitted = advance(freshOrder(), [SUBMIT]);
    const impersonator: OrderActor = { kind: "merchant", pubkey: OTHER_MERCHANT };
    const acceptResult = applyOrderAction(submitted, { type: "accept", actor: impersonator }, NOW + 10);
    expect(acceptResult.ok).toBe(false);
    if (!acceptResult.ok) expect(acceptResult.code).toBe("unauthorized_actor");

    const rejectResult = applyOrderAction(submitted, { type: "reject", actor: impersonator }, NOW + 10);
    expect(rejectResult.ok).toBe(false);
    if (!rejectResult.ok) expect(rejectResult.code).toBe("unauthorized_actor");
  });

  it("16. a customer may never accept, reject, or fulfill", () => {
    const submitted = advance(freshOrder(), [SUBMIT]);
    for (const type of ["accept", "reject", "fulfill"] as const) {
      const result = applyOrderAction(submitted, { type, actor: CUSTOMER_ACTOR }, NOW + 10);
      expect(result.ok, type).toBe(false);
      if (!result.ok) expect(result.code).toBe("unauthorized_actor");
    }
  });
});

describe("self-dealing — a customer may never be their own order's seller", () => {
  it("18. same actor pubkey as buyer and seller is REJECTED at creation with code \"self_dealing\"", () => {
    const result = createOrder(
      { id: "order-self", productId: "product-1", sellerPubkey: CUSTOMER, unitPriceCents: 500, currency: "USD" },
      CUSTOMER_ACTOR,
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("self_dealing");
  });

  it("19. a legitimate distinct buyer/seller pair still succeeds (no false positive)", () => {
    const result = createOrder(
      { id: "order-legit", productId: "product-1", sellerPubkey: MERCHANT, unitPriceCents: 500, currency: "USD" },
      CUSTOMER_ACTOR,
      NOW,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.order.buyerPubkey).toBe(CUSTOMER);
      expect(result.order.sellerPubkey).toBe(MERCHANT);
    }
  });

  it("20. the check is unconditional — there is no caller-suppliable role/flag on the actor or input that bypasses it", () => {
    // OrderActor has exactly two fields (`kind`, `pubkey`) and CreateOrderInput
    // carries no role/flag of its own — there is nothing to spoof. This test
    // forges an actor with an extra, unrecognized property (simulating a
    // caller from some hypothetical "UI role" trying to smuggle in a flag
    // the state machine might trust) and confirms it changes nothing: the
    // self-dealing gate still fires purely off `actor.pubkey === input.sellerPubkey`.
    const forgedActor = { kind: "customer", pubkey: CUSTOMER, role: "trusted-merchant-ui" } as unknown as OrderActor;
    const result = createOrder(
      { id: "order-spoof", productId: "product-1", sellerPubkey: CUSTOMER, unitPriceCents: 500, currency: "USD" },
      forgedActor,
      NOW,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("self_dealing");
  });

  it("21. case-variant hex is NOT caught by this check — documented, pre-existing repo-wide convention, not a new gap", () => {
    // This codebase's pubkey comparisons (this file's own `isActorIdentityAuthorized`,
    // `local_order_repository.ts`, `delivery_state_machine.ts`,
    // `reputation_issuance.ts`) all use plain `===` with no case/encoding
    // normalization anywhere — Nostr pubkeys are canonically lowercase hex
    // secp256k1 keys, so a genuine same-identity case mismatch is not a
    // realistic vector in practice (every real caller in this codebase
    // already produces/consumes lowercase hex consistently; a mismatched
    // case would already break every OTHER identity check in this file,
    // e.g. `isActorIdentityAuthorized`, long before self-dealing became a
    // concern). This test documents that an uppercase variant of the same
    // underlying pubkey is treated as a DIFFERENT string and therefore is
    // NOT rejected as self-dealing — consistent with, not a regression
    // introduced by, this fix.
    // CUSTOMER/MERCHANT above are all-digit strings ("1"/"f" repeated), which
    // have no case to vary — a digit-only string is unchanged by
    // `.toUpperCase()`, so this needs its own actor pubkey containing actual
    // hex letters to exercise case variance at all.
    const lowerHexActor: OrderActor = { kind: "customer", pubkey: "a".repeat(64) };
    const upperHexSeller = "a".repeat(64).toUpperCase();
    const result = createOrder(
      { id: "order-case", productId: "product-1", sellerPubkey: upperHexSeller, unitPriceCents: 500, currency: "USD" },
      lowerHexActor,
      NOW,
    );
    expect(result.ok).toBe(true); // documents current (pre-existing convention) behavior, not an endorsement
  });

  it("22. two different legitimate personas/pubkeys still work correctly (no over-broad rejection)", () => {
    const first = createOrder(
      { id: "order-a", productId: "product-1", sellerPubkey: MERCHANT, unitPriceCents: 500, currency: "USD" },
      CUSTOMER_ACTOR,
      NOW,
    );
    const second = createOrder(
      { id: "order-b", productId: "product-2", sellerPubkey: OTHER_MERCHANT, unitPriceCents: 750, currency: "USD" },
      { kind: "customer", pubkey: OTHER_CUSTOMER },
      NOW,
    );
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
  });
});

describe("complete authority", () => {
  it("17. either the order's own buyer or seller may complete; an unrelated pubkey may not", () => {
    const delivered = advance(freshOrder(), [
      SUBMIT,
      ACCEPT,
      {
        type: "confirm_payment",
        actor: { kind: "payment_evidence" },
        evidence: { orderId: "order-1", paymentId: "pay-1", status: "settled", observedAt: NOW, reason: "x" },
      },
      { type: "fulfill", actor: MERCHANT_ACTOR },
      {
        type: "confirm_delivery",
        actor: { kind: "delivery_evidence" },
        evidence: { orderId: "order-1", deliveryId: "d-1", status: "delivered", observedAt: NOW, reason: "x" },
      },
    ]);

    const strangerResult = applyOrderAction(
      delivered,
      { type: "complete", actor: { kind: "customer", pubkey: OTHER_CUSTOMER } },
      NOW + 10,
    );
    expect(strangerResult.ok).toBe(false);
    if (!strangerResult.ok) expect(strangerResult.code).toBe("unauthorized_actor");

    const buyerResult = applyOrderAction(delivered, { type: "complete", actor: CUSTOMER_ACTOR }, NOW + 10);
    expect(buyerResult.ok).toBe(true);
  });
});
