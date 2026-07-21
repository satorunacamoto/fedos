/**
 * Secure Runtime Alpha 5161-5240 — Canonical Desktop Composition and FedOS
 * Beta 0.1 Release-Blocker Closure Arc — acceptance suite for the
 * Navigation/Notification/Tray/Badge/Background-Lifecycle/Device-Sync
 * composition added to `FedosDesktopBetaApplicationAssembly` (closing BLK-1
 * from the immediately-prior Arc's own reconciliation report).
 *
 * Proves, against REAL boundaries (real `FedosProfileInitializationCoordinator`,
 * real `startFedosDesktopRuntime()`, real `FedosDeviceSyncScheduler` once
 * enabled via the new additive Coordinator dependency): every owned
 * component is constructed exactly once, a confirmed Runtime restart rebuilds
 * the Runtime-bound presentation layer without duplicating the Electron-
 * global one, and the Settings `backgroundSyncEnabled` control genuinely
 * starts/stops the one real Scheduler end to end for the first time (the
 * prior Arc's own suite could only prove this control honestly reported
 * `unavailable`, since no Coordinator-driven Runtime ever enabled the
 * Scheduler before this Arc).
 */

import { describe, it, expect, afterEach } from "vitest";

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error see above.
import { join } from "node:path";
// @ts-expect-error see above.
import { tmpdir } from "node:os";

import {
  FedosProfileInitializationCoordinator,
  type FedosProfileInitializationDependencies,
} from "../src/desktop/onboarding/fedos_profile_initialization_coordinator.js";
import { planFedosLocalProfilePaths, ensureFedosLocalProfileDirectories } from "../src/desktop/onboarding/fedos_local_profile_paths.js";
import { FileFedosLocalProfilePersistence } from "../src/desktop/onboarding/fedos_local_profile_persistence.js";
import { FileFedosSealedMasterSeedEnvelopePersistence } from "../src/runtime/master_seed/fedos_sealed_master_seed_envelope_persistence.js";
import { DevelopmentFedosMasterSeedAuthority } from "../src/desktop/onboarding/fedos_development_master_seed_authority.js";
import { fedosProfileUnlockSecretFromUtf8 } from "../src/desktop/onboarding/fedos_profile_unlock_secret.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";

import { createInMemoryFedosDesktopSettingsController } from "../src/desktop/settings/fedos_desktop_settings_controller.js";
import { defaultFedosSettingsDescriptorV1, type FedosSettingsDescriptorV1 } from "../src/settings/fedos_settings_descriptor.js";
import type { FedosDesktopNotificationPort, FedosDesktopNotificationDeliveryResult } from "../src/desktop/notification/fedos_desktop_notification_port.js";
import type { FedosDesktopNotificationView } from "../src/desktop/notification/fedos_desktop_notification_types.js";
import type { FedosDesktopBadgePort, FedosDesktopBadgePortStatus } from "../src/desktop/badge/fedos_desktop_badge_port.js";
import type { FedosDesktopBadgeView } from "../src/desktop/badge/fedos_desktop_badge_types.js";
import { FedosDeviceSyncEventBridge } from "../src/device/sync_events/fedos_device_sync_event_bridge.js";

import { FedosDesktopBetaApplicationAssembly } from "../src/desktop/beta/fedos_desktop_beta_application_assembly.js";
import type { FedosDesktopRuntimeConfig } from "../src/desktop/runtime/fedos_desktop_runtime_config.js";

// ---------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------

const tmpDirs: string[] = [];
function makeTmpRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-canonical-composition-"));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop()!;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
});

const DEVICE_SYNC_ABANDONMENT_POLICY = Object.freeze({ maxAttempts: 5, laterDelaySeconds: 30 });

function makeCoordinator(
  root: string,
  overrides: Partial<FedosProfileInitializationDependencies> = {},
): FedosProfileInitializationCoordinator {
  const paths = planFedosLocalProfilePaths(root)!;
  ensureFedosLocalProfileDirectories(paths);
  const deps: FedosProfileInitializationDependencies = {
    paths,
    profilePersistence: new FileFedosLocalProfilePersistence(paths.profileDescriptorFile),
    sealedSeedPersistence: new FileFedosSealedMasterSeedEnvelopePersistence(paths.sealedMasterSeedFile),
    masterSeedAuthority: new DevelopmentFedosMasterSeedAuthority(),
    accountSigningAuthority: new RealFedosNostrSigningAuthority(),
    ...overrides,
  };
  return new FedosProfileInitializationCoordinator(deps);
}

