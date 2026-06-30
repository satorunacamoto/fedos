/**
 * Stage 13 — mock-only publish UI prototype (render layer).
 *
 * This renders a PREVIEW of the posting flow on a space landing page. It is
 * strictly read-only/preview: it builds an UNSIGNED event with `prepareSpacePost`
 * and shows what *would* be signed and published — but it never signs, never
 * calls a NIP-07 provider, and never calls a `RelayPublisher`. The publish
 * button is always disabled and labelled mock-only. There is no network here.
 *
 * Every event-derived string (content, pubkey, tags, decision reason, actor) is
 * HTML-escaped before output, exactly like the rest of the render layer.
 */

import { escapeHtml, shortenHex } from "./html.js";
import { canPost } from "../community/policy.js";
import { prepareSpacePost } from "../sign/build.js";
import type { Space, SpaceDecision } from "../community/types.js";
import type { UnsignedNostrEvent } from "../sign/types.js";

/** Inputs to a preview, parsed from the request (untrusted strings). */
export interface PublishPrototypeParams {
  /** Draft note body. May be empty (renders a placeholder). */
  readonly content: string;
  /** Candidate author. Absent => guest, which is denied (must identify first). */
  readonly actorPubkey?: string;
}

/**
 * A fully-resolved preview: who is composing, whether policy allows it, and the
 * unsigned event that `prepareSpacePost` produced (only when allowed AND content
 * is non-empty). The render functions format this; they do no policy work.
 */
export interface PublishPrototypeView {
  readonly spaceName: string;
  /** undefined => guest (no actor selected). */
  readonly actorPubkey: string | undefined;
  readonly content: string;
  readonly decision: SpaceDecision;
  /** Present only when the post is allowed and there is content to preview. */
  readonly unsigned: UnsignedNostrEvent | undefined;
}

/**
 * Builds a preview view for a (already readable) space. Pure: it consults the
 * Stage 9 `canPost` policy and the Stage 10 `prepareSpacePost` builder, but
 * never signs or publishes. A missing actor is treated as a denial — you must
 * identify a candidate author (e.g. an external signer's pubkey) to preview.
 */
export function buildPublishPrototypeView(
  params: PublishPrototypeParams,
  space: Space,
): PublishPrototypeView {
  const actorPubkey = params.actorPubkey || undefined;

  if (actorPubkey === undefined) {
    return {
      spaceName: space.name,
      actorPubkey: undefined,
      content: params.content,
      decision: {
        allowed: false,
        role: "guest",
        reason: "no actor selected — add ?actor=<pubkey> to preview a post",
      },
      unsigned: undefined,
    };
  }

  const decision = canPost(actorPubkey, space);
  let unsigned: UnsignedNostrEvent | undefined;
  if (decision.allowed && params.content.length > 0) {
    const prepared = prepareSpacePost({ actorPubkey, space, content: params.content });
    if (prepared.ok) unsigned = prepared.request.unsigned;
  }

  return { spaceName: space.name, actorPubkey, content: params.content, decision, unsigned };
}

/** Renders the denied state: just the (escaped) policy reason. */
export function renderPublishDenied(decision: SpaceDecision): string {
  return (
    `<p class="publish-denied">Cannot preview a post here: ` +
    `${escapeHtml(decision.reason)}</p>`
  );
}

/** Renders the unsigned-event preview: the body a signer would receive. */
export function renderUnsignedEventPreview(event: UnsignedNostrEvent): string {
  const tags =
    event.tags.length === 0
      ? `<li class="empty">(none)</li>`
      : event.tags
          .map(
            (tag) =>
              `<li><code>[${tag.map((t) => escapeHtml(t)).join(", ")}]</code></li>`,
          )
          .join("");
  return (
    `<div class="unsigned-preview">` +
    `<p class="preview-label">Unsigned event preview (not signed, not sent):</p>` +
    `<dl>` +
    `<dt>kind</dt><dd>${event.kind}</dd>` +
    `<dt>pubkey</dt><dd><code title="${escapeHtml(event.pubkey)}">` +
    `${escapeHtml(shortenHex(event.pubkey))}</code></dd>` +
    `<dt>created_at</dt><dd>${event.created_at}</dd>` +
    `<dt>content</dt><dd class="preview-content">${escapeHtml(event.content)}</dd>` +
    `<dt>tags</dt><dd><ul class="preview-tags">${tags}</ul></dd>` +
    `</dl>` +
    `<p class="preview-missing"><code>id</code> and <code>sig</code> are not ` +
    `present yet — they would be produced by an external signer (e.g. NIP-07). ` +
    `This app does not sign.</p>` +
    `</div>`
  );
}

/**
 * Renders the whole preview-only compose panel. Allowed + content => unsigned
 * preview; allowed + empty => placeholder; denied => the reason. The publish
 * button is always disabled and mock-only — nothing is signed or sent.
 */
export function renderPublishPrototype(view: PublishPrototypeView): string {
  const viewingAs = view.actorPubkey
    ? `<p class="viewing-as">composing as <code>${escapeHtml(shortenHex(view.actorPubkey))}</code></p>`
    : `<p class="viewing-as">no actor selected (guest)</p>`;

  let body: string;
  if (!view.decision.allowed) {
    body = renderPublishDenied(view.decision);
  } else if (view.content.length === 0) {
    body =
      `<p class="publish-placeholder">You can post here. Add ` +
      `<code>&amp;content=…</code> to preview an unsigned event.</p>`;
  } else if (view.unsigned) {
    body = renderUnsignedEventPreview(view.unsigned);
  } else {
    // Allowed with content but no unsigned event built — defensive fallback.
    body = `<p class="publish-placeholder">Nothing to preview.</p>`;
  }

  // The button is ALWAYS disabled: this prototype is mock-only, no network.
  const button =
    `<div class="publish-actions">` +
    `<button type="button" disabled>Publish — mock only (disabled)</button> ` +
    `<span class="publish-mock-note">Preview only. No signing, no relay send. ` +
    `A real flow would hand the unsigned event to an external signer, then to a ` +
    `<code>RelayPublisher</code> (a <code>MockRelayPublisher</code> in tests).</span>` +
    `</div>`;

  return (
    `<section class="publish-prototype">` +
    `<h3>Compose — preview only</h3>` +
    viewingAs +
    body +
    button +
    `</section>`
  );
}
