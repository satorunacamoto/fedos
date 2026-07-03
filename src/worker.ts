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
import type { PaymentDecision, PaymentProvider } from "./payment/types.js";
import { renderPurchasePreview } from "./render/payment.js";
import { buildGrantPreview, renderGrantPreview } from "./render/grant_preview.js";
import {
  buildRuntimeStatusView,
  renderRuntimeStatusPage,
  renderRuntimeStatusJson,
} from "./render/runtime_status.js";
import type { AppRuntime } from "./runtime/types.js";
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
import {
  renderMockPromotionPreview,
  buildPromotionPreviewDiagnostic,
  renderPromotionPreviewDiagnostic,
} from "./render/promotion.js";
import { invokePromotionProviderPreview } from "./promotion/invocation.js";
import type { PromotionProvider } from "./promotion/adapter.js";
import type { PromotionRequest } from "./promotion/types.js";
import { renderBoardPreviewPage, SAMPLE_BOARDS } from "./render/board_preview.js";
import { renderMarketplacePreviewPage, SAMPLE_LISTINGS } from "./render/marketplace_preview.js";
import {
  renderCreatorProfilePreviewPage,
  SAMPLE_CREATOR_PROFILES,
} from "./render/creator_profile_preview.js";
import {
  renderCommunityRulesPreviewPage,
  SAMPLE_COMMUNITY_RULES,
} from "./render/community_rules_preview.js";
import {
  renderCreatorDashboardPreviewPage,
  SAMPLE_CREATOR_DASHBOARDS,
} from "./render/creator_dashboard_preview.js";
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