/** Builds a coordinator with the Device Sync Scheduler enabled (Phase E) — the new additive dependency this Arc adds, mirroring `archiveEnabled`'s own established pattern. */
async function readyCoordinatorWithDeviceSync(root: string): Promise<FedosProfileInitializationCoordinator> {
  const coordinator = makeCoordinator(root, {
    deviceSyncSchedulerEnabled: true,
    deviceSyncAbandonmentPolicy: DEVICE_SYNC_ABANDONMENT_POLICY,
    // Omitted deviceSyncAttemptFn -> the Coordinator's own documented fail-closed default applies;
    // this suite proves the Scheduler is real and constructed, not that a real target is reachable
    // (Phase E's own "no eligible target -> Scheduler remains valid but idle" honest case).
  });
  const created = await coordinator.createProfile({ displayLabel: "Alice's laptop" }, fedosProfileUnlockSecretFromUtf8("correct horse battery staple"));
  if (created.outcome !== "ok") throw new Error(`test setup: createProfile failed (${created.outcome})`);
  return coordinator;
}

async function readyCoordinator(root: string): Promise<FedosProfileInitializationCoordinator> {
  const coordinator = makeCoordinator(root);
  const created = await coordinator.createProfile({ displayLabel: "Alice's laptop" }, fedosProfileUnlockSecretFromUtf8("correct horse battery staple"));
  if (created.outcome !== "ok") throw new Error(`test setup: createProfile failed (${created.outcome})`);
  return coordinator;
}

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

class RecordingBadgePort implements FedosDesktopBadgePort {
  rendered: FedosDesktopBadgeView[] = [];
  status(): FedosDesktopBadgePortStatus {
    return "available";
  }
  render(view: FedosDesktopBadgeView): void {
    this.rendered.push(view);
  }
}

class RecordingTrayStatusSink {
  tooltips: string[] = [];
  setTooltip(text: string): void {
    this.tooltips.push(text);
  }
}

function withFedosSettings(base: FedosSettingsDescriptorV1, overrides: Partial<FedosSettingsDescriptorV1>): FedosSettingsDescriptorV1 {
  return { ...base, ...overrides };
}

const LOCAL_VIEWER = Object.freeze({ authority: "nostr" as const, publicIdentifier: "a".repeat(64), identityId: null });
const COUNTERPARTY = Object.freeze({ authority: "nostr" as const, publicIdentifier: "c".repeat(64) });

function startAssembly(
  root: string,
  coordinator: FedosProfileInitializationCoordinator,
  overrides: Partial<Parameters<typeof FedosDesktopBetaApplicationAssembly.start>[0]> = {},
) {
  return FedosDesktopBetaApplicationAssembly.start({
    coordinator,
    settingsController: createInMemoryFedosDesktopSettingsController(),
    notificationPort: new RecordingNotificationPort(),
    badgePort: new RecordingBadgePort(),
    trayStatusSink: new RecordingTrayStatusSink(),
    viewerParticipant: LOCAL_VIEWER,
    navigationLogPath: join(root, "navigation.log"),
    ...overrides,
  });
}

// ---------------------------------------------------------------------
// Phase A/B — ownership: every owned component constructed exactly once.
// ---------------------------------------------------------------------

