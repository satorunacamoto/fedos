import { describe, it, expect, afterEach } from "vitest";
import {
  renderMockPromotionPreview,
  renderPromotionCandidatePreview,
  renderPromotionDecisionPreview,
} from "../src/render/promotion.js";
import { resolvePlacement } from "../src/promotion/policy.js";
import type {
  PromotionCandidate,
  PromotionDecision,
} from "../src/promotion/types.js";
import { handleRequest, isPromotionPreviewEnabled } from "../src/worker.js";
import type {
  RelaySocketEvent,
  RelaySocketEventType,
  RelaySocketLike,
  WebSocketFactory,
} from "../src/nostr/ws_relay.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/** A scripted socket that answers REQ with an immediate EOSE (no events). */
function eoseFactory(): WebSocketFactory {
  return () => {
    const listeners: Partial<
      Record<RelaySocketEventType, ((ev: RelaySocketEvent) => void)[]>
    > = {};
    const socket: RelaySocketLike = {
      send(data: string) {
        const m = JSON.parse(data);
        if (m[0] === "REQ") {
          for (const l of listeners.message ?? []) {
            l({ data: JSON.stringify(["EOSE", m[1]]) });
          }
        }
      },
      close() {},
      addEventListener(type, listener) {
        (listeners[type] ??= []).push(listener);
      },
    };
    return socket;
  };
}

const placement = resolvePlacement("space_header");

function candidate(overrides: Partial<PromotionCandidate> = {}): PromotionCandidate {
  return {
    id: "mock-candidate-1",
    title: "Sample mock promotion",
    description: "A fixed mock candidate.",
    destination: "https://ad.example/click-target",
    image: "https://ad.example/banner.png",
    sponsor: "example-sponsor",
    priority: 1,
    weight: 1,
    metadata: { mock: "true" },
    ...overrides,
  };
}

function decisionWith(candidates: readonly PromotionCandidate[]): PromotionDecision {
  return {
    selected: candidates,
    reason: candidates.length > 0 ? "ok" : "no_candidates",
    placement,
  };
}

describe("renderPromotionCandidatePreview / renderPromotionDecisionPreview", () => {
  it("1. renders the mock candidate title and sponsor", () => {
    const html = renderPromotionDecisionPreview(decisionWith([candidate()]));
    expect(html).toContain("Sample mock promotion");
    expect(html).toContain("example-sponsor");
    expect(html).toContain("Promotion preview (mock)");
  });

  it("2. escapes title, description, and sponsor", () => {
    const html = renderPromotionCandidatePreview(
      candidate({
        title: "<script>t</script>",
        description: "<b>d</b>",
        sponsor: "<i>s</i>",
      }),
    );
    expect(html).not.toContain("<script>t</script>");
    expect(html).toContain("&lt;script&gt;t&lt;/script&gt;");
    expect(html).toContain("&lt;b&gt;d&lt;/b&gt;");
    expect(html).toContain("&lt;i&gt;s&lt;/i&gt;");
  });

  it("3. renders no destination link", () => {
    const html = renderPromotionCandidatePreview(candidate());
    expect(html).not.toContain("https://ad.example/click-target");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("href");
  });

  it("4. renders no image tag", () => {
    const html = renderPromotionCandidatePreview(candidate());
    expect(html).not.toContain("<img");
    expect(html).not.toContain("https://ad.example/banner.png");
  });

  it("5. an empty decision renders a safe empty state", () => {
    const html = renderPromotionDecisionPreview(decisionWith([]));
    expect(html).toContain("promotion-preview-empty");
    expect(html).toContain("No mock promotion candidates.");
    expect(html).not.toContain("<li");
  });

  it("6. escapes metadata keys and values", () => {
    const html = renderPromotionCandidatePreview(
      candidate({ metadata: { "<k>": "<v>" } }),
    );
    expect(html).not.toContain("<k>");
    expect(html).toContain("&lt;k&gt;");
    expect(html).toContain("&lt;v&gt;");
  });

  it("renders no tracking/billing/ranking vocabulary", () => {
    const html = renderPromotionDecisionPreview(decisionWith([candidate()]));
    const lower = html.toLowerCase();
    for (const banned of [
      "click",
      "impression",
      "tracking",
      "billing",
      "ranking",
      "auction",
      "stripe",
      "checkout",
      "destination",
    ]) {
      expect(lower).not.toContain(banned);
    }
  });

  it("renderMockPromotionPreview drives the mock provider and renders its decision", async () => {
    const html = await renderMockPromotionPreview({
      placement,
      tags: [],
      limit: 2,
    });
    // Two default mock candidates come back under the preview block.
    expect(html).toContain("Promotion preview (mock)");
    expect(html).toContain("Sample promotion");
  });
});

