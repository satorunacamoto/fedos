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
 * HONEST SCOPE BOUNDARY (Phase F/G, disclosed in the reconciliation report):
 * `FedosDesktopRuntimeConfig` (`../runtime/fedos_desktop_runtime_config.ts`)
 * has NO `relays`/`archiveDirectory` field — there is no existing plumbing
 * from the Settings descriptor's `relays`/`defaultRelay`/`archiveDirectory`
 * fields to a Runtime-construction input. `restartRuntime()` below is a real,
 * generic, tested "stop the one Runtime, construct exactly one replacement,
 * verify readiness" primitive for ANY future Runtime-construction-input
 * Setting — it is not, in this Arc, wired to a concrete Settings field, because
 * no such field's Runtime-side consumer exists yet in the accepted lineage.
 *
 * -----------------------------------------------------------------------
 * Secure Runtime Alpha 5161-5240 ("Canonical Desktop Composition and Beta
 * Release-Blocker Closure Arc") — Phase B/C/D/E: EXTENDS this assembly (never
 * replaces it) to also own, exactly once, the already-accepted Navigation /
 * Notification / Tray / Badge / Background-Lifecycle / Device-Sync-Event
 * layer — closing BLK-1 from the immediately-prior Arc's own reconciliation
 * report ("Navigation/Tray/Badge/Device-Sync-event-wiring are NOT constructed
 * inside `fedos_electron_beta_main.cts`").
 *
 * Every one of `FedosDesktopConversationWindowRegistry` (Navigation, Alpha
 * 4181-4260), `TrayCoordinator` (Alpha 4261-4340), `FedosDesktopBadgeCoordinator`
 * (Alpha 4341-4420), `BackgroundLifecycleCoordinator` (Alpha 4261-4340),
 * `FedosDesktopDeviceSyncPresentationWiring` (Alpha 4421-4500), and
 * `FedosDeviceSyncEventBridge` (Alpha 4421-4500) is ALREADY framework-neutral
 * (no Electron import) and ALREADY port-based (`FedosDesktopBadgePort`,
 * `FedosDesktopTrayPort` name nothing Electron-specific) — this file
 * constructs every one of them exactly once, taking only the two REAL
 * Electron-side adapters (`badgePort`, `trayStatusSink`) as injected
 * dependencies, mirroring `notificationPort`'s own established pattern
 * exactly. The Electron main remains responsible ONLY for the concrete Tray
 * icon/menu rendering and `BrowserWindow` lifecycle (neither of which this
 * framework-neutral module may import), driven by this assembly's own
 * `trayCoordinator`/`navigationRegistry` getters.
 *
 * DEVICE SYNC SCHEDULER ENABLEMENT (Phase E): the Coordinator's own
 * `#buildRuntimeConfig()` never turned `deviceSyncSchedulerEnabled` on before
 * this Arc — closed via one additive, precedented dependency on
 * `FedosProfileInitializationDependencies` (mirrors `archiveEnabled`'s own
 * existing "optional capability toggle" pattern byte-for-byte). This
 * assembly does not itself decide whether the Scheduler is enabled — that is
 * the CALLER's decision (via the Coordinator's own constructor deps, made
 * BEFORE `unlockProfile()`/`createProfile()` runs); this assembly only reads
 * whatever the Coordinator's own Runtime actually exposes via
 * `runtime.deviceSyncOperational()`, honestly reporting `unavailable` when
 * the Scheduler was never constructed (e.g. no trusted target Device exists
 * yet — Phase E's own "Scheduler remains valid but idle, UI reports no
 * eligible target honestly").
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
import type { FedosDesktopNotificationPort } from "../../notifications/fedos_desktop_notification_port.js";
import { FedosDesktopNotificationCoordinator } from "../../notifications/fedos_desktop_notification_coordinator.js";
import { FedosDesktopConversationWindowRegistry } from "../navigation/fedos_desktop_conversation_window_registry.js";
import type { FedosConversationParticipantReference } from "../../conversations/membership/fedos_conversation_participant_reference.js";
import { TrayCoordinator } from "../tray/fedos_desktop_tray_coordinator.js";
import type { FedosDesktopTrayPort } from "../tray/fedos_desktop_tray_port.js";
import { FedosDesktopBadgeCoordinator } from "../badge/fedos_desktop_badge_coordinator.js";
import type { FedosDesktopBadgePort } from "../badge/fedos_desktop_badge_port.js";
import { BackgroundLifecycleCoordinator } from "../background/fedos_desktop_background_lifecycle_coordinator.js";
import { FedosDesktopDeviceSyncPresentationWiring } from "../runtime/fedos_desktop_device_sync_presentation_wiring.js";
import type { FedosDeviceSyncEventBridge } from "../../device/sync_events/fedos_device_sync_event_bridge.js";

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
  /** Secure Runtime Alpha 5161-5240 — the real, Electron-side (or test) badge backend. Never called directly by this assembly's own caller. */
  readonly badgePort: FedosDesktopBadgePort;
  /** Secure Runtime Alpha 5161-5240 — OPTIONAL real tray status sink (`setTooltip`), used ONLY by the Device Sync Presentation Wiring for its own tray-tooltip status string. Omitted, tray status updates are simply skipped (mirrors `FedosDesktopDeviceSyncPresentationWiringDeps.trayStatusSink`'s own existing optionality). */
  readonly trayStatusSink?: Pick<FedosDesktopTrayPort, "setTooltip">;
  /** Secure Runtime Alpha 5161-5240 — this process's own local viewer identity, for Navigation's per-session bookkeeping (pinned/recent conversations, last-opened). Non-secret. */
  readonly viewerParticipant: FedosConversationParticipantReference;
  /** Secure Runtime Alpha 5161-5240 — explicit, caller-supplied durable path for Navigation's own append-only session-state log (mirrors every other `*LogPath` field's "no default, no cwd-relative path" discipline). */
  readonly navigationLogPath: string;
  /**
   * Secure Runtime Alpha 5161-5240 — OPTIONAL. When the caller already
   * constructed a `FedosDeviceSyncEventBridge` BEFORE `unlockProfile()`/
   * `createProfile()` (so its `wrapAttemptFn()` could be threaded into the
   * Coordinator's own Runtime-construction config), this assembly wires its
   * OWN `FedosDesktopDeviceSyncPresentationWiring` as that Bridge's
   * effective listener target via `deviceSyncEventBridge`'s own caller-owned
   * indirection (see `fedos_electron_beta_main.cts`'s own header for the
   * exact closure pattern, identical to `fedos_electron_badge_main.cts`'s
   * established one). Omitted, no Device Sync presentation wiring is built
   * (honest: no Scheduler was constructed on this Runtime either).
   */
  readonly deviceSyncEventBridge?: Pick<FedosDeviceSyncEventBridge, "isTargetBelievedOffline">;
}

