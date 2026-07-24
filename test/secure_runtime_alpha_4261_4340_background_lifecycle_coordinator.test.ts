/**
 * Secure Runtime Alpha 4261-4340 — Phase D: Background Operation, real
 * unit tests. `BackgroundLifecycleCoordinator` is a pure state machine (no
 * I/O, no Runtime dependency) -- these tests exercise the REAL class
 * directly, no mock needed.
 */
import { describe, it, expect } from "vitest";
import { BackgroundLifecycleCoordinator } from "../src/desktop/background/fedos_desktop_background_lifecycle_coordinator.js";

describe("Alpha 4261-4340 -- Background Lifecycle Coordinator: window close keeps runtime alive", () => {
  it("closing the last open window with keepAliveInBackground=true transitions to 'background', never 'shutting-down'", () => {
    const coordinator = new BackgroundLifecycleCoordinator({ keepAliveInBackground: true });
    expect(coordinator.windowOpened()).toBe("foreground");
    expect(coordinator.openWindowCount).toBe(1);
    expect(coordinator.windowClosed()).toBe("background");
    expect(coordinator.openWindowCount).toBe(0);
    // Background sync/notifications remain available while backgrounded -- the whole point of "keep runtime alive".
    expect(coordinator.canRunBackgroundSync()).toBe(true);
    expect(coordinator.canDeliverBackgroundNotifications()).toBe(true);
  });

  it("closing the last open window with keepAliveInBackground=false transitions to 'shutting-down'", () => {
    const coordinator = new BackgroundLifecycleCoordinator({ keepAliveInBackground: false });
    coordinator.windowOpened();
    expect(coordinator.windowClosed()).toBe("shutting-down");
    expect(coordinator.canRunBackgroundSync()).toBe(false);
    expect(coordinator.canDeliverBackgroundNotifications()).toBe(false);
  });

  it("closing one of several open windows stays 'foreground' -- only the LAST window closing backgrounds/shuts down", () => {
    const coordinator = new BackgroundLifecycleCoordinator({ keepAliveInBackground: true });
    coordinator.windowOpened();
    coordinator.windowOpened();
    expect(coordinator.openWindowCount).toBe(2);
    expect(coordinator.windowClosed()).toBe("foreground");
    expect(coordinator.openWindowCount).toBe(1);
  });

  it("windowClosed() never underflows the open window count below zero", () => {
    const coordinator = new BackgroundLifecycleCoordinator({ keepAliveInBackground: true });
    coordinator.windowClosed();
    coordinator.windowClosed();
    expect(coordinator.openWindowCount).toBe(0);
    expect(coordinator.state).toBe("background");
  });
});

describe("Alpha 4261-4340 -- Background Lifecycle Coordinator: background sync / background notifications", () => {
  it("background sync and background notification capability flags stay true across foreground <-> background transitions", () => {
    const coordinator = new BackgroundLifecycleCoordinator({ keepAliveInBackground: true });
    expect(coordinator.canRunBackgroundSync()).toBe(true); // even before any window ever opens ("background" resting state).
    coordinator.windowOpened();
    expect(coordinator.canRunBackgroundSync()).toBe(true);
    coordinator.windowClosed();
    expect(coordinator.canRunBackgroundSync()).toBe(true);
    expect(coordinator.canDeliverBackgroundNotifications()).toBe(true);
  });

  it("both capability flags go false once shutdown begins, and stay false after confirmShutdown", () => {
    const coordinator = new BackgroundLifecycleCoordinator({ keepAliveInBackground: true });
    coordinator.windowOpened();
    coordinator.requestShutdown();
    expect(coordinator.canRunBackgroundSync()).toBe(false);
    expect(coordinator.canDeliverBackgroundNotifications()).toBe(false);
    coordinator.confirmShutdown();
    expect(coordinator.canRunBackgroundSync()).toBe(false);
    expect(coordinator.canDeliverBackgroundNotifications()).toBe(false);
  });
});

describe("Alpha 4261-4340 -- Background Lifecycle Coordinator: restart", () => {
  it("a new window opening after backgrounding returns the coordinator to 'foreground' (restart from tray)", () => {
    const coordinator = new BackgroundLifecycleCoordinator({ keepAliveInBackground: true });
    coordinator.windowOpened();
    coordinator.windowClosed();
    expect(coordinator.state).toBe("background");
    expect(coordinator.windowOpened()).toBe("foreground");
    expect(coordinator.openWindowCount).toBe(1);
  });
});

describe("Alpha 4261-4340 -- Background Lifecycle Coordinator: clean shutdown", () => {
  it("requestShutdown() then confirmShutdown() reaches a terminal 'stopped' state", () => {
    const coordinator = new BackgroundLifecycleCoordinator({ keepAliveInBackground: true });
    coordinator.windowOpened();
    expect(coordinator.requestShutdown()).toBe("shutting-down");
    expect(coordinator.confirmShutdown()).toBe("stopped");
    expect(coordinator.state).toBe("stopped");
  });

  it("requestShutdown() is a one-way door -- a late windowOpened()/windowClosed() never resurrects 'foreground'/'background'", () => {
    const coordinator = new BackgroundLifecycleCoordinator({ keepAliveInBackground: true });
    coordinator.requestShutdown();
    expect(coordinator.windowOpened()).toBe("shutting-down");
    expect(coordinator.windowClosed()).toBe("shutting-down");
  });

  it("confirmShutdown() is idempotent and terminal -- resource cleanup never re-enters a live state", () => {
    const coordinator = new BackgroundLifecycleCoordinator({ keepAliveInBackground: true });
    coordinator.requestShutdown();
    coordinator.confirmShutdown();
    expect(coordinator.confirmShutdown()).toBe("stopped");
    expect(coordinator.windowOpened()).toBe("stopped");
    expect(coordinator.state).toBe("stopped");
  });
});

describe("Alpha 4261-4340 -- Background Lifecycle Coordinator: single runtime ownership (structural)", () => {
  it("two independent coordinator instances never share state -- each governs exactly its own process's own window count", () => {
    const first = new BackgroundLifecycleCoordinator({ keepAliveInBackground: true });
    const second = new BackgroundLifecycleCoordinator({ keepAliveInBackground: false });
    first.windowOpened();
    first.windowOpened();
    second.windowOpened();
    expect(first.openWindowCount).toBe(2);
    expect(second.openWindowCount).toBe(1);
    second.windowClosed();
    expect(second.state).toBe("shutting-down");
    expect(first.state).toBe("foreground");
  });
});
