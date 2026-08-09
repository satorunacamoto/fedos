/**
 * Secure Runtime Alpha 941 ("Encryption Coordination Record") — Phase B
 * of the Alpha 931–990 Conversation Identity Resolution and Encryption
 * Coordinator Arc.
 *
 * A dedicated, minimal port — the ONLY consumer is
 * `FedosConversationEncryptionCoordinator` (Alpha 943). Mirrors
 * `FedosConversationConstructionCoordinationPersistence`'s own
 * `(coordinationId, phase)`-keyed, "resolve current by precedence" shape
 * (Alpha 914) exactly, which itself mirrors
 * `FedosConversationRedemptionCoordinationPersistence`'s own (Alpha 844).
 */

import type {
  FedosConversationEncryptionCoordinationPhase,
  FedosPersistedConversationEncryptionCoordinationV1,
} from "./fedos_persisted_conversation_encryption_coordination_v1.js";

/** Mirrors `FedosConversationPersistenceWriteResult` exactly (Alpha 749). */
export type FedosConversationEncryptionCoordinationWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosConversationEncryptionCoordinationPersistence {
  putCoordinationFact(
    record: FedosPersistedConversationEncryptionCoordinationV1,
  ): FedosConversationEncryptionCoordinationWriteResult;
  /** Resolves the CURRENT (furthest-progressed) fact for one coordination id. */
  getCoordination(coordinationId: string): FedosPersistedConversationEncryptionCoordinationV1 | null;
}

/** Internal storage key — `(coordinationId, phase)`, never `coordinationId` alone. */
export function fedosConversationEncryptionCoordinationRecordKey(coordinationId: string, phase: string): string {
  return `${coordinationId}::${phase}`;
}

/** Structural equality over every field. */
export function fedosPersistedConversationEncryptionCoordinationRecordsAreEqual(
  a: FedosPersistedConversationEncryptionCoordinationV1,
  b: FedosPersistedConversationEncryptionCoordinationV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.coordinationId === b.coordinationId &&
    a.conversationId === b.conversationId &&
    a.envelopeId === b.envelopeId &&
    a.payloadId === b.payloadId &&
    a.phase === b.phase &&
    a.startedAt === b.startedAt &&
    a.updatedAt === b.updatedAt
  );
}

/**
 * Phases only ever move FORWARD within one encryption attempt — the
 * CURRENT fact is whichever present phase has the highest rank.
 * `"terminal-failed"` outranks `"prepared"` (it can only be written
 * AFTER a `"prepared"` fact exists) but is never written once
 * `"payload-persisted"` (or later) exists — mirrors the construction
 * coordinator's own identical rule.
 */
const PHASE_RANK: Readonly<Record<FedosConversationEncryptionCoordinationPhase, number>> = {
  prepared: 0,
  "terminal-failed": 1,
  "payload-persisted": 2,
  "envelope-persisted": 3,
};

export function resolveCurrentEncryptionCoordinationRecord(
  factsForId: readonly FedosPersistedConversationEncryptionCoordinationV1[],
): FedosPersistedConversationEncryptionCoordinationV1 | null {
  if (factsForId.length === 0) return null;
  let current = factsForId[0]!;
  for (const fact of factsForId) {
    if (PHASE_RANK[fact.phase] > PHASE_RANK[current.phase]) current = fact;
  }
  return current;
}
