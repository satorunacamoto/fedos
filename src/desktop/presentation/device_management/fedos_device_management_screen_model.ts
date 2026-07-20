/**
 * Secure Runtime Alpha 3941–4020 — Phases D/E/F/G/H/I/K: screen-specific
 * content shapes. Pure types + pure builder functions only — no Shell
 * call, no ViewModel reference, no mutation lives in this file (the
 * controller, `fedos_device_management_controller.ts`, is the one place
 * that reads ViewModel state and calls these builders). Every shape here
 * is plain, JSON-serializable data (Phase J's own "structured-clone-safe"
 * requirement, enforced one layer further out by the renderer, but true
 * of every type in this file already by construction — no function, no
 * class instance, no `Error`).
 */

import type {
  FedosDeviceSyncConflictView,
  FedosDeviceSyncDeviceView,
  FedosDeviceSyncScheduleView,
  FedosDeviceSyncSchedulerStatusView,
  FedosDeviceSyncTransferSessionView,
} from "../../runtime/fedos_device_sync_operational_facade.js";
import type { FedosDeviceSyncTickEntry } from "../../../device/sync_scheduler/fedos_device_sync_scheduler.js";
import type { FedosDeviceManagementConfirmationAction } from "./fedos_device_management_screen.js";
import { fedosDeviceManagementTruncateText, FEDOS_DEVICE_MANAGEMENT_MAX_DIAGNOSTIC_LENGTH } from "./fedos_device_management_presentation_limits.js";

// ---------------------------------------------------------------------
// Phase D — Overview.
// ---------------------------------------------------------------------

export interface FedosDeviceManagementOverviewContent {
  readonly localDeviceId: string | null;
  readonly localDeviceLabel: string | null;
  readonly localDeviceTrustState: FedosDeviceSyncDeviceView["trustState"] | null;
  readonly trustedDeviceCount: number;
  readonly revokedDeviceCount: number;
  readonly schedulerEnabled: boolean;
  readonly schedulerRunning: boolean;
  readonly schedulerTickInFlight: boolean;
  readonly pendingScheduleCount: number;
  readonly unresolvedConflictCount: number;
  readonly activeTransferCount: number;
  readonly lastCoarseSyncOutcome: string | null;
  readonly relayAcceptedTransferCount: number;
  readonly targetImportedTransferCount: number;
  /**
   * `true` ONLY when the Scheduler is enabled, every currently-known
   * transfer session (`activeTransferCount` included) reports
   * `deviceImported: true`, and no unresolved conflict exists — Phase D's
   * own "never display a generic 'Everything Synced' label unless actual
   * imported state supports it for ALL relevant targets" requirement.
   * `false` whenever there is nothing to claim (e.g. zero transfer
   * sessions exist yet) — an empty set never counts as "everything
   * synced."
   */
  readonly allKnownTransfersImported: boolean;
}

export function fedosDeviceManagementBuildOverview(input: {
  readonly localDevice: FedosDeviceSyncDeviceView | null;
  readonly devices: readonly FedosDeviceSyncDeviceView[];
  readonly schedulerStatus: FedosDeviceSyncSchedulerStatusView | null;
  readonly unresolvedConflictCount: number;
  readonly transfers: readonly FedosDeviceSyncTransferSessionView[];
}): FedosDeviceManagementOverviewContent {
  const trustedDeviceCount = input.devices.filter((d) => d.trustState === "trusted").length;
  const revokedDeviceCount = input.devices.filter((d) => d.trustState === "revoked").length;
  const relayAcceptedTransferCount = input.transfers.filter((t) => t.relayAccepted).length;
  const targetImportedTransferCount = input.transfers.filter((t) => t.deviceImported).length;
  const activeTransferCount = input.transfers.length;
  const allKnownTransfersImported =
    activeTransferCount > 0 && targetImportedTransferCount === activeTransferCount && input.unresolvedConflictCount === 0 && (input.schedulerStatus?.enabled ?? false);

  return Object.freeze({
    localDeviceId: input.localDevice?.deviceId ?? null,
    localDeviceLabel: input.localDevice?.label ?? null,
    localDeviceTrustState: input.localDevice?.trustState ?? null,
    trustedDeviceCount,
    revokedDeviceCount,
    schedulerEnabled: input.schedulerStatus?.enabled ?? false,
    schedulerRunning: input.schedulerStatus?.running ?? false,
    schedulerTickInFlight: input.schedulerStatus?.tickInFlight ?? false,
    pendingScheduleCount: input.schedulerStatus?.pendingCount ?? 0,
    unresolvedConflictCount: input.unresolvedConflictCount,
    activeTransferCount,
    lastCoarseSyncOutcome: null,
    relayAcceptedTransferCount,
    targetImportedTransferCount,
    allKnownTransfersImported,
  });
}

