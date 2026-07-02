/**
 * Stage 21 — runtime integration layer (types only).
 *
 * `AppRuntime` is the single bag of already-selected boundaries (cache,
 * directory, index, verifier, promotion/recommendation providers, publisher)
 * that `createRuntime` assembles from a `RuntimeEnv`. It is the one place where
 * "Cloudflare vs local vs test vs mock" is decided, so later stages (an
 * `AssetCache` boundary, a MeshKV adapter) can be slotted in without threading
 * new `select*` calls through the Worker.
 *
 * This is a SELECTION / dependency-injection boundary only. Constructing a
 * runtime starts no external communication: no relay socket, no `fetch`, no
 * publish, no signer. MeshKV and asset caching are NOT implemented here.
 */

import type { MeshKVClient } from "../asset/meshkv_asset_cache.js";
import type { MeshKVApi } from "../../packages/meshkv/src/index.js";
import type { R2LikeBucket } from "../asset/r2_asset_cache.js";
import type { AssetCache } from "../asset/types.js";
import type { EventCache } from "../cache/types.js";
import type { KvLikeNamespace } from "../cache/kv_event_cache.js";
import type { AsyncSpaceDirectory, SpaceDirectory } from "../community/directory.js";
import type { D1LikeDatabase } from "../indexer/d1_index.js";
import type { MetadataIndex } from "../indexer/types.js";
import type { NotificationBridge } from "../notification/types.js";
import type { PaymentProvider } from "../payment/types.js";
import type { SignatureVerifier } from "../nostr/signature.js";
import type { RelayPublisher } from "../nostr/publish.js";
import type { PromotionProvider, RecommendationProvider } from "../promotion/adapter.js";
import type { EdgeRecFetchLike } from "../promotion/edge_rec_adapter.js";
import type { WebAuthnProvider } from "../identity/webauthn_adapter.js";
import type { CryptoProvider } from "../crypto/types.js";

/** Where the runtime believes it is running. Affects defaults/diagnostics only. */
export type RuntimeMode = "test" | "local" | "cloudflare";

/**
 * The environment a runtime is built from. Every field is optional: with no env
 * the runtime falls back to test/local-safe in-memory defaults. Cloudflare
 * bindings and promotion config are read but never mutated.
 */
