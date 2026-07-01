import { describe, it, expect } from "vitest";
import {
  buildGrantPreview,
  renderGrantPreview,
  renderGrantPreviewUnavailable,
} from "../src/render/grant_preview.js";
import type { GrantPreviewView } from "../src/render/grant_preview.js";
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

function decision(overrides: Partial<PaymentDecision> = {}): PaymentDecision {
  return {
    allowed: true,
    status: "accepted_placeholder",
    rail: "manual_placeholder",
    reason: "request is policy-clean",
    productId: "prod-1",
    buyerPubkey: BUYER,
    ...overrides,
  };
}

describe("buildGrantPreview", () => {
  it("1. builds a preview view for an accepted_placeholder decision", () => {
    const view = buildGrantPreview(product(), decision(), BUYER, 1_700_000_000_000);
    expect(view).not.toBeNull();
    expect(view?.productId).toBe("prod-1");
    expect(view?.productTitle).toBe("A Product");
    expect(view?.actorPubkey).toBe(BUYER);
    expect(view?.createdAt).toBe(1_700_000_000);
  });

  it("2. returns null for a pending decision", () => {
    expect(
      buildGrantPreview(product(), decision({ allowed: true, status: "pending" }), BUYER),
    ).toBeNull();
  });

  it("3. returns null for a rejected/unavailable/error decision", () => {
    for (const status of ["rejected", "unavailable", "error"] as const) {
      expect(
        buildGrantPreview(product(), decision({ allowed: false, status }), BUYER),
      ).toBeNull();
    }
  });

  it("4. source is always preview_only", () => {
    const view = buildGrantPreview(product(), decision(), BUYER);
    expect(view?.source).toBe("preview_only");
  });

  it("5. access is always not_granted", () => {
    const view = buildGrantPreview(product(), decision(), BUYER);
    expect(view?.access).toBe("not_granted");
  });

  it("does not mutate the product or decision", () => {
    const p = product();
    const d = decision();
    const productSnap = JSON.stringify(p);
    const decisionSnap = JSON.stringify(d);
    buildGrantPreview(p, d, BUYER);
    expect(JSON.stringify(p)).toBe(productSnap);
    expect(JSON.stringify(d)).toBe(decisionSnap);
  });

  it("omits actorPubkey when none is supplied", () => {
    const view = buildGrantPreview(product(), decision());
    expect(view?.actorPubkey).toBeUndefined();
  });
});

describe("renderGrantPreview", () => {
  it("6. escapes product title, reason, and actor", () => {
    const view: GrantPreviewView = {
      productId: '"><script>evil</script>',
      productTitle: "<b>Title</b>",
      actorPubkey: BUYER,
      source: "preview_only",
      access: "not_granted",
      reason: "<i>reason</i>",
    };
    const html = renderGrantPreview(view);
    expect(html).not.toContain("<script>evil</script>");
    expect(html).toContain("&lt;script&gt;evil&lt;/script&gt;");
    expect(html).not.toContain("<b>Title</b>");
    expect(html).toContain("&lt;b&gt;Title&lt;/b&gt;");
    expect(html).not.toContain("<i>reason</i>");
    expect(html).toContain("&lt;i&gt;reason&lt;/i&gt;");
  });

  it("7. never claims paid/settled/purchased/granted (only the negated preview wording)", () => {
    const view = buildGrantPreview(product(), decision(), BUYER)!;
    const html = renderGrantPreview(view);
    const lower = html.toLowerCase();
    expect(lower).not.toMatch(/\bpaid\b|\bsettled\b|\bpurchased\b/);
    expect(lower).not.toContain("grant issued");
    expect(lower).not.toContain("access granted");
    expect(lower).not.toContain("download unlocked");
    // The permitted, explicitly-negated phrasing:
    expect(lower).toContain("preview only");
    expect(lower).toContain("not_granted");
  });

  it("renders with no actor line when actorPubkey is absent", () => {
    const view = buildGrantPreview(product(), decision())!;
    const html = renderGrantPreview(view);
    expect(html).not.toContain("grant-preview-actor");
  });

  it("8. does not mutate the view", () => {
    const view = buildGrantPreview(product(), decision(), BUYER)!;
    const viewSnap = JSON.stringify(view);
    renderGrantPreview(view);
    expect(JSON.stringify(view)).toBe(viewSnap);
  });
});

describe("renderGrantPreviewUnavailable", () => {
  it("escapes the reason and renders no grant fields", () => {
    const html = renderGrantPreviewUnavailable("<script>alert(1)</script>");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("preview_only");
    expect(html).not.toContain("not_granted");
  });
});
