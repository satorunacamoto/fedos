/**
 * Stage 28 — `MeshKVBrowserClient`: the adapter that plugs the external MeshKV
 * package into the host's `MeshKVClient` boundary.
 *
 * This is the ONLY file in `src/` that imports `packages/meshkv`. Its sole job is
 * to translate the host's `MeshKVClient` calls into the MeshKV package's
 * `MeshKVApi` calls — it adds no caching, no policy, and no transport. The asset
 * policy gate stays in `MeshKVAssetCache` (which wraps a `MeshKVClient`); this
 * adapter never sees a private/paid/secret asset because that cache refuses it
 * before calling `put`.
 *
 * It starts NO network: constructing the adapter does not call
 * `connect()`/`init()`/`start()`, so no signaling socket, WebRTC link, or peer
 * discovery begins. Bringing the underlying MeshKV node online is the caller's
 * explicit responsibility. Bytes and metadata are cloned across the boundary so
 * neither side shares a mutable reference with the other.
 */

import type { MeshKVApi, MeshKVMeta } from "../../packages/meshkv/src/meshkv.js";
import type { MeshKVClient } from "./meshkv_asset_cache.js";
import type { AssetMetadata } from "./types.js";

/** Copies an ArrayBuffer so neither side can mutate the other's bytes. */
function cloneBytes(bytes: ArrayBuffer): ArrayBuffer {
  return bytes.slice(0);
}

/** Copies metadata into a plain MeshKV meta record (no shared references). */
function cloneMeta(metadata: AssetMetadata): MeshKVMeta {
  return { ...metadata, tags: [...metadata.tags] };
}

export interface MeshKVBrowserClientOptions {
  /** A MeshKV node (or any `MeshKVApi`). The adapter does not bring it online. */
  readonly mesh: MeshKVApi;
}

/**
 * Adapts a MeshKV node to the host's `MeshKVClient`. Pure delegation: each method
 * forwards to the MeshKV API, cloning bytes/metadata across the boundary. No
 * lifecycle call is made here — the node stays exactly as online/offline as the
 * caller left it.
 */
export class MeshKVBrowserClient implements MeshKVClient {
  readonly #mesh: MeshKVApi;

  constructor(options: MeshKVBrowserClientOptions) {
    this.#mesh = options.mesh;
    // No connect()/init()/start(): constructing the adapter starts no network.
  }

  async get(key: string): Promise<ArrayBuffer | null> {
    const record = await this.#mesh.get(key);
    return record ? cloneBytes(record.value) : null;
  }

  async put(key: string, bytes: ArrayBuffer, metadata: AssetMetadata): Promise<void> {
    await this.#mesh.set(key, cloneBytes(bytes), cloneMeta(metadata));
  }

  async has(key: string): Promise<boolean> {
    return this.#mesh.has(key);
  }

  async delete(key: string): Promise<void> {
    await this.#mesh.remove(key);
  }

  async clear(): Promise<void> {
    await this.#mesh.clearAll();
  }
}