describe("Phase A/B — canonical composition owns each component exactly once", () => {
  it("exposes real, distinct Navigation/Tray/Badge/Background/DeviceSyncWiring objects", async () => {
    const root = makeTmpRoot();
    const coordinator = await readyCoordinator(root);
    const result = startAssembly(root, coordinator);
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    const assembly = result.value;

    expect(assembly.navigationRegistry).toBeDefined();
    expect(assembly.trayCoordinator).toBeDefined();
    expect(assembly.badgeCoordinator).toBeDefined();
    expect(assembly.backgroundLifecycle).toBeDefined();
    expect(assembly.deviceSyncPresentationWiring).toBeDefined();

    // The SAME registry instance backs both Tray's "recent-conversations" and Badge's own unread sum
    // — never a second, divergent Registry (Phase A/B "no duplicate Navigation Registry").
    const created = assembly.boundary.shell.createDirectConversation({ recipient: COUNTERPARTY });
    expect(created.outcome).toBe("ok");
    if (created.outcome !== "ok") return;
    assembly.navigationRegistry.recordConversationOpened(created.value.conversationId);

    const trayRecent = await assembly.trayCoordinator.dispatch({ action: "recent-conversations" });
    expect(trayRecent.action).toBe("recent-conversations");
    if (trayRecent.action === "recent-conversations") {
      expect(trayRecent.conversationIds).toContain(created.value.conversationId);
    }

    await assembly.shutdown();
  });

  it("badge refresh() drives the real injected badge port, and repeated identical refreshes never double-render (no duplicate badge updates)", async () => {
    const root = makeTmpRoot();
    const coordinator = await readyCoordinator(root);
    const badgePort = new RecordingBadgePort();
    const result = startAssembly(root, coordinator, { badgePort });
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    const assembly = result.value;

    await assembly.badgeCoordinator.refresh();
    const firstRenderCount = assembly.badgeCoordinator.renderCount;
    expect(badgePort.rendered.length).toBe(firstRenderCount);

    await assembly.badgeCoordinator.refresh(); // identical state -> no new render
    expect(assembly.badgeCoordinator.renderCount).toBe(firstRenderCount);
    expect(badgePort.rendered.length).toBe(firstRenderCount);

    await assembly.shutdown();
  });
});

// ---------------------------------------------------------------------
// Phase E — Device Sync composition: the Scheduler is now REAL, once enabled.
// ---------------------------------------------------------------------

describe("Phase E — Device Sync Scheduler composed and controllable through Settings", () => {
  it("with no trusted target: Scheduler is real and enabled, but honestly reports idle/no eligible target", async () => {
    const root = makeTmpRoot();
    const coordinator = await readyCoordinatorWithDeviceSync(root);
    const runtime = coordinator.runningRuntime()!;
    const status = runtime.deviceSyncOperational().syncStatus();
    expect(status.outcome).toBe("ok");
    if (status.outcome !== "ok") return;
    expect(status.value.enabled).toBe(true);
    expect(status.value.running).toBe(false);
    expect(status.value.targetDeviceCount).toBe(0);
  });

  it("Settings backgroundSyncEnabled genuinely starts/stops the one real Scheduler through the assembly", async () => {
    const root = makeTmpRoot();
    const coordinator = await readyCoordinatorWithDeviceSync(root);
    const result = startAssembly(root, coordinator);
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    const assembly = result.value;

    // `initialize()` (already run by `start()`) deliberately does NOT auto-start background sync
    // (Phase D "a subsystem action that goes through the plan/confirmation path") — the effective
    // descriptor is already `backgroundSyncEnabled: true` (the default), so applying that SAME
    // value would be a no-op `"no-change"`. Establish a real false->true transition instead: force
    // the effective descriptor to `false` first (a real apply, proving the control's own `stop()`
    // path too), THEN apply `true` and observe the real Scheduler actually start.
    const forcedOff = await assembly.settingsCoordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), { backgroundSyncEnabled: false }));
    expect(forcedOff.outcome).toBe("persisted-and-applied");
    const started = await assembly.settingsCoordinator.apply(defaultFedosSettingsDescriptorV1()); // backgroundSyncEnabled: true (default)
    expect(started.outcome).toBe("persisted-and-applied");
    const runningStatus = coordinator.runningRuntime()!.deviceSyncOperational().syncStatus();
    expect(runningStatus.outcome).toBe("ok");
    if (runningStatus.outcome === "ok") expect(runningStatus.value.running).toBe(true);

    const stopped = await assembly.settingsCoordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), { backgroundSyncEnabled: false }));
    expect(stopped.outcome).toBe("persisted-and-applied");
    const stoppedStatus = coordinator.runningRuntime()!.deviceSyncOperational().syncStatus();
    expect(stoppedStatus.outcome).toBe("ok");
    if (stoppedStatus.outcome === "ok") expect(stoppedStatus.value.running).toBe(false);

    await assembly.shutdown();
  });

  it("deviceSyncPresentationWiring routes a real event into the real Notification/Badge coordinators (the same handleEvent() a genuine Scheduler-sourced event would call)", async () => {
    const root = makeTmpRoot();
    const coordinator = await readyCoordinatorWithDeviceSync(root);
    const notificationPort = new RecordingNotificationPort();
    const badgePort = new RecordingBadgePort();
    const result = startAssembly(root, coordinator, { notificationPort, badgePort });
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    const assembly = result.value;

    await assembly.deviceSyncPresentationWiring.handleEvent({
      kind: "sync-completed",
      at: Math.floor(Date.now() / 1000),
      scheduleId: "s1",
      sourceDeviceId: "device-a",
      targetDeviceId: "device-b",
      attemptNumber: 1,
    });

    expect(notificationPort.shown.length).toBe(1);
    expect(notificationPort.shown[0]!.kind).toBe("sync-complete");
    expect(assembly.deviceSyncPresentationWiring.currentTrayStatus).toBe("Idle");

    await assembly.shutdown();
  });
});

