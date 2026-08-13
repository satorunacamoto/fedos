/**
 * Commerce E2E Completion arc (Wave B, Agent I) — `IpfsMediaStore`, an
 * OPTIONAL `MediaStorePort` adapter (`./media_store_port.ts`). This is the
 * ONE file under `src/os/commerce/` allowed to know about IPFS/CID
 * shapes — every other file in this domain stays IPFS-agnostic, reaching
 * IPFS only through the plain `MediaStorePort` interface if/when a real
 * composition root chooses this adapter over `./local_media_store.ts`.
 *
 * ============================================================
 * A CID IS METADATA, NOT CONFIDENTIALITY — NEVER AN ANONYMITY CLAIM.
 * ============================================================
 * Nothing about storing bytes under a content-addressed CID makes them
 * private, and nothing about fetching a CID over IPFS makes the fetch
 * anonymous. This file makes neither claim anywhere, in code or comment.
 * `./network_profile.ts`'s own header carries the transport-side version
 * of this same caveat (Tor is a routing choice, never an anonymity
 * guarantee) — the two files deliberately repeat each other so neither
 * can be read in isolation as implying a privacy property this arc does
 * not actually provide.
 *
 * ENCRYPT-FIRST FOR PROTECTED MEDIA: `MediaStorePort.put()` itself
 * (`./media_store_port.ts`) has NO `classification` field on
 * `MediaStorePutRequest` — by design, per that Port's own header,
 * classification-awareness lives ONE layer up, in
 * `./product_media_encryption.ts`/`./product_media_types.ts`. This file
 * mirrors that same separation, but ALSO exposes small, domain-specific
 * convenience methods beyond the bare `MediaStorePort` surface —
 * `putProtected()`/`putPublic()`/`getProtected()` — so a caller cannot
 * accidentally hand this adapter plaintext for protected media the way a
 * bare `put()` call always could. `putProtected()` is the ENFORCEMENT
 * MECHANISM this arc's brief asks for ("a protected-classified put is
 * REJECTED or forced through encryption, your call on the exact
 * mechanism, document it"): it is `async`, it ALWAYS calls the injected
 * `ProductMediaEncryptionPort` first, and it structurally CANNOT reach
 * `this.put()` with plaintext bytes — there is no code path in
 * `putProtected()` between "received plaintext" and "call put()" that
 * skips the encryption step. If encryption is unavailable/fails, it
 * returns `{ outcome: "failed" }` (an existing `MediaStorePutResult`
 * outcome — no new outcome invented) and `put()` is never called at all.
 * `getProtected()` (Commerce FINAL Closure arc, Agent M) is the read-side
 * mirror: it ALWAYS runs the fetched bytes through the injected
 * `ProductMediaDecryptionPort` and never returns ciphertext mislabeled as
 * plaintext. `putProtected()`/`putPublic()`/`getProtected()` are plain
 * additive methods on this class, not part of the `MediaStorePort`
 * interface itself — the Port's own shape is unchanged
 * (`media_store_port.ts` is not modified by this arc).
 *
 * DEFAULT ENCRYPTION/DECRYPTION (Commerce FINAL Closure arc, Agent M):
 * `encryption`/`decryption` now default to the REAL
 * `WasmProductMediaEncryption`/`WasmProductMediaDecryption` adapters
 * (`./wasm_product_media_encryption.ts`/`./wasm_product_media_decryption.ts`)
 * rather than to the permanently-`null` `UnavailableProductMediaEncryption`/
 * `UnavailableProductMediaDecryption` (`./product_media_encryption.ts`/
 * `./product_media_decryption.ts`). This is a SAFE, additive change:
 * both real adapters fail closed to `null` exactly like the `Unavailable*`
 * pair whenever no real, unlocked `FedosMasterSeedAuthority` is supplied
 * (the default, zero-argument case — see `WasmProductMediaEncryption`'s
 * own header) — there is still, and will never be, a code path that
 * silently downgrades protected media to plaintext. What changes is that
 * a caller who explicitly injects the app's real, already-unlocked,
 * SHARED `FedosMasterSeedAuthority` instance (mirroring
 * `fedos_conversation_production_crypto_authority_factory.ts`'s own
 * "one Authority instance, shared across every Authority that needs it"
 * pattern — a genuine composition-root responsibility, out of scope for
 * this file/arc to perform itself) now gets REAL encryption/decryption
 * from the ordinary, un-overridden constructor default, with no need to
 * separately know about or import either Wasm adapter class themselves.
 *
 * BLOCKER 4 FIX (Buyer Discovery + Digital Content Delivery mega-arc,
 * Agent M) — `docs/commerce/PROTECTED-MEDIA-CROSS-PROCESS-REACHABILITY.md`'s
 * own "Blocker 4" section documented (and
 * `docs/commerce/usability-v2/SELLER-TABLETOP-AFTER.md`'s live-reproduced
 * P1 "image storage failed: failed" independently confirmed) that `put()`/
 * `get()` used to call `evaluateNetworkAccess(this.#networkProfile, true)`
 * — a HARD-CODED `requiresNetwork: true` — regardless of what the actual
 * injected `IpfsTransport` does. Every real caller in this codebase
 * (`commerceMediaStoreFor()`, `fedos_electron_beta_main.cts`) constructs
 * this store with the ONLY `IpfsTransport` implementation that exists,
 * `InMemoryIpfsTransport` (a `Map`, this file's own header — no real
 * network reach anywhere), against `networkProfile: "local-only"`. Since
 * `"local-only"` refuses any `requiresNetwork: true` call
 * (`./network_profile.ts`'s own `evaluateNetworkAccess()`), EVERY put/get
 * against a store that has ZERO actual network dependency failed
 * unconditionally — a policy bug, not a genuine security boundary: nothing
 * about writing to a `Map` "requires network access" in the sense
 * `NetworkProfile` exists to gate.
 *
 * The fix: `IpfsTransport` itself now declares `readonly requiresNetwork:
 * boolean` — an honest, transport-specific self-report of whether ITS OWN
 * `add()`/`cat()` calls actually reach a network, mirroring `pin()`'s own
 * "best-effort, transport tells the truth about itself" contract just
 * above. `put()`/`get()` below now call `evaluateNetworkAccess(profile,
 * this.#transport.requiresNetwork)` — the transport's own honest claim,
 * never a blanket `true`. `InMemoryIpfsTransport.requiresNetwork` is
 * `false` (it is, honestly, always local), so a seller's own local
 * protected-media store now genuinely durably stores and retrieves their
 * own content under the default `"local-only"` profile — while a FUTURE
 * real network-backed `IpfsTransport` (not built by this arc) that
 * honestly declares `requiresNetwork: true` is STILL correctly refused
 * under `"local-only"`, exactly as `NetworkProfile`'s own contract
 * promises. No network-egress gating that exists for a real reason is
 * weakened by this change — only the false "everything needs the network"
 * assumption is corrected. See `../../../test/commerce_ipfs_media_store.test.ts`
 * (test 16, rewritten this arc) for the regression coverage: a
 * network-REQUIRING fake transport is still refused under `"local-only"`,
 * while the real, always-local `InMemoryIpfsTransport` is now allowed.
 *
 * SYNCHRONOUS PORT, AND WHY THIS ADAPTER STAYS SYNCHRONOUS TOO: every
 * `MediaStorePort` method (`put`/`get`/`exists`/`remove`/`metadata`) is a
 * plain, NON-`Promise`-returning function — `./local_media_store.ts`'s
 * own signature, unchanged here. A REAL, network-backed IPFS transport is
 * inherently asynchronous (an HTTP call to a gateway, a libp2p round
 * trip), which the current synchronous `MediaStorePort` shape cannot
 * honestly wrap without either (a) blocking the event loop, which no real
 * transport can do, or (b) widening the Port to return `Promise`s, an
 * existing-Port-shape change this arc's own brief says to avoid unless a
 * GENUINE gap is found and explicitly justified. This file resolves that
 * tension by keeping `IpfsTransport` itself synchronous — a deliberate,
 * explicitly-documented scope decision, NOT an oversight: this adapter
 * (and the `MediaStorePort` contract it satisfies) is built and proven
 * against a synchronous, deterministic, in-memory FAKE transport only
 * (`InMemoryIpfsTransport` below). A genuinely network-backed
 * `IpfsTransport` implementation is future, out-of-scope work; bridging a
 * truly async transport under this still-synchronous Port (e.g. via a
 * pre-fetch/cache layer, or a Port-widening change reviewed and applied
 * elsewhere) is an OPEN design question this file does not resolve or
 * paper over. `putProtected()` is the one async method this file adds
 * (because `ProductMediaEncryptionPort.encrypt()` is itself `async` —
 * `./product_media_encryption.ts`), but even it only calls the
 * synchronous `IpfsTransport`/`put()` methods once encryption has already
 * finished.
 */