// ---------------------------------------------------------------------
// Phase E — Device list filters.
// ---------------------------------------------------------------------

export type FedosDeviceManagementDeviceListFilter = "all" | "trusted" | "revoked" | "pending" | "local" | "remote";

export const FEDOS_DEVICE_MANAGEMENT_DEVICE_LIST_FILTERS: readonly FedosDeviceManagementDeviceListFilter[] = ["all", "trusted", "revoked", "pending", "local", "remote"];

export function isFedosDeviceManagementDeviceListFilter(candidate: unknown): candidate is FedosDeviceManagementDeviceListFilter {
  return typeof candidate === "string" && (FEDOS_DEVICE_MANAGEMENT_DEVICE_LIST_FILTERS as readonly string[]).includes(candidate);
}

export function fedosDeviceManagementFilterDevices(devices: readonly FedosDeviceSyncDeviceView[], filter: FedosDeviceManagementDeviceListFilter): readonly FedosDeviceSyncDeviceView[] {
  switch (filter) {
    case "all":
      return devices;
    case "trusted":
      return devices.filter((d) => d.trustState === "trusted");
    case "revoked":
      return devices.filter((d) => d.trustState === "revoked");
    case "pending":
      return devices.filter((d) => d.trustState === "pending");
    case "local":
      return devices.filter((d) => d.isLocal);
    case "remote":
      return devices.filter((d) => !d.isLocal);
  }
}

// ---------------------------------------------------------------------
// Phase F — Registration / Revocation Confirmation.
// ---------------------------------------------------------------------

/**
 * Honest, real fact (Phase A §20 / Phase F's own "if no complete Shell
 * registration command exists, complete the screen models that can be
 * real and stop at the exact missing command boundary"): no
 * `registerDevice`/`mintChallenge`/`confirmTrust` command exists anywhere
 * on `FedosDesktopApplicationShell`/`FedosDeviceSyncOperationalFacade` on
 * this base. This screen therefore always reports `available: false` —
 * mirroring `deviceStatus()`'s own established "real, intentional,
 * non-placeholder unavailable" precedent, never a fabricated challenge or
 * a fake success.
 */
export interface FedosDeviceManagementRegistrationContent {
  readonly available: false;
  readonly reason: string;
}

export function fedosDeviceManagementBuildRegistration(): FedosDeviceManagementRegistrationContent {
  return Object.freeze({
    available: false,
    reason: "Device registration has no Shell/Facade command on this base -- see Alpha 3941-4020 Phase A finding.",
  });
}

export interface FedosDeviceManagementRevocationConfirmationContent {
  readonly deviceId: string;
  readonly deviceLabel: string | null;
  readonly confirmationText: string;
  readonly terminalWarning: string;
  readonly noRemoteErasureWarning: string;
  /** `false` on this base -- no `revokeDevice()` command exists on the Shell/Facade (only `runtime.deviceTrust().revokeDevice()`, unreachable from this presentation layer without a new Shell command this Arc does not add). */
  readonly confirmAvailable: false;
  readonly confirmUnavailableReason: string;
}

