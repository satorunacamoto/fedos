import { describe, it, expect } from "vitest";
import {
  resolveProductAssetPreviews,
  filterPreviewAssetMetadata,
  isPreviewAssetVisible,
} from "../src/os/commerce/catalog/asset_preview.js";
import type { ProductAsset } from "../src/os/commerce/catalog/directory.js";
import type { Product } from "../src/os/commerce/catalog/types.js";
import type {
  AssetCache,
  AssetKey,
  AssetMetadata,
  CachedAsset,
} from "../src/os/_legacy_prototype/asset/types.js";

/** A product referencing three asset ids. */
function product(assetIds: string[]): Product {
  return {
    id: "p1",
    kind: "pdf",
    title: "Test Product",
    creatorPubkey: "a".repeat(64),
    priceCents: 0,
    currency: "USD",
    status: "active",
    visibility: "public",
    linkedSpaceIds: [],
    linkedEventIds: [],
    assetIds,
  };
}

function meta(overrides: Partial<AssetMetadata> = {}): AssetMetadata {
  return {
    kind: "preview",
    visibility: "public",
    contentType: "image/png",
    sizeBytes: 100,
    tags: [],
    ...overrides,
  };
}

function sampleAsset(id: string, overrides: Partial<AssetMetadata> = {}): ProductAsset {
  return { id, metadata: meta(overrides) };
}

/** A cache whose `get` returns scripted hits and records every key/now. */
class ScriptedAssetCache implements AssetCache {
  readonly getCalls: { key: AssetKey; now: number }[] = [];
  #hits: Map<string, CachedAsset>;
  #throwFor: Set<string>;

  constructor(hits: Record<string, CachedAsset> = {}, throwFor: string[] = []) {
    this.#hits = new Map(Object.entries(hits));
    this.#throwFor = new Set(throwFor);
  }

