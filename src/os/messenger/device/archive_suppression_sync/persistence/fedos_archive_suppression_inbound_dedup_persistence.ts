/**
 * Secure Runtime Alpha 7721–7800 — Suppression Sync Inbound Dedup
 * Persistence. Mirrors
 * `../../relay_sync/persistence/fedos_device_relay_sync_inbound_dedup_persistence.ts`'s
 * own single-layer discipline, narrowed: suppression facts are small and
 * carry their own `factId`/`deliveryId`, so ONE primary key
 * (`relayEventId`, the outer Relay event's own NIP-01 id) is sufficient
 * — a second "same fact via a different Relay" layer is unnecessary
 * because `FedosArchiveSuppressionObservationAuthority.recordImportedSuppression()`
 * (Phase E) already de-duplicates by the fact's own deterministic
 * `factId` at the persistence layer, one level up. This file's own job
 * is strictly "the exact same outer Relay event never reaches the
 * Authority twice."
 */

export interface FedosPersistedArchiveSuppressionInboundImportRecordV1 {
  readonly schemaVersion: 1;
  readonly relayEventId: string;
  readonly factId: string;
  readonly importedAt: number;
}

export type FedosArchiveSuppressionInboundImportWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosArchiveSuppressionInboundDedupPersistence {
  putImport(record: FedosPersistedArchiveSuppressionInboundImportRecordV1): FedosArchiveSuppressionInboundImportWriteResult;
  getByRelayEventId(relayEventId: string): FedosPersistedArchiveSuppressionInboundImportRecordV1 | null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidUnixSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

export function isWellFormedFedosPersistedArchiveSuppressionInboundImportRecordV1(
  candidate: unknown,
): candidate is FedosPersistedArchiveSuppressionInboundImportRecordV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  if (Object.keys(value).length !== 4) return false;
  if (value.schemaVersion !== 1) return false;
  if (!isNonEmptyString(value.relayEventId)) return false;
  if (!isNonEmptyString(value.factId)) return false;
  if (!isValidUnixSeconds(value.importedAt)) return false;
  return true;
}

export function fedosPersistedArchiveSuppressionInboundImportRecordsAreEqual(
  a: FedosPersistedArchiveSuppressionInboundImportRecordV1,
  b: FedosPersistedArchiveSuppressionInboundImportRecordV1,
): boolean {
  return a.relayEventId === b.relayEventId && a.factId === b.factId && a.importedAt === b.importedAt;
}

export class InMemoryFedosArchiveSuppressionInboundDedupPersistence implements FedosArchiveSuppressionInboundDedupPersistence {
  readonly #byRelayEventId = new Map<string, FedosPersistedArchiveSuppressionInboundImportRecordV1>();

  putImport(record: FedosPersistedArchiveSuppressionInboundImportRecordV1): FedosArchiveSuppressionInboundImportWriteResult {
    const existing = this.#byRelayEventId.get(record.relayEventId);
    if (existing === undefined) {
      this.#byRelayEventId.set(record.relayEventId, record);
      return "inserted";
    }
    return fedosPersistedArchiveSuppressionInboundImportRecordsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getByRelayEventId(relayEventId: string): FedosPersistedArchiveSuppressionInboundImportRecordV1 | null {
    return this.#byRelayEventId.get(relayEventId) ?? null;
  }
}
