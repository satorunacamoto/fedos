import { describe, it, expect } from "vitest";
import {
  buildPromotionPreviewDiagnostic,
  renderPromotionPreviewDiagnostic,
  renderProviderPromotionCandidatePreview,
} from "../src/os/_legacy_prototype/render/promotion.js";
import type { PromotionPreviewDiagnosticView } from "../src/os/_legacy_prototype/render/promotion.js";
import { handleRequest } from "../src/os/_legacy_prototype/worker.js";
import { createRuntime } from "../src/os/_legacy_prototype/runtime/create_runtime.js";
import type { AppRuntime } from "../src/os/_legacy_prototype/runtime/types.js";
import type {
  PromotionCandidate,
  PromotionDecision,
  PromotionRequest,
} from "../src/os/_legacy_prototype/promotion/types.js";
import type { PromotionInvocationDecision } from "../src/os/_legacy_prototype/promotion/invocation.js";
import type { PromotionProvider } from "../src/os/_legacy_prototype/promotion/adapter.js";

const PLACEMENT = { type: "product_sidebar", context: "product", label: "Product sidebar" } as const;

function invocation(overrides: Partial<PromotionInvocationDecision> = {}): PromotionInvocationDecision {
  return { state: "disabled", reason: "generic reason", invokedAt: 1_700_000_000_000, ...overrides };
}

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
    if (this.#shouldThrow) throw new Error("SECRET_STACK_TRACE at endpoint https://real-edge-rec.example/api?key=sk_live_12345");
    return this.#decision ?? { selected: [], reason: "no_candidates", placement: request.placement };
  }
}

function runtimeWith(overrides: Partial<AppRuntime> = {}): AppRuntime {
  return { ...createRuntime(), ...overrides };
}

describe("buildPromotionPreviewDiagnostic / renderPromotionPreviewDiagnostic", () => {
  it("1. disabled env-missing reason is rendered", () => {
    const view = buildPromotionPreviewDiagnostic(invocation({ state: "disabled" }), "env_flag_disabled");
    const html = renderPromotionPreviewDiagnostic(view);
    expect(html).toContain("Provider preview disabled");
    expect(html).toContain("ENABLE_PROMOTION_PROVIDER_PREVIEW");
    expect(html).toContain('data-disabled-reason="env_flag_disabled"');
  });

  it("2. disabled query-missing reason is rendered", () => {
    const view = buildPromotionPreviewDiagnostic(invocation({ state: "disabled" }), "query_flag_missing");
    const html = renderPromotionPreviewDiagnostic(view);
    expect(html).toContain("Provider preview disabled");
    expect(html).toContain("query flag is not present");
    expect(html).toContain('data-disabled-reason="query_flag_missing"');
  });

  it("disabled preview-mode-not-requested is the default reason", () => {
    const view = buildPromotionPreviewDiagnostic(invocation({ state: "mock_preview" }));
    expect(view.kind).toBe("disabled");
    expect(view.disabledReason).toBe("preview_mode_not_requested");
    const html = renderPromotionPreviewDiagnostic(view);
    expect(html).toContain("was not requested");
  });

  it("3. the provider-invoked label is rendered on success", () => {
    const decision: PromotionDecision = { selected: [], reason: "no_candidates", placement: PLACEMENT };
    const view = buildPromotionPreviewDiagnostic(invocation({ state: "provider_preview", decision }));
    expect(view.kind).toBe("provider_preview");
    const html = renderPromotionPreviewDiagnostic(view);
    expect(html).toContain("Provider preview");
    expect(html).toContain("Not a served advertisement");
  });

  it("4. the provider_error label is rendered", () => {
    const view = buildPromotionPreviewDiagnostic(invocation({ state: "provider_error" }));
    expect(view.kind).toBe("provider_error");
    const html = renderPromotionPreviewDiagnostic(view);
    expect(html).toContain("Provider preview unavailable");
    expect(html).toContain('data-state="provider_error"');
  });

  it("5. provider_error never renders a stack trace", () => {
    const view = buildPromotionPreviewDiagnostic(
      invocation({ state: "provider_error", reason: "Error: boom\n  at Object.<anonymous> (/app/x.js:12:3)" }),
    );
    const html = renderPromotionPreviewDiagnostic(view);
    expect(html).not.toContain("at Object.<anonymous>");
    expect(html).not.toContain(".js:");
    expect(html).not.toContain("boom");
  });

  it("6. provider_error never renders an endpoint or API key", () => {
    const view = buildPromotionPreviewDiagnostic(
      invocation({
        state: "provider_error",
        reason: "edge-rec responded 401 at https://real-edge-rec.example/api?key=sk_live_12345",
      }),
    );
    const html = renderPromotionPreviewDiagnostic(view);
    expect(html).not.toContain("real-edge-rec.example");
    expect(html).not.toContain("sk_live_12345");
    expect(html).not.toContain("https://");
  });

  it("14a. does not mutate the invocation decision or view", () => {
    const decision: PromotionDecision = { selected: [], reason: "ok", placement: PLACEMENT };
    const result = invocation({ state: "provider_preview", decision });
    const resultSnap = JSON.stringify(result);
    const view = buildPromotionPreviewDiagnostic(result, "env_flag_disabled");
    const viewSnap = JSON.stringify(view);
    renderPromotionPreviewDiagnostic(view);
    expect(JSON.stringify(result)).toBe(resultSnap);
    expect(JSON.stringify(view)).toBe(viewSnap);
  });
});

