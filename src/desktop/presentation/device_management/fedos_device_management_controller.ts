/**
 * Secure Runtime Alpha 3941–4020 — Phases C/D/E/F/G/H/I: the ONE Device
 * Management controller.
 *
 * `FedosDeviceManagementController` owns the navigation state
 * (`FedosDeviceManagementNavigationState`, Phase C) and composes the SIX
 * EXISTING, UNMODIFIED Device Sync ViewModels (Alpha 3801-3880) —
 * `deviceInventory`, `deviceSyncStatus`, `syncSchedule`, `transferSession`,
 * `syncConflict` — into per-screen content. It calls NOTHING beyond those
 * ViewModels' own already-public getters/actions — never the Shell, the
 * Runtime, or a Device Registry/Scheduler/Persistence class directly
 * (this file imports none of them). It is registered as a NEW
 * `deviceManagement` property on the EXISTING
 * `FedosDesktopConversationUiPresentationBoundary`
 * (`../fedos_desktop_conversation_ui_presentation_boundary.ts`) — never a
 * second, parallel top-level presentation boundary.
 *
 * Every list/detail getter is a PURE, synchronous projection computed on
 * demand from the underlying ViewModels' own CURRENT state — there is no
 * separate cache to invalidate, and therefore no possibility of this
 * controller's own screen model drifting out of sync with the ViewModel
 * it reads.
 *
 * Duplicate-submission prevention (Phase G): `#syncStartStopInFlight`/
 * `#triggerInFlight` are the ONLY local flags this file adds, guarding
 * `startSync()`/`confirmStopSync()`/`confirmTriggerSyncNow()` against a
 * second call while the first is still in flight — no hidden polling
 * timer of any kind exists anywhere in this file.
 */

import type { FedosDesktopConversationUiPresentationBoundary } from "../fedos_desktop_conversation_ui_presentation_boundary.js";
import type { FedosDesktopDeviceInventoryViewModel } from "../fedos_desktop_device_inventory_view_model.js";
import type { FedosDesktopDeviceSyncStatusViewModel } from "../fedos_desktop_device_sync_status_view_model.js";
import type { FedosDesktopSyncScheduleViewModel } from "../fedos_desktop_sync_schedule_view_model.js";
import type { FedosDesktopTransferSessionViewModel } from "../fedos_desktop_transfer_session_view_model.js";
import type { FedosDesktopSyncConflictViewModel } from "../fedos_desktop_sync_conflict_view_model.js";
import type { FedosDeviceSyncConflictResolutionAction } from "../../../device/sync_scheduler/persistence/fedos_device_sync_conflict_persistence.js";
import type {
  FedosDeviceSyncConflictView,
  FedosDeviceSyncDeviceView,
  FedosDeviceSyncScheduleView,
  FedosDeviceSyncTransferSessionView,
} from "../../runtime/fedos_device_sync_operational_facade.js";
// Secure Runtime Alpha 4581-4660 (Desktop Device Registration, Pairing, and
// Durable Sync Journal Arc) -- every import/addition below this comment is
// ADDITIVE ONLY, mirroring this file's own established pattern above.
import type { FedosDesktopDevicePairingViewModel } from "../fedos_desktop_device_pairing_view_model.js";
import type {
  FedosDevicePairingApprovalOutcomeView,
  FedosDevicePairingBindingView,
  FedosDevicePairingRequestInspectionView,
  FedosDevicePairingRequestSummary,
} from "../../runtime/fedos_device_pairing_facade.js";
import type { FedosDeviceBindingAccountRef } from "../../../device/fedos_device_binding.js";
import { fedosViewModelIdle, fedosViewModelLoaded, fedosViewModelLoading, fedosViewModelError, type FedosDesktopViewModelState } from "../fedos_desktop_view_model_state.js";
import { FedosDeviceManagementNavigationState } from "./fedos_device_management_navigation_state.js";
import {
  fedosDeviceManagementBuildOverview,
  fedosDeviceManagementBuildRegistration,
  fedosDeviceManagementBuildRevocationConfirmation,
  fedosDeviceManagementDeriveSyncActionState,
  fedosDeviceManagementFilterConflicts,
  fedosDeviceManagementFilterDevices,
  type FedosDeviceManagementConfirmationContent,
  type FedosDeviceManagementConflictListFilter,
  type FedosDeviceManagementDeviceListFilter,
  type FedosDeviceManagementOverviewContent,
  type FedosDeviceManagementRegistrationContent,
  type FedosDeviceManagementRevocationConfirmationContent,
  type FedosDeviceManagementSyncStatusContent,
} from "./fedos_device_management_screen_model.js";
import {
  fedosDeviceManagementTruncateList,
  type FedosDeviceManagementTruncatedList,
  FEDOS_DEVICE_MANAGEMENT_MAX_DEVICES_RENDERED,
  FEDOS_DEVICE_MANAGEMENT_MAX_SCHEDULES_RENDERED,
  FEDOS_DEVICE_MANAGEMENT_MAX_TRANSFERS_RENDERED,
  FEDOS_DEVICE_MANAGEMENT_MAX_CONFLICTS_RENDERED,
} from "./fedos_device_management_presentation_limits.js";

