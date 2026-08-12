import { describe, expect, it } from "vitest";
import {
  isWellFormedPaymentEvidenceSyncVerification,
  isWellFormedPrivatePaymentEvidenceSyncPayload,
  PAYMENT_EVIDENCE_SYNC_MAX_REASON_CHARS,
  PRIVATE_PAYMENT_EVIDENCE_SYNC_ALLOWED_KEYS,
  type PrivatePaymentEvidenceSyncPayload,
} from "../src/os/commerce/events/commerce_private_payment_evidence_sync.js";

/** Commerce Purchase/Payment Completion mega-arc (Agent P) — wire-shape well-formedness coverage. */

function validPayload(overrides: Partial<PrivatePaymentEvidenceSyncPayload> = {}): PrivatePaymentEvidenceSyncPayload {
  return {
    category: "private-payment-evidence-sync",
    formatVersion: 1,
    paymentId: "payment-1",
    orderId: "order-1",
    productId: "prod-1",
    amountCents: 4200,
    currency: "USD",
    status: "settled",
    verification: { source: "provider_verified", provider: "btcpay", verifiedAt: 1_700_000_000 },
    observedAt: 1_700_000_000,
    reason: "settled via btcpay webhook",
    at: 1_700_000_100,
    ...overrides,
  };
}

