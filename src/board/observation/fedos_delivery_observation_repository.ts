/**
 * Secure Runtime Alpha 466 ("Delivery Observation Repository") — Stage 6
 * of the Alpha 461–470 Canonical Delivery Observation Arc.
 *
 * `FedosDeliveryObservationRepository` is the WRITE-side owner of
 * `FedosDeliveryObservationPersistence`
 * (`./fedos_delivery_observation_persistence.js`, Alpha 464): the single
 * place that constructs a `FedosDeliveryObservation`
 * (`./fedos_delivery_observation.js`, Alpha 462), serializes it (Alpha
 * 463), and writes it — no caller anywhere else builds an Observation
 * record by hand. Mirrors `PersistedFedosBoardRepository`'s own bridging
 * role (`../persistence/persisted_fedos_board_repository.ts`, Alpha 317),
 * scoped to Observations only.
 *
 * `record()` never overwrites a prior Observation — an Observation is a
 * historical fact, never a mutable status; recording the SAME logical
 * fact twice (same `subjectId`/`state`/`observedAt`) is idempotent by
 * construction (Alpha 462's own deterministic id), never a second row.
 *
 * HARD GUARDRAILS:
 *   - No Board, Outbox, Publisher, Nostr, Relay, retry, backoff, pool, or
 *     GUI import of any kind anywhere in this file.
 *   - No delete, no update-in-place — `record()` is the ONLY write
 *     method.
 */

import {
  createFedosDeliveryObservation,
  type FedosDeliveryObservation,
  type FedosDeliveryObservationState,
  type FedosDeliveryObservationSubjectId,
} from "./fedos_delivery_observation.js";
import {
  serializeFedosDeliveryObservation,
  deserializeFedosDeliveryObservation,
} from "./fedos_delivery_observation_codec.js";
import type { FedosDeliveryObservationPersistence } from "./fedos_delivery_observation_persistence.js";

/**
 * The result of one `record()` call:
 *   - `"recorded"`: a genuinely new Observation was accepted.
 *   - `"already-present"`: the identical logical fact was recorded again
 *     — idempotent, no new row.
 *   - `"conflict"`: the derived id collided with a DIFFERENT stored
 *     record (see `FedosDeliveryObservationPersistence`'s own
 *     `"conflict"`, Alpha 464) — should not occur in practice, since the
 *     id is a pure function of the three inputs, but is surfaced rather
 *     than swallowed.
 *   - `"failed"`: the backend itself could not complete the write.
 *   - `"invalid"`: `subjectId`/`state`/`observedAt`/`reason` failed
 *     `createFedosDeliveryObservation`'s own validation — fails closed,
 *     never throws.
 */
export type FedosDeliveryObservationRepositoryWriteResult =
  | "recorded"
  | "already-present"
  | "conflict"
  | "failed"
  | "invalid";

export class FedosDeliveryObservationRepository {
  readonly #persistence: FedosDeliveryObservationPersistence;

  constructor(persistence: FedosDeliveryObservationPersistence) {
    this.#persistence = persistence;
  }

  record(
    subjectId: FedosDeliveryObservationSubjectId,
    state: FedosDeliveryObservationState,
    observedAt: number,
    reason?: string,
  ): FedosDeliveryObservationRepositoryWriteResult {
    const observation = createFedosDeliveryObservation(subjectId, state, observedAt, reason);
    if (observation === null) return "invalid";

    const result = this.#persistence.putObservation(serializeFedosDeliveryObservation(observation));
    return result === "inserted" ? "recorded" : result;
  }

  get(id: string): FedosDeliveryObservation | null {
    const record = this.#persistence.getObservation(id);
    if (record === null) return null;
    return deserializeFedosDeliveryObservation(record);
  }

  /** Skips (never throws on) any corrupt stored record — a pure, best-effort read. */
  list(): readonly FedosDeliveryObservation[] {
    const observations: FedosDeliveryObservation[] = [];
    for (const record of this.#persistence.listObservations()) {
      const observation = deserializeFedosDeliveryObservation(record);
      if (observation !== null) observations.push(observation);
    }
    return observations;
  }
}
