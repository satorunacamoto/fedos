/**
 * Secure Runtime Alpha 3801–3880 ("Device Sync Operational Status and
 * Desktop Shell Integration") — the Runtime Operational Facade (Phase B).
 *
 * The ONE narrow, Runtime-owned boundary that makes Device Sync operational
 * state visible/controllable from the Desktop Shell. Delegates EVERYTHING
 * to already-real, already-wired authorities — constructs no persistence,
 * no crypto, no timer of its own:
 *
 *   - Device inventory/trust: `FedosDeviceTrustRuntime`
 *     (`./fedos_device_trust_runtime.ts`, Alpha 2921–3000, unmodified) —
 *     the SAME instance `FedosRunningDesktopRuntime.deviceTrust()` returns.
 *     No second Device Runtime is constructed anywhere in this file.
 *   - Scheduler status/control: `FedosDeviceSyncScheduler`
 *     (`../../device/sync_scheduler/fedos_device_sync_scheduler.ts`, Alpha
 *     3721–3800, unmodified) — injected, constructed exactly once by
 *     `startFedosDesktopRuntime()` (Phase C) over the SAME
 *     `FedosDeviceRegistryPersistence`/`FedosSyncState` instances
 *     `FedosDeviceTrustRuntime` already owns. This file owns no timer
 *     beyond that one Scheduler's own.
 *   - Conflict visibility/safe actions: `FedosDeviceSyncConflictPersistence`
 *     (Alpha 3721–3800, unmodified) — read/resolve only, never a new
 *     resolution authority.
 *   - Transfer session status: `FedosDeviceTransferSessionPersistence`
 *     (Alpha 3481–3560, unmodified) — READ-ONLY. This Arc does not drive
 *     the Transfer protocol (invite/challenge/approve), only reports
 *     whatever session state already durably exists.
 *   - Relay-accepted vs. Device-imported: `FedosDeviceRelaySyncObservationRepository`
 *     (Alpha 3641–3720, unmodified) via `queryFedosDeviceRelaySyncStatusForSession()`
 *     — the two facts are NEVER collapsed (mirrors that Arc's own Phase L
 *     guarantee); `relayAccepted`/`deviceImported` below are two
 *     INDEPENDENT booleans, never one merged "synced" flag.
 *
 * NO NEW AUTHORITY (see this Arc's own Phase A §20 reconciliation doc):
 * this file does not assemble a real, network-attached Relay Sync graph —
 * every dependency below is OPTIONAL and, when omitted, the corresponding
 * capability honestly reports `"disabled"`, never a fabricated value.
 *
 * Every public method returns a closed `FedosDeviceSyncOperationalResult<T>`
 * — never a raw `Error`, never a raw persisted record, never a secret.
 * Every method checks `isRuntimeRunning()` first and reports `"unavailable"`
 * once the owning Desktop Runtime has stopped — the SAME two-layer defense
 * `FedosDesktopConversationContentAccessor` already established (its own
 * gate on the accessor PLUS this closure's own independent check for a
 * reference a caller grabbed before `stop()`).
 */

import type { FedosDeviceBindingAccountRef, FedosDeviceBindingV1 } from "../../device/fedos_device_binding.js";
import type { FedosDeviceTrustRuntime } from "./fedos_device_trust_runtime.js";
import { FedosDeviceSyncScheduler, type FedosDeviceSyncTickEntry } from "../../device/sync_scheduler/fedos_device_sync_scheduler.js";
import type { FedosDeviceSyncSchedulePersistence } from "../../device/sync_scheduler/persistence/fedos_device_sync_schedule_persistence.js";
import type { FedosDeviceSyncScheduleV1 } from "../../device/sync_scheduler/fedos_device_sync_schedule.js";
import type {
  FedosDeviceSyncConflictPersistence,
  FedosDeviceSyncConflictRecordV1,
  FedosDeviceSyncConflictResolutionAction,
} from "../../device/sync_scheduler/persistence/fedos_device_sync_conflict_persistence.js";
import type { FedosDeviceTransferSessionPersistence } from "../../device/transfer/persistence/fedos_device_transfer_session_persistence.js";
import {
  queryFedosDeviceRelaySyncStatusForSession,
  type FedosDeviceRelaySyncObservationRepository,
} from "../../device/relay_sync/fedos_device_relay_sync_observation.js";

function defaultNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

// ---------------------------------------------------------------------
// Closed, coarse outcome vocabulary.
// ---------------------------------------------------------------------

export type FedosDeviceSyncOperationalOutcomeKind = "ok" | "disabled" | "unavailable" | "not-found" | "invalid-input" | "conflict" | "failed";

export type FedosDeviceSyncOperationalResult<T> =
  | { readonly outcome: "ok"; readonly value: T }
  | { readonly outcome: Exclude<FedosDeviceSyncOperationalOutcomeKind, "ok">; readonly reason: string };

function ok<T>(value: T): FedosDeviceSyncOperationalResult<T> {
  return { outcome: "ok", value };
}
function fail<T>(outcome: Exclude<FedosDeviceSyncOperationalOutcomeKind, "ok">, reason: string): FedosDeviceSyncOperationalResult<T> {
  return { outcome, reason };
}

// ---------------------------------------------------------------------
// Safe view shapes -- no secret, no raw signature, no raw Relay event.
// ---------------------------------------------------------------------

export interface FedosDeviceSyncDeviceView {
  readonly deviceId: string;
  readonly label: string | null;
  readonly accountAuthority: string;
  readonly accountPublicIdentifier: string;
  readonly devicePublicKeyRef: string | null;
  readonly trustState: FedosDeviceBindingV1["trustState"];
  readonly createdAt: number;
  readonly revokedAt: number | null;
  readonly isLocal: boolean;
}

export interface FedosDeviceSyncSchedulerStatusView {
  readonly enabled: boolean;
  readonly running: boolean;
  readonly tickInFlight: boolean;
  readonly scheduleCount: number;
  readonly pendingCount: number;
  readonly inProgressCount: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly operatorRequiredCount: number;
  readonly targetDeviceCount: number;
}

