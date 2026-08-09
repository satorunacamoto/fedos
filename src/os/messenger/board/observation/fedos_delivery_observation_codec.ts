/**
 * Secure Runtime Alpha 463 ("Persisted Delivery Observation Record V1 and
 * Codec") — Stage 3 of the Alpha 461–470 Canonical Delivery Observation
 * Arc.
 *
 * `FedosPersistedDeliveryObservationRecordV1` is the STABLE WIRE SHAPE the
 * Observation persistence layer writes to a backend — deliberately NOT the
 * branded runtime `FedosDeliveryObservation`
 * (`./fedos_delivery_observation.ts`, Alpha 462) itself, mirroring
 * `FedosPersistedBoardOutboxRecordV1`'s own identical relationship to
 * `FedosBoardOutboxIntent` (`../outbox/fedos_board_outbox_codec.ts`, Alpha
 * 416).
 *
 * `serializeFedosDeliveryObservation`/`deserializeFedosDeliveryObservation`
 * are the ONLY two functions permitted to convert between the two:
 * deserialize fails closed to `null` for anything malformed, never
 * throws; `schemaVersion` is checked EXACTLY against `1`; unknown
 * top-level fields are REJECTED, not silently ignored; no implicit
 * coercion.
 *
 * HARD GUARDRAILS:
 *   - `deserializeFedosDeliveryObservation` never throws.
 *   - No silent migration: an unrecognized `schemaVersion` is rejected,
 *     never guessed at.
 *   - `serializeFedosDeliveryObservation` never shares a reference with
 *     `observation` — a fresh plain object every call.
 */

import {
  createFedosDeliveryObservation,
  isFedosDeliveryObservationState,
  toFedosDeliveryObservationSubjectId,
  type FedosDeliveryObservation,
  type FedosDeliveryObservationState,
} from "./fedos_delivery_observation.js";

export interface FedosPersistedDeliveryObservationRecordV1 {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly subjectId: string;
  readonly state: FedosDeliveryObservationState;
  readonly observedAt: number;
  readonly reason?: string;
}

/** Copies `observation` into the persisted V1 wire shape. Never shares a reference with `observation`. */
export function serializeFedosDeliveryObservation(
  observation: FedosDeliveryObservation,
): FedosPersistedDeliveryObservationRecordV1 {
  return observation.reason === undefined
    ? {
        schemaVersion: 1,
        id: observation.id,
        subjectId: observation.subjectId,
        state: observation.state,
        observedAt: observation.observedAt,
      }
    : {
        schemaVersion: 1,
        id: observation.id,
        subjectId: observation.subjectId,
        state: observation.state,
        observedAt: observation.observedAt,
        reason: observation.reason,
      };
}

const TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
  "schemaVersion",
  "id",
  "subjectId",
  "state",
  "observedAt",
  "reason",
]);

function hasOnlyAllowedKeys(value: object, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

interface RawTopLevelFields {
  readonly schemaVersion: unknown;
  readonly id: unknown;
  readonly subjectId: unknown;
  readonly state: unknown;
  readonly observedAt: unknown;
  readonly reason: unknown;
}

/**
 * Fails closed to `null` for any malformed, unrecognized-schema, or
 * corrupt input. Reuses `createFedosDeliveryObservation` (Alpha 462) for
 * the final construction/validation step, never re-implementing its
 * checks. Deliberately does NOT trust the record's own `id` field
 * blindly: it re-derives the id from `subjectId`/`state`/`observedAt` via
 * `createFedosDeliveryObservation` -> `makeFedosDeliveryObservationId`,
 * and rejects the record if the stored `id` does not match — a tampered
 * or hand-edited log line can never resurrect a mismatched id.
 */
export function deserializeFedosDeliveryObservation(record: unknown): FedosDeliveryObservation | null {
  if (record === null || typeof record !== "object") return null;
  if (!hasOnlyAllowedKeys(record, TOP_LEVEL_KEYS)) return null;

  const { schemaVersion, id, subjectId, state, observedAt, reason } = record as RawTopLevelFields;

  if (schemaVersion !== 1) return null;
  if (typeof id !== "string") return null;
  if (typeof subjectId !== "string") return null;
  if (typeof state !== "string" || !isFedosDeliveryObservationState(state)) return null;
  if (typeof observedAt !== "number") return null;
  if (reason !== undefined && typeof reason !== "string") return null;

  const brandedSubjectId = toFedosDeliveryObservationSubjectId(subjectId);
  if (brandedSubjectId === null) return null;

  const observation = createFedosDeliveryObservation(brandedSubjectId, state, observedAt, reason);
  if (observation === null) return null;
  if (observation.id !== id) return null;

  return observation;
}
