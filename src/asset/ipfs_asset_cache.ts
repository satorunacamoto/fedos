/**
 * Stage 43 — IPFS asset adapter boundary (types + Noop/Placeholder only).
 *
 * IPFS is a candidate FUTURE origin/backend for the public `AssetCache`
 * boundary (alongside R2 and MeshKV), for public/unlisted media only. This
 * file ships ONLY the boundary shape: an `IpfsClient` interface, a
 * `NoopIpfsClient` (the safe, permanently-unavailable default), and
 * `IpfsAssetCache` / `PlaceholderIpfsAssetCache` — adapters that gate every
 * write through `canCacheAsset` and otherwise behave as a pure policy check.
 *
 * NOT IMPLEMENTED, ON PURPOSE: no real IPFS node, no gateway `fetch`, no
 * pinning service call, and no upload/download of bytes. `IpfsAssetCache`
 * NEVER calls the injected `IpfsClient`'s `get`/`put`/`pin`/`unpin` — a
 * successful `put()` here means only "this asset passed the public-asset
 * policy", not that anything was sent to IPFS or is retrievable. `get`/`has`
 * always report a miss and `delete`/`clear` are safe no-ops. This keeps the
 * adapter honest about doing nothing until a real backend boundary is
 * designed in a later stage.
 *
 * SCOPE GUARDRAILS: public/unlisted assets only. `private`/`paid` visibility
 * and any `dm`/`secret`/`key`/`payment`/`entitlement` tag are rejected by the
 * same `canCacheAsset` policy used by R2/MeshKV — no purchased original, DM
 * payload, secret, key material, or payment/entitlement data may ever be
 * pointed at IPFS. A CID is NOT a secret and NEVER an authorization token:
 * anyone who has (or guesses/enumerates) a CID can fetch that content from any
 * public gateway or node that pins it, and unpinning does not guarantee
 * deletion (other nodes may still hold and re-serve the data indefinitely).
 * This file is not wired into the runtime or the Worker.
 */

import { canCacheAsset } from "./policy.js";
import type { AssetCache, AssetKey, AssetMetadata, CachedAsset } from "./types.js";

/**
 * The transport a future real IPFS-backed `AssetCache` would write through.
 * `IpfsAssetCache` in this stage never calls any of these methods — the
 * interface exists so a real client (or a test double) can be typed and
 * injected later without changing the adapter's public shape.
 */
export interface IpfsClient {
  get(cid: string): Promise<ArrayBuffer | null>;
  put(bytes: ArrayBuffer, metadata: AssetMetadata): Promise<{ readonly cid: string }>;
  pin?(cid: string): Promise<void>;
  unpin?(cid: string): Promise<void>;
}

/**
 * The safe default `IpfsClient`: opens no node connection, contacts no
 * gateway, and pins nothing. Every read is a miss and every write is
 * `unavailable` — there is no backend behind this client.
 */
export class NoopIpfsClient implements IpfsClient {
  constructor() {
    // Does nothing: no node, no gateway, no pinning service is contacted.
  }

  async get(_cid: string): Promise<ArrayBuffer | null> {
    // No gateway/node is contacted; this is always a miss.
    return null;
  }

  async put(_bytes: ArrayBuffer, _metadata: AssetMetadata): Promise<{ readonly cid: string }> {
    // No node is contacted and no bytes are sent anywhere; there is nothing
    // to mint a CID for, so this always rejects rather than fabricate one.
    throw new Error("NoopIpfsClient: unavailable — no IPFS backend is configured (nothing was sent)");
  }

  async pin(_cid: string): Promise<void> {
    // No pinning service is contacted.
    throw new Error("NoopIpfsClient: unavailable — no IPFS backend is configured (nothing was pinned)");
  }

  async unpin(_cid: string): Promise<void> {
    // No pinning service is contacted.
    throw new Error("NoopIpfsClient: unavailable — no IPFS backend is configured (nothing was unpinned)");
  }
}

export interface IpfsAssetCacheOptions {
  /**
   * Reserved for a future real backend. `IpfsAssetCache` never calls this
   * client's methods in this stage — see the module doc comment. Defaults to
   * `NoopIpfsClient` when omitted.
   */
  readonly client?: IpfsClient;
  /**
   * Reject non-cacheable assets on `put` (default true). This is the
   * guardrail that keeps private/paid/sensitive bytes from ever being
   * considered for IPFS — keep it on.
   */
  readonly enforcePolicy?: boolean;
}

