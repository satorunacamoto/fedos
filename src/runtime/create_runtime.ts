/**
 * Secure Runtime Alpha 8281-8360 -- Production Cleanup and Repository
 * Consolidation Arc: **this is NOT the FedOS Secure Messenger Desktop
 * Beta's production Runtime.** This file builds `AppRuntime`, the Runtime
 * for the ORIGINAL "nostr-window" product (`src/worker.ts`, a Cloudflare
 * Worker) -- the repository's earliest product, still real and still
 * tested (295 test files), but with no deployment configuration in this
 * repository today (no `wrangler.toml`, no `deploy` script). The shipped
 * Desktop app never constructs an `AppRuntime` and has its own, entirely
 * separate crypto/Runtime path: `src/desktop/production_activation/*`,
 * reached from `packages/fedos-desktop-electron-spike/`. If you are
 * looking for how the Desktop app boots its Runtime or activates crypto,
 * start there instead. See `docs/reviews/fedos_dead_runtime_production_path_v1/`
 * (Dead Runtime Paths / Production-Path Consolidation V1 review) for the
 * full traced graph of both products and why they coexist in one
 * repository. Nothing below this banner is changed by this Arc --
 * `AppRuntime`/`initializeCrypto()`/`PrototypeDisabled` remain exactly as
 * documented, kept intentionally (108-295 test files depend on this
 * object's shape; see that review's own `09`/`12` for why deleting it is
 * explicitly NOT recommended).
 */

