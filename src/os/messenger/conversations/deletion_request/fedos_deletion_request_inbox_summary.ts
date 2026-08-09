/**
 * Secure Runtime Alpha 6041-6120 (FedOS Signed Deletion Request Multi-Device
 * Aggregation and User Consent UI Arc) — a narrow, ADDITIVE durable summary
 * of a RECEIVED deletion request's own safe display fields, recorded once at
 * import time by the Inbound Coordinator. `5641-5720`'s own
 * `FedosPersistedDeletionRecipientDecisionRecordV1` carries the decision
 * STATE only (`requestId`/`decisionState`/`suppliedLocalOutcome`) — it never
 * stored the request's own conversation/scope/timing/requester facts, which
 * this Arc's own restart-safe consent Inbox (Phase D) needs to render an
 * already-received item without re-decoding its own original wire payload
 * (which is never itself kept durably). This file is a NEW, SEPARATE,
 * insert-only port — it never modifies `5641-5720`'s own frozen persisted
 * record shape.
 *
 * Every field here is already safe by construction: no signature, no raw
 * path, no message plaintext (the target's own body is never read by this
 * domain at all).
 */
import { isFedosDeletionRequestScope, type FedosDeletionRequestScope } from "../../../../conversation/deletion_request/fedos_deletion_request_scope.js";
import { isFedosDeletionRequestReasonCode, type FedosDeletionRequestReasonCode } from "../../../../conversation/deletion_request/fedos_deletion_request_reason_code.js";
import { isFedosDeletionRequestId } from "../../../../conversation/deletion_request/fedos_deletion_request_id.js";

export interface FedosDeletionRequestInboxSummaryV1 {
  readonly schemaVersion: 1;
  readonly requestId: string;
  readonly conversationId: string;
  readonly targetEnvelopeId: string;
  readonly requesterAccountRef: string;
  readonly requesterDeviceRef: string | null;
  readonly recipientDeviceRef: string | null;
  readonly scope: FedosDeletionRequestScope;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly reasonCode: FedosDeletionRequestReasonCode | null;
  readonly recordedAt: number;
}

const FIELD_NAMES: readonly string[] = [
  "schemaVersion",
  "requestId",
  "conversationId",
  "targetEnvelopeId",
  "requesterAccountRef",
  "requesterDeviceRef",
  "recipientDeviceRef",
  "scope",
  "issuedAt",
  "expiresAt",
  "reasonCode",
  "recordedAt",
];

function isBoundedString(value: unknown, max = 512): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}
function isBoundedStringOrNull(value: unknown, max = 512): value is string | null {
  return value === null || isBoundedString(value, max);
}
function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function isWellFormedFedosDeletionRequestInboxSummaryV1(candidate: unknown): candidate is FedosDeletionRequestInboxSummaryV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const v = candidate as Record<string, unknown>;
  const keys = Object.keys(v);
  if (keys.length !== FIELD_NAMES.length || !FIELD_NAMES.every((n) => n in v)) return false;
  if (v.schemaVersion !== 1) return false;
  if (!isFedosDeletionRequestId(v.requestId)) return false;
  if (!isBoundedString(v.conversationId)) return false;
  if (!isBoundedString(v.targetEnvelopeId)) return false;
  if (!isBoundedString(v.requesterAccountRef)) return false;
  if (!isBoundedStringOrNull(v.requesterDeviceRef)) return false;
  if (!isBoundedStringOrNull(v.recipientDeviceRef)) return false;
  if (!isFedosDeletionRequestScope(v.scope)) return false;
  if (!isNonNegativeInteger(v.issuedAt) || !isNonNegativeInteger(v.expiresAt) || !isNonNegativeInteger(v.recordedAt)) return false;
  if (v.reasonCode !== null && !isFedosDeletionRequestReasonCode(v.reasonCode)) return false;
  return true;
}

export type FedosDeletionRequestInboxSummaryWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosDeletionRequestInboxSummaryPersistence {
  putSummary(summary: FedosDeletionRequestInboxSummaryV1): FedosDeletionRequestInboxSummaryWriteResult;
  getSummary(requestId: string): FedosDeletionRequestInboxSummaryV1 | null;
  listSummaries(): readonly FedosDeletionRequestInboxSummaryV1[];
}

function summariesEqual(a: FedosDeletionRequestInboxSummaryV1, b: FedosDeletionRequestInboxSummaryV1): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function evaluateFedosDeletionRequestInboxSummaryWrite(
  existing: FedosDeletionRequestInboxSummaryV1 | null,
  incoming: FedosDeletionRequestInboxSummaryV1,
): FedosDeletionRequestInboxSummaryWriteResult {
  if (existing === null) return "inserted";
  return summariesEqual(existing, incoming) ? "already-present" : "conflict";
}

export class InMemoryFedosDeletionRequestInboxSummaryPersistence implements FedosDeletionRequestInboxSummaryPersistence {
  readonly #byRequestId = new Map<string, FedosDeletionRequestInboxSummaryV1>();

  putSummary(summary: FedosDeletionRequestInboxSummaryV1): FedosDeletionRequestInboxSummaryWriteResult {
    const outcome = evaluateFedosDeletionRequestInboxSummaryWrite(this.#byRequestId.get(summary.requestId) ?? null, summary);
    if (outcome === "inserted") this.#byRequestId.set(summary.requestId, summary);
    return outcome;
  }
  getSummary(requestId: string): FedosDeletionRequestInboxSummaryV1 | null {
    return this.#byRequestId.get(requestId) ?? null;
  }
  listSummaries(): readonly FedosDeletionRequestInboxSummaryV1[] {
    return [...this.#byRequestId.values()];
  }
}
