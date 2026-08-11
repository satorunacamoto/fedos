/**
 * Stage 28/29 — `MeshKVBrowserClient`: the adapter that plugs the external MeshKV
 * package into the host's `MeshKVClient` boundary.
 *
 * This is the only file in `src/` that reaches `packages/meshkv` at RUNTIME (a
 * few others take type-only imports: `runtime/types.ts`, `meshkv_lifecycle.ts`).
 * Its sole job is to translate the host's `MeshKVClient` calls into the MeshKV
 * package's `MeshKVApi` (`init`/`get`/`put`/`remove`) — it adds no caching, no
 * policy, and no transport. The asset policy gate stays in `MeshKVAssetCache` (which wraps a
 * `MeshKVClient`); this adapter never sees a private/paid/secret asset because
 * that cache refuses it before calling `put`.
 *
 * API mapping (host `MeshKVClient` → real MeshKV `MeshKVApi`):
 *   - `get`    → `mesh.get` (returns bytes directly; cloned on the way out)
 *   - `put`    → `mesh.put(key, bytes, metadata.contentType)` (content type only)
 *   - `has`    → derived from `mesh.get` (the real API exposes no `has`)
 *   - `delete` → `mesh.remove`
 *   - `clear`  → intentionally NOT implemented: the real MeshKV exposes no bulk
 *     clear, and `MeshKVClient.clear` is optional. `MeshKVAssetCache` handles a
 *     client without `clear` (it clears only its own side-table).
 *
 * It starts NO network: constructing the adapter calls no `init()`/
 * `startSignaling()`/`connect()`, so no signaling socket, WebRTC link, or peer
 * discovery begins. Bringing the MeshKV node online is the caller's explicit
 * responsibility. Bytes are cloned across the boundary so neither side shares a
 * mutable buffer with the other.
 */

import type { MeshKVApi } from "../../../../packages/meshkv/src/index.js";
import type { MeshKVClient } from "./meshkv_asset_cache.js";
import type { AssetMetadata } from "./types.js";

/** Copies an ArrayBuffer so neither side can mutate the other's bytes. */
function cloneBytes(bytes: ArrayBuffer): ArrayBuffer {
  return bytes.slice(0);
}

export interface MeshKVBrowserClientOptions {
  /** A MeshKV node (or any `MeshKVApi`). The adapter does not bring it online. */
  readonly mesh: MeshKVApi;
}

/**
 * Adapts a MeshKV node to the host's `MeshKVClient`. Pure delegation: each method
 * forwards to the MeshKV API, cloning bytes across the boundary. No lifecycle
 * call is made here — the node stays exactly as online/offline as the caller
 * left it.
 */
export class MeshKVBrowserClient implements MeshKVClient {
  readonly #mesh: MeshKVApi;

  constructor(options: MeshKVBrowserClientOptions) {
    this.#mesh = options.mesh;
    // No init()/startSignaling()/connect(): constructing the adapter starts no
    // network — no signaling socket, no WebRTC, no peer discovery.
  }

  async get(key: string): Promise<ArrayBuffer | null> {
    const data = await this.#mesh.get(key);
    return data ? cloneBytes(data) : null;
  }

  async put(key: string, bytes: ArrayBuffer, metadata: AssetMetadata): Promise<void> {
    // The real MeshKV stores bytes + a content-type string; richer metadata is
    // kept by `MeshKVAssetCache`'s own side-table, not pushed onto the mesh.
    await this.#mesh.put(key, cloneBytes(bytes), metadata.contentType);
  }

  async has(key: string): Promise<boolean> {
    return (await this.#mesh.get(key)) !== null;
  }

  async delete(key: string): Promise<void> {
    await this.#mesh.remove(key);
  }
}
