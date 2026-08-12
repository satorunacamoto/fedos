import { describe, expect, it } from "vitest";
import { applyInboundPrivateDeliverySyncPayload } from "../src/os/commerce/events/commerce_private_delivery_apply.js";
import type { PrivateDeliverySyncPayload } from "../src/os/commerce/events/commerce_private_delivery_sync.js";
import type { DeliveryRecord } from "../src/os/commerce/delivery/index.js";

/**
 * FedOS Commerce Purchase Completion mega-arc (Agent D) — coverage for
 * `applyInboundPrivateDeliverySyncPayload()`, the receive-side
 * reconciliation this arc's own "Cross-process delivery" requirement
 * depends on. Covers this arc's required test set at the domain layer:
 *   - "delivery send/receive": Bob's real 'fulfilling' claim materializes
 *     a brand-new local `DeliveryRecord` on Alice's independent process
 *     (never a shared-repository shortcut — this function only ever sees
 *     what the caller passed in as `existingDelivery`/`orderPaymentConfirmed`,
 *     modeling exactly what a second, independent process would locally
 *     hold).
 *   - "delivery replay (no duplicate side effects)": re-applying the SAME
 *     wire event twice is a safe, idempotent no-op.
 *   - "wrong-buyer content access (must be REJECTED)" — the delivery-side
 *     analogue: a seller CANNOT manufacture the buyer's own
 *     "recipient_acknowledged" claim, and no third-party sender can either.
 */

const BUYER = "b".repeat(64);
const SELLER = "s".repeat(64);
const MALLORY = "m".repeat(64);

function payload(overrides: Partial<PrivateDeliverySyncPayload> = {}): PrivateDeliverySyncPayload {
  return {
    category: "private-delivery-sync",
    formatVersion: 1,
    deliveryId: "delivery-1",
    orderId: "order-1",
    buyerPubkey: BUYER,
    sellerPubkey: SELLER,
    action: "fulfilling",
    at: 1_700_000_000,
    ...overrides,
  };
}

describe("commerce_private_delivery_apply: 'fulfilling' -- materialization on a fresh receiving process (delivery send/receive)", () => {
  it("materializes a brand-new local DeliveryRecord (pending->fulfilling in one step) when the sender is genuinely the seller and the local Order is already paid+", () => {
    const result = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: undefined,
      orderPaymentConfirmed: true,
      senderPubkeyHex: SELLER,
      payload: payload(),
    });
    expect(result.outcome).toBe("applied");
    if (result.outcome !== "applied") throw new Error("unreachable");
    expect(result.delivery.id).toBe("delivery-1");
    expect(result.delivery.orderId).toBe("order-1");
    expect(result.delivery.buyerPubkey).toBe(BUYER);
    expect(result.delivery.sellerPubkey).toBe(SELLER);
    expect(result.delivery.status).toBe("fulfilling");
    // Full audit fidelity preserved even though only ONE wire event triggered this.
    expect(result.delivery.history.map((h) => h.action)).toEqual(["create", "start_fulfillment"]);
  });

  it("rejects materialization when the sender is NOT the real seller (a third party cannot forge a fulfillment claim)", () => {
    const result = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: undefined,
      orderPaymentConfirmed: true,
      senderPubkeyHex: MALLORY,
      payload: payload(),
    });
    expect(result.outcome).toBe("rejected");
  });

  it("rejects materialization when the receiving process's own local Order is not yet paid (never trusts the wire claim alone)", () => {
    const result = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: undefined,
      orderPaymentConfirmed: false,
      senderPubkeyHex: SELLER,
      payload: payload(),
    });
    expect(result.outcome).toBe("rejected");
  });
});

describe("commerce_private_delivery_apply: 'fulfilling' -- replay (no duplicate side effects)", () => {
  it("re-applying the identical 'fulfilling' event twice against a process that already materialized it is a safe no-op, not a re-transition", () => {
    const first = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: undefined,
      orderPaymentConfirmed: true,
      senderPubkeyHex: SELLER,
      payload: payload(),
    });
    expect(first.outcome).toBe("applied");
    if (first.outcome !== "applied") throw new Error("unreachable");

    const replay = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: first.delivery,
      orderPaymentConfirmed: true,
      senderPubkeyHex: SELLER,
      payload: payload(),
    });
    expect(replay.outcome).toBe("no-op");
    // No second history entry, no mutation -- verified by re-checking the
    // ORIGINAL record object is untouched (this function never mutates its
    // inputs) and its own history length is unchanged.
    expect(first.delivery.history).toHaveLength(2);
  });
});

