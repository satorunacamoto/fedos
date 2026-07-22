/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Outbound Request Lifecycle Vocabulary.
 *
 * Phase B — a closed, ten-value vocabulary for the REQUESTER's own local
 * view of one outbound request. This Arc has no live transport
 * (Absolute Prohibitions) — `"pending-delivery"`/`"delivered"`/
 * `"recipient-evaluating"` are named here because a FUTURE transport
 * Arc's own durable state must extend, not replace, this vocabulary
 * (mirrors `b3b3a6d`'s own "extends `FedosPayloadDeletionMeaning`, never
 * replaces it" discipline) — but `isFedosDeletionRequestLifecycleTransitionReachableByThisArc`
 * below states PLAINLY which transitions this Arc's own code can
 * actually produce, so a caller can never mistake a named-for-the-future
 * value for one this build can reach on its own.
 */

export type FedosDeletionRequestLifecycleState =
  | "draft"
  | "signed"
  | "pending-delivery"
  | "delivered"
  | "recipient-evaluating"
  | "acknowledged"
  | "expired"
  | "rejected"
  | "failed"
  | "cancelled";

export const FEDOS_DELETION_REQUEST_LIFECYCLE_STATES: readonly FedosDeletionRequestLifecycleState[] = [
  "draft",
  "signed",
  "pending-delivery",
  "delivered",
  "recipient-evaluating",
  "acknowledged",
  "expired",
  "rejected",
  "failed",
  "cancelled",
];

const FEDOS_DELETION_REQUEST_LIFECYCLE_STATE_SET: ReadonlySet<string> = new Set(FEDOS_DELETION_REQUEST_LIFECYCLE_STATES);

export function isFedosDeletionRequestLifecycleState(value: unknown): value is FedosDeletionRequestLifecycleState {
  return typeof value === "string" && FEDOS_DELETION_REQUEST_LIFECYCLE_STATE_SET.has(value);
}

/**
 * The closed set of `(from, to)` transitions this Arc's own local
 * planner/durable-state layer (`fedos_deletion_request_state_persistence.ts`,
 * `fedos_deletion_request_retry_plan.ts`) can ACTUALLY produce, with no
 * live transport. `"pending-delivery"`/`"delivered"`/
 * `"recipient-evaluating"` never appear as a `to` value here — reaching
 * them requires a real transport send/receive this Arc does not build.
 * `"acknowledged"` IS reachable, but ONLY via the test-only
 * `recordSuppliedLocalDeletionOutcome`-shaped path (Phase J/O) that
 * records an ALREADY-PRODUCED local outcome — never a live
 * acknowledgement received over a wire.
 */
const REACHABLE_TRANSITIONS: ReadonlySet<string> = new Set([
  "draft->signed",
  "draft->cancelled",
  "signed->cancelled",
  "signed->expired",
  "signed->acknowledged",
  "signed->failed",
]);

export function isFedosDeletionRequestLifecycleTransitionReachableByThisArc(
  from: FedosDeletionRequestLifecycleState,
  to: FedosDeletionRequestLifecycleState,
): boolean {
  return REACHABLE_TRANSITIONS.has(`${from}->${to}`);
}
