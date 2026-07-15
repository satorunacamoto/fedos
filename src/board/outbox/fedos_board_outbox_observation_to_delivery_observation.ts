/**
 * Secure Runtime Alpha 497 ("Scheduler Contract Rewiring") — Stage 7 of
 * the Alpha 491–500 Canonical Publisher & Delivery Observation Contract
 * Reconciliation Arc.
 *
 * The ONE sanctioned bridge between the two Observation vocabularies
 * (Alpha 493's own decision): `FedosBoardOutboxObservation`
 * (`./fedos_board_outbox_observation.js`, Alpha 475, UNCHANGED — still
 * produced internally by `FedosPublishScheduler`, also UNCHANGED) to
 * the canonical `FedosDeliveryObservation`
 * (`../observation/fedos_delivery_observation.js`, Alpha 462,
 * UNCHANGED). No other file may hand-translate one to the other (Alpha
 * 493 §2).
 *
 * Kind/state mapping (Alpha 493 §3, reproduced exactly, not
 * re-decided here):
 *
 *   attempt-started -> publishing
 *   delivered        -> accepted
 *   rejected         -> rejected   (verbatim)
 *   failed            -> failed     (verbatim)
 *   abandoned        -> failed     (narrowed, not a sixth state — Alpha 493 §4)
 *
 * `subjectId` is NOT derived from `outboxId` by this function — the
 * two are different branded types with no defined relationship; the
 * CALLER supplies the `FedosDeliveryObservationSubjectId` explicitly
 * (e.g. the same opaque string an upstream signing/publish step already
 * used to correlate the same logical delivery attempt), matching this
 * repository's own "never invent a cross-vocabulary identity mapping
 * silently" discipline.
 *
 * HARD GUARDRAILS:
 *   - `fedosBoardOutboxObservationToDeliveryObservation` is the ONLY
 *     export.
 *   - Pure, synchronous, fails closed to `null` (never throws) — reuses
 *     `createFedosDeliveryObservation`'s (Alpha 462) own validation
 *     rather than re-implementing it.
 *   - Does not write to any Repository/Persistence — this is a VALUE
 *     mapping only; wiring the result into durable storage remains
 *     Alpha 500's own named "Next Arc" (durable Observation wiring).
 */

import type { FedosBoardOutboxObservation } from "./fedos_board_outbox_observation.js";
import {
  createFedosDeliveryObservation,
  type FedosDeliveryObservation,
  type FedosDeliveryObservationState,
  type FedosDeliveryObservationSubjectId,
} from "../observation/fedos_delivery_observation.js";

const KIND_TO_STATE: Readonly<Record<FedosBoardOutboxObservation["kind"], FedosDeliveryObservationState>> = Object.freeze({
  "attempt-started": "publishing",
  delivered: "accepted",
  rejected: "rejected",
  failed: "failed",
  abandoned: "failed",
});

export function fedosBoardOutboxObservationToDeliveryObservation(
  observation: FedosBoardOutboxObservation,
  subjectId: FedosDeliveryObservationSubjectId,
): FedosDeliveryObservation | null {
  const state = KIND_TO_STATE[observation.kind];
  return createFedosDeliveryObservation(subjectId, state, observation.observedAt, observation.reason);
}
