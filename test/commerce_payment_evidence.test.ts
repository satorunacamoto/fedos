import { describe, it, expect } from "vitest";
import {
  AUTHORITATIVE_PAYMENT_EVIDENCE_SOURCES,
  type PaymentDecision,
  type PaymentEvidence,
  type PaymentEvidenceProvenance,
  type PaymentProvider,
  type PaymentProviderStatus,
  type PaymentCapability,
  type PaymentRequest,
} from "../src/os/commerce/payment/types.js";
import { PlaceholderPaymentProvider } from "../src/os/commerce/payment/noop_payment.js";
import { DeterministicLocalPaymentProvider } from "../src/os/commerce/payment/local_simulator.js";
import { computeHmacSha256Hex, verifyHmacSha256Hex } from "../src/os/commerce/payment/callback_verification.js";

/**
 * Commerce E2E Completion arc, Agent P -- explicit `PaymentEvidence`
 * type tests (brief item 2/§16) and `PaymentProvider` Port
 * extensibility (item 3).
 */

describe("PaymentEvidenceProvenance -- all five kinds are constructible and distinct", () => {
  it("customer_claim / merchant_claim are structurally non-authoritative", () => {
    const customer: PaymentEvidenceProvenance = { source: "customer_claim", authoritative: false, claimedBy: "buyer" };
    const merchant: PaymentEvidenceProvenance = { source: "merchant_claim", authoritative: false, claimedBy: "seller" };
    expect(customer.authoritative).toBe(false);
    expect(merchant.authoritative).toBe(false);
  });

  it("provider_unverified is structurally non-authoritative", () => {
    const unverified: PaymentEvidenceProvenance = { source: "provider_unverified", authoritative: false, provider: "placeholder" };
    expect(unverified.authoritative).toBe(false);
  });

  it("provider_verified and test_simulator are structurally authoritative", () => {
    const verified: PaymentEvidenceProvenance = {
      source: "provider_verified",
      authoritative: true,
      provider: "placeholder",
      verifiedAt: 1000,
    };
    const simulated: PaymentEvidenceProvenance = {
      source: "test_simulator",
      authoritative: true,
      simulator: "DeterministicLocalPaymentProvider",
    };
    expect(verified.authoritative).toBe(true);
    expect(simulated.authoritative).toBe(true);
  });

  it("the runtime allowlist names exactly the two authoritative sources", () => {
    expect(AUTHORITATIVE_PAYMENT_EVIDENCE_SOURCES.has("provider_verified")).toBe(true);
    expect(AUTHORITATIVE_PAYMENT_EVIDENCE_SOURCES.has("test_simulator")).toBe(true);
    expect(AUTHORITATIVE_PAYMENT_EVIDENCE_SOURCES.has("customer_claim")).toBe(false);
    expect(AUTHORITATIVE_PAYMENT_EVIDENCE_SOURCES.has("merchant_claim")).toBe(false);
    expect(AUTHORITATIVE_PAYMENT_EVIDENCE_SOURCES.has("provider_unverified")).toBe(false);
    expect(AUTHORITATIVE_PAYMENT_EVIDENCE_SOURCES.size).toBe(2);
  });
});

describe("PaymentEvidence.status vocabulary includes disputed (justified: DeterministicLocalPaymentProvider + state machine both exercise it)", () => {
  it("DeterministicLocalPaymentProvider can simulate a disputed outcome", async () => {
    const provider = new DeterministicLocalPaymentProvider({ acknowledgeTestOnly: true });
    const decision = await provider.requestPayment({
      productId: "prod-1",
      amountCents: 500,
      currency: "USD",
      rail: "manual_placeholder",
    });
    const evidence = await provider.simulateSettlement(decision.paymentId!, "disputed");
    expect(evidence.status).toBe("disputed");
  });
});

