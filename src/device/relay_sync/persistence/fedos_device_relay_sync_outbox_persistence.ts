/**
 * Secure Runtime Alpha 3641–3720 — Device Sync Outbox Persistence
 * (Phase D: "No duplicate package construction for the same
 * transfer/session revision").
 *
 * A DELIBERATELY SEPARATE, small, Device-Sync-scoped port — mirrors this
 * codebase's own already-established "a transport outbox intent is not a
 * Board outbox intent" discipline
 * (`../../../conversation/transport/fedos_conversation_transport_outbox_persistence.ts`'s
 * own header) one domain further: one record per `transferSessionId`, an
 * insert-only guard a caller checks BEFORE ever calling
 * `FedosDeviceTransferCoordinator.buildTransferPackage()` again for a
 * session that already has one.
 */

export interface FedosPersistedDeviceRelaySyncOutboxRecordV1 {
  readonly schemaVersion: 1;
  readonly transferSessionId: string;
  readonly packageContentHash: string;
  readonly deliveryId: string;
  readonly builtAt: number;
  /** The already-built `FedosDeviceTransferPackageV1` (serialized, base64) — cached here so a retry NEVER calls `FedosDeviceTransferCoordinator.buildTransferPackage()` a second time for the same session; it is re-read and re-published instead. */
  readonly transferPackageBase64: string;
}

export type FedosDeviceRelaySyncOutboxWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosDeviceRelaySyncOutboxPersistence {
  putRecord(record: FedosPersistedDeviceRelaySyncOutboxRecordV1): FedosDeviceRelaySyncOutboxWriteResult;
  getRecord(transferSessionId: string): FedosPersistedDeviceRelaySyncOutboxRecordV1 | null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidUnixSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

/** Structural validation only. Fails closed; never throws. */
export function isWellFormedFedosPersistedDeviceRelaySyncOutboxRecordV1(candidate: unknown): candidate is FedosPersistedDeviceRelaySyncOutboxRecordV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  if (Object.keys(value).length !== 6) return false;
  if (value.schemaVersion !== 1) return false;
  if (!isNonEmptyString(value.transferSessionId)) return false;
  if (typeof value.packageContentHash !== "string" || !/^[0-9a-f]{64}$/.test(value.packageContentHash)) return false;
  if (!isNonEmptyString(value.deliveryId)) return false;
  if (!isValidUnixSeconds(value.builtAt)) return false;
  if (typeof value.transferPackageBase64 !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(value.transferPackageBase64)) return false;
  return true;
}

export function fedosPersistedDeviceRelaySyncOutboxRecordsAreEqual(
  a: FedosPersistedDeviceRelaySyncOutboxRecordV1,
  b: FedosPersistedDeviceRelaySyncOutboxRecordV1,
): boolean {
  return (
    a.transferSessionId === b.transferSessionId &&
    a.packageContentHash === b.packageContentHash &&
    a.deliveryId === b.deliveryId &&
    a.builtAt === b.builtAt &&
    a.transferPackageBase64 === b.transferPackageBase64
  );
}
