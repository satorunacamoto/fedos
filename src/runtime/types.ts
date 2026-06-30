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

import type { EventCache } from "../cache/types.js";
import type { KvLikeNamespace } from "../cache/kv_event_cache.js";
import type { AsyncSpaceDirectory, SpaceDirectory } from "../community/directory.js";
import type { D1LikeDatabase } from "../indexer/d1_index.js";
import type { MetadataIndex } from "../indexer/types.js";
import type { SignatureVerifier } from "../nostr/signature.js";
import type { RelayPublisher } from "../nostr/publish.js";
import type { PromotionProvider, RecommendationProvider } from "../promotion/adapter.js";
import type { EdgeRecFetchLike } from "../promotion/edge_rec_adapter.js";

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
  /** edge-rec-middleware endpoint for promotions (selection only; no auto-serve). */
  readonly PROMOTION_ENDPOINT?: string;
  /** Optional bearer token for the promotion endpoint. */
  readonly PROMOTION_API_KEY?: string;
  /** recommendation-rewriter endpoint (falls back to the promotion endpoint). */
  readonly RECOMMENDATION_ENDPOINT?: string;
  /**
   * Injected HTTP client for the promotion/recommendation adapters. The runtime
   * never reaches for a global `fetch`; without this an endpoint cannot be wired
   * and the safe mock provider is used instead.
   */
  readonly fetch?: EdgeRecFetchLike;
}

/**
 * Explicit overrides that win over anything selected from `env`. Used by tests
 * and by callers that want to pin a specific boundary (e.g. a stub publisher).
 */
export interface RuntimeOverrides {
  readonly mode?: RuntimeMode;
  readonly eventCache?: EventCache;
  readonly spaceDirectory?: SpaceDirectory | AsyncSpaceDirectory;
  readonly metadataIndex?: MetadataIndex;
  readonly signatureVerifier?: SignatureVerifier;
  readonly promotionProvider?: PromotionProvider;
  readonly recommendationProvider?: RecommendationProvider;
  readonly relayPublisher?: RelayPublisher;
}

/** The assembled set of boundaries the app runs against. */
export interface AppRuntime {
  readonly mode: RuntimeMode;
  readonly eventCache: EventCache;
  /** Sync (in-memory) or async (D1) directory; the async one is not auto-wired. */
  readonly spaceDirectory: SpaceDirectory | AsyncSpaceDirectory;
  readonly metadataIndex: MetadataIndex;
  readonly signatureVerifier: SignatureVerifier;
  readonly promotionProvider: PromotionProvider;
  readonly recommendationProvider: RecommendationProvider;
  readonly relayPublisher: RelayPublisher;
}