export interface RuntimeEnv {
  /** Workers KV namespace for caching live relay results. */
  readonly NOSTR_EVENT_CACHE?: KvLikeNamespace;
  /** D1 database holding persisted space definitions + members. */
  readonly NOSTR_SPACE_DB?: D1LikeDatabase;
  /** D1 database backing the discovery metadata index. */
  readonly NOSTR_INDEX?: D1LikeDatabase;
  /**
   * R2 bucket backing the public asset cache (origin storage). When present the
   * runtime wraps it in an `R2AssetCache`. Public/unlisted media only — never
   * private/paid/secret/DM/payment data, and never a purchased original.
   */
  readonly NOSTR_ASSET_R2?: R2LikeBucket;
  /**
   * A MeshKV client for browser-to-browser caching of PUBLIC media. When present
   * the runtime wraps it in a `MeshKVAssetCache`. It only ever carries
   * public/unlisted bytes — never private/paid/secret/DM/payment data. This is
   * the legacy, already-constructed client binding and is used as-is (no opt-in
   * flag required).
   */
  readonly MESHKV_ASSET_CACHE?: MeshKVClient;
  /**
   * EXPLICIT opt-in for building a `MeshKVBrowserClient` from `MESHKV_API` (or an
   * injected `overrides.meshKVApi`). Truthy = `true` or a truthy string
   * ("1"/"true"/"yes"/"on"). WITHOUT this flag the runtime never constructs the
   * browser client. Opting in only SELECTS the adapter — it starts no MeshKV
   * network: no `init`, `connect`, `startSignaling`, WebRTC, or peer discovery.
   */
  readonly ENABLE_MESHKV_ASSET_CACHE?: string | boolean;
  /**
   * A MeshKV node / `MeshKVApi` to build a `MeshKVBrowserClient` from, used ONLY
   * when `ENABLE_MESHKV_ASSET_CACHE` is truthy. Providing it does not bring the
   * node online; the runtime never calls its lifecycle methods.
   */
  readonly MESHKV_API?: MeshKVApi;
  /** edge-rec-middleware endpoint for promotions (selection only; no auto-serve). */
  readonly PROMOTION_ENDPOINT?: string;
  /** Optional bearer token for the promotion endpoint. */
  readonly PROMOTION_API_KEY?: string;
  /** recommendation-rewriter endpoint (falls back to the promotion endpoint). */
  readonly RECOMMENDATION_ENDPOINT?: string;
  /**
   * Optional bearer token for the recommendation endpoint. Falls back to
   * `PROMOTION_API_KEY` when absent (the two often share the edge-rec transport).
   */
  readonly RECOMMENDATION_API_KEY?: string;
  /**
   * EXPLICIT opt-in to send the RAW viewer pubkey to edge-rec. Truthy = `true` or a
   * truthy string ("1"/"true"/"yes"/"on"). DEFAULT (absent/falsy): the viewer
   * pubkey is NEVER sent. Selection only reflects this into the adapter options; it
   * sends nothing here.
   */
  readonly PROMOTION_SEND_VIEWER_PUBKEY?: string | boolean;
  /**
   * Intent to send a HASHED viewer id instead of the raw pubkey. Recognized as a
   * future opt-in, but NO hash function is wired in the runtime yet, so setting it
   * sends NOTHING (the raw pubkey is never leaked as a fallback). See the README.
   */
  readonly PROMOTION_HASH_VIEWER_PUBKEY?: string | boolean;
  /**
   * edge-rec request timeout in milliseconds. Parsed and clamped to a safe range by
   * `parseEdgeRecTimeoutMs`; unparseable/non-positive values are ignored (the
   * adapter's own default applies).
   */
  readonly EDGE_REC_TIMEOUT_MS?: string | number;
  /**
   * Injected HTTP client for the promotion/recommendation adapters. The runtime
   * never reaches for a global `fetch`; without this an endpoint cannot be wired
   * and the safe mock provider is used instead.
   */
  readonly fetch?: EdgeRecFetchLike;
  /**
   * Which notification bridge to build.
   *   - "noop"        → `NoopNotificationBridge` (safe default — nothing sent).
   *   - "placeholder" → `PlaceholderNotificationBridge` (dev/test — still nothing sent).
   *   - absent/other  → `NoopNotificationBridge`.
   * Selection only. `notify()` is never auto-called.
   */
  readonly NOTIFICATION_PROVIDER?: string;
  /**
   * Explicit opt-in to use the placeholder bridge. Truthy = `true` or a truthy
   * string ("1"/"true"/"yes"/"on"). Takes effect when `NOTIFICATION_PROVIDER` is
   * not "noop" or "placeholder" but this flag is truthy — same result as
   * `NOTIFICATION_PROVIDER=placeholder`. Selection only; sends nothing.
   */
  readonly ENABLE_NOTIFICATION_PLACEHOLDER?: string | boolean;
  /**
   * Preferred default `NotificationChannel` when building notification payloads.
   * Must be one of the six placeholder channel names; any other value is silently
   * ignored (the bridge constructor receives no channel argument in this stage).
   * Valid values: "telegram_placeholder" | "line_placeholder" | "apns_placeholder"
   * | "fcm_placeholder" | "email_placeholder" | "local_placeholder".
   */
  readonly NOTIFICATION_DEFAULT_CHANNEL?: string;
  /**
   * Which payment provider to build (Stage 44's `PaymentProvider` seam).
   *   - "noop"        → `NoopPaymentProvider` (safe default — always `unavailable`/rejected).
   *   - "placeholder" → `PlaceholderPaymentProvider` (dev/test — still charges nothing).
   *   - absent/other  → `NoopPaymentProvider`.
   * Selection only. `requestPayment()` is never auto-called, and
   * `paymentDecisionToGrant` is never called from the runtime — no
   * `PurchaseGrant` is ever issued by constructing a runtime.
   */
  readonly PAYMENT_PROVIDER?: string;
  /**
   * Explicit opt-in to use the placeholder provider. Truthy = `true` or a
   * truthy string ("1"/"true"/"yes"/"on"). Takes effect when `PAYMENT_PROVIDER`
   * is not "noop" or "placeholder" but this flag is truthy — same result as
   * `PAYMENT_PROVIDER=placeholder`. Selection only; charges nothing.
   */
  readonly ENABLE_PAYMENT_PLACEHOLDER?: string | boolean;
  /**
   * Preferred default `PaymentRail` for building payment requests. Must be one
   * of the six placeholder rail names; any other value is silently ignored (no
   * provider constructor takes it in this stage — see
   * `resolvePaymentDefaultRail`). Valid values: "lightning_placeholder" |
   * "stripe_placeholder" | "apple_pay_placeholder" | "google_pay_placeholder" |
   * "manual_placeholder" | "external_placeholder".
   */
  readonly PAYMENT_DEFAULT_RAIL?: string;
  /**
   * EXPLICIT opt-in half of the Stage 52 dual-flag gate for invoking a REAL
   * `promotionProvider` (e.g. `EdgeRecPromotionProvider`) for a preview.
   * Truthy = `true` or a truthy string ("1"/"true"/"yes"/"on"). This alone
   * does NOT invoke anything — the Worker also requires an explicit per-request
   * query flag (`?edgeRecPreview=1` / `?providerPromotionPreview=1`) before it
   * ever calls `invokePromotionProviderPreview`. Reflected into
   * `AppRuntime.promotionProviderPreviewAllowed`; selection/flag only.
   */
  readonly ENABLE_PROMOTION_PROVIDER_PREVIEW?: string | boolean;
  /**
   * Which WebAuthn / Passkey browser provider to build (Stage 60's
   * `WebAuthnProvider` seam).
   *   - "noop"        → `NoopWebAuthnProvider` (safe default — permanently
   *                     `unavailable`, advertises nothing, denies every attempt).
   *   - "placeholder" → `PlaceholderWebAuthnProvider` (dev/test — models the UX
   *                     states but still calls no browser API and unlocks nothing).
   *   - absent/other  → `NoopWebAuthnProvider`.
   * Selection only. `begin()`/`cancel()` are NEVER auto-called, no
   * browser credential API is touched, no Face ID / Touch ID is launched,
   * and no credential/challenge is stored.
   */
  readonly WEBAUTHN_PROVIDER?: string;
  /**
   * Explicit opt-in to use the placeholder provider. Truthy = `true` or a truthy
   * string ("1"/"true"/"yes"/"on"). Takes effect when `WEBAUTHN_PROVIDER` is not
   * "noop" or "placeholder" but this flag is truthy — same result as
   * `WEBAUTHN_PROVIDER=placeholder`. Selection only; starts no WebAuthn request.
   */
  readonly ENABLE_WEBAUTHN_PLACEHOLDER?: string | boolean;
  /**
   * Which crypto core provider to build (Stage 34's `CryptoProvider` seam).
   *   - "noop"  → `NoopCryptoProvider` (safe default — permanently `unavailable`,
   *               advertises nothing, denies every operation).
   *   - "fedos" → `FedosCoreCryptoProvider` injected with the permanently-inert
   *               `PlaceholderFedosCoreCrypto` ONLY (no real Rust/WASM core, no
   *               WASM loader). Still `unavailable`; runs no cryptography.
   *   - absent/other → `NoopCryptoProvider`.
   * Selection only. `randomBytes()`/`deriveKey()`/`encrypt()`/`decrypt()` are
   * NEVER auto-called; no WASM is loaded, no `fetch`/dynamic import happens, and
   * no randomness/KDF/AEAD runs.
   */
  readonly CRYPTO_PROVIDER?: string;
  /**
   * Explicit opt-in to use the FedOS core provider (placeholder core only).
   * Truthy = `true` or a truthy string ("1"/"true"/"yes"/"on"). Takes effect
   * when `CRYPTO_PROVIDER` is not "noop" or "fedos" but this flag is truthy —
   * same result as `CRYPTO_PROVIDER=fedos`. Selection only; runs no cryptography.
   */
  readonly ENABLE_CRYPTO_PLACEHOLDER?: string | boolean;
}

