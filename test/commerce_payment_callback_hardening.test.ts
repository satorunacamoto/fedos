import { describe, it, expect } from "vitest";
import { PlaceholderPaymentProvider } from "../src/os/commerce/payment/noop_payment.js";
import { computeHmacSha256Hex } from "../src/os/commerce/payment/callback_verification.js";
import { DeterministicLocalPaymentProvider } from "../src/os/commerce/payment/local_simulator.js";
import { applySettlementEvidence, createPendingSettlement } from "../src/os/commerce/payment/state_machine.js";
import type { PaymentEvidence, PaymentEvidenceProvenance, PaymentRequest } from "../src/os/commerce/payment/types.js";

/**
 * Commerce E2E Completion arc, Agent P — P0 hardening test.
 *
 * `docs/commerce/COMMERCE-GAP-CLASSIFICATION.md` Gap #5:
 * `PlaceholderPaymentProvider.ingestCallback()` used to accept ANY
 * `{paymentId, event}` payload with zero authentication and flip its own
 * ledger accordingly. This file proves the exact attack ("I forge a
 * settlement callback with no signature") is rejected at BOTH layers this
 * arc adds:
 *
 *   1. When the provider is configured with a `callbackSecret` (the
 *      hardened mode a real deployment would use), an unsigned or forged
 *      callback is rejected outright by `ingestCallback()` itself (`null`,
 *      ledger untouched).
 *   2. Even in the provider's DEFAULT (unconfigured) mode -- which must
 *      keep accepting a bare callback exactly as before, because
 *      `test/architecture_payment_provider_btcpay_readiness.test.ts` (a
 *      file this arc is FORBIDDEN from editing) exercises that exact
 *      behavior directly -- the evidence it returns is tagged
 *      `verification.source: "provider_unverified"`, which
 *      `payment/state_machine.ts` structurally can never treat as
 *      authoritative. So even though the low-level dormant method still
 *      "accepts" an unauthenticated payload internally (matching the
 *      locked contract test), it is now UNABLE to cause a real
 *      PAID-equivalent transition anywhere downstream.
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

describe("Gap #5 hardening: PlaceholderPaymentProvider.ingestCallback() -- hardened (signed) mode", () => {
  it("REJECTS an unsigned callback outright when a callbackSecret is configured", async () => {
    const provider = new PlaceholderPaymentProvider({ callbackSecret: "test-secret-do-not-use-in-prod" });
    const decision = await provider.requestPayment(request());
    expect(decision.allowed).toBe(true);
    // PlaceholderPaymentProvider's own pre-existing quirk (unchanged by
    // this hardening, and required by the locked BTCPay-readiness contract
    // test): a freshly-accepted placeholder payment ALREADY observes as
    // "settled" -- so the meaningful attack here is forging a REFUND
    // (something that would actually change observable state) without a
    // valid signature.
    const before = await provider.observePayment(decision.paymentId!);
    expect(before.status).toBe("settled");

    // The exact attack: forge a plain, unsigned refund callback.
    const forged = await provider.ingestCallback({ paymentId: decision.paymentId, event: "refunded" });
    expect(forged).toBeNull();

    // Ledger must be untouched -- observePayment still reports the
    // ORIGINAL state, never the forged "refunded" state.
    const after = await provider.observePayment(decision.paymentId!);
    expect(after.status).toBe("settled");
    expect(after.status).not.toBe("refunded");
  });

  it("REJECTS a callback with a forged/incorrect signature", async () => {
    const provider = new PlaceholderPaymentProvider({ callbackSecret: "real-secret" });
    const decision = await provider.requestPayment(request());

    const forged = await provider.ingestCallback({
      paymentId: decision.paymentId,
      event: "settled",
      signature: "0".repeat(64), // well-formed hex, but not a valid HMAC
    });
    expect(forged).toBeNull();

    const withWrongSecret = await provider.ingestCallback({
      paymentId: decision.paymentId,
      event: "settled",
      signature: await computeHmacSha256Hex("wrong-secret", `${decision.paymentId}:settled`),
    });
    expect(withWrongSecret).toBeNull();
  });

  it("ACCEPTS a correctly-signed callback and tags evidence provider_verified/authoritative", async () => {
    const secret = "correct-secret";
    const provider = new PlaceholderPaymentProvider({ callbackSecret: secret });
    const decision = await provider.requestPayment(request());

    const signature = await computeHmacSha256Hex(secret, `${decision.paymentId}:settled`);
    const evidence = await provider.ingestCallback({ paymentId: decision.paymentId, event: "settled", signature });

    expect(evidence).not.toBeNull();
    expect(evidence?.status).toBe("settled");
    expect(evidence?.verification?.source).toBe("provider_verified");
    expect(evidence?.verification?.authoritative).toBe(true);
  });
});

describe("Gap #5 hardening: PlaceholderPaymentProvider default (unconfigured) mode stays reachable for the LOCKED readiness contract, but is structurally inert downstream", () => {
  it("default construction still accepts a bare unsigned callback (matches the locked BTCPay-readiness test's own behavior)", async () => {
    const provider = new PlaceholderPaymentProvider(); // no secret -- identical construction to the locked test file
    const decision = await provider.requestPayment(request());
    const evidence = await provider.ingestCallback({ paymentId: decision.paymentId, event: "settled" });
    expect(evidence).not.toBeNull();
    expect(evidence?.status).toBe("settled");
  });

  it("but that evidence is tagged provider_unverified/non-authoritative", async () => {
    const provider = new PlaceholderPaymentProvider();
    const decision = await provider.requestPayment(request());
    const evidence = await provider.ingestCallback({ paymentId: decision.paymentId, event: "settled" });
    expect(evidence?.verification?.source).toBe("provider_unverified");
    expect(evidence?.verification?.authoritative).toBe(false);
  });

  it("UNAUTHENTICATED PAYMENT CALLBACK REACHABLE: the state machine REJECTS it -- no real PAID-equivalent transition is ever caused", async () => {
    const provider = new PlaceholderPaymentProvider();
    const decision = await provider.requestPayment(request());
    const forgedEvidence = (await provider.ingestCallback({
      paymentId: decision.paymentId,
      event: "settled",
    })) as PaymentEvidence;
    expect(forgedEvidence).not.toBeNull();

    const settlement = createPendingSettlement(decision.paymentId!, "order-1", "prod-1");
    const result = applySettlementEvidence(settlement, forgedEvidence, "order-1");

    expect(result.outcome).toBe("rejected");
    expect(result.state.status).toBe("pending"); // NEVER "paid"
    expect(result.reason).toMatch(/not authoritative/);
  });
});

describe("Failure case: customer falsely claims paid", () => {
  it("a raw customer_claim evidence object is rejected by the state machine", () => {
    const settlement = createPendingSettlement("payment-x", "order-1", "prod-1");
    const evidence: PaymentEvidence = {
      paymentId: "payment-x",
      productId: "prod-1",
      observedAt: Math.floor(Date.now() / 1000),
      status: "settled",
      reason: "customer says they paid",
      verification: { source: "customer_claim", authoritative: false, claimedBy: "buyer-pubkey" },
    };
    const result = applySettlementEvidence(settlement, evidence, "order-1");
    expect(result.outcome).toBe("rejected");
    expect(result.state.status).toBe("pending");
  });

  it("cannot even be type-constructed as authoritative -- the discriminated union forbids it", () => {
    // @ts-expect-error customer_claim's `authoritative` is fixed to `false` at the type level.
    const illegal: PaymentEvidenceProvenance = { source: "customer_claim", authoritative: true, claimedBy: "buyer" };
    expect(illegal).toBeDefined(); // reached only if the @ts-expect-error above is wrong
  });
});

describe("Failure case: merchant falsely claims paid", () => {
  it("a raw merchant_claim evidence object is rejected by the state machine", () => {
    const settlement = createPendingSettlement("payment-y", "order-1", "prod-1");
    const evidence: PaymentEvidence = {
      paymentId: "payment-y",
      productId: "prod-1",
      observedAt: Math.floor(Date.now() / 1000),
      status: "settled",
      reason: "merchant says buyer paid",
      verification: { source: "merchant_claim", authoritative: false, claimedBy: "merchant-pubkey" },
    };
    const result = applySettlementEvidence(settlement, evidence, "order-1");
    expect(result.outcome).toBe("rejected");
    expect(result.state.status).toBe("pending");
  });
});

describe("DeterministicLocalPaymentProvider -- structural guardrails (item 4 of the brief)", () => {
  it("cannot be constructed without an explicit acknowledgeTestOnly: true (runtime re-check, in addition to the type error)", () => {
    // @ts-expect-error acknowledgeTestOnly is required and must be the literal `true`.
    expect(() => new DeterministicLocalPaymentProvider({})).toThrow(/acknowledgeTestOnly/);
    // @ts-expect-error same -- omitting the options object entirely.
    expect(() => new DeterministicLocalPaymentProvider()).toThrow(/acknowledgeTestOnly/);
  });

  it("throws if told it is running in a production profile", () => {
    expect(
      () => new DeterministicLocalPaymentProvider({ acknowledgeTestOnly: true, runtimeProfile: "production" }),
    ).toThrow(/production/);
  });

  it("constructs fine for test/development profiles or when the profile is unspecified", () => {
    expect(() => new DeterministicLocalPaymentProvider({ acknowledgeTestOnly: true })).not.toThrow();
    expect(() => new DeterministicLocalPaymentProvider({ acknowledgeTestOnly: true, runtimeProfile: "test" })).not.toThrow();
  });

  it("requestPayment() alone NEVER settles a payment -- observePayment stays non-paid until simulateSettlement() is called explicitly", async () => {
    const provider = new DeterministicLocalPaymentProvider({ acknowledgeTestOnly: true });
    const decision = await provider.requestPayment(request());
    const evidence = await provider.observePayment(decision.paymentId!);
    expect(evidence.status).not.toBe("settled");
    expect(evidence.verification).toBeUndefined();
  });

  it("simulateSettlement() produces authoritative test_simulator evidence the state machine ACCEPTS", async () => {
    const provider = new DeterministicLocalPaymentProvider({ acknowledgeTestOnly: true });
    const decision = await provider.requestPayment(request({ orderId: "order-42" }));
    const evidence = await provider.simulateSettlement(decision.paymentId!, "paid");

    expect(evidence.status).toBe("settled");
    expect(evidence.verification?.source).toBe("test_simulator");
    expect(evidence.verification?.authoritative).toBe(true);

    const settlement = createPendingSettlement(decision.paymentId!, "order-42", "prod-1");
    const result = applySettlementEvidence(settlement, evidence, "order-42");
    expect(result.outcome).toBe("transitioned");
    expect(result.state.status).toBe("paid");
  });

  it("ingestCallback only recognizes its own unmistakable { simulate: true, ... } shape -- a webhook-shaped payload is ignored", async () => {
    const provider = new DeterministicLocalPaymentProvider({ acknowledgeTestOnly: true });
    const decision = await provider.requestPayment(request());
    // A plausible-looking real webhook payload -- NOT recognized.
    await expect(provider.ingestCallback({ paymentId: decision.paymentId, event: "settled" })).resolves.toBeNull();
    // Its own explicit shape IS recognized.
    const evidence = await provider.ingestCallback({ simulate: true, paymentId: decision.paymentId, outcome: "paid" });
    expect(evidence?.status).toBe("settled");
    expect(evidence?.verification?.source).toBe("test_simulator");
  });
});
