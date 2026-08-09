/**
 * Stage 118 — Creator analytics preview UI skeleton (read-only, opt-in).
 *
 * Pure string builders showing a fixed, static "creator analytics" summary —
 * sample/static engagement COUNTS plus fixed visibility LABELS pulled from
 * `../community/moderation.js` — as a read-only preview page, gated behind
 * an explicit `?creatorAnalyticsPreview=1` flag in the Worker (see
 * `../worker.js`). Every analytics-derived string is HTML-escaped.
 *
 * There is NO real analytics computation — `SAMPLE_CREATOR_ANALYTICS` is a
 * fixed, static array, never aggregated from a real post/reply/reaction/
 * moderation-event log. Nothing here contacts `StorageBackend`,
 * `FederationProvider`, `ChatProvider`, or `MarketplaceProvider`.
 *
 * NEVER rendered here, and NEVER present anywhere in this file (comments
 * included): a real purchaser identity, any monetary/settlement field, or
 * the actual content of any post/reply/chat. Every count on this page is
 * explicitly a PLACEHOLDER number, not a real tally.
 */

import { escapeHtml } from "./html.js";

/** One creator's read-only, sample analytics summary. No real counts, no real content. */
export interface CreatorAnalyticsPreviewDescriptor {
  readonly creatorRef: string;
  /** A PLACEHOLDER count only — never a real post tally. */
  readonly postCountPlaceholder: number;
  /** A PLACEHOLDER count only — never a real reply tally. */
  readonly replyCountPlaceholder: number;
  /** A PLACEHOLDER count only — never a real reaction tally. */
  readonly reactionCountPlaceholder: number;
  /** A PLACEHOLDER count only — never a real moderation-event tally. */
  readonly moderationEventCountPlaceholder: number;
  /** Fixed visibility labels only — never a real moderation action taken. */
  readonly visibilitySummaryLabels: readonly string[];
}

/** Static sample creator analytics for the preview page. Never computed, never live. */
export const SAMPLE_CREATOR_ANALYTICS: readonly CreatorAnalyticsPreviewDescriptor[] = [
  {
    creatorRef: "creator-alice",
    postCountPlaceholder: 12,
    replyCountPlaceholder: 34,
    reactionCountPlaceholder: 56,
    moderationEventCountPlaceholder: 1,
    visibilitySummaryLabels: ["visible_placeholder", "hidden_placeholder"],
  },
  {
    creatorRef: "creator-bob",
    postCountPlaceholder: 3,
    replyCountPlaceholder: 5,
    reactionCountPlaceholder: 9,
    moderationEventCountPlaceholder: 0,
    visibilitySummaryLabels: ["visible_placeholder"],
  },
];

/** A read-only list of escaped visibility-label spans, or "" when none. */
function renderVisibilityLabels(labels: readonly string[]): string {
  if (labels.length === 0) return "";
  const items = labels
    .map((label) => `<span class="creator-analytics-visibility-label">${escapeHtml(label)}</span>`)
    .join("");
  return `<dt>visibility</dt><dd class="creator-analytics-visibility-labels">${items}</dd>`;
}

/**
 * A single creator's read-only analytics preview: `creatorRef`, four
 * PLACEHOLDER counts, and a fixed visibility label list (all HTML-escaped).
 * Ends with a permanently `disabled` "view detail" button — no real
 * aggregation, no navigation, no form.
 */
export function renderCreatorAnalyticsPreview(
  analytics: CreatorAnalyticsPreviewDescriptor,
): string {
  return (
    `<li class="creator-analytics-preview-item" data-creator="${escapeHtml(analytics.creatorRef)}">` +
    `<h3 class="creator-analytics-preview-name">${escapeHtml(analytics.creatorRef)}</h3>` +
    `<dl class="creator-analytics-preview-meta">` +
    `<dt>posts</dt><dd>${escapeHtml(String(analytics.postCountPlaceholder))}</dd>` +
    `<dt>replies</dt><dd>${escapeHtml(String(analytics.replyCountPlaceholder))}</dd>` +
    `<dt>reactions</dt><dd>${escapeHtml(String(analytics.reactionCountPlaceholder))}</dd>` +
    `<dt>moderation events</dt><dd>${escapeHtml(String(analytics.moderationEventCountPlaceholder))}</dd>` +
    renderVisibilityLabels(analytics.visibilitySummaryLabels) +
    `</dl>` +
    `<button type="button" class="creator-analytics-detail-button" disabled ` +
    `title="Preview only — not implemented">View analytics detail (preview only)</button>` +
    `</li>`
  );
}

/**
 * The full read-only creator analytics preview page: a note explaining
 * every count is a static placeholder and every label a fixed visibility
 * name (never a real aggregation or a real moderation action), then each
 * sample creator's preview. NO real post/reply/chat content appears
 * anywhere on this page.
 */
export function renderCreatorAnalyticsPreviewPage(
  analyticsList: readonly CreatorAnalyticsPreviewDescriptor[],
): string {
  const items = analyticsList.map(renderCreatorAnalyticsPreview).join("");
  return (
    `<section class="creator-analytics-preview-page">` +
    `<h2>Creator analytics preview</h2>` +
    `<p class="creator-analytics-preview-note">Read-only sample preview — every count shown is a ` +
    `static placeholder, not a real aggregation, and every visibility label is a fixed name from ` +
    `this codebase's own moderation boundary, never a real moderation action.</p>` +
    `<ul class="creator-analytics-preview-list">${items}</ul>` +
    `</section>`
  );
}
