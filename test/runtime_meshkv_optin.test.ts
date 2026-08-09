import { describe, it, expect } from "vitest";
import {
  createRuntime,
  selectAssetCache,
  selectMeshKVClient,
} from "../src/os/_legacy_prototype/runtime/create_runtime.js";
import type { RuntimeEnv } from "../src/os/_legacy_prototype/runtime/types.js";
// Worker source as a string for a static "no MeshKV auto-wire" check.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
import { InMemoryAssetCache } from "../src/os/_legacy_prototype/asset/memory_asset_cache.js";
import { CompositeAssetCache } from "../src/os/_legacy_prototype/asset/composite_asset_cache.js";
import {
  MeshKVAssetCache,
  MockMeshKVClient,
} from "../src/os/_legacy_prototype/asset/meshkv_asset_cache.js";
import { MeshKVBrowserClient } from "../src/os/_legacy_prototype/asset/meshkv_browser_client.js";
import { MockR2Bucket } from "../src/os/_legacy_prototype/asset/r2_asset_cache.js";
import type { MeshKVApi } from "../packages/meshkv/src/index.js";

/**
 * A MeshKVApi that records EVERY call — including lifecycle methods MeshKVApi
 * does not require (`connect`/`startSignaling`) — so we can prove the runtime
 * never touches the node while building.
 */
interface SpyMeshKVApi extends MeshKVApi {
  connect(): Promise<void>;
  startSignaling(): Promise<void>;
  calls: {
    init: number;
    get: number;
    put: number;
    remove: number;
    load: number;
    connect: number;
    startSignaling: number;
  };
}

function spyMeshKVApi(): SpyMeshKVApi {
  const calls = {
    init: 0,
    get: 0,
    put: 0,
    remove: 0,
    load: 0,
    connect: 0,
    startSignaling: 0,
  };
  return {
    calls,
    async init() {
      calls.init += 1;
    },
    async get() {
      calls.get += 1;
      return null;
    },
    async put() {
      calls.put += 1;
    },
    async remove() {
      calls.remove += 1;
    },
    async load() {
      calls.load += 1;
      return new ArrayBuffer(0);
    },
    async connect() {
      calls.connect += 1;
    },
    async startSignaling() {
      calls.startSignaling += 1;
    },
  };
}

