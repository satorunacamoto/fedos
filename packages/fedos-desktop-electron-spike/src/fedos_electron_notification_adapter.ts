/**
 * Secure Runtime Alpha 4261-4340 ("Desktop Notifications, System Tray, and
 * Background Operation Arc") — Phase E: Electron Notification adapter.
 *
 * "Electron only hosts UI" (this Arc's own hard requirement): this file
 * contains NO business logic of any kind -- it does exactly one thing, show
 * an already-built, already-validated notification view via Electron's own
 * real `Notification` API. Every decision (what kind is valid, what the
 * fixed title/body template is, whether a `detail` field looked sensitive)
 * already happened one layer below, in
 * `../../../src/desktop/notification/fedos_desktop_notification_coordinator.ts`
 * (Phase B, UNMODIFIED) -- this adapter never re-derives any of that.
 *
 * This package's own tsconfig never includes root `src/` (Alpha 4021-4100's
 * own isolation architecture, restated by every later Arc's own Electron
 * file) -- `FedosElectronNotificationEventLike` is a LOCAL structural type
 * describing exactly what `FedosDesktopNotificationView`
 * (`../../../src/desktop/notification/fedos_desktop_notification_types.ts`)
 * already shapes, not an import of it; this file `implements` the SHAPE of
 * `FedosDesktopNotificationPort` (`../../../src/desktop/notification/fedos_desktop_notification_port.ts`)
 * structurally for the same reason -- mirrors `NavigationRegistry`/
 * `NavigationWindowController`'s own local-interface convention in
 * `fedos_electron_navigation_main.cts`.
 */

import { Notification } from "electron";

export interface FedosElectronNotificationEventLike {
  readonly kind: string;
  readonly title: string;
  readonly body: string;
}

export interface FedosElectronNotificationDeliveryResultLike {
  readonly delivered: boolean;
  readonly reason: string;
}

export class FedosElectronNotificationAdapter {
  status(): "available" | "unavailable" {
    return Notification.isSupported() ? "available" : "unavailable";
  }

  /** Shows one OS-level toast notification. Never throws -- a genuine Electron/OS failure is caught and reported as a closed, non-`delivered` result. */
  async notify(event: FedosElectronNotificationEventLike): Promise<FedosElectronNotificationDeliveryResultLike> {
    if (!Notification.isSupported()) {
      return { delivered: false, reason: "OS notifications are not supported in this environment" };
    }
    try {
      const notification = new Notification({ title: event.title, body: event.body, silent: false });
      notification.show();
      return { delivered: true, reason: "shown" };
    } catch {
      return { delivered: false, reason: "the OS notification backend failed unexpectedly" };
    }
  }
}