/**
 * Explicit overrides that win over anything selected from `env`. Used by tests
 * and by callers that want to pin a specific boundary (e.g. a stub publisher).
 */
export interface RuntimeOverrides {
  readonly mode?: RuntimeMode;
  readonly eventCache?: EventCache;
  readonly assetCache?: AssetCache;
  /** Pre-built notification bridge. Wins over any `env` notification fields. */
  readonly notificationBridge?: NotificationBridge;
  /**
   * A pre-built MeshKV client. Wins over `env.MESHKV_ASSET_CACHE` and the opt-in
   * browser-client path when selecting the asset cache. Ignored if `assetCache`
   * is supplied.
   */
  readonly meshKVClient?: MeshKVClient;
  /**
   * A MeshKV node / `MeshKVApi` to build a `MeshKVBrowserClient` from, used ONLY
   * under the `ENABLE_MESHKV_ASSET_CACHE` opt-in. Wins over `env.MESHKV_API`.
   */
  readonly meshKVApi?: MeshKVApi;
  readonly spaceDirectory?: SpaceDirectory | AsyncSpaceDirectory;
  readonly metadataIndex?: MetadataIndex;
  readonly signatureVerifier?: SignatureVerifier;
  readonly promotionProvider?: PromotionProvider;
  readonly recommendationProvider?: RecommendationProvider;
  readonly relayPublisher?: RelayPublisher;
  /** Pre-built payment provider. Wins over any `env` payment fields. */
  readonly paymentProvider?: PaymentProvider;
  /**
   * Pre-built WebAuthn provider. Wins over any `env` WebAuthn fields.
   * Selection only — the runtime never calls its `begin()`/`cancel()`.
   */
  readonly webAuthnProvider?: WebAuthnProvider;
  /**
   * Pre-built crypto provider. Wins over any `env` crypto fields. Selection only
   * — the runtime never calls its `randomBytes`/`deriveKey`/`encrypt`/`decrypt`.
   */
  readonly cryptoProvider?: CryptoProvider;
}