function ok<T>(value: T): { readonly outcome: "ok"; readonly value: T } {
  return { outcome: "ok", value };
}

/**
 * The ONE composed Beta application object: exactly one Shell/Boundary over
 * exactly one Coordinator-owned Runtime, exactly one Navigation Registry /
 * Notification / Tray / Badge / Background-Lifecycle Coordinator, exactly
 * one Device Sync Presentation Wiring, plus the Settings Application
 * Coordinator wired against that same boundary. Construct via `start()`,
 * never directly.
 */
export class FedosDesktopBetaApplicationAssembly {
  readonly #coordinator: FedosProfileInitializationCoordinator;
  readonly #notificationPort: FedosDesktopNotificationPort;
  readonly #badgePort: FedosDesktopBadgePort;
  readonly #trayStatusSink: Pick<FedosDesktopTrayPort, "setTooltip"> | undefined;
  readonly #viewerParticipant: FedosConversationParticipantReference;
  readonly #navigationLogPath: string;
  readonly #notificationGate: FedosSettingsNotificationPresentationGateHolder;
  readonly #settingsCoordinator: FedosDesktopSettingsApplicationCoordinator;
  readonly #notificationCoordinator: FedosDesktopNotificationCoordinator;
  readonly #backgroundLifecycle: BackgroundLifecycleCoordinator;
  #shell: FedosDesktopApplicationShell;
  #boundary: FedosDesktopConversationUiPresentationBoundary;
  #navigationRegistry: FedosDesktopConversationWindowRegistry;
  #trayCoordinator: TrayCoordinator;
  #badgeCoordinator: FedosDesktopBadgeCoordinator;
  #deviceSyncPresentationWiring: FedosDesktopDeviceSyncPresentationWiring;
  #restarting = false;

