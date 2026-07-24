/**
 * Secure Runtime Alpha 3941–4020 — Phase C: navigation state owner.
 *
 * `FedosDeviceManagementNavigationState` is the ONE place "which screen is
 * currently shown" and "which deviceId/scheduleId/transferSessionId/
 * conflictId is selected" lives. It owns NOTHING else: no Device truth, no
 * Sync truth, no persistence, no network state, no secret state — every
 * fact this Arc renders still comes from the EXISTING 6 ViewModels
 * (`FedosDeviceInventoryViewModel` etc., Alpha 3801-3880, unmodified).
 *
 * This state is explicitly NOT durable canonical data: it is a plain,
 * in-memory object, reset to `"overview"`/no-selection on every process
 * restart or fresh construction — never written to any log, persistence
 * port, or file. A future UI's own "resume where I left off" concern (if
 * ever wanted) is out of this Arc's scope entirely.
 *
 * `goto()` is the ONLY way the current screen changes, and it is a
 * fail-closed gate: an unrecognized screen id (Phase B's own
 * `isFedosDeviceManagementScreen()`) is REFUSED — the current screen never
 * changes and the call returns `false` — never a silent fallback to some
 * default screen and never a thrown exception. There is no arbitrary
 * string-based route of any kind.
 */

import {
  isFedosDeviceManagementConfirmationAction,
  isFedosDeviceManagementScreen,
  type FedosDeviceManagementConfirmationAction,
  type FedosDeviceManagementScreen,
} from "./fedos_device_management_screen.js";

export interface FedosDeviceManagementPendingConfirmation {
  readonly action: FedosDeviceManagementConfirmationAction;
  /** The Device this confirmation concerns, when the action is Device-scoped (`"revoke-device"`). `null` for account/Runtime-scoped actions (`"trigger-sync-now"`, `"stop-sync"`). */
  readonly deviceId: string | null;
}

export class FedosDeviceManagementNavigationState {
  #screen: FedosDeviceManagementScreen = "overview";
  #returnScreen: FedosDeviceManagementScreen | null = null;
  #selectedDeviceId: string | null = null;
  #selectedScheduleId: string | null = null;
  #selectedTransferSessionId: string | null = null;
  #selectedConflictId: string | null = null;
  #pendingConfirmation: FedosDeviceManagementPendingConfirmation | null = null;

  get screen(): FedosDeviceManagementScreen {
    return this.#screen;
  }

  get returnScreen(): FedosDeviceManagementScreen | null {
    return this.#returnScreen;
  }

  get selectedDeviceId(): string | null {
    return this.#selectedDeviceId;
  }

  get selectedScheduleId(): string | null {
    return this.#selectedScheduleId;
  }

  get selectedTransferSessionId(): string | null {
    return this.#selectedTransferSessionId;
  }

  get selectedConflictId(): string | null {
    return this.#selectedConflictId;
  }

  get pendingConfirmation(): FedosDeviceManagementPendingConfirmation | null {
    return this.#pendingConfirmation;
  }

  /** Fail-closed: an unrecognized `screen` value is refused (returns `false`, no state change whatsoever) — never a silent default, never a thrown exception. On a real transition, the PRIOR screen becomes `returnScreen` (a single-level back reference, not a full history stack). */
  goto(screen: unknown): boolean {
    if (!isFedosDeviceManagementScreen(screen)) return false;
    if (screen === this.#screen) return true;
    this.#returnScreen = this.#screen;
    this.#screen = screen;
    return true;
  }

  /** Navigates to `returnScreen` if one exists, clearing it afterward. A no-op (returns `false`) if there is nowhere to return to. */
  goBack(): boolean {
    if (this.#returnScreen === null) return false;
    const target = this.#returnScreen;
    this.#returnScreen = null;
    this.#screen = target;
    return true;
  }

  /** Selects a Device id and navigates to `"device-detail"` in one step — refused (no state change) if `deviceId` is not a non-empty string. */
  selectDevice(deviceId: unknown): boolean {
    if (typeof deviceId !== "string" || deviceId.trim().length === 0) return false;
    this.#selectedDeviceId = deviceId;
    return this.goto("device-detail");
  }

  /** Device Revocation Confirmation is its OWN dedicated screen (Phase B) -- distinct from the generic `"confirmation"` screen the account/Runtime-scoped actions use. */
  requestRevocationConfirmation(deviceId: unknown): boolean {
    if (typeof deviceId !== "string" || deviceId.trim().length === 0) return false;
    this.#selectedDeviceId = deviceId;
    return this.goto("revocation-confirmation");
  }

  selectSchedule(scheduleId: unknown): boolean {
    if (typeof scheduleId !== "string" || scheduleId.trim().length === 0) return false;
    this.#selectedScheduleId = scheduleId;
    return this.goto("schedule-list");
  }

  selectTransferSession(transferSessionId: unknown): boolean {
    if (typeof transferSessionId !== "string" || transferSessionId.trim().length === 0) return false;
    this.#selectedTransferSessionId = transferSessionId;
    return this.goto("transfer-detail");
  }

  selectConflict(conflictId: unknown): boolean {
    if (typeof conflictId !== "string" || conflictId.trim().length === 0) return false;
    this.#selectedConflictId = conflictId;
    return this.goto("conflict-detail");
  }

  /** Records a pending confirmation and navigates to `"confirmation"` — the SAME fail-closed discipline as `goto()`: an unrecognized action is refused, no state change. */
  requestConfirmation(action: unknown, deviceId: string | null = null): boolean {
    if (!isFedosDeviceManagementConfirmationAction(action)) return false;
    this.#pendingConfirmation = Object.freeze({ action, deviceId });
    return this.goto("confirmation");
  }

  /** Clears the pending confirmation without necessarily changing screen — a caller navigates separately once the underlying action itself has been carried out (or cancelled). */
  clearConfirmation(): void {
    this.#pendingConfirmation = null;
  }
}
