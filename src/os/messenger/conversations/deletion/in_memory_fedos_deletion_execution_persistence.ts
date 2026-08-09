/**
 * Secure Runtime Alpha 5401-5480 ("FedOS Local Deletion Capability and
 * Deletion-State Foundation Arc") — In-Memory Deletion Execution
 * Persistence.
 *
 * Mirrors `InMemoryFedosPayloadRetentionPersistence`'s own private-`Map`-
 * backed convention exactly.
 */

import {
  fedosPersistedDeletionExecutionRecordsAreEqual,
  type FedosPersistedDeletionExecutionRecordV1,
} from "./fedos_persisted_deletion_execution_record_v1.js";
import type { FedosDeletionExecutionPersistence, FedosDeletionExecutionPersistenceWriteResult } from "./fedos_deletion_execution_persistence.js";

export class InMemoryFedosDeletionExecutionPersistence implements FedosDeletionExecutionPersistence {
  readonly #records = new Map<string, FedosPersistedDeletionExecutionRecordV1>();

  putRecord(record: FedosPersistedDeletionExecutionRecordV1): FedosDeletionExecutionPersistenceWriteResult {
    const existing = this.#records.get(record.id);
    if (existing === undefined) {
      this.#records.set(record.id, record);
      return "inserted";
    }
    return fedosPersistedDeletionExecutionRecordsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getRecord(planId: string): FedosPersistedDeletionExecutionRecordV1 | null {
    return this.#records.get(planId) ?? null;
  }

  listRecords(): readonly FedosPersistedDeletionExecutionRecordV1[] {
    return [...this.#records.values()];
  }
}
