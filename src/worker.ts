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
  renderNotice,
  renderPage,
  renderQueryStatus,
} from "./render/html.js";
import { SAMPLE_EVENTS } from "./render/sample.js";

const DEMO_RELAY_URL = "wss://demo.invalid";

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

/** Builds the sample-mode page (default). */
async function renderSample(url: URL, now: number): Promise<string> {
  const adapter: RelayAdapter = new InMemoryRelayAdapter(DEMO_RELAY_URL, SAMPLE_EVENTS);
  const events = await adapter.query([{ kinds: [1] }]);
  const { accepted } = ingestRawEvents(events, { relayUrl: adapter.url, now });
  const result = buildThreads(accepted);
  const lead = renderNotice(
    "Sample mode — fixed in-memory events. Signatures are NOT verified.",
    "info",
  );
  return statusFor(parseQueryOptions(url), lead, result);
}

/** Builds the live read-only relay page for an allowlisted relay. */
async function renderLive(
  url: URL,
  relayUrl: string,
  now: number,
  factory: WebSocketFactory,
): Promise<string> {
  const adapter = new WebSocketRelayAdapter(relayUrl, {
    factory,
    timeoutMs: clampTimeout(url.searchParams.get("timeout")),
  });
  const events = await adapter.query([{ kinds: [1], limit: 100 }]);
  // Noop verifier: exercises the hook but does NOT verify signatures.
  const { accepted } = await ingestRawEvents(
    events,
    { relayUrl, now },
    NoopSignatureVerifier,
  );
  const result = buildThreads(accepted);
  const lead = renderNotice(
    `Live relay (read-only): ${relayUrl} — signatures are NOT verified.`,
    "info",
  );
  return statusFor(parseQueryOptions(url), lead, result);
}

/** Handles an HTTP request and returns a page. Exported for tests. */
export async function handleRequest(
  request: Request,
  factory: WebSocketFactory = createWorkersWebSocket,
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
      return htmlResponse(await renderLive(url, relayParam, Date.now(), factory));
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

export default {
  fetch(request: Request): Promise<Response> {
    return handleRequest(request);
  },
};
