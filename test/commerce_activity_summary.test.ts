import { describe, it, expect } from "vitest";
import {
  computeCommerceBuyerActivitySummary,
  computeCommerceSellerActivitySummary,
  type CommerceActivitySummaryOrderLike,
} from "../src/os/commerce/order/activity_summary.js";
import { createOrder, applyOrderAction } from "../src/os/commerce/order/order_state_machine.js";
import { LocalOrderRepository } from "../src/os/commerce/order/local_order_repository.js";
import type { Order } from "../src/os/commerce/order/order_types.js";

/**
 * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
 * (Agent D) — friction-ledger row #14 / arc §32/§36: correct counts
 * against a REAL repository fixture (`LocalOrderRepository` + the real
 * Order state machine), not a hand-built fake shape.
 */

const BUYER = "buyer-pubkey-1".repeat(5).slice(0, 64);
const SELLER = "seller-pubkey-1".repeat(4).slice(0, 64);
const NOW = 100_000;

function makeOrder(repo: LocalOrderRepository, id: string, targetStatus: "created" | "submitted" | "accepted" | "paid" | "fulfilling" | "delivered" | "completed"): Order {
  const created = createOrder({ id, productId: "product-1", sellerPubkey: SELLER, unitPriceCents: 500, currency: "USD" }, { kind: "customer", pubkey: BUYER }, NOW);
  if (!created.ok) throw new Error("unreachable");
  let order = created.order;
  repo.save(order);
  if (targetStatus === "created") return order;

  const submitted = applyOrderAction(order, { type: "submit", actor: { kind: "customer", pubkey: BUYER } }, NOW);
  if (!submitted.ok) throw new Error("unreachable");
  order = submitted.order;
  repo.save(order);
  if (targetStatus === "submitted") return order;

  const accepted = applyOrderAction(order, { type: "accept", actor: { kind: "merchant", pubkey: SELLER } }, NOW);
  if (!accepted.ok) throw new Error("unreachable");
  order = accepted.order;
  repo.save(order);
  if (targetStatus === "accepted") return order;

  const paid = applyOrderAction(
    order,
    { type: "confirm_payment", actor: { kind: "payment_evidence" }, evidence: { orderId: id, paymentId: `pay-${id}`, status: "settled", observedAt: NOW, reason: "settled" } },
    NOW,
  );
  if (!paid.ok) throw new Error("unreachable");
  order = paid.order;
  repo.save(order);
  if (targetStatus === "paid") return order;

  const fulfilling = applyOrderAction(order, { type: "fulfill", actor: { kind: "merchant", pubkey: SELLER } }, NOW);
  if (!fulfilling.ok) throw new Error("unreachable");
  order = fulfilling.order;
  repo.save(order);
  if (targetStatus === "fulfilling") return order;

  const delivered = applyOrderAction(
    order,
    { type: "confirm_delivery", actor: { kind: "delivery_evidence" }, evidence: { orderId: id, deliveryId: `del-${id}`, status: "delivered", observedAt: NOW, reason: "confirmed" } },
    NOW,
  );
  if (!delivered.ok) throw new Error("unreachable");
  order = delivered.order;
  repo.save(order);
  if (targetStatus === "delivered") return order;

  const completed = applyOrderAction(order, { type: "complete", actor: { kind: "customer", pubkey: BUYER } }, NOW);
  if (!completed.ok) throw new Error("unreachable");
  order = completed.order;
  repo.save(order);
  return order;
}

describe("computeCommerceBuyerActivitySummary — real repository fixture", () => {
  it("produces the correct count in EVERY bucket against a real, mixed-status Order set", () => {
    const repo = new LocalOrderRepository();
    makeOrder(repo, "o-created", "created");
    makeOrder(repo, "o-submitted-1", "submitted");
    makeOrder(repo, "o-submitted-2", "submitted");
    makeOrder(repo, "o-accepted", "accepted");
    makeOrder(repo, "o-paid", "paid");
    makeOrder(repo, "o-fulfilling", "fulfilling");
    makeOrder(repo, "o-delivered", "delivered");
    const completedWithReceipt = makeOrder(repo, "o-completed-with-receipt", "completed");
    makeOrder(repo, "o-completed-no-receipt", "completed");

    const orders: readonly CommerceActivitySummaryOrderLike[] = repo.listByBuyer(BUYER);
    const hasReceipt = (orderId: string) => orderId === completedWithReceipt.id;
    const summary = computeCommerceBuyerActivitySummary(orders, hasReceipt);

    expect(summary.draft).toBe(1);
    expect(summary.awaitingSellerAcceptance).toBe(2);
    expect(summary.readyToPay).toBe(1);
    expect(summary.inFulfillment).toBe(2); // paid + fulfilling
    expect(summary.readyToAcknowledge).toBe(1); // fulfilling only
    expect(summary.readyToComplete).toBe(1); // delivered only
    expect(summary.readyReceipts).toBe(1); // only the completed order WITH a durable receipt
  });

  it("an empty order list produces all-zero counts, never throws", () => {
    const summary = computeCommerceBuyerActivitySummary([], () => false);
    expect(summary).toEqual({
      draft: 0,
      awaitingSellerAcceptance: 0,
      readyToPay: 0,
      inFulfillment: 0,
      readyToAcknowledge: 0,
      readyToComplete: 0,
      readyReceipts: 0,
    });
  });
});

describe("computeCommerceSellerActivitySummary — real repository fixture", () => {
  it("produces the correct count in EVERY bucket, and 'completedAwaitingReceipt' is the INVERSE of the buyer's readyReceipts condition", () => {
    const repo = new LocalOrderRepository();
    makeOrder(repo, "s-submitted", "submitted");
    makeOrder(repo, "s-paid-1", "paid");
    makeOrder(repo, "s-paid-2", "paid");
    makeOrder(repo, "s-fulfilling", "fulfilling");
    const completedWithReceipt = makeOrder(repo, "s-completed-with-receipt", "completed");
    makeOrder(repo, "s-completed-no-receipt-1", "completed");
    makeOrder(repo, "s-completed-no-receipt-2", "completed");

    const orders: readonly CommerceActivitySummaryOrderLike[] = repo.listBySeller(SELLER);
    const hasReceipt = (orderId: string) => orderId === completedWithReceipt.id;
    const summary = computeCommerceSellerActivitySummary(orders, hasReceipt);

    expect(summary.newSubmitted).toBe(1);
    expect(summary.paidReadyToFulfill).toBe(2);
    expect(summary.fulfillingInProgress).toBe(1);
    expect(summary.completedAwaitingReceipt).toBe(2);
  });
});
