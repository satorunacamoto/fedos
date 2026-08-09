/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Coarse Reason Code Vocabulary.
 *
 * Phase C — restates the normative review's own closed, OPTIONAL,
 * non-identifying reason vocabulary (`860a58e`, Doc 07) verbatim. Never
 * free text — a requester who does not want to disclose a reason simply
 * omits the field (`null`).
 */

export type FedosDeletionRequestReasonCode = "sent-in-error" | "content-correction" | "privacy" | "other";

export const FEDOS_DELETION_REQUEST_REASON_CODES: readonly FedosDeletionRequestReasonCode[] = [
  "sent-in-error",
  "content-correction",
  "privacy",
  "other",
];

const FEDOS_DELETION_REQUEST_REASON_CODE_SET: ReadonlySet<string> = new Set(FEDOS_DELETION_REQUEST_REASON_CODES);

export function isFedosDeletionRequestReasonCode(value: unknown): value is FedosDeletionRequestReasonCode {
  return typeof value === "string" && FEDOS_DELETION_REQUEST_REASON_CODE_SET.has(value);
}