describe("candidate rendering (Stage 53 hardening)", () => {
  const candidate: PromotionCandidate = {
    id: "edge-1",
    title: "<b>title</b>",
    description: "<i>desc</i>",
    destination: "https://example.com/should-not-render",
    image: "https://example.com/should-not-render.png",
    sponsor: "<script>x</script>",
    priority: 1,
    weight: 1,
    metadata: { key: "<code>value</code>" },
  };

  it("7. candidate destination is not linked", () => {
    const html = renderProviderPromotionCandidatePreview(candidate);
    expect(html).not.toContain("https://example.com/should-not-render");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("href=");
  });

  it("8. candidate image is not rendered", () => {
    const html = renderProviderPromotionCandidatePreview(candidate);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("should-not-render.png");
  });

  it("9. candidate title/description/sponsor/metadata are escaped and metadata is bounded", () => {
    const html = renderProviderPromotionCandidatePreview(candidate);
    expect(html).not.toContain("<b>title</b>");
    expect(html).toContain("&lt;b&gt;title&lt;/b&gt;");
    expect(html).not.toContain("<i>desc</i>");
    expect(html).toContain("&lt;i&gt;desc&lt;/i&gt;");
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(html).not.toContain("<code>value</code>");
    expect(html).toContain("&lt;code&gt;value&lt;/code&gt;");

    // Bounded: many metadata entries -> only the first N are shown.
    const manyMeta: Record<string, string> = {};
    for (let i = 0; i < 50; i++) manyMeta[`k${i}`] = `v${i}`;
    const manyHtml = renderProviderPromotionCandidatePreview({ ...candidate, metadata: manyMeta });
    const itemCount = (manyHtml.match(/promo-provider-preview-meta-item/g) ?? []).length;
    expect(itemCount).toBeLessThanOrEqual(10);

    // Bounded: an overlong value is truncated.
    const longValue = "x".repeat(5000);
    const longHtml = renderProviderPromotionCandidatePreview({
      ...candidate,
      metadata: { long: longValue },
    });
    expect(longHtml).not.toContain(longValue);
    expect(longHtml.length).toBeLessThan(longValue.length);
  });
});

describe("Stage 53 — provider preview diagnostics wired through the Worker", () => {
  it("10. viewer/actor pubkey is never rendered", async () => {
    const actor = "a".repeat(64);
    const spy = new SpyPromotionProvider();
    const runtime = runtimeWith({ promotionProvider: spy, promotionProviderPreviewAllowed: true });
    const body = await (
      await handleRequest(
        new Request(`http://localhost/?product=guide-pdf&edgeRecPreview=1&actor=${actor}`),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        runtime,
      )
    ).text();
    expect(body).not.toContain(actor);
    expect(spy.calls[0]?.viewerPubkey).toBeUndefined();
  });

  it("11. the mock preview path is unaffected by the diagnostics hardening", async () => {
    const body = await (
      await handleRequest(new Request("http://localhost/?product=guide-pdf&promotionPreview=1"))
    ).text();
    expect(body).toContain("Promotion preview (mock)");
    expect(body).not.toContain("Provider preview disabled");
    expect(body).not.toContain("Provider preview unavailable");
  });

  it("12. the provider is not called when disabled (env flag missing)", async () => {
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
    expect(body).toContain("Provider preview disabled");
    expect(body).toContain('data-disabled-reason="env_flag_disabled"');
  });

  it("13a. the dual flag is still required: query only calls the provider zero times", async () => {
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

  it("13b. the dual flag is still required: env only calls the provider zero times", async () => {
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

  it("13c. both flags together still call the provider exactly once", async () => {
    const spy = new SpyPromotionProvider();
    const runtime = runtimeWith({ promotionProvider: spy, promotionProviderPreviewAllowed: true });
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
    expect(spy.calls.length).toBe(1);
  });

  it("a real provider error renders the sanitized diagnostic, not the raw error", async () => {
    const spy = new SpyPromotionProvider(undefined, true);
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
    expect(body).toContain("Provider preview unavailable");
    expect(body).not.toContain("SECRET_STACK_TRACE");
    expect(body).not.toContain("real-edge-rec.example");
    expect(body).not.toContain("sk_live_12345");
  });

  it("14b. does not mutate the request", async () => {
    const url = "http://localhost/?product=guide-pdf&edgeRecPreview=1&actor=" + "b".repeat(64);
    const req = new Request(url);
    const spy = new SpyPromotionProvider();
    const runtime = runtimeWith({ promotionProvider: spy, promotionProviderPreviewAllowed: true });
    await handleRequest(req, undefined, undefined, undefined, undefined, undefined, undefined, runtime);
    expect(req.url).toBe(url);
  });
});

describe("PromotionPreviewDiagnosticView shape", () => {
  it("only carries decision for provider_preview and only disabledReason for disabled", () => {
    const disabledView: PromotionPreviewDiagnosticView = { kind: "disabled", disabledReason: "env_flag_disabled" };
    const errorView: PromotionPreviewDiagnosticView = { kind: "provider_error" };
    expect(disabledView.decision).toBeUndefined();
    expect(errorView.disabledReason).toBeUndefined();
  });
});
