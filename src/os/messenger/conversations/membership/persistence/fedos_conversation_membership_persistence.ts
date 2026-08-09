/**
 * Secure Runtime Alpha 827 ("Membership Persistence Port") — Stage 7 of
 * the Alpha 821–850 Durable Conversation Membership & Capability
 * Persistence Arc.
 *
 * A DEDICATED port — Option B of Alpha 823 ("dedicated persistence
 * ports injected into Authorities"), mirroring
 * `FedosConversationPersistence`'s own shape (Alpha 749) exactly.
 *
 * Because Membership DOES mutate over time (`active → revoked|left`,
 * Alpha 768) and this codebase's append-only backends are insert-only
 * (never rewrite/update), a single mutable record-per-id would make a
 * second, DIFFERENT write for the same `id` collide as `"conflict"` —
 * exactly the problem the ALREADY-COMPLETE `FedosPayloadRetentionPersistence`
 * port (Alpha 795/796) solved for an analogous "one entity, several
 * append-only transition facts over time" shape. This port reuses that
 * SAME solution: each write is internally keyed by
 * `(record.id, record.state)`, not `record.id` alone — at most one
 * `"active"`, one `"revoked"`, one `"left"` record can ever exist per
 * membership id, and `getMembership()`/`listMemberships()` resolve the
 * CURRENT record from whichever terminal (`revoked`/`left`) or
 * non-terminal (`active`) key is present, per
 * `resolveCurrentMembershipRecord()` below — presenting callers with
 * the SAME single-current-record contract `FedosConversationPersistence`
 * already has, while storing data in an append-only-safe shape
 * underneath.
 *
 * `putMembership()`'s caller (`PersistedFedosConversationMembershipAuthority`,
 * Alpha 830) is the ONLY thing that decides WHICH new key to write and
 * WHEN — this port itself enforces no transition legality (Alpha 827's
 * own "state transitions must remain owned by the Membership Authority,
 * not the raw persistence port" instruction); it only detects a
 * genuinely IRRECONCILABLE conflict (two different terminal states, or
 * two different records under an identical key) and fails closed.
 *
 * HARD GUARDRAILS:
 *   - No delete method.
 *   - Synchronous, matching every other port in this codebase.
 */

import type { FedosPersistedConversationMembershipV1 } from "../../../../../conversation/membership/persistence/fedos_persisted_conversation_membership_v1.js";

/** Mirrors `FedosConversationPersistenceWriteResult` exactly (Alpha 749). */
export type FedosConversationMembershipPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosConversationMembershipPersistence {
  putMembership(record: FedosPersistedConversationMembershipV1): FedosConversationMembershipPersistenceWriteResult;
  /** Resolves the CURRENT record for one membership id — see this file's own header. */
  getMembership(id: string): FedosPersistedConversationMembershipV1 | null;
  /** One CURRENT record per distinct membership id. */
  listMemberships(): readonly FedosPersistedConversationMembershipV1[];
  listConversationMemberships(conversationId: string): readonly FedosPersistedConversationMembershipV1[];
}

/** Internal storage key — `(id, state)`, never `id` alone. See this file's own header. */
export function fedosConversationMembershipRecordKey(id: string, state: string): string {
  return `${id}::${state}`;
}

/** Structural equality over every field — the same role `fedosPersistedConversationRecordsAreEqual` plays for Conversation persistence (Alpha 749). */
export function fedosPersistedConversationMembershipsAreEqual(
  a: FedosPersistedConversationMembershipV1,
  b: FedosPersistedConversationMembershipV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.id === b.id &&
    a.conversationId === b.conversationId &&
    a.participantAuthority === b.participantAuthority &&
    a.participantPublicIdentifier === b.participantPublicIdentifier &&
    a.participantIdentityId === b.participantIdentityId &&
    a.role === b.role &&
    a.state === b.state &&
    a.joinedAt === b.joinedAt &&
    a.endedAt === b.endedAt
  );
}

/**
 * Resolves the CURRENT record for one membership id out of every
 * `(id, state)`-keyed record a backend holds for it. `"revoked"` and
 * `"left"` are mutually exclusive by the Alpha 768 transition contract
 * (only one terminal transition is ever legal from `"active"`) — if a
 * backend somehow holds BOTH for the same id, that is genuine, real
 * corruption (an authority-level invariant violated), not a normal
 * sequence, and this function throws rather than silently picking a
 * winner — the SAME severity `AppendOnlyFedosConversationPersistence`
 * (Alpha 752) already applies to an irreconcilable duplicate.
 */
export function resolveCurrentMembershipRecord(
  recordsForId: readonly FedosPersistedConversationMembershipV1[],
): FedosPersistedConversationMembershipV1 | null {
  const revoked = recordsForId.find((record) => record.state === "revoked") ?? null;
  const left = recordsForId.find((record) => record.state === "left") ?? null;
  if (revoked !== null && left !== null) {
    throw new Error(
      `FedosConversationMembershipPersistence: invariant violated -- both "revoked" and "left" records exist for membership id "${revoked.id}".`,
    );
  }
  if (revoked !== null) return revoked;
  if (left !== null) return left;
  return recordsForId.find((record) => record.state === "active") ?? null;
}
