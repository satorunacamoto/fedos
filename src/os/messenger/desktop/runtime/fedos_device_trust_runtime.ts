/**
 * Secure Runtime Alpha 2921–3000 ("Device Trust and Multi-Device Runtime
 * Integration") — Device Trust Runtime (Phases F/G/I/J).
 *
 * The one narrow facade `./fedos_desktop_runtime.ts`'s
 * `FedosRunningDesktopRuntime.deviceTrust()` accessor returns (mirrors
 * `boardRuntime()`/`conversationRuntime()`/`privateTransport()`'s own
 * exact "one instance per running runtime, no global singleton, throws
 * once the owning runtime has stopped" contract — enforced by that
 * accessor itself, not duplicated here).
 *
 * Owns exactly what Phase F names: one local Device identity
 * (`localDeviceId`), the Device Registry + Device Trust Authority
 * (`PersistedFedosDeviceTrustAuthority`, `../../device/persistence/persisted_fedos_device_trust_authority.ts`),
 * and the EXISTING Sync Journal/Cursor (`FedosSyncState`,
 * `../../sync/fedos_sync_state.ts`, Alpha 2421–2500, unmodified) —
 * bridged together so that sync-fabric membership always follows Device
 * Trust, never the reverse:
 *
 *   - `registerSyncDevice()` only ever calls the underlying
 *     `FedosSyncState.registerDevice()` for a `deviceId` this facade's
 *     own Device Trust Authority currently reports `"trusted"` — a
 *     `"pending"`/`"unavailable"`/`"revoked"` device can never join the
 *     Sync Journal's fan-out set through this facade.
 *   - `recordLocalChange()` runs `reviewFedosSyncRecordForJournal()`
 *     (`../../sync/fedos_sync_record_allowlist.ts`, Phase G) BEFORE ever
 *     calling `FedosSyncState.recordLocalChange()` — an unknown or
 *     secret-bearing `recordType` never reaches the Journal.
 *   - `revokeDevice()` revokes BOTH the Device Trust Authority's own
 *     binding AND (best-effort, if the device was ever registered into
 *     sync) the `FedosSyncState` registry entry — closing Phase I's
 *     "future sync eligibility denied" requirement without claiming any
 *     retroactive deletion of already-journaled history (Phase I's own
 *     explicit "do not erase historical Device Binding facts").
 *   - `restoreDeviceFromRecoverySnapshot()` requires the target device to
 *     currently be `"trusted"` — Phase J's "restored Runtime requires
 *     its own Device trust process," never inherited from a snapshot
 *     alone.
 *
 * Restart/cursor limitation, stated honestly (Phase H): `FedosSyncJournal`/
 * `FedosSyncCursorStore` remain exactly what Alpha 2421–2500 already
 * built — an in-memory, single-process structure. This Arc does not add
 * disk persistence for the Journal or Cursor (Phase G/H's own "use the
 * EXISTING Sync Journal" instruction, and the absolute prohibition on
 * redesigning the Sync Foundation). "Restart recovery" here means: the
 * Device Registry (Phase D) is durable across a process restart when
 * constructed over `deviceRegistryLogPath`; the Sync Journal's own
 * position for a device is durable ACROSS A RESTART ONLY via the
 * existing `captureRecoverySnapshot()`/`restoreDeviceFromRecoverySnapshot()`
 * pair (Alpha 2421–2500), which a caller must invoke explicitly — there
 * is still no multi-writer/multi-process Journal in this codebase.
 */

import {
  fedosDeviceBindingAccountRefsEqual,
  type FedosDeviceBindingAccountRef,
  type FedosDeviceBindingV1,
} from "../../device/fedos_device_binding.js";
import type { FedosDeviceRegistrationRequest } from "../../device/fedos_device_registration_authority.js";
import {
  PersistedFedosDeviceTrustAuthority,
  type FedosDeviceRegistrationResult,
  type FedosDeviceRevocationResult,
  type FedosDeviceTrustConfirmationResult,
} from "../../device/persistence/persisted_fedos_device_trust_authority.js";
import {
  reviewFedosSyncRecordForJournal,
  type FedosSyncAllowedRecordType,
} from "../../../../sync/fedos_sync_record_allowlist.js";
import {
  FedosSyncState,
  type FedosSyncApplyResult,
  type FedosSyncLocalChangeInput,
} from "../../../../sync/fedos_sync_state.js";
import type { FedosSyncCursor } from "../../../../sync/fedos_sync_cursor.js";
import type { FedosSyncDeviceBinding } from "../../../../sync/fedos_sync_device_binding.js";
import type { FedosSyncJournalAppendResult, FedosSyncJournalEntryV1 } from "../../../../sync/fedos_sync_journal.js";
import type { FedosSyncRecoverySnapshotV1 } from "../../../../sync/fedos_sync_recovery.js";

export type FedosSyncChangeRejectedReason = "device-not-trusted" | "record-type-not-allowed";

export type FedosRecordLocalChangeResult =
  | { readonly outcome: "recorded"; readonly append: FedosSyncJournalAppendResult }
  | { readonly outcome: "rejected"; readonly reason: FedosSyncChangeRejectedReason; readonly detail: string };

export interface FedosDeviceSyncReadiness {
  readonly deviceId: string;
  readonly trustState: FedosDeviceBindingV1["trustState"] | "unknown";
  readonly registeredForSync: boolean;
  readonly ready: boolean;
}

export class FedosDeviceTrustRuntime {
  readonly #localDeviceId: string;
  readonly #localAccountRef: FedosDeviceBindingAccountRef;
  readonly #trustAuthority: PersistedFedosDeviceTrustAuthority;
  readonly #syncState: FedosSyncState;

