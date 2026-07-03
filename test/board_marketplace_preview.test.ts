import { describe, it, expect } from "vitest";
import {
  renderBoardPreview,
  renderBoardPreviewPage,
  SAMPLE_BOARDS,
} from "../src/render/board_preview.js";
import type { BoardDescriptor } from "../src/social/board.js";
import {
  renderMarketplaceListingPreview,
  renderMarketplacePreviewPage,
  SAMPLE_LISTINGS,
} from "../src/render/marketplace_preview.js";
import type { MarketplaceListingDescriptor } from "../src/marketplace/types.js";
import {
  BOARD_INTERACTION_INTENT_KINDS,
  reviewBoardInteractionIntent,
  sanitizeBoardInteractionIntentMetadata,
} from "../src/social/intent.js";
import type { BoardInteractionIntentDescriptor } from "../src/social/intent.js";
import {
  MARKETPLACE_INTENT_KINDS,
  reviewMarketplaceIntent,
  sanitizeMarketplaceIntentMetadata,
} from "../src/marketplace/intent.js";
import type { MarketplaceIntentDescriptor } from "../src/marketplace/intent.js";
import {
  handleRequest,
  isBoardPreviewEnabled,
  isMarketplacePreviewEnabled,
} from "../src/worker.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardPreviewSource from "../src/render/board_preview.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import marketplacePreviewSource from "../src/render/marketplace_preview.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import socialIntentSource from "../src/social/intent.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import marketplaceIntentSource from "../src/marketplace/intent.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

const previewSources = [boardPreviewSource, marketplacePreviewSource].join("\n");
const intentSources = [socialIntentSource, marketplaceIntentSource].join("\n");

const XSS_TITLE = `<script>alert('xss')</script>`;

