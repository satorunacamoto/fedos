/**
 * Secure Runtime Alpha 4501-4580 ("Desktop Device Sync Electron Main
 * Integration Arc") — Phase D: main-process self-test sequence for Device
 * Sync (test-support only, mirrors `fedos_electron_badge_selftest.ts`'s own
 * `FEDOS_BADGE_TEST:{...}` "MARKER" transport-proof convention exactly,
 * under this file's own `FEDOS_DEVICE_SYNC_TEST:` prefix so the two
 * self-tests' own output never collides or has to be reconciled against a
 * single closed step list).
 *
 * Runs directly in the MAIN process, gated behind
 * `FEDOS_ELECTRON_BADGE_AUTOTEST=1` (the SAME flag `fedos_electron_badge_main.cts`
 * already gates its own selftest behind) -- never runs during a normal
 * developer/user launch.
 *
 * HONEST, DISCLOSED SCOPE (restated from `fedos_electron_badge_main.cts`'s
 * own header -- read that file's header in full before this one):
 * `FedosDesktopApplicationShell` exposes Device Sync OPERATIONAL commands
 * only; it has no device REGISTRATION surface at all, and the Sync Journal
 * (`FedosSyncState`) has no durable-path config field anywhere in this
 * codebase, so even a temporary raw seed runtime could not carry a seeded
 * entry into this file's own real, long-lived Boundary runtime. This
 * process's own real Scheduler therefore has no reachable way to ever have
 * a real, trusted, in-range target device today -- `trigger-now` below
 * honestly reports its own REAL, empty tick, never a fabricated one. To
 * still prove the real, live Notification/Badge/Tray Coordinators this
 * process constructs correctly receive and process Device Sync events,
 * `event-routing` drives `wiring.handleEvent()` directly with hand-built,
 * schema-valid `FedosDeviceSyncEvent` objects -- the IDENTICAL method, and
 * IDENTICAL code path, a genuine Scheduler-sourced event takes
 * (`FedosDeviceSyncEventBridge` itself only ever calls
 * `this.#listener(event)`, i.e. this exact `wiring.handleEvent`, to deliver
 * a real one).
 */

const MARKER = "FEDOS_DEVICE_SYNC_TEST:";

