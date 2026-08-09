/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * In-Memory Acknowledgement Persistence.
 */

import {
  fedosPersistedDeletionAcknowledgementRecordsAreEqual,
  type FedosPersistedDeletionAcknowledgementRecordV1,
} from "../../../../conversation/deletion_request/fedos_persisted_deletion_acknowledgement_record_v1.js";
import type { FedosDeletionAcknowledgementPersistence, FedosDeletionAcknowledgementPersistenceWriteResult } from "../../../../conversation/deletion_request/fedos_deletion_acknowledgement_persistence.js";

export class InMemoryFedosDeletionAcknowledgementPersistence implements FedosDeletionAcknowledgementPersistence {
  readonly #records = new Map<string, FedosPersistedDeletionAcknowledgementRecordV1>();

  putRecord(record: FedosPersistedDeletionAcknowledgementRecordV1): FedosDeletionAcknowledgementPersistenceWriteResult {
    const existing = this.#records.get(record.requestId);
    if (existing === undefined) {
      this.#records.set(record.requestId, record);
      return "inserted";
    }
    return fedosPersistedDeletionAcknowledgementRecordsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getRecord(requestId: string): FedosPersistedDeletionAcknowledgementRecordV1 | null {
    return this.#records.get(requestId) ?? null;
  }

  listRecords(): readonly FedosPersistedDeletionAcknowledgementRecordV1[] {
    return [...this.#records.values()];
  }
}
