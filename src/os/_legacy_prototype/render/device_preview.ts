/**
 * Stage 130 — Device & identity preview UI skeleton (read-only, opt-in).
 *
 * Pure string builders showing sample device registration/trust/session/
 * recovery records run through their real (pure) review functions —
 * `../identity/device_registration.js`, `../identity/device_trust.js`,
 * `../identity/session_boundary.js`, `../identity/recovery_policy.js` — as
 * a read-only preview page, gated behind an explicit `?devicePreview=1`
 * flag in the Worker (see `../worker.js`). Every label is HTML-escaped.
 *
 * There is NO password, recovery phrase, mnemonic, seed, backup, export,
 * import, sync, or authentication field anywhere in this file (or in the
 * four boundaries it calls) — every review function it calls is a pure
 * label lookup that mutates nothing and contacts no provider.
 */

import {
  reviewDeviceRegistration,
  type DeviceRegistrationDescriptor,
} from "../../core/identity/device_registration.js";
import { reviewDeviceTrust, type DeviceTrustDescriptor } from "../../core/identity/device_trust.js";
import { reviewSessionRequest, type SessionRequestDescriptor } from "../../core/identity/session_boundary.js";
import {
  reviewIdentityRecoveryRequest,
  type IdentityRecoveryRequestDescriptor,
} from "../../core/identity/recovery_policy.js";
import { escapeHtml } from "./html.js";

/** Static sample device registrations for the preview page. Never paired, never live. */
export const SAMPLE_DEVICE_REGISTRATIONS: readonly DeviceRegistrationDescriptor[] = [
  { idRef: "device-1", deviceRef: "device-ref-1", actorRef: "actor-1", platformLabel: "desktop" },
];

/** Static sample device trust assessments for the preview page. Never attested, never live. */
export const SAMPLE_DEVICE_TRUST: readonly DeviceTrustDescriptor[] = [
  { idRef: "trust-1", deviceRef: "device-ref-1", label: "trusted_placeholder" },
];

/** Static sample session requests for the preview page. Never a real session. */
export const SAMPLE_SESSION_REQUESTS: readonly SessionRequestDescriptor[] = [
  { idRef: "session-1", deviceRef: "device-ref-1", actorRef: "actor-1", action: "start_placeholder" },
];

/** Static sample recovery requests for the preview page. Never a real recovery. */
export const SAMPLE_RECOVERY_REQUESTS: readonly IdentityRecoveryRequestDescriptor[] = [
  { idRef: "recovery-1", actorRef: "actor-1", kind: "unlock_trigger_placeholder" },
];

function renderDeviceRegistrationRow(device: DeviceRegistrationDescriptor): string {
  const decision = reviewDeviceRegistration(device);
  return (
    `<li class="device-preview-registration-item">` +
    `<dl><dt>platform</dt><dd>${escapeHtml(device.platformLabel ?? "")}</dd>` +
    `<dt>state</dt><dd>${escapeHtml(decision.state)}</dd></dl>` +
    `</li>`
  );
}

function renderDeviceTrustRow(trust: DeviceTrustDescriptor): string {
  const decision = reviewDeviceTrust(trust);
  return (
    `<li class="device-preview-trust-item">` +
    `<dl><dt>label</dt><dd>${escapeHtml(trust.label)}</dd>` +
    `<dt>review</dt><dd>${escapeHtml(decision.state)}</dd></dl>` +
    `</li>`
  );
}

function renderSessionRow(request: SessionRequestDescriptor): string {
  const review = reviewSessionRequest(request);
  return (
    `<li class="device-preview-session-item">` +
    `<dl><dt>action</dt><dd>${escapeHtml(request.action)}</dd>` +
    `<dt>state</dt><dd>${escapeHtml(review.decision)}</dd></dl>` +
    `</li>`
  );
}

function renderRecoveryRow(request: IdentityRecoveryRequestDescriptor): string {
  const decision = reviewIdentityRecoveryRequest(request);
  return (
    `<li class="device-preview-recovery-item">` +
    `<dl><dt>kind</dt><dd>${escapeHtml(request.kind)}</dd>` +
    `<dt>state</dt><dd>${escapeHtml(decision.state)}</dd></dl>` +
    `</li>`
  );
}

/**
 * The full read-only device & identity preview page: a note explaining
 * every row is a static sample run through a pure review function (never a
 * real pairing/attestation/session/recovery), then one section per
 * boundary. NO pair/unlock/recover button exists anywhere on this page.
 */
export function renderDevicePreviewPage(
  registrations: readonly DeviceRegistrationDescriptor[],
  trustAssessments: readonly DeviceTrustDescriptor[],
  sessionRequests: readonly SessionRequestDescriptor[],
  recoveryRequests: readonly IdentityRecoveryRequestDescriptor[],
): string {
  return (
    `<section class="device-preview-page">` +
    `<h2>Device &amp; identity preview</h2>` +
    `<p class="device-preview-note">Read-only sample preview — every row is a static sample run ` +
    `through a pure review function; nothing here pairs, attests, authenticates, syncs, or recovers ` +
    `any real device, session, or credential.</p>` +
    `<h3>Device registrations</h3><ul class="device-preview-registration-list">${registrations.map(renderDeviceRegistrationRow).join("")}</ul>` +
    `<h3>Device trust</h3><ul class="device-preview-trust-list">${trustAssessments.map(renderDeviceTrustRow).join("")}</ul>` +
    `<h3>Sessions</h3><ul class="device-preview-session-list">${sessionRequests.map(renderSessionRow).join("")}</ul>` +
    `<h3>Recovery requests</h3><ul class="device-preview-recovery-list">${recoveryRequests.map(renderRecoveryRow).join("")}</ul>` +
    `</section>`
  );
}
