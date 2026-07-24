/**
 * Secure Runtime Alpha 3641–3720 — Device Sync Inbound Dedup Persistence
 * (Phase F: durable hierarchy).
 *
 * Two independently-checkable, durable layers over ONE record:
 *   1. `relayEventId` (PRIMARY KEY, insert-only) — dedups the exact same
 *      outer Nostr event arriving twice from the SAME Relay (e.g.
 *      reconnect/redelivery).
 *   2. `getBySessionAndHash(transferSessionId, packageContentHash)` — a
 *      SECONDARY lookup dedups the SAME underlying package arriving via a
 *      DIFFERENT Relay (a different `relayEventId`, since each Relay's own
 *      copy of a re-published event may carry a different NIP-01 event
 *      id if re-signed, or simply because two Relays are both handed the
 *      identical event and each is checked independently) — "same package
 *      from multiple Relays imports once."
 *
 * A THIRD layer — Sync record identity — is inherited, unmodified, from
 * `FedosDeviceTransferCoordinator.verifyTransferPackage()`'s own
 * session-state-keyed duplicate/conflict detection (Alpha 3481–3560): this
 * file's own two layers run BEFORE that coordinator is ever called, as a
 * cheap first-line Relay-level dedup; the coordinator's own,
 * already-proven duplicate/conflict logic is the FINAL word on whether a
 * package's CONTENT is genuinely new, unmodified here.
 *
 * Durable (in-memory + append-only backends, mirroring every other port in
 * this codebase) — "does not rely only on in-memory sets."
 */

export interface FedosPersistedDeviceRelaySyncImportRecordV1 {
  readonly schemaVersion: 1;
  readonly relayEventId: string;
  readonly transferSessionId: string;
  readonly packageContentHash: string;
  readonly importedAt: number;
}

export type FedosDeviceRelaySyncImportWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosDeviceRelaySyncInboundDedupPersistence {
  putImport(record: FedosPersistedDeviceRelaySyncImportRecordV1): FedosDeviceRelaySyncImportWriteResult;
  getByRelayEventId(relayEventId: string): FedosPersistedDeviceRelaySyncImportRecordV1 | null;
  getBySessionAndHash(transferSessionId: string, packageContentHash: string): FedosPersistedDeviceRelaySyncImportRecordV1 | null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidUnixSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

/** Structural validation only. Fails closed; never throws. */
export function isWellFormedFedosPersistedDeviceRelaySyncImportRecordV1(candidate: unknown): candidate is FedosPersistedDeviceRelaySyncImportRecordV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  if (Object.keys(value).length !== 5) return false;
  if (value.schemaVersion !== 1) return false;
  if (!isNonEmptyString(value.relayEventId)) return false;
  if (!isNonEmptyString(value.transferSessionId)) return false;
  if (typeof value.packageContentHash !== "string" || !/^[0-9a-f]{64}$/.test(value.packageContentHash)) return false;
  if (!isValidUnixSeconds(value.importedAt)) return false;
  return true;
}

export function fedosPersistedDeviceRelaySyncImportRecordsAreEqual(
  a: FedosPersistedDeviceRelaySyncImportRecordV1,
  b: FedosPersistedDeviceRelaySyncImportRecordV1,
): boolean {
  return (
    a.relayEventId === b.relayEventId &&
    a.transferSessionId === b.transferSessionId &&
    a.packageContentHash === b.packageContentHash &&
    a.importedAt === b.importedAt
  );
}
