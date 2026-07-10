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
import type { StorageBackend } from "../storage/types.js";
import type { FederationProvider } from "../federation/types.js";
import type { ChatProvider } from "../chat/types.js";
import type { MarketplaceProvider } from "../marketplace/types.js";
import type { EntitlementProvider } from "../creator/entitlement.js";
import type { RuntimeCryptoProvider } from "./crypto_provider.js";
import type { RuntimeCapabilities } from "./fedos_runtime_prototype_execution.js";
import type { AeadKeyHandle } from "./fedos_runtime_aead_key_generation.js";
import type {
  AeadCiphertextHandle,
  AeadAlgorithm,
  AeadAadDomain,
} from "./fedos_runtime_encrypt.js";
import type { AeadCiphertextWire } from "./fedos_runtime_export_ciphertext.js";

/** Where the runtime believes it is running. Affects defaults/diagnostics only. */
export type RuntimeMode = "test" | "local" | "cloudflare";

/**
 * Stage 689–696 (Prototype Phase 001) — the fixed reason
 * `AppRuntime.initializeCrypto()` always reports. `"PrototypeDisabled"`
 * is the ONLY value produced in this stage; this is a Runtime PUBLIC
 * API PROTOTYPE ONLY, deliberately separate from the twelve
 * `PlanningOnly` layers in `src/runtime/fedos_*.ts`
 * (`docs/runtime_initialize_crypto_planning_review.md`) — it neither
 * calls nor extends any of them.
 */
export type RuntimeInitializeCryptoReason = "PrototypeDisabled";

/**
 * The fixed result `AppRuntime.initializeCrypto()` always returns in
 * this stage — see `docs/runtime_initialize_crypto_prototype.md`.
 * `allowed`/`initialized` are typed as the literal `false`: this is a
 * public API SHAPE only ("adds a door, does not open it"). No
 * Rust/WASM/Loader/generated JS glue call of any kind, and no
 * `import()` (static or dynamic), ever produces this value.
 */
