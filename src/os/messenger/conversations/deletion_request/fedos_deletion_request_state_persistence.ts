/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Outbound Request State Persistence Port.
 *
 * Phase I. `putRecord` enforces MONOTONIC lifecycle transitions: the
 * FIRST snapshot ever written for a `requestId` must be `"draft"`
 * (`"invalid-initial-state"` otherwise); a later snapshot for a KNOWN
 * `requestId` must either be structurally IDENTICAL to the current
 * latest one (`"already-present"`, a safe no-op retry) or a REACHABLE
 * transition from it per `isFedosDeletionRequestLifecycleTransitionReachableByThisArc`
 * (`fedos_deletion_request_lifecycle_state.ts`) with the SAME
 * `bodyHash` (`"conflict"` if the body differs, `"invalid-transition"`
 * if the lifecycle move itself is not one this Arc's own code produces).
 */

import { fedosPersistedDeletionRequestStateRecordsAreEqual, type FedosPersistedDeletionRequestStateRecordV1 } from "./fedos_persisted_deletion_request_state_record_v1.js";
import { isFedosDeletionRequestLifecycleTransitionReachableByThisArc } from "./fedos_deletion_request_lifecycle_state.js";

export type FedosDeletionRequestStatePersistenceWriteResult =
  | "inserted"
  | "already-present"
  | "conflict"
  | "invalid-transition"
  | "invalid-initial-state"
  | "failed";

export interface FedosDeletionRequestStatePersistence {
  putRecord(record: FedosPersistedDeletionRequestStateRecordV1): FedosDeletionRequestStatePersistenceWriteResult;
  /** The LATEST snapshot for `requestId`, or `null` if none exists. */
  getRecord(requestId: string): FedosPersistedDeletionRequestStateRecordV1 | null;
  /** Every snapshot ever written, in append order — for restart replay / audit only. */
  listAllSnapshots(): readonly FedosPersistedDeletionRequestStateRecordV1[];
}

/**
 * The ONE shared decision function both `InMemoryFedosDeletionRequestStatePersistence`
 * and `AppendOnlyFedosDeletionRequestStatePersistence` call — never
 * duplicated across the two backends, so the monotonic-transition rule
 * can never silently drift between them.
 */
export function evaluateFedosDeletionRequestStateWrite(
  latest: FedosPersistedDeletionRequestStateRecordV1 | null,
  incoming: FedosPersistedDeletionRequestStateRecordV1,
): FedosDeletionRequestStatePersistenceWriteResult {
  if (latest === null) {
    return incoming.lifecycleState === "draft" ? "inserted" : "invalid-initial-state";
  }
  if (fedosPersistedDeletionRequestStateRecordsAreEqual(latest, incoming)) return "already-present";
  if (latest.bodyHash !== incoming.bodyHash) return "conflict";
  if (!isFedosDeletionRequestLifecycleTransitionReachableByThisArc(latest.lifecycleState, incoming.lifecycleState)) return "invalid-transition";
  return "inserted";
}
