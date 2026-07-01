import { describe, it, expect } from "vitest";
import {
  createRuntime,
  parseEdgeRecTimeoutMs,
  resolveEdgeRecViewerOptions,
  selectPromotionProvider,
  selectRecommendationProvider,
} from "../src/runtime/create_runtime.js";
import type { RuntimeEnv } from "../src/runtime/types.js";
import {
  MockPromotionProvider,
  MockRecommendationProvider,
  type PromotionProvider,
  type RecommendationProvider,
} from "../src/promotion/adapter.js";
import { EdgeRecPromotionProvider } from "../src/promotion/edge_rec_adapter.js";
import type {
  EdgeRecFetchLike,
  EdgeRecRequestBody,
} from "../src/promotion/edge_rec_adapter.js";
import { buildPromotionRequest, resolvePlacement } from "../src/promotion/policy.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/** A fetch client that records the endpoint, headers, and JSON-parsed body. */
function captureFetch(): EdgeRecFetchLike & {
  calls: number;
  bodies: EdgeRecRequestBody[];
  headers: Record<string, string>[];
} {
  const fn = ((_url: string, init) => {
    fn.calls += 1;
    fn.bodies.push(JSON.parse(init.body) as EdgeRecRequestBody);
    fn.headers.push({ ...init.headers });
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ candidates: [] }),
    });
  }) as EdgeRecFetchLike & {
    calls: number;
    bodies: EdgeRecRequestBody[];
    headers: Record<string, string>[];
  };
  fn.calls = 0;
  fn.bodies = [];
  fn.headers = [];
  return fn;
}

/** A request that passes the `canShowPromotion` gate (limit > 0). */
function viewerRequest(viewerPubkey: string) {
  return buildPromotionRequest(resolvePlacement("space_header"), {
    viewerPubkey,
    spaceId: "space-1",
    limit: 1,
  });
}

