/**
 * Stage 5 — minimal Cloudflare Workers entry.
 *
 * Default: sample mode (fixed in-memory events), unchanged from Stage 3/4.
 * Opt-in: `?relay=wss://...` switches to a read-only live relay, but ONLY for an
 * allowlisted set of relays. Anything else is rejected (400) — fail safe. A
 * relay connection failure renders an error page instead of crashing.
 *
 * There is NO posting, NO signing (the live path uses NoopSignatureVerifier, so
 * signatures are NOT verified), NO key handling.
 *
 * Query params (sample and live): ?sort ?q ?author ?minReplies ?since ?until
 * ?limit ?offset. Live mode also reads ?relay and ?timeout (capped).
 *
 * `?product=<id>` renders a read-only product page over the fixed sample
 * products: a summary plus PUBLIC/UNLISTED asset PREVIEW metadata only. The
 * preview metadata may be sourced from the runtime's `AssetCache` (Stage 35),
 * falling back to the fixed sample metadata on a miss/error — METADATA ONLY. The
 * asset cache is consulted ONLY on this product route, never on the board. There
 * is NO body delivery, signed URL, download, or payment — `private`/`paid` assets
 * are never shown and no asset bytes are embedded.
 *
 * `?chat=<id>` renders a read-only chat room over the fixed sample chats, gated
 * by `canReadChat`. Messages are PLAINTEXT labels only — nothing is sent, nothing
 * is encrypted, and there is no send form/button or message delivery.
 */

import { InMemoryRelayAdapter } from "./nostr/relay.js";
import type { RelayAdapter } from "./nostr/relay.js";
import {
  WebSocketRelayAdapter,
  type RelaySocketLike,
  type WebSocketFactory,
} from "./nostr/ws_relay.js";
import { NoopSignatureVerifier } from "./nostr/signature.js";
import type { SignatureVerifier } from "./nostr/signature.js";
import { ingestRawEvents } from "./ingest/ingest.js";
import { buildThreads } from "./thread/thread.js";
import { queryThreads } from "./query/thread_query.js";
import type { SortMode, ThreadQueryOptions } from "./query/types.js";
import {
  InMemoryEventCache,
  getCachedOrFetchEvents,
} from "./cache/event_cache.js";
import type { KvLikeNamespace } from "./cache/kv_event_cache.js";
import type { EventCache } from "./cache/types.js";
import type { NostrFilter } from "./nostr/relay.js";
import type { IngestedEvent } from "./ingest/types.js";
import { canPost, canRead } from "./community/policy.js";
import {
  InMemorySpaceDirectory,
  findSpaceById,
  filterEventsForSpace,
  listReadableSpaces,
  type SpaceDirectory,
} from "./community/directory.js";
import { D1SpaceDirectory } from "./community/d1_directory.js";
import type { D1LikeDatabase } from "./indexer/d1_index.js";
import { SAMPLE_SPACES } from "./community/sample_spaces.js";
import {
  renderCacheStatus,
  renderNotice,
  renderPage,
  renderQueryStatus,
} from "./render/html.js";
import {
  renderSpaceAccessDenied,
  renderSpaceDirectory,
  renderSpaceLanding,
  renderSpaceNotFound,
} from "./render/space.js";
import {
  buildPublishPrototypeView,
  renderPublishPrototype,
} from "./render/publish.js";
import {
  renderProductDirectory,
  renderProductPage,
  renderProductNotFound,
  renderProductAccessDenied,
} from "./render/product.js";
import {
  findProductById,
  listViewableProducts,
} from "./commerce/directory.js";
import { resolveProductAssetPreviews } from "./commerce/asset_preview.js";
import { canViewProduct } from "./commerce/policy.js";
import type { Product } from "./commerce/types.js";
import {
  SAMPLE_PRODUCTS,
  SAMPLE_GRANTS,
  SAMPLE_ASSET_METADATA,
} from "./commerce/sample_products.js";
import type { AssetCache } from "./asset/types.js";
import { canRequestPaymentForProduct, productToPaymentRequest } from "./payment/commerce_bridge.js";
import { PlaceholderPaymentProvider } from "./payment/noop_payment.js";
import { renderPurchasePreview, renderPurchaseUnavailable } from "./render/payment.js";
import {
  renderChatDirectory,
  renderChatRoom,
  renderChatNotFound,
  renderChatAccessDenied,
} from "./render/chat.js";
import {
  findChatById,
  getChatMessages,
  listReadableChats,
} from "./chat/directory.js";
import { canPostChat, canReadChat } from "./chat/policy.js";
import { SAMPLE_CHATS, SAMPLE_CHAT_MESSAGES } from "./chat/sample_chats.js";
import { renderUnifiedDirectory } from "./render/directory.js";
import { buildProductPlacement, buildSpacePlacement } from "./promotion/bridge.js";
import { renderMockPromotionPreview } from "./render/promotion.js";
import { SAMPLE_EVENTS } from "./render/sample.js";
import {
  createRuntime,
  selectEventCache,
  selectSignatureVerifier,
} from "./runtime/create_runtime.js";