describe("runtime MeshKV opt-in wiring", () => {
  it("1. without the opt-in flag, no MeshKVBrowserClient is constructed", () => {
    // An injected MeshKVApi is present but the flag is absent -> no client.
    const env: RuntimeEnv = { MESHKV_API: spyMeshKVApi() };
    expect(selectMeshKVClient(env)).toBeUndefined();
    expect(selectAssetCache(env)).toBeInstanceOf(InMemoryAssetCache);
    expect(createRuntime(env).assetCache).toBeInstanceOf(InMemoryAssetCache);
  });

  it("1b. a falsy flag string does not opt in", () => {
    for (const flag of ["false", "0", "no", "off", ""]) {
      const env: RuntimeEnv = {
        ENABLE_MESHKV_ASSET_CACHE: flag,
        MESHKV_API: spyMeshKVApi(),
      };
      expect(selectMeshKVClient(env)).toBeUndefined();
    }
  });

  it("2. ENABLE + injected api selects a MeshKVAssetCache over a browser client", () => {
    const api = spyMeshKVApi();
    const env: RuntimeEnv = {
      ENABLE_MESHKV_ASSET_CACHE: true,
      MESHKV_API: api,
    };
    const client = selectMeshKVClient(env);
    expect(client).toBeInstanceOf(MeshKVBrowserClient);
    expect(selectAssetCache(env)).toBeInstanceOf(MeshKVAssetCache);
    const rt = createRuntime(env);
    expect(rt.assetCache).toBeInstanceOf(MeshKVAssetCache);
    expect(rt.mode).toBe("cloudflare");
    // Selecting did not touch the node.
    expect(api.calls.init).toBe(0);
  });

  it("2b. a truthy flag string ('true'/'1'/'on') opts in", () => {
    for (const flag of ["true", "1", "on", "yes", "  TRUE  "]) {
      const env: RuntimeEnv = {
        ENABLE_MESHKV_ASSET_CACHE: flag,
        MESHKV_API: spyMeshKVApi(),
      };
      expect(selectMeshKVClient(env)).toBeInstanceOf(MeshKVBrowserClient);
    }
  });

  it("2c. the opt-in api can be injected via overrides.meshKVApi", () => {
    const api = spyMeshKVApi();
    const client = selectMeshKVClient(
      { ENABLE_MESHKV_ASSET_CACHE: true },
      { meshKVApi: api },
    );
    expect(client).toBeInstanceOf(MeshKVBrowserClient);
  });

  it("2d. opt-in flag but no api available -> no client", () => {
    expect(selectMeshKVClient({ ENABLE_MESHKV_ASSET_CACHE: true })).toBeUndefined();
    expect(
      createRuntime({ ENABLE_MESHKV_ASSET_CACHE: true }).assetCache,
    ).toBeInstanceOf(InMemoryAssetCache);
  });

  it("3. R2 + opt-in MeshKV composes a CompositeAssetCache", () => {
    const bucket = new MockR2Bucket();
    const api = spyMeshKVApi();
    const rt = createRuntime({
      NOSTR_ASSET_R2: bucket,
      ENABLE_MESHKV_ASSET_CACHE: "true",
      MESHKV_API: api,
    });
    expect(rt.assetCache).toBeInstanceOf(CompositeAssetCache);
    expect((rt.assetCache as CompositeAssetCache).layerNames).toEqual([
      "r2",
      "meshkv",
      "memory",
    ]);
    // Composing performs no R2 or mesh I/O.
    expect(bucket.calls).toEqual({ get: 0, put: 0, head: 0, delete: 0 });
    expect(api.calls.get).toBe(0);
    expect(api.calls.put).toBe(0);
  });

  it("4. overrides.assetCache wins over an opt-in MeshKV env", () => {
    const override = new InMemoryAssetCache();
    const rt = createRuntime(
      { ENABLE_MESHKV_ASSET_CACHE: true, MESHKV_API: spyMeshKVApi() },
      { assetCache: override },
    );
    expect(rt.assetCache).toBe(override);
  });

  it("4b. overrides.meshKVClient wins over env.MESHKV_ASSET_CACHE and opt-in", () => {
    const pinned = new MockMeshKVClient();
    const client = selectMeshKVClient(
      {
        MESHKV_ASSET_CACHE: new MockMeshKVClient(),
        ENABLE_MESHKV_ASSET_CACHE: true,
        MESHKV_API: spyMeshKVApi(),
      },
      { meshKVClient: pinned },
    );
    expect(client).toBe(pinned);
  });

  it("5. env.MESHKV_ASSET_CACHE is used as-is (no browser client)", () => {
    const binding = new MockMeshKVClient();
    // No opt-in flag, no api — the legacy binding still works.
    const client = selectMeshKVClient({ MESHKV_ASSET_CACHE: binding });
    expect(client).toBe(binding);
    expect(client).not.toBeInstanceOf(MeshKVBrowserClient);
    const rt = createRuntime({ MESHKV_ASSET_CACHE: binding });
    expect(rt.assetCache).toBeInstanceOf(MeshKVAssetCache);
    expect(binding.calls).toEqual({ get: 0, put: 0, has: 0, delete: 0, clear: 0 });
  });

  it("6. createRuntime never calls init/connect/startSignaling on the node", () => {
    const api = spyMeshKVApi();
    createRuntime({ ENABLE_MESHKV_ASSET_CACHE: true, MESHKV_API: api });
    expect(api.calls.init).toBe(0);
    expect(api.calls.connect).toBe(0);
    expect(api.calls.startSignaling).toBe(0);
    expect(api.calls.load).toBe(0);
  });

  it("7. createRuntime performs no asset get/put/has on the node", () => {
    const api = spyMeshKVApi();
    createRuntime({
      NOSTR_ASSET_R2: new MockR2Bucket(),
      ENABLE_MESHKV_ASSET_CACHE: true,
      MESHKV_API: api,
    });
    expect(api.calls.get).toBe(0);
    expect(api.calls.put).toBe(0);
    expect(api.calls.remove).toBe(0);
  });

  it("8. the Worker does not auto-wire a MeshKV browser client", () => {
    const src: string = workerSource;
    expect(src).not.toContain("MeshKVBrowserClient");
    expect(src).not.toContain("ENABLE_MESHKV_ASSET_CACHE");
    expect(src).not.toContain("MESHKV_API");
    expect(src).not.toContain("startSignaling");
  });

  it("9. selecting does not mutate the input env", () => {
    const api = spyMeshKVApi();
    const env: RuntimeEnv = {
      ENABLE_MESHKV_ASSET_CACHE: "true",
      MESHKV_API: api,
      NOSTR_ASSET_R2: new MockR2Bucket(),
    };
    const before = { ...env };
    const beforeKeys = Object.keys(env).sort();
    createRuntime(env);
    selectAssetCache(env);
    selectMeshKVClient(env);
    expect(Object.keys(env).sort()).toEqual(beforeKeys);
    expect(env.ENABLE_MESHKV_ASSET_CACHE).toBe(before.ENABLE_MESHKV_ASSET_CACHE);
    expect(env.MESHKV_API).toBe(before.MESHKV_API);
    expect(env.NOSTR_ASSET_R2).toBe(before.NOSTR_ASSET_R2);
  });
});
