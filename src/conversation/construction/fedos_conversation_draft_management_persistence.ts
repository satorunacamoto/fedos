/**
 * Secure Runtime Alpha 1003 ("Draft Management Persistence Port") — Phase C of
 * the Alpha 991–1050 Conversation Invitation Transport & Draft Management Arc.
 *
 * A DEDICATED, minimal durable port for draft-management transition facts —
 * the ONLY consumer is `FedosConversationDraftManager` (Alpha 1006). Mirrors
 * `FedosConversationConstructionCoordinationPersistence`'s own append-only,
 * "resolve current on read" shape (Alpha 914) exactly, substituting the
 * `(conversationId, revision)` key an alternating managed lifecycle needs.
 *
 * Kept SEPARATE from `FedosConversationDraftPersistence` (Alpha 894): the
 * immutable draft record and its mutable-over-time managed state are different
 * durable facts, so they never share a port or a log file — the same "one port
 * per durable concern" discipline this codebase applies everywhere.
 *
 * HARD GUARDRAILS:
 *   - No delete/compaction/rewrite method.
 *   - Synchronous, matching every other port in this codebase.
 */

import type { FedosPersistedConversationDraftManagementStateV1 } from "./fedos_persisted_conversation_draft_management_state_v1.js";

/** Mirrors `FedosConversationPersistenceWriteResult` exactly (Alpha 749). */
export type FedosConversationDraftManagementWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosConversationDraftManagementPersistence {
  putManagementFact(record: FedosPersistedConversationDraftManagementStateV1): FedosConversationDraftManagementWriteResult;
  /** Resolves the CURRENT (highest-revision) management fact for one conversation — `null` when none exists (base `"draft"`). */
  getCurrentManagementState(conversationId: string): FedosPersistedConversationDraftManagementStateV1 | null;
  /** Every management fact recorded for one conversation, in no guaranteed order. */
  listManagementFacts(conversationId: string): readonly FedosPersistedConversationDraftManagementStateV1[];
}