/**
 * Stage 21 — `createRuntime`: the one place that picks every boundary.
 *
 * Each `select*` reads (never mutates) the `RuntimeEnv` and returns a concrete
 * implementation, preferring a real Cloudflare-backed adapter when its binding /
 * config is present and otherwise a test/local-safe in-memory or mock default.
 * `createRuntime` just composes them, letting `overrides` win.
 *
 * Guardrails: building a runtime starts NO external communication. No relay
 * socket is opened, no `fetch` is issued, nothing is published, and no signer is
 * invoked. The promotion endpoint, when present, only selects an adapter that is
 * READY to call out — it is not called here, and the Worker still shows no real
 * ads. The in-memory cache / directory / index defaults are shared module-level
 * singletons so state survives across requests in one isolate.
 *
 * Stage 691 (Prototype Phase 001) adds `initializeCrypto`
 * (`createRuntimeInitializeCryptoResult`) to the assembled `AppRuntime` — a
 * fixed, side-effect-free prototype ALWAYS resolving `{ allowed: false,
 * initialized: false, reason: "PrototypeDisabled" }`. It calls no Facade,
 * Loader, WASM, or Rust code (no `packages/fedos-core-rust` reference of any
 * kind, no `fedos_*.ts` planning-layer reference, no `import()` of any kind),
 * and does not touch the pre-existing `cryptoProvider`/`crypto` selection
 * above. See `docs/runtime_initialize_crypto_prototype.md`.
 *
 * Stage 697 (Prototype Phase 002) extends `createRuntimeInitializeCryptoResult`
 * ONE link deeper — it now calls `createCryptoLoaderFacade()`
 * (`fedos_crypto_loader_facade.ts`, Stage 594) and DISCARDS the result;
 * the function's own return value stays UNCHANGED (`{ allowed: false,
 * initialized: false, reason: "PrototypeDisabled" }`). This is the SAME
 * "reach one link deeper, keep your own answer" pattern already
 * established throughout the `fedos_*.ts` `PlanningOnly` chain. Runtime
 * reaches ONLY the Facade — it does not call the Provider/Facade
 * Boundary, the WASM Loader, `WebAssembly`, or Rust directly, and no
 * `import()` of any kind is written here. The existing Facade file
 * itself is UNMODIFIED by this stage.
 *
 * Stage 999 (Secure Runtime Alpha 003) adds `runtimeCapabilities`
 * (`runtimeCapabilities()`, `fedos_runtime_prototype_execution.ts`,
 * Stage 994) to the assembled `AppRuntime` — the FIRST read-only
 * Runtime Capability Reader, per
 * `docs/secure_runtime_alpha_002_public_surface_review.md` §7's own
 * recommendation. It is a SECOND, entirely separate field alongside
 * `initializeCrypto` — `createRuntimeInitializeCryptoResult` itself is
 * UNMODIFIED, still ALWAYS `{ allowed: false, initialized: false,
 * reason: "PrototypeDisabled" }`, and `runtimeCapabilities()`'s own
 * result is never read by, or merged into, it. `runtimeCapabilities()`
 * internally calls `attemptDevOnlyRuntimeRustIntegration()` exactly
 * once — no new Rust call, no new gate, no Worker/Production
 * connection, no Secure Storage of any kind.
 *
 * Stage 1004 (Secure Runtime Alpha 008) adds `randomBytes`
 * (`randomBytes()`, `fedos_runtime_random_bytes.ts`, Stage 1004) to the
 * assembled `AppRuntime` — the FIRST public Crypto API, implementing
 * the four-layer Public Runtime API -> Runtime Service -> Rust Boundary
 * -> Internal Rust architecture end to end for exactly one operation.
 * It is a THIRD, entirely separate field alongside `initializeCrypto`
 * and `runtimeCapabilities` — neither is modified, called, or read by
 * this new field's own implementation. `randomBytes()` internally
 * drives its own fresh `FedosWasmLoader` through the SAME six-condition
 * chain and calls the Rust Boundary's own thin, non-cryptographic
 * wrapper export. No Worker/Production connection, no Secure Storage
 * of any kind, no new build dependency of any kind.
 *
 * Stage 1005 (Secure Runtime Alpha 010) adds `generateAeadKey`
 * (`generateAeadKey()`, `fedos_runtime_aead_key_generation.ts`, Stage
 * 1005) to the assembled `AppRuntime` — the SECOND public Crypto API,
 * mirroring `randomBytes`'s own four-layer reach exactly. It is a
 * FOURTH, entirely separate field alongside `initializeCrypto`/
 * `runtimeCapabilities`/`randomBytes` — none of which is modified,
 * called, or read by this new field's own implementation.
 * `generateAeadKey()` internally drives its own fresh `FedosWasmLoader`
 * through the SAME six-condition chain and calls the Rust Boundary's
 * own thin wrapper export. No Worker/Production connection, no Secure
 * Storage of any kind, no new build dependency of any kind.
 *
 * Stage 1008 (Secure Runtime Alpha 013) — `generateAeadKey()`'s own
 * return shape changes from raw key bytes to an opaque `AeadKeyHandle`,
 * per this arc's own Alpha 012 Key Boundary Decision's deliberate
 * breaking-change decision. This file's own wiring is
 * UNCHANGED — `generateAeadKey` is imported and assigned exactly as
 * before; only the imported function's own return type changed, in
 * `fedos_runtime_aead_key_generation.ts`.
 *
 * Stage 1009 (Secure Runtime Alpha 014) adds `encrypt`
 * (`encrypt()`, `fedos_runtime_encrypt.ts`, Stage 1009) to the assembled
 * `AppRuntime` — the THIRD public Crypto API, and the FIRST performing
 * a real cryptographic operation. It is a FIFTH, entirely separate
 * field alongside `initializeCrypto`/`runtimeCapabilities`/
 * `randomBytes`/`generateAeadKey` — none of which is modified, called,
 * or read by this new field's own implementation. `encrypt()` accepts
 * ONLY an opaque `AeadKeyHandle` (Stage 1008) — never a raw key byte —
 * and internally drives its own fresh `FedosWasmLoader` through the
 * SAME six-condition chain before calling the Rust Boundary's own thin
 * wrapper export. No Worker/Production connection, no Secure Storage of
 * any kind, no new build dependency of any kind. `importKey()`/
 * `exportKey()` remain unimplemented.
 *
 * Stage 1010 (Secure Runtime Alpha 015) adds `decrypt`
 * (`decrypt()`, `fedos_runtime_decrypt.ts`, Stage 1010) to the assembled
 * `AppRuntime` — the FOURTH public Crypto API, and the counterpart to
 * `encrypt`. It is a SIXTH, entirely separate field — none of the
 * five above is modified, called, or read by this new field's own
 * implementation. `decrypt()` accepts ONLY opaque handle values (the
 * SAME key handle and ciphertext handle types `generateAeadKey()`/
 * `encrypt` already produce) — never raw bytes for either — and
 * internally drives its own fresh `FedosWasmLoader` through the SAME
 * six-condition chain before calling the Rust Boundary's own thin
 * wrapper export. No Worker/Production connection, no Secure Storage
 * of any kind, no new build dependency of any kind. `importKey()`/
 * `exportKey()` remain unimplemented.
 *
 * Stage 1011 (Secure Runtime Alpha 018) adds `exportCiphertext`/
 * `importCiphertext` (`fedos_runtime_export_ciphertext.ts`/
 * `fedos_runtime_import_ciphertext.ts`, Stage 1011) to the assembled
 * `AppRuntime` — the FIFTH and SIXTH public Crypto APIs, added TOGETHER
 * as a required pair per
 * `docs/secure_runtime_alpha_017_ciphertext_wire_format_decision.md`
 * §7. They are two entirely separate fields — none of the six above is
 * modified, called, or read by either new field's own implementation.
 * `exportCiphertext()` accepts ONLY the same opaque ciphertext handle
 * type `encrypt` already produces and returns a branded wire string;
 * `importCiphertext()` accepts that wire string (treated as COMPLETELY
 * UNTRUSTED) and returns the SAME opaque ciphertext handle type on
 * success. Both internally drive their OWN fresh `FedosWasmLoader`
 * through the SAME six-condition chain before calling the Rust
 * Boundary's own thin wrapper export — reusing this crate's existing,
 * unchanged canonical JSON + base64url ciphertext codec (Stage 182/186)
 * rather than any new wire format. No Worker/Production connection, no
 * Secure Storage of any kind, no Network connection, no new build
 * dependency of any kind. `importKey()`/`exportKey()` remain
 * unimplemented.
 *
 * Stage 1012 (Secure Runtime Alpha 019) adds `storeCiphertext`/
 * `loadCiphertext`/`deleteCiphertext` (`fedos_runtime_ciphertext_storage.ts`,
 * Stage 1012) to the assembled `AppRuntime` — the FIRST storage-shaped
 * Public Runtime API, three entirely separate fields alongside the
 * eight above, none of which is modified, called, or read by any of
 * these three new fields' own implementation. Unlike every prior Crypto
 * API, this Stage reaches NO `FedosWasmLoader` and NO Rust Boundary at
 * all — the exported ciphertext wire value `exportCiphertext`/
 * `importCiphertext` already produce/consume is already a plain string
 * by the time it reaches this layer, so storing/loading/deleting one
 * needs no cryptographic operation. All three read/write a SINGLE
 * shared, in-process `MemoryCiphertextStorage` instance (the ONLY
 * storage backend this Stage ships) through a dedicated
 * `RuntimeCiphertextStorage` Storage Interface. Stores that ciphertext
 * wire value ONLY — NEVER an opaque key handle or any raw key byte;
 * `exportKey()`/`importKey()` remain unimplemented. No Worker/
 * Production/OS Keychain/Network connection of any kind, no new build
 * dependency of any kind.
 *
 * Secure Runtime Alpha 050–052 (Identity Runtime Integration Arc,
 * Alpha 051 "Runtime Identity Bootstrap") — `createRuntime()` now also
 * constructs ONE `FedosRuntimeIdentity` (`fedos_runtime_identity.ts`,
 * Alpha 050) per call, assigned to a local, function-scoped constant
 * that is NEVER attached to the `AppRuntime` object literal this
 * function returns and NEVER read anywhere else in this repository —
 * the Identity Layer's first real connection into the Runtime, held
 * entirely internally. `AppRuntime`'s own field set (`types.js`) is
 * UNCHANGED — no `identity` field, no new Public Runtime API of any
 * kind. Construction is unconditional and identical across every
 * Runtime Mode (`Development`/`Production`/`Unknown`) — `resolveMode()`
 * is not read by, and does not influence, this construction in any
 * way. See
 * `docs/secure_runtime_alpha_050_052_identity_runtime_integration_arc.md`
 * for the full design rationale.
 *
 * Secure Runtime Alpha 053–055 (Identity Runtime Internal Operations,
 * Alpha 055 "Identity Runtime First Use") — `createRuntime()` called
 * `runtimeIdentity.describeIdentity()` EXACTLY ONCE per call,
 * immediately after constructing it, as a pure startup-confirmation
 * smoke test — a call that (given the current Identity Layer Provider/
 * Source wiring, Alpha 049) always resolved `null`. The returned
 * `Promise` was explicitly discarded via `void`, chained with a no-op
 * `.catch()` so a hypothetical future rejection could never surface as
 * an unhandled promise rejection out of this synchronous function.
 * REMOVED by Alpha 057 (below) — see
 * `docs/secure_runtime_alpha_053_055_identity_runtime_internal_operations.md`
 * for that call's own original design rationale.
 *
 * Secure Runtime Alpha 056 (Identity Bootstrap Semantics Review) —
 * review/decision only, no code change: formally compared five options
 * for the Alpha 055 auto-fired Bootstrap call against `createRuntime()`'s
 * own historically pure, synchronous construction contract, and adopted
 * Option B — remove the automatic Bootstrap entirely, deferring real
 * identity retrieval to a future, explicit, separately-reviewed API or
 * Bootstrap boundary. See
 * `docs/secure_runtime_alpha_056_identity_bootstrap_semantics_review.md`.
 *
 * Secure Runtime Alpha 057 (Identity Bootstrap Removal) implements that
 * Decision, and ONLY that Decision: the Alpha 055
 * `void runtimeIdentity.describeIdentity().catch(() => {});` statement
 * is removed. `createRuntime()` is Construct Only again, exactly as
 * Alpha 051 first shipped it — `FedosRuntimeIdentity` is still
 * constructed once per call (Alpha 050-052, unchanged above), held as a
 * local, function-scoped constant, never attached to the `AppRuntime`
 * object literal this function returns and never read anywhere else in
 * this repository. No new Bootstrap API, no new identity-retrieval
 * method, and no Public Runtime API change of any kind are introduced
 * by this Stage. See
 * `docs/secure_runtime_alpha_057_identity_bootstrap_removal.md` for the
 * full design rationale.
 */

