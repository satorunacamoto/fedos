/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Request Target Type Vocabulary.
 *
 * Phase B — a closed, ONE-value vocabulary: this Arc supports only a
 * Direct-conversation message target (review Doc 03/14 — Group is
 * deferred entirely; Doc 16 — attachments are excluded entirely). A
 * single-value union still exists as its own named type, rather than
 * being silently assumed, so a future Arc adding a second value does so
 * by widening this one closed declaration, never by adding an implicit
 * default.
 */

export type FedosDeletionRequestTargetType = "direct-message";

export const FEDOS_DELETION_REQUEST_TARGET_TYPES: readonly FedosDeletionRequestTargetType[] = ["direct-message"];

const FEDOS_DELETION_REQUEST_TARGET_TYPE_SET: ReadonlySet<string> = new Set(FEDOS_DELETION_REQUEST_TARGET_TYPES);

export function isFedosDeletionRequestTargetType(value: unknown): value is FedosDeletionRequestTargetType {
  return typeof value === "string" && FEDOS_DELETION_REQUEST_TARGET_TYPE_SET.has(value);
}