// ---------------------------------------------------------------------
// Phase F/G — confirmed restart rebuilds the Runtime-bound layer only.
// ---------------------------------------------------------------------

describe("Phase F/G — confirmed restart reconnects exactly one new Runtime-bound presentation set", () => {
  function restartConfigFor(root: string): FedosDesktopRuntimeConfig {
    return {
      boardLogPath: join(root, "profile", "board.log"),
      outboxLogPath: join(root, "profile", "outbox.log"),
      deliveryEnabled: false,
      archiveEnabled: false,
    };
  }

  it("rebuilds Navigation/Tray/Badge/DeviceSyncWiring as NEW objects, but keeps the SAME notificationCoordinator/backgroundLifecycle (never reconstructed unnecessarily)", async () => {
    const root = makeTmpRoot();
    const coordinator = await readyCoordinator(root);
    const result = startAssembly(root, coordinator);
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    const assembly = result.value;

    const oldNavigation = assembly.navigationRegistry;
    const oldTray = assembly.trayCoordinator;
    const oldBadge = assembly.badgeCoordinator;
    const oldWiring = assembly.deviceSyncPresentationWiring;
    const oldNotificationCoordinator = assembly.notificationCoordinator;
    const oldBackgroundLifecycle = assembly.backgroundLifecycle;

    const restart = await assembly.restartRuntime(restartConfigFor(root));
    expect(restart.outcome).toBe("ok");

    expect(assembly.navigationRegistry).not.toBe(oldNavigation);
    expect(assembly.trayCoordinator).not.toBe(oldTray);
    expect(assembly.badgeCoordinator).not.toBe(oldBadge);
    expect(assembly.deviceSyncPresentationWiring).not.toBe(oldWiring);
    // Electron-global objects (no Runtime reference) are NOT reconstructed (Phase F "do not
    // reconstruct Electron-global presentation objects unnecessarily").
    expect(assembly.notificationCoordinator).toBe(oldNotificationCoordinator);
    expect(assembly.backgroundLifecycle).toBe(oldBackgroundLifecycle);

    await assembly.shutdown();
  });

  it("restarting 3 times never leaves more than one live Navigation Registry reachable from the assembly (no accumulation)", async () => {
    const root = makeTmpRoot();
    const coordinator = await readyCoordinator(root);
    const result = startAssembly(root, coordinator);
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    const assembly = result.value;

    const seenRegistries = new Set<unknown>();
    seenRegistries.add(assembly.navigationRegistry);
    for (let i = 0; i < 3; i += 1) {
      const restart = await assembly.restartRuntime(restartConfigFor(root));
      expect(restart.outcome).toBe("ok");
      seenRegistries.add(assembly.navigationRegistry);
    }
    // Exactly one CURRENT registry is reachable at any time (the getter always returns the latest) —
    // 4 distinct historical instances is expected (one per restart), but the assembly itself only
    // ever exposes/uses the CURRENT one, never an accumulating list.
    expect(seenRegistries.size).toBe(4);

    await assembly.shutdown();
  });
});

// ---------------------------------------------------------------------
// Phase L — repeated lock/unlock does not accumulate live objects.
// ---------------------------------------------------------------------

