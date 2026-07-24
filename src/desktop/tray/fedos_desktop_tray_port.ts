/**
 * Secure Runtime Alpha 4261-4340 — Phase C: System Tray Boundary.
 *
 * `FedosDesktopTrayPort` is a narrow, FRAMEWORK-NEUTRAL contract for
 * actually SHOWING a tray icon and its menu — names nothing Electron-
 * specific (no `Tray`, no `Menu`, no `nativeImage`), mirroring
 * `FedosDesktopNotificationPort`'s own split (`../notification/fedos_desktop_notification_port.ts`):
 * this Port only ever RENDERS output and forwards a raw clicked action
 * string back to its caller; it decides nothing itself (decision logic
 * lives in `./fedos_desktop_tray_coordinator.ts`, entirely separate from
 * this Port, so it can be unit-tested with zero tray/menu dependency).
 *
 * `NoopFedosDesktopTrayPort` is this boundary's own permanently inert
 * default — shows nothing, forwards nothing, never throws.
 */

import type { FedosDesktopTrayMenuItemView } from "./fedos_desktop_tray_types.js";

export interface FedosDesktopTrayPort {
  /** Renders the FULL closed menu (`fedosDesktopTrayMenuItems()`'s own output) -- never a partial update, never a caller-invented item. */
  render(items: readonly FedosDesktopTrayMenuItemView[]): void;
  /** Sets the tray icon's tooltip text -- display only, no business meaning. */
  setTooltip(text: string): void;
  /** Tears down the tray icon (Phase G "resource cleanup"). Idempotent -- a second `destroy()` is a safe no-op. */
  destroy(): void;
}

export class NoopFedosDesktopTrayPort implements FedosDesktopTrayPort {
  render(_items: readonly FedosDesktopTrayMenuItemView[]): void {
    // No real tray backend -- shows nothing.
  }

  setTooltip(_text: string): void {
    // No real tray backend -- nothing to label.
  }

  destroy(): void {
    // No real tray backend -- nothing to tear down.
  }
}
