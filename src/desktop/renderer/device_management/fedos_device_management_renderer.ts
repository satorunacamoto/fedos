/**
 * Secure Runtime Alpha 3941–4020 — Phase J/K: the ONE Device Management
 * renderer.
 *
 * `FedosDeviceManagementRenderer` consumes ONLY a
 * `FedosDeviceManagementController` (`../../presentation/device_management/fedos_device_management_controller.js`)
 * — its navigation state getters and its per-screen content getters. It
 * imports no Device Registry, Scheduler, Sync Journal, Relay, persistence,
 * or crypto module of any kind (verified by source-inspection test,
 * `secure_runtime_alpha_3941_4020_security_boundary_guards.test.ts`). It
 * calls no ViewModel action method itself — mirrors every existing
 * Renderer's own "reads only public getters, never drives the ViewModel"
 * discipline one layer up.
 *
 * Every render method returns `FedosDesktopRenderModel<T>`
 * (`../fedos_desktop_render_model.ts`, unmodified) — `T` is always plain,
 * JSON-serializable data: real domain fields plus Phase K's own semantic
 * metadata (`title`, `actions` — closed `FedosDeviceManagementActionDescriptor`
 * values, never a function — `emptyStateMessage`, `disabledReason`).
 */

import type { FedosDeviceManagementController } from "../../presentation/device_management/fedos_device_management_controller.js";
import type { FedosDeviceManagementScreen } from "../../presentation/device_management/fedos_device_management_screen.js";
import type {
  FedosDeviceManagementDeviceListFilter,
  FedosDeviceManagementConflictListFilter,
  FedosDeviceManagementRevocationConfirmationContent,
} from "../../presentation/device_management/fedos_device_management_screen_model.js";
import type { FedosDeviceManagementTruncatedList } from "../../presentation/device_management/fedos_device_management_presentation_limits.js";
import type {
  FedosDeviceSyncConflictView,
  FedosDeviceSyncDeviceView,
  FedosDeviceSyncScheduleView,
  FedosDeviceSyncTransferSessionView,
} from "../../runtime/fedos_device_sync_operational_facade.js";
import { fedosRenderModel, type FedosDesktopRenderModel } from "../fedos_desktop_render_model.js";
import { fedosDeviceManagementAction, type FedosDeviceManagementActionDescriptor } from "./fedos_device_management_action_descriptor.js";

export interface FedosDeviceManagementOverviewRenderContent {
  readonly title: string;
  readonly localDeviceId: string | null;
  readonly localDeviceLabel: string | null;
  readonly localDeviceTrustState: string | null;
  readonly trustedDeviceCount: number;
  readonly revokedDeviceCount: number;
  readonly schedulerEnabled: boolean;
  readonly schedulerRunning: boolean;
  readonly schedulerTickInFlight: boolean;
  readonly pendingScheduleCount: number;
  readonly unresolvedConflictCount: number;
  readonly activeTransferCount: number;
  readonly relayAcceptedTransferCount: number;
  readonly targetImportedTransferCount: number;
  readonly allKnownTransfersImported: boolean;
  readonly syncSummaryLabel: string;
  readonly actions: readonly FedosDeviceManagementActionDescriptor[];
}

export interface FedosDeviceManagementListRenderContent<T> {
  readonly title: string;
  readonly items: readonly T[];
  readonly totalCount: number;
  readonly renderedCount: number;
  readonly truncated: boolean;
  readonly emptyStateMessage: string | null;
  readonly actions: readonly FedosDeviceManagementActionDescriptor[];
}

function listContent<T>(title: string, truncated: FedosDeviceManagementTruncatedList<T>, emptyStateMessage: string, actions: readonly FedosDeviceManagementActionDescriptor[]): FedosDeviceManagementListRenderContent<T> {
  return Object.freeze({
    title,
    items: truncated.items,
    totalCount: truncated.totalCount,
    renderedCount: truncated.renderedCount,
    truncated: truncated.truncated,
    emptyStateMessage: truncated.totalCount === 0 ? emptyStateMessage : null,
    actions,
  });
}

export class FedosDeviceManagementRenderer {
  readonly #controller: FedosDeviceManagementController;

  constructor(controller: FedosDeviceManagementController) {
    this.#controller = controller;
  }

  // ---------------------------------------------------------------------
  // Phase D — Overview.
  // ---------------------------------------------------------------------

