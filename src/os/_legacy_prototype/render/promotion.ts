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
 *
 * Stage 52 adds a SEPARATE preview family for Stage 49's
 * `invokePromotionProviderPreview` result (`PromotionInvocationDecision`):
 * `renderProviderPromotionCandidatePreview` / `renderProviderPromotionDecisionPreview`.
 * These are worded "Provider preview" / "Not a served advertisement" rather
 * than "mock" — the underlying provider MAY be a real `EdgeRecPromotionProvider`
 * — but the guardrails are identical: no `destination` link, no image, no
 * click/impression tracking, no ranking/auction/billing. These renderers never
 * call anything themselves; they only format an already-produced result.
 *
 * Stage 53 hardens the diagnostics shown for the OTHER two invocation states
 * (`"disabled"`/`"mock_preview"` and `"provider_error"`) via
 * `PromotionPreviewDiagnosticView` / `buildPromotionPreviewDiagnostic` /
 * `renderPromotionPreviewDiagnostic`. The disabled panel categorizes WHY
 * (`env_flag_disabled` / `query_flag_missing` / `preview_mode_not_requested`)
 * with FIXED, safe copy — it never echoes the raw `PromotionInvocationDecision.reason`
 * string. The error panel likewise shows a FIXED, sanitized sentence — never
 * the provider's own error message, a stack trace, an endpoint URL, or an API
 * key (none of which this module ever receives in the first place). The
 * Stage 52 dual-flag gate itself is unchanged — this stage only changes what
 * is DISPLAYED, never when `invokePromotionProviderPreview` is called.
 */

import { MockPromotionProvider, type PromotionProvider } from "../promotion/adapter.js";
import type { PromotionInvocationDecision } from "../promotion/invocation.js";
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

/** Caps how much of a candidate's metadata the provider preview ever shows. */
const MAX_PROVIDER_PREVIEW_METADATA_ENTRIES = 10;
/** Caps how long a single metadata value is shown before truncating. */
const MAX_PROVIDER_PREVIEW_METADATA_VALUE_LENGTH = 200;

/**
 * Bounds a candidate's metadata for safe display: at most
 * `MAX_PROVIDER_PREVIEW_METADATA_ENTRIES` entries, each value truncated to
 * `MAX_PROVIDER_PREVIEW_METADATA_VALUE_LENGTH` chars (with an ellipsis) —
 * a real/injected provider is an external boundary and could otherwise return
 * an unbounded amount of data. Pure; never mutates `metadata`.
 */
function boundProviderPreviewMetadata(
  metadata: Readonly<Record<string, string>>,
): readonly (readonly [string, string])[] {
  return Object.entries(metadata)
    .slice(0, MAX_PROVIDER_PREVIEW_METADATA_ENTRIES)
    .map(([key, value]) => [
      key,
      value.length > MAX_PROVIDER_PREVIEW_METADATA_VALUE_LENGTH
        ? `${value.slice(0, MAX_PROVIDER_PREVIEW_METADATA_VALUE_LENGTH)}…`
        : value,
    ]);
}

/**
 * Renders ONE candidate from a real/injected provider's decision (Stage 49).
 * Wording is "Provider preview — not a served advertisement." rather than
 * "mock", since the underlying provider may be real — but the same
 * guardrails apply: escapes title/sponsor/description/metadata/id, NEVER
 * renders a `destination` link or an image, and bounds metadata display
 * (Stage 53 — see `boundProviderPreviewMetadata`).
 */
export function renderProviderPromotionCandidatePreview(candidate: PromotionCandidate): string {
  const desc = candidate.description
    ? `<p class="promo-provider-preview-desc">${escapeHtml(candidate.description)}</p>`
    : "";
  const metaItems = boundProviderPreviewMetadata(candidate.metadata)
    .map(
      ([key, value]) =>
        `<li class="promo-provider-preview-meta-item">` +
        `<code>${escapeHtml(key)}</code>: ${escapeHtml(value)}</li>`,
    )
    .join("");
  const metaList = metaItems ? `<ul class="promo-provider-preview-meta">${metaItems}</ul>` : "";
  return (
    `<li class="promo-provider-preview-candidate" ` +
    `data-candidate="${escapeHtml(shortCandidateId(candidate.id))}">` +
    `<span class="promo-provider-preview-title">${escapeHtml(candidate.title)}</span> ` +
    `<span class="promo-provider-preview-sponsor">by ${escapeHtml(candidate.sponsor)}</span>` +
    desc +
    metaList +
    `<p class="promo-provider-preview-note">Provider preview — not a served advertisement.</p>` +
    `</li>`
  );
}

/**
 * Renders a whole `PromotionDecision` produced by a real/injected provider
 * (Stage 49's `invokePromotionProviderPreview`) as a PREVIEW-ONLY block. Never
 * a click target, an image, or any click/impression/tracking/ranking/auction/
 * billing markup — "Provider preview", "Not a served advertisement", "No
 * click/impression tracking".
 */
