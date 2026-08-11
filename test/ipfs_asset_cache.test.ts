import { describe, it, expect } from "vitest";
import {
  NoopIpfsClient,
  IpfsAssetCache,
  PlaceholderIpfsAssetCache,
  isIpfsCidLike,
  assetKeyToIpfsRef,
} from "../src/os/_legacy_prototype/asset/ipfs_asset_cache.js";
import type { IpfsClient } from "../src/os/_legacy_prototype/asset/ipfs_asset_cache.js";
import { createAssetKey } from "../src/os/_legacy_prototype/asset/policy.js";
import type { AssetMetadata, CachedAsset } from "../src/os/_legacy_prototype/asset/types.js";
// Source-level checks: prove no real transport import and no runtime/worker auto-wire.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import ipfsAssetCacheSource from "../src/os/_legacy_prototype/asset/ipfs_asset_cache.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

// Real-shaped example CIDs (well-known public examples, no relation to any
// user content): a CIDv0 and a CIDv1 (base32).
const REAL_CIDV0 = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
const REAL_CIDV1 = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

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

/** A client that records whether it was ever called, so tests can prove it wasn't. */
class SpyIpfsClient implements IpfsClient {
  readonly calls = { get: 0, put: 0, pin: 0, unpin: 0 };

  async get(_cid: string): Promise<ArrayBuffer | null> {
    this.calls.get += 1;
    return null;
  }

  async put(_bytes: ArrayBuffer, _metadata: AssetMetadata): Promise<{ cid: string }> {
    this.calls.put += 1;
    return { cid: REAL_CIDV0 };
  }

  async pin(_cid: string): Promise<void> {
    this.calls.pin += 1;
  }

  async unpin(_cid: string): Promise<void> {
    this.calls.unpin += 1;
  }
}

describe("NoopIpfsClient", () => {
  it("1. get always returns null (a miss)", async () => {
    const client = new NoopIpfsClient();
    expect(await client.get(REAL_CIDV0)).toBeNull();
    expect(await client.get("anything")).toBeNull();
  });

  it("put/pin/unpin reject as unavailable (no fabricated CID, no real call)", async () => {
    const client = new NoopIpfsClient();
    await expect(client.put(bytes("x"), meta())).rejects.toThrow(/unavailable/i);
    await expect(client.pin(REAL_CIDV0)).rejects.toThrow(/unavailable/i);
    await expect(client.unpin(REAL_CIDV0)).rejects.toThrow(/unavailable/i);
  });
});

