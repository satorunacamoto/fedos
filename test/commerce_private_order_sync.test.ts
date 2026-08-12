import { describe, expect, it } from "vitest";
import {
  isWellFormedPrivateOrderSyncPayload,
  PRIVATE_ORDER_SYNC_ALLOWED_KEYS,
  PRIVATE_ORDER_SYNC_STATUS_ACTION,
  type PrivateOrderSyncPayload,
} from "../src/os/commerce/events/commerce_private_order_sync.js";

const BUYER = "a".repeat(64);
const SELLER = "b".repeat(64);

function validPayload(overrides: Partial<PrivateOrderSyncPayload> = {}): PrivateOrderSyncPayload {
  return {
    category: "private-order-sync",
    formatVersion: 1,
    orderId: "order-1",
    productId: "prod-1",
    buyerPubkey: BUYER,
    sellerPubkey: SELLER,
    quantity: 2,
    unitPriceCents: 1999,
    currency: "USD",
    status: "submitted",
    at: 1_700_000_000,
    ...overrides,
  };
}

describe("commerce_private_order_sync: isWellFormedPrivateOrderSyncPayload", () => {
  it("accepts a well-formed payload for every allowed status", () => {
    for (const status of ["submitted", "accepted", "rejected", "fulfilling", "completed", "cancelled"] as const) {
      expect(isWellFormedPrivateOrderSyncPayload(validPayload({ status }))).toBe(true);
    }
  });

  it("rejects 'created' -- a draft order must never be transmitted, private or public", () => {
    expect(isWellFormedPrivateOrderSyncPayload({ ...validPayload(), status: "created" })).toBe(false);
  });

  it("rejects 'paid' -- only a locally-verified payment_evidence actor may ever cause this transition", () => {
    expect(isWellFormedPrivateOrderSyncPayload({ ...validPayload(), status: "paid" })).toBe(false);
  });

  it("rejects 'delivered' -- only a locally-verified delivery_evidence actor may ever cause this transition", () => {
    expect(isWellFormedPrivateOrderSyncPayload({ ...validPayload(), status: "delivered" })).toBe(false);
  });

  it("rejects an unknown/extra field (allowlist enforcement, same discipline as the public drafts)", () => {
    expect(isWellFormedPrivateOrderSyncPayload({ ...validPayload(), paymentMethod: "card" })).toBe(false);
    expect(isWellFormedPrivateOrderSyncPayload({ ...validPayload(), buyerRealName: "Alice" })).toBe(false);
  });

  it("rejects self-dealing (buyerPubkey === sellerPubkey)", () => {
    expect(isWellFormedPrivateOrderSyncPayload({ ...validPayload(), sellerPubkey: BUYER })).toBe(false);
  });

  it("rejects a non-hex64 buyer/seller pubkey", () => {
    expect(isWellFormedPrivateOrderSyncPayload({ ...validPayload(), buyerPubkey: "not-hex" })).toBe(false);
    expect(isWellFormedPrivateOrderSyncPayload({ ...validPayload(), sellerPubkey: "not-hex" })).toBe(false);
  });

  it("rejects a non-positive quantity", () => {
    expect(isWellFormedPrivateOrderSyncPayload({ ...validPayload(), quantity: 0 })).toBe(false);
    expect(isWellFormedPrivateOrderSyncPayload({ ...validPayload(), quantity: -1 })).toBe(false);
  });

  it("rejects a negative unitPriceCents", () => {
    expect(isWellFormedPrivateOrderSyncPayload({ ...validPayload(), unitPriceCents: -1 })).toBe(false);
  });

  it("accepts an optional reason string (reject/cancel)", () => {
    expect(isWellFormedPrivateOrderSyncPayload(validPayload({ status: "rejected", reason: "out of stock" }))).toBe(true);
  });

  it("rejects a non-string reason", () => {
    expect(isWellFormedPrivateOrderSyncPayload({ ...validPayload(), reason: 42 })).toBe(false);
  });

  it("rejects non-object/null/garbage input without throwing", () => {
    for (const garbage of [null, undefined, 42, "string", [], {}]) {
      expect(() => isWellFormedPrivateOrderSyncPayload(garbage)).not.toThrow();
      expect(isWellFormedPrivateOrderSyncPayload(garbage)).toBe(false);
    }
  });
});

describe("commerce_private_order_sync: field classification -- exact allowlist, zero unknown fields", () => {
  it("a full payload's own key set is EXACTLY PRIVATE_ORDER_SYNC_ALLOWED_KEYS minus the optional 'reason'", () => {
    const payload = validPayload();
    expect(Object.keys(payload).sort()).toEqual([...PRIVATE_ORDER_SYNC_ALLOWED_KEYS].filter((k) => k !== "reason").sort());
  });

  it("never carries a raw payment/delivery evidence field, a free-text comment, or exact payment rail metadata", () => {
    const forbidden = ["paymentId", "deliveryId", "invoiceId", "transactionId", "paymentMethod", "comment", "note", "deliveryAddress"];
    for (const field of forbidden) {
      expect(PRIVATE_ORDER_SYNC_ALLOWED_KEYS.has(field)).toBe(false);
    }
  });
});

describe("commerce_private_order_sync: PRIVATE_ORDER_SYNC_STATUS_ACTION mapping", () => {
  it("maps every allowed status to a real order_state_machine.ts OrderActionType", () => {
    expect(PRIVATE_ORDER_SYNC_STATUS_ACTION.submitted).toEqual({ action: "submit", actorKind: "customer" });
    expect(PRIVATE_ORDER_SYNC_STATUS_ACTION.cancelled).toEqual({ action: "cancel", actorKind: "customer" });
    expect(PRIVATE_ORDER_SYNC_STATUS_ACTION.accepted).toEqual({ action: "accept", actorKind: "merchant" });
    expect(PRIVATE_ORDER_SYNC_STATUS_ACTION.rejected).toEqual({ action: "reject", actorKind: "merchant" });
    expect(PRIVATE_ORDER_SYNC_STATUS_ACTION.fulfilling).toEqual({ action: "fulfill", actorKind: "merchant" });
    expect(PRIVATE_ORDER_SYNC_STATUS_ACTION.completed).toEqual({ action: "complete", actorKind: "either" });
  });

  it("never maps to confirm_payment/confirm_delivery -- those actions are structurally unreachable through this table", () => {
    const actions = Object.values(PRIVATE_ORDER_SYNC_STATUS_ACTION).map((v) => v.action);
    expect(actions).not.toContain("confirm_payment");
    expect(actions).not.toContain("confirm_delivery");
  });
});
