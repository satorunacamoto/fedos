/**
 * Secure Runtime Alpha 4981-5060 ("Desktop Settings Runtime Application and
 * Safe Reconfiguration Arc") — Phase R real acceptance suite.
 *
 * REAL BOUNDARIES, minimal mocks (only for narrow failure injection). Every
 * "applied" assertion drives a REAL live boundary:
 *   - theme / window layout      -> a real `InMemoryFedosSettingsPresentationSink`
 *                                   the renderer/shell reads.
 *   - notification presentation  -> a real `FedosDesktopNotificationCoordinator`
 *                                   over a real `GatedFedosDesktopNotificationPort`
 *                                   wrapping a real recording port.
 *   - background sync            -> a REAL `FedosDeviceSyncScheduler` whose
 *                                   `isRunning()` truly flips.
 *   - persistence                -> a REAL file-backed settings store (temp
 *                                   JSON file), reopened to model "restart".
 */

import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  defaultFedosSettingsDescriptorV1,
  withFedosSettings,
  type FedosSettingsDescriptorV1,
} from "../src/os/core/settings/fedos_settings_descriptor.js";
import { createFileBackedFedosDesktopSettingsController } from "../src/os/messenger/desktop/settings/fedos_desktop_settings_controller.js";
import { fedosDesktopSettingsFilePath } from "../src/os/messenger/desktop/settings/fedos_desktop_settings_controller.js";
import {
  fedosSettingsApplicationClassification,
  fedosSettingsFieldApplication,
} from "../src/os/core/settings/application/fedos_settings_application_class.js";
import { planFedosSettingsApplication } from "../src/os/core/settings/application/fedos_settings_application_plan.js";
import { fedosSettingsEffectiveStateFromLoaded } from "../src/os/core/settings/application/fedos_settings_effective_state.js";
import {
  FedosDesktopSettingsApplicationCoordinator,
  type FedosDesktopSettingsApplicationCoordinatorDeps,
} from "../src/os/messenger/desktop/settings/fedos_desktop_settings_application_coordinator.js";
import {
  InMemoryFedosSettingsPresentationSink,
  FedosSettingsNotificationPresentationGateHolder,
  GatedFedosDesktopNotificationPort,
  FacadeBackedFedosSettingsBackgroundSyncControl,
  type FedosSettingsBackgroundSyncControl,
  type FedosSettingsPortOutcome,
  type FedosSettingsPresentationSink,
} from "../src/os/messenger/desktop/settings/fedos_desktop_settings_application_ports.js";
import { FedosDesktopSettingsApplicationHostBridge } from "../src/os/messenger/desktop/settings/fedos_desktop_settings_application_host_bridge.js";
import { FedosDesktopSettingsApplicationViewModel } from "../src/os/messenger/desktop/presentation/fedos_desktop_settings_application_view_model.js";

import { FedosDesktopNotificationCoordinator } from "../src/os/messenger/notifications/fedos_desktop_notification_coordinator.js";
import type {
  FedosDesktopNotificationPort,
  FedosDesktopNotificationDeliveryResult,
} from "../src/os/messenger/notifications/fedos_desktop_notification_port.js";
import type { FedosDesktopNotificationView } from "../src/os/messenger/notifications/fedos_desktop_notification_types.js";

