import { describe, it, expect } from "vitest";
import { NoopPaymentProvider, PlaceholderPaymentProvider } from "../src/payment/noop_payment.js";
import {
  canRequestPaymentForProduct,
  paymentDecisionToGrant,
  productToPaymentRequest,
} from "../src/payment/commerce_bridge.js";
import type { PaymentDecision, PaymentRequest } from "../src/payment/types.js";
import type { Product } from "../src/commerce/types.js";
// Source-level checks: prove no real transport import and no runtime/worker auto-wire.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import paymentTypesSource from "../src/payment/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopPaymentSource from "../src/payment/noop_payment.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import commerceBridgeSource from "../src/payment/commerce_bridge.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

const paymentSources = [paymentTypesSource, noopPaymentSource, commerceBridgeSource].join("\n");

const CREATOR = "a".repeat(64);
const BUYER = "b".repeat(64);

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    kind: "pdf",
    title: "A Product",
    creatorPubkey: CREATOR,
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

function request(overrides: Partial<PaymentRequest> = {}): PaymentRequest {
  return {
    productId: "prod-1",
    buyerPubkey: BUYER,
    amountCents: 500,
    currency: "USD",
    rail: "manual_placeholder",
    ...overrides,
  };
}

describe("NoopPaymentProvider", () => {
  it("1. is always unavailable / rejected", async () => {
    const provider = new NoopPaymentProvider();
    expect(provider.getStatus()).toEqual({
      available: false,
      reason: "no payment backend is configured",
    });
    expect(provider.getCapabilities()).toEqual([]);
    const decision = await provider.requestPayment(request());
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("unavailable");
  });
});

