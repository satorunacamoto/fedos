/**
 * Secure Runtime Alpha 5061-5160 — FedOS Desktop Beta 0.1 Integration,
 * Release Candidate, and Acceptance Freeze Arc — Phase C/D/E: the ONE
 * canonical, framework-neutral application assembly.
 *
 * This closes the release-blocking gap the Phase A reconciliation report
 * documents: every prior Electron main (`packages/fedos-desktop-electron-spike/src/*_main.cts`)
 * either (a) constructs its own `FedosDesktopConversationUiPresentationBoundary`,
 * which starts its OWN `FedosRunningDesktopRuntime` via `FedosDesktopApplicationShell.start()`,
 * or (b) constructs `FedosProfileInitializationCoordinator`, which starts ITS
 * OWN Runtime internally during `unlockProfile()`/`createProfile()` — but no
 * file ever composed both, and doing so naively would construct TWO
 * independent Runtimes over the same durable paths (a real "duplicate Runtime
 * ownership" defect, not a stylistic one).
 *
 * This module wires the ONE Coordinator-owned Runtime into a
 * `FedosDesktopApplicationShell`/`FedosDesktopConversationUiPresentationBoundary`
 * pair via the two additive factories this Arc also adds
 * (`FedosDesktopApplicationShell.fromRunningRuntime()`,
 * `FedosDesktopConversationUiPresentationBoundary.fromShell()`) — no second
 * Runtime is ever constructed. It also wires the Alpha 4981-5060 Settings
 * Application Coordinator against that SAME boundary/runtime (Phase D), and
 * provides a generic, tested confirmed-Runtime-restart primitive (Phase E).
 *
 * OWNS NO ELECTRON, NO CRYPTO, NO SECRET. The caller (an Electron main, or a
 * test) supplies an ALREADY-UNLOCKED `FedosProfileInitializationCoordinator`
 * (`lifecycleState === "ready"`), a settings controller, and a notification
 * port; this module owns only the wiring between them.
 *
 * HONEST SCOPE BOUNDARY (Phase F/G, disclosed in the reconciliation report):
 * `FedosDesktopRuntimeConfig` (`../runtime/fedos_desktop_runtime_config.ts`)
 * has NO `relays`/`archiveDirectory` field — there is no existing plumbing
 * from the Settings descriptor's `relays`/`defaultRelay`/`archiveDirectory`
 * fields to a Runtime-construction input. `restartRuntime()` below is a real,
 * generic, tested "stop the one Runtime, construct exactly one replacement,
 * verify readiness" primitive for ANY future Runtime-construction-input
 * Setting — it is not, in this Arc, wired to a concrete Settings field, because
 * no such field's Runtime-side consumer exists yet in the accepted lineage.
 */

import {
  startFedosDesktopRuntime,
  type FedosRunningDesktopRuntime,
} from "../runtime/fedos_desktop_runtime.js";
import type { FedosDesktopRuntimeConfig } from "../runtime/fedos_desktop_runtime_config.js";
import { FedosDesktopApplicationShell } from "../shell/fedos_desktop_application_shell.js";
import { FedosDesktopConversationUiPresentationBoundary } from "../presentation/fedos_desktop_conversation_ui_presentation_boundary.js";
import type { FedosProfileInitializationCoordinator } from "../onboarding/fedos_profile_initialization_coordinator.js";
import type { FedosDesktopSettingsController } from "../settings/fedos_desktop_settings_controller.js";
import { FedosDesktopSettingsApplicationCoordinator } from "../settings/fedos_desktop_settings_application_coordinator.js";
import {
  InMemoryFedosSettingsPresentationSink,
  FedosSettingsNotificationPresentationGateHolder,
  GatedFedosDesktopNotificationPort,
  FacadeBackedFedosSettingsBackgroundSyncControl,
  type FedosSettingsBackgroundSyncFacadeLike,
} from "../settings/fedos_desktop_settings_application_ports.js";
import type { FedosDesktopNotificationPort } from "../notification/fedos_desktop_notification_port.js";
import { FedosDesktopNotificationCoordinator } from "../notification/fedos_desktop_notification_coordinator.js";

/** The coarse, closed outcome vocabulary for assembling the Beta application. Never a raw Error. */
export type FedosDesktopBetaAssemblyOutcome = "ok" | "coordinator-not-ready" | "settings-load-failed";

export type FedosDesktopBetaAssemblyResult =
  | { readonly outcome: "ok"; readonly value: FedosDesktopBetaApplicationAssembly }
  | { readonly outcome: Exclude<FedosDesktopBetaAssemblyOutcome, "ok">; readonly reason: string };

