/**
 * Stage 39 — pure policy/helpers for the notification boundary.
 *
 * All functions are pure: they inspect or normalize a `NotificationPayload` and
 * never mutate inputs, perform I/O, or send anything. They enforce the ONE hard
 * rule of this boundary: a notification carries only COARSE, non-sensitive
 * metadata — never DM/message content, a secret, key, seed, token, payment secret,
 * entitlement, or credential.
 */

import type { NotificationDecision, NotificationPayload } from "./types.js";

/**
 * Substrings that mark a VALUE as sensitive (case-insensitive). Deliberately
 * conservative: matching one denies/sanitizes the field. Note we do NOT flag long
 * hex strings, because an opaque public pubkey (a legitimate `actorRef`) is hex —
 * only explicit secret markers are treated as sensitive.
 */
const SENSITIVE_VALUE_MARKERS: readonly string[] = [
  "secret",
  "seed",
  "passphrase",
  "password",
  "private key",
  "privatekey",
  "nsec", // bech32 private key prefix
  "credential",
  "entitlement",
  "bearer ",
  "api key",
  "apikey",
  "payment",
  "card number",
  "cardnumber",
  "cvv",
  "token",
];

/**
 * Sensitive metadata KEY markers (matched against the key with non-alphanumerics
 * stripped). A key like `dmContent`, `messageBody`, `paymentSecret`, `authToken`,
 * or `apiKey` is dropped.
 */
const SENSITIVE_KEY_MARKERS: readonly string[] = [
  "dm",
  "content",
  "message",
  "body",
  "secret",
  "key",
  "seed",
  "token",
  "payment",
  "entitlement",
  "credential",
  "password",
  "passphrase",
];

/** True if a string value looks like it carries secret/sensitive content. */
export function isSensitiveNotificationField(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return SENSITIVE_VALUE_MARKERS.some((marker) => v.includes(marker));
}

/** True if a metadata key names a sensitive field. */
function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_KEY_MARKERS.some((marker) => k.includes(marker));
}

/** Denied decision with a fixed, non-sensitive reason (never echoes content). */
function deny(reason: string): NotificationDecision {
  return { allowed: false, state: "rejected", reason };
}

/**
 * Decide whether a payload may be sent. Denies (never throws) when any string
 * field or any metadata key/value looks sensitive. A clean payload is `accepted`
 * — a PLACEHOLDER acceptance that still sends nothing.
 */
export function canSendNotification(payload: NotificationPayload): NotificationDecision {
  const fields: readonly (string | undefined)[] = [
    payload.title,
    payload.bodyPreview,
    payload.targetRef,
    payload.actorRef,
  ];
  for (const field of fields) {
    if (typeof field === "string" && isSensitiveNotificationField(field)) {
      return deny("a payload field contains sensitive content");
    }
  }
  if (payload.metadata) {
    for (const [key, value] of Object.entries(payload.metadata)) {
      if (isSensitiveKey(key) || isSensitiveNotificationField(value)) {
        return deny("payload metadata contains a sensitive key or value");
      }
    }
  }
  return {
    allowed: true,
    state: "accepted",
    reason: "payload carries only non-sensitive notification metadata",
  };
}

/** Filter metadata down to non-sensitive entries, or `undefined` if none remain. */
function sanitizeMetadata(
  metadata: Readonly<Record<string, string>> | undefined,
): Record<string, string> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, string> = {};
  let kept = 0;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitiveNotificationField(value)) continue;
    out[key] = value;
    kept += 1;
  }
  return kept > 0 ? out : undefined;
}

/**
 * Return a NEW payload with sensitive content removed/replaced. Pure: the input is
 * never mutated. A sensitive `title` is replaced with a generic label; sensitive
 * `bodyPreview`/`targetRef`/`actorRef` are dropped; sensitive metadata entries are
 * filtered out. The result is safe for `canSendNotification` to accept.
 */
export function sanitizeNotificationPayload(
  payload: NotificationPayload,
): NotificationPayload {
  const title = isSensitiveNotificationField(payload.title)
    ? "Notification"
    : payload.title;
  const keepIfSafe = (value: string | undefined): string | undefined =>
    value !== undefined && !isSensitiveNotificationField(value) ? value : undefined;

  const bodyPreview = keepIfSafe(payload.bodyPreview);
  const targetRef = keepIfSafe(payload.targetRef);
  const actorRef = keepIfSafe(payload.actorRef);
  const metadata = sanitizeMetadata(payload.metadata);

  return {
    kind: payload.kind,
    channel: payload.channel,
    title,
    ...(bodyPreview !== undefined ? { bodyPreview } : {}),
    ...(targetRef !== undefined ? { targetRef } : {}),
    ...(actorRef !== undefined ? { actorRef } : {}),
    ...(payload.createdAt !== undefined ? { createdAt: payload.createdAt } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };
}