describe("PlaceholderPaymentProvider", () => {
  it("2. does not create an invoice (no invoice field/URL anywhere in the decision)", async () => {
    const provider = new PlaceholderPaymentProvider();
    const decision = await provider.requestPayment(request());
    expect(decision.status).toBe("accepted_placeholder");
    expect(Object.keys(decision)).not.toContain("invoiceUrl");
    expect(Object.keys(decision)).not.toContain("invoice");
    expect(JSON.stringify(decision)).not.toMatch(/lnbc|invoice/i);
  });

  it("3. does not create a checkout URL (no checkout/url field anywhere in the decision)", async () => {
    const provider = new PlaceholderPaymentProvider();
    const decision = await provider.requestPayment(request());
    expect(Object.keys(decision)).not.toContain("checkoutUrl");
    expect(Object.keys(decision)).not.toContain("url");
    expect(JSON.stringify(decision)).not.toMatch(/checkout|https?:\/\//i);
  });

  it("accepts a policy-clean request as accepted_placeholder", async () => {
    const provider = new PlaceholderPaymentProvider();
    const decision = await provider.requestPayment(request());
    expect(decision).toEqual({
      allowed: true,
      status: "accepted_placeholder",
      rail: "manual_placeholder",
      reason: "request is policy-clean (placeholder acceptance — nothing was charged)",
      productId: "prod-1",
      buyerPubkey: BUYER,
    });
  });

  it("rejects a negative amount", async () => {
    const provider = new PlaceholderPaymentProvider();
    const decision = await provider.requestPayment(request({ amountCents: -1 }));
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("rejected");
  });
});

describe("commerce bridge", () => {
  it("4. productToPaymentRequest allows an active product", () => {
    const req = productToPaymentRequest(product(), BUYER);
    expect(req).toEqual({
      productId: "prod-1",
      buyerPubkey: BUYER,
      amountCents: 500,
      currency: "USD",
      rail: "manual_placeholder",
    });
  });

  it("5. rejects a draft product", () => {
    expect(productToPaymentRequest(product({ status: "draft" }), BUYER)).toBeNull();
    expect(canRequestPaymentForProduct(product({ status: "draft" })).allowed).toBe(false);
  });

  it("6. rejects an archived product", () => {
    expect(productToPaymentRequest(product({ status: "archived" }), BUYER)).toBeNull();
    expect(canRequestPaymentForProduct(product({ status: "archived" })).allowed).toBe(false);
  });

  it("7. rejects a negative price", () => {
    expect(productToPaymentRequest(product({ priceCents: -100 }), BUYER)).toBeNull();
    expect(canRequestPaymentForProduct(product({ priceCents: -100 })).allowed).toBe(false);
  });

  it("8. paymentDecisionToGrant returns null for pending/rejected/unavailable/error", () => {
    const base: PaymentDecision = {
      allowed: true,
      status: "pending",
      rail: "manual_placeholder",
      reason: "awaiting request",
      productId: "prod-1",
      buyerPubkey: BUYER,
    };
    expect(paymentDecisionToGrant(base)).toBeNull();
    expect(paymentDecisionToGrant({ ...base, allowed: false, status: "rejected" })).toBeNull();
    expect(paymentDecisionToGrant({ ...base, allowed: false, status: "unavailable" })).toBeNull();
    expect(paymentDecisionToGrant({ ...base, allowed: false, status: "error" })).toBeNull();
  });

  it("9. paymentDecisionToGrant returns a grant only for accepted_placeholder", () => {
    const decision: PaymentDecision = {
      allowed: true,
      status: "accepted_placeholder",
      rail: "manual_placeholder",
      reason: "request is policy-clean",
      productId: "prod-1",
      buyerPubkey: BUYER,
    };
    const grant = paymentDecisionToGrant(decision, { grantedAt: 1000 });
    expect(grant).toEqual({
      productId: "prod-1",
      buyerPubkey: BUYER,
      grantedAt: 1000,
      source: "manual",
    });
    // No buyerPubkey -> cannot build a grant.
    expect(paymentDecisionToGrant({ ...decision, buyerPubkey: undefined })).toBeNull();
  });

  it("10. the grant is never marked payment-settled", () => {
    const decision: PaymentDecision = {
      allowed: true,
      status: "accepted_placeholder",
      rail: "manual_placeholder",
      reason: "request is policy-clean",
      productId: "prod-1",
      buyerPubkey: BUYER,
    };
    const grant = paymentDecisionToGrant(decision, { grantedAt: 1000 });
    expect(grant?.source).not.toBe("payment");
    expect(["manual", "promo"]).toContain(grant?.source);
    // Even asking for "promo" is allowed; "payment" is not offered by the type.
    const promoGrant = paymentDecisionToGrant(decision, { source: "promo", grantedAt: 1000 });
    expect(promoGrant?.source).toBe("promo");
  });

  it("11. sensitive metadata is removed (bridge) or denied (provider)", async () => {
    const sensitiveMetadata = {
      note: "gift for a friend",
      cardNumber: "4111111111111111",
      walletSecret: "xprv-should-never-appear",
    };
    const req = productToPaymentRequest(product(), BUYER, { metadata: sensitiveMetadata });
    expect(req?.metadata).toEqual({ note: "gift for a friend" });
    expect(JSON.stringify(req)).not.toMatch(/4111111111111111|xprv/);

    const provider = new PlaceholderPaymentProvider();
    const decision = await provider.requestPayment(request({ metadata: sensitiveMetadata }));
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("rejected");
  });

  it("12. does not mutate inputs", () => {
    const p = product({ visibility: "public" });
    const opts = { metadata: { note: "hi" } };
    const productSnap = JSON.stringify(p);
    const optsSnap = JSON.stringify(opts);
    productToPaymentRequest(p, BUYER, opts);
    canRequestPaymentForProduct(p);
    expect(JSON.stringify(p)).toBe(productSnap);
    expect(JSON.stringify(opts)).toBe(optsSnap);

    const decision: PaymentDecision = {
      allowed: true,
      status: "accepted_placeholder",
      rail: "manual_placeholder",
      reason: "ok",
      productId: "prod-1",
      buyerPubkey: BUYER,
    };
    const decisionSnap = JSON.stringify(decision);
    paymentDecisionToGrant(decision, { grantedAt: 1000 });
    expect(JSON.stringify(decision)).toBe(decisionSnap);
  });
});

describe("payment boundary stays unwired and free of real transports", () => {
  it("13. Runtime source does not import or wire the payment boundary", () => {
    expect(runtimeSource).not.toMatch(/from\s+['"].*\/payment\//);
    expect(runtimeSource).not.toMatch(/PaymentProvider|NoopPaymentProvider|PlaceholderPaymentProvider/);
    expect(runtimeSource).not.toMatch(/requestPayment|productToPaymentRequest|paymentDecisionToGrant/);
  });

  it("14. Worker source does not import or wire the payment boundary", () => {
    expect(workerSource).not.toMatch(/from\s+['"].*\/payment\//);
    expect(workerSource).not.toMatch(/PaymentProvider|NoopPaymentProvider|PlaceholderPaymentProvider/);
    expect(workerSource).not.toMatch(/requestPayment|productToPaymentRequest|paymentDecisionToGrant/);
  });

  it("15. imports no Lightning/Stripe/Apple Pay/Google Pay/Breez/Greenlight library", () => {
    const importLines = paymentSources
      .split("\n")
      .filter((line: string) => /^\s*import\b/.test(line));
    const denylist = [
      "breez",
      "greenlight",
      "lightning",
      "lnd",
      "lnurl",
      "bolt11",
      "stripe",
      "apple-pay",
      "applepay",
      "google-pay",
      "googlepay",
      "braintree",
      "paypal",
    ];
    for (const line of importLines) {
      for (const banned of denylist) {
        expect(line.toLowerCase()).not.toContain(banned);
      }
    }
  });

  it("16. issues no fetch/network call and no invoice/checkout builder", () => {
    expect(paymentSources).not.toMatch(/\bfetch\s*\(/);
    expect(paymentSources).not.toMatch(/createInvoice|generateInvoice|createCheckout|checkoutUrl/i);
  });
});
