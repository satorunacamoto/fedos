/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * In-Memory Outbound Request State Persistence.
 */

import type { FedosPersistedDeletionRequestStateRecordV1 } from "../../../../conversation/deletion_request/fedos_persisted_deletion_request_state_record_v1.js";
import {
  evaluateFedosDeletionRequestStateWrite,
  type FedosDeletionRequestStatePersistence,
  type FedosDeletionRequestStatePersistenceWriteResult,
} from "../../../../conversation/deletion_request/fedos_deletion_request_state_persistence.js";

export class InMemoryFedosDeletionRequestStatePersistence implements FedosDeletionRequestStatePersistence {
  readonly #latestByRequestId = new Map<string, FedosPersistedDeletionRequestStateRecordV1>();
  readonly #allSnapshots: FedosPersistedDeletionRequestStateRecordV1[] = [];

  putRecord(record: FedosPersistedDeletionRequestStateRecordV1): FedosDeletionRequestStatePersistenceWriteResult {
    const outcome = evaluateFedosDeletionRequestStateWrite(this.#latestByRequestId.get(record.requestId) ?? null, record);
    if (outcome === "inserted") {
      this.#latestByRequestId.set(record.requestId, record);
      this.#allSnapshots.push(record);
    }
    return outcome;
  }

  getRecord(requestId: string): FedosPersistedDeletionRequestStateRecordV1 | null {
    return this.#latestByRequestId.get(requestId) ?? null;
  }

  listAllSnapshots(): readonly FedosPersistedDeletionRequestStateRecordV1[] {
    return [...this.#allSnapshots];
  }
}
