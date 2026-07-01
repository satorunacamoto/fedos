import { describe, it, expect } from "vitest";
import {
  buildRuntimeStatusView,
  renderRuntimeStatusJson,
  serializeRuntimeStatusView,
} from "../src/render/runtime_status.js";
import { createRuntime } from "../src/runtime/create_runtime.js";

describe("serializeRuntimeStatusView", () => {
  it("1. returns the runtime mode", () => {
    const view = buildRuntimeStatusView(createRuntime());
    const json = serializeRuntimeStatusView(view);
    expect(json.mode).toBe("test");
  });

  it("2. returns sections in the fixed category order", () => {
    const view = buildRuntimeStatusView(createRuntime());
    const json = serializeRuntimeStatusView(view);
    expect(json.sections.map((s) => s.category)).toEqual([
      "cache",
      "storage",
      "provider",
      "bridge",
      "security",
    ]);
  });

  it("3. JSON includes every category", () => {
    const view = buildRuntimeStatusView(createRuntime());
    const json = serializeRuntimeStatusView(view);
    for (const category of ["cache", "storage", "provider", "bridge", "security"]) {
      const section = json.sections.find((s) => s.category === category);
      expect(section).toBeDefined();
      expect(section!.components.length).toBeGreaterThan(0);
    }
  });

  it("4. JSON includes component labels (constructor names)", () => {
    const view = buildRuntimeStatusView(createRuntime());
    const json = serializeRuntimeStatusView(view);
    const byName = Object.fromEntries(json.components.map((c) => [c.name, c.label]));
    expect(byName.eventCache).toBe("InMemoryEventCache");
    expect(byName.paymentProvider).toBe("NoopPaymentProvider");
    expect(byName.notificationBridge).toBe("NoopNotificationBridge");
  });

  it("5. no endpoint/API key/env secret anywhere in the JSON", () => {
    const runtime = createRuntime({
      PROMOTION_ENDPOINT: "https://secret-endpoint.example/api",
      PROMOTION_API_KEY: "sk_live_should_never_appear",
      NOTIFICATION_PROVIDER: "placeholder",
    });
    const view = buildRuntimeStatusView(runtime);
    const json = JSON.stringify(serializeRuntimeStatusView(view));
    expect(json).not.toContain("secret-endpoint.example");
    expect(json).not.toContain("sk_live_should_never_appear");
    expect(json).not.toContain("https://");
    expect(json).not.toMatch(/[0-9a-f]{64}/i);
  });

  it("6. no functions/methods in the serialized output", () => {
    const view = buildRuntimeStatusView(createRuntime());
    const json = serializeRuntimeStatusView(view);
    const check = (value: unknown): void => {
      expect(typeof value).not.toBe("function");
      if (Array.isArray(value)) {
        for (const item of value) check(item);
      } else if (value !== null && typeof value === "object") {
        for (const v of Object.values(value)) check(v);
      }
    };
    check(json);
    // Round-trips cleanly through JSON (no functions survive serialization).
    const roundTripped = JSON.parse(JSON.stringify(json));
    expect(roundTripped).toEqual(json);
  });

  it("7. does not mutate the view", () => {
    const view = buildRuntimeStatusView(createRuntime());
    const snap = JSON.stringify(view);
    serializeRuntimeStatusView(view);
    renderRuntimeStatusJson(view);
    expect(JSON.stringify(view)).toBe(snap);
  });

  it("8. renderRuntimeStatusJson returns valid, parseable JSON", () => {
    const view = buildRuntimeStatusView(createRuntime());
    const json = renderRuntimeStatusJson(view);
    expect(typeof json).toBe("string");
    const parsed = JSON.parse(json);
    expect(parsed.mode).toBe("test");
    expect(Array.isArray(parsed.sections)).toBe(true);
    expect(Array.isArray(parsed.components)).toBe(true);
  });

  it("generatedAt is omitted by default and injectable when explicitly passed", () => {
    const view = buildRuntimeStatusView(createRuntime());
    const withoutTimestamp = serializeRuntimeStatusView(view);
    expect(withoutTimestamp.generatedAt).toBeUndefined();
    expect(Object.keys(withoutTimestamp)).not.toContain("generatedAt");

    const withTimestamp = serializeRuntimeStatusView(view, 1_700_000_000_000);
    expect(withTimestamp.generatedAt).toBe(1_700_000_000_000);
  });

  it("reflects env-selected providers (e.g. PlaceholderPaymentProvider)", () => {
    const runtime = createRuntime({ PAYMENT_PROVIDER: "placeholder" });
    const view = buildRuntimeStatusView(runtime);
    const json = serializeRuntimeStatusView(view);
    const payment = json.components.find((c) => c.name === "paymentProvider");
    expect(payment?.label).toBe("PlaceholderPaymentProvider");
  });
});