describe("commerce_private_delivery_apply: 'recipient_acknowledged' -- Seller must NOT be able to manufacture Buyer acknowledgment", () => {
  function fulfillingDelivery(): DeliveryRecord {
    const created = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: undefined,
      orderPaymentConfirmed: true,
      senderPubkeyHex: SELLER,
      payload: payload(),
    });
    if (created.outcome !== "applied") throw new Error("setup failed");
    return created.delivery;
  }

  it("REJECTS a 'recipient_acknowledged' claim purporting to come from the buyer when the real verified sender is the SELLER", () => {
    const delivery = fulfillingDelivery();
    const result = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: delivery,
      orderPaymentConfirmed: true,
      senderPubkeyHex: SELLER, // the seller trying to sign as if acknowledging their own delivery
      payload: payload({ action: "recipient_acknowledged" }),
    });
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.reason).toMatch(/buyer/i);
    // The local record must remain exactly as it was -- never silently advanced to "delivered".
    expect(delivery.status).toBe("fulfilling");
  });

  it("REJECTS a 'recipient_acknowledged' claim from an unrelated third party", () => {
    const delivery = fulfillingDelivery();
    const result = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: delivery,
      orderPaymentConfirmed: true,
      senderPubkeyHex: MALLORY,
      payload: payload({ action: "recipient_acknowledged" }),
    });
    expect(result.outcome).toBe("rejected");
  });

  it("ACCEPTS the same claim when the real verified sender genuinely IS the buyer, reaching 'delivered' with reconstructed (never wire-trusted) evidence", () => {
    const delivery = fulfillingDelivery();
    const result = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: delivery,
      orderPaymentConfirmed: true,
      senderPubkeyHex: BUYER,
      payload: payload({ action: "recipient_acknowledged", reason: "arrived safely" }),
    });
    expect(result.outcome).toBe("applied");
    if (result.outcome !== "applied") throw new Error("unreachable");
    expect(result.delivery.status).toBe("delivered");
    expect(result.delivery.evidenceSource).toBe("recipient_acknowledgment");
    expect(result.delivery.artifact).toBeDefined();
  });

  it("replaying the SAME buyer acknowledgment twice is idempotent -- no duplicate artifact regeneration, no duplicate history entry", () => {
    const delivery = fulfillingDelivery();
    const first = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: delivery,
      orderPaymentConfirmed: true,
      senderPubkeyHex: BUYER,
      payload: payload({ action: "recipient_acknowledged" }),
    });
    expect(first.outcome).toBe("applied");
    if (first.outcome !== "applied") throw new Error("unreachable");

    const replay = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: first.delivery,
      orderPaymentConfirmed: true,
      senderPubkeyHex: BUYER,
      payload: payload({ action: "recipient_acknowledged" }),
    });
    expect(replay.outcome).toBe("applied"); // ok(delivery) no-op success per delivery_state_machine.ts's own idempotency contract
    if (replay.outcome !== "applied") throw new Error("unreachable");
    expect(replay.delivery).toBe(first.delivery); // literally the SAME object -- confirms no re-derivation happened
    expect(replay.delivery.history).toHaveLength(first.delivery.history.length);
  });

  it("rejects an acknowledgment for a delivery that doesn't exist locally yet (out-of-order, dropped safely)", () => {
    const result = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: undefined,
      orderPaymentConfirmed: true,
      senderPubkeyHex: BUYER,
      payload: payload({ action: "recipient_acknowledged" }),
    });
    expect(result.outcome).toBe("rejected");
  });
});

