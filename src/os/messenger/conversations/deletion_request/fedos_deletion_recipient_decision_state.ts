/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Recipient Decision State Vocabulary.
 *
 * Phase J — a closed, eleven-value vocabulary for the RECIPIENT's own
 * local evaluation of one received request. Normalized against
 * `b3b3a6d`'s own real `FedosDeletionExecutionTerminalStatus`
 * (`"completed" | "partially-deleted" | "failed"`) — `"locally-applied"`/
 * `"partially-applied"`/`"failed"` map onto those three exactly, never
 * inventing a fourth local outcome `b3b3a6d` itself cannot produce.
 *
 * This Arc's own code can reach every value HERE except
 * `"locally-applied"`/`"partially-applied"` through its own real
 * evaluation pipeline (`fedos_deletion_request_authorization_assessment.ts`)
 * run directly in-process — this Arc never receives a request over a
 * wire, but "received" still names a real state a caller
 * (a future transport Arc, or this Arc's own vertical-slice test) can
 * durably record before evaluation runs.
 * `"locally-applied"`/`"partially-applied"` are reachable ONLY via the
 * test-only recorded-outcome path (Phase J) — this Arc's own code never
 * calls `b3b3a6d`'s execution coordinator itself.
 */

export type FedosDeletionRecipientDecisionState =
  | "received"
  | "validated"
  | "unauthorized"
  | "expired"
  | "unsupported"
  | "policy-pending"
  | "policy-rejected"
  | "local-plan-ready"
  | "locally-applied"
  | "partially-applied"
  | "failed";

export const FEDOS_DELETION_RECIPIENT_DECISION_STATES: readonly FedosDeletionRecipientDecisionState[] = [
  "received",
  "validated",
  "unauthorized",
  "expired",
  "unsupported",
  "policy-pending",
  "policy-rejected",
  "local-plan-ready",
  "locally-applied",
  "partially-applied",
  "failed",
];

const FEDOS_DELETION_RECIPIENT_DECISION_STATE_SET: ReadonlySet<string> = new Set(FEDOS_DELETION_RECIPIENT_DECISION_STATES);

export function isFedosDeletionRecipientDecisionState(value: unknown): value is FedosDeletionRecipientDecisionState {
  return typeof value === "string" && FEDOS_DELETION_RECIPIENT_DECISION_STATE_SET.has(value);
}

/**
 * The closed set of `(from, to)` transitions this Arc's own recipient
 * evaluation pipeline (`fedos_deletion_request_authorization_assessment.ts`)
 * and durable state layer (`fedos_deletion_recipient_decision_persistence.ts`)
 * can produce. `"received"` is the only valid INITIAL state.
 * `"locally-applied"`/`"partially-applied"` are reachable ONLY through
 * the test-only recorded-outcome path (Phase J) — never automatically.
 */
const REACHABLE_RECIPIENT_DECISION_TRANSITIONS: ReadonlySet<string> = new Set([
  "received->validated",
  "received->unauthorized",
  "received->expired",
  "received->unsupported",
  "validated->unauthorized",
  "validated->expired",
  "validated->unsupported",
  "validated->policy-pending",
  "policy-pending->policy-rejected",
  "policy-pending->local-plan-ready",
  "policy-pending->expired",
  "local-plan-ready->locally-applied",
  "local-plan-ready->partially-applied",
  "local-plan-ready->failed",
]);

export function isFedosDeletionRecipientDecisionTransitionReachableByThisArc(
  from: FedosDeletionRecipientDecisionState,
  to: FedosDeletionRecipientDecisionState,
): boolean {
  return REACHABLE_RECIPIENT_DECISION_TRANSITIONS.has(`${from}->${to}`);
}
