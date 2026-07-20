/**
 * Secure Runtime Alpha 4421–4500 ("Desktop Device Sync Badge, Notification,
 * and Operational Event Wiring Arc") — Phase C/D/E: `FedosDeviceSyncEventBridge`
 * (`../../device/sync_events/fedos_device_sync_event_bridge.ts`) event
 * routing into the three ALREADY-REAL Desktop presentation Coordinators.
 *
 * `FedosDesktopDeviceSyncPresentationWiring` is orchestration ONLY -- it
 * owns no decision the target Coordinators do not already own themselves:
 *   - Notification content/template/policy: entirely
 *     `FedosDesktopNotificationCoordinator`'s own job
 *     (`../notification/fedos_desktop_notification_coordinator.ts`, Alpha
 *     4261-4340, UNMODIFIED) -- this file only picks WHICH of the three
 *     already-closed kinds (`"device-sync"`/`"sync-complete"`/
 *     `"sync-failed"`) a given `FedosDeviceSyncEvent` maps to, and supplies
 *     one short, non-sensitive `detail` string (a device id / coarse
 *     outcome code -- never Journal content).
 *   - Unread aggregation/state derivation: entirely
 *     `FedosDesktopBadgeCoordinator`'s own job
 *     (`../badge/fedos_desktop_badge_coordinator.ts`, Alpha 4341-4420,
 *     UNMODIFIED) -- this file calls ONLY its two real public control
 *     surfaces, `setSynchronizing(bool)` and `refresh()`.
 *   - Tray icon/menu ownership: entirely `FedosElectronTrayAdapter`'s own
 *     job at the Electron layer; this file touches only the ALREADY
 *     Electron-neutral `FedosDesktopTrayPort.setTooltip()`
 *     (`../tray/fedos_desktop_tray_port.ts`, Alpha 4261-4340, UNMODIFIED)
 *     — never a second `Tray`, never a menu item add/remove/rename.
 *
 * HONEST DEVIATION FROM THE ARC BRIEF'S OWN LITERAL WORDING (disclosed,
 * verified against actual current source per this Arc's own Phase A
 * instruction, not fabricated): the brief says "Wire setSynchronizing(),
 * setAttention(), setCount(), setNone()." Real, current
 * `FedosDesktopBadgeCoordinator` source
 * (`../badge/fedos_desktop_badge_coordinator.ts`) has NO
 * `setAttention()`/`setCount()`/`setNone()` public methods -- those are
 * pure VIEW-CONSTRUCTION functions in `../badge/fedos_desktop_badge_types.ts`
 * (`fedosDesktopBadgeAttention()`/`fedosDesktopBadgeCount()`/
 * `fedosDesktopBadgeNone()`), called ONLY from inside the Coordinator's own
 * `refresh()` based on its own real unread-count computation --
 * "attention"/"count"/"none" are DERIVED, never externally settable, by
 * that Coordinator's own explicit "never compute unread independently /
 * this boundary never infers ... on its own" design (see that file's own
 * header). Calling a nonexistent method would be fabrication; instead,
 * this file calls the TWO real public control surfaces that exist
 * (`setSynchronizing()` + `refresh()`) -- `refresh()` itself is what
 * naturally re-derives "attention"/"count"/"none" from the real,
 * already-current unread state every single time, so every Device Sync
 * event that should visibly change the badge still does, through the
 * Coordinator's own real, unmodified decision logic.
 *
 * TRAY STATUS (Phase D's own five-value "Synchronizing, Idle, Conflict,
 * Failure, Disconnected" list): `TrayCoordinator` itself
 * (`../tray/fedos_desktop_tray_coordinator.ts`) has no "set overall status"
 * action in its own closed six-action vocabulary -- it only dispatches
 * discrete actions and returns a `FedosDeviceSyncSchedulerStatusView`
 * snapshot for `"device-sync-status"`. The one REAL, Electron-neutral
 * surface for showing a short live status string on the tray icon that
 * DOES already exist is `FedosDesktopTrayPort.setTooltip(text)` -- this
 * file drives that (never constructing a second Tray, never touching
 * `TrayCoordinator`'s own six actions), reducing the SAME five values the
 * brief names into one short tooltip sentence.
 */

import type { FedosDesktopNotificationCoordinator } from "../notification/fedos_desktop_notification_coordinator.js";
import type { FedosDesktopBadgeCoordinator } from "../badge/fedos_desktop_badge_coordinator.js";
import type { FedosDesktopTrayPort } from "../tray/fedos_desktop_tray_port.js";
import type { FedosDeviceSyncEvent } from "../../device/sync_events/fedos_device_sync_event.js";

/** The Notification Coordinator surface this file actually calls -- never the whole class, mirrors every sibling Coordinator's own "narrowest dependency" discipline in this codebase (`FedosDesktopTrayRegistryView`, `FedosDesktopBadgeRegistryView`). */
export type FedosDeviceSyncNotificationSink = Pick<FedosDesktopNotificationCoordinator, "notify">;
/** The Badge Coordinator surface this file actually calls. */
export type FedosDeviceSyncBadgeSink = Pick<FedosDesktopBadgeCoordinator, "setSynchronizing" | "refresh">;
/** The Tray Port surface this file actually calls. */
export type FedosDeviceSyncTrayStatusSink = Pick<FedosDesktopTrayPort, "setTooltip">;

/** The CLOSED five-value tray status vocabulary this Arc's own Phase D brief names, verbatim. */
export type FedosDeviceSyncTrayStatus = "Synchronizing" | "Idle" | "Conflict" | "Failure" | "Disconnected";

const TRAY_TOOLTIP_PREFIX = "Device sync: ";

