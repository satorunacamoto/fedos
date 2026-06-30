/**
 * Stage 3 — pure HTML render layer for the read-only Reddit-style view.
 *
 * Everything here is a pure string-producing function: no DOM, no innerHTML, no
 * network, no signing. The Worker entry (src/worker.ts) feeds a built
 * ThreadBuildResult in and serves the returned string.
 *
 * SECURITY: every piece of event-derived text (content, pubkey, id, warning
 * detail) is passed through `escapeHtml` before being placed in markup. None of
 * this output is trusted as raw HTML by anything downstream — it is plain text
 * that happens to render. Signatures are NOT verified at this layer (or any
 * layer yet); this is a read-only demo view.
 */

import type {
  ThreadBuildResult,
  ThreadBuildWarning,
  ThreadNode,
} from "../thread/types.js";

/** Escapes the five HTML-significant characters. Always called on event text. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Shortens a long hex string (id/pubkey) for display: `12345678…cdef`. */
export function shortenHex(hex: string, head = 8, tail = 4): string {
  if (hex.length <= head + tail + 1) return hex;
  return `${hex.slice(0, head)}…${hex.slice(-tail)}`;
}

/**
 * Renders one thread node (recursively, with its children).
 * `depth` drives indentation via both `data-depth` and an inline margin.
 */
export function renderThreadNode(node: ThreadNode): string {
  const event = node.event;
  const pubkeyShort = escapeHtml(shortenHex(event.pubkey));
  const pubkeyFull = escapeHtml(event.pubkey);
  const idShort = escapeHtml(shortenHex(event.id));
  const idFull = escapeHtml(event.id);
  const content = escapeHtml(event.content);
  const createdAt = event.created_at; // number; safe to interpolate

  const childrenHtml = node.children.map(renderThreadNode).join("");
  const children = childrenHtml
    ? `<div class="children">${childrenHtml}</div>`
    : "";

  return (
    `<article class="thread-node" data-depth="${node.depth}" ` +
    `style="margin-left:${node.depth * 16}px">` +
    `<header class="meta">` +
    `<span class="pubkey" title="${pubkeyFull}">${pubkeyShort}</span>` +
    `<span class="sep">·</span>` +
    `<span class="eid" title="${idFull}">id:${idShort}</span>` +
    `<span class="sep">·</span>` +
    `<time datetime="${createdAt}">t=${createdAt}</time>` +
    `</header>` +
    `<div class="content">${content}</div>` +
    children +
    `</article>`
  );
}

/** Renders a list of root threads, or an empty-state notice when empty. */
export function renderRoots(roots: readonly ThreadNode[]): string {
  if (roots.length === 0) {
    return `<div class="empty">No threads to display.</div>`;
  }
  const cards = roots.map(renderThreadNode).join("");
  return `<div class="thread-list">${cards}</div>`;
}

/** Renders all root threads from a build result (unfiltered). */
export function renderThreadList(result: ThreadBuildResult): string {
  return renderRoots(result.roots);
}

/**
 * Small read-only status line describing the active sort/filter/pagination.
 * Takes plain primitives (not query types) so the render layer stays decoupled
 * from the query module. All user-derived strings are escaped.
 */
export interface QueryStatusView {
  readonly sort: string;
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly author?: string;
  readonly text?: string;
  readonly minReplies?: number;
  readonly since?: number;
  readonly until?: number;
}

export function renderQueryStatus(view: QueryStatusView): string {
  const chips: string[] = [`sort=<strong>${escapeHtml(view.sort)}</strong>`];
  if (view.text) chips.push(`q=<code>${escapeHtml(view.text)}</code>`);
  if (view.author) {
    chips.push(`author=<code>${escapeHtml(shortenHex(view.author))}</code>`);
  }
  if (typeof view.minReplies === "number" && view.minReplies > 0) {
    chips.push(`minReplies=${view.minReplies}`);
  }
  if (typeof view.since === "number") chips.push(`since=${view.since}`);
  if (typeof view.until === "number") chips.push(`until=${view.until}`);
  chips.push(`offset=${view.offset}`, `limit=${view.limit}`);
  return (
    `<div class="query-status">` +
    `${view.total} thread(s) · ${chips.join(" · ")}` +
    `</div>`
  );
}

/** Renders a developer-facing panel of build warnings (escaped). */
export function renderWarnings(warnings: readonly ThreadBuildWarning[]): string {
  if (warnings.length === 0) {
    return `<aside class="warnings empty">No build warnings.</aside>`;
  }
  const items = warnings
    .map((w) => {
      const kind = escapeHtml(w.kind);
      const eventId = escapeHtml(shortenHex(w.eventId));
      const detail = w.detail ? ` — ${escapeHtml(w.detail)}` : "";
      return (
        `<li class="warning warning-${kind}">` +
        `<code>${kind}</code> <span class="eid">id:${eventId}</span>${detail}` +
        `</li>`
      );
    })
    .join("");
  return (
    `<aside class="warnings">` +
    `<h2>Dev warnings (${warnings.length})</h2>` +
    `<ul>${items}</ul>` +
    `</aside>`
  );
}

const PAGE_STYLE = `
:root{color-scheme:light dark}
body{font-family:system-ui,sans-serif;max-width:760px;margin:0 auto;padding:16px;line-height:1.5}
.banner{border:1px solid #d0a000;background:#fff8e0;color:#5a4a00;padding:8px 12px;border-radius:8px;font-size:.85rem;margin-bottom:16px}
.query-status{font-size:.8rem;color:#666;background:rgba(127,127,127,.08);border-radius:6px;padding:6px 10px;margin-bottom:12px}
.query-status code{font-family:monospace}
.thread-node{padding:8px 12px;margin:6px 0}
.thread-node[data-depth="0"]{border:1px solid #ccc;border-radius:8px;background:rgba(127,127,127,.04);margin-bottom:16px}
.children{border-left:2px solid rgba(127,127,127,.25)}
.meta{font-size:.8rem;color:#888;display:flex;gap:6px;align-items:center}
.meta .eid,.meta .pubkey{font-family:monospace}
.content{white-space:pre-wrap;word-break:break-word;margin-top:4px}
.empty{color:#888;font-style:italic;padding:24px 0;text-align:center}
.warnings{margin-top:24px;border-top:1px dashed #bbb;padding-top:12px;font-size:.85rem}
.warnings.empty{color:#888}
.warnings code{background:rgba(127,127,127,.15);padding:0 4px;border-radius:4px}
.sep{opacity:.5}
`.trim();

/**
 * Optional view overrides for `renderPage`. When `roots` is supplied (e.g. a
 * filtered/sorted page from the query layer) it is rendered instead of the
 * build result's full root list. `status` is inserted above the list.
 */
export interface PageView {
  readonly roots?: readonly ThreadNode[];
  readonly status?: string;
}

/** Renders a complete, self-contained HTML document. */
export function renderPage(result: ThreadBuildResult, view: PageView = {}): string {
  const roots = view.roots ?? result.roots;
  const status = view.status ?? "";
  return (
    `<!doctype html>` +
    `<html lang="en">` +
    `<head>` +
    `<meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>nostr-window — read-only demo</title>` +
    `<style>${PAGE_STYLE}</style>` +
    `</head>` +
    `<body>` +
    `<p class="banner">Read-only demo. Signatures are <strong>NOT</strong> verified and ` +
    `no live relay is connected — events come from a fixed in-memory sample.</p>` +
    `<main>${status}${renderRoots(roots)}</main>` +
    renderWarnings(result.warnings) +
    `</body>` +
    `</html>`
  );
}