export function fedosDeviceManagementBuildRevocationConfirmation(device: FedosDeviceSyncDeviceView): FedosDeviceManagementRevocationConfirmationContent {
  return Object.freeze({
    deviceId: device.deviceId,
    deviceLabel: device.label,
    confirmationText: `Revoke Device "${device.label ?? device.deviceId}"? This cannot be undone.`,
    terminalWarning: "Revocation is terminal -- a revoked Device can never be trusted again under this same Device id.",
    noRemoteErasureWarning: "Data already delivered to this Device before revocation is not remotely erased.",
    confirmAvailable: false,
    confirmUnavailableReason: "Device revocation has no Shell/Facade command on this base -- see Alpha 3941-4020 Phase A finding.",
  });
}

// ---------------------------------------------------------------------
// Phase G — Sync operations action state.
// ---------------------------------------------------------------------

export type FedosDeviceManagementSyncActionState = "disabled" | "unavailable" | "stopped" | "starting" | "running" | "tick-in-flight" | "stopping" | "failed";

export function fedosDeviceManagementDeriveSyncActionState(input: {
  readonly schedulerStatus: FedosDeviceSyncSchedulerStatusView | null;
  readonly actionInFlight: "start" | "stop" | null;
  readonly loadOutcome: "unavailable" | "unsupported" | null;
}): FedosDeviceManagementSyncActionState {
  if (input.loadOutcome === "unavailable") return "unavailable";
  if (input.loadOutcome === "unsupported") return "disabled";
  if (input.schedulerStatus === null) return "unavailable";
  if (!input.schedulerStatus.enabled) return "disabled";
  if (input.actionInFlight === "start") return "starting";
  if (input.actionInFlight === "stop") return "stopping";
  if (input.schedulerStatus.tickInFlight) return "tick-in-flight";
  return input.schedulerStatus.running ? "running" : "stopped";
}

export interface FedosDeviceManagementSyncStatusContent {
  readonly status: FedosDeviceSyncSchedulerStatusView | null;
  readonly actionState: FedosDeviceManagementSyncActionState;
  readonly lastTick: readonly FedosDeviceSyncTickEntry[] | null;
}

// ---------------------------------------------------------------------
// Phase I — Conflict filters.
// ---------------------------------------------------------------------

export type FedosDeviceManagementConflictListFilter = "unresolved" | "operator-required" | "all";

export const FEDOS_DEVICE_MANAGEMENT_CONFLICT_LIST_FILTERS: readonly FedosDeviceManagementConflictListFilter[] = ["unresolved", "operator-required", "all"];

export function isFedosDeviceManagementConflictListFilter(candidate: unknown): candidate is FedosDeviceManagementConflictListFilter {
  return typeof candidate === "string" && (FEDOS_DEVICE_MANAGEMENT_CONFLICT_LIST_FILTERS as readonly string[]).includes(candidate);
}

export function fedosDeviceManagementFilterConflicts(conflicts: readonly FedosDeviceSyncConflictView[], filter: FedosDeviceManagementConflictListFilter): readonly FedosDeviceSyncConflictView[] {
  switch (filter) {
    case "all":
      return conflicts;
    case "unresolved":
      return conflicts.filter((c) => !c.resolved);
    case "operator-required":
      return conflicts.filter((c) => c.operatorRequired && !c.resolved);
  }
}

// ---------------------------------------------------------------------
// Phase C/G — generic confirmation screen.
// ---------------------------------------------------------------------

export interface FedosDeviceManagementConfirmationContent {
  readonly action: FedosDeviceManagementConfirmationAction;
  readonly deviceId: string | null;
  readonly confirmationText: string;
  readonly available: boolean;
  readonly unavailableReason: string | null;
}

// ---------------------------------------------------------------------
// Shared diagnostic truncation for any Shell/facade `reason` string this
// Arc's own screens surface verbatim.
// ---------------------------------------------------------------------

export function fedosDeviceManagementTruncateReason(reason: string): string {
  return fedosDeviceManagementTruncateText(reason, FEDOS_DEVICE_MANAGEMENT_MAX_DIAGNOSTIC_LENGTH) ?? "";
}
