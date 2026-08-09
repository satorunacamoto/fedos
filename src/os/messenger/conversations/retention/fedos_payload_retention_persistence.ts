/**
 * Secure Runtime Alpha 795/796 — Stages 5-6 of the Alpha 791–820
 * Conversation Retention & Private Payload Storage Boundary Foundation
 * Arc.
 *
 * A DEDICATED port for the Retention Decision Log — mirrors
 * `FedosConversationPersistence`'s own shape (Alpha 749). Keyed by the
 * deterministic `fedosPayloadRetentionDecisionKey(payloadId, action)`
 * (`./fedos_payload_retention_decision.ts`) — at most one `"tombstoned"`
 * and one `"payload-removed"` record can ever exist per payload; a
 * SECOND write for the SAME key is idempotent (`"already-present"`) if
 * identical, or a genuine `"conflict"` if not (mirrors every other port
 * in this codebase). A DIFFERENT key (e.g. writing `"payload-removed"`
 * after `"tombstoned"` already exists for the same `payloadId`) is a
 * normal, expected additional record — the monotonic transition rule
 * itself (Alpha 798) is enforced by `FedosPayloadRetentionAuthority`
 * (`./fedos_payload_retention_authority.ts`), never by this pure port.
 *
 * HARD GUARDRAILS:
 *   - No delete method — a retention decision is itself a permanent,
 *     append-only fact; it is never un-recorded.
 *   - Synchronous, matching `FedosConversationPersistence`'s own
 *     contract.
 */

import type { FedosConversationPayloadId } from "../../../../conversation/payload_storage/fedos_conversation_payload_id.js";
import type { FedosPayloadRetentionAction } from "../../../../conversation/retention/fedos_payload_retention_decision.js";
import type { FedosPersistedPayloadRetentionDecisionV1 } from "../../../../conversation/retention/fedos_persisted_payload_retention_decision_v1.js";

/** Mirrors `FedosConversationPersistenceWriteResult` exactly (Alpha 749). */
export type FedosPayloadRetentionPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosPayloadRetentionPersistence {
  putDecision(record: FedosPersistedPayloadRetentionDecisionV1): FedosPayloadRetentionPersistenceWriteResult;
  getDecision(payloadId: FedosConversationPayloadId, action: FedosPayloadRetentionAction): FedosPersistedPayloadRetentionDecisionV1 | null;
  listDecisionsForPayload(payloadId: FedosConversationPayloadId): readonly FedosPersistedPayloadRetentionDecisionV1[];
  listDecisions(): readonly FedosPersistedPayloadRetentionDecisionV1[];
}

/** Structural equality over every field — the same role `fedosPersistedConversationRecordsAreEqual` plays for Conversation persistence (Alpha 749). */
export function fedosPersistedPayloadRetentionDecisionsAreEqual(
  a: FedosPersistedPayloadRetentionDecisionV1,
  b: FedosPersistedPayloadRetentionDecisionV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.payloadId === b.payloadId &&
    a.action === b.action &&
    a.decidedAt === b.decidedAt &&
    a.authorityReference === b.authorityReference &&
    a.reasonCode === b.reasonCode
  );
}
