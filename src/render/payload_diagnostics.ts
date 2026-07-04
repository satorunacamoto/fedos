/**
 * Stage 190 — Payload diagnostics (pure functions only, preview only).
 *
 * Derives and renders a [`PayloadDiagnosticsDescriptor`]
 * (`../storage/encrypted_payload.ts`, Stage 189–191) FROM a
 * [`PayloadPreviewDescriptor`] — `algorithm`/`encoding`/`version`/
 * `transportKind`/`validationStatus` labels only. Every function here is
 * PURE: no I/O, no mutation, no network, no DOM. No secret byte, key,
 * ciphertext, nonce, tag, or plaintext is read, derived, or displayed —
 * `PayloadPreviewDescriptor`/`PayloadDiagnosticsDescriptor` carry none of
 * those fields to begin with.
 *
 * NOT wired into `../worker.ts` or `../runtime/` — this file is imported
 * by nothing, and imports nothing from either. No `StorageBackend`/
 * `FederationProvider`/Nostr relay connection of any kind.
 */

import type {
  PayloadDiagnosticsDescriptor,
  PayloadPreviewDescriptor,
} from "../storage/encrypted_payload.js";
import { escapeHtml } from "./html.js";

/**
 * Pure projection: a [`PayloadDiagnosticsDescriptor`] carries exactly the
 * label fields `descriptor` already has, minus `aadDomain`/`payloadId`
 * (a diagnostics summary names capability/status labels, not one item's
 * AAD domain or opaque reference) — never mutates `descriptor`.
 */
export function buildPayloadDiagnostics(
  descriptor: PayloadPreviewDescriptor,
): PayloadDiagnosticsDescriptor {
  return {
    version: descriptor.version,
    algorithm: descriptor.algorithm,
    encoding: descriptor.encoding,
    transportKind: descriptor.transportKind,
    validationStatus: descriptor.status,
  };
}

/**
 * Renders one diagnostics summary panel: `version`/`algorithm`/`encoding`/
 * `transportKind`/`validationStatus`, all escaped. No ciphertext/nonce/
 * tag/plaintext/key field is rendered — `PayloadDiagnosticsDescriptor`
 * carries none.
 */
export function renderPayloadDiagnostics(diagnostics: PayloadDiagnosticsDescriptor): string {
  return (
    `<section class="payload-diagnostics" data-testid="payload-diagnostics" ` +
    `aria-label="Payload diagnostics, preview only">` +
    `<h3>Payload diagnostics</h3>` +
    `<p class="payload-diagnostics-note">Preview only. No secret, key, ciphertext, nonce, tag, or ` +
    `plaintext is read or shown here.</p>` +
    `<dl class="payload-diagnostics-meta">` +
    `<dt>version</dt><dd>${escapeHtml(diagnostics.version)}</dd>` +
    `<dt>algorithm</dt><dd>${escapeHtml(diagnostics.algorithm)}</dd>` +
    `<dt>encoding</dt><dd>${escapeHtml(diagnostics.encoding)}</dd>` +
    `<dt>transport</dt><dd>${escapeHtml(diagnostics.transportKind)}</dd>` +
    `<dt>validation status</dt><dd>${escapeHtml(diagnostics.validationStatus)}</dd>` +
    `</dl>` +
    `</section>`
  );
}

/**
 * Convenience pure pipeline: build diagnostics from `descriptor`, then
 * render them. Equivalent to
 * `renderPayloadDiagnostics(buildPayloadDiagnostics(descriptor))`.
 */
export function renderPayloadDiagnosticsFromPreview(descriptor: PayloadPreviewDescriptor): string {
  return renderPayloadDiagnostics(buildPayloadDiagnostics(descriptor));
}