describe("IpfsAssetCache / PlaceholderIpfsAssetCache", () => {
  it("2. get is always a miss, even after put", async () => {
    const cache = new PlaceholderIpfsAssetCache();
    await cache.put(asset({ key: "k" }));
    expect(await cache.get("k", 1000)).toBeUndefined();
    expect(await new IpfsAssetCache().get("k", 1000)).toBeUndefined();
  });

  it("3. put on a public asset resolves without ever calling the injected client", async () => {
    const spy = new SpyIpfsClient();
    const cache = new IpfsAssetCache({ client: spy });
    await expect(cache.put(asset())).resolves.toBeUndefined();
    expect(spy.calls).toEqual({ get: 0, put: 0, pin: 0, unpin: 0 });
  });

  it("4. rejects a private asset", async () => {
    const cache = new PlaceholderIpfsAssetCache();
    await expect(
      cache.put(asset({ metadata: meta({ visibility: "private" }) })),
    ).rejects.toThrow(/not cacheable/);
  });

  it("5. rejects a paid asset", async () => {
    const cache = new PlaceholderIpfsAssetCache();
    await expect(
      cache.put(asset({ metadata: meta({ visibility: "paid" }) })),
    ).rejects.toThrow(/not cacheable/);
  });

  it("6. rejects secret/payment/key/dm/entitlement-tagged assets", async () => {
    const cache = new PlaceholderIpfsAssetCache();
    for (const tag of ["secret", "key", "payment", "dm", "entitlement"]) {
      await expect(cache.put(asset({ metadata: meta({ tags: [tag] }) }))).rejects.toThrow(
        /not cacheable/,
      );
    }
  });

  it("7. has always returns false", async () => {
    const cache = new PlaceholderIpfsAssetCache();
    await cache.put(asset({ key: "k" }));
    expect(await cache.has("k", 1000)).toBe(false);
    expect(await cache.has("missing", 1000)).toBe(false);
  });

  it("8. delete/clear are safe no-ops and never touch the client", async () => {
    const spy = new SpyIpfsClient();
    const cache = new IpfsAssetCache({ client: spy });
    await cache.put(asset({ key: "k" }));
    await expect(cache.delete("k")).resolves.toBeUndefined();
    await expect(cache.clear()).resolves.toBeUndefined();
    expect(spy.calls).toEqual({ get: 0, put: 0, pin: 0, unpin: 0 });
  });

  it("9. CID helper accepts only plausible CIDs", () => {
    expect(isIpfsCidLike(REAL_CIDV0)).toBe(true);
    expect(isIpfsCidLike(REAL_CIDV1)).toBe(true);
    expect(isIpfsCidLike("not-a-cid")).toBe(false);
    expect(isIpfsCidLike("")).toBe(false);
    expect(isIpfsCidLike(123)).toBe(false);
    expect(isIpfsCidLike(null)).toBe(false);
    expect(isIpfsCidLike("nsec1privatekeymaterialxxxxxxxxxxxxxxxxxxxxxxxxxxxx")).toBe(false);
  });

  it("10. a CID-shaped value grants no access (not an authorization token)", async () => {
    const cache = new PlaceholderIpfsAssetCache();
    // Presenting something CID-shaped as the cache key unlocks nothing.
    expect(isIpfsCidLike(REAL_CIDV0)).toBe(true);
    expect(await cache.get(REAL_CIDV0, 1000)).toBeUndefined();
    expect(await cache.has(REAL_CIDV0, 1000)).toBe(false);
    // assetKeyToIpfsRef never fabricates a CID from an opaque asset key.
    expect(assetKeyToIpfsRef(createAssetKey(meta()))).toBeNull();
  });

  it("11. does not mutate the input asset", async () => {
    const cache = new PlaceholderIpfsAssetCache();
    const a = asset({ key: "k", bytes: bytes("zzz"), metadata: meta({ tags: ["b", "a"] }) });
    const metaSnap = JSON.stringify(a.metadata);
    const byteSnap = new TextDecoder().decode(a.bytes);
    await cache.put(a);
    await cache.get("k", 1000);
    await cache.has("k", 1000);
    await cache.delete("k");
    expect(JSON.stringify(a.metadata)).toBe(metaSnap);
    expect(new TextDecoder().decode(a.bytes)).toBe(byteSnap);
  });
});

describe("IPFS adapter stays a boundary and is not auto-wired", () => {
  it("12. Runtime source has no IPFS reference at all", () => {
    expect(runtimeSource).not.toMatch(/ipfs/i);
  });

  it("13. Worker source has no IPFS reference at all", () => {
    expect(workerSource).not.toMatch(/ipfs/i);
  });

  it("14. imports no fetch/http/real-IPFS-client library", () => {
    const importLines = ipfsAssetCacheSource
      .split("\n")
      .filter((line: string) => /^\s*import\b/.test(line));
    const denylist = [
      "ipfs-http-client",
      "kubo-rpc-client",
      "helia",
      "node-fetch",
      "undici",
      "axios",
      "http",
      "https",
    ];
    for (const line of importLines) {
      for (const banned of denylist) {
        expect(line.toLowerCase()).not.toContain(banned);
      }
    }
    expect(ipfsAssetCacheSource).not.toMatch(/\bfetch\s*\(/);
  });
});
