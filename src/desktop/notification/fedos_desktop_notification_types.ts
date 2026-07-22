/**
 * Secure Runtime Alpha 4261-4340 ("Desktop Notifications, System Tray, and
 * Background Operation Arc") — Phase B: Desktop Notification Boundary,
 * closed type vocabulary.
 *
 * `FedosDesktopNotificationKind` is a CLOSED, exhaustive vocabulary of the
 * only notification kinds a Desktop Host may ever raise. There is no
 * free-form "custom" kind and no free-form payload: every notification this
 * boundary ever produces is a FIXED, generic, per-kind title/body template
 * (see `FEDOS_DESKTOP_NOTIFICATION_TEMPLATES` below) plus, optionally, one
 * opaque `targetConversationId` ref (never content) and one bounded, policy-
 * checked `detail` string (a short, non-sensitive extra, e.g. "3 devices" —
 * never a message body, secret, or content preview).
 *
 * RELATIONSHIP TO `src/notification/` (Stage 39, EXISTING, verified —
 * DELIBERATELY UNRELATED, never merged): that boundary is a GENERIC,
 * desktop-agnostic seam for a FUTURE EXTERNAL push transport (Telegram/
 * LINE/APNs/FCM/Email) carrying coarse chat/space/product activity signals
 * — it has no desktop/Electron/OS-notification-tray concept anywhere in it,
 * and nothing under `src/desktop/` may depend on it structurally. This file
 * intentionally mirrors its ONE proven safety idea — "coarse, non-sensitive
 * signal only, never real content" — and reuses its pure
 * `isSensitiveNotificationField` policy helper (`../../notification/policy.js`)
 * for `detail` validation, rather than reinventing that check. It does NOT
 * reuse `NotificationChannel`/`NotificationPayload`/`NotificationBridge`
 * (those model EXTERNAL channels this Arc never touches) and does NOT
 * import `src/notification/bridge.ts` or `types.ts`. The two boundaries
 * remain independent: this one is OS-level desktop notification tray
 * output (Electron `Notification`, Phase E); that one is a future external
 * push bridge. A future Arc MAY choose to fan this boundary's own events
 * out to that one — this Arc does not, and names no such wiring.
 *
 * HARD GUARDRAILS (Phase B "Fail Closed"):
 *   - `validateFedosDesktopNotificationRequest` fails closed to `null` for
 *     any unrecognized `kind`, wrong-shaped candidate, or oversized field —
 *     never throws.
 *   - No field on `FedosDesktopNotificationRequest`/`FedosDesktopNotificationView`
 *     ever carries a message body, secret, key, token, or credential — the
 *     title/body strings are FIXED TEMPLATES this file owns, never supplied
 *     by a caller.
 */

// eslint-disable-next-line no-restricted-imports -- deliberate, narrow reuse of one PURE policy helper; see this file's own header, "RELATIONSHIP TO src/notification/".
import { isSensitiveNotificationField } from "../../notification/policy.js";

export type FedosDesktopNotificationKind =
  | "conversation-message"
  | "device-sync"
  | "device-transfer"
  | "sync-complete"
  | "sync-failed"
  | "archive-complete"
  | "archive-failed"
  | "warning"
  | "error"
  // Secure Runtime Alpha 6041-6120 (FedOS Signed Deletion Request Multi-
  // Device Aggregation and User Consent UI Arc) -- five new, additive,
  // FIXED-template kinds. Never carries message plaintext, a requester
  // identity, or a Conversation title -- `detail` (when present) is the
  // SAME bounded, policy-checked, non-sensitive string every other kind
  // already uses (e.g. "1 device pending"), never request/ack content.
  | "deletion-request-received"
  | "deletion-request-expired"
  | "deletion-request-responded"
  | "deletion-request-pending-devices"
  | "deletion-request-partial";

export const FEDOS_DESKTOP_NOTIFICATION_KINDS: readonly FedosDesktopNotificationKind[] = [
  "conversation-message",
  "device-sync",
  "device-transfer",
  "sync-complete",
  "sync-failed",
  "archive-complete",
  "archive-failed",
  "warning",
  "error",
  "deletion-request-received",
  "deletion-request-expired",
  "deletion-request-responded",
  "deletion-request-pending-devices",
  "deletion-request-partial",
];

/** This layer's own bound for id-shaped/detail strings — mirrors `FEDOS_DESKTOP_HOST_MAX_ID_LENGTH`'s own "512, non-empty" convention (`../host_boundary/fedos_desktop_host_command.ts`), restated here since this boundary sits beside, not under, the Host layer. */
export const FEDOS_DESKTOP_NOTIFICATION_MAX_ID_LENGTH = 512;

/** A short, non-sensitive extra detail string is bounded well below a message-body length — it is display text, never stored content. */
export const FEDOS_DESKTOP_NOTIFICATION_MAX_DETAIL_LENGTH = 200;