export class FedosDeviceManagementController {
  readonly navigation = new FedosDeviceManagementNavigationState();
  readonly #deviceInventory: FedosDesktopDeviceInventoryViewModel;
  readonly #deviceSyncStatus: FedosDesktopDeviceSyncStatusViewModel;
  readonly #syncSchedule: FedosDesktopSyncScheduleViewModel;
  readonly #transferSession: FedosDesktopTransferSessionViewModel;
  readonly #syncConflict: FedosDesktopSyncConflictViewModel;
  readonly #devicePairing: FedosDesktopDevicePairingViewModel;

  #syncStartStopInFlight: "start" | "stop" | null = null;
  #triggerInFlight = false;
  #revokeInFlight = false;

  constructor(boundary: FedosDesktopConversationUiPresentationBoundary) {
    this.#deviceInventory = boundary.deviceInventory;
    this.#deviceSyncStatus = boundary.deviceSyncStatus;
    this.#syncSchedule = boundary.syncSchedule;
    this.#transferSession = boundary.transferSession;
    this.#syncConflict = boundary.syncConflict;
    this.#devicePairing = boundary.devicePairing;
  }

  // ---------------------------------------------------------------------
  // Phase D — Overview.
  // ---------------------------------------------------------------------

  async refreshOverview(): Promise<void> {
    await Promise.all([this.#deviceInventory.refresh(), this.#deviceSyncStatus.refresh(), this.#syncConflict.refresh(), this.#transferSession.refresh()]);
  }

  get overviewState(): FedosDesktopViewModelState<FedosDeviceManagementOverviewContent> {
    const devicesState = this.#deviceInventory.listState;
    if (devicesState.status === "idle") return fedosViewModelIdle();
    if (devicesState.status === "loading") return fedosViewModelLoading();
    if (devicesState.status === "error") return fedosViewModelError(devicesState.outcome, devicesState.reason);

    const devices = devicesState.data;
    const localDevice = devices.find((d) => d.isLocal) ?? null;

    const schedulerState = this.#deviceSyncStatus.state;
    const schedulerStatus = schedulerState.status === "loaded" ? schedulerState.data : null;

    const conflictsState = this.#syncConflict.listState;
    const unresolvedConflictCount = conflictsState.status === "loaded" ? conflictsState.data.filter((c) => !c.resolved).length : 0;

    const transfersState = this.#transferSession.state;
    const transfers = transfersState.status === "loaded" ? transfersState.data : [];

    return fedosViewModelLoaded(fedosDeviceManagementBuildOverview({ localDevice, devices, schedulerStatus, unresolvedConflictCount, transfers }));
  }

  // ---------------------------------------------------------------------
  // Phase E — Device list / detail.
  // ---------------------------------------------------------------------

  async refreshDeviceList(): Promise<void> {
    await this.#deviceInventory.refresh();
  }

  async openDeviceList(): Promise<void> {
    this.navigation.goto("device-list");
    await this.refreshDeviceList();
  }

  deviceListState(filter: FedosDeviceManagementDeviceListFilter = "all"): FedosDesktopViewModelState<FedosDeviceManagementTruncatedList<FedosDeviceSyncDeviceView>> {
    const state = this.#deviceInventory.listState;
    if (state.status !== "loaded") return state;
    const filtered = fedosDeviceManagementFilterDevices(state.data, filter);
    return fedosViewModelLoaded(fedosDeviceManagementTruncateList(filtered, FEDOS_DEVICE_MANAGEMENT_MAX_DEVICES_RENDERED));
  }

  async selectDevice(deviceId: string): Promise<void> {
    this.navigation.selectDevice(deviceId);
    await this.#deviceInventory.selectDevice(deviceId);
  }

  /** `"invalid-input"` if the ViewModel's own loaded detail does not match the currently-selected id (Phase M "stale selected ID handled safely") -- never silently shows the wrong Device. */
  get deviceDetailState(): FedosDesktopViewModelState<FedosDeviceSyncDeviceView> {
    const selectedId = this.navigation.selectedDeviceId;
    const state = this.#deviceInventory.selectedState;
    if (selectedId === null) return fedosViewModelError("invalid-input", "no Device selected");
    if (state.status !== "loaded") return state;
    if (state.data.deviceId !== selectedId) return fedosViewModelError("invalid-input", "selected Device id is stale");
    return state;
  }

  // ---------------------------------------------------------------------
  // Phase F — Registration / Revocation confirmation.
  // ---------------------------------------------------------------------

  get registrationContent(): FedosDeviceManagementRegistrationContent {
    return fedosDeviceManagementBuildRegistration();
  }

  openRegistration(): void {
    this.navigation.goto("registration");
  }

  async requestRevokeDeviceConfirmation(deviceId: string): Promise<void> {
    await this.#deviceInventory.selectDevice(deviceId);
    this.navigation.requestRevocationConfirmation(deviceId);
  }

  get revocationConfirmationState(): FedosDesktopViewModelState<FedosDeviceManagementRevocationConfirmationContent> {
    const deviceId = this.navigation.selectedDeviceId;
    if (deviceId === null) return fedosViewModelError("invalid-input", "no Device selected for revocation");
    const state = this.#deviceInventory.selectedState;
    if (state.status !== "loaded") return state;
    if (state.data.deviceId !== deviceId) return fedosViewModelError("invalid-input", "selected Device id is stale");
    return fedosViewModelLoaded(fedosDeviceManagementBuildRevocationConfirmation(state.data));
  }

  /**
   * Secure Runtime Alpha 4581-4660 -- carries out the revocation the
   * `"revocation-confirmation"` screen (above) offered, using the CURRENTLY
   * selected Device's own `devicePublicKeyRef` (already loaded by
   * `requestRevokeDeviceConfirmation()`'s own `#deviceInventory.selectDevice()`
   * call). Duplicate submission is prevented -- a second call while one is
   * already in flight is a silent no-op, mirroring `confirmStopSync()`'s
   * own established discipline. Refreshes the Device list on any outcome so
   * a real terminal-state change is immediately visible.
   */
  async confirmRevokeDevice(): Promise<void> {
    if (this.#revokeInFlight) return;
    const deviceId = this.navigation.selectedDeviceId;
    const selected = this.#deviceInventory.selectedState;
    if (deviceId === null || selected.status !== "loaded" || selected.data.deviceId !== deviceId || selected.data.devicePublicKeyRef === null) {
      return;
    }
    this.#revokeInFlight = true;
    try {
      await this.#devicePairing.revokeDevice(deviceId, selected.data.devicePublicKeyRef);
      await this.refreshDeviceList();
    } finally {
      this.#revokeInFlight = false;
      this.navigation.clearConfirmation();
    }
  }

  get revocationResultState(): FedosDesktopViewModelState<FedosDevicePairingBindingView> {
    return this.#devicePairing.revocationState;
  }

  // ---------------------------------------------------------------------
  // Secure Runtime Alpha 4581-4660 -- real Device Pairing actions. Every
  // method below delegates ENTIRELY to `FedosDesktopDevicePairingViewModel`
  // (`../fedos_desktop_device_pairing_view_model.ts`) -- this controller
  // owns no cryptographic implementation or Registry logic of its own.
  // ---------------------------------------------------------------------

  /** JOINING Device: creates a fresh pairing request. The resulting `encoded` string is the ONE artifact a real UI must surface to the user for manual out-of-band transfer -- labeled sensitive pairing data (Phase I), even though it contains no private key. */
  async createPairingRequest(deviceId: string, expectedAccountRef: FedosDeviceBindingAccountRef): Promise<void> {
    await this.#devicePairing.createPairingRequest(deviceId, expectedAccountRef);
  }

  get pairingCreatedState(): FedosDesktopViewModelState<{ readonly pairingId: string; readonly encoded: string }> {
    return this.#devicePairing.createdState;
  }

  async refreshPendingPairings(): Promise<void> {
    await this.#devicePairing.refreshPendingList();
  }

  get pendingPairingsState(): FedosDesktopViewModelState<readonly FedosDevicePairingRequestSummary[]> {
    return this.#devicePairing.pendingListState;
  }

  /** AUTHORIZING Device: safe, read-only inspection of an inbound encoded pairing request. */
  async inspectPairingRequest(encodedRequest: string): Promise<void> {
    await this.#devicePairing.inspectPairingRequest(encodedRequest);
  }

  get pairingInspectionState(): FedosDesktopViewModelState<FedosDevicePairingRequestInspectionView> {
    return this.#devicePairing.inspectionState;
  }

  /** AUTHORIZING Device: approves an inbound pairing request, producing the encoded approval to transfer back. */
  async approvePairingRequest(encodedRequest: string): Promise<void> {
    await this.#devicePairing.approvePairingRequest(encodedRequest);
  }

  get pairingApprovalState(): FedosDesktopViewModelState<FedosDevicePairingApprovalOutcomeView> {
    return this.#devicePairing.approvalState;
  }

  /** JOINING Device: completes registration using an inbound encoded approval. Refreshes the Device list on success so the newly trusted Device is immediately visible. */
  async completePairing(pairingId: string, encodedApproval: string): Promise<void> {
    await this.#devicePairing.completePairing(pairingId, encodedApproval);
    await this.refreshDeviceList();
  }

  get pairingCompletionState(): FedosDesktopViewModelState<FedosDevicePairingBindingView> {
    return this.#devicePairing.completionState;
  }

  async refreshRegistrationStatus(deviceId: string): Promise<void> {
    await this.#devicePairing.refreshStatus(deviceId);
  }

  get registrationStatusState(): FedosDesktopViewModelState<FedosDevicePairingBindingView> {
    return this.#devicePairing.statusState;
  }

  // ---------------------------------------------------------------------
  // Phase G — Sync operations.
  // ---------------------------------------------------------------------

  async refreshSyncStatus(): Promise<void> {
    await this.#deviceSyncStatus.refresh();
  }

  async openSyncStatus(): Promise<void> {
    this.navigation.goto("sync-status");
    await this.refreshSyncStatus();
  }

  get syncStatusState(): FedosDesktopViewModelState<FedosDeviceManagementSyncStatusContent> {
    const state = this.#deviceSyncStatus.state;
    const lastTickState = this.#deviceSyncStatus.lastTickState;
    if (state.status === "idle") return fedosViewModelIdle();
    if (state.status === "loading") return fedosViewModelLoading();

    const loadOutcome = state.status === "error" ? (state.outcome === "unavailable" ? "unavailable" : state.outcome === "unsupported" ? "unsupported" : null) : null;
    if (state.status === "error" && loadOutcome === null) return fedosViewModelError(state.outcome, state.reason);

    const schedulerStatus = state.status === "loaded" ? state.data : null;
    const actionState = fedosDeviceManagementDeriveSyncActionState({ schedulerStatus, actionInFlight: this.#syncStartStopInFlight, loadOutcome });
    const lastTick = lastTickState.status === "loaded" ? lastTickState.data : null;
    return fedosViewModelLoaded({ status: schedulerStatus, actionState, lastTick });
  }

  /** Duplicate submission is prevented -- a second call while one is already in flight is a silent no-op, never a second real Shell call. */
  async startSync(): Promise<void> {
    if (this.#syncStartStopInFlight !== null) return;
    this.#syncStartStopInFlight = "start";
    try {
      await this.#deviceSyncStatus.start();
    } finally {
      this.#syncStartStopInFlight = null;
    }
  }

  requestStopSyncConfirmation(): boolean {
    return this.navigation.requestConfirmation("stop-sync");
  }

  async confirmStopSync(): Promise<void> {
    if (this.#syncStartStopInFlight !== null) return;
    this.#syncStartStopInFlight = "stop";
    try {
      await this.#deviceSyncStatus.stop();
    } finally {
      this.#syncStartStopInFlight = null;
      this.navigation.clearConfirmation();
    }
  }

  requestTriggerSyncNowConfirmation(): boolean {
    return this.navigation.requestConfirmation("trigger-sync-now");
  }

  async confirmTriggerSyncNow(): Promise<void> {
    if (this.#triggerInFlight) return;
    this.#triggerInFlight = true;
    try {
      await this.#deviceSyncStatus.triggerNow();
    } finally {
      this.#triggerInFlight = false;
      this.navigation.clearConfirmation();
    }
  }

  cancelConfirmation(): void {
    this.navigation.clearConfirmation();
    this.navigation.goBack();
  }

  get confirmationState(): FedosDesktopViewModelState<FedosDeviceManagementConfirmationContent> {
    const pending = this.navigation.pendingConfirmation;
    if (pending === null) return fedosViewModelError("invalid-input", "no pending confirmation");
    if (pending.action === "revoke-device") {
      return fedosViewModelError("invalid-input", "Device revocation uses the dedicated revocation-confirmation screen, not this generic one");
    }
    const schedulerState = this.#deviceSyncStatus.state;
    const schedulerStatus = schedulerState.status === "loaded" ? schedulerState.data : null;
    if (pending.action === "trigger-sync-now") {
      const available = schedulerStatus !== null && schedulerStatus.enabled && schedulerStatus.running;
      return fedosViewModelLoaded({
        action: "trigger-sync-now",
        deviceId: null,
        confirmationText: "Trigger a manual Device Sync attempt now?",
        available,
        unavailableReason: available ? null : "the Scheduler is not enabled and running",
      });
    }
    // "stop-sync"
    const available = schedulerStatus !== null && schedulerStatus.enabled;
    return fedosViewModelLoaded({
      action: "stop-sync",
      deviceId: null,
      confirmationText: "Stop the background Device Sync Scheduler?",
      available,
      unavailableReason: available ? null : "the Scheduler is not enabled",
    });
  }

  // ---------------------------------------------------------------------
  // Phase H — Schedules / Transfers.
  // ---------------------------------------------------------------------

  async refreshScheduleList(): Promise<void> {
    await this.#syncSchedule.refresh();
  }

  async openSchedules(): Promise<void> {
    this.navigation.goto("schedule-list");
    await this.refreshScheduleList();
  }

  get scheduleListState(): FedosDesktopViewModelState<FedosDeviceManagementTruncatedList<FedosDeviceSyncScheduleView>> {
    const state = this.#syncSchedule.state;
    if (state.status !== "loaded") return state;
    return fedosViewModelLoaded(fedosDeviceManagementTruncateList(state.data, FEDOS_DEVICE_MANAGEMENT_MAX_SCHEDULES_RENDERED));
  }

  selectSchedule(scheduleId: string): void {
    this.navigation.selectSchedule(scheduleId);
  }

  async refreshTransferList(): Promise<void> {
    await this.#transferSession.refresh();
  }

  async openTransfers(): Promise<void> {
    this.navigation.goto("transfer-list");
    await this.refreshTransferList();
  }

  get transferListState(): FedosDesktopViewModelState<FedosDeviceManagementTruncatedList<FedosDeviceSyncTransferSessionView>> {
    const state = this.#transferSession.state;
    if (state.status !== "loaded") return state;
    return fedosViewModelLoaded(fedosDeviceManagementTruncateList(state.data, FEDOS_DEVICE_MANAGEMENT_MAX_TRANSFERS_RENDERED));
  }

  async selectTransferSession(transferSessionId: string): Promise<void> {
    this.navigation.selectTransferSession(transferSessionId);
    await this.refreshTransferList();
  }

  /** No dedicated per-item fetch exists on `FedosDesktopTransferSessionViewModel` (Alpha 3801-3880 built list-only) -- detail is a pure client-side lookup within the already-loaded list, never a second Shell call. */
  get transferDetailState(): FedosDesktopViewModelState<FedosDeviceSyncTransferSessionView> {
    const selectedId = this.navigation.selectedTransferSessionId;
    if (selectedId === null) return fedosViewModelError("invalid-input", "no Transfer Session selected");
    const state = this.#transferSession.state;
    if (state.status !== "loaded") return state;
    const found = state.data.find((t) => t.transferSessionId === selectedId);
    if (found === undefined) return fedosViewModelError("not-found", "selected Transfer Session id is stale or no longer present");
    return fedosViewModelLoaded(found);
  }

  // ---------------------------------------------------------------------
  // Phase I — Conflicts.
  // ---------------------------------------------------------------------

  async refreshConflictList(includeResolved = false): Promise<void> {
    await this.#syncConflict.refresh(includeResolved);
  }

  async openConflicts(): Promise<void> {
    this.navigation.goto("conflict-list");
    await this.refreshConflictList();
  }

  conflictListState(filter: FedosDeviceManagementConflictListFilter = "unresolved"): FedosDesktopViewModelState<FedosDeviceManagementTruncatedList<FedosDeviceSyncConflictView>> {
    const state = this.#syncConflict.listState;
    if (state.status !== "loaded") return state;
    const filtered = fedosDeviceManagementFilterConflicts(state.data, filter);
    return fedosViewModelLoaded(fedosDeviceManagementTruncateList(filtered, FEDOS_DEVICE_MANAGEMENT_MAX_CONFLICTS_RENDERED));
  }

  async selectConflict(conflictId: string): Promise<void> {
    this.navigation.selectConflict(conflictId);
    await this.#syncConflict.selectConflict(conflictId);
  }

  get conflictDetailState(): FedosDesktopViewModelState<FedosDeviceSyncConflictView> {
    const selectedId = this.navigation.selectedConflictId;
    const state = this.#syncConflict.selectedState;
    if (selectedId === null) return fedosViewModelError("invalid-input", "no Conflict selected");
    if (state.status !== "loaded") return state;
    if (state.data.conflictId !== selectedId) return fedosViewModelError("invalid-input", "selected Conflict id is stale");
    return state;
  }

  /** Thin passthrough to the real, already-safe `FedosDesktopSyncConflictViewModel.acknowledge()` -- the ONLY 4 actions the real Conflict Authority itself supports (Alpha 3801-3880), never a 5th generic one. */
  async acknowledgeConflict(conflictId: string, action: FedosDeviceSyncConflictResolutionAction): Promise<void> {
    await this.#syncConflict.acknowledge(conflictId, action);
  }

  // ---------------------------------------------------------------------
  // Navigation passthrough.
  // ---------------------------------------------------------------------

  goBack(): boolean {
    return this.navigation.goBack();
  }
}