import { CompositeAssetCache } from "../asset/composite_asset_cache.js";
import { InMemoryAssetCache } from "../asset/memory_asset_cache.js";
import { MeshKVAssetCache, type MeshKVClient } from "../asset/meshkv_asset_cache.js";
import { MeshKVBrowserClient } from "../asset/meshkv_browser_client.js";
import { R2AssetCache } from "../asset/r2_asset_cache.js";
import type { AssetCache } from "../asset/types.js";
import { InMemoryEventCache } from "../cache/event_cache.js";
import { KvEventCache } from "../cache/kv_event_cache.js";
import type { EventCache } from "../cache/types.js";
import {
  InMemorySpaceDirectory,
  type AsyncSpaceDirectory,
  type SpaceDirectory,
} from "../community/directory.js";
import { D1SpaceDirectory } from "../community/d1_directory.js";
import { SAMPLE_SPACES } from "../community/sample_spaces.js";
import { D1MetadataIndex } from "../indexer/d1_index.js";
import { InMemoryMetadataIndex } from "../indexer/memory_index.js";
import type { MetadataIndex } from "../indexer/types.js";
import { NobleSignatureVerifier } from "../nostr/noble_signature.js";
import type { SignatureVerifier } from "../nostr/signature.js";
import { MockRelayPublisher, type RelayPublisher } from "../nostr/publish.js";
import {
  MockPromotionProvider,
  MockRecommendationProvider,
  type PromotionProvider,
  type RecommendationProvider,
} from "../promotion/adapter.js";
import { EdgeRecPromotionProvider } from "../promotion/edge_rec_adapter.js";
import type { EdgeRecViewerOptions } from "../promotion/edge_rec_adapter.js";
import {
  NoopNotificationBridge,
  PlaceholderNotificationBridge,
} from "../notification/noop_notification.js";
import {
  NOTIFICATION_CHANNELS,
  type NotificationBridge,
  type NotificationChannel,
} from "../notification/types.js";
import {
  NoopPaymentProvider,
  PlaceholderPaymentProvider,
} from "../payment/noop_payment.js";
import {
  PAYMENT_RAILS,
  type PaymentProvider,
  type PaymentRail,
} from "../payment/types.js";
import {
  NoopWebAuthnProvider,
  PlaceholderWebAuthnProvider,
  type WebAuthnProvider,
} from "../identity/webauthn_adapter.js";
import { NoopCryptoProvider } from "../crypto/noop_crypto.js";
import { FedosCoreCryptoProvider } from "../crypto/fedos_core_adapter.js";
import type { CryptoProvider } from "../crypto/types.js";
import { PlaceholderFedosCoreCrypto } from "../../packages/fedos-core-rust/src/index.js";
import {
  NoopStorageBackend,
  PlaceholderStorageBackend,
} from "../storage/noop_storage.js";
import type { StorageBackend } from "../storage/types.js";
import { NoopFederationProvider } from "../federation/noop_federation.js";
import type { FederationProvider } from "../federation/types.js";
import { NoopChatProvider } from "../chat/noop_chat.js";
import type { ChatProvider } from "../chat/types.js";
import { NoopMarketplaceProvider } from "../marketplace/noop_marketplace.js";
import type { MarketplaceProvider } from "../marketplace/types.js";
import { NoopEntitlementProvider } from "../creator/entitlement.js";
import type { EntitlementProvider } from "../creator/entitlement.js";
import type { RuntimeCryptoProvider } from "./crypto_provider.js";
import { buildRuntimeCryptoProvider } from "./runtime_crypto_bridge.js";
import { createCryptoLoaderFacade } from "./fedos_crypto_loader_facade.js";
import { runtimeCapabilities } from "./fedos_runtime_prototype_execution.js";
import { randomBytes } from "./fedos_runtime_random_bytes.js";
import { generateAeadKey } from "./fedos_runtime_aead_key_generation.js";
import { encrypt } from "./fedos_runtime_encrypt.js";
import { decrypt } from "./fedos_runtime_decrypt.js";
import { exportCiphertext } from "./fedos_runtime_export_ciphertext.js";
import { importCiphertext } from "./fedos_runtime_import_ciphertext.js";
import {
  storeCiphertext,
  loadCiphertext,
  deleteCiphertext,
} from "./fedos_runtime_ciphertext_storage.js";
import { FedosRuntimeIdentity } from "./fedos_runtime_identity.js";
import type {
  AppRuntime,
  RuntimeEnv,
  RuntimeInitializeCryptoResult,
  RuntimeMode,
  RuntimeOverrides,
} from "./types.js";

