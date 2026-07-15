/**
 * Secure Runtime Alpha 495 ("Observation Write Validator") — Stage 5 of
 * the Alpha 491–500 Canonical Publisher & Delivery Observation Contract
 * Reconciliation Arc.
 *
 * `FedosDeliveryObservationRepository` (`./fedos_delivery_observation_repository.js`,
 * Alpha 466) and `FedosDeliveryObservationQuery`
 * (`./fedos_delivery_observation_query.js`, Alpha 467) are BOTH
 * byte-for-byte UNCHANGED — this file adds a pure validation function
 * plus a composing decorator class around both, never a modification to
 * either.
 *
 * `validateFedosDeliveryObservationTransition` reads the subject's
 * current latest fact via the injected `Query` (Alpha 467's own
 * `currentStateFor()`, unchanged), applies
 * `isAllowedFedosDeliveryObservationTransition` (Alpha 494) for
 * structural legality, and separately rejects a candidate whose
 * `observedAt` is strictly earlier than the current fact's own
 * `observedAt` — the exact Alpha 483 §3 staleness gap this Stage
 * closes. It is PURE with respect to this file's own state (it performs
 * one read, no write) and NEVER throws.
 *
 * `FedosValidatingDeliveryObservationRepository.record()` runs that
 * validation BEFORE calling the real, unchanged
 * `FedosDeliveryObservationRepository.record()` — an invalid or stale
 * candidate never reaches the underlying Persistence layer, so the
 * Repository's own existing correct history can never be corrupted by a
 * rejected write attempt.
 *
 * HARD GUARDRAILS:
 *   - No import from `../outbox/*`, `../publish/*`, or any Relay/Board/
 *     Publisher file anywhere in this file.
 *   - `FedosDeliveryObservationRepository`/`FedosDeliveryObservationQuery`
 *     are imported as TYPE ONLY where possible and never subclassed —
 *     both are held as injected, composed dependencies.
 *   - No `delete`/update-in-place method exists on
 *     `FedosValidatingDeliveryObservationRepository` — `record()` is
 *     its ONLY write method, mirroring the underlying Repository's own
 *     discipline exactly.
 */

import type { FedosDeliveryObservationState, FedosDeliveryObservationSubjectId } from "./fedos_delivery_observation.js";
import type {
  FedosDeliveryObservationRepository,
  FedosDeliveryObservationRepositoryWriteResult,
} from "./fedos_delivery_observation_repository.js";
import type { FedosDeliveryObservationQuery } from "./fedos_delivery_observation_query.js";
import { isAllowedFedosDeliveryObservationTransition } from "./fedos_delivery_observation_transition_graph.js";

export type FedosDeliveryObservationValidatedWriteResult =
  | FedosDeliveryObservationRepositoryWriteResult
  | "invalid-transition"
  | "stale";

/**
 * Pure preview: does NOT write anything. Reads `query.currentStateFor(subjectId)`
 * and checks the candidate `(state, observedAt)` against it. Never throws.
 */
export function validateFedosDeliveryObservationTransition(
  query: FedosDeliveryObservationQuery,
  subjectId: FedosDeliveryObservationSubjectId,
  candidate: { readonly state: FedosDeliveryObservationState; readonly observedAt: number },
): "ok" | "invalid-transition" | "stale" {
  const current = query.currentStateFor(subjectId);
  const currentState: FedosDeliveryObservationState | null = current === null ? null : current.state;

  if (!isAllowedFedosDeliveryObservationTransition(currentState, candidate.state)) {
    return "invalid-transition";
  }
  if (current !== null && candidate.observedAt < current.observedAt) {
    return "stale";
  }
  return "ok";
}

export class FedosValidatingDeliveryObservationRepository {
  readonly #repository: FedosDeliveryObservationRepository;
  readonly #query: FedosDeliveryObservationQuery;

  constructor(repository: FedosDeliveryObservationRepository, query: FedosDeliveryObservationQuery) {
    this.#repository = repository;
    this.#query = query;
  }

  record(
    subjectId: FedosDeliveryObservationSubjectId,
    state: FedosDeliveryObservationState,
    observedAt: number,
    reason?: string,
  ): FedosDeliveryObservationValidatedWriteResult {
    const check = validateFedosDeliveryObservationTransition(this.#query, subjectId, { state, observedAt });
    if (check !== "ok") return check;
    return this.#repository.record(subjectId, state, observedAt, reason);
  }

  get(id: string) {
    return this.#repository.get(id);
  }

  list() {
    return this.#repository.list();
  }
}
