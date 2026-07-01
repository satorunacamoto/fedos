import { describe, it, expect } from "vitest";
import worker, { handleRequest } from "../src/worker.js";
import { createRuntime } from "../src/runtime/create_runtime.js";
import type { AppRuntime } from "../src/runtime/types.js";
import type { AssetCache, AssetKey, CachedAsset } from "../src/asset/types.js";
import type { PromotionDecision, PromotionRequest } from "../src/promotion/types.js";
import type { PromotionProvider, RecommendationProvider } from "../src/promotion/adapter.js";
import type {
  NotificationBridge,
  NotificationDecision,
  NotificationPayload,
} from "../src/notification/types.js";
import type { PaymentDecision, PaymentProvider, PaymentRequest } from "../src/payment/types.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

interface SpyCallCounts {
  assetCacheGet: number;
  getPromotions: number;
  getRecommendations: number;
  notify: number;
  requestPayment: number;
  publish: number;
}

/** Counters for every "must not be called" boundary method. */
function spyRuntime(): { runtime: AppRuntime; calls: SpyCallCounts } {
  const base = createRuntime();
  const calls: SpyCallCounts = {
    assetCacheGet: 0,
    getPromotions: 0,
    getRecommendations: 0,
    notify: 0,
    requestPayment: 0,
    publish: 0,
  };

  const assetCache: AssetCache = {
    async get(key: AssetKey, now: number): Promise<CachedAsset | undefined> {
      calls.assetCacheGet += 1;
      return base.assetCache.get(key, now);
    },
    put: (asset) => base.assetCache.put(asset),
    has: (key, now) => base.assetCache.has(key, now),
    delete: (key) => base.assetCache.delete(key),
    clear: () => base.assetCache.clear(),
  };

  const promotionProvider: PromotionProvider = {
    async getPromotions(request: PromotionRequest): Promise<PromotionDecision> {
      calls.getPromotions += 1;
      return base.promotionProvider.getPromotions(request);
    },
  };

  const recommendationProvider: RecommendationProvider = {
    async getRecommendations(request: PromotionRequest): Promise<PromotionDecision> {
      calls.getRecommendations += 1;
      return base.recommendationProvider.getRecommendations(request);
    },
  };

  const notificationBridge: NotificationBridge = {
    getStatus: () => base.notificationBridge.getStatus(),
    getCapabilities: () => base.notificationBridge.getCapabilities(),
    async notify(payload: NotificationPayload): Promise<NotificationDecision> {
      calls.notify += 1;
      return base.notificationBridge.notify(payload);
    },
  };

  const paymentProvider: PaymentProvider = {
    getStatus: () => base.paymentProvider.getStatus(),
    getCapabilities: () => base.paymentProvider.getCapabilities(),
    async requestPayment(request: PaymentRequest): Promise<PaymentDecision> {
      calls.requestPayment += 1;
      return base.paymentProvider.requestPayment(request);
    },
  };

  const relayPublisher = {
    async publish(event: Parameters<AppRuntime["relayPublisher"]["publish"]>[0]) {
      calls.publish += 1;
      return base.relayPublisher.publish(event);
    },
  };

  const runtime: AppRuntime = {
    ...base,
    assetCache,
    promotionProvider,
    recommendationProvider,
    notificationBridge,
    paymentProvider,
    relayPublisher,
  };
  return { runtime, calls };
}

describe("Stage 50 — Runtime provider status page", () => {
  it("1. ?runtimeStatus=1 renders a status page", async () => {
    const { runtime } = spyRuntime();
    const res = await handleRequest(
      new Request("http://localhost/?runtimeStatus=1"),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      runtime,
    );
    const body = await res.text();
    expect(body).toContain("Runtime status");
  });

  it("2. the status page includes the runtime mode", async () => {
    const { runtime } = spyRuntime();
    const body = await (
      await handleRequest(
        new Request("http://localhost/?runtimeStatus=true"),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        runtime,
      )
    ).text();
    expect(body).toContain(`mode: <code>${runtime.mode}</code>`);
  });

  it("3. the status page includes paymentProvider/notificationBridge labels", async () => {
    const { runtime } = spyRuntime();
    const body = await (
      await handleRequest(
        new Request("http://localhost/?runtimeStatus=1"),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        runtime,
      )
    ).text();
    expect(body).toContain("paymentProvider");
    expect(body).toContain("notificationBridge");
  });

  it("4. getPromotions/getRecommendations/requestPayment/notify/publish are never called", async () => {
    const { runtime, calls } = spyRuntime();
    await handleRequest(
      new Request("http://localhost/?runtimeStatus=1"),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      runtime,
    );
    expect(calls.getPromotions).toBe(0);
    expect(calls.getRecommendations).toBe(0);
    expect(calls.requestPayment).toBe(0);
    expect(calls.notify).toBe(0);
    expect(calls.publish).toBe(0);
  });

  it("5. assetCache.get is never called", async () => {
    const { runtime, calls } = spyRuntime();
    await handleRequest(
      new Request("http://localhost/?runtimeStatus=1"),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      runtime,
    );
    expect(calls.assetCacheGet).toBe(0);
  });

  it("6. issues no fetch (source-level check)", () => {
    expect(workerSource).not.toMatch(/\bfetch\s*\(\s*['"`]https?:/);
  });

  it("7. no endpoint URL or API key is rendered", async () => {
    const runtime = createRuntime({
      PROMOTION_ENDPOINT: "https://secret-endpoint.example/api",
      PROMOTION_API_KEY: "sk_live_should_never_appear",
    });
    const body = await (
      await handleRequest(
        new Request("http://localhost/?runtimeStatus=1"),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        runtime,
      )
    ).text();
    expect(body).not.toContain("secret-endpoint.example");
    expect(body).not.toContain("sk_live_should_never_appear");
    expect(body).not.toContain("https://");
  });

  it("8. the existing default board route still works (no runtime, no flag)", async () => {
    const res = await handleRequest(new Request("http://localhost/"));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Welcome to nostr-window");
  });

  it("the flag alone (no runtime supplied) falls through to normal routing", async () => {
    const res = await handleRequest(new Request("http://localhost/?runtimeStatus=1"));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toContain("Runtime status");
  });

  it("the default Worker export serves the status page end-to-end", async () => {
    const res = await worker.fetch(new Request("http://localhost/?runtimeStatus=1"), {});
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Runtime status");
    expect(body).toContain("mode: <code>local</code>");
  });
});
