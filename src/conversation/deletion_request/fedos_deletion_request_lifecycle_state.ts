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
 * `fedos_deletion_request_retry_plan.ts`) can ACTUALLY produce.
 *
 * Secure Runtime Alpha 5881-5960 (FedOS Signed Recipient Deletion Request
 * Private Transport and Local Policy Integration Arc) — the "future
 * transport Arc" this file's own original header named: `"pending-delivery"`,
 * `"delivered"`, and `"recipient-evaluating"` are now real, live-transport-
 * reachable `to` values (`fedos_deletion_request_outbound_coordinator.ts`
 * / `fedos_deletion_acknowledgement_inbound_coordinator.ts`), additively
 * extending — never replacing or renumbering — every transition this
 * file already named reachable. `"acknowledged"` remains reachable both
 * ways: the pre-existing `"signed->acknowledged"` test-only shortcut
 * (Phase J/O of `5641-5720`, unmodified) AND the new live
 * `"recipient-evaluating->acknowledged"` path a real received
 * acknowledgement now produces.
 */
const REACHABLE_TRANSITIONS: ReadonlySet<string> = new Set([
  "draft->signed",
  "draft->cancelled",
  "signed->cancelled",
  "signed->expired",
  "signed->acknowledged",
  "signed->failed",
  "signed->pending-delivery",
  "pending-delivery->delivered",
  "pending-delivery->expired",
  "pending-delivery->failed",
  "pending-delivery->cancelled",
  "delivered->recipient-evaluating",
  "delivered->expired",
  "delivered->failed",
  "recipient-evaluating->acknowledged",
  "recipient-evaluating->expired",
  "recipient-evaluating->failed",
]);

export function isFedosDeletionRequestLifecycleTransitionReachableByThisArc(
  from: FedosDeletionRequestLifecycleState,
  to: FedosDeletionRequestLifecycleState,
): boolean {
  return REACHABLE_TRANSITIONS.has(`${from}->${to}`);
}
