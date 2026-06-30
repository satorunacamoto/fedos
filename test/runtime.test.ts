import { describe, it, expect } from "vitest";
import {
  createRuntime,
  selectEventCache,
  selectMetadataIndex,
  selectPromotionProvider,
  selectRecommendationProvider,
  selectRelayPublisher,
  selectSignatureVerifier,
  selectSpaceDirectory,
} from "../src/runtime/create_runtime.js";
import type { RuntimeEnv } from "../src/runtime/types.js";
import { InMemoryAssetCache } from "../src/asset/memory_asset_cache.js";
import {
  MeshKVAssetCache,
  MockMeshKVClient,
} from "../src/asset/meshkv_asset_cache.js";
import { MockR2Bucket, R2AssetCache } from "../src/asset/r2_asset_cache.js";
import { InMemoryEventCache } from "../src/cache/event_cache.js";
import { KvEventCache, type KvLikeNamespace } from "../src/cache/kv_event_cache.js";
import { InMemorySpaceDirectory } from "../src/community/directory.js";
import { D1SpaceDirectory } from "../src/community/d1_directory.js";
import { InMemoryMetadataIndex } from "../src/indexer/memory_index.js";
import { D1MetadataIndex, type D1LikeDatabase, type D1LikePreparedStatement } from "../src/indexer/d1_index.js";
import { NobleSignatureVerifier } from "../src/nostr/noble_signature.js";
import { MockRelayPublisher } from "../src/nostr/publish.js";
import {
  MockPromotionProvider,
  MockRecommendationProvider,
} from "../src/promotion/adapter.js";
import { EdgeRecPromotionProvider, type EdgeRecFetchLike } from "../src/promotion/edge_rec_adapter.js";

class FakeKv implements KvLikeNamespace {
  async get(): Promise<string | null> {
    return null;
  }
  async put(): Promise<void> {}
  async delete(): Promise<void> {}
}

class StubD1 implements D1LikeDatabase {
  prepare(): D1LikePreparedStatement {
    const stmt: D1LikePreparedStatement = {
      bind: () => stmt,
      run: () => Promise.resolve({}),
      all: () => Promise.resolve({ results: [] }),
      first: () => Promise.resolve(null),
    };
    return stmt;
  }
  batch(): Promise<unknown[]> {
    return Promise.resolve([]);
  }
}

/** A fetch client that records calls — used to prove createRuntime never calls out. */
function spyFetch(): EdgeRecFetchLike & { calls: number } {
  const fn = ((_url: string, _init) => {
    fn.calls += 1;
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ candidates: [] }),
    });
  }) as EdgeRecFetchLike & { calls: number };
  fn.calls = 0;
  return fn;
}

