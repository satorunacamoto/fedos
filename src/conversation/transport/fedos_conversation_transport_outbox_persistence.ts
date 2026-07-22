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
 *
 * Secure Runtime Alpha 1841–1920 Phase B (Alpha 1846/1848) — the port's
 * own record type is WIDENED, additively, from the V1-only shape to the
 * closed `FedosPersistedConversationTransportOutboxRecord` union (V1 |
 * V2, `fedos_conversation_transport_outbox_codec.ts`). Every existing
 * backend/caller that only ever produces/consumes V1 records continues
 * to type-check and behave identically — V1 is a member of the union,
 * unchanged.
 */

import type {
  FedosPersistedConversationTransportOutboxRecord,
  FedosPersistedConversationTransportOutboxRecordV1,
  FedosPersistedConversationTransportOutboxRecordV2,
} from "./fedos_conversation_transport_outbox_codec.js";

export type FedosConversationTransportOutboxPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosConversationTransportOutboxPersistence {
  putIntent(record: FedosPersistedConversationTransportOutboxRecord): FedosConversationTransportOutboxPersistenceWriteResult;
  getIntent(id: string): FedosPersistedConversationTransportOutboxRecord | null;
  listIntents(): readonly FedosPersistedConversationTransportOutboxRecord[];
}

function recordsShareCommonFields(
  a: FedosPersistedConversationTransportOutboxRecord,
  b: FedosPersistedConversationTransportOutboxRecord,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.id === b.id &&
    a.envelopeId === b.envelopeId &&
    a.conversationId === b.conversationId &&
    a.createdAt === b.createdAt
  );
}

function fedosNativeEventsAreEqual(
  a: FedosPersistedConversationTransportOutboxRecordV2["nativeEvent"],
  b: FedosPersistedConversationTransportOutboxRecordV2["nativeEvent"],
): boolean {
  return (
    a.id === b.id &&
    a.pubkey === b.pubkey &&
    a.created_at === b.created_at &&
    a.kind === b.kind &&
    a.content === b.content &&
    a.sig === b.sig &&
    a.tags.length === b.tags.length &&
    a.tags.every((tag, index) => {
      const other = b.tags[index];
      return other !== undefined && tag.length === other.length && tag.every((value, i) => value === other[i]);
    })
  );
}

/**
 * Field-by-field structural equality — mirrors `fedosPersistedBoardOutboxRecordsAreEqual`'s
 * own identical role. Alpha 1846/1848 — ADDITIVELY handles the V2 shape:
 * two records of different `schemaVersion` are never equal; two V2
 * records are equal only if EVERY field, including the full native
 * event, matches exactly.
 */
export function fedosPersistedConversationTransportOutboxRecordsAreEqual(
  a: FedosPersistedConversationTransportOutboxRecord,
  b: FedosPersistedConversationTransportOutboxRecord,
): boolean {
  if (!recordsShareCommonFields(a, b)) return false;
  if (a.schemaVersion === 1 || b.schemaVersion === 1) return a.schemaVersion === b.schemaVersion;
  return a.route === b.route && a.recipientPublicKeyHex === b.recipientPublicKeyHex && fedosNativeEventsAreEqual(a.nativeEvent, b.nativeEvent);
}

export type { FedosPersistedConversationTransportOutboxRecordV1 };
