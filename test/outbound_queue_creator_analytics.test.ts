import { describe, it, expect } from "vitest";
import {
  enqueuePlaceholder,
  dequeuePlaceholder,
  isSensitiveOutboundQueueValue,
} from "../src/federation/outbound_queue.js";
import type { OutboundQueueItemDescriptor } from "../src/federation/outbound_queue.js";
import {
  renderCreatorAnalyticsPreview,
  renderCreatorAnalyticsPreviewPage,
  SAMPLE_CREATOR_ANALYTICS,
} from "../src/render/creator_analytics_preview.js";
import {
  handleRequest,
  isCreatorAnalyticsPreviewEnabled,
} from "../src/worker.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import outboundQueueSource from "../src/federation/outbound_queue.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import analyticsPreviewSource from "../src/render/creator_analytics_preview.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

const boundarySources = [outboundQueueSource, analyticsPreviewSource].join("\n");

const XSS_LABEL = `<script>alert('xss')</script>`;

describe("Federation outbound queue skeleton", () => {
  const cleanItem: OutboundQueueItemDescriptor = {
    idRef: "item-1",
    intentRef: "intent-1",
    adapterKind: "nostr_placeholder",
    createdAt: 1000,
    metadata: { note: "sample" },
  };

  it("1. enqueuePlaceholder accepts a clean item as queued_placeholder", () => {
    const result = enqueuePlaceholder([], cleanItem);
    expect(result.decision.allowed).toBe(true);
    expect(result.decision.state).toBe("queued_placeholder");
    expect(result.queue).toEqual([cleanItem]);
  });

  it("2. enqueuePlaceholder never mutates the input queue", () => {
    const queue: readonly OutboundQueueItemDescriptor[] = [];
    const result = enqueuePlaceholder(queue, cleanItem);
    expect(queue).toEqual([]);
    expect(result.queue).not.toBe(queue);
  });

  it("3. enqueuePlaceholder rejects sensitive metadata (secret/key/seed/token/payment/entitlement/dm/body/content/message/sig/signature/privkey/nsec/relay)", () => {
    const markers = [
      "secret",
      "key",
      "seed",
      "token",
      "payment",
      "entitlement",
      "dm",
      "body",
      "content",
      "message",
      "sig",
      "signature",
      "privkey",
      "nsec",
      "relay",
    ];
    for (const key of markers) {
      const result = enqueuePlaceholder([], { ...cleanItem, metadata: { [key]: "x" } });
      expect(result.decision.allowed).toBe(false);
      expect(result.decision.state).toBe("rejected");
      expect(result.queue).toEqual([]);
    }
  });

  it("4. dequeuePlaceholder removes the front item (FIFO)", () => {
    const second: OutboundQueueItemDescriptor = { ...cleanItem, idRef: "item-2" };
    const enqueue1 = enqueuePlaceholder([], cleanItem);
    const enqueue2 = enqueuePlaceholder(enqueue1.queue, second);
    const dequeue = dequeuePlaceholder(enqueue2.queue);
    expect(dequeue.decision.allowed).toBe(true);
    expect(dequeue.decision.state).toBe("dequeued_placeholder");
    expect(dequeue.item).toEqual(cleanItem);
    expect(dequeue.queue).toEqual([second]);
  });

  it("5. dequeuePlaceholder on an empty queue is rejected and leaves the queue unchanged", () => {
    const queue: readonly OutboundQueueItemDescriptor[] = [];
    const result = dequeuePlaceholder(queue);
    expect(result.decision.allowed).toBe(false);
    expect(result.decision.state).toBe("rejected");
    expect(result.item).toBeUndefined();
    expect(result.queue).toBe(queue);
  });

  it("6. dequeuePlaceholder never mutates the input queue", () => {
    const queue = [cleanItem];
    dequeuePlaceholder(queue);
    expect(queue).toEqual([cleanItem]);
  });

  it("7. isSensitiveOutboundQueueValue flags a signing/relay-shaped value", () => {
    expect(isSensitiveOutboundQueueValue("my nsec1abc")).toBe(true);
    expect(isSensitiveOutboundQueueValue("a plain note")).toBe(false);
  });

  it("8. carries no content/body/bytes field on the type", () => {
    expect(outboundQueueSource).not.toMatch(
      /interface\s+OutboundQueueItemDescriptor[\s\S]{0,600}\breadonly\s+(content|body|bytes)\s*[?:]/i,
    );
  });

  it("9. no signing/network call in source", () => {
    expect(outboundQueueSource).not.toMatch(/\bfetch\s*\(/);
    expect(outboundQueueSource).not.toMatch(/\bnew\s+WebSocket\s*\(/);
    expect(outboundQueueSource).not.toMatch(/\bsign\s*\(/);
    expect(outboundQueueSource).not.toMatch(/\bpublish\s*\(/);
  });

  it("10. never throws", () => {
    expect(() => enqueuePlaceholder([], { adapterKind: "test_placeholder" })).not.toThrow();
    expect(() => dequeuePlaceholder([])).not.toThrow();
  });
});

describe("Creator analytics preview UI", () => {
  it("11. flag absent -> not shown (checked via Worker route below)", () => {
    expect(SAMPLE_CREATOR_ANALYTICS.length).toBeGreaterThan(0);
  });

  it("12. renderCreatorAnalyticsPreview escapes creatorRef and visibility labels", () => {
    const analytics = {
      ...SAMPLE_CREATOR_ANALYTICS[0]!,
      creatorRef: XSS_LABEL,
      visibilitySummaryLabels: [XSS_LABEL],
    };
    const html = renderCreatorAnalyticsPreview(analytics);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("13. renderCreatorAnalyticsPreviewPage renders every sample creator", () => {
    const html = renderCreatorAnalyticsPreviewPage(SAMPLE_CREATOR_ANALYTICS);
    for (const analytics of SAMPLE_CREATOR_ANALYTICS) {
      expect(html).toContain(analytics.creatorRef);
    }
  });

  it("14. the detail button is permanently disabled", () => {
    const html = renderCreatorAnalyticsPreviewPage(SAMPLE_CREATOR_ANALYTICS);
    const buttonMatches = html.match(/<button\b[^>]*>/g) ?? [];
    expect(buttonMatches.length).toBeGreaterThan(0);
    for (const button of buttonMatches) {
      expect(button).toContain("disabled");
    }
  });

  it("15. no revenue/amount/payment/checkout/invoice/buyer/email field or word anywhere in source", () => {
    const denylist = ["revenue", "amount", "payment", "checkout", "invoice", "buyer", "email"];
    for (const word of denylist) {
      expect(analyticsPreviewSource.toLowerCase()).not.toContain(word);
    }
  });

  it("16. never throws", () => {
    expect(() => renderCreatorAnalyticsPreviewPage(SAMPLE_CREATOR_ANALYTICS)).not.toThrow();
  });
});

describe("Worker creator analytics preview route", () => {
  it("17. no creatorAnalyticsPreview flag -> normal board route", async () => {
    const res = await handleRequest(new Request("https://example.com/"));
    const body = await res.text();
    expect(body).not.toMatch(/creator-analytics-preview-page/);
  });

  it("18. ?creatorAnalyticsPreview=1 -> creator analytics preview page", async () => {
    const res = await handleRequest(new Request("https://example.com/?creatorAnalyticsPreview=1"));
    const body = await res.text();
    expect(body).toMatch(/creator-analytics-preview-page/);
  });

  it("19. ?creatorAnalyticsPreview=true -> creator analytics preview page", async () => {
    const res = await handleRequest(new Request("https://example.com/?creatorAnalyticsPreview=true"));
    const body = await res.text();
    expect(body).toMatch(/creator-analytics-preview-page/);
  });

  it("20. creatorDashboardPreview takes precedence over creatorAnalyticsPreview when both present", async () => {
    const res = await handleRequest(
      new Request("https://example.com/?creatorDashboardPreview=1&creatorAnalyticsPreview=1"),
    );
    const body = await res.text();
    expect(body).toMatch(/creator-dashboard-preview-page/);
    expect(body).not.toMatch(/creator-analytics-preview-page/);
  });

  it("21. isCreatorAnalyticsPreviewEnabled recognizes only 1/true", () => {
    expect(
      isCreatorAnalyticsPreviewEnabled(new URL("https://x.com/?creatorAnalyticsPreview=1")),
    ).toBe(true);
    expect(
      isCreatorAnalyticsPreviewEnabled(new URL("https://x.com/?creatorAnalyticsPreview=true")),
    ).toBe(true);
    expect(
      isCreatorAnalyticsPreviewEnabled(new URL("https://x.com/?creatorAnalyticsPreview=0")),
    ).toBe(false);
  });

  it("22. existing routes are unaffected", async () => {
    const res = await handleRequest(new Request("https://example.com/?relay=bad-relay"));
    expect(res.status).toBe(400);
  });
});

describe("Stage 118 boundaries stay free of real network/provider calls", () => {
  it("23. imports no fetch/WebSocket/relay/signing library in either new file", () => {
    for (const source of [outboundQueueSource, analyticsPreviewSource]) {
      const importLines = source
        .split("\n")
        .filter((line: string) => /^\s*import\b/.test(line));
      const denylist = ["ws", "websocket", "node-fetch", "node:http", "node:https"];
      for (const line of importLines) {
        for (const banned of denylist) {
          expect(line.toLowerCase()).not.toContain(banned);
        }
      }
      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toMatch(/\bnew\s+WebSocket\s*\(/);
    }
  });

  it("24. calls no provider method", () => {
    expect(boundarySources).not.toMatch(
      /\.(put|get|delete|requestPayment|purchasePlaceholder|listPlaceholder|checkPlaceholder|sendPlaceholder|publishPlaceholder|connect|disconnect)\s*\(/,
    );
  });

  it("25. boundary sources import no storage/payment/entitlement library", () => {
    expect(boundarySources).not.toMatch(/from\s+['"].*storage\//);
    expect(boundarySources).not.toMatch(/from\s+['"].*payment\//);
    expect(boundarySources).not.toMatch(/from\s+['"].*creator\/entitlement\.js/);
  });

  it("26. Worker source never reads/calls a runtime-selected boundary from the creator analytics preview route", () => {
    expect(workerSource).toMatch(/isCreatorAnalyticsPreviewEnabled\(url\)/);
    expect(workerSource).not.toMatch(
      /runtime\.(storageBackend|federationProvider|marketplaceProvider|creatorEntitlementProvider|chatProvider)\b/,
    );
  });
});