describe("commerce_private_payment_evidence_sync: isWellFormedPrivatePaymentEvidenceSyncPayload", () => {
  it("accepts a well-formed provider_verified payload for every status", () => {
    for (const status of ["settled", "expired", "refunded", "error", "disputed"] as const) {
      expect(isWellFormedPrivatePaymentEvidenceSyncPayload(validPayload({ status }))).toBe(true);
    }
  });

  it("accepts a well-formed test_simulator payload", () => {
    expect(
      isWellFormedPrivatePaymentEvidenceSyncPayload(
        validPayload({ verification: { source: "test_simulator", simulator: "DeterministicLocalPaymentProvider" } }),
      ),
    ).toBe(true);
  });

  it("rejects a verification claiming a non-authoritative source ('customer_claim'/'merchant_claim'/'provider_unverified') -- does not type-check AND is rejected at runtime", () => {
    for (const forgedVerification of [
      { source: "customer_claim", authoritative: false },
      { source: "merchant_claim", authoritative: false },
      { source: "provider_unverified", authoritative: false, provider: "btcpay" },
    ]) {
      expect(isWellFormedPrivatePaymentEvidenceSyncPayload({ ...validPayload(), verification: forgedVerification })).toBe(false);
    }
  });

  it("rejects a provider_verified verification missing 'provider' or 'verifiedAt'", () => {
    expect(isWellFormedPrivatePaymentEvidenceSyncPayload({ ...validPayload(), verification: { source: "provider_verified", verifiedAt: 1 } })).toBe(false);
    expect(isWellFormedPrivatePaymentEvidenceSyncPayload({ ...validPayload(), verification: { source: "provider_verified", provider: "btcpay" } })).toBe(false);
  });

  it("rejects a test_simulator verification missing 'simulator'", () => {
    expect(isWellFormedPrivatePaymentEvidenceSyncPayload({ ...validPayload(), verification: { source: "test_simulator" } })).toBe(false);
  });

  it("rejects a verification object with an extra/unknown key", () => {
    expect(
      isWellFormedPrivatePaymentEvidenceSyncPayload({
        ...validPayload(),
        verification: { source: "provider_verified", provider: "btcpay", verifiedAt: 1, extra: "x" },
      }),
    ).toBe(false);
  });

  it("rejects an unknown/extra top-level field (allowlist enforcement)", () => {
    expect(isWellFormedPrivatePaymentEvidenceSyncPayload({ ...validPayload(), buyerPubkey: "a".repeat(64) })).toBe(false);
    expect(isWellFormedPrivatePaymentEvidenceSyncPayload({ ...validPayload(), providerSecret: "shh" })).toBe(false);
  });

  it("rejects an empty paymentId/orderId/productId/currency", () => {
    expect(isWellFormedPrivatePaymentEvidenceSyncPayload({ ...validPayload(), paymentId: "" })).toBe(false);
    expect(isWellFormedPrivatePaymentEvidenceSyncPayload({ ...validPayload(), orderId: "" })).toBe(false);
    expect(isWellFormedPrivatePaymentEvidenceSyncPayload({ ...validPayload(), productId: "" })).toBe(false);
    expect(isWellFormedPrivatePaymentEvidenceSyncPayload({ ...validPayload(), currency: "" })).toBe(false);
  });

  it("rejects a negative or non-integer amountCents", () => {
    expect(isWellFormedPrivatePaymentEvidenceSyncPayload({ ...validPayload(), amountCents: -1 })).toBe(false);
    expect(isWellFormedPrivatePaymentEvidenceSyncPayload({ ...validPayload(), amountCents: 1.5 })).toBe(false);
  });

  it("rejects an unknown status value", () => {
    expect(isWellFormedPrivatePaymentEvidenceSyncPayload({ ...validPayload(), status: "paid" })).toBe(false);
    expect(isWellFormedPrivatePaymentEvidenceSyncPayload({ ...validPayload(), status: "pending" })).toBe(false);
  });

  it("rejects a negative observedAt/at", () => {
    expect(isWellFormedPrivatePaymentEvidenceSyncPayload({ ...validPayload(), observedAt: -1 })).toBe(false);
    expect(isWellFormedPrivatePaymentEvidenceSyncPayload({ ...validPayload(), at: -1 })).toBe(false);
  });

  it("rejects a non-string reason and a reason exceeding the max length", () => {
    expect(isWellFormedPrivatePaymentEvidenceSyncPayload({ ...validPayload(), reason: 42 })).toBe(false);
    expect(isWellFormedPrivatePaymentEvidenceSyncPayload({ ...validPayload(), reason: "x".repeat(PAYMENT_EVIDENCE_SYNC_MAX_REASON_CHARS + 1) })).toBe(false);
    expect(isWellFormedPrivatePaymentEvidenceSyncPayload({ ...validPayload(), reason: "x".repeat(PAYMENT_EVIDENCE_SYNC_MAX_REASON_CHARS) })).toBe(true);
  });

  it("rejects the wrong category/formatVersion", () => {
    expect(isWellFormedPrivatePaymentEvidenceSyncPayload({ ...validPayload(), category: "private-order-sync" })).toBe(false);
    expect(isWellFormedPrivatePaymentEvidenceSyncPayload({ ...validPayload(), formatVersion: 2 })).toBe(false);
  });

  it("rejects non-object/null/garbage input without throwing", () => {
    for (const garbage of [null, undefined, 42, "string", [], {}]) {
      expect(() => isWellFormedPrivatePaymentEvidenceSyncPayload(garbage)).not.toThrow();
      expect(isWellFormedPrivatePaymentEvidenceSyncPayload(garbage)).toBe(false);
    }
  });

  it("PRIVATE_PAYMENT_EVIDENCE_SYNC_ALLOWED_KEYS matches exactly the fields on a valid payload", () => {
    expect(new Set(Object.keys(validPayload()))).toEqual(PRIVATE_PAYMENT_EVIDENCE_SYNC_ALLOWED_KEYS);
  });
});

describe("commerce_private_payment_evidence_sync: isWellFormedPaymentEvidenceSyncVerification", () => {
  it("never throws on garbage", () => {
    for (const garbage of [null, undefined, 42, "string", [], {}, { source: "unknown" }]) {
      expect(() => isWellFormedPaymentEvidenceSyncVerification(garbage)).not.toThrow();
      expect(isWellFormedPaymentEvidenceSyncVerification(garbage)).toBe(false);
    }
  });
});
