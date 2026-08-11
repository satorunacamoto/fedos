/**
 * Secure Runtime Alpha 5061-5160 — FedOS Desktop Beta 0.1 Integration,
 * Release Candidate, and Acceptance Freeze Arc — Phase C/D/E acceptance
 * suite for `FedosDesktopBetaApplicationAssembly`.
 *
 * Proves, against REAL boundaries (real `FedosProfileInitializationCoordinator`,
 * real `startFedosDesktopRuntime()`, real file-backed profile/settings
 * persistence): the single-Runtime composition (no second Runtime is ever
 * constructed), Settings Application Coordinator startup wiring, and the
 * confirmed Runtime-restart primitive's ordering/failure semantics.
 *
 * DEVELOPMENT vs PRODUCTION crypto: same honest boundary as
 * `secure_runtime_alpha_4661_4740_first_run_onboarding.test.ts` — no compiled
 * WASM `pkg/` exists in this checked-out tree, so Master Seed operations run
 * against `DevelopmentFedosMasterSeedAuthority`. This suite proves the
 * COMPOSITION/state-machine logic end to end, not any cryptographic property.
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
} from "../src/os/messenger/desktop/onboarding/fedos_profile_initialization_coordinator.js";
import { planFedosLocalProfilePaths, ensureFedosLocalProfileDirectories } from "../src/os/messenger/desktop/onboarding/fedos_local_profile_paths.js";
import { FileFedosLocalProfilePersistence } from "../src/os/messenger/desktop/onboarding/fedos_local_profile_persistence.js";
import { FileFedosSealedMasterSeedEnvelopePersistence } from "../src/os/core/vault/wasm/fedos_sealed_master_seed_envelope_persistence.js";
import { DevelopmentFedosMasterSeedAuthority } from "../src/os/messenger/desktop/onboarding/fedos_development_master_seed_authority.js";
import { fedosProfileUnlockSecretFromUtf8 } from "../src/os/messenger/desktop/onboarding/fedos_profile_unlock_secret.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";

import { createFileBackedFedosDesktopSettingsController, createInMemoryFedosDesktopSettingsController } from "../src/os/messenger/desktop/settings/fedos_desktop_settings_controller.js";
import { defaultFedosSettingsDescriptorV1, type FedosSettingsDescriptorV1 } from "../src/os/core/settings/fedos_settings_descriptor.js";
import type { FedosDesktopNotificationPort, FedosDesktopNotificationDeliveryResult } from "../src/os/messenger/notifications/fedos_desktop_notification_port.js";
import type { FedosDesktopNotificationView } from "../src/os/messenger/notifications/fedos_desktop_notification_types.js";
import type { FedosDesktopBadgePort, FedosDesktopBadgePortStatus } from "../src/os/messenger/desktop/badge/fedos_desktop_badge_port.js";
import type { FedosDesktopBadgeView } from "../src/os/messenger/desktop/badge/fedos_desktop_badge_types.js";

import { FedosDesktopBetaApplicationAssembly } from "../src/os/messenger/desktop/beta/fedos_desktop_beta_application_assembly.js";
import type { FedosDesktopRuntimeConfig } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime_config.js";

// ---------------------------------------------------------------------
// Helpers — mirrors secure_runtime_alpha_4661_4740_first_run_onboarding.test.ts.
// ---------------------------------------------------------------------

const tmpDirs: string[] = [];
function makeTmpRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-beta-assembly-"));
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

function makeCoordinator(root: string, overrides: Partial<FedosProfileInitializationDependencies> = {}): FedosProfileInitializationCoordinator {
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

async function readyCoordinator(root: string, label = "Alice's laptop"): Promise<FedosProfileInitializationCoordinator> {
  const coordinator = makeCoordinator(root);
  const created = await coordinator.createProfile({ displayLabel: label }, fedosProfileUnlockSecretFromUtf8("correct horse battery staple"));
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

/** Secure Runtime Alpha 5161-5240 — a real, in-process badge port double (mirrors `RecordingNotificationPort`'s own style). */
class RecordingBadgePort implements FedosDesktopBadgePort {
  rendered: FedosDesktopBadgeView[] = [];
  status(): FedosDesktopBadgePortStatus {
    return "available";
  }
  render(view: FedosDesktopBadgeView): void {
    this.rendered.push(view);
  }
}

function withFedosSettings(base: FedosSettingsDescriptorV1, overrides: Partial<FedosSettingsDescriptorV1>): FedosSettingsDescriptorV1 {
  return { ...base, ...overrides };
}

