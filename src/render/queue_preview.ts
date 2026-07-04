/**
 * Stage 119 — Federation queue status preview UI skeleton (read-only, opt-in).
 *
 * Pure string builders showing a `QueueStatusPreview`
 * (`../federation/queue_status_preview.js`) — computed from a fixed, static
 * sample queue array via the PURE `summarizeQueueStatusPreview` fold — as a
 * read-only preview page, gated behind an explicit `?queuePreview=1` flag
 * in the Worker (see `../worker.js`). Every label is HTML-escaped.
 *
 * There is NO real queue — `SAMPLE_QUEUE_ITEMS` is a fixed, static array,
 * never a live in-memory queue any real route reads/writes. Nothing here
 * calls `enqueuePlaceholder`/`dequeuePlaceholder`, opens a connection, or
 * sends anything.
 */

import {
  summarizeQueueStatusPreview,
  type QueuePreviewDescriptor,
} from "../federation/queue_status_preview.js";
import type { OutboundQueueItemDescriptor } from "../federation/outbound_queue.js";
import { escapeHtml } from "./html.js";

/** Static sample queue items for the preview page. Never sent, never live. */
export const SAMPLE_QUEUE_ITEMS: readonly OutboundQueueItemDescriptor[] = [
  { idRef: "queue-1", intentRef: "intent-1", adapterKind: "nostr_placeholder", createdAt: 1000 },
  { idRef: "queue-2", intentRef: "intent-2", adapterKind: "nostr_placeholder", createdAt: 1001 },
  { idRef: "queue-3", intentRef: "intent-3", adapterKind: "rss_placeholder", createdAt: 1002 },
];

/** One adapter's read-only queue row: adapter kind, PLACEHOLDER count, and state (all HTML-escaped). */
export function renderQueuePreviewRow(descriptor: QueuePreviewDescriptor): string {
  return (
    `<li class="queue-preview-item" data-adapter="${escapeHtml(descriptor.adapterKind)}">` +
    `<dl class="queue-preview-meta">` +
    `<dt>adapter</dt><dd>${escapeHtml(descriptor.adapterKind)}</dd>` +
    `<dt>items</dt><dd>${escapeHtml(String(descriptor.itemCountPlaceholder))}</dd>` +
    `<dt>state</dt><dd>${escapeHtml(descriptor.state)}</dd>` +
    `</dl>` +
    `</li>`
  );
}

/**
 * The full read-only queue status preview page: a note explaining every
 * count is computed from a static sample array (never a live queue), then
 * one row per adapter kind. NO send/enqueue/dequeue button exists anywhere
 * on this page.
 */
export function renderQueueStatusPreviewPage(
  queue: readonly OutboundQueueItemDescriptor[],
): string {
  const preview = summarizeQueueStatusPreview(queue);
  const items = preview.descriptors.map(renderQueuePreviewRow).join("");
  return (
    `<section class="queue-status-preview-page">` +
    `<h2>Federation queue status preview</h2>` +
    `<p class="queue-status-preview-note">Read-only sample preview — every count shown is computed ` +
    `from a static sample array, never a live queue, and nothing here sends, publishes, or connects ` +
    `to anything.</p>` +
    `<ul class="queue-status-preview-list">${items}</ul>` +
    `</section>`
  );
}
