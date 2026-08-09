/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Acknowledgement Record.
 *
 * Phase K — the closed, versioned, UNSIGNED acknowledgement body,
 * restating the normative review's own schema (`860a58e`, Doc 12)
 * field-for-field. Never transmitted by this Arc (Absolute
 * Prohibitions) — this file implements the TYPE, its strict validator,
 * and canonical/signing boundary only.
 *
 * HARD GUARDRAILS:
 *   - No local absolute path, no backup name — `appliedScopes`/
 *     `retainedScopes` are closed `FedosDeletionRequestScope`-shaped
 *     values (plus a `"local-index"` addition — see below), never a
 *     free string.
 *   - No physical-erasure claim — `evidenceClass` is `b3b3a6d`'s own
 *     4-value `FedosDeletionEvidence`, which has no "physical" level to
 *     begin with.
 *   - No account-wide deletion claim — `recipientDeviceRef` is always
 *     present (one Device only, never omitted to imply broader scope).
 */

import { isFedosDeletionRequestId } from "../../../../conversation/deletion_request/fedos_deletion_request_id.js";
import {
  isFedosDeletionRequestAcknowledgementOutcome,
  type FedosDeletionRequestAcknowledgementOutcome,
} from "../../../../conversation/deletion_request/fedos_deletion_request_acknowledgement_outcome.js";
import { isFedosDeletionEvidence, type FedosDeletionEvidence } from "../../../../conversation/deletion/fedos_deletion_evidence.js";

export const FEDOS_DELETION_ACKNOWLEDGEMENT_SCHEMA_VERSION = 1 as const;
export const FEDOS_DELETION_ACKNOWLEDGEMENT_PROTOCOL_VERSION = 1 as const;

/** `"local-index"` names the Search-purge half of `"local-history-and-index"` independently, so `appliedScopes` can honestly report a partial outcome (history applied, index purge failed, or vice versa). */
export type FedosDeletionAcknowledgementAppliedScope = "local-history" | "local-index";

const APPLIED_SCOPE_SET: ReadonlySet<string> = new Set(["local-history", "local-index"]);

function isFedosDeletionAcknowledgementAppliedScope(value: unknown): value is FedosDeletionAcknowledgementAppliedScope {
  return typeof value === "string" && APPLIED_SCOPE_SET.has(value);
}

const MAX_IDENTIFIER_LENGTH = 256;
const MAX_APPLIED_SCOPES = 2;

function isBoundedNonEmptyIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_IDENTIFIER_LENGTH && !value.includes("/") && !value.includes("\\") && !value.includes("..");
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export interface FedosDeletionAcknowledgementRecordV1 {
  readonly schemaVersion: 1;
  readonly requestId: string;
  readonly recipientAccountRef: string;
  /** Opaque, advisory only — never cryptographically bound (Doc 08 — no real Device key exists). */
  readonly recipientDeviceRef: string | null;
  readonly outcome: FedosDeletionRequestAcknowledgementOutcome;
  readonly appliedScopes: readonly FedosDeletionAcknowledgementAppliedScope[];
  readonly retainedScopes: readonly FedosDeletionAcknowledgementAppliedScope[];
  readonly evidenceClass: FedosDeletionEvidence;
  readonly acknowledgedAt: number;
  readonly protocolVersion: 1;
}

const ACK_FIELD_NAMES: readonly string[] = [
  "schemaVersion",
  "requestId",
  "recipientAccountRef",
  "recipientDeviceRef",
  "outcome",
  "appliedScopes",
  "retainedScopes",
  "evidenceClass",
  "acknowledgedAt",
  "protocolVersion",
];

export function isWellFormedFedosDeletionAcknowledgementRecordV1(candidate: unknown): candidate is FedosDeletionAcknowledgementRecordV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.length !== ACK_FIELD_NAMES.length) return false;
  for (const name of ACK_FIELD_NAMES) {
    if (!(name in value)) return false;
  }

  if (value.schemaVersion !== FEDOS_DELETION_ACKNOWLEDGEMENT_SCHEMA_VERSION) return false;
  if (!isFedosDeletionRequestId(value.requestId)) return false;
  if (!isBoundedNonEmptyIdentifier(value.recipientAccountRef)) return false;
  if (value.recipientDeviceRef !== null && !isBoundedNonEmptyIdentifier(value.recipientDeviceRef)) return false;
  if (!isFedosDeletionRequestAcknowledgementOutcome(value.outcome)) return false;
  if (!Array.isArray(value.appliedScopes) || value.appliedScopes.length > MAX_APPLIED_SCOPES) return false;
  if (!value.appliedScopes.every(isFedosDeletionAcknowledgementAppliedScope)) return false;
  if (!Array.isArray(value.retainedScopes) || value.retainedScopes.length > MAX_APPLIED_SCOPES) return false;
  if (!value.retainedScopes.every(isFedosDeletionAcknowledgementAppliedScope)) return false;
  if (!isFedosDeletionEvidence(value.evidenceClass)) return false;
  if (!isNonNegativeInteger(value.acknowledgedAt)) return false;
  if (value.protocolVersion !== FEDOS_DELETION_ACKNOWLEDGEMENT_PROTOCOL_VERSION) return false;

  return true;
}

/**
 * Closes the "acknowledgement overclaim" class of dishonesty: an
 * `outcome` that did not actually apply anything (`rejected-policy`,
 * `unauthorized`, `unsupported-scope`, `expired`, `invalid`, `failed`,
 * `accepted-pending`) must carry an EMPTY `appliedScopes` — never claim
 * partial or full application it did not perform. An `"applied-*"`
 * outcome must carry a NON-EMPTY `appliedScopes`. Precondition:
 * `record` already passed `isWellFormedFedosDeletionAcknowledgementRecordV1`.
 */
export function isFedosDeletionAcknowledgementRecordHonest(record: FedosDeletionAcknowledgementRecordV1): boolean {
  const claimsApplication = record.outcome.startsWith("applied-");
  if (claimsApplication) return record.appliedScopes.length > 0;
  return record.appliedScopes.length === 0;
}
