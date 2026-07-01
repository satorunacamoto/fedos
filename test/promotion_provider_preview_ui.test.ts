import { describe, it, expect } from "vitest";
import { handleRequest } from "../src/worker.js";
import { createRuntime } from "../src/runtime/create_runtime.js";
import type { AppRuntime } from "../src/runtime/types.js";
import type { PromotionDecision, PromotionRequest } from "../src/promotion/types.js";
import type { PromotionProvider } from "../src/promotion/adapter.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

const CANDIDATE = {
  id: "edge-1",
  title: "Edge candidate <b>title</b>",
  description: "Edge description <i>desc</i>",
  destination: "https://example.com/should-not-render",
  image: "https://example.com/should-not-render.png",
  sponsor: "acme <script>x</script>",
  priority: 1,
  weight: 1,
  metadata: { source: "<code>edge</code>" },
};

/** A PromotionProvider that records every call and can be scripted to succeed/throw. */
class SpyPromotionProvider implements PromotionProvider {
  calls: PromotionRequest[] = [];
  #decision: PromotionDecision | undefined;
  #shouldThrow: boolean;

  constructor(decision?: PromotionDecision, shouldThrow = false) {
    this.#decision = decision;
    this.#shouldThrow = shouldThrow;
  }

  async getPromotions(request: PromotionRequest): Promise<PromotionDecision> {
    this.calls.push(request);
    if (this.#shouldThrow) throw new Error("simulated provider failure");
    return (
      this.#decision ?? { selected: [], reason: "no_candidates", placement: request.placement }
    );
  }
}

function runtimeWith(overrides: Partial<AppRuntime> = {}): AppRuntime {
  return { ...createRuntime(), ...overrides };
}

describe("Stage 52 — promotion provider preview, dual-flag gated", () => {
  it("1. query flag only (no env flag) does not call the provider", async () => {
    const spy = new SpyPromotionProvider();
    const runtime = runtimeWith({ promotionProvider: spy, promotionProviderPreviewAllowed: false });
    await handleRequest(
      new Request("http://localhost/?product=guide-pdf&edgeRecPreview=1"),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      runtime,
    );
    expect(spy.calls.length).toBe(0);
  });

  it("2. env flag only (no query flag) does not call the provider", async () => {
    const spy = new SpyPromotionProvider();
    const runtime = runtimeWith({ promotionProvider: spy, promotionProviderPreviewAllowed: true });
    await handleRequest(
      new Request("http://localhost/?product=guide-pdf"),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      runtime,
    );
    expect(spy.calls.length).toBe(0);
  });

  it("3. env + query calls the provider exactly once on the space route", async () => {
    const spy = new SpyPromotionProvider();
    const runtime = runtimeWith({ promotionProvider: spy, promotionProviderPreviewAllowed: true });
    await handleRequest(
      new Request("http://localhost/?space=general&edgeRecPreview=1"),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      runtime,
    );
    expect(spy.calls.length).toBe(1);
  });

  it("4. env + query calls the provider exactly once on the product route", async () => {
    const spy = new SpyPromotionProvider();
    const runtime = runtimeWith({ promotionProvider: spy, promotionProviderPreviewAllowed: true });
    await handleRequest(
      new Request("http://localhost/?product=guide-pdf&providerPromotionPreview=1"),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      runtime,
    );
    expect(spy.calls.length).toBe(1);
  });

  it("5. the board (no-param) route never calls the provider", async () => {
    const spy = new SpyPromotionProvider();
    const runtime = runtimeWith({ promotionProvider: spy, promotionProviderPreviewAllowed: true });
    await handleRequest(
      new Request("http://localhost/?edgeRecPreview=1"),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      runtime,
    );
    expect(spy.calls.length).toBe(0);
  });

  it("6. the chat route never calls the provider", async () => {
    const spy = new SpyPromotionProvider();
    const runtime = runtimeWith({ promotionProvider: spy, promotionProviderPreviewAllowed: true });
    await handleRequest(
      new Request("http://localhost/?chat=lounge-chat&edgeRecPreview=1"),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      runtime,
    );
    expect(spy.calls.length).toBe(0);
  });

  it("7. ?promotionPreview=1 still uses the mock preview path only", async () => {
    const spy = new SpyPromotionProvider();
    const runtime = runtimeWith({ promotionProvider: spy, promotionProviderPreviewAllowed: true });
    const body = await (
      await handleRequest(
        new Request("http://localhost/?product=guide-pdf&promotionPreview=1"),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        runtime,
      )
    ).text();
    expect(spy.calls.length).toBe(0);
    expect(body).toContain("Promotion preview (mock)");
  });

  it("8. a provider error renders a provider_error preview (never throws)", async () => {
    const spy = new SpyPromotionProvider(undefined, true);
    const runtime = runtimeWith({ promotionProvider: spy, promotionProviderPreviewAllowed: true });
    const res = await handleRequest(
      new Request("http://localhost/?product=guide-pdf&edgeRecPreview=1"),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      runtime,
    );
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toContain("provider_error");
  });

  it("9. no destination link/image/tracking/billing text renders", async () => {
    const spy = new SpyPromotionProvider({
      selected: [CANDIDATE],
      reason: "ok",
      placement: { type: "product_sidebar", context: "product", label: "Product sidebar" },
    });
    const runtime = runtimeWith({ promotionProvider: spy, promotionProviderPreviewAllowed: true });
    const body = await (
      await handleRequest(
        new Request("http://localhost/?product=guide-pdf&edgeRecPreview=1"),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        runtime,
      )
    ).text();
    expect(body).not.toContain("https://example.com/should-not-render");
    expect(body).not.toContain("<img");
    // Scope the link/tracking-attribute check to the provider-preview block
    // itself (the page's unrelated "← back" link is out of scope here).
    const providerBlock = body.match(/<aside class="promotion-provider-preview[\s\S]*?<\/aside>/)?.[0];
    expect(providerBlock).toBeDefined();
    expect(providerBlock).not.toContain("<a ");
    expect(providerBlock).not.toContain("href=");
    expect(providerBlock).not.toContain("onclick");
    expect(providerBlock).not.toContain("data-track");
    // The disclaimer legitimately uses these words in a NEGATED sentence
    // ("no click/impression tracking... occurs here") — assert that framing,
    // not a blanket ban on the words themselves.
    expect(body.toLowerCase()).toContain("no click/impression tracking, ranking, auction, or billing occurs here");
  });

  it("10. candidate fields are HTML-escaped", async () => {
    const spy = new SpyPromotionProvider({
      selected: [CANDIDATE],
      reason: "ok",
      placement: { type: "product_sidebar", context: "product", label: "Product sidebar" },
    });
    const runtime = runtimeWith({ promotionProvider: spy, promotionProviderPreviewAllowed: true });
    const body = await (
      await handleRequest(
        new Request("http://localhost/?product=guide-pdf&edgeRecPreview=1"),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        runtime,
      )
    ).text();
    expect(body).not.toContain("<b>title</b>");
    expect(body).toContain("&lt;b&gt;title&lt;/b&gt;");
    expect(body).not.toContain("<script>x</script>");
    expect(body).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(body).not.toContain("<code>edge</code>");
    expect(body).toContain("&lt;code&gt;edge&lt;/code&gt;");
  });

  it("11. the actor/viewer pubkey is never sent to the provider", async () => {
    const spy = new SpyPromotionProvider();
    const runtime = runtimeWith({ promotionProvider: spy, promotionProviderPreviewAllowed: true });
    const actor = "a".repeat(64);
    await handleRequest(
      new Request(`http://localhost/?product=guide-pdf&edgeRecPreview=1&actor=${actor}`),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      runtime,
    );
    expect(spy.calls.length).toBe(1);
    expect(spy.calls[0]?.viewerPubkey).toBeUndefined();
  });

  it("12. the disabled explanation (query only, no env flag) is escaped-safe and non-committal", async () => {
    const spy = new SpyPromotionProvider();
    const runtime = runtimeWith({ promotionProvider: spy, promotionProviderPreviewAllowed: false });
    const body = await (
      await handleRequest(
        new Request("http://localhost/?product=guide-pdf&edgeRecPreview=1"),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        runtime,
      )
    ).text();
    expect(spy.calls.length).toBe(0);
    expect(body).toContain("disabled");
    expect(body).not.toContain("<script>");
  });

  it("13. no fetch is issued unless the injected provider itself performs one", async () => {
    let fetchCalls = 0;
    class FakeNetworkProvider implements PromotionProvider {
      async getPromotions(request: PromotionRequest): Promise<PromotionDecision> {
        fetchCalls += 1; // stands in for a real network call inside a real adapter
        return { selected: [], reason: "no_candidates", placement: request.placement };
      }
    }
    const provider = new FakeNetworkProvider();
    const disabledRuntime = runtimeWith({
      promotionProvider: provider,
      promotionProviderPreviewAllowed: false,
    });
    await handleRequest(
      new Request("http://localhost/?product=guide-pdf&edgeRecPreview=1"),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      disabledRuntime,
    );
    expect(fetchCalls).toBe(0);

    const allowedRuntime = runtimeWith({
      promotionProvider: provider,
      promotionProviderPreviewAllowed: true,
    });
    await handleRequest(
      new Request("http://localhost/?product=guide-pdf&edgeRecPreview=1"),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      allowedRuntime,
    );
    expect(fetchCalls).toBe(1);
  });

  it("14. does not mutate the request", async () => {
    const url =
      "http://localhost/?product=guide-pdf&edgeRecPreview=1&actor=" + "b".repeat(64);
    const req = new Request(url);
    const spy = new SpyPromotionProvider();
    const runtime = runtimeWith({ promotionProvider: spy, promotionProviderPreviewAllowed: true });
    await handleRequest(req, undefined, undefined, undefined, undefined, undefined, undefined, runtime);
    expect(req.url).toBe(url);
  });
});

describe("Worker source: dual-flag gate stays intact", () => {
  it("invokePromotionProviderPreview is called from exactly one gated helper", () => {
    const calls = workerSource.match(/invokePromotionProviderPreview\s*\(/g) ?? [];
    expect(calls.length).toBe(1);
  });

  it("no unconditional/default-true real-provider invocation exists", () => {
    expect(workerSource).not.toMatch(/allowRealProvider:\s*true[^}]*mode:\s*["']disabled["']/);
  });
});
