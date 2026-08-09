/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * In-Memory Recipient Decision State Persistence.
 */

import type { FedosPersistedDeletionRecipientDecisionRecordV1 } from "../../../../conversation/deletion_request/fedos_persisted_deletion_recipient_decision_record_v1.js";
import {
  evaluateFedosDeletionRecipientDecisionWrite,
  type FedosDeletionRecipientDecisionPersistence,
  type FedosDeletionRecipientDecisionPersistenceWriteResult,
} from "../../../../conversation/deletion_request/fedos_deletion_recipient_decision_persistence.js";

export class InMemoryFedosDeletionRecipientDecisionPersistence implements FedosDeletionRecipientDecisionPersistence {
  readonly #latestByRequestId = new Map<string, FedosPersistedDeletionRecipientDecisionRecordV1>();
  readonly #allSnapshots: FedosPersistedDeletionRecipientDecisionRecordV1[] = [];

  putRecord(record: FedosPersistedDeletionRecipientDecisionRecordV1): FedosDeletionRecipientDecisionPersistenceWriteResult {
    const outcome = evaluateFedosDeletionRecipientDecisionWrite(this.#latestByRequestId.get(record.requestId) ?? null, record);
    if (outcome === "inserted") {
      this.#latestByRequestId.set(record.requestId, record);
      this.#allSnapshots.push(record);
    }
    return outcome;
  }

  getRecord(requestId: string): FedosPersistedDeletionRecipientDecisionRecordV1 | null {
    return this.#latestByRequestId.get(requestId) ?? null;
  }

  listAllSnapshots(): readonly FedosPersistedDeletionRecipientDecisionRecordV1[] {
    return [...this.#allSnapshots];
  }
}
