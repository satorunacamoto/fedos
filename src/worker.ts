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
import {
  renderCacheStatus,
  renderNotice,
  renderPage,
  renderQueryStatus,
} from "./render/html.js";
import { SAMPLE_EVENTS } from "./render/sample.js";

const DEMO_RELAY_URL = "wss://demo.invalid";

/** Process-local cache for live relay results (lost on isolate restart). */
const liveCache: EventCache = new InMemoryEventCache();

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

/** Builds the sample-mode page (default). Sample mode never uses the cache. */
async function renderSample(url: URL, now: number): Promise<string> {
  const adapter: RelayAdapter = new InMemoryRelayAdapter(DEMO_RELAY_URL, SAMPLE_EVENTS);
  const events = await adapter.query([{ kinds: [1] }]);
  const { accepted } = ingestRawEvents(events, { relayUrl: adapter.url, now });
  const result = buildThreads(accepted);
  const lead =
    renderNotice(
      "Sample mode — fixed in-memory events. Signatures are NOT verified.",
      "info",
    ) + renderCacheStatus({ status: "bypass (sample mode)", ttlSeconds: 0 });
  return statusFor(parseQueryOptions(url), lead, result);
}

/** Builds the live read-only relay page for an allowlisted relay (with cache). */
async function renderLive(
  url: URL,
  relayUrl: string,
  now: number,
  factory: WebSocketFactory,
  cache: EventCache,
): Promise<string> {
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

  // Noop verifier: exercises the hook but does NOT verify signatures.
  const { accepted } = await ingestRawEvents(
    fetched.events,
    { relayUrl, now },
    NoopSignatureVerifier,
  );
  const result = buildThreads(accepted);

  const lead =
    renderNotice(
      `Live relay (read-only): ${relayUrl} — signatures are NOT verified.`,
      "info",
    ) +
    renderCacheStatus({
      status: fetched.status,
      ttlSeconds,
      cacheKey: fetched.cacheKey,
      error: fetched.error,
    });
  return statusFor(parseQueryOptions(url), lead, result);
}

/** Handles an HTTP request and returns a page. Exported for tests. */
export async function handleRequest(
  request: Request,
  factory: WebSocketFactory = createWorkersWebSocket,
  cache: EventCache = liveCache,
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
      return htmlResponse(
        await renderLive(url, relayParam, Date.now(), factory, cache),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const page = renderPage(buildThreads([]), {
        status: renderNotice(`Relay connection failed: ${message}`, "error"),
      });
      return htmlResponse(page, 200);
    }
  }

  return htmlResponse(await renderSample(url, Date.now()));
}

/** Worker bindings. The KV namespace is optional; without it we fall back. */
export interface Env {
  /** Optional Workers KV namespace for caching live relay results. */
  NOSTR_EVENT_CACHE?: KvLikeNamespace;
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

export default {
  fetch(request: Request, env?: Env): Promise<Response> {
    return handleRequest(request, createWorkersWebSocket, selectCache(env));
  },
};
