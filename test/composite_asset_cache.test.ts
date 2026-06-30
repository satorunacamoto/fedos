import { describe, it, expect } from "vitest";
import {
  CompositeAssetCache,
  type AssetCacheLayer,
} from "../src/asset/composite_asset_cache.js";
import { InMemoryAssetCache } from "../src/asset/memory_asset_cache.js";
import { createAssetKey } from "../src/asset/policy.js";
import type { AssetCache, AssetKey, AssetMetadata, CachedAsset } from "../src/asset/types.js";

function bytes(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

function decode(buf: ArrayBuffer): string {
  return new TextDecoder().decode(buf);
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

/** A spying in-memory cache that records each operation. */
class SpyCache implements AssetCache {
  readonly inner = new InMemoryAssetCache();
  readonly calls = { get: 0, put: 0, has: 0, delete: 0, clear: 0 };

  async get(key: AssetKey, now: number): Promise<CachedAsset | undefined> {
    this.calls.get += 1;
    return this.inner.get(key, now);
  }
  async put(a: CachedAsset): Promise<void> {
    this.calls.put += 1;
    return this.inner.put(a);
  }
  async has(key: AssetKey, now: number): Promise<boolean> {
    this.calls.has += 1;
    return this.inner.has(key, now);
  }
  async delete(key: AssetKey): Promise<void> {
    this.calls.delete += 1;
    return this.inner.delete(key);
  }
  async clear(): Promise<void> {
    this.calls.clear += 1;
    return this.inner.clear();
  }
}

/** A cache whose put always throws (used to prove warm-fill failures are ignored). */
class ThrowingPutCache implements AssetCache {
  readonly calls = { get: 0, put: 0, has: 0, delete: 0, clear: 0 };
  async get(): Promise<CachedAsset | undefined> {
    this.calls.get += 1;
    return undefined;
  }
  async put(): Promise<void> {
    this.calls.put += 1;
    throw new Error("put boom");
  }
  async has(): Promise<boolean> {
    this.calls.has += 1;
    return false;
  }
  async delete(): Promise<void> {
    this.calls.delete += 1;
  }
  async clear(): Promise<void> {
    this.calls.clear += 1;
  }
}

function layer(
  name: string,
  cache: AssetCache,
  overrides: Partial<Omit<AssetCacheLayer, "name" | "cache">> = {},
): AssetCacheLayer {
  return {
    name,
    cache,
    writable: overrides.writable ?? true,
    volatile: overrides.volatile ?? true,
  };
}

function chain(...layers: AssetCacheLayer[]): CompositeAssetCache {
  return new CompositeAssetCache({ layers });
}

describe("CompositeAssetCache get fallback", () => {
  it("1. returns a hit from the first layer (and does not read the rest)", async () => {
    const l0 = new SpyCache();
    const l1 = new SpyCache();
    const composite = new CompositeAssetCache({ layers: [layer("a", l0), layer("b", l1)] });
    await l0.put(asset({ key: "k", bytes: bytes("from-0") }));
    const got = await composite.get("k", 1000);
    expect(decode(got!.bytes)).toBe("from-0");
    expect(l1.calls.get).toBe(0); // short-circuited on the first hit
  });

  it("2. falls back to the second layer", async () => {
    const l0 = new SpyCache();
    const l1 = new SpyCache();
    const composite = new CompositeAssetCache({
      layers: [layer("a", l0), layer("b", l1)],
      readStrategy: "fallback",
    });
    await l1.put(asset({ key: "k", bytes: bytes("from-1") }));
    expect(decode((await composite.get("k", 1000))!.bytes)).toBe("from-1");
    expect(l0.calls.get).toBe(1);
  });

  it("3. falls back to the third layer", async () => {
    const l0 = new SpyCache();
    const l1 = new SpyCache();
    const l2 = new SpyCache();
    const composite = new CompositeAssetCache({
      layers: [layer("a", l0), layer("b", l1), layer("c", l2)],
      readStrategy: "fallback",
    });
    await l2.put(asset({ key: "k", bytes: bytes("from-2") }));
    expect(decode((await composite.get("k", 1000))!.bytes)).toBe("from-2");
  });

  it("4. returns undefined when every layer misses", async () => {
    const composite = chain(layer("a", new SpyCache()), layer("b", new SpyCache()));
    expect(await composite.get("nope", 1000)).toBeUndefined();
  });
});

describe("CompositeAssetCache warm-fill", () => {
  it("5. warm-fills earlier writable layers after a lower hit", async () => {
    const l0 = new SpyCache();
    const l1 = new SpyCache();
    const composite = new CompositeAssetCache({
      layers: [layer("a", l0), layer("b", l1)],
      readStrategy: "warm-fill",
    });
    await l1.put(asset({ key: "k", bytes: bytes("origin") }));
    await composite.get("k", 1000);
    // The earlier layer now holds the asset.
    expect(decode((await l0.get("k", 1000))!.bytes)).toBe("origin");
    expect(l0.calls.put).toBe(1);
  });

  it("warm-fill does not write to a non-writable earlier layer", async () => {
    const l0 = new SpyCache();
    const l1 = new SpyCache();
    const composite = new CompositeAssetCache({
      layers: [layer("a", l0, { writable: false }), layer("b", l1)],
      readStrategy: "warm-fill",
    });
    await l1.put(asset({ key: "k" }));
    await composite.get("k", 1000);
    expect(l0.calls.put).toBe(0);
  });

  it("6. ignores a warm-fill failure and still returns the hit", async () => {
    const throwing = new ThrowingPutCache();
    const l1 = new SpyCache();
    const composite = new CompositeAssetCache({
      layers: [layer("a", throwing), layer("b", l1)],
      readStrategy: "warm-fill",
    });
    await l1.put(asset({ key: "k", bytes: bytes("survives") }));
    const got = await composite.get("k", 1000);
    expect(decode(got!.bytes)).toBe("survives");
    expect(throwing.calls.put).toBe(1); // attempted, threw, was swallowed
  });
});

describe("CompositeAssetCache put", () => {
  it("7. default strategy writes only the first writable layer", async () => {
    const l0 = new SpyCache();
    const l1 = new SpyCache();
    const composite = new CompositeAssetCache({ layers: [layer("a", l0), layer("b", l1)] });
    await composite.put(asset({ key: "k" }));
    expect(l0.calls.put).toBe(1);
    expect(l1.calls.put).toBe(0);
  });

  it("first-writable skips a leading non-writable layer", async () => {
    const l0 = new SpyCache();
    const l1 = new SpyCache();
    const composite = new CompositeAssetCache({
      layers: [layer("a", l0, { writable: false }), layer("b", l1)],
    });
    await composite.put(asset({ key: "k" }));
    expect(l0.calls.put).toBe(0);
    expect(l1.calls.put).toBe(1);
  });

  it("8. the all-writable strategy writes every writable layer", async () => {
    const l0 = new SpyCache();
    const l1 = new SpyCache();
    const l2 = new SpyCache();
    const composite = new CompositeAssetCache({
      layers: [layer("a", l0), layer("b", l1, { writable: false }), layer("c", l2)],
      writeStrategy: "all-writable",
    });
    await composite.put(asset({ key: "k" }));
    expect(l0.calls.put).toBe(1);
    expect(l1.calls.put).toBe(0); // non-writable
    expect(l2.calls.put).toBe(1);
  });

  it("9. rejects a private asset before any layer is written", async () => {
    const l0 = new SpyCache();
    const composite = new CompositeAssetCache({ layers: [layer("a", l0)] });
    await expect(
      composite.put(asset({ metadata: meta({ visibility: "private" }) })),
    ).rejects.toThrow(/not cacheable/);
    expect(l0.calls.put).toBe(0);
  });

  it("10. rejects a paid asset", async () => {
    const l0 = new SpyCache();
    const composite = new CompositeAssetCache({ layers: [layer("a", l0)] });
    await expect(
      composite.put(asset({ metadata: meta({ visibility: "paid" }) })),
    ).rejects.toThrow(/not cacheable/);
    expect(l0.calls.put).toBe(0);
  });

  it("rejects a sensitive-tagged asset before any layer is written", async () => {
    const l0 = new SpyCache();
    const composite = new CompositeAssetCache({ layers: [layer("a", l0)] });
    for (const tag of ["secret", "key", "payment", "dm", "entitlement"]) {
      await expect(
        composite.put(asset({ metadata: meta({ tags: [tag] }) })),
      ).rejects.toThrow(/not cacheable/);
    }
    expect(l0.calls.put).toBe(0);
  });
});

describe("CompositeAssetCache delete / has / clear", () => {
  it("11. delete fans out to every layer", async () => {
    const l0 = new SpyCache();
    const l1 = new SpyCache();
    const composite = new CompositeAssetCache({ layers: [layer("a", l0), layer("b", l1)] });
    await l0.put(asset({ key: "k" }));
    await l1.put(asset({ key: "k" }));
    await composite.delete("k");
    expect(l0.calls.delete).toBe(1);
    expect(l1.calls.delete).toBe(1);
    expect(await composite.get("k", 1000)).toBeUndefined();
  });

  it("13. has is true when any layer has the key", async () => {
    const l0 = new SpyCache();
    const l1 = new SpyCache();
    const composite = new CompositeAssetCache({ layers: [layer("a", l0), layer("b", l1)] });
    await l1.put(asset({ key: "k" }));
    expect(await composite.has("k", 1000)).toBe(true);
    expect(await composite.has("absent", 1000)).toBe(false);
  });

  it("12a. clear defaults to a no-op (origin and volatile layers untouched)", async () => {
    const origin = new SpyCache();
    const local = new SpyCache();
    const composite = new CompositeAssetCache({
      layers: [layer("r2", origin, { volatile: false }), layer("mem", local, { volatile: true })],
    });
    await origin.put(asset({ key: "k" }));
    await local.put(asset({ key: "k" }));
    await composite.clear();
    expect(origin.calls.clear).toBe(0);
    expect(local.calls.clear).toBe(0);
    expect(await origin.get("k", 1000)).toBeDefined();
  });

  it("12b. clear=volatile clears only volatile layers (origin preserved)", async () => {
    const origin = new SpyCache();
    const local = new SpyCache();
    const composite = new CompositeAssetCache({
      layers: [layer("r2", origin, { volatile: false }), layer("mem", local, { volatile: true })],
      clearStrategy: "volatile",
    });
    await origin.put(asset({ key: "k" }));
    await local.put(asset({ key: "k" }));
    await composite.clear();
    expect(origin.calls.clear).toBe(0); // durable origin never wiped
    expect(local.calls.clear).toBe(1);
    expect(await origin.get("k", 1000)).toBeDefined();
    expect(await local.get("k", 1000)).toBeUndefined();
  });
});

describe("CompositeAssetCache purity", () => {
  it("14. does not mutate the input asset (bytes or metadata)", async () => {
    const composite = new CompositeAssetCache({
      layers: [layer("a", new SpyCache()), layer("b", new SpyCache())],
      writeStrategy: "all-writable",
    });
    const a = asset({ key: "k", bytes: bytes("zzz"), metadata: meta({ tags: ["b", "a"] }) });
    const metaSnap = JSON.stringify(a.metadata);
    const byteSnap = decode(a.bytes);
    await composite.put(a);
    await composite.get("k", 1000);
    expect(JSON.stringify(a.metadata)).toBe(metaSnap);
    expect(decode(a.bytes)).toBe(byteSnap);
  });

  it("exposes its layer names for diagnostics", () => {
    const composite = new CompositeAssetCache({
      layers: [layer("r2", new SpyCache()), layer("meshkv", new SpyCache()), layer("memory", new SpyCache())],
    });
    expect(composite.layerNames).toEqual(["r2", "meshkv", "memory"]);
  });
});
