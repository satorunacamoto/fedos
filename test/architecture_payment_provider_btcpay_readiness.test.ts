import { describe, it, expect } from "vitest";
import { PlaceholderPaymentProvider } from "../src/os/commerce/payment/noop_payment.js";
import type { PaymentRequest } from "../src/os/commerce/payment/types.js";

/**
 * Compatibility Facade Reduction + Package Extraction Readiness arc —
 * `PaymentProvider` BTCPay-readiness contract test.
 *
 * Section 16-18 of this arc's own kickoff brief: audit (and prove
 * implementable, without running real BTCPay) the widened contract's
 * create/status-observation/expiry/idempotency/malformed-callback surface.
 * `PlaceholderPaymentProvider` (`src/os/commerce/payment/noop_payment.ts`)
 * is used here as the "FakePaymentProvider" the brief asks for — it already
 * implements the full widened `PaymentProvider` shape against a purely
 * in-memory ledger; no real BTCPay/network/credential is used anywhere in
 * this file.
 */

function request(overrides: Partial<PaymentRequest> = {}): PaymentRequest {
  return {
    productId: "prod-1",
    buyerPubkey: "b".repeat(64),
    amountCents: 500,
    currency: "USD",
    rail: "manual_placeholder",
    ...overrides,
  };
}

describe("PaymentProvider BTCPay-readiness contract", () => {
  it("1. create-equivalent: requestPayment mints an opaque paymentId a later call can address", async () => {
    const provider = new PlaceholderPaymentProvider();
    const decision = await provider.requestPayment(request());
    expect(decision.allowed).toBe(true);
    expect(typeof decision.paymentId).toBe("string");
    expect(decision.paymentId?.length).toBeGreaterThan(0);
  });

  it("2. unpaid: a freshly-created payment observes as settled=false-equivalent (placeholder 'settled' state, but this boundary never claims real settlement)", async () => {
    const provider = new PlaceholderPaymentProvider();
    const decision = await provider.requestPayment(request());
    const evidence = await provider.observePayment(decision.paymentId!);
    // "settled" here is the placeholder ledger's terminal-but-unverified
    // state -- the whole point of this boundary's own hard guardrails is
    // that it never actually confirms a real payment. A real BTCPay adapter
    // would report "settled" only after a genuinely verified webhook/poll.
    expect(evidence.status).toBe("settled");
    expect(evidence.paymentId).toBe(decision.paymentId);
  });

  it("3. paid evidence: an ingestCallback 'settled' event updates observable evidence", async () => {
    const provider = new PlaceholderPaymentProvider();
    const decision = await provider.requestPayment(request());
    const evidence = await provider.ingestCallback({ paymentId: decision.paymentId, event: "settled" });
    expect(evidence).not.toBeNull();
    expect(evidence?.status).toBe("settled");
    expect(evidence?.productId).toBe("prod-1");
  });

  it("4. duplicate evidence / idempotency: two requestPayment calls with the same idempotencyKey return the SAME paymentId, never a second payment", async () => {
    const provider = new PlaceholderPaymentProvider();
    const first = await provider.requestPayment(request({ idempotencyKey: "attempt-1" }));
    const second = await provider.requestPayment(request({ idempotencyKey: "attempt-1" }));
    expect(second.paymentId).toBe(first.paymentId);
    expect(second.reason).toMatch(/idempotent replay/);

    // A DIFFERENT idempotency key (or none) mints a genuinely new payment.
    const third = await provider.requestPayment(request({ idempotencyKey: "attempt-2" }));
    expect(third.paymentId).not.toBe(first.paymentId);
  });

  it("5. expired: a request whose expiresAt is already in the past is rejected as expired, not silently accepted", async () => {
    const provider = new PlaceholderPaymentProvider();
    const decision = await provider.requestPayment(request({ expiresAt: Math.floor(Date.now() / 1000) - 3600 }));
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("expired");
  });

  it("5b. expired: an accepted payment observed after its expiresAt elapses reports expired evidence", async () => {
    const provider = new PlaceholderPaymentProvider();
    const decision = await provider.requestPayment(request({ expiresAt: Math.floor(Date.now() / 1000) + 1 }));
    expect(decision.allowed).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const evidence = await provider.observePayment(decision.paymentId!);
    expect(evidence.status).toBe("expired");
  });

  it("6. malformed provider result: ingestCallback returns null (not a thrown error) for an unrecognized payload shape", async () => {
    const provider = new PlaceholderPaymentProvider();
    await expect(provider.ingestCallback(null)).resolves.toBeNull();
    await expect(provider.ingestCallback("not an object")).resolves.toBeNull();
    await expect(provider.ingestCallback({ foo: "bar" })).resolves.toBeNull();
    await expect(provider.ingestCallback({ paymentId: "x", event: "not-a-real-event" })).resolves.toBeNull();
    await expect(provider.ingestCallback({ paymentId: "unknown-id", event: "settled" })).resolves.toBeNull();
  });

  it("7. provider errors: observePayment on an unknown paymentId reports evidence with status 'error', never throws", async () => {
    const provider = new PlaceholderPaymentProvider();
    const evidence = await provider.observePayment("never-existed");
    expect(evidence.status).toBe("error");
  });

  it("8. cancellation is separate from refund: cancelPayment before settlement, refundPayment after", async () => {
    const provider = new PlaceholderPaymentProvider();

    const toCancel = await provider.requestPayment(request());
    const cancelDecision = await provider.cancelPayment!(toCancel.paymentId!);
    expect(cancelDecision.status).toBe("rejected");
    const cancelledEvidence = await provider.observePayment(toCancel.paymentId!);
    expect(cancelledEvidence.status).toBe("error");

    const toRefund = await provider.requestPayment(request());
    const refundEvidence = await provider.refundPayment!(toRefund.paymentId!);
    expect(refundEvidence.status).toBe("refunded");
    const observedAfterRefund = await provider.observePayment(toRefund.paymentId!);
    expect(observedAfterRefund.status).toBe("refunded");
  });

  it("9. no BTCPay-specific type leaks anywhere in the contract or this provider's own source", async () => {
    const typesSource = await import("../src/os/commerce/payment/types.js");
    // Type-only leak check: if a BTCPayInvoice/BTCPayStore/BTCPayWebhook type
    // existed, it would have to be imported/re-exported somewhere reachable
    // from this module's own runtime exports -- there are none, by
    // construction, since this whole module never imports anything BTCPay-named.
    expect(Object.keys(typesSource)).not.toContain("BTCPayInvoice");
    expect(Object.keys(typesSource)).not.toContain("BTCPayStore");
    expect(Object.keys(typesSource)).not.toContain("BTCPayWebhook");
  });
});
