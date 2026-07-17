/**
 * Secure Runtime Alpha 1331–1333/1336 ("Pairwise Path Identity/Record/
 * State/Persistence") — Phase B of the Alpha 1321–1390 Private Group
 * Pairwise Fanout Foundation Arc.
 *
 * A `FedosGroupDirectPathRecord` maps one (group, generation, local,
 * counterparty) tuple onto exactly one underlying `direct` Conversation.
 * `pathId` is generation-scoped (a new record per generation, per Alpha
 * 1331); `directConversationId` is NOT generation-scoped — the same two
 * participants always resolve to the SAME underlying Direct Conversation
 * across every generation they are both active in, computed via
 * `toFedosGroupPairKey()` fed as the idempotency key to the existing,
 * unmodified `createDirectDraft()` (Alpha 915) — no new id-minting scheme,
 * no new Conversation-id constructor.
 */

export type FedosGroupDirectPathState = "pending" | "ready" | "unavailable" | "superseded";

export interface FedosGroupDirectPathRecord {
  readonly pathId: string;
  readonly groupConversationId: string;
  readonly generationId: string;
  readonly senderMembershipId: string;
  readonly recipientMembershipId: string;
  readonly directConversationId: string;
  readonly state: FedosGroupDirectPathState;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Deterministic — generation-scoped (Alpha 1331). */
export function toFedosGroupDirectPathId(
  groupConversationId: string,
  generationId: string,
  senderMembershipId: string,
  recipientMembershipId: string,
): string {
  return `group-path::${groupConversationId}::${generationId}::${senderMembershipId}::${recipientMembershipId}`;
}

/**
 * Deterministic — NEVER generation-scoped, order-independent (sorted),
 * so a (sender, recipient) pair always resolves to the SAME pair key
 * regardless of which of the two membership ids is passed first, and
 * regardless of which generation is current when it is computed. Fed as
 * the `idempotencyKey` to `createDirectDraft()` (Alpha 908) — that
 * function's own `isSafeRequestId()` REJECTS any string over 256
 * characters or containing `"::"` (its own reserved separator). A
 * `FedosConversationMembershipId` (Alpha 767) already always contains
 * `"::"` internally AND embeds the full `groupConversationId` — so this
 * strips the (already-known, redundant) `groupConversationId::` prefix
 * each membership id carries, keeping only its own
 * `authority::publicIdentifier` suffix, then escapes the one remaining
 * `"::"` to `_c_` — a purely mechanical, deterministic, length-bounded,
 * ::-free transform (never a hash, never new cryptography). The
 * underlying `direct` Conversation this key resolves to is therefore
 * shared by the SAME two participants across every group they are both
 * members of — a deliberate, honest simplification (two people talking
 * pairwise need not get a second Direct Conversation per group).
 */
function participantSuffixOfMembershipId(groupConversationId: string, membershipId: string): string {
  const prefix = `${groupConversationId}::`;
  const suffix = membershipId.startsWith(prefix) ? membershipId.slice(prefix.length) : membershipId;
  return suffix.replace(/::/g, "_c_");
}

export function toFedosGroupPairKey(groupConversationId: string, membershipIdA: string, membershipIdB: string): string {
  const sorted = [
    participantSuffixOfMembershipId(groupConversationId, membershipIdA),
    participantSuffixOfMembershipId(groupConversationId, membershipIdB),
  ].sort();
  return `group-pair_${sorted[0]!}_${sorted[1]!}`;
}

const PATH_STATE_RANK: Readonly<Record<FedosGroupDirectPathState, number>> = {
  pending: 0,
  unavailable: 1,
  ready: 2,
  superseded: 3,
};

export function resolveCurrentGroupDirectPathRecord(
  factsForId: readonly FedosGroupDirectPathRecord[],
): FedosGroupDirectPathRecord | null {
  if (factsForId.length === 0) return null;
  let current = factsForId[0]!;
  for (const fact of factsForId) {
    if (PATH_STATE_RANK[fact.state] > PATH_STATE_RANK[current.state]) current = fact;
  }
  return current;
}

/** Internal storage key — `(pathId, state)`, never `pathId` alone (mirrors Activation's `(activationId, phase)` key). */
export function fedosGroupDirectPathRecordKey(pathId: string, state: string): string {
  return `${pathId}::${state}`;
}

export function fedosGroupDirectPathRecordsAreEqual(a: FedosGroupDirectPathRecord, b: FedosGroupDirectPathRecord): boolean {
  return (
    a.pathId === b.pathId &&
    a.groupConversationId === b.groupConversationId &&
    a.generationId === b.generationId &&
    a.senderMembershipId === b.senderMembershipId &&
    a.recipientMembershipId === b.recipientMembershipId &&
    a.directConversationId === b.directConversationId &&
    a.state === b.state &&
    a.createdAt === b.createdAt &&
    a.updatedAt === b.updatedAt
  );
}

export type FedosGroupDirectPathPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosGroupDirectPathPersistence {
  putPathFact(record: FedosGroupDirectPathRecord): FedosGroupDirectPathPersistenceWriteResult;
  /** Resolves the CURRENT (highest-ranked state) fact for one path id. */
  getPath(pathId: string): FedosGroupDirectPathRecord | null;
  /** Every current path fact for one generation — used by the Fanout Planner. */
  listPathsForGeneration(groupConversationId: string, generationId: string): readonly FedosGroupDirectPathRecord[];
}
