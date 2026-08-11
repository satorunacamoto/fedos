import { describe, it, expect } from "vitest";
import {
  applySettlementEvidence,
  createPendingSettlement,
  PaymentSettlementLedger,
} from "../src/os/commerce/payment/state_machine.js";
import { DeterministicLocalPaymentProvider } from "../src/os/commerce/payment/local_simulator.js";
import type { PaymentEvidence } from "../src/os/commerce/payment/types.js";

/**
 * Commerce E2E Completion arc, Agent P -- Payment state machine tests
 * (brief items 3/5/§17). Uses `DeterministicLocalPaymentProvider`
 * (item 4) as the authoritative-evidence source throughout, since it is
 * the one provider in this module explicitly designed to produce
 * `test_simulator` evidence the state machine is allowed to act on.
 */

function authoritativeEvidence(overrides: Partial<PaymentEvidence> = {}): PaymentEvidence {
  return {
    paymentId: "payment-1",
    productId: "prod-1",
    observedAt: Math.floor(Date.now() / 1000),
    status: "settled",
    reason: "test evidence",
    verification: { source: "test_simulator", authoritative: true, simulator: "DeterministicLocalPaymentProvider" },
    ...overrides,
  };
}

describe("pending -> paid -> refunded happy path", () => {
  it("transitions pending -> paid on authoritative settled evidence, then paid -> refunded", () => {
    let state = createPendingSettlement("payment-1", "order-1", "prod-1");
    expect(state.status).toBe("pending");

    const paidResult = applySettlementEvidence(state, authoritativeEvidence({ status: "settled" }), "order-1");
    expect(paidResult.outcome).toBe("transitioned");
    expect(paidResult.state.status).toBe("paid");
    expect(paidResult.state.history).toHaveLength(1);
    state = paidResult.state;

    const refundResult = applySettlementEvidence(state, authoritativeEvidence({ status: "refunded" }), "order-1");
    expect(refundResult.outcome).toBe("transitioned");
    expect(refundResult.state.status).toBe("refunded");
    expect(refundResult.state.history).toHaveLength(2);
  });

  it("paid -> disputed -> refunded is a legal path", () => {
    let state = createPendingSettlement("payment-1", "order-1", "prod-1");
    state = applySettlementEvidence(state, authoritativeEvidence({ status: "settled" }), "order-1").state;
    const disputedResult = applySettlementEvidence(state, authoritativeEvidence({ status: "disputed" }), "order-1");
    expect(disputedResult.outcome).toBe("transitioned");
    expect(disputedResult.state.status).toBe("disputed");

    const refundResult = applySettlementEvidence(disputedResult.state, authoritativeEvidence({ status: "refunded" }), "order-1");
    expect(refundResult.outcome).toBe("transitioned");
    expect(refundResult.state.status).toBe("refunded");
  });
});

describe("Failure case: duplicate callback is idempotent (no-op)", () => {
  it("applying the same settled evidence twice does not double-transition or duplicate history", () => {
    const initial = createPendingSettlement("payment-1", "order-1", "prod-1");
    const first = applySettlementEvidence(initial, authoritativeEvidence({ status: "settled" }), "order-1");
    expect(first.outcome).toBe("transitioned");
    expect(first.state.status).toBe("paid");

    const second = applySettlementEvidence(first.state, authoritativeEvidence({ status: "settled" }), "order-1");
    expect(second.outcome).toBe("no_op");
    expect(second.state.status).toBe("paid");
    expect(second.state.history).toHaveLength(1); // unchanged -- no duplicate entry
  });

  it("via the ledger convenience wrapper: a duplicate provider callback for the same payment is a no-op", async () => {
    const provider = new DeterministicLocalPaymentProvider({ acknowledgeTestOnly: true });
    const decision = await provider.requestPayment({
      productId: "prod-1",
      orderId: "order-9",
      amountCents: 500,
      currency: "USD",
      rail: "manual_placeholder",
    });
    const ledger = new PaymentSettlementLedger();
    ledger.bind(decision.paymentId!, "order-9", "prod-1");

    const evidence1 = await provider.simulateSettlement(decision.paymentId!, "paid");
    const applied1 = ledger.apply(evidence1, "order-9");
    expect(applied1.outcome).toBe("transitioned");

    // Simulate the SAME callback arriving twice (e.g. an at-least-once webhook redelivery).
    const evidence2 = await provider.simulateSettlement(decision.paymentId!, "paid");
    const applied2 = ledger.apply(evidence2, "order-9");
    expect(applied2.outcome).toBe("no_op");
    expect(ledger.get(decision.paymentId!)?.status).toBe("paid");
  });
});

