import { describe, it, expect } from "vitest";
import { InMemoryAssetCache } from "../src/asset/memory_asset_cache.js";
import { createAssetKey } from "../src/asset/policy.js";
import type { AssetMetadata, CachedAsset } from "../src/asset/types.js";

function bytes(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

function meta(overrides: Partial<AssetMetadata> = {}): AssetMetadata {
  return {
    kind: "thumbnail",
    visibility: "public",
    contentType: "image/png",
    sizeBytes: 4,
    tags: [],
    ...overrides,
  };
}

function asset(overrides: Partial<CachedAsset> = {}): CachedAsset {
  const metadata = overrides.metadata ?? meta();
  return {
    key: overrides.key ?? createAssetKey(metadata),
    bytes: overrides.bytes ?? bytes("data"),
    metadata,
    cachedAt: overrides.cachedAt ?? 1000,
    ...(overrides.expiresAt !== undefined ? { expiresAt: overrides.expiresAt } : {}),
  };
}

describe("InMemoryAssetCache", () => {
  it("1. stores and returns an asset", async () => {
    const cache = new InMemoryAssetCache();
    const a = asset();
    await cache.put(a);
    const got = await cache.get(a.key, 1000);
    expect(got).toBeDefined();
    expect(got?.bytes).toBe(a.bytes);
    expect(got?.metadata.kind).toBe("thumbnail");
  });

  it("2. reports presence via has", async () => {
    const cache = new InMemoryAssetCache();
    const a = asset();
    expect(await cache.has(a.key, 1000)).toBe(false);
    await cache.put(a);
    expect(await cache.has(a.key, 1000)).toBe(true);
  });

  it("3. deletes an asset", async () => {
    const cache = new InMemoryAssetCache();
    const a = asset();
    await cache.put(a);
    await cache.delete(a.key);
    expect(await cache.get(a.key, 1000)).toBeUndefined();
  });

  it("4. clears all assets", async () => {
    const cache = new InMemoryAssetCache();
    await cache.put(asset({ key: "k1" }));
    await cache.put(asset({ key: "k2" }));
    await cache.clear();
    expect(cache.size).toBe(0);
  });

  it("5/6. an expired entry returns a miss; a fresh one is a hit", async () => {
    const cache = new InMemoryAssetCache();
    const a = asset({ key: "k", expiresAt: 2000 });
    await cache.put(a);
    expect(await cache.get("k", 1999)).toBeDefined(); // before expiry
    expect(await cache.get("k", 2000)).toBeUndefined(); // at/after expiry -> miss
    expect(await cache.has("k", 2500)).toBe(false);
  });

  it("7. refuses non-cacheable assets when policy is enforced (default)", async () => {
    const cache = new InMemoryAssetCache();
    await expect(
      cache.put(asset({ metadata: meta({ visibility: "private" }) })),
    ).rejects.toThrow(/not cacheable/);
    await expect(
      cache.put(asset({ metadata: meta({ visibility: "paid" }) })),
    ).rejects.toThrow(/not cacheable/);
    await expect(
      cache.put(asset({ metadata: meta({ tags: ["secret"] }) })),
    ).rejects.toThrow(/not cacheable/);
  });

  it("can disable enforcement for tests/tools", async () => {
    const cache = new InMemoryAssetCache({ enforcePolicy: false });
    const a = asset({ key: "k", metadata: meta({ visibility: "private" }) });
    await cache.put(a); // does not throw
    expect(await cache.get("k", 1000)).toBeDefined();
  });

  it("8. does not mutate the stored asset", async () => {
    const cache = new InMemoryAssetCache();
    const a = asset();
    const snapshot = JSON.stringify({
      key: a.key,
      metadata: a.metadata,
      cachedAt: a.cachedAt,
    });
    await cache.put(a);
    await cache.get(a.key, 1000);
    expect(
      JSON.stringify({ key: a.key, metadata: a.metadata, cachedAt: a.cachedAt }),
    ).toBe(snapshot);
  });
});