/** The closed outcome vocabulary for a confirmed Runtime restart (Phase E). Never a raw Error, never a false "ok" if two Runtimes could ever coexist. */
export type FedosDesktopBetaRuntimeRestartOutcome = "ok" | "not-ready" | "recovery-required";

export interface FedosDesktopBetaRuntimeRestartResult {
  readonly outcome: FedosDesktopBetaRuntimeRestartOutcome;
  readonly reason: string;
}

export interface FedosDesktopBetaApplicationAssemblyDeps {
  /** MUST already be `lifecycleState === "ready"` (a successful `unlockProfile()`/`createProfile()`), and MUST NOT be shared with any other assembly instance. */
  readonly coordinator: FedosProfileInitializationCoordinator;
  readonly settingsController: FedosDesktopSettingsController;
  /** The real, Electron-side (or test) notification backend. Wrapped by the Settings notification-presentation gate — never called directly by this assembly's own caller. */
  readonly notificationPort: FedosDesktopNotificationPort;
}

function ok<T>(value: T): { readonly outcome: "ok"; readonly value: T } {
  return { outcome: "ok", value };
}

/**
 * The ONE composed Beta application object: exactly one Shell/Boundary over
 * exactly one Coordinator-owned Runtime, plus the Settings Application
 * Coordinator wired against that same boundary. Construct via `start()`,
 * never directly.
 */
export class FedosDesktopBetaApplicationAssembly {
  readonly #coordinator: FedosProfileInitializationCoordinator;
  readonly #notificationPort: FedosDesktopNotificationPort;
  readonly #notificationGate: FedosSettingsNotificationPresentationGateHolder;
  readonly #settingsCoordinator: FedosDesktopSettingsApplicationCoordinator;
  readonly #notificationCoordinator: FedosDesktopNotificationCoordinator;
  #shell: FedosDesktopApplicationShell;
  #boundary: FedosDesktopConversationUiPresentationBoundary;
  #restarting = false;

