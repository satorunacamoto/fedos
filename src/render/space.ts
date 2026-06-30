/**
 * Stage 11 — read-only render for spaces (directory + landing pages).
 *
 * Pure string builders. Every space-derived string (id, name, description,
 * decision reason, actor) is HTML-escaped. These views are read-only: any
 * "post" affordance is rendered DISABLED ("coming soon") — there is no signing
 * or publishing here.
 */

import { escapeHtml, shortenHex } from "./html.js";
import type { Space, SpaceDecision } from "../community/types.js";
import { buildSpacePlacement, type SpacePlacementType } from "../promotion/bridge.js";
import { renderPromotionPlaceholder } from "./promotion.js";

/** Builds an EMPTY space promotion placeholder (no candidate, no provider). */
function spacePromotionPlaceholder(
  space: Space,
  slot: SpacePlacementType,
  label: string,
): string {
  const request = buildSpacePlacement(space, slot);
  return renderPromotionPlaceholder(request.placement, label);
}

/** Builds a safe `?space=<id>` href (URL-encoded then attribute-escaped). */
function spaceHref(id: string, actorPubkey?: string): string {
  let href = `?space=${encodeURIComponent(id)}`;
  if (actorPubkey) href += `&actor=${encodeURIComponent(actorPubkey)}`;
  return escapeHtml(href);
}

function viewingAs(actorPubkey?: string): string {
  if (!actorPubkey) return "";
  return `<p class="viewing-as">viewing as <code>${escapeHtml(shortenHex(actorPubkey))}</code></p>`;
}

/** Lists spaces with links into their landing pages. */
export function renderSpaceDirectory(
  spaces: readonly Space[],
  actorPubkey?: string,
): string {
  const header = `<h2>Spaces</h2>${viewingAs(actorPubkey)}`;
  if (spaces.length === 0) {
    return `<section class="space-directory">${header}<p class="empty">No spaces available.</p></section>`;
  }
  const items = spaces
    .map((space) => {
      const desc = space.description
        ? `<p class="space-desc">${escapeHtml(space.description)}</p>`
        : "";
      return (
        `<li class="space-item">` +
        `<a href="${spaceHref(space.id, actorPubkey)}">${escapeHtml(space.name)}</a> ` +
        `<span class="space-meta">${escapeHtml(space.type)} · ${escapeHtml(space.visibility)}</span>` +
        desc +
        `</li>`
      );
    })
    .join("");
  return `<section class="space-directory">${header}<ul>${items}</ul></section>`;
}

/** The disabled, read-only post affordance plus a hint based on policy. */
function renderPostHint(postDecision: SpaceDecision): string {
  const cls = postDecision.allowed ? "post-hint allowed" : "post-hint denied";
  const text = postDecision.allowed
    ? "You can post here once posting ships."
    : `Posting restricted: ${escapeHtml(postDecision.reason)}`;
  return (
    `<div class="${cls}">${text} ` +
    `<button type="button" disabled>Post — coming soon</button></div>`
  );
}

/** Options for `renderSpaceLanding`. */
export interface SpaceLandingOptions {
  /**
   * Whether to render the (empty) promotion placeholders. Default true. The
   * Worker turns this off outside sample mode so the read-only live path stays
   * placeholder-free.
   */
  readonly promotions?: boolean;
}

/**
 * Landing header for a readable space, with read status and a post hint. When
 * `options.promotions` (default true), it brackets the content with EMPTY
 * `space_header` / `space_footer` promotion placeholders — disclosure-only slots
 * that render no ad candidate and call no provider.
 */
export function renderSpaceLanding(
  space: Space,
  readDecision: SpaceDecision,
  postDecision: SpaceDecision,
  options: SpaceLandingOptions = {},
): string {
  const desc = space.description
    ? `<p class="space-desc">${escapeHtml(space.description)}</p>`
    : "";
  const showPromotions = options.promotions ?? true;
  const headerSlot = showPromotions
    ? spacePromotionPlaceholder(space, "space_header", "Sponsored slot")
    : "";
  const footerSlot = showPromotions
    ? spacePromotionPlaceholder(space, "space_footer", "Promotion placeholder")
    : "";
  return (
    `<section class="space-landing">` +
    headerSlot +
    `<h2>${escapeHtml(space.name)} ` +
    `<span class="space-type">${escapeHtml(space.type)}</span></h2>` +
    `<p class="space-meta">visibility: ${escapeHtml(space.visibility)} · ` +
    `read: ${escapeHtml(readDecision.reason)}</p>` +
    desc +
    renderPostHint(postDecision) +
    `<p><a href="?">← all threads</a></p>` +
    footerSlot +
    `</section>`
  );
}

/** Shown when `?space=<id>` names a space that does not exist. */
export function renderSpaceNotFound(spaceId: string): string {
  return (
    `<section class="space-error">` +
    `<h2>Space not found</h2>` +
    `<p>No space with id <code>${escapeHtml(spaceId)}</code>.</p>` +
    `</section>`
  );
}

/** Shown when the actor may not read the requested space. */
export function renderSpaceAccessDenied(
  space: Space,
  decision: SpaceDecision,
): string {
  return (
    `<section class="space-error">` +
    `<h2>Access denied</h2>` +
    `<p>${escapeHtml(space.name)}: ${escapeHtml(decision.reason)}</p>` +
    `</section>`
  );
}
