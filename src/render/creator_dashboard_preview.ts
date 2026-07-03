/**
 * Stage 117 — Creator dashboard preview UI skeleton (read-only, opt-in).
 *
 * Pure string builders showing a fixed, static "creator dashboard" summary —
 * sample/static counts plus fixed capability/visibility LABELS pulled from
 * two existing pure boundaries (`../federation/capability_matrix.js`,
 * `../community/moderation.js`) — as a read-only preview page, gated behind
 * an explicit `?creatorDashboardPreview=1` flag in the Worker (see
 * `../worker.js`). Every dashboard-derived string is HTML-escaped.
 *
 * There is NO real listing/plan/rule lookup — `SAMPLE_CREATOR_DASHBOARDS` is
 * a fixed, static array, never queried from `MarketplaceProvider`,
 * `src/creator/membership.ts`, or `src/community/moderation.ts` storage.
 * Calling `getProtocolAdapterCapabilities` here opens no relay/HTTP/OAuth
 * connection — it is a pure label lookup over a fixed matrix.
 *
 * NEVER rendered here, and NEVER present anywhere in this file (comments
 * included): a real purchaser count, any monetary/settlement field, or the
 * actual content of any chat/listing/rule. Every count on this page is
 * explicitly a PLACEHOLDER number, not a real tally.
 */

import {
  getProtocolAdapterCapabilities,
  type ProtocolAdapterKind,
} from "../federation/capability_matrix.js";
import { escapeHtml } from "./html.js";

/** One creator's read-only, sample dashboard summary. No real counts, no real content. */
export interface CreatorDashboardPreviewDescriptor {
  readonly creatorRef: string;
  /** A PLACEHOLDER count only — never a real listing tally. */
  readonly listingCountPlaceholder: number;
  /** A PLACEHOLDER count only — never a real plan tally. */
  readonly membershipPlanCountPlaceholder: number;
  /** A PLACEHOLDER count only — never a real rule tally. */
  readonly communityRuleCountPlaceholder: number;
  /** Fixed capability labels only — never a live connection status. */
  readonly federationCapabilitySummaryLabels: readonly string[];
  /** Fixed visibility labels only — never a real moderation action taken. */
  readonly moderationVisibilitySummaryLabels: readonly string[];
}

/**
 * The capability labels this matrix marks `available_placeholder` for
 * `adapter` — a pure filter over `getProtocolAdapterCapabilities`. Opens no
 * connection; the caller decides which sample dashboard shows which
 * adapter's summary.
 */
function summarizeAvailableCapabilityLabels(adapter: ProtocolAdapterKind): readonly string[] {
  const row = getProtocolAdapterCapabilities(adapter);
  return Object.entries(row)
    .filter(([, decision]) => decision.state === "available_placeholder")
    .map(([capability]) => capability);
}

/** Static sample creator dashboards for the preview page. Never queried, never live. */
export const SAMPLE_CREATOR_DASHBOARDS: readonly CreatorDashboardPreviewDescriptor[] = [
  {
    creatorRef: "creator-alice",
    listingCountPlaceholder: 3,
    membershipPlanCountPlaceholder: 2,
    communityRuleCountPlaceholder: 4,
    federationCapabilitySummaryLabels: summarizeAvailableCapabilityLabels("nostr_placeholder"),
    moderationVisibilitySummaryLabels: ["hidden_placeholder", "muted_placeholder", "filtered_placeholder"],
  },
  {
    creatorRef: "creator-bob",
    listingCountPlaceholder: 0,
    membershipPlanCountPlaceholder: 1,
    communityRuleCountPlaceholder: 2,
    federationCapabilitySummaryLabels: summarizeAvailableCapabilityLabels("rss_placeholder"),
    moderationVisibilitySummaryLabels: ["filtered_placeholder"],
  },
];

/** A read-only list of escaped label spans for one dashboard field, or "" when none. */
function renderLabelList(className: string, labels: readonly string[]): string {
  if (labels.length === 0) return "";
  const items = labels
    .map((label) => `<span class="${escapeHtml(className)}">${escapeHtml(label)}</span>`)
    .join("");
  return `<dd class="${escapeHtml(className)}-list">${items}</dd>`;
}

/**
 * A single creator's read-only dashboard preview: `creatorRef`, three
 * PLACEHOLDER counts, and two fixed label lists (all HTML-escaped). Ends
 * with three permanently `disabled` navigation buttons — no listing/plan/
 * rule fetch, no real navigation, no form.
 */
export function renderCreatorDashboardPreview(
  dashboard: CreatorDashboardPreviewDescriptor,
): string {
  return (
    `<li class="creator-dashboard-preview-item" data-creator="${escapeHtml(dashboard.creatorRef)}">` +
    `<h3 class="creator-dashboard-preview-name">${escapeHtml(dashboard.creatorRef)}</h3>` +
    `<dl class="creator-dashboard-preview-meta">` +
    `<dt>listings</dt><dd>${escapeHtml(String(dashboard.listingCountPlaceholder))}</dd>` +
    `<dt>membership plans</dt><dd>${escapeHtml(String(dashboard.membershipPlanCountPlaceholder))}</dd>` +
    `<dt>community rules</dt><dd>${escapeHtml(String(dashboard.communityRuleCountPlaceholder))}</dd>` +
    `<dt>federation capabilities</dt>` +
    renderLabelList("creator-dashboard-federation-label", dashboard.federationCapabilitySummaryLabels) +
    `<dt>moderation visibility</dt>` +
    renderLabelList("creator-dashboard-moderation-label", dashboard.moderationVisibilitySummaryLabels) +
    `</dl>` +
    `<button type="button" class="creator-dashboard-listings-button" disabled ` +
    `title="Preview only — not implemented">View listings (preview only)</button>` +
    `<button type="button" class="creator-dashboard-membership-button" disabled ` +
    `title="Preview only — not implemented">Manage membership plans (preview only)</button>` +
    `<button type="button" class="creator-dashboard-rules-button" disabled ` +
    `title="Preview only — not implemented">View community rules (preview only)</button>` +
    `</li>`
  );
}

/**
 * The full read-only creator dashboard preview page: a note explaining every
 * count is a static placeholder and every label a fixed capability/
 * visibility name (never a live connection or a real moderation action),
 * then each sample dashboard's preview. NO real listing/plan/rule/chat
 * content appears anywhere on this page.
 */
export function renderCreatorDashboardPreviewPage(
  dashboards: readonly CreatorDashboardPreviewDescriptor[],
): string {
  const items = dashboards.map(renderCreatorDashboardPreview).join("");
  return (
    `<section class="creator-dashboard-preview-page">` +
    `<h2>Creator dashboard preview</h2>` +
    `<p class="creator-dashboard-preview-note">Read-only sample preview — every count shown is a ` +
    `static placeholder, not a real tally, and every capability/visibility label is a fixed name from ` +
    `this codebase's own matrix, never a live connection or a real moderation action.</p>` +
    `<ul class="creator-dashboard-preview-list">${items}</ul>` +
    `</section>`
  );
}
