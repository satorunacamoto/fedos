/**
 * Secure Runtime Alpha 749 ("Conversation Persistence Port") — Stage 9
 * of the Alpha 741–760 Canonical Conversation Identity and Record
 * Foundation Arc.
 *
 * A DEDICATED port — mirrors `FedosBoardPersistence`'s own shape
 * (`../../board/persistence/fedos_board_persistence.ts`, Alpha 315)
 * exactly, but is NEVER folded into it: a Conversation record and a
 * Board post are different durable facts with different lifecycles
 * (see `docs/secure_runtime_alpha_749_conversation_persistence_port.md`
 * §"why not Board persistence"), matching this codebase's own existing
 * discipline of one port per durable concern (Board / Outbox /
 * Observation, each already separate).
 *
 * HARD GUARDRAILS:
 *   - No `delete` method — this Arc's own Absolute Prohibitions forbid
 *     deletion/compaction entirely.
 *   - No database-specific vocabulary, no SQL, no KV keys, no
 *     filesystem path, no Secure Runtime handle, no `p2p` type, no
 *     protocol adapter, no network.
 *   - Synchronous, matching `FedosBoardPersistence`'s own contract.
 */

import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";
import type { FedosPersistedConversationRecordV1 } from "../../../../conversation/persistence/fedos_persisted_conversation_record_v1.js";

/**
 * Mirrors `FedosBoardPersistenceWriteResult` exactly (Alpha 315) — no
 * new outcome invented, no outcome omitted.
 */
export type FedosConversationPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosConversationPersistence {
  putConversation(record: FedosPersistedConversationRecordV1): FedosConversationPersistenceWriteResult;
  getConversation(id: FedosConversationId): FedosPersistedConversationRecordV1 | null;
  listConversations(): readonly FedosPersistedConversationRecordV1[];
}

/**
 * Field-by-field structural equality — the SAME role
 * `fedosPersistedBoardPostRecordsAreEqual` plays for
 * `FedosBoardPersistence` (Alpha 315 §"already-present"), applied here
 * so `"already-present"` vs `"conflict"` is a port-level rule, not one
 * backend's private detail.
 */
export function fedosPersistedConversationRecordsAreEqual(
  a: FedosPersistedConversationRecordV1,
  b: FedosPersistedConversationRecordV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.id === b.id &&
    a.mode === b.mode &&
    a.boardId === b.boardId &&
    a.rootThreadId === b.rootThreadId &&
    a.rootPostId === b.rootPostId &&
    a.policyReference === b.policyReference &&
    a.createdAt === b.createdAt
  );
}
