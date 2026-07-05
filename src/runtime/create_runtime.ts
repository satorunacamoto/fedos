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
import type { AppRuntime, RuntimeEnv, RuntimeMode, RuntimeOverrides } from "./types.js";

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
 * Assembles the `AppRuntime` for an environment. Pure and side-effect-free: it
 * constructs adapters but opens no socket, issues no `fetch`, and publishes
 * nothing. `overrides` take precedence over anything selected from `env`, and
 * `env` is never mutated.
 */
export function createRuntime(
  env?: RuntimeEnv,
  overrides: RuntimeOverrides = {},
): AppRuntime {
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
  };
}
