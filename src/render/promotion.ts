/**
 * Stage 18 — promotion placeholder render helper (label only).
 *
 * Renders a small "Sponsored"/"Promotion" placeholder for a placement slot. It
 * deliberately renders NO real advertisement: it never emits a candidate's
 * title, image, or `destination`, and links nothing. The real ad system fills
 * these slots in a later stage; this is only a labeled, escaped marker so a
 * layout can reserve space and disclose that a slot is sponsored.
 *
 * Stage 41 adds a PREVIEW-ONLY renderer for a `PromotionDecision`
 * (`renderPromotionDecisionPreview` / `renderPromotionCandidatePreview`) plus
 * `renderMockPromotionPreview`, which drives the in-memory `MockPromotionProvider`
 * ONLY. Even the preview never renders a `destination` link or an image, never
 * calls a real/EdgeRec provider, issues no `fetch`, and does no click/impression
 * tracking, ranking, auction, or billing. It exists solely to verify the
 * promotion boundary connects to the UI under an explicit preview flag.
 */

import { MockPromotionProvider, type PromotionProvider } from "../promotion/adapter.js";
import type {
  Placement,
  PromotionCandidate,
  PromotionDecision,
  PromotionRequest,
} from "../promotion/types.js";
import { escapeHtml } from "./html.js";

/**
 * Renders a labeled placeholder for a placement. `label` is the disclosure text
 * (e.g. "Sponsored" or "Promotion"); it is escaped, as are the placement's type,
 * context, and human label. No candidate data is accepted or rendered here — the
 * slot is empty by design.
 */
export function renderPromotionPlaceholder(
  placement: Placement,
  label = "Sponsored",
): string {
  return (
    `<aside class="promotion-placeholder promotion-${escapeHtml(placement.context)}" ` +
    `data-placement="${escapeHtml(placement.type)}">` +
    `<span class="promotion-tag">${escapeHtml(label)}</span>` +
    `<span class="promotion-slot">${escapeHtml(placement.label)}</span>` +
    `</aside>`
  );
}

/** A short, display-only form of a candidate id (never a link target). */
function shortCandidateId(id: string): string {
  return id.length > 16 ? `${id.slice(0, 16)}…` : id;
}

/**
 * Renders ONE mock promotion candidate as a preview card. It escapes the title,
 * sponsor, description, metadata, and a shortened id. It deliberately renders NO
 * `destination` link and NO image — the card is a disclosure/label only, with no
 * click target and no tracking.
 */
export function renderPromotionCandidatePreview(candidate: PromotionCandidate): string {
  const desc = candidate.description
    ? `<p class="promo-preview-desc">${escapeHtml(candidate.description)}</p>`
    : "";
  const metaItems = Object.entries(candidate.metadata)
    .map(
      ([key, value]) =>
        `<li class="promo-preview-meta-item">` +
        `<code>${escapeHtml(key)}</code>: ${escapeHtml(value)}</li>`,
    )
    .join("");
  const metaList = metaItems ? `<ul class="promo-preview-meta">${metaItems}</ul>` : "";
  return (
    `<li class="promo-preview-candidate" ` +
    `data-candidate="${escapeHtml(shortCandidateId(candidate.id))}">` +
    `<span class="promo-preview-title">${escapeHtml(candidate.title)}</span> ` +
    `<span class="promo-preview-sponsor">by ${escapeHtml(candidate.sponsor)}</span>` +
    desc +
    metaList +
    `<p class="promo-preview-note">Mock preview candidate — not a real advertisement.</p>` +
    `</li>`
  );
}

/**
 * Renders a whole `PromotionDecision` as a PREVIEW-ONLY block. An empty selection
 * renders a safe empty state. This never emits a click target, an image, or any
 * click/impression/tracking/billing markup — it discloses that the slot is a mock
 * preview and lists the (escaped) candidate labels only.
 */
export function renderPromotionDecisionPreview(decision: PromotionDecision): string {
  const { placement, selected, reason } = decision;
  const attrs =
    `data-placement="${escapeHtml(placement.type)}" ` +
    `data-reason="${escapeHtml(reason)}"`;
  const header =
    `<span class="promo-preview-tag">Promotion preview (mock)</span>` +
    `<span class="promo-preview-slot">${escapeHtml(placement.label)}</span>`;
  if (selected.length === 0) {
    return (
      `<aside class="promotion-preview promotion-preview-empty promotion-${escapeHtml(placement.context)}" ` +
      `${attrs}>` +
      header +
      `<p class="promo-preview-empty-note">No mock promotion candidates.</p>` +
      `</aside>`
    );
  }
  const items = selected.map(renderPromotionCandidatePreview).join("");
  return (
    `<aside class="promotion-preview promotion-${escapeHtml(placement.context)}" ${attrs}>` +
    header +
    `<ul class="promo-preview-list">${items}</ul>` +
    `<p class="promo-preview-disclaimer">Preview mode — mock promotion candidates only.</p>` +
    `</aside>`
  );
}

/**
 * Drive the in-memory `MockPromotionProvider` for a request and render its
 * decision as a preview block. The provider defaults to a fresh
 * `MockPromotionProvider` — this helper NEVER constructs or calls the real/EdgeRec
 * provider and issues no `fetch`. Callers pass a request built from the pure
 * placement bridges; only an explicit preview mode should reach here.
 */
export async function renderMockPromotionPreview(
  request: PromotionRequest,
  provider: PromotionProvider = new MockPromotionProvider(),
): Promise<string> {
  const decision = await provider.getPromotions(request);
  return renderPromotionDecisionPreview(decision);
}