describe("Failure case: wrong-order payment evidence is rejected", () => {
  it("evidence for a payment bound to a DIFFERENT order than the caller expects is rejected", () => {
    const state = createPendingSettlement("payment-1", "order-real", "prod-1");
    const result = applySettlementEvidence(state, authoritativeEvidence({ status: "settled" }), "order-attacker-supplied");
    expect(result.outcome).toBe("rejected");
    expect(result.state.status).toBe("pending");
    expect(result.reason).toMatch(/wrong-order/);
  });

  it("via the ledger: evidence for an unbound/unknown paymentId is rejected outright, never silently applied", async () => {
    const provider = new DeterministicLocalPaymentProvider({ acknowledgeTestOnly: true });
    const decision = await provider.requestPayment({
      productId: "prod-1",
      amountCents: 500,
      currency: "USD",
      rail: "manual_placeholder",
    });
    const evidence = await provider.simulateSettlement(decision.paymentId!, "paid");

    const ledger = new PaymentSettlementLedger(); // note: never bind()-ed
    const result = ledger.apply(evidence, "order-1");
    expect(result.outcome).toBe("rejected");
    expect(result.reason).toMatch(/unknown\/unbound/);
  });
});

describe("Failure case: replayed callback (stale evidence after resolution) is rejected", () => {
  it("a settled event replayed AFTER the payment already resolved to refunded does not revert it to paid", () => {
    let state = createPendingSettlement("payment-1", "order-1", "prod-1");
    state = applySettlementEvidence(state, authoritativeEvidence({ status: "settled" }), "order-1").state;
    state = applySettlementEvidence(state, authoritativeEvidence({ status: "refunded" }), "order-1").state;
    expect(state.status).toBe("refunded");

    // An old, stale "settled" webhook delivery arrives late and gets replayed.
    const replay = applySettlementEvidence(state, authoritativeEvidence({ status: "settled" }), "order-1");
    expect(replay.outcome).toBe("rejected");
    expect(replay.state.status).toBe("refunded"); // still refunded, NEVER reverted to paid
    expect(replay.reason).toMatch(/illegal transition/);
  });

  it("a settled event replayed after the payment already expired does not resurrect it as paid", () => {
    let state = createPendingSettlement("payment-1", "order-1", "prod-1");
    state = applySettlementEvidence(state, authoritativeEvidence({ status: "expired" }), "order-1").state;
    expect(state.status).toBe("expired");

    const replay = applySettlementEvidence(state, authoritativeEvidence({ status: "settled" }), "order-1");
    expect(replay.outcome).toBe("rejected");
    expect(replay.state.status).toBe("expired");
  });
});

describe("Failure case: payment after expiry", () => {
  it("request-time expiry (already-elapsed expiresAt) is rejected before a payment is even minted (existing PlaceholderPaymentProvider/DeterministicLocalPaymentProvider behavior)", async () => {
    const provider = new DeterministicLocalPaymentProvider({ acknowledgeTestOnly: true });
    const decision = await provider.requestPayment({
      productId: "prod-1",
      amountCents: 500,
      currency: "USD",
      rail: "manual_placeholder",
      expiresAt: Math.floor(Date.now() / 1000) - 3600,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("expired");
  });

  it("settlement-time expiry: a payment that already reached 'expired' cannot be paid by later evidence", () => {
    let state = createPendingSettlement("payment-1", "order-1", "prod-1");
    state = applySettlementEvidence(state, authoritativeEvidence({ status: "expired" }), "order-1").state;
    expect(state.status).toBe("expired");

    const lateSettle = applySettlementEvidence(state, authoritativeEvidence({ status: "settled" }), "order-1");
    expect(lateSettle.outcome).toBe("rejected");
    expect(lateSettle.state.status).toBe("expired");
  });
});

describe("evidence.paymentId mismatch is rejected (defense in depth alongside wrong-order)", () => {
  it("evidence naming a different paymentId than the state record is rejected", () => {
    const state = createPendingSettlement("payment-1", "order-1", "prod-1");
    const result = applySettlementEvidence(state, authoritativeEvidence({ paymentId: "payment-OTHER" }), "order-1");
    expect(result.outcome).toBe("rejected");
    expect(result.reason).toMatch(/does not match/);
  });
});

describe("non-authoritative evidence never transitions the state machine, regardless of status value", () => {
  it.each(["provider_unverified", "customer_claim", "merchant_claim"] as const)("source=%s is rejected", (source) => {
    const state = createPendingSettlement("payment-1", "order-1", "prod-1");
    const evidence: PaymentEvidence = {
      paymentId: "payment-1",
      productId: "prod-1",
      observedAt: Math.floor(Date.now() / 1000),
      status: "settled",
      reason: "untrusted",
      verification:
        source === "provider_unverified"
          ? { source, authoritative: false, provider: "someone" }
          : { source, authoritative: false, claimedBy: "someone" },
    };
    const result = applySettlementEvidence(state, evidence, "order-1");
    expect(result.outcome).toBe("rejected");
    expect(result.state.status).toBe("pending");
  });

  it("missing verification entirely is treated identically to non-authoritative (fail closed)", () => {
    const state = createPendingSettlement("payment-1", "order-1", "prod-1");
    const evidence: PaymentEvidence = {
      paymentId: "payment-1",
      productId: "prod-1",
      observedAt: Math.floor(Date.now() / 1000),
      status: "settled",
      reason: "no provenance attached at all",
    };
    const result = applySettlementEvidence(state, evidence, "order-1");
    expect(result.outcome).toBe("rejected");
  });
});
