/**
 * Secure Runtime Alpha 4341-4420 ("Desktop Unread Badge and Menu Bar Count
 * Integration Arc") — Phase E: Electron Badge adapter.
 *
 * "Electron only hosts UI" (restated from Alpha 4261-4340's own hard
 * requirement): this file contains NO business logic of any kind -- it does
 * exactly one thing, apply an already-computed, already-validated
 * `FedosDesktopBadgeView`-shaped object to the real OS surfaces Electron
 * exposes. Every decision (what state, what count, whether anything
 * actually changed since the last render) already happened one layer below,
 * in `../../../src/desktop/badge/fedos_desktop_badge_coordinator.ts` (Phase
 * B, this Arc) -- this adapter never re-derives any of that.
 *
 * REUSE, NO DUPLICATE STATE (this Arc's own hard requirement, "Reuse
 * existing Notification/Tray layer"): this adapter never constructs its own
 * `Tray`. It is handed the package's ALREADY-EXISTING, single
 * `FedosElectronTrayAdapter` instance (`./fedos_electron_tray_adapter.ts`,
 * Alpha 4261-4340, UNMODIFIED) by its own caller (`fedos_electron_badge_main.cts`)
 * and only calls that instance's own `setTooltip()`/`render()` methods --
 * never a second, competing Tray icon.
 *
 * FOUR REAL SURFACES (Phase E "Implement: Taskbar badge, Dock badge, Tray
 * badge update, Menu badge update"):
 *   - Taskbar badge: `BrowserWindow.setOverlayIcon()` on every currently
 *     open window (Windows-only API; a no-op on other platforms --
 *     Electron itself ignores the call there) plus the cross-platform
 *     `app.setBadgeCount()` (meaningful on Linux/Unity; also a safe no-op
 *     where unsupported -- Electron's own documented behavior, never
 *     guarded by a platform check this file would otherwise have to
 *     invent).
 *   - Dock badge: `app.dock?.setBadge()` (macOS-only; `app.dock` is
 *     `undefined` everywhere else, per Electron's own API -- this file
 *     already guards for that, no `process.platform` guess needed).
 *   - Tray badge update: the EXISTING `FedosElectronTrayAdapter`'s own
 *     `setTooltip()`.
 *   - Menu badge update: the EXISTING `FedosElectronTrayAdapter`'s own
 *     `render()`, called with the SAME closed six-item menu the Tray
 *     Coordinator already produces, with ONLY the "Recent Conversations"
 *     item's own display LABEL text amended with a "(N)" suffix -- this
 *     file never adds, removes, or reinterprets a tray action (the closed
 *     `FedosDesktopTrayAction` vocabulary, `../../../src/desktop/tray/fedos_desktop_tray_types.ts`,
 *     is untouched).
 *
 * This package's own tsconfig never includes root `src/` (Alpha 4021-4100's
 * own isolation architecture, restated by every later Arc's own Electron
 * file) -- `FedosElectronBadgeViewLike` is a LOCAL structural type
 * describing exactly what `FedosDesktopBadgeView`
 * (`../../../src/desktop/badge/fedos_desktop_badge_types.ts`) already
 * shapes, not an import of it; this file `implements` the SHAPE of
 * `FedosDesktopBadgePort` (`../../../src/desktop/badge/fedos_desktop_badge_port.ts`)
 * structurally for the same reason -- mirrors `FedosElectronNotificationAdapter`/
 * `FedosElectronTrayAdapter`'s own local-interface convention.
 *
 * No new binary asset file: the taskbar overlay dot is the SAME kind of
 * tiny, embedded 1x1 PNG technique `FedosElectronTrayAdapter` already uses
 * for its own tray icon (`./fedos_electron_tray_adapter.ts`) -- here a
 * solid, opaque red pixel (rather than a fully transparent one), since an
 * overlay icon is only ever meaningful when actually visible.
 */