describe("createRuntime", () => {
  it("1. with no env, picks test/local-safe in-memory defaults", () => {
    const rt = createRuntime();
    expect(rt.mode).toBe("test");
    expect(rt.eventCache).toBeInstanceOf(InMemoryEventCache);
    expect(rt.assetCache).toBeInstanceOf(InMemoryAssetCache);
    expect(rt.spaceDirectory).toBeInstanceOf(InMemorySpaceDirectory);
    expect(rt.metadataIndex).toBeInstanceOf(InMemoryMetadataIndex);
    expect(rt.signatureVerifier).toBe(NobleSignatureVerifier);
    expect(rt.promotionProvider).toBeInstanceOf(MockPromotionProvider);
    expect(rt.recommendationProvider).toBeInstanceOf(MockRecommendationProvider);
    expect(rt.relayPublisher).toBeInstanceOf(MockRelayPublisher);
  });

  it("a bare env (no bindings) reports local mode", () => {
    expect(createRuntime({}).mode).toBe("local");
  });

  it("2. selects a KvEventCache when the KV binding is present", () => {
    const env: RuntimeEnv = { NOSTR_EVENT_CACHE: new FakeKv() };
    expect(selectEventCache(env)).toBeInstanceOf(KvEventCache);
    const rt = createRuntime(env);
    expect(rt.eventCache).toBeInstanceOf(KvEventCache);
    expect(rt.mode).toBe("cloudflare");
  });

  it("3. selects a D1SpaceDirectory when the space DB binding is present", () => {
    const env: RuntimeEnv = { NOSTR_SPACE_DB: new StubD1() };
    expect(selectSpaceDirectory(env)).toBeInstanceOf(D1SpaceDirectory);
    expect(createRuntime(env).spaceDirectory).toBeInstanceOf(D1SpaceDirectory);
  });

  it("4. selects a D1MetadataIndex when the index DB binding is present", () => {
    const env: RuntimeEnv = { NOSTR_INDEX: new StubD1() };
    expect(selectMetadataIndex(env)).toBeInstanceOf(D1MetadataIndex);
    expect(createRuntime(env).metadataIndex).toBeInstanceOf(D1MetadataIndex);
  });

  it("5. an endpoint + injected fetch makes EdgeRec selectable", () => {
    const env: RuntimeEnv = {
      PROMOTION_ENDPOINT: "https://edge-rec.example/promotions",
      RECOMMENDATION_ENDPOINT: "https://edge-rec.example/recos",
      fetch: spyFetch(),
    };
    expect(selectPromotionProvider(env)).toBeInstanceOf(EdgeRecPromotionProvider);
    expect(selectRecommendationProvider(env)).toBeInstanceOf(EdgeRecPromotionProvider);
  });

  it("6. without an endpoint, falls back to the mock providers", () => {
    expect(selectPromotionProvider()).toBeInstanceOf(MockPromotionProvider);
    expect(selectRecommendationProvider()).toBeInstanceOf(MockRecommendationProvider);
    // An endpoint with no injected fetch cannot be wired -> still the mock.
    const env: RuntimeEnv = { PROMOTION_ENDPOINT: "https://edge-rec.example/x" };
    expect(selectPromotionProvider(env)).toBeInstanceOf(MockPromotionProvider);
  });

  it("7. the relay publisher defaults to the mock (no real publish)", () => {
    expect(selectRelayPublisher()).toBeInstanceOf(MockRelayPublisher);
    expect(createRuntime().relayPublisher).toBeInstanceOf(MockRelayPublisher);
  });

  it("8. the signature verifier is the real Noble (Schnorr) verifier", () => {
    expect(selectSignatureVerifier()).toBe(NobleSignatureVerifier);
  });

  it("9. overrides win over anything selected from env", () => {
    const stubCache = new InMemoryEventCache();
    const stubAssetCache = new InMemoryAssetCache();
    const stubPublisher = new MockRelayPublisher();
    const rt = createRuntime(
      { NOSTR_EVENT_CACHE: new FakeKv() },
      {
        eventCache: stubCache,
        assetCache: stubAssetCache,
        relayPublisher: stubPublisher,
        mode: "test",
      },
    );
    expect(rt.eventCache).toBe(stubCache); // not the KvEventCache from env
    expect(rt.assetCache).toBe(stubAssetCache);
    expect(rt.relayPublisher).toBe(stubPublisher);
    expect(rt.mode).toBe("test");
  });

  it("10. createRuntime starts no external work (no fetch/publish/query)", async () => {
    const fetch = spyFetch();
    const env: RuntimeEnv = {
      PROMOTION_ENDPOINT: "https://edge-rec.example/promotions",
      NOSTR_EVENT_CACHE: new FakeKv(),
      fetch,
    };
    const rt = createRuntime(env);
    expect(fetch.calls).toBe(0); // no promotion request issued
    // The mock publisher has published nothing.
    expect((rt.relayPublisher as MockRelayPublisher).published).toEqual([]);
  });

  it("selects an R2AssetCache when an R2 bucket is bound (and R2 wins over mesh)", () => {
    const bucket = new MockR2Bucket();
    const rt = createRuntime({
      NOSTR_ASSET_R2: bucket,
      MESHKV_ASSET_CACHE: new MockMeshKVClient(),
    });
    expect(rt.assetCache).toBeInstanceOf(R2AssetCache);
    expect(rt.mode).toBe("cloudflare");
    // Construction performs no R2 I/O.
    expect(bucket.calls).toEqual({ get: 0, put: 0, head: 0, delete: 0 });
  });

  it("an explicit assetCache override wins over an R2 binding", () => {
    const override = new InMemoryAssetCache();
    const rt = createRuntime(
      { NOSTR_ASSET_R2: new MockR2Bucket() },
      { assetCache: override },
    );
    expect(rt.assetCache).toBe(override);
  });

  it("selects a MeshKVAssetCache when a mesh client is bound", () => {
    const client = new MockMeshKVClient();
    const rt = createRuntime({ MESHKV_ASSET_CACHE: client });
    expect(rt.assetCache).toBeInstanceOf(MeshKVAssetCache);
    expect(rt.mode).toBe("cloudflare");
    // Building the runtime opens no mesh connection / runs no mesh op.
    expect(client.calls).toEqual({ get: 0, put: 0, has: 0, delete: 0, clear: 0 });
  });

  it("falls back to the in-memory asset cache without a mesh binding", () => {
    expect(createRuntime().assetCache).toBeInstanceOf(InMemoryAssetCache);
    expect(createRuntime({}).assetCache).toBeInstanceOf(InMemoryAssetCache);
  });

  it("createRuntime performs no asset-cache operations", async () => {
    let calls = 0;
    const spyAssetCache = {
      get: async () => {
        calls += 1;
        return undefined;
      },
      put: async () => {
        calls += 1;
      },
      has: async () => {
        calls += 1;
        return false;
      },
      delete: async () => {
        calls += 1;
      },
      clear: async () => {
        calls += 1;
      },
    };
    const rt = createRuntime(undefined, { assetCache: spyAssetCache });
    expect(rt.assetCache).toBe(spyAssetCache);
    expect(calls).toBe(0); // nothing read or written during construction
  });

  it("11. does not mutate the input env", () => {
    const env: RuntimeEnv = {
      NOSTR_EVENT_CACHE: new FakeKv(),
      PROMOTION_ENDPOINT: "https://edge-rec.example/promotions",
      PROMOTION_API_KEY: "secret",
      fetch: spyFetch(),
    };
    const before = { ...env };
    const beforeKeys = Object.keys(env).sort();
    createRuntime(env);
    expect(Object.keys(env).sort()).toEqual(beforeKeys);
    expect(env.NOSTR_EVENT_CACHE).toBe(before.NOSTR_EVENT_CACHE);
    expect(env.PROMOTION_ENDPOINT).toBe(before.PROMOTION_ENDPOINT);
    expect(env.PROMOTION_API_KEY).toBe(before.PROMOTION_API_KEY);
    expect(env.fetch).toBe(before.fetch);
  });
});