/** Stage 54: wraps an already-serialized, safe JSON string. Issues no I/O itself. */
function jsonResponse(json: string, status = 200): Response {
  return new Response(json, {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
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

/**
 * True ONLY when the caller explicitly opts into REAL provider preview mode
 * via `?edgeRecPreview=1`/`=true` or `?providerPromotionPreview=1`/`=true`.
 * This is HALF of the Stage 52 dual-flag gate: `runtime.promotionProvider` is
 * invoked via `invokePromotionProviderPreview` ONLY when this query flag is
 * ALSO paired with a truthy `ENABLE_PROMOTION_PROVIDER_PREVIEW` env flag
 * (`runtime.promotionProviderPreviewAllowed`). Applies to the product/space
 * routes only — the query flag alone, with no env flag, still calls no
 * provider (a disabled explanation may render instead — see
 * `renderProviderPromotionPreview`).
 */
export function isProviderPromotionPreviewEnabled(url: URL): boolean {
  const isTruthy = (value: string | null): boolean => value === "1" || value === "true";
  return (
    isTruthy(url.searchParams.get("edgeRecPreview")) ||
    isTruthy(url.searchParams.get("providerPromotionPreview"))
  );
}

/**
 * True ONLY when the caller explicitly opts into payment-provider preview mode
 * via `?paymentPreview=1` or `?paymentPreview=true`. This flag gates whether
 * the product purchase preview (Stage 45) calls `runtime.paymentProvider`
 * (Stage 46's env-selected provider) instead of its own locally-constructed
 * `PlaceholderPaymentProvider`. It never enables a real payment rail, never
 * calls `paymentDecisionToGrant`, and applies to the product route only.
 */
export function isPaymentPreviewEnabled(url: URL): boolean {
  const value = url.searchParams.get("paymentPreview");
  return value === "1" || value === "true";
}

/**
 * True ONLY when the caller explicitly opts into the read-only Runtime status
 * page via `?runtimeStatus=1` or `?runtimeStatus=true`. This flag takes
 * precedence over every other route (board/product/space/chat). The page it
 * gates (`renderRuntimeStatusPage`) calls no provider/cache/bridge method and
 * issues no `fetch` — see `src/render/runtime_status.ts`.
 */
export function isRuntimeStatusEnabled(url: URL): boolean {
  const value = url.searchParams.get("runtimeStatus");
  return value === "1" || value === "true";
}

/**
 * True ONLY when `?runtimeStatus=1`'s page is explicitly asked to render as
 * JSON via `&format=json`. Any other `format` value (or its absence) falls
 * back to the HTML page — this is a strict allowlist, not a denylist, so a
 * typo or unexpected value never accidentally serves JSON. Disabled by
 * default: `?runtimeStatus=1` alone still renders HTML, exactly as Stage 50
 * left it.
 */
export function isRuntimeStatusJsonRequested(url: URL): boolean {
  return url.searchParams.get("format") === "json";
}

/**
 * True ONLY when the caller explicitly opts into the read-only Board
 * preview page via `?boardPreview=1` or `?boardPreview=true` (Stage 114).
 * Takes precedence over `?marketplacePreview=1` and every other route
 * (relay/sample board/product/space/chat) except `?runtimeStatus=1`. The
 * page it gates (`renderBoardPreviewPage`) uses ONLY sample/static board
 * descriptors, calls no runtime-selected boundary, and issues no `fetch`.
 */
export function isBoardPreviewEnabled(url: URL): boolean {
  const value = url.searchParams.get("boardPreview");
  return value === "1" || value === "true";
}

/**
 * True ONLY when the caller explicitly opts into the read-only Marketplace
 * listing preview page via `?marketplacePreview=1` or
 * `?marketplacePreview=true` (Stage 114). Takes precedence over every
 * other route (relay/sample board/product/space/chat) except
 * `?runtimeStatus=1`/`?boardPreview=1`. The page it gates
 * (`renderMarketplacePreviewPage`) uses ONLY sample/static listing
 * descriptors, calls no marketplace/payment boundary, and issues no
 * `fetch`.
 */
export function isMarketplacePreviewEnabled(url: URL): boolean {
  const value = url.searchParams.get("marketplacePreview");
  return value === "1" || value === "true";
}

/**
 * True ONLY when the caller explicitly opts into the read-only Creator
 * profile preview page via `?creatorPreview=1` or `?creatorPreview=true`
 * (Stage 115). Takes precedence over every other route (relay/sample
 * board/product/space/chat) except `?runtimeStatus=1`/`?boardPreview=1`/
 * `?marketplacePreview=1`. The page it gates
 * (`renderCreatorProfilePreviewPage`) uses ONLY sample/static profile
 * descriptors, calls no runtime-selected boundary, performs no real
 * identity verification, and issues no `fetch`.
 */
export function isCreatorPreviewEnabled(url: URL): boolean {
  const value = url.searchParams.get("creatorPreview");
  return value === "1" || value === "true";
}

/**
 * True ONLY when the caller explicitly opts into the read-only Community
 * ruleset preview page via `?communityRulesPreview=1` or
 * `?communityRulesPreview=true` (Stage 116). Takes precedence over every
 * other route (relay/sample board/product/space/chat) except
 * `?runtimeStatus=1`/`?boardPreview=1`/`?marketplacePreview=1`/
 * `?creatorPreview=1`. The page it gates (`renderCommunityRulesPreviewPage`)
 * uses ONLY sample/static rule entries, calls no runtime-selected boundary,
 * applies no real moderation action, and issues no `fetch`.
 */
export function isCommunityRulesPreviewEnabled(url: URL): boolean {
  const value = url.searchParams.get("communityRulesPreview");
  return value === "1" || value === "true";
}

/**
 * True ONLY when the caller explicitly opts into the read-only Creator
 * dashboard preview page via `?creatorDashboardPreview=1` or
 * `?creatorDashboardPreview=true` (Stage 117). Takes precedence over every
 * other route (relay/sample board/product/space/chat) except
 * `?runtimeStatus=1`/`?boardPreview=1`/`?marketplacePreview=1`/
 * `?creatorPreview=1`/`?communityRulesPreview=1`. The page it gates
 * (`renderCreatorDashboardPreviewPage`) uses ONLY sample/static dashboard
 * descriptors, calls no runtime-selected boundary, performs no real
 * listing/plan/rule lookup, and issues no `fetch`.
 */
export function isCreatorDashboardPreviewEnabled(url: URL): boolean {
  const value = url.searchParams.get("creatorDashboardPreview");
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
 * Stage 45/47/48: resolves the payment decision for a product's purchase AND
 * grant preview (product route only), so both previews share exactly one
 * decision. `canRequestPaymentForProduct`/`productToPaymentRequest` gate
 * eligibility (draft/archived/invalid price -> that check's own `rejected`/
 * `pending` decision is returned as-is); otherwise a provider evaluates the
 * built request. `actor` is used only as a display "buyer candidate" — never
 * to process payment or issue a grant. `paymentDecisionToGrant` is never
 * called here, so no `PurchaseGrant` is ever issued from this preview.
 *
 * Stage 47: `runtimeProvider` is used ONLY when the caller passes one (i.e.
 * ONLY under the explicit `?paymentPreview=1` flag, wired by
 * `renderProductRoute` below) — that is Stage 46's env-selected
 * `runtime.paymentProvider`, which may be `NoopPaymentProvider` (yields an
 * `unavailable` decision) or `PlaceholderPaymentProvider` (yields
 * `accepted_placeholder` for a valid request) depending on env config.
 * WITHOUT the flag, a freshly-constructed `PlaceholderPaymentProvider` is
 * used, exactly as Stage 45 left it — the runtime provider is never
 * contacted implicitly.
 */
async function resolveProductPaymentDecision(
  product: Product,
  actor: string,
  runtimeProvider?: PaymentProvider,
): Promise<PaymentDecision> {
  const eligibility = canRequestPaymentForProduct(product);
  if (!eligibility.allowed) return eligibility;
  const request = productToPaymentRequest(product, actor || undefined);
  if (!request) return eligibility;
  const provider = runtimeProvider ?? new PlaceholderPaymentProvider();
  return provider.requestPayment(request);
}

/**
 * Stage 52: the DUAL-FLAG-gated real provider preview (Stage 53: hardened
 * diagnostics). Calls `invokePromotionProviderPreview` (Stage 49) with
 * `allowRealProvider: true` and `mode: "provider_preview"` ONLY when
 * `envAllowed` (from `runtime.promotionProviderPreviewAllowed`, i.e.
 * `ENABLE_PROMOTION_PROVIDER_PREVIEW`) is true AND a `provider` is supplied —
 * the caller (`renderProductRoute`/`renderBoard`'s space branch) only invokes
 * this function at all once the QUERY flag
 * (`?edgeRecPreview=1`/`?providerPromotionPreview=1`) is present, so both
 * halves of the gate are required end to end (UNCHANGED from Stage 52).
 * Without the env flag, this renders a categorized `"env_flag_disabled"`
 * diagnostic (fixed, safe copy — never an echoed reason/env value) instead of
 * calling anything. `request` comes from `buildProductPlacement`/
 * `buildSpacePlacement` called with NO `viewerPubkey` option — the
 * actor/viewer pubkey is never placed on the request. A provider error is
 * caught inside `invokePromotionProviderPreview` and rendered as a fixed,
 * sanitized "Provider preview unavailable" note, never thrown and never
 * echoing the provider's own error text.
 */
async function renderProviderPromotionPreview(
  request: PromotionRequest,
  provider: PromotionProvider | undefined,
  envAllowed: boolean,
): Promise<string> {
  if (!envAllowed || !provider) {
    return renderPromotionPreviewDiagnostic({ kind: "disabled", disabledReason: "env_flag_disabled" });
  }
  const result = await invokePromotionProviderPreview(provider, request, {
    allowRealProvider: true,
    mode: "provider_preview",
  });
  return renderPromotionPreviewDiagnostic(buildPromotionPreviewDiagnostic(result));
}

/**
 * Routes `?product=<id>` against the fixed sample products (read-only):
 * - unknown id       -> not-found page (+ the viewable directory).
 * - view denied      -> access-denied page.
 * - view allowed     -> product summary + public/unlisted asset previews + an
 *                       EMPTY promotion placeholder + a purchase preview panel
 *                       + (Stage 48) a grant preview panel.
 *
 * Asset previews are PUBLIC/UNLISTED metadata only — no bytes, no download, no
 * signed URL, no payment. `private`/`paid` assets are never shown. When an
 * `assetCache` is supplied (the runtime's), preview METADATA may come from the
 * cache; a miss/error falls back to the fixed sample metadata. The cache is
 * consulted ONLY on this product route — never on the board/directory path.
 * The purchase preview (Stage 45) and grant preview (Stage 48) are likewise
 * product-route only. Stage 47: `paymentPreview` (from `?paymentPreview=1`)
 * gates whether the shared payment decision uses `paymentProvider` (the
 * runtime's Stage 46 env-selected provider) instead of a local
 * `PlaceholderPaymentProvider` — see `resolveProductPaymentDecision`. The
 * grant preview (Stage 48) shows ONLY for an `accepted_placeholder` decision
 * (any other status renders no grant preview at all); it NEVER calls
 * `paymentDecisionToGrant` and NEVER issues a `PurchaseGrant`.
 */
async function renderProductRoute(
  data: BoardData,
  productId: string,
  actor: string,
  assetCache?: AssetCache,
  promotionPreview = false,
  paymentPreview = false,
  paymentProvider?: PaymentProvider,
  providerPromotionPreview = false,
  promotionProvider?: PromotionProvider,
  providerPreviewAllowed = false,
): Promise<string> {
  const product = findProductById(SAMPLE_PRODUCTS, productId);
  if (!product) {
    return renderPage(buildThreads([]), {
      status: data.lead + renderProductNotFound(productId) + productDirectoryView(actor),
    });
  }

  const viewDecision = canViewProduct(actor, product, SAMPLE_GRANTS);
  if (!viewDecision.allowed) {
    return renderPage(buildThreads([]), {
      status: data.lead + renderProductAccessDenied(product, viewDecision),
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
  // Stage 52: ONLY under the explicit query flag, and gated a second time
  // inside `renderProviderPromotionPreview` on the env flag — see that
  // function's doc comment. `buildProductPlacement(product)` is called with
  // NO `viewerPubkey` option, so the actor is never placed on the request.
  const providerPreview = providerPromotionPreview
    ? await renderProviderPromotionPreview(
        buildProductPlacement(product),
        promotionProvider,
        providerPreviewAllowed,
      )
    : "";
  // Stage 45/47/48: always appended on this route (view already allowed
  // above). The runtime provider is passed ONLY when `paymentPreview` is
  // explicitly set; otherwise the decision falls back to a local
  // `PlaceholderPaymentProvider`, exactly as Stage 45 left it.
  const paymentDecision = await resolveProductPaymentDecision(
    product,
    actor,
    paymentPreview ? paymentProvider : undefined,
  );
  const purchasePreview = renderPurchasePreview(product, paymentDecision, {
    buyerPubkey: actor || undefined,
  });
  // Stage 48: a grant PREVIEW only — shown ONLY for `accepted_placeholder`,
  // never issues a PurchaseGrant, never calls `paymentDecisionToGrant`.
  const grantPreviewView = buildGrantPreview(product, paymentDecision, actor || undefined);
  const grantPreview = grantPreviewView ? renderGrantPreview(grantPreviewView) : "";
  return renderPage(buildThreads([]), {
    status:
      data.lead +
      renderProductPage(product, viewDecision, assets, {
        promotions: data.showPromotions,
        actorPubkey: actor || undefined,
      }) +
      preview +
      providerPreview +
      purchasePreview +
      grantPreview,
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
 * board/directory path never touches it. `paymentProvider` (the runtime's
 * Stage 46 env-selected `PaymentProvider`), when supplied, is likewise used
 * ONLY by the product route's purchase preview, and only under `?paymentPreview=1`
 * (Stage 47) — board/space/chat never call it. `promotionProvider` (the
 * runtime's `PromotionProvider`) and `providerPreviewAllowed` (Stage 52's
 * `runtime.promotionProviderPreviewAllowed`, i.e. the
 * `ENABLE_PROMOTION_PROVIDER_PREVIEW` env flag) are likewise used ONLY by the
 * product/space routes, and only under `?edgeRecPreview=1`/
 * `?providerPromotionPreview=1` — the board (no `?space`) and chat routes
 * never call the provider regardless of these flags.
 */
async function renderBoard(
  url: URL,
  data: BoardData,
  directory: SpaceDirectory,
  assetCache?: AssetCache,
  paymentProvider?: PaymentProvider,
  promotionProvider?: PromotionProvider,
  providerPreviewAllowed = false,
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
  // Stage 47: opt-in only, product route only — see `renderProductRoute`.
  const paymentPreview = isPaymentPreviewEnabled(url);
  // Stage 52: opt-in only, product/space routes only — see
  // `renderProviderPromotionPreview`. Never true on the board/chat routes.
  const providerPromotionPreview = isProviderPromotionPreviewEnabled(url);

  if (productId !== null) {
    return renderProductRoute(
      data,
      productId,
      actor,
      assetCache,
      promotionPreview,
      paymentPreview,
      paymentProvider,
      providerPromotionPreview,
      promotionProvider,
      providerPreviewAllowed,
    );
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

  // Stage 52: ONLY under the explicit query flag, and gated a second time on
  // the env flag inside `renderProviderPromotionPreview`. `buildSpacePlacement
  // (space)` is called with NO `viewerPubkey` option — the actor is never
  // placed on the request.
  if (providerPromotionPreview) {
    lead += await renderProviderPromotionPreview(
      buildSpacePlacement(space),
      promotionProvider,
      providerPreviewAllowed,
    );
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
  paymentProvider?: PaymentProvider,
  runtime?: AppRuntime,
): Promise<Response> {
  const url = new URL(request.url);

  // Stage 50: `?runtimeStatus=1` takes precedence over every other route. It
  // is entirely read-only — no board is built, no relay/live path runs, and
  // no provider/cache/bridge method is called. Requires a full `AppRuntime`
  // (only the Worker's default `fetch` handler supplies one); without it this
  // falls through to normal routing. Stage 54: `&format=json` (disabled by
  // default — any other/absent value still renders HTML) serves the SAME
  // view as safe, allowlisted JSON instead of the HTML page.
  if (runtime !== undefined && isRuntimeStatusEnabled(url)) {
    const view = buildRuntimeStatusView(runtime);
    if (isRuntimeStatusJsonRequested(url)) {
      return jsonResponse(renderRuntimeStatusJson(view));
    }
    return htmlResponse(
      renderPage(buildThreads([]), { status: renderRuntimeStatusPage(view) }),
    );
  }

  // Stage 114/115/116/117: `?boardPreview=1` / `?marketplacePreview=1` /
  // `?creatorPreview=1` / `?communityRulesPreview=1` /
  // `?creatorDashboardPreview=1` are entirely read-only, sample-data-only
  // preview pages — no board is built, no relay/live path runs, and no
  // runtime-selected boundary (storage, federation, marketplace, payment,
  // entitlement, or chat) is ever called from any branch; `runtime` is not
  // even read here. `boardPreview` takes precedence over
  // `marketplacePreview`, which takes precedence over `creatorPreview`,
  // which takes precedence over `communityRulesPreview`, which takes
  // precedence over `creatorDashboardPreview`, when more than one is
  // present; each falls through to normal routing when absent.
  if (isBoardPreviewEnabled(url)) {
    return htmlResponse(
      renderPage(buildThreads([]), { status: renderBoardPreviewPage(SAMPLE_BOARDS) }),
    );
  }
  if (isMarketplacePreviewEnabled(url)) {
    return htmlResponse(
      renderPage(buildThreads([]), { status: renderMarketplacePreviewPage(SAMPLE_LISTINGS) }),
    );
  }
  // Stage 115: `?creatorPreview=1` — same read-only, sample-data-only
  // treatment as the board/marketplace preview branches above; no runtime-
  // selected boundary is called and `runtime` is not read here.
  if (isCreatorPreviewEnabled(url)) {
    return htmlResponse(
      renderPage(buildThreads([]), {
        status: renderCreatorProfilePreviewPage(SAMPLE_CREATOR_PROFILES),
      }),
    );
  }
  // Stage 116: `?communityRulesPreview=1` — same read-only, sample-data-only
  // treatment as the preview branches above; no runtime-selected boundary
  // is called and `runtime` is not read here.
  if (isCommunityRulesPreviewEnabled(url)) {
    return htmlResponse(
      renderPage(buildThreads([]), {
        status: renderCommunityRulesPreviewPage(SAMPLE_COMMUNITY_RULES),
      }),
    );
  }
  // Stage 117: `?creatorDashboardPreview=1` — same read-only, sample-data-
  // only treatment as the preview branches above; no runtime-selected
  // boundary is called and `runtime` is not read here.
  if (isCreatorDashboardPreviewEnabled(url)) {
    return htmlResponse(
      renderPage(buildThreads([]), {
        status: renderCreatorDashboardPreviewPage(SAMPLE_CREATOR_DASHBOARDS),
      }),
    );
  }

  // Stage 52: derived once from `runtime` (when supplied) and threaded into
  // `renderBoard` — used ONLY by the product/space routes, and only when the
  // per-request query flag is ALSO present (see `renderProviderPromotionPreview`).
  const promotionProvider = runtime?.promotionProvider;
  const providerPreviewAllowed = runtime?.promotionProviderPreviewAllowed ?? false;

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
      return htmlResponse(
        await renderBoard(
          url,
          data,
          directory,
          assetCache,
          paymentProvider,
          promotionProvider,
          providerPreviewAllowed,
        ),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const page = renderPage(buildThreads([]), {
        status: renderNotice(`Relay connection failed: ${message}`, "error"),
      });
      return htmlResponse(page, 200);
    }
  }

  const data = await buildSampleBoard(Date.now());
  return htmlResponse(
    await renderBoard(
      url,
      data,
      directory,
      assetCache,
      paymentProvider,
      promotionProvider,
      providerPreviewAllowed,
    ),
  );
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
  /**
   * Payment provider selection config (Stage 46). These only let
   * `createRuntime` SELECT a `PaymentProvider`; the Worker NEVER calls
   * `requestPayment()` from this field and never calls
   * `paymentDecisionToGrant` — no `PurchaseGrant` is issued. Selection only —
   * the product purchase preview (Stage 45) still builds its own
   * `PlaceholderPaymentProvider` directly and is unaffected by these fields.
   */
  PAYMENT_PROVIDER?: string;
  ENABLE_PAYMENT_PLACEHOLDER?: string;
  PAYMENT_DEFAULT_RAIL?: string;
  /**
   * HALF of the Stage 52 dual-flag gate for invoking a REAL `promotionProvider`
   * (e.g. `EdgeRecPromotionProvider`) for a preview. Even when truthy, the
   * Worker still requires the per-request query flag
   * (`?edgeRecPreview=1`/`?providerPromotionPreview=1`) before it calls
   * `invokePromotionProviderPreview` — and even then, only on the product/space
   * routes. No ad is ever auto-served; this is selection/gating only.
   */
  ENABLE_PROMOTION_PROVIDER_PREVIEW?: string;
  /**
   * WebAuthn / Passkey provider selection config (Stage 62). These only let
   * `createRuntime` SELECT a `WebAuthnProvider`; the Worker NEVER calls
   * `begin()`/`cancel()`, touches no browser credential API, launches no
   * Face ID / Touch ID, contacts no Secure Enclave / Android Keystore, and
   * stores no credential/challenge. Selection only — WebAuthn stays an unlock
   * TRIGGER, never a key source, and no unlock happens from the Worker.
   */
  WEBAUTHN_PROVIDER?: string;
  ENABLE_WEBAUTHN_PLACEHOLDER?: string;
  /**
   * Crypto provider selection config (Stage 65). These only let `createRuntime`
   * SELECT a `CryptoProvider`; the Worker NEVER calls
   * `randomBytes`/`deriveKey`/`encrypt`/`decrypt`, loads no WASM, issues no
   * `fetch`/dynamic import, and runs no KDF/AEAD/random. The FedOS option wraps
   * only the inert `PlaceholderFedosCoreCrypto`. Selection only — no cryptography
   * happens from the Worker.
   */
  CRYPTO_PROVIDER?: string;
  ENABLE_CRYPTO_PLACEHOLDER?: string;
  /**
   * Storage backend selection config (Stage 109). These only let
   * `createRuntime` SELECT a `StorageBackend`; the Worker NEVER calls
   * `put()`/`get()`/`delete()`, contacts no Google Drive API, opens no
   * Nostr relay WebSocket, touches no SQLite, no Bluetooth/Wi-Fi mesh, and
   * no content-addressed gateway. Selection only — no storage operation happens from
   * the Worker.
   */
  STORAGE_PROVIDER?: string;
  ENABLE_STORAGE_PLACEHOLDER?: string;
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
    // to source PREVIEW metadata only. (Stage 46) the runtime's paymentProvider
    // is passed through too — but (Stage 47) it is used ONLY by the product
    // route's purchase preview, and ONLY under the explicit `?paymentPreview=1`
    // flag; otherwise the preview keeps using its own local
    // `PlaceholderPaymentProvider` exactly as Stage 45 left it. (Stage 50) the
    // whole runtime is passed through too, so `?runtimeStatus=1` can render a
    // read-only type-label page (Stage 50) — no provider/cache/bridge method
    // is called from that path. (Stage 52) `handleRequest` also derives
    // `runtime.promotionProvider`/`.promotionProviderPreviewAllowed` from it,
    // but the provider is invoked ONLY on the product/space routes and ONLY
    // when the per-request query flag (`?edgeRecPreview=1`/
    // `?providerPromotionPreview=1`) is ALSO present. No real publish, no
    // NIP-07, no auto-served ads, no asset bytes/downloads, and no automatic
    // `requestPayment()`/`paymentDecisionToGrant` call from this selection.
    const runtime = createRuntime(env);
    return handleRequest(
      request,
      createWorkersWebSocket,
      runtime.eventCache,
      undefined,
      undefined,
      runtime.assetCache,
      runtime.paymentProvider,
      runtime,
    );
  },
};
