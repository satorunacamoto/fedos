import { describe, it, expect } from "vitest";
import {
  MeshKVAssetCache,
  MockMeshKVClient,
  type MeshKVClient,
} from "../src/os/_legacy_prototype/asset/meshkv_asset_cache.js";
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

describe("MeshKVAssetCache", () => {
  it("1. stores and returns a public asset", async () => {
    const client = new MockMeshKVClient();
    const cache = new MeshKVAssetCache({ client });
    const a = asset({ key: "k", bytes: bytes("hello") });
    await cache.put(a);
    const got = await cache.get("k", 1000);
    expect(got).toBeDefined();
    expect(decode(got!.bytes)).toBe("hello");
    expect(got!.metadata.kind).toBe("thumbnail");
    expect(client.calls.put).toBe(1);
  });

  it("2. stores and returns an unlisted preview", async () => {
    const cache = new MeshKVAssetCache({ client: new MockMeshKVClient() });
    const a = asset({ key: "p", metadata: meta({ kind: "preview", visibility: "unlisted" }) });
    await cache.put(a);
    expect((await cache.get("p", 1000))?.metadata.visibility).toBe("unlisted");
  });

  it("3. rejects a private asset (and never calls the client)", async () => {
    const client = new MockMeshKVClient();
    const cache = new MeshKVAssetCache({ client });
    await expect(
      cache.put(asset({ metadata: meta({ visibility: "private" }) })),
    ).rejects.toThrow(/not cacheable/);
    expect(client.calls.put).toBe(0);
  });

  it("4. rejects a paid asset", async () => {
    const cache = new MeshKVAssetCache({ client: new MockMeshKVClient() });
    await expect(
      cache.put(asset({ metadata: meta({ visibility: "paid" }) })),
    ).rejects.toThrow(/not cacheable/);
  });

  it("5. rejects a sensitive-tag asset (secret/key/payment/dm/entitlement)", async () => {
    const cache = new MeshKVAssetCache({ client: new MockMeshKVClient() });
    for (const tag of ["secret", "key", "payment", "dm", "entitlement"]) {
      await expect(cache.put(asset({ metadata: meta({ tags: [tag] }) }))).rejects.toThrow(
        /not cacheable/,
      );
    }
  });

  it("6. has respects expiry", async () => {
    const cache = new MeshKVAssetCache({ client: new MockMeshKVClient() });
    await cache.put(asset({ key: "k", expiresAt: 2000 }));
    expect(await cache.has("k", 1999)).toBe(true);
    expect(await cache.has("k", 2000)).toBe(false); // at/after expiry
    expect(await cache.has("missing", 0)).toBe(false);
  });

  it("7. an expired get returns a miss", async () => {
    const cache = new MeshKVAssetCache({ client: new MockMeshKVClient() });
    await cache.put(asset({ key: "k", expiresAt: 2000 }));
    expect(await cache.get("k", 1999)).toBeDefined();
    expect(await cache.get("k", 2000)).toBeUndefined();
  });

  it("8. delete removes the asset from adapter and client", async () => {
    const client = new MockMeshKVClient();
    const cache = new MeshKVAssetCache({ client });
    await cache.put(asset({ key: "k" }));
    await cache.delete("k");
    expect(await cache.get("k", 1000)).toBeUndefined();
    expect(client.calls.delete).toBe(1);
    expect(client.size).toBe(0);
  });

  it("9. clear calls the client's clear when available", async () => {
    const client = new MockMeshKVClient();
    const cache = new MeshKVAssetCache({ client });
    await cache.put(asset({ key: "k" }));
    await cache.clear();
    expect(client.calls.clear).toBe(1);
    expect(await cache.get("k", 1000)).toBeUndefined();
  });

  it("10. clear is a no-op on the client when it has no clear()", async () => {
    let cleared = false;
    const store = new Map<string, ArrayBuffer>();
    const client: MeshKVClient = {
      async get(k) {
        return store.get(k) ?? null;
      },
      async put(k, b) {
        store.set(k, b);
      },
      async has(k) {
        return store.has(k);
      },
      async delete(k) {
        store.delete(k);
      },
      // no clear()
    };
    const cache = new MeshKVAssetCache({ client });
    await cache.put(asset({ key: "k" }));
    await expect(cache.clear()).resolves.toBeUndefined();
    expect(cleared).toBe(false);
    // The adapter's own metadata table is cleared, so the key is gone.
    expect(await cache.get("k", 1000)).toBeUndefined();
  });

  it("11. clones bytes and metadata handed to the client", async () => {
    const client = new MockMeshKVClient();
    const cache = new MeshKVAssetCache({ client });
    const a = asset({ key: "k", bytes: bytes("xyz"), metadata: meta({ contentType: "IMAGE/PNG" }) });
    await cache.put(a);
    const storedBytes = await client.get("k");
    expect(storedBytes).not.toBe(a.bytes); // a distinct buffer
    expect(decode(storedBytes!)).toBe("xyz"); // ...with the same content
    const storedMeta = client.metadataStore.get("k")!;
    expect(storedMeta).not.toBe(a.metadata); // a distinct object
    expect(storedMeta.contentType).toBe("image/png"); // normalized
  });

  it("12. does not mutate the input asset", async () => {
    const cache = new MeshKVAssetCache({ client: new MockMeshKVClient() });
    const a = asset({ key: "k", bytes: bytes("zzz"), metadata: meta({ tags: ["b", "a"] }) });
    const metaSnap = JSON.stringify(a.metadata);
    const byteSnap = decode(a.bytes);
    await cache.put(a);
    await cache.get("k", 1000);
    expect(JSON.stringify(a.metadata)).toBe(metaSnap);
    expect(decode(a.bytes)).toBe(byteSnap);
  });
});
