/**
 * Secure Runtime Alpha 4261-4340 ("Desktop Notifications, System Tray, and
 * Background Operation Arc") — Phase B: Desktop Notification Boundary,
 * real acceptance tests. No mocks of the boundary itself -- `FakeTrackingPort`
 * below is a real, total `FedosDesktopNotificationPort` implementation (the
 * same style as `NoopFedosDesktopNotificationPort`, just with an
 * inspectable log), not a stub library.
 */
import { describe, it, expect } from "vitest";
import { FedosDesktopNotificationCoordinator } from "../src/desktop/notification/fedos_desktop_notification_coordinator.js";
import { NoopFedosDesktopNotificationPort } from "../src/desktop/notification/fedos_desktop_notification_port.js";
import type { FedosDesktopNotificationPort, FedosDesktopNotificationDeliveryResult } from "../src/desktop/notification/fedos_desktop_notification_port.js";
import type { FedosDesktopNotificationView } from "../src/desktop/notification/fedos_desktop_notification_types.js";
import { validateFedosDesktopNotificationRequest, FEDOS_DESKTOP_NOTIFICATION_KINDS } from "../src/desktop/notification/fedos_desktop_notification_types.js";

class FakeTrackingPort implements FedosDesktopNotificationPort {
  #available = true;
  #throwOnNotify = false;
  readonly shown: FedosDesktopNotificationView[] = [];

  setAvailable(value: boolean): void {
    this.#available = value;
  }
  setThrowOnNotify(value: boolean): void {
    this.#throwOnNotify = value;
  }

  status(): "available" | "unavailable" {
    return this.#available ? "available" : "unavailable";
  }

