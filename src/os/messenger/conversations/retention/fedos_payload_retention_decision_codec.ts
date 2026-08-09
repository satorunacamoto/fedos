/**
 * Secure Runtime Alpha 795 ("Retention Decision Record") — Stage 5 of
 * the Alpha 791–820 Conversation Retention & Private Payload Storage
 * Boundary Foundation Arc.
 *
 * The ONLY two functions permitted to convert between
 * `FedosPayloadRetentionDecision` and its persisted wire shape
 * `FedosPersistedPayloadRetentionDecisionV1` — mirrors
 * `serializeFedosConversationRecord`/`deserializeFedosConversationRecord`'s
 * own exact discipline (Alpha 750).
 */

import {
  validateFedosPayloadRetentionDecision,
  type FedosPayloadRetentionDecisionInput,
} from "./fedos_payload_retention_decision_validator.js";
import {
  fedosPayloadRetentionDecisionKey,
  type FedosPayloadRetentionDecision,
} from "./fedos_payload_retention_decision.js";
import type { FedosPersistedPayloadRetentionDecisionV1 } from "./fedos_persisted_payload_retention_decision_v1.js";

export function serializeFedosPayloadRetentionDecision(
  decision: FedosPayloadRetentionDecision,
): FedosPersistedPayloadRetentionDecisionV1 {
  return {
    schemaVersion: 1,
    id: fedosPayloadRetentionDecisionKey(decision.payloadId, decision.action),
    payloadId: decision.payloadId,
    action: decision.action,
    decidedAt: decision.decidedAt,
    authorityReference: decision.authorityReference,
    reasonCode: decision.reasonCode,
  };
}

const TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
  "schemaVersion",
  "id",
  "payloadId",
  "action",
  "decidedAt",
  "authorityReference",
  "reasonCode",
]);

interface RawTopLevelFields {
  readonly schemaVersion: unknown;
  readonly id: unknown;
  readonly payloadId: unknown;
  readonly action: unknown;
  readonly decidedAt: unknown;
  readonly authorityReference: unknown;
  readonly reasonCode: unknown;
}

/** Fails closed to `null` for anything malformed, unrecognized-schema, or corrupt. Never throws. Also rejects if `id` does not match the deterministic key its own `payloadId`/`action` would produce -- a genuine consistency check, not merely a schema check. */
export function deserializeFedosPayloadRetentionDecision(record: unknown): FedosPayloadRetentionDecision | null {
  if (record === null || typeof record !== "object") return null;
  const keys = Object.keys(record);
  if (!keys.every((key) => TOP_LEVEL_KEYS.has(key)) || keys.length !== TOP_LEVEL_KEYS.size) return null;

  const { schemaVersion, id, payloadId, action, decidedAt, authorityReference, reasonCode } = record as RawTopLevelFields;

  if (schemaVersion !== 1) return null;
  if (typeof id !== "string") return null;
  if (typeof payloadId !== "string") return null;
  if (typeof action !== "string") return null;
  if (typeof decidedAt !== "number") return null;
  if (authorityReference !== null && typeof authorityReference !== "string") return null;
  if (typeof reasonCode !== "string") return null;

  const input: FedosPayloadRetentionDecisionInput = { payloadId, action, decidedAt, authorityReference, reasonCode };
  const decision = validateFedosPayloadRetentionDecision(input);
  if (decision === null) return null;

  if (id !== fedosPayloadRetentionDecisionKey(decision.payloadId, decision.action)) return null;

  return decision;
}
