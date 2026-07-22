/**
 * Secure Runtime Alpha 4981-5060 — Phase D/F/H/I: the NARROW live-subsystem
 * application ports the Settings Application Coordinator drives.
 *
 * Each port is a small, framework-neutral contract for applying ONE class of
 * setting to a real, already-owned live subsystem — never a generic
 * key-value engine, never reflection, never a raw Runtime/Relay/Scheduler
 * object crossing the boundary. The coordinator depends only on these
 * interfaces; the CALLER (the shell / Electron adapter / an acceptance test)
 * wires the REAL subsystem behind each one. This is the adapter-over-
 * replacement discipline the Arc requires.
 *
 * Every port fails closed and never throws across the boundary — mirroring
 * `FedosDesktopNotificationCoordinator`/`FedosSettingsAuthority`'s own "never
 * a raw Error" ethos.
 */

import type {
  FedosSettingsTheme,
  FedosSettingsWindowLayout,
} from "../../settings/fedos_settings_descriptor.js";
import type {
  FedosDesktopNotificationPort,
  FedosDesktopNotificationDeliveryResult,
  FedosDesktopNotificationPortStatus,
} from "../notification/fedos_desktop_notification_port.js";
import type { FedosDesktopNotificationView } from "../notification/fedos_desktop_notification_types.js";

/** The coarse, closed result every application port returns. Never a raw Error. */
export type FedosSettingsPortOutcome = "applied" | "unchanged" | "unavailable" | "failed";

// ---------------------------------------------------------------------
// A — IMMEDIATE: presentation preferences (theme + window layout).
// ---------------------------------------------------------------------

/**
 * A real, live presentation-preference sink. The renderer/shell reads its
 * current values; applying a setting mutates the in-force presentation state
 * WITHOUT reconstructing the Runtime (Phase F "Prove immediate effect without
 * Runtime recreation"). Closed vocabulary only — never arbitrary CSS.
 */
export interface FedosSettingsPresentationSink {
  currentTheme(): FedosSettingsTheme;
  currentWindowLayout(): FedosSettingsWindowLayout;
  applyTheme(theme: FedosSettingsTheme): FedosSettingsPortOutcome;
  applyWindowLayout(layout: FedosSettingsWindowLayout): FedosSettingsPortOutcome;
}

/**
 * The ONE in-process presentation-state holder — a genuine live boundary a
 * real renderer/shell reads. Deep frozen values in, closed vocabulary only.
 * Holds no durable state (mirrors `FedosDesktopViewModelState`'s own
 * "presentation state is never durable" guardrail): this is the CURRENT
 * effective presentation, re-seeded from persisted settings at startup.
 */
export class InMemoryFedosSettingsPresentationSink implements FedosSettingsPresentationSink {
  #theme: FedosSettingsTheme;
  #windowLayout: FedosSettingsWindowLayout;

  constructor(theme: FedosSettingsTheme = "system", windowLayout: FedosSettingsWindowLayout = "standard") {
    this.#theme = theme;
    this.#windowLayout = windowLayout;
  }

  currentTheme(): FedosSettingsTheme {
    return this.#theme;
  }

  currentWindowLayout(): FedosSettingsWindowLayout {
    return this.#windowLayout;
  }