import { computeCommerceMediaContentHash, verifyCommerceMediaContentAddress } from "./product_media_content_address.js";
import {
  contentAddressPublicMedia,
  encryptThenContentAddressProtectedMedia,
  type ProductMediaEncryptionPort,
} from "./product_media_encryption.js";
import { WasmProductMediaEncryption } from "./wasm_product_media_encryption.js";
import type { ProductMediaDecryptionPort } from "./product_media_decryption.js";
import { WasmProductMediaDecryption } from "./wasm_product_media_decryption.js";
import type {
  MediaObject,
  MediaObjectMetadata,
  MediaStorePort,
  MediaStorePutRequest,
  MediaStorePutResult,
} from "./media_store_port.js";
import { evaluateNetworkAccess, type NetworkProfile } from "./network_profile.js";

/**
 * Injectable seam for the actual IPFS backend — deliberately shaped after
 * IPFS's own three primitive operations (`add`/`cat`/`pin`), never a
 * generic HTTP client, so a real adapter's own IPFS-specific request
 * shaping stays out of this file too. Synchronous by design — see this
 * file's own header for why.
 *
 * `add`/`cat` return `null` (never throw, by CONTRACT — this adapter
 * additionally wraps every call in `try`/`catch` as defense-in-depth in
 * case a real implementation violates that contract) on any failure:
 * offline, unknown CID, malformed content, or any other backend error.
 * `pin` is best-effort only and never affects content-addressing
 * correctness — a `false` return means "not pinned," never "not stored."
 */
