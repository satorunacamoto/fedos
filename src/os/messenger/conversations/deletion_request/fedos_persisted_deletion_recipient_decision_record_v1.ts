/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Durable Recipient Decision State Fact.
 *
 * Phase J — one durable SNAPSHOT of the RECIPIENT's own local evaluation
 * of one received request, keyed by `requestId`. `suppliedLocalOutcome`
 * is set ONLY by the test-only recorded-outcome path (Phase J/O) — this
 * Arc's own code never calls `b3b3a6d`'s execution coordinator itself,
 * so this field is never populated by any automatic process.
 */

export type FedosDeletionRecipientSuppliedLocalOutcome = "completed" | "partially-deleted" | "failed";

export interface FedosPersistedDeletionRecipientDecisionRecordV1 {
  readonly schemaVersion: 1;
  readonly requestId: string;
  readonly decisionState: import("../../../../conversation/deletion_request/fedos_deletion_recipient_decision_state.js").FedosDeletionRecipientDecisionState;
  /** Mirrors `b3b3a6d`'s own `FedosDeletionExecutionTerminalStatus` verbatim — never invents a fourth value. `null` until a caller EXPLICITLY supplies one (never set by this Arc's own automatic evaluation). */
  readonly suppliedLocalOutcome: FedosDeletionRecipientSuppliedLocalOutcome | null;
  readonly recordedAt: number;
}

export function fedosPersistedDeletionRecipientDecisionRecordsAreEqual(
  a: FedosPersistedDeletionRecipientDecisionRecordV1,
  b: FedosPersistedDeletionRecipientDecisionRecordV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.requestId === b.requestId &&
    a.decisionState === b.decisionState &&
    a.suppliedLocalOutcome === b.suppliedLocalOutcome &&
    a.recordedAt === b.recordedAt
  );
}
