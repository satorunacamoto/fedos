/**
 * Secure Runtime Alpha 4261-4340 — Phase F: Presentation Integration, real
 * acceptance test. `FedosDesktopNotificationsTrayStatusViewModel` reads live
 * state off a real `FedosDesktopNotificationCoordinator` +
 * `BackgroundLifecycleCoordinator` -- no Renderer/Boundary redesign.
 */
import { describe, it, expect } from "vitest";
import { FedosDesktopNotificationCoordinator } from "../src/desktop/notification/fedos_desktop_notification_coordinator.js";
import { NoopFedosDesktopNotificationPort } from "../src/desktop/notification/fedos_desktop_notification_port.js";
import { BackgroundLifecycleCoordinator } from "../src/desktop/background/fedos_desktop_background_lifecycle_coordinator.js";
import { FedosDesktopNotificationsTrayStatusViewModel } from "../src/desktop/presentation/fedos_desktop_notifications_tray_status_view_model.js";

describe("Alpha 4261-4340 -- Notifications/Tray Status ViewModel: status only, real coordinators", () => {
  it("reflects live background state and notification counters without mutating either coordinator", async () => {
    const notificationCoordinator = new FedosDesktopNotificationCoordinator(new NoopFedosDesktopNotificationPort());
    const backgroundLifecycle = new BackgroundLifecycleCoordinator({ keepAliveInBackground: true });
    const viewModel = new FedosDesktopNotificationsTrayStatusViewModel(notificationCoordinator, backgroundLifecycle);

    const initial = viewModel.status();
    expect(initial.backgroundState).toBe("background");
    expect(initial.openWindowCount).toBe(0);
    expect(initial.deliveredNotificationCount).toBe(0);
    expect(initial.lastNotificationOutcome).toBeNull();

    backgroundLifecycle.windowOpened();
    await notificationCoordinator.notify({ kind: "warning" });

    const after = viewModel.status();
    expect(after.backgroundState).toBe("foreground");
    expect(after.openWindowCount).toBe(1);
    expect(after.deniedNotificationCount).toBe(1); // Noop port -> "unavailable" -> counted as denied.
    expect(after.lastNotificationOutcome?.state).toBe("unavailable");

    // Reading status() again never mutates anything -- a pure snapshot.
    const again = viewModel.status();
    expect(again).toEqual(after);
  });
});
