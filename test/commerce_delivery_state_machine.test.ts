import { describe, it, expect } from "vitest";
import { applyDeliveryAction, createDelivery, getAvailableDeliveryActions, isTerminalDeliveryStatus } from "../src/os/commerce/delivery/delivery_state_machine.js";
import type {
  CreateDeliveryInput,
  DeliveryEvidence,
  DeliveryRecord,
} from "../src/os/commerce/delivery/delivery_types.js";

/**
 * Commerce E2E Completion arc, Agent D (Wave B) -- Delivery state machine
 * tests. Covers the brief's §16/§19/§20 failure cases: delivery before
 * paid, a bare merchant DELIVERED claim, duplicate evidence idempotency,
 * and the full pending -> fulfilling -> delivered -> completed happy path.
 */

const CUSTOMER = "1".repeat(64);
const MERCHANT = "f".repeat(64);
const OTHER_MERCHANT = "e".repeat(64);
const NOW = 1_700_000_000;

function baseInput(overrides: Partial<CreateDeliveryInput> = {}): CreateDeliveryInput {
  return {
    id: "delivery-1",
    orderId: "order-1",
    buyerPubkey: CUSTOMER,
    sellerPubkey: MERCHANT,
    orderPaymentConfirmed: true,
    ...overrides,
  };
}

function freshDelivery(overrides: Partial<CreateDeliveryInput> = {}): DeliveryRecord {
  const result = createDelivery(baseInput(overrides), { kind: "merchant", pubkey: overrides.sellerPubkey ?? MERCHANT }, NOW);
  if (!result.ok) throw new Error("fixture setup failed: " + result.reason);
  return result.delivery;
}

function acknowledgmentEvidence(overrides: Partial<DeliveryEvidence> = {}): DeliveryEvidence {
  return {
    deliveryId: "delivery-1",
    orderId: "order-1",
    status: "delivered",
    observedAt: NOW,
    reason: "customer confirmed receipt",
    verification: { source: "recipient_acknowledgment", authoritative: true, acknowledgedBy: CUSTOMER },
    ...overrides,
  };
}

