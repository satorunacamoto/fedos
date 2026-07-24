/**
 * Secure Runtime Alpha 3641–3720 — In-Memory Device Sync Inbound Dedup
 * Persistence. Primary key `relayEventId`; a secondary in-memory index
 * supports the session+hash lookup without a second durable store.
 */

import {
  fedosPersistedDeviceRelaySyncImportRecordsAreEqual,
  type FedosDeviceRelaySyncImportWriteResult,
  type FedosDeviceRelaySyncInboundDedupPersistence,
  type FedosPersistedDeviceRelaySyncImportRecordV1,
} from "./fedos_device_relay_sync_inbound_dedup_persistence.js";

function sessionHashKey(transferSessionId: string, packageContentHash: string): string {
  return `${transferSessionId}::${packageContentHash}`;
}

export class InMemoryFedosDeviceRelaySyncInboundDedupPersistence implements FedosDeviceRelaySyncInboundDedupPersistence {
  readonly #byRelayEventId = new Map<string, FedosPersistedDeviceRelaySyncImportRecordV1>();

  putImport(record: FedosPersistedDeviceRelaySyncImportRecordV1): FedosDeviceRelaySyncImportWriteResult {
    const existing = this.#byRelayEventId.get(record.relayEventId);
    if (existing === undefined) {
      this.#byRelayEventId.set(record.relayEventId, record);
      return "inserted";
    }
    return fedosPersistedDeviceRelaySyncImportRecordsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getByRelayEventId(relayEventId: string): FedosPersistedDeviceRelaySyncImportRecordV1 | null {
    return this.#byRelayEventId.get(relayEventId) ?? null;
  }

  getBySessionAndHash(transferSessionId: string, packageContentHash: string): FedosPersistedDeviceRelaySyncImportRecordV1 | null {
    const key = sessionHashKey(transferSessionId, packageContentHash);
    for (const record of this.#byRelayEventId.values()) {
      if (sessionHashKey(record.transferSessionId, record.packageContentHash) === key) return record;
    }
    return null;
  }
}