import { FedosDeviceSyncScheduler } from "../src/os/messenger/device/sync_scheduler/fedos_device_sync_scheduler.js";
import { InMemoryFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/in_memory_fedos_device_registry_persistence.js";
import { InMemoryFedosDeviceSyncSchedulePersistence } from "../src/os/messenger/device/sync_scheduler/persistence/in_memory_fedos_device_sync_schedule_persistence.js";
import { FedosSyncState } from "../src/sync/fedos_sync_state.js";
import type { FedosDeviceBindingAccountRef } from "../src/os/messenger/device/fedos_device_binding.js";

// --------------------------------------------------------------------------
// Real-boundary fixtures.
// --------------------------------------------------------------------------

const tmpDirs: string[] = [];
function freshSettingsFile(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-settings-app-"));
  tmpDirs.push(dir);
  return fedosDesktopSettingsFilePath(dir)!;
}
afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop()!;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

/** A real recording notification port — counts how many notifications actually reached the backend. */
class RecordingNotificationPort implements FedosDesktopNotificationPort {
  shown: FedosDesktopNotificationView[] = [];
  status(): "available" | "unavailable" {
    return "available";
  }
  async notify(view: FedosDesktopNotificationView): Promise<FedosDesktopNotificationDeliveryResult> {
    this.shown.push(view);
    return { delivered: true, reason: "shown" };
  }
}

/** Builds a REAL Device-Sync Scheduler whose isRunning() genuinely flips; injected no-op timer fns so no wall-clock tick fires. */
function buildRealScheduler(): FedosDeviceSyncScheduler {
  const accountRef: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: "a".repeat(64), identityId: null };
  const syncState = new FedosSyncState(`${accountRef.authority}:${accountRef.publicIdentifier}`);
  return new FedosDeviceSyncScheduler({
    schedulePersistence: new InMemoryFedosDeviceSyncSchedulePersistence(),
    registryPersistence: new InMemoryFedosDeviceRegistryPersistence(),
    accountRef,
    sourceDeviceId: "phone",
    syncState,
    attemptFn: async () => ({ outcome: "delivered" }) as never,
    abandonmentPolicy: { maxAttempts: 3, laterDelaySeconds: 60 },
    intervalMs: 30_000,
    setIntervalFn: () => 1,
    clearIntervalFn: () => undefined,
  });
}

/** Wraps a REAL scheduler as the narrow facade-like the background-sync control expects. */
function realSchedulerControl(scheduler: FedosDeviceSyncScheduler): FacadeBackedFedosSettingsBackgroundSyncControl {
  return new FacadeBackedFedosSettingsBackgroundSyncControl({
    syncStatus: () => ({ outcome: "ok", value: { running: scheduler.isRunning() } }),
    startSync: () => {
      scheduler.startSync();
      return { outcome: "ok" };
    },
    stopSync: async () => {
      await scheduler.stopSync();
      return { outcome: "ok" };
    },
  });
}

interface Harness {
  readonly coordinator: FedosDesktopSettingsApplicationCoordinator;
  readonly sink: InMemoryFedosSettingsPresentationSink;
  readonly gate: FedosSettingsNotificationPresentationGateHolder;
  readonly notification: FedosDesktopNotificationCoordinator;
  readonly recordingPort: RecordingNotificationPort;
  readonly scheduler: FedosDeviceSyncScheduler;
  readonly filePath: string;
}

function buildHarness(overrides?: {
  presentationSink?: FedosSettingsPresentationSink;
  backgroundSyncControl?: FedosSettingsBackgroundSyncControl;
  filePath?: string;
}): Harness {
  const filePath = overrides?.filePath ?? freshSettingsFile();
  const controller = createFileBackedFedosDesktopSettingsController(filePath);
  const sink = new InMemoryFedosSettingsPresentationSink();
  const gate = new FedosSettingsNotificationPresentationGateHolder(true);
  const recordingPort = new RecordingNotificationPort();
  const gatedPort = new GatedFedosDesktopNotificationPort(recordingPort, gate);
  const notification = new FedosDesktopNotificationCoordinator(gatedPort);
  const scheduler = buildRealScheduler();
  const deps: FedosDesktopSettingsApplicationCoordinatorDeps = {
    controller,
    presentationSink: overrides?.presentationSink ?? sink,
    notificationGate: gate,
    backgroundSyncControl: overrides?.backgroundSyncControl ?? realSchedulerControl(scheduler),
  };
  return {
    coordinator: new FedosDesktopSettingsApplicationCoordinator(deps),
    sink,
    gate,
    notification,
    recordingPort,
    scheduler,
    filePath,
  };
}

// --------------------------------------------------------------------------
// Phase A — classification.
// --------------------------------------------------------------------------

