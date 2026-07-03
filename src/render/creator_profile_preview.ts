/**
 * Stage 115 — Creator profile preview UI skeleton (read-only, opt-in).
 *
 * Pure string builders showing a `CreatorProfileDescriptor`
 * (`src/creator/profile.ts`) as a read-only preview page — sample/static
 * data only, gated behind an explicit `?creatorPreview=1` flag in the
 * Worker (see `src/worker.ts`). Every profile-derived string is
 * HTML-escaped.
 *
 * There is NO real profile lookup — `SAMPLE_CREATOR_PROFILES` is a fixed,
 * static array, never looked up, never a real Nostr `kind 0` profile fetch. NO
 * relay connection, and NO real identity verification anywhere in this
 * file — `reviewCreatorProfile` (Stage 115, `src/creator/profile.ts`) is a
 * PURE, unsigned policy check; calling it here to show its review state
 * opens no connection and verifies no identity.
 *
 * NEVER rendered here: `metadata` (the descriptor's own non-display field),
 * a payment/entitlement/private field (the type has none), or a real
 * follow/subscribe/buy/message action — the one "follow" affordance this
 * page renders is a permanently `disabled` button.
 */

import {
  reviewCreatorProfile,
  type CreatorProfileDescriptor,
} from "../creator/profile.js";
import { escapeHtml } from "./html.js";

/** Static sample creator profiles for the preview page. Never fetched, never live. */
export const SAMPLE_CREATOR_PROFILES: readonly CreatorProfileDescriptor[] = [
  {
    creatorRef: "creator-alice",
    displayName: "Alice",
    bioPreview: "Digital illustrator sharing weekly sketches.",
    category: "art",
    trustLabels: ["new_creator_placeholder"],
  },
  {
    creatorRef: "creator-bob",
    displayName: "Bob",
    bioPreview: "Indie game dev, devlogs and prototypes.",
    category: "games",
    trustLabels: ["community_trusted_placeholder"],
  },
  {
    creatorRef: "creator-carol",
    displayName: "Carol",
    bioPreview: "Music producer, sample packs and tutorials.",
    category: "music",
    trustLabels: ["unknown_placeholder", "reported_placeholder"],
  },
];

/** A read-only list of escaped trust-label spans, or "" when none. */
function renderTrustLabels(labels: readonly string[] | undefined): string {
  if (!labels || labels.length === 0) return "";
  const items = labels
    .map((label) => `<span class="creator-trust-label">${escapeHtml(label)}</span>`)
    .join("");
  return `<dt>trust</dt><dd class="creator-trust-labels">${items}</dd>`;
}

/**
 * A single creator's read-only preview: display name, bio preview, category,
 * and trust labels (all HTML-escaped), plus the PURE `reviewCreatorProfile`
 * review state — never a "verified"/"trusted" claim, just the policy-review
 * label. Ends with a permanently `disabled` "follow" placeholder button —
 * no follow/subscribe/buy/message flow, no profile fetch, no metadata.
 */
export function renderCreatorProfilePreview(profile: CreatorProfileDescriptor): string {
  const decision = reviewCreatorProfile(profile);
  const nameRow = profile.displayName
    ? `<h3 class="creator-profile-preview-name">${escapeHtml(profile.displayName)}</h3>`
    : "";
  const categoryRow = profile.category
    ? `<dt>category</dt><dd>${escapeHtml(profile.category)}</dd>`
    : "";
  const bioRow = profile.bioPreview
    ? `<p class="creator-profile-preview-bio">${escapeHtml(profile.bioPreview)}</p>`
    : "";
  return (
    `<li class="creator-profile-preview-item" data-creator="${escapeHtml(profile.creatorRef ?? "")}">` +
    nameRow +
    `<dl class="creator-profile-preview-meta">` +
    categoryRow +
    renderTrustLabels(profile.trustLabels) +
    `<dt>review</dt><dd>${escapeHtml(decision.state)}</dd>` +
    `</dl>` +
    bioRow +
    `<button type="button" class="creator-follow-button" disabled ` +
    `title="Preview only — following is not implemented">Follow (preview only)</button>` +
    `</li>`
  );
}

/**
 * The full read-only creator profile preview page: a note explaining it is
 * preview-only (including that trust labels are NOT real identity
 * verification), then each profile's preview. NO follow/subscribe/buy/
 * message form exists anywhere on this page — it is a display-only
 * skeleton.
 */
export function renderCreatorProfilePreviewPage(
  profiles: readonly CreatorProfileDescriptor[],
): string {
  const items = profiles.map(renderCreatorProfilePreview).join("");
  return (
    `<section class="creator-profile-preview-page">` +
    `<h2>Creator profile preview</h2>` +
    `<p class="creator-profile-preview-note">Read-only sample preview — no profile fetch, ` +
    `no real identity verification, and trust labels are placeholder display labels only. ` +
    `No follow/subscribe/buy/message happens from this page.</p>` +
    `<ul class="creator-profile-preview-list">${items}</ul>` +
    `</section>`
  );
}
