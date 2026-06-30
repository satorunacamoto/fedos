import { describe, it, expect } from "vitest";
// Vite/Vitest `?raw` import: the adapter source as a string (no node:fs needed).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import edgeRecSource from "../src/promotion/edge_rec_adapter.ts?raw";
import {
  EdgeRecPromotionProvider,
  isEdgeRecResponseLike,
  mapEdgeRecResponseToDecision,
  mapPromotionRequestToEdgeRec,
  type EdgeRecFetchLike,
  type EdgeRecHttpResponse,
} from "../src/promotion/edge_rec_adapter.js";
import { buildPromotionRequest, resolvePlacement } from "../src/promotion/policy.js";
import type { PromotionRequest } from "../src/promotion/types.js";

const VIEWER = "a".repeat(64);

function spaceRequest(
  overrides: Partial<Parameters<typeof buildPromotionRequest>[1]> = {},
): PromotionRequest {
  return buildPromotionRequest(resolvePlacement("space_header"), {
    spaceId: "lounge",
    tags: ["topic"],
    limit: 2,
    ...overrides,
  });
}

/** A fake injected client that records calls and never touches the network. */
function fakeFetch(
  response: EdgeRecHttpResponse | (() => Promise<EdgeRecHttpResponse>),
): EdgeRecFetchLike & { calls: { url: string; body: string }[] } {
  const calls: { url: string; body: string }[] = [];
  const fn = ((url: string, init) => {
    calls.push({ url, body: init.body });
    return typeof response === "function" ? response() : Promise.resolve(response);
  }) as EdgeRecFetchLike & { calls: { url: string; body: string }[] };
  fn.calls = calls;
  return fn;
}

function okResponse(json: unknown): EdgeRecHttpResponse {
  return { ok: true, status: 200, json: () => Promise.resolve(json) };
}