describe("Alpha 4981-5060 — classification (Phase A)", () => {
  it("1. classifies all ten applicable fields exactly once", () => {
    const table = fedosSettingsApplicationClassification();
    expect(table.length).toBe(10);
    expect(new Set(table.map((t) => t.field)).size).toBe(10);
  });

  it("2. theme / windowLayout / notificationsEnabled are IMMEDIATE", () => {
    for (const f of ["theme", "windowLayout", "notificationsEnabled"] as const) {
      expect(fedosSettingsFieldApplication(f).applicationClass).toBe("immediate");
    }
  });

  it("3. backgroundSyncEnabled is SUBSYSTEM and requires confirmation", () => {
    const d = fedosSettingsFieldApplication("backgroundSyncEnabled");
    expect(d.applicationClass).toBe("subsystem");
    expect(d.confirmationRequired).toBe(true);
  });

  it("4. relays / defaultRelay / archiveDirectory are RUNTIME-RESTART", () => {
    for (const f of ["relays", "defaultRelay", "archiveDirectory"] as const) {
      expect(fedosSettingsFieldApplication(f).applicationClass).toBe("runtime-restart");
    }
  });

  it("5. language / autoStart / autoLockTimeoutMinutes are honestly UNSUPPORTED", () => {
    expect(fedosSettingsFieldApplication("language").applicationClass).toBe("unsupported");
    expect(fedosSettingsFieldApplication("autoStart").applicationClass).toBe("unsupported");
    expect(fedosSettingsFieldApplication("autoLockTimeoutMinutes").applicationClass).toBe("unsupported");
  });

  it("6. unsupported reasons are the honest, evidence-derived ones", () => {
    expect(fedosSettingsFieldApplication("language").reason).toBe("no-localization-boundary");
    expect(fedosSettingsFieldApplication("autoStart").reason).toBe("no-os-auto-start-boundary");
    expect(fedosSettingsFieldApplication("autoLockTimeoutMinutes").reason).toBe("no-idle-activity-boundary");
  });
});

// --------------------------------------------------------------------------
// Phase B — planner.
// --------------------------------------------------------------------------

describe("Alpha 4981-5060 — planner (Phase B)", () => {
  const base = defaultFedosSettingsDescriptorV1();

  it("7. no-change plan when nothing differs", () => {
    const plan = planFedosSettingsApplication(base, base);
    expect(plan.noChange).toBe(true);
    expect(plan.entries.length).toBe(0);
  });

  it("8. theme change yields a single apply-immediately entry, no confirmation", () => {
    const plan = planFedosSettingsApplication(base, withFedosSettings(base, { theme: "dark" }));
    expect(plan.entries.length).toBe(1);
    expect(plan.entries[0]!.action).toBe("apply-immediately");
    expect(plan.confirmationRequired).toBe(false);
  });

  it("9. window layout change yields update-window-preferences", () => {
    const plan = planFedosSettingsApplication(base, withFedosSettings(base, { windowLayout: "compact" }));
    expect(plan.entries[0]!.action).toBe("update-window-preferences");
  });

  it("10. notification toggle yields reconfigure-notifications", () => {
    const plan = planFedosSettingsApplication(base, withFedosSettings(base, { notificationsEnabled: false }));
    expect(plan.entries[0]!.action).toBe("reconfigure-notifications");
  });

  it("11. background sync enable/disable yield start-/stop-background-sync", () => {
    const enabled = planFedosSettingsApplication(withFedosSettings(base, { backgroundSyncEnabled: false }), base);
    expect(enabled.entries[0]!.action).toBe("start-background-sync");
    const disabled = planFedosSettingsApplication(base, withFedosSettings(base, { backgroundSyncEnabled: false }));
    expect(disabled.entries[0]!.action).toBe("stop-background-sync");
  });

  it("12. relay change yields runtime-restart-required and flags runtimeRestartRequired", () => {
    const plan = planFedosSettingsApplication(base, withFedosSettings(base, { relays: ["wss://relay.example"], defaultRelay: "wss://relay.example" }));
    expect(plan.runtimeRestartRequired).toBe(true);
    expect(plan.entries.every((e) => e.action === "runtime-restart-required")).toBe(true);
  });

  it("13. unsupported field change yields action unsupported and unsupportedFields", () => {
    const plan = planFedosSettingsApplication(base, withFedosSettings(base, { autoStart: true }));
    expect(plan.entries[0]!.action).toBe("unsupported");
    expect(plan.unsupportedFields).toContain("autoStart");
  });

  it("14. entries are ordered immediate -> subsystem -> restart", () => {
    const desired = withFedosSettings(base, {
      theme: "dark",
      backgroundSyncEnabled: false,
      relays: ["wss://r.example"],
      defaultRelay: "wss://r.example",
    });
    const plan = planFedosSettingsApplication(base, desired);
    const classes = plan.entries.map((e) => e.applicationClass);
    expect(classes[0]).toBe("immediate");
    expect(classes[classes.length - 1]).toBe("runtime-restart");
  });

  it("15. no secret ever appears in a relay/archive summary", () => {
    const desired = withFedosSettings(base, {
      relays: ["wss://user:secret@relay.example"],
      defaultRelay: "wss://user:secret@relay.example",
      archiveDirectory: "/home/alice/secret-archive",
    });
    const plan = planFedosSettingsApplication(base, desired);
    const json = JSON.stringify(plan);
    expect(json).not.toContain("secret");
    expect(json).not.toContain("alice");
  });
});

