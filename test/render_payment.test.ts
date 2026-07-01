import { describe, it, expect } from "vitest";
import {
  renderPaymentDecision,
  renderPurchasePreview,
  renderPurchaseUnavailable,
} from "../src/render/payment.js";
import { canRequestPaymentForProduct, productToPaymentRequest } from "../src/payment/commerce_bridge.js";
import { PlaceholderPaymentProvider } from "../src/payment/noop_payment.js";
import type { PaymentDecision } from "../src/payment/types.js";
import type { Product } from "../src/commerce/types.js";

const BUYER = "b".repeat(64);

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    kind: "pdf",
    title: "A Product",
    creatorPubkey: "a".repeat(64),
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

function acceptedDecision(overrides: Partial<PaymentDecision> = {}): PaymentDecision {
  return {
    allowed: true,
    status: "accepted_placeholder",
    rail: "manual_placeholder",
    reason: "request is policy-clean (placeholder acceptance — nothing was charged)",
    productId: "prod-1",
    buyerPubkey: BUYER,
    ...overrides,
  };
}

/** Drives the real Stage 44 boundary end-to-end (no network) for a given product. */
async function previewFor(p: Product, buyerPubkey?: string): Promise<string> {
  const eligibility = canRequestPaymentForProduct(p);
  if (!eligibility.allowed) return renderPurchaseUnavailable(eligibility.reason);
  const request = productToPaymentRequest(p, buyerPubkey);
  if (!request) return renderPurchaseUnavailable(eligibility.reason);
  const decision = await new PlaceholderPaymentProvider().requestPayment(request);
  return renderPurchasePreview(p, decision, { buyerPubkey });
}

describe("renderPurchasePreview", () => {
  it("1. renders a purchase preview for an active product", async () => {
    const html = await previewFor(product());
    expect(html).toContain('class="purchase-preview"');
    expect(html).toContain("Purchase preview");
    expect(html).toContain("USD 5.00");
    expect(html).toContain("manual_placeholder");
    expect(html).toContain("No payment is processed.");
  });

  it("2. escapes price/currency-adjacent product fields", () => {
    const html = renderPurchasePreview(
      product({ id: '"><script>evil</script>', currency: '<b>USD</b>' }),
      acceptedDecision(),
    );
    expect(html).not.toContain("<script>evil</script>");
    expect(html).toContain("&lt;script&gt;evil&lt;/script&gt;");
    expect(html).not.toContain("<b>USD</b>");
    expect(html).toContain("&lt;b&gt;USD&lt;/b&gt;");
  });

  it("3. renders a disabled checkout button", () => {
    const html = renderPurchasePreview(product(), acceptedDecision());
    expect(html).toMatch(/<button[^>]*\bdisabled\b[^>]*>Checkout disabled<\/button>/);
  });

  it("4. never renders an invoice, checkout URL, QR, or card form", async () => {
    const html = await previewFor(product(), BUYER);
    const lower = html.toLowerCase();
    expect(lower).not.toContain("invoice");
    expect(lower).not.toContain("checkout url");
    expect(lower).not.toContain("http://");
    expect(lower).not.toContain("https://");
    expect(lower).not.toContain("qr");
    expect(lower).not.toContain("<img");
    expect(lower).not.toContain('type="text"'); // no card-number-style input
    expect(lower).not.toContain("card number");
    expect(lower).not.toContain("wallet secret");
    expect(lower).not.toMatch(/\bgrant issued\b/);
    expect(lower).not.toMatch(/\bpaid\b|\bsettled\b|\bpurchased\b/);
  });

  it("5. a draft product renders an unavailable preview", async () => {
    const html = await previewFor(product({ status: "draft" }));
    expect(html).toContain("purchase-preview-unavailable");
    expect(html).toContain("Purchase preview unavailable");
    expect(html).not.toContain("Checkout disabled");
  });

  it("6. an archived product renders an unavailable preview", async () => {
    const html = await previewFor(product({ status: "archived" }));
    expect(html).toContain("purchase-preview-unavailable");
    expect(html).not.toContain("Checkout disabled");
  });

  it("7. escapes the reason text on the unavailable panel", () => {
    const html = renderPurchaseUnavailable('<script>alert(1)</script>');
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("8. does not mutate the product or the decision", () => {
    const p = product();
    const decision = acceptedDecision();
    const productSnap = JSON.stringify(p);
    const decisionSnap = JSON.stringify(decision);
    renderPurchasePreview(p, decision, { buyerPubkey: BUYER });
    renderPaymentDecision(decision);
    expect(JSON.stringify(p)).toBe(productSnap);
    expect(JSON.stringify(decision)).toBe(decisionSnap);
  });
});

describe("renderPaymentDecision / renderPurchaseUnavailable", () => {
  it("renders the decision's status/rail/reason, escaped", () => {
    const html = renderPaymentDecision(
      acceptedDecision({ reason: '<i>reason</i>' }),
    );
    expect(html).toContain("accepted_placeholder");
    expect(html).toContain("manual_placeholder");
    expect(html).toContain("&lt;i&gt;reason&lt;/i&gt;");
    expect(html).not.toContain("<i>reason</i>");
  });

  it("a rejected/pending/unavailable decision falls back to the unavailable panel", () => {
    for (const status of ["pending", "rejected", "unavailable", "error"] as const) {
      const html = renderPurchasePreview(
        product(),
        acceptedDecision({ allowed: status === "pending", status, reason: `state:${status}` }),
      );
      expect(html).toContain("purchase-preview-unavailable");
      expect(html).toContain(`state:${status}`);
      expect(html).not.toContain("Checkout disabled");
    }
  });
});
