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

const FANOUT_STATES: ReadonlySet<string> = new Set(Object.keys(FANOUT_STATE_RANK));
const MAX_STRING_LENGTH = 512;

function isSafeNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_STRING_LENGTH;
}

/**
 * Secure Runtime Alpha 1921–1980 — the deep validator for a
 * `FedosGroupMessageRecord`, mirroring `validateFedosGroupGenerationRecord()`'s
 * own discipline (`./fedos_group_generation.ts`, Alpha 1327): rejects
 * unknown fields, requires `fanoutState` to be one of the closed
 * vocabulary above, requires `recipientCount` to be a non-negative
 * integer, and freezes the result. Unlike Generation's own `generationId`
 * or Path's own `pathId`, `id` cannot be re-derived here (`toFedosGroupMessageId()`
 * needs the ORIGINAL idempotency key, which this record does not itself
 * carry) — it is validated structurally only, exactly as this codebase
 * already accepts for other ids it cannot independently re-derive. Fails
 * closed to `null`, never throws.
 */
export function validateFedosGroupMessageRecord(candidate: unknown): FedosGroupMessageRecord | null {
  if (candidate === null || typeof candidate !== "object") return null;
  const keys = Object.keys(candidate as object).sort();
  const expected = [
    "createdAt",
    "fanoutState",
    "generationId",
    "groupConversationId",
    "id",
    "recipientCount",
    "replyToGroupMessageId",
    "senderMembershipId",
  ];
  if (keys.length !== expected.length || !keys.every((k, i) => k === expected[i])) return null;

  const record = candidate as Record<string, unknown>;
  if (!isSafeNonEmptyString(record.id)) return null;
  if (!isSafeNonEmptyString(record.groupConversationId)) return null;
  if (!isSafeNonEmptyString(record.generationId)) return null;
  if (!isSafeNonEmptyString(record.senderMembershipId)) return null;
  if (typeof record.createdAt !== "number" || !Number.isInteger(record.createdAt) || record.createdAt < 0) return null;
  if (record.replyToGroupMessageId !== null && !isSafeNonEmptyString(record.replyToGroupMessageId)) return null;
  if (typeof record.recipientCount !== "number" || !Number.isInteger(record.recipientCount) || record.recipientCount < 0) return null;
  if (typeof record.fanoutState !== "string" || !FANOUT_STATES.has(record.fanoutState)) return null;

  return Object.freeze({
    id: record.id,
    groupConversationId: record.groupConversationId,
    generationId: record.generationId,
    senderMembershipId: record.senderMembershipId,
    createdAt: record.createdAt,
    replyToGroupMessageId: record.replyToGroupMessageId as string | null,
    recipientCount: record.recipientCount,
    fanoutState: record.fanoutState as FedosGroupMessageFanoutState,
  });
}

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
