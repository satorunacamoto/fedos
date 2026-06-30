/**
 * Stage 3 — minimal Cloudflare Workers entry (read-only demo).
 *
 * Pipeline: in-memory sample -> RelayAdapter.query -> ingest -> buildThreads ->
 * renderPage. There is NO live relay connection, NO signing, NO posting. A real
 * read-only relay WebSocket adapter is a later stage; this just proves the
 * read-only render path end to end.
 */

import { InMemoryRelayAdapter } from "./nostr/relay.js";
import { ingestRawEvents } from "./ingest/ingest.js";
import { buildThreads } from "./thread/thread.js";
import { renderPage } from "./render/html.js";
import { SAMPLE_EVENTS } from "./render/sample.js";

const DEMO_RELAY_URL = "wss://demo.invalid";

/** Builds the demo HTML from the fixed sample (pure-ish: only Date for `now`). */
async function renderDemo(now: number): Promise<string> {
  const adapter = new InMemoryRelayAdapter(DEMO_RELAY_URL, SAMPLE_EVENTS);
  const events = await adapter.query([{ kinds: [1] }]);
  const { accepted } = ingestRawEvents(events, {
    relayUrl: adapter.url,
    now,
  });
  const result = buildThreads(accepted);
  return renderPage(result);
}

/** Handles an HTTP request and returns the demo page. Exported for tests. */
export async function handleRequest(_request: Request): Promise<Response> {
  const html = await renderDemo(Date.now());
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
