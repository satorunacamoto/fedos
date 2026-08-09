import { describe, it, expect } from "vitest";
import type {
  PaymentCapability,
  PaymentDecision,
  PaymentProvider,
  PaymentProviderStatus,
  PaymentRequest,
} from "../src/os/commerce/payment/types.js";
import { NoopPaymentProvider, PlaceholderPaymentProvider } from "../src/os/commerce/payment/noop_payment.js";

/**
 * OS Capability Modularization — Factory/Port Completion pass. Port-shape
 * check for `PaymentProvider` (`src/os/commerce/payment/types.ts`).
 *
 * `docs/architecture/FACTORY-PORT-COMPLETION-PLAN.md` names this exact gap:
 * `MessagingPort`/`ConversationPort`/`NotificationPort` each have a shape
 * test (`architecture_boundary_adapter_port_shapes.test.ts`);
 * `PaymentProvider` — named as a peer concept (`payments`) in the target
 * `createCommerce()` signature — did not. This file closes that gap,
 * mirroring that file's own two-part pattern:
 *
 *   1. a MINIMAL, hand-built double, checked for type-level assignability
 *      via `assertPaymentProviderShape` — belt-and-suspenders documentation
 *      of intent that the interface is genuinely implementable by an
 *      arbitrary conforming adapter, not just this repo's own two classes;
 *      and
 *   2. runtime behavior checks against the two REAL implementations that
 *      already exist (`NoopPaymentProvider`, `PlaceholderPaymentProvider`)
 *      — both take zero constructor dependencies, so (unlike the
 *      coordinator-backed Messenger/Conversation adapters) this file needs
 *      no `#private`-field workaround: it constructs genuine instances.
 *
 * Every check here reconfirms this Port's own hard guardrail: nothing
 * charges a card, opens a Lightning channel/invoice, builds a checkout
 * session, contacts a wallet, or issues a `fetch`. `accepted_placeholder`
 * means "policy-clean", never "paid".
 */

function assertPaymentProviderShape(_provider: PaymentProvider): void {}

/** A minimal hand-built double proving the interface is genuinely implementable by a third party, not just this repo's own two classes. */
class MinimalFakePaymentProvider implements PaymentProvider {
  #available: boolean;

  constructor(available: boolean) {
    this.#available = available;
  }

  getStatus(): PaymentProviderStatus {
    return this.#available
      ? { available: true, reason: "fake provider ready" }
      : { available: false, reason: "fake provider not configured" };
  }

  getCapabilities(): readonly PaymentCapability[] {
    return this.#available ? ["manual_grant_placeholder"] : [];
  }

  async requestPayment(request: PaymentRequest): Promise<PaymentDecision> {
    if (!this.#available) {
      return { allowed: false, status: "unavailable", rail: request.rail, reason: "fake provider not configured", productId: request.productId };
    }
    return { allowed: true, status: "accepted_placeholder", rail: request.rail, reason: "fake accept", productId: request.productId };
  }
}

const SAMPLE_REQUEST: PaymentRequest = Object.freeze({
  productId: "product-1",
  amountCents: 500,
  currency: "USD",
  rail: "manual_placeholder",
});

describe("PaymentProvider shape", () => {
  it("a minimal hand-built double satisfies the PaymentProvider shape (type-level, via `implements`)", () => {
    const fake = new MinimalFakePaymentProvider(true);
    assertPaymentProviderShape(fake);
    expect(typeof fake.getStatus).toBe("function");
    expect(typeof fake.getCapabilities).toBe("function");
    expect(typeof fake.requestPayment).toBe("function");
  });

  it("the hand-built double's requestPayment() never throws and returns a closed-vocabulary decision", async () => {
    const fake = new MinimalFakePaymentProvider(false);
    const decision = await fake.requestPayment(SAMPLE_REQUEST);
    expect(decision).toEqual({
      allowed: false,
      status: "unavailable",
      rail: "manual_placeholder",
      reason: "fake provider not configured",
      productId: "product-1",
    });
  });
});

describe("NoopPaymentProvider (real implementation) satisfies PaymentProvider", () => {
  it("satisfies the shape and is permanently unavailable", () => {
    const provider = new NoopPaymentProvider();
    assertPaymentProviderShape(provider);
    expect(provider.getStatus()).toEqual({ available: false, reason: "no payment backend is configured" });
    expect(provider.getCapabilities()).toEqual([]);
  });

  it("requestPayment() never throws, charges nothing, and always denies", async () => {
    const provider = new NoopPaymentProvider();
    const decision = await provider.requestPayment(SAMPLE_REQUEST);
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("unavailable");
    expect(decision.productId).toBe("product-1");
  });
});

describe("PlaceholderPaymentProvider (real implementation) satisfies PaymentProvider", () => {
  it("satisfies the shape and advertises placeholder-only capabilities", () => {
    const provider = new PlaceholderPaymentProvider();
    assertPaymentProviderShape(provider);
    expect(provider.getStatus().available).toBe(true);
    for (const capability of provider.getCapabilities()) {
      expect(capability.endsWith("_placeholder")).toBe(true);
    }
  });

  it("requestPayment() accepts a policy-clean request as accepted_placeholder, never a paid/settled status", async () => {
    const provider = new PlaceholderPaymentProvider();
    const decision = await provider.requestPayment(SAMPLE_REQUEST);
    expect(decision.status).toBe("accepted_placeholder");
    expect(decision.allowed).toBe(true);
    // Hard guardrail this Port's own header names: never "paid"/"settled"/"confirmed".
    expect(decision.status).not.toBe("paid");
    expect(decision.reason.toLowerCase()).not.toContain("paid");
    expect(decision.reason.toLowerCase()).not.toContain("settled");
  });

  it("requestPayment() rejects a negative amount without throwing", async () => {
    const provider = new PlaceholderPaymentProvider();
    const decision = await provider.requestPayment({ ...SAMPLE_REQUEST, amountCents: -1 });
    expect(decision).toEqual({
      allowed: false,
      status: "rejected",
      rail: "manual_placeholder",
      reason: "amount must be a non-negative number",
      productId: "product-1",
    });
  });

  it("requestPayment() rejects metadata that looks like a card/wallet/secret value", async () => {
    const provider = new PlaceholderPaymentProvider();
    const decision = await provider.requestPayment({ ...SAMPLE_REQUEST, metadata: { note: "card 4111111111111111" } });
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("rejected");
  });
});
