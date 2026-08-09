/**
 * Secure Runtime Alpha 844 ("Coordination Persistence") — Stage 2 of
 * Phase D of the Alpha 821–850 Durable Conversation Membership &
 * Capability Persistence Arc.
 *
 * A dedicated, minimal port — the ONLY consumer is
 * `FedosConversationDurableRedemptionCoordinator` (Alpha 845), matching
 * this Arc's own "implement in-memory and append-only variants only
 * when both are actual consumers" instruction. Mirrors
 * `FedosConversationMembershipPersistence`'s own `(id, state)`-keyed,
 * "one fact per transition, resolve current by precedence" shape (Alpha
 * 827) exactly, applied to `(coordinationId, phase)` instead.
 */

import type {
  FedosConversationRedemptionCoordinationPhase,
  FedosPersistedConversationRedemptionCoordinationV1,
} from "../../../../../conversation/capability/coordination/fedos_persisted_conversation_redemption_coordination_v1.js";

/** Mirrors `FedosConversationMembershipPersistenceWriteResult` exactly (Alpha 827). */
export type FedosConversationRedemptionCoordinationWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosConversationRedemptionCoordinationPersistence {
  putCoordinationFact(record: FedosPersistedConversationRedemptionCoordinationV1): FedosConversationRedemptionCoordinationWriteResult;
  /** Resolves the CURRENT (furthest-progressed) fact for one coordination id — see this file's own header. */
  getCoordination(coordinationId: string): FedosPersistedConversationRedemptionCoordinationV1 | null;
}

/** Internal storage key — `(coordinationId, phase)`, never `coordinationId` alone. */
export function fedosConversationRedemptionCoordinationRecordKey(coordinationId: string, phase: string): string {
  return `${coordinationId}::${phase}`;
}

/** Structural equality over every field. */
export function fedosPersistedConversationRedemptionCoordinationRecordsAreEqual(
  a: FedosPersistedConversationRedemptionCoordinationV1,
  b: FedosPersistedConversationRedemptionCoordinationV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.coordinationId === b.coordinationId &&
    a.capabilityId === b.capabilityId &&
    a.conversationId === b.conversationId &&
    a.redeemerAuthority === b.redeemerAuthority &&
    a.redeemerPublicIdentifier === b.redeemerPublicIdentifier &&
    a.redeemerIdentityId === b.redeemerIdentityId &&
    a.phase === b.phase &&
    a.startedAt === b.startedAt &&
    a.updatedAt === b.updatedAt
  );
}

/**
 * Phases only ever move FORWARD within one coordination attempt (see
 * `fedos_persisted_conversation_redemption_coordination_v1.ts`'s own
 * header) — the CURRENT fact is simply whichever phase present has the
 * highest rank. `"terminal-failed"` outranks `"prepared"` (it can only
 * ever be written AFTER a `"prepared"` fact already exists, for the SAME
 * coordination id) but is always superseded the moment a
 * `"capability-consumed"` fact (or later) exists — the Coordinator
 * itself (Alpha 845) never writes `"terminal-failed"` once Capability
 * consumption has durably succeeded, so this ordering never has to
 * reconcile a genuine conflict the way `resolveCurrentMembershipRecord()`
 * does for `"revoked"`/`"left"` (Alpha 827).
 */
const PHASE_RANK: Readonly<Record<FedosConversationRedemptionCoordinationPhase, number>> = {
  prepared: 0,
  "terminal-failed": 1,
  "capability-consumed": 2,
  "membership-admitted": 3,
  completed: 4,
};

export function resolveCurrentCoordinationRecord(
  factsForId: readonly FedosPersistedConversationRedemptionCoordinationV1[],
): FedosPersistedConversationRedemptionCoordinationV1 | null {
  if (factsForId.length === 0) return null;
  let current = factsForId[0]!;
  for (const fact of factsForId) {
    if (PHASE_RANK[fact.phase] > PHASE_RANK[current.phase]) current = fact;
  }
  return current;
}