describe("commerce_private_delivery_apply: 'completed' -- either party, only from 'delivered'", () => {
  function deliveredDelivery(): DeliveryRecord {
    const created = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: undefined,
      orderPaymentConfirmed: true,
      senderPubkeyHex: SELLER,
      payload: payload(),
    });
    if (created.outcome !== "applied") throw new Error("setup failed");
    const delivered = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: created.delivery,
      orderPaymentConfirmed: true,
      senderPubkeyHex: BUYER,
      payload: payload({ action: "recipient_acknowledged" }),
    });
    if (delivered.outcome !== "applied") throw new Error("setup failed");
    return delivered.delivery;
  }

  it("either the real buyer or the real seller may close it out", () => {
    const bySeller = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: deliveredDelivery(),
      orderPaymentConfirmed: true,
      senderPubkeyHex: SELLER,
      payload: payload({ action: "completed" }),
    });
    expect(bySeller.outcome).toBe("applied");
    if (bySeller.outcome === "applied") expect(bySeller.delivery.status).toBe("completed");

    const byBuyer = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: deliveredDelivery(),
      orderPaymentConfirmed: true,
      senderPubkeyHex: BUYER,
      payload: payload({ action: "completed" }),
    });
    expect(byBuyer.outcome).toBe("applied");
  });

  it("rejects a 'completed' claim from an unrelated third party", () => {
    const result = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: deliveredDelivery(),
      orderPaymentConfirmed: true,
      senderPubkeyHex: MALLORY,
      payload: payload({ action: "completed" }),
    });
    expect(result.outcome).toBe("rejected");
  });

  it("replaying 'completed' after it already applied is a safe no-op (state machine's own invalid_state guard)", () => {
    const delivery = deliveredDelivery();
    const first = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: delivery,
      orderPaymentConfirmed: true,
      senderPubkeyHex: BUYER,
      payload: payload({ action: "completed" }),
    });
    expect(first.outcome).toBe("applied");
    if (first.outcome !== "applied") throw new Error("unreachable");
    const replay = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: first.delivery,
      orderPaymentConfirmed: true,
      senderPubkeyHex: BUYER,
      payload: payload({ action: "completed" }),
    });
    expect(replay.outcome).toBe("no-op");
  });
});

describe("commerce_private_delivery_apply: defense in depth -- a sync payload can never silently rebind an existing record's own economics", () => {
  it("rejects a payload whose buyer/seller/orderId does not match the ALREADY-KNOWN local delivery record", () => {
    const created = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: undefined,
      orderPaymentConfirmed: true,
      senderPubkeyHex: SELLER,
      payload: payload(),
    });
    if (created.outcome !== "applied") throw new Error("setup failed");

    const mismatched = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: created.delivery,
      orderPaymentConfirmed: true,
      senderPubkeyHex: BUYER,
      payload: payload({ action: "recipient_acknowledged", orderId: "a-different-order" }),
    });
    expect(mismatched.outcome).toBe("rejected");
  });
});

/**
 * FedOS Commerce Purchase Completion mega-arc (completion-lag fix round) —
 * the `retryable` half of every non-`"applied"` outcome. Same defect and
 * same discipline as `commerce_private_order_apply.test.ts`: the CALLER
 * (`fedos_electron_beta_main.cts`) may only retire an inbound event id from
 * its process-lifetime dedup set once the apply genuinely RESOLVED. A
 * refusal that is merely EARLY must stay eligible, or a pure ordering race
 * becomes a permanent per-process drop.
 */