const DEMO_RELAY_URL = "wss://demo.invalid";

/** Process-local cache for live relay results (lost on isolate restart). */
const liveCache: EventCache = new InMemoryEventCache();

/** Process-local directory of demo spaces. */
const spaceDirectory: SpaceDirectory = new InMemorySpaceDirectory(SAMPLE_SPACES);

const DEFAULT_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 300;

/** Resolves the cache TTL in seconds. `?cache=0` or non-positive `?ttl` bypasses. */
function parseTtlSeconds(url: URL): number {
  if (url.searchParams.get("cache") === "0") return 0;
  const raw = url.searchParams.get("ttl");
  if (raw === null) return DEFAULT_TTL_SECONDS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_TTL_SECONDS;
  return Math.min(Math.floor(n), MAX_TTL_SECONDS);
}

/** Relays the demo Worker is permitted to connect to. */
const RELAY_ALLOWLIST: ReadonlySet<string> = new Set([
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
]);

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 5000;
const MIN_TIMEOUT_MS = 100;

/** Reads raw query options from the URL. Validation is left to `queryThreads`. */
function parseQueryOptions(url: URL): ThreadQueryOptions {
  const sp = url.searchParams;
  const str = (k: string): string | undefined => sp.get(k) ?? undefined;
  const num = (k: string): number | undefined => {
    const raw = sp.get(k);
    return raw === null ? undefined : Number(raw);
  };
  return {
    sort: str("sort") as SortMode | undefined,
    text: str("q"),
    authorPubkey: str("author"),
    minReplies: num("minReplies"),
    since: num("since"),
    until: num("until"),
    limit: num("limit"),
    offset: num("offset"),
  };
}

