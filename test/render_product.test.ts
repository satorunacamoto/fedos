import { describe, it, expect } from "vitest";
import {
  renderProductLabel,
  renderProductPromotionPlaceholder,
  renderProductSummary,
} from "../src/render/product.js";
import type { Product } from "../src/commerce/types.js";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    kind: "pdf",
    title: "Field Guide",
    description: "A handy guide.",
    creatorPubkey: "a".repeat(64),
    priceCents: 500,
    currency: "USD",
    status: "active",
    visibility: "public",
    linkedSpaceIds: ["lounge"],
    linkedEventIds: [],
    assetIds: [],
    ...overrides,
  };
}

describe("renderProductLabel", () => {
  it("1. renders the product kind and title", () => {
    const html = renderProductLabel(product());
    expect(html).toContain("pdf");
    expect(html).toContain("Field Guide");
    expect(html).toContain('class="product-label product-pdf"');
  });
});

describe("renderProductSummary", () => {
  it("2. renders price, currency, status and visibility", () => {
    const html = renderProductSummary(product({ priceCents: 500, currency: "USD" }));
    expect(html).toContain("USD");
    expect(html).toContain("5.00");
    expect(html).toContain("active");
    expect(html).toContain("public");
    expect(html).toContain("lounge"); // linked space id
  });

  it("3. escapes the title and description", () => {
    const html = renderProductSummary(
      product({ title: "<b>Evil</b>", description: "<script>x</script>" }),
    );
    expect(html).not.toContain("<b>Evil</b>");
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;b&gt;Evil&lt;/b&gt;");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
  });

  it("escapes a malicious currency and id", () => {
    const html = renderProductSummary(product({ currency: "<x>", id: "<id>" }));
    expect(html).not.toContain("<x>");
    expect(html).not.toContain('data-product="<id>"');
    expect(html).toContain("&lt;x&gt;");
  });
});

describe("renderProductPromotionPlaceholder", () => {
  it("4. renders an empty product_sidebar placeholder", () => {
    const html = renderProductPromotionPlaceholder(product());
    expect(html).toContain('data-placement="product_sidebar"');
    expect(html).toContain("promotion-product");
    expect(html).toContain("Promotion placeholder");
  });

  it("5. renders no link, payment, download or ad candidate", () => {
    const combined =
      renderProductSummary(product()) + renderProductPromotionPlaceholder(product());
    expect(combined).not.toContain("<a "); // no destination/anchor
    expect(combined).not.toContain("http"); // no external URL
    expect(combined).not.toContain("<button"); // no buy/checkout/download action
  });
});

describe("product render purity", () => {
  it("6. does not mutate the input product", () => {
    const p = product();
    const snapshot = JSON.stringify(p);
    renderProductLabel(p);
    renderProductSummary(p);
    renderProductPromotionPlaceholder(p);
    expect(JSON.stringify(p)).toBe(snapshot);
  });
});
