import { describe, it, expect } from "vitest";
import { LocalOrderRepository } from "../src/os/commerce/order/local_order_repository.js";
import { applyOrderAction } from "../src/os/commerce/order/order_state_machine.js";
import { CustomerOrderController, MerchantOrderController } from "../src/os/commerce/order/ui/order_ui_controller.js";
import {
  buildCreateOrderDraft,
  buildOrderReviewViewModel,
  describeOrderStatus,
} from "../src/os/commerce/order/ui/order_view_models.js";
import type { Product } from "../src/os/commerce/catalog/types.js";
import type { OrderRepository } from "../src/os/commerce/order/order_repository_port.js";

const CUSTOMER = "1".repeat(64);
const MERCHANT = "f".repeat(64);
let clock = 1_700_000_000;
const now = () => ++clock;

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "product-1",
    kind: "pdf",
    title: "Digital art print",
    creatorPubkey: MERCHANT,
    priceCents: 500,
    currency: "USD",
    status: "active",
    visibility: "public",
    linkedSpaceIds: [],
    linkedEventIds: [],
    assetIds: [],
    ...overrides,
  };
}

function wiredControllers(repository: OrderRepository = new LocalOrderRepository()) {
  return {
    repository,
    customer: new CustomerOrderController({ repository, now }, CUSTOMER),
    merchant: new MerchantOrderController({ repository, now }, MERCHANT),
  };
}

describe("view-model builders", () => {
  it("1. buildCreateOrderDraft rejects a non-active product", () => {
    const result = buildCreateOrderDraft(product({ status: "draft" }), 1);
    expect(result.ok).toBe(false);
  });

  it("2. buildCreateOrderDraft rejects a non-positive/fractional quantity", () => {
    expect(buildCreateOrderDraft(product(), 0).ok).toBe(false);
    expect(buildCreateOrderDraft(product(), -1).ok).toBe(false);
    expect(buildCreateOrderDraft(product(), 1.5).ok).toBe(false);
  });

  it("3. buildCreateOrderDraft builds a draft snapshotting the product's price/currency/seller", () => {
    const result = buildCreateOrderDraft(product(), 2);
    expect(result.ok).toBe(true);
    expect(result.draft).toMatchObject({
      productId: "product-1",
      sellerPubkey: MERCHANT,
      unitPriceCents: 500,
      currency: "USD",
      quantity: 2,
    });
  });

  it("4. buildOrderReviewViewModel computes the total from quantity * unit price", () => {
    const draftResult = buildCreateOrderDraft(product(), 3);
    if (!draftResult.ok || draftResult.draft === undefined) throw new Error("expected ok draft");
    const review = buildOrderReviewViewModel(draftResult.draft);
    expect(review.totalCents).toBe(1500);
    expect(review.quantity).toBe(3);
  });

  it("5. describeOrderStatus returns a distinct, non-empty label for every status", () => {
    const statuses = ["created", "submitted", "accepted", "rejected", "paid", "fulfilling", "delivered", "completed", "cancelled"] as const;
    const labels = statuses.map(describeOrderStatus);
    expect(new Set(labels).size).toBe(statuses.length);
    for (const label of labels) expect(label.length).toBeGreaterThan(0);
  });
});

describe("CustomerOrderController", () => {
  it("6. drives Create Order -> Submit and persists through the repository", () => {
    const { customer, repository } = wiredControllers();
    const draftResult = customer.buildDraft(product(), 1);
    if (!draftResult.ok || draftResult.draft === undefined) throw new Error("expected ok draft");

    const created = customer.createOrder("order-1", draftResult.draft);
    expect(created.ok).toBe(true);
    expect(repository.findById("order-1")?.status).toBe("created");

    const submitted = customer.submitOrder("order-1");
    expect(submitted.ok).toBe(true);
    expect(repository.findById("order-1")?.status).toBe("submitted");
  });

  it("7. cancelOrder respects the state machine's own policy (rejects once accepted)", () => {
    const { customer, merchant } = wiredControllers();
    const draftResult = customer.buildDraft(product(), 1);
    if (!draftResult.ok || draftResult.draft === undefined) throw new Error("expected ok draft");
    customer.createOrder("order-1", draftResult.draft);
    customer.submitOrder("order-1");
    merchant.acceptOrder("order-1");

    const cancelResult = customer.cancelOrder("order-1");
    expect(cancelResult.ok).toBe(false);
  });

  it("8. getOrderStatusViewModel reflects the persisted order and current available actions", () => {
    const { customer } = wiredControllers();
    const draftResult = customer.buildDraft(product(), 1);
    if (!draftResult.ok || draftResult.draft === undefined) throw new Error("expected ok draft");
    customer.createOrder("order-1", draftResult.draft);

    const viewModel = customer.getOrderStatusViewModel("order-1");
    expect(viewModel?.status).toBe("created");
    expect(viewModel?.availableActions).toEqual(["submit", "cancel"]);
  });

  it("9. listMyOrders only returns this customer's own orders", () => {
    const repository = new LocalOrderRepository();
    const alice = new CustomerOrderController({ repository, now }, CUSTOMER);
    const bob = new CustomerOrderController({ repository, now }, "2".repeat(64));

    const aliceDraft = alice.buildDraft(product(), 1);
    if (!aliceDraft.ok || aliceDraft.draft === undefined) throw new Error("expected ok draft");
    alice.createOrder("alice-order", aliceDraft.draft);

    const bobDraft = bob.buildDraft(product(), 1);
    if (!bobDraft.ok || bobDraft.draft === undefined) throw new Error("expected ok draft");
    bob.createOrder("bob-order", bobDraft.draft);

    expect(alice.listMyOrders().map((o) => o.id)).toEqual(["alice-order"]);
  });

  it("10. acting on an unknown order id is reported as a rejection, never a throw", () => {
    const { customer } = wiredControllers();
    const result = customer.submitOrder("does-not-exist");
    expect(result.ok).toBe(false);
  });

  it('11. CustomerOrderController has NO method that can cause a payment/delivery-equivalent transition', () => {
    const { customer } = wiredControllers();
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(customer));
    for (const forbidden of ["confirmPayment", "confirmDelivery", "markPaid", "markDelivered", "settlePayment"]) {
      expect(methodNames).not.toContain(forbidden);
    }
  });
});

