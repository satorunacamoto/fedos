import { describe, it, expect } from "vitest";
import {
  buildRuntimeStatusView,
  renderRuntimeComponentStatus,
  renderRuntimeStatusPage,
  renderRuntimeStatusSection,
} from "../src/os/_legacy_prototype/render/runtime_status.js";
import type { RuntimeStatusView } from "../src/os/_legacy_prototype/render/runtime_status.js";
import { createRuntime } from "../src/os/_legacy_prototype/runtime/create_runtime.js";
import type { AssetCache, AssetKey, CachedAsset } from "../src/os/_legacy_prototype/asset/types.js";
import type { PaymentDecision, PaymentProvider, PaymentRequest } from "../src/os/commerce/payment/types.js";

describe("buildRuntimeStatusView", () => {
  it("builds a view from a real runtime (flat components, backward compatible)", () => {
    const runtime = createRuntime();
    const view = buildRuntimeStatusView(runtime);
    expect(view.mode).toBe("test");
    expect(view.components.length).toBe(12);
    const names = view.components.map((c) => c.name);
    expect(names).toEqual([
      "eventCache",
      "assetCache",
      "spaceDirectory",
      "metadataIndex",
      "signatureVerifier",
      "webAuthnProvider",
      "cryptoProvider",
      "promotionProvider",
      "recommendationProvider",
      "paymentProvider",
      "relayPublisher",
      "notificationBridge",
    ]);
  });

  it("1. builds categorized sections in a fixed order", () => {
    const runtime = createRuntime();
    const view = buildRuntimeStatusView(runtime);
    expect(view.sections.map((s) => s.category)).toEqual([
      "cache",
      "storage",
      "provider",
      "bridge",
      "security",
    ]);
  });

  it("2. the cache section contains eventCache/assetCache", () => {
    const view = buildRuntimeStatusView(createRuntime());
    const cache = view.sections.find((s) => s.category === "cache")!;
    expect(cache.components.map((c) => c.name)).toEqual(["eventCache", "assetCache"]);
  });

  it("3. the storage section contains spaceDirectory/metadataIndex", () => {
    const view = buildRuntimeStatusView(createRuntime());
    const storage = view.sections.find((s) => s.category === "storage")!;
    expect(storage.components.map((c) => c.name)).toEqual(["spaceDirectory", "metadataIndex"]);
  });

  it("4. the provider section contains promotion/recommendation/payment providers", () => {
    const view = buildRuntimeStatusView(createRuntime());
    const provider = view.sections.find((s) => s.category === "provider")!;
    expect(provider.components.map((c) => c.name)).toEqual([
      "promotionProvider",
      "recommendationProvider",
      "paymentProvider",
    ]);
  });

  it("5. the bridge section contains relayPublisher/notificationBridge", () => {
    const view = buildRuntimeStatusView(createRuntime());
    const bridge = view.sections.find((s) => s.category === "bridge")!;
    expect(bridge.components.map((c) => c.name)).toEqual(["relayPublisher", "notificationBridge"]);
  });

  it("6. the security section contains signatureVerifier/webAuthnProvider/cryptoProvider", () => {
    const view = buildRuntimeStatusView(createRuntime());
    const security = view.sections.find((s) => s.category === "security")!;
    expect(security.components.map((c) => c.name)).toEqual([
      "signatureVerifier",
      "webAuthnProvider",
      "cryptoProvider",
    ]);
  });

  it("every component carries its category", () => {
    const view = buildRuntimeStatusView(createRuntime());
    const byName = Object.fromEntries(view.components.map((c) => [c.name, c.category]));
    expect(byName.eventCache).toBe("cache");
    expect(byName.assetCache).toBe("cache");
    expect(byName.spaceDirectory).toBe("storage");
    expect(byName.metadataIndex).toBe("storage");
    expect(byName.signatureVerifier).toBe("security");
    expect(byName.webAuthnProvider).toBe("security");
    expect(byName.cryptoProvider).toBe("security");
    expect(byName.promotionProvider).toBe("provider");
    expect(byName.recommendationProvider).toBe("provider");
    expect(byName.paymentProvider).toBe("provider");
    expect(byName.relayPublisher).toBe("bridge");
    expect(byName.notificationBridge).toBe("bridge");
  });

  it("labels each component with a coarse type (constructor name or safe fallback)", () => {
    const runtime = createRuntime();
    const view = buildRuntimeStatusView(runtime);
    const byName = Object.fromEntries(view.components.map((c) => [c.name, c.label]));
    expect(byName.eventCache).toBe("InMemoryEventCache");
    expect(byName.assetCache).toBe("InMemoryAssetCache");
    expect(byName.notificationBridge).toBe("NoopNotificationBridge");
    expect(byName.paymentProvider).toBe("NoopPaymentProvider");
    expect(byName.webAuthnProvider).toBe("NoopWebAuthnProvider");
    expect(byName.cryptoProvider).toBe("NoopCryptoProvider");
    // signatureVerifier is a plain object literal (not a class) -> safe fallback.
    expect(byName.signatureVerifier).toBe("(unnamed implementation)");
  });

  it("reflects env-selected providers (e.g. PlaceholderPaymentProvider)", () => {
    const runtime = createRuntime({ PAYMENT_PROVIDER: "placeholder" });
    const view = buildRuntimeStatusView(runtime);
    const payment = view.components.find((c) => c.name === "paymentProvider");
    expect(payment?.label).toBe("PlaceholderPaymentProvider");
  });

  it("11. does not mutate the runtime and never calls a component method", () => {
    const calls: string[] = [];
    const runtime = createRuntime();
    const spiedAssetCache: AssetCache = {
      async get(key: AssetKey, now: number): Promise<CachedAsset | undefined> {
        calls.push("get");
        return runtime.assetCache.get(key, now);
      },
      async put(asset) {
        calls.push("put");
        return runtime.assetCache.put(asset);
      },
      async has(key, now) {
        calls.push("has");
        return runtime.assetCache.has(key, now);
      },
      async delete(key) {
        calls.push("delete");
        return runtime.assetCache.delete(key);
      },
      async clear() {
        calls.push("clear");
        return runtime.assetCache.clear();
      },
    };
    const snap = JSON.stringify(Object.keys(runtime));
    buildRuntimeStatusView({ ...runtime, assetCache: spiedAssetCache });
    expect(JSON.stringify(Object.keys(runtime))).toBe(snap);
    // Only a property READ (constructor.name), never a method CALL.
    expect(calls).toEqual([]);
  });
});

