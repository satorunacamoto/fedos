import { describe, it, expect } from "vitest";
import {
  canCacheAsset,
  createAssetKey,
  isPublicCacheable,
  normalizeAssetMetadata,
} from "../src/os/_legacy_prototype/asset/policy.js";
import type { AssetMetadata } from "../src/os/_legacy_prototype/asset/types.js";

function meta(overrides: Partial<AssetMetadata> = {}): AssetMetadata {
  return {
    kind: "image",
    visibility: "public",
    contentType: "image/png",
    sizeBytes: 1024,
    tags: [],
    ...overrides,
  };
}

describe("asset cache policy", () => {
  it("1. a public image is cacheable", () => {
    const decision = canCacheAsset(meta());
    expect(decision.allowed).toBe(true);
    expect(isPublicCacheable(meta())).toBe(true);
  });

  it("2. an unlisted preview is cacheable", () => {
    expect(
      canCacheAsset(meta({ kind: "preview", visibility: "unlisted" })).allowed,
    ).toBe(true);
  });

  it("3. a private asset is denied", () => {
    const decision = canCacheAsset(meta({ visibility: "private" }));
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/private/);
    expect(isPublicCacheable(meta({ visibility: "private" }))).toBe(false);
  });

  it("4. a paid asset is denied", () => {
    const decision = canCacheAsset(meta({ visibility: "paid" }));
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/paid/);
  });

  it("5. a sensitive tag (secret/key/payment/dm/entitlement) denies caching", () => {
    for (const tag of ["secret", "key", "payment", "dm", "entitlement"]) {
      expect(canCacheAsset(meta({ tags: [tag] })).allowed).toBe(false);
    }
    // Namespaced labels are caught too...
    expect(canCacheAsset(meta({ tags: ["payment:stripe"] })).allowed).toBe(false);
    expect(canCacheAsset(meta({ tags: ["user-secret"] })).allowed).toBe(false);
    // ...but innocuous words that merely contain a token are not.
    expect(canCacheAsset(meta({ tags: ["monkey", "keyword"] })).allowed).toBe(true);
  });

  it("6. the asset key is deterministic and order-independent", () => {
    const a = meta({ tags: ["b", "a"], contentType: "IMAGE/PNG" });
    const b = meta({ tags: ["a", "b"], contentType: "image/png" });
    expect(createAssetKey(a)).toBe(createAssetKey(b));
    expect(createAssetKey(a)).toMatch(/^asset:[0-9a-f]{8}$/);
    // A checksum makes the key content-addressed.
    const c1 = createAssetKey(meta({ checksum: "abc" }));
    const c2 = createAssetKey(meta({ checksum: "abc", source: "different" }));
    expect(c1).toBe(c2);
  });

  it("7. normalizes content type, size and tags", () => {
    const n = normalizeAssetMetadata(
      meta({
        contentType: "  IMAGE/PNG  ",
        sizeBytes: 12.9,
        tags: ["x", "x", "", "a"],
      }),
    );
    expect(n.contentType).toBe("image/png");
    expect(n.sizeBytes).toBe(12);
    expect(n.tags).toEqual(["a", "x"]); // deduped, empties dropped, sorted
  });

  it("normalizes a non-finite/negative size to 0", () => {
    expect(normalizeAssetMetadata(meta({ sizeBytes: -5 })).sizeBytes).toBe(0);
    expect(normalizeAssetMetadata(meta({ sizeBytes: Number.NaN })).sizeBytes).toBe(0);
  });

  it("8. does not mutate its inputs", () => {
    const m = meta({ tags: ["b", "a"], contentType: "IMAGE/PNG" });
    const snapshot = JSON.stringify(m);
    canCacheAsset(m);
    isPublicCacheable(m);
    createAssetKey(m);
    normalizeAssetMetadata(m);
    expect(JSON.stringify(m)).toBe(snapshot);
  });
});
