/**
 * Secure Runtime Alpha 4261-4340 — Phase F: Presentation Integration.
 *
 * `FedosDesktopNotificationsTrayStatusViewModel` exposes STATUS ONLY — the
 * current `FedosDesktopNotificationCoordinator`/`TrayCoordinator`/
 * `BackgroundLifecycleCoordinator` state, read-only, for a future UI to
 * display. No Renderer redesign: this is a new, minimal, ADDITIVE
 * ViewModel, not a change to any existing renderer/ViewModel file.
 *
 * DELIBERATELY NOT added to `FedosDesktopConversationUiPresentationBoundary`
 * (`./fedos_desktop_conversation_ui_presentation_boundary.ts`, frozen,
 * UNTOUCHED by this Arc): every existing ViewModel that class constructs is
 * a thin wrapper over `FedosDesktopApplicationShell` — this ViewModel wraps
 * three NEW coordinators that have no Shell method of their own (they are
 * new architecture, not Shell-backed), so it is constructed the SAME way
 * `FedosDesktopConversationWindowRegistry` (Alpha 4181-4260) already is:
 * a standalone class taking its dependencies as constructor arguments,
 * owned by whichever caller (the Electron adapter, Phase E) constructs the
 * coordinators in the first place — never a second, competing Boundary.
 *
 * No I/O, no mutation of any coordinator's own state -- purely reads.
 */

import type { FedosDesktopNotificationCoordinator, FedosDesktopNotificationOutcome } from "../../notifications/fedos_desktop_notification_coordinator.js";
import type { BackgroundLifecycleCoordinator, FedosDesktopBackgroundLifecycleState } from "../background/fedos_desktop_background_lifecycle_coordinator.js";

export interface FedosDesktopNotificationsTrayStatusView {
  readonly backgroundState: FedosDesktopBackgroundLifecycleState;
  readonly openWindowCount: number;
  readonly canRunBackgroundSync: boolean;
  readonly canDeliverBackgroundNotifications: boolean;
  readonly lastNotificationOutcome: FedosDesktopNotificationOutcome | null;
  readonly deliveredNotificationCount: number;
  readonly deniedNotificationCount: number;
}

export class FedosDesktopNotificationsTrayStatusViewModel {
  readonly #notificationCoordinator: FedosDesktopNotificationCoordinator;
  readonly #backgroundLifecycle: BackgroundLifecycleCoordinator;

  constructor(notificationCoordinator: FedosDesktopNotificationCoordinator, backgroundLifecycle: BackgroundLifecycleCoordinator) {
    this.#notificationCoordinator = notificationCoordinator;
    this.#backgroundLifecycle = backgroundLifecycle;
  }

  /** A fresh, immutable snapshot -- always synchronous (every underlying coordinator's own status read is synchronous), no `"loading"` state needed. */
  status(): FedosDesktopNotificationsTrayStatusView {
    return Object.freeze({
      backgroundState: this.#backgroundLifecycle.state,
      openWindowCount: this.#backgroundLifecycle.openWindowCount,
      canRunBackgroundSync: this.#backgroundLifecycle.canRunBackgroundSync(),
      canDeliverBackgroundNotifications: this.#backgroundLifecycle.canDeliverBackgroundNotifications(),
      lastNotificationOutcome: this.#notificationCoordinator.lastOutcome,
      deliveredNotificationCount: this.#notificationCoordinator.deliveredCount,
      deniedNotificationCount: this.#notificationCoordinator.deniedCount,
    });
  }
}
