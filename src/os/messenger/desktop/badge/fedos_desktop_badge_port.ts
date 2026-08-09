/**
 * Secure Runtime Alpha 4341-4420 — Phase B: Desktop Badge Boundary.
 *
 * `FedosDesktopBadgePort` is a narrow, FRAMEWORK-NEUTRAL contract for
 * actually SHOWING one already-computed `FedosDesktopBadgeView` on whatever
 * real OS surfaces a Desktop Host owns (taskbar overlay icon, Dock badge,
 * the existing Tray icon's tooltip, the existing Tray menu's own item
 * labels) — names nothing Electron-specific (no `BrowserWindow`, no `Tray`,
 * no `app`), mirroring `FedosDesktopNotificationPort`/`FedosDesktopTrayPort`'s
 * own identical split (`../notification/fedos_desktop_notification_port.ts`,
 * `../tray/fedos_desktop_tray_port.ts`): this Port only ever RENDERS
 * output; it decides nothing itself (every decision -- what state, what
 * count, whether anything actually changed since the last render -- is
 * `./fedos_desktop_badge_coordinator.ts`'s own job, entirely separate from
 * this Port, so it can be unit-tested with zero Electron/OS dependency).
 *
 * `NoopFedosDesktopBadgePort` is this boundary's own permanently inert
 * default -- shows nothing, never throws.
 */

import type { FedosDesktopBadgeView } from "./fedos_desktop_badge_types.js";

export type FedosDesktopBadgePortStatus = "available" | "unavailable";

export interface FedosDesktopBadgePort {
  /** Current coarse status (pure read, never throws). */
  status(): FedosDesktopBadgePortStatus;
  /** Applies one already-computed badge view to whatever real OS surfaces this Port owns. Never throws -- a genuine backend failure is swallowed, mirroring every sibling Port's own discipline. */
  render(view: FedosDesktopBadgeView): void;
}

export class NoopFedosDesktopBadgePort implements FedosDesktopBadgePort {
  status(): FedosDesktopBadgePortStatus {
    return "unavailable";
  }

  render(_view: FedosDesktopBadgeView): void {
    // No real badge backend -- shows nothing.
  }
}
