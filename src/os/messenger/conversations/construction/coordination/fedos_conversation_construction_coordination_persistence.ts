/**
 * Secure Runtime Alpha 914 ("Coordination Persistence") — Stage 4 of
 * Phase C of the Alpha 891–930 Private Conversation Draft Construction and
 * Readiness Runtime Arc.
 *
 * A dedicated, minimal port — the ONLY consumer is
 * `FedosPrivateConversationConstructionCoordinator` (Alpha 915). Mirrors
 * `FedosConversationRedemptionCoordinationPersistence`'s own
 * `(coordinationId, phase)`-keyed, "resolve current by precedence" shape
 * (Alpha 844) exactly.
 *
 * Requirements (Alpha 914): deterministic coordination id (the caller's,
 * `fedosConversationConstructionCoordinationId`); append-only state
 * progression (one immutable fact per `(coordinationId, phase)`); NO
 * backward phase transition (`resolveCurrent...` picks the highest rank);
 * corruption fails closed (a conflicting duplicate key throws on replay);
 * restart replay; NO compaction/delete.
 */

import type {
  FedosConversationConstructionCoordinationPhase,
  FedosPersistedConversationConstructionCoordinationV1,
} from "../../../../../conversation/construction/coordination/fedos_persisted_conversation_construction_coordination_v1.js";

/** Mirrors `FedosConversationPersistenceWriteResult` exactly (Alpha 749). */
export type FedosConversationConstructionCoordinationWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosConversationConstructionCoordinationPersistence {
  putCoordinationFact(
    record: FedosPersistedConversationConstructionCoordinationV1,
  ): FedosConversationConstructionCoordinationWriteResult;
  /** Resolves the CURRENT (furthest-progressed) fact for one coordination id. */
  getCoordination(coordinationId: string): FedosPersistedConversationConstructionCoordinationV1 | null;
}

/** Internal storage key — `(coordinationId, phase)`, never `coordinationId` alone. */
export function fedosConversationConstructionCoordinationRecordKey(coordinationId: string, phase: string): string {
  return `${coordinationId}::${phase}`;
}

/** Structural equality over every field. */
export function fedosPersistedConversationConstructionCoordinationRecordsAreEqual(
  a: FedosPersistedConversationConstructionCoordinationV1,
  b: FedosPersistedConversationConstructionCoordinationV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.coordinationId === b.coordinationId &&
    a.conversationId === b.conversationId &&
    a.mode === b.mode &&
    a.phase === b.phase &&
    a.issuedCapabilityId === b.issuedCapabilityId &&
    a.startedAt === b.startedAt &&
    a.updatedAt === b.updatedAt
  );
}

/**
 * Phases only ever move FORWARD within one construction attempt — the
 * CURRENT fact is whichever present phase has the highest rank.
 * `"terminal-failed"` outranks `"prepared"` (it can only be written AFTER
 * a `"prepared"` fact exists) but is always superseded once
 * `"conversation-persisted"` (or later) exists — the coordinator never
 * writes `"terminal-failed"` after a durable draft write has succeeded.
 */
const PHASE_RANK: Readonly<Record<FedosConversationConstructionCoordinationPhase, number>> = {
  prepared: 0,
  "terminal-failed": 1,
  "conversation-persisted": 2,
  "creator-membership-admitted": 3,
  "capability-issued": 4,
  "draft-completed": 5,
};

export function resolveCurrentConstructionCoordinationRecord(
  factsForId: readonly FedosPersistedConversationConstructionCoordinationV1[],
): FedosPersistedConversationConstructionCoordinationV1 | null {
  if (factsForId.length === 0) return null;
  let current = factsForId[0]!;
  for (const fact of factsForId) {
    if (PHASE_RANK[fact.phase] > PHASE_RANK[current.phase]) current = fact;
  }
  return current;
}
