import { describe, it, expect } from "vitest";
import { invokePromotionProviderPreview } from "../src/os/_legacy_prototype/promotion/invocation.js";
import type {
  PromotionInvocationOptions,
} from "../src/os/_legacy_prototype/promotion/invocation.js";
import { MockPromotionProvider } from "../src/os/_legacy_prototype/promotion/adapter.js";
import type { PromotionProvider } from "../src/os/_legacy_prototype/promotion/adapter.js";
import { renderMockPromotionPreview, renderPromotionDecisionPreview } from "../src/os/_legacy_prototype/render/promotion.js";
import { buildPromotionRequest, resolvePlacement } from "../src/os/_legacy_prototype/promotion/policy.js";
import type { PromotionDecision, PromotionRequest } from "../src/os/_legacy_prototype/promotion/types.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import invocationSource from "../src/os/_legacy_prototype/promotion/invocation.ts?raw";

function request(overrides: Partial<PromotionRequest> = {}): PromotionRequest {
  return buildPromotionRequest(resolvePlacement("product_sidebar"), overrides);
}

/** A provider that records every call and can be scripted to succeed/throw. */
class SpyProvider implements PromotionProvider {
  calls: PromotionRequest[] = [];
  #result: PromotionDecision | (() => PromotionDecision);
  #shouldThrow: boolean;

  constructor(
    result: PromotionDecision | (() => PromotionDecision) = {
      selected: [],
      reason: "no_candidates",
      placement: resolvePlacement("product_sidebar"),
    },
    shouldThrow = false,
  ) {
    this.#result = result;
    this.#shouldThrow = shouldThrow;
  }

