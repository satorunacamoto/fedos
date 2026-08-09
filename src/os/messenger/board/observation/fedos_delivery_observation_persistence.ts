/**
 * Secure Runtime Alpha 464 ("Delivery Observation Persistence Port") —
 * Stage 4 of the Alpha 461–470 Canonical Delivery Observation Arc.
 *
 * The backend-neutral port every Observation persistence backend
 * implements — `InMemoryFedosDeliveryObservationPersistence`
 * (`./in_memory_fedos_delivery_observation_persistence.js`, Alpha 465).
 * Mirrors `FedosBoardOutboxPersistence`'s own shape and semantics
 * (`../outbox/fedos_board_outbox_persistence.ts`, Alpha 417) — a
 * DELIBERATELY SEPARATE port, not folded into it or into any other
 * existing persistence port, since a Delivery Observation is not an
 * Outbox intent and this Arc's own scope is standalone (Alpha 461).
 *
 * HARD GUARDRAILS:
 *   - Synchronous — the same contract `FedosBoardOutboxPersistence` and
 *     `FedosBoardPersistence` both already adopted.
 *   - No `delete`, no mutation method — an Observation is a historical
 *     fact and is never rewritten once written.
 *   - No retry method, no Publisher call, no connection-pool reference,
 *     no network, no Board/Outbox mutation of any kind.
 */

import type { FedosPersistedDeliveryObservationRecordV1 } from "./fedos_delivery_observation_codec.js";

/**
 * The result of one `putObservation` call — mirrors
 * `FedosBoardOutboxPersistenceWriteResult` (Alpha 417) exactly:
 *   - `"inserted"`: a genuinely new `id` was accepted.
 *   - `"already-present"`: the same `id` was written again with a
 *     STRUCTURALLY IDENTICAL record — idempotent, no mutation occurred.
 *   - `"conflict"`: the same `id` was written again with a DIFFERENT
 *     record — the original is preserved, fail closed.
 *   - `"failed"`: the backend itself could not complete the write for a
 *     reason unrelated to record content.
 */
export type FedosDeliveryObservationPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosDeliveryObservationPersistence {
  putObservation(
    record: FedosPersistedDeliveryObservationRecordV1,
  ): FedosDeliveryObservationPersistenceWriteResult;
  getObservation(id: string): FedosPersistedDeliveryObservationRecordV1 | null;
  listObservations(): readonly FedosPersistedDeliveryObservationRecordV1[];
}

/**
 * Field-by-field structural equality over every
 * `FedosPersistedDeliveryObservationRecordV1` field — the rule
 * `"already-present"` (§ above) depends on, mirroring
 * `fedosPersistedBoardOutboxRecordsAreEqual`'s own identical role
 * (`../outbox/fedos_board_outbox_persistence.ts`, Alpha 417).
 * Deliberately NOT a `JSON.stringify` comparison, so key order never
 * matters.
 */
export function fedosPersistedDeliveryObservationRecordsAreEqual(
  a: FedosPersistedDeliveryObservationRecordV1,
  b: FedosPersistedDeliveryObservationRecordV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.id === b.id &&
    a.subjectId === b.subjectId &&
    a.state === b.state &&
    a.observedAt === b.observedAt &&
    a.reason === b.reason
  );
}