  applyTheme(theme: FedosSettingsTheme): FedosSettingsPortOutcome {
    if (theme === this.#theme) return "unchanged";
    this.#theme = theme;
    return "applied";
  }

  applyWindowLayout(layout: FedosSettingsWindowLayout): FedosSettingsPortOutcome {
    if (layout === this.#windowLayout) return "unchanged";
    this.#windowLayout = layout;
    return "applied";
  }
}

// ---------------------------------------------------------------------
// A/I — IMMEDIATE: notification presentation gate.
// ---------------------------------------------------------------------

/**
 * A real gate over notification PRESENTATION. Disabling suppresses the OS
 * notification from ever being shown, while leaving every canonical event,
 * Device Sync state, Tray state, and unread calculation entirely untouched
 * (Phase I). It is a pure boolean gate — it owns no persistence, no transport.
 */
export interface FedosSettingsNotificationPresentationGate {
  isPresentationEnabled(): boolean;
  setPresentationEnabled(enabled: boolean): FedosSettingsPortOutcome;
}

/**
 * The concrete gate — a plain boolean holder. Additive: it does NOT modify
 * `FedosDesktopNotificationCoordinator`. It is composed with the real
 * notification port through `GatedFedosDesktopNotificationPort` below, so the
 * suppression happens at the delivery boundary, never by mutating the
 * coordinator's internals.
 */
export class FedosSettingsNotificationPresentationGateHolder implements FedosSettingsNotificationPresentationGate {
  #enabled: boolean;

  constructor(enabled = true) {
    this.#enabled = enabled;
  }

  isPresentationEnabled(): boolean {
    return this.#enabled;
  }

  setPresentationEnabled(enabled: boolean): FedosSettingsPortOutcome {
    if (enabled === this.#enabled) return "unchanged";
    this.#enabled = enabled;
    return "applied";
  }
}

/**
 * A `FedosDesktopNotificationPort` decorator that consults a presentation
 * gate BEFORE delegating. When the gate is disabled, it returns a
 * `delivered:false` "presentation suppressed" result WITHOUT ever calling the
 * wrapped port — so no OS notification is shown — while the wrapped backend
 * (and every canonical event that produced the notification request) is left
 * entirely intact. Re-enabling the gate restores delivery with no state loss.
 *
 * Reports the wrapped port's own `status()` verbatim (the backend's
 * availability is a separate fact from the user's presentation preference).
 */
export class GatedFedosDesktopNotificationPort implements FedosDesktopNotificationPort {
  readonly #delegate: FedosDesktopNotificationPort;
  readonly #gate: FedosSettingsNotificationPresentationGate;

  constructor(delegate: FedosDesktopNotificationPort, gate: FedosSettingsNotificationPresentationGate) {
    this.#delegate = delegate;
    this.#gate = gate;
  }

  status(): FedosDesktopNotificationPortStatus {
    return this.#delegate.status();
  }

  async notify(view: FedosDesktopNotificationView): Promise<FedosDesktopNotificationDeliveryResult> {
    if (!this.#gate.isPresentationEnabled()) {
      return { delivered: false, reason: "notification presentation suppressed by settings (canonical event unaffected)" };
    }
    return this.#delegate.notify(view);
  }
}

// ---------------------------------------------------------------------
// B — SUBSYSTEM: background sync scheduler control.
// ---------------------------------------------------------------------

/**
 * A narrow control over the background Device-Sync Scheduler lifecycle. The
 * coordinator uses ONLY this — it never touches the scheduler, the sync
 * journal, or any device key directly. `null` availability means the running
 * Runtime was constructed without the scheduler (honest "unavailable"), never
 * a fabricated start.
 */
export interface FedosSettingsBackgroundSyncControl {
  isAvailable(): boolean;
  isRunning(): boolean;
  start(): FedosSettingsPortOutcome;
  stop(): Promise<FedosSettingsPortOutcome>;
}

/** The narrow slice of `FedosDeviceSyncOperationalFacade` this control needs — kept minimal so the adapter never widens its surface. */
export interface FedosSettingsBackgroundSyncFacadeLike {
  syncStatus(): { readonly outcome: string; readonly value?: { readonly running: boolean } };
  startSync(): { readonly outcome: string };
  stopSync(): Promise<{ readonly outcome: string }>;
}

/**
 * Adapts the real `FedosDeviceSyncOperationalFacade` (or the narrow
 * `FedosSettingsBackgroundSyncFacadeLike` slice of it) onto the background-
 * sync control. Enabling calls the facade's own `startSync()` (which uses the
 * ONE existing Scheduler — never a second timer); disabling calls its
 * `stopSync()` (which waits for the in-flight tick per the scheduler's own
 * contract, discarding no Journal state). Never fabricates success.
 */
export class FacadeBackedFedosSettingsBackgroundSyncControl implements FedosSettingsBackgroundSyncControl {
  readonly #facade: FedosSettingsBackgroundSyncFacadeLike | null;

  constructor(facade: FedosSettingsBackgroundSyncFacadeLike | null) {
    this.#facade = facade;
  }

  isAvailable(): boolean {
    if (this.#facade === null) return false;
    return this.#facade.syncStatus().outcome === "ok";
  }

  isRunning(): boolean {
    if (this.#facade === null) return false;
    const status = this.#facade.syncStatus();
    return status.outcome === "ok" && status.value?.running === true;
  }

  start(): FedosSettingsPortOutcome {
    if (this.#facade === null) return "unavailable";
    if (this.isRunning()) return "unchanged";
    const result = this.#facade.startSync();
    if (result.outcome === "ok") return "applied";
    if (result.outcome === "disabled" || result.outcome === "unavailable") return "unavailable";
    if (result.outcome === "conflict") return "unchanged"; // already running
    return "failed";
  }

  async stop(): Promise<FedosSettingsPortOutcome> {
    if (this.#facade === null) return "unavailable";
    if (!this.isRunning()) return "unchanged";
    const result = await this.#facade.stopSync();
    if (result.outcome === "ok") return "applied";
    if (result.outcome === "disabled" || result.outcome === "unavailable") return "unavailable";
    return "failed";
  }
}
