/**
 * Stage 4 — minimal Cloudflare Workers entry (read-only demo).
 *
 * Pipeline: in-memory sample -> RelayAdapter.query -> ingest -> buildThreads ->
 * queryThreads(URL params) -> renderPage. There is NO live relay connection, NO
 * signing, NO posting. A real read-only relay WebSocket adapter is a later
 * stage; this just proves the read-only path end to end.
 *
 * Supported query params (all optional, normalized by `queryThreads`):
 *   ?sort=new|old|top|hot  ?q=<text>  ?author=<pubkey>  ?minReplies=<n>
 *   ?since=<unix>  ?until=<unix>  ?limit=<n>  ?offset=<n>
 */

import { InMemoryRelayAdapter } from "./nostr/relay.js";
import { ingestRawEvents } from "./ingest/ingest.js";
import { buildThreads } from "./thread/thread.js";
import { queryThreads } from "./query/thread_query.js";
import type { SortMode, ThreadQueryOptions } from "./query/types.js";
import { renderPage, renderQueryStatus } from "./render/html.js";
import { SAMPLE_EVENTS } from "./render/sample.js";

const DEMO_RELAY_URL = "wss://demo.invalid";

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

/** Builds the demo HTML from the fixed sample (impure only via injected `now`). */
async function renderDemo(now: number, options: ThreadQueryOptions): Promise<string> {
  const adapter = new InMemoryRelayAdapter(DEMO_RELAY_URL, SAMPLE_EVENTS);
  const events = await adapter.query([{ kinds: [1] }]);
  const { accepted } = ingestRawEvents(events, { relayUrl: adapter.url, now });
  const result = buildThreads(accepted);

  const query = queryThreads(result, options);
  const status = renderQueryStatus({
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

/** Handles an HTTP request and returns the demo page. Exported for tests. */
export async function handleRequest(request: Request): Promise<Response> {
  const options = parseQueryOptions(new URL(request.url));
  const html = await renderDemo(Date.now(), options);
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  fetch(request: Request): Promise<Response> {
    return handleRequest(request);
  },
};