export interface FedosDeviceSyncScheduleView {
  readonly scheduleId: string;
  readonly sourceDeviceId: string;
  readonly targetDeviceId: string;
  readonly state: FedosDeviceSyncScheduleV1["state"];
  readonly attemptCount: number;
  readonly nextEligibleAt: number;
  readonly lastCoarseOutcome: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface FedosDeviceSyncTransferSessionView {
  readonly transferSessionId: string;
  readonly sourceDeviceId: string;
  readonly targetDeviceId: string;
  readonly state: string;
  /** `true` iff at least one configured Relay recorded `"relay-accepted"` for this session -- NEVER implies Device import (see this file's own header). */
  readonly relayAccepted: boolean;
  /** `true` iff the target Device itself recorded `"imported"` -- the ONLY fact this Arc ever labels as import-complete. */
  readonly deviceImported: boolean;
  readonly createdAt: number;
}

export interface FedosDeviceSyncConflictView {
  readonly conflictId: string;
  readonly recordType: string | null;
  readonly conversationId: string;
  readonly sourceDeviceId: string;
  readonly targetDeviceId: string;
  readonly conflictKind: FedosDeviceSyncConflictRecordV1["conflictKind"];
  readonly decision: FedosDeviceSyncConflictRecordV1["decision"];
  readonly reason: string;
  readonly operatorRequired: boolean;
  readonly firstObservedAt: number;
  readonly lastObservedAt: number;
  readonly resolved: boolean;
  readonly resolutionAction: FedosDeviceSyncConflictResolutionAction | null;
  /** Safe actions this facade will accept for `acknowledgeConflict()` -- empty once `resolved`. */
  readonly availableActions: readonly FedosDeviceSyncConflictResolutionAction[];
}

const SAFE_UNRESOLVED_ACTIONS: readonly FedosDeviceSyncConflictResolutionAction[] = [
  "accept-identical",
  "discard-invalid",
  "refresh-missing-dependency",
  "acknowledge",
];

function toDeviceView(binding: FedosDeviceBindingV1, localDeviceId: string): FedosDeviceSyncDeviceView {
  return Object.freeze({
    deviceId: binding.deviceId,
    label: binding.label,
    accountAuthority: binding.accountRef.authority,
    accountPublicIdentifier: binding.accountRef.publicIdentifier,
    devicePublicKeyRef: binding.devicePublicKeyRef,
    trustState: binding.trustState,
    createdAt: binding.createdAt,
    revokedAt: binding.revokedAt,
    isLocal: binding.deviceId === localDeviceId,
  });
}

function toScheduleView(schedule: FedosDeviceSyncScheduleV1): FedosDeviceSyncScheduleView {
  return Object.freeze({
    scheduleId: schedule.scheduleId,
    sourceDeviceId: schedule.sourceDeviceId,
    targetDeviceId: schedule.targetDeviceId,
    state: schedule.state,
    attemptCount: schedule.attemptCount,
    nextEligibleAt: schedule.nextEligibleAt,
    lastCoarseOutcome: schedule.lastCoarseOutcome,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  });
}

function toConflictView(record: FedosDeviceSyncConflictRecordV1): FedosDeviceSyncConflictView {
  return Object.freeze({
    conflictId: record.conflictId,
    recordType: record.recordType,
    conversationId: record.conversationId,
    sourceDeviceId: record.sourceDeviceId,
    targetDeviceId: record.targetDeviceId,
    conflictKind: record.conflictKind,
    decision: record.decision,
    reason: record.reason,
    operatorRequired: record.decision === "require-operator",
    firstObservedAt: record.firstObservedAt,
    lastObservedAt: record.lastObservedAt,
    resolved: record.resolved,
    resolutionAction: record.resolutionAction,
    availableActions: record.resolved ? [] : SAFE_UNRESOLVED_ACTIONS,
  });
}

export interface FedosDeviceSyncOperationalFacadeDeps {
  readonly deviceTrust: FedosDeviceTrustRuntime;
  readonly localAccountRef: FedosDeviceBindingAccountRef;
  readonly localDeviceId: string;
  /** `null` -- Scheduler was never configured (`config.deviceSyncSchedulerEnabled` omitted/false). */
  readonly scheduler: FedosDeviceSyncScheduler | null;
  readonly schedulePersistence: FedosDeviceSyncSchedulePersistence | null;
  readonly conflictPersistence: FedosDeviceSyncConflictPersistence | null;
  readonly transferSessionPersistence: FedosDeviceTransferSessionPersistence | null;
  readonly relaySyncObservationRepository: FedosDeviceRelaySyncObservationRepository | null;
  readonly isRuntimeRunning: () => boolean;
  readonly now?: () => number;
}

export class FedosDeviceSyncOperationalFacade {
  readonly #deps: FedosDeviceSyncOperationalFacadeDeps;
  readonly #now: () => number;

  constructor(deps: FedosDeviceSyncOperationalFacadeDeps) {
    this.#deps = deps;
    this.#now = deps.now ?? defaultNowSeconds;
  }

  #checkRunning<T>(): FedosDeviceSyncOperationalResult<T> | null {
    if (!this.#deps.isRuntimeRunning()) return fail("unavailable", "the owning Desktop Runtime has stopped");
    return null;
  }

  // -- Device inventory / trust -----------------------------------------

