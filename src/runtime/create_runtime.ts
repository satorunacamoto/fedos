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

import { InMemoryAssetCache } from "../asset/memory_asset_cache.js";
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

/**
 * The public asset cache. Always the in-memory cache in Stage 22 — an R2 / HTTP /
 * MeshKV adapter slots in here later (e.g. keyed off `NOSTR_ASSET_R2`). It only
 * ever holds public/unlisted media; the policy guardrail keeps private/paid out.
 */
export function selectAssetCache(_env?: RuntimeEnv): AssetCache {
  return defaultAssetCache;
}

/** Always real BIP-340 Schnorr verification (verify-only; no signing). */
export function selectSignatureVerifier(_env?: RuntimeEnv): SignatureVerifier {
  return NobleSignatureVerifier;
}

/**
 * EdgeRec adapter when an endpoint AND an injected fetch are present, else the
 * inert mock. Selecting the EdgeRec adapter does NOT call out — it is merely
 * ready to, behind an injected client.
 */
export function selectPromotionProvider(env?: RuntimeEnv): PromotionProvider {
  if (env?.PROMOTION_ENDPOINT && env.fetch) {
    return new EdgeRecPromotionProvider({
      fetch: env.fetch,
      endpoint: env.PROMOTION_ENDPOINT,
      ...(env.PROMOTION_API_KEY !== undefined ? { apiKey: env.PROMOTION_API_KEY } : {}),
    });
  }
  return new MockPromotionProvider();
}

/**
 * EdgeRec adapter (shares the promotion transport) when a recommendation or
 * promotion endpoint AND an injected fetch are present, else the inert mock.
 */
export function selectRecommendationProvider(env?: RuntimeEnv): RecommendationProvider {
  const endpoint = env?.RECOMMENDATION_ENDPOINT ?? env?.PROMOTION_ENDPOINT;
  if (endpoint && env?.fetch) {
    return new EdgeRecPromotionProvider({
      fetch: env.fetch,
      endpoint,
      ...(env.PROMOTION_API_KEY !== undefined ? { apiKey: env.PROMOTION_API_KEY } : {}),
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

/** Cloudflare when any binding/endpoint is present, local with a bare env, else test. */
function resolveMode(env?: RuntimeEnv): RuntimeMode {
  if (!env) return "test";
  if (
    env.NOSTR_EVENT_CACHE ||
    env.NOSTR_SPACE_DB ||
    env.NOSTR_INDEX ||
    env.PROMOTION_ENDPOINT ||
    env.RECOMMENDATION_ENDPOINT
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
    assetCache: overrides.assetCache ?? selectAssetCache(env),
    spaceDirectory: overrides.spaceDirectory ?? selectSpaceDirectory(env),
    metadataIndex: overrides.metadataIndex ?? selectMetadataIndex(env),
    signatureVerifier: overrides.signatureVerifier ?? selectSignatureVerifier(env),
    promotionProvider: overrides.promotionProvider ?? selectPromotionProvider(env),
    recommendationProvider:
      overrides.recommendationProvider ?? selectRecommendationProvider(env),
    relayPublisher: overrides.relayPublisher ?? selectRelayPublisher(env),
  };
}
