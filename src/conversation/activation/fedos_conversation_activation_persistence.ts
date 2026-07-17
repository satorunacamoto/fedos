/**
 * Secure Runtime Alpha 1121 ("Activation Persistence") — Phase B of the
 * Alpha 1111–1180 Private Conversation Activation and Direct Messaging
 * Runtime Arc.
 *
 * A dedicated, minimal port — the ONLY consumer is
 * `FedosConversationDirectActivationCoordinator` (Alpha 1122) plus the
 * shared read helper `resolveFedosConversationActiveConversation()`
 * (`./fedos_conversation_active_lookup.ts`). Mirrors
 * `FedosConversationConstructionCoordinationPersistence`'s own
 * `(activationId, phase)`-keyed, "resolve current by precedence" shape
 * exactly (Alpha 914).
 *
 * Requirements (Alpha 1121): append-only; no backward phase transition
 * (`resolveCurrent...` picks the highest rank); active cannot revert to
 * draft (there is no write path that removes or downgrades a `"completed"`
 * fact — every backend below has no delete/update method); corruption
 * fails closed (a conflicting duplicate key throws on replay); restart-
 * stable replay; no delete/compaction.
 */

import type {
  FedosConversationActivationPhase,
  FedosPersistedConversationActivationV1,
} from "./fedos_persisted_conversation_activation_v1.js";

/** Mirrors `FedosConversationConstructionCoordinationWriteResult` exactly (Alpha 914). */
export type FedosConversationActivationPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosConversationActivationPersistence {
  putActivationFact(record: FedosPersistedConversationActivationV1): FedosConversationActivationPersistenceWriteResult;
  /** Resolves the CURRENT (furthest-progressed) fact for one activation id. */
  getActivation(activationId: string): FedosPersistedConversationActivationV1 | null;
}

/** Internal storage key — `(activationId, phase)`, never `activationId` alone. */
export function fedosConversationActivationRecordKey(activationId: string, phase: string): string {
  return `${activationId}::${phase}`;
}

/** Structural equality over every field. */
export function fedosPersistedConversationActivationRecordsAreEqual(
  a: FedosPersistedConversationActivationV1,
  b: FedosPersistedConversationActivationV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.activationId === b.activationId &&
    a.conversationId === b.conversationId &&
    a.phase === b.phase &&
    a.startedAt === b.startedAt &&
    a.updatedAt === b.updatedAt
  );
}

/**
 * Phases only ever move FORWARD within one activation attempt — the CURRENT
 * fact is whichever present phase has the highest rank. `"terminal-failed"`
 * outranks `"prepared"` (it can only be written AFTER a `"prepared"` fact
 * exists) but is always superseded once `"readiness-confirmed"` (or later)
 * exists — the coordinator never writes `"terminal-failed"` after a
 * readiness-confirmed fact has succeeded. Mirrors
 * `PHASE_RANK`/`resolveCurrentConstructionCoordinationRecord` exactly
 * (Alpha 914).
 */
const PHASE_RANK: Readonly<Record<FedosConversationActivationPhase, number>> = {
  prepared: 0,
  "terminal-failed": 1,
  "readiness-confirmed": 2,
  "lifecycle-activated": 3,
  completed: 4,
};

export function resolveCurrentActivationRecord(
  factsForId: readonly FedosPersistedConversationActivationV1[],
): FedosPersistedConversationActivationV1 | null {
  if (factsForId.length === 0) return null;
  let current = factsForId[0]!;
  for (const fact of factsForId) {
    if (PHASE_RANK[fact.phase] > PHASE_RANK[current.phase]) current = fact;
  }
  return current;
}