describe("commerce_private_delivery_apply: 'not yet' (retryable) is distinguished from 'never' (retired)", () => {
  /** Drives a real local `DeliveryRecord` to `pending`/`fulfilling`/`delivered`/`completed` through this module's own real transitions. */
  function deliveryAt(status: "fulfilling" | "delivered" | "completed"): DeliveryRecord {
    const created = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: undefined,
      orderPaymentConfirmed: true,
      senderPubkeyHex: SELLER,
      payload: payload({ action: "fulfilling" }),
    });
    if (created.outcome !== "applied") throw new Error("fixture: fulfilling failed");
    if (status === "fulfilling") return created.delivery;
    const delivered = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: created.delivery,
      orderPaymentConfirmed: true,
      senderPubkeyHex: BUYER,
      payload: payload({ action: "recipient_acknowledged" }),
    });
    if (delivered.outcome !== "applied") throw new Error("fixture: recipient_acknowledged failed");
    if (status === "delivered") return delivered.delivery;
    const completed = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: delivered.delivery,
      orderPaymentConfirmed: true,
      senderPubkeyHex: BUYER,
      payload: payload({ action: "completed" }),
    });
    if (completed.outcome !== "applied") throw new Error("fixture: completed failed");
    return completed.delivery;
  }

  it("a buyer acknowledgment arriving before the seller's own 'fulfilling' did is RETRYABLE (out of order, not invalid)", () => {
    const result = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: undefined,
      orderPaymentConfirmed: true,
      senderPubkeyHex: BUYER,
      payload: payload({ action: "recipient_acknowledged" }),
    });
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.retryable).toBe(true);

    // ...and the SAME event applies once the record exists.
    const later = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: deliveryAt("fulfilling"),
      orderPaymentConfirmed: true,
      senderPubkeyHex: BUYER,
      payload: payload({ action: "recipient_acknowledged" }),
    });
    expect(later.outcome).toBe("applied");
  });

  it("a 'completed' arriving before the record reached 'delivered' is RETRYABLE, and applies once it has", () => {
    const early = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: deliveryAt("fulfilling"),
      orderPaymentConfirmed: true,
      senderPubkeyHex: BUYER,
      payload: payload({ action: "completed" }),
    });
    expect(early.outcome).toBe("no-op");
    if (early.outcome !== "no-op") throw new Error("unreachable");
    expect(early.retryable).toBe(true);

    const later = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: deliveryAt("delivered"),
      orderPaymentConfirmed: true,
      senderPubkeyHex: BUYER,
      payload: payload({ action: "completed" }),
    });
    expect(later.outcome).toBe("applied");
  });

  it("a 'fulfilling' refused only because this process's own Order is not payment-confirmed YET is RETRYABLE", () => {
    const early = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: undefined,
      orderPaymentConfirmed: false,
      senderPubkeyHex: SELLER,
      payload: payload({ action: "fulfilling" }),
    });
    expect(early.outcome).toBe("rejected");
    if (early.outcome !== "rejected") throw new Error("unreachable");
    expect(early.retryable, "order_not_paid is a local-state race, not a verdict about these bytes").toBe(true);

    const later = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: undefined,
      orderPaymentConfirmed: true,
      senderPubkeyHex: SELLER,
      payload: payload({ action: "fulfilling" }),
    });
    expect(later.outcome).toBe("applied");
  });

  it("BOUNDED: a genuine REPLAY of an already-applied action is NOT retryable (superseded forever)", () => {
    const fulfillingReplay = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: deliveryAt("fulfilling"),
      orderPaymentConfirmed: true,
      senderPubkeyHex: SELLER,
      payload: payload({ action: "fulfilling" }),
    });
    expect(fulfillingReplay.outcome).toBe("no-op");
    if (fulfillingReplay.outcome !== "no-op") throw new Error("unreachable");
    expect(fulfillingReplay.retryable).toBe(false);

    const completedReplay = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: deliveryAt("completed"),
      orderPaymentConfirmed: true,
      senderPubkeyHex: BUYER,
      payload: payload({ action: "completed" }),
    });
    expect(completedReplay.outcome).toBe("no-op");
    if (completedReplay.outcome !== "no-op") throw new Error("unreachable");
    expect(completedReplay.retryable).toBe(false);
  });

  it("BOUNDED + TRUST BOUNDARY: every AUTHORITY refusal is retired immediately, never retried forever", () => {
    // A seller trying to manufacture the buyer's acknowledgment.
    const forged = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: deliveryAt("fulfilling"),
      orderPaymentConfirmed: true,
      senderPubkeyHex: SELLER,
      payload: payload({ action: "recipient_acknowledged" }),
    });
    expect(forged.outcome).toBe("rejected");
    if (forged.outcome !== "rejected") throw new Error("unreachable");
    expect(forged.retryable, "a forged acknowledgment must never be kept alive for retry").toBe(false);

    // A total stranger.
    const stranger = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: deliveryAt("delivered"),
      orderPaymentConfirmed: true,
      senderPubkeyHex: MALLORY,
      payload: payload({ action: "completed" }),
    });
    expect(stranger.outcome).toBe("rejected");
    if (stranger.outcome !== "rejected") throw new Error("unreachable");
    expect(stranger.retryable).toBe(false);

    // A payload smuggling different identity fields.
    const mismatched = applyInboundPrivateDeliverySyncPayload({
      existingDelivery: deliveryAt("fulfilling"),
      orderPaymentConfirmed: true,
      senderPubkeyHex: BUYER,
      payload: payload({ action: "recipient_acknowledged", orderId: "a-different-order" }),
    });
    expect(mismatched.outcome).toBe("rejected");
    if (mismatched.outcome !== "rejected") throw new Error("unreachable");
    expect(mismatched.retryable).toBe(false);
  });
});
