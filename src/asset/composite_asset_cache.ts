/**
 * Stage 26 — composed fallback chain over several `AssetCache` layers.
 *
 * Wraps an ORDERED list of asset caches (e.g. R2 origin → MeshKV peer cache →
 * in-memory local fallback) behind the single `AssetCache` contract. Reads fall
 * through the layers in order and return the first hit; an optional warm-fill
 * back-populates the preceding layers. Writes are policy-gated and go to the
 * first writable layer (or all writable layers). Deletes fan out to every layer.
 *
 * SCOPE GUARDRAILS (unchanged from the wrapped adapters): public/unlisted media
 * only. Every write — direct or warm-fill — is gated by `canCacheAsset`, so
 * private/paid content, DMs, secrets, key material, and payment/entitlement data
 * are refused before any layer is touched. The composite opens NO connection and
 * issues NO `fetch` of its own; all I/O happens inside the layers it was given.
 * It is a cache hierarchy, NOT access control, payment, entitlement, or DRM, and
 * there are no signed URLs, downloads, or delivery here. `clear()` defaults to a
 * deliberate no-op so a shared origin (R2) is never bulk-wiped.
 */

import { canCacheAsset } from "./policy.js";
import type { AssetCache, AssetKey, CachedAsset } from "./types.js";

/**
 * One layer in the chain. `cache` is the adapter; `writable` lets writes (direct
 * puts and warm-fills) target it; `volatile` marks a layer whose contents are
 * disposable (in-memory / peer cache) so a `"volatile"` clear may wipe it while
 * a durable origin (R2) is left intact.
 */
export interface AssetCacheLayer {
  readonly name: string;
  readonly cache: AssetCache;
  readonly writable: boolean;
  readonly volatile: boolean;
}

/**
 * - `fallback`:  return the first hit; do not back-populate earlier layers.
 * - `warm-fill`: return the first hit AND copy it into the preceding writable
 *   layers (each re-gated by `canCacheAsset`; failures are ignored).
 */
export type CompositeReadStrategy = "fallback" | "warm-fill";

/**
 * - `first-writable`: write only to the first writable layer.
 * - `all-writable`:   write to every writable layer.
 */
export type CompositeWriteStrategy = "first-writable" | "all-writable";

/**
 * - `none`:     `clear()` does nothing (default; never bulk-wipes a shared origin).
 * - `volatile`: `clear()` clears only the `volatile` layers, leaving the origin.
 */
export type CompositeClearStrategy = "none" | "volatile";

export interface CompositeAssetCacheOptions {
  /** Ordered layers; reads fall through front to back (e.g. R2 → MeshKV → memory). */
  readonly layers: readonly AssetCacheLayer[];
  /** Back-populate preceding layers on a lower hit. Default `"warm-fill"`. */
  readonly readStrategy?: CompositeReadStrategy;
  /** Where direct writes land. Default `"first-writable"`. */
  readonly writeStrategy?: CompositeWriteStrategy;
  /** What `clear()` does. Default `"none"` (no-op). */
  readonly clearStrategy?: CompositeClearStrategy;
  /**
   * Gate every write through `canCacheAsset` (default true). Keep it on — it is
   * the guardrail that keeps private/paid/sensitive bytes out of every layer.
   */
  readonly enforcePolicy?: boolean;
}

/**
 * `AssetCache` over an ordered list of layers. Holds no bytes of its own: it
 * delegates storage to the layers, which each clone/normalize on `put`. The
 * composite never mutates the asset it is handed.
 */
export class CompositeAssetCache implements AssetCache {
  readonly #layers: readonly AssetCacheLayer[];
  readonly #readStrategy: CompositeReadStrategy;
  readonly #writeStrategy: CompositeWriteStrategy;
  readonly #clearStrategy: CompositeClearStrategy;
  readonly #enforcePolicy: boolean;

  constructor(options: CompositeAssetCacheOptions) {
    this.#layers = [...options.layers];
    this.#readStrategy = options.readStrategy ?? "warm-fill";
    this.#writeStrategy = options.writeStrategy ?? "first-writable";
    this.#clearStrategy = options.clearStrategy ?? "none";
    this.#enforcePolicy = options.enforcePolicy ?? true;
  }

  /** The layer names, front to back (diagnostics only). */
  get layerNames(): readonly string[] {
    return this.#layers.map((layer) => layer.name);
  }

  async get(key: AssetKey, now: number): Promise<CachedAsset | undefined> {
    for (let i = 0; i < this.#layers.length; i++) {
      const hit = await this.#layers[i]!.cache.get(key, now);
      if (hit !== undefined) {
        if (this.#readStrategy === "warm-fill" && i > 0) {
          await this.#warmFill(hit, i);
        }
        return hit;
      }
    }
    return undefined;
  }

  async has(key: AssetKey, now: number): Promise<boolean> {
    for (const layer of this.#layers) {
      if (await layer.cache.has(key, now)) return true;
    }
    return false;
  }

  async put(asset: CachedAsset): Promise<void> {
    if (this.#enforcePolicy) {
      const decision = canCacheAsset(asset.metadata);
      if (!decision.allowed) {
        throw new Error(`asset not cacheable: ${decision.reason}`);
      }
    }
    for (const layer of this.#layers) {
      if (!layer.writable) continue;
      await layer.cache.put(asset);
      if (this.#writeStrategy === "first-writable") return;
    }
  }

  async delete(key: AssetKey): Promise<void> {
    for (const layer of this.#layers) {
      await layer.cache.delete(key);
    }
  }

  /**
   * Defaults to a no-op so a shared/durable origin is never bulk-wiped. With the
   * `"volatile"` strategy it clears only the volatile layers (local/peer caches),
   * leaving non-volatile layers (e.g. R2 origin) untouched.
   */
  async clear(): Promise<void> {
    if (this.#clearStrategy !== "volatile") return;
    for (const layer of this.#layers) {
      if (layer.volatile) await layer.cache.clear();
    }
  }

  /**
   * Copies a hit into the writable layers that precede the one it came from. Each
   * fill is re-gated by `canCacheAsset` and isolated in a try/catch — a failing
   * warm-fill never breaks the read it was optimizing.
   */
  async #warmFill(asset: CachedAsset, hitIndex: number): Promise<void> {
    if (!canCacheAsset(asset.metadata).allowed) return;
    for (let i = 0; i < hitIndex; i++) {
      const layer = this.#layers[i]!;
      if (!layer.writable) continue;
      try {
        await layer.cache.put(asset);
      } catch {
        /* warm-fill is best-effort — ignore failures */
      }
    }
  }
}