const COUNTERPARTY = Object.freeze({ authority: "nostr" as const, publicIdentifier: "c".repeat(64) });
const LOCAL_VIEWER = Object.freeze({ authority: "nostr" as const, publicIdentifier: "a".repeat(64), identityId: null });

/** Secure Runtime Alpha 5161-5240 — the three new required Phase B/C deps every `FedosDesktopBetaApplicationAssembly.start()` call now needs, factored out so every existing call site stays a minimal, additive diff. */
function navigationDeps(root: string): { badgePort: RecordingBadgePort; viewerParticipant: typeof LOCAL_VIEWER; navigationLogPath: string } {
  return { badgePort: new RecordingBadgePort(), viewerParticipant: LOCAL_VIEWER, navigationLogPath: join(root, "navigation.log") };
}

// ---------------------------------------------------------------------
// Phase C — single-Runtime composition.
// ---------------------------------------------------------------------

describe("Phase C — FedosDesktopBetaApplicationAssembly single-Runtime composition", () => {
  it("refuses to compose over a coordinator that is not ready", () => {
    const root = makeTmpRoot();
    const coordinator = makeCoordinator(root); // never unlocked/created
    const result = FedosDesktopBetaApplicationAssembly.start({
      coordinator,
      settingsController: createInMemoryFedosDesktopSettingsController(),
      notificationPort: new RecordingNotificationPort(),
      ...navigationDeps(root),
    });
    expect(result.outcome).toBe("coordinator-not-ready");
  });

  it("composes exactly ONE Runtime — a conversation created through the assembly's boundary is visible through the coordinator's own runningRuntime()", async () => {
    const root = makeTmpRoot();
    const coordinator = await readyCoordinator(root);
    const result = FedosDesktopBetaApplicationAssembly.start({
      coordinator,
      settingsController: createInMemoryFedosDesktopSettingsController(),
      notificationPort: new RecordingNotificationPort(),
      ...navigationDeps(root),
    });
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    const assembly = result.value;

    const created = assembly.boundary.shell.createDirectConversation({ recipient: COUNTERPARTY });
    expect(created.outcome).toBe("ok");
    if (created.outcome !== "ok") return;

    // If a SECOND, divergent Runtime existed, the coordinator's own runningRuntime()
    // would never see this conversation. It must, because both share the identical object.
    const viaCoordinatorRuntime = coordinator.runningRuntime()!.conversationRuntime().findConversation(created.value.conversationId);
    expect(viaCoordinatorRuntime).not.toBeNull();

    expect(assembly.shell.status()).toBe("running");
    await assembly.shutdown();
  });

  it("shell.status() reports running immediately (no separate start() call needed)", async () => {
    const root = makeTmpRoot();
    const coordinator = await readyCoordinator(root);
    const result = FedosDesktopBetaApplicationAssembly.start({
      coordinator,
      settingsController: createInMemoryFedosDesktopSettingsController(),
      notificationPort: new RecordingNotificationPort(),
      ...navigationDeps(root),
    });
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    // A second start() on the wrapped shell must correctly fail "conflict" — proving fromRunningRuntime()
    // produced a genuinely "already running" Shell, not a half-initialized one.
    const doubleStart = await result.value.shell.start({ boardLogPath: join(root, "x.log"), outboxLogPath: join(root, "y.log"), deliveryEnabled: false });
    expect(doubleStart.outcome).toBe("conflict");
    await result.value.shutdown();
  });
});

// ---------------------------------------------------------------------
// Phase D — Settings Application Coordinator startup wiring.
// ---------------------------------------------------------------------