/** Shared in-memory defaults so state persists across requests in one isolate. */
const defaultEventCache: EventCache = new InMemoryEventCache();
const defaultSpaceDirectory: SpaceDirectory = new InMemorySpaceDirectory(SAMPLE_SPACES);
const defaultMetadataIndex: MetadataIndex = new InMemoryMetadataIndex();
const defaultAssetCache: AssetCache = new InMemoryAssetCache();

/** KV-backed cache when bound, else the shared in-memory cache. */
export function selectEventCache(env?: RuntimeEnv): EventCache {
  if (env?.NOSTR_EVENT_CACHE) {
    return new KvEventCache({ kv: env.NOSTR_EVENT_CACHE });
  }
  return defaultEventCache;
}

/**
 * D1-backed (async) directory when bound, else the shared in-memory sample
 * directory. The async one is a selection seam only — it is not auto-wired into
 * the synchronous render path.
 */
export function selectSpaceDirectory(env?: RuntimeEnv): SpaceDirectory | AsyncSpaceDirectory {
  if (env?.NOSTR_SPACE_DB) {
    return new D1SpaceDirectory({ db: env.NOSTR_SPACE_DB });
  }
  return defaultSpaceDirectory;
}

/** D1-backed metadata index when bound, else the shared in-memory index. */
export function selectMetadataIndex(env?: RuntimeEnv): MetadataIndex {
  if (env?.NOSTR_INDEX) {
    return new D1MetadataIndex(env.NOSTR_INDEX);
  }
  return defaultMetadataIndex;
}

/** Truthy test for a string|boolean env flag ("1"/"true"/"yes"/"on" or `true`). */
function isEnvFlagTruthy(flag: string | boolean | undefined): boolean {
  if (flag === true) return true;
  if (typeof flag === "string") {
    const v = flag.trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes" || v === "on";
  }
  return false;
}

/** Truthy test for the `ENABLE_MESHKV_ASSET_CACHE` opt-in flag. */
function isMeshKVOptIn(env?: RuntimeEnv): boolean {
  return isEnvFlagTruthy(env?.ENABLE_MESHKV_ASSET_CACHE);
}

/**
 * Resolves the MeshKV client the asset cache should write through, or
 * `undefined` when MeshKV is not wired. Priority:
 *   1. `overrides.meshKVClient` — an explicit, pre-built client.
 *   2. `env.MESHKV_ASSET_CACHE` — the legacy already-constructed binding.
 *   3. OPT-IN ONLY: `ENABLE_MESHKV_ASSET_CACHE` truthy AND a `MeshKVApi`
 *      (`overrides.meshKVApi` or `env.MESHKV_API`) present → a
 *      `MeshKVBrowserClient` over that node.
 *
 * WITHOUT the opt-in flag (cases 1/2 aside) the `MeshKVBrowserClient` is never
 * constructed. Constructing it here starts NO network: no `init`, `connect`,
 * `startSignaling`, WebRTC, or peer discovery — it only makes the adapter ready.
 */
export function selectMeshKVClient(
  env?: RuntimeEnv,
  overrides: RuntimeOverrides = {},
): MeshKVClient | undefined {
  if (overrides.meshKVClient) return overrides.meshKVClient;
  if (env?.MESHKV_ASSET_CACHE) return env.MESHKV_ASSET_CACHE;
  if (isMeshKVOptIn(env)) {
    const mesh = overrides.meshKVApi ?? env?.MESHKV_API;
    if (mesh) {
      // No lifecycle call — constructing the adapter opens no MeshKV connection.
      return new MeshKVBrowserClient({ mesh });
    }
  }
  return undefined;
}

/**
 * The public asset cache. Priority:
 *   1. both R2 and a MeshKV client → a `CompositeAssetCache` chaining
 *      R2 (origin) → MeshKV (peer cache) → in-memory (local fallback),
 *   2. R2 only   → an `R2AssetCache` (origin storage),
 *   3. MeshKV only → a `MeshKVAssetCache` (peer cache),
 *   4. neither   → the shared in-memory cache.
 * The MeshKV client is resolved via `selectMeshKVClient` (legacy binding or the
 * explicit opt-in browser client). Every choice holds public/unlisted media
 * only — the policy guardrail keeps private/paid/sensitive bytes out.
 * Selecting/composing performs no I/O: it opens no connection and reads/writes
 * no asset, and starts no MeshKV network.
 */