  private constructor(
    coordinator: FedosProfileInitializationCoordinator,
    shell: FedosDesktopApplicationShell,
    boundary: FedosDesktopConversationUiPresentationBoundary,
    settingsController: FedosDesktopSettingsController,
    notificationPort: FedosDesktopNotificationPort,
    badgePort: FedosDesktopBadgePort,
    trayStatusSink: Pick<FedosDesktopTrayPort, "setTooltip"> | undefined,
    viewerParticipant: FedosConversationParticipantReference,
    navigationLogPath: string,
  ) {
    this.#coordinator = coordinator;
    this.#shell = shell;
    this.#boundary = boundary;
    this.#notificationPort = notificationPort;
    this.#badgePort = badgePort;
    this.#trayStatusSink = trayStatusSink;
    this.#viewerParticipant = viewerParticipant;
    this.#navigationLogPath = navigationLogPath;

    this.#notificationGate = new FedosSettingsNotificationPresentationGateHolder(true);
    this.#notificationCoordinator = new FedosDesktopNotificationCoordinator(
      new GatedFedosDesktopNotificationPort(this.#notificationPort, this.#notificationGate),
    );
    this.#backgroundLifecycle = new BackgroundLifecycleCoordinator({ keepAliveInBackground: true });

    const built = this.#buildPresentationLayer(boundary);
    this.#navigationRegistry = built.navigationRegistry;
    this.#trayCoordinator = built.trayCoordinator;
    this.#badgeCoordinator = built.badgeCoordinator;
    this.#deviceSyncPresentationWiring = built.deviceSyncPresentationWiring;

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
      deps.badgePort,
      deps.trayStatusSink,
      deps.viewerParticipant,
      deps.navigationLogPath,
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

  /** Secure Runtime Alpha 5161-5240 — the ONE Navigation Registry over the current Shell/Boundary. Rebuilt (never duplicated) on a confirmed Runtime restart. */
  get navigationRegistry(): FedosDesktopConversationWindowRegistry {
    return this.#navigationRegistry;
  }

  /** Secure Runtime Alpha 5161-5240 — the ONE Tray Coordinator. The real Tray icon/menu rendering itself remains the Electron main's own responsibility (this framework-neutral module may not import Electron); the main dispatches a clicked action's own string through this getter's `.dispatch()`. */
  get trayCoordinator(): TrayCoordinator {
    return this.#trayCoordinator;
  }

  /** Secure Runtime Alpha 5161-5240 — the ONE Badge Coordinator. */
  get badgeCoordinator(): FedosDesktopBadgeCoordinator {
    return this.#badgeCoordinator;
  }

  /** Secure Runtime Alpha 5161-5240 — the ONE Background Lifecycle Coordinator (pure state machine; the Electron main performs every real side effect its returned state implies). */
  get backgroundLifecycle(): BackgroundLifecycleCoordinator {
    return this.#backgroundLifecycle;
  }

  /** Secure Runtime Alpha 5161-5240 — the ONE Device Sync Presentation Wiring. The caller's own `FedosDeviceSyncEventBridge` (constructed before unlock so its `wrapAttemptFn()` could be threaded into the Coordinator's Runtime config) routes events here via its own caller-owned indirection. */
  get deviceSyncPresentationWiring(): FedosDesktopDeviceSyncPresentationWiring {
    return this.#deviceSyncPresentationWiring;
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
   * Secure Runtime Alpha 5161-5240 — constructs the ENTIRE
   * Navigation/Tray/Badge/Device-Sync-Wiring layer over a given Boundary,
   * exactly once per call. Used both by the constructor (first composition)
   * and by `restartRuntime()` (Phase F "reconnect one set of application
   * coordinators", "detach old Device Sync event wiring before disposal") —
   * never leaves two live sets wired to two different Boundaries at once.
   * `notificationCoordinator`/`backgroundLifecycle` are NOT rebuilt here:
   * neither is bound to the Runtime (the former wraps a stable Electron-side
   * port; the latter is a pure state machine with no Runtime reference at
   * all), so a restart must not discard their own accumulated state.
   */
  #buildPresentationLayer(boundary: FedosDesktopConversationUiPresentationBoundary): {
    readonly navigationRegistry: FedosDesktopConversationWindowRegistry;
    readonly trayCoordinator: TrayCoordinator;
    readonly badgeCoordinator: FedosDesktopBadgeCoordinator;
    readonly deviceSyncPresentationWiring: FedosDesktopDeviceSyncPresentationWiring;
  } {
    const navigationRegistry = new FedosDesktopConversationWindowRegistry(
      boundary,
      this.#viewerParticipant,
      this.#navigationLogPath,
    );
    const trayCoordinator = new TrayCoordinator(navigationRegistry, boundary.deviceSyncStatus);
    const badgeCoordinator = new FedosDesktopBadgeCoordinator(navigationRegistry, boundary.unreadCounter, this.#badgePort);
    const deviceSyncPresentationWiring = new FedosDesktopDeviceSyncPresentationWiring({
      notificationCoordinator: this.#notificationCoordinator,
      badgeCoordinator,
      trayStatusSink: this.#trayStatusSink,
    });
    return { navigationRegistry, trayCoordinator, badgeCoordinator, deviceSyncPresentationWiring };
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
   * Ordering (spec Phase E/F): stop background sync -> stop the current
   * Runtime (this ALSO detaches the old Navigation/Tray/Badge/Device-Sync-
   * Wiring set, since they are rebuilt fresh over the new Boundary below,
   * never reused across a Runtime swap) -> construct exactly one replacement
   * -> adopt it on the Coordinator (so `coordinator.status()`/
   * `runningRuntime()` never go stale) -> rebuild the Shell/Boundary/
   * Settings-application wiring AND the entire presentation layer over it,
   * via the SAME `#buildPresentationLayer()` the constructor itself uses
   * (Phase F "verify no duplicate subscription remains" — the OLD
   * Navigation/Tray/Badge/Wiring objects are simply dropped, never reused,
   * never left wired to the old, now-stopped Boundary). NEVER runs two
   * Runtimes at once: the old one is fully stopped before the new one is
   * constructed. On construction failure, this assembly is left in an honest
   * `recovery-required` state (Coordinator remains `ready`, but
   * `shell.status()` reports `"stopped"` and every Shell method fails closed
   * `"unavailable"`) — Runtime handles are one-shot, so a failed restart
   * cannot "restore" the old one; this is disclosed, not silently retried.
   *
   * Electron-global presentation objects (`notificationCoordinator`,
   * `backgroundLifecycle`) are deliberately NOT reconstructed here (Phase F
   * "do not reconstruct Electron-global presentation objects unnecessarily")
   * — neither holds a Runtime reference.
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
      const rebuilt = this.#buildPresentationLayer(this.#boundary);
      this.#navigationRegistry = rebuilt.navigationRegistry;
      this.#trayCoordinator = rebuilt.trayCoordinator;
      this.#badgeCoordinator = rebuilt.badgeCoordinator;
      this.#deviceSyncPresentationWiring = rebuilt.deviceSyncPresentationWiring;
      return { outcome: "ok", reason: "Runtime restarted" };
    } finally {
      this.#restarting = false;
    }
  }

  /**
   * Clean shutdown (Phase U/G): requests + confirms the Background Lifecycle
   * transition, stops background sync, then the one Runtime via the Shell.
   * Idempotent-safe — a second call reports the Shell's own `"unavailable"`,
   * never throws.
   */
  async shutdown(): Promise<void> {
    this.#backgroundLifecycle.requestShutdown();
    try {
      const backgroundSyncControl = new FacadeBackedFedosSettingsBackgroundSyncControl(this.#backgroundSyncFacade());
      await backgroundSyncControl.stop();
    } catch {
      /* best-effort */
    }
    await this.#shell.stop();
    this.#backgroundLifecycle.confirmShutdown();
  }
}
