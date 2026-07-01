/**
 * Stage 39 — Notification Bridge boundary (types only).
 *
 * A MINIMAL, future-facing seam for delivering "something happened" signals to an
 * external notification channel (Telegram / LINE / APNs / FCM / Email) WITHOUT
 * carrying any secret. It belongs to the FedOS Vault / Crypto / Identity /
 * messaging layer. This file defines shapes ONLY — it sends nothing, calls no Bot
 * API / APNs / FCM / LINE / Email service, issues no `fetch`, and holds no key,
 * token, or DM body. It exists so a real notification transport can drop in later
 * behind the same interface without the current Nostr/Cloudflare core, the chat
 * layer, the commerce layer, or any secret depending on it.
 *
 * HARD GUARDRAILS:
 *   - A `NotificationPayload` carries only COARSE, non-sensitive metadata: a kind,
 *     a channel, a generic title, an optional GENERIC `bodyPreview` (e.g. "New chat
 *     activity"), opaque refs, a timestamp, and non-secret metadata. It NEVER
 *     carries DM/message content, a secret, key, seed, token, payment secret,
 *     entitlement, or credential.
 *   - `bodyPreview` is a GENERIC label, NOT the real message/DM body. The real
 *     content of a chat message, space post, or product/payment is never placed in
 *     a notification.
 *   - Push transports (APNs/FCM) can leak `metadata` to third parties — keep it
 *     free of anything sensitive; the policy denies/sanitizes such payloads.
 *   - This boundary makes NO delivery, security, or privacy guarantee. Do not
 *     describe it as "safe", "delivered", or "encrypted".
 */

/**
 * FUTURE external channels — all PLACEHOLDERS in this stage. A name is a label of
 * intent, NOT a working, wired, or safe transport. None is contacted here.
 */
export type NotificationChannel =
  | "telegram_placeholder" // future Telegram Bot API bridge (no API called)
  | "line_placeholder" // future LINE Messaging API bridge (no API called)
  | "apns_placeholder" // future Apple Push Notification service (no API called)
  | "fcm_placeholder" // future Firebase Cloud Messaging (no API called)
  | "email_placeholder" // future email transport (no mail sent)
  | "local_placeholder"; // future in-app/local notification (nothing dispatched)

/** What kind of activity a notification refers to. Coarse categories only. */
export type NotificationKind =
  | "chat_activity" // a chat received activity — NEVER the message body
  | "space_activity" // a space received activity — NEVER the post content
  | "product_update" // a product changed — NEVER payment/download secrets
  | "moderation_notice" // a moderation action occurred
  | "payment_status_placeholder" // a payment status changed — NEVER payment secrets
  | "system_notice"; // a generic system message

/**
 * FUTURE capabilities a bridge MIGHT advertise — all PLACEHOLDERS, one per channel
 * it could route to. Presence is a label of intent, not a working transport.
 */
export type NotificationCapability =
  | "telegram_placeholder"
  | "line_placeholder"
  | "apns_placeholder"
  | "fcm_placeholder"
  | "email_placeholder"
  | "local_placeholder";

/**
 * Coarse outcome/state of a notification attempt or the bridge itself. No content
 * is exposed at any state.
 */
export type NotificationState =
  | "ready" // a bridge is present and ready (placeholder) — nothing has been sent
  | "accepted" // PLACEHOLDER: accepted into a no-op queue — NOTHING is sent externally
  | "rejected" // policy denied the payload (e.g. it looked sensitive)
  | "unavailable" // no bridge backend is present (the no-op default)
  | "error"; // an attempt could not be served; recorded as state, never thrown

/**
 * A non-sensitive notification. It says WHAT happened and WHERE (by opaque ref),
 * never the real content. `bodyPreview`, when present, is a GENERIC label like
 * "New chat activity" — never a DM/message/payment body. `targetRef`/`actorRef`
 * are opaque ids (e.g. a chat/space/product id or a public pubkey), never secrets.
 * `metadata` is non-secret key/value display data only.
 */
export interface NotificationPayload {
  readonly kind: NotificationKind;
  readonly channel: NotificationChannel;
  /** Short, non-sensitive title (a generic label, not real content). */
  readonly title: string;
  /** OPTIONAL generic preview label — NEVER the real message/DM/payment body. */
  readonly bodyPreview?: string;
  /** Opaque target id (chat/space/product id). Not a secret. */
  readonly targetRef?: string;
  /** Opaque actor id (e.g. a public pubkey). Not a secret. */
  readonly actorRef?: string;
  /** Unix timestamp (seconds) of the underlying activity. */
  readonly createdAt?: number;
  /** Non-secret display metadata. Must contain no secret/key/token/payment data. */
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * The result of a notification attempt / status read. Failures and policy denials
 * are reported here (with a non-sensitive reason) rather than thrown.
 */
export interface NotificationDecision {
  readonly allowed: boolean;
  /** The bridge/attempt state AFTER this decision. */
  readonly state: NotificationState;
  /** Non-sensitive explanation. Never echoes secret content. */
  readonly reason: string;
}

/**
 * The notification seam. Implementations MUST NOT send anything, call a Bot API /
 * APNs / FCM / LINE / Email service, or issue a `fetch`. `notify` never throws —
 * it resolves to a `NotificationDecision` (including `rejected`/`error`). An
 * `accepted` decision is a PLACEHOLDER and delivers nothing. Constructing an
 * implementation does nothing.
 */
export interface NotificationBridge {
  /** Current coarse status (pure read). */
  getStatus(): NotificationDecision;
  /** The PLACEHOLDER capabilities this bridge advertises (may be empty). */
  getCapabilities(): readonly NotificationCapability[];
  /**
   * Ask to notify. Sends NOTHING externally in this stage. Evaluates the payload
   * against the safe-notification policy and returns a decision; never throws and
   * never mutates the payload.
   */
  notify(payload: NotificationPayload): Promise<NotificationDecision>;
}

/** Every placeholder channel/capability name (for mapping/documentation helpers). */
export const NOTIFICATION_CHANNELS: readonly NotificationChannel[] = [
  "telegram_placeholder",
  "line_placeholder",
  "apns_placeholder",
  "fcm_placeholder",
  "email_placeholder",
  "local_placeholder",
];
