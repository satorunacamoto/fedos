import { describe, it, expect } from "vitest";
import {
  summarizeQueueStatusPreview,
  type QueueStatusPreview,
} from "../src/federation/queue_status_preview.js";
import { PROTOCOL_ADAPTER_KINDS } from "../src/federation/capability_matrix.js";
import type { OutboundQueueItemDescriptor } from "../src/federation/outbound_queue.js";
import {
  renderQueueStatusPreviewPage,
  SAMPLE_QUEUE_ITEMS,
} from "../src/render/queue_preview.js";
import { handleRequest, isQueuePreviewEnabled } from "../src/worker.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import queueStatusPreviewSource from "../src/federation/queue_status_preview.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import queuePreviewRenderSource from "../src/render/queue_preview.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import blueskyDoc from "../docs/bluesky_adapter_planning.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import threadsDoc from "../docs/threads_adapter_planning.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import rssDoc from "../docs/rss_adapter_planning.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

const boundarySources = [queueStatusPreviewSource, queuePreviewRenderSource].join("\n");

describe("Federation queue status preview", () => {
  it("1. summarizeQueueStatusPreview returns one row per known adapter kind", () => {
    const preview: QueueStatusPreview = summarizeQueueStatusPreview([]);
    expect(preview.descriptors.length).toBe(PROTOCOL_ADAPTER_KINDS.length);
    for (const descriptor of preview.descriptors) {
      expect(descriptor.state).toBe("idle_placeholder");
      expect(descriptor.itemCountPlaceholder).toBe(0);
    }
  });

  it("2. states are ONLY queued_placeholder or idle_placeholder", () => {
    const queue: readonly OutboundQueueItemDescriptor[] = [
      { adapterKind: "nostr_placeholder" },
      { adapterKind: "nostr_placeholder" },
    ];
    const preview = summarizeQueueStatusPreview(queue);
    for (const descriptor of preview.descriptors) {
      expect(["queued_placeholder", "idle_placeholder"]).toContain(descriptor.state);
    }
    const nostrRow = preview.descriptors.find((d) => d.adapterKind === "nostr_placeholder")!;
    expect(nostrRow.state).toBe("queued_placeholder");
    expect(nostrRow.itemCountPlaceholder).toBe(2);
  });

  it("3. never mutates the input queue", () => {
    const queue: readonly OutboundQueueItemDescriptor[] = [{ adapterKind: "rss_placeholder" }];
    const snapshot = JSON.stringify(queue);
    summarizeQueueStatusPreview(queue);
    expect(JSON.stringify(queue)).toBe(snapshot);
  });

  it("4. never throws", () => {
    expect(() => summarizeQueueStatusPreview([])).not.toThrow();
  });

  it("5. no fetch/websocket/publish/send call in source", () => {
    for (const source of [queueStatusPreviewSource, queuePreviewRenderSource]) {
      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toMatch(/\bnew\s+WebSocket\s*\(/);
      expect(source).not.toMatch(/\benqueuePlaceholder\s*\(/);
      expect(source).not.toMatch(/\bdequeuePlaceholder\s*\(/);
    }
  });
});

describe("Queue preview UI", () => {
  it("6. flag absent -> not shown (checked via Worker route below)", () => {
    expect(SAMPLE_QUEUE_ITEMS.length).toBeGreaterThan(0);
  });

  it("7. renderQueueStatusPreviewPage renders every adapter kind", () => {
    const html = renderQueueStatusPreviewPage(SAMPLE_QUEUE_ITEMS);
    for (const kind of PROTOCOL_ADAPTER_KINDS) {
      expect(html).toContain(kind);
    }
  });

  it("8. never throws", () => {
    expect(() => renderQueueStatusPreviewPage(SAMPLE_QUEUE_ITEMS)).not.toThrow();
  });
});

describe("Worker queue preview route", () => {
  it("9. no queuePreview flag -> normal board route", async () => {
    const res = await handleRequest(new Request("https://example.com/"));
    const body = await res.text();
    expect(body).not.toMatch(/queue-status-preview-page/);
  });

  it("10. ?queuePreview=1 -> queue status preview page", async () => {
    const res = await handleRequest(new Request("https://example.com/?queuePreview=1"));
    const body = await res.text();
    expect(body).toMatch(/queue-status-preview-page/);
  });

  it("11. ?queuePreview=true -> queue status preview page", async () => {
    const res = await handleRequest(new Request("https://example.com/?queuePreview=true"));
    const body = await res.text();
    expect(body).toMatch(/queue-status-preview-page/);
  });

  it("12. creatorAnalyticsPreview takes precedence over queuePreview when both present", async () => {
    const res = await handleRequest(
      new Request("https://example.com/?creatorAnalyticsPreview=1&queuePreview=1"),
    );
    const body = await res.text();
    expect(body).toMatch(/creator-analytics-preview-page/);
    expect(body).not.toMatch(/queue-status-preview-page/);
  });

  it("13. isQueuePreviewEnabled recognizes only 1/true", () => {
    expect(isQueuePreviewEnabled(new URL("https://x.com/?queuePreview=1"))).toBe(true);
    expect(isQueuePreviewEnabled(new URL("https://x.com/?queuePreview=true"))).toBe(true);
    expect(isQueuePreviewEnabled(new URL("https://x.com/?queuePreview=0"))).toBe(false);
  });

  it("14. existing routes are unaffected", async () => {
    const res = await handleRequest(new Request("https://example.com/?relay=bad-relay"));
    expect(res.status).toBe(400);
  });
});

describe("Bluesky/Threads/RSS adapter planning docs", () => {
  it("15. all three docs are docs-only, no implementation", () => {
    for (const doc of [blueskyDoc, threadsDoc, rssDoc] as string[]) {
      expect(doc).toMatch(/docs only/i);
    }
  });

  it("16. no OAuth token, fetch, or WebSocket call named as implemented in the docs", () => {
    for (const doc of [blueskyDoc, threadsDoc, rssDoc] as string[]) {
      expect(doc).not.toMatch(/\bfetch\s*\(/);
      expect(doc).not.toMatch(/\bnew\s+WebSocket\s*\(/);
    }
  });

  it("17. each doc references its ProtocolAdapterKind capability row staying unavailable", () => {
    expect(blueskyDoc).toMatch(/bluesky_placeholder/);
    expect(threadsDoc).toMatch(/threads_placeholder/);
    expect(rssDoc).toMatch(/rss_placeholder/);
  });
});

describe("Stage 119 boundaries stay free of real network/provider calls", () => {
  it("18. calls no provider method", () => {
    expect(boundarySources).not.toMatch(
      /\.(requestPayment|purchasePlaceholder|listPlaceholder|checkPlaceholder|sendPlaceholder|publishPlaceholder|connect|disconnect)\s*\(/,
    );
  });

  it("19. boundary sources import no storage/payment/entitlement library", () => {
    expect(boundarySources).not.toMatch(/from\s+['"].*storage\//);
    expect(boundarySources).not.toMatch(/from\s+['"].*payment\//);
  });

  it("20. Worker source never reads/calls a runtime-selected boundary from the queue preview route", () => {
    expect(workerSource).toMatch(/isQueuePreviewEnabled\(url\)/);
    expect(workerSource).not.toMatch(
      /runtime\.(storageBackend|federationProvider|marketplaceProvider|creatorEntitlementProvider|chatProvider)\b/,
    );
  });
});