export function selectAssetCache(
  env?: RuntimeEnv,
  overrides: RuntimeOverrides = {},
): AssetCache {
  const r2 = env?.NOSTR_ASSET_R2;
  const mesh = selectMeshKVClient(env, overrides);
  if (r2 && mesh) {
    return new CompositeAssetCache({
      layers: [
        {
          name: "r2",
          cache: new R2AssetCache({ bucket: r2 }),
          writable: true,
          volatile: false,
        },
        {
          name: "meshkv",
          cache: new MeshKVAssetCache({ client: mesh }),
          writable: true,
          volatile: true,
        },
        { name: "memory", cache: defaultAssetCache, writable: true, volatile: true },
      ],
    });
  }
  if (r2) {
    return new R2AssetCache({ bucket: r2 });
  }
  if (mesh) {
    return new MeshKVAssetCache({ client: mesh });
  }
  return defaultAssetCache;
}

/** Always real BIP-340 Schnorr verification (verify-only; no signing). */
export function selectSignatureVerifier(_env?: RuntimeEnv): SignatureVerifier {
  return NobleSignatureVerifier;
}

/** Safe timeout bounds for the edge-rec transport (ms). */
const EDGE_REC_MIN_TIMEOUT_MS = 100;
const EDGE_REC_MAX_TIMEOUT_MS = 30_000;

/**
 * Parse `EDGE_REC_TIMEOUT_MS` into a clamped millisecond value, or `undefined`
 * when it is absent/unparseable/non-positive (the adapter's own default applies).
 * Pure — reads only the passed value.
 */
export function parseEdgeRecTimeoutMs(value?: string | number): number | undefined {
  if (value === undefined) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(Math.max(Math.floor(n), EDGE_REC_MIN_TIMEOUT_MS), EDGE_REC_MAX_TIMEOUT_MS);
}

/** `{ timeoutMs }` only when the env supplies a usable value, else `{}`. */
function edgeRecTimeoutOption(env?: RuntimeEnv): { timeoutMs?: number } {
  const timeoutMs = parseEdgeRecTimeoutMs(env?.EDGE_REC_TIMEOUT_MS);
  return timeoutMs !== undefined ? { timeoutMs } : {};
}

/**
 * Resolve the viewer-privacy options for the edge-rec adapter from env.
 *
 * PRIVACY DEFAULT: the viewer pubkey is NEVER sent. Only an explicit truthy
 * `PROMOTION_SEND_VIEWER_PUBKEY` opts in to sending the RAW pubkey.
 * `PROMOTION_HASH_VIEWER_PUBKEY` is recognized as intent, but NO hash function is
 * wired here, so no `hashViewerPubkey` is set and nothing is sent for it — the raw
 * pubkey is never leaked as a fallback.
 */
export function resolveEdgeRecViewerOptions(env?: RuntimeEnv): EdgeRecViewerOptions {
  return isEnvFlagTruthy(env?.PROMOTION_SEND_VIEWER_PUBKEY)
    ? { sendViewerPubkey: true }
    : {};
}

/**
 * EdgeRec adapter when an endpoint AND an injected fetch are present, else the
 * inert mock. Selecting the EdgeRec adapter does NOT call out — it is merely
 * ready to, behind an injected client. API key, a clamped timeout, and the
 * (default-off) viewer options are threaded from env into the adapter.
 */
export function selectPromotionProvider(env?: RuntimeEnv): PromotionProvider {
  if (env?.PROMOTION_ENDPOINT && env.fetch) {
    return new EdgeRecPromotionProvider({
      fetch: env.fetch,
      endpoint: env.PROMOTION_ENDPOINT,
      ...(env.PROMOTION_API_KEY !== undefined ? { apiKey: env.PROMOTION_API_KEY } : {}),
      ...edgeRecTimeoutOption(env),
      ...resolveEdgeRecViewerOptions(env),
    });
  }
  return new MockPromotionProvider();
}

/**
 * EdgeRec adapter (shares the promotion transport) when a recommendation or
 * promotion endpoint AND an injected fetch are present, else the inert mock. The
 * recommendation API key falls back to the promotion key; timeout and viewer
 * options are shared with the promotion path.
 */
export function selectRecommendationProvider(env?: RuntimeEnv): RecommendationProvider {
  const endpoint = env?.RECOMMENDATION_ENDPOINT ?? env?.PROMOTION_ENDPOINT;
  if (endpoint && env?.fetch) {
    const apiKey = env.RECOMMENDATION_API_KEY ?? env.PROMOTION_API_KEY;
    return new EdgeRecPromotionProvider({
      fetch: env.fetch,
      endpoint,
      ...(apiKey !== undefined ? { apiKey } : {}),
      ...edgeRecTimeoutOption(env),
      ...resolveEdgeRecViewerOptions(env),
    });
  }
  return new MockRecommendationProvider();
}

/**
 * Always the mock publisher for now — there is no real publish path wired into
 * the runtime. A real `WebSocketRelayPublisher` is composed explicitly elsewhere.
 */
export function selectRelayPublisher(_env?: RuntimeEnv): RelayPublisher {
  return new MockRelayPublisher();
}

/**
 * Validate and return a `NotificationChannel` from the env's
 * `NOTIFICATION_DEFAULT_CHANNEL`. An absent or unrecognized value is silently
 * ignored (returns `undefined`). Pure — never mutates env.
 */
export function resolveNotificationDefaultChannel(
  env?: RuntimeEnv,
): NotificationChannel | undefined {
  const raw = env?.NOTIFICATION_DEFAULT_CHANNEL;
  if (!raw) return undefined;
  return (NOTIFICATION_CHANNELS as readonly string[]).includes(raw)
    ? (raw as NotificationChannel)
    : undefined;
}