export function renderProviderPromotionDecisionPreview(decision: PromotionDecision): string {
  const { placement, selected, reason } = decision;
  const attrs =
    `data-placement="${escapeHtml(placement.type)}" ` +
    `data-reason="${escapeHtml(reason)}"`;
  const header =
    `<span class="promo-provider-preview-tag">Provider preview</span>` +
    `<span class="promo-provider-preview-slot">${escapeHtml(placement.label)}</span>`;
  if (selected.length === 0) {
    return (
      `<aside class="promotion-provider-preview promotion-provider-preview-empty ` +
      `promotion-${escapeHtml(placement.context)}" ${attrs}>` +
      header +
      `<p class="promo-provider-preview-empty-note">No candidates. Not a served advertisement.</p>` +
      `</aside>`
    );
  }
  const items = selected.map(renderProviderPromotionCandidatePreview).join("");
  return (
    `<aside class="promotion-provider-preview promotion-${escapeHtml(placement.context)}" ${attrs}>` +
    header +
    `<ul class="promo-provider-preview-list">${items}</ul>` +
    `<p class="promo-provider-preview-disclaimer">Not a served advertisement. No click/impression ` +
    `tracking, ranking, auction, or billing occurs here.</p>` +
    `</aside>`
  );
}

/**
 * Why the Stage 52 provider preview is currently disabled. This is a display
 * CATEGORY only — it never changes when `invokePromotionProviderPreview` is
 * actually called (the Stage 52 dual-flag gate is unchanged).
 */
export type PromotionPreviewDisabledReason =
  | "env_flag_disabled"
  | "query_flag_missing"
  | "preview_mode_not_requested";

/** Fixed, safe copy for each disabled reason — never echoes raw flag/env values. */
const DISABLED_REASON_TEXT: Readonly<Record<PromotionPreviewDisabledReason, string>> = {
  env_flag_disabled: "the ENABLE_PROMOTION_PROVIDER_PREVIEW env flag is not enabled.",
  query_flag_missing:
    "the ?edgeRecPreview=1 / ?providerPromotionPreview=1 query flag is not present.",
  preview_mode_not_requested: "provider preview mode was not requested.",
};

/**
 * Fixed, sanitized text for a provider error. This NEVER echoes the
 * provider's own error message, an endpoint URL, an API key, or a stack
 * trace — none of those are available to this render layer in the first
 * place, and this stays a fixed sentence even if a future caller starts
 * passing richer error context through `PromotionInvocationDecision.reason`.
 */
const PROVIDER_ERROR_TEXT = "the provider could not be reached or returned an error.";

/**
 * A structured, display-safe diagnostic derived from a Stage 49
 * `PromotionInvocationDecision`. `disabledReason`/`decision` are present only
 * for their matching `kind`.
 */
export interface PromotionPreviewDiagnosticView {
  readonly kind: "disabled" | "provider_preview" | "provider_error";
  readonly disabledReason?: PromotionPreviewDisabledReason;
  readonly decision?: PromotionDecision;
}

/**
 * Builds a `PromotionPreviewDiagnosticView` from an invocation result.
 * `disabledReason` is used ONLY when the result isn't `"provider_preview"`
 * with a decision or `"provider_error"` — callers that know WHY the preview
 * is disabled (e.g. the Worker, which knows whether the env or query flag was
 * missing) should pass it explicitly; it defaults to
 * `"preview_mode_not_requested"`. Pure — never mutates `result`.
 */
export function buildPromotionPreviewDiagnostic(
  result: PromotionInvocationDecision,
  disabledReason: PromotionPreviewDisabledReason = "preview_mode_not_requested",
): PromotionPreviewDiagnosticView {
  if (result.state === "provider_preview" && result.decision) {
    return { kind: "provider_preview", decision: result.decision };
  }
  if (result.state === "provider_error") {
    return { kind: "provider_error" };
  }
  return { kind: "disabled", disabledReason };
}

/**
 * Renders the provider-preview diagnostic panel: a successful
 * `"provider_preview"` renders its `decision` via
 * `renderProviderPromotionDecisionPreview`; `"provider_error"` renders a
 * FIXED, sanitized "Provider preview unavailable" note (never the provider's
 * own error text); `"disabled"` renders a FIXED, categorized "Provider
 * preview disabled" note. Never candidate data, never a claim that anything
 * was served, never a stack trace/endpoint/API key. This function calls
 * nothing itself; it only formats an already-produced view.
 */
export function renderPromotionPreviewDiagnostic(view: PromotionPreviewDiagnosticView): string {
  if (view.kind === "provider_preview" && view.decision) {
    return renderProviderPromotionDecisionPreview(view.decision);
  }
  if (view.kind === "provider_error") {
    return (
      `<aside class="promotion-provider-preview promotion-provider-preview-error" ` +
      `data-state="provider_error">` +
      `<span class="promo-provider-preview-tag">Provider preview unavailable</span>` +
      `<p class="promo-provider-preview-reason">${escapeHtml(PROVIDER_ERROR_TEXT)}</p>` +
      `<p class="promo-provider-preview-note">Not a served advertisement.</p>` +
      `</aside>`
    );
  }
  const reasonKey = view.disabledReason ?? "preview_mode_not_requested";
  return (
    `<aside class="promotion-provider-preview promotion-provider-preview-disabled" ` +
    `data-state="disabled" data-disabled-reason="${escapeHtml(reasonKey)}">` +
    `<span class="promo-provider-preview-tag">Provider preview disabled</span>` +
    `<p class="promo-provider-preview-reason">${escapeHtml(DISABLED_REASON_TEXT[reasonKey])}</p>` +
    `<p class="promo-provider-preview-note">Not a served advertisement.</p>` +
    `</aside>`
  );
}
