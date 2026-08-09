/**
 * Secure Runtime Alpha 894/911 ("Conversation Record Compatibility" /
 * "Construction Write Inventory") — a DEDICATED durable port for the
 * private-draft record, mirroring `FedosConversationPersistence`'s own
 * shape (Alpha 749) exactly and kept SEPARATE from it: the public
 * Conversation record and a private draft record are different durable
 * facts (different fields, different id namespace, different lifecycle),
 * so they never share a port or a log file — the same "one port per
 * durable concern" discipline this codebase already applies to
 * Board/Outbox/Observation/Membership/Capability.
 *
 * A draft record is IMMUTABLE once written in this Arc (its only legal
 * lifecycle is `"draft"`; no `draft → active` transition exists here), so
 * a single record per id is sufficient — unlike Membership/Capability,
 * this port needs no `(id, state)` event-keying.
 *
 * HARD GUARDRAILS:
 *   - No `delete`/compaction/rewrite method — this Arc's Absolute
 *     Prohibitions forbid it.
 *   - Synchronous, matching every other port in this codebase.
 */

import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";
import type { FedosPersistedConversationDraftRecordV1 } from "../../../../conversation/construction/fedos_persisted_conversation_draft_record_v1.js";

/** Mirrors `FedosConversationPersistenceWriteResult` exactly (Alpha 749). */
export type FedosConversationDraftPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosConversationDraftPersistence {
  putDraft(record: FedosPersistedConversationDraftRecordV1): FedosConversationDraftPersistenceWriteResult;
  getDraft(id: FedosConversationId): FedosPersistedConversationDraftRecordV1 | null;
  listDrafts(): readonly FedosPersistedConversationDraftRecordV1[];
}

/** Field-by-field structural equality — decides `"already-present"` vs `"conflict"` at the port level (Alpha 749). */
export function fedosPersistedConversationDraftRecordsAreEqual(
  a: FedosPersistedConversationDraftRecordV1,
  b: FedosPersistedConversationDraftRecordV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.id === b.id &&
    a.mode === b.mode &&
    a.lifecycleState === b.lifecycleState &&
    a.policyReference === b.policyReference &&
    a.creatorAuthority === b.creatorAuthority &&
    a.creatorPublicIdentifier === b.creatorPublicIdentifier &&
    a.creatorIdentityId === b.creatorIdentityId &&
    a.createdAt === b.createdAt
  );
}
