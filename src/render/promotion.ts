/**
 * Stage 18 — promotion placeholder render helper (label only).
 *
 * Renders a small "Sponsored"/"Promotion" placeholder for a placement slot. It
 * deliberately renders NO real advertisement: it never emits a candidate's
 * title, image, or `destination`, and links nothing. The real ad system fills
 * these slots in a later stage; this is only a labeled, escaped marker so a
 * layout can reserve space and disclose that a slot is sponsored.
 */

import type { Placement } from "../promotion/types.js";
import { escapeHtml } from "./html.js";

/**
 * Renders a labeled placeholder for a placement. `label` is the disclosure text
 * (e.g. "Sponsored" or "Promotion"); it is escaped, as is the placement. No
 * candidate data is accepted or rendered here.
 */
export function renderPromotionPlaceholder(
  placement: Placement,
  label = "Sponsored",
): string {
  return (
    `<aside class="promotion-placeholder promotion-${escapeHtml(placement.context)}" ` +
    `data-placement="${escapeHtml(placement.type)}">` +
    `<span class="promotion-tag">${escapeHtml(label)}</span>` +
    `</aside>`
  );
}