/**
 * Select the `NotificationBridge` from env / overrides. Priority:
 *   1. `overrides.notificationBridge` — wins unconditionally.
 *   2. `NOTIFICATION_PROVIDER=noop` → `NoopNotificationBridge`.
 *   3. `NOTIFICATION_PROVIDER=placeholder` OR `ENABLE_NOTIFICATION_PLACEHOLDER`
 *      truthy → `PlaceholderNotificationBridge`.
 *   4. Otherwise → `NoopNotificationBridge` (safe default, sends nothing).
 *
 * Selection only: constructing the bridge contacts no API and calls no `notify`.
 * No Telegram/LINE/APNs/FCM/Email transport is imported or invoked. `env` is
 * never mutated.
 */
export function selectNotificationBridge(
  env?: RuntimeEnv,
  overrides: RuntimeOverrides = {},
): NotificationBridge {
  if (overrides.notificationBridge) return overrides.notificationBridge;
  const provider = env?.NOTIFICATION_PROVIDER;
  if (provider === "noop") return new NoopNotificationBridge();
  if (
    provider === "placeholder" ||
    isEnvFlagTruthy(env?.ENABLE_NOTIFICATION_PLACEHOLDER)
  ) {
    return new PlaceholderNotificationBridge();
  }
  return new NoopNotificationBridge();
}

/**
 * Validate and return a `PaymentRail` from the env's `PAYMENT_DEFAULT_RAIL`. An
 * absent or unrecognized value is silently ignored (returns `undefined`) — no
 * provider constructor in this stage takes it. Pure — never mutates env.
 */
export function resolvePaymentDefaultRail(env?: RuntimeEnv): PaymentRail | undefined {
  const raw = env?.PAYMENT_DEFAULT_RAIL;
  if (!raw) return undefined;
  return (PAYMENT_RAILS as readonly string[]).includes(raw) ? (raw as PaymentRail) : undefined;
}

/**
 * Select the `PaymentProvider` from env / overrides. Priority:
 *   1. `overrides.paymentProvider` — wins unconditionally.
 *   2. `PAYMENT_PROVIDER=noop` → `NoopPaymentProvider`.
 *   3. `PAYMENT_PROVIDER=placeholder` OR `ENABLE_PAYMENT_PLACEHOLDER` truthy →
 *      `PlaceholderPaymentProvider`.
 *   4. Otherwise → `NoopPaymentProvider` (safe default, charges nothing).
 *
 * Selection only: constructing the provider contacts no rail and calls no
 * `requestPayment`. No Lightning/Stripe/Apple Pay/Google Pay transport is
 * imported or invoked. `env` is never mutated.
 */
export function selectPaymentProvider(
  env?: RuntimeEnv,
  overrides: RuntimeOverrides = {},
): PaymentProvider {
  if (overrides.paymentProvider) return overrides.paymentProvider;
  const provider = env?.PAYMENT_PROVIDER;
  if (provider === "noop") return new NoopPaymentProvider();
  if (provider === "placeholder" || isEnvFlagTruthy(env?.ENABLE_PAYMENT_PLACEHOLDER)) {
    return new PlaceholderPaymentProvider();
  }
  return new NoopPaymentProvider();
}

/**
 * Select the `WebAuthnProvider` from env / overrides. Priority:
 *   1. `overrides.webAuthnProvider` — wins unconditionally.
 *   2. `WEBAUTHN_PROVIDER=noop` → `NoopWebAuthnProvider`.
 *   3. `WEBAUTHN_PROVIDER=placeholder` OR `ENABLE_WEBAUTHN_PLACEHOLDER` truthy →
 *      `PlaceholderWebAuthnProvider`.
 *   4. Otherwise → `NoopWebAuthnProvider` (safe default, permanently
 *      `unavailable`).
 *
 * Selection only: constructing the provider touches no browser credential
 * API, launches no Face ID / Touch ID, contacts no Secure Enclave / Android
 * Keystore, and calls no `begin`/`cancel`. WebAuthn / Passkey stays an unlock
 * TRIGGER only, never a key source. No credential/challenge is stored. `env` is
 * never mutated.
 */
export function selectWebAuthnProvider(
  env?: RuntimeEnv,
  overrides: RuntimeOverrides = {},
): WebAuthnProvider {
  if (overrides.webAuthnProvider) return overrides.webAuthnProvider;
  const provider = env?.WEBAUTHN_PROVIDER;
  if (provider === "noop") return new NoopWebAuthnProvider();
  if (provider === "placeholder" || isEnvFlagTruthy(env?.ENABLE_WEBAUTHN_PLACEHOLDER)) {
    return new PlaceholderWebAuthnProvider();
  }
  return new NoopWebAuthnProvider();
}

/**
 * Select the `CryptoProvider` from env / overrides. Priority:
 *   1. `overrides.cryptoProvider` — wins unconditionally.
 *   2. `CRYPTO_PROVIDER=noop` → `NoopCryptoProvider`.
 *   3. `CRYPTO_PROVIDER=fedos` OR `ENABLE_CRYPTO_PLACEHOLDER` truthy →
 *      `FedosCoreCryptoProvider` injected with the permanently-inert
 *      `PlaceholderFedosCoreCrypto` ONLY.
 *   4. Otherwise → `NoopCryptoProvider` (safe default, permanently `unavailable`).
 *
 * DISABLED BY DEFAULT: without an explicit opt-in the runtime uses
 * `NoopCryptoProvider`. Even the FedOS option is inert — it wraps only the
 * placeholder core, so it stays `unavailable` and runs no cryptography.
 *
 * Selection only: constructing the provider loads NO WASM (no real WASM loader
 * is used), issues no `fetch`/dynamic import, performs no WASM instantiation,
 * and runs no KDF/AEAD/random/zeroize. `randomBytes`/`deriveKey`/`encrypt`/
 * `decrypt` are never auto-called. `env` is never mutated.
 */
