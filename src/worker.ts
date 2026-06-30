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
import { NobleSignatureVerifier } from "./nostr/noble_signature.js";
import { ingestRawEvents } from "./ingest/ingest.js";
import { buildThreads } from "./thread/thread.js";
import { queryThreads } from "./query/thread_query.js";
import type { SortMode, ThreadQueryOptions } from "./query/types.js";
import {
  InMemoryEventCache,
  getCachedOrFetchEvents,
} from "./cache/event_cache.js";
import { KvEventCache, type KvLikeNamespace } from "./cache/kv_event_cache.js";
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
import { SAMPLE_EVENTS } from "./render/sample.js";

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
  return { accepted, lead };
}

/**
 * Routes a board through the space directory:
 * - no `?space`        -> all threads + a directory of readable spaces.
 * - `?space=<unknown>` -> not-found page.
 * - read denied        -> access-denied page.
 * - read allowed       -> only that space's threads + a landing header.
 *
 * `?actor=<pubkey>` selects the viewer (guest when absent).
 */
function renderBoard(url: URL, data: BoardData, directory: SpaceDirectory): string {
  const spaceId = url.searchParams.get("space");
  const actor = url.searchParams.get("actor") ?? "";
  const spaces = directory.list();
  const queryOptions = parseQueryOptions(url);

  if (spaceId === null) {
    const lead =
      data.lead + renderSpaceDirectory(listReadableSpaces(spaces, actor), actor || undefined);
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
  let lead = data.lead + renderSpaceLanding(space, readDecision, postDecision);

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
  return NobleSignatureVerifier;
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
  return { accepted, lead };
}

/** Handles an HTTP request and returns a page. Exported for tests. */
export async function handleRequest(
  request: Request,
  factory: WebSocketFactory = createWorkersWebSocket,
  cache: EventCache = liveCache,
  verifier: SignatureVerifier = selectVerifier(),
  directory: SpaceDirectory = spaceDirectory,
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
      return htmlResponse(renderBoard(url, data, directory));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const page = renderPage(buildThreads([]), {
        status: renderNotice(`Relay connection failed: ${message}`, "error"),
      });
      return htmlResponse(page, 200);
    }
  }

  const data = await buildSampleBoard(Date.now());
  return htmlResponse(renderBoard(url, data, directory));
}

/** Worker bindings. The KV namespace is optional; without it we fall back. */
export interface Env {
  /** Optional Workers KV namespace for caching live relay results. */
  NOSTR_EVENT_CACHE?: KvLikeNamespace;
  /** Optional D1 database holding persisted space definitions + members. */
  NOSTR_SPACE_DB?: D1LikeDatabase;
}

/**
 * Picks the cache backend: KV when the binding is present, otherwise the
 * process-local in-memory cache. Exported for tests.
 */
export function selectCache(env?: Env): EventCache {
  if (env?.NOSTR_EVENT_CACHE) {
    return new KvEventCache({ kv: env.NOSTR_EVENT_CACHE });
  }
  return liveCache;
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
    return handleRequest(request, createWorkersWebSocket, selectCache(env));
  },
};
