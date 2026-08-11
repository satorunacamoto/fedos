/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Acknowledgement Outcome Vocabulary.
 *
 * Phase K — restates the normative review's own closed outcome
 * vocabulary (`860a58e`, Doc 12) verbatim — this Arc does not
 * re-derive it, only implements the TYPE and its own strict/local
 * construction (never transmission — Absolute Prohibitions).
 */

export type FedosDeletionRequestAcknowledgementOutcome =
  | "accepted-pending"
  | "applied-local-history"
  | "applied-local-history-and-index"
  | "applied-partial"
  | "rejected-policy"
  | "unauthorized"
  | "unsupported-scope"
  | "expired"
  | "invalid"
  | "failed";

export const FEDOS_DELETION_REQUEST_ACKNOWLEDGEMENT_OUTCOMES: readonly FedosDeletionRequestAcknowledgementOutcome[] = [
  "accepted-pending",
  "applied-local-history",
  "applied-local-history-and-index",
  "applied-partial",
  "rejected-policy",
  "unauthorized",
  "unsupported-scope",
  "expired",
  "invalid",
  "failed",
];

const FEDOS_DELETION_REQUEST_ACKNOWLEDGEMENT_OUTCOME_SET: ReadonlySet<string> = new Set(FEDOS_DELETION_REQUEST_ACKNOWLEDGEMENT_OUTCOMES);

export function isFedosDeletionRequestAcknowledgementOutcome(value: unknown): value is FedosDeletionRequestAcknowledgementOutcome {
  return typeof value === "string" && FEDOS_DELETION_REQUEST_ACKNOWLEDGEMENT_OUTCOME_SET.has(value);
}