describe("MerchantOrderController", () => {
  function submittedOrder(repository: OrderRepository) {
    const customer = new CustomerOrderController({ repository, now }, CUSTOMER);
    const draftResult = customer.buildDraft(product(), 1);
    if (!draftResult.ok || draftResult.draft === undefined) throw new Error("expected ok draft");
    customer.createOrder("order-1", draftResult.draft);
    customer.submitOrder("order-1");
  }

  it("12. getIncomingOrdersViewModel buckets a submitted order under 'incoming'", () => {
    const { merchant, repository } = wiredControllers();
    submittedOrder(repository);
    const viewModel = merchant.getIncomingOrdersViewModel();
    expect(viewModel.incoming.map((o) => o.orderId)).toEqual(["order-1"]);
    expect(viewModel.inProgress).toEqual([]);
    expect(viewModel.closed).toEqual([]);
  });

  it("13. acceptOrder moves a submitted order to accepted and out of 'incoming'", () => {
    const { merchant, repository } = wiredControllers();
    submittedOrder(repository);
    const result = merchant.acceptOrder("order-1");
    expect(result.ok).toBe(true);
    const viewModel = merchant.getIncomingOrdersViewModel();
    expect(viewModel.incoming).toEqual([]);
    expect(viewModel.inProgress.map((o) => o.orderId)).toEqual(["order-1"]);
  });

  it("14. rejectOrder moves a submitted order to rejected/closed", () => {
    const { merchant, repository } = wiredControllers();
    submittedOrder(repository);
    merchant.rejectOrder("order-1", "out of stock");
    const viewModel = merchant.getIncomingOrdersViewModel();
    expect(viewModel.closed.map((o) => o.orderId)).toEqual(["order-1"]);
  });

  it("15. getOrderDetailViewModel's fulfillmentStubNote is set ONLY while fulfilling, and there is still no delivered button", () => {
    const { merchant, repository } = wiredControllers();
    submittedOrder(repository);
    merchant.acceptOrder("order-1");
    expect(merchant.getOrderDetailViewModel("order-1")?.fulfillmentStubNote).toBeUndefined();

    // Bind payment via real evidence (the only legitimate path), not via any controller method.
    const accepted = repository.findById("order-1");
    if (accepted === undefined) throw new Error("expected order");
    const paidResult = applyOrderAction(
      accepted,
      {
        type: "confirm_payment",
        actor: { kind: "payment_evidence" },
        evidence: { orderId: "order-1", paymentId: "pay-1", status: "settled", observedAt: now(), reason: "test settlement" },
      },
      now(),
    );
    if (!paidResult.ok) throw new Error("expected paid");
    repository.save(paidResult.order);

    merchant.fulfillOrder("order-1");
    const detail = merchant.getOrderDetailViewModel("order-1");
    expect(detail?.status).toBe("fulfilling");
    expect(detail?.fulfillmentStubNote).toMatch(/no manual/i);
    expect(detail?.availableActions).not.toContain("confirm_delivery" as never); // merchant is never offered this action
  });

  it('16. MerchantOrderController has NO method that can cause a payment/delivery-equivalent transition', () => {
    const { merchant } = wiredControllers();
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(merchant));
    for (const forbidden of ["confirmPayment", "confirmDelivery", "markPaid", "markDelivered", "settlePayment"]) {
      expect(methodNames).not.toContain(forbidden);
    }
  });
});