  renderOverview(): FedosDesktopRenderModel<FedosDeviceManagementOverviewRenderContent> {
    return fedosRenderModel(this.#controller.overviewState, (content) => {
      const syncSummaryLabel = content.allKnownTransfersImported
        ? "All known transfer sessions imported"
        : content.activeTransferCount === 0
          ? "No active transfer sessions"
          : `${content.targetImportedTransferCount} of ${content.activeTransferCount} transfer sessions imported (Relay acceptance is a separate fact)`;
      return {
        title: "Device Overview",
        localDeviceId: content.localDeviceId,
        localDeviceLabel: content.localDeviceLabel,
        localDeviceTrustState: content.localDeviceTrustState,
        trustedDeviceCount: content.trustedDeviceCount,
        revokedDeviceCount: content.revokedDeviceCount,
        schedulerEnabled: content.schedulerEnabled,
        schedulerRunning: content.schedulerRunning,
        schedulerTickInFlight: content.schedulerTickInFlight,
        pendingScheduleCount: content.pendingScheduleCount,
        unresolvedConflictCount: content.unresolvedConflictCount,
        activeTransferCount: content.activeTransferCount,
        relayAcceptedTransferCount: content.relayAcceptedTransferCount,
        targetImportedTransferCount: content.targetImportedTransferCount,
        allKnownTransfersImported: content.allKnownTransfersImported,
        syncSummaryLabel,
        actions: [
          fedosDeviceManagementAction("open-device-list", "View Devices"),
          fedosDeviceManagementAction("open-sync-status", "View Sync Operations"),
          fedosDeviceManagementAction("open-schedules", "View Pending Schedules"),
          fedosDeviceManagementAction("open-transfers", "View Transfer Sessions"),
          fedosDeviceManagementAction("open-conflicts", "View Conflict Inbox", content.unresolvedConflictCount > 0),
        ],
      };
    });
  }

  // ---------------------------------------------------------------------
  // Phase E — Device list / detail.
  // ---------------------------------------------------------------------

  renderDeviceList(filter: FedosDeviceManagementDeviceListFilter = "all"): FedosDesktopRenderModel<FedosDeviceManagementListRenderContent<FedosDeviceSyncDeviceView>> {
    const titles: Record<FedosDeviceManagementDeviceListFilter, string> = {
      all: "All Devices",
      trusted: "Trusted Devices",
      revoked: "Revoked Devices",
      pending: "Pending Devices",
      local: "Local Device",
      remote: "Remote Devices",
    };
    return fedosRenderModel(this.#controller.deviceListState(filter), (truncated) =>
      listContent(titles[filter], truncated, "No Devices in this view.", [fedosDeviceManagementAction("open-registration", "Register a Device")]),
    );
  }

  renderDeviceDetail(): FedosDesktopRenderModel<FedosDeviceSyncDeviceView & { readonly title: string; readonly actions: readonly FedosDeviceManagementActionDescriptor[] }> {
    return fedosRenderModel(this.#controller.deviceDetailState, (device) => ({
      ...device,
      title: device.label ?? device.deviceId,
      actions: [fedosDeviceManagementAction("request-revoke-device", "Revoke Device", device.trustState !== "revoked", device.trustState === "revoked" ? "already revoked" : null)],
    }));
  }

  // ---------------------------------------------------------------------
  // Phase F — Registration / Revocation confirmation.
  // ---------------------------------------------------------------------

  renderRegistration(): FedosDesktopRenderModel<{ readonly title: string; readonly available: true; readonly reason: string }> {
    const content = this.#controller.registrationContent;
    return Object.freeze({ kind: "content", content: { title: "Device Registration", available: content.available, reason: content.reason } });
  }

  renderRevocationConfirmation(): FedosDesktopRenderModel<
    FedosDeviceManagementRevocationConfirmationContent & { readonly title: string; readonly actions: readonly FedosDeviceManagementActionDescriptor[] }
  > {
    return fedosRenderModel(this.#controller.revocationConfirmationState, (content) => ({
      ...content,
      title: "Confirm Device Revocation",
      actions: [
        fedosDeviceManagementAction("confirm-revoke-device", "Confirm Revoke", content.confirmAvailable, content.confirmUnavailableReason),
        fedosDeviceManagementAction("cancel-confirmation", "Cancel"),
      ],
    }));
  }

  // ---------------------------------------------------------------------
  // Phase G — Sync operations.
  // ---------------------------------------------------------------------

  renderSyncStatus() {
    return fedosRenderModel(this.#controller.syncStatusState, (content) => ({
      title: "Sync Operations",
      status: content.status,
      actionState: content.actionState,
      lastTick: content.lastTick,
      actions: [
        fedosDeviceManagementAction("start-sync", "Start Sync", content.actionState === "stopped"),
        fedosDeviceManagementAction("request-stop-sync", "Stop Sync", content.actionState === "running" || content.actionState === "tick-in-flight"),
        fedosDeviceManagementAction("request-trigger-sync-now", "Trigger Sync Now", content.actionState === "running"),
        fedosDeviceManagementAction("open-schedules", "View Pending Schedules"),
        fedosDeviceManagementAction("open-transfers", "View Transfer Sessions"),
        fedosDeviceManagementAction("open-conflicts", "View Conflict Inbox"),
      ],
    }));
  }

  renderConfirmation() {
    return fedosRenderModel(this.#controller.confirmationState, (content) => ({
      title: "Confirm Action",
      ...content,
      actions: [fedosDeviceManagementAction("confirm-action", "Confirm", content.available, content.unavailableReason), fedosDeviceManagementAction("cancel-confirmation", "Cancel")],
    }));
  }

  // ---------------------------------------------------------------------
  // Phase H — Schedules / Transfers.
  // ---------------------------------------------------------------------

  renderScheduleList(): FedosDesktopRenderModel<FedosDeviceManagementListRenderContent<FedosDeviceSyncScheduleView>> {
    return fedosRenderModel(this.#controller.scheduleListState, (truncated) => listContent("Pending Sync Schedules", truncated, "No sync schedules.", []));
  }

  renderTransferList(): FedosDesktopRenderModel<FedosDeviceManagementListRenderContent<FedosDeviceSyncTransferSessionView>> {
    return fedosRenderModel(this.#controller.transferListState, (truncated) => listContent("Transfer Sessions", truncated, "No transfer sessions.", []));
  }

  renderTransferDetail() {
    return fedosRenderModel(this.#controller.transferDetailState, (transfer) => ({
      ...transfer,
      title: `Transfer Session ${transfer.transferSessionId}`,
      relayDeliveryStatusLabel: transfer.relayAccepted ? "Relay accepted" : "Not yet Relay-accepted",
      importStatusLabel: transfer.deviceImported ? "Imported by target Device" : "Not yet imported by target Device",
    }));
  }

  // ---------------------------------------------------------------------
  // Phase I — Conflicts.
  // ---------------------------------------------------------------------

  renderConflictList(filter: FedosDeviceManagementConflictListFilter = "unresolved"): FedosDesktopRenderModel<FedosDeviceManagementListRenderContent<FedosDeviceSyncConflictView>> {
    const titles: Record<FedosDeviceManagementConflictListFilter, string> = { unresolved: "Unresolved Conflicts", "operator-required": "Operator-Required Conflicts", all: "All Conflicts" };
    return fedosRenderModel(this.#controller.conflictListState(filter), (truncated) => listContent(titles[filter], truncated, "No conflicts in this view.", []));
  }

  renderConflictDetail() {
    return fedosRenderModel(this.#controller.conflictDetailState, (conflict) => ({
      ...conflict,
      title: `Conflict ${conflict.conflictId}`,
      actions: conflict.availableActions.map((action) => fedosDeviceManagementAction(`acknowledge-conflict:${action}`, action, !conflict.resolved)),
    }));
  }

  // ---------------------------------------------------------------------
  // Unavailable / error (Phase B screens).
  // ---------------------------------------------------------------------

  renderUnavailable(reason: string): FedosDesktopRenderModel<{ readonly title: string; readonly reason: string }> {
    return Object.freeze({ kind: "content", content: { title: "Unavailable", reason } });
  }

  renderCurrentScreen(): { readonly screen: FedosDeviceManagementScreen; readonly render: unknown } {
    const screen = this.#controller.navigation.screen;
    switch (screen) {
      case "overview":
        return { screen, render: this.renderOverview() };
      case "device-list":
        return { screen, render: this.renderDeviceList() };
      case "device-detail":
        return { screen, render: this.renderDeviceDetail() };
      case "registration":
        return { screen, render: this.renderRegistration() };
      case "revocation-confirmation":
        return { screen, render: this.renderRevocationConfirmation() };
      case "sync-status":
        return { screen, render: this.renderSyncStatus() };
      case "schedule-list":
        return { screen, render: this.renderScheduleList() };
      case "transfer-list":
        return { screen, render: this.renderTransferList() };
      case "transfer-detail":
        return { screen, render: this.renderTransferDetail() };
      case "conflict-list":
        return { screen, render: this.renderConflictList() };
      case "conflict-detail":
        return { screen, render: this.renderConflictDetail() };
      case "confirmation":
        return { screen, render: this.renderConfirmation() };
      case "unavailable":
        return { screen, render: this.renderUnavailable("this capability is not available") };
      case "error":
        return { screen, render: Object.freeze({ kind: "error", outcome: "failed", message: "an error occurred" }) };
    }
  }
}