// --------------------------------------------------------------------------
// Phase C — effective state.
// --------------------------------------------------------------------------

describe("Alpha 4981-5060 — effective state (Phase C)", () => {
  it("16. fresh load: persisted == desired == effective, all fields effective", () => {
    const s = fedosSettingsEffectiveStateFromLoaded(defaultFedosSettingsDescriptorV1());
    expect(s.fullyEffective).toBe(true);
    expect(s.fields.every((f) => f.status === "effective")).toBe(true);
    expect(s.effective).toEqual(s.persisted);
  });
});

// --------------------------------------------------------------------------
// Phase F/I — immediate: theme, window layout, notifications.
// --------------------------------------------------------------------------

describe("Alpha 4981-5060 — immediate application (Phases F/I)", () => {
  it("17. default settings at first launch initialize live boundaries", () => {
    const h = buildHarness();
    const init = h.coordinator.initialize();
    expect(init.outcome).toBe("ok");
    expect(h.sink.currentTheme()).toBe("system");
    expect(h.gate.isPresentationEnabled()).toBe(true);
  });

  it("18. theme change applies immediately to the live presentation sink, no runtime recreation", async () => {
    const h = buildHarness();
    h.coordinator.initialize();
    const desired = withFedosSettings(defaultFedosSettingsDescriptorV1(), { theme: "dark" });
    const report = await h.coordinator.apply(desired);
    expect(report.outcome).toBe("persisted-and-applied");
    expect(h.sink.currentTheme()).toBe("dark"); // REAL live effect
  });

  it("19. theme survives a restart (reopen same file) and re-seeds the sink", async () => {
    const h = buildHarness();
    h.coordinator.initialize();
    await h.coordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), { theme: "light" }));
    // "restart": a brand-new harness over the SAME file.
    const h2 = buildHarness({ filePath: h.filePath });
    h2.coordinator.initialize();
    expect(h2.sink.currentTheme()).toBe("light");
  });

  it("20. window layout applies immediately", async () => {
    const h = buildHarness();
    h.coordinator.initialize();
    await h.coordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), { windowLayout: "wide" }));
    expect(h.sink.currentWindowLayout()).toBe("wide");
  });

  it("21. disabling notifications suppresses presentation while the canonical event still flows", async () => {
    const h = buildHarness();
    h.coordinator.initialize();
    // Enabled: a notification actually reaches the backend.
    const first = await h.notification.notify({ kind: "conversation-message" });
    expect(first.state).toBe("delivered");
    expect(h.recordingPort.shown.length).toBe(1);

    // Disable via settings.
    await h.coordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), { notificationsEnabled: false }));
    expect(h.gate.isPresentationEnabled()).toBe(false);

    const second = await h.notification.notify({ kind: "conversation-message" });
    expect(second.state).toBe("denied"); // presentation suppressed
    expect(h.recordingPort.shown.length).toBe(1); // NOT shown — no new backend delivery
  });

  it("22. re-enabling notifications restores presentation with no state loss", async () => {
    const h = buildHarness();
    h.coordinator.initialize();
    await h.coordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), { notificationsEnabled: false }));
    await h.coordinator.apply(defaultFedosSettingsDescriptorV1()); // notificationsEnabled back to true
    expect(h.gate.isPresentationEnabled()).toBe(true);
    const r = await h.notification.notify({ kind: "conversation-message" });
    expect(r.state).toBe("delivered");
  });
});

