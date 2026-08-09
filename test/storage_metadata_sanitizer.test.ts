import { describe, it, expect } from "vitest";
import {
  isLocationDerivedValue,
  isSensitiveStorageValue,
  sanitizeStorageMetadata,
} from "../src/storage/policy.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storagePolicySource from "../src/os/core/storage/policy.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopStorageSource from "../src/os/core/storage/noop_storage.ts?raw";

describe("sanitizeStorageMetadata", () => {
  it("1. keeps non-sensitive, non-location metadata unchanged", () => {
    const metadata = { note: "sample", size: "small" };
    expect(sanitizeStorageMetadata(metadata)).toEqual(metadata);
  });

  it("2. returns undefined for undefined input", () => {
    expect(sanitizeStorageMetadata(undefined)).toBeUndefined();
  });

  it("3. drops sensitive keys/values (secret/key/seed/token/payment/entitlement/dm/body/content/message)", () => {
    const metadata = {
      authToken: "abc",
      paymentSecret: "x",
      seed: "y",
      dmBody: "z",
      note: "keep",
    };
    const clean = sanitizeStorageMetadata(metadata);
    expect(clean).toEqual({ note: "keep" });
  });

  it("4. drops location-derived keys (area_id/geohash/h3/s2/location/lat/lon)", () => {
    const metadata = {
      areaId: "9q8yy",
      geohash: "9q8yyk8",
      h3Index: "8928308280fffff",
      s2CellId: "89c25",
      location: "somewhere",
      lat: "35.6",
      lon: "139.7",
      latitude: "35.6",
      longitude: "139.7",
      note: "keep",
    };
    const clean = sanitizeStorageMetadata(metadata);
    expect(clean).toEqual({ note: "keep" });
  });

  it("5. drops a value that looks location-derived even under a neutral key", () => {
    const metadata = { extra: "geohash:9q8yyk8", note: "keep" };
    const clean = sanitizeStorageMetadata(metadata);
    expect(clean).toEqual({ note: "keep" });
  });

  it("6. returns undefined when every entry is dropped", () => {
    expect(sanitizeStorageMetadata({ areaId: "x", secret: "y" })).toBeUndefined();
  });

  it("7. does not mutate its input", () => {
    const metadata = { areaId: "x", note: "keep", secret: "y" };
    const snapshot = JSON.stringify(metadata);
    sanitizeStorageMetadata(metadata);
    expect(JSON.stringify(metadata)).toBe(snapshot);
  });

  it("8. never throws", () => {
    expect(() => sanitizeStorageMetadata(undefined)).not.toThrow();
    expect(() => sanitizeStorageMetadata({})).not.toThrow();
    expect(() => sanitizeStorageMetadata({ areaId: "x" })).not.toThrow();
  });
});

describe("isLocationDerivedValue / isSensitiveStorageValue", () => {
  it("9. isLocationDerivedValue recognizes location-shaped strings", () => {
    expect(isLocationDerivedValue("geohash:9q8yyk8")).toBe(true);
    expect(isLocationDerivedValue("h3 cell 8928308280fffff")).toBe(true);
    expect(isLocationDerivedValue("my gps coordinate")).toBe(true);
    expect(isLocationDerivedValue("a plain note")).toBe(false);
  });

  it("10. isSensitiveStorageValue is unaffected by location markers alone", () => {
    // "geohash" is not itself a secret/key/seed/token/payment/dm/body/content/message marker.
    expect(isSensitiveStorageValue("geohash:9q8yyk8")).toBe(false);
    expect(isSensitiveStorageValue("a bearer secret")).toBe(true);
  });
});

describe("storage metadata sanitizer stays a standalone, unwired boundary", () => {
  it("11. sanitizeStorageMetadata is not called from noop_storage.ts (kept independent)", () => {
    expect(noopStorageSource).not.toMatch(/sanitizeStorageMetadata/);
  });

  it("12. imports no fetch/file/H3/geohash/S2 library", () => {
    const importLines = storagePolicySource
      .split("\n")
      .filter((line: string) => /^\s*import\b/.test(line));
    const denylist = ["h3-js", "h3o", "geohash", "s2-geometry", "s2geometry"];
    for (const line of importLines) {
      for (const banned of denylist) {
        expect(line.toLowerCase()).not.toContain(banned);
      }
    }
    expect(storagePolicySource).not.toMatch(/\bfetch\s*\(/);
  });

  it("13. computes no area id and calls no geolocation API", () => {
    expect(storagePolicySource).not.toMatch(/get_area_id|getAreaId|round\s*\(\s*lat/i);
    expect(storagePolicySource).not.toMatch(/navigator\s*\.\s*geolocation/);
  });
});
