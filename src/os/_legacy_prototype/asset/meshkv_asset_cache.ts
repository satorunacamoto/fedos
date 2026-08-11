/**
 * Stage 23 — MeshKV adapter for the public `AssetCache` boundary.
 *
 * Lets PUBLIC/unlisted media (previews, thumbnails, video segments) be cached
 * through a browser-to-browser mesh later, behind the same `AssetCache` contract
 * as the in-memory cache. This file ships ONLY the boundary: a `MeshKVClient`
 * interface, a `MockMeshKVClient` (in-process map, no peers), and the adapter
 * that gates every write through `canCacheAsset`.
 *
 * EXPLICITLY OUT OF SCOPE / NOT IMPLEMENTED: real WebRTC, any signaling server,
 * peer discovery, and any external/peer communication. MeshKV is a cache for
 * public bytes — it is NOT access control, payment, entitlement, or DRM, and it
 * must NEVER hold private/paid content, DMs, secrets, key material, or
 * payment/entitlement data (the policy gate refuses those). No purchased
 * originals ever live here.
 */

import { canCacheAsset, normalizeAssetMetadata } from "./policy.js";
import type { AssetCache, AssetKey, AssetMetadata, CachedAsset } from "./types.js";

/**
 * The transport a `MeshKVAssetCache` writes through. A real implementation backs
 * this with a mesh/peer store; it only ever moves opaque public bytes plus
 * descriptive metadata. `clear` is optional (a mesh may have no global wipe).
 */
export interface MeshKVClient {
  get(key: string): Promise<ArrayBuffer | null>;
  put(key: string, bytes: ArrayBuffer, metadata: AssetMetadata): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  clear?(): Promise<void>;
}

/** A side-table entry the adapter keeps for keys it has written. */
interface MeshKVEntry {
  readonly metadata: AssetMetadata;
  readonly cachedAt: number;
  readonly expiresAt?: number;
}

export interface MeshKVAssetCacheOptions {
  readonly client: MeshKVClient;
  /**
   * Reject non-cacheable assets on `put` (default true). This is the guardrail
   * that keeps private/paid/sensitive bytes off the mesh — keep it on.
   */
  readonly enforcePolicy?: boolean;
}

/** Copies an ArrayBuffer so neither side can mutate the other's bytes. */
function cloneBytes(bytes: ArrayBuffer): ArrayBuffer {
  return bytes.slice(0);
}

/**
 * `AssetCache` over a `MeshKVClient`. The client stores only bytes, so the
 * adapter keeps metadata + expiry locally and reconstructs a `CachedAsset` on
 * read. Every write is gated by `canCacheAsset`; bytes and metadata are cloned/
 * normalized so the input is never mutated and the mesh never shares a live ref.
 */
export class MeshKVAssetCache implements AssetCache {
  readonly #client: MeshKVClient;
  readonly #enforcePolicy: boolean;
  /** Metadata/expiry for keys this adapter has written (client holds bytes). */
  readonly #entries = new Map<AssetKey, MeshKVEntry>();

  constructor(options: MeshKVAssetCacheOptions) {
    this.#client = options.client;
    this.#enforcePolicy = options.enforcePolicy ?? true;
  }

  async put(asset: CachedAsset): Promise<void> {
    if (this.#enforcePolicy) {
      const decision = canCacheAsset(asset.metadata);
      if (!decision.allowed) {
        throw new Error(`asset not cacheable: ${decision.reason}`);
      }
    }
    const metadata = normalizeAssetMetadata(asset.metadata);
    const bytes = cloneBytes(asset.bytes);
    this.#entries.set(asset.key, {
      metadata,
      cachedAt: asset.cachedAt,
      ...(asset.expiresAt !== undefined ? { expiresAt: asset.expiresAt } : {}),
    });
    await this.#client.put(asset.key, bytes, metadata);
  }

  async get(key: AssetKey, now: number): Promise<CachedAsset | undefined> {
    const entry = this.#entries.get(key);
    if (!entry) return undefined; // no metadata -> treat as a miss
    if (entry.expiresAt !== undefined && now >= entry.expiresAt) {
      return undefined; // expired -> miss
    }
    const bytes = await this.#client.get(key);
    if (bytes === null) return undefined;
    return {
      key,
      bytes: cloneBytes(bytes),
      metadata: entry.metadata,
      cachedAt: entry.cachedAt,
      ...(entry.expiresAt !== undefined ? { expiresAt: entry.expiresAt } : {}),
    };
  }

  async has(key: AssetKey, now: number): Promise<boolean> {
    const entry = this.#entries.get(key);
    if (!entry) return false;
    if (entry.expiresAt !== undefined && now >= entry.expiresAt) return false;
    return this.#client.has(key);
  }

  async delete(key: AssetKey): Promise<void> {
    this.#entries.delete(key);
    await this.#client.delete(key);
  }

  async clear(): Promise<void> {
    this.#entries.clear();
    if (this.#client.clear) {
      await this.#client.clear();
    }
  }
}

/**
 * In-process `MeshKVClient` for tests/dev: a plain map with NO peers, NO
 * WebRTC, NO signaling, and NO network. Records call counts so tests can assert
 * which operations ran.
 */
export class MockMeshKVClient implements MeshKVClient {
  readonly #store = new Map<string, ArrayBuffer>();
  /** Metadata the adapter handed to `put`, exposed for assertions. */
  readonly metadataStore = new Map<string, AssetMetadata>();
  readonly calls = { get: 0, put: 0, has: 0, delete: 0, clear: 0 };

  get size(): number {
    return this.#store.size;
  }

  async get(key: string): Promise<ArrayBuffer | null> {
    this.calls.get += 1;
    return this.#store.get(key) ?? null;
  }

  async put(key: string, bytes: ArrayBuffer, metadata: AssetMetadata): Promise<void> {
    this.calls.put += 1;
    this.#store.set(key, bytes);
    this.metadataStore.set(key, metadata);
  }

  async has(key: string): Promise<boolean> {
    this.calls.has += 1;
    return this.#store.has(key);
  }

  async delete(key: string): Promise<void> {
    this.calls.delete += 1;
    this.#store.delete(key);
    this.metadataStore.delete(key);
  }

  async clear(): Promise<void> {
    this.calls.clear += 1;
    this.#store.clear();
    this.metadataStore.clear();
  }
}