export function selectCryptoProvider(
  env?: RuntimeEnv,
  overrides: RuntimeOverrides = {},
): CryptoProvider {
  if (overrides.cryptoProvider) return overrides.cryptoProvider;
  const provider = env?.CRYPTO_PROVIDER;
  if (provider === "noop") return new NoopCryptoProvider();
  if (provider === "fedos" || isEnvFlagTruthy(env?.ENABLE_CRYPTO_PLACEHOLDER)) {
    // Inject the inert placeholder core ONLY — no real Rust/WASM core, no loader.
    return new FedosCoreCryptoProvider(new PlaceholderFedosCoreCrypto());
  }
  return new NoopCryptoProvider();
}

/**
 * Select the `StorageBackend` from env / overrides. Priority:
 *   1. `overrides.storageBackend` — wins unconditionally.
 *   2. `STORAGE_PROVIDER=noop` → `NoopStorageBackend`.
 *   3. `STORAGE_PROVIDER=placeholder` OR `ENABLE_STORAGE_PLACEHOLDER` truthy →
 *      `PlaceholderStorageBackend`.
 *   4. Otherwise → `NoopStorageBackend` (safe default, stores nothing).
 *
 * Selection only: constructing the backend contacts no Google Drive API,
 * opens no Nostr relay WebSocket, touches no SQLite, no Bluetooth/Wi-Fi
 * mesh, and no content-addressed gateway, and calls no `put`/`get`/`delete`. `env` is
 * never mutated.
 */
export function selectStorageBackend(
  env?: RuntimeEnv,
  overrides: RuntimeOverrides = {},
): StorageBackend {
  if (overrides.storageBackend) return overrides.storageBackend;
  const provider = env?.STORAGE_PROVIDER;
  if (provider === "noop") return new NoopStorageBackend();
  if (provider === "placeholder" || isEnvFlagTruthy(env?.ENABLE_STORAGE_PLACEHOLDER)) {
    return new PlaceholderStorageBackend();
  }
  return new NoopStorageBackend();
}

/**
 * Select the `FederationProvider`. Priority:
 *   1. `overrides.federationProvider` — wins unconditionally.
 *   2. Otherwise → `NoopFederationProvider` (safe default, always
 *      `disconnected`).
 *
 * There is no env-selectable real/placeholder adapter yet — Stage 110 ships
 * only `NoopFederationProvider` (see `docs/federation_boundary.md`).
 * Selection only: constructing the provider opens no relay/WebSocket/HTTP/
 * OAuth/AT-Protocol session and calls no `connect`/`disconnect`/
 * `publishPlaceholder`/`fetchPlaceholder`. `env` is never mutated.
 */
export function selectFederationProvider(
  _env?: RuntimeEnv,
  overrides: RuntimeOverrides = {},
): FederationProvider {
  if (overrides.federationProvider) return overrides.federationProvider;
  return new NoopFederationProvider();
}

/**
 * Select the `ChatProvider` (Stage 111's protocol-neutral chat/DM transport
 * seam — unrelated to the Stage 16 `ChatRoom`/`ChatMessage` model). Priority:
 *   1. `overrides.chatProvider` — wins unconditionally.
 *   2. Otherwise → `NoopChatProvider` (safe default, always `unavailable`).
 *
 * There is no env-selectable real/placeholder adapter yet. Selection only:
 * constructing the provider opens no relay/WebSocket session and encrypts/
 * decrypts/sends nothing. `env` is never mutated.
 */
export function selectChatProvider(
  _env?: RuntimeEnv,
  overrides: RuntimeOverrides = {},
): ChatProvider {
  if (overrides.chatProvider) return overrides.chatProvider;
  return new NoopChatProvider();
}

/**
 * Select the `MarketplaceProvider` (Stage 111). Priority:
 *   1. `overrides.marketplaceProvider` — wins unconditionally.
 *   2. Otherwise → `NoopMarketplaceProvider` (safe default, always
 *      `unavailable`).
 *
 * There is no env-selectable real/placeholder adapter yet. Selection only:
 * constructing the provider lists nothing, charges nothing, and issues no
 * `PurchaseGrant`. `env` is never mutated.
 */
export function selectMarketplaceProvider(
  _env?: RuntimeEnv,
  overrides: RuntimeOverrides = {},
): MarketplaceProvider {
  if (overrides.marketplaceProvider) return overrides.marketplaceProvider;
  return new NoopMarketplaceProvider();
}

/**
 * Select the `EntitlementProvider` (Stage 111). Priority:
 *   1. `overrides.creatorEntitlementProvider` — wins unconditionally.
 *   2. Otherwise → `NoopEntitlementProvider` (safe default, always
 *      `unavailable`, never `allowed: true`).
 *
 * There is no env-selectable real/placeholder adapter yet. Selection only:
 * constructing the provider grants no access and contacts no payment rail.
 * `env` is never mutated.
 */
export function selectCreatorEntitlementProvider(
  _env?: RuntimeEnv,
  overrides: RuntimeOverrides = {},
): EntitlementProvider {
  if (overrides.creatorEntitlementProvider) return overrides.creatorEntitlementProvider;
  return new NoopEntitlementProvider();
}

/**
 * Whether `ENABLE_PROMOTION_PROVIDER_PREVIEW` was truthy — HALF of the Stage 52
 * dual-flag gate for invoking a real `promotionProvider` for a preview. Pure;
 * never mutates `env`.
 */
export function isPromotionProviderPreviewAllowed(env?: RuntimeEnv): boolean {
  return isEnvFlagTruthy(env?.ENABLE_PROMOTION_PROVIDER_PREVIEW);
}

/**
 * Select the Runtime crypto provider (Stage 249's `RuntimeCryptoProvider`
 * seam, deliberately separate from `cryptoProvider`/`CryptoProvider` above).
 * Priority:
 *   1. `overrides.runtimeCryptoProvider` — wins unconditionally.
 *   2. Otherwise → `buildRuntimeCryptoProvider()` (Stage 259), which always
 *      resolves the safe placeholder — `runtimeCryptoEnabled`
 *      (`src/runtime/runtime_crypto_config.ts`) is permanently `false`.
 *
 * Reads NO `RuntimeEnv` field — this seam has no env-selectable option in
 * this stage. Selection only: constructing the provider calls no FedOS core
 * (Rust crate or TS package boundary), loads no WASM, and never invokes
 * `encrypt`/`decrypt` automatically.
 */
