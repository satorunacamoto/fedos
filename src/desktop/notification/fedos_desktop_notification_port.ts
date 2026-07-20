/**
 * Secure Runtime Alpha 4261-4340 — Phase B: Desktop Notification Boundary.
 *
 * `FedosDesktopNotificationPort` is a narrow, FRAMEWORK-NEUTRAL contract for
 * actually SHOWING one already-built `FedosDesktopNotificationView` — names
 * nothing Electron-specific (no `Notification`, no `BrowserWindow`), so a
 * concrete adapter (Electron's `Notification` API, or anything else) can
 * implement this exact interface, mirroring `FedosDesktopHostPort`'s own
 * "framework-neutral port + concrete adapter" split
 * (`../host_boundary/fedos_desktop_host_port.ts`).
 *
 * `NoopFedosDesktopNotificationPort` is this boundary's own permanently
 * `"unavailable"` default (mirrors `../../notification/bridge.ts`'s own
 * `NoopNotificationBridge` — same idea, independently implemented here per
 * this file's own "RELATIONSHIP" note, `./fedos_desktop_notification_types.ts`) —
 * it advertises nothing and denies every attempt; constructing it does
 * nothing and it never throws.
 */

import type { FedosDesktopNotificationView } from "./fedos_desktop_notification_types.js";

export type FedosDesktopNotificationPortStatus = "available" | "unavailable";

export interface FedosDesktopNotificationDeliveryResult {
  readonly delivered: boolean;
  /** Non-sensitive explanation. Never echoes notification content. */
  readonly reason: string;
}

export interface FedosDesktopNotificationPort {
  /** Current coarse status (pure read, never throws). */
  status(): FedosDesktopNotificationPortStatus;
  /** Attempts to show one already-built, already-validated notification. Never throws — resolves to a result even on failure. */
  notify(view: FedosDesktopNotificationView): Promise<FedosDesktopNotificationDeliveryResult>;
}

export class NoopFedosDesktopNotificationPort implements FedosDesktopNotificationPort {
  status(): FedosDesktopNotificationPortStatus {
    return "unavailable";
  }

  async notify(_view: FedosDesktopNotificationView): Promise<FedosDesktopNotificationDeliveryResult> {
    return { delivered: false, reason: "no notification backend is configured (nothing shown)" };
  }
}