  constructor(deps: {
    localDeviceId: string;
    localAccountRef: FedosDeviceBindingAccountRef;
    trustAuthority: PersistedFedosDeviceTrustAuthority;
    syncState: FedosSyncState;
  }) {
    this.#localDeviceId = deps.localDeviceId;
    this.#localAccountRef = deps.localAccountRef;
    this.#trustAuthority = deps.trustAuthority;
    this.#syncState = deps.syncState;
  }

  localDeviceId(): string {
    return this.#localDeviceId;
  }

  localAccountRef(): FedosDeviceBindingAccountRef {
    return this.#localAccountRef;
  }

  registerDevice(request: FedosDeviceRegistrationRequest, now: number): FedosDeviceRegistrationResult {
    return this.#trustAuthority.registerDevice(request, now);
  }

  confirmTrust(deviceId: string, now: number): FedosDeviceTrustConfirmationResult {
    return this.#trustAuthority.confirmTrust(deviceId, now);
  }

  /** Phase I — revokes the Device Binding, then (best-effort) removes future sync eligibility in the existing Sync fabric. Never erases past Journal history. */
  revokeDevice(deviceId: string, now: number): FedosDeviceRevocationResult {
    const result = this.#trustAuthority.revokeDevice(deviceId, now);
    if (result.outcome === "revoked") {
      this.#syncState.revokeDevice(deviceId, now);
    }
    return result;
  }

  getDevice(deviceId: string): FedosDeviceBindingV1 | null {
    return this.#trustAuthority.getBinding(deviceId);
  }

  listDevices(): readonly FedosDeviceBindingV1[] {
    return this.#trustAuthority.listBindingsForAccount(this.#localAccountRef);
  }

  listTrustedDevices(): readonly FedosDeviceBindingV1[] {
    return this.#trustAuthority.listTrustedBindingsForAccount(this.#localAccountRef);
  }

  isDeviceTrusted(deviceId: string): boolean {
    return this.#trustAuthority.isDeviceTrusted(deviceId);
  }

  /** Only ever joins the existing Sync fabric a `"trusted"` device — never a `"pending"`/`"unavailable"`/`"revoked"` one. */
  registerSyncDevice(deviceId: string, now: number): "registered" | "already-registered" | "conflict" | "not-trusted" {
    if (!this.isDeviceTrusted(deviceId)) return "not-trusted";
    return this.#syncState.registerDevice(deviceId, now);
  }

  listSyncDevices(): readonly FedosSyncDeviceBinding[] {
    return this.#syncState.listDevices();
  }

  /** Phase G — the allowlist gate runs before the existing Journal is ever touched; Phase I — a revoked/untrusted origin device is refused before the gate even runs. */
  recordLocalChange(
    originDeviceRef: string,
    recordType: FedosSyncAllowedRecordType | string,
    input: FedosSyncLocalChangeInput,
    now: number,
    metadata?: Readonly<Record<string, string>>,
  ): FedosRecordLocalChangeResult {
    if (!this.isDeviceTrusted(originDeviceRef)) {
      return { outcome: "rejected", reason: "device-not-trusted", detail: `device "${originDeviceRef}" is not currently trusted` };
    }
    const review = reviewFedosSyncRecordForJournal(recordType, metadata);
    if (!review.allowed) {
      return { outcome: "rejected", reason: "record-type-not-allowed", detail: review.reason };
    }
    return { outcome: "recorded", append: this.#syncState.recordLocalChange(originDeviceRef, input, now) };
  }

  deliverQueuedChanges(targetDeviceRef: string, now: number): number {
    return this.#syncState.deliverQueuedChanges(targetDeviceRef, now);
  }

  applyPendingChanges(deviceRef: string, now: number): readonly FedosSyncApplyResult[] {
    return this.#syncState.applyPendingChanges(deviceRef, now);
  }

  getCursor(deviceRef: string): FedosSyncCursor {
    return this.#syncState.getCursor(deviceRef);
  }

  listPendingChanges(deviceRef: string): readonly FedosSyncJournalEntryV1[] {
    return this.#syncState.listPendingChanges(deviceRef);
  }

  journalEntries(): readonly FedosSyncJournalEntryV1[] {
    return this.#syncState.journalEntries();
  }

  captureRecoverySnapshot(deviceRef: string, now: number): FedosSyncRecoverySnapshotV1 {
    return this.#syncState.captureRecoverySnapshot(deviceRef, now);
  }

  /** Phase J — a restored device must currently be `"trusted"` in THIS Runtime's own Device Trust Authority; a snapshot alone never implies trust. */
  restoreDeviceFromRecoverySnapshot(snapshot: FedosSyncRecoverySnapshotV1): boolean {
    if (!this.isDeviceTrusted(snapshot.deviceRef)) return false;
    return this.#syncState.restoreDeviceFromRecoverySnapshot(snapshot);
  }

  /** Phase F — the one "conflict/readiness query" this Runtime owns: a device is sync-ready only when BOTH currently trusted AND currently registered in the existing Sync fabric. */
  syncReadiness(deviceId: string): FedosDeviceSyncReadiness {
    const binding = this.getDevice(deviceId);
    const registeredForSync = this.#syncState.listDevices().some((d) => d.deviceRef === deviceId);
    const trustState = binding?.trustState ?? "unknown";
    return {
      deviceId,
      trustState,
      registeredForSync,
      ready: trustState === "trusted" && registeredForSync,
    };
  }

  /** `true` iff `accountRef` matches this Runtime's own local account — used to refuse a caller impersonating a different account (Phase E's "no self-asserted ownership" requirement, checked at the facade boundary in addition to the Authority's own check). */
  isLocalAccount(accountRef: FedosDeviceBindingAccountRef): boolean {
    return fedosDeviceBindingAccountRefsEqual(accountRef, this.#localAccountRef);
  }
}
