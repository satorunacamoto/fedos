/**
 * Secure Runtime Alpha 1324–1327 ("Group Generation Identity/Record/
 * Validation/Persistence") — Phase A of the Alpha 1321–1390 Private Group
 * Pairwise Fanout Foundation Arc.
 *
 * A `FedosGroupGenerationRecord` is an IMMUTABLE snapshot of which
 * Membership ids were active on a `private-group` Conversation at the
 * moment the generation was created — never a shared cryptographic
 * artifact (no key of any kind lives here). Reuses the existing, frozen
 * `FedosConversationMembershipAuthority` for the underlying admit/revoke/
 * leave facts (Alpha 761–790, unmodified); this file only snapshots and
 * numbers them. A Membership change (admission or removal) produces a
 * NEW generation with a new, deterministic id — an old generation is
 * never mutated, mirroring `FedosConversationActivationPhase`'s own
 * forward-only, no-delete discipline (Alpha 1121).
 */

export type FedosGroupGenerationId = string & { readonly __brand: "FedosGroupGenerationId" };

export interface FedosGroupGenerationRecord {
  readonly groupConversationId: string;
  readonly generationId: FedosGroupGenerationId;
  readonly generationNumber: number;
  /** Sorted ascending, deduplicated — deterministic order, never insertion order. */
  readonly activeMemberMembershipIds: readonly string[];
  readonly createdAt: number;
  readonly previousGenerationId: FedosGroupGenerationId | null;
}

/** Deterministic — the same (group, number) pair always yields the identical id (mirrors `fedosConversationActivationId`, Alpha 1121). */
export function toFedosGroupGenerationId(groupConversationId: string, generationNumber: number): FedosGroupGenerationId {
  return `group-generation::${groupConversationId}::${generationNumber}` as FedosGroupGenerationId;
}

const MAX_STRING_LENGTH = 512;

function isSafeNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_STRING_LENGTH;
}

/**
 * Sole constructor — rejects unknown fields, requires the id to be
 * genuinely derived (never caller-asserted independently of its own
 * parts), requires at least two active members (Alpha 1326: "at least
 * creator plus one other participant"), requires sorted/deduplicated
 * membership ids, and freezes the result. Fails closed to `null`, never
 * throws.
 */
export function validateFedosGroupGenerationRecord(candidate: unknown): FedosGroupGenerationRecord | null {
  if (candidate === null || typeof candidate !== "object") return null;
  const keys = Object.keys(candidate as object).sort();
  const expected = [
    "activeMemberMembershipIds",
    "createdAt",
    "generationId",
    "generationNumber",
    "groupConversationId",
    "previousGenerationId",
  ];
  if (keys.length !== expected.length || !keys.every((k, i) => k === expected[i])) return null;

  const record = candidate as Record<string, unknown>;
  if (!isSafeNonEmptyString(record.groupConversationId)) return null;
  if (typeof record.generationNumber !== "number" || !Number.isInteger(record.generationNumber) || record.generationNumber < 0) {
    return null;
  }
  if (record.generationId !== toFedosGroupGenerationId(record.groupConversationId, record.generationNumber)) return null;
  if (typeof record.createdAt !== "number" || !Number.isInteger(record.createdAt) || record.createdAt < 0) return null;
  if (record.previousGenerationId !== null && !isSafeNonEmptyString(record.previousGenerationId)) return null;

  if (!Array.isArray(record.activeMemberMembershipIds)) return null;
  const ids = record.activeMemberMembershipIds as unknown[];
  if (ids.length < 2) return null; // creator + at least one other (Alpha 1326).
  if (!ids.every(isSafeNonEmptyString)) return null;
  const asStrings = ids as string[];
  if (new Set(asStrings).size !== asStrings.length) return null; // no duplicates.
  const sorted = [...asStrings].sort();
  if (!sorted.every((id, i) => id === asStrings[i])) return null; // must already be sorted (deterministic order).

  return Object.freeze({
    groupConversationId: record.groupConversationId,
    generationId: record.generationId as FedosGroupGenerationId,
    generationNumber: record.generationNumber,
    activeMemberMembershipIds: Object.freeze([...asStrings]),
    createdAt: record.createdAt,
    previousGenerationId: record.previousGenerationId as FedosGroupGenerationId | null,
  });
}

export type FedosGroupGenerationPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

/**
 * A generation record is written exactly once and never superseded by a
 * later fact under the SAME id (unlike Activation's own multi-phase log —
 * a generation has no phase progression of its own). `putGeneration`
 * therefore behaves like a plain insert-once map keyed by `generationId`;
 * `currentGenerationForGroup`/`listGenerations` scan by `groupConversationId`.
 */
export interface FedosGroupGenerationPersistence {
  putGeneration(record: FedosGroupGenerationRecord): FedosGroupGenerationPersistenceWriteResult;
  getGeneration(generationId: FedosGroupGenerationId): FedosGroupGenerationRecord | null;
  /** The highest `generationNumber` record for this group, or `null` if none exists yet. */
  currentGenerationForGroup(groupConversationId: string): FedosGroupGenerationRecord | null;
  /** Sorted by `generationNumber` ascending. */
  listGenerations(groupConversationId: string): readonly FedosGroupGenerationRecord[];
}

/** Structural equality over every field — used to distinguish a genuine duplicate write from a conflicting one. */
export function fedosGroupGenerationRecordsAreEqual(a: FedosGroupGenerationRecord, b: FedosGroupGenerationRecord): boolean {
  return (
    a.groupConversationId === b.groupConversationId &&
    a.generationId === b.generationId &&
    a.generationNumber === b.generationNumber &&
    a.createdAt === b.createdAt &&
    a.previousGenerationId === b.previousGenerationId &&
    a.activeMemberMembershipIds.length === b.activeMemberMembershipIds.length &&
    a.activeMemberMembershipIds.every((id, i) => id === b.activeMemberMembershipIds[i])
  );
}

export function currentGenerationFrom(records: readonly FedosGroupGenerationRecord[]): FedosGroupGenerationRecord | null {
  if (records.length === 0) return null;
  let current = records[0]!;
  for (const record of records) {
    if (record.generationNumber > current.generationNumber) current = record;
  }
  return current;
}