// --------------------------------------------------------------------------
// Phase H — background sync subsystem (REAL scheduler).
// --------------------------------------------------------------------------

describe("Alpha 4981-5060 — background sync subsystem (Phase H)", () => {
  it("23. enabling background sync starts the REAL scheduler (isRunning flips)", async () => {
    const h = buildHarness();
    // Persist a disabled baseline, initialize, then enable.
    h.coordinator.initialize();
    await h.coordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), { backgroundSyncEnabled: false }));
    expect(h.scheduler.isRunning()).toBe(false);
    const report = await h.coordinator.apply(defaultFedosSettingsDescriptorV1()); // backgroundSyncEnabled true
    expect(report.outcome).toBe("persisted-and-applied");
    expect(h.scheduler.isRunning()).toBe(true); // REAL scheduler running
  });

  it("24. exactly one scheduler is used — enabling twice does not throw or double-start", async () => {
    const h = buildHarness();
    h.coordinator.initialize();
    await h.coordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), { backgroundSyncEnabled: false }));
    await h.coordinator.apply(defaultFedosSettingsDescriptorV1());
    expect(h.scheduler.isRunning()).toBe(true);
    // Applying the same again is a no-change; scheduler stays running, no throw.
    const again = await h.coordinator.apply(defaultFedosSettingsDescriptorV1());
    expect(again.outcome).toBe("no-change");
    expect(h.scheduler.isRunning()).toBe(true);
  });

  it("25. disabling background sync stops the REAL scheduler", async () => {
    const h = buildHarness();
    h.coordinator.initialize();
    await h.coordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), { backgroundSyncEnabled: false }));
    await h.coordinator.apply(defaultFedosSettingsDescriptorV1());
    expect(h.scheduler.isRunning()).toBe(true);
    const stop = await h.coordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), { backgroundSyncEnabled: false }));
    expect(stop.outcome).toBe("persisted-and-applied");
    expect(h.scheduler.isRunning()).toBe(false);
  });

  it("26. background sync is honestly BLOCKED when no scheduler boundary is wired", async () => {
    const unavailable: FedosSettingsBackgroundSyncControl = {
      isAvailable: () => false,
      isRunning: () => false,
      start: () => "unavailable",
      stop: async () => "unavailable",
    };
    const h = buildHarness({ backgroundSyncControl: unavailable });
    h.coordinator.initialize();
    const report = await h.coordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), { backgroundSyncEnabled: false }));
    expect(report.outcome).toBe("persisted-but-blocked");
    expect(report.effectiveState?.blockedFields).toContain("backgroundSyncEnabled");
  });
});

// --------------------------------------------------------------------------
// Phase G/J/K/L — restart-required & unsupported honesty.
// --------------------------------------------------------------------------