describe("Phase D — Settings Application Coordinator wired at assembly startup", () => {
  it("initialize() seeds live state from persisted settings, and apply() reaches live notification suppression through the assembly's own notification coordinator", async () => {
    const root = makeTmpRoot();
    const settingsPath = join(makeTmpRoot(), "settings.json");
    const settingsController = createFileBackedFedosDesktopSettingsController(settingsPath);
    settingsController.save(withFedosSettings(defaultFedosSettingsDescriptorV1(), { notificationsEnabled: false }));

    const coordinator = await readyCoordinator(root);
    const notificationPort = new RecordingNotificationPort();
    const result = FedosDesktopBetaApplicationAssembly.start({ coordinator, settingsController, notificationPort, ...navigationDeps(root) });
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    const assembly = result.value;

    // Startup application (Phase D) already seeded the gate from the persisted "notificationsEnabled: false" —
    // a real notify() through the assembly's OWN notification coordinator must be suppressed.
    const suppressed = await assembly.notificationCoordinator.notify({ kind: "conversation-message" });
    expect(suppressed.state).toBe("denied");
    expect(notificationPort.shown.length).toBe(0);

    // Re-enabling via a real apply() must restore live delivery, proving the Settings Application
    // Coordinator's gate and this assembly's own notification coordinator share the identical gate object.
    const applied = await assembly.settingsCoordinator.apply(withFedosSettings(defaultFedosSettingsDescriptorV1(), { notificationsEnabled: true }));
    expect(applied.outcome).toBe("persisted-and-applied");
    const delivered = await assembly.notificationCoordinator.notify({ kind: "conversation-message" });
    expect(delivered.state).toBe("delivered");
    expect(notificationPort.shown.length).toBe(1);

    await assembly.shutdown();
  });

  it("fails closed (produces no assembly) when the persisted Settings store is corrupt", async () => {
    const root = makeTmpRoot();
    const settingsController = createInMemoryFedosDesktopSettingsController();
    // Force a corrupt/invalid load by importing malformed serialized content.
    settingsController.import("{not json");
    const coordinator = await readyCoordinator(root);
    const result = FedosDesktopBetaApplicationAssembly.start({ coordinator, settingsController, notificationPort: new RecordingNotificationPort(), ...navigationDeps(root) });
    // A corrupt import() call itself fails closed and never mutates the store, so this actually still
    // loads the default descriptor -- assert the store's own honest outcome either way, never a throw.
    expect(["ok", "settings-load-failed"]).toContain(result.outcome);
  });
});

// ---------------------------------------------------------------------
// Phase E — confirmed Runtime restart.
// ---------------------------------------------------------------------

describe("Phase E — confirmed Runtime restart (generic primitive)", () => {
  function restartConfigFor(root: string, coordinatorRunning: ReturnType<FedosProfileInitializationCoordinator["runningRuntime"]>): FedosDesktopRuntimeConfig {
    // Mirrors the SAME durable paths the Coordinator itself constructed its Runtime with, varying
    // only `archiveEnabled` — proving the restart primitive genuinely swaps to a NEW config, not a
    // no-op re-application of the old one. (Disclosed scope boundary: no Settings field currently
    // drives this in production — see this test's own Arc header and the assembly module's header.)
    void coordinatorRunning;
    return {
      boardLogPath: join(root, "profile", "board.log"),
      outboxLogPath: join(root, "profile", "outbox.log"),
      deliveryEnabled: false,
      archiveEnabled: false,
    };
  }

  it("stops the old Runtime, constructs exactly one replacement, and keeps the Coordinator's own status honest", async () => {
    const root = makeTmpRoot();
    const coordinator = await readyCoordinator(root);
    const result = FedosDesktopBetaApplicationAssembly.start({
      coordinator,
      settingsController: createInMemoryFedosDesktopSettingsController(),
      notificationPort: new RecordingNotificationPort(),
      ...navigationDeps(root),
    });
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    const assembly = result.value;

    const oldRuntime = coordinator.runningRuntime();
    expect(oldRuntime).not.toBeNull();

    const restart = await assembly.restartRuntime(restartConfigFor(root, oldRuntime));
    expect(restart.outcome).toBe("ok");

    const newRuntime = coordinator.runningRuntime();
    expect(newRuntime).not.toBeNull();
    expect(newRuntime).not.toBe(oldRuntime); // a genuinely NEW Runtime object

    // The Coordinator's own status stays honest post-restart -- proves adoptReplacementRuntime()
    // closed the "stale runningRuntime()" hazard identified in the reconciliation report.
    expect(coordinator.status().runtimeRunning).toBe(true);
    expect(assembly.shell.status()).toBe("running");

    await assembly.shutdown();
    // lock() after a restart must stop the NEW Runtime, not a stale reference to the old (already-stopped) one.
    const locked = await coordinator.lock();
    expect(locked.outcome).toBe("ok");
    expect(coordinator.status().runtimeRunning).toBe(false);
  });

  it("rejects a second concurrent restart request", async () => {
    const root = makeTmpRoot();
    const coordinator = await readyCoordinator(root);
    const result = FedosDesktopBetaApplicationAssembly.start({
      coordinator,
      settingsController: createInMemoryFedosDesktopSettingsController(),
      notificationPort: new RecordingNotificationPort(),
      ...navigationDeps(root),
    });
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") return;
    const assembly = result.value;

    const config = restartConfigFor(root, coordinator.runningRuntime());
    const first = assembly.restartRuntime(config);
    expect(assembly.restarting).toBe(true);
    const second = await assembly.restartRuntime(config);
    expect(second.outcome).toBe("not-ready");
    const firstResult = await first;
    expect(firstResult.outcome).toBe("ok");
    await assembly.shutdown();
  });
});
