import { describe, it, expect } from "vitest";
import { renderPromotionPlaceholder } from "../src/render/promotion.js";
import { resolvePlacement } from "../src/promotion/policy.js";

describe("promotion render placeholder", () => {
  it("renders a labeled, escaped placeholder for a placement", () => {
    const html = renderPromotionPlaceholder(resolvePlacement("space_sidebar"));
    expect(html).toContain('data-placement="space_sidebar"');
    expect(html).toContain("promotion-space");
    expect(html).toContain("Sponsored");
  });

  it("accepts a custom disclosure label and escapes it", () => {
    const html = renderPromotionPlaceholder(
      resolvePlacement("thread_header"),
      "Promotion <x>",
    );
    expect(html).toContain("Promotion &lt;x&gt;");
    expect(html).not.toContain("<x>");
  });

  it("never renders a real ad (no candidate destination/link)", () => {
    const html = renderPromotionPlaceholder(resolvePlacement("product_sidebar"));
    expect(html).not.toContain("http");
    expect(html).not.toContain("<a ");
  });
});
