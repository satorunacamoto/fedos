/**
 * Secure Runtime Alpha 1346–1347 ("Fanout Delivery Record/States") —
 * Phase C of the Alpha 1321–1390 Private Group Pairwise Fanout
 * Foundation Arc.
 *
 * One immutable-per-state record per (Group Message, recipient) pair —
 * the durable fact this codebase's own crash recovery reads to decide
 * whether a recipient's own `sendDirectMessage()` call already
 * completed (Alpha 1350: "Recovery must not duplicate an already-stored
 * recipient Envelope"). No plaintext, no key, no arbitrary error string
 * — `state` is a closed, coarse vocabulary only (Alpha 1348's own "no
 * arbitrary error string" instruction, applied here identically).
 */

export type FedosGroupFanoutDeliveryState = "planned" | "encrypting" | "stored" | "failed";

export interface FedosGroupFanoutDeliveryRecord {
  readonly groupMessageId: string;
  readonly recipientMembershipId: string;
  readonly pathId: string;
  readonly envelopeId: string | null;
  readonly state: FedosGroupFanoutDeliveryState;
  readonly createdAt: number;
}

/** Deterministic — one record identity per (Group Message, recipient). */
export function toFedosGroupFanoutDeliveryId(groupMessageId: string, recipientMembershipId: string): string {
  return `group-delivery::${groupMessageId}::${recipientMembershipId}`;
}

const DELIVERY_STATE_RANK: Readonly<Record<FedosGroupFanoutDeliveryState, number>> = {
  planned: 0,
  encrypting: 1,
  failed: 2,
  stored: 3,
};

const DELIVERY_STATES: ReadonlySet<string> = new Set(Object.keys(DELIVERY_STATE_RANK));
const MAX_STRING_LENGTH = 512;

function isSafeNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_STRING_LENGTH;
}

/**
 * Secure Runtime Alpha 1921–1980 — the deep validator for a
 * `FedosGroupFanoutDeliveryRecord`, mirroring `validateFedosGroupGenerationRecord()`'s
 * own discipline (`../group/fedos_group_generation.ts`, Alpha 1327):
 * rejects unknown fields, requires `state` to be one of the closed
 * vocabulary above, requires `envelopeId` to be `null` or a safe
 * non-empty string, and freezes the result. Fails closed to `null`,
 * never throws.
 */
export function validateFedosGroupFanoutDeliveryRecord(candidate: unknown): FedosGroupFanoutDeliveryRecord | null {
  if (candidate === null || typeof candidate !== "object") return null;
  const keys = Object.keys(candidate as object).sort();
  const expected = ["createdAt", "envelopeId", "groupMessageId", "pathId", "recipientMembershipId", "state"];
  if (keys.length !== expected.length || !keys.every((k, i) => k === expected[i])) return null;

  const record = candidate as Record<string, unknown>;
  if (!isSafeNonEmptyString(record.groupMessageId)) return null;
  if (!isSafeNonEmptyString(record.recipientMembershipId)) return null;
  if (!isSafeNonEmptyString(record.pathId)) return null;
  if (record.envelopeId !== null && !isSafeNonEmptyString(record.envelopeId)) return null;
  if (typeof record.state !== "string" || !DELIVERY_STATES.has(record.state)) return null;
  if (typeof record.createdAt !== "number" || !Number.isInteger(record.createdAt) || record.createdAt < 0) return null;

  return Object.freeze({
    groupMessageId: record.groupMessageId,
    recipientMembershipId: record.recipientMembershipId,
    pathId: record.pathId,
    envelopeId: record.envelopeId as string | null,
    state: record.state as FedosGroupFanoutDeliveryState,
    createdAt: record.createdAt,
  });
}

export function resolveCurrentGroupFanoutDeliveryRecord(
  factsForId: readonly FedosGroupFanoutDeliveryRecord[],
): FedosGroupFanoutDeliveryRecord | null {
  if (factsForId.length === 0) return null;
  let current = factsForId[0]!;
  for (const fact of factsForId) {
    if (DELIVERY_STATE_RANK[fact.state] > DELIVERY_STATE_RANK[current.state]) current = fact;
  }
  return current;
}

/** Internal storage key — `(deliveryId, state)`, never `deliveryId` alone. */
export function fedosGroupFanoutDeliveryRecordKey(deliveryId: string, state: string): string {
  return `${deliveryId}::${state}`;
}

export function fedosGroupFanoutDeliveryRecordsAreEqual(
  a: FedosGroupFanoutDeliveryRecord,
  b: FedosGroupFanoutDeliveryRecord,
): boolean {
  return (
    a.groupMessageId === b.groupMessageId &&
    a.recipientMembershipId === b.recipientMembershipId &&
    a.pathId === b.pathId &&
    a.envelopeId === b.envelopeId &&
    a.state === b.state &&
    a.createdAt === b.createdAt
  );
}

export type FedosGroupFanoutDeliveryPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosGroupFanoutDeliveryPersistence {
  putDeliveryFact(record: FedosGroupFanoutDeliveryRecord): FedosGroupFanoutDeliveryPersistenceWriteResult;
  /** Resolves the CURRENT (highest-ranked state) fact for one (Group Message, recipient) pair. */
  getDelivery(groupMessageId: string, recipientMembershipId: string): FedosGroupFanoutDeliveryRecord | null;
  /** Every current delivery fact for one Group Message — used to compute a read-model fanout summary and to drive recovery. */
  listDeliveriesForMessage(groupMessageId: string): readonly FedosGroupFanoutDeliveryRecord[];
}