function clampTimeout(raw: string | null): number {
  if (raw === null) return DEFAULT_TIMEOUT_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.max(Math.floor(n), MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/**
 * True ONLY when the caller explicitly opts into mock promotion preview mode via
 * `?promotionPreview=1` or `?promotionPreview=true`. This flag gates a
 * mock-provider-only preview (see `renderMockPromotionPreview`); it never enables
 * the real/EdgeRec provider and issues no `fetch`.
 */
export function isPromotionPreviewEnabled(url: URL): boolean {
  const value = url.searchParams.get("promotionPreview");
  return value === "1" || value === "true";
}

/** Builds the query-status HTML for a result page. */
function statusFor(options: ThreadQueryOptions, lead: string, result: ReturnType<typeof buildThreads>): string {
  const query = queryThreads(result, options);
  const status =
    lead +
    renderQueryStatus({
      sort: query.sort,
      total: query.total,
      limit: query.limit,
      offset: query.offset,
      author: query.options.authorPubkey,
      text: query.options.text,
      minReplies: query.options.minReplies,
      since: query.options.since,
      until: query.options.until,
    });
  return renderPage(result, { roots: query.roots, status });
}

/** Cloudflare Workers outbound WebSocket factory (fetch upgrade + accept). */
const createWorkersWebSocket: WebSocketFactory = async (url) => {
  const resp = await fetch(url, { headers: { Upgrade: "websocket" } });
  const ws = (resp as unknown as { webSocket?: WorkersWebSocket }).webSocket;
  if (!ws) throw new Error("relay did not return a WebSocket upgrade");
  ws.accept();
  return {
    send: (data) => ws.send(data),
    close: (code, reason) => ws.close(code, reason),
    addEventListener: (type, listener) =>
      ws.addEventListener(type, (ev: { data?: unknown }) =>
        listener({ data: ev?.data }),
      ),
  } satisfies RelaySocketLike;
};

/** Minimal shape of a Cloudflare Workers WebSocket (avoids a hard lib dep). */
interface WorkersWebSocket {
  accept(): void;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: string, listener: (ev: { data?: unknown }) => void): void;
}

/** Ingested events plus the mode-specific lead notice for a page. */
interface BoardData {
  readonly accepted: IngestedEvent[];
  readonly lead: string;
  /**
   * Whether to show the (empty) promotion placeholders on a space landing. Only
   * sample mode opts in; the live read-only path stays placeholder-free.
   */
  readonly showPromotions: boolean;
}

/** Builds sample-mode board data (default). Sample mode never uses the cache. */
async function buildSampleBoard(now: number): Promise<BoardData> {
  const adapter: RelayAdapter = new InMemoryRelayAdapter(DEMO_RELAY_URL, SAMPLE_EVENTS);
  const events = await adapter.query([{ kinds: [1] }]);
  const { accepted } = ingestRawEvents(events, { relayUrl: adapter.url, now });
  const lead =
    renderNotice(
      "Sample mode — demo events are unsigned (no signature verification).",
      "info",
    ) + renderCacheStatus({ status: "bypass (sample mode)", ttlSeconds: 0 });
  return { accepted, lead, showPromotions: true };
}

/**
 * Read-only product directory of the sample products viewable by the actor.
 * Sample mode only — there is no live D1/asset product lookup yet.
 */
function productDirectoryView(actor: string): string {
  return renderProductDirectory(
    listViewableProducts(SAMPLE_PRODUCTS, actor, SAMPLE_GRANTS),
    actor || undefined,
  );
}

/**
 * Stage 45: a "Purchase preview" panel for the product route ONLY. Uses the
 * Stage 44 payment boundary purely for a DISPLAY decision —
 * `canRequestPaymentForProduct`/`productToPaymentRequest` gate eligibility
 * (draft/archived/invalid price -> unavailable) and a freshly-constructed
 * `PlaceholderPaymentProvider` (never wired into the runtime, never contacted
 * over the network) evaluates the request. `actor` is used only as a display
 * "buyer candidate" — never to process payment or issue a grant.
 * `paymentDecisionToGrant` is never called, so no `PurchaseGrant` is ever
 * issued from this preview.
 */
async function renderProductPurchasePreview(product: Product, actor: string): Promise<string> {
  const eligibility = canRequestPaymentForProduct(product);
  if (!eligibility.allowed) {
    return renderPurchaseUnavailable(eligibility.reason);
  }
  const request = productToPaymentRequest(product, actor || undefined);
  if (!request) {
    return renderPurchaseUnavailable(eligibility.reason);
  }
  const decision = await new PlaceholderPaymentProvider().requestPayment(request);
  return renderPurchasePreview(product, decision, { buyerPubkey: actor || undefined });
}

/**
 * Routes `?product=<id>` against the fixed sample products (read-only):
 * - unknown id       -> not-found page (+ the viewable directory).
 * - view denied      -> access-denied page.
 * - view allowed     -> product summary + public/unlisted asset previews + an
 *                       EMPTY promotion placeholder + a purchase preview panel.
 *
 * Asset previews are PUBLIC/UNLISTED metadata only — no bytes, no download, no
 * signed URL, no payment. `private`/`paid` assets are never shown. When an
 * `assetCache` is supplied (the runtime's), preview METADATA may come from the
 * cache; a miss/error falls back to the fixed sample metadata. The cache is
 * consulted ONLY on this product route — never on the board/directory path.
 * The purchase preview (Stage 45) is likewise product-route only.
 */
async function renderProductRoute(
  data: BoardData,
  productId: string,
  actor: string,
  assetCache?: AssetCache,
  promotionPreview = false,
): Promise<string> {
  const product = findProductById(SAMPLE_PRODUCTS, productId);
  if (!product) {
    return renderPage(buildThreads([]), {
      status: data.lead + renderProductNotFound(productId) + productDirectoryView(actor),
    });
  }

  const decision = canViewProduct(actor, product, SAMPLE_GRANTS);
  if (!decision.allowed) {
    return renderPage(buildThreads([]), {
      status: data.lead + renderProductAccessDenied(product, decision),
    });
  }

  const assets = await resolveProductAssetPreviews(
    product,
    SAMPLE_ASSET_METADATA,
    assetCache,
    Date.now(),
  );
  // Stage 41: ONLY under an explicit preview flag (sample mode), append a
  // mock-provider-driven preview block. No real/EdgeRec provider, no fetch.
  const preview = promotionPreview
    ? await renderMockPromotionPreview(buildProductPlacement(product))
    : "";
  // Stage 45: always appended on this route (view already allowed above) —
  // placeholder only, see `renderProductPurchasePreview`.
  const purchasePreview = await renderProductPurchasePreview(product, actor);
  return renderPage(buildThreads([]), {
    status:
      data.lead +
      renderProductPage(product, decision, assets, {
        promotions: data.showPromotions,
        actorPubkey: actor || undefined,
      }) +
      preview +
      purchasePreview,
  });
}

/**
 * Read-only directory of the sample chats readable by the actor. Sample mode
 * only — there is no live chat lookup, and nothing is sent.
 */
function chatDirectoryView(actor: string): string {
  return renderChatDirectory(
    listReadableChats(SAMPLE_CHATS, actor),
    actor || undefined,
  );
}

/**
 * Routes `?chat=<id>` against the fixed sample chats (read-only):
 * - unknown id     -> not-found page (+ the readable directory).
 * - read denied    -> access-denied page.
 * - read allowed   -> chat room + plaintext messages + a post hint.
 *
 * Messages are PLAINTEXT labels only — nothing is sent, nothing is encrypted,
 * and there is no send form/button or message delivery.
 */
function renderChatRoute(data: BoardData, chatId: string, actor: string): string {
  const chat = findChatById(SAMPLE_CHATS, chatId);
  if (!chat) {
    return renderPage(buildThreads([]), {
      status: data.lead + renderChatNotFound(chatId) + chatDirectoryView(actor),
    });
  }

  const readDecision = canReadChat(actor, chat);
  if (!readDecision.allowed) {
    return renderPage(buildThreads([]), {
      status: data.lead + renderChatAccessDenied(chat, readDecision),
    });
  }

  const postDecision = canPostChat(actor, chat);
  const messages = getChatMessages(chat, SAMPLE_CHAT_MESSAGES);
  return renderPage(buildThreads([]), {
    status: data.lead + renderChatRoom(chat, readDecision, postDecision, messages),
  });
}

/**
 * Routes a board through the space directory:
 * - no `?space`        -> all threads + a directory of readable spaces.
 * - `?space=<unknown>` -> not-found page.
 * - read denied        -> access-denied page.
 * - read allowed       -> only that space's threads + a landing header.
 *
 * `?product=<id>` and `?chat=<id>` take precedence and render their read-only
 * pages. `?actor=<pubkey>` selects the viewer (guest when absent). `assetCache`,
 * when supplied, is used ONLY by the product route (for preview metadata); the
 * board/directory path never touches it.
 */
async function renderBoard(
  url: URL,
  data: BoardData,
  directory: SpaceDirectory,
  assetCache?: AssetCache,
): Promise<string> {
  const productId = url.searchParams.get("product");
  const chatId = url.searchParams.get("chat");
  const spaceId = url.searchParams.get("space");
  const actor = url.searchParams.get("actor") ?? "";
  const spaces = directory.list();
  const queryOptions = parseQueryOptions(url);
  // Preview is sample-mode only (`data.showPromotions`) AND opt-in via the flag,
  // so the live read-only relay path never invokes the preview provider.
  const promotionPreview = data.showPromotions && isPromotionPreviewEnabled(url);

  if (productId !== null) {
    return renderProductRoute(data, productId, actor, assetCache, promotionPreview);
  }

  if (chatId !== null) {
    return renderChatRoute(data, chatId, actor);
  }

  if (spaceId === null) {
    // Stage 30: the Space / Product / Chat directories are arranged into one
    // unified section. Spaces are always shown; the product and chat sections
    // are sample-mode only (the live read-only path adds no new data lookup).
    const directoryHtml = renderUnifiedDirectory({
      spaces: listReadableSpaces(spaces, actor),
      products: data.showPromotions
        ? listViewableProducts(SAMPLE_PRODUCTS, actor, SAMPLE_GRANTS)
        : [],
      chats: data.showPromotions ? listReadableChats(SAMPLE_CHATS, actor) : [],
      actorPubkey: actor || undefined,
      showProducts: data.showPromotions,
      showChats: data.showPromotions,
    });
    const lead = data.lead + directoryHtml;
    return statusFor(queryOptions, lead, buildThreads(data.accepted));
  }

  const space = findSpaceById(spaces, spaceId);
  if (!space) {
    const directoryView = renderSpaceDirectory(listReadableSpaces(spaces, actor), actor || undefined);
    return renderPage(buildThreads([]), {
      status: data.lead + renderSpaceNotFound(spaceId) + directoryView,
    });
  }

  const readDecision = canRead(actor, space);
  if (!readDecision.allowed) {
    return renderPage(buildThreads([]), {
      status: data.lead + renderSpaceAccessDenied(space, readDecision),
    });
  }

  const postDecision = canPost(actor, space);
  const spaceEvents = filterEventsForSpace(data.accepted, space);
  let lead =
    data.lead +
    renderSpaceLanding(space, readDecision, postDecision, {
      promotions: data.showPromotions,
    });

  // Stage 41: ONLY under an explicit preview flag (sample mode), append a
  // mock-provider-driven preview block for the space header slot.
  if (promotionPreview) {
    lead += await renderMockPromotionPreview(buildSpacePlacement(space));
  }

  // `?compose=1` adds a MOCK-ONLY publish preview panel. It builds an unsigned
  // event for display but never signs and never sends — there is no publish
  // endpoint and no POST handling.
  if (url.searchParams.get("compose") === "1") {
    const view = buildPublishPrototypeView(
      {
        content: url.searchParams.get("content") ?? "",
        actorPubkey: actor || undefined,
      },
      space,
    );
    lead += renderPublishPrototype(view);
  }

  return statusFor(queryOptions, lead, buildThreads(spaceEvents));
}

/**
 * Chooses the signature verifier for the live relay path. Functionized so the
 * choice (e.g. fail-open vs fail-closed, or a future env toggle) lives in one
 * place. Defaults to real Schnorr verification.
 */
export function selectVerifier(): SignatureVerifier {
  return selectSignatureVerifier();
}

/** Builds live-relay board data for an allowlisted relay (with cache). */
async function buildLiveBoard(
  url: URL,
  relayUrl: string,
  now: number,
  factory: WebSocketFactory,
  cache: EventCache,
  verifier: SignatureVerifier,
): Promise<BoardData> {
  const filters: NostrFilter[] = [{ kinds: [1], limit: 100 }];
  const ttlSeconds = parseTtlSeconds(url);

  const fetched = await getCachedOrFetchEvents({
    cache,
    relayUrl,
    filters,
    ttlSeconds,
    now,
    fetchEvents: () => {
      const adapter = new WebSocketRelayAdapter(relayUrl, {
        factory,
        timeoutMs: clampTimeout(url.searchParams.get("timeout")),
      });
      return adapter.query(filters);
    },
  });

  // Events failing signature verification are dropped by the ingest hook.
  const { accepted } = await ingestRawEvents(
    fetched.events,
    { relayUrl, now },
    verifier,
  );

  const verifyNote =
    verifier === NoopSignatureVerifier
      ? "signatures are NOT verified"
      : "signature verification: enabled (Schnorr)";
  const lead =
    renderNotice(`Live relay (read-only): ${relayUrl} — ${verifyNote}.`, "info") +
    renderCacheStatus({
      status: fetched.status,
      ttlSeconds,
      cacheKey: fetched.cacheKey,
      error: fetched.error,
    });
  return { accepted, lead, showPromotions: false };
}

/** Handles an HTTP request and returns a page. Exported for tests. */
export async function handleRequest(
  request: Request,
  factory: WebSocketFactory = createWorkersWebSocket,
  cache: EventCache = liveCache,
  verifier: SignatureVerifier = selectVerifier(),
  directory: SpaceDirectory = spaceDirectory,
  assetCache?: AssetCache,
): Promise<Response> {
  const url = new URL(request.url);
  const relayParam = url.searchParams.get("relay");

  if (relayParam !== null) {
    if (!RELAY_ALLOWLIST.has(relayParam)) {
      const page = renderPage(buildThreads([]), {
        status: renderNotice(`Relay not allowed: ${relayParam}`, "error"),
      });
      return htmlResponse(page, 400);
    }
    try {
      const data = await buildLiveBoard(
        url,
        relayParam,
        Date.now(),
        factory,
        cache,
        verifier,
      );
      return htmlResponse(await renderBoard(url, data, directory, assetCache));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const page = renderPage(buildThreads([]), {
        status: renderNotice(`Relay connection failed: ${message}`, "error"),
      });
      return htmlResponse(page, 200);
    }
  }

  const data = await buildSampleBoard(Date.now());
  return htmlResponse(await renderBoard(url, data, directory, assetCache));
}

/** Worker bindings. The KV namespace is optional; without it we fall back. */
export interface Env {
  /** Optional Workers KV namespace for caching live relay results. */
  NOSTR_EVENT_CACHE?: KvLikeNamespace;
  /** Optional D1 database holding persisted space definitions + members. */
  NOSTR_SPACE_DB?: D1LikeDatabase;
  /**
   * EdgeRec selection config (Stage 38). These only let `createRuntime` SELECT a
   * provider; the Worker injects NO `fetch`, so without one the safe mock provider
   * is used and no ad is ever served or fetched. No promotion request is issued
   * from the Worker at all. Viewer pubkey is NOT sent by default.
   */
  PROMOTION_ENDPOINT?: string;
  RECOMMENDATION_ENDPOINT?: string;
  PROMOTION_API_KEY?: string;
  RECOMMENDATION_API_KEY?: string;
  PROMOTION_SEND_VIEWER_PUBKEY?: string;
  PROMOTION_HASH_VIEWER_PUBKEY?: string;
  EDGE_REC_TIMEOUT_MS?: string;
  /**
   * Notification bridge selection config (Stage 42). These only let
   * `createRuntime` SELECT a `NotificationBridge`; the Worker NEVER calls
   * `notify()`, contacts no Telegram/LINE/APNs/FCM/Email API, and issues no
   * `fetch`. Selection only — no notification is sent from the Worker.
   */
  NOTIFICATION_PROVIDER?: string;
  ENABLE_NOTIFICATION_PLACEHOLDER?: string;
  NOTIFICATION_DEFAULT_CHANNEL?: string;
}

/**
 * Picks the cache backend: KV when the binding is present, otherwise the
 * process-local in-memory cache. Exported for tests.
 */
export function selectCache(env?: Env): EventCache {
  return selectEventCache(env);
}

/**
 * Picks the space directory: the D1-backed (async) adapter when a database is
 * bound, otherwise the process-local in-memory directory of sample spaces. The
 * two implement different interfaces (async vs sync), so this is not yet wired
 * into the synchronous render path — it is the selection seam for a later stage.
 * Exported for tests.
 */
export function selectDirectory(env?: Env): SpaceDirectory | D1SpaceDirectory {
  if (env?.NOSTR_SPACE_DB) {
    return new D1SpaceDirectory({ db: env.NOSTR_SPACE_DB });
  }
  return spaceDirectory;
}

export default {
  fetch(request: Request, env?: Env): Promise<Response> {
    // Stage 21: the runtime is the single selection point. We use its event
    // cache here, and (Stage 35) its asset cache is passed for the product route
    // to source PREVIEW metadata only — the directory/index/providers/publisher
    // are selected too but not auto-wired (no real publish, no NIP-07, no
    // auto-served ads, no asset bytes/downloads/payment).
    const runtime = createRuntime(env);
    return handleRequest(
      request,
      createWorkersWebSocket,
      runtime.eventCache,
      undefined,
      undefined,
      runtime.assetCache,
    );
  },
};