  private constructor(
    coordinator: FedosProfileInitializationCoordinator,
    shell: FedosDesktopApplicationShell,
    boundary: FedosDesktopConversationUiPresentationBoundary,
    settingsController: FedosDesktopSettingsController,
    notificationPort: FedosDesktopNotificationPort,
  ) {
    this.#coordinator = coordinator;
    this.#shell = shell;
    this.#boundary = boundary;
    this.#notificationPort = notificationPort;
    this.#notificationGate = new FedosSettingsNotificationPresentationGateHolder(true);
    this.#notificationCoordinator = new FedosDesktopNotificationCoordinator(
      new GatedFedosDesktopNotificationPort(this.#notificationPort, this.#notificationGate),
    );
    this.#settingsCoordinator = new FedosDesktopSettingsApplicationCoordinator({
      controller: settingsController,
      presentationSink: new InMemoryFedosSettingsPresentationSink(),
      notificationGate: this.#notificationGate,
      backgroundSyncControl: new FacadeBackedFedosSettingsBackgroundSyncControl(this.#backgroundSyncFacade()),
    });
  }

  /**
   * Phase C/D — composes the ONE Shell/Boundary over the Coordinator's
   * already-running Runtime, then runs the Settings Application Coordinator's
   * own Phase D startup application (`initialize()`) so the process reflects
   * durable Settings from the first frame. Fails closed: a coordinator that
   * is not `ready`, or a corrupt Settings store, produces NO assembly (never
   * a half-wired one).
   */
  static start(deps: FedosDesktopBetaApplicationAssemblyDeps): FedosDesktopBetaAssemblyResult {
    const runtime = deps.coordinator.runningRuntime();
    if (runtime === null) {
      return { outcome: "coordinator-not-ready", reason: "coordinator.runningRuntime() is null; the profile must be unlocked/created first" };
    }
    const shell = FedosDesktopApplicationShell.fromRunningRuntime(runtime);
    const boundary = FedosDesktopConversationUiPresentationBoundary.fromShell(shell);
    const assembly = new FedosDesktopBetaApplicationAssembly(
      deps.coordinator,
      shell,
      boundary,
      deps.settingsController,
      deps.notificationPort,
    );
    const initialized = assembly.#settingsCoordinator.initialize();
    if (initialized.outcome !== "ok") {
      const reason = initialized.outcome === "invalid" ? `settings load failed: ${initialized.errors.join(", ")}` : `settings load failed: ${initialized.reason}`;
      return { outcome: "settings-load-failed", reason };
    }
    return ok(assembly);
  }

  get shell(): FedosDesktopApplicationShell {
    return this.#shell;
  }

  get boundary(): FedosDesktopConversationUiPresentationBoundary {
    return this.#boundary;
  }

  get settingsCoordinator(): FedosDesktopSettingsApplicationCoordinator {
    return this.#settingsCoordinator;
  }

  get notificationCoordinator(): FedosDesktopNotificationCoordinator {
    return this.#notificationCoordinator;
  }

  /** `true` while a confirmed restart is in flight — callers must reject a second concurrent restart request (Phase E "reject duplicate restart requests"). */
  get restarting(): boolean {
    return this.#restarting;
  }

  #backgroundSyncFacade(): FedosSettingsBackgroundSyncFacadeLike | null {
    const runtime = this.#coordinator.runningRuntime();
    if (runtime === null) return null;
    try {
      return runtime.deviceSyncOperational();
    } catch {
      // Device Sync Scheduler was not enabled on this Runtime's construction — honest "unavailable", never a fabricated facade.
      return null;
    }
  }

  /**
   * Phase E — a CONFIRMED (caller already obtained explicit user confirmation
   * for a previewed plan; this method performs no confirmation UX itself)
   * Runtime-only restart. Generic over `newConfig` — this Arc discloses that
   * no current Settings field (`relays`/`defaultRelay`/`archiveDirectory`)
   * has a corresponding `FedosDesktopRuntimeConfig` field to actually vary
   * `newConfig` with; this primitive is real and tested against ANY two
   * configs, for a future Arc closing that plumbing gap.
   *
   * Ordering (spec Phase E): stop background sync -> stop the current Runtime
   * -> construct exactly one replacement -> adopt it on the Coordinator (so
   * `coordinator.status()`/`runningRuntime()` never go stale) -> rebuild the
   * Shell/Boundary/Settings-application wiring over it. NEVER runs two
   * Runtimes at once: the old one is fully stopped before the new one is
   * constructed. On construction failure, this assembly is left in an honest
   * `recovery-required` state (Coordinator remains `ready`, but
   * `shell.status()` reports `"stopped"` and every Shell method fails closed
   * `"unavailable"`) — Runtime handles are one-shot, so a failed restart
   * cannot "restore" the old one; this is disclosed, not silently retried.
   */
  async restartRuntime(newConfig: FedosDesktopRuntimeConfig): Promise<FedosDesktopBetaRuntimeRestartResult> {
    if (this.#restarting) {
      return { outcome: "not-ready", reason: "a Runtime restart is already in progress" };
    }
    this.#restarting = true;
    try {
      const backgroundSyncControl = new FacadeBackedFedosSettingsBackgroundSyncControl(this.#backgroundSyncFacade());
      await backgroundSyncControl.stop();

      const stopped = await this.#shell.stop();
      if (stopped.outcome !== "ok") {
        return { outcome: "not-ready", reason: `stop-before-restart failed: ${stopped.reason}` };
      }

      let replacement: FedosRunningDesktopRuntime;
      try {
        replacement = await startFedosDesktopRuntime(newConfig);
      } catch {
        return { outcome: "recovery-required", reason: "replacement Runtime construction failed; no Runtime is currently running (old Runtime was already stopped and cannot be restored)" };
      }

      const adopted = this.#coordinator.adoptReplacementRuntime(replacement);
      if (adopted.outcome !== "ok") {
        // Coordinator is no longer `ready` (e.g. concurrently locked) — the replacement Runtime we
        // just built has no owner. Stop it immediately rather than leaking a live, unowned Runtime.
        await replacement.stop();
        return { outcome: "recovery-required", reason: `coordinator refused the replacement Runtime: ${adopted.reason}` };
      }

      this.#shell = FedosDesktopApplicationShell.fromRunningRuntime(replacement);
      this.#boundary = FedosDesktopConversationUiPresentationBoundary.fromShell(this.#shell);
      return { outcome: "ok", reason: "Runtime restarted" };
    } finally {
      this.#restarting = false;
    }
  }

  /** Clean shutdown (Phase U): stops background sync, then the one Runtime via the Shell. Idempotent-safe — a second call reports the Shell's own `"unavailable"`, never throws. */
  async shutdown(): Promise<void> {
    try {
      const backgroundSyncControl = new FacadeBackedFedosSettingsBackgroundSyncControl(this.#backgroundSyncFacade());
      await backgroundSyncControl.stop();
    } catch {
      /* best-effort */
    }
    await this.#shell.stop();
  }
}