function logStep(step: string, result: unknown): void {
  // eslint-disable-next-line no-console -- deliberate, minimal real-process test signal; not a debugging leftover.
  console.log(`${MARKER}${JSON.stringify({ step, result })}`);
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export interface FedosBadgeDeviceSyncSelftestDeps {
  /** Real `boundary.deviceSyncStatus.refresh()` -- proves the real Scheduler was actually constructed (`enabled: true`), never a fabricated flag. */
  readonly deviceSyncStatus: () => Promise<unknown>;
  /** Real `handleTrayAction({action: "resume-sync"})` -- the SAME, already-existing `TrayCoordinator` action (Alpha 4261-4340, unmodified), genuinely functional for the first time now that `deviceSyncSchedulerEnabled` is `true`. */
  readonly resumeSync: () => Promise<unknown>;
  /** Real `handleTrayAction({action: "pause-sync"})`. */
  readonly pauseSync: () => Promise<unknown>;
  /** Real `boundary.deviceSyncStatus.triggerNow()` -- a real Scheduler tick, honestly zero eligible targets on this base (see this file's own header). */
  readonly triggerSyncNow: () => Promise<unknown>;
  /** Real `wiring.handleEvent()` -- drives the real, live Notification/Badge/Tray Coordinators directly with a hand-built, schema-valid event (see this file's own header for why). */
  readonly handleSyntheticEvent: (event: unknown) => Promise<void>;
  readonly currentTrayStatus: () => string;
  readonly notificationDeliveredCount: () => number;
  readonly badgeRenderCount: () => number;
  readonly isTargetBelievedOffline: (targetDeviceId: string) => boolean;
}

export async function runFedosBadgeDeviceSyncSelftest(deps: FedosBadgeDeviceSyncSelftestDeps): Promise<void> {
  // 1 -- scheduler-enabled: the real Boundary reports the real Scheduler as constructed and
  // enabled (`deviceTrustEnabled`/`deviceSyncSchedulerEnabled` genuinely reached
  // `startFedosDesktopRuntime()`, never a fabricated flag this selftest merely asserts by fiat).
  const status = await deps.deviceSyncStatus();
  logStep("scheduler-enabled", status);

  // 2 -- resume-sync: the real, PREVIOUSLY-INERT `TrayCoordinator` "resume-sync" action
  // (Alpha 4261-4340, unmodified) now genuinely starts the real Scheduler.
  const resumeOutcome = await deps.resumeSync();
  logStep("resume-sync", resumeOutcome);

  // 3 -- trigger-now: one real Scheduler tick. Honestly zero eligible targets on this base (see
  // this file's own header) -- `FedosDesktopDeviceSyncStatusViewModel.triggerNow()` returns its
  // own refreshed status view (loaded, `scheduleCount`/`pendingCount` both `0`), never a
  // fabricated attempt.
  const tickResult = await deps.triggerSyncNow();
  logStep("trigger-now-zero-targets", tickResult);

  // 4 -- event-routing (sync): drives the SAME real, live Notification/Badge/Tray Coordinators
  // this process constructed at real startup, via `wiring.handleEvent()` directly (see this
  // file's own header) -- proves the real "sync"/"notification"/"tray update"/"badge update"
  // scenarios this Arc's own Phase D names, using the IDENTICAL code path a genuine
  // Scheduler-sourced event takes.
  const notifyBefore = deps.notificationDeliveredCount();
  const badgeBefore = deps.badgeRenderCount();
  const baseEvent = {
    scheduleId: "selftest-schedule",
    sourceDeviceId: "fedos-badge-local-device",
    targetDeviceId: "selftest-target-device",
    attemptNumber: 1,
  };
  await deps.handleSyntheticEvent({ kind: "sync-started", at: nowSeconds(), ...baseEvent });
  const trayAfterStarted = deps.currentTrayStatus();
  await deps.handleSyntheticEvent({ kind: "sync-completed", at: nowSeconds(), ...baseEvent });
  const trayAfterCompleted = deps.currentTrayStatus();
  logStep("event-routing", {
    trayAfterStarted,
    trayAfterCompleted,
    notificationDelta: deps.notificationDeliveredCount() - notifyBefore,
    badgeRenderDelta: deps.badgeRenderCount() - badgeBefore,
  });

  // 5 -- device connectivity routing: the SAME real routing for the `"device-offline"`/
  // `"device-online"` connectivity vocabulary (derived, in-memory-only signals -- never a
  // Scheduler attempt of their own, see `fedos_device_sync_event_bridge.ts`'s own header).
  // `isTargetBelievedOffline()` lives on the BRIDGE, not the Wiring -- it is populated ONLY by
  // `FedosDeviceSyncEventBridge.wrapAttemptFn()`'s own real attempt observation
  // (`#updateConnectivity()`), which this selftest's hand-fed events never go through (they are
  // driven directly into `wiring.handleEvent()`, see this file's own header). Checking it here
  // deliberately proves genuine isolation: a directly-driven Wiring event changes the real TRAY
  // status but never fabricates a Bridge-level connectivity belief the Bridge itself never
  // actually observed -- honestly `false` throughout, not a bug, not omitted.
  const offlineTargetId = "selftest-offline-device";
  await deps.handleSyntheticEvent({ kind: "device-offline", at: nowSeconds(), targetDeviceId: offlineTargetId, reason: "target-unavailable" });
  const trayOffline = deps.currentTrayStatus();
  const bridgeBelievesOfflineFromUnrelatedHandFedEvent = deps.isTargetBelievedOffline(offlineTargetId);
  await deps.handleSyntheticEvent({ kind: "device-online", at: nowSeconds(), targetDeviceId: offlineTargetId });
  const trayOnline = deps.currentTrayStatus();
  logStep("device-connectivity-routing", { trayOffline, bridgeBelievesOfflineFromUnrelatedHandFedEvent, trayOnline });

  // 6 -- pause-sync: a real, clean Scheduler stop through the real, previously-inert
  // `TrayCoordinator` "pause-sync" action, before this process's own overall shutdown -- never
  // left running past this point.
  const pauseOutcome = await deps.pauseSync();
  logStep("pause-sync", pauseOutcome);

  console.log(`${MARKER}done`);
}
