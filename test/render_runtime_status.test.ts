import { describe, it, expect } from "vitest";
import {
  buildRuntimeStatusView,
  renderRuntimeComponentStatus,
  renderRuntimeStatusPage,
} from "../src/render/runtime_status.js";
import type { RuntimeStatusView } from "../src/render/runtime_status.js";
import { createRuntime } from "../src/runtime/create_runtime.js";

describe("buildRuntimeStatusView", () => {
  it("1. builds a view from a real runtime", () => {
    const runtime = createRuntime();
    const view = buildRuntimeStatusView(runtime);
    expect(view.mode).toBe("test");
    expect(view.components.length).toBe(10);
    const names = view.components.map((c) => c.name);
    expect(names).toEqual([
      "eventCache",
      "assetCache",
      "spaceDirectory",
      "metadataIndex",
      "signatureVerifier",
      "promotionProvider",
      "recommendationProvider",
      "relayPublisher",
      "notificationBridge",
      "paymentProvider",
    ]);
  });

  it("labels each component with a coarse type (constructor name or safe fallback)", () => {
    const runtime = createRuntime();
    const view = buildRuntimeStatusView(runtime);
    const byName = Object.fromEntries(view.components.map((c) => [c.name, c.label]));
    expect(byName.eventCache).toBe("InMemoryEventCache");
    expect(byName.assetCache).toBe("InMemoryAssetCache");
    expect(byName.notificationBridge).toBe("NoopNotificationBridge");
    expect(byName.paymentProvider).toBe("NoopPaymentProvider");
    // signatureVerifier is a plain object literal (not a class) -> safe fallback.
    expect(byName.signatureVerifier).toBe("(unnamed implementation)");
  });

  it("reflects env-selected providers (e.g. PlaceholderPaymentProvider)", () => {
    const runtime = createRuntime({ PAYMENT_PROVIDER: "placeholder" });
    const view = buildRuntimeStatusView(runtime);
    const payment = view.components.find((c) => c.name === "paymentProvider");
    expect(payment?.label).toBe("PlaceholderPaymentProvider");
  });

  it("does not mutate the runtime", () => {
    const runtime = createRuntime();
    const snap = JSON.stringify(Object.keys(runtime));
    buildRuntimeStatusView(runtime);
    expect(JSON.stringify(Object.keys(runtime))).toBe(snap);
  });
});

describe("renderRuntimeComponentStatus / renderRuntimeStatusPage", () => {
  it("2. the page renders the runtime mode", () => {
    const runtime = createRuntime();
    const html = renderRuntimeStatusPage(buildRuntimeStatusView(runtime));
    expect(html).toContain("Runtime status");
    expect(html).toContain("mode: <code>test</code>");
  });

  it("3. the page lists every provider/cache label", () => {
    const runtime = createRuntime();
    const html = renderRuntimeStatusPage(buildRuntimeStatusView(runtime));
    expect(html).toContain("InMemoryEventCache");
    expect(html).toContain("InMemoryAssetCache");
    expect(html).toContain("NoopNotificationBridge");
    expect(html).toContain("NoopPaymentProvider");
    expect(html).toContain("MockPromotionProvider");
  });

  it("4. escapes a malicious component label", () => {
    const view: RuntimeStatusView = {
      mode: "test",
      components: [{ name: '"><script>evil</script>', label: "<b>Fake</b>" }],
    };
    const html = renderRuntimeStatusPage(view);
    expect(html).not.toContain("<script>evil</script>");
    expect(html).toContain("&lt;script&gt;evil&lt;/script&gt;");
    expect(html).not.toContain("<b>Fake</b>");
    expect(html).toContain("&lt;b&gt;Fake&lt;/b&gt;");
  });

  it("5. never exposes an endpoint URL, API key, or env secret", () => {
    const runtime = createRuntime({
      PROMOTION_ENDPOINT: "https://secret-endpoint.example/api",
      PROMOTION_API_KEY: "sk_live_should_never_appear",
      NOTIFICATION_PROVIDER: "placeholder",
    });
    const html = renderRuntimeStatusPage(buildRuntimeStatusView(runtime));
    expect(html).not.toContain("secret-endpoint.example");
    expect(html).not.toContain("sk_live_should_never_appear");
    expect(html).not.toContain("https://");
    expect(html).not.toContain("http://");
  });

  it("6. does not mutate the view", () => {
    const runtime = createRuntime();
    const view = buildRuntimeStatusView(runtime);
    const snap = JSON.stringify(view);
    renderRuntimeStatusPage(view);
    renderRuntimeComponentStatus(view.components[0]!);
    expect(JSON.stringify(view)).toBe(snap);
  });

  it("renders no viewer/actor pubkey", () => {
    const runtime = createRuntime();
    const html = renderRuntimeStatusPage(buildRuntimeStatusView(runtime));
    expect(html).not.toMatch(/[0-9a-f]{64}/i);
  });
});