/** What a caller may ask this boundary to raise — closed shape, no custom payload. */
export interface FedosDesktopNotificationRequest {
  readonly kind: FedosDesktopNotificationKind;
  /** Opaque target ref (e.g. a conversation id) this notification is ABOUT — never content. Used only to route a later click back to a window/conversation (Phase E/F). */
  readonly targetConversationId?: string;
  /** Optional short, non-sensitive extra (e.g. "3 devices", "12 messages"). Policy-checked; a sensitive-looking value denies the WHOLE request (fail closed), never silently dropped-and-sent. */
  readonly detail?: string;
}

/** The FIXED, generic per-kind template this boundary raises. Never caller-supplied (Phase B "No custom notification payloads"). */
export interface FedosDesktopNotificationTemplate {
  readonly title: string;
  readonly body: string;
}

const FEDOS_DESKTOP_NOTIFICATION_TEMPLATES: Readonly<Record<FedosDesktopNotificationKind, FedosDesktopNotificationTemplate>> = Object.freeze({
  "conversation-message": Object.freeze({ title: "New message", body: "You have a new message in a conversation" }),
  "device-sync": Object.freeze({ title: "Device sync", body: "Device sync activity" }),
  "device-transfer": Object.freeze({ title: "Device transfer", body: "A device transfer is in progress" }),
  "sync-complete": Object.freeze({ title: "Sync complete", body: "Sync finished successfully" }),
  "sync-failed": Object.freeze({ title: "Sync failed", body: "Sync did not complete" }),
  "archive-complete": Object.freeze({ title: "Archive complete", body: "Archive finished successfully" }),
  "archive-failed": Object.freeze({ title: "Archive failed", body: "Archive did not complete" }),
  warning: Object.freeze({ title: "Warning", body: "A warning occurred" }),
  error: Object.freeze({ title: "Error", body: "An error occurred" }),
  "deletion-request-received": Object.freeze({ title: "Deletion request", body: "A deletion request is awaiting your review" }),
  "deletion-request-expired": Object.freeze({ title: "Deletion request expired", body: "A deletion request expired before it was reviewed" }),
  "deletion-request-responded": Object.freeze({ title: "Deletion request update", body: "A recipient Device responded to your deletion request" }),
  "deletion-request-pending-devices": Object.freeze({ title: "Deletion request pending", body: "Some recipient Devices have not yet responded" }),
  "deletion-request-partial": Object.freeze({ title: "Deletion request partial", body: "A deletion request was only partially applied" }),
});

export function fedosDesktopNotificationTemplateFor(kind: FedosDesktopNotificationKind): FedosDesktopNotificationTemplate {
  return FEDOS_DESKTOP_NOTIFICATION_TEMPLATES[kind];
}

/** The fully-resolved, ready-to-deliver notification — fixed template + optional opaque target/detail + a caller-independent clock reading. This is the ONLY shape `FedosDesktopNotificationPort.notify()` ever receives. */
export interface FedosDesktopNotificationView {
  readonly kind: FedosDesktopNotificationKind;
  readonly title: string;
  readonly body: string;
  readonly targetConversationId: string | null;
  readonly createdAt: number;
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

/** Fails closed to `null` for anything not a genuinely well-formed, in-vocabulary request. Never throws. */
export function validateFedosDesktopNotificationRequest(candidate: unknown): FedosDesktopNotificationRequest | null {
  if (candidate === null || typeof candidate !== "object") return null;
  const c = candidate as Record<string, unknown>;
  if (typeof c.kind !== "string" || !FEDOS_DESKTOP_NOTIFICATION_KINDS.includes(c.kind as FedosDesktopNotificationKind)) return null;
  const kind = c.kind as FedosDesktopNotificationKind;

  let targetConversationId: string | undefined;
  if (c.targetConversationId !== undefined) {
    if (!isBoundedString(c.targetConversationId, FEDOS_DESKTOP_NOTIFICATION_MAX_ID_LENGTH)) return null;
    targetConversationId = c.targetConversationId;
  }

  let detail: string | undefined;
  if (c.detail !== undefined) {
    if (!isBoundedString(c.detail, FEDOS_DESKTOP_NOTIFICATION_MAX_DETAIL_LENGTH)) return null;
    detail = c.detail;
  }

  return Object.freeze({
    kind,
    ...(targetConversationId !== undefined ? { targetConversationId } : {}),
    ...(detail !== undefined ? { detail } : {}),
  });
}

/** `true` when `request.detail` (if present) looks sensitive by this repo's own existing, pure notification-policy marker check — reused, never re-implemented (see this file's own header). */
export function fedosDesktopNotificationRequestLooksSensitive(request: FedosDesktopNotificationRequest): boolean {
  return request.detail !== undefined && isSensitiveNotificationField(request.detail);
}

/** Builds the final, immutable delivery view from a validated request — the fixed per-kind template, plus the opaque target ref and detail, plus `clock()`'s own reading. Pure; never mutates `request`. */
export function fedosDesktopNotificationViewFrom(request: FedosDesktopNotificationRequest, now: number): FedosDesktopNotificationView {
  const template = fedosDesktopNotificationTemplateFor(request.kind);
  const body = request.detail !== undefined ? `${template.body} (${request.detail})` : template.body;
  return Object.freeze({
    kind: request.kind,
    title: template.title,
    body,
    targetConversationId: request.targetConversationId ?? null,
    createdAt: now,
  });
}