  async getPromotions(req: PromotionRequest): Promise<PromotionDecision> {
    this.calls.push(req);
    if (this.#shouldThrow) throw new Error("simulated provider failure");
    return typeof this.#result === "function" ? this.#result() : this.#result;
  }
}

const CANDIDATE = {
  id: "edge-1",
  title: "Edge candidate",
  destination: "https://example.com/should-not-render",
  image: "https://example.com/should-not-render.png",
  sponsor: "acme",
  priority: 1,
  weight: 1,
  metadata: {},
};

describe("invokePromotionProviderPreview", () => {
  it("1. allowRealProvider=false does not call the provider", async () => {
    const spy = new SpyProvider();
    const result = await invokePromotionProviderPreview(spy, request(), {
      allowRealProvider: false,
      mode: "provider_preview",
    });
    expect(spy.calls.length).toBe(0);
    expect(result.state).toBe("disabled");
    expect(result.decision).toBeUndefined();
  });

  it("2. mode=disabled does not call the provider (even with allowRealProvider=true)", async () => {
    const spy = new SpyProvider();
    const result = await invokePromotionProviderPreview(spy, request(), {
      allowRealProvider: true,
      mode: "disabled",
    });
    expect(spy.calls.length).toBe(0);
    expect(result.state).toBe("disabled");
  });

  it("mode=mock_preview does not call the provider (label only)", async () => {
    const spy = new SpyProvider();
    const result = await invokePromotionProviderPreview(spy, request(), {
      allowRealProvider: true,
      mode: "mock_preview",
    });
    expect(spy.calls.length).toBe(0);
    expect(result.state).toBe("mock_preview");
  });

  it("3. provider_preview + allowRealProvider=true calls the provider exactly once", async () => {
    const spy = new SpyProvider({
      selected: [CANDIDATE],
      reason: "ok",
      placement: resolvePlacement("product_sidebar"),
    });
    const req = request();
    const result = await invokePromotionProviderPreview(spy, req, {
      allowRealProvider: true,
      mode: "provider_preview",
    });
    expect(spy.calls.length).toBe(1);
    expect(spy.calls[0]).toBe(req);
    expect(result.state).toBe("provider_preview");
  });

  it("4. a provider error returns a provider_error decision (never throws)", async () => {
    const spy = new SpyProvider(undefined, true);
    let errorMessage: string | undefined;
    const result = await invokePromotionProviderPreview(spy, request(), {
      allowRealProvider: true,
      mode: "provider_preview",
      onError: (msg) => {
        errorMessage = msg;
      },
    });
    expect(result.state).toBe("provider_error");
    expect(result.decision).toBeUndefined();
    expect(errorMessage).toMatch(/simulated provider failure/);
  });

  it("5. the decision's selected candidates are returned on success", async () => {
    const spy = new SpyProvider({
      selected: [CANDIDATE],
      reason: "ok",
      placement: resolvePlacement("product_sidebar"),
    });
    const result = await invokePromotionProviderPreview(spy, request(), {
      allowRealProvider: true,
      mode: "provider_preview",
    });
    expect(result.decision?.selected).toEqual([CANDIDATE]);
    expect(result.decision?.reason).toBe("ok");
  });

  it("6. destination URL / image are not surfaced by the preview renderer", async () => {
    const spy = new SpyProvider({
      selected: [CANDIDATE],
      reason: "ok",
      placement: resolvePlacement("product_sidebar"),
    });
    const result = await invokePromotionProviderPreview(spy, request(), {
      allowRealProvider: true,
      mode: "provider_preview",
    });
    expect(result.decision).toBeDefined();
    const html = renderPromotionDecisionPreview(result.decision!);
    expect(html).not.toContain("https://example.com/should-not-render");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<a ");
  });

  it("7. does not mutate the request or options", async () => {
    const spy = new SpyProvider({
      selected: [CANDIDATE],
      reason: "ok",
      placement: resolvePlacement("product_sidebar"),
    });
    const req = request();
    const options: PromotionInvocationOptions = {
      allowRealProvider: true,
      mode: "provider_preview",
      now: 1_700_000_000_000,
    };
    const reqSnap = JSON.stringify(req);
    const optionsSnap = JSON.stringify(options);
    await invokePromotionProviderPreview(spy, req, options);
    expect(JSON.stringify(req)).toBe(reqSnap);
    expect(JSON.stringify(options)).toBe(optionsSnap);
  });

  it("8. the invocation decision carries no click/impression/billing fields", async () => {
    const spy = new SpyProvider({
      selected: [CANDIDATE],
      reason: "ok",
      placement: resolvePlacement("product_sidebar"),
    });
    const result = await invokePromotionProviderPreview(spy, request(), {
      allowRealProvider: true,
      mode: "provider_preview",
    });
    const keys = Object.keys(result);
    for (const banned of ["click", "impression", "billing", "cpc", "cpm", "auction", "rank"]) {
      expect(keys.some((k) => k.toLowerCase().includes(banned))).toBe(false);
    }
  });

  it("9. no fetch happens unless the injected provider itself is invoked", async () => {
    let fetchCalls = 0;
    class FakeNetworkProvider implements PromotionProvider {
      async getPromotions(req: PromotionRequest): Promise<PromotionDecision> {
        fetchCalls += 1; // stands in for a real network call inside a real adapter
        return { selected: [], reason: "no_candidates", placement: req.placement };
      }
    }
    const provider = new FakeNetworkProvider();
    // Disabled path: never touches the "network".
    await invokePromotionProviderPreview(provider, request(), {
      allowRealProvider: false,
      mode: "provider_preview",
    });
    expect(fetchCalls).toBe(0);
    // Explicit provider_preview + allow=true: the injected provider IS invoked.
    await invokePromotionProviderPreview(provider, request(), {
      allowRealProvider: true,
      mode: "provider_preview",
    });
    expect(fetchCalls).toBe(1);
  });

  it("10. the existing mock preview path is unchanged", async () => {
    const html = await renderMockPromotionPreview(request(), new MockPromotionProvider());
    expect(html).toContain("promo-preview-tag");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("<img");
  });
});

describe("EdgeRec invocation boundary", () => {
  it("Worker source invokes invokePromotionProviderPreview only from the dual-flag-gated helper (Stage 52)", () => {
    // Stage 52: the Worker legitimately imports/calls this now, but ONLY from
    // renderProviderPromotionPreview, and ONLY behind the env+query dual flag.
    // The invariant is that it is never called unconditionally/directly.
    const calls = workerSource.match(/invokePromotionProviderPreview\s*\(/g) ?? [];
    expect(calls.length).toBe(1);
    expect(workerSource).toMatch(/allowRealProvider:\s*true/);
    expect(workerSource).toMatch(/mode:\s*["']provider_preview["']/);
  });

  it("Runtime source does not import or call invokePromotionProviderPreview", () => {
    expect(runtimeSource).not.toMatch(/invokePromotionProviderPreview/);
  });

  it("the invocation module issues no fetch of its own", () => {
    expect(invocationSource).not.toMatch(/\bfetch\s*\(/);
    const importLines = invocationSource
      .split("\n")
      .filter((line: string) => /^\s*import\b/.test(line));
    for (const line of importLines) {
      expect(line).not.toMatch(/HTMLRewriter|Stripe|Telegram/i);
    }
  });
});