describe("renderRuntimeComponentStatus / renderRuntimeStatusSection / renderRuntimeStatusPage", () => {
  it("the page renders the runtime mode", () => {
    const runtime = createRuntime();
    const html = renderRuntimeStatusPage(buildRuntimeStatusView(runtime));
    expect(html).toContain("Runtime status");
    expect(html).toContain("mode: <code>test</code>");
  });

  it("the page lists every provider/cache label", () => {
    const runtime = createRuntime();
    const html = renderRuntimeStatusPage(buildRuntimeStatusView(runtime));
    expect(html).toContain("InMemoryEventCache");
    expect(html).toContain("InMemoryAssetCache");
    expect(html).toContain("NoopNotificationBridge");
    expect(html).toContain("NoopPaymentProvider");
    expect(html).toContain("MockPromotionProvider");
  });

  it("7. renders a heading for every section/category", () => {
    const html = renderRuntimeStatusPage(buildRuntimeStatusView(createRuntime()));
    for (const heading of ["Cache", "Storage", "Provider", "Bridge", "Security"]) {
      expect(html).toContain(`>${heading}<`);
    }
  });

  it("8. escapes category, name, and label", () => {
    const html = renderRuntimeStatusSection({
      category: "cache",
      components: [
        {
          name: '"><script>name</script>',
          label: "<b>label</b>",
          category: "cache",
        },
      ],
    });
    expect(html).not.toContain("<script>name</script>");
    expect(html).toContain("&lt;script&gt;name&lt;/script&gt;");
    expect(html).not.toContain("<b>label</b>");
    expect(html).toContain("&lt;b&gt;label&lt;/b&gt;");
  });

  it("escapes a malicious category on the section itself", () => {
    const html = renderRuntimeStatusSection({
      // @ts-expect-error deliberately testing an unexpected/malicious category value
      category: '"><script>cat</script>',
      components: [],
    });
    expect(html).not.toContain("<script>cat</script>");
    expect(html).toContain("&lt;script&gt;cat&lt;/script&gt;");
  });

  it("escapes a malicious component label on the page", () => {
    const view: RuntimeStatusView = {
      mode: "test",
      components: [{ name: '"><script>evil</script>', label: "<b>Fake</b>", category: "cache" }],
      sections: [
        {
          category: "cache",
          components: [
            { name: '"><script>evil</script>', label: "<b>Fake</b>", category: "cache" },
          ],
        },
      ],
    };
    const html = renderRuntimeStatusPage(view);
    expect(html).not.toContain("<script>evil</script>");
    expect(html).toContain("&lt;script&gt;evil&lt;/script&gt;");
    expect(html).not.toContain("<b>Fake</b>");
    expect(html).toContain("&lt;b&gt;Fake&lt;/b&gt;");
  });

  it("9. never exposes an endpoint URL, API key, or env secret", () => {
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

  it("10. does not call any component method while rendering", () => {
    const calls: string[] = [];
    const runtime = createRuntime();
    const spiedPayment: PaymentProvider = {
      getStatus() {
        calls.push("getStatus");
        return runtime.paymentProvider.getStatus();
      },
      getCapabilities() {
        calls.push("getCapabilities");
        return runtime.paymentProvider.getCapabilities();
      },
      async requestPayment(request: PaymentRequest): Promise<PaymentDecision> {
        calls.push("requestPayment");
        return runtime.paymentProvider.requestPayment(request);
      },
      observePayment(paymentId: string) {
        calls.push("observePayment");
        return runtime.paymentProvider.observePayment(paymentId);
      },
      ingestCallback(payload: unknown) {
        calls.push("ingestCallback");
        return runtime.paymentProvider.ingestCallback(payload);
      },
    };
    const view = buildRuntimeStatusView({ ...runtime, paymentProvider: spiedPayment });
    renderRuntimeStatusPage(view);
    expect(calls).toEqual([]);
  });

  it("does not mutate the view", () => {
    const runtime = createRuntime();
    const view = buildRuntimeStatusView(runtime);
    const snap = JSON.stringify(view);
    renderRuntimeStatusPage(view);
    renderRuntimeComponentStatus(view.components[0]!);
    renderRuntimeStatusSection(view.sections[0]!);
    expect(JSON.stringify(view)).toBe(snap);
  });

  it("renders no viewer/actor pubkey", () => {
    const runtime = createRuntime();
    const html = renderRuntimeStatusPage(buildRuntimeStatusView(runtime));
    expect(html).not.toMatch(/[0-9a-f]{64}/i);
  });
});
