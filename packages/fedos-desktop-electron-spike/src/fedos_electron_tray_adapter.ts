/**
 * Secure Runtime Alpha 4261-4340 — Phase E: Electron Tray adapter.
 *
 * "Electron only hosts UI": this file renders a real `Tray` icon/menu and
 * forwards a clicked item's own closed `action` string back to its caller
 * -- it decides NOTHING (no Registry/DeviceSyncStatus call lives here; that
 * decision logic is `../../../src/desktop/tray/fedos_desktop_tray_coordinator.ts`,
 * Phase C, UNMODIFIED). Mirrors `FedosElectronNotificationAdapter`'s own
 * "local structural type, no root import" convention
 * (`./fedos_electron_notification_adapter.ts`).
 *
 * No new binary asset file: the tray icon is a tiny, embedded 1x1
 * transparent PNG (identical technique to `nativeImage.createFromBuffer`'s
 * own documented base64 usage) -- avoids adding an image asset this
 * isolated package would otherwise need its own copy-to-`dist` build step
 * for, matching this Arc's own "additive, minimal" scope.
 */

import { Tray, Menu, nativeImage, type MenuItemConstructorOptions } from "electron";

const TRANSPARENT_1X1_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

export interface FedosElectronTrayMenuItemLike {
  readonly action: string;
  readonly label: string;
  readonly enabled: boolean;
}

export class FedosElectronTrayAdapter {
  #tray: Tray | null = null;

  /** Creates the real Tray icon. Idempotent -- a second `create()` call while one already exists is a safe no-op (never a second, leaked icon). */
  create(tooltip: string): void {
    if (this.#tray !== null) return;
    const icon = nativeImage.createFromBuffer(Buffer.from(TRANSPARENT_1X1_PNG_BASE64, "base64"));
    this.#tray = new Tray(icon);
    this.#tray.setToolTip(tooltip);
  }

  /** Renders the FULL closed menu this call is given -- never a partial update, never an item this file itself invents. `onAction` is called with exactly the clicked item's own `action` string. */
  render(items: readonly FedosElectronTrayMenuItemLike[], onAction: (action: string) => void): void {
    if (this.#tray === null) return;
    const template: MenuItemConstructorOptions[] = items.map((item) => ({
      label: item.label,
      enabled: item.enabled,
      click: () => onAction(item.action),
    }));
    this.#tray.setContextMenu(Menu.buildFromTemplate(template));
  }

  setTooltip(text: string): void {
    this.#tray?.setToolTip(text);
  }

  /** Tears down the tray icon (Phase G "resource cleanup"). Idempotent -- a second `destroy()` is a safe no-op, never a throw. */
  destroy(): void {
    this.#tray?.destroy();
    this.#tray = null;
  }
}