export interface IpfsTransport {
  /** Adds `bytes` to the backend, returning its CID, or `null` on failure. */
  add(bytes: Uint8Array): string | null;
  /** Retrieves the bytes for `cid`, or `null` if unknown/unavailable/offline. */
  cat(cid: string): Uint8Array | null;
  /** Best-effort pin; `true` iff the backend confirms the CID is pinned. Never required for `get()`/`exists()` to succeed. */
  pin(cid: string): boolean;
  /**
   * BLOCKER 4 FIX (this file's own header) — an HONEST, transport-specific
   * self-report of whether `add()`/`cat()` actually reach a network. A
   * purely local/in-memory transport (`InMemoryIpfsTransport` below)
   * declares `false`; a future real network-backed transport (gateway
   * HTTP call, libp2p round trip — not built by this arc) MUST declare
   * `true`. `IpfsMediaStore.put()`/`get()` consult this — never a
   * hard-coded assumption either way — before calling
   * `evaluateNetworkAccess()`.
   */
  readonly requiresNetwork: boolean;
}

/**
 * A deterministic, in-memory, `Map`-backed `IpfsTransport` — the ONLY
 * transport this arc's own tests use. No network, no real IPFS node.
 * CIDs here are a fixed, deterministic, content-addressed label derived
 * from the SAME `computeCommerceMediaContentHash()`
 * (`./product_media_content_address.ts`) every other content-addressing
 * spot in this domain already uses — prefixed `"fake-cid:"` so nothing
 * could mistake this for a real multibase/multihash CID string.
 * Constructor options let a test simulate an offline/unavailable backend
 * (`simulateOffline: true` makes `add`/`cat` always return `null`, mirrring
 * a real network outage) without needing a second transport
 * implementation.
 */
export class InMemoryIpfsTransport implements IpfsTransport {
  readonly #objects = new Map<string, Uint8Array>();
  readonly #pinned = new Set<string>();
  #simulateOffline: boolean;
  /** BLOCKER 4 FIX (this file's own header) — always `false`: a `Map` never reaches a network, honestly, under any circumstance. */
  readonly requiresNetwork = false;

  constructor(options: { readonly simulateOffline?: boolean } = {}) {
    this.#simulateOffline = options.simulateOffline ?? false;
  }

  /** Test-only toggle — flips whether this transport behaves as offline from this call onward. Never used by any real (non-test) code path. */
  setSimulateOffline(offline: boolean): void {
    this.#simulateOffline = offline;
  }

