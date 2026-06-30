/**
 * Stage 22 — in-memory `AssetCache` (dev/test only).
 *
 * Process-local and NON-persistent: it offers no durability and is cleared on
 * isolate/process restart. By default it ENFORCES the cache policy, refusing to
 * store any asset `canCacheAsset` rejects (private/paid/sensitive). Expiry is
 * deterministic via an injected `now`.
 *
 * This is a placeholder for a future R2 / HTTP / MeshKV implementation; it does
 * not fetch, decode, or serve bytes anywhere.
 */

import { canCacheAsset } from "./policy.js";
import type { AssetCache, AssetKey, CachedAsset } from "./types.js";

export interface InMemoryAssetCacheOptions {
  /**
   * Reject non-cacheable assets on `put` (default true). Keep this on outside of
   * tests — it is the guardrail that keeps private/paid/sensitive bytes out.
   */
  readonly enforcePolicy?: boolean;
}

export class InMemoryAssetCache implements AssetCache {
  readonly #store = new Map<AssetKey, CachedAsset>();
  readonly #enforcePolicy: boolean;

  constructor(options: InMemoryAssetCacheOptions = {}) {
    this.#enforcePolicy = options.enforcePolicy ?? true;
  }

  get size(): number {
    return this.#store.size;
  }

  async get(key: AssetKey, now: number): Promise<CachedAsset | undefined> {
    const asset = this.#store.get(key);
    if (!asset) return undefined;
    if (asset.expiresAt !== undefined && now >= asset.expiresAt) {
      return undefined; // expired -> miss
    }
    return asset;
  }

  async put(asset: CachedAsset): Promise<void> {
    if (this.#enforcePolicy) {
      const decision = canCacheAsset(asset.metadata);
      if (!decision.allowed) {
        throw new Error(`asset not cacheable: ${decision.reason}`);
      }
    }
    // Store by reference; the input is read, never mutated.
    this.#store.set(asset.key, asset);
  }

  async has(key: AssetKey, now: number): Promise<boolean> {
    return (await this.get(key, now)) !== undefined;
  }

  async delete(key: AssetKey): Promise<void> {
    this.#store.delete(key);
  }

  async clear(): Promise<void> {
    this.#store.clear();
  }
}