/**
 * `AssetCache` boundary for a future IPFS backend. `put` runs the same
 * `canCacheAsset` policy as R2/MeshKV and then STOPS — it never calls the
 * injected client, pins nothing, and stores nothing. `get`/`has` always
 * report a miss and `delete`/`clear` are safe no-ops that never issue a real
 * unpin/delete. A "cacheable" decision here is a policy check only, not a
 * promise that the asset is stored or retrievable.
 */
export class IpfsAssetCache implements AssetCache {
  readonly #client: IpfsClient;
  readonly #enforcePolicy: boolean;

  constructor(options: IpfsAssetCacheOptions = {}) {
    this.#client = options.client ?? new NoopIpfsClient();
    this.#enforcePolicy = options.enforcePolicy ?? true;
  }

  /** Exposed for callers/tests that want to confirm which client is held (never invoked). */
  get client(): IpfsClient {
    return this.#client;
  }

  /**
   * Policy check only. Rejects private/paid/sensitive-tag assets by throwing.
   * For an allowed asset, resolves without calling any IPFS client, node, or
   * gateway, and without storing or pinning anything.
   */
  async put(asset: CachedAsset): Promise<void> {
    if (this.#enforcePolicy) {
      const decision = canCacheAsset(asset.metadata);
      if (!decision.allowed) {
        throw new Error(`asset not cacheable: ${decision.reason}`);
      }
    }
    // Deliberately does not call this.#client.put/pin — see class doc.
  }

  /** Always a miss: no IPFS node/gateway is ever contacted in this stage. */
  async get(_key: AssetKey, _now: number): Promise<CachedAsset | undefined> {
    return undefined;
  }

  /** Always false: nothing is ever actually stored/pinned in this stage. */
  async has(_key: AssetKey, _now: number): Promise<boolean> {
    return false;
  }

  /** Safe no-op: never issues a real unpin/delete call. */
  async delete(_key: AssetKey): Promise<void> {
    /* intentionally does nothing — see the class doc comment */
  }

  /** Safe no-op: never issues a real bulk unpin/delete call. */
  async clear(): Promise<void> {
    /* intentionally does nothing — see the class doc comment */
  }
}

/**
 * The concrete, always-safe default: `IpfsAssetCache` constructed with a
 * `NoopIpfsClient` and no way to swap in a different client. Use this until a
 * real IPFS backend boundary is designed in a later stage.
 */
export class PlaceholderIpfsAssetCache extends IpfsAssetCache {
  constructor(enforcePolicy?: boolean) {
    super({ client: new NoopIpfsClient(), ...(enforcePolicy !== undefined ? { enforcePolicy } : {}) });
  }
}

/** CIDv0: multihash sha2-256, base58btc, "Qm" + 44 chars. */
const CIDV0_RE = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
/** CIDv1: multibase-prefixed. Common cases: base32 lowercase ("b…"), base58btc ("z…"). */
const CIDV1_BASE32_RE = /^b[a-z2-7]{20,}$/;
const CIDV1_BASE58_RE = /^z[1-9A-HJ-NP-Za-km-z]{20,}$/;

/**
 * True if `value` is SHAPED like a CID (CIDv0 or common CIDv1 multibase
 * forms). This is a plausibility check only — it never contacts a node or
 * gateway, never resolves or dereferences the CID, and does not verify the
 * multihash/digest. A CID is public, non-secret metadata; this helper must
 * NEVER be used to grant access or treat the value as an authorization token.
 */
export function isIpfsCidLike(value: unknown): boolean {
  if (typeof value !== "string" || value.length === 0) return false;
  return CIDV0_RE.test(value) || CIDV1_BASE32_RE.test(value) || CIDV1_BASE58_RE.test(value);
}

/**
 * Maps an opaque `AssetCache` key to an IPFS ref, WITHOUT ever fabricating or
 * resolving a CID. `AssetKey`s produced by `createAssetKey` are `asset:<hash>`
 * tokens, not CIDs, so this returns `null` for them (and for anything else
 * that isn't already CID-shaped). It is provided so future code has a single,
 * honest place to ask "is this key already a CID?" instead of guessing.
 */
export function assetKeyToIpfsRef(key: AssetKey): string | null {
  return isIpfsCidLike(key) ? key : null;
}
