/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Acknowledgement Persistence Port.
 *
 * Mirrors `b3b3a6d`'s own `FedosDeletionExecutionPersistence` shape
 * exactly — keyed by `requestId`, no delete method.
 */

import type { FedosPersistedDeletionAcknowledgementRecordV1 } from "../../../../conversation/deletion_request/fedos_persisted_deletion_acknowledgement_record_v1.js";

export type FedosDeletionAcknowledgementPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosDeletionAcknowledgementPersistence {
  putRecord(record: FedosPersistedDeletionAcknowledgementRecordV1): FedosDeletionAcknowledgementPersistenceWriteResult;
  getRecord(requestId: string): FedosPersistedDeletionAcknowledgementRecordV1 | null;
  listRecords(): readonly FedosPersistedDeletionAcknowledgementRecordV1[];
}
