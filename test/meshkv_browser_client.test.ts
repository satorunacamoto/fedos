import { describe, it, expect } from "vitest";
import { MeshKVBrowserClient } from "../src/asset/meshkv_browser_client.js";
import type { MeshKVClient } from "../src/asset/meshkv_asset_cache.js";
import { MeshKV, createMeshKV } from "../packages/meshkv/src/index.js";
import type {
  MeshKVApi,
  MeshKVData,
  MeshKVInitOptions,
} from "../packages/meshkv/src/index.js";
import type { AssetMetadata } from "../src/asset/types.js";
// Runtime / Worker sources as strings: prove the adapter is NOT auto-wired.
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
  readonly store = new Map<string, { data: MeshKVData; contentType?: string }>();
  readonly calls = { init: 0, get: 0, put: 0, remove: 0 };

  async init(_options?: MeshKVInitOptions): Promise<void> {
    this.calls.init += 1;
  }
  async get(key: string): Promise<MeshKVData | null> {
    this.calls.get += 1;
    return this.store.get(key)?.data ?? null;
  }
  async put(key: string, data: MeshKVData, contentType?: string): Promise<void> {
    this.calls.put += 1;
    this.store.set(key, { data, contentType });
  }
  async remove(key: string): Promise<void> {
    this.calls.remove += 1;
    this.store.delete(key);
  }
}

describe("MeshKVBrowserClient", () => {
  it("1. satisfies MeshKVClient and round-trips against a real MeshKV node", async () => {
    const client: MeshKVClient = new MeshKVBrowserClient({ mesh: createMeshKV() });
    await client.put("k", bytes("hello"), meta());
    const got = await client.get("k");
    expect(got).not.toBeNull();
    expect(decode(got!)).toBe("hello");
    expect(await client.has("k")).toBe(true);
    await client.delete("k");
    expect(await client.get("k")).toBeNull();
    expect(await client.has("k")).toBe(false);
  });

  it("2. delegates get/put/has/delete to the MeshKV API (get/put/remove)", async () => {
    const mesh = new SpyMesh();
    const client = new MeshKVBrowserClient({ mesh });
    await client.put("k", bytes("x"), meta());
    await client.get("k");
    await client.has("k"); // derived from get
    await client.delete("k");
    expect(mesh.calls).toEqual({ init: 0, get: 2, put: 1, remove: 1 });
  });

  it("3. clones bytes across the boundary (no shared ArrayBuffer)", async () => {
    const mesh = new SpyMesh();
    const client = new MeshKVBrowserClient({ mesh });
    const input = bytes("xyz");
    await client.put("k", input, meta());
    const stored = mesh.store.get("k")!.data;
    expect(stored).not.toBe(input); // a distinct buffer was stored
    expect(decode(stored)).toBe("xyz"); // ...with identical content
    const got = await client.get("k");
    expect(got).not.toBe(stored); // get also returns a fresh copy
    expect(decode(got!)).toBe("xyz");
  });

  it("4. forwards only the content type from metadata (no metadata object shared)", async () => {
    const mesh = new SpyMesh();
    const client = new MeshKVBrowserClient({ mesh });
    await client.put("k", bytes("x"), meta({ contentType: "image/jpeg", tags: ["a", "b"] }));
    // The real MeshKV takes a content-type string, not a metadata object; the
    // adapter forwards the string and shares no object reference with the mesh.
    expect(mesh.store.get("k")!.contentType).toBe("image/jpeg");
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
    // Construction alone must not init, wire, or bring the node online.
    new MeshKVBrowserClient({ mesh });
    expect(mesh.online).toBe(false);
    expect(mesh.meshWired).toBe(false);
    expect(mesh.signaling.isOpen).toBe(false);
  });

  it("7. operations work fully offline and never go online", async () => {
    const mesh = new MeshKV();
    const client = new MeshKVBrowserClient({ mesh });
    await client.put("k", bytes("offline"), meta());
    expect(decode((await client.get("k"))!)).toBe("offline");
    expect(await client.has("k")).toBe(true);
    await client.delete("k");
    // No operation opened signaling or joined the mesh.
    expect(mesh.online).toBe(false);
    expect(mesh.signaling.isOpen).toBe(false);
  });

  it("8. does not implement a bulk clear (the real MeshKV exposes none)", () => {
    const client = new MeshKVBrowserClient({ mesh: new SpyMesh() });
    // `clear` is optional on MeshKVClient; the adapter deliberately omits it.
    expect((client as MeshKVClient).clear).toBeUndefined();
  });

  it("9. the adapter is not auto-wired into the runtime or worker", () => {
    const runtime: string = runtimeSource;
    const worker: string = workerSource;
    expect(runtime).not.toContain("MeshKVBrowserClient");
    expect(runtime).not.toContain("meshkv_browser_client");
    expect(runtime).not.toContain("packages/meshkv");
    expect(worker).not.toContain("MeshKVBrowserClient");
    expect(worker).not.toContain("meshkv_browser_client");
  });

  it("10. the MeshKV node only goes online via an explicit startSignaling()", async () => {
    const mesh = new MeshKV();
    const client = new MeshKVBrowserClient({ mesh });
    await client.put("k", bytes("v"), meta());
    await mesh.init({ signal: {} }); // wiring only — still offline
    expect(mesh.meshWired).toBe(true);
    expect(mesh.online).toBe(false);
    expect(mesh.signaling.isOpen).toBe(false);
    await mesh.startSignaling(); // caller's explicit choice — never the adapter's
    expect(mesh.online).toBe(true);
    expect(mesh.signaling.isOpen).toBe(true);
    await mesh.stop();
    expect(mesh.online).toBe(false);
  });
});
