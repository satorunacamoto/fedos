import { describe, it, expect } from "vitest";
import {
  NoopHealthCheckProvider,
  DisabledHealthCheckProvider,
  canRunHealthCheck,
} from "../src/runtime/health_check.js";
import type { HealthCheckTarget } from "../src/runtime/health_check.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import healthCheckSource from "../src/runtime/health_check.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

function target(overrides: Partial<HealthCheckTarget> = {}): HealthCheckTarget {
  return {
    kind: "promotion_provider",
    label: "EdgeRec promotion provider",
    ...overrides,
  };
}

describe("NoopHealthCheckProvider", () => {
  it("1. is always disabled", async () => {
    const provider = new NoopHealthCheckProvider();
    expect(provider.getStatus()).toEqual({
      available: false,
      reason: "no health check backend is configured",
    });
    const decision = await provider.check(target());
    expect(decision.status).toBe("disabled");
  });

  it("2. check() issues no fetch", async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (() => {
      fetchCalls += 1;
      return Promise.reject(new Error("should not be called"));
    }) as typeof fetch;
    try {
      await new NoopHealthCheckProvider().check(target());
      await new DisabledHealthCheckProvider().check(target());
      canRunHealthCheck(target(), { enabled: true });
      expect(fetchCalls).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("3. check() calls no provider method (nothing to spy on — target carries no provider reference)", async () => {
    // The target is plain data; there is no provider object passed in at all,
    // so there is nothing this call could invoke beyond its own no-op logic.
    const t = target();
    const before = JSON.stringify(t);
    await new NoopHealthCheckProvider().check(t);
    expect(JSON.stringify(t)).toBe(before);
  });

  it("4. endpointRef is opaque only and never echoed in the decision", async () => {
    const t = target({ endpointRef: "https://real-edge-rec.example/api?key=sk_live_12345" });
    const decision = await new NoopHealthCheckProvider().check(t);
    const json = JSON.stringify(decision);
    expect(json).not.toContain("real-edge-rec.example");
    expect(json).not.toContain("sk_live_12345");
    expect(json).not.toContain("https://");
    // Only the label is echoed, never endpointRef.
    expect(decision.targetLabel).toBe(t.label);
  });

  it("5. no API key/token fields exist on the target or the decision", async () => {
    const t = target({ endpointRef: "edge-rec (configured)" });
    const decision = await new NoopHealthCheckProvider().check(t, { now: 1000 });
    for (const key of Object.keys(t)) {
      expect(key.toLowerCase()).not.toMatch(/key|token|secret|password/);
    }
    for (const key of Object.keys(decision)) {
      expect(key.toLowerCase()).not.toMatch(/key|token|secret|password/);
    }
  });

  it("6. checkedAt uses the injected now", async () => {
    const decision = await new NoopHealthCheckProvider().check(target(), { now: 1_700_000_000_000 });
    expect(decision.checkedAt).toBe(1_700_000_000_000);
  });

  it("7. checkedAt is absent when now is not injected (no Date.now fallback)", async () => {
    const decision = await new NoopHealthCheckProvider().check(target());
    expect(decision.checkedAt).toBeUndefined();
    expect(Object.keys(decision)).not.toContain("checkedAt");
  });

  it("8. does not mutate the target or options", async () => {
    const t = target({ endpointRef: "opaque-label" });
    const options = { now: 1000 };
    const tSnap = JSON.stringify(t);
    const optionsSnap = JSON.stringify(options);
    await new NoopHealthCheckProvider().check(t, options);
    expect(JSON.stringify(t)).toBe(tSnap);
    expect(JSON.stringify(options)).toBe(optionsSnap);
  });
});

describe("DisabledHealthCheckProvider", () => {
  it("is always disabled and issues no fetch", async () => {
    const provider = new DisabledHealthCheckProvider();
    expect(provider.getStatus().available).toBe(false);
    const decision = await provider.check(target());
    expect(decision.status).toBe("disabled");
  });
});

describe("canRunHealthCheck (pure policy)", () => {
  it("defaults to disabled without an explicit opt-in", () => {
    const decision = canRunHealthCheck(target());
    expect(decision.status).toBe("disabled");
  });

  it("resolves to skipped (never fabricates a health result) even when enabled", () => {
    const decision = canRunHealthCheck(target(), { enabled: true });
    expect(decision.status).toBe("skipped");
  });

  it("does not mutate the target or options", () => {
    const t = target();
    const options = { enabled: true, now: 1000 };
    const tSnap = JSON.stringify(t);
    const optionsSnap = JSON.stringify(options);
    canRunHealthCheck(t, options);
    expect(JSON.stringify(t)).toBe(tSnap);
    expect(JSON.stringify(options)).toBe(optionsSnap);
  });
});

describe("health check boundary stays unwired and free of real transports", () => {
  it("9. Runtime source has no auto health check call", () => {
    expect(runtimeSource).not.toMatch(/HealthCheckProvider|canRunHealthCheck|\.check\s*\(/);
    expect(runtimeTypesSource).not.toMatch(/HealthCheckProvider|canRunHealthCheck/);
  });

  it("10. Worker source has no health check auto-wire", () => {
    expect(workerSource).not.toMatch(/HealthCheckProvider|canRunHealthCheck|health_check/);
  });

  it("11. imports no fetch/http library and issues no fetch itself", () => {
    const importLines = healthCheckSource
      .split("\n")
      .filter((line: string) => /^\s*import\b/.test(line));
    expect(importLines.length).toBe(0);
    expect(healthCheckSource).not.toMatch(/\bfetch\s*\(/);
  });
});
