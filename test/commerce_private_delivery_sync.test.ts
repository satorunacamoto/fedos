import { describe, expect, it } from "vitest";
import {
  isWellFormedPrivateDeliverySyncPayload,
  PRIVATE_DELIVERY_SYNC_ALLOWED_KEYS,
  type PrivateDeliverySyncPayload,
} from "../src/os/commerce/events/commerce_private_delivery_sync.js";

const BUYER = "a".repeat(64);
const SELLER = "b".repeat(64);

function validPayload(overrides: Partial<PrivateDeliverySyncPayload> = {}): PrivateDeliverySyncPayload {
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

describe("commerce_private_delivery_sync: isWellFormedPrivateDeliverySyncPayload", () => {
  it("accepts a well-formed payload for every allowed action", () => {
    for (const action of ["fulfilling", "recipient_acknowledged", "completed"] as const) {
      expect(isWellFormedPrivateDeliverySyncPayload(validPayload({ action }))).toBe(true);
    }
  });

  it("rejects an unknown action string", () => {
    expect(isWellFormedPrivateDeliverySyncPayload({ ...validPayload(), action: "delivered" })).toBe(false);
    expect(isWellFormedPrivateDeliverySyncPayload({ ...validPayload(), action: "pending" })).toBe(false);
  });

  it("rejects an unknown/extra field (allowlist enforcement)", () => {
    expect(isWellFormedPrivateDeliverySyncPayload({ ...validPayload(), verification: { source: "recipient_acknowledgment", authoritative: true } })).toBe(false);
    expect(isWellFormedPrivateDeliverySyncPayload({ ...validPayload(), authoritative: true })).toBe(false);
  });

  it("rejects self-dealing (buyerPubkey === sellerPubkey)", () => {
    expect(isWellFormedPrivateDeliverySyncPayload({ ...validPayload(), sellerPubkey: BUYER })).toBe(false);
  });

  it("rejects a non-hex64 buyer/seller pubkey", () => {
    expect(isWellFormedPrivateDeliverySyncPayload({ ...validPayload(), buyerPubkey: "not-hex" })).toBe(false);
    expect(isWellFormedPrivateDeliverySyncPayload({ ...validPayload(), sellerPubkey: "not-hex" })).toBe(false);
  });

  it("rejects an empty deliveryId/orderId", () => {
    expect(isWellFormedPrivateDeliverySyncPayload({ ...validPayload(), deliveryId: "" })).toBe(false);
    expect(isWellFormedPrivateDeliverySyncPayload({ ...validPayload(), orderId: "" })).toBe(false);
  });

  it("accepts an optional reason string", () => {
    expect(isWellFormedPrivateDeliverySyncPayload(validPayload({ reason: "left at front door" }))).toBe(true);
  });

  it("rejects a non-string reason", () => {
    expect(isWellFormedPrivateDeliverySyncPayload({ ...validPayload(), reason: 42 })).toBe(false);
  });

  it("rejects a negative/non-integer 'at'", () => {
    expect(isWellFormedPrivateDeliverySyncPayload({ ...validPayload(), at: -1 })).toBe(false);
    expect(isWellFormedPrivateDeliverySyncPayload({ ...validPayload(), at: 1.5 })).toBe(false);
  });

  it("rejects non-object/null/garbage input without throwing", () => {
    for (const garbage of [null, undefined, 42, "string", [], {}]) {
      expect(() => isWellFormedPrivateDeliverySyncPayload(garbage)).not.toThrow();
      expect(isWellFormedPrivateDeliverySyncPayload(garbage)).toBe(false);
    }
  });
});

describe("commerce_private_delivery_sync: field classification -- exact allowlist, zero unknown fields", () => {
  it("a full payload's own key set is EXACTLY PRIVATE_DELIVERY_SYNC_ALLOWED_KEYS minus the optional 'reason'", () => {
    const payload = validPayload();
    expect(Object.keys(payload).sort()).toEqual([...PRIVATE_DELIVERY_SYNC_ALLOWED_KEYS].filter((k) => k !== "reason").sort());
  });

  it("never carries a verification/authoritative/acknowledgedBy field -- the receiver must always reconstruct evidence itself, never trust the wire", () => {
    const forbidden = ["verification", "authoritative", "acknowledgedBy", "status", "evidenceSource"];
    for (const field of forbidden) {
      expect(PRIVATE_DELIVERY_SYNC_ALLOWED_KEYS.has(field)).toBe(false);
    }
  });
});
