/**
 * Stage 39 — Notification bridge implementations.
 *
 * Two safe defaults for the `NotificationBridge` seam. NEITHER sends anything,
 * calls a Bot API / APNs / FCM / LINE / Email service, or issues a `fetch`. Every
 * method is total and never throws.
 *
 *   - `NoopNotificationBridge` is the permanently `unavailable` default: it
 *     advertises nothing and denies every attempt.
 *   - `PlaceholderNotificationBridge` (dev/test) evaluates the safe-notification
 *     policy and returns the resulting decision (`accepted`/`rejected`) — but it
 *     still delivers NOTHING externally. `accepted` is a placeholder queue label.
 *
 * These exist so callers can depend on the seam without a real transport, exactly
 * as the app depends on mock/no-op defaults elsewhere. NEITHER is wired into the
 * runtime or Worker.
 */

import { canSendNotification } from "./policy.js";
import type {
  NotificationBridge,
  NotificationCapability,
  NotificationDecision,
  NotificationPayload,
} from "./types.js";

export class NoopNotificationBridge implements NotificationBridge {
  constructor() {
    // Does nothing: no transport opened, no channel contacted.
  }

  getStatus(): NotificationDecision {
    return {
      allowed: false,
      state: "unavailable",
      reason: "no notification bridge backend is configured",
    };
  }

  getCapabilities(): readonly NotificationCapability[] {
    // No backend present -> advertises nothing.
    return [];
  }

  async notify(_payload: NotificationPayload): Promise<NotificationDecision> {
    // Reads nothing from the payload; sends nothing; contacts no channel.
    return {
      allowed: false,
      state: "unavailable",
      reason: "no notification bridge backend is configured (nothing sent)",
    };
  }
}

/**
 * A dev/test bridge that models the decision flow WITHOUT sending. `notify`
 * evaluates `canSendNotification` and returns its decision — it opens no
 * transport, calls no API, and issues no `fetch`. An `accepted` result means the
 * payload is policy-clean, NOT that anything was delivered.
 */
export class PlaceholderNotificationBridge implements NotificationBridge {
  constructor() {
    // Does nothing: no transport is contacted.
  }

  getStatus(): NotificationDecision {
    return {
      allowed: true,
      state: "ready",
      reason: "placeholder bridge is ready (nothing is sent externally)",
    };
  }

  getCapabilities(): readonly NotificationCapability[] {
    // Advertises the placeholder channels it WOULD route to — none is contacted.
    return [
      "telegram_placeholder",
      "line_placeholder",
      "apns_placeholder",
      "fcm_placeholder",
      "email_placeholder",
      "local_placeholder",
    ];
  }

  async notify(payload: NotificationPayload): Promise<NotificationDecision> {
    // Policy decision only — never mutates the payload and never sends.
    return canSendNotification(payload);
  }
}