  listDevices(): FedosDeviceSyncOperationalResult<readonly FedosDeviceSyncDeviceView[]> {
    const gate = this.#checkRunning<readonly FedosDeviceSyncDeviceView[]>();
    if (gate !== null) return gate;
    return ok(this.#deps.deviceTrust.listDevices().map((b) => toDeviceView(b, this.#deps.localDeviceId)));
  }

  deviceDetail(deviceId: string): FedosDeviceSyncOperationalResult<FedosDeviceSyncDeviceView> {
    const gate = this.#checkRunning<FedosDeviceSyncDeviceView>();
    if (gate !== null) return gate;
    if (typeof deviceId !== "string" || deviceId.trim().length === 0) return fail("invalid-input", "deviceId must be a non-empty string");
    const binding = this.#deps.deviceTrust.getDevice(deviceId);
    if (binding === null) return fail("not-found", `no Device binding for "${deviceId}"`);
    return ok(toDeviceView(binding, this.#deps.localDeviceId));
  }

  // -- Scheduler status/control ------------------------------------------

  syncStatus(): FedosDeviceSyncOperationalResult<FedosDeviceSyncSchedulerStatusView> {
    const gate = this.#checkRunning<FedosDeviceSyncSchedulerStatusView>();
    if (gate !== null) return gate;
    if (this.#deps.scheduler === null || this.#deps.schedulePersistence === null) {
      return fail("disabled", "Device Sync Scheduler is not enabled -- see config.deviceSyncSchedulerEnabled");
    }
    const status = this.#deps.scheduler.syncStatus();
    const schedules = this.#deps.schedulePersistence.listAllSchedules();
    const targetDeviceCount = new Set(schedules.map((s) => s.targetDeviceId)).size;
    return ok(
      Object.freeze({
        enabled: true,
        running: status.running,
        tickInFlight: status.tickInFlight,
        scheduleCount: status.scheduleCount,
        pendingCount: status.pendingCount,
        inProgressCount: status.inProgressCount,
        completedCount: status.completedCount,
        failedCount: status.failedCount,
        operatorRequiredCount: status.operatorRequiredCount,
        targetDeviceCount,
      }),
    );
  }

  startSync(): FedosDeviceSyncOperationalResult<null> {
    const gate = this.#checkRunning<null>();
    if (gate !== null) return gate;
    if (this.#deps.scheduler === null) return fail("disabled", "Device Sync Scheduler is not enabled -- see config.deviceSyncSchedulerEnabled");
    try {
      this.#deps.scheduler.startSync();
      return ok(null);
    } catch {
      return fail("conflict", "Device Sync Scheduler is already running");
    }
  }

  async stopSync(): Promise<FedosDeviceSyncOperationalResult<null>> {
    const gate = this.#checkRunning<null>();
    if (gate !== null) return gate;
    if (this.#deps.scheduler === null) return fail("disabled", "Device Sync Scheduler is not enabled -- see config.deviceSyncSchedulerEnabled");
    await this.#deps.scheduler.stopSync();
    return ok(null);
  }

  async triggerSyncNow(): Promise<FedosDeviceSyncOperationalResult<readonly FedosDeviceSyncTickEntry[]>> {
    const gate = this.#checkRunning<readonly FedosDeviceSyncTickEntry[]>();
    if (gate !== null) return gate;
    if (this.#deps.scheduler === null) return fail("disabled", "Device Sync Scheduler is not enabled -- see config.deviceSyncSchedulerEnabled");
    if (!this.#deps.scheduler.isRunning()) return fail("conflict", "Device Sync Scheduler is not running -- call startSync() first");
    try {
      const entries = await this.#deps.scheduler.triggerSyncNow();
      return ok(entries);
    } catch {
      return fail("failed", "triggerSyncNow() failed");
    }
  }

  // -- Schedules ----------------------------------------------------------

  listSchedules(): FedosDeviceSyncOperationalResult<readonly FedosDeviceSyncScheduleView[]> {
    const gate = this.#checkRunning<readonly FedosDeviceSyncScheduleView[]>();
    if (gate !== null) return gate;
    if (this.#deps.schedulePersistence === null) return fail("disabled", "Device Sync Scheduler is not enabled -- see config.deviceSyncSchedulerEnabled");
    return ok(this.#deps.schedulePersistence.listAllSchedules().map(toScheduleView));
  }

  // -- Conflicts ------------------------------------------------------------

  listConflicts(includeResolved = false): FedosDeviceSyncOperationalResult<readonly FedosDeviceSyncConflictView[]> {
    const gate = this.#checkRunning<readonly FedosDeviceSyncConflictView[]>();
    if (gate !== null) return gate;
    if (this.#deps.conflictPersistence === null) return fail("disabled", "Device Sync Conflict tracking is not enabled -- see config.deviceSyncSchedulerEnabled");
    const records = includeResolved ? this.#deps.conflictPersistence.listAll() : this.#deps.conflictPersistence.listUnresolved();
    return ok(records.map(toConflictView));
  }

  conflictDetail(conflictId: string): FedosDeviceSyncOperationalResult<FedosDeviceSyncConflictView> {
    const gate = this.#checkRunning<FedosDeviceSyncConflictView>();
    if (gate !== null) return gate;
    if (this.#deps.conflictPersistence === null) return fail("disabled", "Device Sync Conflict tracking is not enabled -- see config.deviceSyncSchedulerEnabled");
    if (typeof conflictId !== "string" || conflictId.trim().length === 0) return fail("invalid-input", "conflictId must be a non-empty string");
    const record = this.#deps.conflictPersistence.get(conflictId);
    if (record === null) return fail("not-found", `no Conflict record for "${conflictId}"`);
    return ok(toConflictView(record));
  }

  /** Phase H -- ONLY the 4 actions the real Conflict persistence itself already supports; never a generic "resolve-any-conflict." */
  acknowledgeConflict(conflictId: string, action: FedosDeviceSyncConflictResolutionAction): FedosDeviceSyncOperationalResult<null> {
    const gate = this.#checkRunning<null>();
    if (gate !== null) return gate;
    if (this.#deps.conflictPersistence === null) return fail("disabled", "Device Sync Conflict tracking is not enabled -- see config.deviceSyncSchedulerEnabled");
    if (typeof conflictId !== "string" || conflictId.trim().length === 0) return fail("invalid-input", "conflictId must be a non-empty string");
    if (!SAFE_UNRESOLVED_ACTIONS.includes(action)) return fail("invalid-input", `unsupported resolution action "${String(action)}"`);
    const existing = this.#deps.conflictPersistence.get(conflictId);
    if (existing === null) return fail("not-found", `no Conflict record for "${conflictId}"`);
    if (existing.resolved) return fail("conflict", `Conflict "${conflictId}" is already resolved`);
    const resolved = this.#deps.conflictPersistence.resolve(conflictId, action, this.#now());
    if (!resolved) return fail("failed", `failed to resolve Conflict "${conflictId}"`);
    return ok(null);
  }

  // -- Transfer sessions ------------------------------------------------------

  listTransferSessions(): FedosDeviceSyncOperationalResult<readonly FedosDeviceSyncTransferSessionView[]> {
    const gate = this.#checkRunning<readonly FedosDeviceSyncTransferSessionView[]>();
    if (gate !== null) return gate;
    if (this.#deps.transferSessionPersistence === null) return fail("disabled", "Device Transfer session tracking is not enabled -- see config.deviceSyncTransferSessionLogPath");
    const sessions = this.#deps.transferSessionPersistence.listSessionsForAccount(
      this.#deps.localAccountRef.authority,
      this.#deps.localAccountRef.publicIdentifier,
    );
    return ok(sessions.map((session) => this.#toTransferSessionView(session)));
  }

  #toTransferSessionView(session: { sessionId: string; initiatorDeviceId: string; responderDeviceId: string; state: string; createdAt: number }): FedosDeviceSyncTransferSessionView {
    let relayAccepted = false;
    let deviceImported = false;
    if (this.#deps.relaySyncObservationRepository !== null) {
      const facts = queryFedosDeviceRelaySyncStatusForSession(this.#deps.relaySyncObservationRepository, session.sessionId);
      relayAccepted = facts.some((f) => f.state === "relay-accepted");
      deviceImported = facts.some((f) => f.state === "imported");
    }
    return Object.freeze({
      transferSessionId: session.sessionId,
      sourceDeviceId: session.initiatorDeviceId,
      targetDeviceId: session.responderDeviceId,
      state: session.state,
      relayAccepted,
      deviceImported,
      createdAt: session.createdAt,
    });
  }
}
