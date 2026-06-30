import { describe, it, expect } from "vitest";
import {
  renderAssetPreviewList,
  renderProductAccessDenied,
  renderProductDirectory,
  renderProductNotFound,
  renderProductPage,
} from "../src/render/product.js";
import type { ProductAsset } from "../src/commerce/directory.js";
import type { AccessDecision, Product } from "../src/commerce/types.js";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "guide",
    kind: "pdf",
    title: "Field Guide",
    description: "A handy guide.",
    creatorPubkey: "f".repeat(64),
    priceCents: 500,
    currency: "USD",
    status: "active",
    visibility: "public",
    linkedSpaceIds: ["lounge"],
    linkedEventIds: [],
    assetIds: ["a-pub", "a-unlisted", "a-private", "a-paid"],
    ...overrides,
  };
}

function asset(
  id: string,
  visibility: ProductAsset["metadata"]["visibility"],
  overrides: Partial<ProductAsset["metadata"]> = {},
): ProductAsset {
  return {
    id,
    metadata: {
      kind: "preview",
      visibility,
      contentType: "application/pdf",
      sizeBytes: 1024,
      checksum: "sha256:demo",
      source: "demo:src",
      tags: ["sample"],
      ...overrides,
    },
  };
}

const ALLOWED: AccessDecision = { allowed: true, reason: "public active product" };

const MIXED_ASSETS: ProductAsset[] = [
  asset("a-pub", "public"),
  asset("a-unlisted", "unlisted"),
  asset("a-private", "private"),
  asset("a-paid", "paid"),
];

describe("renderProductDirectory", () => {
  it("1. renders the products with links to their ?product pages", () => {
    const html = renderProductDirectory([product(), product({ id: "p2", title: "Second" })]);
    expect(html).toContain('class="product-directory"');
    expect(html).toContain("Field Guide");
    expect(html).toContain("Second");
    expect(html).toContain('href="?product=guide"');
  });

  it("renders an empty state and escapes the actor pubkey", () => {
    expect(renderProductDirectory([])).toContain("No products available.");
    const html = renderProductDirectory([product()], "<script>");
    expect(html).not.toContain("viewing as <code><script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("renderProductPage", () => {
  it("2. renders the product summary", () => {
    const html = renderProductPage(product(), ALLOWED, MIXED_ASSETS);
    expect(html).toContain('class="product-page"');
    expect(html).toContain("Field Guide");
    expect(html).toContain("USD");
    expect(html).toContain("public active product"); // the decision reason
  });

  it("3. escapes the title and description", () => {
    const html = renderProductPage(
      product({ title: "<b>Evil</b>", description: "<script>x</script>" }),
      ALLOWED,
      [],
    );
    expect(html).not.toContain("<b>Evil</b>");
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;b&gt;Evil&lt;/b&gt;");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
  });

  it("9. renders the promotion placeholder by default and omits it when disabled", () => {
    expect(renderProductPage(product(), ALLOWED, [])).toContain("promotion-placeholder");
    expect(
      renderProductPage(product(), ALLOWED, [], { promotions: false }),
    ).not.toContain("promotion-placeholder");
  });
});

describe("renderAssetPreviewList", () => {
  it("4. shows only public and unlisted assets", () => {
    const html = renderAssetPreviewList(MIXED_ASSETS);
    expect(html).toContain('data-asset="a-pub"');
    expect(html).toContain('data-asset="a-unlisted"');
    expect(html).toContain("Previews (2)");
  });

  it("5. hides private and paid assets entirely", () => {
    const html = renderAssetPreviewList(MIXED_ASSETS);
    expect(html).not.toContain('data-asset="a-private"');
    expect(html).not.toContain('data-asset="a-paid"');
    expect(html).not.toContain(">paid<");
  });

  it("escapes asset source / checksum / contentType / tags", () => {
    const html = renderAssetPreviewList([
      asset("a-x", "public", {
        contentType: "<ct>",
        source: "<src>",
        checksum: "<sum>",
        tags: ["<tag>"],
      }),
    ]);
    expect(html).not.toContain("<ct>");
    expect(html).not.toContain("<src>");
    expect(html).not.toContain("<sum>");
    expect(html).not.toContain("<tag>");
    expect(html).toContain("&lt;src&gt;");
    expect(html).toContain("&lt;tag&gt;");
  });

  it("6. renders no download, payment, signed URL or link affordance", () => {
    const html = renderAssetPreviewList(MIXED_ASSETS);
    expect(html).not.toContain("<a "); // no link out of a preview
    expect(html).not.toContain("<button"); // no buy/checkout/download action
    expect(html.toLowerCase()).not.toContain("download");
    expect(html.toLowerCase()).not.toContain("http");
    expect(html.toLowerCase()).not.toContain("signed");
  });

  it("shows an empty state when no asset is previewable", () => {
    const html = renderAssetPreviewList([asset("a-paid", "paid"), asset("a-priv", "private")]);
    expect(html).toContain("No public previews available.");
  });
});

describe("renderProductNotFound", () => {
  it("7. escapes the product id", () => {
    const html = renderProductNotFound("<script>");
    expect(html).toContain("Product not found");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("renderProductAccessDenied", () => {
  it("8. renders the (escaped) reason", () => {
    const html = renderProductAccessDenied(
      product({ title: "<b>P</b>" }),
      { allowed: false, reason: "private product requires a valid purchase grant" },
    );
    expect(html).toContain("Access denied");
    expect(html).toContain("private product requires a valid purchase grant");
    expect(html).not.toContain("<b>P</b>");
    expect(html).toContain("&lt;b&gt;P&lt;/b&gt;");
  });
});

describe("product page does not embed bytes or a delivery path", () => {
  it("renders metadata labels only — no base64/data URI/asset bytes", () => {
    const html = renderProductPage(product(), ALLOWED, MIXED_ASSETS);
    expect(html).not.toContain("data:"); // no inline data URI
    expect(html).not.toContain("base64");
    expect(html).not.toContain("<img"); // no embedded image bytes
  });
});