  add(bytes: Uint8Array): string | null {
    if (this.#simulateOffline) return null;
    const cid = `fake-cid:${computeCommerceMediaContentHash(bytes)}`;
    this.#objects.set(cid, Uint8Array.from(bytes));
    return cid;
  }

  cat(cid: string): Uint8Array | null {
    if (this.#simulateOffline) return null;
    const bytes = this.#objects.get(cid);
    return bytes === undefined ? null : Uint8Array.from(bytes);
  }

  pin(cid: string): boolean {
    if (this.#simulateOffline) return false;
    if (!this.#objects.has(cid)) return false;
    this.#pinned.add(cid);
    return true;
  }

  /** Test-only introspection — never part of `IpfsTransport`. */
  isPinned(cid: string): boolean {
    return this.#pinned.has(cid);
  }

  /**
   * Test-only corruption helper: overwrites already-stored bytes for
   * `cid` with `corruptedBytes` WITHOUT updating any externally-recorded
   * checksum — simulates a compromised/misbehaving IPFS node returning
   * the wrong content for a CID, so `IpfsMediaStore.get()`'s own
   * defensive re-check (this file's header) can be proven to catch it.
   * Never used by any real (non-test) code path.
   */
  corruptStoredBytes(cid: string, corruptedBytes: Uint8Array): void {
    this.#objects.set(cid, Uint8Array.from(corruptedBytes));
  }
}

interface StoredEntryMetadata {
  readonly metadata: MediaObjectMetadata;
}

export class IpfsMediaStore implements MediaStorePort {
  readonly #transport: IpfsTransport;
  readonly #maxPayloadByteLength: number;
  readonly #supportedContentTypes: ReadonlySet<string>;
  readonly #encryption: ProductMediaEncryptionPort;
  readonly #decryption: ProductMediaDecryptionPort;
  readonly #networkProfile: NetworkProfile;
  readonly #now: () => number;
  /** Local metadata index, keyed by CID — the transport itself only knows bytes, never our descriptor shape. Mirrors `LocalMediaStore`'s own `#objects` map, minus the bytes (the transport already holds those). */
  readonly #index = new Map<string, StoredEntryMetadata>();

  /**
   * Commerce FINAL Closure arc (Agent M) — `encryption`/`decryption` now
   * DEFAULT to the REAL `WasmProductMediaEncryption`/`WasmProductMediaDecryption`
   * adapters (`./wasm_product_media_encryption.ts`/
   * `./wasm_product_media_decryption.ts`), no longer to
   * `UnavailableProductMediaEncryption`. See this file's own header
   * ("ENCRYPT-FIRST FOR PROTECTED MEDIA") for the enforcement mechanism
   * this does not change, and `WasmProductMediaEncryption`'s own header
   * for exactly what this default does and does not achieve on its own
   * (still fails closed absent a real, unlocked, injected
   * `FedosMasterSeedAuthority` — never a plaintext downgrade either way).
   * `decryption` is a NEW parameter this arc adds, appended LAST so every
   * pre-existing positional call site (including this arc's own
   * predecessor's tests, which pass up to `networkProfile` positionally)
   * keeps meaning exactly what it meant before.
   */
  constructor(
    transport: IpfsTransport,
    maxPayloadByteLength: number,
    supportedContentTypes: readonly string[],
    encryption: ProductMediaEncryptionPort = new WasmProductMediaEncryption(),
    networkProfile: NetworkProfile = "direct",
    now: () => number = Date.now,
    decryption: ProductMediaDecryptionPort = new WasmProductMediaDecryption(),
  ) {
    this.#transport = transport;
    this.#maxPayloadByteLength = maxPayloadByteLength;
    this.#supportedContentTypes = new Set(supportedContentTypes);
    this.#encryption = encryption;
    this.#networkProfile = networkProfile;
    this.#now = now;
    this.#decryption = decryption;
  }

  /**
   * `MediaStorePort.put()` — stores whatever bytes it is given (already
   * ciphertext for protected media, already plaintext for public media;
   * see this file's own header). Content-addresses via the transport's
   * own `add()`, recording our own SHA-256 checksum locally for `get()`'s
   * defensive re-check (below) since a CID is not, in general, our own
   * hash space (see `./media_store_port.ts`'s "Extension point" section).
   */
  put(request: MediaStorePutRequest): MediaStorePutResult {
    if (request.bytes.length > this.#maxPayloadByteLength) {
      return { outcome: "oversized" };
    }
    if (!this.#supportedContentTypes.has(request.contentType)) {
      return { outcome: "unsupported-content-type" };
    }
    // BLOCKER 4 FIX (this file's own header) — the TRANSPORT's own honest
    // self-report, never a hard-coded `true`.
    if (!evaluateNetworkAccess(this.#networkProfile, this.#transport.requiresNetwork).allowed) {
      return { outcome: "failed" };
    }

    const checksum = computeCommerceMediaContentHash(request.bytes);

    let cid: string | null;
    try {
      cid = this.#transport.add(request.bytes);
    } catch {
      cid = null;
    }
    if (cid === null) {
      return { outcome: "failed" };
    }

    const existing = this.#index.get(cid);
    if (existing !== undefined) {
      if (existing.metadata.contentType === request.contentType) {
        return { outcome: "already-present", metadata: existing.metadata };
      }
      // Same CID, different claimed contentType — refuse rather than silently pick a winner (mirrors LocalMediaStore's own "conflict" reasoning).
      return { outcome: "conflict" };
    }

    // Best-effort pin — never affects the stored/content-addressed outcome either way (this file's own header).
    try {
      this.#transport.pin(cid);
    } catch {
      // Pinning failure is not a storage failure.
    }

    const metadata: MediaObjectMetadata = {
      key: cid,
      contentType: request.contentType,
      sizeBytes: request.bytes.length,
      checksum,
      storedAt: this.#now(),
    };
    this.#index.set(cid, { metadata });
    return { outcome: "stored", metadata };
  }

  /**
   * `MediaStorePort.get()` — fetches via the transport, then re-verifies
   * the returned bytes actually hash to the checksum WE recorded at
   * `put()` time before ever returning them (fail closed — `null` — on
   * any mismatch). This is the exact defensive re-check
   * `./media_store_port.ts`'s own "Extension point for a future
   * IpfsMediaStore" section requires of every adapter, and the exact
   * mechanism a wrong-CID/tampered-content acceptance test proves.
   */
  get(key: string): MediaObject | null {
    const entry = this.#index.get(key);
    if (entry === undefined) return null;
    // BLOCKER 4 FIX (this file's own header) — the TRANSPORT's own honest
    // self-report, never a hard-coded `true`.
    if (!evaluateNetworkAccess(this.#networkProfile, this.#transport.requiresNetwork).allowed) return null;

    let bytes: Uint8Array | null;
    try {
      bytes = this.#transport.cat(key);
    } catch {
      bytes = null;
    }
    if (bytes === null) return null;

    if (!verifyCommerceMediaContentAddress(bytes, entry.metadata.checksum)) return null;
    return { metadata: entry.metadata, bytes };
  }

  exists(key: string): boolean {
    return this.#index.has(key);
  }

  remove(key: string): boolean {
    // Content-addressed storage: this adapter drops its own local index entry (mirrors LocalMediaStore's own remove()); it does not attempt an IPFS "unpin everywhere" guarantee, which no local caller can honestly promise for a globally-replicated backend. This is a scope decision, not an oversight -- an "unpin" is a best-effort local hint at most, so this method's contract stays "no longer known/served by THIS index," matching `MediaStorePort.remove()`'s own doc ("removed" from this Port's perspective).
    return this.#index.delete(key);
  }

  metadata(key: string): MediaObjectMetadata | null {
    return this.#index.get(key)?.metadata ?? null;
  }

  /**
   * ENFORCEMENT MECHANISM for protected media — see this file's own
   * header. Always runs `plaintext` through the injected
   * `ProductMediaEncryptionPort` FIRST; only a genuine ciphertext result
   * ever reaches `put()`. Returns `{ outcome: "failed" }` (never throws,
   * never falls back to storing plaintext) if encryption is unavailable
   * or fails for any reason.
   */
  async putProtected(plaintext: Uint8Array, contentType: string): Promise<MediaStorePutResult> {
    const encrypted = await encryptThenContentAddressProtectedMedia(plaintext, this.#encryption);
    if (encrypted.outcome !== "ok") {
      return { outcome: "failed" };
    }
    return this.put({ bytes: encrypted.ciphertext, contentType });
  }

  /**
   * Convenience symmetry with `putProtected()` for explicitly public
   * media — content-addresses and stores `plaintext` bytes directly, no
   * encryption step, exactly as `./product_media_encryption.ts`'s own
   * `contentAddressPublicMedia()` permits for public media. Included for
   * call-site symmetry; a bare `put()` call does exactly the same thing.
   */
  putPublic(plaintext: Uint8Array, contentType: string): MediaStorePutResult {
    contentAddressPublicMedia(plaintext); // computed for symmetry/documentation of intent only -- put() derives its own checksum identically.
    return this.put({ bytes: plaintext, contentType });
  }

  /**
   * Commerce FINAL Closure arc (Agent M) — the decrypt-direction
   * counterpart to `putProtected()`. Fetches `key` through the ORDINARY
   * `get()` path first — meaning the exact same defensive
   * content-address re-check (this file's own header) already runs on
   * the fetched CIPHERTEXT bytes before this method ever hands them to
   * `#decryption` — then decrypts. Returns `null` (never throws) if the
   * object is missing/unavailable/tampered (same as a bare `get()`
   * miss), OR if decryption itself fails for any reason (wrong key,
   * wrong domain, tampered ciphertext despite passing the content-address
   * check, crypto unavailable). Never returns ciphertext mislabeled as
   * plaintext, and never partially decrypts.
   */
  async getProtected(key: string): Promise<Uint8Array | null> {
    const stored = this.get(key);
    if (stored === null) return null;
    try {
      return await this.#decryption.decrypt(stored.bytes);
    } catch {
      return null;
    }
  }
}