  async get(key: AssetKey, now: number): Promise<CachedAsset | undefined> {
    this.getCalls.push({ key, now });
    if (this.#throwFor.has(key)) throw new Error("cache blew up");
    return this.#hits.get(key);
  }
  async put(): Promise<void> {}
  async has(): Promise<boolean> {
    return false;
  }
  async delete(): Promise<void> {}
  async clear(): Promise<void> {}
}

function cached(metadata: AssetMetadata, bytes = new Uint8Array([1, 2, 3, 4])): CachedAsset {
  return {
    key: "k",
    bytes: bytes.buffer,
    metadata,
    cachedAt: 0,
  };
}

describe("isPreviewAssetVisible / filterPreviewAssetMetadata", () => {
  it("accepts public/unlisted, rejects private/paid", () => {
    expect(isPreviewAssetVisible(meta({ visibility: "public" }))).toBe(true);
    expect(isPreviewAssetVisible(meta({ visibility: "unlisted" }))).toBe(true);
    expect(isPreviewAssetVisible(meta({ visibility: "private" }))).toBe(false);
    expect(isPreviewAssetVisible(meta({ visibility: "paid" }))).toBe(false);
  });

  it("rejects sensitive tags even on a public asset", () => {
    expect(isPreviewAssetVisible(meta({ tags: ["secret"] }))).toBe(false);
    expect(isPreviewAssetVisible(meta({ tags: ["payment:stripe"] }))).toBe(false);
    expect(isPreviewAssetVisible(meta({ tags: ["user-key"] }))).toBe(false);
  });

  it("filterPreviewAssetMetadata returns a metadata-only copy or null", () => {
    const ok = filterPreviewAssetMetadata(sampleAsset("a"));
    expect(ok).not.toBeNull();
    expect(ok).toEqual({ id: "a", metadata: meta() });
    expect(Object.keys(ok!)).toEqual(["id", "metadata"]); // no bytes field
    expect(filterPreviewAssetMetadata(sampleAsset("b", { visibility: "paid" }))).toBeNull();
  });
});

describe("resolveProductAssetPreviews", () => {
  it("1. resolves previews from the sample metadata (no cache)", async () => {
    const p = product(["a", "b"]);
    const list = [sampleAsset("a"), sampleAsset("b")];
    const previews = await resolveProductAssetPreviews(p, list);
    expect(previews.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("2. uses cache-hit metadata over the sample metadata", async () => {
    const p = product(["a"]);
    const list = [sampleAsset("a", { contentType: "image/png" })];
    const cache = new ScriptedAssetCache({
      a: cached(meta({ contentType: "image/webp", visibility: "public" })),
    });
    const previews = await resolveProductAssetPreviews(p, list, cache, 1000);
    expect(previews[0]!.metadata.contentType).toBe("image/webp");
    expect(cache.getCalls).toEqual([{ key: "a", now: 1000 }]);
  });

  it("3. discards cache bytes — a ProductAsset never carries them", async () => {
    const p = product(["a"]);
    const cache = new ScriptedAssetCache({ a: cached(meta()) });
    const previews = await resolveProductAssetPreviews(p, [], cache, 0);
    expect(previews).toHaveLength(1);
    expect(previews[0]).toEqual({ id: "a", metadata: meta() });
    expect(previews[0]).not.toHaveProperty("bytes");
    expect(JSON.stringify(previews[0])).not.toContain("bytes");
  });

  it("4. a cache miss falls back to the sample metadata", async () => {
    const p = product(["a"]);
    const list = [sampleAsset("a", { contentType: "image/gif" })];
    const cache = new ScriptedAssetCache({}); // no hits
    const previews = await resolveProductAssetPreviews(p, list, cache, 0);
    expect(previews[0]!.metadata.contentType).toBe("image/gif");
  });

  it("5. a cache error falls back to the sample metadata", async () => {
    const p = product(["a"]);
    const list = [sampleAsset("a", { contentType: "image/gif" })];
    const cache = new ScriptedAssetCache({}, ["a"]); // throws for "a"
    const previews = await resolveProductAssetPreviews(p, list, cache, 0);
    expect(previews[0]!.metadata.contentType).toBe("image/gif");
  });

  it("6. excludes private metadata (sample and cache)", async () => {
    const p = product(["a", "b"]);
    const list = [sampleAsset("a", { visibility: "private" }), sampleAsset("b")];
    const cache = new ScriptedAssetCache({
      b: cached(meta({ visibility: "private" })),
    });
    const previews = await resolveProductAssetPreviews(p, list, cache, 0);
    expect(previews).toEqual([]); // a private (sample), b private (cache)
  });

  it("7. excludes paid metadata", async () => {
    const p = product(["a"]);
    const list = [sampleAsset("a", { visibility: "paid" })];
    const previews = await resolveProductAssetPreviews(p, list);
    expect(previews).toEqual([]);
  });

  it("8. excludes secret/payment/key-tagged metadata", async () => {
    const p = product(["a", "b", "c"]);
    const list = [
      sampleAsset("a", { tags: ["secret"] }),
      sampleAsset("b", { tags: ["payment"] }),
      sampleAsset("c", { tags: ["key"] }),
    ];
    const previews = await resolveProductAssetPreviews(p, list);
    expect(previews).toEqual([]);
  });

  it("9. does not mutate the product, sample list, or cached asset", async () => {
    const p = product(["a"]);
    const list = [sampleAsset("a")];
    const hit = cached(meta({ contentType: "image/webp" }));
    const cache = new ScriptedAssetCache({ a: hit });
    const pSnapshot = JSON.stringify(p);
    const listSnapshot = JSON.stringify(list);
    const hitMetaSnapshot = JSON.stringify(hit.metadata);
    await resolveProductAssetPreviews(p, list, cache, 0);
    expect(JSON.stringify(p)).toBe(pSnapshot);
    expect(JSON.stringify(list)).toBe(listSnapshot);
    expect(JSON.stringify(hit.metadata)).toBe(hitMetaSnapshot);
  });
});