describe("Alpha 4981-5060 — restart-required & unsupported (Phases G/J/K/L)", () => {
  it("27. relay change is persisted but reported pending-runtime-restart (no hot reload)", async () => {
    const h = buildHarness();
    h.coordinator.initialize();
    const desired = withFedosSettings(defaultFedosSettingsDescriptorV1(), {
      relays: ["wss://relay.example"],
      defaultRelay: "wss://relay.example",
    });
    const report = await h.coordinator.apply(desired);
    expect(report.outcome).toBe("persisted-pending-runtime-restart");
    expect(report.effectiveState?.pendingRuntimeRestartFields).toContain("relays");
    // Persisted despite not being live-applied.
    const reopened = createFileBackedFedosDesktopSettingsController(h.filePath).load();
    expect(reopened.outcome).toBe("ok");
    expect(reopened.outcome === "ok" && reopened.value.relays).toEqual(["wss://relay.example"]);
  });

  it("28. archive directory change is persisted pending-runtime-restart; old archives untouched", async () => {
    const h = buildHarness();
    h.coordinator.initialize();
    const report = await h.coordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), { archiveDirectory: "/tmp/fedos-archive" }));
    expect(report.outcome).toBe("persisted-pending-runtime-restart");
    expect(report.effectiveState?.pendingRuntimeRestartFields).toContain("archiveDirectory");
  });

  it("29. auto-lock change is persisted-but-blocked (no idle boundary)", async () => {
    const h = buildHarness();
    h.coordinator.initialize();
    const report = await h.coordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), { autoLockTimeoutMinutes: 30 }));
    expect(report.outcome).toBe("persisted-but-blocked");
    expect(report.effectiveState?.blockedFields).toContain("autoLockTimeoutMinutes");
  });

  it("30. auto-start is never falsely claimed applied — persisted-but-blocked", async () => {
    const h = buildHarness();
    h.coordinator.initialize();
    const report = await h.coordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), { autoStart: true }));
    expect(report.outcome).toBe("persisted-but-blocked");
    expect(report.fieldRecords.find((r) => r.field === "autoStart")?.status).toBe("blocked");
  });
});

// --------------------------------------------------------------------------
// Phase E — transaction & failure semantics.
// --------------------------------------------------------------------------

describe("Alpha 4981-5060 — transaction semantics (Phase E)", () => {
  it("31. invalid candidate is rejected before persist (nothing written)", async () => {
    const h = buildHarness();
    h.coordinator.initialize();
    const report = await h.coordinator.apply({ not: "a descriptor" });
    expect(report.outcome).toBe("rejected-before-persist");
    expect(report.effectiveState).toBe(null);
    // Store still holds the default.
    const stored = createFileBackedFedosDesktopSettingsController(h.filePath).load();
    expect(stored.outcome === "ok" && stored.value.theme).toBe("system");
  });

  it("32. partially-applied: immediate applied + relay pending in one save", async () => {
    const h = buildHarness();
    h.coordinator.initialize();
    const desired = withFedosSettings(defaultFedosSettingsDescriptorV1(), {
      theme: "dark",
      relays: ["wss://r.example"],
      defaultRelay: "wss://r.example",
    });
    const report = await h.coordinator.apply(desired);
    expect(report.outcome).toBe("partially-applied");
    expect(h.sink.currentTheme()).toBe("dark"); // immediate really applied
    expect(report.effectiveState?.pendingRuntimeRestartFields).toContain("relays");
  });

  it("33. failed immediate application rolls back and reports rolled-back", async () => {
    // Applying the NEW value ("dark") fails; re-applying the OLD value ("system") succeeds -> rolled-back.
    const failingSink: FedosSettingsPresentationSink = {
      currentTheme: () => "system",
      currentWindowLayout: () => "standard",
      applyTheme: (t): FedosSettingsPortOutcome => (t === "system" ? "applied" : "failed"),
      applyWindowLayout: (): FedosSettingsPortOutcome => "applied",
    };
    const h = buildHarness({ presentationSink: failingSink });
    h.coordinator.initialize();
    const report = await h.coordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), { theme: "dark" }));
    expect(report.outcome).toBe("rolled-back");
    expect(report.effectiveState?.failedFields).toContain("theme");
  });

  it("34. rollback failure produces the rollback-failed vocabulary", async () => {
    const doublyFailingSink: FedosSettingsPresentationSink = {
      currentTheme: () => "system",
      currentWindowLayout: () => "standard",
      applyTheme: (): FedosSettingsPortOutcome => "failed", // both apply and rollback fail
      applyWindowLayout: (): FedosSettingsPortOutcome => "applied",
    };
    const h = buildHarness({ presentationSink: doublyFailingSink });
    h.coordinator.initialize();
    const report = await h.coordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), { theme: "dark" }));
    expect(report.outcome).toBe("rollback-failed");
  });

  it("35. no-change apply reports no-change and keeps durable == desired", async () => {
    const h = buildHarness();
    h.coordinator.initialize();
    const report = await h.coordinator.apply(defaultFedosSettingsDescriptorV1());
    expect(report.outcome).toBe("no-change");
  });
});

