/**
 * Secure Runtime Alpha 1471–1540 — the backend-neutral Mailbox Delivery
 * Outbox port. Mirrors `FedosBoardOutboxPersistence`'s own shape and
 * semantics (`../../board/outbox/fedos_board_outbox_persistence.ts`,
 * Alpha 417) exactly — a deliberately separate port, not folded into it
 * (a transport outbox intent is not a Board outbox intent).
 *
 * HARD GUARDRAILS:
 *   - Synchronous — the same contract every other Outbox-shaped port in
 *     this repository already adopted.
 *   - No `delete`, no `dequeue`, no acknowledgment, no retry method, no
 *     Relay/protocol reference, no network of any kind.
 */

import type { FedosPersistedConversationTransportOutboxRecordV1 } from "./fedos_conversation_transport_outbox_codec.js";

export type FedosConversationTransportOutboxPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosConversationTransportOutboxPersistence {
  putIntent(record: FedosPersistedConversationTransportOutboxRecordV1): FedosConversationTransportOutboxPersistenceWriteResult;
  getIntent(id: string): FedosPersistedConversationTransportOutboxRecordV1 | null;
  listIntents(): readonly FedosPersistedConversationTransportOutboxRecordV1[];
}

/** Field-by-field structural equality — mirrors `fedosPersistedBoardOutboxRecordsAreEqual`'s own identical role. */
export function fedosPersistedConversationTransportOutboxRecordsAreEqual(
  a: FedosPersistedConversationTransportOutboxRecordV1,
  b: FedosPersistedConversationTransportOutboxRecordV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.id === b.id &&
    a.envelopeId === b.envelopeId &&
    a.conversationId === b.conversationId &&
    a.createdAt === b.createdAt
  );
}