export interface RuntimeInitializeCryptoResult {
  readonly allowed: false;
  readonly initialized: false;
  readonly reason: RuntimeInitializeCryptoReason;
}

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
  /**
   * Which storage backend to build (Stage 107's `StorageBackend` seam).
   *   - "noop"        → `NoopStorageBackend` (safe default — always `unavailable`, denies every attempt).
   *   - "placeholder" → `PlaceholderStorageBackend` (dev/test — still stores nothing).
   *   - absent/other  → `NoopStorageBackend`.
   * Selection only. `put()`/`get()`/`delete()` are NEVER auto-called, and no
   * Google Drive API, Nostr relay WebSocket, SQLite, Bluetooth/Wi-Fi mesh, or
   * content-addressed gateway is contacted.
   */
  readonly STORAGE_PROVIDER?: string;
  /**
   * Explicit opt-in to use the placeholder backend. Truthy = `true` or a
   * truthy string ("1"/"true"/"yes"/"on"). Takes effect when `STORAGE_PROVIDER`
   * is not "noop" or "placeholder" but this flag is truthy — same result as
   * `STORAGE_PROVIDER=placeholder`. Selection only; stores nothing.
   */
  readonly ENABLE_STORAGE_PLACEHOLDER?: string | boolean;
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
  /**
   * Pre-built storage backend. Wins over any `env` storage fields. Selection
   * only — the runtime never calls its `put`/`get`/`delete`.
   */
  readonly storageBackend?: StorageBackend;
  /**
   * Pre-built federation provider (Stage 110's `FederationProvider` seam).
   * Wins over the default. Selection only — the runtime never calls its
   * `connect`/`disconnect`/`publishPlaceholder`/`fetchPlaceholder`.
   */
  readonly federationProvider?: FederationProvider;
  /**
   * Pre-built chat provider (Stage 111's `ChatProvider` seam — a
   * protocol-neutral DM/chat TRANSPORT boundary, unrelated to the Stage 16
   * `ChatRoom`/`ChatMessage` model). Wins over the default. Selection only
   * — the runtime never calls its `sendPlaceholder`/`fetchPlaceholder`.
   */
  readonly chatProvider?: ChatProvider;
  /**
   * Pre-built marketplace provider (Stage 111's `MarketplaceProvider`
   * seam). Wins over the default. Selection only — the runtime never calls
   * its `listPlaceholder`/`purchasePlaceholder`.
   */
  readonly marketplaceProvider?: MarketplaceProvider;
  /**
   * Pre-built creator entitlement provider (Stage 111's
   * `EntitlementProvider` seam). Wins over the default. Selection only —
   * the runtime never calls its `checkPlaceholder`.
   */
  readonly creatorEntitlementProvider?: EntitlementProvider;
  /**
   * Pre-built Runtime crypto provider (Stage 249's `RuntimeCryptoProvider`
   * seam — deliberately SEPARATE from `cryptoProvider`/`CryptoProvider`
   * above). Wins over the default. Selection only — the runtime never
   * calls its `encrypt`/`decrypt`, and this stage's own default
   * (`buildRuntimeCryptoProvider`, Stage 259) never resolves anything but
   * a placeholder regardless of this override being supplied or not.
   */
  readonly runtimeCryptoProvider?: RuntimeCryptoProvider;
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
  /**
   * The selected storage backend (Stage 107's `StorageBackend` seam).
   * Selected from env; `put()`/`get()`/`delete()` are NEVER called
   * automatically. The safe default (`NoopStorageBackend`) is permanently
   * `unavailable`. Constructing a runtime contacts no Google Drive API,
   * opens no Nostr relay WebSocket, touches no SQLite, no Bluetooth/Wi-Fi
   * mesh, and no content-addressed gateway, and issues no `fetch`/file IO.
   */
  readonly storageBackend: StorageBackend;
  /**
   * The selected federation provider (Stage 110's `FederationProvider`
   * seam). Currently ALWAYS a `NoopFederationProvider` unless an
   * `overrides.federationProvider` is supplied — there is no env-selectable
   * real/placeholder adapter yet. `connect()`/`disconnect()`/
   * `publishPlaceholder()`/`fetchPlaceholder()` are NEVER called
   * automatically. Constructing a runtime opens no relay/WebSocket/HTTP/
   * OAuth/AT-Protocol session and signs/publishes/fetches nothing.
   */
  readonly federationProvider: FederationProvider;
  /**
   * The selected chat provider (Stage 111's `ChatProvider` seam — a
   * protocol-neutral DM/chat TRANSPORT boundary, unrelated to the Stage 16
   * `ChatRoom`/`ChatMessage` model already used for in-app chat
   * rendering). ALWAYS a `NoopChatProvider` unless
   * `overrides.chatProvider` is supplied. `sendPlaceholder()`/
   * `fetchPlaceholder()` are NEVER called automatically. Constructing a
   * runtime opens no relay/WebSocket session and encrypts/decrypts/sends
   * nothing.
   */
  readonly chatProvider: ChatProvider;
  /**
   * The selected marketplace provider (Stage 111's `MarketplaceProvider`
   * seam). ALWAYS a `NoopMarketplaceProvider` unless
   * `overrides.marketplaceProvider` is supplied. `listPlaceholder()`/
   * `purchasePlaceholder()` are NEVER called automatically. Constructing a
   * runtime lists nothing, charges nothing, and issues no `PurchaseGrant`.
   */
  readonly marketplaceProvider: MarketplaceProvider;
  /**
   * The selected creator entitlement provider (Stage 111's
   * `EntitlementProvider` seam). ALWAYS a `NoopEntitlementProvider` unless
   * `overrides.creatorEntitlementProvider` is supplied.
   * `checkPlaceholder()` is NEVER called automatically, and `allowed:
   * true` is never produced by the default. Constructing a runtime grants
   * no access and contacts no payment rail.
   */
  readonly creatorEntitlementProvider: EntitlementProvider;
  /**
   * The selected Runtime crypto provider (Stage 249's
   * `RuntimeCryptoProvider` seam — deliberately SEPARATE from `cryptoProvider`
   * above; see `docs/runtime_crypto_bridge.md`/`docs/runtime_worker_crypto_bridge.md`).
   * ALWAYS a `PlaceholderRuntimeCryptoProvider` in this stage (via
   * `buildRuntimeCryptoProvider`, Stage 259) unless
   * `overrides.runtimeCryptoProvider` is supplied — and even that override
   * path never causes THIS runtime to call `encrypt`/`decrypt`
   * automatically, since `createRuntime` never invokes them.
   * `runtimeCryptoEnabled` (`src/runtime/runtime_crypto_config.ts`) is
   * permanently `false`; no `packages/fedos-core-rust` call (Rust crate or
   * TS package boundary) happens anywhere in resolving this field.
   */
  readonly crypto: RuntimeCryptoProvider;
  /**
   * Stage 689–696 (Prototype Phase 001) — the first Runtime PUBLIC API
   * prototype for the twelve-layer `fedos_*.ts` `PlanningOnly` chain
   * (`docs/runtime_initialize_crypto_planning_review.md`). Calling it
   * performs NO real work: no Rust/WASM/Loader/generated JS glue call
   * of any kind, and no `import()` (static or dynamic) anywhere. ALWAYS
   * resolves `{ allowed: false, initialized: false, reason:
   * "PrototypeDisabled" }` in this stage — this adds the door; it does
   * not open it. Deliberately separate from `cryptoProvider`/`crypto`
   * above, both UNCHANGED by this stage. See
   * `docs/runtime_initialize_crypto_prototype.md`.
   */
  readonly initializeCrypto: () => RuntimeInitializeCryptoResult;
  /**
   * Stage 999 (Secure Runtime Alpha 003) — the FIRST read-only Runtime
   * Capability Reader, per
   * `docs/secure_runtime_alpha_002_public_surface_review.md` §7's own
   * recommendation. Reports ONLY "how far Runtime currently reaches"
   * (`prototypeCompleted`/`rustReachable`/`rustVersion`/`runtimeMode`)
   * — it triggers no activation, grants no permission, and is NEVER
   * read by `initializeCrypto()`'s own `if` logic (the two fields
   * above remain byte-for-byte unchanged by this stage). Internally
   * calls `attemptDevOnlyRuntimeRustIntegration()`
   * (`fedos_runtime_prototype_execution.ts`, Stage 994) exactly once —
   * no new Rust call, no new gate, no new Fail-Closed reason of its
   * own. See `docs/secure_runtime_alpha_003_capability_reader.md`.
   * Stage 1001 (Secure Runtime Alpha 005) renamed this field's own
   * `runtimeState` to `runtimeMode` and dropped `"Prototype"` from its
   * value union in favor of `"Unknown"` — naming cleanup only, no
   * behavior change; see
   * `docs/secure_runtime_alpha_005_runtime_state_naming_cleanup.md`.
   */
  readonly runtimeCapabilities: () => Promise<RuntimeCapabilities>;
  /**
   * Stage 1004 (Secure Runtime Alpha 008) — the FIRST public Crypto
   * API Runtime exposes, per this arc's own four-layer Public Runtime
   * API -> Runtime Service -> Rust Boundary -> Internal Rust design.
   * Internally calls
   * `attemptDevOnlyRuntimeRandomBytes()`
   * (`fedos_runtime_random_bytes.ts`, Stage 1004) exactly once, which
   * drives a FRESH `FedosWasmLoader` through the SAME six-condition
   * chain `runtimeCapabilities()` already exercises, then calls the
   * Rust Boundary's `random_bytes_32()` — a thin, non-cryptographic
   * wrapper around the pre-existing, unchanged
   * `fedos_random_bytes_32()`. Fail Closed: resolves `null` whenever
   * any of the Loader's own six conditions is unmet, the export is
   * absent, the call throws, or Rust itself reports
   * `EntropySourceUnavailable` — NEVER a partial/zeroed/degraded
   * result, and NEVER an exception escaping this field. Deliberately
   * separate from `initializeCrypto`/`runtimeCapabilities` above, both
   * UNCHANGED by this stage. See
   * `docs/secure_runtime_alpha_008_random_bytes.md`.
   */
  readonly randomBytes: () => Promise<Uint8Array | null>;
  /**
   * Stage 1005 (Secure Runtime Alpha 010), reshaped Stage 1008 (Secure
   * Runtime Alpha 013) — the SECOND public Crypto API Runtime exposes,
   * mirroring `randomBytes` (Stage 1004)'s own four-layer reach.
   * Internally calls `attemptDevOnlyRuntimeAeadKeyGeneration()`
   * (`fedos_runtime_aead_key_generation.ts`) exactly once, which drives
   * a FRESH `FedosWasmLoader` through the SAME six-condition chain,
   * then calls the Rust Boundary's `generate_aead_key_handle()` — a
   * thin wrapper around the pre-existing, unchanged
   * `fedos_generate_aead_key_32()`. Fail Closed: resolves `null`
   * whenever any of the Loader's own six conditions is unmet, the
   * export is absent, the call throws, the return value is not a
   * genuine opaque handle, or Rust itself reports
   * `EntropySourceUnavailable` — NEVER a partial/degraded result, and
   * NEVER an exception escaping this field.
   * **OPAQUE KEY HANDLE**: per this arc's own Alpha 012 Key Boundary
   * Decision's deliberate breaking-change decision, this field NO
   * LONGER returns raw key bytes — it resolves an opaque `AeadKeyHandle`, which
   * exposes no byte, no raw material, and no serialization of any
   * kind. Still NOT Secure Storage — this field retains no copy of any
   * handle beyond one call's own `await` chain.
   * `encrypt()`/`decrypt()`/`importKey()`/`exportKey()` remain
   * unimplemented. Deliberately separate from
   * `initializeCrypto`/`runtimeCapabilities`/`randomBytes` above, all
   * UNCHANGED by this stage. See
   * `docs/secure_runtime_alpha_013_opaque_aead_key_handle_migration.md`.
   */
  readonly generateAeadKey: () => Promise<AeadKeyHandle | null>;
  /**
   * Stage 1009 (Secure Runtime Alpha 014) — the THIRD public Crypto API
   * Runtime exposes, and the FIRST performing a real cryptographic
   * OPERATION (as opposed to randomness/key generation). Internally
   * calls `attemptDevOnlyRuntimeEncrypt()`
   * (`fedos_runtime_encrypt.ts`) exactly once, which drives a FRESH
   * `FedosWasmLoader` through the SAME six-condition chain, then calls
   * the Rust Boundary's `encrypt_aead()` — a thin wrapper around the
   * pre-existing, unchanged `fedos_encrypt()`. Fail Closed: resolves
   * `null` whenever any of the Loader's own six conditions is unmet,
   * `key` is not a genuine opaque handle, the export is absent, the
   * call throws, the return value is not a genuine ciphertext handle,
   * or Rust itself fails to encrypt — NEVER a partial/degraded result,
   * and NEVER an exception escaping this field.
   * **OPAQUE HANDLE ONLY**: `key` MUST be an `AeadKeyHandle` (Stage
   * 1008) — no raw `Uint8Array` key is ever accepted anywhere in this
   * field's own call chain. The returned `AeadCiphertextHandle` is
   * likewise opaque — no raw ciphertext byte is ever exposed. The
   * Ciphertext boundary's own final wire-format design remains a
   * separate, later, unresolved question this field does not attempt
   * to answer. `importKey()`/`exportKey()` remain unimplemented.
   * `decrypt()` (below) was added later by Stage 1010 (Secure Runtime
   * Alpha 015). Deliberately separate from
   * `initializeCrypto`/`runtimeCapabilities`/`randomBytes`/
   * `generateAeadKey` above, all UNCHANGED by this stage. See
   * `docs/secure_runtime_alpha_014_encrypt_opaque_handle_api.md`.
   */
  readonly encrypt: (
    key: AeadKeyHandle,
    algorithm: AeadAlgorithm,
    aadDomain: AeadAadDomain,
    plaintext: Uint8Array,
  ) => Promise<AeadCiphertextHandle | null>;
  /**
   * Stage 1010 (Secure Runtime Alpha 015) — the FOURTH public Crypto
   * API Runtime exposes, and the SECOND performing a real cryptographic
   * operation — the counterpart to `encrypt` above. Internally calls
   * `attemptDevOnlyRuntimeDecrypt()` (`fedos_runtime_decrypt.ts`)
   * exactly once, which drives a FRESH `FedosWasmLoader` through the
   * SAME six-condition chain, then calls the Rust Boundary's
   * `decrypt_aead()` — a thin wrapper around the pre-existing,
   * unchanged `fedos_decrypt()`. Fail Closed: resolves `null` whenever
   * any of the Loader's own six conditions is unmet, `key`/`ciphertext`
   * is not a genuine opaque handle, `algorithm`/`aadDomain` is not a
   * known label, the export is absent, the call throws, the return
   * value is not a genuine `Uint8Array`, or Rust itself declines to
   * decrypt (wrong key, an algorithm/AAD-domain that does not match
   * what was actually sealed into `ciphertext`, a tampered ciphertext,
   * or an internal failure — ALL collapsed into the SAME Fail-Closed
   * outcome, never a distinguishable reason, per this crate's own
   * "never expose WHY a decrypt failed" AEAD discipline) — NEVER a
   * partial/degraded result, and NEVER an exception escaping this
   * field.
   * **OPAQUE HANDLES ONLY**: `key`/`ciphertext` MUST be the SAME
   * `AeadKeyHandle`/`AeadCiphertextHandle` types `generateAeadKey()`/
   * `encrypt()` already produce — no raw `Uint8Array` key or ciphertext
   * is ever accepted anywhere in this field's own call chain. The
   * RECOVERED PLAINTEXT is the one value this field returns as a plain
   * `Uint8Array` — there is no opaque wrapper for a caller's own
   * requested plaintext to hide behind. `importKey()`/`exportKey()`
   * remain unimplemented. `exportCiphertext`/`importCiphertext` (below)
   * were added later by Stage 1011 (Secure Runtime Alpha 018).
   * Deliberately separate from
   * `initializeCrypto`/`runtimeCapabilities`/`randomBytes`/
   * `generateAeadKey`/`encrypt` above, all UNCHANGED by this stage. See
   * `docs/secure_runtime_alpha_015_decrypt_opaque_handle_api.md`.
   */
  readonly decrypt: (
    key: AeadKeyHandle,
    algorithm: AeadAlgorithm,
    aadDomain: AeadAadDomain,
    ciphertext: AeadCiphertextHandle,
  ) => Promise<Uint8Array | null>;
  /**
   * Stage 1011 (Secure Runtime Alpha 018) — the FIFTH public Crypto API
   * Runtime exposes, executing
   * `docs/secure_runtime_alpha_017_ciphertext_wire_format_decision.md`'s
   * own formally-decided contract. Internally calls
   * `attemptDevOnlyRuntimeExportCiphertext()`
   * (`fedos_runtime_export_ciphertext.ts`) exactly once, which drives a
   * FRESH `FedosWasmLoader` through the SAME six-condition chain, then
   * calls the Rust Boundary's `serialize_aead_ciphertext()` — a thin
   * wrapper around the pre-existing, unchanged
   * `encode_envelope_internal()` (Stage 186). Fail Closed: resolves
   * `null` whenever any of the Loader's own six conditions is unmet,
   * `ciphertext` is not a genuine opaque handle, the export is absent,
   * the call throws, or the return value is not a genuine, non-empty
   * `string` — NEVER a partial/degraded result, and NEVER an exception
   * escaping this field.
   * **OPAQUE HANDLE IN, BRANDED WIRE STRING OUT**: `ciphertext` MUST be
   * the SAME `AeadCiphertextHandle` type `encrypt()` already produces —
   * no raw ciphertext byte is ever accepted or returned anywhere in
   * this field's own call chain. The returned `AeadCiphertextWire` is a
   * branded `string` — the SAME canonical JSON + base64url text
   * (`v`/`alg`/`aad`/`n`/`ct`/`tag`) this crate's own
   * `docs/ciphertext_serialization_format_decision.md` (Stage 182)
   * fixed and Stage 186 already implements; no new wire format is
   * created. The brand is a COMPILE-TIME-ONLY API-misuse boundary, NEVER
   * a runtime security boundary — all real Fail-Closed validation of
   * the wire content happens entirely inside Rust. `importCiphertext`
   * (below) is this field's required pair — both were added together,
   * in this same Stage. Deliberately separate from
   * `initializeCrypto`/`runtimeCapabilities`/`randomBytes`/
   * `generateAeadKey`/`encrypt`/`decrypt` above, all UNCHANGED by this
   * stage. See
   * `docs/secure_runtime_alpha_018_ciphertext_wire_export_import_api.md`.
   */
  readonly exportCiphertext: (
    ciphertext: AeadCiphertextHandle,
  ) => Promise<AeadCiphertextWire | null>;
  /**
   * Stage 1011 (Secure Runtime Alpha 018) — the SIXTH public Crypto API
   * Runtime exposes, and `exportCiphertext`'s (above) required pair.
   * Internally calls `attemptDevOnlyRuntimeImportCiphertext()`
   * (`fedos_runtime_import_ciphertext.ts`) exactly once, which drives a
   * FRESH `FedosWasmLoader` through the SAME six-condition chain, then
   * calls the Rust Boundary's `deserialize_aead_ciphertext()` — a thin
   * wrapper around the pre-existing, unchanged
   * `decode_envelope_internal()` (Stage 186). Fail Closed: resolves
   * `null` whenever any of the Loader's own six conditions is unmet,
   * `serialized` is not a genuine `string`, the import is absent, the
   * call throws, or the return value is not a genuine opaque
   * `AeadCiphertextHandle` — including every one of
   * `decode_envelope_internal`'s own wire-structure rejections
   * (malformed JSON, an unrecognized version/algorithm/AAD-domain
   * label, invalid base64url, a missing/unknown/reordered field) — ALL
   * collapsed into the SAME Fail-Closed outcome, never a distinguishable
   * reason — NEVER a partial/degraded result, and NEVER an exception
   * escaping this field.
   * **INPUT IS COMPLETELY UNTRUSTED**: `serialized` may originate from
   * Secure Storage, a network peer, or an adversarial caller — this
   * field performs NO content validation of its own; that is entirely
   * `decode_envelope_internal`'s own, already-reviewed job. **THIS
   * FIELD SUCCEEDING DOES NOT IMPLY A SUBSEQUENT `decrypt` CALL WILL
   * SUCCEED** — this field validates WIRE STRUCTURE only, never
   * cryptographic validity (key/AAD/algorithm match, authentication);
   * that separation is deliberate, per
   * `docs/secure_runtime_alpha_017_ciphertext_wire_format_decision.md`
   * §9. Deliberately separate from
   * `initializeCrypto`/`runtimeCapabilities`/`randomBytes`/
   * `generateAeadKey`/`encrypt`/`decrypt`/`exportCiphertext` above, all
   * UNCHANGED by this stage. See
   * `docs/secure_runtime_alpha_018_ciphertext_wire_export_import_api.md`.
   */
  readonly importCiphertext: (
    serialized: AeadCiphertextWire,
  ) => Promise<AeadCiphertextHandle | null>;
  /**
   * Stage 1012 (Secure Runtime Alpha 019) — the FIRST storage-shaped
   * Public Runtime API, and `loadCiphertext`/`deleteCiphertext`
   * (below)'s own required companion. Internally calls the Runtime
   * Storage Service's own `storeCiphertext()`
   * (`fedos_runtime_ciphertext_storage.ts`) exactly once, which writes
   * into a SINGLE shared, in-process `MemoryCiphertextStorage` instance
   * — the ONLY storage backend this Stage ships. Fail Closed: resolves
   * `null` (never `false`) whenever the Runtime is not Development,
   * `id`/`wire` is not a genuine non-empty `string`, or the storage
   * backend itself throws.
   * **STORES `AeadCiphertextWire` ONLY — NEVER an `AeadKeyHandle` or any
   * raw key byte.** This field's own type signature makes passing an
   * `AeadKeyHandle` a compile-time error; `exportKey()`/`importKey()`
   * remain unimplemented and are not made any more reachable by this
   * Stage. No Rust change was needed or made — a wire string requires
   * no cryptographic operation to store. No Worker/Production/OS
   * Keychain/Network connection of any kind. Deliberately separate from
   * `initializeCrypto`/`runtimeCapabilities`/`randomBytes`/
   * `generateAeadKey`/`encrypt`/`decrypt`/`exportCiphertext`/
   * `importCiphertext` above, all UNCHANGED by this stage. See
   * `docs/secure_runtime_alpha_019_secure_storage_foundation.md`.
   */
  readonly storeCiphertext: (
    id: string,
    wire: AeadCiphertextWire,
  ) => Promise<boolean | null>;
  /**
   * Stage 1012 (Secure Runtime Alpha 019) — `storeCiphertext`'s
   * required companion. Internally calls
   * `fedos_runtime_ciphertext_storage.ts`'s own `loadCiphertext()`
   * exactly once, reading from the SAME shared `MemoryCiphertextStorage`
   * instance `storeCiphertext` writes to. Fail Closed: resolves `null`
   * whenever the Runtime is not Development, `id` is not a genuine
   * non-empty `string`, nothing was ever stored under `id` (or it was
   * deleted), or the storage backend itself throws.
   */
  readonly loadCiphertext: (id: string) => Promise<AeadCiphertextWire | null>;
  /**
   * Stage 1012 (Secure Runtime Alpha 019) — `storeCiphertext`'s other
   * required companion. Internally calls
   * `fedos_runtime_ciphertext_storage.ts`'s own `deleteCiphertext()`
   * exactly once, removing from the SAME shared `MemoryCiphertextStorage`
   * instance. Fail Closed: resolves `null` (never `false`) whenever the
   * Runtime is not Development, `id` is not a genuine non-empty
   * `string`, or the storage backend itself throws.
   */
  readonly deleteCiphertext: (id: string) => Promise<boolean | null>;
}