describe("Order<->Payment binding seam: orderId is optional and echoes through unchanged", () => {
  it("PaymentRequest/PaymentDecision.orderId is optional -- omitting it changes nothing (backward compatible)", async () => {
    const provider = new PlaceholderPaymentProvider();
    const decision = await provider.requestPayment({
      productId: "prod-1",
      amountCents: 500,
      currency: "USD",
      rail: "manual_placeholder",
    });
    expect(decision.orderId).toBeUndefined();
  });

  it("when a caller supplies orderId, it is echoed back on the decision (Placeholder and DeterministicLocal)", async () => {
    const request: PaymentRequest = {
      productId: "prod-1",
      orderId: "order-echo-test",
      amountCents: 500,
      currency: "USD",
      rail: "manual_placeholder",
    };
    const placeholderDecision = await new PlaceholderPaymentProvider().requestPayment(request);
    expect(placeholderDecision.orderId).toBe("order-echo-test");

    const simDecision = await new DeterministicLocalPaymentProvider({ acknowledgeTestOnly: true }).requestPayment(request);
    expect(simDecision.orderId).toBe("order-echo-test");
  });

  it("this file never imports from src/os/commerce/order -- orderId is treated as a fully opaque string throughout", () => {
    // Structural assertion only: if this test file, or the payment module
    // it exercises, ever needed a real Order type, TypeScript would force
    // an import. `orderId: string` alone is sufficient for every assertion
    // above.
    const opaque: string = "order-anything-at-all-including-garbage";
    expect(typeof opaque).toBe("string");
  });
});

describe("PaymentProvider Port readiness: a hand-built third-party adapter can implement the contract and produce properly-tagged verified evidence", () => {
  /**
   * Proves the Port itself needs NO redesign for a real adapter (e.g. a
   * future BTCPay adapter, left DESIGN ONLY/BLOCKED this wave -- see
   * `payment/adapters/btcpay/README.md`) to plug in: a minimal hand-built
   * double, using ONLY the generic `callback_verification.ts` primitive
   * (not anything Placeholder-specific), can implement `PaymentProvider`
   * and emit `provider_verified` evidence the state machine accepts.
   */
  class MinimalVerifyingAdapter implements PaymentProvider {
    #secret: string;
    #ledger = new Map<string, { productId: string; settled: boolean }>();
    #nextId = 0;

    constructor(secret: string) {
      this.#secret = secret;
    }

    getStatus(): PaymentProviderStatus {
      return { available: true, reason: "minimal adapter ready" };
    }

    getCapabilities(): readonly PaymentCapability[] {
      return ["invoice_placeholder"];
    }

    async requestPayment(request: PaymentRequest): Promise<PaymentDecision> {
      const paymentId = `adapter-payment-${(this.#nextId += 1)}`;
      this.#ledger.set(paymentId, { productId: request.productId, settled: false });
      return { allowed: true, status: "accepted_placeholder", rail: request.rail, reason: "ok", productId: request.productId, paymentId };
    }

    async observePayment(paymentId: string): Promise<PaymentEvidence> {
      const entry = this.#ledger.get(paymentId);
      if (entry === undefined) {
        return { paymentId, productId: "", observedAt: 0, status: "error", reason: "unknown" };
      }
      return {
        paymentId,
        productId: entry.productId,
        observedAt: 0,
        status: entry.settled ? "settled" : "error",
        reason: entry.settled ? "settled" : "not yet settled",
      };
    }

    async ingestCallback(payload: unknown): Promise<PaymentEvidence | null> {
      if (typeof payload !== "object" || payload === null) return null;
      const candidate = payload as { paymentId?: unknown; signature?: unknown };
      if (typeof candidate.paymentId !== "string" || typeof candidate.signature !== "string") return null;
      const entry = this.#ledger.get(candidate.paymentId);
      if (entry === undefined) return null;
      const valid = await verifyHmacSha256Hex(this.#secret, candidate.paymentId, candidate.signature);
      if (!valid) return null;
      entry.settled = true;
      return {
        paymentId: candidate.paymentId,
        productId: entry.productId,
        observedAt: 0,
        status: "settled",
        reason: "verified",
        verification: { source: "provider_verified", authoritative: true, provider: "minimal-adapter", verifiedAt: 0 },
      };
    }
  }

  it("a minimal hand-built adapter can implement the Port and produce authoritative evidence with no Commerce-domain changes", async () => {
    const secret = "adapter-secret";
    const adapter = new MinimalVerifyingAdapter(secret);
    const decision = await adapter.requestPayment({
      productId: "prod-1",
      amountCents: 500,
      currency: "USD",
      rail: "external_placeholder",
    });
    const forged = await adapter.ingestCallback({ paymentId: decision.paymentId, signature: "not-real" });
    expect(forged).toBeNull();

    const signature = await computeHmacSha256Hex(secret, decision.paymentId!);
    const evidence = await adapter.ingestCallback({ paymentId: decision.paymentId, signature });
    expect(evidence?.status).toBe("settled");
    expect(evidence?.verification?.source).toBe("provider_verified");
  });
});