function trayTooltipFor(status: FedosDeviceSyncTrayStatus): string {
  return `${TRAY_TOOLTIP_PREFIX}${status}`;
}

/** Bounded to `FEDOS_DESKTOP_NOTIFICATION_MAX_DETAIL_LENGTH` (200) by construction -- every detail string built below is short (an id or a coarse outcome code), but this is restated as a hard clamp so a future, longer outcome code can never make `notify()` fail closed unexpectedly. */
function boundedDetail(value: string, maxLength = 200): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}

export interface FedosDesktopDeviceSyncPresentationWiringDeps {
  readonly notificationCoordinator: FedosDeviceSyncNotificationSink;
  readonly badgeCoordinator: FedosDeviceSyncBadgeSink;
  /** OPTIONAL -- omitted, this Arc's own Phase D tray status updates are simply skipped (never a fabricated tooltip write against a Port that does not exist). Mirrors every OTHER optional capability's own "remains optional" discipline in this codebase. */
  readonly trayStatusSink?: FedosDeviceSyncTrayStatusSink;
}

export class FedosDesktopDeviceSyncPresentationWiring {
  readonly #deps: FedosDesktopDeviceSyncPresentationWiringDeps;
  #trayStatus: FedosDeviceSyncTrayStatus = "Idle";
  #synchronizing = false;

  constructor(deps: FedosDesktopDeviceSyncPresentationWiringDeps) {
    this.#deps = deps;
  }

  /** The last tray status this wiring itself computed -- exposed so a caller/test can assert on it without reaching into the Port. */
  get currentTrayStatus(): FedosDeviceSyncTrayStatus {
    return this.#trayStatus;
  }

  /**
   * The ONE entry point -- a `FedosDeviceSyncEventListener`-shaped method,
   * so a caller wires it DIRECTLY as `new FedosDeviceSyncEventBridge({
   * listener: (event) => void wiring.handleEvent(event), ... })`. Never
   * throws -- every branch resolves; a Coordinator-level failure is left
   * to that Coordinator's own already-established "never throws past this
   * boundary" discipline (`FedosDesktopNotificationCoordinator.notify()`/
   * `FedosDesktopBadgeCoordinator.refresh()` both already guarantee this).
   */
  async handleEvent(event: FedosDeviceSyncEvent): Promise<void> {
    switch (event.kind) {
      case "sync-started":
        this.#synchronizing = true;
        this.#setTrayStatus("Synchronizing");
        this.#deps.badgeCoordinator.setSynchronizing(true);
        await this.#deps.badgeCoordinator.refresh();
        await this.#notify("device-sync", event.targetDeviceId);
        return;

      case "sync-progress":
        // No real per-attempt content to add beyond "still synchronizing" -- the tray tooltip and
        // badge synchronizing flag are already set by "sync-started"; never a second, redundant
        // notification per attempt (would spam one attempt-in-progress ping per schedule).
        return;

      case "sync-completed":
        this.#synchronizing = false;
        this.#setTrayStatus("Idle");
        this.#deps.badgeCoordinator.setSynchronizing(false);
        await this.#deps.badgeCoordinator.refresh();
        await this.#notify("sync-complete", event.targetDeviceId);
        return;

      case "sync-failed":
        this.#synchronizing = false;
        this.#setTrayStatus("Failure");
        this.#deps.badgeCoordinator.setSynchronizing(false);
        await this.#deps.badgeCoordinator.refresh();
        await this.#notify("sync-failed", boundedDetail(event.outcome));
        return;

      case "conflict-detected":
        this.#synchronizing = false;
        this.#setTrayStatus("Conflict");
        this.#deps.badgeCoordinator.setSynchronizing(false);
        await this.#deps.badgeCoordinator.refresh();
        // "conflict-detected" is not one of the Notification boundary's own three closed kinds
        // (`"device-sync"`/`"sync-complete"`/`"sync-failed"`) -- reuses `"device-sync"` (the generic
        // activity kind) with an explicit "conflict" detail, never inventing a fourth notification
        // kind (Phase C's own hard rule: "Reuse existing notification kinds -- do not invent new
        // ones").
        await this.#notify("device-sync", "conflict detected");
        return;

      case "retry-scheduled":
        // Still mid-sync (more attempts to come) -- tray stays "Synchronizing", badge stays
        // synchronizing=true (already set by "sync-started"); no notification per attempt (Phase C
        // names only sync-started/sync-completed/sync-failed/conflict-detected for Notification
        // wiring -- a retry is not yet a completion or a failure).
        this.#setTrayStatus("Synchronizing");
        return;

      case "retry-aborted":
        this.#synchronizing = false;
        this.#setTrayStatus("Failure");
        this.#deps.badgeCoordinator.setSynchronizing(false);
        await this.#deps.badgeCoordinator.refresh();
        // Retries exhausted (operator-required or abandonment) is a real failure a user should see --
        // reuses the existing "sync-failed" notification kind, never a new one.
        await this.#notify("sync-failed", boundedDetail(`retries aborted: ${event.outcome}`));
        return;

      case "device-offline":
        this.#setTrayStatus("Disconnected");
        return;

      case "device-online":
        this.#setTrayStatus(this.#synchronizing ? "Synchronizing" : "Idle");
        return;
    }
  }

  #setTrayStatus(status: FedosDeviceSyncTrayStatus): void {
    this.#trayStatus = status;
    this.#deps.trayStatusSink?.setTooltip(trayTooltipFor(status));
  }

  async #notify(kind: "device-sync" | "sync-complete" | "sync-failed", detail: string): Promise<void> {
    await this.#deps.notificationCoordinator.notify({ kind, detail: boundedDetail(detail) });
  }
}
