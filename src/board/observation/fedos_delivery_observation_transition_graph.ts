/**
 * Secure Runtime Alpha 494 ("State Transition Contract") — Stage 4 of
 * the Alpha 491–500 Canonical Publisher & Delivery Observation Contract
 * Reconciliation Arc.
 *
 * The FIXED, ENFORCED transition graph for `FedosDeliveryObservationState`
 * (`./fedos_delivery_observation.js`, Alpha 462, UNCHANGED):
 *
 *   queued -> publishing -> { accepted | rejected | failed }
 *
 * A subject with no prior observation may legally begin at EITHER
 * `queued` OR `publishing` (see the design doc §2 for why — a
 * Scheduler-sourced bridge never records an explicit `queued` fact).
 * Every terminal state (`accepted`/`rejected`/`failed`) is final — this
 * Arc adopts a single-attempt-per-`subjectId` model; ANY observation
 * after a terminal one is rejected, deliberately not designing
 * multi-attempt re-entry this Arc (design doc §4).
 *
 * HARD GUARDRAILS:
 *   - `FEDOS_DELIVERY_OBSERVATION_TRANSITIONS` and
 *     `isAllowedFedosDeliveryObservationTransition` are the ONLY
 *     exports.
 *   - Pure, synchronous data + a pure function — no I/O, no Repository
 *     reference, no Publisher reference of any kind.
 *   - Never mutated at runtime — the table itself is `Object.freeze`d.
 */

import type { FedosDeliveryObservationState } from "./fedos_delivery_observation.js";

const TERMINAL_STATES: ReadonlySet<FedosDeliveryObservationState> = new Set(["accepted", "rejected", "failed"]);

/** Every state's own set of legal NEXT states. Terminal states permit none. */
export const FEDOS_DELIVERY_OBSERVATION_TRANSITIONS: Readonly<
  Record<FedosDeliveryObservationState, readonly FedosDeliveryObservationState[]>
> = Object.freeze({
  queued: Object.freeze<FedosDeliveryObservationState[]>(["publishing"]),
  publishing: Object.freeze<FedosDeliveryObservationState[]>(["accepted", "rejected", "failed"]),
  accepted: Object.freeze<FedosDeliveryObservationState[]>([]),
  rejected: Object.freeze<FedosDeliveryObservationState[]>([]),
  failed: Object.freeze<FedosDeliveryObservationState[]>([]),
});

/**
 * `from === null` means "no prior observation exists for this subject"
 * — legal first states are `queued` and `publishing` only, never a
 * terminal state directly. Otherwise looks up `from` in
 * `FEDOS_DELIVERY_OBSERVATION_TRANSITIONS` and checks membership.
 */
export function isAllowedFedosDeliveryObservationTransition(
  from: FedosDeliveryObservationState | null,
  to: FedosDeliveryObservationState,
): boolean {
  if (from === null) {
    return to === "queued" || to === "publishing";
  }
  if (TERMINAL_STATES.has(from)) {
    return false;
  }
  return FEDOS_DELIVERY_OBSERVATION_TRANSITIONS[from].includes(to);
}