describe("createDelivery", () => {
  it("1. creates a pending record when orderPaymentConfirmed is true", () => {
    const result = createDelivery(baseInput(), { kind: "merchant", pubkey: MERCHANT }, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.delivery.status).toBe("pending");
      expect(result.delivery.history).toHaveLength(1);
      expect(result.delivery.history[0]?.to).toBe("pending");
    }
  });

  it("2. FAILURE CASE: delivery before paid -- orderPaymentConfirmed: false is rejected with order_not_paid", () => {
    const result = createDelivery(baseInput({ orderPaymentConfirmed: false }), { kind: "merchant", pubkey: MERCHANT }, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("order_not_paid");
  });

  it("3. rejects a non-merchant actor", () => {
    const result = createDelivery(baseInput(), { kind: "customer", pubkey: CUSTOMER }, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unauthorized_actor");
  });

  it("4. rejects when actor pubkey does not match sellerPubkey", () => {
    const result = createDelivery(baseInput(), { kind: "merchant", pubkey: OTHER_MERCHANT }, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unauthorized_actor");
  });

  it("5. rejects empty id/orderId/buyerPubkey", () => {
    expect(createDelivery(baseInput({ id: "" }), { kind: "merchant", pubkey: MERCHANT }, NOW).ok).toBe(false);
    expect(createDelivery(baseInput({ orderId: "" }), { kind: "merchant", pubkey: MERCHANT }, NOW).ok).toBe(false);
    expect(createDelivery(baseInput({ buyerPubkey: "" }), { kind: "merchant", pubkey: MERCHANT }, NOW).ok).toBe(false);
  });
});

describe("start_fulfillment (bare merchant claim -- self-asserted, permitted)", () => {
  it("6. pending -> fulfilling via a bare MerchantDeliveryClaim", () => {
    const delivery = freshDelivery();
    const result = applyDeliveryAction(
      delivery,
      { type: "start_fulfillment", actor: { kind: "merchant", pubkey: MERCHANT }, claim: { deliveryId: "delivery-1", orderId: "order-1", claimedAt: NOW } },
      NOW + 1,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.delivery.status).toBe("fulfilling");
  });

  it("7. rejects start_fulfillment from a customer actor (wrong actor kind)", () => {
    const delivery = freshDelivery();
    const result = applyDeliveryAction(
      delivery,
      { type: "start_fulfillment", actor: { kind: "customer", pubkey: CUSTOMER }, claim: { deliveryId: "delivery-1", orderId: "order-1", claimedAt: NOW } },
      NOW + 1,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unauthorized_actor");
  });

  it("8. rejects start_fulfillment with a claim for the wrong deliveryId", () => {
    const delivery = freshDelivery();
    const result = applyDeliveryAction(
      delivery,
      { type: "start_fulfillment", actor: { kind: "merchant", pubkey: MERCHANT }, claim: { deliveryId: "wrong-id", orderId: "order-1", claimedAt: NOW } },
      NOW + 1,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("evidence_mismatch");
  });

  it("9. rejects start_fulfillment when not pending (invalid_state)", () => {
    let delivery = freshDelivery();
    delivery = mustOk(
      applyDeliveryAction(delivery, { type: "start_fulfillment", actor: { kind: "merchant", pubkey: MERCHANT }, claim: { deliveryId: "delivery-1", orderId: "order-1", claimedAt: NOW } }, NOW + 1),
    );
    const result = applyDeliveryAction(
      delivery,
      { type: "start_fulfillment", actor: { kind: "merchant", pubkey: MERCHANT }, claim: { deliveryId: "delivery-1", orderId: "order-1", claimedAt: NOW } },
      NOW + 2,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_state");
  });
});

function mustOk(result: ReturnType<typeof applyDeliveryAction>): DeliveryRecord {
  if (!result.ok) throw new Error("expected ok, got: " + result.reason);
  return result.delivery;
}

function fulfillingDelivery(overrides: Partial<CreateDeliveryInput> = {}): DeliveryRecord {
  const delivery = freshDelivery(overrides);
  return mustOk(
    applyDeliveryAction(
      delivery,
      { type: "start_fulfillment", actor: { kind: "merchant", pubkey: overrides.sellerPubkey ?? MERCHANT }, claim: { deliveryId: delivery.id, orderId: delivery.orderId, claimedAt: NOW } },
      NOW + 1,
    ),
  );
}

describe("confirm_delivery -- core invariant: a bare merchant claim must never reach delivered", () => {
  it("10. FAILURE CASE: a merchant actor cannot even attempt confirm_delivery (structural actor-kind gate)", () => {
    const delivery = fulfillingDelivery();
    const result = applyDeliveryAction(
      delivery,
      {
        type: "confirm_delivery",
        actor: { kind: "merchant", pubkey: MERCHANT },
        evidence: acknowledgmentEvidence(),
      },
      NOW + 2,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unauthorized_actor");
  });

  it("11. FAILURE CASE: delivery_evidence actor with merchant_claim provenance is rejected (evidence_not_authoritative) -- defense in depth", () => {
    const delivery = fulfillingDelivery();
    const result = applyDeliveryAction(
      delivery,
      {
        type: "confirm_delivery",
        actor: { kind: "delivery_evidence" },
        evidence: acknowledgmentEvidence({ verification: { source: "merchant_claim", authoritative: false, claimedBy: MERCHANT } }),
      },
      NOW + 2,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("evidence_not_authoritative");
    expect(delivery.status).toBe("fulfilling"); // unchanged
  });

  it("12. FAILURE CASE: missing verification is treated as non-authoritative (fail-closed)", () => {
    const delivery = fulfillingDelivery();
    const result = applyDeliveryAction(
      delivery,
      {
        type: "confirm_delivery",
        actor: { kind: "delivery_evidence" },
        evidence: acknowledgmentEvidence({ verification: undefined }),
      },
      NOW + 2,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("evidence_not_authoritative");
  });

  it("13. recipient_acknowledgment evidence from delivery_evidence actor confirms delivery and produces a real artifact", () => {
    const delivery = fulfillingDelivery();
    const result = applyDeliveryAction(
      delivery,
      { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence: acknowledgmentEvidence() },
      NOW + 2,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.delivery.status).toBe("delivered");
      expect(result.delivery.evidenceSource).toBe("recipient_acknowledgment");
      expect(result.delivery.artifact).toBeDefined();
      expect(result.delivery.artifact?.deliveryId).toBe("delivery-1");
      expect(result.delivery.artifact?.content).toContain("delivery-1");
      expect(() => JSON.parse(result.delivery.artifact?.content ?? "")).not.toThrow();
    }
  });

  it("14. signed_proof evidence (the Agent T seam) also confirms delivery", () => {
    const delivery = fulfillingDelivery();
    const result = applyDeliveryAction(
      delivery,
      {
        type: "confirm_delivery",
        actor: { kind: "delivery_evidence" },
        evidence: acknowledgmentEvidence({ verification: { source: "signed_proof", authoritative: true, provider: "FedosTrustQrReceipt", verifiedAt: NOW } }),
      },
      NOW + 2,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.delivery.evidenceSource).toBe("signed_proof");
  });

  it("15. FAILURE CASE: delivery before fulfilling started (still pending) is rejected", () => {
    const delivery = freshDelivery();
    const result = applyDeliveryAction(
      delivery,
      { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence: acknowledgmentEvidence() },
      NOW + 2,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_state");
  });

  it("16. rejects evidence for the wrong deliveryId", () => {
    const delivery = fulfillingDelivery();
    const result = applyDeliveryAction(
      delivery,
      { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence: acknowledgmentEvidence({ deliveryId: "wrong-id" }) },
      NOW + 2,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("evidence_mismatch");
  });

  it("17. rejects evidence for the wrong orderId", () => {
    const delivery = fulfillingDelivery();
    const result = applyDeliveryAction(
      delivery,
      { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence: acknowledgmentEvidence({ orderId: "wrong-order" }) },
      NOW + 2,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("evidence_mismatch");
  });

  it("18. failed evidence causes no transition (accepted as input, documented gap)", () => {
    const delivery = fulfillingDelivery();
    const result = applyDeliveryAction(
      delivery,
      { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence: acknowledgmentEvidence({ status: "failed" }) },
      NOW + 2,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("evidence_not_authoritative");
    expect(delivery.status).toBe("fulfilling");
  });

  it("19. FAILURE CASE (idempotency): a duplicate 'delivered' evidence event from the same source is a no-op success", () => {
    const delivery = fulfillingDelivery();
    const first = applyDeliveryAction(
      delivery,
      { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence: acknowledgmentEvidence() },
      NOW + 2,
    );
    const delivered = mustOk(first);
    const second = applyDeliveryAction(
      delivered,
      { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence: acknowledgmentEvidence({ observedAt: NOW + 5 }) },
      NOW + 6,
    );
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.delivery.status).toBe("delivered");
      expect(second.delivery.history).toHaveLength(delivered.history.length); // no duplicate history entry
    }
  });

  it("20. a repeat 'delivered' evidence from a DIFFERENT source while already delivered is a mismatch, not silently accepted", () => {
    const delivery = fulfillingDelivery();
    const delivered = mustOk(
      applyDeliveryAction(delivery, { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence: acknowledgmentEvidence() }, NOW + 2),
    );
    const result = applyDeliveryAction(
      delivered,
      {
        type: "confirm_delivery",
        actor: { kind: "delivery_evidence" },
        evidence: acknowledgmentEvidence({ verification: { source: "signed_proof", authoritative: true, provider: "FedosTrustQrReceipt", verifiedAt: NOW } }),
      },
      NOW + 7,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("evidence_mismatch");
  });
});

describe("acknowledge -- delivered -> completed", () => {
  function deliveredDelivery(): DeliveryRecord {
    const delivery = fulfillingDelivery();
    return mustOk(applyDeliveryAction(delivery, { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence: acknowledgmentEvidence() }, NOW + 2));
  }

  it("21. customer may acknowledge/complete a delivered record", () => {
    const delivery = deliveredDelivery();
    const result = applyDeliveryAction(delivery, { type: "acknowledge", actor: { kind: "customer", pubkey: CUSTOMER } }, NOW + 3);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.delivery.status).toBe("completed");
  });

  it("22. merchant may also acknowledge/complete a delivered record", () => {
    const delivery = deliveredDelivery();
    const result = applyDeliveryAction(delivery, { type: "acknowledge", actor: { kind: "merchant", pubkey: MERCHANT } }, NOW + 3);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.delivery.status).toBe("completed");
  });

  it("23. rejects acknowledge from a delivery_evidence actor", () => {
    const delivery = deliveredDelivery();
    const result = applyDeliveryAction(delivery, { type: "acknowledge", actor: { kind: "delivery_evidence" } }, NOW + 3);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unauthorized_actor");
  });

  it("24. rejects acknowledge when not delivered", () => {
    const delivery = fulfillingDelivery();
    const result = applyDeliveryAction(delivery, { type: "acknowledge", actor: { kind: "customer", pubkey: CUSTOMER } }, NOW + 3);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_state");
  });

  it("25. completed is terminal per isTerminalDeliveryStatus", () => {
    expect(isTerminalDeliveryStatus("completed")).toBe(true);
    expect(isTerminalDeliveryStatus("pending")).toBe(false);
    expect(isTerminalDeliveryStatus("fulfilling")).toBe(false);
    expect(isTerminalDeliveryStatus("delivered")).toBe(false);
  });
});

describe("getAvailableDeliveryActions", () => {
  it("26. pending: only merchant start_fulfillment is available", () => {
    const delivery = freshDelivery();
    expect(getAvailableDeliveryActions(delivery, "merchant")).toEqual(["start_fulfillment"]);
    expect(getAvailableDeliveryActions(delivery, "customer")).toEqual([]);
    expect(getAvailableDeliveryActions(delivery, "delivery_evidence")).toEqual([]);
  });

  it("27. fulfilling: only delivery_evidence confirm_delivery is available", () => {
    const delivery = fulfillingDelivery();
    expect(getAvailableDeliveryActions(delivery, "delivery_evidence")).toEqual(["confirm_delivery"]);
    expect(getAvailableDeliveryActions(delivery, "merchant")).toEqual([]);
  });

  it("28. delivered: both customer and merchant may acknowledge", () => {
    const delivery = mustOk(
      applyDeliveryAction(fulfillingDelivery(), { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence: acknowledgmentEvidence() }, NOW + 2),
    );
    expect(getAvailableDeliveryActions(delivery, "customer")).toEqual(["acknowledge"]);
    expect(getAvailableDeliveryActions(delivery, "merchant")).toEqual(["acknowledge"]);
  });

  it("29. completed: no actions available for anyone", () => {
    const delivered = mustOk(
      applyDeliveryAction(fulfillingDelivery(), { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence: acknowledgmentEvidence() }, NOW + 2),
    );
    const completed = mustOk(applyDeliveryAction(delivered, { type: "acknowledge", actor: { kind: "customer", pubkey: CUSTOMER } }, NOW + 3));
    expect(getAvailableDeliveryActions(completed, "customer")).toEqual([]);
    expect(getAvailableDeliveryActions(completed, "merchant")).toEqual([]);
  });
});

describe("end-to-end happy path", () => {
  it("30. pending -> fulfilling -> delivered -> completed, full history recorded", () => {
    const created = freshDelivery();
    const fulfilling = mustOk(
      applyDeliveryAction(created, { type: "start_fulfillment", actor: { kind: "merchant", pubkey: MERCHANT }, claim: { deliveryId: "delivery-1", orderId: "order-1", claimedAt: NOW } }, NOW + 1),
    );
    const delivered = mustOk(
      applyDeliveryAction(fulfilling, { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence: acknowledgmentEvidence() }, NOW + 2),
    );
    const completed = mustOk(applyDeliveryAction(delivered, { type: "acknowledge", actor: { kind: "customer", pubkey: CUSTOMER } }, NOW + 3));

    expect(completed.status).toBe("completed");
    expect(completed.history.map((h) => h.to)).toEqual(["pending", "fulfilling", "delivered", "completed"]);
    expect(completed.artifact).toBeDefined();
  });
});
