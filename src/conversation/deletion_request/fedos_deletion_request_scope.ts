/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Requested Scope Vocabulary.
 *
 * Phase B — a closed, two-value vocabulary naming only the scopes the
 * normative review (`860a58e`, Doc 07's own `requestedOperation` fixed to
 * `"logical-delete"`) selected, narrowed further to match `b3b3a6d`'s own
 * real, two-step `local-payload-deletion` plan exactly
 * (`retention-transition` then `purge-index`,
 * `fedos_deletion_plan.ts`'s own `buildFedosLocalPayloadDeletionPlan`).
 * No whole-conversation, wildcard, arbitrary-list, Archive, backup,
 * Relay, filesystem-path, Group, or attachment scope is named here, not
 * even as an inert value — this Arc's own Absolute Prohibitions forbid
 * every one of them.
 */

export type FedosDeletionRequestScope = "local-history" | "local-history-and-index";

export const FEDOS_DELETION_REQUEST_SCOPES: readonly FedosDeletionRequestScope[] = ["local-history", "local-history-and-index"];

const FEDOS_DELETION_REQUEST_SCOPE_SET: ReadonlySet<string> = new Set(FEDOS_DELETION_REQUEST_SCOPES);

export function isFedosDeletionRequestScope(value: unknown): value is FedosDeletionRequestScope {
  return typeof value === "string" && FEDOS_DELETION_REQUEST_SCOPE_SET.has(value);
}
