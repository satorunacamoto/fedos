/**
 * Stage 114 — Board preview UI skeleton (read-only, opt-in).
 *
 * Pure string builders showing a `BoardDescriptor` (`src/social/board.ts`) as
 * a read-only preview page — sample/static data only, gated behind an
 * explicit `?boardPreview=1` flag in the Worker (see `src/worker.ts`). Every
 * board-derived string is HTML-escaped. There is NO post/reply form, NO
 * relay connection, NO publish/subscribe, and NO signing anywhere in this
 * file — it renders labels, nothing more.
 *
 * `boardToNostrCandidate` (Stage 113, `src/federation/nostr_mapping.ts`) is
 * a PURE, unsigned mapping function — calling it here to show a board's
 * candidate `kindLabel` opens no relay and sends nothing; it is the same
 * category of call as reading a getter, not a network operation.
 *
 * NEVER rendered here: `content`/`body`/bytes of any kind (the type has
 * none), a real Nostr event id/signature/pubkey, or any
 * private/gated/payment/entitlement data.
 */

import { boardToNostrCandidate } from "../federation/nostr_mapping.js";
import type { BoardDescriptor } from "../social/board.js";
import { escapeHtml } from "./html.js";

/** Static sample boards for the preview page. Never fetched, never live. */
export const SAMPLE_BOARDS: readonly BoardDescriptor[] = [
  {
    id: "board-general",
    kind: "board",
    title: "General Discussion",
    topics: [{ id: "t-intro", name: "Introductions" }],
    categories: [{ id: "c-community", name: "Community" }],
  },
  {
    id: "board-dev-thread",
    kind: "thread",
    title: "Dev Updates Thread",
    topics: [{ id: "t-changelog", name: "Changelog" }],
  },
  {
    id: "board-marketplace",
    kind: "marketplace",
    title: "Creator Marketplace",
    categories: [{ id: "c-digital", name: "Digital Goods" }],
  },
];

/** A read-only list of escaped topic labels, or "" when none. */
function renderLabelList(className: string, labels: readonly { readonly name: string }[]): string {
  if (labels.length === 0) return "";
  const items = labels.map((label) => `<li>${escapeHtml(label.name)}</li>`).join("");
  return `<ul class="${className}">${items}</ul>`;
}

/**
 * A single board's read-only preview: kind, title, topics, categories, and
 * (when the PURE `boardToNostrCandidate` mapping accepts it) its candidate
 * `kindLabel` only — never a real event id/signature/pubkey, and never a
 * post/reply affordance.
 */
export function renderBoardPreview(board: BoardDescriptor): string {
  const mapping = boardToNostrCandidate(board);
  const nostrRow =
    mapping.allowed && mapping.candidate
      ? `<dt>nostr candidate</dt><dd><code>${escapeHtml(mapping.candidate.kindLabel)}</code></dd>`
      : "";
  return (
    `<li class="board-preview-item" data-board="${escapeHtml(board.id ?? "")}">` +
    `<h3 class="board-preview-title">${escapeHtml(board.title)}</h3>` +
    `<dl class="board-preview-meta">` +
    `<dt>kind</dt><dd>${escapeHtml(board.kind)}</dd>` +
    nostrRow +
    `</dl>` +
    renderLabelList("board-preview-topics", board.topics ?? []) +
    renderLabelList("board-preview-categories", board.categories ?? []) +
    `</li>`
  );
}

/**
 * The full read-only board preview page: a note explaining it is preview-only,
 * then each board's preview. NO post/reply form exists anywhere on this page
 * — it is a display-only skeleton.
 */
export function renderBoardPreviewPage(boards: readonly BoardDescriptor[]): string {
  const items = boards.map(renderBoardPreview).join("");
  return (
    `<section class="board-preview-page">` +
    `<h2>Board preview</h2>` +
    `<p class="board-preview-note">Read-only sample preview — no relay connection, ` +
    `no post/reply is ever sent from this page.</p>` +
    `<ul class="board-preview-list">${items}</ul>` +
    `</section>`
  );
}
