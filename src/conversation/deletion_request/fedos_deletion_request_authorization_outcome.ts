/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Authorization Assessment Outcome Vocabulary.
 *
 * Phase H — a closed, eleven-value vocabulary for
 * `fedos_deletion_request_authorization_assessment.ts`'s own DETAILED,
 * LOCAL-ONLY result. `coarsenFedosDeletionRequestAuthorizationOutcome`
 * (same module) collapses the target-existence-oracle-prone subset of
 * these into ONE externally-safe signal before anything is ever
 * acknowledged (review Doc 11's own oracle-avoidance rule) — this
 * DETAILED vocabulary itself is never the externally-visible one.
 */

export type FedosDeletionRequestAuthorizationOutcome =
  | "authorized"
  | "unauthorized"
  | "target-unavailable"
  | "conversation-unavailable"
  | "requester-not-author"
  | "requester-not-member"
  | "recipient-mismatch"
  | "device-mismatch"
  | "expired"
  | "invalid-signature"
  | "unsupported";

export const FEDOS_DELETION_REQUEST_AUTHORIZATION_OUTCOMES: readonly FedosDeletionRequestAuthorizationOutcome[] = [
  "authorized",
  "unauthorized",
  "target-unavailable",
  "conversation-unavailable",
  "requester-not-author",
  "requester-not-member",
  "recipient-mismatch",
  "device-mismatch",
  "expired",
  "invalid-signature",
  "unsupported",
];

const FEDOS_DELETION_REQUEST_AUTHORIZATION_OUTCOME_SET: ReadonlySet<string> = new Set(FEDOS_DELETION_REQUEST_AUTHORIZATION_OUTCOMES);

export function isFedosDeletionRequestAuthorizationOutcome(value: unknown): value is FedosDeletionRequestAuthorizationOutcome {
  return typeof value === "string" && FEDOS_DELETION_REQUEST_AUTHORIZATION_OUTCOME_SET.has(value);
}

/**
 * `"target-unavailable"`, `"conversation-unavailable"`, and
 * `"requester-not-author"` are indistinguishable, to anyone but the
 * request's own TRUE, correctly-signed original sender, from a request
 * against a target that never existed at all — collapsing all three into
 * one coarse `"unauthorized"` signal (review Doc 11) is what prevents an
 * outside party from probing for a message's existence via
 * requester-impersonation attempts. Every OTHER detailed outcome is
 * already safe to expose as-is (an EXPIRED/malformed/unsupported request
 * carries no existence information about the target).
 */
export type FedosDeletionRequestCoarseAuthorizationOutcome =
  | "authorized"
  | "unauthorized"
  | "recipient-mismatch"
  | "device-mismatch"
  | "expired"
  | "invalid-signature"
  | "unsupported";

const ORACLE_PRONE_OUTCOMES: ReadonlySet<FedosDeletionRequestAuthorizationOutcome> = new Set([
  "target-unavailable",
  "conversation-unavailable",
  "requester-not-author",
  "requester-not-member",
]);

export function coarsenFedosDeletionRequestAuthorizationOutcome(
  detailed: FedosDeletionRequestAuthorizationOutcome,
): FedosDeletionRequestCoarseAuthorizationOutcome {
  if (ORACLE_PRONE_OUTCOMES.has(detailed)) return "unauthorized";
  return detailed as FedosDeletionRequestCoarseAuthorizationOutcome;
}