describe("Board preview UI", () => {
  it("1. renderBoardPreview escapes title/topic/category labels", () => {
    const board: BoardDescriptor = {
      id: "b1",
      kind: "board",
      title: XSS_TITLE,
      topics: [{ id: "t1", name: XSS_TITLE }],
      categories: [{ id: "c1", name: XSS_TITLE }],
    };
    const html = renderBoardPreview(board);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("2. shows a nostr candidate kindLabel for an eligible board", () => {
    const html = renderBoardPreview(SAMPLE_BOARDS[0]!);
    expect(html).toMatch(/nostr candidate/);
    expect(html).toMatch(/text_note_placeholder|test_placeholder/);
  });

  it("3. renderBoardPreviewPage renders every sample board", () => {
    const html = renderBoardPreviewPage(SAMPLE_BOARDS);
    for (const board of SAMPLE_BOARDS) {
      expect(html).toContain(board.title);
    }
  });

  it("4. contains no post/reply form", () => {
    const html = renderBoardPreviewPage(SAMPLE_BOARDS);
    expect(html).not.toMatch(/<form/i);
    expect(html).not.toMatch(/<textarea/i);
  });
});

describe("Marketplace preview UI", () => {
  it("5. renderMarketplaceListingPreview escapes labels", () => {
    const listing: MarketplaceListingDescriptor = {
      idRef: XSS_TITLE,
      creatorRef: XSS_TITLE,
      kind: "digital_product_placeholder",
      visibility: "public",
    };
    const html = renderMarketplaceListingPreview(listing);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("6. shows a nostr candidate kindLabel for an eligible listing", () => {
    const html = renderMarketplaceListingPreview(SAMPLE_LISTINGS[0]!);
    expect(html).toMatch(/nostr candidate/);
    expect(html).toMatch(/marketplace_announcement_placeholder|test_placeholder/);
  });

  it("7. buy button is present but disabled — no purchase form", () => {
    const html = renderMarketplaceListingPreview(SAMPLE_LISTINGS[0]!);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>/);
    expect(html).not.toMatch(/<form/i);
  });

  it("8. never shows a price/payment/checkout/download/signed-URL field", () => {
    const html = renderMarketplacePreviewPage(SAMPLE_LISTINGS);
    expect(html).not.toMatch(/price|checkout|invoice|downloadUrl|signedUrl/i);
  });

  it("9. renderMarketplacePreviewPage renders every sample listing", () => {
    const html = renderMarketplacePreviewPage(SAMPLE_LISTINGS);
    for (const listing of SAMPLE_LISTINGS) {
      if (listing.idRef) expect(html).toContain(listing.idRef);
    }
  });
});

describe("Worker preview routes", () => {
  it("10. no boardPreview flag -> normal board route (not the preview page)", async () => {
    const res = await handleRequest(new Request("https://example.com/"));
    const body = await res.text();
    expect(body).not.toMatch(/board-preview-page/);
  });

  it("11. ?boardPreview=1 -> board preview page", async () => {
    const res = await handleRequest(new Request("https://example.com/?boardPreview=1"));
    const body = await res.text();
    expect(body).toMatch(/board-preview-page/);
  });

  it("12. ?boardPreview=true -> board preview page", async () => {
    const res = await handleRequest(new Request("https://example.com/?boardPreview=true"));
    const body = await res.text();
    expect(body).toMatch(/board-preview-page/);
  });

  it("13. no marketplacePreview flag -> normal board route", async () => {
    const res = await handleRequest(new Request("https://example.com/"));
    const body = await res.text();
    expect(body).not.toMatch(/marketplace-preview-page/);
  });

  it("14. ?marketplacePreview=1 -> marketplace preview page", async () => {
    const res = await handleRequest(new Request("https://example.com/?marketplacePreview=1"));
    const body = await res.text();
    expect(body).toMatch(/marketplace-preview-page/);
  });

  it("15. boardPreview takes precedence over marketplacePreview when both present", async () => {
    const res = await handleRequest(
      new Request("https://example.com/?boardPreview=1&marketplacePreview=1"),
    );
    const body = await res.text();
    expect(body).toMatch(/board-preview-page/);
    expect(body).not.toMatch(/marketplace-preview-page/);
  });

  it("16. isBoardPreviewEnabled/isMarketplacePreviewEnabled recognize only 1/true", () => {
    expect(isBoardPreviewEnabled(new URL("https://x.com/?boardPreview=1"))).toBe(true);
    expect(isBoardPreviewEnabled(new URL("https://x.com/?boardPreview=true"))).toBe(true);
    expect(isBoardPreviewEnabled(new URL("https://x.com/?boardPreview=yes"))).toBe(false);
    expect(isMarketplacePreviewEnabled(new URL("https://x.com/?marketplacePreview=1"))).toBe(true);
    expect(isMarketplacePreviewEnabled(new URL("https://x.com/?marketplacePreview=0"))).toBe(false);
  });

  it("17. existing routes are unaffected (runtimeStatus/product/space untouched)", async () => {
    const res = await handleRequest(new Request("https://example.com/?relay=bad-relay"));
    expect(res.status).toBe(400);
  });
});

describe("Board interaction intent boundary", () => {
  const cleanIntent: BoardInteractionIntentDescriptor = {
    idRef: "intent-1",
    boardRef: "board-1",
    actorRef: "actor-1",
    kind: "reply_placeholder",
    createdAt: 1000,
    metadata: { note: "sample" },
  };

  it("18. every board-intent kind is a placeholder label", () => {
    for (const kind of BOARD_INTERACTION_INTENT_KINDS) {
      expect(kind).toMatch(/_placeholder$/);
    }
  });

  it("19. a clean intent is accepted_placeholder", () => {
    const decision = reviewBoardInteractionIntent(cleanIntent);
    expect(decision.allowed).toBe(true);
    expect(decision.state).toBe("accepted_placeholder");
  });

  it("20. rejects sensitive metadata (secret/key/seed/token/payment/entitlement/dm/body/content/message)", () => {
    for (const key of ["secret", "key", "seed", "token", "payment", "entitlement", "dm", "body", "content", "message"]) {
      const decision = reviewBoardInteractionIntent({ ...cleanIntent, metadata: { [key]: "x" } });
      expect(decision.allowed).toBe(false);
    }
  });

  it("21. sanitizeBoardInteractionIntentMetadata drops sensitive entries", () => {
    const clean = sanitizeBoardInteractionIntentMetadata({ secret: "x", note: "keep" });
    expect(clean).toEqual({ note: "keep" });
  });

  it("22. does not mutate its input", () => {
    const snapshot = JSON.stringify(cleanIntent);
    reviewBoardInteractionIntent(cleanIntent);
    expect(JSON.stringify(cleanIntent)).toBe(snapshot);
  });

  it("23. carries no content/body/bytes field", () => {
    expect(socialIntentSource).not.toMatch(
      /interface\s+BoardInteractionIntentDescriptor[\s\S]{0,600}\breadonly\s+content\s*[?:]/,
    );
    expect(socialIntentSource).not.toMatch(
      /interface\s+BoardInteractionIntentDescriptor[\s\S]{0,600}\breadonly\s+body\s*[?:]/,
    );
    expect(socialIntentSource).not.toMatch(
      /interface\s+BoardInteractionIntentDescriptor[\s\S]{0,600}\breadonly\s+bytes\s*[?:]/,
    );
  });
});

describe("Marketplace purchase intent boundary", () => {
  const cleanIntent: MarketplaceIntentDescriptor = {
    idRef: "intent-1",
    listingRef: "listing-1",
    actorRef: "actor-1",
    creatorRef: "creator-1",
    kind: "purchase_intent_placeholder",
    createdAt: 1000,
    metadata: { note: "sample" },
  };

  it("24. every marketplace-intent kind is a placeholder label", () => {
    for (const kind of MARKETPLACE_INTENT_KINDS) {
      expect(kind).toMatch(/_placeholder$/);
    }
  });

  it("25. a clean intent is accepted_placeholder", () => {
    const decision = reviewMarketplaceIntent(cleanIntent);
    expect(decision.allowed).toBe(true);
    expect(decision.state).toBe("accepted_placeholder");
  });

  it("26. rejects price/card/payment/checkout/invoice/download metadata", () => {
    for (const key of ["price", "card", "payment", "checkout", "invoice", "download"]) {
      const decision = reviewMarketplaceIntent({ ...cleanIntent, metadata: { [key]: "x" } });
      expect(decision.allowed).toBe(false);
    }
  });

  it("27. sanitizeMarketplaceIntentMetadata drops sensitive entries", () => {
    const clean = sanitizeMarketplaceIntentMetadata({ price: "999", note: "keep" });
    expect(clean).toEqual({ note: "keep" });
  });

  it("28. does not mutate its input", () => {
    const snapshot = JSON.stringify(cleanIntent);
    reviewMarketplaceIntent(cleanIntent);
    expect(JSON.stringify(cleanIntent)).toBe(snapshot);
  });

  it("29. carries no price/card/payment/checkout/invoice/download field on the type", () => {
    expect(marketplaceIntentSource).not.toMatch(
      /interface\s+MarketplaceIntentDescriptor[\s\S]{0,600}\breadonly\s+(price|card|payment|checkout|invoice|download)\w*\s*[?:]/i,
    );
  });

  it("30. does not import PaymentProvider or EntitlementProvider", () => {
    expect(marketplaceIntentSource).not.toMatch(/from\s+['"].*payment\//);
    expect(marketplaceIntentSource).not.toMatch(/from\s+['"].*creator\//);
    expect(marketplaceIntentSource).not.toMatch(
      /:\s*(PaymentProvider|EntitlementProvider)\b/,
    );
  });
});

describe("preview + intent boundaries stay free of real network/provider calls", () => {
  it("31. imports no fetch/WebSocket/relay/signing library in preview render files", () => {
    const importLines = previewSources
      .split("\n")
      .filter((line: string) => /^\s*import\b/.test(line));
    const denylist = ["ws", "websocket", "node-fetch", "node:http", "node:https"];
    for (const line of importLines) {
      for (const banned of denylist) {
        expect(line.toLowerCase()).not.toContain(banned);
      }
    }
    expect(previewSources).not.toMatch(/\bfetch\s*\(/);
    expect(previewSources).not.toMatch(/\bnew\s+WebSocket\s*\(/);
  });

  it("32. preview render files call no provider method (put/get/delete/requestPayment/purchasePlaceholder/etc.)", () => {
    expect(previewSources).not.toMatch(
      /\.(put|get|delete|requestPayment|purchasePlaceholder|listPlaceholder|checkPlaceholder|sendPlaceholder|publishPlaceholder|connect|disconnect)\s*\(/,
    );
  });

  it("33. preview render files do not import StorageBackend/PaymentProvider/EntitlementProvider/ChatProvider/MarketplaceProvider instances", () => {
    expect(previewSources).not.toMatch(/from\s+['"].*storage\/noop_storage\.js/);
    expect(previewSources).not.toMatch(/from\s+['"].*payment\/noop_payment\.js/);
    expect(previewSources).not.toMatch(/from\s+['"].*creator\/entitlement\.js/);
    expect(previewSources).not.toMatch(/from\s+['"].*chat\/noop_chat\.js/);
    expect(previewSources).not.toMatch(/from\s+['"].*marketplace\/noop_marketplace\.js/);
  });

  it("34. intent boundaries import no fetch/relay/payment/entitlement/storage library", () => {
    expect(intentSources).not.toMatch(/\bfetch\s*\(/);
    expect(intentSources).not.toMatch(/from\s+['"].*storage\//);
    expect(intentSources).not.toMatch(/from\s+['"].*federation\//);
  });

  it("35. Worker source never reads/calls a runtime-selected boundary from the preview routes", () => {
    expect(workerSource).toMatch(/isBoardPreviewEnabled\(url\)/);
    expect(workerSource).toMatch(/isMarketplacePreviewEnabled\(url\)/);
    expect(workerSource).not.toMatch(
      /runtime\.(storageBackend|federationProvider|marketplaceProvider|creatorEntitlementProvider|chatProvider)\b/,
    );
  });

  it("36. never throws", () => {
    expect(() => renderBoardPreviewPage(SAMPLE_BOARDS)).not.toThrow();
    expect(() => renderMarketplacePreviewPage(SAMPLE_LISTINGS)).not.toThrow();
    expect(() => reviewBoardInteractionIntent({ kind: "test_placeholder" })).not.toThrow();
    expect(() => reviewMarketplaceIntent({ kind: "test_placeholder" })).not.toThrow();
  });
});