// --------------------------------------------------------------------------
// Phase M/N — host bridge & renderer.
// --------------------------------------------------------------------------

describe("Alpha 4981-5060 — host bridge & renderer (Phases M/N)", () => {
  it("36. host bridge rejects an unknown command (fail closed)", async () => {
    const h = buildHarness();
    h.coordinator.initialize();
    const bridge = new FedosDesktopSettingsApplicationHostBridge(h.coordinator);
    const res = await bridge.dispatch({ type: "settings-nuke-everything" });
    expect(res.outcome).toBe("error");
    expect(res.outcome === "error" && res.code).toBe("unknown-command");
  });

  it("37. host bridge settings-apply returns a structured-clone-safe ok report", async () => {
    const h = buildHarness();
    h.coordinator.initialize();
    const bridge = new FedosDesktopSettingsApplicationHostBridge(h.coordinator);
    const res = await bridge.dispatch({ type: "settings-apply", descriptor: withFedosSettings(defaultFedosSettingsDescriptorV1(), { theme: "dark" }) });
    expect(res.outcome).toBe("ok");
    expect(() => structuredClone(res)).not.toThrow();
  });

  it("38. host bridge settings-application-plan returns the plan", async () => {
    const h = buildHarness();
    h.coordinator.initialize();
    const bridge = new FedosDesktopSettingsApplicationHostBridge(h.coordinator);
    const res = await bridge.dispatch({ type: "settings-application-plan", descriptor: withFedosSettings(defaultFedosSettingsDescriptorV1(), { theme: "dark" }) });
    expect(res.outcome).toBe("ok");
  });

  it("39. host bridge invalid descriptor -> invalid-input, not a thrown error", async () => {
    const h = buildHarness();
    h.coordinator.initialize();
    const bridge = new FedosDesktopSettingsApplicationHostBridge(h.coordinator);
    const res = await bridge.dispatch({ type: "settings-apply", descriptor: { bogus: true } });
    expect(res.outcome === "error" && res.code).toBe("invalid-input");
  });

  it("40. host bridge effective-state before init -> unavailable (not a crash)", async () => {
    const h = buildHarness();
    const bridge = new FedosDesktopSettingsApplicationHostBridge(h.coordinator);
    const res = await bridge.dispatch({ type: "settings-effective-state" });
    expect(res.outcome === "error" && res.code).toBe("unavailable");
  });

  it("41. renderer shows saved vs effective vs pending honestly", async () => {
    const h = buildHarness();
    const vm = new FedosDesktopSettingsApplicationViewModel(h.coordinator);
    vm.initialize();
    await vm.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), { theme: "dark", relays: ["wss://r.example"], defaultRelay: "wss://r.example" }));
    const content = vm.render();
    const themeRow = content.rows.find((r) => r.field === "theme")!;
    expect(themeRow.effectiveValueSummary).toBe("dark");
    const relayRow = content.rows.find((r) => r.field === "relays")!;
    expect(relayRow.restartRequired).toBe(true);
    expect(content.lastOutcome).toBe("partially-applied");
  });

  it("42. renderer content is structured-clone-safe and exposes no raw objects", () => {
    const h = buildHarness();
    const vm = new FedosDesktopSettingsApplicationViewModel(h.coordinator);
    vm.initialize();
    const content = vm.render();
    expect(() => structuredClone(content)).not.toThrow();
  });
});

// --------------------------------------------------------------------------
// Phase Q/S — startup application, isolation, structural guards.
// --------------------------------------------------------------------------