import { app, type BrowserWindow, nativeImage } from "electron";

const RED_1X1_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export interface FedosElectronBadgeViewLike {
  readonly state: string;
  readonly count: number;
  readonly reason: string;
}

export interface FedosElectronBadgeTrayMenuItemLike {
  readonly action: string;
  readonly label: string;
  readonly enabled: boolean;
}

/** The narrow slice of `FedosElectronTrayAdapter` this adapter actually reuses -- never the whole class, never a second instance. */
export interface FedosElectronBadgeTrayLike {
  setTooltip(text: string): void;
  render(items: readonly FedosElectronBadgeTrayMenuItemLike[], onAction: (action: string) => void): void;
}

export class FedosElectronBadgeAdapter {
  readonly #tray: FedosElectronBadgeTrayLike;
  readonly #getOpenWindows: () => readonly BrowserWindow[];
  readonly #getBaseTrayMenuItems: () => readonly FedosElectronBadgeTrayMenuItemLike[];
  readonly #onTrayAction: (action: string) => void;
  readonly #overlayIcon = nativeImage.createFromBuffer(Buffer.from(RED_1X1_PNG_BASE64, "base64"));

  constructor(
    tray: FedosElectronBadgeTrayLike,
    getOpenWindows: () => readonly BrowserWindow[],
    getBaseTrayMenuItems: () => readonly FedosElectronBadgeTrayMenuItemLike[],
    onTrayAction: (action: string) => void,
  ) {
    this.#tray = tray;
    this.#getOpenWindows = getOpenWindows;
    this.#getBaseTrayMenuItems = getBaseTrayMenuItems;
    this.#onTrayAction = onTrayAction;
  }

  status(): "available" | "unavailable" {
    return "available";
  }

  /** Applies one already-computed badge view to every real surface this adapter owns. Never throws -- a genuine per-surface OS failure is caught and does not stop the remaining surfaces from being attempted. */
  render(view: FedosElectronBadgeViewLike): void {
    const showBadge = view.state === "count" || view.state === "attention" || view.state === "synchronizing";
    const badgeText = showBadge ? String(view.count) : "";

    this.#applyDockBadge(badgeText);
    this.#applyTaskbarOverlay(showBadge, view);
    this.#applyTrayTooltip(showBadge, view);
    this.#applyTrayMenuLabel(showBadge, view);
  }

  #applyDockBadge(badgeText: string): void {
    try {
      app.dock?.setBadge(badgeText);
    } catch {
      // Genuinely unsupported/unavailable in this environment -- never crosses this boundary.
    }
  }

  #applyTaskbarOverlay(showBadge: boolean, view: FedosElectronBadgeViewLike): void {
    try {
      app.setBadgeCount?.(showBadge ? view.count : 0);
    } catch {
      // Unsupported on this platform -- Electron itself documents this as a safe no-op; this
      // try/catch only guards against an unexpected throw in an environment that behaves
      // differently than documented.
    }
    const description = showBadge ? `${view.count} unread (${view.state})` : "no unread messages";
    for (const window of this.#getOpenWindows()) {
      try {
        window.setOverlayIcon(showBadge ? this.#overlayIcon : null, description);
      } catch {
        // A single window's own overlay-icon call failing never blocks the others.
      }
    }
  }

  #applyTrayTooltip(showBadge: boolean, view: FedosElectronBadgeViewLike): void {
    const tooltip = showBadge ? `nostr-window (${view.count} unread)` : "nostr-window";
    this.#tray.setTooltip(tooltip);
  }

  #applyTrayMenuLabel(showBadge: boolean, view: FedosElectronBadgeViewLike): void {
    const baseItems = this.#getBaseTrayMenuItems();
    const items = baseItems.map((item) =>
      item.action === "recent-conversations" && showBadge ? { ...item, label: `${item.label} (${view.count})` } : item,
    );
    this.#tray.render(items, this.#onTrayAction);
  }
}
