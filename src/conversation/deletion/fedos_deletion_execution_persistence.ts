/**
 * Secure Runtime Alpha 5401-5480 ("FedOS Local Deletion Capability and
 * Deletion-State Foundation Arc") — Deletion Execution Persistence Port.
 *
 * Mirrors `FedosPayloadRetentionPersistence`'s own shape exactly (Alpha
 * 795/796) — a dedicated port, keyed by `planId`, no delete method (a
 * recorded execution outcome is itself a permanent, append-only fact).
 */

import type { FedosPersistedDeletionExecutionRecordV1 } from "./fedos_persisted_deletion_execution_record_v1.js";

export type FedosDeletionExecutionPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosDeletionExecutionPersistence {
  putRecord(record: FedosPersistedDeletionExecutionRecordV1): FedosDeletionExecutionPersistenceWriteResult;
  getRecord(planId: string): FedosPersistedDeletionExecutionRecordV1 | null;
  listRecords(): readonly FedosPersistedDeletionExecutionRecordV1[];
}
