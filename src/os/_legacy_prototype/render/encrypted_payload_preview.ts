/**
 * Stage 189 — Encrypted payload preview render helpers (display only, no
 * decrypt).
 *
 * Pure string builders showing a [`PayloadPreviewDescriptor`]
 * (`../storage/encrypted_payload.ts`, Stage 189–191) — NEVER its
 * ciphertext, nonce, tag, plaintext, or key, because that type carries
 * none of those fields to begin with (a structural guarantee, not just a
 * rendering discipline). This page shows ONLY: `version`, `algorithm`,
 * `aadDomain`, `encoding`, `payloadId`, `transportKind`, `status` — the
 * exact seven fields `PayloadPreviewDescriptor` has.
 *
 * `Export`/`Download`/`Copy`/`Decrypt` all render as permanently
 * `disabled` buttons — none of the four is implemented anywhere in this
 * file, and none ever will be called from here: there is no ciphertext
 * byte reachable from a `PayloadPreviewDescriptor` in the first place, so
 * none of the four actions has anything to act on even in principle.
 *
 * NOT wired into `../worker.ts` or `../runtime/` — this file is imported
 * by nothing, and imports nothing from either. No `StorageBackend`/
 * `FederationProvider`/Nostr relay connection of any kind.
 */

import type { PayloadPreviewDescriptor } from "../../core/storage/encrypted_payload.js";
import { escapeHtml } from "./html.js";

/** Fixed, honest note shown on every preview — never varies per descriptor. */
const PREVIEW_NOTE =
  "Preview only. No ciphertext, nonce, tag, plaintext, or key is shown or held here.";

/** One disabled action button, with a fixed, honest title. */
function renderDisabledAction(className: string, label: string): string {
  return (
    `<button type="button" class="encrypted-payload-preview-${escapeHtml(className)}-button" ` +
    `disabled title="Preview only — not implemented">${escapeHtml(label)}</button>`
  );
}

/**
 * Renders one payload preview panel: the seven `PayloadPreviewDescriptor`
 * fields (escaped), the fixed preview note, and four permanently
 * `disabled` action buttons (Export/Download/Copy/Decrypt). Never renders
 * a ciphertext/nonce/tag/plaintext/key field — the type given to this
 * function carries none.
 */
export function renderEncryptedPayloadPreview(descriptor: PayloadPreviewDescriptor): string {
  // Rendered verbatim (escaped), never truncated: `payloadId` is an opaque
  // label of arbitrary shape/length, not necessarily a long hex string —
  // unlike a pubkey/event id, shortening it here would be lossy for no
  // benefit and could make two distinct opaque labels visually collide.
  const payloadIdRow = descriptor.payloadId
    ? `<dt>payload id</dt><dd><code>${escapeHtml(descriptor.payloadId)}</code></dd>`
    : `<dt>payload id</dt><dd>(none)</dd>`;
  return (
    `<section class="encrypted-payload-preview" data-testid="encrypted-payload-preview" ` +
    `aria-label="Encrypted payload preview, preview only">` +
    `<h3>Encrypted payload preview</h3>` +
    `<p class="encrypted-payload-preview-note">${escapeHtml(PREVIEW_NOTE)}</p>` +
    `<dl class="encrypted-payload-preview-meta">` +
    `<dt>version</dt><dd>${escapeHtml(descriptor.version)}</dd>` +
    `<dt>algorithm</dt><dd>${escapeHtml(descriptor.algorithm)}</dd>` +
    `<dt>aad domain</dt><dd>${escapeHtml(descriptor.aadDomain)}</dd>` +
    `<dt>encoding</dt><dd>${escapeHtml(descriptor.encoding)}</dd>` +
    payloadIdRow +
    `<dt>transport kind</dt><dd>${escapeHtml(descriptor.transportKind)}</dd>` +
    `<dt>status</dt><dd>${escapeHtml(descriptor.status)}</dd>` +
    `</dl>` +
    renderDisabledAction("export", "Export (preview only)") +
    renderDisabledAction("download", "Download (preview only)") +
    renderDisabledAction("copy", "Copy (preview only)") +
    renderDisabledAction("decrypt", "Decrypt (preview only)") +
    `</section>`
  );
}

/**
 * The full read-only encrypted payload preview page: a top-level note
 * explaining this is a preview-only view (never a real decrypt/export/
 * download/copy path), then each descriptor's own preview panel. NO
 * ciphertext/nonce/tag/plaintext/key/secret/payment/buyer/chat/
 * entitlement/body/message field appears anywhere on this page — none of
 * those exist on `PayloadPreviewDescriptor` for this page to render.
 */
export function renderEncryptedPayloadPreviewPage(
  descriptors: readonly PayloadPreviewDescriptor[],
): string {
  const items = descriptors.map(renderEncryptedPayloadPreview).join("");
  return (
    `<section class="encrypted-payload-preview-page">` +
    `<h2>Encrypted payload preview</h2>` +
    `<p class="encrypted-payload-preview-page-note">Read-only preview — every field shown is a ` +
    `fixed label or opaque reference; no ciphertext, nonce, tag, plaintext, or key is ever shown, ` +
    `and no export, download, copy, or decrypt action is implemented on this page.</p>` +
    `<ul class="encrypted-payload-preview-list">${items}</ul>` +
    `</section>`
  );
}
