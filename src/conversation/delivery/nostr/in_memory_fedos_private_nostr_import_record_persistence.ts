/** Secure Runtime Alpha 1426 — in-memory `FedosPrivateNostrImportRecordPersistence` backend. Single-record-per-`nostrEventId`. */

import {
  fedosPrivateNostrImportRecordsAreEqual,
  type FedosPrivateNostrImportRecord,
  type FedosPrivateNostrImportRecordPersistence,
  type FedosPrivateNostrImportRecordPersistenceWriteResult,
} from "./fedos_private_nostr_import_record.js";

export class InMemoryFedosPrivateNostrImportRecordPersistence implements FedosPrivateNostrImportRecordPersistence {
  readonly #records = new Map<string, FedosPrivateNostrImportRecord>();

  putImportFact(record: FedosPrivateNostrImportRecord): FedosPrivateNostrImportRecordPersistenceWriteResult {
    const existing = this.#records.get(record.nostrEventId);
    if (existing === undefined) {
      this.#records.set(record.nostrEventId, record);
      return "inserted";
    }
    return fedosPrivateNostrImportRecordsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getImport(nostrEventId: string): FedosPrivateNostrImportRecord | null {
    return this.#records.get(nostrEventId) ?? null;
  }
}
