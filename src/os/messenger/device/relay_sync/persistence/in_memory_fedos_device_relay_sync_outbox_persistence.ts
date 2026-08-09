/**
 * Secure Runtime Alpha 3641–3720 — In-Memory Device Sync Outbox
 * Persistence. Mirrors this codebase's own private-`Map<key, record>`
 * convention exactly, keyed by `transferSessionId` (one record per
 * session — a second `putRecord()` for the SAME session with a DIFFERENT
 * `packageContentHash` is a `"conflict"`, never silently overwritten).
 */

import {
  fedosPersistedDeviceRelaySyncOutboxRecordsAreEqual,
  type FedosDeviceRelaySyncOutboxPersistence,
  type FedosDeviceRelaySyncOutboxWriteResult,
  type FedosPersistedDeviceRelaySyncOutboxRecordV1,
} from "../../../../../device/relay_sync/persistence/fedos_device_relay_sync_outbox_persistence.js";

export class InMemoryFedosDeviceRelaySyncOutboxPersistence implements FedosDeviceRelaySyncOutboxPersistence {
  readonly #records = new Map<string, FedosPersistedDeviceRelaySyncOutboxRecordV1>();

  putRecord(record: FedosPersistedDeviceRelaySyncOutboxRecordV1): FedosDeviceRelaySyncOutboxWriteResult {
    const existing = this.#records.get(record.transferSessionId);
    if (existing === undefined) {
      this.#records.set(record.transferSessionId, record);
      return "inserted";
    }
    return fedosPersistedDeviceRelaySyncOutboxRecordsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getRecord(transferSessionId: string): FedosPersistedDeviceRelaySyncOutboxRecordV1 | null {
    return this.#records.get(transferSessionId) ?? null;
  }
}