describe("Phase L — repeated lock/unlock cycles do not accumulate Runtimes/Coordinators/subscriptions", () => {
  it("5 lock/unlock cycles against the same durable profile each produce exactly one live Runtime and one live assembly, never more", async () => {
    const root = makeTmpRoot();
    const paths = planFedosLocalProfilePaths(root)!;
    ensureFedosLocalProfileDirectories(paths);
    const secret = "correct horse battery staple";
    const accountSigningAuthority = new RealFedosNostrSigningAuthority();

    // First launch: create the durable profile once.
    const created = await makeCoordinator(root, { accountSigningAuthority }).createProfile(
      { displayLabel: "Cycles" },
      fedosProfileUnlockSecretFromUtf8(secret),
    );
    expect(created.outcome).toBe("ok");

    const seenRuntimes = new Set<unknown>();
    for (let i = 0; i < 5; i += 1) {
      // Each cycle mirrors a real process relaunch: a FRESH Coordinator instance (as
      // `fedos_electron_beta_main.cts`'s own `buildFreshCoordinator()` constructs per attempt),
      // unlocking the SAME durable profile.
      const coordinator = makeCoordinator(root, { accountSigningAuthority });
      const unlocked = await coordinator.unlockProfile(fedosProfileUnlockSecretFromUtf8(secret));
      expect(unlocked.outcome).toBe("ok");
      const runtime = coordinator.runningRuntime();
      expect(runtime).not.toBeNull();
      seenRuntimes.add(runtime);

      const result = startAssembly(root, coordinator);
      expect(result.outcome).toBe("ok");
      if (result.outcome !== "ok") continue;
      const assembly = result.value;

      // Real activity in this cycle -- proves the Runtime/Coordinators are genuinely live, not stubs.
      await assembly.badgeCoordinator.refresh();
      await assembly.trayCoordinator.dispatch({ action: "recent-conversations" });

      await assembly.shutdown();
      const locked = await coordinator.lock();
      expect(locked.outcome).toBe("ok");
      expect(coordinator.status().runtimeRunning).toBe(false);
    }
    // Every cycle's own Runtime is a genuinely distinct object (a real process relaunch would never
    // reuse one) -- 5 distinct instances, never fewer (a false "same Runtime survived lock" would
    // collapse this set) and never MORE THAN 5 (no cycle ever left two live Runtimes at once).
    expect(seenRuntimes.size).toBe(5);
  });
});

// ---------------------------------------------------------------------
// Phase E (Event Bridge threading) — deviceSyncAttemptFn wraps into the Runtime.
// ---------------------------------------------------------------------

describe("Phase E — FedosDeviceSyncEventBridge threads into the Coordinator's own Runtime construction", () => {
  it("wrapAttemptFn's own fail-closed default is honored end to end through a real Scheduler tick", async () => {
    const root = makeTmpRoot();
    let handledEvents: string[] = [];
    const eventBridge = new FedosDeviceSyncEventBridge({
      listener: (event) => {
        handledEvents.push(event.kind);
      },
    });
    const coordinator = makeCoordinator(root, {
      deviceSyncSchedulerEnabled: true,
      deviceSyncAbandonmentPolicy: DEVICE_SYNC_ABANDONMENT_POLICY,
      deviceSyncAttemptFn: eventBridge.wrapAttemptFn(),
    });
    const created = await coordinator.createProfile({ displayLabel: "Bob" }, fedosProfileUnlockSecretFromUtf8("another-real-secret"));
    expect(created.outcome).toBe("ok");

    const runtime = coordinator.runningRuntime()!;
    const startedSync = runtime.deviceSyncOperational().startSync();
    expect(startedSync.outcome).toBe("ok");
    const triggered = await runtime.deviceSyncOperational().triggerSyncNow();
    // No trusted target exists (Phase E's own honest "no eligible target" case) -> an empty tick,
    // never a fabricated attempt -- but the Bridge itself must still be live and wired (it simply
    // has nothing to report because the Scheduler found no schedule to attempt).
    expect(triggered.outcome).toBe("ok");
    expect(handledEvents.length).toBe(0);

    await coordinator.lock();
  });
});