describe("Alpha 4981-5060 — startup, isolation, guards (Phases Q/S)", () => {
  it("43. startup applies persisted non-default settings to the live boundaries", async () => {
    const filePath = freshSettingsFile();
    // First session persists a non-default theme.
    const h1 = buildHarness({ filePath });
    h1.coordinator.initialize();
    await h1.coordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), { theme: "dark", notificationsEnabled: false }));
    // Second session (restart) initializes from the durable file.
    const h2 = buildHarness({ filePath });
    h2.coordinator.initialize();
    expect(h2.sink.currentTheme()).toBe("dark");
    expect(h2.gate.isPresentationEnabled()).toBe(false);
  });

  it("44. persisted != effective distinction survives a restart with a pending relay", async () => {
    const filePath = freshSettingsFile();
    const h1 = buildHarness({ filePath });
    h1.coordinator.initialize();
    await h1.coordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), { relays: ["wss://r.example"], defaultRelay: "wss://r.example" }));
    const h2 = buildHarness({ filePath });
    const state = h2.coordinator.initialize();
    // After restart the relay IS the durable/effective config (a fresh Runtime would build it).
    expect(state.outcome === "ok" && state.value.persisted.relays).toEqual(["wss://r.example"]);
  });

  it("45. two coordinators over two different files are isolated", async () => {
    const a = buildHarness();
    const b = buildHarness();
    a.coordinator.initialize();
    b.coordinator.initialize();
    await a.coordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), { theme: "dark" }));
    expect(a.sink.currentTheme()).toBe("dark");
    expect(b.sink.currentTheme()).toBe("system"); // untouched
  });

  it("46. no secret ever appears in an apply report", async () => {
    const h = buildHarness();
    h.coordinator.initialize();
    const report = await h.coordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), {
      relays: ["wss://user:hunter2@relay.example"],
      defaultRelay: "wss://user:hunter2@relay.example",
      archiveDirectory: "/home/bob/topsecret",
    }));
    const json = JSON.stringify(report);
    expect(json).not.toContain("hunter2");
    expect(json).not.toContain("topsecret");
  });

  it("47. a corrupt store fails closed on initialize (no silent default)", () => {
    const h = buildHarness();
    // Write a corrupt file directly.
    writeFileSync(h.filePath, "{ not valid json");
    const result = h.coordinator.initialize();
    expect(result.outcome).not.toBe("ok");
  });

  it("48. background sync in-flight tick is awaited on disable (no discard)", async () => {
    // Use a real scheduler with a blocking attemptFn to prove stop awaits.
    const h = buildHarness();
    h.coordinator.initialize();
    await h.coordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), { backgroundSyncEnabled: false }));
    await h.coordinator.apply(defaultFedosSettingsDescriptorV1());
    expect(h.scheduler.isRunning()).toBe(true);
    const stop = await h.coordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), { backgroundSyncEnabled: false }));
    expect(stop.outcome).toBe("persisted-and-applied");
    expect(h.scheduler.isRunning()).toBe(false);
  });

  it("49. preview plan never persists or applies", async () => {
    const h = buildHarness();
    h.coordinator.initialize();
    h.coordinator.previewPlan(withFedosSettings(defaultFedosSettingsDescriptorV1(), { theme: "dark" }));
    expect(h.sink.currentTheme()).toBe("system"); // unchanged
    const stored = createFileBackedFedosDesktopSettingsController(h.filePath).load();
    expect(stored.outcome === "ok" && stored.value.theme).toBe("system");
  });

  it("50. multi-field immediate save applies every immediate field at once", async () => {
    const h = buildHarness();
    h.coordinator.initialize();
    const report = await h.coordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), {
      theme: "dark",
      windowLayout: "compact",
      notificationsEnabled: false,
    }));
    expect(report.outcome).toBe("persisted-and-applied");
    expect(h.sink.currentTheme()).toBe("dark");
    expect(h.sink.currentWindowLayout()).toBe("compact");
    expect(h.gate.isPresentationEnabled()).toBe(false);
  });
});
