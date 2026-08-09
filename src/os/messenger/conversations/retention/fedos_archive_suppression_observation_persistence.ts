/**
 * Secure Runtime Alpha 7721–7800 ("FedOS Archive Multi-Device Suppression
 * Propagation Arc") — Phase E: the durable port for suppression
 * observations. Mirrors `FedosPayloadRetentionPersistence`'s own shape
 * exactly (Alpha 795/796) — this Arc's OWN, separate log (Phase A
 * reconciliation report's own decision: never merged into the local
 * Retention Authority's own decision log, so "local decision and
 * imported observation remain distinguishable" by construction).
 *
 * HARD GUARDRAILS:
 *   - No delete method — a suppression observation is a permanent,
 *     append-only fact; it is never un-recorded (an incoming
 *     rollback/conflict is REJECTED before it would ever need to
 *     overwrite one, per `fedos_archive_suppression_observation_authority.ts`).
 *   - Synchronous, matching every other port in this codebase.
 */

import type { FedosPersistedArchiveSuppressionObservationV1 } from "../../../../conversation/retention/fedos_persisted_archive_suppression_observation_v1.js";

export type FedosArchiveSuppressionObservationPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosArchiveSuppressionObservationPersistence {
  putObservation(record: FedosPersistedArchiveSuppressionObservationV1): FedosArchiveSuppressionObservationPersistenceWriteResult;
  getObservation(id: string): FedosPersistedArchiveSuppressionObservationV1 | null;
  listObservationsForSubject(subjectRef: string): readonly FedosPersistedArchiveSuppressionObservationV1[];
  listObservations(): readonly FedosPersistedArchiveSuppressionObservationV1[];
}
