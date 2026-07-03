import { describe, it, expect } from "vitest";
import {
  NoopNearbyConsentProvider,
  PlaceholderNearbyConsentProvider,
} from "../src/nearby/noop_consent.js";
import { NEARBY_CONSENT_CAPABILITIES } from "../src/nearby/types.js";
import type { NearbyConsentRequest } from "../src/nearby/types.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nearbyTypesSource from "../src/nearby/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopConsentSource from "../src/nearby/noop_consent.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

const nearbySources = [nearbyTypesSource, noopConsentSource].join("\n");

const cleanRequest: NearbyConsentRequest = { reference: "settings_nearby_toggle" };

describe("NoopNearbyConsentProvider", () => {
  it("1. is always unavailable / denies every attempt", async () => {
    const provider = new NoopNearbyConsentProvider();
    expect(provider.getStatus().allowed).toBe(false);
    expect(provider.getStatus().status).toBe("unavailable");
    expect(provider.getCapabilities()).toEqual([]);
    expect(provider.isGranted()).toBe(false);

    const requestDecision = await provider.requestConsent(cleanRequest);
    expect(requestDecision.allowed).toBe(false);
    expect(requestDecision.status).toBe("unavailable");

    const revokeDecision = await provider.revokeConsent();
    expect(revokeDecision.allowed).toBe(false);
  });
});

describe("PlaceholderNearbyConsentProvider", () => {
  it("2. defaults to denied / off before any request", () => {
    const provider = new PlaceholderNearbyConsentProvider();
    expect(provider.getStatus().allowed).toBe(false);
    expect(provider.getStatus().status).toBe("denied");
    expect(provider.isGranted()).toBe(false);
  });

  it("3. requestConsent ALWAYS resolves denied — never grants (no real consent UI exists)", async () => {
    const provider = new PlaceholderNearbyConsentProvider();
    const decision = await provider.requestConsent(cleanRequest);
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("denied");
    expect(provider.isGranted()).toBe(false);
    // Requesting repeatedly never flips to granted.
    for (let i = 0; i < 5; i++) {
      const again = await provider.requestConsent(cleanRequest);
      expect(again.allowed).toBe(false);
      expect(again.status).toBe("denied");
    }
  });

  it("4. advertises only placeholder capabilities", () => {
    const provider = new PlaceholderNearbyConsentProvider();
    for (const cap of provider.getCapabilities()) {
      expect(cap).toMatch(/_placeholder$/);
      expect(NEARBY_CONSENT_CAPABILITIES).toContain(cap);
    }
  });

  it("5. revokeConsent is a safe no-op and stays denied", async () => {
    const provider = new PlaceholderNearbyConsentProvider();
    await provider.requestConsent(cleanRequest);
    const decision = await provider.revokeConsent();
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("denied");
    expect(provider.isGranted()).toBe(false);
  });

  it("6. never leaks a coordinate/location value in any decision", async () => {
    const provider = new PlaceholderNearbyConsentProvider();
    const decision = await provider.requestConsent({ reference: "35.6,139.7" });
    expect(JSON.stringify(decision)).not.toMatch(/35\.6|139\.7/);
  });
});

describe("nearby consent boundary is pure and total", () => {
  it("7. does not mutate its input request", async () => {
    const provider = new PlaceholderNearbyConsentProvider();
    const snapshot = JSON.stringify(cleanRequest);
    await provider.requestConsent(cleanRequest);
    expect(JSON.stringify(cleanRequest)).toBe(snapshot);
  });

  it("8. never throws", async () => {
    const provider = new PlaceholderNearbyConsentProvider();
    await expect(provider.requestConsent(cleanRequest)).resolves.toBeDefined();
    await expect(provider.requestConsent({})).resolves.toBeDefined();
    await expect(provider.revokeConsent()).resolves.toBeDefined();
    expect(() => provider.getStatus()).not.toThrow();
    expect(() => provider.getCapabilities()).not.toThrow();
    expect(() => provider.isGranted()).not.toThrow();
  });
});

describe("nearby consent boundary stays unwired and free of real permission/location APIs", () => {
  it("9. imports no geolocation / permissions / H3 / geohash / S2 library", () => {
    const importLines = nearbySources
      .split("\n")
      .filter((line: string) => /^\s*import\b/.test(line));
    const denylist = [
      "geolocation",
      "navigator",
      "permissions",
      "h3-js",
      "h3o",
      "geohash",
      "s2-geometry",
      "s2geometry",
    ];
    for (const line of importLines) {
      for (const banned of denylist) {
        expect(line.toLowerCase()).not.toContain(banned);
      }
    }
  });

  it("10. issues no fetch, calls no geolocation API, and computes no area id", () => {
    expect(nearbySources).not.toMatch(/\bfetch\s*\(/);
    // Doc comments legitimately DISCUSS "navigator.geolocation" as a thing that
    // is NOT called; the real invariant is that it is never invoked.
    expect(nearbySources).not.toMatch(/navigator\s*\.\s*geolocation\s*\.\s*\w/);
    expect(nearbySources).not.toMatch(/getCurrentPosition\s*\(|watchPosition\s*\(/);
    expect(nearbySources).not.toMatch(/get_area_id|getAreaId|round\s*\(\s*lat/i);
  });

  it("11. Runtime source does not select or call a NearbyConsentProvider", () => {
    const runtimeSources = [runtimeSource, runtimeTypesSource].join("\n");
    expect(runtimeSources).not.toMatch(/NearbyConsentProvider/);
    expect(runtimeSources).not.toMatch(/NoopNearbyConsentProvider|PlaceholderNearbyConsentProvider/);
    expect(runtimeSources).not.toMatch(/from\s+['"].*nearby\//);
  });

  it("12. Worker source does not select or call a NearbyConsentProvider", () => {
    expect(workerSource).not.toMatch(/NearbyConsentProvider/);
    expect(workerSource).not.toMatch(/NoopNearbyConsentProvider|PlaceholderNearbyConsentProvider/);
    expect(workerSource).not.toMatch(/from\s+['"].*nearby\//);
  });

  it("13. does not import StorageBackend (consent and storage stay independent boundaries)", () => {
    // Doc comments legitimately NAME `StorageBackend` when explaining that this
    // boundary is NOT wired into it; the real invariant is no import/usage.
    expect(nearbySources).not.toMatch(/from\s+['"].*storage\//);
    expect(nearbySources).not.toMatch(/:\s*StorageBackend\b/);
    expect(nearbySources).not.toMatch(/implements\s+StorageBackend\b/);
  });
});
