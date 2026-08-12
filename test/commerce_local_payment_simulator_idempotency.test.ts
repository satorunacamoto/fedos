import { describe, it, expect } from "vitest";
import { DeterministicLocalPaymentProvider } from "../src/os/commerce/payment/local_simulator.js";
import type { PaymentRequest } from "../src/os/commerce/payment/types.js";

/**
 * Commerce Real Two-Party UX Closure (Agent U) — regression test for
 * Commerce Friction Ledger row 6's second, non-naming half: a double-click
 * on the buyer-facing "Pay Now" (formerly "Request Payment") button used to
 * mint a SECOND, orphaned `paymentId` in the durable settlement ledger,
 * because `DeterministicLocalPaymentProvider.requestPayment()` never read
 * `PaymentRequest.idempotencyKey` at all — even though the type contract
 * (`../src/os/commerce/payment/types.ts`) already required every provider
 * to honor it, and the sibling `PlaceholderPaymentProvider`
 * (`../src/os/commerce/payment/noop_payment.ts`, proven by
 * `architecture_payment_provider_btcpay_readiness.test.ts`'s own test 4)
 * already implemented it correctly. This file proves the SAME contract now
 * holds for the provider actually wired into the Beta Electron app
 * (`fedos_electron_beta_main.cts`'s `state.payments`).
 */

function request(overrides: Partial<PaymentRequest> = {}): PaymentRequest {
  return {
    productId: "prod-1",
    orderId: "order-1",
    buyerPubkey: "b".repeat(64),
    amountCents: 500,
    currency: "USD",
    rail: "manual_placeholder",
    ...overrides,
  };
}

describe("DeterministicLocalPaymentProvider -- idempotencyKey (Commerce Friction Ledger row 6)", () => {
  it("two requestPayment() calls with the same idempotencyKey return the SAME paymentId, never a second payment", async () => {
    const provider = new DeterministicLocalPaymentProvider({ acknowledgeTestOnly: true });
    const first = await provider.requestPayment(request({ idempotencyKey: "order-1" }));
    const second = await provider.requestPayment(request({ idempotencyKey: "order-1" }));
    expect(first.allowed).toBe(true);
    expect(first.paymentId).toBeDefined();
    expect(second.paymentId).toBe(first.paymentId);
    expect(second.reason).toMatch(/idempotent replay/);
  });

  it("a DIFFERENT idempotencyKey (a different order) mints a genuinely new payment", async () => {
    const provider = new DeterministicLocalPaymentProvider({ acknowledgeTestOnly: true });
    const first = await provider.requestPayment(request({ idempotencyKey: "order-1" }));
    const second = await provider.requestPayment(request({ idempotencyKey: "order-2", orderId: "order-2" }));
    expect(second.paymentId).not.toBe(first.paymentId);
  });

  it("omitting idempotencyKey entirely preserves the provider's original (pre-fix) behavior -- a fresh payment every call", async () => {
    const provider = new DeterministicLocalPaymentProvider({ acknowledgeTestOnly: true });
    const first = await provider.requestPayment(request());
    const second = await provider.requestPayment(request());
    expect(second.paymentId).not.toBe(first.paymentId);
  });

  it("an idempotent replay can still be settled through the SAME paymentId (simulateSettlement observes the original ledger entry, not a duplicate)", async () => {
    const provider = new DeterministicLocalPaymentProvider({ acknowledgeTestOnly: true });
    const first = await provider.requestPayment(request({ idempotencyKey: "order-1" }));
    await provider.requestPayment(request({ idempotencyKey: "order-1" })); // simulated double-click
    const evidence = await provider.simulateSettlement(first.paymentId!, "paid");
    expect(evidence.status).toBe("settled");
    expect(evidence.paymentId).toBe(first.paymentId);
  });
});