  async notify(view: FedosDesktopNotificationView): Promise<FedosDesktopNotificationDeliveryResult> {
    if (this.#throwOnNotify) throw new Error("simulated port failure");
    this.shown.push(view);
    return { delivered: true, reason: "shown" };
  }
}

function fixedClock(at: number): () => number {
  return () => at;
}

describe("Alpha 4261-4340 -- Notification types: closed vocabulary + validation", () => {
  it("the closed kind vocabulary is exactly the nine documented kinds", () => {
    expect(new Set(FEDOS_DESKTOP_NOTIFICATION_KINDS)).toEqual(
      new Set([
        "conversation-message",
        "device-sync",
        "device-transfer",
        "sync-complete",
        "sync-failed",
        "archive-complete",
        "archive-failed",
        "warning",
        "error",
      ]),
    );
  });

  it("rejects a malformed/unrecognized candidate -- fails closed to null, never throws", () => {
    expect(validateFedosDesktopNotificationRequest(null)).toBeNull();
    expect(validateFedosDesktopNotificationRequest("conversation-message")).toBeNull();
    expect(validateFedosDesktopNotificationRequest({})).toBeNull();
    expect(validateFedosDesktopNotificationRequest({ kind: "not-a-real-kind" })).toBeNull();
    expect(validateFedosDesktopNotificationRequest({ kind: "conversation-message", targetConversationId: 123 })).toBeNull();
    expect(validateFedosDesktopNotificationRequest({ kind: "conversation-message", detail: "x".repeat(1000) })).toBeNull();
  });

  it("accepts a well-formed request for every closed kind", () => {
    for (const kind of FEDOS_DESKTOP_NOTIFICATION_KINDS) {
      expect(validateFedosDesktopNotificationRequest({ kind })).toEqual({ kind });
    }
  });
});

describe("Alpha 4261-4340 -- Notification Coordinator: fail closed defaults", () => {
  it("NoopFedosDesktopNotificationPort denies every attempt and advertises unavailable", async () => {
    const coordinator = new FedosDesktopNotificationCoordinator(new NoopFedosDesktopNotificationPort(), fixedClock(1_000));
    const outcome = await coordinator.notify({ kind: "conversation-message" });
    expect(outcome.state).toBe("unavailable");
    expect(outcome.notification).not.toBeNull();
    expect(coordinator.deliveredCount).toBe(0);
    expect(coordinator.deniedCount).toBe(1);
  });

  it("rejects a malformed candidate before ever touching the Port", async () => {
    const port = new FakeTrackingPort();
    const coordinator = new FedosDesktopNotificationCoordinator(port, fixedClock(1_000));
    const outcome = await coordinator.notify({ kind: "not-a-real-kind" });
    expect(outcome.state).toBe("rejected");
    expect(outcome.notification).toBeNull();
    expect(port.shown).toHaveLength(0);
  });

  it("rejects (fails closed) a request whose detail field looks sensitive -- never sends, never sanitizes-and-sends", async () => {
    const port = new FakeTrackingPort();
    const coordinator = new FedosDesktopNotificationCoordinator(port, fixedClock(1_000));
    const outcome = await coordinator.notify({ kind: "warning", detail: "your api key is exposed" });
    expect(outcome.state).toBe("rejected");
    expect(outcome.notification).toBeNull();
    expect(port.shown).toHaveLength(0);
  });

  it("a genuinely throwing Port is converted to a closed 'error' outcome, never a raw throw", async () => {
    const port = new FakeTrackingPort();
    port.setThrowOnNotify(true);
    const coordinator = new FedosDesktopNotificationCoordinator(port, fixedClock(1_000));
    const outcome = await coordinator.notify({ kind: "error" });
    expect(outcome.state).toBe("error");
    expect(coordinator.deniedCount).toBe(1);
  });
});

describe("Alpha 4261-4340 -- Notification Coordinator: real delivery scenarios (Phase G)", () => {
  it("message notification -- conversation-message carries only the opaque conversation id, never content", async () => {
    const port = new FakeTrackingPort();
    const coordinator = new FedosDesktopNotificationCoordinator(port, fixedClock(1_000));
    const outcome = await coordinator.notify({ kind: "conversation-message", targetConversationId: "conv-abc" });
    expect(outcome.state).toBe("delivered");
    expect(outcome.notification?.targetConversationId).toBe("conv-abc");
    expect(outcome.notification?.title).toBe("New message");
    expect(port.shown).toHaveLength(1);
  });

  it("archive notification -- archive-complete and archive-failed both deliver with their own fixed templates", async () => {
    const port = new FakeTrackingPort();
    const coordinator = new FedosDesktopNotificationCoordinator(port, fixedClock(1_000));
    const complete = await coordinator.notify({ kind: "archive-complete" });
    const failed = await coordinator.notify({ kind: "archive-failed" });
    expect(complete.notification?.title).toBe("Archive complete");
    expect(failed.notification?.title).toBe("Archive failed");
    expect(port.shown).toHaveLength(2);
  });

  it("sync notification -- sync-complete/sync-failed/device-sync/device-transfer all deliver", async () => {
    const port = new FakeTrackingPort();
    const coordinator = new FedosDesktopNotificationCoordinator(port, fixedClock(1_000));
    for (const kind of ["sync-complete", "sync-failed", "device-sync", "device-transfer"] as const) {
      const outcome = await coordinator.notify({ kind });
      expect(outcome.state).toBe("delivered");
    }
    expect(port.shown).toHaveLength(4);
  });

  it("multiple notifications -- counters accumulate correctly across delivered and denied outcomes", async () => {
    const port = new FakeTrackingPort();
    const coordinator = new FedosDesktopNotificationCoordinator(port, fixedClock(1_000));
    await coordinator.notify({ kind: "conversation-message" });
    await coordinator.notify({ kind: "warning" });
    await coordinator.notify({ kind: "not-a-real-kind" }); // rejected
    port.setAvailable(false);
    await coordinator.notify({ kind: "error" }); // unavailable
    expect(coordinator.deliveredCount).toBe(2);
    expect(coordinator.deniedCount).toBe(2);
    expect(coordinator.lastOutcome?.state).toBe("unavailable");
  });
});
