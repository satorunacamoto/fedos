/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Recipient Decision State Persistence Port.
 *
 * Phase J. Mirrors `fedos_deletion_request_state_persistence.ts`'s own
 * monotonic-transition discipline exactly, over
 * `FedosDeletionRecipientDecisionState` instead of
 * `FedosDeletionRequestLifecycleState`. `"received"` is the only valid
 * initial state.
 */

import {
  fedosPersistedDeletionRecipientDecisionRecordsAreEqual,
  type FedosPersistedDeletionRecipientDecisionRecordV1,
} from "../../../../conversation/deletion_request/fedos_persisted_deletion_recipient_decision_record_v1.js";
import { isFedosDeletionRecipientDecisionTransitionReachableByThisArc } from "../../../../conversation/deletion_request/fedos_deletion_recipient_decision_state.js";

export type FedosDeletionRecipientDecisionPersistenceWriteResult =
  | "inserted"
  | "already-present"
  | "conflict"
  | "invalid-transition"
  | "invalid-initial-state"
  | "failed";

export interface FedosDeletionRecipientDecisionPersistence {
  putRecord(record: FedosPersistedDeletionRecipientDecisionRecordV1): FedosDeletionRecipientDecisionPersistenceWriteResult;
  getRecord(requestId: string): FedosPersistedDeletionRecipientDecisionRecordV1 | null;
  listAllSnapshots(): readonly FedosPersistedDeletionRecipientDecisionRecordV1[];
}

export function evaluateFedosDeletionRecipientDecisionWrite(
  latest: FedosPersistedDeletionRecipientDecisionRecordV1 | null,
  incoming: FedosPersistedDeletionRecipientDecisionRecordV1,
): FedosDeletionRecipientDecisionPersistenceWriteResult {
  if (latest === null) {
    return incoming.decisionState === "received" ? "inserted" : "invalid-initial-state";
  }
  if (fedosPersistedDeletionRecipientDecisionRecordsAreEqual(latest, incoming)) return "already-present";
  if (latest.requestId !== incoming.requestId) return "conflict";
  if (!isFedosDeletionRecipientDecisionTransitionReachableByThisArc(latest.decisionState, incoming.decisionState)) return "invalid-transition";
  return "inserted";
}