describe("edge-rec adapter", () => {
  it("1. request mapper maps placement and context", () => {
    const body = mapPromotionRequestToEdgeRec(spaceRequest());
    expect(body.placement).toBe("space_header");
    expect(body.context.surface).toBe("space");
    expect(body.context.spaceId).toBe("lounge");
    expect(body.context.tags).toEqual(["topic"]);
    expect(body.limit).toBe(2);
  });

  it("2. request mapper drops context irrelevant to the placement", () => {
    // A space slot carries no thread/chat/product id even if one is present.
    const raw: PromotionRequest = {
      placement: resolvePlacement("space_header"),
      spaceId: "lounge",
      threadId: "t1",
      chatId: "c1",
      productId: "p1",
      tags: [],
      limit: 1,
    };
    const body = mapPromotionRequestToEdgeRec(raw);
    expect(body.context.spaceId).toBe("lounge");
    expect(body.context.threadId).toBeUndefined();
    expect(body.context.chatId).toBeUndefined();
    expect(body.context.productId).toBeUndefined();
  });

  it("3. viewerPubkey is omitted by default", () => {
    const body = mapPromotionRequestToEdgeRec(spaceRequest({ viewerPubkey: VIEWER }));
    expect(body.viewer).toBeUndefined();
  });

  it("4. viewerPubkey is included only with an explicit option", () => {
    const raw = mapPromotionRequestToEdgeRec(spaceRequest({ viewerPubkey: VIEWER }), {
      sendViewerPubkey: true,
    });
    expect(raw.viewer).toBe(VIEWER);

    const hashed = mapPromotionRequestToEdgeRec(
      spaceRequest({ viewerPubkey: VIEWER }),
      { hashViewerPubkey: (pk) => `h:${pk.slice(0, 4)}` },
    );
    expect(hashed.viewer).toBe("h:aaaa"); // opaque, not the raw pubkey
  });

  it("5. response mapper maps candidates and stamps the provider", () => {
    const decision = mapEdgeRecResponseToDecision(
      {
        candidates: [
          {
            id: "ad-1",
            title: "Buy this",
            description: "desc",
            destination: "https://ad.example/1",
            image: "https://ad.example/1.png",
            sponsor: "acme",
            priority: 7,
            weight: 3,
            metadata: { campaign: "x" },
          },
        ],
      },
      resolvePlacement("space_header"),
    );
    expect(decision.reason).toBe("ok");
    expect(decision.selected).toHaveLength(1);
    const c = decision.selected[0]!;
    expect(c.id).toBe("ad-1");
    expect(c.title).toBe("Buy this");
    expect(c.destination).toBe("https://ad.example/1");
    expect(c.image).toBe("https://ad.example/1.png");
    expect(c.sponsor).toBe("acme");
    expect(c.metadata.provider).toBe("edge-rec");
    expect(c.metadata.campaign).toBe("x");
  });

  it("isEdgeRecResponseLike accepts a candidates array and rejects junk", () => {
    expect(isEdgeRecResponseLike({ candidates: [] })).toBe(true);
    expect(isEdgeRecResponseLike({})).toBe(false);
    expect(isEdgeRecResponseLike(null)).toBe(false);
    expect(isEdgeRecResponseLike("nope")).toBe(false);
  });

  it("6. a malformed response gives a provider_error decision", () => {
    const decision = mapEdgeRecResponseToDecision({ nope: true }, resolvePlacement("space_header"));
    expect(decision.selected).toEqual([]);
    expect(decision.reason).toBe("provider_error");
  });

  it("7. the provider calls the injected fetch with the endpoint", async () => {
    const fetch = fakeFetch(okResponse({ candidates: [] }));
    const provider = new EdgeRecPromotionProvider({
      fetch,
      endpoint: "https://edge-rec.example/promotions",
    });
    await provider.getPromotions(spaceRequest());
    expect(fetch.calls).toHaveLength(1);
    expect(fetch.calls[0]!.url).toBe("https://edge-rec.example/promotions");
    expect(JSON.parse(fetch.calls[0]!.body).placement).toBe("space_header");
  });

  it("8. the provider does not call fetch when the limit is 0", async () => {
    const fetch = fakeFetch(okResponse({ candidates: [] }));
    const provider = new EdgeRecPromotionProvider({
      fetch,
      endpoint: "https://edge-rec.example/promotions",
    });
    const decision = await provider.getPromotions(spaceRequest({ limit: 0 }));
    expect(fetch.calls).toHaveLength(0);
    expect(decision.reason).toBe("limit_zero");
    expect(decision.selected).toEqual([]);
  });

  it("9. the provider turns a fetch rejection into provider_error", async () => {
    const fetch = fakeFetch(() => Promise.reject(new Error("network down")));
    const provider = new EdgeRecPromotionProvider({
      fetch,
      endpoint: "https://edge-rec.example/promotions",
    });
    const decision = await provider.getPromotions(spaceRequest());
    expect(decision.reason).toBe("provider_error");
    expect(decision.selected).toEqual([]);
  });

  it("10. the provider turns a non-200 into provider_error", async () => {
    const fetch = fakeFetch({ ok: false, status: 503, json: () => Promise.resolve({}) });
    const provider = new EdgeRecPromotionProvider({
      fetch,
      endpoint: "https://edge-rec.example/promotions",
    });
    const decision = await provider.getPromotions(spaceRequest());
    expect(decision.reason).toBe("provider_error");
  });

  it("11. the adapter imports nothing from Stripe/Telegram and uses no HTMLRewriter", () => {
    const src: string = edgeRecSource;
    // No imports pull in Stripe / Telegram / HTMLRewriter (prose may mention them).
    const importLines = src
      .split("\n")
      .filter((line) => line.trimStart().startsWith("import"));
    for (const line of importLines) {
      expect(line.toLowerCase()).not.toContain("stripe");
      expect(line.toLowerCase()).not.toContain("telegram");
      expect(line.toLowerCase()).not.toContain("htmlrewriter");
    }
    // No API usage of any of these, and no ambient/global fetch reference.
    expect(src).not.toMatch(/HTMLRewriter\s*\(/);
    expect(src).not.toMatch(/new\s+HTMLRewriter/);
    expect(src).not.toMatch(/\bStripe\s*\(/);
    expect(src).not.toContain("globalThis.fetch");
    expect(src).not.toMatch(/[^.#\w]fetch\s*\(/);
  });

  it("12. does not mutate the input request", async () => {
    const req = spaceRequest({ viewerPubkey: VIEWER });
    const snapshot = JSON.stringify(req);
    mapPromotionRequestToEdgeRec(req, { sendViewerPubkey: true });
    const fetch = fakeFetch(okResponse({ candidates: [] }));
    const provider = new EdgeRecPromotionProvider({
      fetch,
      endpoint: "https://edge-rec.example/promotions",
    });
    await provider.getPromotions(req);
    expect(JSON.stringify(req)).toBe(snapshot);
  });
});