describe("worker mock promotion preview mode", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("1. ?space=general&promotionPreview=1 renders a mock promotion preview", async () => {
    const body = await (
      await handleRequest(
        new Request("http://localhost/?space=general&promotionPreview=1"),
      )
    ).text();
    expect(body).toContain("Promotion preview (mock)");
    expect(body).toContain("Sample promotion");
  });

  it("2. ?product=<id>&promotionPreview=1 renders a mock promotion preview", async () => {
    const body = await (
      await handleRequest(
        new Request("http://localhost/?product=guide-pdf&promotionPreview=1"),
      )
    ).text();
    expect(body).toContain("Promotion preview (mock)");
    expect(body).toContain("Sample promotion");
  });

  it("3. without the preview flag, no mock candidate is rendered", async () => {
    const body = await (
      await handleRequest(new Request("http://localhost/?space=general"))
    ).text();
    expect(body).not.toContain("Promotion preview (mock)");
    expect(body).not.toContain("Sample promotion");
    // The empty placeholder is still there (unchanged behaviour).
    expect(body).toContain("promotion-placeholder");
  });

  it("4. the mock preview flag path constructs no EdgeRec / real provider", () => {
    const src: string = workerSource;
    // Stage 52 legitimately adds a SEPARATE, dual-flag-gated real-provider
    // preview path (see promotion_provider_preview_ui.test.ts) — but the
    // Worker never imports the edge-rec adapter module or constructs
    // `EdgeRecPromotionProvider` directly, and `?promotionPreview=1` alone
    // still drives ONLY the mock provider (see test 1/2 above).
    expect(src).not.toContain("edge_rec_adapter");
    expect(src).not.toMatch(/new\s+EdgeRecPromotionProvider/);
    expect(src).not.toContain("getRecommendations");
  });

  it("5. rendering a preview issues no fetch", async () => {
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response("nope");
    }) as typeof fetch;
    await handleRequest(
      new Request("http://localhost/?space=general&promotionPreview=1"),
    );
    await handleRequest(
      new Request("http://localhost/?product=guide-pdf&promotionPreview=1"),
    );
    expect(fetchCalls).toBe(0);
  });

  it("6. the preview contains no click/impression/tracking/billing text", async () => {
    const body = await (
      await handleRequest(
        new Request("http://localhost/?space=general&promotionPreview=1"),
      )
    ).text();
    const lower = body.toLowerCase();
    for (const banned of [
      "impression",
      "tracking",
      "billing",
      "ranking",
      "auction",
      "stripe",
      "checkout",
    ]) {
      expect(lower).not.toContain(banned);
    }
    // No image or click target in the preview.
    expect(body).not.toContain("<img");
    expect(body).not.toContain("ad.example");
  });

  it("7. the live relay path does not invoke the preview provider", async () => {
    // Successful live path (allowlisted relay) is placeholder-free and, even with
    // the flag, renders NO preview because it is not sample mode.
    const live = await handleRequest(
      new Request(
        "http://localhost/?relay=wss://relay.damus.io&space=general&promotionPreview=1",
      ),
      eoseFactory(),
    );
    const liveBody = await live.text();
    expect(live.status).toBe(200);
    expect(liveBody).not.toContain("Promotion preview (mock)");
    expect(liveBody).not.toContain("Sample promotion");

    // A non-allowlisted relay is rejected (400) before any board/preview render.
    const rejected = await handleRequest(
      new Request(
        "http://localhost/?relay=wss://evil.example&space=general&promotionPreview=1",
      ),
    );
    expect(rejected.status).toBe(400);
    expect(await rejected.text()).not.toContain("Promotion preview (mock)");
  });

  it("8. a candidate injected via the mock provider is escaped in output", async () => {
    // Drive the render path directly with a hostile candidate to prove escaping.
    const html = await renderMockPromotionPreview(
      { placement, tags: [], limit: 1 },
      {
        getPromotions: async (request) => ({
          selected: [candidate({ title: "<script>x</script>", sponsor: "<img src=x>" })],
          reason: "ok",
          placement: request.placement,
        }),
      },
    );
    expect(html).not.toContain("<script>x</script>");
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
  });

  it("isPromotionPreviewEnabled only accepts explicit 1/true", () => {
    const url = (q: string) => new URL(`http://localhost/${q}`);
    expect(isPromotionPreviewEnabled(url("?promotionPreview=1"))).toBe(true);
    expect(isPromotionPreviewEnabled(url("?promotionPreview=true"))).toBe(true);
    expect(isPromotionPreviewEnabled(url("?promotionPreview=0"))).toBe(false);
    expect(isPromotionPreviewEnabled(url("?promotionPreview=yes"))).toBe(false);
    expect(isPromotionPreviewEnabled(url("?"))).toBe(false);
  });
});