describe("Stage 38 — EdgeRec worker env selection", () => {
  it("1. no endpoint -> MockPromotionProvider", () => {
    expect(selectPromotionProvider()).toBeInstanceOf(MockPromotionProvider);
    expect(selectPromotionProvider({})).toBeInstanceOf(MockPromotionProvider);
  });

  it("2. endpoint without fetch -> MockPromotionProvider", () => {
    const env: RuntimeEnv = { PROMOTION_ENDPOINT: "https://edge-rec.example/p" };
    expect(selectPromotionProvider(env)).toBeInstanceOf(MockPromotionProvider);
  });

  it("3. endpoint + fetch -> EdgeRecPromotionProvider", () => {
    const env: RuntimeEnv = {
      PROMOTION_ENDPOINT: "https://edge-rec.example/p",
      fetch: captureFetch(),
    };
    expect(selectPromotionProvider(env)).toBeInstanceOf(EdgeRecPromotionProvider);
  });

  it("4. recommendation endpoint + fetch -> EdgeRec provider", () => {
    const env: RuntimeEnv = {
      RECOMMENDATION_ENDPOINT: "https://edge-rec.example/recos",
      fetch: captureFetch(),
    };
    expect(selectRecommendationProvider(env)).toBeInstanceOf(EdgeRecPromotionProvider);
  });

  it("5. recommendation falls back to the promotion endpoint", () => {
    // Only PROMOTION_ENDPOINT is set; the recommendation provider still wires up.
    const env: RuntimeEnv = {
      PROMOTION_ENDPOINT: "https://edge-rec.example/p",
      fetch: captureFetch(),
    };
    expect(selectRecommendationProvider(env)).toBeInstanceOf(EdgeRecPromotionProvider);
    // With neither endpoint, it stays the mock.
    expect(selectRecommendationProvider({ fetch: captureFetch() })).toBeInstanceOf(
      MockRecommendationProvider,
    );
  });

  it("6. api key is passed as a Bearer header, not exposed in the decision output", async () => {
    const fetch = captureFetch();
    const env: RuntimeEnv = {
      PROMOTION_ENDPOINT: "https://edge-rec.example/p",
      PROMOTION_API_KEY: "super-secret-key",
      fetch,
    };
    const provider = selectPromotionProvider(env);
    const decision = await provider.getPromotions(viewerRequest("pk"));
    // The key travels only in the Authorization header of the outbound request.
    expect(fetch.headers[0]?.["authorization"]).toBe("Bearer super-secret-key");
    // It never leaks into the returned decision.
    expect(JSON.stringify(decision)).not.toContain("super-secret-key");
  });

  it("7. timeout is parsed and clamped", () => {
    expect(parseEdgeRecTimeoutMs("5000")).toBe(5000);
    expect(parseEdgeRecTimeoutMs(1500)).toBe(1500);
    // Below the floor clamps up; above the ceiling clamps down.
    expect(parseEdgeRecTimeoutMs("10")).toBe(100);
    expect(parseEdgeRecTimeoutMs(999_999)).toBe(30_000);
    // Unparseable / non-positive / absent -> undefined (adapter default applies).
    expect(parseEdgeRecTimeoutMs("abc")).toBeUndefined();
    expect(parseEdgeRecTimeoutMs(0)).toBeUndefined();
    expect(parseEdgeRecTimeoutMs(-5)).toBeUndefined();
    expect(parseEdgeRecTimeoutMs()).toBeUndefined();
  });

  it("8. sendViewerPubkey defaults to off — the viewer is not sent", async () => {
    expect(resolveEdgeRecViewerOptions()).toEqual({});
    expect(resolveEdgeRecViewerOptions({})).toEqual({});
    const fetch = captureFetch();
    const env: RuntimeEnv = {
      PROMOTION_ENDPOINT: "https://edge-rec.example/p",
      fetch,
    };
    await selectPromotionProvider(env).getPromotions(viewerRequest("viewer-pk"));
    expect(fetch.bodies[0]).not.toHaveProperty("viewer");
  });

  it("9. sendViewerPubkey explicit true sends the raw viewer pubkey", async () => {
    expect(resolveEdgeRecViewerOptions({ PROMOTION_SEND_VIEWER_PUBKEY: "true" })).toEqual({
      sendViewerPubkey: true,
    });
    const fetch = captureFetch();
    const env: RuntimeEnv = {
      PROMOTION_ENDPOINT: "https://edge-rec.example/p",
      PROMOTION_SEND_VIEWER_PUBKEY: "true",
      fetch,
    };
    await selectPromotionProvider(env).getPromotions(viewerRequest("viewer-pk"));
    expect(fetch.bodies[0]?.viewer).toBe("viewer-pk");
  });

  it("10. hashViewerPubkey explicit but no hash fn does NOT leak the raw pubkey", async () => {
    // Hashing is recognized as intent but unwired — nothing is sent for it.
    expect(resolveEdgeRecViewerOptions({ PROMOTION_HASH_VIEWER_PUBKEY: "true" })).toEqual(
      {},
    );
    const fetch = captureFetch();
    const env: RuntimeEnv = {
      PROMOTION_ENDPOINT: "https://edge-rec.example/p",
      PROMOTION_HASH_VIEWER_PUBKEY: "true",
      fetch,
    };
    await selectPromotionProvider(env).getPromotions(viewerRequest("viewer-pk"));
    const body = fetch.bodies[0];
    expect(body).not.toHaveProperty("viewer");
    // The raw pubkey appears nowhere in the outbound body.
    expect(JSON.stringify(body)).not.toContain("viewer-pk");
  });

  it("11. createRuntime issues no fetch", () => {
    const fetch = captureFetch();
    const env: RuntimeEnv = {
      PROMOTION_ENDPOINT: "https://edge-rec.example/p",
      RECOMMENDATION_ENDPOINT: "https://edge-rec.example/recos",
      fetch,
    };
    createRuntime(env);
    expect(fetch.calls).toBe(0);
  });

  it("12. createRuntime does not call getPromotions / getRecommendations", () => {
    let promotionCalls = 0;
    let recommendationCalls = 0;
    const countingPromotion: PromotionProvider = {
      getPromotions: async (r) => {
        promotionCalls += 1;
        return { selected: [], reason: "provider_error", placement: r.placement };
      },
    };
    const countingRecommendation: RecommendationProvider = {
      getRecommendations: async (r) => {
        recommendationCalls += 1;
        return { selected: [], reason: "provider_error", placement: r.placement };
      },
    };
    const rt = createRuntime(
      { PROMOTION_ENDPOINT: "https://edge-rec.example/p", fetch: captureFetch() },
      {
        promotionProvider: countingPromotion,
        recommendationProvider: countingRecommendation,
      },
    );
    expect(rt.promotionProvider).toBe(countingPromotion);
    expect(rt.recommendationProvider).toBe(countingRecommendation);
    expect(promotionCalls).toBe(0);
    expect(recommendationCalls).toBe(0);
  });

  it("13. Worker source has no getPromotions / getRecommendations auto-call", () => {
    expect(workerSource).not.toMatch(/getPromotions|getRecommendations/);
  });

  it("14. does not mutate the input env", () => {
    const env: RuntimeEnv = {
      PROMOTION_ENDPOINT: "https://edge-rec.example/p",
      RECOMMENDATION_ENDPOINT: "https://edge-rec.example/recos",
      PROMOTION_API_KEY: "secret",
      RECOMMENDATION_API_KEY: "reco-secret",
      PROMOTION_SEND_VIEWER_PUBKEY: "true",
      PROMOTION_HASH_VIEWER_PUBKEY: "true",
      EDGE_REC_TIMEOUT_MS: "1500",
      fetch: captureFetch(),
    };
    const before = { ...env };
    const beforeKeys = Object.keys(env).sort();
    createRuntime(env);
    selectPromotionProvider(env);
    selectRecommendationProvider(env);
    expect(Object.keys(env).sort()).toEqual(beforeKeys);
    for (const key of beforeKeys) {
      expect(env[key as keyof RuntimeEnv]).toBe(before[key as keyof RuntimeEnv]);
    }
  });
});
