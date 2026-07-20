/**
 * Secure Runtime Alpha 4261-4340 — Phase D: Background Operation.
 *
 * `BackgroundLifecycleCoordinator` is a PURE, closed state machine over one
 * process's own window-open-count and shutdown intent — it owns no
 * `FedosDesktopApplicationShell`/`FedosDesktopConversationUiPresentationBoundary`
 * reference, starts nothing, and stops nothing itself. It only DECIDES; the
 * Electron adapter (Phase E), which owns exactly one Boundary/Runtime per
 * process (mirroring `fedos_electron_navigation_main.cts`'s own "exactly
 * one Boundary" discipline), calls into it and then performs whatever real
 * side effect (or none) the returned state implies. This split — pure
 * decision here, real effect only in the Electron adapter — mirrors
 * `TrayCoordinator`'s own design exactly (`../tray/fedos_desktop_tray_coordinator.ts`).
 *
 * CAPABILITIES (Phase D, this file's own state machine):
 *   - "window closed"          -> `windowClosed()`.
 *   - "keep runtime alive"     -> when `keepAliveInBackground` is `true`,
 *                                  `windowClosed()` reaching zero open
 *                                  windows transitions to `"background"`,
 *                                  NEVER `"shutting-down"` — the caller
 *                                  must never stop the Runtime on this path.
 *   - "background sync"        -> `canRunBackgroundSync()` stays `true`
 *                                  across `"foreground"`/`"background"` —
 *                                  only `false` once shutdown has begun.
 *                                  This coordinator does not itself run or
 *                                  schedule sync (the existing
 *                                  `FedosDeviceSyncScheduler`,
 *                                  `../../device/sync_scheduler/`, already
 *                                  owns real interval-driven ticking); it
 *                                  only guarantees window-close never stops
 *                                  it.
 *   - "background notifications" -> `canDeliverBackgroundNotifications()`,
 *                                  identical shape/lifetime to
 *                                  `canRunBackgroundSync()` — a
 *                                  `FedosDesktopNotificationCoordinator`
 *                                  (`../notification/`) is never gated by
 *                                  window visibility, only by this
 *                                  coordinator's own shutdown state.
 *   - "clean shutdown"         -> `requestShutdown()` (`"shutting-down"`,
 *                                  a one-way door) then `confirmShutdown()`
 *                                  (`"stopped"`, terminal, idempotent) —
 *                                  two explicit steps so a caller can run
 *                                  its own real `boundary.runtimeStatus.stop()`
 *                                  BETWEEN them without racing a window
 *                                  event that might otherwise resurrect
 *                                  `"foreground"`.
 *   - "single runtime ownership" -> a STRUCTURAL invariant, not a method:
 *                                  exactly one `BackgroundLifecycleCoordinator`
 *                                  is ever constructed per running Host
 *                                  process (mirrors `FedosDesktopHostBridge`'s
 *                                  own "never a second, divergent instance
 *                                  while running" — `../host_boundary/fedos_desktop_host_bridge.ts`),
 *                                  and it never itself references or starts
 *                                  a second Runtime; the ONE real Runtime
 *                                  a process owns is entirely the Electron
 *                                  adapter's own construction responsibility
 *                                  (Phase E), never this file's.
 *
 * HARD GUARDRAILS:
 *   - No daemon mode: this class never detaches from or outlives its own
 *     owning process — a `"background"` state is still governed by the SAME
 *     Electron `app` lifecycle (Phase E quits it via a real `app.quit()`
 *     call driven by `"exit"`/shutdown, never a second, backgrounded OS
 *     process).
 *   - No singleton service, no static/module-level mutable state — every
 *     instance is independent and disposable.
 *   - No I/O, no timer, no Shell/Runtime/persistence call, no async, no
 *     Electron import of any kind.
 */

export type FedosDesktopBackgroundLifecycleState = "foreground" | "background" | "shutting-down" | "stopped";

export interface FedosDesktopBackgroundLifecycleConfig {
  /** Whether closing the last open window keeps the Runtime alive (tray-resident background operation) instead of immediately requesting shutdown. */
  readonly keepAliveInBackground: boolean;
}

export class BackgroundLifecycleCoordinator {
  readonly #keepAliveInBackground: boolean;
  #openWindowCount = 0;
  #state: FedosDesktopBackgroundLifecycleState = "background";

  constructor(config: FedosDesktopBackgroundLifecycleConfig) {
    this.#keepAliveInBackground = config.keepAliveInBackground;
  }

  get state(): FedosDesktopBackgroundLifecycleState {
    return this.#state;
  }

  get openWindowCount(): number {
    return this.#openWindowCount;
  }

  /** A real OS window finished opening. No-op (state unchanged beyond the count) once shutdown has begun -- a late-arriving open event never resurrects a shutting-down/stopped process. */
  windowOpened(): FedosDesktopBackgroundLifecycleState {
    this.#openWindowCount += 1;
    if (this.#state !== "shutting-down" && this.#state !== "stopped") {
      this.#state = "foreground";
    }
    return this.#state;
  }

  /**
   * A real OS window finished closing (Phase D "window closed"). Once the
   * count reaches zero: `"background"` if `keepAliveInBackground` (Phase D
   * "keep runtime alive"), otherwise `"shutting-down"` -- the caller must
   * then drive a real shutdown via `requestShutdown()`/`confirmShutdown()`
   * plus its own `boundary.runtimeStatus.stop()` call; this method never
   * stops anything itself.
   */
  windowClosed(): FedosDesktopBackgroundLifecycleState {
    if (this.#openWindowCount > 0) this.#openWindowCount -= 1;
    if (this.#state === "shutting-down" || this.#state === "stopped") return this.#state;
    if (this.#openWindowCount > 0) {
      this.#state = "foreground";
      return this.#state;
    }
    this.#state = this.#keepAliveInBackground ? "background" : "shutting-down";
    return this.#state;
  }

  /** Begins a clean shutdown (Phase D "clean shutdown") -- a one-way door from `"foreground"`/`"background"`. Idempotent once already `"shutting-down"`/`"stopped"`. */
  requestShutdown(): FedosDesktopBackgroundLifecycleState {
    if (this.#state === "stopped") return this.#state;
    this.#state = "shutting-down";
    return this.#state;
  }

  /** Completes a clean shutdown -- terminal, idempotent. Only meaningful after the caller's own real Runtime-stop call has settled. */
  confirmShutdown(): FedosDesktopBackgroundLifecycleState {
    this.#state = "stopped";
    return this.#state;
  }

  /** Phase D "background sync" -- `true` in `"foreground"`/`"background"`, `false` only once shutdown has begun. */
  canRunBackgroundSync(): boolean {
    return this.#state === "foreground" || this.#state === "background";
  }

  /** Phase D "background notifications" -- identical lifetime to `canRunBackgroundSync()` (see this file's own header). */
  canDeliverBackgroundNotifications(): boolean {
    return this.#state === "foreground" || this.#state === "background";
  }
}
