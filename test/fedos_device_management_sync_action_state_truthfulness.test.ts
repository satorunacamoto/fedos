import { describe, it, expect } from "vitest";
import { fedosDeviceManagementDeriveSyncActionState } from "../src/os/messenger/desktop/presentation/device_management/fedos_device_management_screen_model.js";
import type { FedosDeviceSyncSchedulerStatusView } from "../src/os/messenger/desktop/runtime/fedos_device_sync_operational_facade.js";

/**
 * Own-Device Sync Truthfulness fix -- `"failed"` was a real, declared
 * member of `FedosDeviceManagementSyncActionState` that
 * `fedosDeviceManagementDeriveSyncActionState()` could never actually
 * return: it never read the SAME `operatorRequiredCount`/`pendingCount`
 * facts already present on `schedulerStatus`. A Scheduler where every
 * schedule is permanently stuck (the real, currently-shipped production
 * condition -- see `docs/reviews/fedos-own-device-recovery-current/02_SECOND_DEVICE_GAP.md`)
 * reported the identical `"running"` a healthy, successfully-syncing
 * Scheduler would -- this file proves that false-positive is closed,
 * and that a genuinely healthy/transiently-retrying Scheduler is never
 * mislabeled `"failed"` in exchange.
 */

function status(overrides: Partial<FedosDeviceSyncSchedulerStatusView> = {}): FedosDeviceSyncSchedulerStatusView {
  return {
    enabled: true,
    running: true,
    tickInFlight: false,
    scheduleCount: 0,
    pendingCount: 0,
    inProgressCount: 0,
    completedCount: 0,
    failedCount: 0,
    operatorRequiredCount: 0,
    targetDeviceCount: 0,
    ...overrides,
  };
}

describe("fedosDeviceManagementDeriveSyncActionState -- truthfulness", () => {
  it("REGRESSION (found live this arc): every schedule permanently stuck at operator-required, nothing pending -- must report 'failed', never the same 'running' a healthy Scheduler would report", () => {
    const state = fedosDeviceManagementDeriveSyncActionState({
      schedulerStatus: status({ scheduleCount: 3, operatorRequiredCount: 3, pendingCount: 0, completedCount: 0 }),
      actionInFlight: null,
      loadOutcome: null,
    });
    expect(state).toBe("failed");
  });

  it("a genuinely healthy Scheduler (all delivered, zero operator-required) still reports 'running'", () => {
    const state = fedosDeviceManagementDeriveSyncActionState({
      schedulerStatus: status({ scheduleCount: 3, completedCount: 3, operatorRequiredCount: 0, pendingCount: 0 }),
      actionInFlight: null,
      loadOutcome: null,
    });
    expect(state).toBe("running");
  });

  it("a schedule with a real operator-required outcome that ALSO still has other, genuinely pending schedules is NOT yet reported as the terminal 'failed' -- never cries wolf on an ordinary transient retry-later condition", () => {
    const state = fedosDeviceManagementDeriveSyncActionState({
      schedulerStatus: status({ scheduleCount: 3, operatorRequiredCount: 1, pendingCount: 2 }),
      actionInFlight: null,
      loadOutcome: null,
    });
    expect(state).toBe("running");
  });

  it("scheduler not running at all -- 'stopped', unaffected by operatorRequiredCount (a stopped Scheduler is never mislabeled 'failed')", () => {
    const state = fedosDeviceManagementDeriveSyncActionState({
      schedulerStatus: status({ running: false, operatorRequiredCount: 5, pendingCount: 0 }),
      actionInFlight: null,
      loadOutcome: null,
    });
    expect(state).toBe("stopped");
  });

  it("tick in flight always wins over the failed check -- an in-progress retry attempt is never simultaneously reported as terminally failed", () => {
    const state = fedosDeviceManagementDeriveSyncActionState({
      schedulerStatus: status({ tickInFlight: true, operatorRequiredCount: 3, pendingCount: 0 }),
      actionInFlight: null,
      loadOutcome: null,
    });
    expect(state).toBe("tick-in-flight");
  });

  it("disabled/unavailable/unsupported/start/stop precedence is unchanged by this fix", () => {
    expect(fedosDeviceManagementDeriveSyncActionState({ schedulerStatus: null, actionInFlight: null, loadOutcome: "unavailable" })).toBe("unavailable");
    expect(fedosDeviceManagementDeriveSyncActionState({ schedulerStatus: null, actionInFlight: null, loadOutcome: "unsupported" })).toBe("disabled");
    expect(fedosDeviceManagementDeriveSyncActionState({ schedulerStatus: null, actionInFlight: null, loadOutcome: null })).toBe("unavailable");
    expect(fedosDeviceManagementDeriveSyncActionState({ schedulerStatus: status({ enabled: false }), actionInFlight: null, loadOutcome: null })).toBe("disabled");
    expect(fedosDeviceManagementDeriveSyncActionState({ schedulerStatus: status({ operatorRequiredCount: 9, pendingCount: 0 }), actionInFlight: "start", loadOutcome: null })).toBe("starting");
    expect(fedosDeviceManagementDeriveSyncActionState({ schedulerStatus: status({ operatorRequiredCount: 9, pendingCount: 0 }), actionInFlight: "stop", loadOutcome: null })).toBe("stopping");
  });
});
