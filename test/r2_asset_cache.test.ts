import { describe, it, expect } from "vitest";
import {
  MockR2Bucket,
  R2AssetCache,
} from "../src/os/_legacy_prototype/asset/r2_asset_cache.js";
import { createAssetKey } from "../src/os/_legacy_prototype/asset/policy.js";
import type { AssetMetadata, CachedAsset } from "../src/os/_legacy_prototype/asset/types.js";

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

describe("R2AssetCache", () => {
  it("1. stores and returns a public asset", async () => {
    const bucket = new MockR2Bucket();
    const cache = new R2AssetCache({ bucket });
    await cache.put(asset({ key: "k", bytes: bytes("hello") }));
    const got = await cache.get("k", 1000);
    expect(got).toBeDefined();
    expect(decode(got!.bytes)).toBe("hello");
    expect(got!.metadata.kind).toBe("thumbnail");
    expect(bucket.calls.put).toBe(1);
  });

  it("2. stores and returns an unlisted preview", async () => {
    const cache = new R2AssetCache({ bucket: new MockR2Bucket() });
    await cache.put(
      asset({ key: "p", metadata: meta({ kind: "preview", visibility: "unlisted" }) }),
    );
    expect((await cache.get("p", 1000))?.metadata.visibility).toBe("unlisted");
  });

  it("3. rejects a private asset (and never calls the bucket)", async () => {
    const bucket = new MockR2Bucket();
    const cache = new R2AssetCache({ bucket });
    await expect(
      cache.put(asset({ metadata: meta({ visibility: "private" }) })),
    ).rejects.toThrow(/not cacheable/);
    expect(bucket.calls.put).toBe(0);
  });

  it("4. rejects a paid asset", async () => {
    const cache = new R2AssetCache({ bucket: new MockR2Bucket() });
    await expect(
      cache.put(asset({ metadata: meta({ visibility: "paid" }) })),
    ).rejects.toThrow(/not cacheable/);
  });

  it("5. rejects a sensitive-tag asset", async () => {
    const cache = new R2AssetCache({ bucket: new MockR2Bucket() });
    for (const tag of ["secret", "key", "payment", "dm", "entitlement"]) {
      await expect(cache.put(asset({ metadata: meta({ tags: [tag] }) }))).rejects.toThrow(
        /not cacheable/,
      );
    }
  });

  it("6. stores the content type in httpMetadata", async () => {
    const bucket = new MockR2Bucket();
    const cache = new R2AssetCache({ bucket });
    await cache.put(asset({ key: "k", metadata: meta({ contentType: "image/webp" }) }));
    const obj = await bucket.get("k");
    expect(obj?.httpMetadata?.contentType).toBe("image/webp");
  });

  it("7. restores metadata from customMetadata", async () => {
    const cache = new R2AssetCache({ bucket: new MockR2Bucket() });
    await cache.put(
      asset({ key: "k", metadata: meta({ kind: "video_segment", tags: ["clip"] }) }),
    );
    const got = await cache.get("k", 1000);
    expect(got?.metadata.kind).toBe("video_segment");
    expect(got?.metadata.tags).toEqual(["clip"]);
    expect(got?.cachedAt).toBe(1000);
  });

  it("8. has respects expiry", async () => {
    const cache = new R2AssetCache({ bucket: new MockR2Bucket() });
    await cache.put(asset({ key: "k", expiresAt: 2000 }));
    expect(await cache.has("k", 1999)).toBe(true);
    expect(await cache.has("k", 2000)).toBe(false);
    expect(await cache.has("missing", 0)).toBe(false);
  });

  it("9. an expired get returns a miss", async () => {
    const cache = new R2AssetCache({ bucket: new MockR2Bucket() });
    await cache.put(asset({ key: "k", expiresAt: 2000 }));
    expect(await cache.get("k", 1999)).toBeDefined();
    expect(await cache.get("k", 2000)).toBeUndefined();
  });

  it("10. delete removes the object", async () => {
    const bucket = new MockR2Bucket();
    const cache = new R2AssetCache({ bucket });
    await cache.put(asset({ key: "k" }));
    await cache.delete("k");
    expect(await cache.get("k", 1000)).toBeUndefined();
    expect(bucket.calls.delete).toBe(1);
    expect(bucket.size).toBe(0);
  });

  it("11. clear is a safe no-op (does not wipe the bucket)", async () => {
    const bucket = new MockR2Bucket();
    const cache = new R2AssetCache({ bucket });
    await cache.put(asset({ key: "k" }));
    await expect(cache.clear()).resolves.toBeUndefined();
    expect(bucket.size).toBe(1); // nothing deleted
    expect(await cache.get("k", 1000)).toBeDefined();
  });

  it("12. malformed customMetadata returns a miss", async () => {
    const bucket = new MockR2Bucket();
    const cache = new R2AssetCache({ bucket });
    // An object written outside the adapter, with junk metadata.
    await bucket.put("k", bytes("x"), { customMetadata: { assetMeta: "{not json" } });
    expect(await cache.get("k", 1000)).toBeUndefined();
    // ...and one with no customMetadata at all.
    await bucket.put("k2", bytes("x"));
    expect(await cache.get("k2", 1000)).toBeUndefined();
  });

  it("13. clones bytes and normalizes metadata written to the bucket", async () => {
    const bucket = new MockR2Bucket();
    const cache = new R2AssetCache({ bucket });
    const a = asset({
      key: "k",
      bytes: bytes("xyz"),
      metadata: meta({ contentType: "IMAGE/PNG" }),
    });
    await cache.put(a);
    const obj = await bucket.get("k");
    const storedBytes = await obj!.arrayBuffer();
    expect(storedBytes).not.toBe(a.bytes); // a distinct buffer
    expect(decode(storedBytes)).toBe("xyz"); // ...same content
    const storedMeta = JSON.parse(obj!.customMetadata!["assetMeta"]!);
    expect(storedMeta.contentType).toBe("image/png"); // normalized
  });

  it("14. does not mutate the input asset", async () => {
    const cache = new R2AssetCache({ bucket: new MockR2Bucket() });
    const a = asset({ key: "k", bytes: bytes("zzz"), metadata: meta({ tags: ["b", "a"] }) });
    const metaSnap = JSON.stringify(a.metadata);
    const byteSnap = decode(a.bytes);
    await cache.put(a);
    await cache.get("k", 1000);
    expect(JSON.stringify(a.metadata)).toBe(metaSnap);
    expect(decode(a.bytes)).toBe(byteSnap);
  });
});