/** The assembled set of boundaries the app runs against. */
export interface AppRuntime {
  readonly mode: RuntimeMode;
  readonly eventCache: EventCache;
  /** Public/unlisted media cache (previews, thumbnails, segments). In-memory only. */
  readonly assetCache: AssetCache;
  /** Sync (in-memory) or async (D1) directory; the async one is not auto-wired. */
  readonly spaceDirectory: SpaceDirectory | AsyncSpaceDirectory;
  readonly metadataIndex: MetadataIndex;
  readonly signatureVerifier: SignatureVerifier;
  readonly promotionProvider: PromotionProvider;
  readonly recommendationProvider: RecommendationProvider;
  readonly relayPublisher: RelayPublisher;
  /**
   * The selected notification bridge. Selected from env; `notify()` is NEVER
   * called automatically. Sending nothing is the default (`NoopNotificationBridge`).
   * No Telegram/LINE/APNs/FCM/Email API is contacted.
   */
  readonly notificationBridge: NotificationBridge;
  /**
   * The selected payment provider. Selected from env; `requestPayment()` is
   * NEVER called automatically and `paymentDecisionToGrant` is never called
   * from the runtime — no `PurchaseGrant` is ever issued by constructing a
   * runtime. Charging nothing is the default (`NoopPaymentProvider`). No
   * Lightning/Stripe/Apple Pay/Google Pay rail is contacted.
   */
  readonly paymentProvider: PaymentProvider;
  /**
   * Stage 52: whether `ENABLE_PROMOTION_PROVIDER_PREVIEW` was truthy in env —
   * HALF of the dual-flag gate for invoking a REAL `promotionProvider` for a
   * preview. This flag alone never invokes anything; the Worker also requires
   * an explicit per-request query flag before calling
   * `invokePromotionProviderPreview`. Constructing a runtime with this `true`
   * calls no provider method and issues no `fetch`.
   */
  readonly promotionProviderPreviewAllowed: boolean;
  /**
   * The selected WebAuthn / Passkey browser provider (Stage 62). Selected from
   * env; `begin()`/`cancel()` are NEVER called automatically. The safe default
   * (`NoopWebAuthnProvider`) is permanently `unavailable`. Constructing a
   * runtime touches no browser credential API, launches no Face ID /
   * Touch ID, contacts no Secure Enclave / Android Keystore, and stores no
   * credential/challenge. WebAuthn / Passkey remains an unlock TRIGGER only,
   * never a key source — and no unlock happens by building a runtime.
   */
  readonly webAuthnProvider: WebAuthnProvider;
  /**
   * The selected crypto core provider (Stage 65). Selected from env;
   * `randomBytes()`/`deriveKey()`/`encrypt()`/`decrypt()` are NEVER called
   * automatically. The safe default (`NoopCryptoProvider`) is permanently
   * `unavailable`. The FedOS option injects the permanently-inert
   * `PlaceholderFedosCoreCrypto` ONLY — no real Rust/WASM core, no WASM loader.
   * Constructing a runtime loads no WASM, issues no `fetch`/dynamic import, runs
   * no KDF/AEAD, and generates no randomness.
   */
  readonly cryptoProvider: CryptoProvider;
}
