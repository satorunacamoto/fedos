import { describe, it, expect } from "vitest";
import worker, { handleRequest } from "../src/os/_legacy_prototype/worker.js";
import { createRuntime } from "../src/os/_legacy_prototype/runtime/create_runtime.js";
import type { AppRuntime } from "../src/os/_legacy_prototype/runtime/types.js";
import type { AssetCache, AssetKey, CachedAsset } from "../src/os/_legacy_prototype/asset/types.js";
import type { PromotionDecision, PromotionRequest } from "../src/os/_legacy_prototype/promotion/types.js";
import type { PromotionProvider, RecommendationProvider } from "../src/os/_legacy_prototype/promotion/adapter.js";
import type {
  NotificationBridge,
  NotificationDecision,
  NotificationPayload,
} from "../src/notification/types.js";
import type { PaymentDecision, PaymentProvider, PaymentRequest } from "../src/os/commerce/payment/types.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

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
    observePayment: (paymentId: string) => base.paymentProvider.observePayment(paymentId),
    ingestCallback: (payload: unknown) => base.paymentProvider.ingestCallback(payload),
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

describe("Stage 50/51 — Runtime provider status page (categorized)", () => {
  it("1. ?runtimeStatus=1 still renders a status page", async () => {
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

  it("the status page has category section headings", async () => {
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
    for (const heading of ["Cache", "Storage", "Provider", "Bridge", "Security"]) {
      expect(body).toContain(`>${heading}<`);
    }
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

describe("Stage 54 — Runtime status JSON export (disabled by default)", () => {
  it("1. ?runtimeStatus=1&format=json returns application/json", async () => {
    const { runtime } = spyRuntime();
    const res = await handleRequest(
      new Request("http://localhost/?runtimeStatus=1&format=json"),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      runtime,
    );
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("2. the response body parses as JSON", async () => {
    const { runtime } = spyRuntime();
    const body = await (
      await handleRequest(
        new Request("http://localhost/?runtimeStatus=1&format=json"),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        runtime,
      )
    ).text();
    expect(() => JSON.parse(body)).not.toThrow();
  });

  it("3. the JSON has sections", async () => {
    const { runtime } = spyRuntime();
    const body = await (
      await handleRequest(
        new Request("http://localhost/?runtimeStatus=1&format=json"),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        runtime,
      )
    ).text();
    const parsed = JSON.parse(body);
    expect(parsed.mode).toBe(runtime.mode);
    expect(parsed.sections.map((s: { category: string }) => s.category)).toEqual([
      "cache",
      "storage",
      "provider",
      "bridge",
      "security",
    ]);
  });

  it("4. ?runtimeStatus=1 without format=json still returns the HTML page", async () => {
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
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("Runtime status");
  });

  it("5. an invalid format value falls back to HTML", async () => {
    const { runtime } = spyRuntime();
    for (const format of ["xml", "yaml", "JSON", "1", ""]) {
      const res = await handleRequest(
        new Request(`http://localhost/?runtimeStatus=1&format=${format}`),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        runtime,
      );
      expect(res.headers.get("content-type")).toContain("text/html");
    }
  });

  it("6. getPromotions/getRecommendations/requestPayment/notify/publish/assetCache.get are never called", async () => {
    const { runtime, calls } = spyRuntime();
    await handleRequest(
      new Request("http://localhost/?runtimeStatus=1&format=json"),
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
    expect(calls.assetCacheGet).toBe(0);
  });

  it("7. issues no fetch (source-level check)", () => {
    expect(workerSource).not.toMatch(/\bfetch\s*\(\s*['"`]https?:/);
  });

  it("8. no endpoint URL or API key is rendered in the JSON", async () => {
    const runtime = createRuntime({
      PROMOTION_ENDPOINT: "https://secret-endpoint.example/api",
      PROMOTION_API_KEY: "sk_live_should_never_appear",
    });
    const body = await (
      await handleRequest(
        new Request("http://localhost/?runtimeStatus=1&format=json"),
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

  it("no viewer/actor pubkey appears in the JSON", async () => {
    const { runtime } = spyRuntime();
    const body = await (
      await handleRequest(
        new Request(
          `http://localhost/?runtimeStatus=1&format=json&actor=${"a".repeat(64)}`,
        ),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        runtime,
      )
    ).text();
    expect(body).not.toMatch(/[0-9a-f]{64}/i);
  });

  it("the flag alone (no runtime supplied) with format=json falls through to normal routing", async () => {
    const res = await handleRequest(
      new Request("http://localhost/?runtimeStatus=1&format=json"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("the default Worker export serves the JSON end-to-end", async () => {
    const res = await worker.fetch(
      new Request("http://localhost/?runtimeStatus=1&format=json"),
      {},
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const parsed = JSON.parse(await res.text());
    expect(parsed.mode).toBe("local");
  });

  it("does not mutate the request", async () => {
    const url = "http://localhost/?runtimeStatus=1&format=json";
    const req = new Request(url);
    const { runtime } = spyRuntime();
    await handleRequest(req, undefined, undefined, undefined, undefined, undefined, undefined, runtime);
    expect(req.url).toBe(url);
  });
});
