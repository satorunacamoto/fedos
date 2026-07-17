/**
 * Secure Runtime Alpha 1341–1342 ("Canonical Group Message Identity/
 * Record") — Phase C of the Alpha 1321–1390 Private Group Pairwise
 * Fanout Foundation Arc.
 *
 * A `FedosGroupMessageRecord` is the LOCAL canonical record of one
 * fanout send — it never equals any one recipient's own Envelope id
 * (Alpha 1341), never stores plaintext, and never stores ciphertext
 * inline (Alpha 1342). Per-recipient outcomes live entirely in
 * `FedosGroupFanoutDeliveryRecord` (`./fedos_group_fanout_delivery.ts`).
 * `fanoutState` only ever takes a value this codebase's own Group Send
 * Coordinator actually produces (Alpha 1349) — recovery re-derives
 * progress from the delivery records themselves, never from a separate,
 * potentially-stale progress flag.
 */

export type FedosGroupMessageFanoutState = "planned" | "complete" | "failed";

export interface FedosGroupMessageRecord {
  readonly id: string;
  readonly groupConversationId: string;
  readonly generationId: string;
  readonly senderMembershipId: string;
  readonly createdAt: number;
  readonly replyToGroupMessageId: string | null;
  readonly recipientCount: number;
  readonly fanoutState: FedosGroupMessageFanoutState;
}

/** Deterministic — mirrors `FedosConversationEncryptMessageCommand`'s own idempotency-key-derived id shape (Alpha 943). */
export function toFedosGroupMessageId(groupConversationId: string, idempotencyKey: string): string {
  return `group-message::${groupConversationId}::${idempotencyKey}`;
}

const FANOUT_STATE_RANK: Readonly<Record<FedosGroupMessageFanoutState, number>> = {
  planned: 0,
  failed: 1,
  complete: 2,
};

export function resolveCurrentGroupMessageRecord(
  factsForId: readonly FedosGroupMessageRecord[],
): FedosGroupMessageRecord | null {
  if (factsForId.length === 0) return null;
  let current = factsForId[0]!;
  for (const fact of factsForId) {
    if (FANOUT_STATE_RANK[fact.fanoutState] > FANOUT_STATE_RANK[current.fanoutState]) current = fact;
  }
  return current;
}

/** Internal storage key — `(id, fanoutState)`, never `id` alone. */
export function fedosGroupMessageRecordKey(id: string, fanoutState: string): string {
  return `${id}::${fanoutState}`;
}

export function fedosGroupMessageRecordsAreEqual(a: FedosGroupMessageRecord, b: FedosGroupMessageRecord): boolean {
  return (
    a.id === b.id &&
    a.groupConversationId === b.groupConversationId &&
    a.generationId === b.generationId &&
    a.senderMembershipId === b.senderMembershipId &&
    a.createdAt === b.createdAt &&
    a.replyToGroupMessageId === b.replyToGroupMessageId &&
    a.recipientCount === b.recipientCount &&
    a.fanoutState === b.fanoutState
  );
}

export type FedosGroupMessagePersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosGroupMessagePersistence {
  putMessageFact(record: FedosGroupMessageRecord): FedosGroupMessagePersistenceWriteResult;
  /** Resolves the CURRENT (highest-ranked fanoutState) fact for one Group Message id. */
  getMessage(id: string): FedosGroupMessageRecord | null;
  /** Sorted `createdAt` ascending, id tie-break (mirrors `listDirectMessages()`'s own LOCAL-only ordering, Alpha 1133). */
  listMessagesForGroup(groupConversationId: string): readonly FedosGroupMessageRecord[];
}
