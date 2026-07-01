import { describe, it, expect } from "vitest";
import {
  MeshKVBrowserClient,
} from "../src/asset/meshkv_browser_client.js";
import type { MeshKVClient } from "../src/asset/meshkv_asset_cache.js";
import { MeshKV } from "../packages/meshkv/src/meshkv.js";
import type { MeshKVApi, MeshKVMeta, MeshKVRecord } from "../packages/meshkv/src/meshkv.js";
import type { AssetMetadata } from "../src/asset/types.js";
// Worker / runtime sources as strings: prove the adapter is NOT auto-wired.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";

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

/** A MeshKV API spy that records calls — used to assert pure delegation. */
class SpyMesh implements MeshKVApi {
  readonly store = new Map<string, MeshKVRecord>();
  readonly calls = { get: 0, set: 0, has: 0, remove: 0, clearAll: 0 };
  /** The metadata handed to `set`, for clone assertions. */
  readonly metaStore = new Map<string, MeshKVMeta>();

  async get(key: string): Promise<MeshKVRecord | null> {
    this.calls.get += 1;
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: ArrayBuffer, meta: MeshKVMeta = {}): Promise<void> {
    this.calls.set += 1;
    this.store.set(key, { value, meta });
    this.metaStore.set(key, meta);
  }
  async has(key: string): Promise<boolean> {
    this.calls.has += 1;
    return this.store.has(key);
  }
  async remove(key: string): Promise<void> {
    this.calls.remove += 1;
    this.store.delete(key);
  }
  async clearAll(): Promise<void> {
    this.calls.clearAll += 1;
    this.store.clear();
  }
}

describe("MeshKVBrowserClient", () => {
  it("1. satisfies the MeshKVClient interface and round-trips a value", async () => {
    const client: MeshKVClient = new MeshKVBrowserClient({ mesh: new MeshKV() });
    await client.put("k", bytes("hello"), meta());
    const got = await client.get("k");
    expect(got).not.toBeNull();
    expect(decode(got!)).toBe("hello");
    expect(await client.has("k")).toBe(true);
    await client.delete("k");
    expect(await client.get("k")).toBeNull();
  });

  it("2. delegates every operation to the MeshKV API", async () => {
    const mesh = new SpyMesh();
    const client = new MeshKVBrowserClient({ mesh });
    await client.put("k", bytes("x"), meta());
    await client.get("k");
    await client.has("k");
    await client.delete("k");
    await client.clear();
    expect(mesh.calls).toEqual({ get: 1, set: 1, has: 1, remove: 1, clearAll: 1 });
  });

  it("3. clones bytes across the boundary (no shared ArrayBuffer)", async () => {
    const mesh = new SpyMesh();
    const client = new MeshKVBrowserClient({ mesh });
    const input = bytes("xyz");
    await client.put("k", input, meta());
    const stored = mesh.store.get("k")!.value;
    expect(stored).not.toBe(input); // a distinct buffer was stored
    expect(decode(stored)).toBe("xyz"); // ...with identical content
    const got = await client.get("k");
    expect(got).not.toBe(stored); // get also returns a fresh copy
    expect(decode(got!)).toBe("xyz");
  });

  it("4. clones metadata across the boundary (no shared object/array)", async () => {
    const mesh = new SpyMesh();
    const client = new MeshKVBrowserClient({ mesh });
    const input = meta({ tags: ["a", "b"], contentType: "image/png" });
    await client.put("k", bytes("x"), input);
    const storedMeta = mesh.metaStore.get("k")!;
    expect(storedMeta).not.toBe(input); // a distinct object
    expect(storedMeta["tags"]).not.toBe(input.tags); // a distinct array
    expect(storedMeta["tags"]).toEqual(["a", "b"]); // ...with identical content
    expect(storedMeta["contentType"]).toBe("image/png");
  });

  it("5. does not mutate the input bytes or metadata", async () => {
    const client = new MeshKVBrowserClient({ mesh: new SpyMesh() });
    const input = bytes("zzz");
    const m = meta({ tags: ["b", "a"] });
    const byteSnap = decode(input);
    const metaSnap = JSON.stringify(m);
    await client.put("k", input, m);
    expect(decode(input)).toBe(byteSnap);
    expect(JSON.stringify(m)).toBe(metaSnap);
  });

  it("6. constructing the adapter starts no MeshKV lifecycle / network", async () => {
    const mesh = new MeshKV();
    // Construction alone must not bring the node online.
    new MeshKVBrowserClient({ mesh });
    expect(mesh.connected).toBe(false);
    expect(mesh.signaling.isOpen).toBe(false);
  });

  it("7. operations work fully offline and never go online", async () => {
    const mesh = new MeshKV();
    const client = new MeshKVBrowserClient({ mesh });
    await client.put("k", bytes("offline"), meta());
    expect(decode((await client.get("k"))!)).toBe("offline");
    expect(await client.has("k")).toBe(true);
    await client.clear();
    // No operation opened signaling or joined the mesh.
    expect(mesh.connected).toBe(false);
    expect(mesh.signaling.isOpen).toBe(false);
  });

  it("8. the adapter is not auto-wired into the runtime or worker", () => {
    const runtime: string = runtimeSource;
    const worker: string = workerSource;
    expect(runtime).not.toContain("MeshKVBrowserClient");
    expect(runtime).not.toContain("meshkv_browser_client");
    expect(runtime).not.toContain("packages/meshkv");
    expect(worker).not.toContain("MeshKVBrowserClient");
    expect(worker).not.toContain("meshkv_browser_client");
  });

  it("9. the MeshKV node only goes online via an explicit connect()", async () => {
    const mesh = new MeshKV();
    const client = new MeshKVBrowserClient({ mesh });
    await client.put("k", bytes("v"), meta());
    expect(mesh.connected).toBe(false);
    await mesh.connect(); // caller's explicit choice — never the adapter's
    expect(mesh.connected).toBe(true);
    expect(mesh.signaling.isOpen).toBe(true);
    await mesh.close();
    expect(mesh.connected).toBe(false);
  });
});
