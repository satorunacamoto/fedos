import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  shortenHex,
  renderThreadNode,
  renderThreadList,
  renderWarnings,
  renderQueryStatus,
  renderSpaceLabel,
  renderSpaceLabels,
  renderPage,
} from "../src/render/html.js";
import { buildThreads } from "../src/thread/thread.js";
import type { NostrEvent, NostrTag } from "../src/nostr/types.js";
import type { IngestedEvent } from "../src/ingest/types.js";
import type { ThreadBuildWarning } from "../src/thread/types.js";

const SIG = "0".repeat(128);

function id(label: string): string {
  return (label + "0".repeat(64)).slice(0, 64);
}

function ingest(
  label: string,
  opts: { content?: string; created_at?: number; tags?: NostrTag[]; kind?: number } = {},
): IngestedEvent {
  const event: NostrEvent = {
    id: id(label),
    pubkey: "a".repeat(64),
    created_at: opts.created_at ?? 1000,
    kind: opts.kind ?? 1,
    tags: opts.tags ?? [],
    content: opts.content ?? `content-${label}`,
    sig: SIG,
  };
  return { event, relayUrl: "wss://relay.test", ingestedAt: 1700000000000 };
}

function eTag(label: string, marker: string): NostrTag {
  return ["e", id(label), "", marker];
}

describe("escapeHtml", () => {
  it("escapes <, >, &, double and single quotes", () => {
    expect(escapeHtml(`<script>alert("x") & 'y'</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;) &amp; &#39;y&#39;&lt;/script&gt;",
    );
  });

  it("escapes ampersand first (no double-encoding artifacts)", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });
});

describe("shortenHex", () => {
  it("shortens long hex and leaves short strings intact", () => {
    expect(shortenHex("a".repeat(64))).toBe("aaaaaaaa…aaaa");
    expect(shortenHex("abcd")).toBe("abcd");
  });
});

describe("renderThreadNode", () => {
  it("escapes content (no raw <script> in output)", () => {
    const res = buildThreads([ingest("a", { content: "<script>evil()</script>" })]);
    const html = renderThreadNode(res.roots[0]!);
    expect(html).not.toContain("<script>evil");
    expect(html).toContain("&lt;script&gt;evil()&lt;/script&gt;");
  });

  it("renders nested children", () => {
    const root = ingest("a", { created_at: 100 });
    const reply = ingest("b", { created_at: 200, tags: [eTag("a", "reply")] });
    const res = buildThreads([root, reply]);
    const html = renderThreadNode(res.roots[0]!);
    expect(html).toContain('class="children"');
    expect(html).toContain("content-b");
  });

  it("reflects depth in data-depth", () => {
    const root = ingest("a", { created_at: 100 });
    const reply = ingest("b", { created_at: 200, tags: [eTag("a", "reply")] });
    const res = buildThreads([root, reply]);
    const html = renderThreadNode(res.roots[0]!);
    expect(html).toContain('data-depth="0"');
    expect(html).toContain('data-depth="1"');
  });
});

describe("renderThreadList", () => {
  it("returns an empty state when there are no roots", () => {
    const res = buildThreads([]);
    const html = renderThreadList(res);
    expect(html).toContain("No threads to display.");
  });

  it("wraps roots in a thread-list container", () => {
    const res = buildThreads([ingest("a")]);
    expect(renderThreadList(res)).toContain('class="thread-list"');
  });
});

describe("renderWarnings", () => {
  it("escapes warning detail", () => {
    const warnings: ThreadBuildWarning[] = [
      { kind: "orphan_reply", eventId: id("a"), detail: "<b>danger</b>" },
    ];
    const html = renderWarnings(warnings);
    expect(html).not.toContain("<b>danger");
    expect(html).toContain("&lt;b&gt;danger&lt;/b&gt;");
    expect(html).toContain("orphan_reply");
  });

  it("shows an empty-state when there are no warnings", () => {
    expect(renderWarnings([])).toContain("No build warnings.");
  });
});

describe("renderSpaceLabel / renderSpaceLabels", () => {
  it("escapes space name and id", () => {
    const html = renderSpaceLabel({
      id: "<id>",
      name: "<b>Space</b>",
      type: "community",
    });
    expect(html).not.toContain("<b>Space</b>");
    expect(html).toContain("&lt;b&gt;Space&lt;/b&gt;");
    expect(html).toContain('title="&lt;id&gt;"');
  });

  it("renders an empty string when there are no spaces", () => {
    expect(renderSpaceLabels([])).toBe("");
  });

  it("renders one label per space", () => {
    const html = renderSpaceLabels([
      { id: "a", name: "Alpha", type: "channel" },
      { id: "b", name: "Beta", type: "group" },
    ]);
    expect(html).toContain("Alpha");
    expect(html).toContain("Beta");
    expect(html).toContain('class="space-labels"');
  });
});

describe("renderQueryStatus", () => {
  it("shows the sort mode and total, escaping the search term", () => {
    const html = renderQueryStatus({
      sort: "top",
      total: 3,
      limit: 20,
      offset: 0,
      text: "<script>",
    });
    expect(html).toContain("sort=<strong>top</strong>");
    expect(html).toContain("3 thread(s)");
    expect(html).not.toContain("<code><script></code>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("omits inactive filters", () => {
    const html = renderQueryStatus({ sort: "new", total: 0, limit: 20, offset: 0 });
    expect(html).not.toContain("author=");
    expect(html).not.toContain("q=");
  });
});

describe("renderPage", () => {
  it("returns a complete HTML document", () => {
    const res = buildThreads([ingest("a", { content: "hello" })]);
    const html = renderPage(res);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("</html>");
    expect(html).toContain("<title>nostr-window");
    expect(html).toContain("hello");
    // Read-only / unverified disclosure must be present.
    expect(html).toContain("NOT");
  });

  it("does not mutate the input result", () => {
    const res = buildThreads([
      ingest("a", { created_at: 100 }),
      ingest("b", { created_at: 200, tags: [eTag("a", "reply")] }),
    ]);
    const snapshot = JSON.stringify(res.roots);
    renderPage(res);
    expect(JSON.stringify(res.roots)).toBe(snapshot);
  });
});