export function selectRuntimeCryptoProvider(
  overrides: RuntimeOverrides = {},
): RuntimeCryptoProvider {
  if (overrides.runtimeCryptoProvider) return overrides.runtimeCryptoProvider;
  return buildRuntimeCryptoProvider();
}

/** Cloudflare when any binding/endpoint is present, local with a bare env, else test. */
function resolveMode(env?: RuntimeEnv): RuntimeMode {
  if (!env) return "test";
  if (
    env.NOSTR_EVENT_CACHE ||
    env.NOSTR_SPACE_DB ||
    env.NOSTR_INDEX ||
    env.PROMOTION_ENDPOINT ||
    env.RECOMMENDATION_ENDPOINT ||
    env.MESHKV_ASSET_CACHE ||
    (isMeshKVOptIn(env) && env.MESHKV_API) ||
    env.NOSTR_ASSET_R2
  ) {
    return "cloudflare";
  }
  return "local";
}

/**
 * Stage 691 (Prototype Phase 001) — `AppRuntime.initializeCrypto()`'s real
 * implementation: the first Runtime PUBLIC API prototype for the twelve-layer
 * `fedos_*.ts` `PlanningOnly` chain (`docs/runtime_initialize_crypto_planning_review.md`).
 * Fixed, synchronous, side-effect-free — it calls no Loader, WASM, or Rust
 * code, references no generated JS glue, and writes no `import()` of any
 * kind (static or dynamic). ALWAYS resolves `{ allowed: false, initialized:
 * false, reason: "PrototypeDisabled" }`. See
 * `docs/runtime_initialize_crypto_prototype.md`.
 *
 * Stage 697 (Prototype Phase 002) — now reaches ONE link deeper, into the
 * Crypto Loader Facade (`reachCryptoLoaderFacade`, below); the Facade's
 * result is discarded and this function's own fixed return value is
 * unchanged.
 */
export function createRuntimeInitializeCryptoResult(): RuntimeInitializeCryptoResult {
  reachCryptoLoaderFacade(); // result discarded -- Facade stays PlanningOnly, no Loader/WASM/Rust call
  return { allowed: false, initialized: false, reason: "PrototypeDisabled" };
}

/**
 * PRIVATE (module-scoped) — calls `createCryptoLoaderFacade()`
 * (`fedos_crypto_loader_facade.ts`, Stage 594, UNMODIFIED by this stage).
 * The result is discarded; it is never passed to
 * `WebAssembly.instantiate`/`compile`, `initSync`/the default init export,
 * `packages/fedos-core-rust`, or Worker. This is the ONLY point where
 * Runtime reaches into the `fedos_*.ts` chain — it stops at the Facade and
 * never calls the Provider/Facade Boundary, WASM Loader, or Rust directly.
 */
function reachCryptoLoaderFacade(): void {
  createCryptoLoaderFacade();
}

/**
 * Assembles the `AppRuntime` for an environment. Pure and side-effect-free: it
 * constructs adapters but opens no socket, issues no `fetch`, and publishes
 * nothing. `overrides` take precedence over anything selected from `env`, and
 * `env` is never mutated.
 */
export function createRuntime(
  env?: RuntimeEnv,
  overrides: RuntimeOverrides = {},
): AppRuntime {
  // Secure Runtime Alpha 050-052: constructed for internal wiring only --
  // never attached to the AppRuntime object below, never read elsewhere.
  // Secure Runtime Alpha 057: Construct Only, per the Alpha 056 Decision --
  // the Alpha 055 auto-fired describeIdentity() call is deliberately not
  // present; identity retrieval is deferred to a future, explicit boundary.
  const runtimeIdentity: FedosRuntimeIdentity = new FedosRuntimeIdentity();
  void runtimeIdentity;

  return {
    mode: overrides.mode ?? resolveMode(env),
    eventCache: overrides.eventCache ?? selectEventCache(env),
    assetCache: overrides.assetCache ?? selectAssetCache(env, overrides),
    spaceDirectory: overrides.spaceDirectory ?? selectSpaceDirectory(env),
    metadataIndex: overrides.metadataIndex ?? selectMetadataIndex(env),
    signatureVerifier: overrides.signatureVerifier ?? selectSignatureVerifier(env),
    promotionProvider: overrides.promotionProvider ?? selectPromotionProvider(env),
    recommendationProvider:
      overrides.recommendationProvider ?? selectRecommendationProvider(env),
    relayPublisher: overrides.relayPublisher ?? selectRelayPublisher(env),
    notificationBridge: selectNotificationBridge(env, overrides),
    paymentProvider: selectPaymentProvider(env, overrides),
    promotionProviderPreviewAllowed: isPromotionProviderPreviewAllowed(env),
    webAuthnProvider: selectWebAuthnProvider(env, overrides),
    cryptoProvider: selectCryptoProvider(env, overrides),
    storageBackend: selectStorageBackend(env, overrides),
    federationProvider: selectFederationProvider(env, overrides),
    chatProvider: selectChatProvider(env, overrides),
    marketplaceProvider: selectMarketplaceProvider(env, overrides),
    creatorEntitlementProvider: selectCreatorEntitlementProvider(env, overrides),
    crypto: selectRuntimeCryptoProvider(overrides),
    initializeCrypto: createRuntimeInitializeCryptoResult,
    runtimeCapabilities,
    randomBytes,
    generateAeadKey,
    encrypt,
    decrypt,
    exportCiphertext,
    importCiphertext,
    storeCiphertext,
    loadCiphertext,
    deleteCiphertext,
  };
}
